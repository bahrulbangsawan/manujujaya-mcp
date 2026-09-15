export interface BarListItem {
  key: string;
  label: string;
  value: number;
  valueLabel: string;
  onSelect?: () => void;
}

export function BarList({ items, emptyText }: { items: BarListItem[]; emptyText: string }) {
  if (items.length === 0) return <p className="py-4 text-sm text-fg-muted">{emptyText}</p>;
  const max = Math.max(0, ...items.map((item) => item.value));
  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const width = max > 0 ? Math.max(2, (Math.max(0, item.value) / max) * 100) : 0;
        const body = (
          <>
            <span className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-fg" title={item.label}>
                {item.label}
              </span>
              <span className="shrink-0 tabular-nums text-fg-muted">{item.valueLabel}</span>
            </span>
            <span aria-hidden="true" className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-muted">
              <span className="block h-full rounded-full bg-info" style={{ width: `${width}%` }} />
            </span>
          </>
        );
        return (
          <li key={item.key}>
            {item.onSelect ? (
              <button type="button" onClick={item.onSelect} className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-surface-muted">
                {body}
              </button>
            ) : (
              <div className="px-2 py-1.5">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
