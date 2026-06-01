import React, { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Retrieve MAPBOX token
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

export default function App() {
  // Map core references
  const mapContainer = useRef(null);
  const map = useRef(null);

  // Simulation State Matrix
  const [windSpeed, setWindSpeed] = useState(25);
  const [slrMeters, setSlrMeters] = useState(0.0);
  const [activeThreatIndex, setActiveThreatIndex] = useState(null);
  const [airGapped, setAirGapped] = useState(false);

  // Dynamic Backend Response Payload Repositories
  const [gridAssets, setGridAssets] = useState([]);
  const [gridState, setGridState] = useState('NOMINAL');
  const [derOutput, setDerOutput] = useState(0.0);
  const [marineAnomalies, setMarineAnomalies] = useState([]);
  const [triageReport, setTriageReport] = useState(null);
  const [routingGeoJson, setRoutingGeoJson] = useState(null);
  
  // UI Operational States
  const [isProcessingReport, setIsProcessingReport] = useState(false);
  const [manualReportText, setManualReportText] = useState('');

 // 1. Initialize Mapbox Canvas Base Layer (RUNS EXACTLY ONCE ON MOUNT)
  useEffect(() => {
    if (map.current) return; // Guard clause ensures single canvas context allocation
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-76.78, 17.95], 
      zoom: 11,
      pitch: 35
    });

    map.current.on('load', () => {
      // Register Inundation Source Baseline Layer
      map.current.addSource('inundation-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      map.current.addLayer({
        id: 'inundation-layer',
        type: 'fill',
        source: 'inundation-source',
        paint: {
          'fill-color': '#0ea5e9',
          'fill-opacity': 0.45,
          'fill-outline-color': '#38bdf8'
        }
      });

      // Register Logistics Route Source Baseline Layer
      map.current.addSource('mutual-aid-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      map.current.addLayer({
        id: 'mutual-aid-layer',
        type: 'line',
        source: 'mutual-aid-source',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#a855f7',
          'line-width': 4,
          'line-dasharray': [2, 2]
        }
      });

      // CLEAN INITIALIZATION: Register empty point vector source matrix fallback
      map.current.addSource('substations-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      // Render Circle Canvas Points explicitly over baseline geometry sets
      map.current.addLayer({
        id: 'substations-layer',
        type: 'circle',
        source: 'substations-source',
        paint: {
          'circle-radius': 7,
          'circle-color': [
            'match',
            ['lowercase', ['coalesce', ['get', 'status'], 'nominal']],
            'critical', '#f43f5e',
            'severed', '#f43f5e',
            'islanded', '#38bdf8',
            '#10b981' // Nominal Emerald Green Baseline Color
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#0f172a'
        }
      });
    });

  }, []); // EMPTY ARRAY: Keeps initialization separate from data streams


  // 2. Real-Time Telemetry Synchronization Engine
  useEffect(() => {
    if (map.current && map.current.isStyleLoaded() && map.current.getSource('substations-source')) {
      map.current.getSource('substations-source').setData({
        type: 'FeatureCollection',
        features: gridAssets.map(asset => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: asset.coordinates },
          properties: { id: asset.id, name: asset.name, status: asset.status || 'NOMINAL' }
        }))
      });
    }
  }, [gridAssets]); // Executes instantly whenever dependencies refresh from sliders

  useEffect(() => {
  if (map.current && map.current.getSource('substations-source') && gridAssets.length > 0) {
    map.current.getSource('substations-source').setData({
      type: 'FeatureCollection',
      features: gridAssets.map(asset => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: asset.coordinates },
        properties: { id: asset.id, name: asset.name, status: asset.status }
      }))
    });
  }
}, [gridAssets]);

  // 3. Telemetry Core Synchronizer: NOAA Inundation Multi-Polygon Matrix Mapping
  useEffect(() => {
    fetch(`http://localhost:8000/api/v1/hazard/inundation?slr_meters=${slrMeters}`)
      .then(res => res.json())
      .then(geoJson => {
        if (map.current && map.current.getSource('inundation-source')) {
          map.current.getSource('inundation-source').setData(geoJson);
        }
      })
      .catch(err => console.error("Inundation Vector Fault:", err));
  }, [slrMeters]);

  // 4. Ingestion Sync: Fetch Static Marine Hotspots & Spatial Logistics Routes
  useEffect(() => {
    fetch('http://localhost:8000/api/v1/marine/thermal-anomalies')
      .then(res => res.json())
      .then(data => setMarineAnomalies(data.features || []))
      .catch(err => console.error("Marine Thermal Vector Fault:", err));

    fetch('http://localhost:8000/api/v1/spatial/mutual-aid-paths')
      .then(res => res.json())
      .then(geoJson => {
        setRoutingGeoJson(geoJson);
        if (map.current && map.current.getSource('mutual-aid-source')) {
          map.current.getSource('mutual-aid-source').setData(geoJson);
        }
      })
      .catch(err => console.error("Logistics Route Matrix Fault:", err));
  }, []);

  // 5. Actionable Handler: Parse Dialect Audio/Text Reports
  const handleTriageSubmission = async (e) => {
    e.preventDefault();
    if (!manualReportText.trim()) return;
    
    setIsProcessingReport(true);
    const formData = new FormData();
    formData.append("text", manualReportText);
    formData.append("air_gapped", airGapped.toString());
    formData.append("wind_speed", windSpeed.toString());

    try {
      const response = await fetch('http://localhost:8000/api/v1/voice/report', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      setTriageReport(data);

      // Auto-cascade threat indexes directly into our topology engine state
      if (data.matched_node_threat_index !== null) {
        setActiveThreatIndex(data.matched_node_threat_index);
      }

      // Execute Accent-Aware Text-To-Speech Broadcast Loop
      executeVoiceBroadcast(data.actionable_tactical_playbook);
    } catch (err) {
      console.error("Multi-modal Triage pipeline error:", err);
    } finally {
      setIsProcessingReport(false);
    }
  };

  // 6. Audio Broadcast Controller Engine
  const executeVoiceBroadcast = async (textToSpeak) => {
    if (airGapped) {
      // Pure air-gapped operation fallback: Route directly via client browser rendering
      console.warn("Air-Gapped Flag True. Executing localized client WebSpeech fallback engine.");
      const hostUtterance = new SpeechSynthesisUtterance(textToSpeak);
      hostUtterance.rate = 0.95; 
      window.speechSynthesis.speak(hostUtterance);
      return;
    }

    try {
      const res = await fetch('http://localhost:8000/api/v1/voice/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToSpeak })
      });
      
      const blob = await res.blob();
      if (blob.type.includes("audio")) {
        const audioUrl = URL.createObjectURL(blob);
        const alertAudio = new Audio(audioUrl);
        await alertAudio.play();
      } else {
        // Fall back gracefully if backend framework fails outbound API verification checks
        const fallbackUtterance = new SpeechSynthesisUtterance(textToSpeak);
        window.speechSynthesis.speak(fallbackUtterance);
      }
    } catch (err) {
      console.error("Audio pipeline routing issue, executing client synthesis:", err);
      const errUtterance = new SpeechSynthesisUtterance(textToSpeak);
      window.speechSynthesis.speak(errUtterance);
    }
  };

  // 7. Interactive UI Helper Map Flyto Trigger
  const flyToSpatialCoordinate = (coords) => {
    if (!map.current) return;
    map.current.flyTo({ center: coords, zoom: 13, speed: 1.2 });
  };

  return (
    <div className="dashboard-workspace relative w-screen h-screen overflow-hidden text-slate-100 bg-slate-950 font-sans">
      
      {/* BACKGROUND ELEMENT: MAPBOX IMMERSION CANVAS ENGINE */}
      <div ref={mapContainer} className="map-underlay-container absolute top-0 left-0 w-full h-full z-10" />

      {/* FIXED PLATFORM HEADER NAVIGATION BAR OVERLAY */}
      <header className="absolute top-0 left-0 right-0 h-14 bg-slate-900/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-6 z-20">
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

      {/* PANEL HUD COMPONENT A: TELEMETRY CONTROL MATRIX CARD */}
      <section className="aura-hud-panel panel-controls absolute top-20 left-5 w-80 p-4 rounded-xl z-20 flex flex-col gap-4">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-cyan-400 mb-1">Environmental Vectors</h2>
          <p className="text-[11px] text-slate-400">Configure situational stress variables</p>
        </div>
        
        <hr className="border-white/5" />

        {/* Dynamic Wind Slider Configuration */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between font-mono text-xs">
            <span className="text-slate-400">Sustained Wind Field:</span>
            <span className="text-cyan-400 font-bold">{windSpeed} MPH</span>
          </div>
          <input 
            type="range" min="10" max="100" value={windSpeed} 
            onChange={(e) => setWindSpeed(parseFloat(e.target.value))}
            className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
          />
        </div>

        {/* Dynamic SLR Slider Configuration */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between font-mono text-xs">
            <span className="text-slate-400">Sea Level Surge:</span>
            <span className="text-sky-400 font-bold">+{slrMeters.toFixed(1)}m</span>
          </div>
          <input 
            type="range" min="0.0" max="3.0" step="0.5" value={slrMeters} 
            onChange={(e) => setSlrMeters(parseFloat(e.target.value))}
            className="w-full accent-sky-400 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
          />
        </div>

        <hr className="border-white/5" />

        {/* Air Gap Mode Defensive Toggle Switch */}
        <div className="flex items-center justify-between p-2 bg-slate-950/40 border border-white/5 rounded-lg">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-300">Air-Gapped Hardware Mode</span>
            <span className="text-[10px] text-slate-400">Enforce local model evaluation</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" checked={airGapped} 
              onChange={(e) => setAirGapped(e.target.checked)} 
              className="sr-only peer" 
            />
            <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 peer-checked:after:bg-amber-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500/20 peer-checked:border peer-checked:border-amber-500/30"></div>
          </label>
        </div>
        {airGapped && (
          <div className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 p-2 rounded text-center animate-pulse tracking-wide">
            LOCAL IN-MEMORY INFERENCE ACTIVE (CPU / BF16)
          </div>
        )}
      </section>

      {/* PANEL HUD COMPONENT B: GRID ORCHESTRATION TOPOLOGICAL PHYSICS-GNN STATUS */}
      <section className="aura-hud-panel panel-gnn-status absolute top-20 left-[360px] right-[400px] h-48 p-4 rounded-xl z-20 flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-1">Topological GNN Grid Isolation Analyzer</h2>
            <p className="text-[11px] text-slate-400">Calculated kinetic power capture: <span className="font-mono font-bold text-slate-200">{derOutput} kW</span></p>
          </div>
          {activeThreatIndex !== null && (
            <button 
              onClick={() => setActiveThreatIndex(null)}
              className="text-[10px] font-mono px-2 py-0.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded hover:bg-rose-500/20"
            >
              CLEAR ACTIVE THREAT TARGET
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 h-full mt-1">
          {gridAssets.map(asset => {
            const isTargeted = asset.status.includes("CRITICAL") || asset.status.includes("SEVERED");
            const isIslanded = asset.status.includes("ISLANDED");
            return (
              <div 
                key={asset.id} 
                onClick={() => flyToSpatialCoordinate(asset.coordinates)}
                className={`p-3 bg-slate-950/50 border rounded-lg cursor-pointer flex flex-col justify-between transition-all ${
                  isTargeted ? 'border-rose-500/40 bg-rose-950/10 hover:border-rose-400' :
                  isIslanded ? 'border-blue-500/40 bg-blue-950/10 hover:border-blue-400' : 'border-white/5 hover:border-white/20'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start gap-1">
                    <span className="text-[11px] font-bold tracking-wide truncate block max-w-[150px]">{asset.name}</span>
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 mt-1 ${isTargeted ? 'bg-rose-500 animate-ping' : isIslanded ? 'bg-blue-400 animate-pulse' : 'bg-emerald-400'}`} />
                  </div>
                  <span className="text-[9px] font-mono uppercase text-slate-400 block mt-0.5">{asset.type}</span>
                </div>
                <div className="mt-2">
                  <div className="text-[10px] font-mono text-slate-300 truncate">{asset.status}</div>
                  <div className="text-[9px] font-mono text-slate-500 mt-0.5 truncate">{asset.power_routing}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* PANEL HUD COMPONENT C: ENVIRONMENTAL WATCHDOG SATELLITE TELEMETRY */}
      <section className="aura-hud-panel panel-marine-sat absolute top-20 right-5 w-[360px] p-4 rounded-xl z-20 flex flex-col gap-3">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-teal-400 mb-1">Oceanographic Watchdog Telemetry</h2>
          <p className="text-[11px] text-slate-400">Live oceanic anomaly matrices</p>
        </div>
        <hr className="border-white/5" />
        <div className="flex flex-col gap-2 max-h-36 overflow-y-auto pr-1">
          {marineAnomalies.map((feat, i) => {
            const props = feat.properties;
            const isCritical = props.ai_watchdog_status === "CRITICAL_STORM_INCUBATION";
            return (
              <div 
                key={i}
                onClick={() => flyToSpatialCoordinate(feat.geometry.coordinates)}
                className="p-2 bg-slate-950/40 border border-white/5 rounded-lg flex justify-between items-center text-xs cursor-pointer hover:border-teal-500/40 hover:bg-slate-900/40 transition-all"
              >
                <div className="flex flex-col max-w-[200px]">
                  <span className="font-medium truncate text-slate-200">{props.location_name}</span>
                  <span className={`text-[9px] font-mono mt-0.5 ${isCritical ? 'text-amber-400 font-bold' : 'text-slate-500'}`}>
                    AI EVAL: {props.ai_watchdog_status}
                  </span>
                </div>
                <div className="text-right font-mono text-[11px]">
                  <div className="text-teal-400">ΔT: +{props.surface_temp_anomaly_celsius}°C</div>
                  <div className="text-slate-400">{props.microplastic_density_ppm} PPM</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* PANEL HUD COMPONENT D: LOGISTICS AUDIO/TEXT DIALECT INGESTION ENGINE */}
      <section className="aura-hud-panel panel-triage-audio absolute bottom-5 left-5 w-[420px] p-4 rounded-xl z-20 flex flex-col gap-3">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-1">Dialect-Mapped Logistics Transcriber</h2>
          <p className="text-[11px] text-slate-400">Processes localized incident reports and executes protocols</p>
        </div>
        <hr className="border-white/5" />
        
        <form onSubmit={handleTriageSubmission} className="flex flex-col gap-2">
          <textarea
            value={manualReportText}
            onChange={(e) => setManualReportText(e.target.value)}
            placeholder="Enter emergency transmission text or dialect logs (e.g., 'Palisadoes lines dem under water...')"
            className="w-full h-16 bg-slate-950/70 border border-white/10 rounded-lg p-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-all resize-none"
          />
          <button 
            type="submit" 
            disabled={isProcessingReport}
            className="w-full py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:text-slate-400 text-white font-mono uppercase text-xs tracking-wider rounded-lg font-bold transition-all"
          >
            {isProcessingReport ? 'Evaluating NLP In-Memory Vector Grid...' : 'Process Tactical Transmission'}
          </button>
        </form>

        {/* Tactical Playbook Output Marquee Window */}
        {triageReport && (
          <div className="mt-1 p-3 bg-purple-950/20 border border-purple-500/30 rounded-lg flex flex-col gap-2 animate-fadeIn">
            <div className="flex justify-between items-center text-[10px] font-mono">
              <span className="text-purple-400 font-bold uppercase">PROFILE: {triageReport.triage_incident_profile}</span>
              <span className="text-slate-400">NODE MATCH: #{triageReport.matched_node_threat_index ?? 'NONE'}</span>
            </div>
            <div className="text-xs bg-slate-950/60 p-2 rounded font-mono border border-white/5 max-h-24 overflow-y-auto leading-relaxed text-slate-300">
              <span className="text-amber-400 font-bold">PLAYBOOK: </span>
              {triageReport.actionable_tactical_playbook}
            </div>
            <div className="text-[10px] italic text-slate-400 font-mono truncate">
              Parsed: "{triageReport.transcription}"
            </div>
          </div>
        )}
      </section>

      {/* PANEL HUD COMPONENT E: MUTUAL AID VECTOR GRAPH SPATIAL ROUTER */}
      <section className="aura-hud-panel panel-mutual-aid absolute bottom-5 right-5 w-[400px] p-4 rounded-xl z-20 flex flex-col gap-3">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-1">Mutual Aid Real-Time Routing</h2>
          <p className="text-[11px] text-slate-400">Nearest-Neighbor spatial allocation models</p>
        </div>
        <hr className="border-white/5" />
        <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
          {routingGeoJson?.features?.map((route, idx) => {
            const props = route.properties;
            return (
              <div 
                key={idx}
                className="p-2 bg-slate-950/40 border border-white/5 rounded-lg flex flex-col gap-1 text-xs hover:border-indigo-500/30 transition-all"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-200 truncate max-w-[180px]">{props.origin_kitchen}</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded">
                    {props.permit_verification}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                  <span>➔ Routed Vector to:</span>
                  <span className="text-slate-300 truncate max-w-[180px] font-medium">{props.destination_shelter}</span>
                </div>
              </div>
            );
          })}
          {(!routingGeoJson || routingGeoJson.features.length === 0) && (
            <div className="text-center font-mono text-slate-500 py-4 text-xs">No active supply chains compiled</div>
          )}
        </div>
      </section>

    </div>
  );
}