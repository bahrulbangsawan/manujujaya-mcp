import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { issueOwnerCookie } from "../../src/auth/owner";
import { handleConnectRoutes, type ConnectEnv } from "../../src/connect/routes";
import { QasirSessionsDO } from "../../src/session/qasir-sessions-do";
import type { SessionStorage } from "../../src/session/session-store";

const fixtures = resolve(__dirname, "../../fixtures/connect");
const load = (name: string) => readFileSync(resolve(fixtures, name), "utf8");

const SLUG = "bengkel-manuju-jaya-621095";
const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz123456";
const CSRF = "0123456789abcdef0123456789abcdef";
const ORIGIN = "https://mcp.manujujaya.com";

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

interface Call {
  url: URL;
  init: RequestInit;
  body: Record<string, unknown> | null;
}

/** workerd-like strict fetch (throws on a wrong `this`) with scripted Qasir responses. */
function installQasir(script: (url: URL, call: Call) => Response | undefined = () => undefined): Call[] {
  const calls: Call[] = [];
  const fetchMock = function (this: unknown, input: string, init: RequestInit): Promise<Response> {
    if (this !== undefined && this !== globalThis) throw new TypeError("Illegal invocation");
    const call: Call = { url: new URL(input), init, body: init.body ? JSON.parse(String(init.body)) : null };
    calls.push(call);
    const custom = script(call.url, call);
    if (custom) return Promise.resolve(custom);
    const { pathname, hostname } = call.url;
    if (pathname === "/sign-in") {
      return Promise.resolve(new Response('<meta name="csrf-token" content="www-csrf-token-value-here-xx">'));
    }
    if (pathname === "/api/auth/device-language") return Promise.resolve(Response.json({ status: 1 }));
    if (pathname === "/api/auth/login") return Promise.resolve(new Response(load("login-redirect.json")));
    if (pathname === "/api/auth/outlet-select") return Promise.resolve(new Response(load("outlet-select-success.json")));
    if (hostname === `${SLUG}.qasir.id`) {
      return Promise.resolve(
        new Response(load("dashboard-with-token.html"), { headers: { "set-cookie": "qasir_sess=m; Path=/" } }),
      );
    }
    return Promise.resolve(new Response("nope", { status: 404 }));
  };
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

let storages: Map<string, MemoryStorage>;
let env: ConnectEnv & Record<string, unknown>;
let cookie: string;

function namespace(override?: (name: string) => unknown): DurableObjectNamespace {
  return {
    idFromName: (name: string) => ({ toString: () => name, name }),
    get: (id: { name: string }) => {
      const custom = override?.(id.name);
      if (custom) return custom;
      let storage = storages.get(id.name);
      if (!storage) storages.set(id.name, (storage = new MemoryStorage()));
      return new QasirSessionsDO({ storage, id } as unknown as DurableObjectState, env as unknown as Env);
    },
  } as unknown as DurableObjectNamespace;
}

function doFor(): QasirSessionsDO {
  return (env.QASIR_SESSIONS as DurableObjectNamespace).get(
    (env.QASIR_SESSIONS as DurableObjectNamespace).idFromName(`merchant:${SLUG}`),
  ) as unknown as QasirSessionsDO;
}

function post(path: string, fields: Record<string, string>, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers: { cookie, "content-type": "application/x-www-form-urlencoded", ...headers },
    body: new URLSearchParams({ csrf: CSRF, ...fields }),
  });
}

async function call(req: Request): Promise<Response> {
  const res = await handleConnectRoutes(req, env);
  if (!res) throw new Error("route not handled");
  return res;
}

