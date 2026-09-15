import { AppError, ErrorCodes } from "../errors/codes";
import { sha256Hex } from "./crypto";
import type { SaveSessionInput } from "./session-store";
import type {
  PendingAuthDraft,
  PendingAuthState,
  QasirSessionContext,
  QasirSessionProvider,
  QasirSessionPublicStatus,
  QasirSessionSecrets,
  StoredQasirSession,
} from "./types";

export interface SessionEnv {
  MERCHANT_SLUG: string;
  DEFAULT_OUTLET_ID: string;
  QASIR_API_TOKEN?: string;
  QASIR_CSRF_TOKEN?: string;
  QASIR_COOKIE?: string;
}

/**
 * Host-only session provider using pre-provisioned Worker secrets.
 * Never expose secrets to model code, tool I/O, OpenAPI, resources, or logs.
 */
export class StaticQasirSessionProvider implements QasirSessionProvider {
  #expired = false;
  #env: SessionEnv;

  constructor(env: SessionEnv) {
    this.#env = env;
  }

  /** Marks the static secrets expired, unless a different token is the one that failed. */
  markExpired(failedApiToken?: string): void {
    if (failedApiToken !== undefined && failedApiToken !== this.#env.QASIR_API_TOKEN?.trim()) {
      return;
    }
    this.#expired = true;
  }

  async getSession(): Promise<QasirSessionContext> {
    if (this.#expired) {
      throw new AppError(
        ErrorCodes.QASIR_AUTH_EXPIRED,
        "Qasir session marked expired; refresh dashboard secrets",
      );
    }
    const secrets = readSecrets(this.#env);
    const slug = this.#env.MERCHANT_SLUG;
    if (!slug || slug.includes("/") || slug.includes(".")) {
      throw new AppError(
        ErrorCodes.INVALID_INPUT,
        "MERCHANT_SLUG must be a trusted subdomain label",
      );
    }
    return {
      merchantSlug: slug,
      merchantOrigin: `https://${slug}.qasir.id`,
      defaultOutletId: this.#env.DEFAULT_OUTLET_ID,
      secrets,
      source: "static",
    };
  }
}

/** RPC surface for QasirSessionsDO stub (or test mock). */
export interface QasirSessionsStub {
  getSession(): Promise<StoredQasirSession | null>;
  saveSession(input: SaveSessionInput): Promise<StoredQasirSession>;
  clear(): Promise<void>;
  /** Deletes the session only if sha256hex(stored apiToken) equals `tokenHash`. */
  clearIfToken(tokenHash: string): Promise<boolean>;
  status(): Promise<QasirSessionPublicStatus>;
  savePending(draft: PendingAuthDraft): Promise<PendingAuthState>;
  getPending(): Promise<PendingAuthState | null>;
  clearPending(): Promise<void>;
  getOrCreateDeviceId(): Promise<string>;
  checkRateLimit(input: {
    key: string;
    limit?: number;
    windowMs?: number;
    /** Report the bucket state without counting an attempt. */
    peek?: boolean;
  }): Promise<{ ok: boolean; remaining: number; retryAfterMs: number }>;
}

export interface CompositeSessionOptions {
  env: SessionEnv;
  /** Stub for the merchant-wide QasirSessionsDO (RPC). */
  sessionsDo: Pick<QasirSessionsStub, "getSession" | "clear" | "clearIfToken">;
}

/**
 * Prefer the merchant-wide Durable Object session captured via /connect;
 * fall back to Worker secrets QASIR_* for ops/bootstrap.
 */
export class CompositeQasirSessionProvider implements QasirSessionProvider {
  #env: SessionEnv;
  #do: CompositeSessionOptions["sessionsDo"];
  #static: StaticQasirSessionProvider;
  #preferDo = true;

  constructor(options: CompositeSessionOptions) {
    this.#env = options.env;
    this.#do = options.sessionsDo;
    this.#static = new StaticQasirSessionProvider(options.env);
  }

  /**
   * With `failedApiToken`: compare-and-delete inside the DO, so a session saved
   * after the failing request started is kept; static secrets are only marked
   * expired when they hold that token. Without it: clear everything (legacy).
   */
  async markExpired(failedApiToken?: string): Promise<void> {
    if (failedApiToken === undefined) {
      this.#preferDo = false;
      try {
        await this.#do.clear();
      } catch {
        // ignore DO clear failures; static path still marks expired below
      }
      this.#static.markExpired();
      return;
    }
    try {
      await this.#do.clearIfToken(await sha256Hex(failedApiToken));
    } catch {
      // DO unavailable: the next getSession() will surface the problem
    }
    this.#static.markExpired(failedApiToken);
  }

  async getSession(): Promise<QasirSessionContext> {
    if (this.#preferDo) {
      try {
        const stored = await this.#do.getSession();
        if (stored?.apiToken && stored.csrfToken) {
          // Origin always comes from trusted config, never from stored/caller data.
          const slug = this.#env.MERCHANT_SLUG;
          return {
            merchantSlug: slug,
            merchantOrigin: `https://${slug}.qasir.id`,
            defaultOutletId:
              stored.outletId || this.#env.DEFAULT_OUTLET_ID,
            secrets: {
              apiToken: stored.apiToken,
              csrfToken: stored.csrfToken,
              cookie: stored.cookieJar,
            },
            source: "do",
          };
        }
      } catch {
        // fall through to static
      }
    }
    return this.#static.getSession();
  }
}

function readSecrets(env: SessionEnv): QasirSessionSecrets {
  const apiToken = env.QASIR_API_TOKEN?.trim() ?? "";
  const csrfToken = env.QASIR_CSRF_TOKEN?.trim() ?? "";
  const cookie = env.QASIR_COOKIE?.trim() ?? "";
  if (!apiToken || !csrfToken) {
    throw new AppError(
      ErrorCodes.QASIR_AUTH_EXPIRED,
      "Missing QASIR_API_TOKEN / QASIR_CSRF_TOKEN Worker secrets",
    );
  }
  return { apiToken, csrfToken, cookie };
}

/** One shared Qasir session per configured merchant (single-tenant server). */
export function sessionsDoForMerchant(
  ns: DurableObjectNamespace,
  merchantSlug: string,
): QasirSessionsStub & DurableObjectStub {
  return ns.get(ns.idFromName(`merchant:${merchantSlug}`)) as QasirSessionsStub & DurableObjectStub;
}
