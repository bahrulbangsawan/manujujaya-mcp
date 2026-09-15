import { describe, expect, it } from "vitest";
import { runCodemode } from "../../src/codemode/run";
import { createSpecBundle } from "../../src/codemode/spec";
import type { DispatchRequest } from "../../src/dispatcher/qasir-dispatcher";
import { AppError, ErrorCodes } from "../../src/errors/codes";
import { createFakeDispatcher, MERCHANT_SLUG, type FixtureHandler } from "../stubs/codemode-harness";
import { createFakeWorkerLoader } from "../stubs/fake-worker-loader";

/**
 * The 10 Code Mode eval scenarios, run offline: model-style scripts go through
 * the real runCodemode + sandbox wiring, the dispatcher answers from fixtures
 * (inputs are still validated against the real operation registry).
 */
const spec = createSpecBundle(MERCHANT_SLUG);

const PRODUCTS = Array.from({ length: 45 }, (_, i) => ({ id: String(20562593 + i), name: `Part ${i + 1}`, total_stock: i % 7 }));
const PURCHASES = [
  { id: "1147217", order_no: "PO-1", supplier_name: "JNM", status: "completed", total_price: 1632000 },
  { id: "1147218", order_no: "PO-2", supplier_name: "MAXCOOL", status: "order_processed", total_price: 250000 },
  { id: "1147219", order_no: "PO-3", supplier_name: "GUDANG", status: "order_processed", total_price: 90000 },
  { id: "1147220", order_no: "PO-4", supplier_name: "JNM", status: "cancelled", total_price: 10000 },
  { id: "1147221", order_no: "PO-5", supplier_name: "TOKO", status: "order_processed", total_price: 5000 },
];

function page<T>(rows: T[], req: DispatchRequest, key: string) {
  const pageNo = Number(req.query?.page ?? 1);
  const count = Number(req.query?.count ?? 25);
  const slice = rows.slice((pageNo - 1) * count, pageNo * count);
  return {
    code: 200,
    message: "Berhasil",
    data: { [key]: slice },
    pagination: { current_page: pageNo, page_size: count, total_page: Math.ceil(rows.length / count), total_result: rows.length },
  };
}

const fixtures: Record<string, FixtureHandler> = {
  "products.list": (req) => page(PRODUCTS, req, "products"),
  "purchases.list": (req) => page(PURCHASES, req, "purchases"),
  "reports.summaries.sales": (req) => ({
    code: 200,
    data: {
      start_date: req.query?.start_date,
      end_date: req.query?.end_date,
      gross_sales: 15_750_000,
      discounts: 250_000,
      net_sales: 15_500_000,
      transactions: 128,
    },
  }),
  "inventories.stockHistories": (req) => ({
    code: 200,
    data: {
      inventory_id: req.path?.inventory_id,
      histories: [
        { created_at: "2026-09-01", type: "purchase", quantity: 10 },
        { created_at: "2026-09-03", type: "sales", quantity: -3, sales_id: "S-1" },
        { created_at: "2026-09-05", type: "adjustment", quantity: -1 },
        { created_at: "2026-09-07", type: "sales", quantity: -2, sales_id: "S-2" },
      ],
    },
  }),
  "suppliers.listHtml": () => ({
    rows: [
      { id: 52887, name: "TOKO BU ANI", phone: "<PHONE>", location: "Jambi" },
      { id: 49826, name: "MAXCOOL", phone: "<PHONE>", location: "Jakarta" },
    ],
    pageHint: 1,
  }),
  "customers.get": (req) => ({
    code: 200,
    data: { id: String(req.path?.customer_id), fullname: "Sample Customer", mobile: "<PHONE>", total_transaction: 7 },
  }),
};

function execute(code: string) {
  const dispatcher = createFakeDispatcher(fixtures);
  const run = runCodemode({ loader: createFakeWorkerLoader(), code, mode: "execute", spec, dispatcher });
  return { dispatcher, run };
}

async function json(p: Promise<string>): Promise<unknown> {
  return JSON.parse(await p);
}

