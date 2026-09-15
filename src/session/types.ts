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

export interface QasirSessionPublicStatus {
  connected: boolean;
  merchantSlug?: string;
  outletId?: string;
  connectedAt?: number;
  source?: "do" | "static";
  /** Masked token prefix only, e.g. abcd… */
  apiTokenPrefix?: string;
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
