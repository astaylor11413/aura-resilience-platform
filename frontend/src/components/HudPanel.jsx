export function HudPanel({ title, children, onToggle }) {
  return (
    <details
      className="bg-slate-900/30 backdrop-blur-xl border border-white/20 rounded-xl p-4 flex flex-col gap-3 shadow-2xl transition-all duration-300 hover:bg-slate-900/60 open:bg-slate-900/60"
      onToggle={(e) => onToggle?.(e.target.open)}
    >
      <summary className="flex items-center justify-between cursor-pointer list-none border-b border-white/10 pb-2">
        <h2 className="text-[10px] font-bold tracking-widest text-white uppercase font-mono">
          {title}
        </h2>
        <span className="text-[8px] font-mono bg-white/10 px-1.5 py-0.5 rounded text-emerald-400 border border-white/20">
          AI_ENGINE_ACTIVE
        </span>
      </summary>

      <div className="flex flex-col gap-2 mt-2">
        {children}
      </div>
    </details>
  );
}