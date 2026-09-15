import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CookieJar } from "../../src/connect/cookie-jar";
import {
  continueWithOutlet,
  runQasirLoginFlow,
  type FetchLike,
  type LoginFlowResult,
} from "../../src/connect/login-flow";
import type { PendingAuthState } from "../../src/session/types";

const fixtures = resolve(__dirname, "../../fixtures/connect");
const load = (name: string) => readFileSync(resolve(fixtures, name), "utf8");

const SLUG = "bengkel-manuju-jaya-621095";
const DEVICE = "0f8fad5b-d9cb-469f-a165-70867728950e";
const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz123456";
const WWW_CSRF = "www-csrf-token-value-here-xx";
const DASH_CSRF = "csrf-from-meta-abcdefghijklmnopqrstuvwxyz12";

interface Recorded {
  url: string;
  method: string;
  headers: Headers;
  body: Record<string, unknown> | null;
}

type Handler = (url: URL, req: Recorded) => Response | undefined;

/**
 * Qasir mock that behaves like workerd's fetch: calling it with any `this`
 * other than undefined/globalThis throws "Illegal invocation".
 */
function qasirMock(overrides: Handler = () => undefined) {
  const calls: Recorded[] = [];
  const impl = function (this: unknown, input: string, init: RequestInit): Promise<Response> {
    if (this !== undefined && this !== globalThis) {
      throw new TypeError("Illegal invocation: function called with incorrect this reference");
    }
    const req: Recorded = {
      url: String(input),
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null,
    };
    calls.push(req);
    const url = new URL(req.url);
    const custom = overrides(url, req);
    if (custom) return Promise.resolve(custom);
    if (url.pathname === "/sign-in") {
      return Promise.resolve(
        new Response(`<meta content="${WWW_CSRF}" name="csrf-token">`, {
          headers: [
            ["set-cookie", "laravel_session=www-sess; Path=/; HttpOnly"],
            ["set-cookie", "XSRF-TOKEN=eyJpdiI6ImVuY3J5cHRlZCJ9%3D; Path=/"],
          ],
        }),
      );
    }
    if (url.pathname === "/api/auth/device-language") return Promise.resolve(Response.json({ status: 1 }));
    if (url.pathname === "/api/auth/login") return Promise.resolve(new Response(load("login-redirect.json")));
    if (url.hostname === `${SLUG}.qasir.id` && url.pathname === "/dashboard") {
      return Promise.resolve(
        new Response(load("dashboard-with-token.html"), {
          headers: { "set-cookie": "qasir_sess=merchant-sess; Path=/; HttpOnly" },
        }),
      );
    }
    return Promise.resolve(new Response("nope", { status: 404 }));
  };
  return { calls, fetchImpl: impl as FetchLike };
}

function login(fetchImpl?: FetchLike, extra: Partial<Parameters<typeof runQasirLoginFlow>[0]> = {}) {
  return runQasirLoginFlow({
    username: "081234567890",
    pin: "123456",
    deviceId: DEVICE,
    preferredMerchantSlug: SLUG,
    ...(fetchImpl ? { fetchImpl } : {}),
    ...extra,
  });
}

function expectKind<K extends LoginFlowResult["kind"]>(
  result: LoginFlowResult,
  kind: K,
): Extract<LoginFlowResult, { kind: K }> {
  expect(result.kind, JSON.stringify(result)).toBe(kind);
  return result as Extract<LoginFlowResult, { kind: K }>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DISP-01: fetch is never invoked with a wrong `this`", () => {
  it("default global fetch works through redirect + select_merchant paths", async () => {
    let posts = 0;
    const mock = qasirMock((url) => {
      if (url.pathname === "/api/auth/login") {
        posts += 1;
        return new Response(load(posts === 1 ? "login-select-merchant.json" : "login-redirect.json"));
      }
      return undefined;
    });
    vi.stubGlobal("fetch", mock.fetchImpl);
    const result = expectKind(await login(), "connected");
    expect(result.apiToken).toBe(TOKEN);
    expect(posts).toBe(2);
  });

  it("an injected fetchImpl is called as a plain function in every step", async () => {
    const mock = qasirMock((url) =>
      url.pathname === "/api/auth/login" ? new Response(load("login-select-outlet.json")) : undefined,
    );
    const step = expectKind(await login(mock.fetchImpl), "next_step");
    const pending: PendingAuthState = { ...step.pending, createdAt: Date.now(), expiresAt: Date.now() + 60_000 };
    const outlet = qasirMock((url) =>
      url.pathname === "/api/auth/outlet-select" ? new Response(load("outlet-select-success.json")) : undefined,
    );
    const done = await continueWithOutlet({ pending, outletId: 645203, pin: "123456", merchantSlug: SLUG, fetchImpl: outlet.fetchImpl });
    expectKind(done, "connected");
  });
});

