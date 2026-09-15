import { afterEach, describe, expect, it, vi } from "vitest";
import { QasirDispatcher, type DispatcherLimits } from "../../src/dispatcher/qasir-dispatcher";
import { ErrorCodes } from "../../src/errors/codes";
import type { QasirSessionProvider } from "../../src/session/types";

const TOKEN = "test-token-not-real";
const SLUG = "bengkel-manuju-jaya-621095";
const MERCHANT = `https://${SLUG}.qasir.id`;
const LIST = { operationId: "products.list", query: { page: 1, count: 5 } };

type FetchArgs = [string | URL | Request, RequestInit?];
type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

function setup(handler: Handler, options: { limits?: Partial<DispatcherLimits>; mutationsEnabled?: boolean } = {}) {
  const markExpired = vi.fn(async (_failedApiToken?: string) => undefined);
  const sessions: QasirSessionProvider = {
    markExpired,
    getSession: async () => ({
      merchantSlug: SLUG,
      merchantOrigin: MERCHANT,
      defaultOutletId: "645203",
      secrets: { apiToken: TOKEN, csrfToken: "csrf-test", cookie: "qasir_sess=abc" },
    }),
  };
  const fetchImpl = vi.fn(async (...[input, init]: FetchArgs) => handler(String(input), init ?? {}));
  const d = new QasirDispatcher({
    sessions,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    limits: options.limits,
    mutationsEnabled: options.mutationsEnabled,
  });
  return { d, fetchImpl, markExpired };
}

function redirect(location: string, status = 302): Response {
  return new Response(null, { status, headers: { location } });
}

function ok(body: unknown = { code: 200 }): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

