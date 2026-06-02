import React from 'react';

export function HudPanel({ title, children, onToggle }) {
  return (
    <details
      className="group bg-slate-900/30 backdrop-blur-xl border border-white/20 rounded-xl p-4 shadow-2xl transition-all duration-300 hover:bg-slate-900/60 open:bg-slate-900/60 block pointer-events-auto"
      onToggle={(e) => onToggle?.(e.currentTarget.open)}
    >
      {/* Summary element handling disclosure header status */}
      <summary className="flex items-center justify-between cursor-pointer list-none border-b border-white/10 pb-2 select-none [&::-webkit-details-marker]:hidden">
        <h2 className="text-[10px] font-bold tracking-widest text-white uppercase font-mono">
          {title}
        </h2>
        <span className="text-[8px] font-mono bg-white/10 px-1.5 py-0.5 rounded text-emerald-400 border border-white/20">
          AI_ENGINE_ACTIVE
        </span>
      </summary>

      <div className="flex flex-col gap-3 mt-3 animate-fadeIn">
        {children}
      </div>
    </details>
  );
}