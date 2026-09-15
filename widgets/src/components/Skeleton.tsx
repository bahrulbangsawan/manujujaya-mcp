export function Skeleton({ rows = 5, note }: { rows?: number; note?: string }) {
  return (
    <div role="status" aria-busy="true" className="space-y-2">
      <span className="sr-only">Memuat data…</span>
      {note ? <p className="text-sm text-fg-muted">{note}</p> : null}
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} aria-hidden="true" className="h-9 animate-pulse rounded-md bg-surface-muted motion-reduce:animate-none" />
      ))}
    </div>
  );
}
