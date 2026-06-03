import React, { useState, useRef, useEffect } from 'react';
import Map, { Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useAuraData } from './hooks/useAuraData';
import { HudPanel } from './components/HudPanel';
import { ShieldAlert, Wind, Activity } from 'lucide-react';
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

// --- MAP STYLE LAYERS FOR BACKEND DATA ---
const substationLayer = {
  id: 'substations-layer',
  type: 'circle',
  paint: {
    'circle-radius': 8,
    'circle-color': [
      'match',
      ['get', 'status'],
      'critical', '#f43f5e', // coral-500
      '#10b981'              // emerald-500
    ],
    'circle-stroke-width': 2,
    'circle-stroke-color': '#ffffff'
  }
};

// --- RESTORED ORIGINAL MARINE LAYERS ---
const marinePolygonLayer = {
  id: 'marine-anomaly-polygon-layer',
  type: 'fill',
  paint: {
    'fill-color': '#f59e0b',        // amber-500
    'fill-opacity': 0.15,
    'fill-outline-color': '#fbbf24' // amber-400
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
      'CRITICAL', '#ef4444', // Red for immediate action
      'HIGH', '#f97316',    // Orange for secondary flow
      '#8b5cf6'             // Purple for baseline support
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
  const { state, setters, data, geoJson } = useAuraData();
  const [reportText, setReportText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [modelReady, setModelReady] = useState(false);

  const [showMarineLayer, setShowMarineLayer] = useState(false);
  const [showRoutingLayer, setShowRoutingLayer] = useState(false);

  const mapRef = useRef(null);

  const [viewState, setViewState] = useState({
    longitude: -76.78, latitude: 17.95, zoom: 11, pitch: 35
  });
  const zoomToRoute = (feature) => {
    const map = mapRef.current;
    if (!map || !feature.geometry.coordinates) return;

    const coords = feature.geometry.coordinates;

    // Create a bounding box that covers both the kitchen and the shelter
    const bounds = coords.reduce((bounds, coord) => {
      return bounds.extend(coord);
    }, new maplibregl.LngLatBounds(coords[0], coords[0]));

    // Fly to the line with padding so it's not squashed against the edges
    map.fitBounds(bounds, {
      padding: 100, // Adds space around the route
      duration: 2000, // Smooth 2-second animation
      essential: true
    });
  };

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

  const handlePanToTarget = (lng, lat) => {
    if (!lng || !lat) return;
    mapRef.current?.flyTo({
      center: [lng, lat],
      zoom: 12.5,
      essential: true,
      duration: 2000
    });
  };

  // Determine Data Sources based on Mode to map substation references correctly
  const activeInundation = state.airGapped
    ? runLocalInundation(state.slrMeters)
    : (geoJson?.inundationGeoJson || { type: 'FeatureCollection', features: [] });

  let processedSubstationFeatures = [];
  let calculatedGridState = 'NOMINAL';

  if (state.airGapped) {
    const localGridResult = runLocalGridSimulation(state.windSpeed);
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
    calculatedGridState = state.gridState || 'NOMINAL';
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

  const triggerResilientOrchestrationStory = () => {
    setters.setIsSimulating(true);
    setters.setWindSpeed(78);
    setters.setSlrMeters(2.0);
    setters.setHurricaneIntensity(5);

    const alertText = "Emergency: Hurricane force winds detected. Automating grid isolation and shoreline surge protection protocols.";
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(alertText));

    // Dynamic Zoom Action: Scan grid infrastructure for the critical target location
    setTimeout(() => {
      const palisadoesNode = processedSubstationFeatures.find(f =>
        String(f.properties?.name || '').toLowerCase().includes('palisadoes')
      );

      if (palisadoesNode?.geometry?.coordinates) {
        const [lng, lat] = palisadoesNode.geometry.coordinates;
        mapRef.current?.flyTo({
          center: [lng, lat],
          zoom: 13.5,
          pitch: 45,
          essential: true,
          duration: 2500
        });
      }
    }, 100);
  };

  const handleProcessTransmission = async () => {
    if (!reportText.trim()) return;
    setIsProcessing(true);

    if (state.airGapped) {
      try {
        const result = await runLocalTriage(reportText, state);
        alert(`${result.actionable_tactical_playbook}`);
        setters.setActiveThreatIndex(result.matched_node_threat_index);

        // Local air-gapped backup speaker
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(result.actionable_tactical_playbook));
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
      formData.append('air_gapped', state.airGapped ? 'true' : 'false');

      const response = await fetch('https://aura-resilience-platform-prod.onrender.com/api/v1/voice/report', {
        method: 'POST',
        body: formData
      });

      const resData = await response.json();
      if (resData.status === 'success') {
        if (resData.matched_node_threat_index !== null) {
          setters.setActiveThreatIndex(resData.matched_node_threat_index);
        }

        // === SECOND HOP: SEND TO ELEVENLABS ACCENT ROUTE ===
        try {
          const audioResponse = await fetch('https://aura-resilience-platform-prod.onrender.com/api/v1/voice/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: resData.actionable_tactical_playbook })
          });

          if (!audioResponse.ok) {
            // This line extracts the actual error message from the backend
            const errorText = await audioResponse.text();
            throw new Error(`Server Error ${audioResponse.status}: ${errorText}`);
          }

          const audioBlob = await audioResponse.blob();
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          await audio.play();

        } catch (audioErr) {
          // This will now print the REAL reason the backend is failing
          console.error("--- THE TRUTH BEHIND THE FAILURE ---");
          console.error(audioErr.message);

          // Fallback
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(new SpeechSynthesisUtterance(resData.actionable_tactical_playbook));
        }

        alert(`Triage Complete: ${resData.triage_incident_profile}\nPlaybook: ${resData.actionable_tactical_playbook}`);

      }
    } catch (err) {
      console.error('Transmission processing failure:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const activeMarineFeatures = state.airGapped
    ? runLocalMarineTelemetry()
    : (geoJson?.compiledMarineGeoJson?.features || []);

  const activeRoutingGeoJson = data?.routingGeoJson || { type: 'FeatureCollection', features: [] };

  return (
    <div className="relative w-screen min-h-screen md:h-screen md:overflow-hidden bg-slate-950 text-slate-100 font-sans">

      {/* MAP UNDERLAY */}
      <div className="absolute top-0 left-0 w-full h-[40vh] md:h-full z-0 pointer-events-auto">
        <Map
          {...viewState}
          ref={mapRef}
          onMove={evt => setViewState(evt.viewState)}
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle={
            state.isSimulating
              ? "mapbox://styles/mapbox/satellite-streets-v12" // Swaps to high-detail crisis terrain
              : "mapbox://styles/mapbox/dark-v11"              // Default monitoring state
          }
          style={{ width: '100%', height: '100%' }}
        >
          {/* Inundation Vectors Polygons */}
          <Source id="inundation-data" type="geojson" data={activeInundation}>
            <Layer {...inundationLayer} />
          </Source>

          {/* Conditional Mutual Aid Path Vectors */}
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
                paint={{
                  'text-color': '#ffffff'
                }}
              />
            </Source>
          )}

          {/* Conditional Oceanographic Watchdog Telemetry Layer */}
          {showMarineLayer && activeMarineFeatures.length > 0 && (
            <Source id="marine-data" type="geojson" data={{ type: "FeatureCollection", features: activeMarineFeatures }}>
              <Layer {...marinePolygonLayer} />
              <Layer {...marineGlowLayer} />
            </Source>
          )}

          {/* Physics-Informed Substation Points */}
          <Source id="substation-data" type="geojson" data={{ type: "FeatureCollection", features: processedSubstationFeatures }}>
            <Layer {...substationLayer} />
          </Source>
        </Map>
      </div>

      {/* RESPONSIVE HUD FOREGROUND */}
      <div className="relative md:absolute inset-0 z-30 pt-[42vh] md:pt-0 p-4 md:p-6 pointer-events-none grid grid-cols-1 md:grid-cols-12 md:grid-rows-[auto_1fr_auto] h-full gap-4">

        {/* HEADER BAR */}
        <header className="col-span-1 md:col-span-12 h-14 bg-slate-900/80 backdrop-blur-md border border-white/5 rounded-xl flex items-center justify-between px-6 pointer-events-auto order-first md:order-none">
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${calculatedGridState === 'NOMINAL' ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`} />
            <h1 className="text-sm font-bold tracking-widest text-white uppercase">Status</h1>
          </div>
          <div className="flex items-center gap-6 font-mono text-xs text-slate-400">
            <button
              onClick={() => {
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
                checked={!!state.airGapped}
                onChange={(e) => setters.setAirGapped(e.target.checked)}
                className="rounded bg-slate-950 border-white/10 text-purple-600 focus:ring-0 w-3 h-3"
              />
              <span>AIR_GAPPED_MODE</span>
            </label>
          </div>
        </header>

        {/* LEFT COLUMN */}
        <div className="col-span-1 md:col-span-3 flex flex-col gap-4 pointer-events-auto overflow-y-auto">
          <div>
            <button
              onClick={triggerResilientOrchestrationStory}
              className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors mb-2"
            >
              <ShieldAlert size={18} /> {state.isSimulating ? "Simulation Active..." : "Simulate Hurricane Impact"}
            </button>
            <button
              onClick={() => {
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
              <div className="flex justify-between text-[10px] text-slate-400 font-mono"><span>Wind Field</span><span className="text-emerald-400">{state.windSpeed} MPH</span></div>
              <input type="range" min="10" max="100" value={state.windSpeed} onChange={(e) => setters.setWindSpeed(Number(e.target.value))} className="w-full accent-emerald-400 cursor-pointer" />
            </div>
            <div className="space-y-1 pt-2">
              <div className="flex justify-between text-[10px] text-slate-400 font-mono"><span>Sea Level Surge</span><span className="text-emerald-400">+{state.slrMeters}m</span></div>
              <input type="range" min="0" max="3" step="0.5" value={state.slrMeters} onChange={(e) => setters.setSlrMeters(Number(e.target.value))} className="w-full accent-emerald-400 cursor-pointer" />
            </div>
            {state.activeThreatIndex !== null && (
              <button
                onClick={() => setters.setActiveThreatIndex(null)}
                className="mt-2 text-[9px] font-mono text-rose-400 hover:underline block text-left"
              >
                Clear Override Threat Node (Index: {state.activeThreatIndex})
              </button>
            )}
          </HudPanel>

          <HudPanel title="Marine Warnings" onToggle={setShowMarineLayer}>
            <div className="max-h-56 overflow-y-auto pr-2 space-y-2">
              {activeMarineFeatures.map((m, i) => {
                const locName = m.properties?.location_name || 'Anomalous Region';
                const tempAnomaly = m.properties?.surface_temp_anomaly_celsius || 0;
                const geomCoords = m.geometry?.coordinates;

                let localImpactBlurb = "Monitoring regional baseline indices. Elevated surface metrics signal early risks of local benthic ecosystem stress.";

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
                      if (e.currentTarget.open && geomCoords) {
                        handlePanToTarget(geomCoords[0], geomCoords[1]);
                      }
                    }}
                  >
                    <summary className="text-[10px] font-mono list-none flex justify-between items-center select-none">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-slate-200 group-hover:text-teal-400 transition-colors">
                          {locName}
                        </span>
                        <span className="text-[9px] text-slate-500 font-sans">
                          Watchdog: {m.properties?.ai_watchdog_status || 'MONITOR'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-teal-400 font-bold">+{tempAnomaly}°C</span>
                        <span className="text-slate-500 group-open:rotate-180 transition-transform text-[8px]">▼</span>
                      </div>
                    </summary>
                    <div className="text-[10px] text-slate-400 mt-2 border-t border-white/5 pt-2 font-sans leading-relaxed space-y-1.5">
                      <div className="text-[9px] font-mono uppercase tracking-wider text-teal-500 font-bold">
                        Community & Ecosystem Impact:
                      </div>
                      <p className="text-slate-300">
                        {localImpactBlurb}
                      </p>
                      <div className="text-[9px] font-mono text-slate-500 pt-0.5">
                        Microplastic Density: {m.properties?.microplastic_density_ppm || 0} ppm
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          </HudPanel>
        </div>

        {/* CENTER VISUAL SPACE ACCOMMODATION */}
        <div className="hidden md:block md:col-span-6" />

        {/* RIGHT COLUMN */}
        <div className="col-span-1 md:col-span-3 flex flex-col gap-4 pointer-events-auto overflow-y-auto">
          <HudPanel title="JPS Grid Status">
            <div className="max-h-48 overflow-y-auto pr-2 space-y-2">
              {processedSubstationFeatures.map(feat => {
                const props = feat.properties || {};
                const coords = feat.geometry?.coordinates;
                return (
                  <details
                    key={props.id}
                    className="bg-slate-900/50 p-2 rounded border border-white/5 cursor-pointer group"
                    onToggle={(e) => {
                      if (e.currentTarget.open && coords) {
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
                      <div className="text-slate-500 text-[9px]">Routing: {props.power_routing}</div>
                    </div>
                  </details>
                );
              })}
            </div>
          </HudPanel>

          <HudPanel title="Shelter Supplies" onToggle={setShowRoutingLayer}>
            <div className="max-h-56 overflow-y-auto pr-2 space-y-2">
              {(activeRoutingGeoJson.features || []).map((route, i) => {
                const originKitchen = route.properties?.origin_kitchen || 'Unknown Kitchen';
                const destShelter = route.properties?.destination_shelter || 'Unknown Shelter';
                const urgency = route.properties?.urgency || 'LOW';
                const blurb = getLogisticsBlurb(originKitchen, urgency);

                return (
                  <div
                    key={i}
                    onClick={() => zoomToRoute(route)} // <--- ADD THIS LINE
                    className="bg-slate-900/50 p-3 rounded border border-white/10 text-[10px] font-mono cursor-pointer hover:border-emerald-500/50 transition-colors" // <--- ADDED cursor-pointer for better UX
                  >
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
        </div>

        {/* TRANSCRIBER PANEL */}
        <div className="col-span-1 md:col-span-12 z-[60] pointer-events-auto mt-auto">
          <HudPanel title="Radio Dispatch">
            <div className="flex gap-2">
              <textarea
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                placeholder={modelReady || !state.airGapped ? "Enter incident report (e.g., 'Palisadoes line is underwater down south')..." : "Loading AI model..."}
                disabled={!modelReady && state.airGapped}
                className="flex-grow h-14 bg-slate-950/50 border border-white/10 rounded p-2 text-xs text-slate-200 resize-none focus:border-purple-500 outline-none font-sans"
              />
              <button
                onClick={handleProcessTransmission}
                disabled={isProcessing || (!modelReady && state.airGapped)}
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