import { afterEach, describe, expect, it, vi } from "vitest";
import { sha256Hex } from "../../src/session/crypto";
import { PENDING_TTL_MS, SessionStore, type SessionStorage } from "../../src/session/session-store";
import type { PendingAuthDraft } from "../../src/session/types";

const KEY = btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, i) => 255 - i)));
const ENC_ENV = { SESSION_ENCRYPTION_KEY: KEY, REQUIRE_SESSION_ENCRYPTION: "true" };
const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz123456";

/** In-memory stand-in for DurableObjectStorage (structured-clone semantics). */
class MemoryStorage implements SessionStorage {
  data = new Map<string, unknown>();
  alarm: number | null = null;
  async get<T>(key: string): Promise<T | undefined> {
    const v = this.data.get(key);
    return v === undefined ? undefined : (structuredClone(v) as T);
  }
  async put<T>(key: string, value: T): Promise<void> {
    this.data.set(key, structuredClone(value));
  }
  async delete(key: string): Promise<boolean> {
    return this.data.delete(key);
  }
  async list<T>(options: { prefix: string }): Promise<Map<string, T>> {
    const out = new Map<string, T>();
    for (const [k, v] of this.data) if (k.startsWith(options.prefix)) out.set(k, structuredClone(v) as T);
    return out;
  }
  async getAlarm(): Promise<number | null> {
    return this.alarm;
  }
  async setAlarm(t: number): Promise<void> {
    this.alarm = t;
  }
}

function session(apiToken = TOKEN) {
  return {
    apiToken,
    csrfToken: "csrf-from-meta-abcdefghijklmnopqrstuvwxyz12",
    cookieJar: "qasir_sess=merchant",
    merchantSlug: "bengkel-manuju-jaya-621095",
    outletId: "645203",
    deviceId: "0f8fad5b-d9cb-469f-a165-70867728950e",
    subject: "owner",
  };
}

const draft: PendingAuthDraft = {
  step: "select_outlet",
  username: "6281234567890",
  deviceId: "0f8fad5b-d9cb-469f-a165-70867728950e",
  deviceType: "Chrome 150 · macOS",
  timezone: "Asia/Makassar",
  cookies: [{ name: "laravel_session", value: "www", domain: "www.qasir.id", hostOnly: true, path: "/" }],
  wwwCsrf: { header: "x-csrf-token", value: "www-csrf-token-value-here-xx" },
  merchantId: 42,
  outlets: [{ id: 645203, name: "Utama" }],
};

afterEach(() => {
  vi.useRealTimers();
});

