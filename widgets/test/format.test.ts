import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatNumber, formatPercent, formatRupiah, formatTime } from "../src/lib/format";

/** Intl uses no-break spaces; compare with plain spaces. */
const plain = (s: string) => s.replace(/[  ]/g, " ");

describe("formatRupiah", () => {
  it("formats IDR without decimals", () => {
    expect(plain(formatRupiah(1_250_000))).toBe("Rp 1.250.000");
    expect(plain(formatRupiah(0))).toBe("Rp 0");
    expect(plain(formatRupiah(1_999.6))).toBe("Rp 2.000");
    expect(plain(formatRupiah(-5_000))).toBe("-Rp 5.000");
  });

  it("keeps the no-break space so amounts never wrap", () => {
    expect(formatRupiah(1_000)).toContain(" ");
  });
});

describe("formatNumber", () => {
  it("uses id-ID separators and at most 2 decimals by default", () => {
    expect(formatNumber(1234.5)).toBe("1.234,5");
    expect(formatNumber(2.456)).toBe("2,46");
    expect(formatNumber(2.456, 0)).toBe("2");
    expect(formatNumber(Number.NaN)).toBe("0");
  });
});

describe("dates", () => {
  it("formats calendar dates", () => {
    expect(formatDate("2026-09-15")).toBe("15 Sep 2026");
    expect(formatDate("2026-05-02")).toBe("2 Mei 2026");
    expect(formatDate("")).toBe("—");
  });

  it("formats instants in Asia/Jakarta", () => {
    expect(formatDateTime("2026-09-15T03:32:00.000Z")).toBe("15 Sep 2026 10.32");
    expect(formatDateTime("2026-09-14T17:05:00.000Z")).toBe("15 Sep 2026 00.05");
    expect(formatTime("2026-09-15T03:32:00.000Z")).toBe("10.32");
    expect(formatDateTime("not a date")).toBe("—");
  });
});

describe("formatPercent", () => {
  it("rounds to one decimal with a comma", () => {
    expect(formatPercent(43.37)).toBe("43,4%");
    expect(formatPercent(3496.08)).toBe("3.496,1%");
    expect(formatPercent(null)).toBe("—");
  });
});
