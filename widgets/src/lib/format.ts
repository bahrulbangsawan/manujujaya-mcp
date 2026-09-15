/** Indonesian (id-ID) formatters. Outputs keep Intl's no-break spaces (e.g. "Rp 1.250.000"). */

const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const numberFormats = new Map<number, Intl.NumberFormat>();
const dateFormat = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dateTimeFormat = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Jakarta",
});

const EMPTY = "—";

/** 1250000 → "Rp 1.250.000" (IDR, no decimals). */
export function formatRupiah(n: number): string {
  return rupiah.format(Number.isFinite(n) ? n : 0);
}

/** 1234.5 → "1.234,5"; at most `maxFractionDigits` decimals (default 2). */
export function formatNumber(n: number, maxFractionDigits = 2): string {
  let format = numberFormats.get(maxFractionDigits);
  if (!format) {
    format = new Intl.NumberFormat("id-ID", { maximumFractionDigits: maxFractionDigits });
    numberFormats.set(maxFractionDigits, format);
  }
  return format.format(Number.isFinite(n) ? n : 0);
}

/** "2026-09-15" → "15 Sep 2026"; anything else → "—". */
export function formatDate(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return EMPTY;
  const d = new Date(`${isoDate}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? EMPTY : dateFormat.format(d);
}

function jakartaParts(iso: string): Record<string, string> | null {
  const d = new Date(iso);
  if (iso === "" || Number.isNaN(d.getTime())) return null;
  const parts: Record<string, string> = {};
  for (const part of dateTimeFormat.formatToParts(d)) parts[part.type] = part.value;
  return parts;
}

/** ISO instant → "15 Sep 2026 10.32" in Asia/Jakarta; invalid → "—". */
export function formatDateTime(iso: string): string {
  const p = jakartaParts(iso);
  if (!p) return EMPTY;
  return `${p.day} ${p.month} ${p.year} ${p.hour}.${p.minute}`;
}

/** ISO instant → "10.32" in Asia/Jakarta; invalid → "—". */
export function formatTime(iso: string): string {
  const p = jakartaParts(iso);
  if (!p) return EMPTY;
  return `${p.hour}.${p.minute}`;
}

/** 43.37 → "43,4%"; null → "—". */
export function formatPercent(p: number | null): string {
  if (p === null || !Number.isFinite(p)) return EMPTY;
  return `${formatNumber(p, 1)}%`;
}
