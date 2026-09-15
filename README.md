# manujujaya-mcp

Remote **Model Context Protocol (MCP)** server for **Bengkel Manuju Jaya** Qasir dashboard APIs, hosted on **Cloudflare Workers**.

Qasir does **not** publish an official public API. This server wraps **observed dashboard XHR** (documented under [`docs/`](docs/)) into MCP tools so agents can search the catalog and run read-only (optionally gated write) operations safely.

| | |
|---|---|
| Endpoint | `POST /mcp` (Streamable HTTP) |
| Protocol | MCP **2026-07-28** (SDK v2) |
| Merchant | Hardcoded `bengkel-manuju-jaya-621095` → `https://bengkel-manuju-jaya-621095.qasir.id` |
| Default posture | **Read-only**, fail-closed auth, secrets never enter model-written code |

---

## Table of contents

1. [What you get](#what-you-get)
2. [Architecture (short)](#architecture-short)
3. [Local setup](#local-setup)
4. [Connect Qasir session](#connect-qasir-session)
5. [How to use the MCP tools](#how-to-use-the-mcp-tools)
6. [Install on every agent](#install-on-every-agent)
7. [Copyable install prompts](#copyable-install-prompts)
8. [Verification & E2E](#verification--e2e)
9. [Security notes](#security-notes)
10. [Troubleshooting](#troubleshooting)
11. [Further docs](#further-docs)

---

## What you get

### Tools

| Tool | Purpose |
|---|---|
| `search` | Run sandboxed JS against the **sanitized** OpenAPI/catalog only (`codemode.spec()`). **No network.** |
| `execute` | Run sandboxed JS with `codemode.spec()` + host `codemode.request({ operationId, path, query, body })` for **read-only** Qasir calls. |
| `execute_mutation` | Same sandbox for **mutations** — requires `ENABLE_MUTATIONS=true`, scope `qasir:write`, and a durable approval. **Off by default.** |

Full descriptions: [`docs/mcp-tools.md`](docs/mcp-tools.md).

### Resources

| URI | Content |
|---|---|
| `qasir://docs/index` | Index of sanitized capture docs |
| `qasir://docs/{name}` | One doc (e.g. `products`, `auth-login`) |
| `qasir://openapi` | Sanitized OpenAPI 3.1 |
| `qasir://capabilities` | Server capability summary |
| `qasir://coverage` | Operation coverage manifest |

### Prompts

- `sales_overview`
- `trace_stock_movement`
- `review_purchase_orders`

### Other HTTP routes

| Route | Purpose |
|---|---|
| `GET /healthz` | Liveness (no secrets) |
| `GET/POST /connect…` | Connect Qasir UI (session capture) — see below |

---

## Architecture (short)

```
MCP client  →  Bearer auth  →  /mcp (createMcpHandler, SDK v2)
                                  ├─ search / execute / execute_mutation
                                  ├─ DynamicWorkerExecutor (no outbound fetch from sandbox)
                                  └─ QasirDispatcher (allowlisted hosts + session)
                                         ↑
                              /connect or QASIR_* Worker secrets
```

**Important compatibility choice:** Cloudflare’s `openApiMcpServer()` / `codeMcpServer()` still produce **SDK v1** servers. This project keeps `/mcp` on **SDK v2** and builds Code Mode tools manually with `DynamicWorkerExecutor`.

---

## Local setup

### Prerequisites

- [Bun](https://bun.sh) 1.4+
- Cloudflare Wrangler (`bunx wrangler`)
- Qasir owner/staff login for Manuju Jaya (phone/email + **6-digit PIN** — **no OTP accounts**)

### Install & run

```bash
cd /path/to/manujujaya-mcp
bun install
cp .dev.vars.example .dev.vars
# Edit .dev.vars — at minimum for local MCP clients:
#   ALLOW_DEV_PSK=true
#   DEV_PSK=<long random string>
#   SESSION_ENCRYPTION_KEY=<openssl rand -base64 32>
#   MERCHANT_SLUG=bengkel-manuju-jaya-621095
#   DEFAULT_OUTLET_ID=645203
bun run check-types
bun test
bun run dev
```

Default local base URL:

```text
http://127.0.0.1:8787
```

- Health: `http://127.0.0.1:8787/healthz`
- MCP: `http://127.0.0.1:8787/mcp`
- Connect UI: `http://127.0.0.1:8787/connect?psk=<DEV_PSK>`

Every MCP request needs:

```http
Authorization: Bearer <DEV_PSK>
```

when `ALLOW_DEV_PSK=true`. Production should use real OAuth (currently fail-closed until JWKS is wired).

### Deploy (when you choose to)

```bash
# Prefer Connect UI after deploy; optional bootstrap secrets:
wrangler secret put SESSION_ENCRYPTION_KEY
wrangler secret put CONNECT_NONCE
# optional bootstrap (or use /connect only):
wrangler secret put QASIR_API_TOKEN
wrangler secret put QASIR_CSRF_TOKEN
wrangler secret put QASIR_COOKIE

# Keep ALLOW_DEV_PSK=false in production wrangler vars
bunx wrangler deploy
```

Replace `http://127.0.0.1:8787` in client configs with your `https://<worker>.<account>.workers.dev` URL.

---

## Connect Qasir session

Agents never see your PIN. The **host** holds `API_TOKEN` / CSRF / cookies.

1. Open `/connect?psk=<DEV_PSK>` (or use Bearer / `CONNECT_NONCE` gate).
2. Sign in with **phone/email + PIN only**.
3. Merchant is **auto-fixed** to Manuju Jaya (`MERCHANT_SLUG`). No merchant picker.
4. If Qasir asks for **outlet**, pick one in the UI.
5. If Qasir would require **OTP**, Connect **rejects** (410 on OTP routes) — use a non-OTP account.
6. If `API_TOKEN` cannot be scraped after `tokenWeb`, use **paste fallback** (DevTools → token + CSRF + Cookie).
7. Confirm `GET /connect/status` → `connected: true` (no secrets in the JSON).

Details: [`docs/connect-qasir.md`](docs/connect-qasir.md).

Optional live E2E (uses `.dev.vars` `QASIR_E2E_*`, never prints secrets):

```bash
bun run scripts/e2e-live-login-products.ts
```

---

## How to use the MCP tools

### Progressive discovery pattern

1. **`search`** — find `operationId`s (products, reports, purchases, …).
2. **`execute`** — call only those ids via `codemode.request`.
3. Keep returned fields small (map/filter/aggregate in the sandbox).

### Example: find product operations

Ask the agent (or call `search` with code like):

```js
async () => {
  const { catalog } = await codemode.spec();
  return catalog
    .filter((o) => o.tags?.includes("products") || /product/i.test(o.operationId))
    .slice(0, 15)
    .map(({ operationId, method, pathTemplate, title }) => ({
      operationId, method, pathTemplate, title,
    }));
};
```

### Example: list products

```js
async () => {
  const r = await codemode.request({
    operationId: "products.list",
    query: { page: 1, count: 5 },
  });
  return r;
};
```

### Rules for model-written code

- **Do** use `operationId` from the catalog.
- **Do not** pass absolute URLs, `Authorization`, cookies, CSRF, or `Origin`.
- **Do not** call `fetch()` from the sandbox (blocked).
- Mutations stay disabled unless you explicitly enable + approve them.

Useful `operationId` examples (see coverage for the full list): `products.list`, `users.list`, `suppliers.listHtml`, report/order history ops under `docs/architecture/coverage.md`.

---

## Install on every agent

This server is **remote HTTP (Streamable HTTP)** at `/mcp`, **not** a local stdio binary. Every client needs:

1. Base URL ending in `/mcp`
2. `Authorization: Bearer <token>` (`DEV_PSK` locally)

Below, substitute:

- `MCP_URL` → e.g. `http://127.0.0.1:8787/mcp` or `https://manujujaya-mcp.<account>.workers.dev/mcp`
- `MCP_TOKEN` → your `DEV_PSK` (local) or production bearer

### Claude Code (CLI)

```bash
claude mcp add --transport http manujujaya \
  --header "Authorization: Bearer MCP_TOKEN" \
  MCP_URL
```

Project-shared (commit `.mcp.json`, team must approve):

```bash
claude mcp add --scope project --transport http manujujaya \
  --header "Authorization: Bearer ${MANUJUJAYA_MCP_TOKEN}" \
  MCP_URL
```

Or create **`.mcp.json`** in the project root:

```json
{
  "mcpServers": {
    "manujujaya": {
      "type": "http",
      "url": "http://127.0.0.1:8787/mcp",
      "headers": {
        "Authorization": "Bearer ${MANUJUJAYA_MCP_TOKEN}"
      }
    }
  }
}
```

Check: `claude mcp list` → `/mcp` inside Claude Code.

Docs: [Claude Code MCP](https://code.claude.com/docs/en/mcp).

### Claude Desktop

Edit:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "manujujaya": {
      "type": "http",
      "url": "http://127.0.0.1:8787/mcp",
      "headers": {
        "Authorization": "Bearer MCP_TOKEN"
      }
    }
  }
}
```

Fully quit and reopen Claude Desktop. If your Desktop build only supports stdio MCP, use Claude Code / Cursor / Codex for this HTTP server, or put a tiny local stdio proxy in front (not bundled here).

### Codex CLI + ChatGPT desktop / IDE (shared Codex host)

ChatGPT **desktop**, Codex CLI, and the Codex IDE extension share `~/.codex/config.toml`.

CLI:

```bash
codex mcp add manujujaya \
  --url MCP_URL \
  --env MANUJUJAYA_MCP_TOKEN=MCP_TOKEN
```

Then ensure bearer env wiring in `~/.codex/config.toml`:

```toml
[mcp_servers.manujujaya]
url = "http://127.0.0.1:8787/mcp"
bearer_token_env_var = "MANUJUJAYA_MCP_TOKEN"
# or:
# http_headers = { "Authorization" = "Bearer MCP_TOKEN" }
```

```bash
export MANUJUJAYA_MCP_TOKEN='MCP_TOKEN'
codex mcp list
```

In the ChatGPT desktop app: **Settings → MCP servers → Add server → Streamable HTTP** → URL + bearer.

### ChatGPT web (chatgpt.com)

ChatGPT **web** does **not** read `~/.codex/config.toml`. Remote MCP there is via **Plugins / Connectors** (admin-controlled on Team/Enterprise). You generally need a **public HTTPS** Worker URL and whatever connector onboarding ChatGPT requires — local `127.0.0.1` will not work from ChatGPT cloud.

Use ChatGPT **desktop** (Codex host) for local `8787`, or deploy the Worker first for web plugins.

Docs: [ChatGPT Learn — MCP](https://learn.chatgpt.com/docs/extend/mcp).

### Cursor

Cursor Settings → **MCP** → Add server (or project `.cursor/mcp.json` / Cursor MCP UI):

```json
{
  "mcpServers": {
    "manujujaya": {
      "url": "http://127.0.0.1:8787/mcp",
      "headers": {
        "Authorization": "Bearer MCP_TOKEN"
      }
    }
  }
}
```

(Exact UI labels vary by Cursor version; transport must be HTTP/Streamable HTTP, not stdio.)

### VS Code (GitHub Copilot MCP)

Use root key **`servers`** (not `mcpServers`) in `.vscode/mcp.json`:

```json
{
  "servers": {
    "manujujaya": {
      "type": "http",
      "url": "http://127.0.0.1:8787/mcp",
      "headers": {
        "Authorization": "Bearer MCP_TOKEN"
      }
    }
  }
}
```

### Windsurf / Cline / Continue / other MCP clients

Same idea as Claude Desktop JSON (`mcpServers` + `url` + `headers`), or their HTTP MCP dialog. Always:

1. URL = `…/mcp`
2. Header `Authorization: Bearer …`
3. Prefer Streamable HTTP / HTTP over deprecated SSE-only unless the client forces SSE.

### Grok / other assistants

Any client that can call a remote MCP Streamable HTTP endpoint with a custom Authorization header can use this server the same way. If the client only supports stdio, you need a local bridge (out of scope of this repo).

---

## Copyable install prompts

Paste one of these into an agent chat (fill `MCP_URL` and `MCP_TOKEN` first). The agent should configure itself or give you exact file edits.

### Universal (any coding agent)

````text
Install the remote MCP server "manujujaya" for me.

- Transport: Streamable HTTP (MCP)
- URL: MCP_URL
- Auth header: Authorization: Bearer MCP_TOKEN
- Server name: manujujaya

This wraps unofficial Qasir dashboard APIs for Bengkel Manuju Jaya (merchant slug bengkel-manuju-jaya-621095). Tools: search, execute, execute_mutation (mutations off by default). After connecting, call search to list product-related operationIds, then execute products.list with page=1 count=5. Do not ask me for the Qasir PIN; session is provisioned via the Worker /connect UI or host secrets.
````

### Claude Code

````text
Add this remote MCP server to Claude Code (user scope):

claude mcp add --transport http manujujaya \
  --header "Authorization: Bearer MCP_TOKEN" \
  MCP_URL

Then run `claude mcp list` and `/mcp` to confirm Connected. Afterwards, use tool `search` to find products operations and `execute` with operationId products.list (page 1, count 5).
````

### Codex / ChatGPT desktop

````text
Configure Codex MCP for manujujaya:

1) export MANUJUJAYA_MCP_TOKEN='MCP_TOKEN'
2) codex mcp add manujujaya --url MCP_URL
3) In ~/.codex/config.toml set:

[mcp_servers.manujujaya]
url = "MCP_URL"
bearer_token_env_var = "MANUJUJAYA_MCP_TOKEN"

4) Restart ChatGPT desktop / Codex if needed, then `/mcp` and verify manujujaya is enabled.
````

### Claude Desktop

````text
Edit claude_desktop_config.json (macOS: ~/Library/Application Support/Claude/claude_desktop_config.json) and merge:

{
  "mcpServers": {
    "manujujaya": {
      "type": "http",
      "url": "MCP_URL",
      "headers": {
        "Authorization": "Bearer MCP_TOKEN"
      }
    }
  }
}

Fully quit and reopen Claude Desktop, then confirm the manujujaya MCP tools appear.
````

### Cursor

````text
Add an MCP server named manujujaya in Cursor:

URL: MCP_URL
Headers: Authorization: Bearer MCP_TOKEN
Transport: HTTP / Streamable HTTP

Reload MCP servers, then list tools (search, execute, execute_mutation).
````

### VS Code Copilot

````text
Create or update .vscode/mcp.json with root key "servers" (not mcpServers):

{
  "servers": {
    "manujujaya": {
      "type": "http",
      "url": "MCP_URL",
      "headers": {
        "Authorization": "Bearer MCP_TOKEN"
      }
    }
  }
}

Reload the window and confirm Copilot can see the manujujaya tools.
````

### One-liner local defaults (dev)

````text
MCP_URL=http://127.0.0.1:8787/mcp
MCP_TOKEN=<paste DEV_PSK from .dev.vars>
````

---

## Verification & E2E

```bash
bun run check-types
bun test
bun run coverage:validate
bun run openapi:validate
bun run deploy:dry-run   # does not publish
bun run scripts/e2e-live-login-products.ts   # needs QASIR_E2E_* in .dev.vars
```

---

## Security notes

- Never commit `.dev.vars`, PINs, cookies, or `API_TOKEN`.
- Do not put Qasir PIN in MCP tool args or agent chat if avoidable — use `/connect`.
- Sandbox cannot reach the network except through allowlisted dispatcher.
- Mutations require explicit enablement + approval DO.
- Production OAuth is fail-closed until issuer/JWKS verification is wired; local uses `ALLOW_DEV_PSK`.

---

## Troubleshooting

| Symptom | Check |
|---|---|
| `401` on `/mcp` | Bearer missing/wrong; `ALLOW_DEV_PSK` and `DEV_PSK` |
| `QASIR_AUTH_EXPIRED` | Re-run `/connect` or refresh session secrets |
| OTP error on Connect | Account requires OTP — use phone/email+PIN-only account |
| Merchant error | Login must include configured `MERCHANT_SLUG` store |
| Client connects but no tools | Wrong URL (must end with `/mcp`); restart client; confirm protocol HTTP not stdio-only |
| ChatGPT web can’t reach localhost | Deploy Worker to HTTPS or use ChatGPT desktop/Codex |
| `products.list` huge | Use small `count`; filter in sandbox before return |

---

## Further docs

- [`docs/mcp-tools.md`](docs/mcp-tools.md) — tool/resource/prompt reference
- [`docs/connect-qasir.md`](docs/connect-qasir.md) — Connect UI details
- [`docs/architecture/overview.md`](docs/architecture/overview.md) — architecture
- [`docs/architecture/setup.md`](docs/architecture/setup.md) — ops setup
- [`docs/architecture/coverage.md`](docs/architecture/coverage.md) — API coverage
- Capture notes: `docs/products.md`, `docs/auth-login.md`, …

## License

Private — Manuju Jaya / Bahrul.
