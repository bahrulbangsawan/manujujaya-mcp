import { DurableObject } from "cloudflare:workers";
import type {
  QasirSessionPublicStatus,
  StoredQasirSession,
} from "./types";
import { maskTokenPrefix } from "./types";

const SESSION_KEY = "session";
const RATE_PREFIX = "rate:";

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
 * DO storage holds secrets; optional Worker secret SESSION_ENCRYPTION_KEY
 * can wrap the blob (AES-GCM) when set on the Worker — encryption is applied
 * by the connect routes before put when that secret is present.
 *
 * Never log apiToken / csrf / cookieJar / PIN.
 */
export class QasirSessionsDO extends DurableObject {
  async getSession(): Promise<StoredQasirSession | null> {
    const raw = await this.ctx.storage.get<StoredQasirSession>(SESSION_KEY);
    if (!raw) return null;
    if (raw.expiresAt && Date.now() > raw.expiresAt) {
      await this.clear();
      return null;
    }
    return raw;
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
    await this.ctx.storage.put(SESSION_KEY, record);
    return record;
  }

  async clear(): Promise<void> {
    await this.ctx.storage.delete(SESSION_KEY);
  }

  async status(): Promise<QasirSessionPublicStatus> {
    const s = await this.getSession();
    if (!s) return { connected: false };
    return {
      connected: true,
      merchantSlug: s.merchantSlug,
      outletId: s.outletId || undefined,
      connectedAt: s.connectedAt,
      source: "do",
      apiTokenPrefix: maskTokenPrefix(s.apiToken),
    };
  }

  /**
   * Simple rate limit: max `limit` hits per `windowMs` for a key (e.g. IP or username hash).
   * Returns { ok, remaining, retryAfterMs }.
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
}
