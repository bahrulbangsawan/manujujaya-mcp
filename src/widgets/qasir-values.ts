/** Coercion of loosely typed Qasir response values. Never throws. */

/** Numbers and numeric strings ("220000.00") → number; anything else → 0. */
export function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** Like toNumber, but null when the value is absent or not numeric. */
export function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Strings are trimmed; finite numbers are stringified; everything else → "". */
export function toText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

/** "43,37%" → 43.37; "" or malformed → null. Qasir sends unsigned values plus a separate status. */
export function parsePercent(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace("%", "").replace(/\./g, "").replace(",", ".").trim();
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Plain object guard for upstream JSON. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
