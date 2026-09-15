import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { extractApiTokenFromHtml, extractCsrfFromHtml } from "../../src/connect/extract-token";
import { parseLoginResponse, normalizeUsername, isValidPin } from "../../src/connect/login-parse";
import { validatePasteInput } from "../../src/connect/paste";
import {
  assertQasirRedirectUrl,
  merchantSlugFromQasirHost,
} from "../../src/connect/redirect-allowlist";
import { runQasirLoginFlow } from "../../src/connect/login-flow";
import { AppError, ErrorCodes } from "../../src/errors/codes";
import {
  CompositeQasirSessionProvider,
  StaticQasirSessionProvider,
} from "../../src/session/qasir-session";
import type { StoredQasirSession } from "../../src/session/types";

const fixtures = resolve(__dirname, "../../fixtures/connect");

function load(name: string): string {
  return readFileSync(resolve(fixtures, name), "utf8");
}

describe("login response parsing", () => {
  it("parses redirect next_step", () => {
    const parsed = parseLoginResponse(JSON.parse(load("login-redirect.json")));
    expect(parsed.ok).toBe(true);
    expect(parsed.nextStep).toBe("redirect");
    expect(parsed.redirectUrl).toContain("bengkel-manuju-jaya-621095.qasir.id");
  });

  it("parses select_merchant", () => {
    const parsed = parseLoginResponse(
      JSON.parse(load("login-select-merchant.json")),
    );
    expect(parsed.nextStep).toBe("select_merchant");
    expect(parsed.merchants).toHaveLength(1);
  });

  it("parses failure", () => {
    const parsed = parseLoginResponse(JSON.parse(load("login-fail.json")));
    expect(parsed.ok).toBe(false);
    expect(parsed.message).toBe("PIN salah");
  });

  it("normalizes phone and validates pin", () => {
    expect(normalizeUsername("081234567890")).toBe("6281234567890");
    expect(normalizeUsername("81234567890")).toBe("6281234567890");
    expect(normalizeUsername("you@Example.com")).toBe("you@example.com");
    expect(isValidPin("123456")).toBe(true);
    expect(isValidPin("12345")).toBe(false);
  });
});

describe("API_TOKEN extraction", () => {
  it("extracts from sample dashboard HTML", () => {
    const html = load("dashboard-with-token.html");
    expect(extractApiTokenFromHtml(html)).toBe(
      "AbCdEfGhIjKlMnOpQrStUvWxYz123456",
    );
    expect(extractCsrfFromHtml(html)).toContain("csrf-from-meta");
  });

  it("returns null when absent", () => {
    expect(extractApiTokenFromHtml(load("dashboard-no-token.html"))).toBeNull();
  });
});

describe("paste validation", () => {
  it("accepts valid shapes", () => {
    const v = validatePasteInput({
      apiToken: "AbCdEfGhIjKlMnOpQrStUvWxYz123456",
      csrfToken: "csrf",
      cookie: "qasir_sess=abc",
      outletId: "645203",
    });
    expect(v.apiToken).toHaveLength(32);
  });

  it("rejects bad token", () => {
    expect(() =>
      validatePasteInput({
        apiToken: "short",
        csrfToken: "csrf",
        cookie: "c",
      }),
    ).toThrow(AppError);
  });

  it("rejects empty csrf/cookie", () => {
    expect(() =>
      validatePasteInput({
        apiToken: "AbCdEfGhIjKlMnOpQrStUvWxYz123456",
        csrfToken: "",
        cookie: "c",
      }),
    ).toThrow(AppError);
  });
});

describe("redirect allowlist", () => {
  it("allows *.qasir.id", () => {
    const u = assertQasirRedirectUrl(
      "https://bengkel-manuju-jaya-621095.qasir.id/dashboard?tokenWeb=x",
    );
    expect(u.hostname).toBe("bengkel-manuju-jaya-621095.qasir.id");
    expect(merchantSlugFromQasirHost(u.hostname)).toBe(
      "bengkel-manuju-jaya-621095",
    );
  });

  it("rejects off-domain redirects", () => {
    expect(() =>
      assertQasirRedirectUrl("https://evil.example/phish"),
    ).toThrow(AppError);
    try {
      assertQasirRedirectUrl("https://evil.example/phish");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe(ErrorCodes.REDIRECT_NOT_ALLOWED);
    }
  });

  it("rejects http", () => {
    expect(() =>
      assertQasirRedirectUrl("http://store.qasir.id/dashboard"),
    ).toThrow(AppError);
  });
});

