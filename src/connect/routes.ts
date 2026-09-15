import { AppError, ErrorCodes } from "../errors/codes";
import { log } from "../observability/log";
import {
  CompositeQasirSessionProvider,
  sessionsDoForSubject,
  StaticQasirSessionProvider,
} from "../session/qasir-session";
import type { QasirSessionsDO } from "../session/qasir-sessions-do";
import { maskTokenPrefix } from "../session/types";
import {
  assertFormCsrf,
  requireConnectAccess,
  withSetCookies,
  type ConnectGateEnv,
} from "./gate";
import {
  connectErrorHtml,
  connectLoginPage,
  connectNextStepHtml,
  connectPasteNeededHtml,
  connectSuccessHtml,
  htmlResponse,
} from "./html";
import { runQasirLoginFlow } from "./login-flow";
import { validatePasteInput } from "./paste";

export interface ConnectEnv extends ConnectGateEnv {
  MERCHANT_SLUG: string;
  DEFAULT_OUTLET_ID: string;
  QASIR_API_TOKEN?: string;
  QASIR_CSRF_TOKEN?: string;
  QASIR_COOKIE?: string;
  QASIR_SESSIONS: DurableObjectNamespace;
}

function wantsJson(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  const ct = request.headers.get("content-type") ?? "";
  return (
    accept.includes("application/json") ||
    ct.includes("application/json") ||
    new URL(request.url).searchParams.get("format") === "json"
  );
}

