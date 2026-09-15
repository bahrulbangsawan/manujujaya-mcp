import { AppError, ErrorCodes } from "../errors/codes";
import type { PendingAuthState } from "../session/types";
import { mergeCookies, parseSetCookieHeaders } from "./cookie-jar";
import { extractApiTokenFromHtml, extractCsrfFromHtml } from "./extract-token";
import {
  matchConfiguredMerchant,
  parseLoginResponse,
  type ParsedLoginResponse,
} from "./login-parse";
import {
  assertQasirRedirectUrl,
  merchantSlugFromQasirHost,
} from "./redirect-allowlist";

export type LoginFlowResult =
  | {
      kind: "connected";
      apiToken: string;
      csrfToken: string;
      cookieJar: string;
      merchantSlug: string;
      deviceId: string;
      outletId?: string;
      redirectUrl: string;
    }
  | {
      kind: "needs_paste";
      csrfToken: string;
      cookieJar: string;
      merchantSlug: string;
      deviceId: string;
      outletId?: string;
      redirectUrl: string;
      reason: string;
    }
  | {
      kind: "next_step";
      step: "select_merchant" | "select_outlet";
      parsed: ParsedLoginResponse;
      cookieJar: string;
      deviceId: string;
      csrfToken: string;
      username: string;
      pin: string;
      deviceType: string;
      timezone: string;
      merchantId?: number;
    }
  | { kind: "error"; message: string; status?: number };

const SIGN_IN = "https://www.qasir.id/sign-in?lang=id";
export const LOGIN_URL = "https://www.qasir.id/api/auth/login";
export const DEVICE_LANG_URL = "https://www.qasir.id/api/auth/device-language";
export const OUTLET_SELECT_URL = "https://www.qasir.id/api/auth/outlet-select";
export const SIGN_IN_URL = SIGN_IN;

export function wwwHeaders(csrf: string, jar: string): Headers {
  const h = new Headers();
  h.set("content-type", "application/json");
  h.set("origin", "https://www.qasir.id");
  h.set("referer", SIGN_IN);
  h.set("x-csrf-token", csrf);
  h.set("x-requested-with", "XMLHttpRequest");
  h.set("cookie", jar);
  h.set("accept", "application/json");
  return h;
}