describe("login flow (mocked fetch, no live PIN)", () => {
  it("connects when dashboard HTML contains API_TOKEN", async () => {
    const dashHtml = load("dashboard-with-token.html");
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("/sign-in")) {
        return new Response(
          '<meta name="csrf-token" content="www-csrf-token-value-here-xx">',
          {
            status: 200,
            headers: {
              "set-cookie":
                "laravel-session=abc; Path=/, XSRF-TOKEN=www%3D; Path=/",
            },
          },
        );
      }
      if (u.includes("device-language")) {
        return new Response(JSON.stringify({ status: 1 }), { status: 200 });
      }
      if (u.includes("/api/auth/login")) {
        return new Response(load("login-redirect.json"), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (u.includes("dashboard")) {
        return new Response(dashHtml, {
          status: 200,
          headers: {
            "set-cookie": "qasir_sess=sess; Path=/",
            "content-type": "text/html",
          },
        });
      }
      return new Response("nope", { status: 404 });
    });

    const result = await runQasirLoginFlow({
      username: "6281234567890",
      pin: "123456",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.kind).toBe("connected");
    if (result.kind === "connected") {
      expect(result.apiToken).toBe("AbCdEfGhIjKlMnOpQrStUvWxYz123456");
      expect(result.merchantSlug).toBe("bengkel-manuju-jaya-621095");
    }
  });

  it("returns needs_paste when token missing", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("/sign-in")) {
        return new Response(
          '<meta name="csrf-token" content="www-csrf-token-value-here-xx">',
          { status: 200 },
        );
      }
      if (u.includes("device-language")) {
        return new Response("{}", { status: 200 });
      }
      if (u.includes("/api/auth/login")) {
        return new Response(load("login-redirect.json"), { status: 200 });
      }
      if (u.includes("dashboard")) {
        return new Response(load("dashboard-no-token.html"), { status: 200 });
      }
      return new Response("nope", { status: 404 });
    });
    const result = await runQasirLoginFlow({
      username: "6281234567890",
      pin: "123456",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.kind).toBe("needs_paste");
  });

  it("rejects evil redirect_url from login JSON", async () => {
    const evil = {
      status: 1,
      message: "",
      next_step: "redirect",
      data: { redirect_url: "https://evil.example/steal" },
    };
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("/sign-in")) {
        return new Response(
          '<meta name="csrf-token" content="www-csrf-token-value-here-xx">',
          { status: 200 },
        );
      }
      if (u.includes("device-language")) {
        return new Response("{}", { status: 200 });
      }
      if (u.includes("/api/auth/login")) {
        return new Response(JSON.stringify(evil), { status: 200 });
      }
      return new Response("nope", { status: 404 });
    });
    const result = await runQasirLoginFlow({
      username: "6281234567890",
      pin: "123456",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message.toLowerCase()).toMatch(/allowlist|redirect/);
    }
  });

  it("returns next_step for select_merchant", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("/sign-in")) {
        return new Response(
          '<meta name="csrf-token" content="www-csrf-token-value-here-xx">',
          { status: 200 },
        );
      }
      if (u.includes("device-language")) {
        return new Response("{}", { status: 200 });
      }
      if (u.includes("/api/auth/login")) {
        return new Response(load("login-select-merchant.json"), {
          status: 200,
        });
      }
      return new Response("nope", { status: 404 });
    });
    const result = await runQasirLoginFlow({
      username: "6281234567890",
      pin: "123456",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.kind).toBe("next_step");
    if (result.kind === "next_step") {
      expect(result.step).toBe("select_merchant");
    }
  });
});

