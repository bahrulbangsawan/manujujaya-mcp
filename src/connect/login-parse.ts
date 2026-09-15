import type { PendingMerchant, PendingOutlet } from "../session/types";

export type LoginNextStep =
  | "redirect"
  | "select_merchant"
  | "select_outlet"
  | "verify_otp"
  | "unknown";

export interface ParsedLoginResponse {
  ok: boolean;
  status: number;
  message: string;
  nextStep: LoginNextStep | null;
  redirectUrl?: string;
  merchants?: PendingMerchant[];
  outlets?: PendingOutlet[];
  merchant?: { id?: number };
  mobile?: string;
  merchantId?: number;
  verifyKey?: string;
  tokenWeb?: string;
  subdomainUrl?: string;
  raw: unknown;
}

/**
 * Parse Qasir auth envelope `{ status, message, next_step, data }`.
 * status === 1 is success (unlike POS code: 200).
 */
export function parseLoginResponse(json: unknown): ParsedLoginResponse {
  if (!json || typeof json !== "object") {
    return {
      ok: false,
      status: 0,
      message: "Non-object login response",
      nextStep: null,
      raw: json,
    };
  }
  const o = json as Record<string, unknown>;
  const status = typeof o.status === "number" ? o.status : 0;
  const message = typeof o.message === "string" ? o.message : "";
  const next =
    typeof o.next_step === "string" ? (o.next_step as LoginNextStep) : null;
  const data =
    o.data && typeof o.data === "object"
      ? (o.data as Record<string, unknown>)
      : {};

  const base: ParsedLoginResponse = {
    ok: status === 1,
    status,
    message,
    nextStep: next,
    raw: json,
  };

  if (next === "redirect") {
    const redirectUrl =
      typeof data.redirect_url === "string" ? data.redirect_url : undefined;
    return { ...base, redirectUrl };
  }
  if (next === "select_merchant") {
    return {
      ...base,
      merchants: normalizeMerchants(data.merchants),
    };
  }
  if (next === "select_outlet") {
    const merchant =
      data.merchant && typeof data.merchant === "object"
        ? (data.merchant as { id?: number })
        : undefined;
    return {
      ...base,
      outlets: normalizeOutlets(data.outlets),
      merchant,
      merchantId: typeof merchant?.id === "number" ? merchant.id : undefined,
    };
  }
  if (next === "verify_otp") {
    return {
      ...base,
      mobile: typeof data.mobile === "string" ? data.mobile : undefined,
      merchantId:
        typeof data.merchant_id === "number" ? data.merchant_id : undefined,
      verifyKey:
        typeof data.verify_key === "string" ? data.verify_key : undefined,
    };
  }

  // outlet-select success may omit next_step and return token_web + subdomain_url
  const tokenWeb =
    typeof data.token_web === "string" ? data.token_web : undefined;
  const subdomainUrl =
    typeof data.subdomain_url === "string" ? data.subdomain_url : undefined;
  if (status === 1 && tokenWeb && subdomainUrl) {
    const redirectUrl = buildDashboardRedirect(subdomainUrl, tokenWeb);
    return {
      ...base,
      ok: true,
      nextStep: "redirect",
      redirectUrl,
      tokenWeb,
      subdomainUrl,
    };
  }

  return base;
}

export function buildDashboardRedirect(
  subdomainUrl: string,
  tokenWeb: string,
): string {
  const base = subdomainUrl.replace(/\/$/, "");
  return `${base}/dashboard?tokenWeb=${encodeURIComponent(tokenWeb)}`;
}

function normalizeMerchants(raw: unknown): PendingMerchant[] {
  if (!Array.isArray(raw)) return [];
  const out: PendingMerchant[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const m = item as Record<string, unknown>;
    if (typeof m.id !== "number") continue;
    out.push({
      id: m.id,
      business_name:
        typeof m.business_name === "string" ? m.business_name : `Merchant ${m.id}`,
      subdomain_url:
        typeof m.subdomain_url === "string" ? m.subdomain_url : undefined,
    });
  }
  return out;
}

function normalizeOutlets(raw: unknown): PendingOutlet[] {
  if (!Array.isArray(raw)) return [];
  const out: PendingOutlet[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (typeof o.id !== "number") continue;
    out.push({
      id: o.id,
      name: typeof o.name === "string" ? o.name : `Outlet ${o.id}`,
      location_name:
        typeof o.location_name === "string" ? o.location_name : undefined,
      is_main: typeof o.is_main === "boolean" ? o.is_main : undefined,
      is_lock: typeof o.is_lock === "boolean" ? o.is_lock : undefined,
      images: typeof o.images === "string" ? o.images : undefined,
    });
  }
  return out;
}

export type MatchConfiguredMerchantResult =
  | { ok: true; merchantId: number; businessName?: string }
  | { ok: false; message: string };

/**
 * Extract merchant slug from a Qasir subdomain_url (full URL, with/without
 * path or trailing slash). Returns null if not a merchant *.qasir.id host.
 */
export function slugFromSubdomainUrl(subdomainUrl: string): string | null {
  const raw = subdomainUrl.trim();
  if (!raw) return null;
  try {
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(withProto);
    const host = url.hostname.toLowerCase();
    if (!host.endsWith(".qasir.id")) return null;
    const slug = host.slice(0, -".qasir.id".length);
    if (!slug || slug.includes(".")) return null;
    if (slug === "www" || slug === "pos" || slug === "order") return null;
    return slug;
  } catch {
    return null;
  }
}

/**
 * Pick the configured merchant from a select_merchant list.
 * Matches subdomain_url host/slug to `merchantSlug`. Never returns a picker —
 * if the configured slug is absent, returns an error result.
 */
export function matchConfiguredMerchant(
  merchants: PendingMerchant[],
  merchantSlug: string,
): MatchConfiguredMerchantResult {
  const configured = merchantSlug.trim().toLowerCase();
  if (!configured) {
    return {
      ok: false,
      message: "Configured merchant slug is empty; only a fixed merchant is allowed",
    };
  }

  const matches = merchants.filter((m) => {
    if (!m.subdomain_url) return false;
    const slug = slugFromSubdomainUrl(m.subdomain_url);
    return slug !== null && slug.toLowerCase() === configured;
  });

  if (matches.length >= 1) {
    const pick = matches[0]!;
    return {
      ok: true,
      merchantId: pick.id,
      businessName: pick.business_name,
    };
  }

  return {
    ok: false,
    message:
      `Only the configured merchant (${configured}) is allowed. ` +
      `It was not found in the account merchant list — merchant picker is disabled.`,
  };
}

export function normalizeUsername(input: string): string {
  const t = input.trim();
  if (t.includes("@")) return t.toLowerCase();
  // Phone: digits only; ensure leading 62 if starts with 8
  let digits = t.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  if (digits.startsWith("8")) digits = `62${digits}`;
  return digits;
}

export function isValidPin(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

export function isValidOtpCode(code: string): boolean {
  return /^\d{4}$/.test(code);
}
