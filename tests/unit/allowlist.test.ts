import { describe, expect, it } from "vitest";
import {
  assertAllowedUrl,
  assertSafeSlug,
  isQasirLoginUrl,
  resolveHost,
} from "../../src/dispatcher/allowlist";
import { applyQuery, buildPath, resolveUrl } from "../../src/dispatcher/path";
import { AppError, ErrorCodes, isAppErrorLike, toAppError } from "../../src/errors/codes";

const SLUG = "bengkel-manuju-jaya-621095";

describe("allowlist + path", () => {
  it("resolves known hosts", () => {
    expect(resolveHost("pos", SLUG)).toBe("pos.qasir.id");
    expect(resolveHost("merchant", SLUG)).toBe(`${SLUG}.qasir.id`);
  });

  it("rejects bad slug and traversal", () => {
    expect(() => assertSafeSlug("../evil")).toThrow(AppError);
    expect(() =>
      buildPath("/api/v5/customers/{customer_id}", {
        customer_id: "../x",
      }),
    ).toThrow(AppError);
    expect(() =>
      buildPath("/api/v5/customers/{customer_id}", {
        customer_id: "https://evil.test/1",
      }),
    ).toThrow(AppError);
  });

  it("whitelists path segments, rejecting dot segments and encoded separators (DISP-07)", () => {
    for (const bad of [".", "..", "a.b", "%2e", "%2F", "a\\b", "a b", "ä", "x".repeat(65), ""]) {
      expect(() => buildPath("/api/v5/purchases/{purchase_id}/items", { purchase_id: bad })).toThrow(
        expect.objectContaining({ code: ErrorCodes.INVALID_INPUT }),
      );
    }
    expect(buildPath("/api/v5/purchases/{purchase_id}/items", { purchase_id: 1147217 })).toBe(
      "/api/v5/purchases/1147217/items",
    );
    expect(buildPath("/ajax/purchase/cancel/{id}", { id: "PO_12-a" })).toBe("/ajax/purchase/cancel/PO_12-a");
  });

  it("resolveUrl refuses any path the URL parser would rewrite", () => {
    expect(resolveUrl("pos.qasir.id", "/api/v5/products").toString()).toBe(
      "https://pos.qasir.id/api/v5/products",
    );
    for (const rewritten of ["/api/v5/inventories/./stock-histories", "/api/v5/a/../b", "/api\\v5", "/a b"]) {
      expect(() => resolveUrl("pos.qasir.id", rewritten)).toThrow(
        expect.objectContaining({ code: ErrorCodes.INVALID_INPUT }),
      );
    }
  });

  it("applyQuery skips undefined values", () => {
    const url = new URL("https://pos.qasir.id/api/v5/products");
    applyQuery(url, { page: 1, name: undefined, flag: true });
    expect(url.search).toBe("?page=1&flag=true");
  });

  it("rejects off-allowlist hosts", () => {
    expect(() =>
      assertAllowedUrl(new URL("https://evil.example/api"), "slug"),
    ).toThrow(AppError);
    expect(() =>
      assertAllowedUrl(new URL("http://pos.qasir.id/api"), "slug"),
    ).toThrow(AppError);
  });

  it("isQasirLoginUrl detects sign-in pages on Qasir hosts only", () => {
    expect(isQasirLoginUrl(new URL("https://www.qasir.id/sign-in?lang=id"))).toBe(true);
    expect(isQasirLoginUrl(new URL(`https://${SLUG}.qasir.id/login`))).toBe(true);
    expect(isQasirLoginUrl(new URL("https://qasir.id/auth/login"))).toBe(true);
    expect(isQasirLoginUrl(new URL(`https://${SLUG}.qasir.id/suppliers`))).toBe(false);
    expect(isQasirLoginUrl(new URL(`https://${SLUG}.qasir.id/blogin`))).toBe(false);
    expect(isQasirLoginUrl(new URL("https://evil.example/login"))).toBe(false);
    expect(isQasirLoginUrl(new URL("http://www.qasir.id/sign-in"))).toBe(false);
  });
});

describe("structural AppError detection (C4)", () => {
  it("recognises AppErrors that crossed an RPC boundary as plain Error", () => {
    const rpc = Object.assign(new Error("Qasir session marked expired"), {
      name: "AppError",
      code: "QASIR_AUTH_EXPIRED",
      status: 401,
    });
    expect(rpc instanceof AppError).toBe(false);
    expect(isAppErrorLike(rpc)).toBe(true);
    const typed = toAppError(rpc);
    expect(typed).toBeInstanceOf(AppError);
    expect(typed).toMatchObject({ code: "QASIR_AUTH_EXPIRED", status: 401, message: rpc.message });
  });

  it("maps unknown codes to UPSTREAM_ERROR and ignores ordinary errors", () => {
    expect(toAppError({ name: "AppError", code: "WHATEVER", message: "m" })?.code).toBe(
      ErrorCodes.UPSTREAM_ERROR,
    );
    expect(toAppError(new Error("x"))).toBeUndefined();
    expect(isAppErrorLike(null)).toBe(false);
    const real = new AppError(ErrorCodes.FORBIDDEN, "no");
    expect(toAppError(real)).toBe(real);
  });
});
