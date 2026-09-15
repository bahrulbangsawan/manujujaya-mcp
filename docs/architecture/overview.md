# Architecture overview

One Cloudflare Worker (`src/index.ts`) serves one Qasir merchant. The merchant is set by `MERCHANT_SLUG` in `wrangler.jsonc`. Callers can never choose the merchant origin.

## Modules

| Area | Path | Responsibility |
| --- | --- | --- |
| Entry + OAuth wiring | `src/index.ts` | `OAuthProvider` with `apiRoute: "/mcp"` → `mcpApiHandler`; everything else → `appHandler` (`/healthz`, `/`, `/authorize`, `/login`, `/logout`, `/approvals/:id`, `/connect*`) |
| Owner auth | `src/auth/owner.ts` | `OWNER_PASSWORD` check (constant-time), HMAC owner cookie (key HKDF-derived from `SESSION_ENCRYPTION_KEY` salted with the password), double-submit CSRF, `__Host-` cookies on https |
| Consent / login pages | `src/auth/owner-routes.ts`, `src/auth/pages.ts` | `/authorize` consent (client name, redirect origin, scopes, password), `/login`, `/logout`, password rate limit |
| Principal + scopes | `src/auth/verify.ts`, `src/auth/scopes.ts` | Principal from token `props`; loopback-only `DEV_PSK`; `qasir:read` / `qasir:write` / `qasir:admin` |
| MCP surface | `src/mcp/server.ts`, `resources.ts`, `prompts.ts`, `results.ts` | SDK v2 `McpServer` per request: tools, resources, prompts, typed error results |
| Mutation tool | `src/mcp/mutation-tool.ts` | Two-call `execute_mutation` flow |
| Approvals | `src/approvals/mutation-approvals.ts`, `routes.ts` | `MutationApprovalsDO` (single-use, args-hash-bound, 10 min) + `/approvals/:id` owner page |
| Code Mode | `src/codemode/run.ts`, `budget.ts`, `output.ts`, `errors.ts`, `spec.ts` | `DynamicWorkerExecutor` sandbox, host-side limits, output cap, error bridging, spec bundle |
| Registry + OpenAPI | `src/registry/*` | Typed `ApiOperation`s (`ops/*.ts`), input validation (`validate.ts`), OpenAPI 3.1, coverage manifest + exclusions |
| Dispatcher | `src/dispatcher/*` | Host allowlist, path building, auth headers per `authProfile`, redirects, body cap, upstream status mapping |
| HTML adapters | `src/html/*` | Suppliers list and stock-adjustment history pages parsed into rows |
| Qasir session | `src/session/*` | `QasirSessionsDO` + `SessionStore` (AES-GCM, AAD-bound), composite provider (DO session, then static secrets) |
| Connect | `src/connect/*` | `/connect` gate, server-side Qasir login (phone/email + PIN, outlet select), `API_TOKEN` scrape, paste fallback |
| Bundled docs | `src/docs/bundled.ts` | The 13 API docs compiled in (`bun run docs:bundle`) for `qasir://docs/{document}` |
| Observability | `src/observability/log.ts`, `redact.ts` | JSON log lines with key- and pattern-based redaction; doc sanitizer |
| Widget tools | `src/widgets/contract.ts`, `qasir-dates.ts`, `qasir-values.ts`, `budget.ts`, `tools/*` | 6 view tools and 9 app-only helpers over hard-coded read operations, per-call `RequestBudget`, zod contract shared with the SPA |
| Widget views | `src/widgets/resources.ts`, `src/widgets/bundled.ts`, `widgets/` | Six `ui://manujujaya/<view>.html` MCP App resources serving one generated single-file SPA (React 19 + TanStack, Vite; `bun run widgets:bundle`) |

## Request flow: MCP call

1. **OAuth provider** (`@cloudflare/workers-oauth-provider` 0.10.3) handles `/mcp`. It checks the Bearer token against the hashed token in `OAUTH_KV` and checks the audience (`https://mcp.manujujaya.com/mcp`). A missing or invalid token gets `401` with `WWW-Authenticate: ... resource_metadata=...`. On loopback hosts only, `resolveExternalToken` also accepts `DEV_PSK`.
2. **`mcpApiHandler`** builds the principal from `ctx.props` (`subject: "owner"`, granted scopes, clientId). It then creates a stateless `createMcpHandler` (agents 0.23.0) with `legacy: "reject"`, unless `MCP_LEGACY_MODE=stateless`, and passes `authInfo`.
3. **`createManujujayaServer`** registers `search` and `execute`. It also registers `execute_mutation`, but only if `ENABLE_MUTATIONS=true` and the token has `qasir:write`. Unless `ENABLE_WIDGETS=false`, it then registers the 15 widget tools and the six `ui://manujujaya/*.html` resources for every token, since the client's UI capability only arrives per request. Then it adds resources and prompts. Nothing persists between requests: there is no MCP session id, and `GET /mcp` returns 405.
4. **`search` / `execute`** call `runCodemode`. The model's function runs in a Worker Loader isolate with `globalOutbound: null` and a CPU limit. It gets `codemode.spec()`, and in `execute` also `codemode.request()`. The script runs on the executor. Every host call is checked against an `ExecutionBudget`.
5. **`codemode.request`** accepts only `{ operationId, path, query, body }`. The operation must be registered, exposed and `safety: "read"`.
6. **`QasirDispatcher`**:
   - validates input against the operation schema (page size ≤ 100, typed path/query, unknown keys rejected);
   - loads the session;
   - resolves the host from the operation (never from input);
   - checks the allowlist;
   - attaches auth per `authProfile` (`bearer`, `raw-token` or `cookie-csrf`) and the trusted Origin/Referer;
   - fetches with `redirect: "manual"`, a 25 s timeout and a 2 MB body cap;
   - maps upstream statuses to typed errors;
   - parses JSON, or HTML through the adapters.
