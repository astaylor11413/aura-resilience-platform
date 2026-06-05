import React, { useState, useRef, useEffect, useMemo } from 'react';
import Map, { Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useAuraData } from './hooks/useAuraData';
import { HudPanel } from './components/HudPanel';
import { ImpactAnalysisPanel } from './components/ImpactAnalysisPanel';
import { ShieldAlert } from 'lucide-react';
import ThreeDSimulationPage from './ThreeDSimulationPage';
import {
  runLocalTriage,
  runLocalGridSimulation,
  runLocalInundation,
  runLocalMarineTelemetry,
  getModel
} from './utils/edgeEngine';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';
const HOME_COORDINATES = {
  longitude: -76.78,
  latitude: 17.95,
  zoom: 11
};

// --- STATIC MAP STYLE LAYERS ---
const substationLayer = {
  id: 'substations-layer',
  type: 'circle',
  paint: {
    'circle-radius': 8,
    'circle-color': [
      'match',
      ['get', 'status'],
      'critical', '#f43f5e',
      '#10b981'
    ],
    'circle-stroke-width': 2,
    'circle-stroke-color': '#ffffff'
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
      ['get', 'urgency'],
      'CRITICAL', '#ef4444',
      'HIGH', '#f97316',
      '#8b5cf6'
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
  const isKitchen = name.includes("kitchen");
  const isHub = name.includes("hub");

  if (urgency === 'CRITICAL') {
    if (isKitchen) return {
      text: "Supply chain bottleneck at food preparation site. Immediate risk of caloric deficit in shelter zones.",
      action: "DEPLOY: Mobile distribution fleet."
    };
    if (isHub) return {
      text: "Communication and coordination node compromised. Islanded communities are losing situational oversight.",
      action: "DEPLOY: Satellite comms relay unit."
    };
    return {
      text: "Medical/Supply relief station capacity reached. Critical backlog in emergency aid throughput.",
      action: "DEPLOY: Secondary triage field unit."
    };
  }
  return {
    text: "Operational status nominal. Maintaining flow of essential resources to designated zones.",
    action: "STATUS: Steady state operations."
  };
};

export default function App() {
  // Global context destructuring
  const { state: globalState, setters, data, geoJson } = useAuraData();
  
  // Local UI and telemetry states
  const [reportText, setReportText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [showMarineLayer, setShowMarineLayer] = useState(false);
  const [showRoutingLayer, setShowRoutingLayer] = useState(false);
  const [showImpactAnalysis, setShowImpactAnalysis] = useState(false);
  const [currentTimeStep, setCurrentTimeStep] = useState(0);
  const [currentAlert, setCurrentAlert] = useState(null);

  const mapRef = useRef(null);
  const tickerRef = useRef(null);

  const [viewState, setViewState] = useState({
    longitude: -76.78, latitude: 17.95, zoom: 11, pitch: 35
  });

  // Clean up timers on component unmount
  useEffect(() => {
    return () => { if (tickerRef.current) clearInterval(tickerRef.current); };
  }, []);

  // Model Warm-up
  useEffect(() => {
    async function prepareEdge() {
      try {
        await getModel('triage');
        setModelReady(true);
      } catch (err) {
        console.error("Model failed to initialize:", err);
      }
    }
    prepareEdge();
  }, []);

  // Compute metrics: time vs structural footprints
  const structuralStats = useMemo(() => {
    const baseCurve = [0.08, 0.22, 0.41, 0.58, 0.72, 0.85, 0.93, 1.02, 1.08, 1.12, 1.15, 1.18];
    const multiplier = (globalState.windSpeed / 90) + (globalState.slrMeters * 0.2);
    const activeProfile = baseCurve.map(depth => depth * (multiplier > 0 ? multiplier : 1));
    const currentDepth = activeProfile[currentTimeStep];

    const criticalBreached = globalState.windSpeed > 75 ? 3 : globalState.windSpeed > 55 ? 1 : 0;
    const commercialBreached = globalState.windSpeed > 85 ? 6 : globalState.windSpeed > 60 ? 2 : 0;
    const highRiskPercent = Math.min(100, Math.round((globalState.windSpeed * 0.8) + (globalState.slrMeters * 5)));

    return {
      historicalDepthProfile: activeProfile,
      carsRisk: currentDepth > 0.3 ? Math.floor(14 * (currentTimeStep + 1) * 0.6) : 0,
      suvRisk: currentDepth > 0.6 ? Math.floor(8 * (currentTimeStep + 1) * 0.5) : 0,
      structuralFailure: currentDepth > 0.9 ? Math.floor(4 * (currentTimeStep - 4)) : 0,
      criticalTotal: 4,
      commercialTotal: 8,
      criticalBreached,
      commercialBreached,
      highRiskPercent
    };
  }, [currentTimeStep, globalState.windSpeed, globalState.slrMeters]);

  const usaStructuresLayerConfig = useMemo(() => {
    const depthFactor = structuralStats.historicalDepthProfile[currentTimeStep];
    return {
      id: 'usa-structures-extruded-3d',
      type: 'fill-extrusion',
      paint: {
        'fill-extrusion-color': depthFactor > 0.9
          ? '#f43f5e' 
          : depthFactor > 0.6
            ? '#fb923c' 
            : depthFactor > 0.3
              ? '#facc15' 
              : '#38bdf8',
        'fill-extrusion-height': ['coalesce', ['get', 'height_meters'], 4],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.85
      }
    };
  }, [currentTimeStep, structuralStats]);

  const handlePanToTarget = (lng, lat) => {
    if (!lng || !lat) return;
    mapRef.current?.flyTo({
      center: [lng, lat],
      zoom: 12.5,
      essential: true,
      duration: 2000
    });
  };

  // LIVE INTERACTIVE TIMELINE ORCHESTRATOR WITH GENUINE ELEVENLABS AUDIO CHAIN
  const triggerResilientOrchestrationStory = () => {
    if (tickerRef.current) clearInterval(tickerRef.current);

    setters.setIsSimulating(true);
    setters.setWindSpeed(88);
    setters.setSlrMeters(2.5);
    setters.setHurricaneIntensity(5);
    setShowImpactAnalysis(true);
    setShowRoutingLayer(false); // Hide mutual aid routes until alert is resolved
    setCurrentTimeStep(0);
    setCurrentAlert("Category 4 Hurricane Outer Bands reaching Jamaica. Commencing live operational monitoring.");

    // Simple opening browser announcement
    const alertText = "Emergency operations engaged. Initializing interactive storm surge timeline tracking.";
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(alertText));

    const simulationTimeline = [
      { step: 1, alert: "Storm front tightening. Sea state telemetry indices elevating across the south shelf." },
      { step: 3, alert: "Storm surge rising to 1.5m. Palisadoes runway/airport link perimeters experiencing initial breach." },
      { step: 5, alert: "CRITICAL: Kingston Harbor waterfront layout reporting surge immersion. Localized power nodes offline." },
      { step: 7, alert: "AI Triage Engine: High risk of structural asset failure predicted across lower grid boundaries." },
      { step: 9, alert: "MAXIMUM BREACH: Surge peaking at 4.5m. Automating industrial utility isolation protocols." },
      { step: 11, alert: "Triage Complete. Crisis footprint successfully compiled. Triggering localized AI transcription." }
    ];

    tickerRef.current = setInterval(async () => {
      let currentStepValue;
      
      setCurrentTimeStep(prevStep => {
        const nextStep = prevStep + 1;
        currentStepValue = nextStep;
        
        const matchingMilestone = simulationTimeline.find(item => item.step === nextStep);
        if (matchingMilestone) {
          setCurrentAlert(matchingMilestone.alert);
        }

        if (nextStep >= 11) {
          clearInterval(tickerRef.current);
        }
        return nextStep;
      });

      // Trigger final phase when timeline reaches its peak
      if (currentStepValue >= 11) {
        // Step 1: Simulate user typing or injecting the ground-truth problem
        const incidentReport = "Palisadoes road link completely submerged down south. Coastal defenses breached near Rockfort, grid isolation requested.";
        setReportText(incidentReport);
        setIsProcessing(true);

        try {
          let tacticalPlaybook = "";
          
          // Step 2: Push through the core Flask backend triage engine
          if (globalState.airGapped) {
            const result = await runLocalTriage(incidentReport, globalState);
            tacticalPlaybook = result.actionable_tactical_playbook;
            if (result.matched_node_threat_index !== null) {
              setters.setActiveThreatIndex(result.matched_node_threat_index);
            }
          } else {
            const formData = new FormData();
            formData.append('text', incidentReport);
            formData.append('air_gapped', 'false');
            
            const response = await fetch('https://aura-resilience-platform-qa.onrender.com/api/v1/voice/report', {
              method: 'POST',
              body: formData
            });
            const resData = await response.json();
            tacticalPlaybook = resData.actionable_tactical_playbook;
          }

          // Step 3: Chain text to Route #6 (/api/v1/voice/broadcast) for authentic ElevenLabs audio stream
          const voiceBroadcastText = `Wah gwaan command center. Triage complete. ${tacticalPlaybook}`;
          
          try {
            const audioResponse = await fetch('https://aura-resilience-platform-qa.onrender.com/api/v1/voice/broadcast', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ text: voiceBroadcastText })
            });

            // Check if backend returned valid file stream or triggered browser fallback string info
            if (audioResponse.ok && audioResponse.headers.get('content-type')?.includes('audio/mpeg')) {
              const audioBlob = await audioResponse.blob();
              const audioUrl = URL.createObjectURL(audioBlob);
              const audio = new Audio(audioUrl);
              
              // Play authentic dialect voice file
              await audio.play();
            } else {
              // Fallback to standard web voice if backend key isn't deployed or error returns
              window.speechSynthesis.speak(new SpeechSynthesisUtterance(voiceBroadcastText));
            }
          } catch (audioErr) {
            console.warn("ElevenLabs audio stream chain failed, falling back to local TTS:", audioErr);
            window.speechSynthesis.speak(new SpeechSynthesisUtterance(voiceBroadcastText));
          }

          // Step 4: Display custom Alert popup overlay window to user
          alert(`[AURA EDGE PLAYBOOK] \n\n${tacticalPlaybook}`);
          
          // Step 5: Post-alert cleanup - instantly slide open mutual aid vectors and maps
          setShowImpactAnalysis(false); 
          setShowRoutingLayer(true);   // renders paths from `/api/v1/spatial/mutual-aid-paths`
          
        } catch (err) {
          console.error("Automated triage integration runner failure:", err);
        } finally {
          setIsProcessing(false);
        }
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
      formData.append('air_gapped', globalState.airGapped ? 'true' : 'false');

      const response = await fetch('https://aura-resilience-platform-qa.onrender.com/api/v1/voice/report', {
        method: 'POST',
        body: formData
      });

      const resData = await response.json();
      if (resData.status === 'success') {
        if (resData.matched_node_threat_index !== null) {
          setters.setActiveThreatIndex(resData.matched_node_threat_index);
        }
        alert(`Triage Complete: ${resData.triage_incident_profile}\nPlaybook: ${resData.actionable_tactical_playbook}`);
      }
    } catch (err) {
      console.error('Transmission processing failure:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Resolve active telemetry datasets based on isolation mode
  const activeInundation = globalState.airGapped
    ? runLocalInundation(globalState.slrMeters)
    : (geoJson?.inundationGeoJson || { type: 'FeatureCollection', features: [] });

  let processedSubstationFeatures = [];
  let calculatedGridState = 'NOMINAL';

  if (globalState.airGapped) {
    const localGridResult = runLocalGridSimulation(globalState.windSpeed);
    calculatedGridState = localGridResult?.grid_state || 'NOMINAL';
    const localAssets = localGridResult?.assets || [];
    processedSubstationFeatures = localAssets.map(a => ({
      type: "Feature",
      properties: {
        id: a.id,
        name: a.name,
        rawStatus: a.status,
        status: a.status?.toLowerCase().includes('critical') ? 'critical' : 'nominal',
        power_routing: a.power_routing
      },
      geometry: { type: "Point", coordinates: a.coordinates }
    }));
  } else {
    calculatedGridState = globalState.gridState || 'NOMINAL';
    const cloudGeoJson = geoJson?.compiledSubstationGeoJson || { type: 'FeatureCollection', features: [] };
    const rawAssetsList = data?.gridAssets || [];

    processedSubstationFeatures = (cloudGeoJson.features || []).map(f => {
      const liveAssetMatch = rawAssetsList.find(a => a.id === f.properties?.id);
      return {
        ...f,
        properties: {
          ...f.properties,
          power_routing: liveAssetMatch ? liveAssetMatch.power_routing : 'MAIN_LINE_FEED'
        }
      };
    });
  }

  const activeMarineFeatures = globalState.airGapped
    ? runLocalMarineTelemetry()
    : (geoJson?.compiledMarineGeoJson?.features || []);

  const activeRoutingGeoJson = data?.routingGeoJson || { type: 'FeatureCollection', features: [] };

  // --- DATA SANITIZATION FILTERS ---
  const sanitizedSubstations = useMemo(() => {
    if (globalState.airGapped) return { type: "FeatureCollection", features: processedSubstationFeatures };
    
    const rawSubstations = data?.gridAssets || [];
    if (rawSubstations.length === 0 && processedSubstationFeatures.length > 0) {
      return { type: "FeatureCollection", features: processedSubstationFeatures };
    }

    return {
      type: "FeatureCollection",
      features: rawSubstations.map(sub => ({
        type: "Feature",
        properties: {
          id: sub.id,
          name: sub.name,
          status: sub.status?.toLowerCase() || 'nominal',
          rawStatus: sub.status || 'NOMINAL'
        },
        geometry: {
          type: "Point",
          coordinates: sub.coordinates
        }
      }))
    };
  }, [globalState.airGapped, data?.gridAssets, processedSubstationFeatures]);

  const sanitizedInundation = useMemo(() => {
    if (globalState.airGapped) return activeInundation;
    if (activeInundation?.features && activeInundation.features.length > 0) return activeInundation;

    return {
      type: "FeatureCollection",
      features: []
    };
  }, [globalState.airGapped, activeInundation]);

  return (
    <div className="relative w-screen min-h-screen md:h-screen md:overflow-hidden bg-slate-950 text-slate-100 font-sans">
      
      {/* 🟢 REAL-TIME EMERGENCY SITUATION READOUT BANNER */}
      {globalState.isSimulating && currentAlert && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-[100] w-11/12 max-w-2xl bg-slate-950/95 border border-cyan-500/40 text-cyan-400 px-5 py-3.5 rounded-xl shadow-[0_0_30px_rgba(6,182,212,0.15)] backdrop-blur-md flex items-center gap-4 pointer-events-auto animate-pulse">
          <div className="h-2 w-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
          <p className="text-xs font-mono tracking-wide leading-relaxed">{currentAlert}</p>
        </div>
      )}

      {/* MAP UNDERLAY */}
      <div className="absolute top-0 left-0 w-full h-[40vh] md:h-full z-0 pointer-events-auto">
        {globalState.isSimulating ? (
          /* SWAPPED MAP VIEWPORT: 3D Esri / Satellite Terrain Engine */
          <ThreeDSimulationPage 
            currentTimeStep={currentTimeStep}
            geoData={geoJson?.structuresGeoJson}
            simulationArgs={{
              slrMeters: globalState.slrMeters,
              windSpeed: globalState.windSpeed,
              threatIndex: globalState.activeThreatIndex
            }}
          />
        ) : (
          /* DEFAULT MAP VIEWPORT: Optimized Flat Operations Map */
          <Map
            {...viewState}
            ref={mapRef}
            onMove={evt => setViewState(evt.viewState)}
            mapboxAccessToken={MAPBOX_TOKEN}
            mapStyle="mapbox://styles/mapbox/dark-v11"
            style={{ width: '100%', height: '100%' }}
          >
            <Source id="inundation-data" type="geojson" data={sanitizedInundation}>
              <Layer {...inundationLayer} />
            </Source>

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
                <Layer
                  id="routing-arrows"
                  type="symbol"
                  layout={{
                    'symbol-placement': 'line',
                    'symbol-spacing': 50,
                    'text-field': '▶',
                    'text-size': 12,
                    'text-keep-upright': true
                  }}
                  paint={{ 'text-color': '#ffffff' }}
                />
              </Source>
            )}

            {showMarineLayer && activeMarineFeatures.length > 0 && (
              <Source id="marine-data" type="geojson" data={{ type: "FeatureCollection", features: activeMarineFeatures }}>
                <Layer {...marinePolygonLayer} />
                <Layer {...marineGlowLayer} />
              </Source>
            )}

            <Source id="substation-data" type="geojson" data={sanstations => sanitizedSubstations}>
              <Layer {...substationLayer} />
            </Source>

            {showImpactAnalysis && geoJson?.structuresGeoJson && (
              <Source id="fema-structures" type="geojson" data={geoJson.structuresGeoJson}>
                <Layer {...usaStructuresLayerConfig} />
                <Layer {...structuralFootprintLayer} id="usa-structures-base" />
              </Source>
            )}
          </Map>
        )}
      </div>

      {/* FOREGROUND HUD LAYOUT */}
      <div className="relative md:absolute inset-0 z-30 pt-[42vh] md:pt-0 p-4 md:p-6 pointer-events-none grid grid-cols-1 md:grid-cols-12 md:grid-rows-[auto_1fr_auto] h-full gap-4">
        
        {/* HEADER BAR */}
        <header className="col-span-1 md:col-span-12 h-14 bg-slate-900/80 backdrop-blur-md border border-white/5 rounded-xl flex items-center justify-between px-6 pointer-events-auto order-first md:order-none">
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${calculatedGridState === 'NOMINAL' ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`} />
            <h1 className="text-sm font-bold tracking-widest text-white uppercase">AURA Command Center</h1>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${globalState.airGapped ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
              <span className="text-[10px] font-mono uppercase text-slate-400">
                {globalState.airGapped ? `[MODE: EDGE_ISOLATED | AI: ${modelReady ? 'READY' : 'LOADING'}]` : "[MODE: CLOUD_SYNC]"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-6 font-mono text-xs text-slate-400">
            <button
              onClick={() => {
                if (tickerRef.current) clearInterval(tickerRef.current);
                setCurrentAlert(null);
                if (globalState.isSimulating) {
                  setters.setIsSimulating(false);
                }
                mapRef.current?.flyTo({
                  center: [HOME_COORDINATES.longitude, HOME_COORDINATES.latitude],
                  zoom: HOME_COORDINATES.zoom,
                  essential: true,
                  duration: 1500
                });
              }}
              className="bg-white/5 hover:bg-white/10 text-[10px] text-slate-300 px-3 py-1.5 rounded border border-white/10 transition-colors"
            >
              RESET_VIEW
            </button>
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
            <button
              onClick={triggerResilientOrchestrationStory}
              className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors mb-2"
            >
              <ShieldAlert size={18} /> {globalState.isSimulating ? "Simulation Active..." : "Simulate Hurricane Impact"}
            </button>
            <button
              onClick={() => {
                if (tickerRef.current) clearInterval(tickerRef.current);
                setCurrentAlert(null);
                if (window.confirm("CRITICAL: This will purge all local session data and reset AURA to factory settings. Continue?")) {
                  setters.resetAuraState();
                }
              }}
              className="w-full bg-rose-900/30 hover:bg-rose-900/60 text-rose-500 text-[10px] px-3 py-1.5 rounded border border-rose-900/50 transition-colors text-center"
            >
              System Reset
            </button>
          </div>

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
              <button
                onClick={() => setters.setActiveThreatIndex(null)}
                className="mt-2 text-[9px] font-mono text-rose-400 hover:underline block text-left"
              >
                Clear Override Threat Node (Index: {globalState.activeThreatIndex})
              </button>
            )}
          </HudPanel>

          <HudPanel title="Oceanographic Watchdog" onToggle={setShowMarineLayer}>
            <div className="max-h-56 overflow-y-auto pr-2 space-y-2">
              {activeMarineFeatures.map((m, i) => {
                const locName = m.properties?.location_name || 'Anomalous Region';
                const tempAnomaly = m.properties?.surface_temp_anomaly_celsius || 0;
                const geomCoords = m.geometry?.coordinates;
                let localImpactBlurb = "Monitoring regional baseline indices. Elevated surface metrics signal early risks.";

                if (locName.includes("Coral Bleaching Cluster A")) {
                  localImpactBlurb = `A +${tempAnomaly}°C spike here accelerates severe coral bleaching across nearshore reefs. For locals, this threatens critical artisanal fishing grounds and degrades the natural storm barriers shielding the Kingston shoreline.`;
                } else if (locName.includes("Pedro Bank")) {
                  localImpactBlurb = `This massive +${tempAnomaly}°C anomaly in the pelagic gyre traps heavy sargassum biomass. Drifting fields choke down south-coast harbors, drop marine oxygen values, and disrupt active commercial fishing links.`;
                } else if (locName.includes("Algal Stress Hotspot")) {
                  localImpactBlurb = `Sustained temperatures +${tempAnomaly}°C above historical norms trigger rapid toxic microalgae spikes on the shallow shelf. This risks bioaccumulation issues in shellfish maps and harms beach infrastructure groups.`;
                }

                return (
                  <details
                    key={i}
                    className="bg-slate-900/50 p-2 rounded border border-white/5 cursor-pointer group"
                    onToggle={(e) => {
                      if (e.currentTarget.open && geomCoords && !globalState.isSimulating) {
                        handlePanToTarget(geomCoords[0], geomCoords[1]);
                      }
                    }}
                  >
                    <summary className="text-[10px] font-mono list-none flex justify-between items-center select-none">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-slate-200 group-hover:text-teal-400 transition-colors">{locName}</span>
                        <span className="text-[9px] text-slate-500 font-sans">Watchdog: {m.properties?.ai_watchdog_status || 'MONITOR'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-teal-400 font-bold">+{tempAnomaly}°C</span>
                        <span className="text-slate-500 group-open:rotate-180 transition-transform text-[8px]">▼</span>
                      </div>
                    </summary>
                    <div className="text-[10px] text-slate-400 mt-2 border-t border-white/5 pt-2 font-sans leading-relaxed space-y-1.5">
                      <div className="text-[9px] font-mono uppercase tracking-wider text-teal-500 font-bold">Community & Ecosystem Impact:</div>
                      <p className="text-slate-300">{localImpactBlurb}</p>
                      <div className="text-[9px] font-mono text-slate-500 pt-0.5">Microplastic Density: {m.properties?.microplastic_density_ppm || 0} ppm</div>
                    </div>
                  </details>
                );
              })}
            </div>
          </HudPanel>
        </div>

        {/* CENTER VISUAL ACCOMMODATION COUPLER */}
        <div className="hidden md:block md:col-span-6" />

        {/* RIGHT INTERACTIVE COLUMN */}
        <div className="col-span-1 md:col-span-3 flex flex-col gap-4 pointer-events-auto overflow-y-auto">
          
          {/* Dynamic Switch Panel Layout */}
          {!showImpactAnalysis ? (
            <>
              <HudPanel title="System Operations Matrix">
                <div className="text-[10px] text-slate-300 space-y-2">
                  <p>Steady-state climate vectors active.</p>
                  <button
                    onClick={() => {
                      setters.setIsSimulating(true);
                      setters.setWindSpeed(90);
                      setShowImpactAnalysis(true);
                    }}
                    className="w-full py-1.5 bg-rose-600 font-bold rounded uppercase tracking-wider text-white hover:bg-rose-500 transition-colors cursor-pointer pointer-events-auto text-[9px]"
                  >
                    RUN FLOOD SIMULATION
                  </button>
                </div>
              </HudPanel>

              <HudPanel title="GNN Grid Analyzer">
                <div className="max-h-48 overflow-y-auto pr-2 space-y-2">
                  {(sanitizedSubstations.features || []).map(feat => {
                    const props = feat.properties || {};
                    const coords = feat.geometry?.coordinates;
                    return (
                      <details
                        key={props.id}
                        className="bg-slate-900/50 p-2 rounded border border-white/5 cursor-pointer group"
                        onToggle={(e) => {
                          if (e.currentTarget.open && coords && !globalState.isSimulating) {
                            handlePanToTarget(coords[0], coords[1]);
                          }
                        }}
                      >
                        <summary className="text-[11px] font-mono text-emerald-400 list-none flex justify-between items-center select-none">
                          <span>{props.name}</span>
                          <span className="text-slate-500 group-open:rotate-180 transition-transform text-[9px]">▼</span>
                        </summary>
                        <div className="text-[10px] text-slate-400 mt-2 border-t border-white/5 pt-2 font-mono space-y-1">
                          <div>Status: <span className={props.status?.toUpperCase().includes('CRITICAL') ? 'text-rose-400' : 'text-emerald-300'}>{props.rawStatus}</span></div>
                          <div className="text-slate-500 text-[9px]">Routing: {props.power_routing || 'MAIN_LINE_FEED'}</div>
                        </div>
                      </details>
                    );
                  })}
                </div>
              </HudPanel>

              <HudPanel title="Logistics & Mutual Aid" onToggle={setShowRoutingLayer}>
                <div className="max-h-56 overflow-y-auto pr-2 space-y-2">
                  {(activeRoutingGeoJson.features || []).map((route, i) => {
                    const originKitchen = route.properties?.origin_kitchen || 'Unknown Kitchen';
                    const destShelter = route.properties?.destination_shelter || 'Unknown Shelter';
                    const urgency = route.properties?.urgency || 'LOW';
                    const blurb = getLogisticsBlurb(originKitchen, urgency);

                    return (
                      <div key={i} className="bg-slate-900/50 p-3 rounded border border-white/10 text-[10px] font-mono">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-emerald-400 font-bold">{originKitchen}</span>
                          <span className="text-slate-500">→</span>
                          <span className="text-purple-400 font-bold">{destShelter}</span>
                        </div>
                        <p className="text-slate-300 leading-tight mb-2 italic">"{blurb.text}"</p>
                        <div className="bg-slate-950 p-1.5 rounded border border-purple-500/30 text-purple-300 font-bold uppercase tracking-wider text-[9px]">
                          {blurb.action}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </HudPanel>
            </>
          ) : (
            <ImpactAnalysisPanel
              currentTimeStep={currentTimeStep}
              onTimeStepChange={(newStep) => {
                // If user touches slider manually, kill autopilot loop to prevent overriding them
                if (tickerRef.current) clearInterval(tickerRef.current);
                setCurrentTimeStep(newStep);
              }}
              structuralStats={structuralStats}
              onClose={() => {
                if (tickerRef.current) clearInterval(tickerRef.current);
                setCurrentAlert(null);
                setShowImpactAnalysis(false);
                setters.setIsSimulating(false);
              }}
            />
          )}
        </div>

        {/* VOICE TRANSCRIPTION TRANSCRIBER PANEL */}
        <div className="col-span-1 md:col-span-12 z-[60] pointer-events-auto mt-auto">
          <HudPanel title="Logistics Transcriber">
            <div className="flex gap-2">
              <textarea
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                placeholder={modelReady || !globalState.airGapped ? "Enter incident report (e.g., 'Palisadoes line is underwater down south')..." : "Loading AI model..."}
                disabled={!modelReady && globalState.airGapped}
                className="flex-grow h-14 bg-slate-950/50 border border-white/10 rounded p-2 text-xs text-slate-200 resize-none focus:border-purple-500 outline-none font-sans"
              />
              <button
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