import { AppError, ErrorCodes } from "../errors/codes";

const SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/** Qasir product hosts that are never a merchant dashboard subdomain. */
const RESERVED_SUBDOMAINS = new Set([
  "www",
  "pos",
  "order",
  "account",
  "payment",
  "sms",
  "api",
  "cdn",
  "auth",
  "app",
]);

/** Hosts that may appear in Qasir auth redirect_url (any *.qasir.id). */
export function isQasirIdHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "qasir.id" || h.endsWith(".qasir.id");
}

/**
 * Assert redirect_url is https on *.qasir.id only.
 * Rejects userinfo, non-443 ports, http, and off-domain hosts.
 */
export function assertQasirRedirectUrl(raw: string, base?: URL): URL {
  let url: URL;
  try {
    url = new URL(raw, base);
  } catch {
    throw new AppError(ErrorCodes.REDIRECT_NOT_ALLOWED, "Invalid redirect_url");
  }
  if (url.protocol !== "https:") {
    throw new AppError(ErrorCodes.REDIRECT_NOT_ALLOWED, "Redirect must be https");
  }
  if (url.username || url.password) {
    throw new AppError(ErrorCodes.REDIRECT_NOT_ALLOWED, "Redirect userinfo not allowed");
  }
  if (url.port && url.port !== "443") {
    throw new AppError(
      ErrorCodes.REDIRECT_NOT_ALLOWED,
      "Redirect non-default port not allowed",
    );
  }
  if (!isQasirIdHost(url.hostname)) {
    throw new AppError(
      ErrorCodes.REDIRECT_NOT_ALLOWED,
      `Redirect host not allowlisted: ${url.hostname}`,
    );
  }
  return url;
}

/**
 * Assert a dashboard URL (tokenWeb landing, subdomain_url, or any followed
 * Location) is exactly `https://${expectedSlug}.qasir.id`. Relative Locations
 * resolve against `base`.
 */
export function assertMerchantDashboardUrl(raw: string, expectedSlug: string, base?: URL): URL {
  const url = assertQasirRedirectUrl(raw, base);
  const slug = expectedSlug.trim().toLowerCase();
  if (!SLUG_RE.test(slug) || RESERVED_SUBDOMAINS.has(slug)) {
    throw new AppError(ErrorCodes.INVALID_INPUT, "MERCHANT_SLUG is not a valid merchant subdomain");
  }
  if (url.hostname.toLowerCase() !== `${slug}.qasir.id`) {
    throw new AppError(
      ErrorCodes.REDIRECT_NOT_ALLOWED,
      `Login landed on ${url.hostname}, not the configured merchant ${slug}.qasir.id`,
    );
  }
  return url;
}

/** Extract merchant slug from https://{slug}.qasir.id/...; null for product hosts. */
export function merchantSlugFromQasirHost(hostname: string): string | null {
  const h = hostname.toLowerCase();
  if (!h.endsWith(".qasir.id")) return null;
  const slug = h.slice(0, -".qasir.id".length);
  if (!SLUG_RE.test(slug) || RESERVED_SUBDOMAINS.has(slug)) return null;
  return slug;
}
