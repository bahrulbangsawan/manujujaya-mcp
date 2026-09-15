import { AppError, ErrorCodes } from "../errors/codes";
import { log } from "../observability/log";
import { getOperation } from "../registry/operations";
import type { ApiOperation } from "../registry/types";
import {
  validateOperationInput,
  type ValidatedInput,
} from "../registry/validate";
import type { QasirSessionContext, QasirSessionProvider } from "../session/types";
import { assertAllowedUrl, resolveHost } from "./allowlist";
import { applyQuery, buildPath, resolveUrl } from "./path";
import {
  createRequestSignals,
  discardBody,
  fetchUpstream,
  readBodyCapped,
  type UpstreamContext,
} from "./upstream";
import { looksLikeLoginPage } from "../html/text";
import { parseSuppliersHtml } from "../html/suppliers";
import { parseStockAdjustmentHtml } from "../html/stock-adjustment";

export interface DispatchRequest {
  operationId: string;
  /** Path params only — never an absolute URL. */
  path?: Record<string, string | number>;
  /** `undefined` values mean "not provided" and are dropped. */
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

export interface DispatchResult {
  operationId: string;
  status: number;
  data: unknown;
}

export interface DispatchOptions {
  /** Must be true (and mutations enabled) for write/destructive ops. */
  allowMutation?: boolean;
  /** Aborts in-flight fetches and body reads (e.g. execution deadline). */
  signal?: AbortSignal;
}

export interface DispatcherLimits {
  /** One deadline for the whole request, including redirects and body read. */
  timeoutMs: number;
  maxBytes: number;
  maxRedirects: number;
}

const DEFAULT_LIMITS: DispatcherLimits = {
  timeoutMs: 25_000,
  maxBytes: 2_000_000,
  maxRedirects: 3,
};

/** Laravel "page expired" (CSRF token / session mismatch). */
const LARAVEL_PAGE_EXPIRED = 419;

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
    // Never store the bare global: calling it later as a method would bind
    // `this` to the dispatcher and workerd throws "Illegal invocation".
    this.#fetchImpl =
      options.fetchImpl ?? ((input, init) => fetch(input, init));
  }

  /**
   * Run every local check dispatch() would (operation gate, input validation,
   * session lookup, URL allowlist, header construction) without contacting
   * Qasir. execute_mutation calls this before consuming a single-use approval.
   */
  async preflight(req: DispatchRequest, opts: DispatchOptions = {}): Promise<void> {
    await this.#prepare(req, opts);
  }

  async dispatch(
    req: DispatchRequest,
    opts: DispatchOptions = {},
  ): Promise<DispatchResult> {
    const { op, input, session, host, path, url, init } = await this.#prepare(req, opts);

    log("info", "qasir.dispatch", {
      operationId: op.operationId,
      method: op.method,
      host,
      path,
    });


    const { deadline, signal } = createRequestSignals(
      this.#limits.timeoutMs,
      opts.signal,
    );
    const ctx: UpstreamContext = {
      fetchImpl: this.#fetchImpl,
      deadline,
      signal,
      timeoutMs: this.#limits.timeoutMs,
      merchantSlug: session.merchantSlug,
      maxRedirects: this.#limits.maxRedirects,
    };
    const outcome = await fetchUpstream(url, init, ctx);
    if (outcome.kind === "login-redirect") {
      await this.#expire(op, session, "login-redirect");
      throw new AppError(
        ErrorCodes.QASIR_AUTH_EXPIRED,
        "Qasir session expired (redirected to sign-in); reconnect at /connect",
      );
    }
    const response = outcome.response;
    await this.#assertAuthStatus(op, session, response);
    const text = await readBodyCapped(response, this.#limits.maxBytes, ctx);
    const data = normalizeResponse(op, response.status, text, input);
    return { operationId: op.operationId, status: response.status, data };
  }

  async #assertAuthStatus(
    op: ApiOperation,
    session: QasirSessionContext,
    response: Response,
  ): Promise<void> {
    const status = response.status;
    if (status === 401) {
      discardBody(response);
      await this.#expire(op, session, "401");
      throw new AppError(
        ErrorCodes.QASIR_AUTH_EXPIRED,
        "Upstream auth failed (401); reconnect at /connect",
      );
    }
    if (status === 403) {
      // Role / outlet / feature denials: the session itself is still valid.
      discardBody(response);
      throw new AppError(
        ErrorCodes.FORBIDDEN,
        `Upstream forbidden (403) for ${op.operationId}`,
      );
    }
    if (status === LARAVEL_PAGE_EXPIRED) {
      // Dashboard cookie/CSRF expired; Bearer ops may still work, keep session.
      discardBody(response);
      throw new AppError(
        ErrorCodes.QASIR_AUTH_EXPIRED,
        "Qasir dashboard session or CSRF expired (419); reconnect at /connect",
      );
    }
    if (status === 429) {
      discardBody(response);
      throw new AppError(ErrorCodes.QASIR_RATE_LIMITED, "Upstream rate limited");
    }
  }

  async #prepare(req: DispatchRequest, opts: DispatchOptions) {
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
      if (opts.allowMutation !== true) {
        throw new AppError(
          ErrorCodes.MUTATION_DISABLED,
          "Write operations require the approved execute_mutation path",
        );
      }
    }
    const input = validateOperationInput(op, {
      path: req.path,
      query: definedQuery(req.query),
      body: req.body,
    });

    const session = await this.#sessions.getSession();
    const host = resolveHost(op.host, session.merchantSlug);
    const path = buildPath(op.pathTemplate, input.path);
    const url = resolveUrl(host, path);
    applyQuery(url, input.query);
    assertAllowedUrl(url, session.merchantSlug);

    const headers = buildHeaders(op, session);
    const init: RequestInit = { method: op.method, headers, redirect: "manual" };
    if (input.body !== undefined) {
      headers.set("content-type", "application/json");
      init.body = JSON.stringify(input.body);
    }
    return { op, input, session, host, path, url, init };
  }

  /** Clear the stored session only if it still holds the token that failed. */
  async #expire(
    op: ApiOperation,
    session: QasirSessionContext,
    reason: string,
  ): Promise<void> {
    log("warn", "qasir.session_expired", { operationId: op.operationId, reason });
    // A dead dashboard cookie says nothing about the API token: keep the session
    // for cookie-csrf ops so Bearer operations keep working until reconnect.
    if (op.authProfile !== "bearer" && op.authProfile !== "raw-token") return;
    try {
      await this.#sessions.markExpired(session.secrets.apiToken);
    } catch (err) {
      log("warn", "qasir.mark_expired_failed", {
        operationId: op.operationId,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

function definedQuery(
  query: DispatchRequest["query"],
): Record<string, string | number | boolean> | undefined {
  if (query === undefined || query === null) return undefined;
  if (typeof query !== "object" || Array.isArray(query)) {
    // Let the validator report the wrong shape.
    return query as unknown as Record<string, string | number | boolean>;
  }
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

function buildHeaders(op: ApiOperation, session: QasirSessionContext): Headers {
  try {
    return buildHeadersUnchecked(op, session);
  } catch (err) {
    if (err instanceof AppError) throw err;
    // Headers.set throws TypeError on CR/LF etc. in stored cookie/CSRF values.
    throw new AppError(
      ErrorCodes.QASIR_AUTH_EXPIRED,
      "Stored Qasir credentials are malformed; reconnect at /connect",
    );
  }
}

function buildHeadersUnchecked(op: ApiOperation, session: QasirSessionContext): Headers {
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
    // Only JSON ajax routes are XHRs; SSR pages are plain navigations and
    // Laravel switches response format on this header.
    if (op.responseKind === "json") h.set("x-requested-with", "XMLHttpRequest");
  }
  return h;
}

function normalizeResponse(
  op: ApiOperation,
  status: number,
  text: string,
  input: ValidatedInput,
): unknown {
  if (status >= 300 && status < 400) {
    throw new AppError(ErrorCodes.UPSTREAM_ERROR, `Unexpected upstream status ${status}`);
  }
  if (op.responseKind === "html") {
    if (status >= 400) {
      throw new AppError(ErrorCodes.UPSTREAM_ERROR, `HTML upstream ${status}`);
    }
    const page = typeof input.query.page === "number" ? input.query.page : undefined;
    if (op.operationId === "suppliers.listHtml") {
      return parseSuppliersHtml(text, { requestedPage: page });
    }
    if (op.operationId === "stockAdjustment.historyHtml") {
      return parseStockAdjustmentHtml(text, { requestedPage: page });
    }
    return { htmlLength: text.length };
  }
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    if (looksLikeLoginPage(text)) {
      throw new AppError(
        ErrorCodes.QASIR_AUTH_EXPIRED,
        "Qasir returned a sign-in page instead of JSON; reconnect at /connect",
      );
    }
    throw new AppError(
      ErrorCodes.UPSTREAM_ERROR,
      status >= 400 ? `Upstream ${status} (non-JSON body)` : "Non-JSON upstream body",
    );
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
