export function HudPanel({ title, children }) {
  return (
    // Lowered from /50 to /30 for more transparency
    <div className="bg-slate-950/30 backdrop-blur-md border border-white/10 rounded-xl p-4 flex flex-col gap-3 shadow-xl transition-all duration-300 hover:bg-slate-950/60">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <h2 className="text-[10px] font-bold tracking-widest text-slate-200 uppercase font-mono">
          {title}
        </h2>
        <span className="text-[8px] font-mono bg-white/5 px-1.5 py-0.5 rounded text-slate-400 border border-white/5">
          AI_ENGINE_ACTIVE
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {children}
      </div>
    </div>
  );
}