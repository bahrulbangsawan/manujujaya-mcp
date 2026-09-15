/** Helpers shared by every widget tool: upstream envelopes, pagination, size caps, Indonesian text. */
import { AppError, ErrorCodes, isAppErrorLike } from "../../errors/codes";
import { pageInput } from "../contract";
import { isRecord, toNumberOrNull } from "../qasir-values";

/** Maximum length of a widget tool's text block. */
export const TEXT_MAX_CHARS = 2_000;
/** Highest page a widget pager accepts (pageInput max). */
const MAX_PAGE = pageInput.maxValue ?? 500;

/** `res.data` of a Qasir JSON envelope; anything else is UPSTREAM_ERROR. */
export function envelopeData(res: unknown, label: string): Record<string, unknown> {
  if (isRecord(res) && isRecord(res.data)) return res.data;
  throw new AppError(ErrorCodes.UPSTREAM_ERROR, `Unexpected ${label} response`);
}

/** The records in the array at `key`; a missing or non-array value gives []. Non-record items are skipped. */
export function recordsAt(obj: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const value = obj[key];
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

export interface PageInfo {
  currentPage: number | null;
  totalPage: number | null;
  totalResult: number | null;
  hasNext: boolean;
}

/** Qasir `pagination` block (`current_page`, `total_page`, `total_result`, `next`), or null when absent. */
export function pageInfo(res: unknown): PageInfo | null {
  if (!isRecord(res) || !isRecord(res.pagination)) return null;
  const p = res.pagination;
  return {
    currentPage: toNumberOrNull(p.current_page),
    totalPage: toNumberOrNull(p.total_page),
    totalResult: toNumberOrNull(p.total_result),
    hasNext: typeof p.next === "string" && p.next.length > 0,
  };
}

/**
 * The page after `page`, or null. With a pagination block only `next` counts
 * (total_page/total_result can be wrong upstream); without one, a full page
 * suggests more rows. Never returns a page a widget pager would reject (> 500).
 */
export function nextPageOf(res: unknown, page: number, rowsReturned: number, pageSize: number): number | null {
  if (page >= MAX_PAGE) return null;
  const info = pageInfo(res);
  if (info) return info.hasNext ? page + 1 : null;
  return rowsReturned >= pageSize ? page + 1 : null;
}

/** The dispatcher's error for an upstream 404 with a JSON body (stockTurnover search with no match). */
export function isUpstream404(err: unknown): boolean {
  return isAppErrorLike(err) && err.code === ErrorCodes.UPSTREAM_ERROR && err.message === "Upstream 404";
}

/**
 * Keep the longest head of `rows` whose payload `build(rows)` serializes to at
 * most `maxChars`. `build` should produce the payload as sent when truncated
 * (truncated: true plus its reason), so the measured size is the final size.
 */
export function capRows<T>(rows: T[], maxChars: number, build: (rows: T[]) => unknown): { rows: T[]; truncated: boolean } {
  const fits = (n: number) => (JSON.stringify(build(rows.slice(0, n)))?.length ?? 0) <= maxChars;
  if (fits(rows.length)) return { rows, truncated: false };
  let lo = 0;
  let hi = rows.length - 1;
  // Largest n in [0, rows.length - 1] that fits; payload size grows with n.
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fits(mid)) lo = mid;
    else hi = mid - 1;
  }
  return { rows: rows.slice(0, lo), truncated: true };
}

const RUPIAH = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const QTY = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
const INDO_DATE = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** 1250000 → "Rp 1.250.000" (plain space on every ICU build). */
export function rupiah(amount: number): string {
  // Some ICU builds separate "Rp" from the amount with U+00A0 (NBSP) instead of a plain space.
  return RUPIAH.format(amount).replace(/ /g, " ").replace(/Rp(?=\d)/, "Rp ");
}

/** 1234.567 → "1.234,57". */
export function formatQty(n: number): string {
  return QTY.format(n);
}

/** "2026-09-15" → "15 Sep 2026". */
export function indoDate(isoDate: string): string {
  return INDO_DATE.format(new Date(`${isoDate}T00:00:00Z`));
}

/** Cut `text` to `maxChars`, ending with "…" when cut. */
export function clipText(text: string, maxChars: number = TEXT_MAX_CHARS): string {
  return text.length > maxChars ? `${text.slice(0, Math.max(0, maxChars - 1))}…` : text;
}

/** Join the truthy lines with "\n" and cut the result to `maxChars` (default 2,000). */
export function joinLines(lines: Array<string | null | undefined | false>, maxChars: number = TEXT_MAX_CHARS): string {
  return clipText(lines.filter((line): line is string => typeof line === "string" && line.length > 0).join("\n"), maxChars);
}