describe("CompositeQasirSessionProvider", () => {
  function mockDo(session: StoredQasirSession | null) {
    return {
      getSession: vi.fn(async () => session),
      clear: vi.fn(async () => {
        session = null;
      }),
      saveSession: vi.fn(),
      status: vi.fn(),
      checkRateLimit: vi.fn(),
    };
  }

  const env = {
    MERCHANT_SLUG: "bengkel-manuju-jaya-621095",
    DEFAULT_OUTLET_ID: "645203",
    QASIR_API_TOKEN: "StaticTokenStaticTokenStaticTok12",
    QASIR_CSRF_TOKEN: "static-csrf",
    QASIR_COOKIE: "qasir_sess=static",
  };

  it("prefers DO session over static secrets", async () => {
    const stored: StoredQasirSession = {
      apiToken: "DoTokenDoTokenDoTokenDoTokenDoTo12",
      csrfToken: "do-csrf",
      cookieJar: "qasir_sess=do",
      merchantSlug: "bengkel-manuju-jaya-621095",
      outletId: "645203",
      deviceId: "dev",
      connectedAt: Date.now(),
      subject: "dev-psk",
    };
    const stub = mockDo(stored);
    const provider = new CompositeQasirSessionProvider({
      env,
      subject: "dev-psk",
      sessionsDo: stub as never,
    });
    const s = await provider.getSession();
    expect(s.source).toBe("do");
    expect(s.secrets.apiToken).toBe(stored.apiToken);
  });

  it("falls back to static secrets when DO empty", async () => {
    const stub = mockDo(null);
    const provider = new CompositeQasirSessionProvider({
      env,
      subject: "dev-psk",
      sessionsDo: stub as never,
    });
    const s = await provider.getSession();
    expect(s.source).toBe("static");
    expect(s.secrets.apiToken).toBe(env.QASIR_API_TOKEN);
  });

  it("clear on markExpired then static also expired", async () => {
    const stored: StoredQasirSession = {
      apiToken: "DoTokenDoTokenDoTokenDoTokenDoTo12",
      csrfToken: "do-csrf",
      cookieJar: "qasir_sess=do",
      merchantSlug: "bengkel-manuju-jaya-621095",
      outletId: "645203",
      deviceId: "dev",
      connectedAt: Date.now(),
      subject: "dev-psk",
    };
    let current: StoredQasirSession | null = stored;
    const stub = {
      getSession: vi.fn(async () => current),
      clear: vi.fn(async () => {
        current = null;
      }),
    };
    const provider = new CompositeQasirSessionProvider({
      env,
      subject: "dev-psk",
      sessionsDo: stub as never,
    });
    await provider.markExpired();
    expect(stub.clear).toHaveBeenCalled();
    await expect(provider.getSession()).rejects.toMatchObject({
      code: ErrorCodes.QASIR_AUTH_EXPIRED,
    });
  });

  it("StaticQasirSessionProvider still works alone", async () => {
    const p = new StaticQasirSessionProvider(env);
    const s = await p.getSession();
    expect(s.source).toBe("static");
  });
});

