import { describe, expect, it } from "vitest";
import type { z } from "zod";
import type { DispatchRequest } from "../../src/dispatcher/qasir-dispatcher";
import { AppError, ErrorCodes } from "../../src/errors/codes";
import {
  STRUCTURED_MAX_CHARS,
  stockBrowserData,
  stockHistoryData,
  stockPageData,
  stockVelocityData,
  type ToolOutput,
} from "../../src/widgets/contract";
import {
  STOCK_TOOLS,
  stockBrowserTool,
  stockHistoryTool,
  stockPageTool,
  stockVelocityTool,
} from "../../src/widgets/tools/stock";
import type { FixtureHandler } from "../stubs/codemode-harness";
import { callWidgetTool, envelope, type WidgetCall } from "../stubs/widget-harness";

// Harness clock: 2026-09-15T03:00:00Z = 10:00 in Jakarta, so "today" is 2026-09-15
// and the 30-day velocity window starts at 2026-08-16T03:00:00.000Z.
const GENERATED_AT = "2026-09-15T03:00:00.000Z";
const META = { outlet_id: "645203", generated_at: GENERATED_AT, truncated: false, truncated_reason: null };
const ALL_TYPES = "sales,purchase,transfer,adjustment-plus,adjustment-minus,refund";

function expectContract<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.parse(value);
  // Parsing strips unknown keys, so equality proves the tool emits contract fields only.
  expect(parsed).toEqual(value);
  return parsed;
}

function requests(call: WidgetCall): DispatchRequest[] {
  expect(call.dispatcher.calls.every((c) => c.opts?.allowMutation === undefined)).toBe(true);
  return call.dispatcher.calls.map((c) => c.req);
}

function upstream404(): never {
  throw new AppError(ErrorCodes.UPSTREAM_ERROR, "Upstream 404");
}

// ── Synthetic upstream payloads (shapes per spec §2; no real names) ─────────

const VARIANT_SOLD = {
  id: 25952218,
  product_name: "Oli Mesin A - 1 Liter",
  stock: 12,
  price_sell: 80_000,
  latest_sales_date: "2026-09-12T06:27:33.000Z",
  latest_adjustment_date: "2022-01-21T14:53:44.893348Z",
  latest_sales_till_now: "3",
  latest_adjustment_till_now: "1697",
};
const VARIANT_NEVER_SOLD = {
  id: 25952219,
  product_name: "Oli Mesin A - 4 Liter",
  stock: 0,
  price_sell: "300000",
  latest_sales_date: "",
  latest_adjustment_date: "2026-09-01T02:00:00Z",
  latest_sales_till_now: "0",
  latest_adjustment_till_now: "",
};
const VARIANT_WITHOUT_ID = { ...VARIANT_SOLD, id: "bukan-id" };

const ROW_SOLD = {
  inventory_id: 25952218,
  name: "Oli Mesin A - 1 Liter",
  stock: 12,
  price_sell: 80_000,
  last_sale_at: "2026-09-12T06:27:33.000Z",
  days_since_sale: 3,
  last_adjustment_at: "2022-01-21T14:53:44.893Z",
  days_since_adjustment: 1697,
};
const ROW_NEVER_SOLD = {
  inventory_id: 25952219,
  name: "Oli Mesin A - 4 Liter",
  stock: 0,
  price_sell: 300_000,
  last_sale_at: null,
  days_since_sale: null,
  last_adjustment_at: "2026-09-01T02:00:00.000Z",
  // No upstream day count: computed from the Jakarta date (1 Sep) to today (15 Sep).
  days_since_adjustment: 14,
};

function plainVariant(i: number) {
  return {
    id: 30_000_000 + i,
    product_name: `Produk Stok ${i}`,
    stock: i,
    price_sell: 1_000 * i,
    latest_sales_date: "",
    latest_adjustment_date: "",
    latest_sales_till_now: "0",
    latest_adjustment_till_now: "0",
  };
}

function plainRow(i: number) {
  return {
    inventory_id: 30_000_000 + i,
    name: `Produk Stok ${i}`,
    stock: i,
    price_sell: 1_000 * i,
    last_sale_at: null,
    days_since_sale: null,
    last_adjustment_at: null,
    days_since_adjustment: null,
  };
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, k) => from + k);
}

