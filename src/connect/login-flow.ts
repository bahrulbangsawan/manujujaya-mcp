import { AppError, ErrorCodes } from "../errors/codes";
import {
  mergeCookies,
  parseSetCookieHeaders,
} from "./cookie-jar";
import { extractApiTokenFromHtml, extractCsrfFromHtml } from "./extract-token";
import {
  isValidPin,
  normalizeUsername,
  parseLoginResponse,
  type ParsedLoginResponse,
} from "./login-parse";
import {
  assertQasirRedirectUrl,
  merchantSlugFromQasirHost,
} from "./redirect-allowlist";

export interface LoginFlowInput {
  username: string;
  pin: string;
  timezone?: string;
  deviceType?: string;
  merchantId?: number;
  fetchImpl?: typeof fetch;
}

export type LoginFlowResult =
  | {
      kind: "connected";
      apiToken: string;
      csrfToken: string;
      cookieJar: string;
      merchantSlug: string;
      deviceId: string;
      redirectUrl: string;
    }
  | {
      kind: "needs_paste";
      csrfToken: string;
      cookieJar: string;
      merchantSlug: string;
      deviceId: string;
      redirectUrl: string;
      reason: string;
    }
  | {
      kind: "next_step";
      step: Exclude<ParsedLoginResponse["nextStep"], "redirect" | null>;
      parsed: ParsedLoginResponse;
      cookieJar: string;
      deviceId: string;
      csrfToken: string;
    }
  | { kind: "error"; message: string; status?: number };

const SIGN_IN = "https://www.qasir.id/sign-in?lang=id";
const DEVICE_LANG = "https://www.qasir.id/api/auth/device-language";
const LOGIN = "https://www.qasir.id/api/auth/login";

/**
 * Server-side Qasir login per docs/auth-login.md.
 * Fully implements next_step=redirect; stubs other next_steps as structured results.
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
  let jar = `qasir_device_id=${deviceId}`;

  // 1) GET sign-in → CSRF + cookies
  const signInRes = await fetchImpl(SIGN_IN, {
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

  const commonHeaders = (): Headers => {
    const h = new Headers();
    h.set("content-type", "application/json");
    h.set("origin", "https://www.qasir.id");
    h.set("referer", SIGN_IN);
    h.set("x-csrf-token", wwwCsrf);
    h.set("x-requested-with", "XMLHttpRequest");
    h.set("cookie", jar);
    h.set("accept", "application/json");
    return h;
  };

  // 2) device-language
  const langRes = await fetchImpl(DEVICE_LANG, {
    method: "POST",
    headers: commonHeaders(),
    body: JSON.stringify({ language_code: "id", device_id: deviceId }),
    redirect: "manual",
  });
  jar = mergeCookies(jar, parseSetCookieHeaders(langRes.headers));

  // 3) login
  const body: Record<string, unknown> = {
    username,
    password: input.pin,
    device_id: deviceId,
    device_type: input.deviceType ?? "Chrome 150 · macOS",
    timezone: input.timezone ?? "Asia/Makassar",
  };
  if (input.merchantId !== undefined) body.merchant_id = input.merchantId;

  const loginRes = await fetchImpl(LOGIN, {
    method: "POST",
    headers: commonHeaders(),
    body: JSON.stringify(body),
    redirect: "manual",
  });
  jar = mergeCookies(jar, parseSetCookieHeaders(loginRes.headers));

  let loginJson: unknown;
  try {
    loginJson = await loginRes.json();
  } catch {
    return {
      kind: "error",
      message: "Login returned non-JSON",
      status: loginRes.status,
    };
  }

  const parsed = parseLoginResponse(loginJson);
  if (!parsed.ok) {
    return {
      kind: "error",
      message: parsed.message || "Login failed",
      status: loginRes.status,
    };
  }

  if (
    parsed.nextStep === "select_merchant" ||
    parsed.nextStep === "select_outlet" ||
    parsed.nextStep === "verify_otp"
  ) {
    return {
      kind: "next_step",
      step: parsed.nextStep,
      parsed,
      cookieJar: jar,
      deviceId,
      csrfToken: wwwCsrf,
    };
  }

  if (parsed.nextStep !== "redirect" || !parsed.redirectUrl) {
    return {
      kind: "error",
      message: `Unexpected next_step: ${parsed.nextStep ?? "null"}`,
    };
  }

  // 4) Follow redirect_url (allowlisted *.qasir.id only)
  let redirectUrl: URL;
  try {
    redirectUrl = assertQasirRedirectUrl(parsed.redirectUrl);
  } catch (err) {
    if (err instanceof AppError) {
      return { kind: "error", message: err.message };
    }
    throw err;
  }

  const dashRes = await fetchImpl(redirectUrl.toString(), {
    method: "GET",
    headers: {
      accept: "text/html",
      cookie: jar,
      referer: SIGN_IN,
    },
    redirect: "manual",
  });
  jar = mergeCookies(jar, parseSetCookieHeaders(dashRes.headers));

  // Follow one more hop if still on *.qasir.id
  let finalRes = dashRes;
  if (dashRes.status >= 300 && dashRes.status < 400) {
    const loc = dashRes.headers.get("location");
    if (loc) {
      try {
        const next = assertQasirRedirectUrl(
          new URL(loc, redirectUrl).toString(),
        );
        finalRes = await fetchImpl(next.toString(), {
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
    wwwCsrf;

  if (apiToken) {
    return {
      kind: "connected",
      apiToken,
      csrfToken: dashCsrf,
      cookieJar: jar,
      merchantSlug: slug,
      deviceId,
      redirectUrl: redirectUrl.toString(),
    };
  }

  return {
    kind: "needs_paste",
    csrfToken: dashCsrf,
    cookieJar: jar,
    merchantSlug: slug,
    deviceId,
    redirectUrl: redirectUrl.toString(),
    reason:
      "API_TOKEN not found in dashboard HTML/JS. Paste API_TOKEN + CSRF + Cookie from DevTools (expected until mint hop is observed).",
  };
}

function decodeCookieToken(jar: string, name: string): string | null {
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
