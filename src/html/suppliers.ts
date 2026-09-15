import {
  assertExpectedPage,
  columnIndex,
  extractTables,
  readPagination,
  rowCells,
} from "./text";

export interface SupplierRow {
  /** Dashboard form id from this row's own /supplier/form/{id} (or delete) link. */
  id: string | null;
  name: string;
  phone: string;
  address: string;
  city: string;
}

export interface SuppliersPage {
  rows: SupplierRow[];
  /** Current page (active pagination item, else the requested page). */
  pageHint: number | null;
  hasNext: boolean;
}

export interface ParseSuppliersOptions {
  requestedPage?: number;
}

/** Title `Supplier`, the "Nama Supplier" column, or supplier row actions. */
const PAGE_MARKERS = [
  /<title>[^<]*\bSupplier\b[^<]*<\/title>/i,
  /Nama\s+Supplier/i,
  /\/supplier\/(form|delete)\/\d+/,
];

/**
 * Parse the SSR suppliers table. Throws QASIR_AUTH_EXPIRED for a sign-in page
 * and UPSTREAM_ERROR for any other page, never an empty "success".
 */
export function parseSuppliersHtml(
  html: string,
  options: ParseSuppliersOptions = {},
): SuppliersPage {
  assertExpectedPage(html, PAGE_MARKERS, "Supplier");
  const tables = extractTables(html);
  const table =
    tables.find((t) => t.headers.some((h) => /supplier/i.test(h))) ??
    tables.find((t) => t.rows.some((tr) => /\/supplier\/(form|delete)\/\d+/.test(tr)));
  const rows: SupplierRow[] = [];
  if (table) {
    const h = table.headers;
    const col = {
      name: columnIndex(h, /nama/i, 0),
      phone: columnIndex(h, /telepon|phone|hp/i, 1),
      address: columnIndex(h, /alamat|address/i, 2),
      city: columnIndex(h, /kota|city|lokasi/i, 3),
    };
    for (const tr of table.rows) {
      const cells = rowCells(tr);
      if (cells.length < 2) continue; // "no data" colspan rows
      if (cells.every((c) => !c || c === "Edit" || c === "Hapus")) continue;
      const name = cells[col.name] ?? "";
      if (!name) continue;
      rows.push({
        id: extractRowId(tr),
        name,
        phone: cells[col.phone] ?? "",
        address: cells[col.address] ?? "",
        city: cells[col.city] ?? "",
      });
    }
  }
  const pagination = readPagination(html, options.requestedPage);
  return { rows, pageHint: pagination.page, hasNext: pagination.hasNext };
}

function extractRowId(tr: string): string | null {
  const m = tr.match(/\/supplier\/form\/(\d+)/) ?? tr.match(/\/supplier\/delete\/(\d+)/);
  return m?.[1] ?? null;
}
