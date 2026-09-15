import { log } from "../observability/log";
import {
  decryptJson,
  encryptJson,
  isEncryptedBlobV1,
  resolveSessionCrypto,
  sha256Hex,
  type SessionCryptoEnv,
  type SessionKeys,
} from "./crypto";
import type {
  PendingAuthDraft,
  PendingAuthState,
  QasirSessionPublicStatus,
  StoredQasirSession,
} from "./types";
import { maskTokenPrefix } from "./types";

const SESSION_KEY = "session";
const PENDING_KEY = "pending_auth";
/** Stable Qasir device id; survives clear()/disconnect so reconnects look like the same device. */
const DEVICE_KEY = "device_id";
const RATE_PREFIX = "rate:";
export const PENDING_TTL_MS = 10 * 60_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RecordKind = "session" | "pending";

/** At-rest envelope for new writes. `exp` is plaintext so expiry never needs the key. */
interface SealedRecord {
  v: 2;
  kind: RecordKind;
  exp: number | null;
  iv: string;
  ct: string;
}

/** Plaintext envelope, only when no key is configured and encryption is not required. */
interface PlainRecord {
  v: 2;
  kind: RecordKind;
  exp: number | null;
  plain: unknown;
}

interface RateEntry {
  count: number;
  resetAt: number;
}

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

/** The subset of DurableObjectStorage the store needs (lets tests use an in-memory map). */
export interface SessionStorage {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  list<T = unknown>(options: { prefix: string }): Promise<Map<string, T>>;
  getAlarm(): Promise<number | null>;
  setAlarm(scheduledTime: number): Promise<void>;
}

function isV2Record(raw: unknown): raw is SealedRecord | PlainRecord {
  if (!raw || typeof raw !== "object") return false;
  const r = raw as Partial<SealedRecord & PlainRecord>;
  return (
    r.v === 2 &&
    (r.kind === "session" || r.kind === "pending") &&
    (r.exp === null || typeof r.exp === "number")
  );
}

function sameRecord(a: unknown, b: unknown): boolean {
  return a !== undefined && b !== undefined && JSON.stringify(a) === JSON.stringify(b);
}

function isStoredSession(v: unknown): v is StoredQasirSession {
  if (!v || typeof v !== "object") return false;
  const s = v as Partial<StoredQasirSession>;
  return (
    typeof s.apiToken === "string" &&
    typeof s.csrfToken === "string" &&
    typeof s.cookieJar === "string" &&
    typeof s.merchantSlug === "string" &&
    typeof s.connectedAt === "number"
  );
}

function isPendingState(v: unknown): v is PendingAuthState {
  if (!v || typeof v !== "object") return false;
  const p = v as Partial<PendingAuthState> & { pin?: unknown };
  return (
    p.step === "select_outlet" &&
    p.pin === undefined &&
    typeof p.username === "string" &&
    typeof p.deviceId === "string" &&
    typeof p.merchantId === "number" &&
    Array.isArray(p.cookies) &&
    Array.isArray(p.outlets) &&
    !!p.wwwCsrf &&
    typeof p.expiresAt === "number"
  );
}

/**
 * Qasir session storage for the merchant-wide QasirSessionsDO.
 *
 * - Records are AES-GCM encrypted with an HKDF-derived key; the AAD binds each
 *   blob to this DO id, its storage key, its kind and its plaintext expiry.
 * - Legacy v1 blobs (no AAD) are still read and re-sealed; legacy pending
 *   records (which held the PIN) are deleted on sight.
 * - Undecryptable or malformed records are deleted and read as absent.
 * - REQUIRE_SESSION_ENCRYPTION=true rejects plaintext records on read.
 * - An alarm hard-expires pending state and prunes rate-limit buckets.
 *
 * Never log apiToken / csrf / cookies / username.
 */
export class SessionStore {
  #storage: SessionStorage;
  #env: SessionCryptoEnv;
  #scope: string;
  #keyCache: { raw: string | undefined; keys: Promise<SessionKeys> } | undefined;

  constructor(storage: SessionStorage, env: SessionCryptoEnv, scope: string) {
    this.#storage = storage;
    this.#env = env;
    this.#scope = scope;
  }

  async getSession(): Promise<StoredQasirSession | null> {
    await this.#sweepPending();
    return this.#read(SESSION_KEY, "session", isStoredSession);
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
    await this.#write(SESSION_KEY, "session", record, input.expiresAt ?? null);
    await this.clearPending();
    return record;
  }

  async clear(): Promise<void> {
    await this.#storage.delete(SESSION_KEY);
  }

