import {
  assertExpectedPage,
  columnIndex,
  extractTables,
  readPagination,
  rowCells,
} from "./text";

export interface StockAdjustmentRow {
  date: string;
  productName: string;
  productType: string;
  outlet: string;
  adjustment: string;
  notes: string;
}

export interface StockAdjustmentPage {
  rows: StockAdjustmentRow[];
  /** Current page (active pagination item, else the requested page). */
  pageHint: number | null;
  hasNext: boolean;
}

export interface ParseStockAdjustmentOptions {
  requestedPage?: number;
}

/** Vue root `#stockAdjustment`, the history columns, or the new-adjustment link. */
const PAGE_MARKERS = [
  /\bid\s*=\s*["']stockAdjustment["']/,
  /Tanggal\s+Penyesuaian/i,
  /\/stock\/adjustment\/form\b/,
];

/**
 * Parse the SSR stock adjustment history table. Throws QASIR_AUTH_EXPIRED for
 * a sign-in page and UPSTREAM_ERROR for any other unexpected page.
 */
export function parseStockAdjustmentHtml(
  html: string,
  options: ParseStockAdjustmentOptions = {},
): StockAdjustmentPage {
  assertExpectedPage(html, PAGE_MARKERS, "stock adjustment");
  const tables = extractTables(html);
  const table =
    tables.find((t) => t.headers.some((h) => /penyesuaian/i.test(h))) ??
    tables.find((t) => t.headers.some((h) => /produk/i.test(h)));
  const rows: StockAdjustmentRow[] = [];
  if (table) {
    const h = table.headers;
    const col = {
      date: columnIndex(h, /tanggal|date/i, 0),
      productName: columnIndex(h, /nama|produk/i, 1, /jenis/i),
      productType: columnIndex(h, /jenis|type/i, 2),
      outlet: columnIndex(h, /outlet/i, 3),
      adjustment: columnIndex(h, /penyesuaian|adjust/i, 4, /tanggal|date/i),
      notes: columnIndex(h, /catatan|note/i, 5),
    };
    for (const tr of table.rows) {
      const cells = rowCells(tr);
      if (cells.length < 4) continue; // "no data" colspan rows
      const row: StockAdjustmentRow = {
        date: cells[col.date] ?? "",
        productName: cells[col.productName] ?? "",
        productType: cells[col.productType] ?? "",
        outlet: cells[col.outlet] ?? "",
        adjustment: cells[col.adjustment] ?? "",
        notes: cells[col.notes] ?? "",
      };
      if (row.productName || row.date) rows.push(row);
    }
  }
  const pagination = readPagination(html, options.requestedPage);
  return { rows, pageHint: pagination.page, hasNext: pagination.hasNext };
}
