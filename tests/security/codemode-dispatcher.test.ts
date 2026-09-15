import { describe, expect, it, vi } from "vitest";
import { runCodemode } from "../../src/codemode/run";
import { createSpecBundle } from "../../src/codemode/spec";
import { QasirDispatcher } from "../../src/dispatcher/qasir-dispatcher";
import { AppError, ErrorCodes } from "../../src/errors/codes";
import type { QasirSessionProvider } from "../../src/session/types";
import { MERCHANT_SLUG } from "../stubs/codemode-harness";
import { createFakeWorkerLoader } from "../stubs/fake-worker-loader";

/** End-to-end through the real QasirDispatcher with a mocked fetch (no network). */
const API_TOKEN = "TOKEN-must-never-reach-the-sandbox-0000";
const CSRF = "CSRF-must-never-reach-the-sandbox";
const COOKIE = "qasir_sess=COOKIE-must-never-reach-the-sandbox";

function sessions(): QasirSessionProvider {
  return {
    markExpired: vi.fn(),
    getSession: async () => ({
      merchantSlug: MERCHANT_SLUG,
      merchantOrigin: `https://${MERCHANT_SLUG}.qasir.id`,
      defaultOutletId: "1",
      secrets: { apiToken: API_TOKEN, csrfToken: CSRF, cookie: COOKIE },
    }),
  };
}

const spec = createSpecBundle(MERCHANT_SLUG);

describe("Code Mode with the real dispatcher", () => {
  it("serves reads while credentials stay on the host", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("authorization")).toBe(`Bearer ${API_TOKEN}`);
      return Response.json({
        code: 200,
        data: { products: [{ id: "1", name: "Filter" }] },
        pagination: { current_page: 1, total_page: 1 },
      });
    });
    const dispatcher = new QasirDispatcher({ sessions: sessions(), fetchImpl: fetchImpl as unknown as typeof fetch });
    const out = await runCodemode({
      loader: createFakeWorkerLoader(),
      mode: "execute",
      spec,
      dispatcher,
      code: `async () => {
        const r = await codemode.request({ operationId: 'products.list', query: { page: 1, count: 10 } });
        return { r, globals: Object.getOwnPropertyNames(globalThis), self: JSON.stringify(this ?? null) };
      }`,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0]![0])).toBe("https://pos.qasir.id/api/v5/products?page=1&count=10");
    expect(out).toContain("Filter");
    for (const secret of [API_TOKEN, CSRF, "COOKIE-must-never"]) expect(out).not.toContain(secret);
  });

  it("the host deadline aborts the upstream fetch", async () => {
    let fetchSignal: AbortSignal | undefined;
    const fetchImpl = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          fetchSignal = init?.signal ?? undefined;
          fetchSignal?.addEventListener("abort", () => reject(fetchSignal?.reason), { once: true });
        }),
    );
    const dispatcher = new QasirDispatcher({ sessions: sessions(), fetchImpl: fetchImpl as unknown as typeof fetch });
    const err = await runCodemode({
      loader: createFakeWorkerLoader(),
      mode: "execute",
      spec,
      dispatcher,
      limits: { timeoutMs: 150 },
      code: "async () => codemode.request({ operationId: 'products.list', query: { page: 1, count: 10 } })",
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe(ErrorCodes.UPSTREAM_TIMEOUT);
    expect(fetchSignal?.aborted).toBe(true);
  });

  it("maps an upstream 401 to QASIR_AUTH_EXPIRED for the MCP client", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ message: "Unauthenticated" }, { status: 401 }));
    const dispatcher = new QasirDispatcher({ sessions: sessions(), fetchImpl: fetchImpl as unknown as typeof fetch });
    const err = await runCodemode({
      loader: createFakeWorkerLoader(),
      mode: "execute",
      spec,
      dispatcher,
      code: "async () => codemode.request({ operationId: 'products.list', query: { page: 1, count: 10 } })",
    }).catch((e: unknown) => e);
    expect((err as AppError).code).toBe(ErrorCodes.QASIR_AUTH_EXPIRED);
  });

  it("rejects schema-invalid input with INVALID_INPUT before any fetch", async () => {
    const fetchImpl = vi.fn();
    const dispatcher = new QasirDispatcher({ sessions: sessions(), fetchImpl: fetchImpl as unknown as typeof fetch });
    const err = await runCodemode({
      loader: createFakeWorkerLoader(),
      mode: "execute",
      spec,
      dispatcher,
      code: "async () => codemode.request({ operationId: 'products.list', query: { page: 1, count: 10, outlet_ids: 5 } })",
    }).catch((e: unknown) => e);
    expect((err as AppError).code).toBe(ErrorCodes.INVALID_INPUT);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
