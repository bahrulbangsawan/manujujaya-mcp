import { describe, expect, it, vi } from "vitest";
import { QasirDispatcher } from "../../src/dispatcher/qasir-dispatcher";
import { AppError, ErrorCodes } from "../../src/errors/codes";
import type { QasirSessionProvider } from "../../src/session/types";

function mockSession(): QasirSessionProvider {
  return {
    markExpired: vi.fn(),
    getSession: async () => ({
      merchantSlug: "bengkel-manuju-jaya-621095",
      merchantOrigin: "https://bengkel-manuju-jaya-621095.qasir.id",
      defaultOutletId: "645203",
      secrets: {
        apiToken: "test-token-not-real",
        csrfToken: "csrf-test",
        cookie: "qasir_sess=abc; XSRF-TOKEN=xyz",
      },
    }),
  };
}

describe("dispatcher", () => {
  it("rejects unknown operation", async () => {
    const d = new QasirDispatcher({
      sessions: mockSession(),
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });
    await expect(d.dispatch({ operationId: "nope" })).rejects.toMatchObject({
      code: ErrorCodes.UNSUPPORTED_OPERATION,
    });
  });

  it("blocks mutations when disabled", async () => {
    const d = new QasirDispatcher({
      sessions: mockSession(),
      mutationsEnabled: false,
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });
    await expect(
      d.dispatch({
        operationId: "products.inventories.bulk",
        body: { data: [] },
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("dispatches allowlisted read with bearer", async () => {
    const fetchImpl = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        new Response(JSON.stringify({ code: 200, data: { products: [] } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const d = new QasirDispatcher({
      sessions: mockSession(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const result = await d.dispatch({
      operationId: "products.list",
      query: { page: 1, count: 5 },
    });
    expect(result.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalled();
    const call = fetchImpl.mock.calls[0]!;
    const url = String(call[0]);
    const init = call[1] as RequestInit;
    expect(url).toContain("https://pos.qasir.id/api/v5/products");
    const h = init.headers as Headers;
    expect(h.get("authorization")).toBe("Bearer test-token-not-real");
  });

  it("uses raw token for stock histories", async () => {
    const fetchImpl = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        new Response(
          JSON.stringify({ code: 200, data: { stock_histories: [] } }),
          { status: 200 },
        ),
    );
    const d = new QasirDispatcher({
      sessions: mockSession(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await d.dispatch({
      operationId: "inventories.stockHistories",
      path: { inventory_id: 25950360 },
      query: {
        page: 1,
        count: 10,
        outlet_ids: "645203",
        type: "sales,refund",
      },
    });
    const init = fetchImpl.mock.calls[0]![1] as RequestInit;
    const h = init.headers as Headers;
    expect(h.get("authorization")).toBe("test-token-not-real");
  });

  it("marks session expired on upstream 401", async () => {
    const sessions = mockSession();
    const fetchImpl = vi.fn(
      async () => new Response("unauthorized", { status: 401 }),
    );
    const d = new QasirDispatcher({
      sessions,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(
      d.dispatch({ operationId: "products.list", query: { page: 1 } }),
    ).rejects.toMatchObject({ code: ErrorCodes.QASIR_AUTH_EXPIRED });
    expect(sessions.markExpired).toHaveBeenCalled();
  });

});