describe("connect-01: login must land on MERCHANT_SLUG", () => {
  it("connects and always reports the configured slug", async () => {
    const mock = qasirMock();
    const result = expectKind(await login(mock.fetchImpl), "connected");
    expect(result.merchantSlug).toBe(SLUG);
    expect(result.csrfToken).toBe(DASH_CSRF);
    expect(result.deviceId).toBe(DEVICE);
  });

  it("rejects a redirect_url for another store and never fetches it", async () => {
    const mock = qasirMock((url) =>
      url.pathname === "/api/auth/login"
        ? Response.json({ status: 1, next_step: "redirect", data: { redirect_url: "https://some-other-store-1.qasir.id/dashboard?tokenWeb=x" } })
        : undefined,
    );
    const result = expectKind(await login(mock.fetchImpl), "error");
    expect(result.message).toMatch(/configured merchant/);
    expect(mock.calls.some((c) => c.url.includes("some-other-store-1"))).toBe(false);
  });

  it("rejects an off-domain redirect_url", async () => {
    const mock = qasirMock((url) =>
      url.pathname === "/api/auth/login"
        ? Response.json({ status: 1, next_step: "redirect", data: { redirect_url: "https://evil.example/steal" } })
        : undefined,
    );
    expectKind(await login(mock.fetchImpl), "error");
    expect(mock.calls.some((c) => c.url.includes("evil.example"))).toBe(false);
  });

  it("rejects a dashboard Location that leaves the merchant host", async () => {
    const mock = qasirMock((url) => {
      if (url.hostname === `${SLUG}.qasir.id`) {
        return new Response(null, { status: 302, headers: { location: "https://some-other-store-1.qasir.id/dashboard" } });
      }
      return undefined;
    });
    expectKind(await login(mock.fetchImpl), "error");
    expect(mock.calls.some((c) => c.url.includes("some-other-store-1"))).toBe(false);
  });

  it("follows relative same-host redirects", async () => {
    const mock = qasirMock((url) => {
      if (url.hostname === `${SLUG}.qasir.id` && url.searchParams.has("tokenWeb")) {
        return new Response(null, { status: 302, headers: { location: "/dashboard" } });
      }
      return undefined;
    });
    expectKind(await login(mock.fetchImpl), "connected");
  });

  it("rejects outlet-select token_web whose subdomain_url is another store", async () => {
    const mock = qasirMock((url) =>
      url.pathname === "/api/auth/outlet-select"
        ? Response.json({ status: 1, data: { token_web: "tw", subdomain_url: "https://some-other-store-1.qasir.id" } })
        : undefined,
    );
    const result = await continueWithOutlet({
      pending: pendingFixture(),
      outletId: 645203,
      pin: "123456",
      merchantSlug: SLUG,
      fetchImpl: mock.fetchImpl,
    });
    expectKind(result, "error");
    expect(mock.calls.some((c) => c.url.includes("some-other-store-1"))).toBe(false);
  });

  it("errors when select_merchant lacks the configured store", async () => {
    const mock = qasirMock((url) =>
      url.pathname === "/api/auth/login"
        ? Response.json({ status: 1, next_step: "select_merchant", data: { merchants: [{ id: 1, business_name: "Wrong", subdomain_url: "https://store-a.qasir.id" }] } })
        : undefined,
    );
    expectKind(await login(mock.fetchImpl), "error");
  });
});

function pendingFixture(patch: Partial<PendingAuthState> = {}): PendingAuthState {
  const jar = new CookieJar();
  jar.set(new URL("https://www.qasir.id/"), "laravel_session", "www-sess");
  return {
    step: "select_outlet",
    username: "6281234567890",
    deviceId: DEVICE,
    deviceType: "Chrome 150 · macOS",
    timezone: "Asia/Makassar",
    cookies: jar.toJSON(),
    wwwCsrf: { header: "x-csrf-token", value: WWW_CSRF },
    merchantId: 42,
    outlets: [
      { id: 645203, name: "Utama", is_lock: false },
      { id: 645299, name: "Gudang", is_lock: true },
    ],
    createdAt: Date.now(),
    expiresAt: Date.now() + 600_000,
    ...patch,
  };
}

