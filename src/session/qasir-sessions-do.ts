import { DurableObject } from "cloudflare:workers";
import {
  decryptJson,
  encryptJson,
  isEncryptedBlob,
  resolveSessionCrypto,
  type EncryptedBlob,
} from "./crypto";
import type {
  PendingAuthState,
  QasirSessionPublicStatus,
  StoredQasirSession,
} from "./types";
import { maskTokenPrefix } from "./types";

const SESSION_KEY = "session";
const PENDING_KEY = "pending_auth";
const RATE_PREFIX = "rate:";
const PENDING_TTL_MS = 10 * 60_000;

export interface SaveSessionInput {
  apiToken: string;
  csrfToken: string;
  cookieJar: string;
  merchantSlug: string;
  outletId?: string;
  deviceId?: string;
  subject: string;
  expiresAt?: number;
}

/**
 * Per-subject Durable Object holding Qasir dashboard session material.
 * Encrypts at rest with SESSION_ENCRYPTION_KEY (AES-GCM) when set.
 * When REQUIRE_SESSION_ENCRYPTION=true and key missing, refuse writes.
 *
 * Never log apiToken / csrf / cookieJar / PIN.
 */
export class QasirSessionsDO extends DurableObject<Env> {
  async getSession(): Promise<StoredQasirSession | null> {
    const raw = await this.ctx.storage.get<StoredQasirSession | EncryptedBlob>(
      SESSION_KEY,
    );
    if (!raw) return null;
    const session = await this.#unwrapSession(raw);
    if (!session) return null;
    if (session.expiresAt && Date.now() > session.expiresAt) {
      await this.clear();
      return null;
    }
    return session;
  }

  async saveSession(input: SaveSessionInput): Promise<StoredQasirSession> {
    const record: StoredQasirSession = {
      apiToken: input.apiToken,
      csrfToken: input.csrfToken,
      cookieJar: input.cookieJar,
      merchantSlug: input.merchantSlug,
      outletId: input.outletId ?? "",
      deviceId: input.deviceId ?? "",
      connectedAt: Date.now(),
      expiresAt: input.expiresAt,
      subject: input.subject,
    };
    await this.ctx.storage.put(SESSION_KEY, await this.#wrap(record));
    await this.clearPending();
    return record;
  }

  async clear(): Promise<void> {
    await this.ctx.storage.delete(SESSION_KEY);
  }

  async savePending(state: Omit<PendingAuthState, "createdAt" | "expiresAt"> & {
    createdAt?: number;
    expiresAt?: number;
  }): Promise<PendingAuthState> {
    const now = Date.now();
    const record: PendingAuthState = {
      ...state,
      createdAt: state.createdAt ?? now,
      expiresAt: state.expiresAt ?? now + PENDING_TTL_MS,
    };
    await this.ctx.storage.put(PENDING_KEY, await this.#wrap(record));
    return record;
  }

  async getPending(): Promise<PendingAuthState | null> {
    const raw = await this.ctx.storage.get<PendingAuthState | EncryptedBlob>(
      PENDING_KEY,
    );
    if (!raw) return null;
    const pending = await this.#unwrapPending(raw);
    if (!pending) return null;
    if (Date.now() > pending.expiresAt) {
      await this.clearPending();
      return null;
    }
    return pending;
  }

  async clearPending(): Promise<void> {
    await this.ctx.storage.delete(PENDING_KEY);
  }

  async status(): Promise<QasirSessionPublicStatus> {
    const s = await this.getSession();
    if (s) {
      return {
        connected: true,
        merchantSlug: s.merchantSlug,
        outletId: s.outletId || undefined,
        connectedAt: s.connectedAt,
        source: "do",
        apiTokenPrefix: maskTokenPrefix(s.apiToken),
      };
    }
    const pending = await this.getPending();
    if (pending) {
      return { connected: false, pendingStep: pending.step };
    }
    return { connected: false };
  }

  /**
   * Simple rate limit: max `limit` hits per `windowMs` for a key (e.g. IP or username hash).
   */
  async checkRateLimit(input: {
    key: string;
    limit?: number;
    windowMs?: number;
  }): Promise<{ ok: boolean; remaining: number; retryAfterMs: number }> {
    const limit = input.limit ?? 5;
    const windowMs = input.windowMs ?? 15 * 60_000;
    const storageKey = `${RATE_PREFIX}${input.key}`;
    const now = Date.now();
    const entry =
      (await this.ctx.storage.get<{ count: number; resetAt: number }>(
        storageKey,
      )) ?? { count: 0, resetAt: now + windowMs };

    if (now > entry.resetAt) {
      entry.count = 0;
      entry.resetAt = now + windowMs;
    }
    if (entry.count >= limit) {
      await this.ctx.storage.put(storageKey, entry);
      return {
        ok: false,
        remaining: 0,
        retryAfterMs: Math.max(0, entry.resetAt - now),
      };
    }
    entry.count += 1;
    await this.ctx.storage.put(storageKey, entry);
    return {
      ok: true,
      remaining: Math.max(0, limit - entry.count),
      retryAfterMs: 0,
    };
  }

  async #wrap<T>(value: T): Promise<T | EncryptedBlob> {
    const { key } = await resolveSessionCrypto(this.env);
    if (!key) return value;
    return encryptJson(key, value);
  }

  async #unwrapSession(
    raw: StoredQasirSession | EncryptedBlob,
  ): Promise<StoredQasirSession | null> {
    if (isEncryptedBlob(raw)) {
      const { key } = await resolveSessionCrypto(this.env);
      if (!key) return null;
      return decryptJson<StoredQasirSession>(key, raw);
    }
    return raw;
  }

  async #unwrapPending(
    raw: PendingAuthState | EncryptedBlob,
  ): Promise<PendingAuthState | null> {
    if (isEncryptedBlob(raw)) {
      const { key } = await resolveSessionCrypto(this.env);
      if (!key) return null;
      return decryptJson<PendingAuthState>(key, raw);
    }
    return raw;
  }
}