async function rejection(p: Promise<unknown>): Promise<AppError> {
  const err = await p.then(
    () => {
      throw new Error("expected rejection");
    },
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(AppError);
  return err as AppError;
}

describe("Code Mode eval scenarios", () => {
  it("1. finds product operations via search", async () => {
    const out = await json(
      runCodemode({
        loader: createFakeWorkerLoader(),
        mode: "search",
        spec,
        code: `async () => {
          const { catalog } = await codemode.spec();
          return catalog.filter(o => o.tags.includes('products') && o.safety === 'read').map(o => ({ id: o.operationId, inputs: o.inputKeys }));
        }`,
      }),
    );
    expect(out).toEqual(expect.arrayContaining([{ id: "products.list", inputs: ["page", "count", "name"] }]));
    expect((out as Array<{ id: string }>).some((o) => o.id === "products.inventories.bulk")).toBe(false);
  });

  it("2. paginates products.list to count every item", async () => {
    const { run, dispatcher } = execute(`async () => {
      let pageNo = 1, total = 0, stocked = 0;
      while (true) {
        const r = await codemode.request({ operationId: 'products.list', query: { page: pageNo, count: 20 } });
        const rows = r.data.data.products;
        total += rows.length;
        stocked += rows.filter(p => p.total_stock > 0).length;
        if (pageNo >= r.data.pagination.total_page) break;
        pageNo++;
      }
      return { total, stocked, pages: pageNo };
    }`);
    expect(await json(run)).toEqual({ total: 45, stocked: 38, pages: 3 });
    expect(dispatcher.calls.map((c) => c.req.query?.page)).toEqual([1, 2, 3]);
  });

  it("3. summarizes sales for a date range", async () => {
    const { run, dispatcher } = execute(`async () => {
      const r = await codemode.request({ operationId: 'reports.summaries.sales', query: { start_date: '2026-09-01', end_date: '2026-09-07', outlet_ids: '645203' } });
      const d = r.data.data;
      return { range: d.start_date + '..' + d.end_date, net: d.net_sales, avgTicket: Math.round(d.net_sales / d.transactions) };
    }`);
    expect(await json(run)).toEqual({ range: "2026-09-01..2026-09-07", net: 15_500_000, avgTicket: 121_094 });
    expect(dispatcher.calls[0]!.req.query).toMatchObject({ start_date: "2026-09-01", end_date: "2026-09-07" });
  });

  it("4. traces stock histories for an inventory id with a running balance", async () => {
    const { run, dispatcher } = execute(`async () => {
      const r = await codemode.request({
        operationId: 'inventories.stockHistories',
        path: { inventory_id: 25950360 },
        query: { page: 1, count: 50, outlet_ids: '645203', type: 'all' },
      });
      let balance = 0;
      return r.data.data.histories.map(h => ({ date: h.created_at, type: h.type, balance: (balance += h.quantity) }));
    }`);
    const out = (await json(run)) as Array<{ balance: number; type: string }>;
    expect(out.map((h) => h.balance)).toEqual([10, 7, 6, 4]);
    expect(dispatcher.calls[0]!.req.path).toEqual({ inventory_id: 25950360 });
  });

  it("5. lists open purchase orders across pages", async () => {
    const { run } = execute(`async () => {
      const open = [];
      for (let pageNo = 1; ; pageNo++) {
        const r = await codemode.request({ operationId: 'purchases.list', query: { page: pageNo, count: 2 } });
        open.push(...r.data.data.purchases.filter(p => p.status === 'order_processed').map(p => p.order_no));
        if (pageNo >= r.data.pagination.total_page) break;
      }
      return open;
    }`);
    expect(await json(run)).toEqual(["PO-2", "PO-3", "PO-5"]);
  });

  it("6. reads the supplier list from the HTML adapter", async () => {
    const { run } = execute(`async () => {
      const r = await codemode.request({ operationId: 'suppliers.listHtml', query: { page: 1 } });
      return r.data.rows.map(s => s.id + ':' + s.name);
    }`);
    expect(await json(run)).toEqual(["52887:TOKO BU ANI", "49826:MAXCOOL"]);
  });

  it("7. looks up a customer by id", async () => {
    const { run } = execute(`async () => {
      const r = await codemode.request({ operationId: 'customers.get', path: { customer_id: 5512 } });
      return { name: r.data.data.fullname, transactions: r.data.data.total_transaction };
    }`);
    expect(await json(run)).toEqual({ name: "Sample Customer", transactions: 7 });
  });

  it("8. blocks a write attempted from execute", async () => {
    const { run, dispatcher } = execute(`async () => codemode.request({ operationId: 'purchases.cancel', path: { id: '1147218' } })`);
    const err = await rejection(run);
    expect(err.code).toBe(ErrorCodes.MUTATION_DISABLED);
    expect(err.message).toMatch(/writes are disabled on this server/);
    expect(dispatcher.calls).toHaveLength(0);
  });

  it("9. blocks direct fetch to the Qasir API", async () => {
    const { run, dispatcher } = execute(`async () => {
      const res = await fetch('https://pos.qasir.id/api/v5/products?page=1&count=5');
      return res.json();
    }`);
    const err = await rejection(run);
    expect(err.code).toBe(ErrorCodes.INVALID_INPUT);
    expect(err.message).toMatch(/not permitted/);
    expect(dispatcher.calls).toHaveLength(0);
  });

  it("10. stops an over-broad fan-out with RESULT_LIMIT_EXCEEDED", async () => {
    const { run, dispatcher } = execute(`async () => {
      const pages = await Promise.all(Array.from({ length: 323 }, (_, i) =>
        codemode.request({ operationId: 'products.list', query: { page: i + 1, count: 25 } })));
      return pages.length;
    }`);
    const err = await rejection(run);
    expect(err.code).toBe(ErrorCodes.RESULT_LIMIT_EXCEEDED);
    expect(dispatcher.calls.length).toBeLessThanOrEqual(50);
  });
});
