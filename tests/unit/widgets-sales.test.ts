import { describe, expect, it } from "vitest";
import type { z } from "zod";
import type { DispatchRequest } from "../../src/dispatcher/qasir-dispatcher";
import { AppError, ErrorCodes } from "../../src/errors/codes";
import {
  PRODUCT_ORDERS,
  PRODUCT_ORDER_SORT,
  productRankingData,
  productRankingPageData,
  salesDashboardData,
  type ToolOutput,
} from "../../src/widgets/contract";
import {
  SALES_TOOLS,
  productRankingPageTool,
  productRankingTool,
  salesDashboardTool,
} from "../../src/widgets/tools/sales";
import { callWidgetTool, envelope, type WidgetCall } from "../stubs/widget-harness";

// Harness clock: 2026-09-15T03:00:00Z = 10:00 in Jakarta, so "today" is 2026-09-15.
const GENERATED_AT = "2026-09-15T03:00:00.000Z";
const META = { outlet_id: "645203", generated_at: GENERATED_AT, truncated: false, truncated_reason: null };

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

function byOperation(reqs: DispatchRequest[]): DispatchRequest[] {
  return [...reqs].sort((a, b) => a.operationId.localeCompare(b.operationId));
}

// ── Synthetic upstream payloads (shapes per spec §2; no real names or numbers) ──

function summaryPayload() {
  return envelope({
    summary_sales: {
      sales: 9_185_000,
      discount: 15_000,
      total_gross_sales: 9_170_000,
      capital_price: 6_000_000,
      total_profit: 3_170_000,
      tax: 0,
      total_transaction: 120,
      total_quantity: 245.5,
      cash_in: -5_000,
      sales_trend: {
        comparison_date: "09/01/2026 - 09/07/2026",
        gross: { value: "21,16%", status: "up" },
        profit: { value: "2,41%", status: "down" },
        transaction: { value: "", status: "" },
        quantity: { value: "3496,08%", status: "up" },
      },
    },
  });
}

function emptySummaryPayload() {
  return envelope({
    summary_sales: {
      sales: "",
      discount: "",
      total_gross_sales: "",
      capital_price: "",
      total_profit: "",
      tax: "",
      total_transaction: "",
      total_quantity: "",
      sales_trend: {
        comparison_date: "",
        gross: { value: "", status: "" },
        profit: { value: "", status: "" },
        transaction: { value: "", status: "" },
        quantity: { value: "", status: "" },
      },
    },
  });
}

function trendPayload() {
  return envelope({
    data_trends: [
      { date: "2026-09-08", amount: 1_200_000, comparison_date: "2026-09-01", comparison_amount: 1_000_000, percentage_change: "20%", status: "up" },
      { date: "2026-09-09 00:00:00", amount: "1300000.00", comparison_date: "", comparison_amount: null, percentage_change: "", status: "" },
      { date: "bukan tanggal", amount: 5, comparison_date: "", comparison_amount: 0 },
    ],
    current_period: { date: "2026-09-08 - 2026-09-14", total_amount: 2_500_000 },
    comparison_period: { date: "2026-09-01 - 2026-09-07", total_amount: 1_000_000 },
  });
}

function paymentPayload() {
  return envelope({
    payment_method: [
      { id: 1, name: "QRIS", quantity: 40, amount: 3_000_000 },
      { id: 2, name: "CASH", quantity: 80, amount: 6_170_000 },
    ],
  });
}

function categoriesPayload() {
  return envelope(
    {
      report_categories: [
        { id: 11, name: "Kategori Oli", quantity: 30, total_gross: 2_400_000, total_collected: 2_350_000, total_tax: 0, unit_label: "pcs" },
        { id: 12, name: "Kategori Filter", quantity: "4.5", total_gross: "180000.00", total_collected: 180_000, total_tax: 0, unit_label: "pcs" },
      ],
    },
    { current_page: 1, page_size: 10, total_page: 1, total_result: 2 },
  );
}

const MANUAL_ROW = { id: 0, name: "Transaksi Manual", category_name: "Transaksi Manual", sku: "", quantity: 2, total_gross: 50_000, total_collected: 50_000, unit_label: "", type: "" };

