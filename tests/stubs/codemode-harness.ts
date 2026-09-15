import { vi } from "vitest";
import {
  MutationApprovalsDO,
  type MutationApprovalsStub,
} from "../../src/approvals/mutation-approvals";
import type { AuthPrincipal } from "../../src/auth/verify";
import type { CodemodeDispatcher } from "../../src/codemode/run";
import type { DispatchRequest, DispatchResult } from "../../src/dispatcher/qasir-dispatcher";
import { AppError, ErrorCodes } from "../../src/errors/codes";
import { getOperation } from "../../src/registry/operations";
import { validateOperationInput } from "../../src/registry/validate";
import type { QasirSessionProvider } from "../../src/session/types";

export const MERCHANT_SLUG = "demo-merchant";

export function testEnv(overrides: Partial<Env> = {}): Env {
  return {
    MERCHANT_SLUG,
    ENABLE_MUTATIONS: "false",
    PUBLIC_BASE_URL: "https://mcp.example.test",
    MCP_SERVER_NAME: "manujujaya-mcp-test",
    MCP_SERVER_VERSION: "0.0.0-test",
    MCP_LEGACY_MODE: "reject",
    ...overrides,
  } as Env;
}

export const readPrincipal: AuthPrincipal = { subject: "owner", scopes: ["qasir:read"], via: "oauth" };
export const writePrincipal: AuthPrincipal = {
  subject: "owner",
  scopes: ["qasir:read", "qasir:write"],
  via: "oauth",
};

/** Session provider that must never be reached when a fake dispatcher is injected. */
export const unusedSessions: QasirSessionProvider = {
  getSession: async () => {
    throw new Error("sessions must not be used in this test");
  },
  markExpired: () => undefined,
};

export type FixtureHandler = (
  req: DispatchRequest,
  opts: { allowMutation?: boolean; signal?: AbortSignal } | undefined,
) => unknown;

export interface FakeDispatcher extends CodemodeDispatcher {
  readonly calls: Array<{ req: DispatchRequest; opts?: { allowMutation?: boolean; signal?: AbortSignal } }>;
  readonly peakInFlight: number;
}

/**
 * Dispatcher double: validates input with the real registry validator (C1),
 * enforces the read-only gate like the real dispatcher (C2), then answers from
 * fixture handlers keyed by operationId. Never touches the network.
 */
export function createFakeDispatcher(
  handlers: Record<string, FixtureHandler>,
  options: { mutationsEnabled?: boolean } = {},
): FakeDispatcher {
  const calls: FakeDispatcher["calls"] = [];
  let inFlight = 0;
  let peak = 0;
  return {
    calls,
    get peakInFlight() {
      return peak;
    },
    async dispatch(req, opts): Promise<DispatchResult> {
      calls.push({ req, opts });
      const op = getOperation(req.operationId);
      if (!op || !op.exposed) {
        throw new AppError(ErrorCodes.UNSUPPORTED_OPERATION, `Unknown operation: ${req.operationId}`);
      }
      if (op.safety !== "read" && !(options.mutationsEnabled && opts?.allowMutation === true)) {
        throw new AppError(ErrorCodes.MUTATION_DISABLED, "Mutations are disabled");
      }
      const input = validateOperationInput(op, {
        path: req.path,
        query: req.query as Record<string, string | number | boolean> | undefined,
        body: req.body,
      });
      const handler = handlers[req.operationId];
      if (!handler) throw new AppError(ErrorCodes.UPSTREAM_ERROR, `No fixture for ${req.operationId}`);
      inFlight++;
      peak = Math.max(peak, inFlight);
      try {
        const data = await handler({ operationId: req.operationId, ...input }, opts);
        return { operationId: req.operationId, status: 200, data };
      } finally {
        inFlight--;
      }
    },
  };
}

/** Resolve after `ms`, or reject with the signal's reason when aborted first. */
export function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

class MemoryStorage {
  readonly #data = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | undefined> {
    const v = this.#data.get(key);
    return v === undefined ? undefined : (structuredClone(v) as T);
  }
  async put(key: string, value: unknown): Promise<void> {
    this.#data.set(key, structuredClone(value));
  }
  async delete(keys: string | string[]): Promise<void> {
    for (const k of Array.isArray(keys) ? keys : [keys]) this.#data.delete(k);
  }
  async list<T>(opts: { prefix?: string } = {}): Promise<Map<string, T>> {
    const out = new Map<string, T>();
    for (const [k, v] of this.#data) if (!opts.prefix || k.startsWith(opts.prefix)) out.set(k, structuredClone(v) as T);
    return out;
  }
  async setAlarm(): Promise<void> {}
}

/** Re-throw like Workers RPC does (contract C4): a plain Error with name/code copied. */
function rpcError(err: unknown): Error {
  if (!(err instanceof AppError)) return err instanceof Error ? err : new Error(String(err));
  const plain = new Error(err.message) as Error & { code: string; status: number };
  plain.name = "AppError";
  plain.code = err.code;
  plain.status = err.status;
  return plain;
}

/**
 * The real MutationApprovalsDO over in-memory storage, exposed through a stub
 * that crosses a simulated RPC boundary (AppError loses its prototype).
 */
export function createApprovalsHarness(): { stub: MutationApprovalsStub; spies: Record<keyof MutationApprovalsStub, ReturnType<typeof vi.fn>> } {
  const ctx = { storage: new MemoryStorage() };
  const DO = MutationApprovalsDO as unknown as new (ctx: unknown, env: unknown) => MutationApprovalsDO;
  const instance = new DO(ctx, {});
  const wrap = <K extends keyof MutationApprovalsStub>(name: K) =>
    vi.fn(async (input: Parameters<MutationApprovalsStub[K]>[0]) => {
      try {
        return await (instance[name] as (i: typeof input) => Promise<unknown>)(input);
      } catch (err) {
        throw rpcError(err);
      }
    });
  const spies = {
    request: wrap("request"),
    get: wrap("get"),
    decide: wrap("decide"),
    consume: wrap("consume"),
  };
  return { stub: spies as unknown as MutationApprovalsStub, spies };
}
