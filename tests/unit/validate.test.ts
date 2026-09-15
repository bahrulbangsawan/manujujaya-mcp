import { describe, expect, it } from "vitest";
import { AppError, ErrorCodes } from "../../src/errors/codes";
import { getOperation, OPERATIONS } from "../../src/registry/operations";
import type { ApiOperation } from "../../src/registry/types";
import {
  pathParamNames,
  validateOperationInput,
  type OperationInput,
} from "../../src/registry/validate";

function op(id: string): ApiOperation {
  const found = getOperation(id);
  if (!found) throw new Error(`missing op ${id}`);
  return found;
}

function invalid(id: string, input: OperationInput): AppError {
  try {
    validateOperationInput(op(id), input);
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe(ErrorCodes.INVALID_INPUT);
    return err as AppError;
  }
  throw new Error(`expected INVALID_INPUT for ${id}`);
}

describe("validateOperationInput — doc-derived constraints (REG-1)", () => {
  it("rejects outlet_ids on products.list (products.md: returns 500)", () => {
    const err = invalid("products.list", {
      query: { page: 1, count: 10, outlet_ids: "645203" },
    });
    expect(err.message).toContain("unknown: outlet_ids");
    expect(err.message).toContain("allowed: page, count, name");
  });

  it("requires outlet_id on purchases.items (purchases.md:138)", () => {
    const err = invalid("purchases.items", { path: { purchase_id: "1147217" } });
    expect(err.message).toContain("missing required: outlet_id");
  });

  it("requires count, outlet_ids and type on inventories.stockHistories", () => {
    const err = invalid("inventories.stockHistories", {
      path: { inventory_id: 25950360 },
      query: { page: 1 },
    });
    expect(err.details).toMatchObject({
      missing: expect.arrayContaining(["count", "outlet_ids", "type"]),
    });
  });

  it("rejects start_date on reports.merchants.visits (uses date_from/date_to)", () => {
    const err = invalid("reports.merchants.visits", {
      query: { start_date: "2026-09-01", end_date: "2026-09-02" },
    });
    expect(err.message).toContain("missing required: date_from, date_to");
    expect(err.message).toContain("unknown: start_date, end_date");
  });

  it("requires start_date/end_date/outlet_ids on order.histories.web", () => {
    const err = invalid("order.histories.web", { query: { page: 1, count: 10 } });
    expect(err.details).toMatchObject({
      missing: ["start_date", "end_date", "outlet_ids"],
    });
  });

  it("requires sort on inventories.stockTurnover", () => {
    const err = invalid("inventories.stockTurnover", {
      query: { outlet_ids: "645203", page: 1, count: 5 },
    });
    expect(err.message).toContain("missing required: sort");
  });

  it("requires sort on reports.products (upstream panics with 500 without it)", () => {
    const err = invalid("reports.products", {
      query: { page: 1, count: 5, start_date: "2026-08-16", end_date: "2026-09-15", outlet_ids: "645203" },
    });
    expect(err.message).toContain("missing required: sort");
    expect(() =>
      validateOperationInput(op("reports.products"), {
        query: { page: 1, count: 5, start_date: "2026-08-16", end_date: "2026-09-15", outlet_ids: "645203", sort: "-quantity" },
      }),
    ).not.toThrow();
  });

  it("requires trend_type sales|profit on reports.sales.trend", () => {
    const range = { start_date: "2026-08-16", end_date: "2026-09-15", outlet_ids: "645203" };
    expect(invalid("reports.sales.trend", { query: range }).message).toContain("missing required: trend_type");
    expect(invalid("reports.sales.trend", { query: { ...range, trend_type: "daily" } }).message).toContain(
      'must be one of "sales", "profit"',
    );
    expect(() =>
      validateOperationInput(op("reports.sales.trend"), {
        query: { ...range, trend_type: "sales", comparison_start_date: "2026-07-16", comparison_end_date: "2026-08-15" },
      }),
    ).not.toThrow();
  });

  it("documents the RFC3339 date_from/date_to format on microsite visit reports", () => {
    for (const id of ["reports.merchants.visits", "reports.merchants.visitTrending"]) {
      const props = op(id).inputSchema.properties!;
      expect(props.date_from!.description, id).toContain("RFC3339");
      expect(props.date_to!.description, id).toContain("RFC3339");
    }
  });
});