function movement(type: string, quantity: number, createdDate: string, extra: Record<string, unknown> = {}) {
  return {
    id: `01TESTMOVEMENT${type}${createdDate}`,
    opname: 10,
    quantity,
    notes: "",
    type,
    created_date: createdDate,
    created_by: { id: "", name: "" },
    sales_id: "",
    is_saved_transaction: false,
    is_deleted_saved_transaction: false,
    ...extra,
  };
}

function historyPage(stockHistories: unknown[], next: boolean, stock = 29) {
  return envelope(
    { id: "25950360", product_name: "Produk Velocity-", stock, stock_histories: stockHistories, track_stock: true },
    { current_page: 1, page_size: 100, ...(next ? { next: "/api/v5/inventories/25950360/stock-histories?page=2" } : {}) },
  );
}

// ── show_stock_browser ──────────────────────────────────────────────────────

describe("show_stock_browser", () => {
  it("searches page 1 and projects last-touch dates and day counts", async () => {
    const call = await callWidgetTool(
      stockBrowserTool,
      { search: "  Oli Mesin  " },
      {
        handlers: {
          "inventories.stockTurnover": () =>
            envelope(
              { variants: [VARIANT_SOLD, VARIANT_NEVER_SOLD, VARIANT_WITHOUT_ID] },
              { current_page: 1, page_size: 50, total_page: 1, total_result: 2 },
            ),
        },
      },
    );

    expect(call.error).toBeUndefined();
    expect(requests(call)).toEqual([
      {
        operationId: "inventories.stockTurnover",
        query: { outlet_ids: "645203", page: 1, count: 50, sort: "created_at", search: "Oli Mesin" },
      },
    ]);
    const data = expectContract(stockBrowserData, call.structured);
    const expected: ToolOutput<"show_stock_browser"> = {
      view: "stok",
      ...META,
      search: "Oli Mesin",
      rows: [ROW_SOLD, ROW_NEVER_SOLD],
      total_rows: 2,
      next_page: null,
    };
    expect(data).toEqual(expected);
    expect(call.text).toBe(
      [
        'Stok untuk pencarian "Oli Mesin" (outlet 645203): 2 varian.',
        "- Oli Mesin A - 1 Liter: stok 12, Rp 80.000, terakhir terjual 3 hari lalu",
        "- Oli Mesin A - 4 Liter: stok 0, Rp 300.000, belum pernah terjual",
      ].join("\n"),
    );
  });

  it("omits search when none is given and offers the next page", async () => {
    const call = await callWidgetTool(
      stockBrowserTool,
      {},
      {
        handlers: {
          "inventories.stockTurnover": () =>
            envelope(
              { variants: range(1, 50).map(plainVariant) },
              { current_page: 1, page_size: 50, total_page: 276, total_result: 13_784, next: "/api/v5/inventories/stock-turnover?page=2" },
            ),
        },
      },
    );

    expect(requests(call)).toEqual([
      { operationId: "inventories.stockTurnover", query: { outlet_ids: "645203", page: 1, count: 50, sort: "created_at" } },
    ]);
    const data = expectContract(stockBrowserData, call.structured);
    expect(data).toEqual({
      view: "stok",
      ...META,
      search: null,
      rows: range(1, 50).map(plainRow),
      total_rows: 13_784,
      next_page: 2,
    });
    expect(call.text).toContain("Stok outlet 645203: 13.784 varian.");
    expect(call.text).toContain("- Produk Stok 10: stok 10, Rp 10.000, belum pernah terjual");
    expect(call.text).not.toContain("Produk Stok 11:");
    expect(call.text).toContain("50 varian pertama dimuat");
  });

  it("maps a no-match search (upstream 404) to an empty list", async () => {
    const call = await callWidgetTool(stockBrowserTool, { search: "Tidak Ada" }, { handlers: { "inventories.stockTurnover": upstream404 } });

    expect(call.error).toBeUndefined();
    expect(requests(call)[0]?.query).toMatchObject({ search: "Tidak Ada" });
    expect(expectContract(stockBrowserData, call.structured)).toEqual({
      view: "stok",
      ...META,
      search: "Tidak Ada",
      rows: [],
      total_rows: 0,
      next_page: null,
    });
    expect(call.text).toBe('Stok untuk pencarian "Tidak Ada" (outlet 645203): 0 varian.\nTidak ada produk yang cocok dengan "Tidak Ada".');
  });

  it("keeps a 404 without search as an upstream error", async () => {
    const call = await callWidgetTool(stockBrowserTool, {}, { handlers: { "inventories.stockTurnover": upstream404 } });
    expect(call.result.isError).toBe(true);
    expect(call.error).toEqual({ code: "UPSTREAM_ERROR", message: "Upstream 404" });
  });
});

