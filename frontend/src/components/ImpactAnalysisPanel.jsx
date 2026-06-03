import React, { useState } from 'react';

export function ImpactAnalysisPanel({ 
  currentTimeStep, 
  onTimeStepChange, 
  structuralStats, 
  onClose 
}) {
  const [selectedBuilding, setSelectedBuilding] = useState(null);

  // Simulation time labels matching the 5-minute interval CRF slices
  const timeSlices = Array.from({ length: 12 }, (_, i) => {
    const minutes = (i + 1) * 5;
    return `12:${minutes < 10 ? '0' : ''}${minutes} AM`;
  });

  return (
    <div className="bg-slate-950/90 backdrop-blur-2xl border border-rose-500/30 rounded-xl p-5 shadow-2xl flex flex-col gap-4 font-mono max-w-md w-full pointer-events-auto text-white">
      
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between border-b border-rose-500/20 pb-2">
        <div>
          <h2 className="text-xs font-bold tracking-widest text-rose-500 uppercase flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            ArcGIS Infrastructure Impact Engine
          </h2>
          <p className="text-[9px] text-slate-400 uppercase mt-0.5">
            Active Dataset: Houston Structural Sample Extents
          </p>
        </div>
        <button 
          onClick={onClose}
          className="text-[9px] bg-slate-900 border border-white/10 px-2 py-0.5 rounded hover:bg-slate-800 text-slate-400 transition-colors cursor-pointer"
        >
          HALT_SIM
        </button>
      </div>

      {/* MULTIDIMENSIONAL TIMELINE PLAYBACK (CRF Controller) */}
      <div className="bg-slate-900/60 p-3 rounded-lg border border-white/5 space-y-2">
        <div className="flex justify-between items-center text-[10px]">
          <span className="text-slate-400 uppercase tracking-wider">Temporal Matrix Step:</span>
          <span className="text-cyan-400 font-bold">{timeSlices[currentTimeStep]}</span>
        </div>
        <input 
          type="range" 
          min="0" 
          max="11" 
          value={currentTimeStep} 
          onChange={(e) => onTimeStepChange(parseInt(e.target.value))}
          className="w-full accent-rose-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
        />
        <div className="flex justify-between text-[8px] text-slate-500">
          <span>+5 MIN</span>
          <span>STORM PEAK (60 MIN)</span>
        </div>
      </div>

      {/* INFRASTRUCTURE IMPACT METRICS (FEMA / NWS Benchmarks) */}
      <div className="space-y-2 text-[10px]">
        <h3 className="text-slate-400 uppercase tracking-wider text-[9px]">Structural Inundation Distribution</h3>
        
        <div className="grid grid-cols-3 gap-1.5 text-center">
          <div className="bg-amber-950/30 border border-amber-500/20 p-2 rounded">
            <span className="text-amber-400 font-bold text-sm block">{structuralStats.carsRisk}</span>
            <span className="text-[8px] text-slate-400 uppercase">≥12" (Car Float)</span>
          </div>
          <div className="bg-orange-950/30 border border-orange-500/20 p-2 rounded">
            <span className="text-orange-400 font-bold text-sm block">{structuralStats.suvRisk}</span>
            <span className="text-[8px] text-slate-400 uppercase">≥24" (SUV Float)</span>
          </div>
          <div className="bg-rose-950/30 border border-rose-500/20 p-2 rounded">
            <span className="text-rose-400 font-bold text-sm block">{structuralStats.structuralFailure}</span>
            <span className="text-[8px] text-slate-400 uppercase">≥36" (Breached)</span>
          </div>
        </div>
      </div>

      {/* TEMPORAL PROFILE MINI-CHART CONTAINER */}
      <div className="bg-slate-900/40 border border-white/5 p-3 rounded-lg space-y-2">
        <span className="text-[9px] text-slate-400 block uppercase tracking-wider">
          Temporal Depth Profile (Goliad St Corridor Point Sample)
        </span>
        <div className="h-16 flex items-end gap-1.5 pt-2 border-b border-white/10 px-1">
          {structuralStats.historicalDepthProfile.map((depth, idx) => (
            <div 
              key={idx} 
              style={{ height: `${Math.min(100, depth * 70)}%` }}
              className={`w-full rounded-t-sm transition-all duration-300 relative group cursor-pointer ${
                idx === currentTimeStep ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'bg-rose-600/60 hover:bg-rose-500'
              }`}
              onClick={() => onTimeStepChange(idx)}
            >
              {/* Tooltip on hover */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 bg-slate-900 text-white font-mono text-[7px] py-0.5 px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap mb-1 border border-white/10">
                {depth.toFixed(2)}m
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[7px] text-slate-500">
          <span>05m</span>
          <span>15m</span>
          <span>30m</span>
          <span>45m</span>
          <span>60m</span>
        </div>
      </div>

      {/* ACTION CONTROLLER */}
      <div className="text-[8px] bg-cyan-950/20 border border-cyan-500/20 p-2 rounded text-cyan-300 leading-normal uppercase">
        <span className="font-bold text-cyan-400 block">[MVT LAYER BROADCAST]</span>
        Draping vector segments onto USGS 1-meter lidar DEM mesh. Structural geometries are dynamically scaling attributes based on active timestamp.
      </div>
    </div>
  );
}