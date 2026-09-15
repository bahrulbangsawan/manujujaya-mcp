import {
  mergeCookies,
  parseSetCookieHeaders,
} from "./cookie-jar";
import { extractCsrfFromHtml } from "./extract-token";
import {
  isValidPin,
  normalizeUsername,
} from "./login-parse";
import {
  decodeCookieToken,
  DEVICE_LANG_URL,
  LOGIN_URL,
  resolveAuthJson,
  SIGN_IN_URL,
  wwwHeaders,
  type LoginFlowResult,
} from "./login-continue";

export type { LoginFlowResult } from "./login-continue";
export {
  continueWithMerchant,
  continueWithOutlet,
  continueWithOtp,
  pendingFromNextStep,
  resendOtp,
} from "./login-continue";

export interface LoginFlowInput {
  username: string;
  pin: string;
  timezone?: string;
  deviceType?: string;
  merchantId?: number;
  /** Fixed merchant slug (MERCHANT_SLUG); auto-resolves select_merchant. */
  preferredMerchantSlug?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Server-side Qasir login per docs/auth-login.md.
 * Continuations (merchant / outlet / OTP) live in login-continue.ts.
 * Never invents an API_TOKEN mint endpoint — scrapes dashboard HTML/JS best-effort.
 */
export async function runQasirLoginFlow(
  input: LoginFlowInput,
): Promise<LoginFlowResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const username = normalizeUsername(input.username);
  if (!username) {
    return { kind: "error", message: "Username required" };
  }
  if (!isValidPin(input.pin)) {
    return { kind: "error", message: "PIN must be exactly 6 digits" };
  }

  const deviceId = crypto.randomUUID();
  const deviceType = input.deviceType ?? "Chrome 150 · macOS";
  const timezone = input.timezone ?? "Asia/Makassar";
  let jar = `qasir_device_id=${deviceId}`;

  const signInRes = await fetchImpl(SIGN_IN_URL, {
    method: "GET",
    redirect: "manual",
  });
  jar = mergeCookies(jar, parseSetCookieHeaders(signInRes.headers));
  const signInHtml = await signInRes.text();
  const wwwCsrf =
    extractCsrfFromHtml(signInHtml) ||
    decodeCookieToken(jar, "XSRF-TOKEN");
  if (!wwwCsrf) {
    return { kind: "error", message: "Could not extract CSRF from sign-in page" };
  }

  const langRes = await fetchImpl(DEVICE_LANG_URL, {
    method: "POST",
    headers: wwwHeaders(wwwCsrf, jar),
    body: JSON.stringify({ language_code: "id", device_id: deviceId }),
    redirect: "manual",
  });
  jar = mergeCookies(jar, parseSetCookieHeaders(langRes.headers));

  const body: Record<string, unknown> = {
    username,
    password: input.pin,
    device_id: deviceId,
    device_type: deviceType,
    timezone,
  };
  if (input.merchantId !== undefined) body.merchant_id = input.merchantId;

  const loginRes = await fetchImpl(LOGIN_URL, {
    method: "POST",
    headers: wwwHeaders(wwwCsrf, jar),
    body: JSON.stringify(body),
    redirect: "manual",
  });
  jar = mergeCookies(jar, parseSetCookieHeaders(loginRes.headers));

  return resolveAuthJson({
    fetchImpl,
    jar,
    wwwCsrf,
    deviceId,
    username,
    pin: input.pin,
    deviceType,
    timezone,
    merchantId: input.merchantId,
    preferredMerchantSlug: input.preferredMerchantSlug,
    res: loginRes,
  });
}