  /** Compare-and-delete: clears the session only if it still holds the token with this SHA-256 hex. */
  async clearIfToken(tokenHash: string): Promise<boolean> {
    const before = await this.#storage.get(SESSION_KEY);
    const session = await this.#read(SESSION_KEY, "session", isStoredSession);
    if (!session) return false;
    if ((await sha256Hex(session.apiToken)) !== tokenHash.toLowerCase()) return false;
    // Decrypt/hash awaits can interleave with a saveSession(): delete only if the
    // record is still the one we compared (get → delete has no other await).
    if (!sameRecord(before, await this.#storage.get(SESSION_KEY))) return false;
    await this.clear();
    log("info", "session.cleared_after_upstream_401", {
      tokenPrefix: maskTokenPrefix(session.apiToken),
    });
    return true;
  }

  async savePending(draft: PendingAuthDraft): Promise<PendingAuthState> {
    const now = Date.now();
    const record: PendingAuthState = { ...draft, createdAt: now, expiresAt: now + PENDING_TTL_MS };
    await this.#write(PENDING_KEY, "pending", record, record.expiresAt);
    await this.#scheduleAlarm(record.expiresAt);
    return record;
  }

  async getPending(): Promise<PendingAuthState | null> {
    return this.#read(PENDING_KEY, "pending", isPendingState);
  }

  async clearPending(): Promise<void> {
    await this.#storage.delete(PENDING_KEY);
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
    return pending ? { connected: false, pendingStep: pending.step } : { connected: false };
  }

  /** Stable per-merchant Qasir device id (adopts the id of a legacy stored session). */
  async getOrCreateDeviceId(): Promise<string> {
    const existing = await this.#storage.get<string>(DEVICE_KEY);
    if (typeof existing === "string" && UUID_RE.test(existing)) return existing;
    const session = await this.#read(SESSION_KEY, "session", isStoredSession);
    const id = session && UUID_RE.test(session.deviceId) ? session.deviceId : crypto.randomUUID();
    // A concurrent caller may have created one while we decrypted.
    const raced = await this.#storage.get<string>(DEVICE_KEY);
    if (typeof raced === "string" && UUID_RE.test(raced)) return raced;
    await this.#storage.put(DEVICE_KEY, id);
    return id;
  }

  /**
   * Fixed-window rate limit: max `limit` hits per `windowMs` for a key.
   * Keys are stored as SHA-256 hashes so usernames/IPs never sit at rest.
   */
  async checkRateLimit(input: {
    key: string;
    limit?: number;
    windowMs?: number;
    /** Report the bucket state without counting an attempt. */
    peek?: boolean;
  }): Promise<{ ok: boolean; remaining: number; retryAfterMs: number }> {
    const limit = input.limit ?? 5;
    const windowMs = input.windowMs ?? 15 * 60_000;
    // Hash before touching storage: no non-storage await between get and put.
    const storageKey = `${RATE_PREFIX}${await sha256Hex(input.key)}`;
    const now = Date.now();
    const stored = await this.#storage.get<RateEntry>(storageKey);
    const entry: RateEntry =
      stored && stored.resetAt > now ? { ...stored } : { count: 0, resetAt: now + windowMs };
    if (entry.count >= limit) {
      return { ok: false, remaining: 0, retryAfterMs: Math.max(0, entry.resetAt - now) };
    }
    if (input.peek) return { ok: true, remaining: limit - entry.count, retryAfterMs: 0 };
    entry.count += 1;
    await this.#storage.put(storageKey, entry);
    await this.#scheduleAlarm(entry.resetAt);
    return { ok: true, remaining: Math.max(0, limit - entry.count), retryAfterMs: 0 };
  }

  /** Alarm: hard-expire pending auth and prune expired rate buckets, then reschedule. */
  async alarm(): Promise<void> {
    const now = Date.now();
    let next: number | null = await this.#sweepPending(now);
    const rates = await this.#storage.list<RateEntry>({ prefix: RATE_PREFIX });
    for (const [key, entry] of rates) {
      if (!entry || typeof entry.resetAt !== "number" || entry.resetAt <= now) {
        await this.#storage.delete(key);
      } else {
        next = next === null ? entry.resetAt : Math.min(next, entry.resetAt);
      }
    }
    if (next !== null) await this.#storage.setAlarm(next);
  }

  /** Deletes expired or legacy pending state without decrypting. Returns its expiry if kept. */
  async #sweepPending(now = Date.now()): Promise<number | null> {
    const raw = await this.#storage.get(PENDING_KEY);
    if (raw === undefined) return null;
    if (isV2Record(raw) && raw.kind === "pending" && raw.exp !== null && raw.exp > now) {
      return raw.exp;
    }
    await this.#storage.delete(PENDING_KEY);
    return null;
  }

  async #scheduleAlarm(at: number): Promise<void> {
    const current = await this.#storage.getAlarm();
    if (current === null || current > at) await this.#storage.setAlarm(at);
  }

