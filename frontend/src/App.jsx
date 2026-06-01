import React, { useState } from 'react';
import Map, { Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useAuraData } from './hooks/useAuraData';
import { HudPanel } from './components/HudPanel';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

export default function App() {
  const { state, setters, data, geoJson } = useAuraData();
  
  const [viewState, setViewState] = useState({
    longitude: -76.78, latitude: 17.95, zoom: 11, pitch: 35
  });

  return (
    <div className="relative w-screen h-screen overflow-hidden text-slate-100 bg-slate-950 font-sans">
      
      {/* MAP UNDERLAY */}
      <div className="absolute top-0 left-0 w-full h-full z-0 pointer-events-auto">
        <Map
          {...viewState}
          onMove={evt => setViewState(evt.viewState)}
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          style={{ width: '100%', height: '100%' }}
        >
          {/* Keep your exact Source and Layer components here for Substation, Marine, Routing, and Inundation */}
        </Map>
      </div>

      {/* MODERN CSS GRID FOREGROUND */}
      <div className="absolute inset-0 z-30 pointer-events-none p-6 grid grid-cols-12 grid-rows-6 gap-4">
        
        {/* HEADER BAR */}
        <header className="col-span-12 h-14 bg-slate-900/80 backdrop-blur-md border border-white/5 rounded-xl flex items-center justify-between px-6 pointer-events-auto">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-cyan-400 animate-pulse" />
            <h1 className="text-sm font-bold tracking-widest text-white uppercase">AURA // Command Center</h1>
          </div>
          <div className="font-mono text-xs text-slate-400">
            STATE: <span className={state.gridState === 'NOMINAL' ? 'text-emerald-400' : 'text-amber-400'}>{state.gridState}</span>
          </div>
        </header>

        {/* LEFT COLUMN: Controls & Logistics */}
        <div className="col-span-3 row-span-5 flex flex-col gap-4">
          <HudPanel title="Environmental Vectors" aiBadge>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-slate-400 font-mono"><span>Wind Field</span><span className="text-cyan-400">{state.windSpeed} MPH</span></div>
              <input type="range" min="10" max="100" value={state.windSpeed} onChange={(e) => setters.setWindSpeed(e.target.value)} className="w-full accent-cyan-400 cursor-pointer" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-slate-400 font-mono"><span>Sea Level Surge</span><span className="text-sky-400">+{state.slrMeters}m</span></div>
              <input type="range" min="0" max="3" step="0.5" value={state.slrMeters} onChange={(e) => setters.setSlrMeters(e.target.value)} className="w-full accent-sky-400 cursor-pointer" />
            </div>
          </HudPanel>

          <HudPanel title="Logistics Transcriber" color="purple" aiBadge>
            <textarea placeholder="Enter incident report..." className="w-full h-20 bg-slate-950/50 border border-white/10 rounded p-2 text-xs text-slate-200 resize-none focus:border-purple-500 outline-none" />
            <button className="w-full bg-purple-600 hover:bg-purple-500 text-[10px] py-2 rounded font-bold uppercase transition-colors">Process Transmission</button>
          </HudPanel>
        </div>

        {/* CENTER COLUMN: Leave Empty for Map Visibility */}
        <div className="col-span-6 row-span-5" />

        {/* RIGHT COLUMN: Telemetry & Analyzers */}
        <div className="col-span-3 row-span-5 flex flex-col gap-4">
          <HudPanel title="GNN Grid Analyzer" color="emerald" aiBadge>
            <div className="max-h-48 overflow-y-auto pr-2 space-y-2">
              {data.gridAssets.map(asset => (
                <details key={asset.id || Math.random()} className="bg-slate-900/50 p-2 rounded border border-white/5 cursor-pointer group">
                  <summary className="text-[11px] font-mono text-emerald-400 list-none flex justify-between">
                    <span>{asset.name}</span>
                    <span className="text-slate-500 group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <div className="text-[10px] text-slate-400 mt-2 border-t border-white/5 pt-2">
                    Status: <span className={asset.status?.toUpperCase().includes('CRITICAL') ? 'text-rose-400' : 'text-slate-300'}>{asset.status}</span>
                  </div>
                </details>
              ))}
            </div>
          </HudPanel>

          <HudPanel title="Oceanographic Watchdog" color="teal" aiBadge>
            <div className="max-h-48 overflow-y-auto pr-2 space-y-2">
              {data.marineAnomalies.map((m, i) => (
                <div key={i} className="text-[10px] p-2 border-l-2 border-teal-500 bg-slate-900/50 rounded-r flex justify-between">
                  <div className="font-bold text-slate-200">{m.properties?.location_name || 'Unknown Hub'}</div>
                  <div className="text-teal-400 font-mono">+{m.properties?.surface_temp_anomaly_celsius || 0}°C</div>
                </div>
              ))}
            </div>
          </HudPanel>
        </div>

      </div>
    </div>
  );
}