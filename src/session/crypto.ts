import { AppError, ErrorCodes } from "../errors/codes";

const ALGO = "AES-GCM";
const IV_LEN = 12;
const HKDF_SALT = "manujujaya-mcp/qasir-session-store";
const HKDF_INFO = "mj-session-aes-gcm-v2";

const enc = new TextEncoder();

/** Legacy at-rest blob: raw/SHA-256 key, no associated data. Read-only. */
export interface EncryptedBlobV1 {
  v: 1;
  iv: string;
  ct: string;
}

export interface Ciphertext {
  iv: string;
  ct: string;
}

export interface SessionKeys {
  /** HKDF-derived AES-GCM key for all new writes (always used with AAD). */
  aead: CryptoKey;
  /** Pre-HKDF key, only to read EncryptedBlobV1 records written by older builds. */
  legacy: CryptoKey;
}

function b64Encode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}

function b64Decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(text)));
}

export async function sha256Hex(text: string): Promise<string> {
  return [...(await sha256(text))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Secret bytes behind SESSION_ENCRYPTION_KEY: a base64 32-byte key (preferred,
 * `openssl rand -base64 32`) is used as-is; anything else is treated as a
 * utf-8 passphrase.
 */
function secretBytes(trimmed: string): { bytes: Uint8Array; raw32: boolean } {
  try {
    const decoded = b64Decode(trimmed);
    if (decoded.byteLength === 32) return { bytes: decoded, raw32: true };
  } catch {
    // not base64 — passphrase
  }
  return { bytes: enc.encode(trimmed), raw32: false };
}

/**
 * Import SESSION_ENCRYPTION_KEY. The AES key for new writes is derived with HKDF
 * (distinct label from the owner-cookie HMAC key derived from the same secret).
 */
export async function importSessionKeys(raw: string): Promise<SessionKeys> {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new AppError(ErrorCodes.INVALID_INPUT, "SESSION_ENCRYPTION_KEY is empty");
  }
  const { bytes, raw32 } = secretBytes(trimmed);
  const base = await crypto.subtle.importKey("raw", bytes, "HKDF", false, ["deriveKey"]);
  const aead = await crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: enc.encode(HKDF_SALT), info: enc.encode(HKDF_INFO) },
    base,
    { name: ALGO, length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  const legacyBytes = raw32 ? bytes : await sha256(trimmed);
  const legacy = await crypto.subtle.importKey("raw", legacyBytes, { name: ALGO }, false, [
    "decrypt",
  ]);
  return { aead, legacy };
}

export async function encryptJson(
  key: CryptoKey,
  value: unknown,
  aad: string,
): Promise<Ciphertext> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const plain = enc.encode(JSON.stringify(value));
  const ct = await crypto.subtle.encrypt(
    { name: ALGO, iv, additionalData: enc.encode(aad) },
    key,
    plain,
  );
  return { iv: b64Encode(iv), ct: b64Encode(ct) };
}

/**
 * Decrypt a blob. `aad` must match the value used at encryption; pass `null`
 * only for legacy v1 blobs that were written without associated data.
 * Throws AppError(QASIR_AUTH_EXPIRED) on any authentication failure.
 */
export async function decryptJson<T>(
  key: CryptoKey,
  blob: Ciphertext,
  aad: string | null,
): Promise<T> {
  if (typeof blob.iv !== "string" || typeof blob.ct !== "string" || !blob.iv || !blob.ct) {
    throw new AppError(ErrorCodes.INVALID_INPUT, "Invalid encrypted session blob");
  }
  try {
    const iv = b64Decode(blob.iv);
    const params = aad === null ? { name: ALGO, iv } : { name: ALGO, iv, additionalData: enc.encode(aad) };
    const plain = await crypto.subtle.decrypt(params, key, b64Decode(blob.ct));
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  } catch {
    throw new AppError(
      ErrorCodes.QASIR_AUTH_EXPIRED,
      "Failed to decrypt session (wrong SESSION_ENCRYPTION_KEY?)",
    );
  }
}

export function isEncryptedBlobV1(value: unknown): value is EncryptedBlobV1 {
  return (
    !!value &&
    typeof value === "object" &&
    (value as EncryptedBlobV1).v === 1 &&
    typeof (value as EncryptedBlobV1).iv === "string" &&
    typeof (value as EncryptedBlobV1).ct === "string"
  );
}

export interface SessionCryptoEnv {
  SESSION_ENCRYPTION_KEY?: string;
  REQUIRE_SESSION_ENCRYPTION?: string;
}

export async function resolveSessionCrypto(
  env: SessionCryptoEnv,
): Promise<{ keys: SessionKeys | null; require: boolean }> {
  const require = env.REQUIRE_SESSION_ENCRYPTION === "true";
  const raw = env.SESSION_ENCRYPTION_KEY?.trim();
  if (!raw) {
    if (require) {
      throw new AppError(
        ErrorCodes.FORBIDDEN,
        "REQUIRE_SESSION_ENCRYPTION=true but SESSION_ENCRYPTION_KEY is missing — refusing plaintext session storage",
      );
    }
    return { keys: null, require };
  }
  return { keys: await importSessionKeys(raw), require };
}