function productRow(i: number) {
  return {
    id: 1000 + i,
    name: `Produk ${i}`,
    category_name: "Kategori Oli",
    sku: ` SKU-${i} `,
    quantity: 100 - i,
    total_gross: (100 - i) * 10_000,
    total_collected: (100 - i) * 9_000,
    unit_label: "pcs",
    type: "product",
  };
}

function expectedRank(i: number, rank: number) {
  return {
    rank,
    id: 1000 + i,
    name: `Produk ${i}`,
    category: "Kategori Oli",
    sku: `SKU-${i}`,
    quantity: 100 - i,
    unit: "pcs",
    gross: (100 - i) * 10_000,
    collected: (100 - i) * 9_000,
  };
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, k) => from + k);
}

const EXPECTED_CATEGORIES = [
  { id: 11, name: "Kategori Oli", quantity: 30, gross: 2_400_000, collected: 2_350_000 },
  { id: 12, name: "Kategori Filter", quantity: 4.5, gross: 180_000, collected: 180_000 },
];

// ── show_sales_dashboard ────────────────────────────────────────────────────

describe("show_sales_dashboard", () => {
  it("dispatches the six report reads with registry-valid queries and projects every field", async () => {
    const call = await callWidgetTool(
      salesDashboardTool,
      { start_date: "2026-09-08", end_date: "2026-09-14" },
      {
        handlers: {
          "reports.summaries.transaction": () => summaryPayload(),
          "reports.sales.trend": () => trendPayload(),
          "reports.summaries.paymentMethods": () => paymentPayload(),
          "reports.categories": () => categoriesPayload(),
          "reports.products": () => envelope({ report_products: [MANUAL_ROW, productRow(1), productRow(2)] }),
          "reports.summaries.installment": () =>
            envelope({ total_customer: 22, total_down_payment: 1_250_000, total_receivable: 53_634_000 }),
        },
      },
    );

    expect(call.error).toBeUndefined();
    const outlet = { start_date: "2026-09-08", end_date: "2026-09-14", outlet_ids: "645203" };
    expect(byOperation(requests(call))).toEqual(
      byOperation([
        { operationId: "reports.summaries.transaction", query: outlet },
        {
          operationId: "reports.sales.trend",
          query: { ...outlet, trend_type: "sales", comparison_start_date: "2026-09-01", comparison_end_date: "2026-09-07" },
        },
        { operationId: "reports.summaries.paymentMethods", query: { ...outlet, country_code: "ID", language_code: "id" } },
        { operationId: "reports.categories", query: { page: 1, count: 10, ...outlet } },
        { operationId: "reports.products", query: { page: 1, count: 5, ...outlet, sort: "-quantity" } },
        {
          operationId: "reports.summaries.installment",
          query: { start_date: "2015-01-01", end_date: "2026-09-15", outlet_ids: "645203" },
        },
      ]),
    );

    const data = expectContract(salesDashboardData, call.structured);
    const expected: ToolOutput<"show_sales_dashboard"> = {
      view: "penjualan",
      ...META,
      range: { start_date: "2026-09-08", end_date: "2026-09-14" },
      comparison: { start_date: "2026-09-01", end_date: "2026-09-07" },
      kpis: {
        sales_before_discount: 9_185_000,
        discount: 15_000,
        gross_sales: 9_170_000,
        profit: 3_170_000,
        capital: 6_000_000,
        tax: 0,
        transactions: 120,
        quantity: 245.5,
        average_ticket: 76_417,
      },
      changes: {
        gross: { percent: 21.16, direction: "up" },
        profit: { percent: 2.41, direction: "down" },
        transactions: { percent: null, direction: null },
        quantity: { percent: 3496.08, direction: "up" },
      },
      trend: [
        { date: "2026-09-08", amount: 1_200_000, comparison_date: "2026-09-01", comparison_amount: 1_000_000 },
        { date: "2026-09-09", amount: 1_300_000, comparison_date: null, comparison_amount: null },
      ],
      payment_methods: [
        { name: "CASH", quantity: 80, amount: 6_170_000 },
        { name: "QRIS", quantity: 40, amount: 3_000_000 },
      ],
      categories: EXPECTED_CATEGORIES,
      top_products: [expectedRank(1, 1), expectedRank(2, 2)],
      receivable: { total: 53_634_000, customers: 22 },
    };
    expect(data).toEqual(expected);

    expect(call.result.content).toHaveLength(1);
    expect(call.text.length).toBeLessThanOrEqual(2000);
    expect(call.text).toContain("Penjualan 8 Sep 2026 – 14 Sep 2026 (outlet 645203), dibandingkan 1 Sep 2026 – 7 Sep 2026.");
    expect(call.text).toContain("Penjualan kotor: Rp 9.170.000 (naik 21,16% dari periode sebelumnya).");
    expect(call.text).toContain("Laba kotor: Rp 3.170.000 (turun 2,41% dari periode sebelumnya).");
    expect(call.text).toContain("Transaksi: 120; rata-rata Rp 76.417 per transaksi.");
    expect(call.text).toContain("Metode pembayaran teratas: CASH Rp 6.170.000 (80 transaksi).");
    expect(call.text).toContain("Produk terlaris: 1. Produk 1 (99 pcs), 2. Produk 2 (98 pcs).");
    expect(call.text).toContain("Sisa piutang (laporan Qasir): Rp 53.634.000 dari 22 pelanggan.");
    expect(call.text).not.toContain("Transaksi Manual");
  });

  it("handles a day without data, a single-day comparison and an explicit outlet", async () => {
    const call = await callWidgetTool(
      salesDashboardTool,
      { start_date: "2026-09-15", end_date: "2026-09-15", outlet_id: "777" },
      {
        handlers: {
          "reports.summaries.transaction": () => emptySummaryPayload(),
          "reports.sales.trend": () => envelope({ data_trends: [] }),
          "reports.summaries.paymentMethods": () => envelope({ payment_method: [] }),
          "reports.categories": () => envelope({ report_categories: [] }),
          "reports.products": () => envelope({ report_products: [] }),
          "reports.summaries.installment": () => envelope({ total_customer: 0, total_down_payment: 0, total_receivable: 0 }),
        },
      },
    );

    expect(call.error).toBeUndefined();
    const reqs = requests(call);
    expect(reqs).toHaveLength(6);
    for (const req of reqs) expect(req.query?.outlet_ids).toBe("777");
    expect(reqs.find((r) => r.operationId === "reports.sales.trend")?.query).toMatchObject({
      comparison_start_date: "2026-09-14",
      comparison_end_date: "2026-09-14",
    });

    const data = expectContract(salesDashboardData, call.structured);
    expect(data).toEqual({
      view: "penjualan",
      ...META,
      outlet_id: "777",
      range: { start_date: "2026-09-15", end_date: "2026-09-15" },
      comparison: { start_date: "2026-09-14", end_date: "2026-09-14" },
      kpis: {
        sales_before_discount: 0,
        discount: 0,
        gross_sales: 0,
        profit: 0,
        capital: 0,
        tax: 0,
        transactions: 0,
        quantity: 0,
        average_ticket: 0,
      },
      changes: {
        gross: { percent: null, direction: null },
        profit: { percent: null, direction: null },
        transactions: { percent: null, direction: null },
        quantity: { percent: null, direction: null },
      },
      trend: [],
      payment_methods: [],
      categories: [],
      top_products: [],
      receivable: { total: 0, customers: 0 },
    });
    expect(call.text).toContain("Penjualan 15 Sep 2026 (outlet 777), dibandingkan 14 Sep 2026.");
    expect(call.text).toContain("Tidak ada transaksi pada periode ini.");
    expect(call.text).not.toContain("Produk terlaris");
    expect(call.text).not.toContain("Metode pembayaran teratas");
  });

  it("rejects reversed and over-long ranges before any dispatch", async () => {
    for (const input of [
      { start_date: "2026-09-15", end_date: "2026-09-14" },
      { start_date: "2025-09-14", end_date: "2026-09-15" },
    ]) {
      const call = await callWidgetTool(salesDashboardTool, input, { handlers: {} });
      expect(call.result.isError).toBe(true);
      expect(call.error?.code).toBe("INVALID_INPUT");
      expect(call.dispatcher.calls).toHaveLength(0);
    }
  });

  it("surfaces an upstream failure as a {code, message} error without structured content", async () => {
    const ok = () => envelope({});
    const call = await callWidgetTool(
      salesDashboardTool,
      { start_date: "2026-09-08", end_date: "2026-09-14" },
      {
        handlers: {
          "reports.summaries.transaction": ok,
          "reports.sales.trend": ok,
          "reports.summaries.paymentMethods": ok,
          "reports.categories": ok,
          "reports.products": () => {
            throw new AppError(ErrorCodes.UPSTREAM_ERROR, "Upstream 500");
          },
          "reports.summaries.installment": ok,
        },
      },
    );
    expect(call.result.isError).toBe(true);
    expect(call.error).toEqual({ code: "UPSTREAM_ERROR", message: "Upstream 500" });
    expect(call.result.structuredContent).toBeUndefined();
  });
});

