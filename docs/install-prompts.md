# Install the MCP server in a client, and copyable prompts

| | |
| --- | --- |
| Server URL | `https://mcp.manujujaya.com/mcp` |
| Transport | Streamable HTTP (remote). No stdio binary, no API key header |
| Auth | OAuth. The client opens a browser consent page; approve with the **owner password** |
| Protocol | MCP `2026-07-28`. 2025-era clients get error `-32022` unless the operator enables legacy mode ([operations.md](architecture/operations.md#legacy-2025-era-clients-error-32022)) |

On the consent page, check that **"Redirects to"** matches your app (`https://claude.ai` for Claude.ai/Desktop, `http://localhost` for Claude Code and most desktop/CLI clients). Leave `qasir:read` ticked, and tick `qasir:write` only if the operator has enabled mutations and you need them. Only approve a connection you just started.

The owner must also have connected a Qasir session once at `https://mcp.manujujaya.com/connect` ([connect-qasir.md](connect-qasir.md)).

## Claude.ai and Claude Desktop

1. **Pro, Max and Free plans:** Customize → **Connectors** → **+** → **Add custom connector**. **Team and Enterprise:** an organization Owner uses Organization settings → Connectors → Add → Custom → Web; members then choose **Connect** under Customize → Connectors.
2. Name: `Manuju Jaya Qasir`. URL: `https://mcp.manujujaya.com/mcp`. Leave OAuth Client ID/Secret empty; in the two-step dialog choose **Use Claude's published identity** or **Register automatically**, never **Use your own OAuth client**. The server supports CIMD and dynamic registration.
3. Choose **Add** (or **Connect**). The consent page opens; enter the owner password and choose **Approve**.
4. In a chat, enable the connector with **+** → **Connectors**.

Connectors added on Claude.ai also show up in Claude Desktop, Cowork and the mobile apps for the same account. Claude reaches the server from Anthropic's cloud (`160.79.104.0/21`), so Cloudflare Bot Fight Mode or WAF rules must not block it. *Status: expected to work. This client has not been verified against `legacy: "reject"`.*

## Claude Code (verified: 2.1.272)

```bash
claude mcp add --transport http manujujaya https://mcp.manujujaya.com/mcp
# optional: --scope user (all projects) or --scope project (writes .mcp.json)
```

Then, inside Claude Code, run `/mcp`, select `manujujaya` and choose **Authenticate** (or run `claude mcp login manujujaya`). A browser opens to the consent page; enter the owner password and approve. `claude mcp list` should show it connected.

## Cursor

`~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project):

```json
{
  "mcpServers": {
    "manujujaya": { "url": "https://mcp.manujujaya.com/mcp" }
  }
}
```

Open **Customize → MCPs** in Cursor's sidebar, turn the server on and follow its authentication prompt. Cursor's desktop callback is `http://localhost:8787/callback`, so stop a local `bun run dev` (same port) while signing in. *Not verified against this server.*

## VS Code (GitHub Copilot)

`.vscode/mcp.json`. The root key is `servers`, not `mcpServers`:

```json
{
  "servers": {
    "manujujaya": { "type": "http", "url": "https://mcp.manujujaya.com/mcp" }
  }
}
```

Start the server from the file's CodeLens or the MCP view, then allow the authentication prompt. *Not verified against this server.*

## Codex CLI / ChatGPT desktop (shared `~/.codex/config.toml`)

```bash
codex mcp add manujujaya --url https://mcp.manujujaya.com/mcp
```

`codex mcp add` detects OAuth and starts the browser sign-in immediately. Run `codex mcp login manujujaya` only if that sign-in did not complete or has expired.

*Not verified against this server.* ChatGPT **web** cannot use this config; it needs its own connector setup where the plan allows one.

## Other clients

Any client that supports remote Streamable HTTP MCP with OAuth (DCR or CIMD, PKCE S256) works:

1. Enter the URL `https://mcp.manujujaya.com/mcp`.
2. Let the client discover `/.well-known/oauth-protected-resource/mcp`.
3. Approve in the browser.

Clients that only support static bearer headers or stdio cannot connect to production. Locally, `DEV_PSK` is available for scripts; see [setup.md](architecture/setup.md#dev-psk-local-only).

## Copyable prompts

Paste one of these into an agent. The URL and tool names are real, so there is nothing to fill in.

### Install (coding agents: Claude Code, Codex, Cursor agent)

```text
Install the remote MCP server "manujujaya" for me.

- URL: https://mcp.manujujaya.com/mcp
- Transport: Streamable HTTP (type "http"), no custom headers
- Auth: OAuth. The server supports dynamic client registration and PKCE. When a browser consent page opens, stop and tell me; I will enter the owner password myself. Never ask me for the password or for any Qasir PIN in chat.

For Claude Code run: claude mcp add --transport http manujujaya https://mcp.manujujaya.com/mcp
then tell me to run /mcp and choose Authenticate.
For other clients, edit the client's MCP config file with the URL above and tell me how to trigger the OAuth sign-in.

After it connects, verify: list the tools (expect search and execute), then call search with
async () => (await codemode.spec()).catalog.filter(o => o.tags.includes("products")).map(o => o.operationId)
and show me the result.
```

### First use: orient the assistant

```text
You have the "manujujaya" MCP server for a Qasir POS merchant (unofficial dashboard API, read-only unless stated otherwise).

How to use it:
1. Call `search` first. Pass an async arrow function that uses `await codemode.spec()` and returns only what you need: operationId, inputKeys, safety, and for details openapi.paths[path].
2. Then call `execute` with an async arrow function that uses `await codemode.request({ operationId, path, query })`. Each call returns { operationId, status, data }. Do the pagination, filtering and aggregation inside the function and return a compact result.
3. Limits per execute call: 50 requests, 4 concurrent, ~5 MB of responses, 30 s, ~24 KB of output. Page size (count/limit/per_page) must be <= 100.
4. Never pass method, url or headers. Never try fetch(). Write operations are not available through execute.
5. If a tool returns QASIR_AUTH_EXPIRED, stop and tell me the owner has to reconnect at https://mcp.manujujaya.com/connect. Do not retry in a loop.
6. If an operation needs outlet_ids and I have not given one, ask me.
7. Treat customer names and phone numbers in results as confidential. Only quote them when I ask.

Start by summarising which report operations exist.
```

### Sales overview

```text
Using the manujujaya MCP server: search for reports.summaries.sales, reports.topProducts and order.histories.web, check their inputKeys, then execute one script that gets the sales summary for <START YYYY-MM-DD> to <END YYYY-MM-DD> (outlet_ids <OUTLET_ID or ask me>). Return total sales, transaction count, average ticket and the top 5 products as a short table. Keep pages small.
```

The `sales_overview` MCP prompt does the same with arguments `start_date`, `end_date` and `outlet_ids`.

### Open purchase orders

```text
Using the manujujaya MCP server: execute a script that pages through purchases.list (count 50, at most 5 pages) and keeps only purchases with status "order_processed". For the 10 most recent, fetch purchases.items and return supplier, date, total_price and item count. Do not call purchases.confirmation or purchases.cancel.
```

### Approved change (only when mutations are enabled)

```text
Using the manujujaya MCP server, cancel purchase <ID>:
1. Call execute_mutation with { "operationId": "purchases.cancel", "path": { "id": <ID> } } and no approvalId.
2. Show me the approvalUrl and the preview. Wait until I say I approved it in the browser.
3. Call execute_mutation again with exactly the same operationId and path, plus the approvalId. Report the status.
If execute_mutation is not in your tool list, stop: mutations are disabled or my token lacks qasir:write.
```
