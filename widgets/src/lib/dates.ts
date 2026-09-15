/** Calendar helpers for the widget. Dates are "YYYY-MM-DD" strings in Asia/Jakarta. */

export const PRESET_KEYS = ["hari_ini", "kemarin", "7_hari", "minggu_ini", "bulan_ini", "30_hari", "custom"] as const;
export type PresetKey = (typeof PRESET_KEYS)[number];
export type RangePresetKey = Exclude<PresetKey, "custom">;

export const PRESET_LABEL: Record<PresetKey, string> = {
  hari_ini: "Hari ini",
  kemarin: "Kemarin",
  "7_hari": "7 hari terakhir",
  minggu_ini: "Minggu ini",
  bulan_ini: "Bulan ini",
  "30_hari": "30 hari terakhir",
  custom: "Pilih tanggal",
};

export interface DateRangeValue {
  start_date: string;
  end_date: string;
}

const DAY_MS = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === value;
}

function utcDay(iso: string): number {
  const m = ISO_DATE.exec(iso);
  if (!m) throw new RangeError(`Invalid date: ${iso}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** "2026-08-31" + 1 → "2026-09-01". */
export function addIsoDays(iso: string, days: number): string {
  return new Date(utcDay(iso) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `a` to `b` (negative when b is earlier). */
export function isoDaysBetween(a: string, b: string): number {
  return Math.round((utcDay(b) - utcDay(a)) / DAY_MS);
}

/** Calendar date in Asia/Jakarta for the given instant. */
export function jakartaTodayBrowser(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Inclusive range for a preset as of `today`. Weeks start on Monday. */
export function presetRange(key: RangePresetKey, today: string): DateRangeValue {
  switch (key) {
    case "hari_ini":
      return { start_date: today, end_date: today };
    case "kemarin": {
      const yesterday = addIsoDays(today, -1);
      return { start_date: yesterday, end_date: yesterday };
    }
    case "7_hari":
      return { start_date: addIsoDays(today, -6), end_date: today };
    case "minggu_ini": {
      const weekday = new Date(utcDay(today)).getUTCDay(); // 0 = Sunday
      return { start_date: addIsoDays(today, -((weekday + 6) % 7)), end_date: today };
    }
    case "bulan_ini":
      return { start_date: `${today.slice(0, 8)}01`, end_date: today };
    case "30_hari":
      return { start_date: addIsoDays(today, -29), end_date: today };
  }
}

const MATCH_ORDER: readonly RangePresetKey[] = ["hari_ini", "kemarin", "7_hari", "30_hari", "minggu_ini", "bulan_ini"];

/** The preset whose range equals start..end as of today, or null. */
export function matchPreset(start: string, end: string, today: string): RangePresetKey | null {
  for (const key of MATCH_ORDER) {
    const range = presetRange(key, today);
    if (range.start_date === start && range.end_date === end) return key;
  }
  return null;
}

/** null ⇒ "—", 0 ⇒ "Hari ini", 1 ⇒ "Kemarin", n ⇒ "n hari lalu". */
export function daysAgoLabel(days: number | null): string {
  if (days === null || !Number.isFinite(days)) return "—";
  const whole = Math.max(0, Math.floor(days));
  if (whole === 0) return "Hari ini";
  if (whole === 1) return "Kemarin";
  return `${whole} hari lalu`;
}
