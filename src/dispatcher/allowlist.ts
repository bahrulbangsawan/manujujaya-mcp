import { AppError, ErrorCodes } from "../errors/codes";
import type { HostKey } from "../registry/types";

const FIXED_HOSTS: Record<Exclude<HostKey, "merchant">, string> = {
  pos: "pos.qasir.id",
  order: "order.qasir.id",
  payment: "payment.qasir.id",
  account: "account.qasir.id",
  sms: "sms.qasir.id",
  www: "www.qasir.id",
};

export function resolveHost(
  host: HostKey,
  merchantSlug: string,
): string {
  if (host === "merchant") {
    assertSafeSlug(merchantSlug);
    return `${merchantSlug}.qasir.id`;
  }
  return FIXED_HOSTS[host];
}

export function assertSafeSlug(slug: string): void {
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i.test(slug)) {
    throw new AppError(
      ErrorCodes.HOST_NOT_ALLOWED,
      "Invalid merchant slug",
    );
  }
}

/** Validate a fully resolved URL is on the allowlist; reject traversal / http / userinfo. */
export function assertAllowedUrl(
  url: URL,
  merchantSlug: string,
): void {
  if (url.protocol !== "https:") {
    throw new AppError(ErrorCodes.HOST_NOT_ALLOWED, "Only https allowed");
  }
  if (url.username || url.password) {
    throw new AppError(ErrorCodes.HOST_NOT_ALLOWED, "Userinfo not allowed");
  }
  if (url.port && url.port !== "443") {
    throw new AppError(ErrorCodes.HOST_NOT_ALLOWED, "Non-default ports not allowed");
  }
  const allowed = new Set<string>([
    ...Object.values(FIXED_HOSTS),
    `${merchantSlug}.qasir.id`,
  ]);
  if (!allowed.has(url.hostname)) {
    throw new AppError(
      ErrorCodes.HOST_NOT_ALLOWED,
      `Host not allowlisted: ${url.hostname}`,
    );
  }
  if (url.pathname.includes("..") || url.pathname.includes("//")) {
    throw new AppError(ErrorCodes.HOST_NOT_ALLOWED, "Path traversal rejected");
  }
}

export function isRedirectAllowed(
  location: string,
  merchantSlug: string,
): boolean {
  try {
    const url = new URL(location);
    assertAllowedUrl(url, merchantSlug);
    return true;
  } catch {
    return false;
  }
}
