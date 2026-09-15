import { describe, expect, it } from "vitest";
import { parseStockAdjustmentHtml } from "../../src/html/stock-adjustment";
import { parseSuppliersHtml } from "../../src/html/suppliers";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const fixtures = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures",
);

describe("html adapters", () => {
  it("parses suppliers fixture", () => {
    const html = readFileSync(path.join(fixtures, "suppliers.html"), "utf8");
    const page = parseSuppliersHtml(html);
    expect(page.rows.length).toBeGreaterThanOrEqual(2);
    expect(page.rows[0]?.name).toContain("MAXCOOL");
    expect(page.rows[0]?.id).toBe("52887");
  });

  it("parses stock adjustment fixture", () => {
    const html = readFileSync(
      path.join(fixtures, "stock-adjustment.html"),
      "utf8",
    );
    const page = parseStockAdjustmentHtml(html);
    expect(page.rows.length).toBeGreaterThanOrEqual(1);
    expect(page.rows[0]?.productName.length).toBeGreaterThan(0);
  });
});