describe("validateOperationInput — types, coercion and bounds", () => {
  it("accepts a valid read and coerces numeric strings for integer fields", () => {
    expect(
      validateOperationInput(op("products.list"), {
        query: { page: "2" as unknown as number, count: "10" as unknown as number },
      }),
    ).toEqual({ path: {}, query: { page: 2, count: 10 } });
  });

  it("stringifies numbers for string fields (lossless on the wire)", () => {
    const out = validateOperationInput(op("inventories.stockTurnover"), {
      query: { outlet_ids: 645203, page: 1, count: 5, sort: "created_at" },
    });
    expect(out.query.outlet_ids).toBe("645203");
  });

  it("rejects non-numeric integers, nested objects and arrays in query", () => {
    const err = invalid("products.list", {
      query: {
        page: "one",
        count: { a: 1 } as unknown as number,
        name: ["x"] as unknown as string,
      },
    });
    expect(err.message).toContain("page: expected integer, got string");
    expect(err.message).toContain("count: query values must be strings, numbers or booleans");
    expect(err.message).toContain("name: query values must be strings, numbers or booleans");
  });

  it("caps count at 100 and requires page/count >= 1 on products.list", () => {
    expect(invalid("products.list", { query: { page: 1, count: 1_000_000 } }).message).toContain(
      "count: must be <= 100",
    );
    expect(invalid("products.list", { query: { page: 0, count: 5 } }).message).toContain(
      "page: must be >= 1",
    );
    expect(
      validateOperationInput(op("products.list"), { query: { page: 1, count: 100 } }).query,
    ).toEqual({ page: 1, count: 100 });
  });

  it("defaults count|limit|per_page to maximum 100 when the schema has none", () => {
    const bare: ApiOperation = {
      ...op("products.list"),
      inputSchema: {
        type: "object",
        properties: {
          page: { type: "integer" },
          count: { type: "integer" },
          limit: { type: "integer" },
          per_page: { type: "integer" },
          other: { type: "integer" },
        },
        additionalProperties: false,
      },
    };
    for (const key of ["count", "limit", "per_page"]) {
      expect(() => validateOperationInput(bare, { query: { [key]: 101 } })).toThrow(
        `${key}: must be <= 100`,
      );
    }
    expect(() => validateOperationInput(bare, { query: { page: 0 } })).toThrow("page: must be >= 1");
    expect(validateOperationInput(bare, { query: { other: 5000, page: 9999 } }).query).toEqual({
      other: 5000,
      page: 9999,
    });
  });

  it("honours schema minimum/maximum/enum when present", () => {
    const custom: ApiOperation = {
      ...op("products.list"),
      inputSchema: {
        type: "object",
        properties: {
          count: { type: "integer", maximum: 500 },
          sort: { type: "string", enum: ["asc", "desc"] },
          ratio: { type: "number", minimum: 0.5 },
        },
        additionalProperties: false,
      },
    };
    expect(validateOperationInput(custom, { query: { count: 400 } }).query).toEqual({ count: 400 });
    expect(() => validateOperationInput(custom, { query: { count: 501 } })).toThrow("<= 500");
    expect(() => validateOperationInput(custom, { query: { sort: "up" } })).toThrow(
      'must be one of "asc", "desc"',
    );
    expect(() => validateOperationInput(custom, { query: { ratio: 0.1 } })).toThrow(">= 0.5");
  });

  it("drops undefined/null query values as not provided", () => {
    const out = validateOperationInput(op("products.list"), {
      query: { page: 1, count: 5, name: undefined as unknown as string },
    });
    expect(out.query).toEqual({ page: 1, count: 5 });
  });

  it("rejects over-long strings", () => {
    const err = invalid("products.searchAjax", { query: { name: "x".repeat(2001) } });
    expect(err.message).toContain("longer than 2000");
  });
});