7. The result goes back into the sandbox. The final return value is truncated structurally and capped at ~24 KB of text.

## Request flow: widget view

1. The model calls a view tool, for example `show_transactions { start_date, end_date }`.
2. The tool handler runs on the host, not in the sandbox:
   - checks `qasir:read`;
   - validates the range;
   - resolves `outlet_id` (input, else the session outlet);
   - sends its fixed read operations through `QasirDispatcher` under a `RequestBudget` (4 concurrent, 30 s, ~8 MB, per-tool request cap).
3. It projects the responses into the contract shape. It returns one Indonesian text block and `structuredContent`, trimmed to 250 KB if needed.
4. A host that supports MCP Apps reads `ui://manujujaya/transaksi.html` and renders it in a sandboxed iframe. It then delivers the tool input and result over `postMessage`.
5. The SPA seeds its query cache from that result, so the first render needs no second call. Paging, details and filter changes call tools through the host's `tools/call` (`transactions_page`, `order_detail`, `show_transactions`). The iframe itself makes no network requests.

## Browser flows

| Route | Who | What happens |
| --- | --- | --- |
| `GET/POST /authorize` | Owner, started by an MCP client | Provider parses and validates the auth request (client, redirect URI, PKCE, CIMD fetch). The consent page shows the self-declared client name, client ID, redirect **origin** and scope checkboxes (`qasir:read` pre-ticked; `qasir:write` offered if requested or mutations are enabled; `qasir:admin` only if requested). Approve needs CSRF plus the owner password, unless the owner cookie is already valid. `completeAuthorization` stores props `{ subject: "owner", scopes, clientId, clientName }`. |
| `GET/POST /login`, `POST /logout` | Owner | Password → HMAC owner cookie (8 h). `next` accepts same-origin relative paths only. |
| `/connect*` | Owner cookie (or `x-dev-psk` on loopback) | Qasir sign-in with phone/email + PIN, optional outlet selection (PIN asked again), paste fallback, disconnect, status. See [connect-qasir.md](../connect-qasir.md). |
| `GET/POST /approvals/:id` | Owner cookie | Shows the pending mutation preview (arguments redacted by key/pattern) with Approve once / Reject. |

## State

| Store | Binding | Contents |
| --- | --- | --- |
| Workers KV | `OAUTH_KV` | OAuth clients (DCR clients expire after 365 days), grants (`grant:owner:*`), hashed access/refresh tokens (`token:owner:*`) |
| Durable Object (SQLite) | `QASIR_SESSIONS` | Instance `merchant:<MERCHANT_SLUG>`: the one encrypted Qasir session, pending outlet selection (10 min, no PIN), stable Qasir device id, hashed rate-limit buckets. Instance `ratelimit:owner-password`: password attempt buckets |
| Durable Object (SQLite) | `MUTATION_APPROVALS` | Instance `owner`: approval records, garbage-collected by alarm 1 h after expiry |
| Worker Loader | `LOADER` | Short-lived sandbox isolates for Code Mode (no state) |

## Protocol and dependency compatibility

