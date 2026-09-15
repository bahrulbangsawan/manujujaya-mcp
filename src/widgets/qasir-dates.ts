import { AppError, ErrorCodes } from "../errors/codes";
import { AGING_BUCKET_KEYS, DEBT_SCAN_START_DATE, MAX_RANGE_DAYS, type AgingBucketKey } from "./contract";

export const JAKARTA_TZ = "Asia/Jakarta";
const DAY_MS = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const MONTHS: Record<string, number> = {
  januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
  juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12,
};

function utcDay(iso: string): number {
  const m = ISO_DATE.exec(iso);
  if (!m) throw new AppError(ErrorCodes.INVALID_INPUT, `Invalid date: ${iso}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function isoFromUtcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Calendar date (YYYY-MM-DD) in Asia/Jakarta for the given instant. */
export function jakartaToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: JAKARTA_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(iso: string, days: number): string {
  return isoFromUtcDay(utcDay(iso) + days * DAY_MS);
}

/** Whole days from `a` to `b` (negative when b is earlier). */
export function daysBetween(a: string, b: string): number {
  return Math.round((utcDay(b) - utcDay(a)) / DAY_MS);
}

/** Throws INVALID_INPUT unless start ≤ end and the inclusive range is ≤ maxDays. */
export function assertDateRange(start: string, end: string, maxDays: number = MAX_RANGE_DAYS): void {
  const span = daysBetween(start, end);
  if (span < 0) throw new AppError(ErrorCodes.INVALID_INPUT, "start_date must be on or before end_date");
  if (span + 1 > maxDays) {
    throw new AppError(ErrorCodes.INVALID_INPUT, `Date range may cover at most ${maxDays} days`);
  }
}

/** The equal-length range that ends the day before `start`. */
export function previousRange(start: string, end: string): { start_date: string; end_date: string } {
  const length = daysBetween(start, end) + 1;
  return { start_date: addDays(start, -length), end_date: addDays(start, -1) };
}

/** "02 Oktober 2026" → "2026-10-02"; "", "0001-01-01" and unknown months → null. */
export function parseIndonesianDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(value.trim());
  if (!m) return null;
  const month = MONTHS[m[2]!.toLowerCase()];
  if (!month) return null;
  return `${m[3]}-${String(month).padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
}

/**
 * Qasir timestamps → ISO 8601 UTC, or null for empty / zero values.
 * - "YYYY-MM-DD HH:MM:SS" is dashboard local time (Asia/Jakarta, UTC+7, no DST).
 * - "YYYY-MM-DD HH:MM:SS.ffffff +0000 +0000" is Go UTC.
 * - ISO strings with Z or an offset are parsed as-is.
 */
export function parseQasirDateTime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (v === "" || v.startsWith("0001-01-01")) return null;
  const go = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(\.\d+)? \+0000/.exec(v);
  if (go) {
    const frac = (go[3] ?? ".0").slice(0, 4).padEnd(4, "0");
    return new Date(`${go[1]}T${go[2]}${frac}Z`).toISOString();
  }
  const local = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}(?::\d{2})?)$/.exec(v);
  if (local) {
    const time = local[2]!.length === 5 ? `${local[2]}:00` : local[2];
    return new Date(`${local[1]}T${time}+07:00`).toISOString();
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Jakarta calendar date of a parsed ISO instant. */
export function jakartaDateOf(isoInstant: string): string {
  return jakartaToday(new Date(isoInstant));
}

const BUCKET_BOUNDS: Record<AgingBucketKey, { min: number; max: number | null }> = {
  "0-7": { min: 0, max: 7 },
  "8-30": { min: 8, max: 30 },
  "31-90": { min: 31, max: 90 },
  "91-180": { min: 91, max: 180 },
  "181-365": { min: 181, max: 365 },
  "366-730": { min: 366, max: 730 },
  "gt-730": { min: 731, max: null },
};

/** Aging bucket for a debt that is `ageDays` old (negative ages count as 0). */
export function agingBucket(ageDays: number): AgingBucketKey {
  const age = Math.max(0, ageDays);
  for (const key of AGING_BUCKET_KEYS) {
    const { max } = BUCKET_BOUNDS[key];
    if (max === null || age <= max) return key;
  }
  return "gt-730";
}

/** Sale-date range (inclusive) whose debts fall in `bucket` as of `today`. */
export function bucketSaleDateRange(bucket: AgingBucketKey, today: string): { start_date: string; end_date: string } {
  const { min, max } = BUCKET_BOUNDS[bucket];
  return {
    start_date: max === null ? DEBT_SCAN_START_DATE : addDays(today, -max),
    end_date: addDays(today, -min),
  };
}
