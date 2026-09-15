import { DurableObject } from "cloudflare:workers";
import { SessionStore, type SaveSessionInput } from "./session-store";
import type {
  PendingAuthDraft,
  PendingAuthState,
  QasirSessionPublicStatus,
  StoredQasirSession,
} from "./types";

export type { SaveSessionInput } from "./session-store";

/**
 * Merchant-wide Durable Object holding Qasir dashboard session material
 * (`merchant:<MERCHANT_SLUG>`), plus rate-limit buckets for other named instances.
 * All logic lives in SessionStore; this class only exposes it over RPC.
 *
 * Never log apiToken / csrf / cookieJar / PIN.
 */
export class QasirSessionsDO extends DurableObject<Env> {
  #store: SessionStore;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.#store = new SessionStore(ctx.storage, env, ctx.id.toString());
  }

  getSession(): Promise<StoredQasirSession | null> {
    return this.#store.getSession();
  }

  saveSession(input: SaveSessionInput): Promise<StoredQasirSession> {
    return this.#store.saveSession(input);
  }

  clear(): Promise<void> {
    return this.#store.clear();
  }

  /** Compare-and-delete used by markExpired(failedApiToken). */
  clearIfToken(tokenHash: string): Promise<boolean> {
    return this.#store.clearIfToken(tokenHash);
  }

  savePending(draft: PendingAuthDraft): Promise<PendingAuthState> {
    return this.#store.savePending(draft);
  }

  getPending(): Promise<PendingAuthState | null> {
    return this.#store.getPending();
  }

  clearPending(): Promise<void> {
    return this.#store.clearPending();
  }

  status(): Promise<QasirSessionPublicStatus> {
    return this.#store.status();
  }

  getOrCreateDeviceId(): Promise<string> {
    return this.#store.getOrCreateDeviceId();
  }

  checkRateLimit(input: {
    key: string;
    limit?: number;
    windowMs?: number;
    /** Report the bucket state without counting an attempt. */
    peek?: boolean;
  }): Promise<{ ok: boolean; remaining: number; retryAfterMs: number }> {
    return this.#store.checkRateLimit(input);
  }

  override alarm(): Promise<void> {
    return this.#store.alarm();
  }
}