describe("SessionStore encryption at rest", () => {
  it("stores v2 sealed records with plaintext exp and no secrets in clear", async () => {
    const storage = new MemoryStorage();
    const store = new SessionStore(storage, ENC_ENV, "do-1");
    await store.saveSession(session());
    const raw = JSON.stringify(storage.data.get("session"));
    expect(raw).not.toContain(TOKEN);
    expect(raw).not.toContain("qasir_sess");
    expect(storage.data.get("session")).toMatchObject({ v: 2, kind: "session", exp: null });
    expect((await store.getSession())?.apiToken).toBe(TOKEN);
  });

  it("AAD binds a blob to its DO and storage key", async () => {
    const a = new MemoryStorage();
    await new SessionStore(a, ENC_ENV, "do-a").saveSession(session());
    // Same key, blob copied into another DO: rejected and deleted.
    const b = new MemoryStorage();
    b.data.set("session", a.data.get("session"));
    expect(await new SessionStore(b, ENC_ENV, "do-b").getSession()).toBeNull();
    expect(b.data.has("session")).toBe(false);
    // Session blob swapped into the pending slot of the same DO: rejected.
    a.data.set("pending_auth", { ...(a.data.get("session") as object), kind: "pending", exp: Date.now() + 60_000 });
    expect(await new SessionStore(a, ENC_ENV, "do-a").getPending()).toBeNull();
  });

  it("deletes an undecryptable record (rotated key) and reads it as absent instead of throwing", async () => {
    const storage = new MemoryStorage();
    await new SessionStore(storage, ENC_ENV, "do-1").saveSession(session());
    await new SessionStore(storage, ENC_ENV, "do-1").savePending(draft);
    const rotated = new SessionStore(storage, { ...ENC_ENV, SESSION_ENCRYPTION_KEY: "rotated-key-rotated-key-rotated" }, "do-1");
    await expect(rotated.getSession()).resolves.toBeNull();
    await expect(rotated.getPending()).resolves.toBeNull();
    await expect(rotated.status()).resolves.toEqual({ connected: false });
    expect(storage.data.has("session")).toBe(false);
    expect(storage.data.has("pending_auth")).toBe(false);
  });

  it("checks plaintext exp before decrypting", async () => {
    const storage = new MemoryStorage();
    const store = new SessionStore(storage, ENC_ENV, "do-1");
    await store.saveSession({ ...session(), expiresAt: Date.now() - 1 });
    const decrypt = vi.spyOn(crypto.subtle, "decrypt");
    expect(await store.getSession()).toBeNull();
    expect(decrypt).not.toHaveBeenCalled();
    decrypt.mockRestore();
    expect(storage.data.has("session")).toBe(false);
  });

  it("rejects plaintext records on read when encryption is required", async () => {
    const storage = new MemoryStorage();
    await new SessionStore(storage, { REQUIRE_SESSION_ENCRYPTION: "false" }, "do-1").saveSession(session());
    expect(storage.data.get("session")).toMatchObject({ v: 2, plain: expect.anything() });
    expect(await new SessionStore(storage, ENC_ENV, "do-1").getSession()).toBeNull();
    expect(storage.data.has("session")).toBe(false);

    // Legacy bare-object sessions too.
    storage.data.set("session", { ...session(), connectedAt: Date.now() });
    expect(await new SessionStore(storage, ENC_ENV, "do-1").getSession()).toBeNull();
    expect(storage.data.has("session")).toBe(false);
  });

  it("fails closed (FORBIDDEN) when encryption is required but the key is missing", async () => {
    const store = new SessionStore(new MemoryStorage(), { REQUIRE_SESSION_ENCRYPTION: "true" }, "do-1");
    await expect(store.saveSession(session())).rejects.toMatchObject({ name: "AppError", code: "FORBIDDEN" });
  });

  it("reads a legacy v1 session blob and re-seals it as v2", async () => {
    const storage = new MemoryStorage();
    const rawBytes = Uint8Array.from(atob(KEY), (c) => c.charCodeAt(0));
    const oldKey = await crypto.subtle.importKey("raw", rawBytes, "AES-GCM", false, ["encrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plain = new TextEncoder().encode(JSON.stringify({ ...session(), connectedAt: 1 }));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, oldKey, plain));
    const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
    storage.data.set("session", { v: 1, iv: b64(iv), ct: b64(ct) });

    const store = new SessionStore(storage, ENC_ENV, "do-1");
    expect((await store.getSession())?.apiToken).toBe(TOKEN);
    expect(storage.data.get("session")).toMatchObject({ v: 2, kind: "session" });
    expect((await store.getSession())?.apiToken).toBe(TOKEN);
  });

  it("drops legacy pending records (which held the PIN) on sight", async () => {
    const storage = new MemoryStorage();
    storage.data.set("pending_auth", { username: "628", pin: "123456", step: "select_outlet", expiresAt: Date.now() + 1e6 });
    const store = new SessionStore(storage, ENC_ENV, "do-1");
    await store.getSession();
    expect(storage.data.has("pending_auth")).toBe(false);
  });
});

describe("SessionStore pending state", () => {
  it("never stores a PIN, and the alarm hard-expires it", async () => {
    vi.useFakeTimers({ now: 1_800_000_000_000 });
    const storage = new MemoryStorage();
    const store = new SessionStore(storage, ENC_ENV, "do-1");
    const saved = await store.savePending(draft);
    expect(saved).not.toHaveProperty("pin");
    expect(storage.alarm).toBe(saved.expiresAt);
    expect(saved.expiresAt - saved.createdAt).toBe(PENDING_TTL_MS);
    expect((await store.getPending())?.merchantId).toBe(42);

    vi.setSystemTime(saved.expiresAt + 1);
    await store.alarm();
    expect(storage.data.has("pending_auth")).toBe(false);
  });

  it("rejects pending state that contains a pin field", async () => {
    const storage = new MemoryStorage();
    const store = new SessionStore(storage, ENC_ENV, "do-1");
    await store.savePending({ ...draft, pin: "123456" } as PendingAuthDraft);
    expect(await store.getPending()).toBeNull();
  });
});

describe("SessionStore clearIfToken (C3 compare-and-delete)", () => {
  it("deletes only when the stored token matches the hash", async () => {
    const storage = new MemoryStorage();
    const store = new SessionStore(storage, ENC_ENV, "do-1");
    await store.saveSession(session("NewTokenNewTokenNewTokenNewToken"));
    expect(await store.clearIfToken(await sha256Hex(TOKEN))).toBe(false);
    expect(await store.getSession()).not.toBeNull();
    expect(await store.clearIfToken(await sha256Hex("NewTokenNewTokenNewTokenNewToken"))).toBe(true);
    expect(await store.getSession()).toBeNull();
    expect(await store.clearIfToken(await sha256Hex(TOKEN))).toBe(false);
  });

  it("keeps a session saved while the compare was in flight", async () => {
    class RacyStorage extends MemoryStorage {
      sessionGets = 0;
      beforeThirdGet: (() => Promise<void>) | null = null;
      override async get<T>(key: string): Promise<T | undefined> {
        if (key === "session" && ++this.sessionGets === 3 && this.beforeThirdGet) await this.beforeThirdGet();
        return super.get<T>(key);
      }
    }
    const storage = new RacyStorage();
    const store = new SessionStore(storage, ENC_ENV, "do-1");
    await store.saveSession(session());
    storage.sessionGets = 0;
    storage.beforeThirdGet = async () => {
      await new SessionStore(storage, ENC_ENV, "do-1").saveSession(session("FreshTokenFreshTokenFreshToken12"));
    };
    expect(await store.clearIfToken(await sha256Hex(TOKEN))).toBe(false);
    storage.beforeThirdGet = null;
    expect((await store.getSession())?.apiToken).toBe("FreshTokenFreshTokenFreshToken12");
  });
});

describe("SessionStore device id", () => {
  it("is stable and survives clear() and clearPending()", async () => {
    const storage = new MemoryStorage();
    const store = new SessionStore(storage, ENC_ENV, "do-1");
    const id = await store.getOrCreateDeviceId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    await store.saveSession(session());
    await store.clear();
    await store.clearPending();
    expect(await store.getOrCreateDeviceId()).toBe(id);
  });

  it("adopts the device id of an existing session", async () => {
    const storage = new MemoryStorage();
    const store = new SessionStore(storage, ENC_ENV, "do-1");
    await store.saveSession(session());
    expect(await store.getOrCreateDeviceId()).toBe(session().deviceId);
  });
});

describe("SessionStore rate limiting", () => {
  it("limits per key, stores only hashed keys, and prunes expired buckets via alarm", async () => {
    vi.useFakeTimers({ now: 1_800_000_000_000 });
    const storage = new MemoryStorage();
    const store = new SessionStore(storage, ENC_ENV, "ratelimit");
    const key = "connect-pin:user:6281234567890";
    for (let i = 0; i < 3; i++) expect((await store.checkRateLimit({ key, limit: 3, windowMs: 60_000 })).ok).toBe(true);
    const blocked = await store.checkRateLimit({ key, limit: 3, windowMs: 60_000 });
    expect(blocked).toMatchObject({ ok: false, remaining: 0 });
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
    // Owner-password style keys keep working with the same signature.
    expect((await store.checkRateLimit({ key: "ip:203.0.113.9", limit: 10 })).ok).toBe(true);
    expect((await store.checkRateLimit({ key: "global", limit: 50 })).ok).toBe(true);

    const keys = [...storage.data.keys()].filter((k) => k.startsWith("rate:"));
    expect(keys).toHaveLength(3);
    for (const k of keys) expect(k).toMatch(/^rate:[0-9a-f]{64}$/);
    expect(JSON.stringify([...storage.data])).not.toContain("6281234567890");
    expect(storage.alarm).toBe(1_800_000_000_000 + 60_000);

    vi.setSystemTime(1_800_000_000_000 + 61_000);
    await store.alarm();
    expect([...storage.data.keys()].filter((k) => k.startsWith("rate:"))).toHaveLength(2);
    expect(storage.alarm).toBe(1_800_000_000_000 + 15 * 60_000);
    expect((await store.checkRateLimit({ key, limit: 3, windowMs: 60_000 })).ok).toBe(true);
  });
});
