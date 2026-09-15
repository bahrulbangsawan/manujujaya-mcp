import {
  DynamicWorkerExecutor,
  normalizeCode,
  truncateResult,
} from "@cloudflare/codemode";
import { AppError, ErrorCodes } from "../errors/codes";
import type { QasirDispatcher } from "../dispatcher/qasir-dispatcher";
import { getOperation } from "../registry/operations";
import type { CodemodeSpecBundle } from "./spec";

export interface RunCodeOptions {
  loader: WorkerLoader;
  code: string;
  mode: "search" | "execute" | "execute_mutation";
  spec: CodemodeSpecBundle;
  dispatcher?: QasirDispatcher;
  timeoutMs?: number;
}

/**
 * Run model JS in an isolated Worker via DynamicWorkerExecutor.
 * search: only codemode.spec() — globalOutbound null, no dispatcher.
 * execute: + host-injected codemode.request({ operationId, path, query, body }).
 */
export async function runCodemode(options: RunCodeOptions): Promise<unknown> {
  const executor = new DynamicWorkerExecutor({
    loader: options.loader,
    timeout: options.timeoutMs ?? 60_000,
    globalOutbound: null,
  });

  const fns: Record<string, (...args: unknown[]) => Promise<unknown>> = {
    spec: async () => options.spec,
  };

  if (options.mode === "execute" || options.mode === "execute_mutation") {
    if (!options.dispatcher) {
      throw new AppError(ErrorCodes.INVALID_INPUT, "Dispatcher required");
    }
    const dispatcher = options.dispatcher;
    const allowMutations = options.mode === "execute_mutation";
    fns.request = async (raw: unknown) => {
      const args = normalizeRequestArgs(raw);
      const op = getOperation(args.operationId);
      if (!op) {
        throw new AppError(
          ErrorCodes.UNSUPPORTED_OPERATION,
          `Unknown operationId ${args.operationId}`,
        );
      }
      if (op.safety === "read" && allowMutations === false) {
        // ok
      } else if (op.safety !== "read" && !allowMutations) {
        throw new AppError(
          ErrorCodes.MUTATION_DISABLED,
          "Use execute_mutation for writes",
        );
      } else if (op.safety === "read" && allowMutations) {
        // allow reads inside mutation scripts
      }
      return dispatcher.dispatch({
        operationId: args.operationId,
        path: args.path,
        query: args.query,
        body: args.body,
      });
    };
  }

  const code = normalizeCode(options.code);
  const result = await executor.execute(code, [
    { name: "codemode", fns },
  ]);

  if (result.error) {
    throw new AppError(ErrorCodes.INVALID_INPUT, result.error);
  }
  return truncateResult(result.result, { maxTokens: 6000 });
}

interface RequestArgs {
  operationId: string;
  path?: Record<string, string | number>;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

function normalizeRequestArgs(raw: unknown): RequestArgs {
  if (!raw || typeof raw !== "object") {
    throw new AppError(ErrorCodes.INVALID_INPUT, "request() expects an object");
  }
  const o = raw as Record<string, unknown>;
  // NEVER accept method / arbitrary URL from model
  if ("method" in o || "url" in o || "headers" in o || "authorization" in o) {
    throw new AppError(
      ErrorCodes.INVALID_INPUT,
      "request() rejects method/url/headers — use operationId only",
    );
  }
  if (typeof o.operationId !== "string" || !o.operationId) {
    throw new AppError(ErrorCodes.INVALID_INPUT, "operationId is required");
  }
  return {
    operationId: o.operationId,
    path: asParamMap(o.path),
    query: asQueryMap(o.query),
    body: o.body,
  };
}

function asParamMap(
  v: unknown,
): Record<string, string | number> | undefined {
  if (v == null) return undefined;
  if (typeof v !== "object" || Array.isArray(v)) {
    throw new AppError(ErrorCodes.INVALID_INPUT, "path must be an object");
  }
  const out: Record<string, string | number> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "string" || typeof val === "number") out[k] = val;
    else throw new AppError(ErrorCodes.INVALID_INPUT, `Bad path.${k}`);
  }
  return out;
}

function asQueryMap(
  v: unknown,
): Record<string, string | number | boolean | undefined> | undefined {
  if (v == null) return undefined;
  if (typeof v !== "object" || Array.isArray(v)) {
    throw new AppError(ErrorCodes.INVALID_INPUT, "query must be an object");
  }
  return v as Record<string, string | number | boolean | undefined>;
}
