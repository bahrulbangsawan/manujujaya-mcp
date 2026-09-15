import { describe, expect, it } from "vitest";
import {
  assertCsrf,
  ensureCsrf,
  issueOwnerCookie,
  ownerAuthConfigured,
  readOwner,
  verifyOwnerPassword,
} from "../../src/auth/owner";
import { principalFromProps, requireScope, resolveDevPsk } from "../../src/auth/verify";
import { assertFormCsrf, requireConnectAccess } from "../../src/connect/gate";
import { ErrorCodes } from "../../src/errors/codes";

const OWNER_ENV = {
  OWNER_PASSWORD: "correct-horse-battery-staple",
  SESSION_ENCRYPTION_KEY: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
};
const PSK = "local-psk-0123456789abcdef";

function cookieHeader(setCookie: string): string {
  return setCookie.split(";")[0]!;
}

describe("OAuth props → principal", () => {
  it("fails closed on missing or malformed props", () => {
    expect(() => principalFromProps(undefined)).toThrowError();
    expect(() => principalFromProps({ scopes: ["qasir:read"] })).toThrowError();
    expect(() => principalFromProps({ subject: "owner", scopes: "qasir:read" })).toThrowError();
  });

  it("drops unknown scopes and enforces requireScope", () => {
    const p = principalFromProps({ subject: "owner", scopes: ["qasir:read", "root"], clientId: "c1" });
    expect(p.scopes).toEqual(["qasir:read"]);
    expect(p.via).toBe("oauth");
    expect(() => requireScope(p, "qasir:read")).not.toThrow();
    expect(() => requireScope(p, "qasir:write")).toThrowError(expect.objectContaining({ code: ErrorCodes.FORBIDDEN }));
  });
});

describe("dev PSK", () => {
  const env = { ALLOW_DEV_PSK: "true", DEV_PSK: PSK };

  it("is honoured only on loopback hosts with the flag on", async () => {
    expect(await resolveDevPsk(PSK, new Request("http://localhost:8787/mcp"), env)).not.toBeNull();
    expect(await resolveDevPsk(PSK, new Request("http://127.0.0.1:8787/mcp"), env)).not.toBeNull();
    expect(await resolveDevPsk(PSK, new Request("https://mcp.manujujaya.com/mcp"), env)).toBeNull();
    expect(await resolveDevPsk(PSK, new Request("http://localhost/mcp"), { ...env, ALLOW_DEV_PSK: "false" })).toBeNull();
    expect(await resolveDevPsk("wrong", new Request("http://localhost/mcp"), env)).toBeNull();
  });

  it("rejects short PSKs", async () => {
    expect(await resolveDevPsk("short", new Request("http://localhost/mcp"), { ALLOW_DEV_PSK: "true", DEV_PSK: "short" })).toBeNull();
  });
});

describe("owner password and cookie", () => {
  it("fails closed when not configured", async () => {
    expect(ownerAuthConfigured({})).toBe(false);
    expect(ownerAuthConfigured({ ...OWNER_ENV, OWNER_PASSWORD: "too-short" })).toBe(false);
    await expect(verifyOwnerPassword({}, "x")).rejects.toMatchObject({ code: ErrorCodes.UNAUTHORIZED });
  });

  it("verifies the password", async () => {
    expect(await verifyOwnerPassword(OWNER_ENV, OWNER_ENV.OWNER_PASSWORD)).toBe(true);
    expect(await verifyOwnerPassword(OWNER_ENV, "correct-horse-battery-stapl")).toBe(false);
    expect(await verifyOwnerPassword(OWNER_ENV, "")).toBe(false);
  });

  it("issues a signed __Host- cookie that verifies and rejects tampering", async () => {
    const req = new Request("https://mcp.manujujaya.com/login");
    const set = await issueOwnerCookie(req, OWNER_ENV);
    expect(set).toMatch(/^__Host-mj_owner=/);
    expect(set).toContain("HttpOnly");
    expect(set).toContain("Secure");
    const cookie = cookieHeader(set);
    const ok = new Request("https://mcp.manujujaya.com/connect", { headers: { cookie } });
    expect(await readOwner(ok, OWNER_ENV)).toMatchObject({ subject: "owner" });

    const tampered = cookie.slice(0, -2) + (cookie.endsWith("AA") ? "BB" : "AA");
    expect(await readOwner(new Request("https://mcp.manujujaya.com/", { headers: { cookie: tampered } }), OWNER_ENV)).toBeNull();

    // Rotating the password invalidates existing cookies.
    expect(await readOwner(ok, { ...OWNER_ENV, OWNER_PASSWORD: "another-long-owner-password" })).toBeNull();
  });

  it("double-submit CSRF", async () => {
    const first = ensureCsrf(new Request("https://mcp.manujujaya.com/authorize"));
    expect(first.setCookie).toBeDefined();
    const withCookie = new Request("https://mcp.manujujaya.com/authorize", {
      headers: { cookie: cookieHeader(first.setCookie!) },
    });
    await expect(assertCsrf(withCookie, first.token)).resolves.toBeUndefined();
    await expect(assertCsrf(withCookie, "0".repeat(32))).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN });
    await expect(assertCsrf(new Request("https://mcp.manujujaya.com/authorize"), first.token)).rejects.toMatchObject({
      code: ErrorCodes.FORBIDDEN,
    });
  });
});

describe("/connect gate", () => {
  const env = { ...OWNER_ENV, ALLOW_DEV_PSK: "false" };

  it("denies anonymous and bearer-only requests", async () => {
    await expect(requireConnectAccess(new Request("https://mcp.manujujaya.com/connect"), env)).rejects.toMatchObject({
      code: ErrorCodes.UNAUTHORIZED,
    });
    await expect(
      requireConnectAccess(
        new Request("https://mcp.manujujaya.com/connect", { headers: { "x-dev-psk": PSK } }),
        { ...env, ALLOW_DEV_PSK: "true", DEV_PSK: PSK },
      ),
    ).rejects.toMatchObject({ code: ErrorCodes.UNAUTHORIZED });
  });

  it("accepts the owner cookie and enforces form CSRF", async () => {
    const set = await issueOwnerCookie(new Request("https://mcp.manujujaya.com/login"), env);
    const identity = await requireConnectAccess(
      new Request("https://mcp.manujujaya.com/connect", { headers: { cookie: cookieHeader(set) } }),
      env,
    );
    expect(identity.via).toBe("owner-cookie");
    await expect(assertFormCsrf(identity, "nope")).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN });
    await expect(assertFormCsrf(identity, identity.csrfToken)).resolves.toBeUndefined();
  });

  it("accepts x-dev-psk on loopback for scripts", async () => {
    const identity = await requireConnectAccess(
      new Request("http://localhost:8787/connect/status", { headers: { "x-dev-psk": PSK } }),
      { ...env, ALLOW_DEV_PSK: "true", DEV_PSK: PSK },
    );
    expect(identity.via).toBe("dev-psk");
    expect(identity.csrfExempt).toBe(true);
  });
});
