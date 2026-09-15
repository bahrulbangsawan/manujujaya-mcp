import { AppError, ErrorCodes } from "../errors/codes";
import { log } from "../observability/log";
import { getOperation } from "../registry/operations";
import type { ApiOperation } from "../registry/types";
import type { QasirSessionProvider } from "../session/types";
import {
  assertAllowedUrl,
  isRedirectAllowed,
  resolveHost,
} from "./allowlist";
import { applyQuery, buildPath } from "./path";
import { parseSuppliersHtml } from "../html/suppliers";
import { parseStockAdjustmentHtml } from "../html/stock-adjustment";

export interface DispatchRequest {
  operationId: string;
  /** Path params only — never an absolute URL. */
  path?: Record<string, string | number>;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

export interface DispatchResult {
  operationId: string;
  status: number;
  data: unknown;
}

export interface DispatcherLimits {
  timeoutMs: number;
  maxBytes: number;
}

const DEFAULT_LIMITS: DispatcherLimits = {
  timeoutMs: 25_000,
  maxBytes: 2_000_000,
};

export class QasirDispatcher {
  #sessions: QasirSessionProvider;
  #limits: DispatcherLimits;
  #fetchImpl: typeof fetch;
  #mutationsEnabled: boolean;

  constructor(options: {
    sessions: QasirSessionProvider;
    mutationsEnabled?: boolean;
    limits?: Partial<DispatcherLimits>;
    fetchImpl?: typeof fetch;
  }) {
    this.#sessions = options.sessions;
    this.#mutationsEnabled = options.mutationsEnabled ?? false;
    this.#limits = { ...DEFAULT_LIMITS, ...options.limits };
    this.#fetchImpl = options.fetchImpl ?? fetch;
  }

