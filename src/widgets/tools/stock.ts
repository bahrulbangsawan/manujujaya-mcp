import type { DispatchRequest } from "../../dispatcher/qasir-dispatcher";
import {
  PAGE_SIZE,
  STOCK_MOVEMENT_TYPES,
  STRUCTURED_MAX_CHARS,
  VELOCITY_MAX_PAGES,
  VELOCITY_WINDOW_DAYS,
  stockBrowserInput,
  stockHistoryInput,
  stockMovementLabel,
  stockPageInput,
  stockVelocityInput,
  type ToolOutput,
} from "../contract";
import { daysBetween, jakartaDateOf, parseQasirDateTime } from "../qasir-dates";
import { isRecord, toNumber, toNumberOrNull, toText } from "../qasir-values";
import type { AnyWidgetToolDef, ToolContext, WidgetToolDef } from "./define";
import {
  capRows,
  envelopeData,
  formatQty,
  indoDate,
  isUpstream404,
  joinLines,
  nextPageOf,
  pageInfo,
  recordsAt,
  rupiah,
} from "./shared";

type BrowserData = ToolOutput<"show_stock_browser">;
type StockPageData = ToolOutput<"stock_page">;
type HistoryData = ToolOutput<"stock_history">;
type VelocityData = ToolOutput<"stock_velocity">;
type StockRow = BrowserData["rows"][number];
type Movement = HistoryData["movements"][number];

const DAY_MS = 86_400_000;
/** stockTurnover requires a sort; other values are accepted but do not reorder. */
const TURNOVER_SORT = "created_at";
const HISTORY_TYPES = STOCK_MOVEMENT_TYPES.join(",");
/** Largest page size the registry allows; velocity reads up to VELOCITY_MAX_PAGES of these. */
const VELOCITY_PAGE_SIZE = 100;
const TEXT_ITEMS = 10;
const TRUNCATED_REASON = "Baris terakhir dipangkas karena hasil melebihi 250 KB.";

// ── Upstream requests (queries match src/registry/ops/catalog.ts) ───────────

function turnoverRequest(outletId: string, page: number, search: string | undefined): DispatchRequest {
  return {
    operationId: "inventories.stockTurnover",
    query: { outlet_ids: outletId, page, count: PAGE_SIZE.stock, sort: TURNOVER_SORT, ...(search ? { search } : {}) },
  };
}

function historyRequest(outletId: string, inventoryId: number, page: number, count: number): DispatchRequest {
  return {
    operationId: "inventories.stockHistories",
    path: { inventory_id: inventoryId },
    query: { page, count, outlet_ids: outletId, type: HISTORY_TYPES },
  };
}

// ── Projections ─────────────────────────────────────────────────────────────

/** Days since a last-touch date: null without a date; upstream day count, else computed in Jakarta. */
function daysSince(at: string | null, tillNow: unknown, today: string): number | null {
  if (at === null) return null;
  const upstream = toNumberOrNull(tillNow);
  if (upstream !== null && upstream >= 0) return upstream;
  return Math.max(0, daysBetween(jakartaDateOf(at), today));
}

function projectStockRow(variant: Record<string, unknown>, today: string): StockRow | null {
  const id = toNumberOrNull(variant.id);
  if (id === null || !Number.isSafeInteger(id) || id <= 0) return null;
  const lastSale = parseQasirDateTime(variant.latest_sales_date);
  const lastAdjustment = parseQasirDateTime(variant.latest_adjustment_date);
  return {
    inventory_id: id,
    name: toText(variant.product_name),
    stock: toNumber(variant.stock),
    price_sell: toNumber(variant.price_sell),
    last_sale_at: lastSale,
    days_since_sale: daysSince(lastSale, variant.latest_sales_till_now, today),
    last_adjustment_at: lastAdjustment,
    days_since_adjustment: daysSince(lastAdjustment, variant.latest_adjustment_till_now, today),
  };
}

interface StockPage {
  rows: StockRow[];
  totalRows: number | null;
  next: number | null;
}

async function fetchStockPage(ctx: ToolContext, outletId: string, page: number, search: string | undefined): Promise<StockPage> {
  let res: unknown;
  try {
    res = await ctx.request(turnoverRequest(outletId, page, search));
  } catch (err) {
    // A search without matches comes back as upstream 404.
    if (search && isUpstream404(err)) return { rows: [], totalRows: 0, next: null };
    throw err;
  }
  const variants = recordsAt(envelopeData(res, "inventories.stockTurnover"), "variants");
  return {
    rows: variants.flatMap((variant) => {
      const row = projectStockRow(variant, ctx.today);
      return row ? [row] : [];
    }),
    totalRows: pageInfo(res)?.totalResult ?? null,
    next: nextPageOf(res, page, variants.length, PAGE_SIZE.stock),
  };
}

function projectMovement(row: Record<string, unknown>): Movement {
  const type = toText(row.type);
  const salesId = toText(row.sales_id);
  const by = isRecord(row.created_by) ? toText(row.created_by.name) : "";
  return {
    id: toText(row.id),
    at: parseQasirDateTime(row.created_date),
    type,
    type_label: stockMovementLabel(type),
    quantity: toNumber(row.quantity),
    balance: toNumber(row.opname),
    note: toText(row.notes),
    by: by || null,
    sales_id: salesId && salesId !== "0" ? salesId : null,
  };
}

