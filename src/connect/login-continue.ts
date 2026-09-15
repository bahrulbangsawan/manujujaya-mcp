import { AppError } from "../errors/codes";
import type { PendingAuthDraft, PendingAuthState, PendingOutlet, WwwCsrf } from "../session/types";
import { CookieJar } from "./cookie-jar";
import { extractApiTokenFromHtml, extractCsrfFromHtml } from "./extract-token";
import {
  isValidPin,
  matchConfiguredMerchant,
  parseLoginResponse,
} from "./login-parse";
import { assertMerchantDashboardUrl } from "./redirect-allowlist";

/** Minimal fetch signature used by the login flow (tests inject mocks). */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export type LoginFlowResult =
  | {
      kind: "connected";
      apiToken: string;
      /** CSRF from the merchant dashboard's `<meta name="csrf-token">`. */
      csrfToken: string;
      /** Cookie header for `https://${merchantSlug}.qasir.id/` only. */
      cookieJar: string;
      /** Always the configured MERCHANT_SLUG. */
      merchantSlug: string;
      deviceId: string;
      outletId?: string;
    }
  | {
      kind: "needs_paste";
      merchantSlug: string;
      deviceId: string;
      outletId?: string;
      reason: string;
    }
  | {
      kind: "next_step";
      step: "select_outlet";
      merchantId: number;
      outlets: PendingOutlet[];
      /** State to persist (no PIN) until the owner picks an outlet and re-enters the PIN. */
      pending: PendingAuthDraft;
    }
  | { kind: "error"; message: string; status?: number };

export const SIGN_IN_URL = "https://www.qasir.id/sign-in?lang=id";
export const LOGIN_URL = "https://www.qasir.id/api/auth/login";
export const DEVICE_LANG_URL = "https://www.qasir.id/api/auth/device-language";
export const OUTLET_SELECT_URL = "https://www.qasir.id/api/auth/outlet-select";
const FETCH_TIMEOUT_MS = 15_000;
const MAX_DASHBOARD_HOPS = 3;

/**
 * Default fetch. Never store the global fetch on an object and call it as a
 * method: workerd throws "Illegal invocation" when `this` is not globalThis.
 */
export const defaultFetch: FetchLike = (input, init) => fetch(input, init);

