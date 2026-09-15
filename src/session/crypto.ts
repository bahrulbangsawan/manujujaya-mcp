import { AppError, ErrorCodes } from "../errors/codes";

const ALGO = "AES-GCM";
const IV_LEN = 12;

export interface EncryptedBlob {
  v: 1;
  iv: string;
  ct: string;
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

/**
 * Import SESSION_ENCRYPTION_KEY. Accepts base64 (preferred, 32 bytes) or
 * utf-8 passphrase hashed via SHA-256 (dev convenience).
 */
export async function importSessionKey(
  raw: string,
): Promise<CryptoKey> {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new AppError(
      ErrorCodes.INVALID_INPUT,
      "SESSION_ENCRYPTION_KEY is empty",
    );
  }
  let keyBytes: Uint8Array;
  try {
    const decoded = b64Decode(trimmed);
    keyBytes = decoded.byteLength === 32 ? decoded : await sha256(trimmed);
  } catch {
    keyBytes = await sha256(trimmed);
  }
  return crypto.subtle.importKey("raw", keyBytes, { name: ALGO }, false, [
    "encrypt",
    "decrypt",
  ]);
}

async function sha256(text: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return new Uint8Array(digest);
}

export async function encryptJson(
  key: CryptoKey,
  value: unknown,
): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const plain = new TextEncoder().encode(JSON.stringify(value));
  const ct = await crypto.subtle.encrypt({ name: ALGO, iv }, key, plain);
  return { v: 1, iv: b64Encode(iv), ct: b64Encode(ct) };
}

export async function decryptJson<T>(
  key: CryptoKey,
  blob: EncryptedBlob,
): Promise<T> {
  if (blob.v !== 1 || !blob.iv || !blob.ct) {
    throw new AppError(ErrorCodes.INVALID_INPUT, "Invalid encrypted session blob");
  }
  const iv = b64Decode(blob.iv);
  const ct = b64Decode(blob.ct);
  try {
    const plain = await crypto.subtle.decrypt({ name: ALGO, iv }, key, ct);
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  } catch {
    throw new AppError(
      ErrorCodes.QASIR_AUTH_EXPIRED,
      "Failed to decrypt session (wrong SESSION_ENCRYPTION_KEY?)",
    );
  }
}

export function isEncryptedBlob(value: unknown): value is EncryptedBlob {
  return (
    !!value &&
    typeof value === "object" &&
    (value as EncryptedBlob).v === 1 &&
    typeof (value as EncryptedBlob).iv === "string" &&
    typeof (value as EncryptedBlob).ct === "string"
  );
}

export interface SessionCryptoEnv {
  SESSION_ENCRYPTION_KEY?: string;
  REQUIRE_SESSION_ENCRYPTION?: string;
}

export async function resolveSessionCrypto(
  env: SessionCryptoEnv,
): Promise<{ key: CryptoKey | null; require: boolean }> {
  const require = env.REQUIRE_SESSION_ENCRYPTION === "true";
  const raw = env.SESSION_ENCRYPTION_KEY?.trim();
  if (!raw) {
    if (require) {
      throw new AppError(
        ErrorCodes.FORBIDDEN,
        "REQUIRE_SESSION_ENCRYPTION=true but SESSION_ENCRYPTION_KEY is missing — refusing plaintext DO write",
      );
    }
    return { key: null, require };
  }
  return { key: await importSessionKey(raw), require };
}
