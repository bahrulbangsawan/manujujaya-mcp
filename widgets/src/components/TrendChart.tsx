import { useId, useState, type KeyboardEvent, type PointerEvent } from "react";
import { formatDate, formatRupiah } from "../lib/format";
import { EmptyState } from "./EmptyState";
import { cx } from "./ui";

export interface TrendPoint {
  date: string;
  amount: number;
  comparisonAmount: number | null;
}

export interface TrendChartProps {
  points: TrendPoint[];
  onSelectDate?: (date: string) => void;
}

const compact = new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 });

function pointLabel(point: TrendPoint): string {
  const comparison = point.comparisonAmount === null ? "" : `, periode sebelumnya ${formatRupiah(point.comparisonAmount)}`;
  return `${formatDate(point.date)}: ${formatRupiah(point.amount)}${comparison}`;
}

/** Line chart of daily sales against the comparison period. Coordinates are percentages of the plot box. */
export function TrendChart({ points, onSelectDate }: TrendChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const tooltipId = useId();

  if (points.length === 0) return <EmptyState title="Belum ada data untuk grafik" />;

  const max = Math.max(1, ...points.map((p) => Math.max(p.amount, p.comparisonAmount ?? 0)));
  const x = (index: number) => (points.length === 1 ? 50 : (index / (points.length - 1)) * 100);
  const y = (amount: number) => 100 - (Math.max(0, amount) / max) * 100;
  const path = (values: Array<number | null>) => {
    let d = "";
    let drawing = false;
    values.forEach((v, index) => {
      if (v === null) {
        drawing = false;
        return;
      }
      d += `${drawing ? "L" : "M"}${x(index).toFixed(2)},${y(v).toFixed(2)}`;
      drawing = true;
    });
    return d;
  };
  const current = path(points.map((p) => p.amount));
  const comparison = path(points.map((p) => p.comparisonAmount));
  const hasComparison = comparison !== "";
  const tabStop = Math.min(focusIndex, points.length - 1);
  const activePoint = active === null ? undefined : points[active];

  function nearestIndex(event: PointerEvent<HTMLDivElement>): number {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || points.length === 1) return 0;
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    return Math.round(ratio * (points.length - 1));
  }

  function onPointKeyDown(event: KeyboardEvent<HTMLElement>, index: number) {
    const point = points[index];
    if (!point) return;
    let next: number | null = null;
    if (event.key === "ArrowRight") next = Math.min(points.length - 1, index + 1);
    else if (event.key === "ArrowLeft") next = Math.max(0, index - 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = points.length - 1;
    else if (event.key === "Enter" && onSelectDate) {
      event.preventDefault();
      onSelectDate(point.date);
      return;
    }
    if (next === null) return;
    event.preventDefault();
    setFocusIndex(next);
    setActive(next);
    const group = event.currentTarget.parentElement;
    group?.querySelector<HTMLElement>(`[data-point-index="${next}"]`)?.focus();
  }

  const first = points[0];
  const last = points[points.length - 1];

  return (
    <figure className="space-y-2">
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0.5 w-4 rounded bg-info" />
          Periode ini
        </span>
        {hasComparison ? (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="h-0 w-4 border-t-2 border-dashed border-current opacity-60" />
            Periode sebelumnya
          </span>
        ) : null}
        <span className="ml-auto tabular-nums">Maks Rp {compact.format(max)}</span>
      </figcaption>
      <div
        className="relative h-44 px-3 py-3"
        onPointerMove={(event) => setActive(nearestIndex(event))}
        onPointerLeave={() => setActive(null)}
      >
        <div role="group" aria-label="Grafik penjualan harian" className="relative h-full w-full">
          <svg
            aria-hidden="true"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full overflow-visible text-info"
          >
            {[0, 50, 100].map((gridY) => (
              <line
                key={gridY}
                x1={0}
                x2={100}
                y1={gridY}
                y2={gridY}
                stroke="currentColor"
                strokeOpacity={0.15}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {hasComparison ? (
              <path
                d={comparison}
                fill="none"
                stroke="currentColor"
                strokeOpacity={0.45}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
            <path d={current} fill="none" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          </svg>
          {points.map((point, index) => {
            const common = {
              "data-point-index": index,
              tabIndex: index === tabStop ? 0 : -1,
              "aria-label": pointLabel(point),
              "aria-describedby": active === index ? tooltipId : undefined,
              onFocus: () => {
                setFocusIndex(index);
                setActive(index);
              },
              onBlur: () => setActive(null),
              onKeyDown: (event: KeyboardEvent<HTMLElement>) => onPointKeyDown(event, index),
              style: { left: `${x(index)}%`, top: `${y(point.amount)}%` },
              className: "absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full",
            };
            const dot = (
              <span
                aria-hidden="true"
                className={cx("block rounded-full bg-info", active === index ? "size-3" : points.length > 62 ? "size-0" : "size-2")}
              />
            );
            return onSelectDate ? (
              <button key={point.date} type="button" {...common} onClick={() => onSelectDate(point.date)}>
                {dot}
              </button>
            ) : (
              <span key={point.date} role="img" {...common}>
                {dot}
              </span>
            );
          })}
          {activePoint && active !== null ? (
            <div
              id={tooltipId}
              role="tooltip"
              className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md border border-line bg-surface px-2 py-1 text-xs text-fg shadow"
              style={{
                left: `${x(active)}%`,
                top: `${y(activePoint.amount)}%`,
                transform: `translate(${x(active) < 15 ? "0" : x(active) > 85 ? "-100%" : "-50%"}, calc(-100% - 12px))`,
              }}
            >
              <p className="font-medium">{formatDate(activePoint.date)}</p>
              <p className="tabular-nums">Periode ini: {formatRupiah(activePoint.amount)}</p>
              {activePoint.comparisonAmount !== null ? (
                <p className="tabular-nums text-fg-muted">Sebelumnya: {formatRupiah(activePoint.comparisonAmount)}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {first && last ? (
        <div className="flex justify-between px-3 text-xs tabular-nums text-fg-muted">
          <span>{formatDate(first.date)}</span>
          {points.length > 1 ? <span>{formatDate(last.date)}</span> : null}
        </div>
      ) : null}
    </figure>
  );
}