describe("multi-step auth continuations (mocked, no live PIN)", () => {
  const pendingBase = {
    username: "6281234567890",
    pin: "123456",
    deviceId: "device-uuid",
    deviceType: "Chrome 150 · macOS",
    timezone: "Asia/Makassar",
    cookieJar: "laravel-session=abc; qasir_device_id=device-uuid",
    csrfToken: "www-csrf-token-value-here-xx",
    createdAt: Date.now(),
    expiresAt: Date.now() + 600_000,
  };

  it("parses select_outlet and verify_otp fixtures", () => {
    const outlet = parseLoginResponse(JSON.parse(load("login-select-outlet.json")));
    expect(outlet.nextStep).toBe("select_outlet");
    expect(outlet.outlets).toHaveLength(2);
    expect(outlet.merchantId).toBe(42);

    const otp = parseLoginResponse(JSON.parse(load("login-verify-otp.json")));
    expect(otp.nextStep).toBe("verify_otp");
    expect(otp.mobile).toBe("6281234567890");
    expect(otp.verifyKey).toBeTruthy();
  });

  it("parses outlet-select token_web success as redirect", () => {
    const parsed = parseLoginResponse(
      JSON.parse(load("outlet-select-success.json")),
    );
    expect(parsed.ok).toBe(true);
    expect(parsed.nextStep).toBe("redirect");
    expect(parsed.redirectUrl).toContain("bengkel-manuju-jaya-621095.qasir.id");
    expect(parsed.redirectUrl).toContain("tokenWeb=");
  });

  it("continueWithMerchant posts login with merchant_id then connects", async () => {
    const { continueWithMerchant } = await import("../../src/connect/login-flow");
    const dashHtml = load("dashboard-with-token.html");
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/api/auth/login")) {
        const body = JSON.parse(String(init?.body ?? "{}"));
        expect(body.merchant_id).toBe(1);
        expect(body.password).toBe("123456");
        return new Response(load("login-redirect.json"), { status: 200 });
      }
      if (u.includes("dashboard")) {
        return new Response(dashHtml, { status: 200 });
      }
      return new Response("nope", { status: 404 });
    });
    const result = await continueWithMerchant({
      pending: {
        ...pendingBase,
        step: "select_merchant",
        merchants: [{ id: 1, business_name: "Store A" }],
      },
      merchantId: 1,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.kind).toBe("connected");
  });

  it("continueWithOutlet uses outlet-select and scrapes token", async () => {
    const { continueWithOutlet } = await import("../../src/connect/login-flow");
    const dashHtml = load("dashboard-with-token.html");
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("outlet-select")) {
        const body = JSON.parse(String(init?.body ?? "{}"));
        expect(body.outlet_id).toBe(645203);
        expect(body.merchant_id).toBe(42);
        return new Response(load("outlet-select-success.json"), { status: 200 });
      }
      if (u.includes("dashboard")) {
        return new Response(dashHtml, { status: 200 });
      }
      return new Response("nope", { status: 404 });
    });
    const result = await continueWithOutlet({
      pending: {
        ...pendingBase,
        step: "select_outlet",
        merchantId: 42,
        outlets: [
          { id: 645203, name: "Utama", is_lock: false },
          { id: 645299, name: "Gudang", is_lock: true },
        ],
      },
      outletId: 645203,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.kind).toBe("connected");
    if (result.kind === "connected") {
      expect(result.outletId).toBe("645203");
    }
  });

  it("rejects locked outlet", async () => {
    const { continueWithOutlet } = await import("../../src/connect/login-flow");
    const result = await continueWithOutlet({
      pending: {
        ...pendingBase,
        step: "select_outlet",
        merchantId: 42,
        outlets: [{ id: 645299, name: "Gudang", is_lock: true }],
      },
      outletId: 645299,
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });
    expect(result.kind).toBe("error");
  });

  it("continueWithOtp verifies and redirects", async () => {
    const { continueWithOtp } = await import("../../src/connect/login-flow");
    const dashHtml = load("dashboard-with-token.html");
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("otp-verify")) {
        const body = JSON.parse(String(init?.body ?? "{}"));
        expect(body.code).toBe("1234");
        expect(body.verify_key).toBe("verify-key-fixture-not-secret");
        return new Response(load("otp-verify-redirect.json"), { status: 200 });
      }
      if (u.includes("dashboard")) {
        return new Response(dashHtml, { status: 200 });
      }
      return new Response("nope", { status: 404 });
    });
    const result = await continueWithOtp({
      pending: {
        ...pendingBase,
        step: "verify_otp",
        mobile: "6281234567890",
        merchantId: 42,
        verifyKey: "verify-key-fixture-not-secret",
      },
      code: "1234",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.kind).toBe("connected");
  });

  it("resendOtp posts allowlisted host", async () => {
    const { resendOtp } = await import("../../src/connect/login-flow");
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toBe(
        "https://www.qasir.id/api/auth/login/resend-otp",
      );
      return new Response(load("resend-otp-ok.json"), { status: 200 });
    });
    const out = await resendOtp({
      pending: {
        ...pendingBase,
        step: "verify_otp",
        mobile: "6281234567890",
        merchantId: 42,
        verifyKey: "k",
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(out.ok).toBe(true);
  });
});
