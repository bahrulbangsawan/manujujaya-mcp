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
}

/** Parse SSR stock adjustment history table. */
export function parseStockAdjustmentHtml(html: string): StockAdjustmentPage {
  const rows: StockAdjustmentRow[] = [];
  const trBlocks = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  for (const tr of trBlocks) {
    if (/<th[\s>]/i.test(tr)) continue;
    const cells = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) =>
      stripTags(m[1] ?? "").trim(),
    );
    if (cells.length < 4) continue;
    rows.push({
      date: cells[0] ?? "",
      productName: cells[1] ?? "",
      productType: cells[2] ?? "",
      outlet: cells[3] ?? "",
      adjustment: cells[4] ?? "",
      notes: cells[5] ?? "",
    });
  }
  return { rows: rows.filter((r) => r.productName.length > 0 || r.date.length > 0) };
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
