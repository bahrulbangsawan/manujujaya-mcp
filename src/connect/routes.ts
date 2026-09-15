import { clientIp } from "../auth/owner";
import { AppError, ErrorCodes } from "../errors/codes";
import { log } from "../observability/log";
import {
  CompositeQasirSessionProvider,
  sessionsDoForMerchant,
  StaticQasirSessionProvider,
  type QasirSessionsStub,
} from "../session/qasir-session";
import { maskTokenPrefix } from "../session/types";
import { htmlResponse } from "../web/html";
import {
  assertFormCsrf,
  requireConnectAccess,
  withSetCookies,
  type ConnectGateEnv,
  type ConnectIdentity,
} from "./gate";
import {
  connectErrorHtml,
  connectLoginPage,
  connectPendingHtml,
  connectSuccessHtml,
} from "./html";
import { continueWithOutlet, runQasirLoginFlow } from "./login-flow";
import { normalizeUsername } from "./login-parse";
import { validatePasteInput } from "./paste";
import {
  appErrorLike,
  jsonResponse,
  mapConnectError,
  readBody,
  respondLoginResult,
  wantsJson,
} from "./result-handlers";

export interface ConnectEnv extends ConnectGateEnv {
  MERCHANT_SLUG: string;
  DEFAULT_OUTLET_ID: string;
  QASIR_API_TOKEN?: string;
  QASIR_CSRF_TOKEN?: string;
  QASIR_COOKIE?: string;
  QASIR_SESSIONS: DurableObjectNamespace;
}

const LOGIN_WINDOW_MS = 15 * 60_000;

/**
 * PIN attempts (login and outlet-select) are limited per IP, per normalized
 * username and globally, so reformatting a phone number buys no extra guesses.
 * The DO stores only SHA-256 hashes of these keys.
 */
async function pinAttemptAllowed(
  doStub: QasirSessionsStub,
  request: Request,
  username: string,
): Promise<{ ok: true } | { ok: false; retryAfterMs: number }> {
  const user = normalizeUsername(username) || "(empty)";
  const results = await Promise.all([
    doStub.checkRateLimit({ key: `connect-pin:ip:${clientIp(request)}`, limit: 10, windowMs: LOGIN_WINDOW_MS }),
    doStub.checkRateLimit({ key: `connect-pin:user:${user}`, limit: 6, windowMs: LOGIN_WINDOW_MS }),
    doStub.checkRateLimit({ key: "connect-pin:global", limit: 20, windowMs: LOGIN_WINDOW_MS }),
  ]);
  const blocked = results.filter((r) => !r.ok);
  if (!blocked.length) return { ok: true };
  return { ok: false, retryAfterMs: Math.max(...blocked.map((r) => r.retryAfterMs)) };
}

function rateLimited(request: Request, identity: ConnectIdentity, retryAfterMs: number): Response {
  const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  const msg = `Too many sign-in attempts; retry in ${seconds}s`;
  const res = wantsJson(request)
    ? jsonResponse({ code: ErrorCodes.QASIR_RATE_LIMITED, message: msg }, 429)
    : htmlResponse(connectErrorHtml({ csrfToken: identity.csrfToken, message: msg }), 429);
  res.headers.set("retry-after", String(seconds));
  return res;
}

function optionalText(value: string | undefined, re: RegExp): string | undefined {
  const v = value?.trim();
  return v && re.test(v) ? v : undefined;
}

function gone(request: Request, identity: ConnectIdentity, msg: string): Response {
  return wantsJson(request)
    ? jsonResponse({ code: ErrorCodes.INVALID_INPUT, message: msg }, 410)
    : htmlResponse(connectErrorHtml({ csrfToken: identity.csrfToken, message: msg }), 410);
}

/** Runs a login step; any thrown failure also drops pending state so nothing lingers. */
async function withPendingCleanup(doStub: QasirSessionsStub, step: () => Promise<Response>): Promise<Response> {
  try {
    return await step();
  } catch (err) {
    await doStub.clearPending().catch(() => undefined);
    throw err;
  }
}

