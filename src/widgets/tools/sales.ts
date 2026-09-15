import type { DispatchRequest } from "../../dispatcher/qasir-dispatcher";
import {
  DEBT_SCAN_START_DATE,
  PAGE_SIZE,
  PRODUCT_ORDER_LABEL,
  PRODUCT_ORDER_SORT,
  isoDate,
  productRankingInput,
  productRankingPageInput,
  salesDashboardInput,
  type ProductOrder,
  type ToolOutput,
} from "../contract";
import { assertDateRange, parseIndonesianDate, previousRange } from "../qasir-dates";
import { isRecord, parsePercent, toNumber, toNumberOrNull, toText } from "../qasir-values";
import type { AnyWidgetToolDef, WidgetToolDef } from "./define";
import { capStructuredRows, envelopeData, formatQty, indoDate, joinLines, nextPageOf, recordsAt, rupiah } from "./shared";

type DashboardData = ToolOutput<"show_sales_dashboard">;
type RankingData = ToolOutput<"show_product_ranking">;
type RankingPageData = ToolOutput<"product_ranking_page">;
type RankRow = RankingData["rows"][number];
type CategoryRow = DashboardData["categories"][number];
type Change = DashboardData["changes"]["gross"];
type Range = { start_date: string; end_date: string };

const DASHBOARD_CATEGORIES = 10;
const DASHBOARD_TOP_PRODUCTS = 5;
const TEXT_TOP_PRODUCTS = 10;

// ── Upstream requests (operationIds are fixed; queries match src/registry/ops/reports.ts) ──

function rangeQuery(outletId: string, range: Range): { start_date: string; end_date: string; outlet_ids: string } {
  return { start_date: range.start_date, end_date: range.end_date, outlet_ids: outletId };
}

function productsRequest(outletId: string, range: Range, order: ProductOrder, page: number, count: number): DispatchRequest {
  return {
    operationId: "reports.products",
    query: { page, count, ...rangeQuery(outletId, range), sort: PRODUCT_ORDER_SORT[order] },
  };
}

function categoriesRequest(outletId: string, range: Range, count: number): DispatchRequest {
  return { operationId: "reports.categories", query: { page: 1, count, ...rangeQuery(outletId, range) } };
}

// ── Projections ─────────────────────────────────────────────────────────────

/** reports.products page 1 prepends a "Transaksi Manual" pseudo row with id 0. */
function isManualRow(row: Record<string, unknown>): boolean {
  return toNumber(row.id) === 0;
}

interface ProductPage {
  rows: RankRow[];
  manual: { quantity: number; gross: number } | null;
  next: number | null;
}

function projectProducts(res: unknown, page: number, pageSize: number): ProductPage {
  const raw = recordsAt(envelopeData(res, "reports.products"), "report_products");
  const manualRow = raw.find(isManualRow);
  const real = raw.filter((row) => !isManualRow(row)).slice(0, pageSize);
  const offset = (page - 1) * pageSize;
  const rows = real.map((row, index) => ({
    rank: offset + index + 1,
    id: toNumber(row.id),
    name: toText(row.name),
    category: toText(row.category_name),
    sku: toText(row.sku),
    quantity: toNumber(row.quantity),
    unit: toText(row.unit_label),
    gross: toNumber(row.total_gross),
    collected: toNumber(row.total_collected),
  }));
  // total_result overstates, so a short page is always the last one.
  const next = real.length < pageSize ? null : nextPageOf(res, page, real.length, pageSize);
  return {
    rows,
    manual: manualRow ? { quantity: toNumber(manualRow.quantity), gross: toNumber(manualRow.total_gross) } : null,
    next,
  };
}

function projectCategories(res: unknown, count: number): CategoryRow[] {
  return recordsAt(envelopeData(res, "reports.categories"), "report_categories")
    .slice(0, count)
    .map((row) => ({
      id: toNumber(row.id),
      name: toText(row.name),
      quantity: toNumber(row.quantity),
      gross: toNumber(row.total_gross),
      collected: toNumber(row.total_collected),
    }));
}

