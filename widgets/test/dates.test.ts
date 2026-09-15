import { describe, expect, it } from "vitest";
import {
  PRESET_KEYS,
  PRESET_LABEL,
  addIsoDays,
  daysAgoLabel,
  isIsoDate,
  isoDaysBetween,
  jakartaTodayBrowser,
  matchPreset,
  presetRange,
} from "../src/lib/dates";

describe("presetRange", () => {
  // 2026-09-15 is a Tuesday.
  const today = "2026-09-15";

  it("covers every preset as of a mid-month Tuesday", () => {
    expect(presetRange("hari_ini", today)).toEqual({ start_date: "2026-09-15", end_date: "2026-09-15" });
    expect(presetRange("kemarin", today)).toEqual({ start_date: "2026-09-14", end_date: "2026-09-14" });
    expect(presetRange("7_hari", today)).toEqual({ start_date: "2026-09-09", end_date: "2026-09-15" });
    expect(presetRange("minggu_ini", today)).toEqual({ start_date: "2026-09-14", end_date: "2026-09-15" });
    expect(presetRange("bulan_ini", today)).toEqual({ start_date: "2026-09-01", end_date: "2026-09-15" });
    expect(presetRange("30_hari", today)).toEqual({ start_date: "2026-08-17", end_date: "2026-09-15" });
  });

  it("starts weeks on Monday", () => {
    expect(presetRange("minggu_ini", "2026-09-14")).toEqual({ start_date: "2026-09-14", end_date: "2026-09-14" }); // Monday
    expect(presetRange("minggu_ini", "2026-09-13")).toEqual({ start_date: "2026-09-07", end_date: "2026-09-13" }); // Sunday
    expect(presetRange("minggu_ini", "2026-10-01")).toEqual({ start_date: "2026-09-28", end_date: "2026-10-01" }); // Thursday
  });

  it("crosses month and year boundaries", () => {
    expect(presetRange("kemarin", "2026-03-01")).toEqual({ start_date: "2026-02-28", end_date: "2026-02-28" });
    expect(presetRange("kemarin", "2024-03-01")).toEqual({ start_date: "2024-02-29", end_date: "2024-02-29" });
    expect(presetRange("7_hari", "2026-01-03")).toEqual({ start_date: "2025-12-28", end_date: "2026-01-03" });
    expect(presetRange("bulan_ini", "2026-09-01")).toEqual({ start_date: "2026-09-01", end_date: "2026-09-01" });
    expect(presetRange("minggu_ini", "2027-01-01")).toEqual({ start_date: "2026-12-28", end_date: "2027-01-01" });
  });

  it("labels every preset in Indonesian", () => {
    expect(PRESET_KEYS.map((key) => PRESET_LABEL[key])).toEqual([
      "Hari ini",
      "Kemarin",
      "7 hari terakhir",
      "Minggu ini",
      "Bulan ini",
      "30 hari terakhir",
      "Pilih tanggal",
    ]);
  });
});

describe("matchPreset", () => {
  it("recognizes preset ranges and returns null for custom ones", () => {
    expect(matchPreset("2026-09-15", "2026-09-15", "2026-09-15")).toBe("hari_ini");
    expect(matchPreset("2026-09-09", "2026-09-15", "2026-09-15")).toBe("7_hari");
    expect(matchPreset("2026-09-01", "2026-09-15", "2026-09-15")).toBe("bulan_ini");
    expect(matchPreset("2026-08-01", "2026-08-20", "2026-09-15")).toBeNull();
  });
});

describe("date arithmetic", () => {
  it("adds days and counts days between ISO dates", () => {
    expect(addIsoDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addIsoDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(isoDaysBetween("2026-09-01", "2026-09-15")).toBe(14);
  });

  it("validates real calendar dates", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("15-09-2026")).toBe(false);
    expect(isIsoDate(20260915)).toBe(false);
  });
});

describe("jakartaTodayBrowser", () => {
  it("uses Asia/Jakarta, not UTC", () => {
    expect(jakartaTodayBrowser(new Date("2026-09-14T18:30:00Z"))).toBe("2026-09-15");
    expect(jakartaTodayBrowser(new Date("2026-09-14T16:59:59Z"))).toBe("2026-09-14");
  });
});

describe("daysAgoLabel", () => {
  it("renders relative days", () => {
    expect(daysAgoLabel(null)).toBe("—");
    expect(daysAgoLabel(0)).toBe("Hari ini");
    expect(daysAgoLabel(1)).toBe("Kemarin");
    expect(daysAgoLabel(43)).toBe("43 hari lalu");
  });
});
