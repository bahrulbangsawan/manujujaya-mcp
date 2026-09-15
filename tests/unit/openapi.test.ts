import { describe, expect, it } from "vitest";
import { checkOpenApi } from "../../src/registry/checks";
import { buildOpenApiDocument, hostBaseUrl } from "../../src/registry/openapi";
import { OPERATIONS, listExposedOperations } from "../../src/registry/operations";
import type { ApiOperation } from "../../src/registry/types";

const SLUG = "example-merchant-000000";

interface OpenApiOp {
  operationId: string;
  servers?: Array<{ url: string; description?: string }>;
}
type Paths = Record<string, Record<string, OpenApiOp>>;

function build(operations?: ApiOperation[]): { doc: Record<string, unknown>; paths: Paths } {
  const doc = buildOpenApiDocument(SLUG, operations);
  return { doc, paths: doc.paths as Paths };
}

describe("OpenAPI document", () => {
  it("passes the shared drift checks", () => {
    const { doc } = build();
    expect(checkOpenApi({ document: doc, operations: OPERATIONS, merchantSlug: SLUG })).toEqual([]);
  });

  it("binds every operation to exactly one server for its own host", () => {
    const { doc, paths } = build();
    expect(doc.servers).toBeUndefined();
    for (const op of listExposedOperations()) {
      const entry = paths[op.pathTemplate]?.[op.method.toLowerCase()];
      expect(entry?.operationId).toBe(op.operationId);
      expect(entry?.servers, op.operationId).toEqual([
        { url: hostBaseUrl(op.host, SLUG), description: op.host },
      ]);
    }
  });

  it("resolves hosts that differ from pos to their real origins", () => {
    const { paths } = build();
    expect(paths["/api/v5/order/histories/web"]?.get?.servers?.[0]?.url).toBe("https://order.qasir.id");
    expect(paths["/api/v1/payments/pending"]?.get?.servers?.[0]?.url).toBe("https://payment.qasir.id");
    expect(paths["/suppliers"]?.get?.servers?.[0]?.url).toBe(`https://${SLUG}.qasir.id`);
    expect(paths["/ajax/purchase/cancel/{id}"]?.get?.servers?.[0]?.url).toBe(`https://${SLUG}.qasir.id`);
  });

  it("throws instead of silently overwriting a cross-host path collision", () => {
    const base = OPERATIONS.find((o) => o.operationId === "products.list");
    if (!base) throw new Error("products.list missing");
    const collide: ApiOperation = { ...base, operationId: "merchant.products.collide", host: "merchant" };
    expect(() => build([...listExposedOperations(), collide])).toThrow(
      /collision: GET \/api\/v5\/products used by products.list and merchant.products.collide/,
    );
  });

  it("detects operationId drift, missing servers and credentials", () => {
    const { doc, paths } = build();
    const products = paths["/api/v5/products"]?.get;
    if (!products) throw new Error("products path missing");
    products.operationId = "something.else";
    delete products.servers;
    (doc.info as Record<string, unknown>).description = "Bearer abcdefghijklmnopqrstuvwxyz";
    const problems = checkOpenApi({ document: doc, operations: OPERATIONS, merchantSlug: SLUG });
    expect(problems).toContain("GET /api/v5/products is something.else, expected products.list");
    expect(problems).toContain("products.list: servers must be exactly [https://pos.qasir.id]");
    expect(problems).toContain("OpenAPI appears to contain credentials");
  });

  it("detects operations missing from the document", () => {
    const { doc } = build(listExposedOperations().filter((o) => o.operationId !== "users.list"));
    const problems = checkOpenApi({ document: doc, operations: OPERATIONS, merchantSlug: SLUG });
    expect(problems).toContain("users.list: missing GET /api/v5/users");
  });

  it("declares templated path params as required in:path", () => {
    const { paths } = build();
    const legacy = paths["/api/v5/order/histories/{sales_id}/legacy"]?.get as unknown as {
      parameters: Array<{ name: string; in: string; required: boolean }>;
    };
    expect(legacy.parameters).toContainEqual(
      expect.objectContaining({ name: "sales_id", in: "path", required: true }),
    );
  });
});