/** stockHistories names single-variant items "Produk-"; drop the dangling separator. */
function historyProductName(data: Record<string, unknown>): string {
  return toText(data.product_name).replace(/-+$/, "").trim();
}

function capStructuredRows<B extends { truncated: boolean; truncated_reason: string | null }, R>(
  base: B,
  rows: R[],
): B & { rows: R[] } {
  const capped = capRows(rows, STRUCTURED_MAX_CHARS, (kept) => ({ ...base, truncated: true, truncated_reason: TRUNCATED_REASON, rows: kept }));
  return capped.truncated
    ? { ...base, truncated: true, truncated_reason: TRUNCATED_REASON, rows: capped.rows }
    : { ...base, rows: capped.rows };
}

// ── Text ────────────────────────────────────────────────────────────────────

function daysAgo(days: number): string {
  if (days === 0) return "hari ini";
  if (days === 1) return "kemarin";
  return `${formatQty(days)} hari lalu`;
}

function stockLine(row: StockRow): string {
  const sale = row.days_since_sale === null ? "belum pernah terjual" : `terakhir terjual ${daysAgo(row.days_since_sale)}`;
  return `- ${row.name}: stok ${formatQty(row.stock)}, ${rupiah(row.price_sell)}, ${sale}`;
}

function browserText(d: BrowserData): string {
  const hits = d.total_rows ?? d.rows.length;
  const header = d.search === null ? `Stok outlet ${d.outlet_id}: ${formatQty(hits)} varian.` : `Stok untuk pencarian "${d.search}" (outlet ${d.outlet_id}): ${formatQty(hits)} varian.`;
  return joinLines([
    header,
    d.rows.length === 0 && (d.search === null ? "Tidak ada produk." : `Tidak ada produk yang cocok dengan "${d.search}".`),
    ...d.rows.slice(0, TEXT_ITEMS).map(stockLine),
    d.next_page !== null && `${d.rows.length} varian pertama dimuat; buka widget untuk melihat lebih banyak.`,
    d.truncated && d.truncated_reason,
  ]);
}

function stockPageText(d: StockPageData): string {
  return joinLines([
    `Stok halaman ${d.page}${d.search === null ? "" : ` untuk "${d.search}"`}: ${d.rows.length} varian.`,
    d.next_page !== null && `Halaman berikutnya: ${d.next_page}.`,
    d.truncated && d.truncated_reason,
  ]);
}

/** Notes are staff free text (may hold customer names or phones): widget only, never in the text block. */
function movementLine(m: Movement): string {
  const when = m.at === null ? "tanpa tanggal" : indoDate(jakartaDateOf(m.at));
  const qty = m.quantity > 0 ? `+${formatQty(m.quantity)}` : formatQty(m.quantity);
  return `- ${when}: ${m.type_label} ${qty}, saldo ${formatQty(m.balance)}`;
}

function historyText(d: HistoryData): string {
  return joinLines([
    `Riwayat stok ${d.product_name || `item ${d.inventory_id}`} (stok saat ini ${formatQty(d.stock)}), halaman ${d.page}: ${d.movements.length} pergerakan.`,
    ...d.movements.slice(0, TEXT_ITEMS).map(movementLine),
    d.next_page !== null && `Halaman berikutnya: ${d.next_page}.`,
  ]);
}

function velocityText(d: VelocityData, productName: string): string {
  return joinLines([
    `Kecepatan jual ${productName || `item ${d.inventory_id}`}, ${d.window_days} hari terakhir: terjual ${formatQty(d.sold)}, refund ${formatQty(d.refunded)}, bersih ${formatQty(d.net_sold)} (${formatQty(d.daily_rate)} per hari).`,
    d.days_of_cover === null
      ? `Stok saat ini ${formatQty(d.stock)}; tanpa penjualan bersih, perkiraan habis tidak bisa dihitung.`
      : `Stok saat ini ${formatQty(d.stock)}; perkiraan habis dalam ${formatQty(Math.round(d.days_of_cover))} hari.`,
    d.truncated && d.truncated_reason,
  ]);
}

// ── Tools ───────────────────────────────────────────────────────────────────

export const stockBrowserTool: WidgetToolDef<typeof stockBrowserInput> = {
  name: "show_stock_browser",
  title: "Stok produk",
  description:
    "Open an interactive stock browser widget (stok): on-hand stock, sell price, days since last sale and since last stock adjustment per variant, with movement history and 30-day sales velocity per item. Use it when the owner asks about stock levels, slow movers or when an item was last counted. Pass search whenever the user names a product; without it the first load takes about 15 s.",
  input: stockBrowserInput,
  maxRequests: 1,
  view: "stok",
  async run(input, ctx) {
    const outletId = await ctx.outletId(input.outlet_id);
    const page = await fetchStockPage(ctx, outletId, 1, input.search);
    const structured: BrowserData = capStructuredRows(
      { view: "stok" as const, ...ctx.meta(outletId), search: input.search ?? null, total_rows: page.totalRows, next_page: page.next },
      page.rows,
    );
    return { text: browserText(structured), structured };
  },
};