// ── stock_page ──────────────────────────────────────────────────────────────

describe("stock_page", () => {
  it("fetches the requested page with the same search", async () => {
    const call = await callWidgetTool(
      stockPageTool,
      { search: "Oli", page: 2, outlet_id: "777" },
      {
        handlers: {
          "inventories.stockTurnover": () =>
            envelope(
              { variants: [VARIANT_SOLD, VARIANT_NEVER_SOLD] },
              { current_page: 2, page_size: 50, total_page: 3, total_result: 102, next: "/api/v5/inventories/stock-turnover?page=3" },
            ),
        },
      },
    );

    expect(requests(call)).toEqual([
      { operationId: "inventories.stockTurnover", query: { outlet_ids: "777", page: 2, count: 50, sort: "created_at", search: "Oli" } },
    ]);
    const expected: ToolOutput<"stock_page"> = {
      ...META,
      outlet_id: "777",
      search: "Oli",
      page: 2,
      rows: [ROW_SOLD, ROW_NEVER_SOLD],
      next_page: 3,
    };
    expect(expectContract(stockPageData, call.structured)).toEqual(expected);
    expect(call.text).toBe('Stok halaman 2 untuk "Oli": 2 varian.\nHalaman berikutnya: 3.');
  });

  it("maps a 404 on a later search page to an empty page", async () => {
    const call = await callWidgetTool(stockPageTool, { search: "Oli", page: 3 }, { handlers: { "inventories.stockTurnover": upstream404 } });
    expect(expectContract(stockPageData, call.structured)).toEqual({ ...META, search: "Oli", page: 3, rows: [], next_page: null });
  });

  it("trims rows from the tail when the structured result would exceed 250 KB", async () => {
    const huge = range(1, 50).map((i) => ({ ...plainVariant(i), product_name: `Produk ${i} ${"N".repeat(6_000)}` }));
    const call = await callWidgetTool(stockPageTool, { page: 1 }, { handlers: { "inventories.stockTurnover": () => envelope({ variants: huge }) } });

    expect(call.error).toBeUndefined();
    const data = expectContract(stockPageData, call.structured);
    expect(JSON.stringify(call.structured).length).toBeLessThanOrEqual(STRUCTURED_MAX_CHARS);
    expect(data.truncated).toBe(true);
    expect(data.truncated_reason).toBe("Baris terakhir dipangkas karena hasil melebihi 250 KB.");
    expect(data.rows.length).toBeGreaterThan(0);
    expect(data.rows.length).toBeLessThan(50);
    expect(data.rows.map((r) => r.inventory_id)).toEqual(range(1, data.rows.length).map((i) => 30_000_000 + i));
    // No pagination block and a full page: the next page is still offered.
    expect(data.next_page).toBe(2);
  });
});

// ── stock_history ───────────────────────────────────────────────────────────