  async dispatch(req: DispatchRequest): Promise<DispatchResult> {
    const op = getOperation(req.operationId);
    if (!op || !op.exposed) {
      throw new AppError(
        ErrorCodes.UNSUPPORTED_OPERATION,
        `Unknown operation: ${req.operationId}`,
      );
    }
    if (op.safety !== "read") {
      if (!this.#mutationsEnabled) {
        throw new AppError(
          ErrorCodes.MUTATION_DISABLED,
          "Mutations are disabled (ENABLE_MUTATIONS!=true)",
        );
      }
    }

    const session = await this.#sessions.getSession();
    const host = resolveHost(op.host, session.merchantSlug);
    const pathParams = splitPathParams(op, req);
    const path = buildPath(op.pathTemplate, pathParams);
    const url = new URL(`https://${host}${path}`);
    applyQuery(url, remainingQuery(op, req));
    assertAllowedUrl(url, session.merchantSlug);

    const headers = buildHeaders(op, session);
    const init: RequestInit = {
      method: op.method,
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(this.#limits.timeoutMs),
    };
    if (req.body !== undefined && op.method !== "GET") {
      headers.set("content-type", "application/json");
      init.body = JSON.stringify(req.body);
    }

    log("info", "qasir.dispatch", {
      operationId: op.operationId,
      method: op.method,
      host,
      path,
    });

    let response: Response;
    try {
      response = await this.#fetchImpl(url.toString(), init);
    } catch (err) {
      if (err instanceof Error && err.name === "TimeoutError") {
        throw new AppError(ErrorCodes.UPSTREAM_TIMEOUT, "Upstream timed out");
      }
      throw new AppError(ErrorCodes.UPSTREAM_ERROR, "Upstream fetch failed", {
        cause: err,
      });
    }

    response = await followSafeRedirects(
      response,
      session.merchantSlug,
      this.#fetchImpl,
      init,
      this.#limits.timeoutMs,
    );

    await assertAuthStatus(response, this.#sessions);
    const buf = await response.arrayBuffer();
    if (buf.byteLength > this.#limits.maxBytes) {
      throw new AppError(
        ErrorCodes.RESULT_LIMIT_EXCEEDED,
        `Upstream body exceeds ${this.#limits.maxBytes} bytes`,
      );
    }
    const text = new TextDecoder().decode(buf);
    const data = await normalizeResponse(op, response.status, text);
    return { operationId: op.operationId, status: response.status, data };
  }
}

function splitPathParams(
  op: ApiOperation,
  req: DispatchRequest,
): Record<string, string | number> {
  const names = [...op.pathTemplate.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map(
    (m) => m[1]!,
  );
  const out: Record<string, string | number> = {};
  const bag = { ...(req.path ?? {}), ...(req.query ?? {}) };
  for (const name of names) {
    const v = bag[name] ?? (req.body as Record<string, unknown> | undefined)?.[name];
    if (v === undefined || typeof v === "boolean") {
      throw new AppError(ErrorCodes.INVALID_INPUT, `Missing path param ${name}`);
    }
    out[name] = v as string | number;
  }
  return out;
}

function remainingQuery(
  op: ApiOperation,
  req: DispatchRequest,
): Record<string, string | number | boolean | undefined> {
  const pathNames = new Set(
    [...op.pathTemplate.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((m) => m[1]!),
  );
  const out: Record<string, string | number | boolean | undefined> = {
    ...(req.query ?? {}),
  };
  for (const name of pathNames) delete out[name];
  // Also drop path-only keys if mistakenly in query
  if (req.path) {
    for (const k of Object.keys(req.path)) {
      if (pathNames.has(k)) delete out[k];
    }
  }
  return out;
}

function buildHeaders(
  op: ApiOperation,
  session: Awaited<ReturnType<QasirSessionProvider["getSession"]>>,
): Headers {
  const h = new Headers();
  h.set("accept", op.responseKind === "html" ? "text/html" : "*/*");
  h.set("origin", session.merchantOrigin);
  h.set("referer", `${session.merchantOrigin}/`);
  h.set("x-csrf-token", session.secrets.csrfToken);
  if (op.authProfile === "bearer") {
    h.set("authorization", `Bearer ${session.secrets.apiToken}`);
  } else if (op.authProfile === "raw-token") {
    h.set("authorization", session.secrets.apiToken);
  } else if (op.authProfile === "cookie-csrf") {
    if (!session.secrets.cookie) {
      throw new AppError(
        ErrorCodes.QASIR_AUTH_EXPIRED,
        "QASIR_COOKIE required for cookie-csrf operations",
      );
    }
    h.set("cookie", session.secrets.cookie);
    h.set("x-requested-with", "XMLHttpRequest");
  }
  return h;
}

async function followSafeRedirects(
  response: Response,
  merchantSlug: string,
  fetchImpl: typeof fetch,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  let current = response;
  for (let i = 0; i < 3; i++) {
    if (current.status < 300 || current.status >= 400) return current;
    const location = current.headers.get("location");
    if (!location || !isRedirectAllowed(location, merchantSlug)) {
      throw new AppError(
        ErrorCodes.REDIRECT_NOT_ALLOWED,
        "Redirect target not allowlisted",
      );
    }
    current = await fetchImpl(location, {
      ...init,
      method: "GET",
      body: undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
  }
  throw new AppError(ErrorCodes.REDIRECT_NOT_ALLOWED, "Too many redirects");
}

async function assertAuthStatus(
  response: Response,
  sessions: QasirSessionProvider,
): Promise<void> {
  if (response.status === 401 || response.status === 403) {
    sessions.markExpired();
    throw new AppError(
      ErrorCodes.QASIR_AUTH_EXPIRED,
      `Upstream auth failed (${response.status})`,
    );
  }
  if (response.status === 429) {
    throw new AppError(ErrorCodes.QASIR_RATE_LIMITED, "Upstream rate limited");
  }
}

async function normalizeResponse(
  op: ApiOperation,
  status: number,
  text: string,
): Promise<unknown> {
  if (op.responseKind === "html") {
    if (status >= 400) {
      throw new AppError(ErrorCodes.UPSTREAM_ERROR, `HTML upstream ${status}`);
    }
    if (op.operationId === "suppliers.listHtml") {
      return parseSuppliersHtml(text);
    }
    if (op.operationId === "stockAdjustment.historyHtml") {
      return parseStockAdjustmentHtml(text);
    }
    return { htmlLength: text.length };
  }
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new AppError(ErrorCodes.UPSTREAM_ERROR, "Non-JSON upstream body");
  }
  if (status >= 400) {
    throw new AppError(ErrorCodes.UPSTREAM_ERROR, `Upstream ${status}`, {
      details: summarizeError(json),
    });
  }
  return json;
}

function summarizeError(json: unknown): unknown {
  if (json && typeof json === "object") {
    const o = json as Record<string, unknown>;
    return { code: o.code ?? o.status, message: o.message };
  }
  return undefined;
}
