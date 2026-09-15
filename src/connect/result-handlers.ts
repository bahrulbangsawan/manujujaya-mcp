import { AppError, ErrorCodes, type ErrorCode } from "../errors/codes";
import { log } from "../observability/log";
import type { QasirSessionsStub } from "../session/qasir-session";
import { maskTokenPrefix } from "../session/types";
import { htmlResponse } from "../web/html";
import {
  connectErrorHtml,
  connectPasteNeededHtml,
  connectSelectOutletHtml,
  connectSuccessHtml,
} from "./html";
import type { LoginFlowResult } from "./login-flow";

const MAX_BODY_BYTES = 32_000;

export function wantsJson(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  const ct = request.headers.get("content-type") ?? "";
  return (
    accept.includes("application/json") ||
    ct.includes("application/json") ||
    new URL(request.url).searchParams.get("format") === "json"
  );
}

/** JSON for /connect/*: never cached (bodies can carry session status). */
export function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function readBody(request: Request): Promise<Record<string, string>> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
    throw new AppError(ErrorCodes.INVALID_INPUT, "Request body too large");
  }
  const ct = request.headers.get("content-type") ?? "";
  const out: Record<string, string> = {};
  try {
    if (ct.includes("application/json")) {
      const json: unknown = await request.json();
      if (!json || typeof json !== "object" || Array.isArray(json)) {
        throw new AppError(ErrorCodes.INVALID_INPUT, "JSON body must be an object");
      }
      for (const [k, v] of Object.entries(json)) {
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
          out[k] = String(v);
        }
      }
      return out;
    }
    const fd = await request.formData();
    for (const [k, v] of fd.entries()) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  } catch (err) {
    if (appErrorLike(err)) throw err;
    throw new AppError(ErrorCodes.INVALID_INPUT, "Unreadable request body");
  }
}

export interface AppErrorLike {
  code: ErrorCode;
  status: number;
  message: string;
}

/**
 * AppError detection that survives Durable Object RPC: errors thrown inside a DO
 * reach the caller as plain Error with name "AppError" and code/status copied (C4).
 */
export function appErrorLike(err: unknown): AppErrorLike | null {
  if (err instanceof AppError) return { code: err.code, status: err.status, message: err.message };
  if (!err || typeof err !== "object") return null;
  const e = err as { name?: unknown; code?: unknown; status?: unknown; message?: unknown };
  if (e.name !== "AppError" || typeof e.code !== "string") return null;
  const code = e.code as ErrorCode;
  let status = 500;
  if (typeof e.status === "number" && e.status >= 400 && e.status <= 599) status = e.status;
  else if (Object.hasOwn(ErrorCodes, code)) status = new AppError(code, "").status;
  return { code, status, message: typeof e.message === "string" ? e.message : "Error" };
}

export async function respondLoginResult(opts: {
  request: Request;
  result: LoginFlowResult;
  doStub: QasirSessionsStub;
  subject: string;
  csrfToken: string;
  merchantSlug: string;
  outletIdDefault: string;
}): Promise<Response> {
  const { request, result, doStub, subject, csrfToken, merchantSlug, outletIdDefault } = opts;
  const json = wantsJson(request);

  if (result.kind === "next_step") {
    await doStub.savePending(result.pending);
    if (json) {
      return jsonResponse({
        next_step: result.step,
        outlets: result.outlets,
        merchant_id: result.merchantId,
        pin_required: true,
      });
    }
    return htmlResponse(connectSelectOutletHtml({ csrfToken, outlets: result.outlets }));
  }

  // Every other outcome ends the multi-step flow: never leave pending state behind.
  if (result.kind === "error") {
    await doStub.clearPending();
    if (json) {
      return jsonResponse({ code: ErrorCodes.UNAUTHORIZED, message: result.message }, 401);
    }
    return htmlResponse(connectErrorHtml({ csrfToken, message: result.message }), 401);
  }

  if (result.kind === "needs_paste") {
    await doStub.clearPending();
    if (json) {
      return jsonResponse({ needs_paste: true, merchantSlug, reason: result.reason });
    }
    return htmlResponse(connectPasteNeededHtml({ csrfToken, merchantSlug, reason: result.reason }));
  }

  // saveSession also clears pending. The slug is always the configured one.
  await doStub.saveSession({
    apiToken: result.apiToken,
    csrfToken: result.csrfToken,
    cookieJar: result.cookieJar,
    merchantSlug,
    outletId: result.outletId || outletIdDefault,
    deviceId: result.deviceId,
    subject,
  });
  log("info", "connect.login.success", {
    subject,
    merchantSlug,
    tokenPrefix: maskTokenPrefix(result.apiToken),
  });

  if (json) {
    return jsonResponse({
      connected: true,
      merchantSlug,
      apiTokenPrefix: maskTokenPrefix(result.apiToken),
    });
  }
  return htmlResponse(
    connectSuccessHtml({
      csrfToken,
      merchantSlug,
      tokenPrefix: maskTokenPrefix(result.apiToken),
      via: "login",
    }),
  );
}

export function mapConnectError(request: Request, csrfToken: string, err: unknown): Response {
  const app = appErrorLike(err);
  if (app) {
    if (wantsJson(request)) {
      return jsonResponse({ code: app.code, message: app.message }, app.status);
    }
    return htmlResponse(connectErrorHtml({ csrfToken, message: app.message }), app.status);
  }
  log("error", "connect.unhandled", {
    err: err instanceof Error ? err.name : typeof err,
  });
  if (wantsJson(request)) {
    return jsonResponse({ code: ErrorCodes.UPSTREAM_ERROR, message: "Internal error" }, 500);
  }
  return htmlResponse(connectErrorHtml({ csrfToken, message: "Internal error. Try again." }), 500);
}
