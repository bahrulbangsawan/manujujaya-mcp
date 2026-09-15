import { describe, expect, it } from "vitest";
import {
  decryptJson,
  encryptJson,
  importSessionKeys,
  resolveSessionCrypto,
  sha256Hex,
} from "../../src/session/crypto";
import { ErrorCodes } from "../../src/errors/codes";

const RAW_KEY = btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, i) => i)));

function b64(bytes: Uint8Array | ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

describe("session AES-GCM crypto", () => {
  it("round-trips JSON with a base64 32-byte key and AAD", async () => {
    const { aead } = await importSessionKeys(RAW_KEY);
    const blob = await encryptJson(aead, { apiToken: "AbCdEfGhIjKlMnOpQrStUvWxYz123456" }, "scope|session");
    expect(blob.iv).toBeTruthy();
    expect(blob.ct).toBeTruthy();
    const out = await decryptJson<{ apiToken: string }>(aead, blob, "scope|session");
    expect(out.apiToken).toBe("AbCdEfGhIjKlMnOpQrStUvWxYz123456");
  });

  it("binds ciphertext to its AAD", async () => {
    const { aead } = await importSessionKeys(RAW_KEY);
    const blob = await encryptJson(aead, { x: 1 }, "do-a|session|session");
    await expect(decryptJson(aead, blob, "do-b|session|session")).rejects.toMatchObject({
      code: ErrorCodes.QASIR_AUTH_EXPIRED,
    });
    await expect(decryptJson(aead, blob, null)).rejects.toMatchObject({ code: ErrorCodes.QASIR_AUTH_EXPIRED });
  });

  it("derives the AES key with HKDF (the raw key alone does not decrypt new blobs)", async () => {
    const { aead } = await importSessionKeys(RAW_KEY);
    const blob = await encryptJson(aead, { x: 1 }, "aad");
    const rawBytes = Uint8Array.from(atob(RAW_KEY), (c) => c.charCodeAt(0));
    const rawKey = await crypto.subtle.importKey("raw", rawBytes, "AES-GCM", false, ["decrypt"]);
    await expect(decryptJson(rawKey, blob, "aad")).rejects.toMatchObject({ code: ErrorCodes.QASIR_AUTH_EXPIRED });
  });

  it("reads legacy v1 blobs (raw key, no AAD) with the legacy key", async () => {
    const rawBytes = Uint8Array.from(atob(RAW_KEY), (c) => c.charCodeAt(0));
    const oldKey = await crypto.subtle.importKey("raw", rawBytes, "AES-GCM", false, ["encrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, oldKey, new TextEncoder().encode('{"x":2}'));
    const { legacy } = await importSessionKeys(RAW_KEY);
    expect(await decryptJson<{ x: number }>(legacy, { iv: b64(iv), ct: b64(ct) }, null)).toEqual({ x: 2 });
  });

  it("accepts a passphrase-style key", async () => {
    const { aead } = await importSessionKeys("dev-passphrase-not-for-prod");
    const blob = await encryptJson(aead, { x: 1 }, "aad");
    expect(await decryptJson<{ x: number }>(aead, blob, "aad")).toEqual({ x: 1 });
  });

  it("fails with a different key", async () => {
    const a = await importSessionKeys(RAW_KEY);
    const b = await importSessionKeys("another-passphrase-entirely");
    const blob = await encryptJson(a.aead, { x: 1 }, "aad");
    await expect(decryptJson(b.aead, blob, "aad")).rejects.toMatchObject({ code: ErrorCodes.QASIR_AUTH_EXPIRED });
  });

  it("fails closed when REQUIRE_SESSION_ENCRYPTION and no key", async () => {
    await expect(resolveSessionCrypto({ REQUIRE_SESSION_ENCRYPTION: "true" })).rejects.toMatchObject({
      code: ErrorCodes.FORBIDDEN,
    });
  });

  it("allows missing key when not required", async () => {
    const r = await resolveSessionCrypto({ REQUIRE_SESSION_ENCRYPTION: "false" });
    expect(r.keys).toBeNull();
  });

  it("sha256Hex", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
