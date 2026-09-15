/**
 * Live E2E: Qasir login (phone/email+PIN) → products.list.
 * Reads secrets from .dev.vars. Never prints credentials or tokens.
 * Read-only: the only upstream call after login is products.list.
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { continueWithOutlet, runQasirLoginFlow, type LoginFlowResult } from "../src/connect/login-flow";
import { QasirDispatcher } from "../src/dispatcher/qasir-dispatcher";
import type { QasirSessionProvider, QasirSessionContext } from "../src/session/types";

function loadDevVars(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1);
  }
  return out;
}

function mask(s: string): string {
  if (s.length <= 4) return "****";
  return `${s.slice(0, 2)}…${s.slice(-2)} (len=${s.length})`;
}

class FixedSessionProvider implements QasirSessionProvider {
  #ctx: QasirSessionContext;
  constructor(ctx: QasirSessionContext) {
    this.#ctx = ctx;
  }
  async getSession(): Promise<QasirSessionContext> {
    return this.#ctx;
  }
  markExpired(): void {}
}

function summarizeProducts(data: unknown): string {
  if (!data || typeof data !== "object") return "unknown_shape";
  const o = data as Record<string, unknown>;
  const inner = (o.data ?? o) as Record<string, unknown>;
  const list = inner.products ?? inner.items ?? inner.data ?? (Array.isArray(inner) ? inner : null);
  if (!Array.isArray(list)) return `object_keys=${Object.keys(o).slice(0, 12).join(",")}`;
  let summary = `array_len=${list.length}`;
  const first: unknown = list[0];
  if (first && typeof first === "object") {
    const f = first as Record<string, unknown>;
    const id = f.id ?? f.product_id;
    const name = typeof f.name === "string" ? f.name.slice(0, 40) : undefined;
    summary += ` first_id=${String(id ?? "n/a")} first_name=${name ?? "n/a"}`;
  }
  return summary;
}

/** Returns the process exit code. */
async function main(): Promise<number> {
  const vars = loadDevVars(resolve(process.cwd(), ".dev.vars"));
  const username = vars.QASIR_E2E_USERNAME?.trim();
  const pin = vars.QASIR_E2E_PIN?.trim();
  const merchantSlug = vars.MERCHANT_SLUG?.trim() || "bengkel-manuju-jaya-621095";
  const outletId = vars.DEFAULT_OUTLET_ID?.trim() || "645203";
  // Reuse a device id when provided so Qasir sees the same device on every run.
  const deviceId = vars.QASIR_E2E_DEVICE_ID?.trim() || randomUUID();

  if (!username || !pin) {
    console.error("FAIL missing QASIR_E2E_USERNAME or QASIR_E2E_PIN in .dev.vars");
    return 2;
  }

  console.log("E2E start");
  console.log(`merchantSlug=${merchantSlug}`);
  console.log(`username=${mask(username)} pinLen=${pin.length}`);

  let login: LoginFlowResult = await runQasirLoginFlow({
    username,
    pin,
    deviceId,
    preferredMerchantSlug: merchantSlug,
    timezone: "Asia/Makassar",
  });

  if (login.kind === "next_step") {
    console.log(`LOGIN_STEP select_outlet outlets=${login.outlets.length} using=${outletId}`);
    login = await continueWithOutlet({
      pending: { ...login.pending, createdAt: Date.now(), expiresAt: Date.now() + 60_000 },
      outletId: Number(outletId),
      pin,
      merchantSlug,
    });
  }

  if (login.kind === "error") {
    console.error(`LOGIN_FAIL kind=error message=${login.message}`);
    return 1;
  }
  if (login.kind === "next_step") {
    console.error("LOGIN_FAIL kind=next_step (outlet selection repeated)");
    return 1;
  }
  if (login.kind === "needs_paste") {
    console.log(`LOGIN_PARTIAL needs_paste reason=${login.reason} slug=${login.merchantSlug}`);
    console.log("Dashboard HTML did not yield API_TOKEN. Cannot complete products.list without paste.");
    console.log("E2E_RESULT=LOGIN_NEEDS_PASTE");
    return 3;
  }

  const { apiToken, csrfToken, cookieJar } = login;
  console.log(
    `LOGIN_OK via=login_scrape slug=${login.merchantSlug} token=${mask(apiToken)} csrfLen=${csrfToken.length} cookieLen=${cookieJar.length}`,
  );

  const sessions = new FixedSessionProvider({
    merchantSlug: login.merchantSlug,
    merchantOrigin: `https://${login.merchantSlug}.qasir.id`,
    defaultOutletId: outletId,
    secrets: { apiToken, csrfToken, cookie: cookieJar },
  });

  const dispatcher = new QasirDispatcher({ sessions, mutationsEnabled: false });
  const products = await dispatcher.dispatch({
    operationId: "products.list",
    query: { page: 1, count: 5 },
  });

  console.log(`PRODUCTS status=${products.status}`);
  console.log(`PRODUCTS_SUMMARY ${summarizeProducts(products.data)}`);
  console.log("E2E_RESULT=OK");
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    // Redact likely tokens in error messages
    const safe = msg.replace(/[A-Za-z0-9_\-]{20,}/g, "[redacted]");
    console.error(`E2E_CRASH ${safe}`);
    process.exitCode = 1;
  });