describe("validateOperationInput — path params", () => {
  it("integer path params must be plain digit ids", () => {
    for (const bad of [".", "..", "-1", "1.5", "12a", "%2e", "1/2", " 1", "123456789012345678901"]) {
      const err = invalid("customers.get", { path: { customer_id: bad } });
      expect(err.message).toContain("customer_id: expected a non-negative integer id");
    }
    expect(
      validateOperationInput(op("customers.get"), { path: { customer_id: "42" } }).path,
    ).toEqual({ customer_id: 42 });
  });

  it("keeps huge or zero-padded integer ids as exact strings", () => {
    expect(
      validateOperationInput(op("customers.get"), { path: { customer_id: "0042" } }).path,
    ).toEqual({ customer_id: "0042" });
    expect(
      validateOperationInput(op("customers.get"), { path: { customer_id: "12345678901234567890" } })
        .path,
    ).toEqual({ customer_id: "12345678901234567890" });
  });

  it("string path params are restricted to a safe segment charset", () => {
    const stringPath: ApiOperation = {
      ...op("customers.get"),
      pathTemplate: "/api/v5/things/{id}",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
      },
    };
    for (const bad of [".", "..", "a.b", "a/b", "a%2Fb", "x".repeat(65), "a?b", "a\\b", ""]) {
      expect(() => validateOperationInput(stringPath, { path: { id: bad } })).toThrow(
        /id: path params may only contain/,
      );
    }
    expect(validateOperationInput(stringPath, { path: { id: "abc_12-3" } }).path).toEqual({
      id: "abc_12-3",
    });
  });

  it("missing path params and unknown path keys are reported", () => {
    const err = invalid("customers.get", { path: { nope: 1 } });
    expect(err.details).toMatchObject({ missing: ["customer_id"], unknown: ["path.nope"] });
  });

  it("tolerates a path param given in query, but not conflicting values", () => {
    expect(
      validateOperationInput(op("customers.get"), { query: { customer_id: 7 } }),
    ).toEqual({ path: { customer_id: 7 }, query: {} });
    const err = invalid("customers.get", { path: { customer_id: 7 }, query: { customer_id: 8 } });
    expect(err.message).toContain("given in both path and query");
  });
});

describe("validateOperationInput — bodies", () => {
  it("rejects a body on GET operations", () => {
    const err = invalid("products.list", { query: { page: 1, count: 5 }, body: { x: 1 } });
    expect(err.message).toContain("unknown: body");
  });

  it("validates mutation bodies recursively and coerces item integers", () => {
    const out = validateOperationInput(op("products.inventories.bulk"), {
      body: {
        data: [{ variant_id: "11", product_id: 22, outlet_id: 645203, stock: 3, track_stock: true }],
      },
    });
    expect(out.body).toEqual({
      data: [{ variant_id: 11, product_id: 22, outlet_id: 645203, stock: 3, track_stock: true }],
    });
  });

  it("reports missing, unknown and mistyped body fields and query on body ops", () => {
    const err = invalid("purchases.confirmation", {
      query: { page: 1 },
      body: { purchase_id: 1147217, items: "nope", extra: true },
    });
    expect(err.details).toMatchObject({
      missing: ["body.outlet_id"],
      unknown: ["query.page", "body.extra"],
      invalid: ["body.items: expected array, got string"],
    });
  });

  it("requires body fields when the body is absent", () => {
    const err = invalid("products.inventories.bulk", {});
    expect(err.details).toMatchObject({ missing: ["body.data"] });
  });
});

describe("registry schemas are all supported by the validator", () => {
  it("every templated path param is declared in the op input schema", () => {
    for (const o of OPERATIONS) {
      for (const name of pathParamNames(o.pathTemplate)) {
        expect(o.inputSchema.properties?.[name], `${o.operationId}.${name}`).toBeDefined();
      }
    }
  });
});
