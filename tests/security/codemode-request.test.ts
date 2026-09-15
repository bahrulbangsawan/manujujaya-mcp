import { describe, expect, it } from "vitest";
import { AppError, ErrorCodes } from "../../src/errors/codes";

// Exercise the same validation used inside runCodemode without WorkerLoader.
function normalizeRequestArgs(raw: unknown) {
  if (!raw || typeof raw !== "object") {
    throw new AppError(ErrorCodes.INVALID_INPUT, "request() expects an object");
  }
  const o = raw as Record<string, unknown>;
  if ("method" in o || "url" in o || "headers" in o || "authorization" in o) {
    throw new AppError(
      ErrorCodes.INVALID_INPUT,
      "request() rejects method/url/headers — use operationId only",
    );
  }
  if (typeof o.operationId !== "string" || !o.operationId) {
    throw new AppError(ErrorCodes.INVALID_INPUT, "operationId is required");
  }
  return o;
}

describe("codemode request contract", () => {
  it("rejects method/url smuggling", () => {
    expect(() =>
      normalizeRequestArgs({
        operationId: "products.list",
        method: "DELETE",
        url: "https://evil.test",
      }),
    ).toThrow(/rejects method/);
  });

  it("requires operationId", () => {
    expect(() => normalizeRequestArgs({ query: { page: 1 } })).toThrow(
      /operationId/,
    );
  });
});
