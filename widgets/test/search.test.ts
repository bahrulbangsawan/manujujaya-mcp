import { describe, expect, it } from "vitest";
import { TOOL_SCHEMAS, VIEWS, VIEW_TOOL, type ViewName } from "../../src/widgets/contract";
import {
  penjualanSearch,
  piutangSearch,
  searchFromToolArgs,
  stokSearch,
  toolArgsFromSearch,
  transaksiSearch,
  viewPathWithSearch,
} from "../src/app/search";
import { VIEW_LABEL, VIEW_PATH, viewFromMarker } from "../src/app/viewPaths";

const today = "2026-09-15";

describe("viewPaths", () => {
  it("maps every view to a path and an Indonesian label", () => {
    expect(VIEWS.map((view) => VIEW_PATH[view])).toEqual(["/penjualan", "/produk", "/stok", "/pembelian", "/transaksi", "/piutang"]);
    expect(VIEWS.map((view) => VIEW_LABEL[view])).toEqual(["Penjualan", "Produk", "Stok", "Pembelian", "Transaksi", "Piutang"]);
  });

  it("reads the resource marker, defaulting to penjualan", () => {
    expect(viewFromMarker("stok")).toBe("stok");
    expect(viewFromMarker(" Piutang ")).toBe("piutang");
    expect(viewFromMarker("__MJ_VIEW__")).toBe("penjualan");
    expect(viewFromMarker(undefined)).toBe("penjualan");
  });
});

describe("search schemas", () => {
  it("fill defaults and recover from malformed values", () => {
    expect(penjualanSearch.parse({})).toMatchObject({ preset: "7_hari" });
    expect(transaksiSearch.parse({ preset: "besok", start_date: "kemarin", customer_id: -3 })).toMatchObject({
      preset: "hari_ini",
      start_date: undefined,
      customer_id: undefined,
    });
    expect(stokSearch.parse({ search: 42 })).toMatchObject({ search: "" });
    expect(piutangSearch.parse({ sort: "x", bucket: "8-30" })).toMatchObject({ sort: "overdue", bucket: "8-30" });
  });
});

describe("tool args ⇄ search", () => {
  const cases: Array<[ViewName, Record<string, unknown>]> = [
    ["penjualan", { start_date: "2026-09-09", end_date: today }],
    ["penjualan", { start_date: "2026-08-01", end_date: "2026-08-20", outlet_id: "100001" }],
    ["produk", { start_date: "2026-09-01", end_date: today, order: "omzet_terendah" }],
    ["stok", { search: "Kopi" }],
    ["stok", {}],
    ["pembelian", { status: "completed" }],
    ["transaksi", { start_date: today, end_date: today, customer_id: 3001, outlet_id: "100001" }],
    ["piutang", { customer_id: 3001 }],
    ["piutang", {}],
  ];

  it.each(cases)("%s %j round-trips", (view, args) => {
    const search = searchFromToolArgs(view, args, today);
    expect(toolArgsFromSearch(view, search, today)).toEqual(args);
  });

  it("produces arguments the view tool accepts", () => {
    for (const [view, args] of cases) {
      const toolArgs = toolArgsFromSearch(view, searchFromToolArgs(view, args, today), today);
      expect(TOOL_SCHEMAS[VIEW_TOOL[view]].input.safeParse(toolArgs).success).toBe(true);
    }
  });

  it("names the preset when the range matches one", () => {
    expect(searchFromToolArgs("penjualan", { start_date: "2026-09-09", end_date: today }, today)).toEqual({ preset: "7_hari" });
    expect(searchFromToolArgs("transaksi", { start_date: "2026-08-01", end_date: "2026-08-20" }, today)).toEqual({
      preset: "custom",
      start_date: "2026-08-01",
      end_date: "2026-08-20",
    });
  });

  it("normalizes model arguments", () => {
    expect(toolArgsFromSearch("stok", searchFromToolArgs("stok", { search: "  Kopi  " }, today), today)).toEqual({ search: "Kopi" });
    expect(toolArgsFromSearch("pembelian", searchFromToolArgs("pembelian", {}, today), today)).toEqual({ status: "semua" });
    expect(toolArgsFromSearch("produk", searchFromToolArgs("produk", { start_date: "2026-09-15", end_date: "2026-09-15" }, today), today)).toEqual({
      start_date: today,
      end_date: today,
      order: "terlaris",
    });
  });

  it("falls back to the view's default range for bad or missing dates", () => {
    expect(toolArgsFromSearch("penjualan", searchFromToolArgs("penjualan", { start_date: "bad", end_date: today }, today), today)).toEqual({
      start_date: "2026-09-09",
      end_date: today,
    });
    expect(toolArgsFromSearch("transaksi", { preset: "custom", start_date: "2026-09-10" }, today)).toEqual({
      start_date: today,
      end_date: today,
    });
    expect(toolArgsFromSearch("produk", { preset: "bulan_ini" }, today)).toEqual({
      start_date: "2026-09-01",
      end_date: today,
      order: "terlaris",
    });
  });

  it("builds memory-history paths the router can parse back", () => {
    expect(viewPathWithSearch("stok", { search: "Kopi" })).toBe("/stok?search=Kopi");
    expect(viewPathWithSearch("transaksi", { preset: "hari_ini", customer_id: 3001 })).toBe("/transaksi?preset=hari_ini&customer_id=3001");
    expect(viewPathWithSearch("piutang", {})).toBe("/piutang");
  });
});
