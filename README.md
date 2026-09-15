# manujujaya-mcp

Secure Cloudflare Workers remote MCP server for the Manuju Jaya Qasir dashboard APIs.

- **Protocol:** MCP `2026-07-28` via SDK v2 (`@modelcontextprotocol/server` + `createMcpHandler` from `agents/mcp/server`)
- **Transport:** Stateless Streamable HTTP at `/mcp` (`legacy: "reject"`)
- **Discovery:** Code Mode tools `search` / `execute` / gated `execute_mutation` (custom SDK v2 implementation using `DynamicWorkerExecutor`)
- **Safety:** Read-only by default; allowlisted Qasir hosts; credentials never enter model-written code

## Compatibility decision

Official `openApiMcpServer()` / `codeMcpServer()` from `@cloudflare/codemode/mcp` still return **SDK v1** and require `createLegacyMcpHandler`. This project does **not** use them for `/mcp`.

Instead we:

1. Register `search` / `execute` / `execute_mutation` on SDK v2 `McpServer`
2. Run model JS with `DynamicWorkerExecutor` (`globalOutbound: null`)
3. Inject host `codemode.spec()` and `codemode.request({ operationId, path, query, body })` — never method/URL from the model

Pinned packages: see `package.json` (`agents`, `@modelcontextprotocol/server@2.0.0`, `@cloudflare/codemode`).

## Quick start (local)

```bash
bun install
cp .dev.vars.example .dev.vars   # fill Qasir session + DEV_PSK
# .dev.vars
# ALLOW_DEV_PSK is a wrangler var — set in wrangler.jsonc for local or override
bun run check-types
bun test
bun run coverage:validate
bun run openapi:validate
bun run deploy:dry-run
bun run dev
```

Health: `GET /healthz`  
MCP: `POST /mcp` with `Authorization: Bearer <DEV_PSK>` when `ALLOW_DEV_PSK=true`.

## Secrets (never commit)

| Secret | Purpose |
| --- | --- |
| `QASIR_API_TOKEN` | Dashboard `API_TOKEN` (32-char session) |
| `QASIR_CSRF_TOKEN` | Dashboard CSRF |
| `QASIR_COOKIE` | Cookie jar for HTML/ajax (`qasir_sess`, `XSRF-TOKEN`, …) |
| `DEV_PSK` | Local-only bearer when `ALLOW_DEV_PSK=true` |

Production: configure OAuth issuer/audience + token verification (fail-closed until wired). Scopes: `qasir:read`, `qasir:write`, `qasir:admin`.

```bash
wrangler secret put QASIR_API_TOKEN
wrangler secret put QASIR_CSRF_TOKEN
wrangler secret put QASIR_COOKIE
```

## Tools

| Tool | Sandbox APIs | Notes |
| --- | --- | --- |
| `search` | `codemode.spec()` | No network |
| `execute` | `spec` + `request` | Reads only |
| `execute_mutation` | `spec` + `request` | Requires `ENABLE_MUTATIONS`, `qasir:write`, Durable approval |

## Resources

- `qasir://docs/index`, `qasir://docs/{document}` (sanitized)
- `qasir://openapi`, `qasir://capabilities`, `qasir://coverage`

## Prompts

`sales_overview`, `trace_stock_movement`, `review_purchase_orders`

## Docs

- [Architecture](docs/architecture/overview.md)
- [Setup](docs/architecture/setup.md)
- [API coverage](docs/architecture/coverage.md)
- Authoritative API capture notes remain under `docs/*.md`

## License

Private — Manuju Jaya / Bahrul.
