export interface QasirSessionSecrets {
  apiToken: string;
  csrfToken: string;
  cookie: string;
}

export interface QasirSessionContext {
  merchantSlug: string;
  merchantOrigin: string;
  defaultOutletId: string;
  secrets: QasirSessionSecrets;
  /** Where credentials came from for this request. */
  source?: "do" | "static";
}

export interface StoredQasirSession {
  apiToken: string;
  csrfToken: string;
  cookieJar: string;
  merchantSlug: string;
  outletId: string;
  deviceId: string;
  connectedAt: number;
  expiresAt?: number;
  subject: string;
}

/** Short-lived multi-step Connect auth (merchant / outlet / OTP). PIN held encrypted ≤ TTL. */
export interface PendingAuthState {
  username: string;
  /** Temporary PIN for merchant re-login / outlet-select; never logged. */
  pin: string;
  deviceId: string;
  deviceType: string;
  timezone: string;
  cookieJar: string;
  csrfToken: string;
  step: "select_merchant" | "select_outlet" | "verify_otp";
  merchantId?: number;
  mobile?: string;
  verifyKey?: string;
  merchants?: PendingMerchant[];
  outlets?: PendingOutlet[];
  createdAt: number;
  expiresAt: number;
}

export interface PendingMerchant {
  id: number;
  business_name: string;
  subdomain_url?: string;
}

export interface PendingOutlet {
  id: number;
  name: string;
  location_name?: string;
  is_main?: boolean;
  is_lock?: boolean;
  images?: string;
}

export interface QasirSessionPublicStatus {
  connected: boolean;
  merchantSlug?: string;
  outletId?: string;
  connectedAt?: number;
  source?: "do" | "static";
  /** Masked token prefix only, e.g. abcd… */
  apiTokenPrefix?: string;
  pendingStep?: PendingAuthState["step"];
}

export interface QasirSessionProvider {
  getSession(): Promise<QasirSessionContext>;
  /** Mark session invalid (upstream 401/403). May clear DO storage. */
  markExpired(): void | Promise<void>;
}

export function maskTokenPrefix(token: string): string {
  if (token.length < 4) return "****";
  return `${token.slice(0, 4)}…`;
}