describe("stock_history", () => {
  it("reads one page of all movement types and projects each movement", async () => {
    const call = await callWidgetTool(
      stockHistoryTool,
      { inventory_id: 25950360, page: 2 },
      {
        handlers: {
          "inventories.stockHistories": () =>
            envelope(
              {
                id: "25950360",
                product_name: "Filter Udara X-",
                stock: 3,
                track_stock: true,
                stock_histories: [
                  movement("sales", -1, "2026-09-07 01:02:14.608837 +0000 +0000", {
                    id: "01TESTMOVEMENT000000000001",
                    opname: 3,
                    notes: "INV0001A",
                    created_by: { id: "11", name: "Staf Contoh   " },
                    sales_id: "1000000001",
                  }),
                  movement("refund", 1, "2026-09-06 23:30:00.000000 +0000 +0000", {
                    id: "01TESTMOVEMENT000000000002",
                    opname: 4,
                    notes: "Retur Pelanggan A 0800-0000-0001",
                  }),
                  movement("adjustment-plus", 5, "", {
                    id: "01TESTMOVEMENT000000000003",
                    opname: 3,
                    notes: "Opname bulanan",
                    created_by: {},
                    sales_id: "0",
                  }),
                ],
              },
              { current_page: 2, page_size: 50, total_page: 3, total_result: 103, next: "/api/v5/inventories/25950360/stock-histories?page=3" },
            ),
        },
      },
    );

    expect(requests(call)).toEqual([
      {
        operationId: "inventories.stockHistories",
        path: { inventory_id: 25950360 },
        query: { page: 2, count: 50, outlet_ids: "645203", type: ALL_TYPES },
      },
    ]);
    const expected: ToolOutput<"stock_history"> = {
      ...META,
      inventory_id: 25950360,
      product_name: "Filter Udara X",
      stock: 3,
      page: 2,
      movements: [
        {
          id: "01TESTMOVEMENT000000000001",
          at: "2026-09-07T01:02:14.608Z",
          type: "sales",
          type_label: "Penjualan",
          quantity: -1,
          balance: 3,
          note: "INV0001A",
          by: "Staf Contoh",
          sales_id: "1000000001",
        },
        {
          id: "01TESTMOVEMENT000000000002",
          at: "2026-09-06T23:30:00.000Z",
          type: "refund",
          type_label: "Refund",
          quantity: 1,
          balance: 4,
          note: "Retur Pelanggan A 0800-0000-0001",
          by: null,
          sales_id: null,
        },
        {
          id: "01TESTMOVEMENT000000000003",
          at: null,
          type: "adjustment-plus",
          type_label: "Penyesuaian +",
          quantity: 5,
          balance: 3,
          note: "Opname bulanan",
          by: null,
          sales_id: null,
        },
      ],
      next_page: 3,
    };
    expect(expectContract(stockHistoryData, call.structured)).toEqual(expected);
    expect(call.text).toBe(
      [
        "Riwayat stok Filter Udara X (stok saat ini 3), halaman 2: 3 pergerakan.",
        "- 7 Sep 2026: Penjualan -1, saldo 3",
        // 23:30 UTC on 6 Sep is 06:30 on 7 Sep in Jakarta.
        "- 7 Sep 2026: Refund +1, saldo 4",
        "- tanpa tanggal: Penyesuaian + +5, saldo 3",
        "Halaman berikutnya: 3.",
      ].join("\n"),
    );
    // Staff names and free-text notes (which can hold customer names or phones) stay out of the text block.
    expect(call.text).not.toContain("Staf Contoh");
    expect(call.text).not.toContain("Pelanggan A");
    expect(call.text).not.toContain("0800-0000-0001");
    expect(call.text).not.toContain("Opname bulanan");
  });

  it("rejects a non-positive inventory id at the input schema", async () => {
    await expect(callWidgetTool(stockHistoryTool, { inventory_id: 0, page: 1 }, { handlers: {} })).rejects.toThrow();
  });
});

// ── stock_velocity ──────────────────────────────────────────────────────────

