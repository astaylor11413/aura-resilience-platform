export function HudPanel({ title, children }) {
  return (
    // Changed to slate-900/40 for a slightly lighter/more neutral tint
    // backdrop-blur-xl ensures the map lines bleed through effectively
    <div className="bg-slate-900/30 backdrop-blur-xl border border-white/20 rounded-xl p-4 flex flex-col gap-3 shadow-2xl transition-all duration-300 hover:bg-slate-900/60">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <h2 className="text-[10px] font-bold tracking-widest text-white uppercase font-mono">
          {title}
        </h2>
        <span className="text-[8px] font-mono bg-white/10 px-1.5 py-0.5 rounded text-emerald-400 border border-white/20">
          AI_ENGINE_ACTIVE
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {children}
      </div>
    </div>
  );
} 