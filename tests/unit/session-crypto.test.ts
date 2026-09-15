import { describe, expect, it } from "vitest";
import {
  decryptJson,
  encryptJson,
  importSessionKey,
  resolveSessionCrypto,
} from "../../src/session/crypto";
import { AppError, ErrorCodes } from "../../src/errors/codes";

describe("session AES-GCM crypto", () => {
  it("round-trips JSON with base64 32-byte key", async () => {
    const rawKey = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
    const key = await importSessionKey(rawKey);
    const blob = await encryptJson(key, { apiToken: "AbCdEfGhIjKlMnOpQrStUvWxYz123456" });
    expect(blob.v).toBe(1);
    expect(blob.iv).toBeTruthy();
    expect(blob.ct).toBeTruthy();
    const out = await decryptJson<{ apiToken: string }>(key, blob);
    expect(out.apiToken).toBe("AbCdEfGhIjKlMnOpQrStUvWxYz123456");
  });

  it("fail closed when REQUIRE_SESSION_ENCRYPTION and no key", async () => {
    await expect(
      resolveSessionCrypto({ REQUIRE_SESSION_ENCRYPTION: "true" }),
    ).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN });
  });

  it("allows missing key when not required", async () => {
    const r = await resolveSessionCrypto({
      REQUIRE_SESSION_ENCRYPTION: "false",
    });
    expect(r.key).toBeNull();
  });

  it("accepts passphrase-style key via SHA-256", async () => {
    const key = await importSessionKey("dev-passphrase-not-for-prod");
    const blob = await encryptJson(key, { x: 1 });
    const out = await decryptJson<{ x: number }>(key, blob);
    expect(out.x).toBe(1);
  });
});
