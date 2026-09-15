import { authenticateRequest, type AuthPrincipal } from "../auth/verify";
import { AppError, ErrorCodes } from "../errors/codes";

const CONNECT_COOKIE = "mj_connect";
const CSRF_COOKIE = "mj_csrf";
const COOKIE_MAX_AGE = 60 * 60; // 1 hour

export interface ConnectGateEnv {
  ALLOW_DEV_PSK: string;
  DEV_PSK?: string;
  CONNECT_NONCE?: string;
  OAUTH_ISSUER?: string;
  OAUTH_AUDIENCE?: string;
}

export interface ConnectIdentity {
  subject: string;
  via: "oauth" | "dev-psk" | "connect-nonce" | "connect-cookie";
  csrfToken: string;
  setCookies: string[];
}

function signingKey(env: ConnectGateEnv): string | null {
  if (env.ALLOW_DEV_PSK === "true" && env.DEV_PSK?.trim()) {
    return env.DEV_PSK.trim();
  }
  if (env.CONNECT_NONCE?.trim()) return env.CONNECT_NONCE.trim();
  return null;
}

async function hmacSign(key: string, msg: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(msg),
  );
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifySigned(
  key: string,
  subject: string,
  sig: string,
): Promise<boolean> {
  const expected = await hmacSign(key, subject);
  if (expected.length !== sig.length) return false;
  let out = 0;
  for (let i = 0; i < expected.length; i++) {
    out |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return out === 0;
}

function readCookie(request: Request, name: string): string | null {
  const raw = request.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}

function cookieSet(
  name: string,
  value: string,
  maxAge = COOKIE_MAX_AGE,
): string {
  return `${name}=${encodeURIComponent(value)}; Path=/connect; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

async function issueConnectCookies(
  subject: string,
  key: string,
): Promise<{ csrfToken: string; setCookies: string[] }> {
  const sig = await hmacSign(key, subject);
  const csrfToken = crypto.randomUUID().replace(/-/g, "");
  return {
    csrfToken,
    setCookies: [
      cookieSet(CONNECT_COOKIE, `${subject}.${sig}`),
      cookieSet(CSRF_COOKIE, csrfToken),
    ],
  };
}

/**
 * Gate /connect* routes. Order:
 * 1. Bearer MCP principal (when Authorization present and verifies)
 * 2. Local DEV_PSK (header / query once) → connect cookie
 * 3. CONNECT_NONCE (header / query once) → connect cookie
 * 4. Existing signed connect cookie
 */
export async function requireConnectAccess(
  request: Request,
  env: ConnectGateEnv,
): Promise<ConnectIdentity> {
  const url = new URL(request.url);
  const setCookies: string[] = [];

  // 1) Bearer when present
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const principal: AuthPrincipal = await authenticateRequest(request, env);
      const key = signingKey(env);
      let csrf = readCookie(request, CSRF_COOKIE);
      if (!csrf || !key) {
        csrf = crypto.randomUUID().replace(/-/g, "");
        setCookies.push(cookieSet(CSRF_COOKIE, csrf));
        if (key) {
          const issued = await issueConnectCookies(principal.subject, key);
          setCookies.push(...issued.setCookies);
          csrf = issued.csrfToken;
        }
      }
      return {
        subject: principal.subject,
        via: principal.via === "dev-psk" ? "dev-psk" : "oauth",
        csrfToken: csrf,
        setCookies,
      };
    } catch {
      // fall through if bearer invalid — other gates may apply
    }
  }

  const key = signingKey(env);
  if (!key) {
    throw new AppError(
      ErrorCodes.UNAUTHORIZED,
      "Connect gate not configured (ALLOW_DEV_PSK+DEV_PSK or CONNECT_NONCE)",
    );
  }

  // 2) DEV_PSK one-shot
  if (env.ALLOW_DEV_PSK === "true" && env.DEV_PSK?.trim()) {
    const psk =
      request.headers.get("x-dev-psk")?.trim() ||
      url.searchParams.get("psk")?.trim() ||
      "";
    if (psk && timingSafeEqual(psk, env.DEV_PSK.trim())) {
      const issued = await issueConnectCookies("dev-psk", key);
      return {
        subject: "dev-psk",
        via: "dev-psk",
        csrfToken: issued.csrfToken,
        setCookies: issued.setCookies,
      };
    }
  }

  // 3) CONNECT_NONCE one-shot
  if (env.CONNECT_NONCE?.trim()) {
    const nonce =
      request.headers.get("x-connect-nonce")?.trim() ||
      url.searchParams.get("nonce")?.trim() ||
      "";
    if (nonce && timingSafeEqual(nonce, env.CONNECT_NONCE.trim())) {
      const subject = `connect-${crypto.randomUUID()}`;
      const issued = await issueConnectCookies(subject, key);
      return {
        subject,
        via: "connect-nonce",
        csrfToken: issued.csrfToken,
        setCookies: issued.setCookies,
      };
    }
  }

  // 4) Existing connect cookie
  const raw = readCookie(request, CONNECT_COOKIE);
  if (raw) {
    const dot = raw.lastIndexOf(".");
    if (dot > 0) {
      const subject = raw.slice(0, dot);
      const sig = raw.slice(dot + 1);
      if (subject && (await verifySigned(key, subject, sig))) {
        let csrf = readCookie(request, CSRF_COOKIE);
        if (!csrf) {
          csrf = crypto.randomUUID().replace(/-/g, "");
          setCookies.push(cookieSet(CSRF_COOKIE, csrf));
        }
        return {
          subject,
          via: "connect-cookie",
          csrfToken: csrf,
          setCookies,
        };
      }
    }
  }

  throw new AppError(
    ErrorCodes.UNAUTHORIZED,
    "Connect access denied — provide Bearer, DEV_PSK, CONNECT_NONCE, or valid connect cookie",
  );
}

export function assertFormCsrf(
  identity: ConnectIdentity,
  formCsrf: string | null | undefined,
): void {
  const cookieCsrf = identity.csrfToken;
  const provided = formCsrf?.trim() ?? "";
  if (!provided || !cookieCsrf || !timingSafeEqual(provided, cookieCsrf)) {
    throw new AppError(ErrorCodes.FORBIDDEN, "Invalid CSRF token");
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

export function withSetCookies(
  response: Response,
  setCookies: string[],
): Response {
  if (!setCookies.length) return response;
  const headers = new Headers(response.headers);
  for (const c of setCookies) headers.append("Set-Cookie", c);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