/** Trend dates arrive as YYYY-MM-DD (optionally with a time), MM/DD/YYYY or "DD Bulan YYYY". */
function trendDate(value: unknown): string | null {
  const text = toText(value);
  const iso = /^(\d{4}-\d{2}-\d{2})(?:$|[T ])/.exec(text);
  const us = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  const candidate = iso ? iso[1]! : us ? `${us[3]}-${us[1]}-${us[2]}` : parseIndonesianDate(text);
  return candidate !== null && isoDate.safeParse(candidate).success ? candidate : null;
}

function projectChange(value: unknown): Change {
  const trend = isRecord(value) ? value : {};
  const direction = trend.status === "up" || trend.status === "down" ? trend.status : null;
  return { percent: parsePercent(trend.value), direction };
}

// ── Text ────────────────────────────────────────────────────────────────────

function rangeLabel(range: Range): string {
  return range.start_date === range.end_date ? indoDate(range.start_date) : `${indoDate(range.start_date)} – ${indoDate(range.end_date)}`;
}

function changeLabel(change: Change): string {
  if (change.percent === null || change.direction === null) return "";
  return ` (${change.direction === "up" ? "naik" : "turun"} ${formatQty(change.percent)}% dari periode sebelumnya)`;
}

function quantityLabel(quantity: number, unit: string): string {
  return unit ? `${formatQty(quantity)} ${unit}` : formatQty(quantity);
}

function dashboardText(d: DashboardData): string {
  const topPayment = d.payment_methods[0];
  return joinLines([
    `Penjualan ${rangeLabel(d.range)} (outlet ${d.outlet_id}), dibandingkan ${rangeLabel(d.comparison)}.`,
    d.kpis.transactions === 0 && "Tidak ada transaksi pada periode ini.",
    `Penjualan kotor: ${rupiah(d.kpis.gross_sales)}${changeLabel(d.changes.gross)}.`,
    `Laba kotor: ${rupiah(d.kpis.profit)}${changeLabel(d.changes.profit)}.`,
    `Transaksi: ${formatQty(d.kpis.transactions)}${changeLabel(d.changes.transactions)}; rata-rata ${rupiah(d.kpis.average_ticket)} per transaksi.`,
    `Produk terjual: ${formatQty(d.kpis.quantity)}${changeLabel(d.changes.quantity)}.`,
    topPayment && `Metode pembayaran teratas: ${topPayment.name} ${rupiah(topPayment.amount)} (${formatQty(topPayment.quantity)} transaksi).`,
    d.top_products.length > 0 &&
      `Produk terlaris: ${d.top_products
        .slice(0, 3)
        .map((p) => `${p.rank}. ${p.name} (${quantityLabel(p.quantity, p.unit)})`)
        .join(", ")}.`,
    `Sisa piutang (laporan Qasir): ${rupiah(d.receivable.total)} dari ${formatQty(d.receivable.customers)} pelanggan.`,
  ]);
}

function rankingText(d: RankingData): string {
  return joinLines([
    `Peringkat produk ${PRODUCT_ORDER_LABEL[d.order].toLowerCase()}, ${rangeLabel(d.range)} (outlet ${d.outlet_id}):`,
    d.rows.length === 0 && "Tidak ada penjualan produk pada periode ini.",
    ...d.rows
      .slice(0, TEXT_TOP_PRODUCTS)
      .map((p) => `${p.rank}. ${p.name}: ${quantityLabel(p.quantity, p.unit)}, ${rupiah(p.gross)}`),
    d.manual_transactions &&
      `Transaksi manual (tanpa produk): ${formatQty(d.manual_transactions.quantity)} item, ${rupiah(d.manual_transactions.gross)}.`,
    d.next_page !== null && `${d.rows.length} produk pertama dimuat; buka widget untuk melihat lebih banyak.`,
    d.truncated && d.truncated_reason,
  ]);
}

