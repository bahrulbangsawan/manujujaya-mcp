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
  /** Cookie header for the merchant dashboard host only. */
  cookieJar: string;
  merchantSlug: string;
  outletId: string;
  deviceId: string;
  connectedAt: number;
  expiresAt?: number;
  subject: string;
}

/** One cookie in the server-side Connect login jar (RFC 6265 subset). */
export interface StoredCookie {
  name: string;
  value: string;
  /** Lower-case host (host-only) or domain without the leading dot. */
  domain: string;
  hostOnly: boolean;
  path: string;
  /** Epoch ms; absent for session cookies. */
  expiresAt?: number;
}

/** CSRF credential for www.qasir.id auth POSTs. */
export interface WwwCsrf {
  /**
   * `x-csrf-token` carries the plain token from the sign-in page meta tag.
   * `x-xsrf-token` carries Laravel's encrypted XSRF-TOKEN cookie (Laravel decrypts it).
   */
  header: "x-csrf-token" | "x-xsrf-token";
  value: string;
}

/**
 * Short-lived outlet-selection state between /connect/login and /connect/select-outlet.
 * Never holds the PIN: the owner re-enters it on the outlet form.
 */
export interface PendingAuthState {
  step: "select_outlet";
  /** Normalized phone/email. */
  username: string;
  deviceId: string;
  deviceType: string;
  timezone: string;
  /** www.qasir.id login cookies (needed for the outlet-select POST). */
  cookies: StoredCookie[];
  wwwCsrf: WwwCsrf;
  merchantId: number;
  outlets: PendingOutlet[];
  createdAt: number;
  expiresAt: number;
}

export type PendingAuthDraft = Omit<PendingAuthState, "createdAt" | "expiresAt">;

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
  /**
   * Mark the session invalid after an upstream 401 or login redirect.
   * With `failedApiToken`, only a stored session still holding that token is cleared
   * (a session saved after the failing request started survives). Without it,
   * clears unconditionally.
   */
  markExpired(failedApiToken?: string): void | Promise<void>;
}

export function maskTokenPrefix(token: string): string {
  if (token.length < 4) return "****";
  return `${token.slice(0, 4)}…`;
}