/** Resolves after `ms`, or rejects with the signal's reason when it aborts first. */
function afterDelay<T>(ms: number, signal: AbortSignal | null | undefined, value: () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(value()), ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("default fetch binding (DISP-01)", () => {
  it("calls the global fetch unbound when no fetchImpl is given", async () => {
    const calls: unknown[] = [];
    let dispatcher: QasirDispatcher | undefined;
    // Mirrors workerd: fetch invoked with any receiver but globalThis/undefined throws.
    const strictFetch = function (this: unknown, input: string | URL | Request, _init?: RequestInit) {
      if (this !== undefined && this !== globalThis) {
        throw new TypeError("Illegal invocation: function called with incorrect this reference");
      }
      if (this === dispatcher) throw new TypeError("called with dispatcher as this");
      calls.push(String(input));
      return Promise.resolve(ok());
    };
    vi.stubGlobal("fetch", strictFetch);
    const sessions: QasirSessionProvider = {
      markExpired: () => undefined,
      getSession: async () => ({
        merchantSlug: SLUG,
        merchantOrigin: MERCHANT,
        defaultOutletId: "645203",
        secrets: { apiToken: TOKEN, csrfToken: "c", cookie: "" },
      }),
    };
    dispatcher = new QasirDispatcher({ sessions });
    const result = await dispatcher.dispatch(LIST);
    expect(result.status).toBe(200);
    expect(calls).toEqual(["https://pos.qasir.id/api/v5/products?page=1&count=5"]);
  });

  it("also calls an injected fetchImpl without a receiver", async () => {
    const receivers: unknown[] = [];
    const fetchImpl = function (this: unknown) {
      receivers.push(this);
      return Promise.resolve(ok());
    };
    const d = new QasirDispatcher({
      sessions: {
        markExpired: () => undefined,
        getSession: async () => ({
          merchantSlug: SLUG,
          merchantOrigin: MERCHANT,
          defaultOutletId: "1",
          secrets: { apiToken: TOKEN, csrfToken: "c", cookie: "" },
        }),
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await d.dispatch(LIST);
    expect(receivers).toEqual([undefined]);
  });
});

describe("redirect policy (DISP-03, DISP-06)", () => {
  it("follows a relative same-host redirect with the same credentials", async () => {
    const { d, fetchImpl } = setup((url) =>
      url.includes("/products/") ? ok({ followed: true }) : redirect("/api/v5/products/?page=1&count=5", 301),
    );
    const result = await d.dispatch(LIST);
    expect(result.data).toEqual({ followed: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(String(fetchImpl.mock.calls[1]![0])).toBe("https://pos.qasir.id/api/v5/products/?page=1&count=5");
    const second = fetchImpl.mock.calls[1]![1] as RequestInit;
    expect(second.method).toBe("GET");
    expect((second.headers as Headers).get("authorization")).toBe(`Bearer ${TOKEN}`);
    expect(second.redirect).toBe("manual");
  });

  it("refuses cross-host redirects without replaying credentials", async () => {
    const { d, fetchImpl, markExpired } = setup(() => redirect("https://account.qasir.id/x"));
    await expect(d.dispatch(LIST)).rejects.toMatchObject({ code: ErrorCodes.REDIRECT_NOT_ALLOWED });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(markExpired).not.toHaveBeenCalled();
  });

  it("refuses off-allowlist redirects", async () => {
    const { d, fetchImpl } = setup(() => redirect("https://evil.example/api/v5/products"));
    await expect(d.dispatch(LIST)).rejects.toMatchObject({ code: ErrorCodes.REDIRECT_NOT_ALLOWED });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("an expired dashboard session redirecting to www sign-in is QASIR_AUTH_EXPIRED, not empty rows", async () => {
    const { d, fetchImpl, markExpired } = setup(() => redirect("https://www.qasir.id/sign-in?lang=id"));
    await expect(d.dispatch({ operationId: "suppliers.listHtml" })).rejects.toMatchObject({
      code: ErrorCodes.QASIR_AUTH_EXPIRED,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1); // cookie never sent to www
    // A dead dashboard cookie must not delete the shared session (Bearer ops still work).
    expect(markExpired).not.toHaveBeenCalled();
  });

  it("a sign-in redirect on a Bearer operation clears the session for that token", async () => {
    const { d, markExpired } = setup(() => redirect("https://www.qasir.id/sign-in?lang=id"));
    await expect(d.dispatch(LIST)).rejects.toMatchObject({ code: ErrorCodes.QASIR_AUTH_EXPIRED });
    expect(markExpired).toHaveBeenCalledWith(TOKEN);
  });

  it("a same-host /login redirect is QASIR_AUTH_EXPIRED", async () => {
    const { d, fetchImpl } = setup(() => redirect("/login"));
    await expect(
      d.dispatch({ operationId: "products.searchAjax", query: { name: "x" } }),
    ).rejects.toMatchObject({ code: ErrorCodes.QASIR_AUTH_EXPIRED });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("never downgrades a 307/308 on a write to GET", async () => {
    const { d, fetchImpl } = setup(() => redirect("/api/v5/purchases/confirmation/", 307), {
      mutationsEnabled: true,
    });
    await expect(
      d.dispatch(
        {
          operationId: "purchases.confirmation",
          body: { purchase_id: "1", outlet_id: 645203, items: [] },
        },
        { allowMutation: true },
      ),
    ).rejects.toMatchObject({
      code: ErrorCodes.REDIRECT_NOT_ALLOWED,
      message: expect.stringContaining("verify before retrying"),
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("caps the number of redirects", async () => {
    let n = 0;
    const { d, fetchImpl } = setup(() => redirect(`/api/v5/products?hop=${++n}`));
    await expect(d.dispatch(LIST)).rejects.toMatchObject({
      code: ErrorCodes.REDIRECT_NOT_ALLOWED,
      message: "Too many redirects",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("a redirect without Location is REDIRECT_NOT_ALLOWED", async () => {
    const { d } = setup(() => new Response(null, { status: 302 }));
    await expect(d.dispatch(LIST)).rejects.toMatchObject({ code: ErrorCodes.REDIRECT_NOT_ALLOWED });
  });
});

describe("deadline and abort (DISP-02, DISP-04)", () => {
  it("uses one deadline across redirect hops", async () => {
    const { d, fetchImpl } = setup(
      (url, init) =>
        afterDelay(40, init.signal, () => (url.includes("hop") ? ok() : redirect("/api/v5/products?hop=1"))),
      { limits: { timeoutMs: 60 } },
    );
    await expect(d.dispatch(LIST)).rejects.toMatchObject({ code: ErrorCodes.UPSTREAM_TIMEOUT });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const first = (fetchImpl.mock.calls[0]![1] as RequestInit).signal;
    const second = (fetchImpl.mock.calls[1]![1] as RequestInit).signal;
    expect(second).toBe(first);
  });

  it("maps a TimeoutError thrown on a redirect hop to UPSTREAM_TIMEOUT", async () => {
    let calls = 0;
    const { d } = setup(() => {
      calls += 1;
      if (calls === 1) return redirect("/api/v5/products?again=1");
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    });
    await expect(d.dispatch(LIST)).rejects.toMatchObject({ code: ErrorCodes.UPSTREAM_TIMEOUT });
  });

  it("times out a stalled body read and cancels the stream", async () => {
    let cancelled = false;
    const { d } = setup(
      () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('{"partial":'));
            },
            cancel() {
              cancelled = true;
            },
          }),
          { status: 200 },
        ),
      { limits: { timeoutMs: 30 } },
    );
    await expect(d.dispatch(LIST)).rejects.toMatchObject({ code: ErrorCodes.UPSTREAM_TIMEOUT });
    await vi.waitFor(() => expect(cancelled).toBe(true));
  });

  it("honours the caller's signal, including an AppError-like abort reason", async () => {
    const controller = new AbortController();
    const { d, fetchImpl } = setup((_url, init) => afterDelay(1_000, init.signal, () => ok()));
    const pending = d.dispatch(LIST, { signal: controller.signal });
    setTimeout(() => {
      const reason = Object.assign(new Error("Execution deadline reached"), {
        name: "AppError",
        code: ErrorCodes.UPSTREAM_TIMEOUT,
      });
      controller.abort(reason);
    }, 10);
    await expect(pending).rejects.toMatchObject({
      code: ErrorCodes.UPSTREAM_TIMEOUT,
      message: "Execution deadline reached",
    });
    expect((fetchImpl.mock.calls[0]![1] as RequestInit).signal?.aborted).toBe(true);
  });

  it("does not fetch when the caller's signal is already aborted", async () => {
    const { d, fetchImpl } = setup(() => ok());
    await expect(d.dispatch(LIST, { signal: AbortSignal.abort() })).rejects.toMatchObject({
      code: ErrorCodes.UPSTREAM_ERROR,
      message: "Upstream request aborted",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("maps network failures to UPSTREAM_ERROR", async () => {
    const { d } = setup(() => {
      throw new TypeError("network down");
    });
    await expect(d.dispatch(LIST)).rejects.toMatchObject({
      code: ErrorCodes.UPSTREAM_ERROR,
      message: "Upstream fetch failed",
    });
  });
});

describe("response size cap (DISP-02)", () => {
  it("rejects a declared Content-Length over the cap without reading the body", async () => {
    let pulls = 0;
    let cancelled = false;
    const { d } = setup(
      () =>
        new Response(
          new ReadableStream<Uint8Array>({
            pull(controller) {
              pulls += 1;
              controller.enqueue(new Uint8Array(10));
            },
            cancel() {
              cancelled = true;
            },
          }, { highWaterMark: 0 }),
          { status: 200, headers: { "content-length": "5000" } },
        ),
      { limits: { maxBytes: 1_000 } },
    );
    await expect(d.dispatch(LIST)).rejects.toMatchObject({ code: ErrorCodes.RESULT_LIMIT_EXCEEDED });
    expect(pulls).toBe(0);
    await vi.waitFor(() => expect(cancelled).toBe(true));
  });

  it("stops streaming an undeclared body once it passes the cap", async () => {
    let bytesProduced = 0;
    let cancelled = false;
    const { d } = setup(
      () =>
        new Response(
          new ReadableStream<Uint8Array>({
            pull(controller) {
              bytesProduced += 256;
              controller.enqueue(new Uint8Array(256));
            },
            cancel() {
              cancelled = true;
            },
          }, { highWaterMark: 0 }),
          { status: 200 },
        ),
      { limits: { maxBytes: 1_000 } },
    );
    await expect(d.dispatch(LIST)).rejects.toMatchObject({ code: ErrorCodes.RESULT_LIMIT_EXCEEDED });
    await vi.waitFor(() => expect(cancelled).toBe(true));
    expect(bytesProduced).toBeLessThanOrEqual(1_000 + 2 * 256);
  });

  it("accepts a body exactly at the cap", async () => {
    const body = JSON.stringify({ pad: "x".repeat(990) });
    const { d } = setup(() => new Response(body, { status: 200 }), {
      limits: { maxBytes: new TextEncoder().encode(body).byteLength },
    });
    await expect(d.dispatch(LIST)).resolves.toMatchObject({ status: 200 });
  });
});
