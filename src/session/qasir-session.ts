import { AppError, ErrorCodes } from "../errors/codes";
import type {
  PendingAuthState,
  QasirSessionContext,
  QasirSessionProvider,
  QasirSessionPublicStatus,
  QasirSessionSecrets,
  StoredQasirSession,
} from "./types";
import type { SaveSessionInput } from "./qasir-sessions-do";

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

  markExpired(): void {
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
  status(): Promise<QasirSessionPublicStatus>;
  savePending(
    state: Omit<PendingAuthState, "createdAt" | "expiresAt"> & {
      createdAt?: number;
      expiresAt?: number;
    },
  ): Promise<PendingAuthState>;
  getPending(): Promise<PendingAuthState | null>;
  clearPending(): Promise<void>;
  checkRateLimit(input: {
    key: string;
    limit?: number;
    windowMs?: number;
  }): Promise<{ ok: boolean; remaining: number; retryAfterMs: number }>;
}

export interface CompositeSessionOptions {
  env: SessionEnv;
  subject: string;
  /** Stub for the subject's QasirSessionsDO (RPC). */
  sessionsDo: QasirSessionsStub;
}

/**
 * Prefer Durable Object session for the authenticated subject;
 * fall back to Worker secrets QASIR_* for ops/bootstrap.
 * On markExpired, clears the DO session when present.
 */
export class CompositeQasirSessionProvider implements QasirSessionProvider {
  #env: SessionEnv;
  #do: QasirSessionsStub;
  #static: StaticQasirSessionProvider;
  #preferDo = true;

  constructor(options: CompositeSessionOptions) {
    this.#env = options.env;
    this.#do = options.sessionsDo;
    this.#static = new StaticQasirSessionProvider(options.env);
  }

  async markExpired(): Promise<void> {
    this.#preferDo = false;
    try {
      await this.#do.clear();
    } catch {
      // ignore DO clear failures; static path still marks expired below
    }
    this.#static.markExpired();
  }

  async getSession(): Promise<QasirSessionContext> {
    if (this.#preferDo) {
      try {
        const stored = await this.#do.getSession();
        if (stored?.apiToken && stored.csrfToken) {
          const slug = stored.merchantSlug || this.#env.MERCHANT_SLUG;
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

export function sessionsDoForSubject(
  ns: DurableObjectNamespace,
  subject: string,
): QasirSessionsStub & DurableObjectStub {
  return ns.get(ns.idFromName(subject)) as QasirSessionsStub & DurableObjectStub;
}
