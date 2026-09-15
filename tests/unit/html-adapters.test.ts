import { describe, expect, it } from "vitest";
import { parseStockAdjustmentHtml } from "../../src/html/stock-adjustment";
import { parseSuppliersHtml } from "../../src/html/suppliers";
import { decodeEntities, looksLikeLoginPage } from "../../src/html/text";
import { ErrorCodes } from "../../src/errors/codes";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const fixtures = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures",
);
const fixture = (name: string) => readFileSync(path.join(fixtures, name), "utf8");

describe("html adapters", () => {
  it("parses suppliers fixture", () => {
    const page = parseSuppliersHtml(fixture("suppliers.html"));
    expect(page.rows).toHaveLength(2);
    expect(page.rows[0]).toEqual({
      id: "52887",
      name: "MAXCOOL INDONESIA",
      phone: "021",
      address: "Jl A",
      city: "Kota Depok",
    });
    expect(page.rows[1]?.id).toBe("49826");
    expect(page.pageHint).toBe(1);
    expect(page.hasNext).toBe(true);
  });

  it("takes supplier ids from each row's own link, never by global order", () => {
    const page = parseSuppliersHtml(fixture("suppliers-edge.html"));
    expect(page.rows.map((r) => [r.name.slice(0, 12), r.id])).toEqual([
      ["TOKO BU'ANI ", "60001"], // delete link only
      ["MAXCOOL INDO", "52887"],
      ["NO LINK SUPP", null],
      ["GUDANG SPARE", "49826"],
    ]);
  });

  it("decodes Blade-escaped entities in supplier cells", () => {
    const page = parseSuppliersHtml(fixture("suppliers-edge.html"));
    expect(page.rows[0]?.name).toBe(`TOKO BU'ANI "JAYA" & Sons <b>`);
    expect(page.rows[0]?.address).toBe("Jl C");
  });

  it("reads pageHint from the active pagination item, not the Prev link", () => {
    const page = parseSuppliersHtml(fixture("suppliers-edge.html"));
    expect(page.pageHint).toBe(2);
    expect(page.hasNext).toBe(false);
  });

  it("falls back to the requested page when there is no pagination", () => {
    const html = "<title>Supplier</title><table><tr><th>Nama Supplier</th><th>Kota</th></tr></table>";
    expect(parseSuppliersHtml(html, { requestedPage: 7 })).toEqual({
      rows: [],
      pageHint: 7,
      hasNext: false,
    });
  });

  it("parses stock adjustment fixture with header-mapped columns", () => {
    const page = parseStockAdjustmentHtml(fixture("stock-adjustment.html"));
    expect(page.rows).toHaveLength(2);
    expect(page.rows[0]).toEqual({
      date: "2026-09-01",
      productName: "FILTER UDARA",
      productType: "Produk",
      outlet: "Toko Manuju Jaya",
      adjustment: "+2",
      notes: "opname",
    });
    expect(page.rows[1]?.productName).toBe('OLI "MESIN" 1&2');
    expect(page.rows[1]?.notes).toBe("rusak 'bocor'");
  });

  it("login page is QASIR_AUTH_EXPIRED for both adapters, never empty rows", () => {
    const html = fixture("login-page.html");
    expect(looksLikeLoginPage(html)).toBe(true);
    expect(() => parseSuppliersHtml(html)).toThrow(
      expect.objectContaining({ code: ErrorCodes.QASIR_AUTH_EXPIRED }),
    );
    expect(() => parseStockAdjustmentHtml(html)).toThrow(
      expect.objectContaining({ code: ErrorCodes.QASIR_AUTH_EXPIRED }),
    );
  });

  it("bare or unrelated pages are UPSTREAM_ERROR", () => {
    for (const html of ["<html>login</html>", "<html><title>Maintenance</title></html>", ""]) {
      expect(() => parseSuppliersHtml(html)).toThrow(
        expect.objectContaining({ code: ErrorCodes.UPSTREAM_ERROR }),
      );
      expect(() => parseStockAdjustmentHtml(html)).toThrow(
        expect.objectContaining({ code: ErrorCodes.UPSTREAM_ERROR }),
      );
    }
  });

  it("real dashboard pages are not mistaken for login pages", () => {
    expect(looksLikeLoginPage(fixture("suppliers.html"))).toBe(false);
    expect(looksLikeLoginPage(fixture("stock-adjustment.html"))).toBe(false);
    expect(looksLikeLoginPage("<title>Barang Masuk</title>")).toBe(false);
    expect(looksLikeLoginPage("<title>Sign in - Qasir</title>")).toBe(true);
  });

  it("decodeEntities is single-pass and leaves invalid references alone", () => {
    expect(decodeEntities("&amp;lt;")).toBe("&lt;");
    expect(decodeEntities("&#39;&#x27;&apos;&quot;")).toBe(`'''"`);
    expect(decodeEntities("&#0; &#xD800; &bogus;")).toBe("&#0; &#xD800; &bogus;");
  });
});
