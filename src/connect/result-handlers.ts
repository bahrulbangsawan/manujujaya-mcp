import { AppError, ErrorCodes } from "../errors/codes";
import { log } from "../observability/log";
import type { QasirSessionsStub } from "../session/qasir-session";
import { maskTokenPrefix } from "../session/types";
import {
  connectErrorHtml,
  connectPasteNeededHtml,
  connectPendingHtml,
  connectSuccessHtml,
  htmlResponse,
} from "./html";
import {
  pendingFromNextStep,
  type LoginFlowResult,
} from "./login-flow";

export function wantsJson(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  const ct = request.headers.get("content-type") ?? "";
  return (
    accept.includes("application/json") ||
    ct.includes("application/json") ||
    new URL(request.url).searchParams.get("format") === "json"
  );
}

export async function readBody(
  request: Request,
): Promise<Record<string, string>> {
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const json = (await request.json()) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(json)) {
      if (v != null) out[k] = String(v);
    }
    return out;
  }
  const fd = await request.formData();
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

export async function respondLoginResult(opts: {
  request: Request;
  result: LoginFlowResult;
  doStub: QasirSessionsStub;
  subject: string;
  csrfToken: string;
  merchantSlugDefault: string;
  outletIdDefault: string;
}): Promise<Response> {
  const {
    request,
    result,
    doStub,
    subject,
    csrfToken,
    merchantSlugDefault,
    outletIdDefault,
  } = opts;
  const json = wantsJson(request);

  if (result.kind === "error") {
    if (json) {
      return Response.json(
        { code: ErrorCodes.UNAUTHORIZED, message: result.message },
        { status: 401 },
      );
    }
    return htmlResponse(
      connectErrorHtml({ csrfToken, message: result.message }),
      401,
    );
  }

  if (result.kind === "next_step") {
    const pending = await doStub.savePending(pendingFromNextStep(result));
    if (json) {
      return Response.json({
        next_step: result.step,
        merchants: result.parsed.merchants,
        outlets: result.parsed.outlets,
        mobile: result.parsed.mobile,
        merchant_id: result.parsed.merchantId ?? result.merchantId,
        verify_key_present: Boolean(result.parsed.verifyKey),
      });
    }
    return htmlResponse(
      connectPendingHtml(csrfToken, pending, undefined, {
        merchantSlugConfigured: merchantSlugDefault,
      }),
    );
  }

  if (result.kind === "needs_paste") {
    await doStub.clearPending();
    if (json) {
      return Response.json({
        needs_paste: true,
        merchantSlug: result.merchantSlug,
        reason: result.reason,
      });
    }
    return htmlResponse(
      connectPasteNeededHtml({
        csrfToken,
        merchantSlug: result.merchantSlug,
        reason: result.reason,
      }),
    );
  }

  await doStub.saveSession({
    apiToken: result.apiToken,
    csrfToken: result.csrfToken,
    cookieJar: result.cookieJar,
    merchantSlug: result.merchantSlug || merchantSlugDefault,
    outletId: result.outletId || outletIdDefault,
    deviceId: result.deviceId,
    subject,
  });
  log("info", "connect.login.success", {
    subject,
    merchantSlug: result.merchantSlug,
    tokenPrefix: maskTokenPrefix(result.apiToken),
  });

  if (json) {
    return Response.json({
      connected: true,
      merchantSlug: result.merchantSlug,
      apiTokenPrefix: maskTokenPrefix(result.apiToken),
    });
  }
  return htmlResponse(
    connectSuccessHtml({
      csrfToken,
      merchantSlug: result.merchantSlug,
      tokenPrefix: maskTokenPrefix(result.apiToken),
      via: "login",
    }),
  );
}

export function mapConnectError(
  request: Request,
  csrfToken: string,
  err: unknown,
): Response {
  if (err instanceof AppError) {
    if (wantsJson(request)) {
      return Response.json(err.toJSON(), { status: err.status });
    }
    return htmlResponse(
      connectErrorHtml({ csrfToken, message: err.message }),
      err.status,
    );
  }
  log("error", "connect.unhandled", {
    err: err instanceof Error ? err.message : String(err),
  });
  return new Response("Internal Error", { status: 500 });
}
