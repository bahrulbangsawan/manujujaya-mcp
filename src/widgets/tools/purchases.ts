import {
  APP_TOOL,
  PAGE_SIZE,
  PO_STATUSES,
  PO_STATUS_SCAN_PAGES,
  STRUCTURED_MAX_CHARS,
  VIEW_TOOL,
  poStatusLabel,
  purchaseOrderItemsInput,
  purchaseOrdersInput,
  purchaseOrdersPageInput,
  type PoStatusFilter,
  type ToolOutput,
} from "../contract";
import { parseQasirDateTime } from "../qasir-dates";
import { toNumber, toNumberOrNull, toText } from "../qasir-values";
import type { AnyWidgetToolDef, ToolContext, WidgetToolDef } from "./define";
import { capRows, envelopeData, formatQty, indoDate, joinLines, nextPageOf, pageInfo, recordsAt, rupiah } from "./shared";

type PurchaseRow = ToolOutput<"show_purchase_orders">["rows"][number];
type PurchaseItem = ToolOutput<"purchase_order_items">["items"][number];

const TRUNCATED_REASON = "Baris terakhir dipangkas karena hasil melebihi 250 KB.";

/** Trim rows so the payload, measured with its truncation fields set, fits STRUCTURED_MAX_CHARS. */
function fitRows<T, P extends object>(rows: T[], build: (rows: T[]) => P): P & { truncated: boolean; truncated_reason: string | null } {
  const capped = capRows(rows, STRUCTURED_MAX_CHARS, (kept) => ({ ...build(kept), truncated: true, truncated_reason: TRUNCATED_REASON }));
  return { ...build(capped.rows), truncated: capped.truncated, truncated_reason: capped.truncated ? TRUNCATED_REASON : null };
}

/** purchases.list row → contract row; rows without an id are dropped by the caller. */
export function projectPurchaseRow(raw: Record<string, unknown>): PurchaseRow {
  const status = toText(raw.status);
  return {
    id: toText(raw.id),
    order_no: toText(raw.order_no),
    supplier: toText(raw.supplier_name),
    total: toNumber(raw.total_price),
    status,
    status_label: poStatusLabel(status),
    created_at: parseQasirDateTime(raw.created_at),
  };
}

interface PurchasePage {
  rows: PurchaseRow[];
  nextPage: number | null;
  totalResult: number | null;
}

/** One purchases.list page (count 100; the endpoint has no status filter). */
async function fetchPurchasePage(ctx: ToolContext, outletId: string, page: number): Promise<PurchasePage> {
  const res = await ctx.request({
    operationId: "purchases.list",
    query: { page, count: PAGE_SIZE.purchases, outlet_ids: outletId },
  });
  const raw = recordsAt(envelopeData(res, "purchases.list"), "purchases");
  const rows = raw.map(projectPurchaseRow).filter((row) => row.id !== "");
  return {
    rows,
    nextPage: raw.length === 0 ? null : nextPageOf(res, page, raw.length, PAGE_SIZE.purchases),
    totalResult: pageInfo(res)?.totalResult ?? null,
  };
}

/** Every known status starts at 0 so the widget can render all chips. */
function countStatuses(rows: PurchaseRow[]): Record<string, number> {
  const counts: Record<string, number> = Object.fromEntries(PO_STATUSES.map((s) => [s, 0]));
  for (const row of rows) counts[row.status] = (counts[row.status] ?? 0) + 1;
  return counts;
}

function poLine(row: PurchaseRow): string {
  const date = row.created_at ? indoDate(row.created_at.slice(0, 10)) : "tanpa tanggal";
  return `- ${row.order_no || `PO ${row.id}`} · ${date} · ${row.supplier || "Tanpa pemasok"} · ${rupiah(row.total)} · ${row.status_label}`;
}