describe("stock_velocity", () => {
  it("pages histories until a movement predates the 30-day window", async () => {
    const recent = "2026-09-10 01:00:00.000000 +0000 +0000";
    const page1 = [
      ...range(1, 90).map(() => movement("sales", -1, recent)),
      ...range(1, 5).map(() => movement("refund", 1, recent)),
      ...range(1, 5).map(() => movement("purchase", 10, recent)),
    ];
    const page2 = [
      movement("sales", -2, "2026-08-20 10:00:00.000000 +0000 +0000"),
      movement("sales", -5, "2026-08-16 02:59:59.000000 +0000 +0000"), // one second before the window
      movement("adjustment-plus", 3, "2026-08-01 00:00:00.000000 +0000 +0000"),
    ];
    const handler: FixtureHandler = (req) => (req.query?.page === 1 ? historyPage(page1, true) : historyPage(page2, true));
    const call = await callWidgetTool(stockVelocityTool, { inventory_id: 25950360 }, { handlers: { "inventories.stockHistories": handler } });

    expect(call.error).toBeUndefined();
    expect(requests(call)).toEqual(
      [1, 2].map((page) => ({
        operationId: "inventories.stockHistories",
        path: { inventory_id: 25950360 },
        query: { page, count: 100, outlet_ids: "645203", type: ALL_TYPES },
      })),
    );
    const data = expectContract(stockVelocityData, call.structured);
    expect(data).toEqual({
      ...META,
      inventory_id: 25950360,
      stock: 29,
      window_days: 30,
      sold: 92,
      refunded: 5,
      net_sold: 87,
      daily_rate: expect.closeTo(2.9, 10),
      days_of_cover: expect.closeTo(10, 10),
      oldest_scanned_at: "2026-08-01T00:00:00.000Z",
    });
    expect(call.text).toBe(
      [
        "Kecepatan jual Produk Velocity, 30 hari terakhir: terjual 92, refund 5, bersih 87 (2,9 per hari).",
        "Stok saat ini 29; perkiraan habis dalam 10 hari.",
      ].join("\n"),
    );
  });

  it("stops at VELOCITY_MAX_PAGES and flags the result as truncated", async () => {
    const recent = "2026-09-14 01:00:00.000000 +0000 +0000";
    const full = range(1, 100).map(() => movement("sales", -1, recent));
    const call = await callWidgetTool(
      stockVelocityTool,
      { inventory_id: 25950360 },
      { handlers: { "inventories.stockHistories": () => historyPage(full, true, 50) } },
    );

    expect(call.error).toBeUndefined();
    expect(requests(call).map((r) => r.query?.page)).toEqual([1, 2, 3, 4, 5]);
    const data = expectContract(stockVelocityData, call.structured);
    expect(data).toMatchObject({
      truncated: true,
      truncated_reason: "Hanya 500 pergerakan terbaru yang dibaca; penjualan 30 hari bisa lebih tinggi.",
      sold: 500,
      refunded: 0,
      net_sold: 500,
      stock: 50,
      oldest_scanned_at: "2026-09-14T01:00:00.000Z",
    });
    expect(data.days_of_cover).toBeCloseTo(3, 10);
    expect(call.text).toContain("Hanya 500 pergerakan terbaru yang dibaca");
  });

  it("returns no days of cover when refunds cancel out sales", async () => {
    const recent = "2026-09-14 01:00:00.000000 +0000 +0000";
    const call = await callWidgetTool(
      stockVelocityTool,
      { inventory_id: 25950360, outlet_id: "777" },
      {
        handlers: {
          "inventories.stockHistories": () =>
            historyPage([movement("refund", 2, recent), movement("sales", -1, recent), movement("transfer", -4, recent)], false, 7),
        },
      },
    );

    expect(requests(call)).toHaveLength(1);
    expect(requests(call)[0]?.query?.outlet_ids).toBe("777");
    expect(expectContract(stockVelocityData, call.structured)).toEqual({
      ...META,
      outlet_id: "777",
      inventory_id: 25950360,
      stock: 7,
      window_days: 30,
      sold: 1,
      refunded: 2,
      net_sold: -1,
      daily_rate: 0,
      days_of_cover: null,
      oldest_scanned_at: "2026-09-14T01:00:00.000Z",
    });
    expect(call.text).toContain("Stok saat ini 7; tanpa penjualan bersih, perkiraan habis tidak bisa dihitung.");
  });

  it("handles an item without any movements", async () => {
    const call = await callWidgetTool(
      stockVelocityTool,
      { inventory_id: 25950360 },
      { handlers: { "inventories.stockHistories": () => historyPage([], false, 4) } },
    );
    expect(requests(call)).toHaveLength(1);
    const data = expectContract(stockVelocityData, call.structured);
    expect(data).toMatchObject({ sold: 0, refunded: 0, net_sold: 0, daily_rate: 0, days_of_cover: null, oldest_scanned_at: null, truncated: false });
  });
});

// ── Registration metadata ───────────────────────────────────────────────────

describe("STOCK_TOOLS", () => {
  it("declares names, budgets, views and description rules", () => {
    expect(STOCK_TOOLS.map((t) => [t.name, t.maxRequests, t.view])).toEqual([
      ["show_stock_browser", 1, "stok"],
      ["stock_page", 1, undefined],
      ["stock_history", 1, undefined],
      ["stock_velocity", 5, undefined],
    ]);
    for (const tool of STOCK_TOOLS) {
      if (tool.view) {
        expect(tool.description.startsWith("Open an interactive")).toBe(true);
        expect(tool.description.length).toBeLessThanOrEqual(600);
        expect(tool.description).toContain("search");
      } else {
        expect(tool.description.startsWith("Widget helper:")).toBe(true);
        expect(tool.description.length).toBeLessThanOrEqual(300);
      }
    }
  });
});
