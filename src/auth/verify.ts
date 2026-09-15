import { AppError, ErrorCodes } from "../errors/codes";
import { SCOPES, hasScope, type Scope } from "./scopes";

export interface AuthPrincipal {
  subject: string;
  scopes: string[];
  clientId?: string;
  via: "oauth" | "dev-psk";
}

export interface AuthEnv {
  ALLOW_DEV_PSK: string;
  DEV_PSK?: string;
  /** Optional comma-separated audience / issuer placeholders for future IdP. */
  OAUTH_ISSUER?: string;
  OAUTH_AUDIENCE?: string;
}

/**
 * Fail-closed auth boundary. Production requires verified OAuth token.
 * Dev PSK only when ALLOW_DEV_PSK=true and DEV_PSK matches.
 */
export async function authenticateRequest(
  request: Request,
  env: AuthEnv,
): Promise<AuthPrincipal> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new AppError(ErrorCodes.UNAUTHORIZED, "Bearer token required");
  }
  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    throw new AppError(ErrorCodes.UNAUTHORIZED, "Empty bearer token");
  }

  if (env.ALLOW_DEV_PSK === "true") {
    const psk = env.DEV_PSK?.trim();
    if (psk && timingSafeEqual(token, psk)) {
      return {
        subject: "dev-psk",
        scopes: [SCOPES.READ, SCOPES.WRITE, SCOPES.ADMIN],
        via: "dev-psk",
      };
    }
  }

  // Fail closed: without a configured IdP verifier, reject.
  // Hook for @cloudflare/workers-oauth-provider / JWT verification goes here.
  if (!env.OAUTH_ISSUER || !env.OAUTH_AUDIENCE) {
    throw new AppError(
      ErrorCodes.UNAUTHORIZED,
      "OAuth not configured; set OAUTH_ISSUER/OAUTH_AUDIENCE or enable ALLOW_DEV_PSK for local only",
    );
  }

  // Placeholder structural JWT parse without signature verification is forbidden.
  // Until IdP is wired, reject even if issuer vars are set but no JWKS available.
  throw new AppError(
    ErrorCodes.UNAUTHORIZED,
    "OAuth token verification not yet wired to IdP JWKS — fail closed",
  );
}

export function requireScope(principal: AuthPrincipal, scope: Scope): void {
  if (!hasScope(principal.scopes, scope)) {
    throw new AppError(ErrorCodes.FORBIDDEN, `Missing scope ${scope}`);
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
