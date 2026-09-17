import React, { useState, useRef, useEffect, useMemo } from 'react';
import Map, { Source, Layer, Marker } from 'react-map-gl';
import { Home, ShieldAlert } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useAuraData } from './hooks/useAuraData';
import { HudPanel } from './components/HudPanel';
import { ImpactAnalysisPanel } from './components/ImpactAnalysisPanel';
import ThreeDSimulationPage from './ThreeDSimulationPage';
import { triggerDataDownload } from './utils/exportGeospatialData';
import { runLocalTriage, getModel } from './utils/edgeEngine';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';
const HOME_COORDINATES = { longitude: -76.78, latitude: 17.95, zoom: 11 };

// --- MAP STYLE LAYERS ---
export const substationLayer = {
  id: 'substation-layer',
  type: 'circle',
  paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 5, 15, 12],
    'circle-color': [
      'interpolate',
      ['linear'],
      ['coalesce', ['get', 'threat_index'], 0],
      0, '#10b981',  // Stable / Safe (Emerald)
      4, '#f59e0b',  // Elevated (Amber)
      8, '#ef4444',  // Severe (Red)
      11, '#b91c1c'  // Critical (Crimson)
    ],
    'circle-stroke-width': 2,
    'circle-stroke-color': '#ffffff',
    'circle-opacity': 0.9
  }
};

const marinePolygonLayer = {
  id: 'marine-anomaly-polygon-layer',
  type: 'fill',
  paint: {
    'fill-color': '#f59e0b',
    'fill-opacity': 0.15,
    'fill-outline-color': '#fbbf24'
  }
};

const marineGlowLayer = {
  id: 'marine-anomaly-glow-layer',
  type: 'circle',
  paint: {
    'circle-radius': [
      'interpolate', ['exponential', 2], ['zoom'],
      10, ['match', ['get', 'status'], 'CRITICAL_STORM_INCUBATION', 105, 60],
      13, ['match', ['get', 'status'], 'CRITICAL_STORM_INCUBATION', 210, 120],
      16, ['match', ['get', 'status'], 'CRITICAL_STORM_INCUBATION', 420, 240]
    ],
    'circle-color': '#f59e0b',
    'circle-opacity': 0.08,
    'circle-stroke-width': 1.5,
    'circle-stroke-color': '#fbbf24',
    'circle-stroke-opacity': 0.4
  }
};

const inundationLayer = {
  id: 'inundation-layer',
  type: 'fill',
  paint: {
    'fill-color': '#3b82f6',
    'fill-opacity': 0.4
  }
};

// Updated to visually indicate impassable dynamic route cascades
const routingLayer = {
  id: 'routing-layer',
  type: 'line',
  layout: {
    'line-join': 'round',
    'line-cap': 'round'
  },
  paint: {
    'line-color': [
      'match',
      ['get', 'status'],
      'IMPASSABLE', '#ef4444', // Red for blocked roads
      'OPEN', '#10b981',       // Emerald green for cleared routes
      '#8b5cf6'                // Fallback Purple
    ],
    'line-width': [
      'match',
      ['get', 'urgency'],
      'CRITICAL', 6,
      'HIGH', 4,
      2
    ],
    'line-dasharray': [2, 1.5],
  }
};

const structuralFootprintLayer = {
  id: 'usa-structures-extruded',
  type: 'fill-extrusion',
  paint: {
    'fill-extrusion-color': [
      'match',
      ['get', 'usage_type'],
      'GOVERNMENTAL', '#f43f5e',
      'COMMERCIAL', '#fb923c',
      'RESIDENTIAL', '#38bdf8',
      '#94a3b8'
    ],
    'fill-extrusion-height': ['get', 'height_meters'],
    'fill-extrusion-base': 0,
    'fill-extrusion-opacity': 0.85
  }
};