/** GET/POST with a per-request timeout; `fetchImpl` is always called as a plain function. */
export function timedFetch(fetchImpl: FetchLike, url: string, init: RequestInit): Promise<Response> {
  return fetchImpl(url, { ...init, redirect: "manual", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
}

export function wwwHeaders(csrf: WwwCsrf, jar: CookieJar, url: string): Headers {
  const h = new Headers();
  h.set("content-type", "application/json");
  h.set("origin", "https://www.qasir.id");
  h.set("referer", SIGN_IN_URL);
  h.set(csrf.header, csrf.value);
  h.set("x-requested-with", "XMLHttpRequest");
  const cookie = jar.headerFor(new URL(url));
  if (cookie) h.set("cookie", cookie);
  h.set("accept", "application/json");
  return h;
}

/** In-memory login state. The PIN lives here only for the duration of one HTTP request. */
export interface AuthContext {
  fetchImpl: FetchLike;
  jar: CookieJar;
  wwwCsrf: WwwCsrf;
  deviceId: string;
  username: string;
  pin: string;
  deviceType: string;
  timezone: string;
  /** Configured MERCHANT_SLUG; every landing host must match it. */
  merchantSlug: string;
  merchantId?: number;
  outletId?: string;
}

export async function postAuthJson(ctx: AuthContext, url: string, body: object): Promise<Response> {
  const { fetchImpl, jar } = ctx;
  const res = await timedFetch(fetchImpl, url, {
    method: "POST",
    headers: wwwHeaders(ctx.wwwCsrf, jar, url),
    body: JSON.stringify(body),
  });
  jar.applyResponse(new URL(url), res.headers);
  return res;
}

function loginBody(ctx: AuthContext): Record<string, unknown> {
  return {
    username: ctx.username,
    password: ctx.pin,
    device_id: ctx.deviceId,
    device_type: ctx.deviceType,
    timezone: ctx.timezone,
  };
}

export async function resolveAuthJson(ctx: AuthContext, res: Response): Promise<LoginFlowResult> {
  let loginJson: unknown;
  try {
    loginJson = await res.json();
  } catch {
    return { kind: "error", message: "Auth returned non-JSON", status: res.status };
  }

  const parsed = parseLoginResponse(loginJson);
  if (!parsed.ok) {
    return { kind: "error", message: parsed.message || "Auth failed", status: res.status };
  }

  if (parsed.nextStep === "select_merchant") {
    // Never a picker: auto-continue with the configured merchant only.
    const match = matchConfiguredMerchant(parsed.merchants ?? [], ctx.merchantSlug);
    if (!match.ok) return { kind: "error", message: match.message };
    if (ctx.merchantId !== undefined) {
      return {
        kind: "error",
        message: "Login still requires merchant selection after merchant_id was sent",
      };
    }
    const next = { ...ctx, merchantId: match.merchantId };
    const loginRes = await postAuthJson(next, LOGIN_URL, {
      ...loginBody(next),
      merchant_id: match.merchantId,
    });
    return resolveAuthJson(next, loginRes);
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
    if (ctx.outletId !== undefined) {
      return { kind: "error", message: "Qasir asked for outlet selection again" };
    }
    const merchantId = parsed.merchantId ?? ctx.merchantId;
    if (merchantId === undefined) {
      return { kind: "error", message: "Outlet selection did not include a merchant id" };
    }
    if (ctx.merchantId !== undefined && merchantId !== ctx.merchantId) {
      return { kind: "error", message: "Outlet selection is for a different merchant" };
    }
    const outlets = parsed.outlets ?? [];
    return {
      kind: "next_step",
      step: "select_outlet",
      merchantId,
      outlets,
      pending: {
        step: "select_outlet",
        username: ctx.username,
        deviceId: ctx.deviceId,
        deviceType: ctx.deviceType,
        timezone: ctx.timezone,
        cookies: ctx.jar.toJSON(),
        wwwCsrf: ctx.wwwCsrf,
        merchantId,
        outlets,
      },
    };
  }

  if (parsed.nextStep !== "redirect" || !parsed.redirectUrl) {
    return { kind: "error", message: `Unexpected next_step: ${parsed.nextStep ?? "null"}` };
  }
  return followRedirectAndScrape(ctx, parsed.redirectUrl);
}

/**
 * Follow the tokenWeb hand-off on the configured merchant host only, then scrape
 * API_TOKEN and the dashboard CSRF meta. Any hop off `${merchantSlug}.qasir.id`
 * (another store, www sign-in, product hosts) is an error and nothing is saved.
 */
export async function followRedirectAndScrape(
  ctx: AuthContext,
  redirectUrlRaw: string,
): Promise<LoginFlowResult> {
  const { fetchImpl, jar } = ctx;
  let url: URL;
  try {
    url = assertMerchantDashboardUrl(redirectUrlRaw, ctx.merchantSlug);
  } catch (err) {
    if (err instanceof AppError) return { kind: "error", message: err.message };
    throw err;
  }

  let res: Response | null = null;
  for (let hop = 0; hop <= MAX_DASHBOARD_HOPS; hop++) {
    const cookie = jar.headerFor(url);
    const headers: Record<string, string> = { accept: "text/html" };
    if (cookie) headers.cookie = cookie;
    if (hop === 0) headers.referer = "https://www.qasir.id/";
    res = await timedFetch(fetchImpl, url.toString(), { method: "GET", headers });
    jar.applyResponse(url, res.headers);
    if (res.status < 300 || res.status >= 400) break;
    const location = res.headers.get("location");
    await res.body?.cancel();
    if (!location || hop === MAX_DASHBOARD_HOPS) {
      return { kind: "error", message: "Dashboard redirect loop or missing Location" };
    }
    try {
      url = assertMerchantDashboardUrl(location, ctx.merchantSlug, url);
    } catch (err) {
      if (err instanceof AppError) {
        return { kind: "error", message: `Dashboard hand-off rejected: ${err.message}` };
      }
      throw err;
    }
  }
  if (!res || res.status < 200 || res.status >= 300) {
    return { kind: "error", message: `Dashboard returned HTTP ${res?.status ?? 0}`, status: res?.status };
  }

  const html = await res.text();
  const apiToken = extractApiTokenFromHtml(html);
  const dashCsrf = extractCsrfFromHtml(html);
  const merchantRoot = new URL(`https://${ctx.merchantSlug.toLowerCase()}.qasir.id/`);

  if (apiToken && dashCsrf) {
    return {
      kind: "connected",
      apiToken,
      csrfToken: dashCsrf,
      cookieJar: jar.headerFor(merchantRoot),
      merchantSlug: ctx.merchantSlug,
      deviceId: ctx.deviceId,
      outletId: ctx.outletId,
    };
  }

  const missing = [apiToken ? null : "API_TOKEN", dashCsrf ? null : "CSRF meta"].filter(Boolean);
  return {
    kind: "needs_paste",
    merchantSlug: ctx.merchantSlug,
    deviceId: ctx.deviceId,
    outletId: ctx.outletId,
    reason:
      `${missing.join(" and ")} not found in the dashboard HTML. ` +
      "Paste API_TOKEN + CSRF + Cookie from DevTools (expected until the mint hop is observed).",
  };
}

/** POST /api/auth/outlet-select per docs/auth-login.md, with the PIN re-entered by the owner. */
export async function continueWithOutlet(input: {
  pending: PendingAuthState;
  outletId: number;
  pin: string;
  merchantSlug: string;
  fetchImpl?: FetchLike;
}): Promise<LoginFlowResult> {
  const { pending, outletId, pin } = input;
  if (pending.step !== "select_outlet") {
    return { kind: "error", message: "No pending outlet selection" };
  }
  if (!Number.isSafeInteger(outletId) || outletId <= 0) {
    return { kind: "error", message: "Invalid outlet_id" };
  }
  const outlet = pending.outlets.find((o) => o.id === outletId);
  if (!outlet) return { kind: "error", message: "Outlet is not in the pending outlet list" };
  if (outlet.is_lock) return { kind: "error", message: "Outlet is locked" };
  if (!isValidPin(pin)) return { kind: "error", message: "PIN must be exactly 6 digits" };

  const ctx: AuthContext = {
    fetchImpl: input.fetchImpl ?? defaultFetch,
    jar: CookieJar.fromJSON(pending.cookies),
    wwwCsrf: pending.wwwCsrf,
    deviceId: pending.deviceId,
    username: pending.username,
    pin,
    deviceType: pending.deviceType,
    timezone: pending.timezone,
    merchantSlug: input.merchantSlug,
    merchantId: pending.merchantId,
    outletId: String(outletId),
  };
  const res = await postAuthJson(ctx, OUTLET_SELECT_URL, {
    ...loginBody(ctx),
    merchant_id: pending.merchantId,
    outlet_id: outletId,
  });
  return resolveAuthJson(ctx, res);
}