export async function handleConnectRoutes(
  request: Request,
  env: ConnectEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/connect" && !url.pathname.startsWith("/connect/")) return null;

  let identity: ConnectIdentity;
  try {
    identity = await requireConnectAccess(request, env);
  } catch (err) {
    const app = appErrorLike(err);
    if (!app) throw err;
    if (request.method === "GET" && !wantsJson(request)) {
      const next = encodeURIComponent(`${url.pathname}${url.search}`);
      return new Response(null, {
        status: 302,
        headers: { location: `/login?next=${next}`, "cache-control": "no-store" },
      });
    }
    return jsonResponse({ code: app.code, message: app.message }, app.status);
  }

  const doStub = sessionsDoForMerchant(env.QASIR_SESSIONS, env.MERCHANT_SLUG);
  const respond = (res: Response) => withSetCookies(res, identity.setCookies);
  const loginResultOpts = {
    request,
    doStub,
    subject: identity.subject,
    csrfToken: identity.csrfToken,
    merchantSlug: env.MERCHANT_SLUG,
    outletIdDefault: env.DEFAULT_OUTLET_ID,
  };

  try {
    if (request.method === "GET" && url.pathname === "/connect") {
      const pending = await doStub.getPending();
      const html = pending
        ? connectPendingHtml(identity.csrfToken, pending)
        : connectLoginPage({ csrfToken: identity.csrfToken });
      return respond(htmlResponse(html));
    }

    if (request.method === "GET" && url.pathname === "/connect/status") {
      return respond(jsonResponse(await connectStatus(env, doStub, identity)));
    }

    if (request.method === "POST" && url.pathname === "/connect/login") {
      const body = await readBody(request);
      await assertFormCsrf(identity, body.csrf);
      const rate = await pinAttemptAllowed(doStub, request, body.username ?? "");
      if (!rate.ok) return respond(rateLimited(request, identity, rate.retryAfterMs));
      log("info", "connect.login.start", {
        subject: identity.subject,
        usernameLen: (body.username ?? "").length,
      });
      return respond(
        await withPendingCleanup(doStub, async () => {
          const result = await runQasirLoginFlow({
            username: body.username ?? "",
            pin: body.pin ?? "",
            deviceId: await doStub.getOrCreateDeviceId(),
            preferredMerchantSlug: env.MERCHANT_SLUG,
            timezone: optionalText(body.timezone, /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){1,2}$/),
            deviceType: optionalText(body.deviceType, /^[\x20-\x7e·]{1,64}$/),
          });
          return respondLoginResult({ ...loginResultOpts, result });
        }),
      );
    }

    if (request.method === "POST" && url.pathname === "/connect/select-outlet") {
      const body = await readBody(request);
      await assertFormCsrf(identity, body.csrf);
      const pending = await doStub.getPending();
      if (!pending) {
        throw new AppError(ErrorCodes.INVALID_INPUT, "No pending outlet selection; sign in again");
      }
      const rate = await pinAttemptAllowed(doStub, request, pending.username);
      if (!rate.ok) return respond(rateLimited(request, identity, rate.retryAfterMs));
      const outletId = /^\d{1,15}$/.test(body.outletId?.trim() ?? "") ? Number(body.outletId) : NaN;
      return respond(
        await withPendingCleanup(doStub, async () => {
          const result = await continueWithOutlet({
            pending,
            outletId,
            pin: body.pin ?? "",
            merchantSlug: env.MERCHANT_SLUG,
          });
          return respondLoginResult({ ...loginResultOpts, result });
        }),
      );
    }

    if (request.method === "POST" && url.pathname === "/connect/cancel") {
      const body = await readBody(request);
      await assertFormCsrf(identity, body.csrf);
      await doStub.clearPending();
      if (wantsJson(request)) return respond(jsonResponse({ pending: false }));
      return respond(htmlResponse(connectLoginPage({ csrfToken: identity.csrfToken })));
    }

    if (url.pathname === "/connect/select-merchant") {
      return respond(
        gone(request, identity, `Merchant selection is automatic (${env.MERCHANT_SLUG}); sign in again.`),
      );
    }

    if (url.pathname === "/connect/verify-otp" || url.pathname === "/connect/resend-otp") {
      return respond(
        gone(
          request,
          identity,
          "OTP flows are gone (410). Connect supports phone/email + PIN only; OTP accounts are not supported.",
        ),
      );
    }

    if (request.method === "POST" && url.pathname === "/connect/paste") {
      const body = await readBody(request);
      await assertFormCsrf(identity, body.csrf);
      const validated = validatePasteInput({
        apiToken: body.apiToken ?? "",
        csrfToken: body.csrfToken ?? "",
        cookie: body.cookie ?? "",
        outletId: body.outletId,
      });
      const slug = env.MERCHANT_SLUG;
      await doStub.saveSession({
        apiToken: validated.apiToken,
        csrfToken: validated.csrfToken,
        cookieJar: validated.cookieJar,
        merchantSlug: slug,
        outletId: validated.outletId || env.DEFAULT_OUTLET_ID,
        subject: identity.subject,
      });
      const tokenPrefix = maskTokenPrefix(validated.apiToken);
      log("info", "connect.paste.success", { subject: identity.subject, merchantSlug: slug, tokenPrefix });
      if (wantsJson(request)) {
        return respond(jsonResponse({ connected: true, merchantSlug: slug, apiTokenPrefix: tokenPrefix }));
      }
      return respond(
        htmlResponse(
          connectSuccessHtml({ csrfToken: identity.csrfToken, merchantSlug: slug, tokenPrefix, via: "paste" }),
        ),
      );
    }

    if (request.method === "POST" && url.pathname === "/connect/disconnect") {
      const body = await readBody(request);
      await assertFormCsrf(identity, body.csrf);
      await doStub.clear();
      await doStub.clearPending();
      log("info", "connect.disconnect", { subject: identity.subject });
      if (wantsJson(request)) {
        return respond(jsonResponse({ connected: false }));
      }
      return respond(
        htmlResponse(
          connectLoginPage({
            csrfToken: identity.csrfToken,
            statusHtml: '<div class="ok">Disconnected. DO session cleared.</div>',
          }),
        ),
      );
    }

    return respond(
      new Response("Not Found", { status: 404, headers: { "cache-control": "no-store" } }),
    );
  } catch (err) {
    return respond(mapConnectError(request, identity.csrfToken, err));
  }
}

async function connectStatus(
  env: ConnectEnv,
  doStub: QasirSessionsStub,
  identity: ConnectIdentity,
): Promise<Record<string, unknown>> {
  const doStatus = await doStub.status();
  if (doStatus.connected) {
    return {
      connected: true,
      merchantSlug: env.MERCHANT_SLUG,
      outletId: doStatus.outletId,
      connectedAt: doStatus.connectedAt,
      source: "do",
      subject: identity.subject,
    };
  }
  try {
    const s = await new StaticQasirSessionProvider(env).getSession();
    return {
      connected: true,
      merchantSlug: s.merchantSlug,
      outletId: s.defaultOutletId,
      source: "static",
      pendingStep: doStatus.pendingStep,
      subject: identity.subject,
    };
  } catch {
    return { connected: false, pendingStep: doStatus.pendingStep, subject: identity.subject };
  }
}

/** Build the merchant-wide session provider for MCP: Connect DO session, else static secrets. */
export function createSessionProvider(env: ConnectEnv): CompositeQasirSessionProvider {
  return new CompositeQasirSessionProvider({
    env,
    sessionsDo: sessionsDoForMerchant(env.QASIR_SESSIONS, env.MERCHANT_SLUG),
  });
}
