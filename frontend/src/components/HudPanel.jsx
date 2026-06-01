import React from 'react';

export const HudPanel = ({ title, color = "cyan", aiBadge = false, children }) => (
  <div className="p-4 rounded-xl bg-slate-950/70 backdrop-blur-md border border-white/10 shadow-xl flex flex-col gap-3 pointer-events-auto transition-all">
    <div className="flex justify-between items-center border-b border-white/5 pb-2 mb-1">
      <h2 className={`text-[10px] font-bold uppercase tracking-widest text-${color}-400`}>{title}</h2>
      {aiBadge && (
        <span className="text-[8px] uppercase font-mono px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded">
          AI-Active
        </span>
      )}
    </div>
    <div className="flex flex-col gap-3">
      {children}
    </div>
  </div>
);