async function readBody(
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

function clientKey(request: Request, username?: string): string {
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  return `${ip}:${username ?? ""}`.slice(0, 200);
}

export async function handleConnectRoutes(
  request: Request,
  env: ConnectEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/connect")) return null;

  let identity;
  try {
    identity = await requireConnectAccess(request, env);
  } catch (err) {
    if (err instanceof AppError) {
      return Response.json(err.toJSON(), { status: err.status });
    }
    throw err;
  }

  const doStub = sessionsDoForSubject(env.QASIR_SESSIONS, identity.subject);
  const respond = (res: Response) =>
    withSetCookies(res, identity.setCookies);

  try {
    if (request.method === "GET" && url.pathname === "/connect") {
      return respond(
        htmlResponse(connectLoginPage({ csrfToken: identity.csrfToken })),
      );
    }

    if (request.method === "GET" && url.pathname === "/connect/status") {
      const doStatus = await doStub.status();
      let source: "do" | "static" | undefined = doStatus.connected
        ? "do"
        : undefined;
      let connected = doStatus.connected;
      let merchantSlug = doStatus.merchantSlug;
      let outletId = doStatus.outletId;
      let connectedAt = doStatus.connectedAt;

      if (!connected) {
        try {
          const staticProv = new StaticQasirSessionProvider(env);
          const s = await staticProv.getSession();
          connected = true;
          source = "static";
          merchantSlug = s.merchantSlug;
          outletId = s.defaultOutletId;
        } catch {
          // remain disconnected
        }
      }

      return respond(
        Response.json({
          connected,
          merchantSlug,
          outletId,
          connectedAt,
          source,
          subject: identity.subject,
          // never raw secrets
        }),
      );
    }

    if (request.method === "POST" && url.pathname === "/connect/login") {
      const body = await readBody(request);
      assertFormCsrf(identity, body.csrf);

      const rate = await doStub.checkRateLimit({
        key: clientKey(request, body.username),
      });
      if (!rate.ok) {
        const msg = `Too many login attempts; retry in ${Math.ceil(rate.retryAfterMs / 1000)}s`;
        if (wantsJson(request)) {
          return respond(
            Response.json(
              { code: ErrorCodes.QASIR_RATE_LIMITED, message: msg },
              { status: 429 },
            ),
          );
        }
        return respond(
          htmlResponse(
            connectErrorHtml({ csrfToken: identity.csrfToken, message: msg }),
            429,
          ),
        );
      }

      log("info", "connect.login.start", {
        subject: identity.subject,
        // never log PIN or username in full — hash-ish only
        usernameLen: (body.username ?? "").length,
      });

      const result = await runQasirLoginFlow({
        username: body.username ?? "",
        pin: body.pin ?? "",
        timezone: body.timezone,
        deviceType: body.deviceType,
        merchantId: body.merchantId ? Number(body.merchantId) : undefined,
      });

      if (result.kind === "error") {
        if (wantsJson(request)) {
          return respond(
            Response.json(
              { code: ErrorCodes.UNAUTHORIZED, message: result.message },
              { status: 401 },
            ),
          );
        }
        return respond(
          htmlResponse(
            connectErrorHtml({
              csrfToken: identity.csrfToken,
              message: result.message,
            }),
            401,
          ),
        );
      }

      if (result.kind === "next_step") {
        const detail = JSON.stringify(
          {
            next_step: result.step,
            merchants: result.parsed.merchants,
            outlets: result.parsed.outlets,
            merchant: result.parsed.merchant,
            mobile: result.parsed.mobile,
            merchant_id: result.parsed.merchantId,
            // omit verify_key from HTML? keep for OTP stub — it's not PIN
            verify_key_present: Boolean(result.parsed.verifyKey),
          },
          null,
          2,
        );
        if (wantsJson(request)) {
          return respond(
            Response.json({
              next_step: result.step,
              data: result.parsed,
              message: "Additional step required; use Qasir UI or paste fallback",
            }),
          );
        }
        return respond(
          htmlResponse(
            connectNextStepHtml({
              csrfToken: identity.csrfToken,
              step: result.step,
              detail,
            }),
          ),
        );
      }

      if (result.kind === "needs_paste") {
        if (wantsJson(request)) {
          return respond(
            Response.json({
              needs_paste: true,
              merchantSlug: result.merchantSlug,
              reason: result.reason,
            }),
          );
        }
        return respond(
          htmlResponse(
            connectPasteNeededHtml({
              csrfToken: identity.csrfToken,
              merchantSlug: result.merchantSlug,
              reason: result.reason,
            }),
          ),
        );
      }

      // connected
      await doStub.saveSession({
        apiToken: result.apiToken,
        csrfToken: result.csrfToken,
        cookieJar: result.cookieJar,
        merchantSlug: result.merchantSlug || env.MERCHANT_SLUG,
        outletId: env.DEFAULT_OUTLET_ID,
        deviceId: result.deviceId,
        subject: identity.subject,
      });
      log("info", "connect.login.success", {
        subject: identity.subject,
        merchantSlug: result.merchantSlug,
        tokenPrefix: maskTokenPrefix(result.apiToken),
      });

      if (wantsJson(request)) {
        return respond(
          Response.json({
            connected: true,
            merchantSlug: result.merchantSlug,
            apiTokenPrefix: maskTokenPrefix(result.apiToken),
          }),
        );
      }
      return respond(
        htmlResponse(
          connectSuccessHtml({
            csrfToken: identity.csrfToken,
            merchantSlug: result.merchantSlug,
            tokenPrefix: maskTokenPrefix(result.apiToken),
            via: "login",
          }),
        ),
      );
    }

    if (request.method === "POST" && url.pathname === "/connect/paste") {
      const body = await readBody(request);
      assertFormCsrf(identity, body.csrf);
      const validated = validatePasteInput({
        apiToken: body.apiToken ?? "",
        csrfToken: body.csrfToken ?? "",
        cookie: body.cookie ?? "",
        outletId: body.outletId,
        merchantSlug: body.merchantSlug,
      });
      const slug = validated.merchantSlug || env.MERCHANT_SLUG;
      await doStub.saveSession({
        apiToken: validated.apiToken,
        csrfToken: validated.csrfToken,
        cookieJar: validated.cookieJar,
        merchantSlug: slug,
        outletId: validated.outletId || env.DEFAULT_OUTLET_ID,
        subject: identity.subject,
      });
      log("info", "connect.paste.success", {
        subject: identity.subject,
        merchantSlug: slug,
        tokenPrefix: maskTokenPrefix(validated.apiToken),
      });
      if (wantsJson(request)) {
        return respond(
          Response.json({
            connected: true,
            merchantSlug: slug,
            apiTokenPrefix: maskTokenPrefix(validated.apiToken),
          }),
        );
      }
      return respond(
        htmlResponse(
          connectSuccessHtml({
            csrfToken: identity.csrfToken,
            merchantSlug: slug,
            tokenPrefix: maskTokenPrefix(validated.apiToken),
            via: "paste",
          }),
        ),
      );
    }

    if (request.method === "POST" && url.pathname === "/connect/disconnect") {
      const body = await readBody(request);
      assertFormCsrf(identity, body.csrf);
      await doStub.clear();
      log("info", "connect.disconnect", { subject: identity.subject });
      if (wantsJson(request)) {
        return respond(Response.json({ connected: false }));
      }
      return respond(
        htmlResponse(
          connectLoginPage({
            csrfToken: identity.csrfToken,
            statusHtml:
              '<div class="ok">Disconnected. DO session cleared.</div>',
          }),
        ),
      );
    }

    return respond(new Response("Not Found", { status: 404 }));
  } catch (err) {
    if (err instanceof AppError) {
      if (wantsJson(request)) {
        return respond(Response.json(err.toJSON(), { status: err.status }));
      }
      return respond(
        htmlResponse(
          connectErrorHtml({
            csrfToken: identity.csrfToken,
            message: err.message,
          }),
          err.status,
        ),
      );
    }
    log("error", "connect.unhandled", {
      err: err instanceof Error ? err.message : String(err),
    });
    return respond(new Response("Internal Error", { status: 500 }));
  }
}

/** Build session provider for MCP: DO for subject, else static secrets. */
export function createSessionProvider(
  env: ConnectEnv,
  subject: string,
): CompositeQasirSessionProvider {
  return new CompositeQasirSessionProvider({
    env,
    subject,
    sessionsDo: sessionsDoForSubject(env.QASIR_SESSIONS, subject),
  });
}
