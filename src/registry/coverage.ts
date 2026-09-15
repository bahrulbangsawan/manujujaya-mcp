import { OPERATIONS } from "./operations";
import type { CoverageEntry } from "./types";

/** Explicit exclusions for documented paths that are not executable. */
const EXCLUSIONS: CoverageEntry[] = [
  {
    sourceDocument: "reports.md",
    method: "GET",
    path: "/api/v5/reports/sales/total",
    operationId: null,
    auth: "bearer",
    safety: "read",
    implModule: null,
    testFile: "tests/unit/coverage.test.ts",
    status: "excluded",
    exclusionReason: "Failed probe: HTTP 500 with status=saved on crawl",
  },
  {
    sourceDocument: "suppliers.md",
    method: "GET",
    path: "/api/v5/suppliers",
    operationId: null,
    auth: "bearer",
    safety: "read",
    implModule: null,
    testFile: "tests/unit/coverage.test.ts",
    status: "excluded",
    exclusionReason: "Failed probe: 400 BAD_REQUEST for all query sets tried",
  },
  {
    sourceDocument: "suppliers.md",
    method: "GET",
    path: "/api/v5/supplier",
    operationId: null,
    auth: "bearer",
    safety: "read",
    implModule: null,
    testFile: "tests/unit/coverage.test.ts",
    status: "excluded",
    exclusionReason: "Failed probe: 404",
  },
  {
    sourceDocument: "suppliers.md",
    method: "GET",
    path: "/ajax/suppliers/get",
    operationId: null,
    auth: "cookie-csrf",
    safety: "read",
    implModule: null,
    testFile: "tests/unit/coverage.test.ts",
    status: "excluded",
    exclusionReason: "Failed probe: 405",
  },
  {
    sourceDocument: "stock-adjustment.md",
    method: "GET",
    path: "/api/v5/inventories/adjustments",
    operationId: null,
    auth: "bearer",
    safety: "read",
    implModule: null,
    testFile: "tests/unit/coverage.test.ts",
    status: "excluded",
    exclusionReason: "Failed probe: 500 wrapped 405 Method Not Allowed",
  },
  {
    sourceDocument: "products.md",
    method: "GET",
    path: "/api/v5/inventories",
    operationId: null,
    auth: "bearer",
    safety: "read",
    implModule: null,
    testFile: "tests/unit/coverage.test.ts",
    status: "excluded",
    exclusionReason:
      "count ignored (~1.5MB); unsafe as paginated catalog — use products.list / stock-turnover",
  },
  {
    sourceDocument: "auth-login.md",
    method: "POST",
    path: "/api/auth/login",
    operationId: null,
    auth: "www-csrf",
    safety: "write",
    implModule: "src/connect/login-flow.ts",
    testFile: "tests/unit/connect.test.ts",
    status: "session-only",
    exclusionReason:
      "Connect UI / host-only session bootstrap; PIN never accepted from model.",
  },
  {
    sourceDocument: "auth-login.md",
    method: "POST",
    path: "/api/auth/device-language",
    operationId: null,
    auth: "www-csrf",
    safety: "write",
    implModule: "src/connect/login-flow.ts",
    testFile: "tests/unit/connect.test.ts",
    status: "session-only",
    exclusionReason: "Auth bootstrap helper; Connect only — not exposed via Code Mode",
  },
  {
    sourceDocument: "auth-login.md",
    method: "POST",
    path: "/api/auth/outlet-select",
    operationId: null,
    auth: "www-csrf",
    safety: "write",
    implModule: "src/connect/login-continue.ts",
    testFile: "tests/unit/connect.test.ts",
    status: "session-only",
    exclusionReason: "Connect multi-step auth only; not exposed via Code Mode",
  },

  {
    sourceDocument: "auth-login.md",
    method: "POST",
    path: "/api/auth/login/otp-verify",
    operationId: null,
    auth: "www-csrf",
    safety: "write",
    implModule: "src/connect/login-continue.ts",
    testFile: "tests/unit/connect.test.ts",
    status: "session-only",
    exclusionReason: "Connect verify_otp step only; not exposed via Code Mode",
  },
  {
    sourceDocument: "auth-login.md",
    method: "POST",
    path: "/api/auth/login/resend-otp",
    operationId: null,
    auth: "www-csrf",
    safety: "write",
    implModule: "src/connect/login-continue.ts",
    testFile: "tests/unit/connect.test.ts",
    status: "session-only",
    exclusionReason: "Connect resend-otp step only; not exposed via Code Mode",
  },
  {
    sourceDocument: "auth-login.md",
    method: "POST",
    path: "/api/auth/reset-pin",
    operationId: null,
    auth: "www-csrf",
    safety: "write",
    implModule: null,
    testFile: null,
    status: "excluded",
    exclusionReason: "Forgot-PIN flow out of Connect scope; use Qasir UI",
  },
  {
    sourceDocument: "auth-login.md",
    method: "POST",
    path: "/api/auth/otp-verify",
    operationId: null,
    auth: "www-csrf",
    safety: "write",
    implModule: null,
    testFile: null,
    status: "excluded",
    exclusionReason: "Forgot-PIN OTP (authkey); not login OTP verify",
  },
  {
    sourceDocument: "auth-login.md",
    method: "POST",
    path: "/api/auth/reset-pin/create",
    operationId: null,
    auth: "www-csrf",
    safety: "write",
    implModule: null,
    testFile: null,
    status: "excluded",
    exclusionReason: "Forgot-PIN create; out of Connect scope",
  },
  {
    sourceDocument: "routes.md",
    method: "POST",
    path: "/ajax/category/create",
    operationId: null,
    auth: "cookie-csrf",
    safety: "write",
    implModule: null,
    testFile: null,
    status: "excluded",
    exclusionReason: "Documented-not-executed mutation; deferred beyond initial gate set",
  },
  {
    sourceDocument: "routes.md",
    method: "POST",
    path: "/ajax/brand/create",
    operationId: null,
    auth: "cookie-csrf",
    safety: "write",
    implModule: null,
    testFile: null,
    status: "excluded",
    exclusionReason: "Documented-not-executed mutation; deferred beyond initial gate set",
  },
  {
    sourceDocument: "routes.md",
    method: "GET",
    path: "/ajax/payment/pointofinterest",
    operationId: null,
    auth: "cookie-csrf",
    safety: "read",
    implModule: null,
    testFile: null,
    status: "excluded",
    exclusionReason: "Dashboard chrome XHR; not a data API for MCP",
  },
  {
    sourceDocument: "routes.md",
    method: "GET",
    path: "/ajax/prosubs/sku1and6",
    operationId: null,
    auth: "cookie-csrf",
    safety: "read",
    implModule: null,
    testFile: null,
    status: "excluded",
    exclusionReason: "Dashboard chrome XHR; not a data API for MCP",
  },
  {
    sourceDocument: "routes.md",
    method: "GET",
    path: "/api/v5/prosubs/users",
    operationId: null,
    auth: "bearer",
    safety: "read",
    implModule: null,
    testFile: null,
    status: "excluded",
    exclusionReason: "Dashboard chrome XHR; not a data API for MCP",
  },
];