function rankingPageText(d: RankingPageData): string {
  const first = d.rows[0];
  const last = d.rows[d.rows.length - 1];
  return joinLines([
    first && last
      ? `Peringkat produk ${PRODUCT_ORDER_LABEL[d.order].toLowerCase()} halaman ${d.page}: peringkat ${first.rank}–${last.rank}.`
      : `Peringkat produk ${PRODUCT_ORDER_LABEL[d.order].toLowerCase()} halaman ${d.page}: tidak ada produk lagi.`,
    d.next_page !== null && `Halaman berikutnya: ${d.next_page}.`,
    d.truncated && d.truncated_reason,
  ]);
}

// ── Tools ───────────────────────────────────────────────────────────────────

export const salesDashboardTool: WidgetToolDef<typeof salesDashboardInput> = {
  name: "show_sales_dashboard",
  title: "Dasbor penjualan",
  description:
    "Open an interactive sales dashboard widget (penjualan) for a date range: gross sales, profit, transactions and average ticket with change vs the previous period of equal length, a daily trend chart, payment methods, top categories and products, and outstanding customer credit. Use it when the owner asks how sales went today, this week, this month or for any range up to 366 days. Dates are YYYY-MM-DD in Asia/Jakarta.",
  input: salesDashboardInput,
  maxRequests: 6,
  view: "penjualan",
  async run(input, ctx) {
    assertDateRange(input.start_date, input.end_date);
    const outletId = await ctx.outletId(input.outlet_id);
    const range: Range = { start_date: input.start_date, end_date: input.end_date };
    const comparison = previousRange(range.start_date, range.end_date);

    const [summaryRes, trendRes, paymentRes, categoriesRes, productsRes, installmentRes] = await Promise.all([
      ctx.request({ operationId: "reports.summaries.transaction", query: rangeQuery(outletId, range) }),
      ctx.request({
        operationId: "reports.sales.trend",
        query: {
          ...rangeQuery(outletId, range),
          trend_type: "sales",
          comparison_start_date: comparison.start_date,
          comparison_end_date: comparison.end_date,
        },
      }),
      ctx.request({
        operationId: "reports.summaries.paymentMethods",
        query: { ...rangeQuery(outletId, range), country_code: "ID", language_code: "id" },
      }),
      ctx.request(categoriesRequest(outletId, range, DASHBOARD_CATEGORIES)),
      ctx.request(productsRequest(outletId, range, "terlaris", 1, DASHBOARD_TOP_PRODUCTS)),
      ctx.request({
        operationId: "reports.summaries.installment",
        query: rangeQuery(outletId, { start_date: DEBT_SCAN_START_DATE, end_date: ctx.today }),
      }),
    ]);

    const summaryData = envelopeData(summaryRes, "reports.summaries.transaction");
    const summary = isRecord(summaryData.summary_sales) ? summaryData.summary_sales : {};
    const salesTrend = isRecord(summary.sales_trend) ? summary.sales_trend : {};
    const grossSales = toNumber(summary.total_gross_sales);
    const transactions = toNumber(summary.total_transaction);

    const trend = recordsAt(envelopeData(trendRes, "reports.sales.trend"), "data_trends").flatMap((point) => {
      const date = trendDate(point.date);
      if (date === null) return [];
      return [
        {
          date,
          amount: toNumber(point.amount),
          comparison_date: trendDate(point.comparison_date),
          comparison_amount: toNumberOrNull(point.comparison_amount),
        },
      ];
    });

    const paymentMethods = recordsAt(envelopeData(paymentRes, "reports.summaries.paymentMethods"), "payment_method")
      .map((row) => ({ name: toText(row.name), quantity: toNumber(row.quantity), amount: toNumber(row.amount) }))
      .sort((a, b) => b.amount - a.amount);

    const installment = envelopeData(installmentRes, "reports.summaries.installment");

    const structured: DashboardData = {
      view: "penjualan",
      ...ctx.meta(outletId),
      range,
      comparison,
      kpis: {
        sales_before_discount: toNumber(summary.sales),
        discount: toNumber(summary.discount),
        gross_sales: grossSales,
        profit: toNumber(summary.total_profit),
        capital: toNumber(summary.capital_price),
        tax: toNumber(summary.tax),
        transactions,
        quantity: toNumber(summary.total_quantity),
        average_ticket: transactions > 0 ? Math.round(grossSales / transactions) : 0,
      },
      changes: {
        gross: projectChange(salesTrend.gross),
        profit: projectChange(salesTrend.profit),
        transactions: projectChange(salesTrend.transaction),
        quantity: projectChange(salesTrend.quantity),
      },
      trend,
      payment_methods: paymentMethods,
      categories: projectCategories(categoriesRes, DASHBOARD_CATEGORIES),
      top_products: projectProducts(productsRes, 1, DASHBOARD_TOP_PRODUCTS).rows,
      receivable: { total: toNumber(installment.total_receivable), customers: toNumber(installment.total_customer) },
    };
    return { text: dashboardText(structured), structured };
  },
};

