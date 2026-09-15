export interface SupplierRow {
  id: string | null;
  name: string;
  phone: string;
  address: string;
  city: string;
}

export interface SuppliersPage {
  rows: SupplierRow[];
  pageHint: number | null;
}

/**
 * Parse SSR suppliers table. Tolerant of missing columns; ids from /supplier/form/{id}.
 */
export function parseSuppliersHtml(html: string): SuppliersPage {
  const rows: SupplierRow[] = [];
  const formIds = [...html.matchAll(/\/supplier\/form\/(\d+)/g)].map((m) => m[1]!);
  const trBlocks = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  let idIdx = 0;
  for (const tr of trBlocks) {
    if (/<th[\s>]/i.test(tr)) continue;
    const cells = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) =>
      stripTags(m[1] ?? "").trim(),
    );
    if (cells.length < 2) continue;
    // Skip pure action rows
    if (cells.every((c) => !c || c === "Edit" || c === "Hapus")) continue;
    const id = formIds[idIdx] ?? extractFormId(tr);
    if (id) idIdx += 1;
    rows.push({
      id,
      name: cells[0] ?? "",
      phone: cells[1] ?? "",
      address: cells[2] ?? "",
      city: cells[3] ?? "",
    });
  }
  const pageMatch = html.match(/[?&]page=(\d+)/);
  return {
    rows: rows.filter((r) => r.name.length > 0),
    pageHint: pageMatch ? Number(pageMatch[1]) : null,
  };
}

function extractFormId(tr: string): string | null {
  const m = tr.match(/\/supplier\/form\/(\d+)/);
  return m?.[1] ?? null;
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
