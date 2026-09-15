import { describe, expect, it } from "vitest";
import {
  buildCoverageManifest,
  coverageSummary,
} from "../../src/registry/coverage";
import {
  getOperation,
  listExposedOperations,
  listMutationOperations,
  listReadOperations,
} from "../../src/registry/operations";
import { buildOpenApiDocument, buildOperationCatalog } from "../../src/registry/openapi";
import { MAX_PAGE_SIZE } from "../../src/registry/ops/helpers";

describe("operation registry", () => {
  it("exposes only documented executable ops", () => {
    const ops = listExposedOperations();
    expect(ops.length).toBeGreaterThan(30);
    expect(getOperation("products.list")?.safety).toBe("read");
    expect(getOperation("purchases.cancel")?.safety).toBe("destructive");
  });

  it("classifies reads vs mutations", () => {
    expect(listReadOperations().every((o) => o.safety === "read")).toBe(true);
    expect(
      listMutationOperations().every(
        (o) => o.safety === "write" || o.safety === "destructive",
      ),
    ).toBe(true);
  });

  it("treats bulk stock adjustment as destructive (stock may be an absolute overwrite)", () => {
    expect(getOperation("products.inventories.bulk")?.safety).toBe("destructive");
    expect(getOperation("purchases.confirmation")?.safety).toBe("write");
  });

  it("does not expose dashboard chrome menu access", () => {
    expect(getOperation("account.menuAccess")).toBeUndefined();
  });

  it("types users.access as the integer access type from users.md", () => {
    expect(getOperation("users.list")?.inputSchema.properties?.access?.type).toBe("integer");
  });

  it("bounds page size and page index", () => {
    const products = getOperation("products.list")?.inputSchema.properties;
    expect(products?.count).toMatchObject({ type: "integer", minimum: 1, maximum: MAX_PAGE_SIZE });
    expect(products?.page).toMatchObject({ type: "integer", minimum: 1 });
    expect(MAX_PAGE_SIZE).toBe(100);
  });

  it("generates OpenAPI without secrets", () => {
    const doc = buildOpenApiDocument("example-merchant");
    const raw = JSON.stringify(doc);
    expect(raw).not.toMatch(/Bearer [A-Za-z0-9]{20,}/);
    expect(raw).not.toContain("qasir_sess=");
    expect(doc.openapi).toBe("3.1.0");
    const catalog = buildOperationCatalog();
    expect(catalog.find((c) => c.operationId === "products.list")).toBeTruthy();
  });

  it("coverage manifest includes exclusions for failed probes", () => {
    const m = buildCoverageManifest();
    const excluded = m.filter((e) => e.status === "excluded");
    expect(excluded.some((e) => e.path.includes("reports/sales/total"))).toBe(
      true,
    );
    expect(excluded.some((e) => e.path.includes("/api/v5/suppliers"))).toBe(
      true,
    );
    const summary = coverageSummary();
    expect(summary.total).toBe(m.length);
    expect(summary.implemented + summary.htmlAdapter).toBeGreaterThan(20);
  });
});
