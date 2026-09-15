import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkCoverage } from "../../src/registry/checks";
import {
  OPERATION_CONTRACT_TEST,
  buildCoverageManifest,
  coverageKey,
  coverageSummary,
} from "../../src/registry/coverage";
import { renderCoverageMarkdown } from "../../src/registry/coverage-report";
import {
  API_DOC_NAMES,
  extractDocEndpoints,
  parseDocUrl,
} from "../../src/registry/doc-endpoints";
import { hostBaseUrl } from "../../src/registry/openapi";
import { OPERATIONS } from "../../src/registry/operations";
import type { ApiOperation, CoverageEntry } from "../../src/registry/types";

const root = path.resolve(__dirname, "../..");
const docs = Object.fromEntries(
  API_DOC_NAMES.map((n) => [`${n}.md`, readFileSync(path.join(root, "docs", `${n}.md`), "utf8")]),
);
const fileExists = (p: string) => existsSync(path.join(root, p));
const docEndpoints = extractDocEndpoints(docs);
const manifest = buildCoverageManifest();

function run(overrides: {
  manifest?: CoverageEntry[];
  operations?: ApiOperation[];
  docs?: Record<string, string>;
}): string[] {
  return checkCoverage({
    manifest: overrides.manifest ?? manifest,
    operations: overrides.operations ?? OPERATIONS,
    docEndpoints: overrides.docs ? extractDocEndpoints(overrides.docs) : docEndpoints,
    fileExists,
  });
}

function opFixture(partial: Partial<ApiOperation>): ApiOperation {
  const base = OPERATIONS.find((o) => o.operationId === "products.list");
  if (!base) throw new Error("products.list missing");
  return { ...base, ...partial };
}

describe("coverage manifest vs docs/*.md", () => {
  it("every documented METHOD+host+path has exactly one entry and nothing else drifts", () => {
    expect(run({})).toEqual([]);
  });

  it("covers the audited endpoint set with stable totals", () => {
    const unique = new Set(docEndpoints.map(coverageKey));
    // 78 documented upstream endpoints + 4 SSR data pages from the routes.md sidebar.
    expect(unique.size).toBe(82);
    expect(manifest).toHaveLength(82);
    expect(coverageSummary()).toEqual({
      total: 82,
      implemented: 40,
      htmlAdapter: 2,
      mutationGated: 3,
      sessionOnly: 5,
      excluded: 32,
    });
  });

  it("includes the previously missing endpoints with the right status", () => {
    const byKey = new Map(manifest.map((e) => [coverageKey(e), e]));
    const expectStatus = (key: string, status: CoverageEntry["status"]) =>
      expect(byKey.get(key)?.status, key).toBe(status);
    expectStatus("GET www /sign-in", "session-only");
    expectStatus("GET merchant /dashboard", "session-only");
    expectStatus("GET www /sign-in/verification", "excluded");
    expectStatus("GET pos /api/v5/merchant-feature-purchases", "excluded");
    expectStatus("GET merchant /products", "excluded");
    expectStatus("GET merchant /purchase", "excluded");
    expectStatus("GET merchant /ajax/supplier/get", "excluded");
    expectStatus("GET merchant /ajax/suppliers", "excluded");
    expectStatus("GET account /api/v1/menu/access", "excluded");
    for (const page of ["/taxes", "/stock/transfer", "/stock/movement", "/customers"]) {
      expectStatus(`GET merchant ${page}`, "excluded");
    }
    expect(byKey.get("POST merchant /supplier/delete/{}")?.safety).toBe("destructive");
    expect(byKey.get("POST merchant /ajax/category/delete")?.safety).toBe("destructive");
    expect(byKey.get("POST merchant /ajax/brand/delete")?.safety).toBe("destructive");
    expect(byKey.get("POST merchant /ajax/category/update")?.safety).toBe("write");
    expect(byKey.get("POST merchant /ajax/brand/update")?.safety).toBe("write");
  });

  it("marks login OTP as excluded with no impl or test claims", () => {
    for (const p of ["/api/auth/login/otp-verify", "/api/auth/login/resend-otp"]) {
      const e = manifest.find((m) => m.path === p);
      expect(e?.status).toBe("excluded");
      expect(e?.implModule).toBeNull();
      expect(e?.testFile).toBeNull();
      expect(e?.exclusionReason).toMatch(/410/);
    }
  });

  it("every non-null implModule and testFile exists on disk", () => {
    const missing = manifest
      .flatMap((e) => [e.implModule, e.testFile])
      .filter((f): f is string => f !== null && !fileExists(f));
    expect(missing).toEqual([]);
  });

  it("docs/architecture/coverage.md is the rendered manifest", () => {
    const committed = readFileSync(path.join(root, "docs", "architecture", "coverage.md"), "utf8");
    // Regenerate with `bun run scripts/validate-coverage.ts --write-report` when this fails.
    expect(committed).toBe(renderCoverageMarkdown(manifest, coverageSummary()));
    expect(committed).toContain("| **total** | **82** |");
  });

  it("excluded failed probes are never registered operations", () => {
    const probes = manifest.filter((e) => e.exclusionReason?.startsWith("Failed probe"));
    expect(probes.length).toBeGreaterThanOrEqual(7);
    const opKeys = new Set(
      OPERATIONS.map((o) => coverageKey({ method: o.method, host: o.host, path: o.pathTemplate })),
    );
    for (const p of probes) expect(opKeys.has(coverageKey(p)), coverageKey(p)).toBe(false);
  });
});

