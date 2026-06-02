import React, { useState } from 'react';
import Map, { Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useAuraData } from './hooks/useAuraData';
import { HudPanel } from './components/HudPanel';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

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

const marineLayer = {
  id: 'marine-layer',
  type: 'circle',
  paint: {
    'circle-radius': [
      'interpolate', ['linear'], ['get', 'microplastic_density_ppm'],
      300, 6,
      900, 14
    ],
    'circle-color': [
      'match',
      ['get', 'status'],
      'CRITICAL_STORM_INCUBATION', '#ef4444',
      '#14b8a6' // teal-500
    ],
    'circle-opacity': 0.75
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
      '#a855f7' // purple-500 default mutual aid
    ],
    'line-width': 3,
    'line-dasharray': [2, 2]
  }
};

export default function App() {
  const { state, setters, data, geoJson } = useAuraData();
  const [reportText, setReportText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [viewState, setViewState] = useState({
    longitude: -76.78, latitude: 17.95, zoom: 11, pitch: 35
  });

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
        // Feed the threat matrix match down into the GNN engine state triggers
        if (resData.matched_node_threat_index !== null) {
          setters.setActiveThreatIndex(resData.matched_node_threat_index);
        }
        // Update local hook context data array if matching key is registered
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

          {/* Marine Thermal Anomalies Points */}
          <Source id="marine-data" type="geojson" data={geoJson.compiledMarineGeoJson}>
            <Layer {...marineLayer} />
          </Source>

          {/* Physics-Informed Substation Points */}
          <Source id="substation-data" type="geojson" data={geoJson.compiledSubstationGeoJson}>
            <Layer {...substationLayer} />
          </Source>
        </Map>
      </div>

      {/* RESPONSIVE HUD FOREGROUND */}
      <div className="relative md:absolute inset-0 z-30 pt-[42vh] md:pt-0 p-4 md:p-6 pointer-events-none grid grid-cols-1 md:grid-cols-12 md:grid-rows-6 gap-4 overflow-y-auto md:overflow-visible">
        
        {/* HEADER BAR */}
        <header className="col-span-1 md:col-span-12 h-14 bg-slate-900/80 backdrop-blur-md border border-white/5 rounded-xl flex items-center justify-between px-6 pointer-events-auto order-first md:order-none">
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${state.gridState === 'NOMINAL' ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`} />
            <h1 className="text-sm font-bold tracking-widest text-white uppercase">AURA // Command Center</h1>
          </div>
          <div className="flex items-center gap-6 font-mono text-xs text-slate-400">
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

          <HudPanel title="Logistics Transcriber">
            <textarea 
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              placeholder="Enter incident report (e.g., 'Palisadoes line is underwater down south')..." 
              className="w-full h-20 bg-slate-950/50 border border-white/10 rounded p-2 text-xs text-slate-200 resize-none focus:border-purple-500 outline-none font-sans" 
            />
            <button 
              onClick={handleProcessTransmission}
              disabled={isProcessing}
              className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 text-[10px] py-2 rounded font-bold uppercase transition-colors text-white mt-1"
            >
              {isProcessing ? 'Processing Regional Transmission...' : 'Process Transmission'}
            </button>
          </HudPanel>
        </div>

        {/* CENTER COLUMN PLACEHOLDER */}
        <div className="hidden md:block md:col-span-6 md:row-span-5" />

        {/* RIGHT COLUMN: Telemetry & Analyzers */}
        <div className="col-span-1 md:col-span-3 md:row-span-5 flex flex-col gap-4 pointer-events-auto">
          <HudPanel title="GNN Grid Analyzer">
            <div className="max-h-48 overflow-y-auto pr-2 space-y-2">
              {data.gridAssets.map(asset => (
                <details key={asset.id} className="bg-slate-900/50 p-2 rounded border border-white/5 cursor-pointer group">
                  <summary className="text-[11px] font-mono text-emerald-400 list-none flex justify-between items-center">
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

          <HudPanel title="Oceanographic Watchdog">
            <div className="max-h-48 overflow-y-auto pr-2 space-y-2">
              {data.marineAnomalies.map((m, i) => (
                <div key={i} className="text-[10px] p-2 border-l-2 border-teal-500 bg-slate-900/50 rounded-r flex justify-between items-center font-mono">
                  <div>
                    <div className="font-bold text-slate-200">{m.properties?.location_name || 'Unknown Hub'}</div>
                    <div className="text-[9px] text-slate-500">Watchdog: {m.properties?.ai_watchdog_status}</div>
                  </div>
                  <div className="text-teal-400">+{m.properties?.surface_temp_anomaly_celsius || 0}°C</div>
                </div>
              ))}
            </div>
          </HudPanel>
        </div>

      </div>
    </div>
  );
}