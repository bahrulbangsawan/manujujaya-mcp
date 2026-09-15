import { describe, expect, it, vi } from "vitest";
import { QasirDispatcher } from "../../src/dispatcher/qasir-dispatcher";
import { AppError, ErrorCodes } from "../../src/errors/codes";
import type { QasirSessionProvider } from "../../src/session/types";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const TOKEN = "test-token-not-real";
const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");
const fixture = (name: string) => readFileSync(path.join(fixtures, name), "utf8");

function mockSession() {
  const markExpired = vi.fn(async (_failedApiToken?: string) => undefined);
  const getSession = vi.fn(async () => ({
    merchantSlug: "bengkel-manuju-jaya-621095",
    merchantOrigin: "https://bengkel-manuju-jaya-621095.qasir.id",
    defaultOutletId: "645203",
    secrets: {
      apiToken: TOKEN,
      csrfToken: "csrf-test",
      cookie: "qasir_sess=abc; XSRF-TOKEN=xyz",
    },
  }));
  const sessions: QasirSessionProvider = { markExpired, getSession };
  return { sessions, markExpired, getSession };
}

type FetchArgs = [string | URL | Request, RequestInit?];

function respondWith(make: () => Response) {
  return vi.fn(async (..._args: FetchArgs) => make());
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function dispatcher(fetchImpl: ReturnType<typeof vi.fn>, opts: { mutationsEnabled?: boolean } = {}) {
  const s = mockSession();
  const d = new QasirDispatcher({
    sessions: s.sessions,
    mutationsEnabled: opts.mutationsEnabled,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return { d, ...s };
}

function sentHeaders(fetchImpl: ReturnType<typeof vi.fn>, call = 0): Headers {
  return (fetchImpl.mock.calls[call]![1] as RequestInit).headers as Headers;
}

describe("dispatcher", () => {
  it("rejects unknown operation", async () => {
    const { d } = dispatcher(vi.fn());
    await expect(d.dispatch({ operationId: "nope" })).rejects.toMatchObject({
      code: ErrorCodes.UNSUPPORTED_OPERATION,
    });
  });

  it("blocks mutations when disabled", async () => {
    const fetchImpl = vi.fn();
    const { d } = dispatcher(fetchImpl, { mutationsEnabled: false });
    const req = { operationId: "products.inventories.bulk", body: { data: [] } };
    await expect(d.dispatch(req)).rejects.toBeInstanceOf(AppError);
    await expect(d.dispatch(req, { allowMutation: true })).rejects.toMatchObject({
      code: ErrorCodes.MUTATION_DISABLED,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("requires opts.allowMutation === true even when mutations are enabled", async () => {
    const fetchImpl = respondWith(() => json({ code: 200 }));
    const { d } = dispatcher(fetchImpl, { mutationsEnabled: true });
    const req = {
      operationId: "purchases.confirmation",
      body: { purchase_id: "1147217", outlet_id: 645203, items: [] },
    };
    await expect(d.dispatch(req)).rejects.toMatchObject({ code: ErrorCodes.MUTATION_DISABLED });
    await expect(d.dispatch(req, { allowMutation: false })).rejects.toMatchObject({
      code: ErrorCodes.MUTATION_DISABLED,
    });
    expect(fetchImpl).not.toHaveBeenCalled();

    const result = await d.dispatch(req, { allowMutation: true });
    expect(result.status).toBe(200);
    const init = fetchImpl.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual(req.body);
    expect(sentHeaders(fetchImpl).get("content-type")).toBe("application/json");
  });

  it("dispatches allowlisted read with bearer", async () => {
    const fetchImpl = respondWith(() => json({ code: 200, data: { products: [] } }));
    const { d } = dispatcher(fetchImpl);
    const result = await d.dispatch({
      operationId: "products.list",
      query: { page: 1, count: 5 },
    });
    expect(result).toEqual({
      operationId: "products.list",
      status: 200,
      data: { code: 200, data: { products: [] } },
    });
    expect(String(fetchImpl.mock.calls[0]![0])).toBe(
      "https://pos.qasir.id/api/v5/products?page=1&count=5",
    );
    const h = sentHeaders(fetchImpl);
    expect(h.get("authorization")).toBe(`Bearer ${TOKEN}`);
    expect(h.get("cookie")).toBeNull();
    expect(h.get("x-requested-with")).toBeNull();
  });

  it("uses raw token for stock histories", async () => {
    const fetchImpl = respondWith(() => json({ code: 200, data: { stock_histories: [] } }));
    const { d } = dispatcher(fetchImpl);
    await d.dispatch({
      operationId: "inventories.stockHistories",
      path: { inventory_id: 25950360 },
      query: { page: 1, count: 10, outlet_ids: "645203", type: "sales,refund" },
    });
    expect(String(fetchImpl.mock.calls[0]![0])).toBe(
      "https://pos.qasir.id/api/v5/inventories/25950360/stock-histories?page=1&count=10&outlet_ids=645203&type=sales%2Crefund",
    );
    expect(sentHeaders(fetchImpl).get("authorization")).toBe(TOKEN);
  });
});

describe("dispatcher input validation (DISP-05, DISP-07)", () => {
  it("rejects unknown, oversized and nested query params before any session or fetch", async () => {
    const fetchImpl = vi.fn();
    const { d, getSession } = dispatcher(fetchImpl);
    await expect(
      d.dispatch({
        operationId: "products.list",
        query: {
          page: 1,
          count: 1_000_000,
          outlet_ids: 645203,
          anything: "x",
          nested: { a: 1 } as unknown as string,
        },
      }),
    ).rejects.toMatchObject({
      code: ErrorCodes.INVALID_INPUT,
      message: expect.stringContaining("unknown: outlet_ids, anything, nested"),
    });
    expect(getSession).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a '.' path segment instead of collapsing onto a sibling route", async () => {
    const fetchImpl = vi.fn();
    const { d } = dispatcher(fetchImpl);
    for (const [operationId, path, query] of [
      ["inventories.stockHistories", { inventory_id: "." }, { page: 1, count: 1, outlet_ids: "1", type: "sales" }],
      ["order.histories.legacy", { sales_id: "." }, {}],
      ["purchases.items", { purchase_id: "." }, { outlet_id: 645203 }],
      ["customers.get", { customer_id: ".." }, {}],
    ] as const) {
      await expect(
        d.dispatch({ operationId, path: { ...path }, query: { ...query } }),
      ).rejects.toMatchObject({ code: ErrorCodes.INVALID_INPUT });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a body on read (GET) operations", async () => {
    const fetchImpl = vi.fn();
    const { d } = dispatcher(fetchImpl);
    await expect(
      d.dispatch({ operationId: "customers.get", path: { customer_id: 1 }, body: { customer_id: 2 } }),
    ).rejects.toMatchObject({ code: ErrorCodes.INVALID_INPUT });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("dispatcher upstream auth statuses (DISP-08)", () => {
  it("401 marks the session expired with the failing token", async () => {
    const { d, markExpired } = dispatcher(respondWith(() => new Response("unauthorized", { status: 401 })));
    await expect(
      d.dispatch({ operationId: "products.list", query: { page: 1, count: 5 } }),
    ).rejects.toMatchObject({ code: ErrorCodes.QASIR_AUTH_EXPIRED });
    expect(markExpired).toHaveBeenCalledTimes(1);
    expect(markExpired).toHaveBeenCalledWith(TOKEN);
  });

  it("403 is FORBIDDEN and keeps the session", async () => {
    const { d, markExpired } = dispatcher(respondWith(() => json({ message: "no access" }, 403)));
    await expect(
      d.dispatch({ operationId: "users.list", query: { page: 1, count: 5 } }),
    ).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN });
    expect(markExpired).not.toHaveBeenCalled();
  });

  it("Laravel 419 is QASIR_AUTH_EXPIRED without clearing the shared session", async () => {
    const { d, markExpired } = dispatcher(respondWith(() => new Response("Page Expired", { status: 419 })));
    await expect(
      d.dispatch({ operationId: "products.searchAjax", query: { name: "filter" } }),
    ).rejects.toMatchObject({ code: ErrorCodes.QASIR_AUTH_EXPIRED });
    expect(markExpired).not.toHaveBeenCalled();
  });

  it("429 is QASIR_RATE_LIMITED", async () => {
    const { d } = dispatcher(respondWith(() => new Response("slow down", { status: 429 })));
    await expect(
      d.dispatch({ operationId: "products.list", query: { page: 1, count: 5 } }),
    ).rejects.toMatchObject({ code: ErrorCodes.QASIR_RATE_LIMITED });
  });

  it("a failing markExpired still surfaces QASIR_AUTH_EXPIRED", async () => {
    const { d, markExpired } = dispatcher(respondWith(() => new Response("", { status: 401 })));
    markExpired.mockRejectedValueOnce(new Error("DO unavailable"));
    await expect(
      d.dispatch({ operationId: "products.list", query: { page: 1, count: 5 } }),
    ).rejects.toMatchObject({ code: ErrorCodes.QASIR_AUTH_EXPIRED });
  });

  it("malformed stored credentials are a typed error, not a raw TypeError", async () => {
    const fetchImpl = vi.fn();
    const { d, getSession } = dispatcher(fetchImpl);
    getSession.mockResolvedValueOnce({
      merchantSlug: "bengkel-manuju-jaya-621095",
      merchantOrigin: "https://bengkel-manuju-jaya-621095.qasir.id",
      defaultOutletId: "645203",
      secrets: { apiToken: TOKEN, csrfToken: "csrf", cookie: "a=b\nc=d" },
    });
    await expect(
      d.dispatch({ operationId: "products.searchAjax", query: { name: "x" } }),
    ).rejects.toMatchObject({ code: ErrorCodes.QASIR_AUTH_EXPIRED });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("upstream 5xx JSON keeps a summarized error", async () => {
    const { d } = dispatcher(respondWith(() => json({ code: 500, message: "boom", secret: "x" }, 500)));
    await expect(
      d.dispatch({ operationId: "products.list", query: { page: 1, count: 5 } }),
    ).rejects.toMatchObject({
      code: ErrorCodes.UPSTREAM_ERROR,
      details: { code: 500, message: "boom" },
    });
  });
});

describe("dispatcher HTML + ajax ops (DISP-03, DISP-09)", () => {
  it("SSR HTML pages send cookie + CSRF but not x-requested-with", async () => {
    const fetchImpl = respondWith(() => new Response(fixture("suppliers.html"), { status: 200 }));
    const { d } = dispatcher(fetchImpl);
    const result = await d.dispatch({ operationId: "suppliers.listHtml", query: { page: 1 } });
    const h = sentHeaders(fetchImpl);
    expect(h.get("cookie")).toBe("qasir_sess=abc; XSRF-TOKEN=xyz");
    expect(h.get("x-csrf-token")).toBe("csrf-test");
    expect(h.get("accept")).toBe("text/html");
    expect(h.get("x-requested-with")).toBeNull();
    expect(result.data).toMatchObject({ pageHint: 1, rows: [{ id: "52887" }, { id: "49826" }] });
  });

  it("JSON ajax ops send x-requested-with", async () => {
    const fetchImpl = respondWith(() => json({ data: [] }));
    const { d } = dispatcher(fetchImpl);
    await d.dispatch({ operationId: "products.searchAjax", query: { name: "oli" } });
    expect(sentHeaders(fetchImpl).get("x-requested-with")).toBe("XMLHttpRequest");
  });

  it("uses the requested page as pageHint when the page has no pagination", async () => {
    const html = "<title>Supplier</title><table><tr><th>Nama Supplier</th></tr></table>";
    const { d } = dispatcher(respondWith(() => new Response(html, { status: 200 })));
    const result = await d.dispatch({ operationId: "suppliers.listHtml", query: { page: 4 } });
    expect(result.data).toEqual({ rows: [], pageHint: 4, hasNext: false });
  });

  it("a 200 login page is QASIR_AUTH_EXPIRED for HTML adapters, never empty rows", async () => {
    const { d } = dispatcher(respondWith(() => new Response(fixture("login-page.html"), { status: 200 })));
    await expect(d.dispatch({ operationId: "suppliers.listHtml" })).rejects.toMatchObject({
      code: ErrorCodes.QASIR_AUTH_EXPIRED,
    });
    await expect(d.dispatch({ operationId: "stockAdjustment.historyHtml" })).rejects.toMatchObject({
      code: ErrorCodes.QASIR_AUTH_EXPIRED,
    });
  });

  it("a login page where JSON was expected is QASIR_AUTH_EXPIRED", async () => {
    const { d } = dispatcher(respondWith(() => new Response(fixture("login-page.html"), { status: 200 })));
    await expect(
      d.dispatch({ operationId: "ingredients.recipesTotalAjax" }),
    ).rejects.toMatchObject({ code: ErrorCodes.QASIR_AUTH_EXPIRED });
  });

  it("other non-JSON bodies stay UPSTREAM_ERROR", async () => {
    const { d } = dispatcher(respondWith(() => new Response("<html>oops</html>", { status: 502 })));
    await expect(
      d.dispatch({ operationId: "products.list", query: { page: 1, count: 5 } }),
    ).rejects.toMatchObject({ code: ErrorCodes.UPSTREAM_ERROR, message: "Upstream 502 (non-JSON body)" });
  });
});

describe("preflight (final review code-6)", () => {
  it("runs local checks without contacting Qasir", async () => {
    const { sessions, getSession } = mockSession();
    const fetchImpl = respondWith(() => json({}));
    const d = new QasirDispatcher({ sessions, mutationsEnabled: true, fetchImpl });
    await expect(
      d.preflight({ operationId: "purchases.cancel", path: { id: "1147218" } }, { allowMutation: true }),
    ).resolves.toBeUndefined();
    expect(getSession).toHaveBeenCalledTimes(1);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("surfaces a missing session or bad input before any approval is consumed", async () => {
    const { sessions, getSession } = mockSession();
    getSession.mockRejectedValueOnce(new AppError(ErrorCodes.QASIR_AUTH_EXPIRED, "no session"));
    const fetchImpl = respondWith(() => json({}));
    const d = new QasirDispatcher({ sessions, mutationsEnabled: true, fetchImpl });
    await expect(
      d.preflight({ operationId: "purchases.cancel", path: { id: "1147218" } }, { allowMutation: true }),
    ).rejects.toMatchObject({ code: ErrorCodes.QASIR_AUTH_EXPIRED });
    await expect(
      d.preflight({ operationId: "purchases.cancel", path: { id: "../x" } }, { allowMutation: true }),
    ).rejects.toMatchObject({ code: ErrorCodes.INVALID_INPUT });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