describe("coverage checks detect drift", () => {
  it("flags a newly documented endpoint with no manifest entry", () => {
    const drifted = { ...docs, "products.md": `${docs["products.md"]}\n\`GET https://pos.qasir.id/api/v5/new-thing?x=1\`\n` };
    expect(run({ docs: drifted })).toContain(
      "GET pos /api/v5/new-thing (products.md) has 0 manifest entries, expected 1",
    );
  });

  it("flags an exposed failed probe that duplicates an exclusion", () => {
    const probe = opFixture({
      operationId: "suppliers.v5list",
      pathTemplate: "/api/v5/suppliers",
      sourceDocument: "suppliers.md",
      evidence: "failed-probe",
    });
    const operations = [...OPERATIONS, probe];
    const problems = run({
      operations,
      manifest: [...manifest, { ...manifest[0]!, operationId: probe.operationId, path: probe.pathTemplate, sourceDocument: "suppliers.md" }],
    });
    expect(problems).toContain("suppliers.v5list is exposed with failed-probe evidence");
    expect(problems.some((p) => p.startsWith("GET pos /api/v5/suppliers (suppliers.md) has 2 manifest entries"))).toBe(true);
    expect(problems).toContain("GET pos /api/v5/suppliers is excluded but registered as suppliers.v5list");
  });

  it("flags duplicate operationIds and duplicate method+host+path", () => {
    const dupId = opFixture({ pathTemplate: "/api/v5/other" });
    expect(run({ operations: [...OPERATIONS, dupId] })).toContain("duplicate operationId products.list");
    const dupPath = opFixture({ operationId: "products.again" });
    expect(run({ operations: [...OPERATIONS, dupPath] })).toContain(
      "GET pos /api/v5/products registered twice (products.list, products.again)",
    );
  });

  it("allows the same path on a different host", () => {
    const merchantCopy = opFixture({ operationId: "merchant.products", host: "merchant" });
    const problems = run({ operations: [...OPERATIONS, merchantCopy] });
    expect(problems.some((p) => p.includes("registered twice"))).toBe(false);
  });

  it("flags missing files, excluded entries claiming files, and undocumented entries", () => {
    const [first] = manifest;
    if (!first) throw new Error("empty manifest");
    const badFile = { ...first, testFile: "tests/unit/does-not-exist.test.ts" };
    expect(run({ manifest: [badFile, ...manifest.slice(1)] })).toContain(
      "GET pos /api/v5/products references missing file tests/unit/does-not-exist.test.ts",
    );
    const probe = manifest.find((e) => e.status === "excluded");
    if (!probe) throw new Error("no exclusions");
    const claimed = manifest.map((e) => (e === probe ? { ...e, implModule: "src/index.ts" } : e));
    expect(run({ manifest: claimed })).toContain(`${coverageKey(probe)} is excluded but names implModule/testFile`);
    const ghost: CoverageEntry = { ...probe, method: "GET", host: "pos", path: "/api/v5/ghost" };
    expect(run({ manifest: [...manifest, ghost] })).toContain(
      "GET pos /api/v5/ghost is in the manifest but not documented in docs/*.md",
    );
  });
});

