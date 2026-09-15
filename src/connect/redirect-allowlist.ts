import { AppError, ErrorCodes } from "../errors/codes";

/** Hosts that may appear in Qasir auth redirect_url (any *.qasir.id). */
export function isQasirIdHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "qasir.id" || h.endsWith(".qasir.id");
}

/**
 * Assert redirect_url is https on *.qasir.id only.
 * Rejects userinfo, non-443 ports, http, and off-domain hosts.
 */
export function assertQasirRedirectUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AppError(
      ErrorCodes.REDIRECT_NOT_ALLOWED,
      "Invalid redirect_url",
    );
  }
  if (url.protocol !== "https:") {
    throw new AppError(
      ErrorCodes.REDIRECT_NOT_ALLOWED,
      "Redirect must be https",
    );
  }
  if (url.username || url.password) {
    throw new AppError(
      ErrorCodes.REDIRECT_NOT_ALLOWED,
      "Redirect userinfo not allowed",
    );
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

/** Extract merchant slug from https://{slug}.qasir.id/... */
export function merchantSlugFromQasirHost(hostname: string): string | null {
  const h = hostname.toLowerCase();
  if (!h.endsWith(".qasir.id")) return null;
  const slug = h.slice(0, -".qasir.id".length);
  if (!slug || slug.includes(".") || slug === "www" || slug === "pos") {
    // www/pos/order are product hosts, not merchant dashboards — still allowlisted
    // for follow, but slug is only meaningful for *merchant* subdomains.
    if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i.test(slug)) return null;
  }
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i.test(slug)) return null;
  return slug;
}
