import { AppError, ErrorCodes } from "../errors/codes";
import { log } from "../observability/log";
import {
  CompositeQasirSessionProvider,
  sessionsDoForSubject,
  StaticQasirSessionProvider,
} from "../session/qasir-session";
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
  connectPendingHtml,
  connectSuccessHtml,
  connectVerifyOtpHtml,
  htmlResponse,
} from "./html";
import {
  continueWithMerchant,
  continueWithOutlet,
  continueWithOtp,
  resendOtp,
  runQasirLoginFlow,
} from "./login-flow";
import { validatePasteInput } from "./paste";
import {
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
      const pending = await doStub.getPending();
      if (pending) {
        return respond(
          htmlResponse(connectPendingHtml(identity.csrfToken, pending)),
        );
      }
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
          pendingStep: doStatus.pendingStep,
          subject: identity.subject,
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
        usernameLen: (body.username ?? "").length,
      });
      const result = await runQasirLoginFlow({
        username: body.username ?? "",
        pin: body.pin ?? "",
        timezone: body.timezone,
        deviceType: body.deviceType,
        merchantId: body.merchantId ? Number(body.merchantId) : undefined,
      });
      return respond(
        await respondLoginResult({
          request,
          result,
          doStub,
          subject: identity.subject,
          csrfToken: identity.csrfToken,
          merchantSlugDefault: env.MERCHANT_SLUG,
          outletIdDefault: env.DEFAULT_OUTLET_ID,
        }),
      );
    }

    if (
      request.method === "POST" &&
      url.pathname === "/connect/select-merchant"
    ) {
      const body = await readBody(request);
      assertFormCsrf(identity, body.csrf);
      const pending = await doStub.getPending();
      if (!pending || pending.step !== "select_merchant") {
        throw new AppError(
          ErrorCodes.INVALID_INPUT,
          "No pending select_merchant step",
        );
      }
      const result = await continueWithMerchant({
        pending,
        merchantId: Number(body.merchantId),
      });
      return respond(
        await respondLoginResult({
          request,
          result,
          doStub,
          subject: identity.subject,
          csrfToken: identity.csrfToken,
          merchantSlugDefault: env.MERCHANT_SLUG,
          outletIdDefault: env.DEFAULT_OUTLET_ID,
        }),
      );
    }

    if (request.method === "POST" && url.pathname === "/connect/select-outlet") {
      const body = await readBody(request);
      assertFormCsrf(identity, body.csrf);
      const pending = await doStub.getPending();
      if (!pending || pending.step !== "select_outlet") {
        throw new AppError(
          ErrorCodes.INVALID_INPUT,
          "No pending select_outlet step",
        );
      }
      const result = await continueWithOutlet({
        pending,
        outletId: Number(body.outletId),
        merchantId: body.merchantId ? Number(body.merchantId) : undefined,
      });
      return respond(
        await respondLoginResult({
          request,
          result,
          doStub,
          subject: identity.subject,
          csrfToken: identity.csrfToken,
          merchantSlugDefault: env.MERCHANT_SLUG,
          outletIdDefault: env.DEFAULT_OUTLET_ID,
        }),
      );
    }

    if (request.method === "POST" && url.pathname === "/connect/verify-otp") {
      const body = await readBody(request);
      assertFormCsrf(identity, body.csrf);
      const pending = await doStub.getPending();
      if (!pending || pending.step !== "verify_otp") {
        throw new AppError(
          ErrorCodes.INVALID_INPUT,
          "No pending verify_otp step",
        );
      }
      const result = await continueWithOtp({
        pending,
        code: body.code ?? "",
      });
      return respond(
        await respondLoginResult({
          request,
          result,
          doStub,
          subject: identity.subject,
          csrfToken: identity.csrfToken,
          merchantSlugDefault: env.MERCHANT_SLUG,
          outletIdDefault: env.DEFAULT_OUTLET_ID,
        }),
      );
    }

    if (request.method === "POST" && url.pathname === "/connect/resend-otp") {
      const body = await readBody(request);
      assertFormCsrf(identity, body.csrf);
      const pending = await doStub.getPending();
      if (!pending || pending.step !== "verify_otp") {
        throw new AppError(
          ErrorCodes.INVALID_INPUT,
          "No pending verify_otp step",
        );
      }
      const out = await resendOtp({ pending });
      if (out.cookieJar !== pending.cookieJar) {
        await doStub.savePending({ ...pending, cookieJar: out.cookieJar });
      }
      if (wantsJson(request)) {
        return respond(
          Response.json({ ok: out.ok, message: out.message }, { status: out.ok ? 200 : 400 }),
        );
      }
      return respond(
        htmlResponse(
          connectVerifyOtpHtml({
            csrfToken: identity.csrfToken,
            mobile: pending.mobile,
            message: out.message,
          }),
          out.ok ? 200 : 400,
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
      await doStub.clearPending();
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
    return respond(mapConnectError(request, identity.csrfToken, err));
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