describe("doc endpoint extraction", () => {
  it("parses hosts, placeholders and relative paths", () => {
    expect(parseDocUrl("https://www.qasir.id/sign-in?lang=id")).toEqual({ host: "www", path: "/sign-in" });
    expect(parseDocUrl("{slug}.qasir.id/dashboard?tokenWeb=…")).toEqual({ host: "merchant", path: "/dashboard" });
    expect(parseDocUrl("https://<slug>.qasir.id/suppliers")).toEqual({ host: "merchant", path: "/suppliers" });
    expect(parseDocUrl("https://example-shop-123.qasir.id/purchase")).toEqual({ host: "merchant", path: "/purchase" });
    expect(parseDocUrl("{origin}/ajax/purchase/cancel/{id}")).toEqual({ host: "merchant", path: "/ajax/purchase/cancel/{id}" });
    expect(parseDocUrl("/api/v5/users")).toEqual({ host: "pos", path: "/api/v5/users" });
    expect(parseDocUrl("cdn.qasir.id/assets/x.png")).toBeNull();
    expect(parseDocUrl("https://etalastic.s3.amazonaws.com/x")).toBeNull();
  });

  it("expands `create` / `update` / `delete` table shorthand", () => {
    const eps = extractDocEndpoints({
      "x.md": "| `POST` | `{origin}/ajax/brand/create` / `update` / `delete` | Brands |",
    });
    expect(eps.map(coverageKey)).toEqual([
      "POST merchant /ajax/brand/create",
      "POST merchant /ajax/brand/update",
      "POST merchant /ajax/brand/delete",
    ]);
  });

  it("uses bare URLs only when no explicit method documents them, and skips base URLs", () => {
    const eps = extractDocEndpoints({
      "a.md": "| `login` | `https://www.qasir.id/api/auth/login` |\n| `v` | `https://www.qasir.id/sign-in/verification` |\n| `POS_API_HOST` | `https://pos.qasir.id` |\n| `SMS` | `https://sms.qasir.id/api` |",
      "b.md": "```\nPOST https://www.qasir.id/api/auth/login\n```",
    });
    expect(eps.map(coverageKey).sort()).toEqual([
      "GET www /sign-in/verification",
      "POST www /api/auth/login",
    ]);
  });

  it("reads SSR HTML sidebar rows and `(Laravel POST` prose", () => {
    const eps = extractDocEndpoints({
      "r.md": "| Produk → Pajak | `/taxes` | Pajak | **SSR HTML** | — |\nRow actions: `/supplier/form/{id}` (edit), `/supplier/delete/{id}` (Laravel POST + `_method`).",
    });
    expect(eps.map(coverageKey)).toEqual(["GET merchant /taxes", "POST merchant /supplier/delete/{}"]);
  });
});

describe.each(OPERATIONS.map((o) => [o.operationId, o] as const))("operation contract: %s", (_id, op) => {
  const entry = manifest.find((e) => e.operationId === op.operationId);

  it("has one coverage entry that points at this contract test or its adapter test", () => {
    expect(manifest.filter((e) => e.operationId === op.operationId)).toHaveLength(1);
    expect(entry?.host).toBe(op.host);
    if (op.responseKind === "html") {
      expect(entry?.status).toBe("html-adapter");
      expect(entry?.implModule).toMatch(/^src\/html\/.+\.ts$/);
    } else {
      expect(entry?.testFile).toBe(OPERATION_CONTRACT_TEST);
      expect(entry?.status).toBe(op.safety === "read" ? "implemented" : "mutation-gated");
    }
  });

  it("has executable evidence and a host bound to one base URL", () => {
    expect(["failed-probe", "unknown"]).not.toContain(op.evidence);
    expect(hostBaseUrl(op.host, "example-merchant")).toMatch(/^https:\/\/[a-z0-9-]+\.qasir\.id$/);
  });

  it("declares a closed input schema with every path param required", () => {
    expect(op.inputSchema.type).toBe("object");
    expect(op.inputSchema.additionalProperties).toBe(false);
    for (const m of op.pathTemplate.matchAll(/\{([^}]+)\}/g)) {
      const name = m[1] ?? "";
      expect(op.inputSchema.properties?.[name], name).toBeDefined();
      expect(op.inputSchema.required ?? []).toContain(name);
    }
  });

  it("bounds pagination fields", () => {
    const props = op.inputSchema.properties ?? {};
    if (props.page) expect(props.page).toMatchObject({ type: "integer", minimum: 1 });
    for (const key of ["count", "limit", "per_page"]) {
      const field = props[key];
      if (!field) continue;
      expect(field.type).toBe("integer");
      expect(typeof field.maximum === "number" && field.maximum <= 100).toBe(true);
    }
  });
});