beforeEach(async () => {
  storages = new Map();
  env = {
    OWNER_PASSWORD: "correct-horse-battery-staple",
    SESSION_ENCRYPTION_KEY: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
    REQUIRE_SESSION_ENCRYPTION: "true",
    ALLOW_DEV_PSK: "false",
    MERCHANT_SLUG: SLUG,
    DEFAULT_OUTLET_ID: "645203",
    QASIR_SESSIONS: undefined as unknown as DurableObjectNamespace,
  };
  env.QASIR_SESSIONS = namespace();
  const owner = (await issueOwnerCookie(new Request(`${ORIGIN}/login`), env)).split(";")[0]!;
  cookie = `${owner}; __Host-mj_csrf=${CSRF}`;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("/connect pages and JSON", () => {
  it("renders through the shared HTML helper (CSP, no-store) with a Sign out control", async () => {
    const res = await call(new Request(`${ORIGIN}/connect`, { headers: { cookie } }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const html = await res.text();
    expect(html).toContain('action="/logout"');
    expect(html).toContain("Sign out");
  });

  it("JSON status responses are no-store", async () => {
    const res = await call(new Request(`${ORIGIN}/connect/status`, { headers: { cookie } }));
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toMatchObject({ connected: false });
  });

  it("redirects anonymous browsers to /login and returns no-store JSON for API callers", async () => {
    const res = await call(new Request(`${ORIGIN}/connect`));
    expect(res.status).toBe(302);
    const api = await call(new Request(`${ORIGIN}/connect/status`, { headers: { accept: "application/json" } }));
    expect(api.status).toBe(401);
    expect(api.headers.get("cache-control")).toBe("no-store");
  });

  it("select-merchant is gone (merchant is fixed)", async () => {
    const res = await call(post("/connect/select-merchant", { merchantId: "1" }));
    expect(res.status).toBe(410);
  });
});

describe("POST /connect/login", () => {
  it("connects with global fetch, stores the env slug and reuses the stable device id", async () => {
    const calls = installQasir();
    const res = await call(post("/connect/login", { username: "081234567890", pin: "123456" }));
    expect(res.status).toBe(200);
    const stored = await doFor().getSession();
    expect(stored).toMatchObject({ apiToken: TOKEN, merchantSlug: SLUG, cookieJar: "qasir_sess=m" });

    const deviceId = await doFor().getOrCreateDeviceId();
    expect(stored?.deviceId).toBe(deviceId);
    await call(post("/connect/disconnect", {}));
    const again = installQasir();
    await call(post("/connect/login", { username: "081234567890", pin: "123456" }));
    const signIn = again.find((c) => c.url.pathname === "/sign-in")!;
    expect(new Headers(signIn.init.headers).get("cookie")).toBe(`qasir_device_id=${deviceId}`);
    expect(calls.length).toBeGreaterThan(0);
  });

  it("does not save a session when login lands on another store", async () => {
    installQasir((url) =>
      url.pathname === "/api/auth/login"
        ? Response.json({ status: 1, next_step: "redirect", data: { redirect_url: "https://other-store-9.qasir.id/dashboard?tokenWeb=x" } })
        : undefined,
    );
    const res = await call(post("/connect/login", { username: "081234567890", pin: "123456" }, { accept: "application/json" }));
    expect(res.status).toBe(401);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await doFor().getSession()).toBeNull();
  });

  it("ignores a client merchantId on login", async () => {
    const calls = installQasir();
    await call(post("/connect/login", { username: "081234567890", pin: "123456", merchantId: "1" }));
    const loginPost = calls.find((c) => c.url.pathname === "/api/auth/login")!;
    expect(loginPost.body).not.toHaveProperty("merchant_id");
  });

  it("rate-limits by normalized username, so reformatting the phone buys no extra attempts", async () => {
    const calls = installQasir((url) =>
      url.pathname === "/api/auth/login" ? new Response(load("login-fail.json")) : undefined,
    );
    const variants = ["081234567890", "6281234567890", "+62 812-3456-7890", "81234567890", "6-2-8-1-2-3-4-5-6-7-8-9-0", " 081234567890"];
    for (const [i, username] of variants.entries()) {
      const res = await call(post("/connect/login", { username, pin: "000000" }, { "cf-connecting-ip": `198.51.100.${i}` }));
      expect(res.status).toBe(401);
    }
    const before = calls.length;
    const blocked = await call(post("/connect/login", { username: "0812 3456 7890", pin: "000000" }, { "cf-connecting-ip": "198.51.100.77" }));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
    expect(calls.length).toBe(before);
    const raw = JSON.stringify([...storages.get(`merchant:${SLUG}`)!.data.keys()]);
    expect(raw).not.toContain("6281234567890");
    expect(raw).not.toContain("198.51.100");
  });
});

describe("outlet selection", () => {
  async function startOutletFlow(): Promise<Call[]> {
    const calls = installQasir((url) =>
      url.pathname === "/api/auth/login" ? new Response(load("login-select-outlet.json")) : undefined,
    );
    const res = await call(post("/connect/login", { username: "081234567890", pin: "907153" }));
    const html = await res.text();
    expect(html).toContain('action="/connect/select-outlet"');
    expect(html).toContain('name="pin"');
    return calls;
  }

  it("keeps no PIN in pending state and posts the re-entered PIN with the pending merchant", async () => {
    await startOutletFlow();
    const pending = await doFor().getPending();
    expect(pending).not.toBeNull();
    expect(JSON.stringify(pending)).not.toContain("907153");
    const raw = JSON.stringify([...storages.get(`merchant:${SLUG}`)!.data.values()]);
    expect(raw).not.toContain("907153");

    const calls = installQasir();
    const res = await call(post("/connect/select-outlet", { outletId: "645203", pin: "907153", merchantId: "1" }));
    expect(res.status).toBe(200);
    const outletPost = calls.find((c) => c.url.pathname === "/api/auth/outlet-select")!;
    expect(outletPost.body).toMatchObject({ merchant_id: 42, outlet_id: 645203, password: "907153" });
    expect(await doFor().getSession()).toMatchObject({ outletId: "645203", merchantSlug: SLUG });
    expect(await doFor().getPending()).toBeNull();
  });

  it.each([
    ["an outlet not in the pending list", { outletId: "999999", pin: "907153" }],
    ["a locked outlet", { outletId: "645299", pin: "907153" }],
    ["a missing PIN", { outletId: "645203", pin: "" }],
  ])("rejects %s without calling Qasir and clears pending", async (_label, fields) => {
    await startOutletFlow();
    const calls = installQasir();
    const res = await call(post("/connect/select-outlet", fields));
    expect(res.status).toBe(401);
    expect(calls).toHaveLength(0);
    expect(await doFor().getPending()).toBeNull();
  });

  it("clears pending when a later login errors", async () => {
    await startOutletFlow();
    installQasir((url) => (url.pathname === "/api/auth/login" ? new Response(load("login-fail.json")) : undefined));
    await call(post("/connect/login", { username: "081234567890", pin: "000000" }));
    expect(await doFor().getPending()).toBeNull();
  });

  it("clears pending when the upstream request throws", async () => {
    await startOutletFlow();
    installQasir((url) => {
      if (url.pathname === "/api/auth/outlet-select") throw new TypeError("network down");
      return undefined;
    });
    const res = await call(post("/connect/select-outlet", { outletId: "645203", pin: "907153" }));
    expect(res.status).toBe(500);
    expect(await doFor().getPending()).toBeNull();
  });

  it("cancel clears pending but keeps an existing session", async () => {
    installQasir();
    await call(post("/connect/login", { username: "081234567890", pin: "123456" }));
    await startOutletFlow();
    await call(post("/connect/cancel", {}));
    expect(await doFor().getPending()).toBeNull();
    expect(await doFor().getSession()).not.toBeNull();
  });
});

describe("paste", () => {
  it("normalizes a multi-line Cookie paste and stores the env slug", async () => {
    const res = await call(
      post(
        "/connect/paste",
        { apiToken: TOKEN, csrfToken: "csrf-from-meta-abcdefghijklmnopqrstuvwxyz12", cookie: "Cookie: qasir_sess=a;\r\nXSRF-TOKEN=b" },
        { accept: "application/json" },
      ),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await doFor().getSession()).toMatchObject({ cookieJar: "qasir_sess=a; XSRF-TOKEN=b", merchantSlug: SLUG });
  });

  it("rejects a cookie that would be an invalid header value", async () => {
    const res = await call(
      post("/connect/paste", { apiToken: TOKEN, csrfToken: "csrf-from-meta-abcdefghijklmnopqrstuvwxyz12", cookie: "qasir_sess=é" }),
    );
    expect(res.status).toBe(400);
    expect(await doFor().getSession()).toBeNull();
  });
});

describe("connect-03: errors crossing DO RPC", () => {
  it("maps a structural AppError (plain Error, name AppError) to its status instead of 500", async () => {
    env.QASIR_SESSIONS = namespace(() => ({
      getPending: async () => {
        const err = new Error("REQUIRE_SESSION_ENCRYPTION=true but SESSION_ENCRYPTION_KEY is missing");
        Object.assign(err, { name: "AppError", code: "FORBIDDEN", status: 403 });
        throw err;
      },
    }));
    const res = await call(new Request(`${ORIGIN}/connect`, { headers: { cookie } }));
    expect(res.status).toBe(403);
    expect(await res.text()).toContain("SESSION_ENCRYPTION_KEY is missing");
    const json = await call(new Request(`${ORIGIN}/connect?format=json`, { headers: { cookie } }));
    expect(await json.json()).toMatchObject({ code: "FORBIDDEN" });
  });

  it("renders /connect after a key rotation instead of failing permanently", async () => {
    installQasir((url) =>
      url.pathname === "/api/auth/login" ? new Response(load("login-select-outlet.json")) : undefined,
    );
    await call(post("/connect/login", { username: "081234567890", pin: "907153" }));
    env.SESSION_ENCRYPTION_KEY = "a-different-key-after-rotation-000";
    env.QASIR_SESSIONS = namespace();
    // The owner cookie is keyed off the same secret, so sign in again.
    const owner = (await issueOwnerCookie(new Request(`${ORIGIN}/login`), env)).split(";")[0]!;
    cookie = `${owner}; __Host-mj_csrf=${CSRF}`;
    const res = await call(new Request(`${ORIGIN}/connect`, { headers: { cookie } }));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('action="/connect/login"');
  });
});
