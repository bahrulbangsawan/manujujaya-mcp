import type { WwwCsrf } from "../session/types";
import { CookieJar } from "./cookie-jar";
import { extractCsrfFromHtml } from "./extract-token";
import { isValidPin, normalizeUsername } from "./login-parse";
import {
  defaultFetch,
  DEVICE_LANG_URL,
  LOGIN_URL,
  postAuthJson,
  resolveAuthJson,
  SIGN_IN_URL,
  timedFetch,
  type AuthContext,
  type FetchLike,
  type LoginFlowResult,
} from "./login-continue";

export type { FetchLike, LoginFlowResult } from "./login-continue";
export { continueWithOutlet } from "./login-continue";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface LoginFlowInput {
  username: string;
  pin: string;
  /** Stable Qasir device id (QasirSessionsDO.getOrCreateDeviceId); sent as cookie and body field. */
  deviceId: string;
  /** Configured MERCHANT_SLUG. select_merchant auto-resolves to it; every landing host must match it. */
  preferredMerchantSlug: string;
  timezone?: string;
  deviceType?: string;
  fetchImpl?: FetchLike;
}

/**
 * The sign-in page's CSRF for www auth POSTs: the meta token as X-CSRF-TOKEN, or
 * failing that Laravel's encrypted XSRF-TOKEN cookie as X-XSRF-TOKEN (the only
 * header Laravel decrypts). Never sends the cookie value as X-CSRF-TOKEN.
 */
function wwwCsrfFrom(html: string, jar: CookieJar): WwwCsrf | null {
  const meta = extractCsrfFromHtml(html);
  if (meta) return { header: "x-csrf-token", value: meta };
  const cookie = jar.get(new URL(LOGIN_URL), "XSRF-TOKEN");
  if (!cookie) return null;
  let value = cookie;
  try {
    value = decodeURIComponent(cookie);
  } catch {
    // keep raw value
  }
  return /^[\x21-\x7e]{1,2048}$/.test(value) ? { header: "x-xsrf-token", value } : null;
}

/**
 * Server-side Qasir login per docs/auth-login.md.
 * Continuation (outlet) lives in login-continue.ts. OTP is rejected.
 * Never invents an API_TOKEN mint endpoint — scrapes dashboard HTML/JS best-effort.
 */
export async function runQasirLoginFlow(input: LoginFlowInput): Promise<LoginFlowResult> {
  const fetchImpl = input.fetchImpl ?? defaultFetch;
  const username = normalizeUsername(input.username);
  if (!username) {
    return { kind: "error", message: "Username required" };
  }
  if (!isValidPin(input.pin)) {
    return { kind: "error", message: "PIN must be exactly 6 digits" };
  }
  if (!UUID_RE.test(input.deviceId)) {
    return { kind: "error", message: "Invalid device id" };
  }
  if (!input.preferredMerchantSlug?.trim()) {
    return { kind: "error", message: "MERCHANT_SLUG is not configured" };
  }

  const jar = new CookieJar();
  const signInUrl = new URL(SIGN_IN_URL);
  // Browser parity: the device cookie exists before the first page load.
  jar.set(signInUrl, "qasir_device_id", input.deviceId);

  const signInRes = await timedFetch(fetchImpl, SIGN_IN_URL, {
    method: "GET",
    headers: { accept: "text/html", cookie: jar.headerFor(signInUrl) },
  });
  jar.applyResponse(signInUrl, signInRes.headers);
  const wwwCsrf = wwwCsrfFrom(await signInRes.text(), jar);
  if (!wwwCsrf) {
    return { kind: "error", message: "Could not extract CSRF from sign-in page" };
  }

  const ctx: AuthContext = {
    fetchImpl,
    jar,
    wwwCsrf,
    deviceId: input.deviceId,
    username,
    pin: input.pin,
    deviceType: input.deviceType ?? "Chrome 150 · macOS",
    timezone: input.timezone ?? "Asia/Makassar",
    merchantSlug: input.preferredMerchantSlug.trim().toLowerCase(),
  };

  await postAuthJson(ctx, DEVICE_LANG_URL, { language_code: "id", device_id: ctx.deviceId });

  const loginRes = await postAuthJson(ctx, LOGIN_URL, {
    username: ctx.username,
    password: ctx.pin,
    device_id: ctx.deviceId,
    device_type: ctx.deviceType,
    timezone: ctx.timezone,
  });
  return resolveAuthJson(ctx, loginRes);
}