export const stockPageTool: WidgetToolDef<typeof stockPageInput> = {
  name: "stock_page",
  title: "Halaman stok",
  description: "Widget helper: loads one more page (50 variants) of the stock list shown in the stok widget.",
  input: stockPageInput,
  maxRequests: 1,
  async run(input, ctx) {
    const outletId = await ctx.outletId(input.outlet_id);
    const page = await fetchStockPage(ctx, outletId, input.page, input.search);
    const structured: StockPageData = capStructuredRows(
      { ...ctx.meta(outletId), search: input.search ?? null, page: input.page, next_page: page.next },
      page.rows,
    );
    return { text: stockPageText(structured), structured };
  },
};

export const stockHistoryTool: WidgetToolDef<typeof stockHistoryInput> = {
  name: "stock_history",
  title: "Riwayat stok",
  description: "Widget helper: loads one page (50 rows) of stock movements for one inventory item in the stok widget.",
  input: stockHistoryInput,
  maxRequests: 1,
  async run(input, ctx) {
    const outletId = await ctx.outletId(input.outlet_id);
    const res = await ctx.request(historyRequest(outletId, input.inventory_id, input.page, PAGE_SIZE.stockHistory));
    const data = envelopeData(res, "inventories.stockHistories");
    const raw = recordsAt(data, "stock_histories");
    const base = {
      ...ctx.meta(outletId),
      inventory_id: input.inventory_id,
      product_name: historyProductName(data),
      stock: toNumber(data.stock),
      page: input.page,
      next_page: nextPageOf(res, input.page, raw.length, PAGE_SIZE.stockHistory),
    };
    const movements = raw.map(projectMovement);
    const capped = capRows(movements, STRUCTURED_MAX_CHARS, (kept) => ({ ...base, truncated: true, truncated_reason: TRUNCATED_REASON, movements: kept }));
    const structured: HistoryData = capped.truncated
      ? { ...base, truncated: true, truncated_reason: TRUNCATED_REASON, movements: capped.rows }
      : { ...base, movements };
    return { text: historyText(structured), structured };
  },
};

export const stockVelocityTool: WidgetToolDef<typeof stockVelocityInput> = {
  name: "stock_velocity",
  title: "Kecepatan jual",
  description: "Widget helper: net units sold in the last 30 days and estimated days of cover for one inventory item in the stok widget.",
  input: stockVelocityInput,
  maxRequests: VELOCITY_MAX_PAGES,
  async run(input, ctx) {
    const outletId = await ctx.outletId(input.outlet_id);
    const cutoff = new Date(ctx.now.getTime() - VELOCITY_WINDOW_DAYS * DAY_MS).toISOString();
    let stock = 0;
    let productName = "";
    let sold = 0;
    let refunded = 0;
    let oldest: string | null = null;
    let complete = false;

    for (let page = 1; page <= VELOCITY_MAX_PAGES && !complete; page++) {
      const res = await ctx.request(historyRequest(outletId, input.inventory_id, page, VELOCITY_PAGE_SIZE));
      const data = envelopeData(res, "inventories.stockHistories");
      if (page === 1) {
        stock = toNumber(data.stock);
        productName = historyProductName(data);
      }
      const rows = recordsAt(data, "stock_histories");
      for (const row of rows) {
        const at = parseQasirDateTime(row.created_date);
        if (at === null) continue;
        if (oldest === null || at < oldest) oldest = at;
        // Histories are newest first: one movement before the window means the window is fully read.
        if (at < cutoff) {
          complete = true;
          continue;
        }
        const type = toText(row.type);
        if (type === "sales") sold += Math.abs(toNumber(row.quantity));
        else if (type === "refund") refunded += Math.abs(toNumber(row.quantity));
      }
      if (rows.length === 0 || nextPageOf(res, page, rows.length, VELOCITY_PAGE_SIZE) === null) complete = true;
    }

    const netSold = sold - refunded;
    const dailyRate = netSold > 0 ? netSold / VELOCITY_WINDOW_DAYS : 0;
    const structured: VelocityData = {
      ...ctx.meta(outletId),
      ...(complete
        ? {}
        : {
            truncated: true,
            truncated_reason: `Hanya ${VELOCITY_MAX_PAGES * VELOCITY_PAGE_SIZE} pergerakan terbaru yang dibaca; penjualan 30 hari bisa lebih tinggi.`,
          }),
      inventory_id: input.inventory_id,
      stock,
      window_days: VELOCITY_WINDOW_DAYS,
      sold,
      refunded,
      net_sold: netSold,
      daily_rate: dailyRate,
      days_of_cover: netSold > 0 ? Math.max(0, stock) / dailyRate : null,
      oldest_scanned_at: oldest,
    };
    return { text: velocityText(structured, productName), structured };
  },
};

export const STOCK_TOOLS: readonly AnyWidgetToolDef[] = [stockBrowserTool, stockPageTool, stockHistoryTool, stockVelocityTool];
