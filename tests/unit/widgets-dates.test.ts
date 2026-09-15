import { describe, expect, it } from "vitest";
import { AppError } from "../../src/errors/codes";
import {
  addDays,
  agingBucket,
  assertDateRange,
  bucketSaleDateRange,
  daysBetween,
  jakartaToday,
  parseIndonesianDate,
  parseQasirDateTime,
  previousRange,
} from "../../src/widgets/qasir-dates";
import { parsePercent, toNumber, toText } from "../../src/widgets/qasir-values";

describe("jakartaToday", () => {
  it("uses Asia/Jakarta, not UTC", () => {
    // 2026-09-14T18:30Z is 01:30 on 15 Sep in Jakarta (UTC+7).
    expect(jakartaToday(new Date("2026-09-14T18:30:00Z"))).toBe("2026-09-15");
    expect(jakartaToday(new Date("2026-09-14T16:59:59Z"))).toBe("2026-09-14");
  });
});

describe("day arithmetic", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
  });
  it("counts whole days from a to b", () => {
    expect(daysBetween("2026-09-01", "2026-09-15")).toBe(14);
    expect(daysBetween("2026-09-15", "2026-09-01")).toBe(-14);
  });
});

describe("assertDateRange", () => {
  it("accepts ranges up to 366 inclusive days", () => {
    expect(() => assertDateRange("2025-09-15", "2026-09-15")).not.toThrow(); // 366 days inclusive
  });
  it("rejects reversed or over-long ranges with INVALID_INPUT", () => {
    for (const [s, e] of [["2026-09-02", "2026-09-01"], ["2025-09-14", "2026-09-15"]] as const) {
      let err: unknown;
      try {
        assertDateRange(s, e);
      } catch (caught) {
        err = caught;
      }
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe("INVALID_INPUT");
    }
  });
});

describe("previousRange", () => {
  it("returns the immediately preceding range of equal length", () => {
    expect(previousRange("2026-09-08", "2026-09-14")).toEqual({ start_date: "2026-09-01", end_date: "2026-09-07" });
    expect(previousRange("2026-09-14", "2026-09-14")).toEqual({ start_date: "2026-09-13", end_date: "2026-09-13" });
  });
});

describe("parseIndonesianDate", () => {
  it("parses every Indonesian month name", () => {
    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    months.forEach((m, i) => {
      expect(parseIndonesianDate(`02 ${m} 2026`)).toBe(`2026-${String(i + 1).padStart(2, "0")}-02`);
    });
  });
  it("returns null for empty or unknown values", () => {
    expect(parseIndonesianDate("")).toBeNull();
    expect(parseIndonesianDate("02 Foo 2026")).toBeNull();
    expect(parseIndonesianDate("0001-01-01")).toBeNull();
  });
});

describe("parseQasirDateTime", () => {
  it("treats 'YYYY-MM-DD HH:MM:SS' as Jakarta local time", () => {
    expect(parseQasirDateTime("2026-09-12 13:27:33")).toBe("2026-09-12T06:27:33.000Z");
  });
  it("parses Go UTC strings and ISO strings", () => {
    expect(parseQasirDateTime("2026-09-07 01:02:14.608837 +0000 +0000")).toBe("2026-09-07T01:02:14.608Z");
    expect(parseQasirDateTime("2026-08-27T01:02:09.878703Z")).toBe("2026-08-27T01:02:09.878Z");
  });
  it("returns null for empty and zero dates", () => {
    expect(parseQasirDateTime("")).toBeNull();
    expect(parseQasirDateTime("0001-01-01")).toBeNull();
    expect(parseQasirDateTime(undefined)).toBeNull();
  });
});

describe("aging buckets", () => {
  it("assigns boundaries to the lower bucket", () => {
    expect(agingBucket(0)).toBe("0-7");
    expect(agingBucket(7)).toBe("0-7");
    expect(agingBucket(8)).toBe("8-30");
    expect(agingBucket(30)).toBe("8-30");
    expect(agingBucket(90)).toBe("31-90");
    expect(agingBucket(180)).toBe("91-180");
    expect(agingBucket(365)).toBe("181-365");
    expect(agingBucket(730)).toBe("366-730");
    expect(agingBucket(731)).toBe("gt-730");
  });
  it("maps a bucket to the sale-date range it covers", () => {
    const today = "2026-09-15";
    expect(bucketSaleDateRange("0-7", today)).toEqual({ start_date: "2026-09-08", end_date: "2026-09-15" });
    expect(bucketSaleDateRange("8-30", today)).toEqual({ start_date: "2026-08-16", end_date: "2026-09-07" });
    expect(bucketSaleDateRange("gt-730", today)).toEqual({ start_date: "2015-01-01", end_date: "2024-09-14" });
  });
});

describe("value coercion", () => {
  it("parses Qasir percent strings with comma decimals", () => {
    expect(parsePercent("43,37%")).toBe(43.37);
    expect(parsePercent("3496,08%")).toBe(3496.08);
    expect(parsePercent("")).toBeNull();
    expect(parsePercent(undefined)).toBeNull();
  });
  it("coerces numbers and decimal strings, defaulting to 0", () => {
    expect(toNumber("220000.00")).toBe(220000);
    expect(toNumber(15)).toBe(15);
    expect(toNumber("x")).toBe(0);
    expect(toNumber(null)).toBe(0);
  });
  it("trims strings and maps non-strings to ''", () => {
    expect(toText("  SKU-1  ")).toBe("SKU-1");
    expect(toText(12)).toBe("12");
    expect(toText(null)).toBe("");
  });
});
