/**
 * End-to-end check of a running manujujaya-mcp Worker (local `wrangler dev` or production).
 *
 *   bun run scripts/e2e-mcp.ts --base http://localhost:8787            # OAuth flow, no upstream calls
 *   bun run scripts/e2e-mcp.ts --base https://mcp.manujujaya.com --live # + read-only Qasir calls
 *   bun run scripts/e2e-mcp.ts --base http://localhost:8787 --live --stock-search kampas
 *     --live also opens each widget view tool once with a small range and validates its
 *     structuredContent against src/widgets/contract.ts (prints shapes, never values).
 *     --stock-search sets the product-name fragment for show_stock_browser (default "a").
 *   bun run scripts/e2e-mcp.ts --base http://localhost:8787 --connect --live
 *     --connect first signs in as owner and captures a Qasir session through /connect using
 *     QASIR_E2E_USERNAME / QASIR_E2E_PIN (env or .dev.vars). A login is not a Qasir data write.
 *
 * Runs the real OAuth 2.1 flow (DCR → /authorize consent with owner password → PKCE token
 * exchange), then drives /mcp with the official MCP v2 client pinned to 2026-07-28.
 * Reads OWNER_PASSWORD from the environment, falling back to .dev.vars. Never prints secrets.
 * Never calls mutating operations.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import {
  APP_TOOL,
  MCP_APP_MIME_TYPE,
  STRUCTURED_MAX_CHARS,
  TOOL_SCHEMAS,
  VIEW_TOOL,
  VIEWS,
  WIDGET_TOOL_NAMES,
  viewResourceUri,
  type ToolInput,
  type ViewName,
} from "../src/widgets/contract";
import { addDays, jakartaToday } from "../src/widgets/qasir-dates";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1]! : fallback;
};

const BASE = opt("base", "http://localhost:8787").replace(/\/$/, "");
const LIVE = flag("live");
const STOCK_SEARCH = opt("stock-search", "a");
const REDIRECT_URI = "http://localhost:53682/callback";

function devVars(): Record<string, string> {
  const path = resolve(process.cwd(), ".dev.vars");
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i > 0 && !line.trim().startsWith("#")) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}
const VARS = devVars();
const OWNER_PASSWORD = process.env.OWNER_PASSWORD?.trim() || VARS.OWNER_PASSWORD || "";
const CONNECT = flag("connect");

let failures = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function b64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

async function pkce() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  return { verifier, challenge };
}

function cookiesFrom(res: Response): string {
  return res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}

async function oauthToken(scope: string): Promise<string> {
  const prm = await (await fetch(`${BASE}/.well-known/oauth-protected-resource/mcp`)).json() as { resource: string };
  check("protected resource metadata", prm.resource === `${BASE}/mcp`, prm.resource);
  const as = await (await fetch(`${BASE}/.well-known/oauth-authorization-server`)).json() as Record<string, unknown>;
  check("authorization server metadata (S256, CIMD, DCR)",
    JSON.stringify(as.code_challenge_methods_supported) === '["S256"]' &&
    as.client_id_metadata_document_supported === true && typeof as.registration_endpoint === "string");

  const reg = await fetch(`${BASE}/oauth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_name: "manujujaya-e2e", redirect_uris: [REDIRECT_URI], token_endpoint_auth_method: "none" }),
  });
  const client = (await reg.json()) as { client_id: string };
  check("dynamic client registration", reg.status === 201 && Boolean(client.client_id), `status ${reg.status}`);

  const { verifier, challenge } = await pkce();
  const state = crypto.randomUUID();
  const authUrl = new URL(`${BASE}/authorize`);
  for (const [k, v] of Object.entries({
    response_type: "code", client_id: client.client_id, redirect_uri: REDIRECT_URI, scope, state,
    code_challenge: challenge, code_challenge_method: "S256", resource: `${BASE}/mcp`,
  })) authUrl.searchParams.set(k, v);

  const page = await fetch(authUrl, { redirect: "manual" });
  const html = await page.text();
  const csrf = /name="csrf" value="([a-f0-9]{32})"/.exec(html)?.[1] ?? "";
  const cookie = cookiesFrom(page);
  check("consent page renders with CSRF", page.status === 200 && Boolean(csrf) && Boolean(cookie));
  check("consent page anti-framing", page.headers.get("x-frame-options") === "DENY");

  const post = (body: Record<string, string>, withCookie = cookie) =>
    fetch(authUrl, {
      method: "POST",
      redirect: "manual",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie: withCookie },
      body: new URLSearchParams(body),
    });

  const noCsrf = await post({ decision: "approve", scope: "qasir:read", password: OWNER_PASSWORD }, "");
  check("consent rejects missing CSRF", noCsrf.status === 403, `status ${noCsrf.status}`);
  const wrong = await post({ csrf, decision: "approve", scope: "qasir:read", password: "definitely-not-the-password" });
  check("consent rejects wrong owner password", wrong.status === 401, `status ${wrong.status}`);

  const approved = await post({ csrf, decision: "approve", scope: "qasir:read", password: OWNER_PASSWORD });
  const location = approved.headers.get("location") ?? "";
  const cb = location ? new URL(location) : null;
  check("consent approves with owner password", approved.status === 302 && cb?.searchParams.get("state") === state,
    `status ${approved.status}`);
  const code = cb?.searchParams.get("code") ?? "";

  const tokenRes = await fetch(`${BASE}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI, client_id: client.client_id,
      code_verifier: verifier, resource: `${BASE}/mcp`,
    }),
  });
  const token = (await tokenRes.json()) as { access_token?: string; scope?: string; refresh_token?: string };
  check("PKCE token exchange", tokenRes.ok && Boolean(token.access_token), `scope=${token.scope ?? "?"}`);

  const refreshRes = await fetch(`${BASE}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token", refresh_token: token.refresh_token ?? "", client_id: client.client_id, resource: `${BASE}/mcp`,
    }),
  });
  const refreshed = (await refreshRes.json()) as { access_token?: string };
  check("refresh token rotation", refreshRes.ok && Boolean(refreshed.access_token));
  return refreshed.access_token ?? token.access_token ?? "";
}

/** Minimal cookie jar for the browser-style owner flows. */
class Jar {
  #cookies = new Map<string, string>();
  absorb(res: Response): void {
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair!.indexOf("=");
      const name = pair!.slice(0, i);
      const value = pair!.slice(i + 1);
      if (/Max-Age=0/i.test(c) || !value) this.#cookies.delete(name);
      else this.#cookies.set(name, value);
    }
  }
  header(): string {
    return [...this.#cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

async function connectQasirSession(): Promise<void> {
  const username = process.env.QASIR_E2E_USERNAME?.trim() || VARS.QASIR_E2E_USERNAME || "";
  const pin = process.env.QASIR_E2E_PIN?.trim() || VARS.QASIR_E2E_PIN || "";
  if (!username || !pin) throw new Error("QASIR_E2E_USERNAME / QASIR_E2E_PIN not set");
  const jar = new Jar();

  const loginPage = await fetch(`${BASE}/login?next=/connect`, { redirect: "manual" });
  jar.absorb(loginPage);
  const csrf = /name="csrf" value="([a-f0-9]{32})"/.exec(await loginPage.text())?.[1] ?? "";
  const login = await fetch(`${BASE}/login`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: jar.header() },
    body: new URLSearchParams({ csrf, next: "/connect", password: OWNER_PASSWORD }),
  });
  jar.absorb(login);
  check("owner sign-in for /connect", login.status === 302 && login.headers.get("location") === "/connect");

  const json = (path: string, body: Record<string, string>) =>
    fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", cookie: jar.header() },
      body: JSON.stringify({ csrf, ...body }),
    });
  let res = await json("/connect/login", { username, pin });
  let data = (await res.json()) as Record<string, unknown>;
  if (data.next_step === "select_outlet") {
    const outlets = (data.outlets as Array<{ id: number; is_lock?: boolean }>) ?? [];
    const preferred = VARS.DEFAULT_OUTLET_ID || process.env.DEFAULT_OUTLET_ID || "";
    const outlet = outlets.find((o) => String(o.id) === preferred && !o.is_lock) ?? outlets.find((o) => !o.is_lock);
    res = await json("/connect/select-outlet", { outletId: String(outlet?.id ?? ""), pin });
    data = (await res.json()) as Record<string, unknown>;
  }
  check("Qasir login via /connect", res.ok && data.connected === true,
    data.connected ? `merchant=${String(data.merchantSlug)}` : `status ${res.status} ${String(data.message ?? data.reason ?? data.next_step ?? "")}`);
  const status = (await (await fetch(`${BASE}/connect/status`, { headers: { accept: "application/json", cookie: jar.header() } })).json()) as Record<string, unknown>;
  check("/connect/status connected (no secrets in payload)", status.connected === true &&
    !JSON.stringify(status).match(/[A-Za-z0-9]{32}/), `source=${String(status.source)}`);
}

