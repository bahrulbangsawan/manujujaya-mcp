import { AppError, ErrorCodes } from "../errors/codes";
import { isApiTokenShape, isCsrfTokenShape } from "./extract-token";

export interface PasteSessionInput {
  apiToken: string;
  csrfToken: string;
  cookie: string;
  outletId?: string;
}

export interface ValidatedPaste {
  apiToken: string;
  csrfToken: string;
  cookieJar: string;
  outletId: string;
}

const COOKIE_NAME_RE = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
/** RFC 6265 cookie-octet plus space (browsers copy some values unquoted with spaces). */
const COOKIE_VALUE_RE = /^[\x20-\x3a\x3c-\x7e]*$/;
const MAX_COOKIE_LEN = 8192;

/**
 * Normalize a pasted Cookie header: strip a leading `Cookie:` label, turn line
 * breaks into separators, and require printable-ASCII `name=value` parts, so
 * the stored value is always a legal header value.
 */
function normalizeCookie(raw: string): string {
  const unlabeled = raw.trim().replace(/^cookie\s*:\s*/i, "");
  const parts = unlabeled
    .replace(/[\r\n]+/g, ";")
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) {
    throw new AppError(ErrorCodes.INVALID_INPUT, "Cookie string is required");
  }
  for (const part of parts) {
    const eq = part.indexOf("=");
    const name = eq > 0 ? part.slice(0, eq).trim() : "";
    const value = eq > 0 ? part.slice(eq + 1).trim() : "";
    if (!COOKIE_NAME_RE.test(name) || !COOKIE_VALUE_RE.test(value)) {
      throw new AppError(
        ErrorCodes.INVALID_INPUT,
        "Cookie must be name=value pairs separated by ';' (printable ASCII only)",
      );
    }
  }
  const cookie = parts.join("; ");
  if (cookie.length > MAX_COOKIE_LEN) {
    throw new AppError(ErrorCodes.INVALID_INPUT, "Cookie string is too long");
  }
  return cookie;
}

export function validatePasteInput(input: PasteSessionInput): ValidatedPaste {
  const apiToken = input.apiToken?.trim() ?? "";
  const csrfToken = (input.csrfToken ?? "").trim().replace(/^x-csrf-token\s*:\s*/i, "");
  const outletId = input.outletId?.trim() ?? "";

  if (!isApiTokenShape(apiToken)) {
    throw new AppError(
      ErrorCodes.INVALID_INPUT,
      "API_TOKEN must be exactly 32 alphanumeric characters",
    );
  }
  if (!csrfToken) {
    throw new AppError(ErrorCodes.INVALID_INPUT, "CSRF token is required");
  }
  if (!isCsrfTokenShape(csrfToken)) {
    throw new AppError(
      ErrorCodes.INVALID_INPUT,
      "CSRF token must be 16-256 characters from the dashboard <meta name=\"csrf-token\">",
    );
  }
  if (!(input.cookie ?? "").trim()) {
    throw new AppError(ErrorCodes.INVALID_INPUT, "Cookie string is required");
  }
  const cookieJar = normalizeCookie(input.cookie);
  if (outletId && !/^\d{1,12}$/.test(outletId)) {
    throw new AppError(ErrorCodes.INVALID_INPUT, "Outlet id must be numeric");
  }
  return { apiToken, csrfToken, cookieJar, outletId };
}