  /** resolveSessionCrypto with the derived keys cached for the life of this DO instance. */
  async #crypto(): Promise<{ keys: SessionKeys | null; require: boolean }> {
    const raw = this.#env.SESSION_ENCRYPTION_KEY?.trim();
    if (!raw) return resolveSessionCrypto(this.#env);
    let entry = this.#keyCache;
    if (entry?.raw !== raw) {
      // Non-null: resolveSessionCrypto always returns keys when a raw key is present.
      entry = { raw, keys: resolveSessionCrypto(this.#env).then((r) => r.keys!) };
      this.#keyCache = entry;
    }
    try {
      return { keys: await entry.keys, require: this.#env.REQUIRE_SESSION_ENCRYPTION === "true" };
    } catch (err) {
      this.#keyCache = undefined;
      throw err;
    }
  }

  #aad(storageKey: string, kind: RecordKind, exp: number | null): string {
    return `mj-qasir-sessions|${this.#scope}|${storageKey}|${kind}|exp=${exp ?? ""}`;
  }

  async #seal(storageKey: string, kind: RecordKind, value: unknown, exp: number | null): Promise<SealedRecord | PlainRecord> {
    const { keys } = await this.#crypto();
    return keys
      ? { v: 2, kind, exp, ...(await encryptJson(keys.aead, value, this.#aad(storageKey, kind, exp))) }
      : { v: 2, kind, exp, plain: value };
  }

  async #write(storageKey: string, kind: RecordKind, value: unknown, exp: number | null): Promise<void> {
    await this.#storage.put(storageKey, await this.#seal(storageKey, kind, value, exp));
  }

  async #drop(storageKey: string, reason: string): Promise<undefined> {
    await this.#storage.delete(storageKey);
    log("warn", "session.record_dropped", { key: storageKey, reason });
    return undefined;
  }

  async #read<T extends { expiresAt?: number }>(
    storageKey: string,
    kind: RecordKind,
    isShape: (v: unknown) => v is T,
  ): Promise<T | null> {
    const raw = await this.#storage.get(storageKey);
    if (raw === undefined) return null;
    const now = Date.now();
    if (isV2Record(raw) && raw.exp !== null && raw.exp <= now) {
      await this.#storage.delete(storageKey);
      return null;
    }
    // Throws FORBIDDEN (fail closed) when encryption is required but no key is set.
    const { keys, require } = await this.#crypto();
    const value = await this.#open(storageKey, kind, raw, keys, require);
    if (value === undefined) return null;
    if (!isShape(value)) {
      await this.#drop(storageKey, "malformed");
      return null;
    }
    if (value.expiresAt !== undefined && value.expiresAt <= now) {
      await this.#storage.delete(storageKey);
      return null;
    }
    return value;
  }

  /** Returns the decoded value, or undefined when the record was dropped or is unreadable. */
  async #open(
    storageKey: string,
    kind: RecordKind,
    raw: unknown,
    keys: SessionKeys | null,
    require: boolean,
  ): Promise<unknown> {
    if (isV2Record(raw)) {
      if (raw.kind !== kind) return this.#drop(storageKey, "kind_mismatch");
      if ("plain" in raw) {
        if (require) return this.#drop(storageKey, "plaintext_rejected");
        return raw.plain;
      }
      // Encrypted but no key configured (and not required): leave it for when the key returns.
      if (!keys) return undefined;
      try {
        return await decryptJson<unknown>(keys.aead, raw, this.#aad(storageKey, kind, raw.exp));
      } catch {
        return this.#drop(storageKey, "decrypt_failed");
      }
    }
    // Legacy records from older builds. Pending state held the PIN: never reuse it.
    if (kind === "pending") return this.#drop(storageKey, "legacy_pending");
    let legacy: unknown;
    if (isEncryptedBlobV1(raw)) {
      if (!keys) return undefined;
      try {
        legacy = await decryptJson<unknown>(keys.legacy, raw, null);
      } catch {
        return this.#drop(storageKey, "decrypt_failed");
      }
    } else if (require) {
      return this.#drop(storageKey, "plaintext_rejected");
    } else {
      legacy = raw;
    }
    if (isStoredSession(legacy) && keys) {
      // Re-seal as v2 unless a newer record was saved while we decrypted.
      const sealed = await this.#seal(storageKey, kind, legacy, legacy.expiresAt ?? null);
      if (sameRecord(raw, await this.#storage.get(storageKey))) await this.#storage.put(storageKey, sealed);
    }
    return legacy;
  }
}
