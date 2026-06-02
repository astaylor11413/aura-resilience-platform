import React from 'react';

export function HudPanel({ title, children }) {
  return (
    <div className="bg-slate-900/75 backdrop-blur-md border border-white/5 rounded-xl p-4 flex flex-col gap-3 shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <h2 className="text-[10px] font-bold tracking-widest text-slate-400 uppercase font-mono">
          {title}
        </h2>
        <span className="text-[8px] font-mono bg-white/5 px-1.5 py-0.5 rounded text-slate-500 border border-white/5">
          AI_ENGINE_ACTIVE
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {children}
      </div>
    </div>
  );
}