const getLogisticsBlurb = (facilityName, urgency) => {
  const name = String(facilityName || '').toLowerCase();
  if (urgency === 'CRITICAL') {
    if (name.includes("kitchen")) return {
      text: "Supply chain bottleneck at food preparation site. Immediate risk of caloric deficit.",
      action: "DEPLOY: Mobile distribution fleet."
    };
    if (name.includes("hub")) return {
      text: "Communication node compromised. Islanded communities losing situational oversight.",
      action: "DEPLOY: Satellite comms relay unit."
    };
    return {
      text: "Relief station capacity reached. Critical backlog in emergency aid throughput.",
      action: "DEPLOY: Secondary triage field unit."
    };
  }
  return {
    text: "Operational status nominal. Maintaining flow of essential resources.",
    action: "STATUS: Steady state operations."
  };
};

export default function App() {
  const { state: globalState, setters, data, geoJson } = useAuraData();

  const [reportText, setReportText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [showMarineLayer, setShowMarineLayer] = useState(false);
  const [showRoutingLayer, setShowRoutingLayer] = useState(false);
  const [showImpactAnalysis, setShowImpactAnalysis] = useState(false);
  const [currentTimeStep, setCurrentTimeStep] = useState(0);
  const [currentAlert, setCurrentAlert] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  const mapRef = useRef(null);
  const tickerRef = useRef(null);

  const [viewState, setViewState] = useState({
    longitude: -76.78, latitude: 17.95, zoom: 11, pitch: 35
  });

  useEffect(() => {
    return () => { if (tickerRef.current) clearInterval(tickerRef.current); };
  }, []);

  useEffect(() => {
    async function prepareEdge() {
      try {
        await getModel('triage');
        setModelReady(true);
      } catch (err) {
        console.error("Edge model failed to initialize:", err);
      }
    }
    prepareEdge();
  }, []);

  const structuralStats = useMemo(() => {
    const baseCurve = [0.08, 0.22, 0.41, 0.58, 0.72, 0.85, 0.93, 1.02, 1.08, 1.12, 1.15, 1.18];
    const multiplier = (globalState.windSpeed / 90) + (globalState.slrMeters * 0.2);
    const activeProfile = baseCurve.map(depth => depth * (multiplier > 0 ? multiplier : 1));
    const currentDepth = activeProfile[currentTimeStep];

    return {
      historicalDepthProfile: activeProfile,
      carsRisk: currentDepth > 0.3 ? Math.floor(14 * (currentTimeStep + 1) * 0.6) : 0,
      suvRisk: currentDepth > 0.6 ? Math.floor(8 * (currentTimeStep + 1) * 0.5) : 0,
      structuralFailure: currentDepth > 0.9 ? Math.floor(4 * (currentTimeStep - 4)) : 0,
      criticalTotal: 4,
      commercialTotal: 8,
      criticalBreached: globalState.windSpeed > 75 ? 3 : globalState.windSpeed > 55 ? 1 : 0,
      commercialBreached: globalState.windSpeed > 85 ? 6 : globalState.windSpeed > 60 ? 2 : 0,
      highRiskPercent: Math.min(100, Math.round((globalState.windSpeed * 0.8) + (globalState.slrMeters * 5)))
    };
  }, [currentTimeStep, globalState.windSpeed, globalState.slrMeters]);

  const usaStructuresLayerConfig = useMemo(() => {
    const depthFactor = structuralStats.historicalDepthProfile[currentTimeStep];
    return {
      id: 'usa-structures-extruded-3d',
      type: 'fill-extrusion',
      paint: {
        'fill-extrusion-color': depthFactor > 0.9 ? '#f43f5e' : depthFactor > 0.6 ? '#fb923c' : depthFactor > 0.3 ? '#facc15' : '#38bdf8',
        'fill-extrusion-height': ['coalesce', ['get', 'height_meters'], 4],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.85
      }
    };
  }, [currentTimeStep, structuralStats]);

  const handlePanToTarget = (lng, lat) => {
    if (!lng || !lat) return;
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 12.5, essential: true, duration: 2000 });
  };

  const triggerResilientOrchestrationStory = () => {
    if (tickerRef.current) clearInterval(tickerRef.current);

    setters.setIsSimulating(true);
    setters.setWindSpeed(88);
    setters.setSlrMeters(2.5);
    setters.setHurricaneIntensity(5);

    setShowImpactAnalysis(true);
    setShowRoutingLayer(false);
    setCurrentTimeStep(0);
    setCurrentAlert("Category 4 Hurricane Outer Bands reaching Jamaica. Commencing live operational monitoring.");

    const simulationTimeline = [
      { step: 1, alert: "Storm front tightening. Sea state telemetry indices elevating across shelf." },
      { step: 3, alert: "Storm surge rising to 1.5m. Palisadoes runway links experiencing initial breach." },
      { step: 5, alert: "CRITICAL: Kingston Harbor waterfront layout reporting surge immersion." },
      { step: 7, alert: "AI Triage Engine: High risk of structural asset failure predicted across lower grid." },
      { step: 9, alert: "MAXIMUM BREACH: Surge peaking at 4.5m. Automating utility isolation protocols." },
      { step: 11, alert: "Triage Complete. Crisis footprint successfully compiled. Triggering localized AI transcription." }
    ];

    tickerRef.current = setInterval(async () => {
      let currentStepValue;

      setCurrentTimeStep(prevStep => {
        const nextStep = prevStep + 1;
        currentStepValue = nextStep;
        const matchingMilestone = simulationTimeline.find(item => item.step === nextStep);
        if (matchingMilestone) setCurrentAlert(matchingMilestone.alert);
        if (nextStep >= 11) clearInterval(tickerRef.current);
        return nextStep;
      });

      if (currentStepValue >= 11) {
        clearInterval(tickerRef.current);
        const layoutPanels = Array.from(document.querySelectorAll('details'));
        const transcriberPanel = layoutPanels.find(el => el.querySelector('h2')?.textContent?.toLowerCase().includes('logistics transcriber'));

        if (transcriberPanel) transcriberPanel.open = true;

        setTimeout(() => {
          const incidentReport = "CRITICAL INUNDATION: Severe coastal flooding and flash surge overtopping the entire Palisadoes sector. Massive sea water drowning out lower surface zones.";
          let currentCharacterIndex = 0;
          setReportText("");
          setIsProcessing(true);

          const typeWriterTimer = setInterval(async () => {
            setReportText(() => incidentReport.substring(0, currentCharacterIndex + 1));
            currentCharacterIndex++;

            if (currentCharacterIndex >= incidentReport.length) {
              clearInterval(typeWriterTimer);
              try {
                let tacticalPlaybook = "";
                if (globalState.airGapped) {
                  const result = await runLocalTriage(incidentReport, globalState);
                  tacticalPlaybook = result.actionable_tactical_playbook;
                  if (result.matched_node_threat_index !== null) setters.setActiveThreatIndex(result.matched_node_threat_index);
                } else {
                  const formData = new FormData();
                  formData.append('text', incidentReport);
                  formData.append('air_gapped', 'false');
                  const response = await fetch('https://aura-resilience-platform-qa.onrender.com/api/v1/voice/report', { method: 'POST', body: formData });
                  const resData = await response.json();
                  tacticalPlaybook = resData.actionable_tactical_playbook;
                }

                alert(`[AURA EDGE PLAYBOOK] \n\n${tacticalPlaybook}`);
                if (transcriberPanel) transcriberPanel.open = false;
                setShowImpactAnalysis(false); 
                setShowRoutingLayer(true);
              } catch (err) {
                console.error("Automated triage integration runner failure:", err);
              } fontFinally: {
                setIsProcessing(false);
              }
            }
          }, 35);
        }, 600);
      }
    }, 2000);
  };

  const handleProcessTransmission = async () => {
    if (!reportText.trim()) return;
    setIsProcessing(true);

    if (globalState.airGapped) {
      try {
        const result = await runLocalTriage(reportText, globalState);
        alert(`${result.actionable_tactical_playbook}`);
        setters.setActiveThreatIndex(result.matched_node_threat_index);
      } catch (err) {
        console.error("Edge Engine Error:", err);
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    try {
      const formData = new FormData();
      formData.append('text', reportText);
      formData.append('air_gapped', 'false');

      const response = await fetch('https://aura-resilience-platform-qa.onrender.com/api/v1/voice/report', { method: 'POST', body: formData });
      const resData = await response.json();
      if (resData.status === 'success') {
        if (resData.matched_node_threat_index !== null) setters.setActiveThreatIndex(resData.matched_node_threat_index);
        alert(`Triage Complete: ${resData.triage_incident_profile}\nPlaybook: ${resData.actionable_tactical_playbook}`);
      }
    } catch (err) {
      console.error('Transmission processing failure:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Directly consume FeatureCollections from useAuraData
  const sanitizedSubstations = geoJson?.compiledSubstationGeoJson || { type: "FeatureCollection", features: [] };
  const sanitizedInundation = geoJson?.inundationGeoJson || { type: "FeatureCollection", features: [] };
  const activeMarineFeatures = geoJson?.compiledMarineGeoJson?.features || [];
  const activeRoutingGeoJson = data?.routingGeoJson || { type: "FeatureCollection", features: [] };

  return (
    <div className="relative w-screen min-h-screen md:h-screen md:overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {globalState.isSimulating && currentAlert && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-[100] w-11/12 max-w-2xl bg-slate-950/95 border border-cyan-500/40 text-cyan-400 px-5 py-3.5 rounded-xl shadow-[0_0_30px_rgba(6,182,212,0.15)] backdrop-blur-md flex items-center gap-4 pointer-events-auto animate-pulse">
          <div className="h-2 w-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
          <p className="text-xs font-mono tracking-wide leading-relaxed">{currentAlert}</p>
        </div>
      )}

      {/* MAP UNDERLAY */}
      <div className="absolute top-0 left-0 w-full h-[40vh] md:h-full z-0 pointer-events-auto">
        <Map
          {...viewState}
          ref={mapRef}
          onMove={evt => setViewState(evt.viewState)}
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          style={{ width: '100%', height: '100%' }}
        >
          {/* Storm Surge Inundation */}
          <Source id="inundation-data" type="geojson" data={sanitizedInundation}>
            <Layer {...inundationLayer} />
          </Source>

          {/* Mutual Aid Routes */}
          {showRoutingLayer && activeRoutingGeoJson.features?.length > 0 && (
            <Source id="routing-data" type="geojson" data={activeRoutingGeoJson}>
              <Layer {...routingLayer} />
              <Layer
                id="routing-labels"
                type="symbol"
                layout={{
                  'text-field': ['get', 'urgency'],
                  'text-size': 10,
                  'text-offset': [0, -1],
                  'text-anchor': 'bottom',
                  'symbol-placement': 'line'
                }}
                paint={{ 'text-color': '#ffffff' }}
              />
            </Source>            
          )}

          {/* Destination Pins */}
          {showRoutingLayer && activeRoutingGeoJson.features.map((feature, idx) => {
            const coords = feature.geometry?.coordinates;
            if (!coords || coords.length === 0) return null;
            const [lng, lat] = coords[coords.length - 1];
            const shelterName = feature.properties?.destination_shelter || 'Shelter Destination';
            const urgencyLevel = feature.properties?.urgency || 'HIGH';
            const isCritical = urgencyLevel === 'CRITICAL';

            return (
              <Marker key={feature.properties?.id || `shelter-marker-${idx}`} longitude={lng} latitude={lat} anchor="bottom">
                <div className="flex flex-col items-center group pointer-events-auto cursor-pointer">
                  <div className="hidden group-hover:flex flex-col bg-slate-950/95 border border-purple-500/40 text-slate-100 font-mono text-[10px] px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap mb-1">
                    <span className="font-bold text-purple-300">🏠 {shelterName}</span>
                    <span className={`text-[8px] font-semibold ${isCritical ? 'text-rose-400' : 'text-amber-400'}`}>
                      URGENCY: {urgencyLevel}
                    </span>
                  </div>
                  <div className="relative flex items-center justify-center">
                    <span className={`absolute h-6 w-6 rounded-full animate-ping ${isCritical ? 'bg-rose-500/40' : 'bg-purple-500/40'}`} />
                    <div className="h-7 w-7 rounded-full bg-slate-950 border-2 border-purple-400 flex items-center justify-center text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.6)]">
                      <Home size={13} />
                    </div>
                  </div>
                </div>
              </Marker>
            );
          })}

          {/* Marine Telemetry */}
          {showMarineLayer && activeMarineFeatures.length > 0 && (
            <Source id="marine-data" type="geojson" data={{ type: "FeatureCollection", features: activeMarineFeatures }}>
              <Layer {...marinePolygonLayer} />
              <Layer {...marineGlowLayer} />
            </Source>
          )}

          {/* Grid Substation Nodes */}
          <Source id="substation-data" type="geojson" data={sanitizedSubstations}>
            <Layer {...substationLayer} />
          </Source>

          {/* 3D Extrusions */}
          {showImpactAnalysis && geoJson?.structuresGeoJson && (
            <Source id="fema-structures" type="geojson" data={geoJson.structuresGeoJson}>
              <Layer {...usaStructuresLayerConfig} />
              <Layer {...structuralFootprintLayer} id="usa-structures-base" />
            </Source>
          )}
        </Map>

        {globalState.isSimulating && typeof ThreeDSimulationPage === 'function' && (
          <div className="absolute inset-0 z-10 pointer-events-none mix-blend-screen opacity-40">
             <ThreeDSimulationPage 
               currentTimeStep={currentTimeStep}
               geoData={geoJson?.structuresGeoJson}
               simulationArgs={{
                 slrMeters: globalState.slrMeters,
                 windSpeed: globalState.windSpeed,
                 threatIndex: globalState.activeThreatIndex
               }}
             />
          </div>
        )}
      </div>

      {/* FOREGROUND HUD LAYOUT */}
      <div className="relative md:absolute inset-0 z-30 pt-[42vh] md:pt-0 p-4 md:p-6 pointer-events-none grid grid-cols-1 md:grid-cols-12 md:grid-rows-[auto_1fr_auto] h-full gap-4">
        {/* HEADER BAR */}
        <header className="col-span-1 md:col-span-12 h-14 bg-slate-900/80 backdrop-blur-md border border-white/5 rounded-xl flex items-center justify-between px-6 pointer-events-auto order-first md:order-none">
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${globalState.gridState === 'NOMINAL' ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`} />
            <h1 className="text-sm font-bold tracking-widest text-white uppercase">AURA Command Center</h1>
          </div>
          <div className="flex items-center gap-6 font-mono text-xs text-slate-400">
            <div className="relative inline-block text-left">
              <button onClick={() => setIsOpen(!isOpen)} className="bg-white/5 hover:bg-white/10 text-[10px] text-slate-300 px-3 py-1.5 rounded border border-white/10 flex items-center gap-1.5">
                <span>EXPORT GIS DATA</span>
                <span className="text-[8px] text-slate-400">▼</span>
              </button>
              {isOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-700 rounded shadow-xl z-50">
                  <div className="py-1">
                    <button onClick={() => { triggerDataDownload(activeMarineFeatures, 'aura_marine_telemetry', 'geojson'); setIsOpen(false); }} className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-emerald-400 font-mono">
                      GeoJSON Feature Collection
                    </button>
                    <button onClick={() => { triggerDataDownload(activeMarineFeatures, 'aura_stac_catalog', 'stac'); setIsOpen(false); }} className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-emerald-400 font-mono border-t border-slate-800">
                      STAC 1.0.0 Metadata Catalog
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!globalState.airGapped}
                onChange={(e) => setters.setAirGapped(e.target.checked)}
                className="rounded bg-slate-950 border-white/10 text-purple-600 focus:ring-0 w-3 h-3"
              />
              <span>AIR_GAPPED_MODE</span>
            </label>
          </div>
        </header>

        {/* LEFT CONTROL COLUMN */}
        <div className="col-span-1 md:col-span-3 flex flex-col gap-4 pointer-events-auto overflow-y-auto">
          <div>
            <button onClick={triggerResilientOrchestrationStory} className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors mb-2">
              <ShieldAlert size={18} /> {globalState.isSimulating ? "Simulation Active..." : "Simulate Hurricane Impact"}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { if (tickerRef.current) clearInterval(tickerRef.current); setCurrentAlert(null); if (window.confirm("Purge local session data?")) setters.resetAuraState(); }} className="bg-rose-900/30 hover:bg-rose-900/60 text-rose-500 text-[10px] px-3 py-1.5 rounded border border-rose-900/50">
                System Reset
              </button>
              <button onClick={() => { if (tickerRef.current) clearInterval(tickerRef.current); setCurrentAlert(null); if (globalState.isSimulating) setters.setIsSimulating(false); mapRef.current?.flyTo({ center: [HOME_COORDINATES.longitude, HOME_COORDINATES.latitude], zoom: HOME_COORDINATES.zoom, essential: true, duration: 1500 }); }} className="bg-white/5 hover:bg-white/10 text-[10px] text-slate-300 px-3 py-1.5 rounded border border-white/10">
                Reset Map View
              </button>
            </div>
          </div>

          {!showImpactAnalysis ? (
            <HudPanel title="Storm Tracker">
              <div className="text-[10px] text-slate-300 space-y-2"><p>No active storm front selected.</p></div>
            </HudPanel>
          ) : (
            <ImpactAnalysisPanel
              currentTimeStep={currentTimeStep}
              onTimeStepChange={(newStep) => { if (tickerRef.current) clearInterval(tickerRef.current); setCurrentTimeStep(newStep); }}
              structuralStats={structuralStats}
              onClose={() => { if (tickerRef.current) clearInterval(tickerRef.current); setCurrentAlert(null); setShowImpactAnalysis(false); setters.setIsSimulating(false); }}
            />
          )}

          <HudPanel title="Logistics & Mutual Aid" onToggle={setShowRoutingLayer}>
            <div className="max-h-56 overflow-y-auto pr-2 space-y-2">
              {(activeRoutingGeoJson.features || []).map((route, i) => {
                const originKitchen = route.properties?.origin_kitchen || 'Origin Hub';
                const destShelter = route.properties?.destination_shelter || 'Destination Shelter';
                const urgency = route.properties?.urgency || 'LOW';
                const blurb = getLogisticsBlurb(originKitchen, urgency);
                return (
                  <div key={i} className="bg-slate-900/50 p-3 rounded border border-white/10 text-[10px] font-mono">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-emerald-400 font-bold">{originKitchen}</span>
                      <span className="text-slate-500">to</span>
                      <span className="text-purple-400 font-bold">{destShelter}</span>
                    </div>
                    <p className="text-slate-300 leading-tight mb-2 italic">"{blurb.text}"</p>
                    <div className="bg-slate-950 p-1.5 rounded border border-purple-500/30 text-purple-300 font-bold uppercase text-[9px]">
                      {blurb.action}
                    </div>
                  </div>
                );
              })}
            </div>
          </HudPanel>
        </div>

        {/* CENTER SPACER */}
        <div className="hidden md:block md:col-span-6" />

        {/* RIGHT CONTROL COLUMN */}
        <div className="col-span-1 md:col-span-3 flex flex-col gap-4 pointer-events-auto overflow-y-auto">
          <HudPanel title="JPS Grid Status">
            <div className="max-h-48 overflow-y-auto pr-2 space-y-2">
              {sanitizedSubstations.features.map(feat => {
                const props = feat.properties || {};
                const coords = feat.geometry?.coordinates;
                return (
                  <details key={props.id} className="bg-slate-900/50 p-2 rounded border border-white/5 cursor-pointer group" onToggle={(e) => { if (e.currentTarget.open && coords) handlePanToTarget(coords[0], coords[1]); }}>
                    <summary className="text-[11px] font-mono text-emerald-400 list-none flex justify-between items-center select-none">
                      <span>{props.name}</span>
                      <span className="text-slate-500 group-open:rotate-180 transition-transform text-[9px]">▼</span>
                    </summary>
                    <div className="text-[10px] text-slate-400 mt-2 border-t border-white/5 pt-2 font-mono space-y-1">
                      <div>Status: <span className={props.status?.toUpperCase().includes('CRITICAL') ? 'text-rose-400' : 'text-emerald-300'}>{props.status}</span></div>
                      <div>Threat Index: <span className="text-amber-400 font-bold">{props.threat_index ?? 0}</span></div>
                    </div>
                  </details>
                );
              })}
            </div>
          </HudPanel>

          <HudPanel title="Environmental Vectors">
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-slate-400 font-mono"><span>Wind Field</span><span className="text-emerald-400">{globalState.windSpeed} MPH</span></div>
              <input type="range" min="10" max="100" value={globalState.windSpeed} onChange={(e) => setters.setWindSpeed(Number(e.target.value))} className="w-full accent-emerald-400 cursor-pointer" />
            </div>
            <div className="space-y-1 pt-2">
              <div className="flex justify-between text-[10px] text-slate-400 font-mono"><span>Sea Level Surge</span><span className="text-emerald-400">+{globalState.slrMeters}m</span></div>
              <input type="range" min="0" max="3" step="0.5" value={globalState.slrMeters} onChange={(e) => setters.setSlrMeters(Number(e.target.value))} className="w-full accent-emerald-400 cursor-pointer" />
            </div>
            {globalState.activeThreatIndex !== null && (
              <button onClick={() => setters.setActiveThreatIndex(null)} className="mt-2 text-[9px] font-mono text-rose-400 hover:underline block text-left">
                Clear Override Threat Node (Index: {globalState.activeThreatIndex})
              </button>
            )}
          </HudPanel>

          <HudPanel title="Oceanographic Watchdog" onToggle={setShowMarineLayer}>
            <div className="max-h-56 overflow-y-auto pr-2 space-y-2">
              {activeMarineFeatures.map((m, i) => {
                const locName = m.properties?.location_name || 'Anomalous Region';
                const tempAnomaly = m.properties?.surface_temp_anomaly_celsius || 0;
                const impact = m.properties?.economic_impact || {};
                const geomCoords = m.geometry?.coordinates;

                return (
                  <details key={i} className="bg-slate-900/50 p-2 rounded border border-white/5 cursor-pointer group" onToggle={(e) => { if (e.currentTarget.open && geomCoords && !globalState.isSimulating) handlePanToTarget(geomCoords[0], geomCoords[1]); }}>
                    <summary className="text-[10px] font-mono list-none flex justify-between items-center select-none">
                      <span className="font-bold text-slate-200 group-hover:text-teal-400">{locName}</span>
                      <span className="text-teal-400 font-bold">+{tempAnomaly}°C</span>
                    </summary>
                    <div className="bg-slate-950/60 p-2 mt-2 rounded border border-teal-500/20 font-mono space-y-1">
                      <div className="text-[9px] uppercase text-teal-400 font-bold flex justify-between">
                        <span>Risk Exposure:</span>
                        <span className="text-emerald-400">${(impact.total_risk_exposure_usd || 0).toLocaleString()} USD</span>
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          </HudPanel>          
        </div>

        {/* VOICE TRANSCRIPTION PANEL */}
        <div className="col-span-1 md:col-span-12 z-[60] pointer-events-auto mt-auto">
          <HudPanel title="Logistics Transcriber">
            <div className="flex gap-2">
              <textarea
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                placeholder={modelReady || !globalState.airGapped ? "Enter incident report (e.g., 'Palisadoes line is underwater down south')..." : "Loading AI model..."}
                disabled={!modelReady && globalState.airGapped}
                className="flex-grow h-14 bg-slate-950/50 border border-white/10 rounded p-2 text-xs text-slate-200 resize-none font-sans outline-none focus:border-purple-500"
              />
              <button
                type="button"
                onClick={handleProcessTransmission}
                disabled={isProcessing || (!modelReady && globalState.airGapped)}
                className="bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 text-[10px] px-4 py-2 rounded font-bold uppercase transition-colors text-white whitespace-nowrap"
              >
                {isProcessing ? 'Processing...' : 'Process'}
              </button>
            </div>
          </HudPanel>
        </div>
      </div>
    </div>
  );
}