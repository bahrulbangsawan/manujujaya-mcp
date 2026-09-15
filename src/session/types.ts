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
}

export interface QasirSessionProvider {
  getSession(): Promise<QasirSessionContext>;
  /** Future: refresh / re-login when docs conclusively support it. */
  markExpired(): void;
}