export const productRankingTool: WidgetToolDef<typeof productRankingInput> = {
  name: "show_product_ranking",
  title: "Peringkat produk",
  description:
    "Open an interactive product ranking widget (produk) for a date range: best-selling (terlaris) or least-selling (kurang_laris) products by quantity, or highest/lowest revenue (omzet_tertinggi/omzet_terendah), plus sales per category. Use it when the owner asks which products sell best or worst per day, week or month. Dates are YYYY-MM-DD in Asia/Jakarta; range at most 366 days.",
  input: productRankingInput,
  maxRequests: 2,
  view: "produk",
  async run(input, ctx) {
    assertDateRange(input.start_date, input.end_date);
    const outletId = await ctx.outletId(input.outlet_id);
    const range: Range = { start_date: input.start_date, end_date: input.end_date };
    const order: ProductOrder = input.order ?? "terlaris";

    const [productsRes, categoriesRes] = await Promise.all([
      ctx.request(productsRequest(outletId, range, order, 1, PAGE_SIZE.products)),
      ctx.request(categoriesRequest(outletId, range, PAGE_SIZE.categories)),
    ]);
    const products = projectProducts(productsRes, 1, PAGE_SIZE.products);

    const structured: RankingData = capStructuredRows(
      {
        view: "produk" as const,
        ...ctx.meta(outletId),
        range,
        order,
        categories: projectCategories(categoriesRes, PAGE_SIZE.categories),
        manual_transactions: products.manual,
        next_page: products.next,
      },
      products.rows,
    );
    return { text: rankingText(structured), structured };
  },
};

export const productRankingPageTool: WidgetToolDef<typeof productRankingPageInput> = {
  name: "product_ranking_page",
  title: "Halaman peringkat produk",
  description: "Widget helper: loads one more page (50 rows) of the product ranking shown in the produk widget.",
  input: productRankingPageInput,
  maxRequests: 1,
  async run(input, ctx) {
    assertDateRange(input.start_date, input.end_date);
    const outletId = await ctx.outletId(input.outlet_id);
    const range: Range = { start_date: input.start_date, end_date: input.end_date };
    const res = await ctx.request(productsRequest(outletId, range, input.order, input.page, PAGE_SIZE.products));
    const products = projectProducts(res, input.page, PAGE_SIZE.products);

    const structured: RankingPageData = capStructuredRows(
      { ...ctx.meta(outletId), order: input.order, page: input.page, next_page: products.next },
      products.rows,
    );
    return { text: rankingPageText(structured), structured };
  },
};

export const SALES_TOOLS: readonly AnyWidgetToolDef[] = [salesDashboardTool, productRankingTool, productRankingPageTool];
