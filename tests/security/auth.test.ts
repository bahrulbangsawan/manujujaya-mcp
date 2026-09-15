import { describe, expect, it } from "vitest";
import { authenticateRequest } from "../../src/auth/verify";
import { AppError, ErrorCodes } from "../../src/errors/codes";

describe("auth boundary", () => {
  it("fails closed without bearer", async () => {
    await expect(
      authenticateRequest(new Request("https://x/mcp"), {
        ALLOW_DEV_PSK: "false",
      }),
    ).rejects.toMatchObject({ code: ErrorCodes.UNAUTHORIZED });
  });

  it("accepts dev PSK only when flagged", async () => {
    const req = new Request("https://x/mcp", {
      headers: { authorization: "Bearer secret-psk" },
    });
    await expect(
      authenticateRequest(req, { ALLOW_DEV_PSK: "false", DEV_PSK: "secret-psk" }),
    ).rejects.toBeInstanceOf(AppError);

    const principal = await authenticateRequest(req, {
      ALLOW_DEV_PSK: "true",
      DEV_PSK: "secret-psk",
    });
    expect(principal.via).toBe("dev-psk");
    expect(principal.scopes).toContain("qasir:read");
  });
});