export function buildCoverageManifest(): CoverageEntry[] {
  const fromOps: CoverageEntry[] = OPERATIONS.map((o) => ({
    sourceDocument: o.sourceDocument,
    method: o.method,
    path: o.pathTemplate,
    operationId: o.operationId,
    auth: o.authProfile,
    safety: o.safety,
    implModule:
      o.responseKind === "html"
        ? "src/html/"
        : o.safety === "read"
          ? "src/dispatcher/qasir-dispatcher.ts"
          : "src/dispatcher/qasir-dispatcher.ts",
    testFile:
      o.responseKind === "html"
        ? "tests/unit/html-adapters.test.ts"
        : "tests/unit/registry.test.ts",
    status:
      o.safety === "read"
        ? o.responseKind === "html"
          ? "html-adapter"
          : "implemented"
        : "mutation-gated",
  }));
  return [...fromOps, ...EXCLUSIONS];
}

export function coverageSummary(): {
  total: number;
  implemented: number;
  htmlAdapter: number;
  mutationGated: number;
  sessionOnly: number;
  excluded: number;
} {
  const m = buildCoverageManifest();
  const count = (s: CoverageEntry["status"]) =>
    m.filter((e) => e.status === s).length;
  return {
    total: m.length,
    implemented: count("implemented"),
    htmlAdapter: count("html-adapter"),
    mutationGated: count("mutation-gated"),
    sessionOnly: count("session-only"),
    excluded: count("excluded"),
  };
}