describe("connect-02: outlet selection without a stored PIN", () => {
  it("next_step pending state carries no PIN", async () => {
    const mock = qasirMock((url) =>
      url.pathname === "/api/auth/login" ? new Response(load("login-select-outlet.json")) : undefined,
    );
    const step = expectKind(await login(mock.fetchImpl, { pin: "907153" }), "next_step");
    expect(JSON.stringify(step.pending)).not.toContain("907153");
    expect(step.pending).not.toHaveProperty("pin");
    expect(step.merchantId).toBe(42);
  });

  it("posts outlet-select with the re-entered PIN and pending merchant", async () => {
    const mock = qasirMock((url) =>
      url.pathname === "/api/auth/outlet-select" ? new Response(load("outlet-select-success.json")) : undefined,
    );
    const result = await continueWithOutlet({ pending: pendingFixture(), outletId: 645203, pin: "654321", merchantSlug: SLUG, fetchImpl: mock.fetchImpl });
    expect(expectKind(result, "connected").outletId).toBe("645203");
    const post = mock.calls.find((c) => c.url.endsWith("/api/auth/outlet-select"))!;
    expect(post.body).toMatchObject({ outlet_id: 645203, merchant_id: 42, password: "654321", device_id: DEVICE });
    expect(post.headers.get("cookie")).toBe("laravel_session=www-sess");
  });

  it.each([
    ["locked outlet", 645299, "123456"],
    ["outlet not in pending list", 999, "123456"],
    ["invalid outlet id", Number.NaN, "123456"],
    ["missing PIN", 645203, ""],
  ])("rejects %s without calling Qasir", async (_label, outletId, pin) => {
    const fetchImpl = vi.fn() as unknown as FetchLike;
    const result = await continueWithOutlet({ pending: pendingFixture(), outletId, pin, merchantSlug: SLUG, fetchImpl });
    expectKind(result, "error");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("connect-05: CSRF and cookie jar", () => {
  it("returns needs_paste when the dashboard has API_TOKEN but no CSRF meta (no cookie fallback)", async () => {
    const mock = qasirMock((url) =>
      url.hostname === `${SLUG}.qasir.id`
        ? new Response(`<script>window.API_TOKEN = "${TOKEN}";</script>`, {
            headers: { "set-cookie": "XSRF-TOKEN=eyJpdiI6Im1lcmNoYW50In0%3D; Path=/" },
          })
        : undefined,
    );
    const result = expectKind(await login(mock.fetchImpl), "needs_paste");
    expect(result.reason).toMatch(/CSRF/);
    expect(JSON.stringify(result)).not.toContain("eyJ");
  });

  it("returns needs_paste when API_TOKEN is missing", async () => {
    const mock = qasirMock((url) =>
      url.hostname === `${SLUG}.qasir.id` ? new Response(load("dashboard-no-token.html")) : undefined,
    );
    expectKind(await login(mock.fetchImpl), "needs_paste");
  });

  it("keeps www cookies off the merchant host and persists only the merchant jar", async () => {
    const mock = qasirMock();
    const result = expectKind(await login(mock.fetchImpl), "connected");
    expect(result.cookieJar).toBe("qasir_sess=merchant-sess");
    const dash = mock.calls.find((c) => c.url.startsWith(`https://${SLUG}.qasir.id/`))!;
    expect(dash.headers.get("cookie") ?? "").not.toMatch(/laravel_session|XSRF-TOKEN|qasir_device_id/);
  });

  it("uses X-XSRF-TOKEN (never X-CSRF-TOKEN) when the sign-in page lacks a meta token", async () => {
    const mock = qasirMock((url) =>
      url.pathname === "/sign-in"
        ? new Response("<html></html>", { headers: { "set-cookie": "XSRF-TOKEN=eyJpdiI6IngifQ%3D%3D; Path=/" } })
        : undefined,
    );
    await login(mock.fetchImpl);
    const post = mock.calls.find((c) => c.url.endsWith("/api/auth/login"))!;
    expect(post.headers.get("x-csrf-token")).toBeNull();
    expect(post.headers.get("x-xsrf-token")).toBe("eyJpdiI6IngifQ==");
  });

  it("sends Domain=.qasir.id cookies to the merchant host and drops Max-Age=0 cookies", async () => {
    const mock = qasirMock((url) => {
      if (url.pathname === "/api/auth/login") {
        return new Response(load("login-redirect.json"), {
          headers: [
            ["set-cookie", "shared=1; Domain=.qasir.id; Path=/"],
            ["set-cookie", "laravel_session=gone; Max-Age=0; Path=/"],
          ],
        });
      }
      return undefined;
    });
    const result = expectKind(await login(mock.fetchImpl), "connected");
    expect(result.cookieJar.split("; ").sort()).toEqual(["qasir_sess=merchant-sess", "shared=1"]);
  });
});

describe("connect-06: stable device id", () => {
  it("sends qasir_device_id on GET /sign-in and the same id in every auth body", async () => {
    const mock = qasirMock();
    await login(mock.fetchImpl);
    const signIn = mock.calls.find((c) => c.url.includes("/sign-in"))!;
    expect(signIn.headers.get("cookie")).toContain(`qasir_device_id=${DEVICE}`);
    const posts = mock.calls.filter((c) => c.method === "POST");
    expect(posts.length).toBeGreaterThanOrEqual(2);
    for (const p of posts) {
      expect(p.body?.device_id).toBe(DEVICE);
      expect(p.headers.get("cookie")).toContain(`qasir_device_id=${DEVICE}`);
    }
  });

  it("rejects a malformed device id before any request", async () => {
    const fetchImpl = vi.fn() as unknown as FetchLike;
    expectKind(await login(fetchImpl, { deviceId: "not-a-uuid" }), "error");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("OTP", () => {
  it("rejects verify_otp next_step as error (OTP UX unsupported)", async () => {
    const mock = qasirMock((url) =>
      url.pathname === "/api/auth/login" ? new Response(load("login-verify-otp.json")) : undefined,
    );
    const result = expectKind(await login(mock.fetchImpl), "error");
    expect(result.message.toLowerCase()).toMatch(/otp/);
  });
});
