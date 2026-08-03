export function Divider({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4" aria-hidden>
      <span className="h-px flex-1 bg-border" />
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-3">
        {children}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