export function decodeCookieToken(jar: string, name: string): string | null {
  for (const part of jar.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    const raw = part.slice(eq + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}

export async function resolveAuthJson(ctx: {
  fetchImpl: typeof fetch;
  jar: string;
  wwwCsrf: string;
  deviceId: string;
  username: string;
  pin: string;
  deviceType: string;
  timezone: string;
  merchantId?: number;
  outletId?: string;
  /** When set, select_merchant is auto-resolved — never returned as UI. */
  preferredMerchantSlug?: string;
  res: Response;
}): Promise<LoginFlowResult> {
  let loginJson: unknown;
  try {
    loginJson = await ctx.res.json();
  } catch {
    return {
      kind: "error",
      message: "Auth returned non-JSON",
      status: ctx.res.status,
    };
  }

  const parsed = parseLoginResponse(loginJson);
  if (!parsed.ok) {
    return {
      kind: "error",
      message: parsed.message || "Auth failed",
      status: ctx.res.status,
    };
  }

  if (parsed.nextStep === "select_merchant") {
    const preferred = ctx.preferredMerchantSlug?.trim();
    if (preferred) {
      const match = matchConfiguredMerchant(parsed.merchants ?? [], preferred);
      if (!match.ok) {
        return { kind: "error", message: match.message };
      }
      if (ctx.merchantId !== undefined) {
        return {
          kind: "error",
          message:
            "Login still requires merchant selection after merchant_id was sent; " +
            "only the configured merchant is allowed and picker is disabled",
        };
      }
      // Auto re-POST login with merchant_id (same as continueWithMerchant)
      let jar = ctx.jar;
      const body = {
        username: ctx.username,
        password: ctx.pin,
        device_id: ctx.deviceId,
        device_type: ctx.deviceType,
        timezone: ctx.timezone,
        merchant_id: match.merchantId,
      };
      const loginRes = await ctx.fetchImpl(LOGIN_URL, {
        method: "POST",
        headers: wwwHeaders(ctx.wwwCsrf, jar),
        body: JSON.stringify(body),
        redirect: "manual",
      });
      jar = mergeCookies(jar, parseSetCookieHeaders(loginRes.headers));
      return resolveAuthJson({
        ...ctx,
        jar,
        merchantId: match.merchantId,
        preferredMerchantSlug: preferred,
        res: loginRes,
      });
    }
    return {
      kind: "next_step",
      step: "select_merchant",
      parsed,
      cookieJar: ctx.jar,
      deviceId: ctx.deviceId,
      csrfToken: ctx.wwwCsrf,
      username: ctx.username,
      pin: ctx.pin,
      deviceType: ctx.deviceType,
      timezone: ctx.timezone,
      merchantId: ctx.merchantId,
    };
  }

  if (parsed.nextStep === "verify_otp") {
    return {
      kind: "error",
      message:
        "OTP accounts are not supported. Connect only accepts phone/email + PIN " +
        "accounts that land on redirect, merchant selection, or outlet selection. " +
        "Use an account that does not require OTP verification.",
    };
  }

  if (parsed.nextStep === "select_outlet") {
    return {
      kind: "next_step",
      step: "select_outlet",
      parsed,
      cookieJar: ctx.jar,
      deviceId: ctx.deviceId,
      csrfToken: ctx.wwwCsrf,
      username: ctx.username,
      pin: ctx.pin,
      deviceType: ctx.deviceType,
      timezone: ctx.timezone,
      merchantId:
        parsed.merchantId ??
        ctx.merchantId ??
        (typeof parsed.merchant === "object" &&
        parsed.merchant &&
        typeof (parsed.merchant as { id?: number }).id === "number"
          ? (parsed.merchant as { id: number }).id
          : undefined),
    };
  }

  if (parsed.nextStep !== "redirect" || !parsed.redirectUrl) {
    return {
      kind: "error",
      message: `Unexpected next_step: ${parsed.nextStep ?? "null"}`,
    };
  }

  return followRedirectAndScrape({
    fetchImpl: ctx.fetchImpl,
    jar: ctx.jar,
    wwwCsrf: ctx.wwwCsrf,
    deviceId: ctx.deviceId,
    redirectUrlRaw: parsed.redirectUrl,
    outletId: ctx.outletId,
  });
}

export async function followRedirectAndScrape(input: {
  fetchImpl: typeof fetch;
  jar: string;
  wwwCsrf: string;
  deviceId: string;
  redirectUrlRaw: string;
  outletId?: string;
}): Promise<LoginFlowResult> {
  let jar = input.jar;
  let redirectUrl: URL;
  try {
    redirectUrl = assertQasirRedirectUrl(input.redirectUrlRaw);
  } catch (err) {
    if (err instanceof AppError) {
      return { kind: "error", message: err.message };
    }
    throw err;
  }

  const dashRes = await input.fetchImpl(redirectUrl.toString(), {
    method: "GET",
    headers: {
      accept: "text/html",
      cookie: jar,
      referer: SIGN_IN,
    },
    redirect: "manual",
  });
  jar = mergeCookies(jar, parseSetCookieHeaders(dashRes.headers));

  let finalRes = dashRes;
  if (dashRes.status >= 300 && dashRes.status < 400) {
    const loc = dashRes.headers.get("location");
    if (loc) {
      try {
        const next = assertQasirRedirectUrl(
          new URL(loc, redirectUrl).toString(),
        );
        finalRes = await input.fetchImpl(next.toString(), {
          method: "GET",
          headers: { accept: "text/html", cookie: jar },
          redirect: "manual",
        });
        jar = mergeCookies(jar, parseSetCookieHeaders(finalRes.headers));
        redirectUrl = next;
      } catch {
        throw new AppError(
          ErrorCodes.REDIRECT_NOT_ALLOWED,
          "Dashboard redirect not allowlisted",
        );
      }
    }
  }

  const html = await finalRes.text();
  const slug =
    merchantSlugFromQasirHost(redirectUrl.hostname) ??
    redirectUrl.hostname.replace(/\.qasir\.id$/i, "");
  const apiToken = extractApiTokenFromHtml(html);
  const dashCsrf =
    extractCsrfFromHtml(html) ||
    decodeCookieToken(jar, "XSRF-TOKEN") ||
    input.wwwCsrf;

  if (apiToken) {
    return {
      kind: "connected",
      apiToken,
      csrfToken: dashCsrf,
      cookieJar: jar,
      merchantSlug: slug,
      deviceId: input.deviceId,
      outletId: input.outletId,
      redirectUrl: redirectUrl.toString(),
    };
  }

  return {
    kind: "needs_paste",
    csrfToken: dashCsrf,
    cookieJar: jar,
    merchantSlug: slug,
    deviceId: input.deviceId,
    outletId: input.outletId,
    redirectUrl: redirectUrl.toString(),
    reason:
      "API_TOKEN not found in dashboard HTML/JS. Paste API_TOKEN + CSRF + Cookie from DevTools (expected until mint hop is observed).",
  };
}

/** Re-POST login with merchant_id using pending Connect session. */
export async function continueWithMerchant(input: {
  pending: PendingAuthState;
  merchantId: number;
  preferredMerchantSlug?: string;
  fetchImpl?: typeof fetch;
}): Promise<LoginFlowResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const { pending, merchantId } = input;
  if (!Number.isFinite(merchantId) || merchantId <= 0) {
    return { kind: "error", message: "Invalid merchant_id" };
  }
  let jar = pending.cookieJar;
  const body = {
    username: pending.username,
    password: pending.pin,
    device_id: pending.deviceId,
    device_type: pending.deviceType,
    timezone: pending.timezone,
    merchant_id: merchantId,
  };
  const loginRes = await fetchImpl(LOGIN_URL, {
    method: "POST",
    headers: wwwHeaders(pending.csrfToken, jar),
    body: JSON.stringify(body),
    redirect: "manual",
  });
  jar = mergeCookies(jar, parseSetCookieHeaders(loginRes.headers));
  return resolveAuthJson({
    fetchImpl,
    jar,
    wwwCsrf: pending.csrfToken,
    deviceId: pending.deviceId,
    username: pending.username,
    pin: pending.pin,
    deviceType: pending.deviceType,
    timezone: pending.timezone,
    merchantId,
    preferredMerchantSlug: input.preferredMerchantSlug,
    res: loginRes,
  });
}

/** POST /api/auth/outlet-select per docs/auth-login.md. */
export async function continueWithOutlet(input: {
  pending: PendingAuthState;
  outletId: number;
  merchantId?: number;
  preferredMerchantSlug?: string;
  fetchImpl?: typeof fetch;
}): Promise<LoginFlowResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const { pending } = input;
  const merchantId = input.merchantId ?? pending.merchantId;
  if (!merchantId) {
    return { kind: "error", message: "merchant_id required for outlet-select" };
  }
  if (!Number.isFinite(input.outletId) || input.outletId <= 0) {
    return { kind: "error", message: "Invalid outlet_id" };
  }
  const locked = pending.outlets?.find((o) => o.id === input.outletId);
  if (locked?.is_lock) {
    return { kind: "error", message: "Outlet is locked" };
  }

  let jar = pending.cookieJar;
  const body = {
    username: pending.username,
    password: pending.pin,
    device_id: pending.deviceId,
    device_type: pending.deviceType,
    timezone: pending.timezone,
    merchant_id: merchantId,
    outlet_id: input.outletId,
  };
  const res = await fetchImpl(OUTLET_SELECT_URL, {
    method: "POST",
    headers: wwwHeaders(pending.csrfToken, jar),
    body: JSON.stringify(body),
    redirect: "manual",
  });
  jar = mergeCookies(jar, parseSetCookieHeaders(res.headers));
  return resolveAuthJson({
    fetchImpl,
    jar,
    wwwCsrf: pending.csrfToken,
    deviceId: pending.deviceId,
    username: pending.username,
    pin: pending.pin,
    deviceType: pending.deviceType,
    timezone: pending.timezone,
    merchantId,
    outletId: String(input.outletId),
    preferredMerchantSlug: input.preferredMerchantSlug,
    res,
  });
}

export function pendingFromNextStep(
  result: Extract<LoginFlowResult, { kind: "next_step" }>,
): Omit<PendingAuthState, "createdAt" | "expiresAt"> {
  if (result.step !== "select_merchant" && result.step !== "select_outlet") {
    throw new AppError(
      ErrorCodes.INVALID_INPUT,
      `Cannot persist pending step: ${result.step}`,
    );
  }
  return {
    username: result.username,
    pin: result.pin,
    deviceId: result.deviceId,
    deviceType: result.deviceType,
    timezone: result.timezone,
    cookieJar: result.cookieJar,
    csrfToken: result.csrfToken,
    step: result.step,
    merchantId: result.merchantId ?? result.parsed.merchantId,
    mobile: result.parsed.mobile,
    verifyKey: result.parsed.verifyKey,
    merchants: result.parsed.merchants,
    outlets: result.parsed.outlets,
  };
}
