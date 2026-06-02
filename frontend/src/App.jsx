import React, { useState, useRef } from 'react';
import Map, { Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useAuraData } from './hooks/useAuraData';
import { HudPanel } from './components/HudPanel';
import { ShieldAlert, Wind, Activity } from 'lucide-react';

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
    'fill-color': '#f59e0b',       // amber-500
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
  layout: { 'line-join': 'round', 'line-cap': 'round' },
  paint: {
    'line-color': [
      'match',
      ['get', 'urgency'],
      'CRITICAL', '#ef4444',
      'HIGH', '#f97316',
      '#a855f7'
    ],
    'line-width': 3,
    'line-dasharray': [2, 2]
  }
};
const getLogisticsBlurb = (facilityName, urgency) => {
  const name = facilityName.toLowerCase();
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
    // Default to Relief Station logic
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
  const mapRef = useRef(null); // Reference hook to interface with imperative Mapbox GL controls

  const [viewState, setViewState] = useState({
    longitude: -76.78, latitude: 17.95, zoom: 11, pitch: 35
  });

  // Reusable utility function to handle vector camera pans
  const handlePanToTarget = (lng, lat) => {
    if (!lng || !lat) return;
    mapRef.current?.flyTo({
      center: [lng, lat],
      zoom: 12.5,
      essential: true,
      duration: 2000 // Smooth panning duration in milliseconds
    });
  };
  const triggerResilientOrchestrationStory = () => {
    // 1. Trigger visual simulation state
    setters.setIsSimulating(true);

    // 2. Adjust environmental variables to storm-level
    setters.setWindSpeed(78);
    setters.setSlrMeters(2.0);
    setters.setHurricaneIntensity(5);

    // 3. Audio/Broadcast Logic
    const alertText = "Emergency: Hurricane force winds detected. Automating grid isolation and shoreline surge protection protocols.";
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(alertText));

    // 4. (Optional) Force the map to the most critical anomaly node
    const criticalNode = data.marineAnomalies.find(m => m.properties?.ai_watchdog_status?.includes("CRITICAL"));
    if (criticalNode?.geometry?.coordinates) {
      const [lng, lat] = criticalNode.geometry.coordinates;
      mapRef.current?.flyTo({ center: [lng, lat], zoom: 12, essential: true });
    }
  };
  const handleProcessTransmission = async () => {
    if (!reportText.trim()) return;
    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('text', reportText);
      formData.append('air_gapped', state.airGapped ? 'true' : 'false');

      const response = await fetch('https://aura-resilience-platform-qa.onrender.com/api/v1/voice/report', {
        method: 'POST',
        body: formData
      });

      const resData = await response.json();
      if (resData.status === 'success') {
        if (resData.matched_node_threat_index !== null) {
          setters.setActiveThreatIndex(resData.matched_node_threat_index);
        }
        if (data.triageReport !== undefined) {
          data.triageReport = resData;
        }
        alert(`Triage Complete: ${resData.triage_incident_profile}\nPlaybook: ${resData.actionable_tactical_playbook}`);
      }
    } catch (err) {
      console.error('Transmission processing failure:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="relative w-screen min-h-screen md:h-screen md:overflow-hidden bg-slate-950 text-slate-100 font-sans">

      {/* MAP UNDERLAY */}
      <div className="absolute top-0 left-0 w-full h-[40vh] md:h-full z-0 pointer-events-auto">
        <Map
          {...viewState}
          ref={mapRef} // Capture current map element interface context
          onMove={evt => setViewState(evt.viewState)}
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          style={{ width: '100%', height: '100%' }}
        >
          {/* Inundation Vectors Polygons */}
          <Source id="inundation-data" type="geojson" data={data.inundationGeoJson}>
            <Layer {...inundationLayer} />
          </Source>

          {/* Mutual Aid Path Vectors LineStrings */}
          <Source id="routing-data" type="geojson" data={data.routingGeoJson}>
            <Layer {...routingLayer} />
          </Source>

          {/* RESTORED OCEANOGRAPHIC WATCHDOG TELEMETRY LAYER */}
          {geoJson.compiledMarineGeoJson?.features?.length > 0 && (
            <Source id="marine-data" type="geojson" data={geoJson.compiledMarineGeoJson}>
              <Layer {...marinePolygonLayer} />
              <Layer {...marineGlowLayer} />
            </Source>
          )}

          {/* Physics-Informed Substation Points */}
          <Source id="substation-data" type="geojson" data={geoJson.compiledSubstationGeoJson}>
            <Layer {...substationLayer} />
          </Source>
        </Map>
      </div>

      {/* RESPONSIVE HUD FOREGROUND */}
      <div className="relative md:absolute inset-0 z-30 pt-[42vh] md:pt-0 p-4 md:p-6 pointer-events-none grid grid-cols-1 md:grid-cols-12 md:grid-rows-6 gap-2 overflow-y-auto md:overflow-visible">

        {/* HEADER BAR */}
        <header className="col-span-1 md:col-span-12 h-14 bg-slate-900/80 backdrop-blur-md border border-white/5 rounded-xl flex items-center justify-between px-6 pointer-events-auto order-first md:order-none">
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${state.gridState === 'NOMINAL' ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`} />
            <h1 className="text-sm font-bold tracking-widest text-white uppercase">AURA Command Center</h1>
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
                checked={state.airGapped}
                onChange={(e) => setters.setAirGapped(e.target.checked)}
                className="rounded bg-slate-950 border-white/10 text-purple-600 focus:ring-0 w-3 h-3"
              />
              <span>AIR_GAPPED_MODE</span>
            </label>
            <div>
              STATE: <span className={state.gridState === 'NOMINAL' ? 'text-emerald-400' : 'text-rose-400'}>{state.gridState}</span>
            </div>
          </div>

        </header>

        {/* LEFT COLUMN: Controls & Logistics */}
        <div className="col-span-1 md:col-span-3 md:row-span-5 flex flex-col gap-4 pointer-events-auto">
          {/* RESTORED HURRICANE SIMULATOR BUTTON */}
          <button
            onClick={triggerResilientOrchestrationStory}
            className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <ShieldAlert size={18} /> {state.isSimulating ? "Simulation Active..." : "Simulate Hurricane Impact"}
          </button>
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
          {/* OCEANOGRAPHIC WATCHDOG WITH MAP INTERACTION */}
          <HudPanel title="Oceanographic Watchdog">
            <div className="max-h-56 overflow-y-auto pr-2 space-y-2">
              {data.marineAnomalies.map((m, i) => {
                const locName = m.properties?.location_name || '';
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
                      // Trigger dynamic alignment coordinate camera move if target details expand
                      if (e.currentTarget.open && geomCoords) {
                        handlePanToTarget(geomCoords[0], geomCoords[1]);
                      }
                    }}
                  >
                    <summary className="text-[10px] font-mono list-none flex justify-between items-center select-none">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-slate-200 group-hover:text-teal-400 transition-colors">
                          {locName || 'Anomalous Subsystem'}
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

        {/* CENTER COLUMN PLACEHOLDER */}
        <div className="hidden md:block md:col-start-4 md:col-span-6 md:row-start-6 md:row-span-1 pointer-events-auto px-4 pb-4">
          <HudPanel title="Logistics Transcriber">
            <div className="flex gap-2">
              <textarea
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                placeholder="Enter incident report..."
                className="flex-grow h-12 bg-slate-950/50 border border-white/10 rounded p-2 text-xs text-slate-200 resize-none focus:border-purple-500 outline-none font-sans"
              />
              <button
                onClick={handleProcessTransmission}
                disabled={isProcessing}
                className="bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 text-[10px] px-6 rounded font-bold uppercase transition-colors text-white"
              >
                {isProcessing ? 'Processing...' : 'Process'}
              </button>
            </div>
          </HudPanel>
        </div>

        {/* RIGHT COLUMN: Telemetry & Analyzers */}
        <div className="col-span-1 md:col-span-3 md:row-span-5 flex flex-col gap-4 pointer-events-auto">

          {/* GNN GRID ANALYZER WITH MAP INTERACTION */}
          <HudPanel title="GNN Grid Analyzer">
            <div className="max-h-48 overflow-y-auto pr-2 space-y-2">
              {data.gridAssets.map(asset => (
                <details
                  key={asset.id}
                  className="bg-slate-900/50 p-2 rounded border border-white/5 cursor-pointer group"
                  onToggle={(e) => {
                    // Only trigger flight matrix vectors when the panel state opens
                    if (e.currentTarget.open && asset.coordinates) {
                      handlePanToTarget(asset.coordinates[0], asset.coordinates[1]);
                    }
                  }}
                >
                  <summary className="text-[11px] font-mono text-emerald-400 list-none flex justify-between items-center select-none">
                    <span>{asset.name}</span>
                    <span className="text-slate-500 group-open:rotate-180 transition-transform text-[9px]">▼</span>
                  </summary>
                  <div className="text-[10px] text-slate-400 mt-2 border-t border-white/5 pt-2 font-mono space-y-1">
                    <div>Status: <span className={asset.status?.toUpperCase().includes('CRITICAL') ? 'text-rose-400' : 'text-emerald-300'}>{asset.status}</span></div>
                    <div className="text-slate-500 text-[9px]">Routing: {asset.power_routing}</div>
                  </div>
                </details>
              ))}
            </div>
          </HudPanel>
          <HudPanel title="Logistics & Mutual Aid">
            <div className="max-h-56 overflow-y-auto pr-2 space-y-2">
              {data.routingGeoJson.features.map((route, i) => {
                const blurb = getLogisticsBlurb(route.properties.origin_kitchen, route.properties.urgency);
                return (
                  <div key={i} className="bg-slate-900/50 p-3 rounded border border-white/10 text-[10px] font-mono">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-emerald-400 font-bold">{route.properties.origin_kitchen}</span>
                      <span className="text-slate-500">→</span>
                      <span className="text-purple-400 font-bold">{route.properties.destination_shelter}</span>
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

      </div>
    </div>
  );
}