export const purchaseOrdersTool: WidgetToolDef<typeof purchaseOrdersInput> = {
  name: VIEW_TOOL.pembelian,
  title: "Pesanan pembelian (PO)",
  description:
    "Open an interactive purchase-order (PO) widget for the Qasir outlet: newest POs with supplier, total and status (Diproses, Selesai, Dibatalkan), with expandable line items. Use it when the user asks about purchases, POs, suppliers or goods still on order. `status` (default semua) filters by scanning the newest 500 POs.",
  input: purchaseOrdersInput,
  maxRequests: 5, // = PO_STATUS_SCAN_PAGES pages for a specific status
  view: "pembelian",
  async run(input, ctx) {
    const outletId = await ctx.outletId(input.outlet_id);
    const filter: PoStatusFilter = input.status ?? "semua";
    const maxPages = filter === "semua" ? 1 : PO_STATUS_SCAN_PAGES;

    const scanned: PurchaseRow[] = [];
    let totalRows: number | null = null;
    let lastPage = 0;
    let more = false;
    for (let page = 1; page <= maxPages; page++) {
      const result = await fetchPurchasePage(ctx, outletId, page);
      scanned.push(...result.rows);
      totalRows ??= result.totalResult;
      lastPage = page;
      more = result.nextPage !== null;
      if (!more) break;
    }

    const matching = filter === "semua" ? scanned : scanned.filter((row) => row.status === filter);
    const nextPage = more ? lastPage + 1 : null;
    const statusCounts = countStatuses(scanned);
    const build = (rows: PurchaseRow[]) => ({
      view: "pembelian" as const,
      ...ctx.meta(outletId),
      status_filter: filter,
      rows,
      status_counts: statusCounts,
      scanned_rows: scanned.length,
      total_rows: totalRows,
      next_page: nextPage,
    });
    const structured: ToolOutput<"show_purchase_orders"> = fitRows(matching, build);

    const filterLabel = filter === "semua" ? "Semua status" : poStatusLabel(filter);
    const countsLine = Object.entries(statusCounts)
      .map(([status, count]) => `${poStatusLabel(status)} ${count}`)
      .join(", ");
    const text = joinLines([
      `Pesanan pembelian (PO) outlet ${outletId} · filter: ${filterLabel}`,
      `Dipindai ${scanned.length} PO terbaru${totalRows !== null ? ` dari ${totalRows} PO` : ""}: ${countsLine}.`,
      matching.length === 0
        ? filter === "semua"
          ? "Belum ada PO."
          : `Tidak ada PO berstatus ${filterLabel} di PO yang dipindai.`
        : `${filter === "semua" ? "PO terbaru" : `PO berstatus ${filterLabel}`} (${Math.min(10, matching.length)} dari ${matching.length}):`,
      ...matching.slice(0, 10).map(poLine),
      nextPage !== null && "Masih ada PO yang lebih lama; buka widget untuk memuat halaman berikutnya.",
    ]);
    return { text, structured };
  },
};

export const purchaseOrdersPageTool: WidgetToolDef<typeof purchaseOrdersPageInput> = {
  name: APP_TOOL.purchaseOrdersPage,
  title: "Halaman PO berikutnya",
  description: "Widget helper: loads one more page (100 rows, newest first) of purchase orders for the pembelian view. Rows are unfiltered; the widget filters by status.",
  input: purchaseOrdersPageInput,
  maxRequests: 1,
  async run(input, ctx) {
    const outletId = await ctx.outletId(input.outlet_id);
    const result = await fetchPurchasePage(ctx, outletId, input.page);
    const build = (rows: PurchaseRow[]) => ({ ...ctx.meta(outletId), page: input.page, rows, next_page: result.nextPage });
    const structured: ToolOutput<"purchase_orders_page"> = fitRows(result.rows, build);
    const text = joinLines([
      `Halaman ${input.page} PO: ${result.rows.length} PO.`,
      result.nextPage === null ? "Tidak ada halaman berikutnya." : `Halaman berikutnya: ${result.nextPage}.`,
    ]);
    return { text, structured };
  },
};

/** purchases.items line → contract item. Unit cost is price_unit (price_base when absent). */
export function projectPurchaseItem(raw: Record<string, unknown>): PurchaseItem {
  const quantity = toNumber(raw.quantity);
  const price = toNumberOrNull(raw.price_unit) ?? toNumber(raw.price_base);
  return {
    product: toText(raw.product_name),
    variant: toText(raw.variant_name),
    quantity,
    received: toNumber(raw.receive_quantity),
    unit: toText(raw.unit_label_name),
    price,
    subtotal: quantity * price,
  };
}

export const purchaseOrderItemsTool: WidgetToolDef<typeof purchaseOrderItemsInput> = {
  name: APP_TOOL.purchaseOrderItems,
  title: "Rincian item PO",
  description: "Widget helper: line items of one purchase order (product, variant, ordered, received, unit cost, subtotal) for the pembelian view.",
  input: purchaseOrderItemsInput,
  maxRequests: 1,
  async run(input, ctx) {
    const outletId = await ctx.outletId(input.outlet_id);
    const res = await ctx.request({
      operationId: "purchases.items",
      path: { purchase_id: input.purchase_id },
      query: { outlet_id: Number(outletId) },
    });
    const items = recordsAt(envelopeData(res, "purchases.items"), "purchase_items").map(projectPurchaseItem);
    const total = items.reduce((sum, item) => sum + item.subtotal, 0);
    const build = (rows: PurchaseItem[]) => ({ ...ctx.meta(outletId), purchase_id: input.purchase_id, items: rows, total });
    const structured: ToolOutput<"purchase_order_items"> = fitRows(items, build);
    const text = joinLines([
      `Rincian PO ${input.purchase_id}: ${items.length} item, total ${rupiah(total)}.`,
      ...items
        .slice(0, 10)
        .map(
          (item) =>
            `- ${item.product}${item.variant ? ` (${item.variant})` : ""}: dipesan ${formatQty(item.quantity)}, diterima ${formatQty(item.received)} ${item.unit} × ${rupiah(item.price)} = ${rupiah(item.subtotal)}`,
        ),
      items.length > 10 && `…dan ${items.length - 10} item lainnya.`,
    ]);
    return { text, structured };
  },
};

export const PURCHASE_TOOLS: readonly AnyWidgetToolDef[] = [purchaseOrdersTool, purchaseOrdersPageTool, purchaseOrderItemsTool];