// ── show_product_ranking ────────────────────────────────────────────────────

describe("show_product_ranking", () => {
  const fullFirstPage = () =>
    envelope(
      { report_products: [MANUAL_ROW, ...range(1, 50).map(productRow)] },
      { current_page: 1, page_size: 50, total_page: 3, total_result: 150, next: "/api/v5/reports/products?page=2" },
    );

  it("ranks page 1 without the manual pseudo row and reports it separately", async () => {
    const call = await callWidgetTool(
      productRankingTool,
      { start_date: "2026-09-08", end_date: "2026-09-14" },
      { handlers: { "reports.products": () => fullFirstPage(), "reports.categories": () => categoriesPayload() } },
    );

    expect(call.error).toBeUndefined();
    const outlet = { start_date: "2026-09-08", end_date: "2026-09-14", outlet_ids: "645203" };
    expect(byOperation(requests(call))).toEqual([
      { operationId: "reports.categories", query: { page: 1, count: 20, ...outlet } },
      { operationId: "reports.products", query: { page: 1, count: 50, ...outlet, sort: "-quantity" } },
    ]);

    const data = expectContract(productRankingData, call.structured);
    const expected: ToolOutput<"show_product_ranking"> = {
      view: "produk",
      ...META,
      range: { start_date: "2026-09-08", end_date: "2026-09-14" },
      order: "terlaris",
      rows: range(1, 50).map((i) => expectedRank(i, i)),
      categories: EXPECTED_CATEGORIES,
      manual_transactions: { quantity: 2, gross: 50_000 },
      next_page: 2,
    };
    expect(data).toEqual(expected);

    expect(call.text.length).toBeLessThanOrEqual(2000);
    expect(call.text).toContain("Peringkat produk terlaris, 8 Sep 2026 – 14 Sep 2026 (outlet 645203):");
    expect(call.text).toContain("1. Produk 1: 99 pcs, Rp 990.000");
    expect(call.text).toContain("10. Produk 10: 90 pcs, Rp 900.000");
    expect(call.text).not.toContain("11. Produk 11");
    expect(call.text).toContain("Transaksi manual (tanpa produk): 2 item, Rp 50.000.");
    expect(call.text).toContain("50 produk pertama dimuat");
  });

  it.each(PRODUCT_ORDERS)("sends the upstream sort token for order %s", async (order) => {
    const call = await callWidgetTool(
      productRankingTool,
      { start_date: "2026-09-01", end_date: "2026-09-30", order },
      {
        handlers: {
          "reports.products": () => envelope({ report_products: [productRow(1)] }),
          "reports.categories": () => envelope({ report_categories: [] }),
        },
      },
    );
    const products = requests(call).find((r) => r.operationId === "reports.products");
    expect(products?.query?.sort).toBe(PRODUCT_ORDER_SORT[order]);
    expect(expectContract(productRankingData, call.structured).order).toBe(order);
  });

  it("stops paging on a short page even when upstream still advertises a next page", async () => {
    const call = await callWidgetTool(
      productRankingTool,
      { start_date: "2026-09-08", end_date: "2026-09-14", order: "kurang_laris" },
      {
        handlers: {
          "reports.products": () =>
            envelope(
              { report_products: [productRow(1), productRow(2), productRow(3)] },
              { current_page: 1, page_size: 50, total_page: 2, total_result: 60, next: "/api/v5/reports/products?page=2" },
            ),
          "reports.categories": () => envelope({ report_categories: [] }),
        },
      },
    );
    const data = expectContract(productRankingData, call.structured);
    expect(data.rows.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(data.manual_transactions).toBeNull();
    expect(data.next_page).toBeNull();
    expect(call.text).toContain("Peringkat produk kurang laris");
    expect(call.text).not.toContain("Transaksi manual");
  });

  it("rejects an over-long range before any dispatch", async () => {
    const call = await callWidgetTool(productRankingTool, { start_date: "2025-01-01", end_date: "2026-09-15" }, { handlers: {} });
    expect(call.error?.code).toBe("INVALID_INPUT");
    expect(call.dispatcher.calls).toHaveLength(0);
  });
});

// ── product_ranking_page ────────────────────────────────────────────────────

describe("product_ranking_page", () => {
  it("continues ranks from the page offset", async () => {
    const call = await callWidgetTool(
      productRankingPageTool,
      { start_date: "2026-09-08", end_date: "2026-09-14", order: "omzet_tertinggi", page: 3, outlet_id: "645203" },
      {
        handlers: {
          "reports.products": () =>
            envelope(
              { report_products: range(101, 150).map(productRow) },
              { current_page: 3, page_size: 50, total_page: 5, total_result: 250, next: "/api/v5/reports/products?page=4" },
            ),
        },
      },
    );

    expect(requests(call)).toEqual([
      {
        operationId: "reports.products",
        query: { page: 3, count: 50, start_date: "2026-09-08", end_date: "2026-09-14", outlet_ids: "645203", sort: "-total_gross" },
      },
    ]);
    const data = expectContract(productRankingPageData, call.structured);
    const expected: ToolOutput<"product_ranking_page"> = {
      ...META,
      order: "omzet_tertinggi",
      page: 3,
      rows: range(101, 150).map((i) => expectedRank(i, i)),
      next_page: 4,
    };
    expect(data).toEqual(expected);
    expect(call.text).toBe("Peringkat produk omzet tertinggi halaman 3: peringkat 101–150.\nHalaman berikutnya: 4.");
  });

  it("returns an empty last page when total_result overstated the rows", async () => {
    const call = await callWidgetTool(
      productRankingPageTool,
      { start_date: "2026-09-08", end_date: "2026-09-14", order: "terlaris", page: 4 },
      { handlers: { "reports.products": () => envelope({ report_products: [] }, { current_page: 4, total_page: 4, total_result: 200 }) } },
    );
    const data = expectContract(productRankingPageData, call.structured);
    expect(data.rows).toEqual([]);
    expect(data.next_page).toBeNull();
    expect(call.text).toBe("Peringkat produk terlaris halaman 4: tidak ada produk lagi.");
  });

  it("never offers a page beyond 500", async () => {
    const call = await callWidgetTool(
      productRankingPageTool,
      { start_date: "2026-09-08", end_date: "2026-09-14", order: "terlaris", page: 500 },
      {
        handlers: {
          "reports.products": () =>
            envelope({ report_products: range(1, 50).map(productRow) }, { current_page: 500, next: "/api/v5/reports/products?page=501" }),
        },
      },
    );
    expect(expectContract(productRankingPageData, call.structured).next_page).toBeNull();
  });
});

// ── Registration metadata ───────────────────────────────────────────────────

describe("SALES_TOOLS", () => {
  it("declares names, budgets, views and description rules", () => {
    expect(SALES_TOOLS.map((t) => [t.name, t.maxRequests, t.view])).toEqual([
      ["show_sales_dashboard", 6, "penjualan"],
      ["show_product_ranking", 2, "produk"],
      ["product_ranking_page", 1, undefined],
    ]);
    for (const tool of SALES_TOOLS) {
      if (tool.view) {
        expect(tool.description.startsWith("Open an interactive")).toBe(true);
        expect(tool.description.length).toBeLessThanOrEqual(600);
      } else {
        expect(tool.description.startsWith("Widget helper:")).toBe(true);
        expect(tool.description.length).toBeLessThanOrEqual(300);
      }
    }
  });
});
