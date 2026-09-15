import { AppError, ErrorCodes } from "../errors/codes";
import type {
  QasirSessionContext,
  QasirSessionProvider,
  QasirSessionSecrets,
} from "./types";

export interface SessionEnv {
  MERCHANT_SLUG: string;
  DEFAULT_OUTLET_ID: string;
  QASIR_API_TOKEN?: string;
  QASIR_CSRF_TOKEN?: string;
  QASIR_COOKIE?: string;
}

/**
 * Host-only session provider using pre-provisioned Worker secrets.
 * Never expose secrets to model code, tool I/O, OpenAPI, resources, or logs.
 */
export class StaticQasirSessionProvider implements QasirSessionProvider {
  #expired = false;
  #env: SessionEnv;

  constructor(env: SessionEnv) {
    this.#env = env;
  }

  markExpired(): void {
    this.#expired = true;
  }

  async getSession(): Promise<QasirSessionContext> {
    if (this.#expired) {
      throw new AppError(
        ErrorCodes.QASIR_AUTH_EXPIRED,
        "Qasir session marked expired; refresh dashboard secrets",
      );
    }
    const secrets = readSecrets(this.#env);
    const slug = this.#env.MERCHANT_SLUG;
    if (!slug || slug.includes("/") || slug.includes(".")) {
      throw new AppError(
        ErrorCodes.INVALID_INPUT,
        "MERCHANT_SLUG must be a trusted subdomain label",
      );
    }
    return {
      merchantSlug: slug,
      merchantOrigin: `https://${slug}.qasir.id`,
      defaultOutletId: this.#env.DEFAULT_OUTLET_ID,
      secrets,
    };
  }
}

function readSecrets(env: SessionEnv): QasirSessionSecrets {
  const apiToken = env.QASIR_API_TOKEN?.trim() ?? "";
  const csrfToken = env.QASIR_CSRF_TOKEN?.trim() ?? "";
  const cookie = env.QASIR_COOKIE?.trim() ?? "";
  if (!apiToken || !csrfToken) {
    throw new AppError(
      ErrorCodes.QASIR_AUTH_EXPIRED,
      "Missing QASIR_API_TOKEN / QASIR_CSRF_TOKEN Worker secrets",
    );
  }
  return { apiToken, csrfToken, cookie };
}
