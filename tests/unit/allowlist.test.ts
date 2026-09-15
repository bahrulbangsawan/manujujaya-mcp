import { describe, expect, it } from "vitest";
import {
  assertAllowedUrl,
  assertSafeSlug,
  resolveHost,
} from "../../src/dispatcher/allowlist";
import { buildPath } from "../../src/dispatcher/path";
import { AppError } from "../../src/errors/codes";

describe("allowlist + path", () => {
  it("resolves known hosts", () => {
    expect(resolveHost("pos", "bengkel-manuju-jaya-621095")).toBe("pos.qasir.id");
    expect(resolveHost("merchant", "bengkel-manuju-jaya-621095")).toBe(
      "bengkel-manuju-jaya-621095.qasir.id",
    );
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

  it("rejects off-allowlist hosts", () => {
    expect(() =>
      assertAllowedUrl(new URL("https://evil.example/api"), "slug"),
    ).toThrow(AppError);
    expect(() =>
      assertAllowedUrl(new URL("http://pos.qasir.id/api"), "slug"),
    ).toThrow(AppError);
  });
});
