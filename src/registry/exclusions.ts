import type { AuthProfile, CoverageEntry, HostKey, SafetyClass } from "./types";

type Method = CoverageEntry["method"];

interface NonOpEntry {
  doc: string;
  method: Method;
  host: HostKey;
  path: string;
  auth: AuthProfile;
  safety: SafetyClass;
  reason: string;
}

function excluded(e: NonOpEntry): CoverageEntry {
  return {
    sourceDocument: e.doc,
    method: e.method,
    host: e.host,
    path: e.path,
    operationId: null,
    auth: e.auth,
    safety: e.safety,
    implModule: null,
    testFile: null,
    status: "excluded",
    exclusionReason: e.reason,
  };
}

function sessionOnly(
  e: NonOpEntry & { implModule: string; testFile: string },
): CoverageEntry {
  return {
    ...excluded(e),
    implModule: e.implModule,
    testFile: e.testFile,
    status: "session-only",
  };
}

const CONNECT_TEST = "tests/unit/connect.test.ts";
const CHROME = "Dashboard chrome XHR; UI-only, not a business data API for MCP";
const SSR_NO_FIXTURE =
  "SSR HTML page with no JSON API and no captured HTML fixture to build a verified adapter";
const OTP_UNSUPPORTED =
  "Login OTP not supported by Connect (verify/resend routes return 410); documented only";
const UNGATED_MUTATION =
  "Documented-not-executed mutation from app.min.js; not in the approval-gated set";

/** Documented method/paths that are host-only session helpers (never exposed to model code). */
export const SESSION_ONLY: CoverageEntry[] = [
  sessionOnly({
    doc: "auth-login.md", method: "GET", host: "www", path: "/sign-in", auth: "none", safety: "read",
    implModule: "src/connect/login-flow.ts", testFile: CONNECT_TEST,
    reason: "Connect loads the sign-in page for the www CSRF cookie pair before login; host-only",
  }),
  sessionOnly({
    doc: "auth-login.md", method: "POST", host: "www", path: "/api/auth/device-language", auth: "www-csrf", safety: "write",
    implModule: "src/connect/login-flow.ts", testFile: CONNECT_TEST,
    reason: "Auth bootstrap helper; Connect only, not exposed via Code Mode",
  }),
  sessionOnly({
    doc: "auth-login.md", method: "POST", host: "www", path: "/api/auth/login", auth: "www-csrf", safety: "write",
    implModule: "src/connect/login-flow.ts", testFile: CONNECT_TEST,
    reason: "Connect UI / host-only session bootstrap; PIN never accepted from model",
  }),
  sessionOnly({
    doc: "auth-login.md", method: "POST", host: "www", path: "/api/auth/outlet-select", auth: "www-csrf", safety: "write",
    implModule: "src/connect/login-continue.ts", testFile: CONNECT_TEST,
    reason: "Connect select_outlet step only; not exposed via Code Mode",
  }),
  sessionOnly({
    doc: "auth-login.md", method: "GET", host: "merchant", path: "/dashboard", auth: "none", safety: "read",
    implModule: "src/connect/login-continue.ts", testFile: CONNECT_TEST,
    reason: "tokenWeb redirect hop Connect follows to mint the dashboard session and read API_TOKEN; tokenWeb never exposed",
  }),
];