| Component | Version | Notes |
| --- | --- | --- |
| MCP protocol | `2026-07-28` | `server/discover`, per-request protocol metadata, `MCP-Protocol-Version`; unsupported versions get JSON-RPC `-32022` (HTTP 400) |
| `@modelcontextprotocol/server` | 2.0.0 (exact) | SDK v2 `McpServer`, `ResourceTemplate`; exact version required by agents 0.23.0 |
| `agents` | 0.23.0 | `createMcpHandler` from `agents/mcp/server`, stateless Streamable HTTP, `legacy: "reject"` in production |
| `@cloudflare/codemode` | 0.5.2 | `DynamicWorkerExecutor`, `normalizeCode`, `truncateResult`/`truncateResponse`. `codeMcpServer()` / `openApiMcpServer()` are **not used** because they build SDK v1 servers; the tools are built on SDK v2 directly |
| `@cloudflare/workers-oauth-provider` | 0.10.3 (exact) | OAuth 2.1 AS + resource server: DCR, CIMD, PKCE S256, refresh rotation, RFC 9728 metadata |
| `wrangler` | 4.131.2 | `worker_loaders`, custom domain routes, `--secrets-file` |
| `zod` | 4.6.5 | Tool and prompt input schemas |
| `typescript` / `vitest` | 7.0.2 / 5.0.0 | `bun run check-types`, `bun run test` |
| Workers runtime | `compatibility_date: 2026-09-15` | Flags: `nodejs_compat`, `global_fetch_strictly_public` (SSRF guard for CIMD metadata fetches) |
| Client used for E2E | `@modelcontextprotocol/client` 2.0.0 | Installed as a peer of `agents`; used by `scripts/e2e-mcp.ts` only |
| `@modelcontextprotocol/ext-apps` | 2.0.0 (exact, dev) | `App` + React hooks in the widget SPA, `AppBridge` in `scripts/widgets-smoke.ts`. The Worker inlines the MCP Apps constants and does not import it |
| Widget toolchain | React 19.3.0, @tanstack/react-router 1.170.36, react-query 5.102.8, react-table 9.2.4, react-virtual 3.14.13, react-form 1.33.5, react-pacer 0.23.0, Vite 8.3.0, vite-plugin-singlefile 2.3.3, Tailwind CSS 4.3.3 (all exact, dev) | Compiled into `src/widgets/bundled.ts`. The Worker ships only the HTML string |
| `playwright-core` | 1.63.0 (exact, dev) | Drives installed Google Chrome for `bun run widgets:smoke` |

Not used: `McpAgent`, `createLegacyMcpHandler`, `@modelcontextprotocol/sdk` v1.

## API coverage

Generated manifest: [coverage.md](coverage.md). `bun run coverage:validate` checks it against the 13 API docs.

| Status | Count | Meaning |
| --- | --- | --- |
| implemented | 40 | JSON read operations callable through `execute` |
| html-adapter | 2 | `suppliers.listHtml`, `stockAdjustment.historyHtml` (SSR pages parsed to rows) |
| mutation-gated | 3 | `purchases.confirmation` (write), `purchases.cancel` and `products.inventories.bulk` (destructive); only via `execute_mutation` |
| session-only | 5 | Login / tokenWeb hops used by `/connect`, never exposed to models |
| excluded | 32 | Failed probes, OTP / forgot-PIN flows, ungated mutations, dashboard chrome, SSR pages without an adapter |
| **total** | **82** | 45 exposed operations (42 read, 1 write, 2 destructive) |

## Known uncertainties

- **Unofficial API.** Every upstream endpoint was observed from the Qasir dashboard. Qasir can change or remove any of them without notice. Symptoms are `UPSTREAM_ERROR`, `INVALID_INPUT` from outdated schemas, or HTML adapters returning empty rows.
- **Session lifetime.** The dashboard session is not a public API key. Nobody has measured how long it lasts. When it expires, tools return `QASIR_AUTH_EXPIRED` and the owner reconnects at `/connect`. There is no automatic refresh.
- **`API_TOKEN` minting is undocumented.** After the tokenWeb redirect, Connect scrapes the 32-character `API_TOKEN` and CSRF meta from dashboard HTML. If Qasir changes that page, Connect asks for the paste fallback.
- **OTP accounts are not supported.** Connect rejects `verify_otp`. Use a phone/email + PIN account without OTP.
- **Client protocol era.** Claude Code 2.1.272 is verified working with `legacy: "reject"`. The protocol era of the Claude.ai web/Desktop connector, Cursor, VS Code and Codex has not been verified against this server. If a client fails with `-32022`, see [operations.md](operations.md#legacy-2025-era-clients-error-32022).
- **Outlet ids.** `DEFAULT_OUTLET_ID` is only a fallback for the stored session and is never shown to the model. `execute` and the prompts do not inject it: operations that need `outlet_ids` get it from the caller. The widget tools resolve `outlet_id` themselves, in this order: the tool input, the outlet stored by `/connect`, `DEFAULT_OUTLET_ID`.
- **MCP Apps hosts.** The views were verified in headless Google Chrome inside `sandbox="allow-scripts"`, under the ext-apps `AppBridge` and the hosts' default CSP (`bun run widgets:smoke`). Rendering in Claude.ai, Claude Desktop and ChatGPT still needs manual acceptance, and so do WebKit webviews (iOS) and each host's real CSP and sandbox flags. If a host sends an `Origin` header, the agents Origin check may reject the request. If a host fails protocol negotiation with -32022, set `MCP_LEGACY_MODE=stateless`; widgets never require the client UI capability.
- **Observability.** The Worker writes structured JSON logs to Workers Logs (`observability.enabled`, sampling 1.0). The code has no custom OpenTelemetry spans or exporter.
- **Sample PII in git history.** Real sample personal data was removed from `docs/*.md`, and `tests/unit/docs-pii.test.ts` guards against its return. It still exists in git history before that change. Rewrite history before sharing the repository more widely.
