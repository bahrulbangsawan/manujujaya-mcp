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