/** Documented method/paths that are deliberately not executable, each with a reason. */
export const EXCLUSIONS: CoverageEntry[] = [
  // auth-login.md
  excluded({ doc: "auth-login.md", method: "GET", host: "www", path: "/sign-in/verification", auth: "none", safety: "read", reason: OTP_UNSUPPORTED }),
  excluded({ doc: "auth-login.md", method: "POST", host: "www", path: "/api/auth/login/otp-verify", auth: "www-csrf", safety: "write", reason: OTP_UNSUPPORTED }),
  excluded({ doc: "auth-login.md", method: "POST", host: "www", path: "/api/auth/login/resend-otp", auth: "www-csrf", safety: "write", reason: OTP_UNSUPPORTED }),
  excluded({ doc: "auth-login.md", method: "POST", host: "www", path: "/api/auth/reset-pin", auth: "www-csrf", safety: "write", reason: "Forgot-PIN flow out of Connect scope; use Qasir UI" }),
  excluded({ doc: "auth-login.md", method: "POST", host: "www", path: "/api/auth/otp-verify", auth: "www-csrf", safety: "write", reason: "Forgot-PIN OTP (authkey); out of Connect scope" }),
  excluded({ doc: "auth-login.md", method: "POST", host: "www", path: "/api/auth/reset-pin/create", auth: "www-csrf", safety: "write", reason: "Forgot-PIN create; out of Connect scope" }),

  // Failed probes: unsupported evidence, never executable.
  excluded({ doc: "reports.md", method: "GET", host: "pos", path: "/api/v5/reports/sales/total", auth: "bearer", safety: "read", reason: "Failed probe: HTTP 500 with status=saved on crawl" }),
  excluded({ doc: "suppliers.md", method: "GET", host: "pos", path: "/api/v5/suppliers", auth: "bearer", safety: "read", reason: "Failed probe: 400 BAD_REQUEST for all query sets tried" }),
  excluded({ doc: "suppliers.md", method: "GET", host: "pos", path: "/api/v5/supplier", auth: "bearer", safety: "read", reason: "Failed probe: 404" }),
  excluded({ doc: "suppliers.md", method: "GET", host: "merchant", path: "/ajax/suppliers/get", auth: "cookie-csrf", safety: "read", reason: "Failed probe: 405" }),
  excluded({ doc: "suppliers.md", method: "GET", host: "merchant", path: "/ajax/supplier/get", auth: "cookie-csrf", safety: "read", reason: "Failed probe: 405" }),
  excluded({ doc: "suppliers.md", method: "GET", host: "merchant", path: "/ajax/suppliers", auth: "cookie-csrf", safety: "read", reason: "Failed probe: 405" }),
  excluded({ doc: "stock-adjustment.md", method: "GET", host: "pos", path: "/api/v5/inventories/adjustments", auth: "bearer", safety: "read", reason: "Failed probe: 500 wrapped 405 Method Not Allowed" }),

  // Observed but unsafe or redundant.
  excluded({ doc: "products.md", method: "GET", host: "pos", path: "/api/v5/inventories", auth: "bearer", safety: "read", reason: "count ignored (~1.5MB); unsafe as paginated catalog; use products.list / inventories.stockTurnover" }),
  excluded({ doc: "products.md", method: "GET", host: "merchant", path: "/products", auth: "cookie-csrf", safety: "read", reason: "SSR HTML table duplicates products.list JSON; no captured fixture for an adapter; name search via products.searchAjax" }),
  excluded({ doc: "purchases.md", method: "GET", host: "merchant", path: "/purchase", auth: "cookie-csrf", safety: "read", reason: "SSR HTML list (only documented order_no/supplier_name/status filter) but no captured HTML fixture to build a verified adapter; use purchases.list and filter status in code" }),

  // Mutations outside the gated set.
  excluded({ doc: "suppliers.md", method: "POST", host: "merchant", path: "/supplier/delete/{id}", auth: "cookie-csrf", safety: "destructive", reason: `${UNGATED_MUTATION}; deletes a supplier (Laravel form POST)` }),
  excluded({ doc: "routes.md", method: "POST", host: "merchant", path: "/ajax/category/create", auth: "cookie-csrf", safety: "write", reason: UNGATED_MUTATION }),
  excluded({ doc: "routes.md", method: "POST", host: "merchant", path: "/ajax/category/update", auth: "cookie-csrf", safety: "write", reason: UNGATED_MUTATION }),
  excluded({ doc: "routes.md", method: "POST", host: "merchant", path: "/ajax/category/delete", auth: "cookie-csrf", safety: "destructive", reason: UNGATED_MUTATION }),
  excluded({ doc: "routes.md", method: "POST", host: "merchant", path: "/ajax/brand/create", auth: "cookie-csrf", safety: "write", reason: UNGATED_MUTATION }),
  excluded({ doc: "routes.md", method: "POST", host: "merchant", path: "/ajax/brand/update", auth: "cookie-csrf", safety: "write", reason: UNGATED_MUTATION }),
  excluded({ doc: "routes.md", method: "POST", host: "merchant", path: "/ajax/brand/delete", auth: "cookie-csrf", safety: "destructive", reason: UNGATED_MUTATION }),

  // Dashboard chrome (fires on every page; routes.md says to ignore).
  excluded({ doc: "routes.md", method: "GET", host: "account", path: "/api/v1/menu/access", auth: "bearer", safety: "read", reason: `${CHROME} (sidebar menu permissions per role_id)` }),
  excluded({ doc: "routes.md", method: "GET", host: "merchant", path: "/ajax/payment/pointofinterest", auth: "cookie-csrf", safety: "read", reason: CHROME }),
  excluded({ doc: "routes.md", method: "GET", host: "merchant", path: "/ajax/prosubs/sku1and6", auth: "cookie-csrf", safety: "read", reason: CHROME }),
  excluded({ doc: "routes.md", method: "GET", host: "pos", path: "/api/v5/prosubs/users", auth: "bearer", safety: "read", reason: CHROME }),
  excluded({ doc: "routes.md", method: "GET", host: "pos", path: "/api/v5/merchant-feature-purchases", auth: "bearer", safety: "read", reason: `${CHROME} (plan feature purchases)` }),

  // SSR HTML data pages from the routes.md sidebar without a JSON API.
  excluded({ doc: "routes.md", method: "GET", host: "merchant", path: "/taxes", auth: "cookie-csrf", safety: "read", reason: SSR_NO_FIXTURE }),
  excluded({ doc: "routes.md", method: "GET", host: "merchant", path: "/stock/transfer", auth: "cookie-csrf", safety: "read", reason: SSR_NO_FIXTURE }),
  excluded({ doc: "routes.md", method: "GET", host: "merchant", path: "/stock/movement", auth: "cookie-csrf", safety: "read", reason: `${SSR_NO_FIXTURE}; picker data via inventories.stockTurnover` }),
  excluded({ doc: "routes.md", method: "GET", host: "merchant", path: "/customers", auth: "cookie-csrf", safety: "read", reason: `${SSR_NO_FIXTURE}; customer detail via customers.get` }),
];
