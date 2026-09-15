import { formatPercent } from "../lib/format";
import { cx } from "./ui";

export interface KpiChange {
  percent: number | null;
  direction: "up" | "down" | null;
}

export function KpiTile({ label, value, change, hint }: { label: string; value: string; change?: KpiChange; hint?: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <p className="text-xs text-fg-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-fg">{value}</p>
      {change ? <ChangeLine change={change} /> : null}
      {hint ? <p className="mt-1 text-xs text-fg-muted">{hint}</p> : null}
    </div>
  );
}

function ChangeLine({ change }: { change: KpiChange }) {
  if (change.percent === null || change.direction === null) {
    return <p className="mt-1 text-xs text-fg-muted">Belum ada pembanding</p>;
  }
  const up = change.direction === "up";
  return (
    <p className={cx("mt-1 text-xs font-medium tabular-nums", up ? "text-success" : "text-danger")}>
      <span aria-hidden="true">{up ? "▲" : "▼"} </span>
      <span className="sr-only">{up ? "Naik " : "Turun "}</span>
      {formatPercent(change.percent)}
      <span className="font-normal text-fg-muted"> dari periode sebelumnya</span>
    </p>
  );
}
