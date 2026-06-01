import React, { useState, useEffect } from 'react';
import Map, { Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Retrieve MAPBOX token 
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

export default function App() {
  // ==========================================
  // STATE MATRIX
  // ==========================================
  const [windSpeed, setWindSpeed] = useState(25);
  const [slrMeters, setSlrMeters] = useState(0.0);
  const [activeThreatIndex, setActiveThreatIndex] = useState(null);
  const [airGapped, setAirGapped] = useState(false);

  // Guarded Backend Repositories (Initialized to structural defaults)
  const [gridAssets, setGridAssets] = useState([]); 
  const [gridState, setGridState] = useState('NOMINAL');
  const [derOutput, setDerOutput] = useState(0.0);
  const [marineAnomalies, setMarineAnomalies] = useState([]);
  const [triageReport, setTriageReport] = useState(null);
  
  const [routingGeoJson, setRoutingGeoJson] = useState({ type: 'FeatureCollection', features: [] });
  const [inundationGeoJson, setInundationGeoJson] = useState({ type: 'FeatureCollection', features: [] });

  // UI Operational Flags
  const [isProcessingReport, setIsProcessingReport] = useState(false);
  const [manualReportText, setManualReportText] = useState('');

  // Map Navigation Engine Viewport State
  const [viewState, setViewState] = useState({
    longitude: -76.78,
    latitude: 17.95,
    zoom: 11,
    pitch: 35
  });

  // ==========================================
  // DATA SYNCHRONIZATION PIPELINES
  // ==========================================

  // 1. Grid Simulation API Sync Pipeline
  useEffect(() => {
    const threatQuery = activeThreatIndex !== null ? `&threat_index=${activeThreatIndex}` : '';
    fetch(`https://aura-resilience-platform-qa.onrender.com/api/v1/resilience/simulate-grid?wind_speed_mph=${windSpeed}${threatQuery}`)
      .then(res => res.json())
      .then(data => {
        if (data && typeof data === 'object') {
          // Anticipate both payload structural options defensively
          if (Array.isArray(data.assets)) {
            setGridAssets(data.assets);
          } else if (data.assets && Array.isArray(data.assets.assets)) {
            setGridAssets(data.assets.assets);
          } else {
            setGridAssets([]);
          }
          setGridState(data.grid_state || 'NOMINAL');
          setDerOutput(data.calculated_der_output_kw || 0.0);
        }
      })
      .catch(err => {
        console.error("Grid Sync Fault [Recovered]:", err);
        setGridAssets([]); // Fallback state execution to prevent rendering crashes
      });
  }, [windSpeed, activeThreatIndex]);

  // 2. Inundation Vector Sync Pipeline
  useEffect(() => {
    fetch(`https://aura-resilience-platform-qa.onrender.com/api/v1/hazard/inundation?slr_meters=${slrMeters}`)
      .then(res => res.json())
      .then(geoJson => {
        if (geoJson && geoJson.type === 'FeatureCollection') {
          setInundationGeoJson(geoJson);
        }
      })
      .catch(err => console.error("Inundation Vector Fault [Recovered]:", err));
  }, [slrMeters]);

  // 3. Static Oceanographic Vectors & Logistics Paths Sync Pipeline
  useEffect(() => {
    fetch('https://aura-resilience-platform-qa.onrender.com/api/v1/marine/thermal-anomalies')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.features)) setMarineAnomalies(data.features);
      })
      .catch(err => console.error("Marine Thermal Vector Fault [Recovered]:", err));

    fetch('https://aura-resilience-platform-qa.onrender.com/api/v1/spatial/mutual-aid-paths')
      .then(res => res.json())
      .then(geoJson => {
        if (geoJson && Array.isArray(geoJson.features)) {
          setRoutingGeoJson(geoJson);
        } else {
          setRoutingGeoJson({ type: 'FeatureCollection', features: [] });
        }
      })
      .catch(err => console.error("Logistics Route Matrix Fault [Recovered]:", err));
  }, []);

  // 4. Actionable Incident Submission Handler
  const handleTriageSubmission = async (e) => {
    e.preventDefault();
    if (!manualReportText.trim()) return;

    setIsProcessingReport(true);
    const formData = new FormData();
    formData.append("text", manualReportText);
    formData.append("air_gapped", airGapped.toString());
    formData.append("wind_speed", windSpeed.toString());

    try {
      const response = await fetch('https://aura-resilience-platform-qa.onrender.com/api/v1/voice/report', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (data) {
        setTriageReport(data);
        if (data.matched_node_threat_index !== null && data.matched_node_threat_index !== undefined) {
          setActiveThreatIndex(data.matched_node_threat_index);
        }
        executeVoiceBroadcast(data.actionable_tactical_playbook || '');
      }
    } catch (err) {
      console.error("Multi-modal Triage pipeline error [Recovered]:", err);
    } finally {
      setIsProcessingReport(false);
    }
  };

  // 5. Audio Broadcast Engine
  const executeVoiceBroadcast = async (textToSpeak) => {
    if (!textToSpeak) return;
    if (airGapped) {
      const hostUtterance = new SpeechSynthesisUtterance(textToSpeak);
      hostUtterance.rate = 0.95;
      window.speechSynthesis.speak(hostUtterance);
      return;
    }

    try {
      const res = await fetch('https://aura-resilience-platform-qa.onrender.com/api/v1/voice/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToSpeak })
      });

      const blob = await res.blob();
      if (blob && blob.type.includes("audio")) {
        const audioUrl = URL.createObjectURL(blob);
        const alertAudio = new Audio(audioUrl);
        await alertAudio.play();
      } else {
        const fallbackUtterance = new SpeechSynthesisUtterance(textToSpeak);
        window.speechSynthesis.speak(fallbackUtterance);
      }
    } catch (err) {
      const errUtterance = new SpeechSynthesisUtterance(textToSpeak);
      window.speechSynthesis.speak(errUtterance);
    }
  };

  const flyToSpatialCoordinate = (coords) => {
    if (!Array.isArray(coords) || coords.length < 2) return;
    setViewState(prev => ({
      ...prev,
      longitude: coords[0],
      latitude: coords[1],
      zoom: 13,
      transitionDuration: 1200
    }));
  };

  // Helper logic for varied telemetry shapes (Points vs Polygons)
  const getFeatureCenter = (feat) => {
    if (!feat || !feat.geometry) return [-76.78, 17.95];
    const { type, coordinates } = feat.geometry;
    
    if (type === 'Point' && Array.isArray(coordinates)) {
      return coordinates;
    }
    if ((type === 'Polygon' || type === 'MultiPolygon') && Array.isArray(coordinates)) {
      try {
        const firstRing = type === 'Polygon' ? coordinates[0] : coordinates[0][0];
        if (Array.isArray(firstRing) && firstRing.length > 0) return firstRing[0];
      } catch (e) {
        return [-76.78, 17.95];
      }
    }
    return [-76.78, 17.95];
  };

  // ==========================================
  // SPATIAL GEOJSON COMPILERS
  // ==========================================
  const compiledSubstationGeoJson = (() => {
    if (!Array.isArray(gridAssets) || gridAssets.length === 0) return null;
    
    try {
      return {
        type: "FeatureCollection",
        features: gridAssets.map(asset => {
          if (!asset || !Array.isArray(asset.coordinates)) return null;

          const rawStatus = String(asset.status || 'nominal').toLowerCase();
          let parsedStatusToken = 'nominal';

          if (rawStatus.includes('down') || rawStatus.includes('critical') || rawStatus.includes('severed')) {
            parsedStatusToken = 'critical';
          } else if (rawStatus.includes('islanded') || rawStatus.includes('autonomous')) {
            parsedStatusToken = 'islanded';
          }

          return {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: asset.coordinates
            },
            properties: {
              id: asset.id || Math.random().toString(),
              name: asset.name || 'Unnamed Substation',
              status: parsedStatusToken
            }
          };
        }).filter(Boolean)
      };
    } catch (e) {
      console.error("GeoJSON compiler failure exception caught:", e);
      return null;
    }
  })();

  // Defensively compile kitchen/shelter metadata into explicit LineString segments for Mapbox Layer support
  const verifiedRoutingGeoJson = (() => {
    if (!routingGeoJson || !Array.isArray(routingGeoJson.features)) {
      return { type: 'FeatureCollection', features: [] };
    }

    const processedFeatures = routingGeoJson.features.map(route => {
      if (route.geometry && (route.geometry.type === 'LineString' || route.geometry.type === 'MultiLineString')) {
        return route;
      }

      const originCoords = route.properties?.origin_coordinates; 
      const destCoords = route.properties?.destination_coordinates;

      if (Array.isArray(originCoords) && Array.isArray(destCoords)) {
        return {
          type: "Feature",
          properties: route.properties,
          geometry: {
            type: "LineString",
            coordinates: [originCoords, destCoords]
          }
        };
      }
      return null;
    }).filter(Boolean);

    return { type: 'FeatureCollection', features: processedFeatures };
  })();

  // Defensively compile raw marine telemetry arrays into standard GeoJSON features
  const compiledMarineGeoJson = (() => {
    if (!Array.isArray(marineAnomalies) || marineAnomalies.length === 0) {
      return { type: 'FeatureCollection', features: [] };
    }
    
    return {
      type: "FeatureCollection",
      features: marineAnomalies.map(anomaly => {
        if (!anomaly || !anomaly.geometry) return null;
        return {
          type: "Feature",
          geometry: anomaly.geometry,
          properties: {
            ...anomaly.properties,
            status: anomaly.properties?.ai_watchdog_status || 'NOMINAL'
          }
        };
      }).filter(Boolean)
    };
  })();

  return (
    <div className="dashboard-workspace relative w-screen h-screen overflow-hidden text-slate-100 bg-slate-950 font-sans">

      {/* MAP UNDERLAY CANVAS */}
      <div className="map-underlay-container absolute top-0 left-0 w-full h-full z-0">
        <Map
          {...viewState}
          onMove={evt => setViewState(evt.viewState)}
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          style={{ width: '100%', height: '100%' }}
        >
          {/* Inundation Layer */}
          {inundationGeoJson?.features?.length > 0 && (
            <Source type="geojson" data={inundationGeoJson}>
              <Layer
                id="inundation-layer"
                type="fill"
                paint={{
                  'fill-color': '#0ea5e9',
                  'fill-opacity': 0.45,
                  'fill-outline-color': '#38bdf8'
                }}
              />
            </Source>
          )}

          {/* Mutual Aid Route Layer */}
          {verifiedRoutingGeoJson?.features?.length > 0 && (
            <Source type="geojson" data={verifiedRoutingGeoJson}>
              <Layer
                id="mutual-aid-layer"
                type="line"
                layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                paint={{
                  'line-color': '#a855f7',
                  'line-width': 4,
                  'line-dasharray': [2, 2]
                }}
              />
            </Source>
          )}

          {/* OCEANOGRAPHIC WATCHDOG TELEMETRY LAYER */}
          {compiledMarineGeoJson?.features?.length > 0 && (
            <Source type="geojson" data={compiledMarineGeoJson}>
              {/* Dynamic polygon fill matching thermal zone coordinates */}
              <Layer
                id="marine-anomaly-polygon-layer"
                type="fill"
                paint={{
                  'fill-color': '#f59e0b',
                  'fill-opacity': 0.15,
                  'fill-outline-color': '#fbbf24'
                }}
              />
              {/* 3x Expanded, highly translucent regional aura pinpoint tracking impact zone radius */}
              <Layer
                id="marine-anomaly-glow-layer"
                type="circle"
                paint={{
                  'circle-radius': [
                    'interpolate',
                    ['exponential', 2],
                    ['zoom'],
                    10, ['match', ['get', 'status'], 'CRITICAL_STORM_INCUBATION', 105, 60],
                    13, ['match', ['get', 'status'], 'CRITICAL_STORM_INCUBATION', 210, 120],
                    16, ['match', ['get', 'status'], 'CRITICAL_STORM_INCUBATION', 420, 240]
                  ],
                  'circle-color': '#f59e0b',
                  'circle-opacity': 0.08,
                  'circle-stroke-width': 1.5,
                  'circle-stroke-color': '#fbbf24',
                  'circle-stroke-opacity': 0.4
                }}
              />
            </Source>
          )}

          {/* SUBSTATIONS VECTOR LAYER */}
          {compiledSubstationGeoJson && (
            <Source type="geojson" data={compiledSubstationGeoJson}>
              <Layer
                id="substations-layer"
                type="circle"
                paint={{
                  'circle-radius': 8,
                  'circle-color': [
                    'match',
                    ['get', 'status'],
                    'critical', '#e11d48',
                    'islanded', '#38bdf8',
                    '#16a34a' 
                  ],
                  'circle-stroke-width': 2,
                  'circle-stroke-color': '#ffffff'
                }}
              />
            </Source>
          )}
        </Map>
      </div>

      {/* SYSTEM CONTROLS FOREGROUND HUD CONTAINER */}
      <div className="relative w-full h-full pointer-events-none z-30 flex flex-col justify-between">

        {/* PLATFORM HEADER */}
        <header className="w-full h-14 bg-slate-900/85 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-6 pointer-events-auto">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-cyan-400 animate-pulse" />
            <h1 className="text-md font-bold tracking-wider text-white uppercase">AURA // Climate Resilience Control Center</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-800/60 border border-white/5 rounded-md text-xs">
              <span className="text-slate-400">STATE MATRIX:</span>
              <span className={`font-mono font-bold ${gridState === 'NOMINAL' ? 'text-emerald-400' : 'text-amber-400 animate-pulse'}`}>
                {gridState}
              </span>
            </div>
            <div className="text-xs font-mono text-slate-400">v3.1.0-PROD</div>
          </div>
        </header>

        {/* WORKSPACE HUD LAYOUT COMPONENTS */}
        <div className="w-full flex-grow relative px-5 py-4">

          {/* PANEL A: ENVIRONMENTAL MATRIX CONTROLS */}
          <section className="aura-hud-panel panel-controls absolute top-4 left-5 w-80 p-4 rounded-xl bg-slate-900/80 backdrop-blur-md border border-white/5 pointer-events-auto flex flex-col gap-4">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-cyan-400 mb-1">Environmental Vectors</h2>
              <p className="text-[11px] text-slate-400">Configure situational stress variables</p>
            </div>
            <hr className="border-white/5" />
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between font-mono text-xs">
                <span className="text-slate-400">Sustained Wind Field:</span>
                <span className="text-cyan-400 font-bold">{windSpeed} MPH</span>
              </div>
              <input
                type="range" min="10" max="100" value={windSpeed}
                onChange={(e) => setWindSpeed(parseFloat(e.target.value) || 25)}
                className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between font-mono text-xs">
                <span className="text-slate-400">Sea Level Surge:</span>
                <span className="text-sky-400 font-bold">+{slrMeters.toFixed(1)}m</span>
              </div>
              <input
                type="range" min="0.0" max="3.0" step="0.5" value={slrMeters}
                onChange={(e) => setSlrMeters(parseFloat(e.target.value) || 0.0)}
                className="w-full accent-sky-400 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
            </div>
            <hr className="border-white/5" />
            <div className="flex items-center justify-between p-2 bg-slate-950/40 border border-white/5 rounded-lg">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-300">Air-Gapped Hardware Mode</span>
                <span className="text-[10px] text-slate-400">Enforce local execution</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox" checked={airGapped}
                  onChange={(e) => setAirGapped(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 peer-checked:after:bg-amber-400 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500/20"></div>
              </label>
            </div>
          </section>

          {/* PANEL B: GNN GRID ISOLATION HUDS */}
          <section className="aura-hud-panel panel-gnn-status absolute top-4 left-[360px] right-[400px] h-48 p-4 rounded-xl bg-slate-900/80 backdrop-blur-md border border-white/5 pointer-events-auto flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-1">Topological GNN Grid Isolation Analyzer</h2>
                <p className="text-[11px] text-slate-400">Calculated power capture: <span className="font-mono font-bold text-slate-200">{derOutput} kW</span></p>
              </div>
              {activeThreatIndex !== null && (
                <button
                  onClick={() => setActiveThreatIndex(null)}
                  className="text-[10px] font-mono px-2 py-0.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded hover:bg-rose-500/20"
                >
                  CLEAR THREAT TARGET
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3 h-[110px] overflow-y-auto pr-1 mt-1">
              {Array.isArray(gridAssets) && gridAssets.map(asset => {
                if (!asset) return null;
                const statusStr = asset.status || 'NOMINAL';
                const isTargeted = statusStr.includes("CRITICAL") || statusStr.includes("SEVERED");
                const isIslanded = statusStr.includes("ISLANDED");
                return (
                  <div
                    key={asset.id || Math.random()}
                    onClick={() => flyToSpatialCoordinate(asset.coordinates)}
                    className={`p-2.5 bg-slate-950/50 border rounded-lg cursor-pointer flex flex-col justify-between transition-all ${isTargeted ? 'border-rose-500/40 bg-rose-950/10 hover:border-rose-400' :
                      isIslanded ? 'border-blue-500/40 bg-blue-950/10 hover:border-blue-400' : 'border-white/5 hover:border-white/20'
                      }`}
                  >
                    <div>
                      <div className="flex justify-between items-start gap-1">
                        <span className="text-[11px] font-bold tracking-wide truncate block max-w-[120px]">{asset.name || 'Unknown'}</span>
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 mt-1 ${isTargeted ? 'bg-rose-500' : isIslanded ? 'bg-blue-400 animate-pulse' : 'bg-emerald-400'}`} />
                      </div>
                      <span className="text-[9px] font-mono uppercase text-slate-400 block mt-0.5">{asset.type || 'UNKNOWN'}</span>
                    </div>
                    <div className="mt-1">
                      <div className="text-[10px] font-mono text-slate-300 truncate">{statusStr}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* PANEL C: OCEANOGRAPHIC WATCHDOG ARRAY */}
          <section className="aura-hud-panel panel-marine-sat absolute top-4 right-5 w-[360px] p-4 rounded-xl bg-slate-900/80 backdrop-blur-md border border-white/5 pointer-events-auto flex flex-col gap-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-teal-400 mb-1">Oceanographic Watchdog Telemetry</h2>
              <p className="text-[11px] text-slate-400">Live oceanic anomaly matrices</p>
            </div>
            <hr className="border-white/5" />
            <div className="flex flex-col gap-2 max-h-36 overflow-y-auto pr-1">
              {marineAnomalies.map((feat, i) => {
                const props = feat?.properties || {};
                const isCritical = props.ai_watchdog_status === "CRITICAL_STORM_INCUBATION";
                return (
                  <div
                    key={i}
                    onClick={() => flyToSpatialCoordinate(getFeatureCenter(feat))}
                    className="p-2 bg-slate-950/40 border border-white/5 rounded-lg flex justify-between items-center text-xs cursor-pointer hover:border-teal-500/40 hover:bg-slate-900/40 transition-all"
                  >
                    <div className="flex flex-col max-w-[180px]">
                      <span className="font-medium truncate text-slate-200">{props.location_name || 'Unknown Node'}</span>
                      <span className={`text-[9px] font-mono mt-0.5 ${isCritical ? 'text-amber-400 font-bold' : 'text-slate-500'}`}>
                        AI EVAL: {props.ai_watchdog_status || 'NOMINAL'}
                      </span>
                    </div>
                    <div className="text-right font-mono text-[11px]">
                      <div className="text-teal-400">ΔT: +{props.surface_temp_anomaly_celsius || 0}°C</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* PANEL D: LOGISTICS INCIDENT TRANSCRIBER TEXTBOX */}
          <section className="aura-hud-panel panel-triage-audio absolute bottom-4 left-5 w-[420px] p-4 rounded-xl bg-slate-900/80 backdrop-blur-md border border-white/5 pointer-events-auto flex flex-col gap-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-1">Dialect-Mapped Logistics Transcriber</h2>
              <p className="text-[11px] text-slate-400">Processes localized incident reports and executes protocols</p>
            </div>
            <hr className="border-white/5" />
            <form onSubmit={handleTriageSubmission} className="flex flex-col gap-2">
              <textarea
                value={manualReportText}
                onChange={(e) => setManualReportText(e.target.value)}
                placeholder="Enter emergency transmission text or dialect logs..."
                className="w-full h-16 bg-slate-950/70 border border-white/10 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 transition-all resize-none"
              />
              <button
                type="submit"
                disabled={isProcessingReport}
                className="w-full py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 text-white font-mono uppercase text-xs tracking-wider rounded-lg font-bold transition-all"
              >
                {isProcessingReport ? 'Evaluating NLP Vector Grid...' : 'Process Tactical Transmission'}
              </button>
            </form>
            {triageReport && (
              <div className="mt-1 p-2 bg-purple-950/20 border border-purple-500/30 rounded-lg flex flex-col gap-1">
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-purple-400 font-bold uppercase">PROFILE: {triageReport.triage_incident_profile || 'UNKNOWN'}</span>
                </div>
                <div className="text-xs bg-slate-950/60 p-2 rounded font-mono border border-white/5 max-h-20 overflow-y-auto text-slate-300">
                  {triageReport.actionable_tactical_playbook || 'No tactics mapped.'}
                </div>
              </div>
            )}
          </section>

          {/* PANEL E: MUTUAL AID ROUTER MATRIX */}
          <section className="aura-hud-panel panel-mutual-aid absolute bottom-4 right-5 w-[400px] p-4 rounded-xl bg-slate-900/80 backdrop-blur-md border border-white/5 pointer-events-auto flex flex-col gap-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-1">Mutual Aid Real-Time Routing</h2>
              <p className="text-[11px] text-slate-400">Nearest-Neighbor spatial allocation models</p>
            </div>
            <hr className="border-white/5" />
            <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">
              {verifiedRoutingGeoJson?.features?.map((route, idx) => {
                const props = route?.properties || {};
                return (
                  <div key={idx} className="p-2 bg-slate-950/40 border border-white/5 rounded-lg flex flex-col gap-1 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-200 truncate max-w-[180px]">{props.origin_kitchen || 'Origin'}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                      <span>➔ Routed Vector to:</span>
                      <span className="text-slate-300 truncate max-w-[180px]">{props.destination_shelter || 'Destination'}</span>
                    </div>
                  </div>
                );
              })}
              {(!verifiedRoutingGeoJson?.features || verifiedRoutingGeoJson.features.length === 0) && (
                <div className="text-center font-mono text-slate-500 py-4 text-xs">No active supply chains compiled</div>
              )}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}