async function connect(token: string, mode: "modern" | "legacy"): Promise<Client> {
  const client = new Client(
    { name: "manujujaya-e2e", version: "1.0.0" },
    { versionNegotiation: { mode: mode === "modern" ? { pin: "2026-07-28" } : "legacy" } },
  );
  const transport = new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`), {
    requestInit: { headers: { authorization: `Bearer ${token}` } },
  });
  await client.connect(transport);
  return client;
}

function toolText(result: unknown): string {
  const content = (result as { content?: Array<{ type: string; text?: string }> }).content ?? [];
  return content.map((c) => c.text ?? "").join("\n");
}

/** `_meta.ui` of a listed tool, if any. */
function uiMeta(tool: { _meta?: Record<string, unknown> } | undefined): { resourceUri?: unknown; visibility?: unknown } | undefined {
  const ui = tool?._meta?.ui;
  return typeof ui === "object" && ui !== null ? (ui as { resourceUri?: unknown; visibility?: unknown }) : undefined;
}

/** Structure without values: arrays as key[length], objects as key{field count}, scalars as key:type. */
function shapeOf(value: Record<string, unknown>): string {
  return Object.entries(value)
    .map(([key, v]) =>
      Array.isArray(v) ? `${key}[${v.length}]` : v === null ? `${key}:null` : typeof v === "object" ? `${key}{${Object.keys(v).length}}` : `${key}:${typeof v}`,
    )
    .join(" ");
}

/** Indonesian mobile numbers (08…, 628…, +628…). Widget tool text must never contain one. */
const PHONE_PATTERN = /(?<!\d)(?:\+?62|0)8\d{7,11}(?!\d)/;

/** One small read-only call per view tool; dates are Asia/Jakarta. */
function liveViewArgs(today: string): { [V in ViewName]: ToolInput<(typeof VIEW_TOOL)[V]> } {
  return {
    penjualan: { start_date: addDays(today, -1), end_date: today },
    produk: { start_date: addDays(today, -6), end_date: today, order: "terlaris" },
    stok: { search: STOCK_SEARCH },
    pembelian: { status: "semua" },
    transaksi: { start_date: today, end_date: today },
    piutang: {},
  };
}

async function liveWidgetChecks(client: Client): Promise<void> {
  const args = liveViewArgs(jakartaToday(new Date()));
  for (const view of VIEWS) {
    const name = VIEW_TOOL[view];
    const started = Date.now();
    const result = await client.callTool({ name, arguments: args[view] as Record<string, unknown> });
    const content = (result.content ?? []) as Array<{ type: string; text?: string }>;
    const text = content[0]?.text ?? "";
    if (result.isError) {
      check(`live widget: ${name}`, false, text.slice(0, 160));
      continue;
    }
    const size = JSON.stringify(result.structuredContent ?? null).length;
    const parsed = TOOL_SCHEMAS[name].output.safeParse(result.structuredContent);
    check(
      `live widget: ${name} structuredContent matches the contract`,
      parsed.success && size <= STRUCTURED_MAX_CHARS,
      parsed.success
        ? `${Date.now() - started} ms, ${size} chars`
        : parsed.error.issues.slice(0, 3).map((issue) => issue.path.join(".") || "(root)").join(", "),
    );
    check(
      `live widget: ${name} returns one text block (≤ 2,000 chars, no phone numbers)`,
      content.length === 1 && content[0]?.type === "text" && text.length <= 2_000 && !PHONE_PATTERN.test(text),
      `${text.length} chars`,
    );
    if (parsed.success) console.log(`INFO  ${name} shape: ${shapeOf(result.structuredContent as Record<string, unknown>)}`);
  }
}

async function main() {
  console.log(`E2E against ${BASE}${LIVE ? " (live read-only Qasir calls)" : ""}`);
  if (!OWNER_PASSWORD) throw new Error("OWNER_PASSWORD not set (env or .dev.vars)");

  const health = await fetch(`${BASE}/healthz`);
  check("GET /healthz", health.ok);

  const anon = await fetch(`${BASE}/mcp`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  check("unauthenticated /mcp → 401 + resource_metadata",
    anon.status === 401 && (anon.headers.get("www-authenticate") ?? "").includes("resource_metadata="));
  const bogus = await fetch(`${BASE}/mcp`, { method: "POST", headers: { authorization: "Bearer not-a-token" }, body: "{}" });
  check("invalid bearer → 401", bogus.status === 401);
  const connectAnon = await fetch(`${BASE}/connect`, { redirect: "manual" });
  check("/connect requires owner sign-in", connectAnon.status === 302 &&
    (connectAnon.headers.get("location") ?? "").startsWith("/login"));

  if (CONNECT) await connectQasirSession();
  const token = await oauthToken("qasir:read");
  const client = await connect(token, "modern");
  check("server/discover negotiated 2026-07-28", client.getNegotiatedProtocolVersion() === "2026-07-28",
    client.getNegotiatedProtocolVersion());

  const tools = (await client.listTools()).tools;
  const names = tools.map((t) => t.name).sort();
  const widgetNames = names.filter((name) => WIDGET_TOOL_NAMES.includes(name));
  const widgetsEnabled = widgetNames.length > 0;
  // execute_mutation is only registered for qasir:write tokens when ENABLE_MUTATIONS=true.
  check("tools/list (read-only token)", JSON.stringify(names.filter((name) => !WIDGET_TOOL_NAMES.includes(name))) === '["execute","search"]',
    names.join(","));
  check("tools annotated readOnlyHint + title", tools.every((t) => t.annotations?.readOnlyHint === true && Boolean(t.title)));
  if (widgetsEnabled) {
    const byName = new Map(tools.map((t) => [t.name, t]));
    check("widget tools listed (6 views + 9 app-only)", widgetNames.length === WIDGET_TOOL_NAMES.length, `${widgetNames.length}`);
    check("view tools carry _meta.ui.resourceUri", VIEWS.every((view) => uiMeta(byName.get(VIEW_TOOL[view]))?.resourceUri === viewResourceUri(view)));
    check("app-only tools carry _meta.ui.visibility [\"app\"]",
      Object.values(APP_TOOL).every((name) => JSON.stringify(uiMeta(byName.get(name))?.visibility) === '["app"]'));
  } else {
    console.log("INFO  widget tools not listed (ENABLE_WIDGETS=false on this Worker)");
  }

  const listedResources = (await client.listResources()).resources;
  const resources = listedResources.map((r) => r.uri);
  check("resources/list", ["qasir://docs/index", "qasir://openapi", "qasir://capabilities", "qasir://coverage"].every((u) => resources.includes(u)), resources.join(","));
  if (widgetsEnabled) {
    check("resources/list has the six ui:// views (MCP App mime type)",
      VIEWS.every((view) => listedResources.some((r) => r.uri === viewResourceUri(view) && r.mimeType === MCP_APP_MIME_TYPE)));
    const viewResource = await client.readResource({ uri: viewResourceUri("transaksi") });
    const viewContent = viewResource.contents[0] as { mimeType?: string; text?: string } | undefined;
    const viewHtml = viewContent?.text ?? "";
    check("resources/read ui://manujujaya/transaksi.html",
      viewContent?.mimeType === MCP_APP_MIME_TYPE && viewHtml.includes('data-view="transaksi"') && viewHtml.includes('name="mj-build"'),
      `${viewHtml.length} chars`);
  }
  const templates = (await client.listResourceTemplates()).resourceTemplates.map((t) => t.uriTemplate);
  check("resources/templates/list", templates.some((t) => t.includes("qasir://docs/")), templates.join(","));
  const openapi = await client.readResource({ uri: "qasir://openapi" });
  const openapiText = (openapi.contents[0] as { text?: string }).text ?? "";
  check("resources/read qasir://openapi", openapiText.includes('"openapi"'));
  check("openapi has no credentials", !/API_TOKEN\s*[:=]\s*[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9]{20,}|qasir_sess=/.test(openapiText));

  const prompts = (await client.listPrompts()).prompts.map((p) => p.name).sort();
  check("prompts/list", ["review_purchase_orders", "sales_overview", "trace_stock_movement"].every((p) => prompts.includes(p)), prompts.join(","));

  const search = await client.callTool({
    name: "search",
    arguments: { code: "async () => { const { catalog } = await codemode.spec(); return catalog.filter(o => String(o.operationId).startsWith('products.')).map(o => o.operationId).slice(0, 5); }" },
  });
  check("tools/call search (Code Mode sandbox)", !search.isError && toolText(search).includes("products."), toolText(search).slice(0, 120));

  const escape = await client.callTool({
    name: "execute",
    arguments: { code: "async () => { const r = await fetch('https://example.com'); return r.status; }" },
  });
  check("sandbox blocks outbound fetch", escape.isError === true || !/\b200\b/.test(toolText(escape)), toolText(escape).slice(0, 160));

  const write = await client.callTool({
    name: "execute",
    arguments: { code: "async () => codemode.request({ operationId: 'purchases.cancel', path: { id: 1 } })" },
  });
  check("execute refuses mutating operations with MUTATION_DISABLED", write.isError === true && toolText(write).includes("MUTATION_DISABLED"),
    toolText(write).slice(0, 160));
  const hidden = await client.callTool({ name: "execute_mutation", arguments: { operationId: "purchases.cancel" } }).catch((e: Error) => e);
  check("execute_mutation not callable with a read-only token",
    hidden instanceof Error || (hidden as { isError?: boolean }).isError === true);

  if (LIVE) {
    const live = await client.callTool({
      name: "execute",
      arguments: {
        code: `async () => {
  const [products, purchases] = await Promise.all([
    codemode.request({ operationId: 'products.list', query: { page: 1, count: 3 } }),
    codemode.request({ operationId: 'purchases.list', query: { page: 1, count: 3 } }),
  ]);
  const shape = (r) => ({ status: r.status, keys: Object.keys(r.data ?? {}).slice(0, 6) });
  return { products: shape(products), purchases: shape(purchases) };
}`,
      },
    });
    check("live read: products.list + purchases.list via execute", !live.isError && toolText(live).includes('"status":200'),
      toolText(live).slice(0, 240));
    const html = await client.callTool({
      name: "execute",
      arguments: { code: "async () => { const r = await codemode.request({ operationId: 'suppliers.listHtml', query: { page: 1 } }); return { status: r.status, rows: r.data.rows.length, hasNext: r.data.hasNext }; }" },
    });
    check("live read: suppliers HTML adapter (cookie + CSRF)", !html.isError, toolText(html).slice(0, 240));
    const limit = await client.callTool({
      name: "execute",
      arguments: { code: "async () => codemode.request({ operationId: 'products.list', query: { page: 1, count: 5000 } })" },
    });
    check("page size above 100 rejected before any upstream call", limit.isError === true && toolText(limit).includes("INVALID_INPUT"),
      toolText(limit).slice(0, 160));
    if (widgetsEnabled) await liveWidgetChecks(client);
  }
  await client.close();

  try {
    const legacy = await connect(token, "legacy");
    const legacyTools = (await legacy.listTools()).tools.length;
    console.log(`INFO  legacy (2025 initialize) client connected, ${legacyTools} tools (MCP_LEGACY_MODE=stateless)`);
    await legacy.close();
  } catch (err) {
    console.log(`INFO  legacy (2025 initialize) client rejected: ${(err as Error).message.slice(0, 160)}`);
  }

  console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error("E2E crashed:", err instanceof Error ? err.message : err);
  process.exit(2);
});
