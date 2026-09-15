# manujujaya-mcp

An MCP server that lets AI assistants such as Claude, Cursor or Codex read live data from the **Qasir POS dashboard of Bengkel Manuju Jaya**. It covers products, sales reports, orders, stock movements, purchase orders, suppliers, customers and staff. You ask questions in plain language, and the assistant looks the numbers up for you.

It is a remote server hosted on Cloudflare Workers. There is nothing to install or run on your computer. You add one URL to your AI client and sign in once.

| | |
| --- | --- |
| **MCP URL** | `https://mcp.manujujaya.com/mcp` |
| **Sign-in** | OAuth in your browser, approved with the **owner password** |
| **Access** | Read-only. Writes are switched off in production |
| **Status** | Deployed and tested end to end against production. [Health check](https://mcp.manujujaya.com/healthz) |

---

## Contents

1. [Installation](#1-installation)
2. [Using the server](#2-using-the-server)
3. [Tools reference](#3-tools-reference)
4. [Keeping it working (owner tasks)](#4-keeping-it-working-owner-tasks)
5. [Troubleshooting](#5-troubleshooting)
6. [How it works](#6-how-it-works)
7. [Security and privacy](#7-security-and-privacy)
8. [For developers](#8-for-developers)
9. [Documentation index](#9-documentation-index)

---

## 1. Installation

### What you need

- **An MCP client that supports remote servers with OAuth**, for example Claude.ai, Claude Desktop, Claude Code, Cursor, VS Code with GitHub Copilot, or Codex. Clients that only accept a static API key or a local (stdio) server cannot connect.
- **The owner password.** Every new connection is approved in a browser with this password. If you are not the owner, ask the owner to approve the connection with you.
- **A connected Qasir session.** The owner does this once in a browser (step 1). Every client shares the same session.

### Step 1 (owner, one time): connect the Qasir account

The server reads Qasir through a dashboard session that you give it once. Your PIN is never stored.

1. Open **<https://mcp.manujujaya.com/connect>** and sign in with the owner password.
2. Enter the Qasir **phone number or email** and the **6-digit PIN** of an account that can open the Bengkel Manuju Jaya dashboard.
3. If Qasir asks you to pick an outlet, pick one and enter the PIN again.
4. The page should say **Connected to bengkel-manuju-jaya-621095**.

Skip this step if the page already shows the session as connected. Qasir dashboard sessions expire eventually. When tools start returning `QASIR_AUTH_EXPIRED`, repeat this step. The Qasir account must sign in with phone/email + PIN only; accounts that require an OTP code are not supported. If sign-in cannot capture the session automatically, the page offers a paste fallback, described in [docs/connect-qasir.md](docs/connect-qasir.md).

### Step 2: add the server to your AI client

Pick your client below. In every case the URL is `https://mcp.manujujaya.com/mcp`. You do not need a client ID, client secret or API key, because the client registers itself automatically.

#### Claude.ai and Claude Desktop

1. Open **Settings → Connectors → Add custom connector**.
2. Name: `Manuju Jaya Qasir`. URL: `https://mcp.manujujaya.com/mcp`. Leave the advanced OAuth fields empty.
3. Choose **Add**, then **Connect**. A browser page opens; finish [step 3](#step-3-approve-the-connection).
4. In a chat, open the tools menu and make sure **Manuju Jaya Qasir** is turned on.

A connector added on Claude.ai also appears in Claude Desktop for the same account. Custom connectors are only available on Claude plans that include them. *Not yet tested against this server; see [Troubleshooting](#5-troubleshooting) if the connection fails.*

#### Claude Code (tested with version 2.1.272)

```bash
claude mcp add --transport http manujujaya https://mcp.manujujaya.com/mcp
```

Add `--scope user` to use it in every project, or `--scope project` to share it through the project's `.mcp.json`. Then start Claude Code, run `/mcp`, select **manujujaya** and choose **Authenticate**. A browser opens; finish [step 3](#step-3-approve-the-connection).

#### Cursor

Add this to `~/.cursor/mcp.json` (all projects) or `.cursor/mcp.json` (one project):

```json
{
  "mcpServers": {
    "manujujaya": { "url": "https://mcp.manujujaya.com/mcp" }
  }
}
```

Open **Cursor Settings → MCP**. When the server shows that it needs a login, start the sign-in and finish [step 3](#step-3-approve-the-connection). *Not yet tested against this server.*

#### VS Code (GitHub Copilot)

Add this to `.vscode/mcp.json`. Note that the top-level key is `servers`:

```json
{
  "servers": {
    "manujujaya": { "type": "http", "url": "https://mcp.manujujaya.com/mcp" }
  }
}
```

Start the server from the **Start** link above it in the file, or from the MCP servers view, and accept the sign-in prompt. *Not yet tested against this server.*

#### Codex CLI

```bash
codex mcp add manujujaya --url https://mcp.manujujaya.com/mcp
codex mcp login manujujaya
```

*Not yet tested against this server.*

#### Other clients

Any client that supports **remote Streamable HTTP MCP servers with OAuth** (dynamic client registration or client ID metadata documents, with PKCE) should work. Give it the URL above and let it run the browser sign-in.

### Step 3: approve the connection

The client opens the server's **Authorize MCP client** page in your browser.

1. **Check who is asking.** The page shows the client's self-declared name and where it redirects to. For Claude.ai and Claude Desktop that is `https://claude.ai`; for Claude Code, Cursor, VS Code and other desktop or CLI tools it is usually `http://localhost` or `http://127.0.0.1`. If you did not just start this connection, or the redirect looks wrong, choose **Deny**.
2. **Leave only `qasir:read` ticked.** `qasir:write` is only offered when changes are enabled on the server, and should only be ticked when you need them.
3. **Enter the owner password** and choose **Approve**. If you signed in on this browser in the last 8 hours, the password is not asked again.

The browser returns to your client, which is now connected. The connection stays signed in for up to 180 days; after that, or after removing and re-adding the server, you approve it again.

### Step 4: check that it works

Ask your assistant:

> Using the Manuju Jaya Qasir tools, list which report operations are available.

It should call the `search` tool and answer with operation names such as `reports.summaries.sales`. Then try a live question:

> Show me the first 5 products in Qasir with their prices.

If that returns data, you are done. If it returns `QASIR_AUTH_EXPIRED`, do [step 1](#step-1-owner-one-time-connect-the-qasir-account) again. In Claude Code you can also run `claude mcp list` and look for **manujujaya** marked as connected.

### Removing the server

Remove it in your client (for example Settings → Connectors on Claude.ai, or `claude mcp remove manujujaya` in Claude Code). To cut off a client on the server side as well, see [Revoking a client](docs/architecture/operations.md).

---

## 2. Using the server

### How the assistant uses it

The server does not have one tool per report. It gives the assistant two general tools instead:

1. **`search`** looks through the catalog of available Qasir operations, such as "sales summary" or "list purchases", and their required inputs. It never contacts Qasir.
2. **`execute`** runs a short JavaScript function, written by the assistant, that calls those operations, pages through results and adds them up. Only the final summary comes back into the chat.

You do not write any code. The assistant writes these small scripts itself. They run in a locked-down sandbox with no internet access and no access to your Qasir credentials; see [Security and privacy](#7-security-and-privacy).

### What you can ask

| Area | Example questions |
| --- | --- |
| Sales | "What were total sales, number of transactions and average ticket last week?" · "Compare sales by payment method this month." · "Which employees sold the most in August?" |
| Products | "What are our top 10 products this month?" · "Find all products with 'filter' in the name and their prices." · "Which category sells best?" |
| Orders | "List orders from 1 to 7 September with their totals." · "Show the details of sale 12345." · "Which installment orders are still outstanding?" |
| Stock | "Trace the stock movements for this inventory item." · "Show recent stock adjustments." · "What does stock turnover look like?" |
| Purchasing | "Which purchase orders are still open?" · "What items are on purchase order 1147218?" · "List our suppliers." |
| Customers and staff | "Show the customer survey results." · "Look up customer 67890." · "List staff accounts." |
| Other | "Are there pending payments?" · "How many visits did the online store get last month?" · "Show attendance for last week." |

### Data that is available

45 read operations are exposed, grouped as follows. Ask the assistant to run `search` for the exact inputs.

| Area | Operations |
| --- | --- |
| Reports | Sales, transaction, sales-insight, sales-type, payment-method, installment and discount summaries; sales trend; payment types; order types; category, product, brand, employee, discount and modifier sales; top products; promo insight; ingredient stock summaries; online-store (microsite) visits and trend; attendance |
| Products and stock | Product list and name search; stock histories per item; stock turnover; stock adjustment history; product reminders; ingredients and recipe totals |
| Orders | Order histories (web and installment); single order detail |
| Purchasing | Purchase order list and line items; supplier list |
| People | Customer profile; customer survey and survey settings; staff list |
| Payments | Pending payments and their attributes |

The full list, with the source document for each endpoint and the endpoints that are deliberately left out, is in [docs/architecture/coverage.md](docs/architecture/coverage.md).

### Tips for good answers

- **Give a date range** in plain words or as `YYYY-MM-DD`. Most reports need a start and end date.
- **Give the outlet** if the assistant asks for it. Most reports and order histories require an outlet ID, and the server does not pick one for you. You can find the outlet ID in the Qasir dashboard.
- **Ask for summaries**, not full dumps. Each script can make at most 50 requests of up to 100 rows each, and the answer is capped at about 24,000 characters. For large ranges, ask for totals or top-N lists.
- **Treat results as confidential.** Answers can contain real customer names, phone numbers and sales figures.

### Built-in prompts

Clients that show MCP prompts (for example as slash commands) offer three ready-made workflows:

| Prompt | Inputs | What it does |
| --- | --- | --- |
| `sales_overview` | `start_date`, `end_date`, optional `outlet_ids` | Sales KPIs and notable invoices for a date range |
| `trace_stock_movement` | `inventory_id`, optional `outlet_ids` | Recent movements and running balance for one stock item |
| `review_purchase_orders` | optional `page` | Open purchase orders (`order_processed`) and their items, read-only |

More copy-and-paste prompts are in [docs/install-prompts.md](docs/install-prompts.md).

### Resources

Clients that browse MCP resources can open these read-only documents:

| URI | Content |
| --- | --- |
| `qasir://docs/index` | List of the API documents |
| `qasir://docs/{document}` | One API document, such as `products` or `reports`, with personal data redacted |
| `qasir://openapi` | OpenAPI 3.1 description of every operation |
| `qasir://capabilities` | Tools available to your connection, mutation policy and limits |
| `qasir://coverage` | Which documented endpoints are implemented or excluded, and why |

---

## 3. Tools reference

### `search`: find operations

Input: `{ "code": "<async arrow function>" }`. The function can only call `codemode.spec()`, which returns `catalog` (one entry per operation, with `operationId`, `title`, `safety`, `tags`, `inputKeys` and more), `openapi` and `examples`. There is no network access.

```js
async () => {
  const { catalog } = await codemode.spec();
  return catalog
    .filter((o) => o.tags.includes("reports"))
    .map((o) => ({ id: o.operationId, inputs: o.inputKeys }));
}
```

### `execute`: read live data

Input: `{ "code": "<async arrow function>" }`. The function can also call `codemode.request({ operationId, path, query })`, which returns `{ operationId, status, data }`.

```js
async () => {
  const r = await codemode.request({
    operationId: "reports.summaries.sales",
    query: { start_date: "2026-09-01", end_date: "2026-09-07", outlet_ids: "<outlet id>" },
  });
  return r.data;
}
```

What the server enforces:

- Only registered read operations can be called. The method, URL, headers and cookies cannot be chosen by the script.
- Inputs are checked against each operation's schema before anything is sent to Qasir. Page sizes (`count`, `limit`, `per_page`) must be between 1 and 100.
- `fetch()` and other network access fail inside the sandbox.

| Limit per `search` or `execute` call | Value |
| --- | --- |
| `codemode.request()` calls | 50 |
| Requests running at the same time | 4 (the rest wait) |
| Total data returned to the script | about 5 MB |
| Time for the whole script | 30 seconds |
| Size of the answer sent back to the chat | about 24,000 characters (truncated beyond that) |

### `execute_mutation`: approved changes (off in production)

This tool only appears when the operator sets `ENABLE_MUTATIONS=true` **and** the connection was approved with `qasir:write`. It does not run code. It performs one change at a time, and each change needs the owner's approval in a browser:

1. The assistant calls it with `{ operationId, path, query, body }`. The server stores a pending approval and returns an `approvalUrl` with a preview.
2. The owner opens the link, reviews the operation and its arguments, and chooses **Approve once** or **Reject**.
3. The assistant calls it again with exactly the same arguments plus `approvalId`. The change runs once.

An approval expires after 10 minutes, works only once and only for exactly those arguments. The operations that can change data are `purchases.confirmation`, `purchases.cancel` and `products.inventories.bulk`. See [docs/mcp-tools.md](docs/mcp-tools.md) for details.

### Error codes you may see

| Code | Meaning | What to do |
| --- | --- | --- |
| `QASIR_AUTH_EXPIRED` | The Qasir session is missing or has expired | The owner reconnects at `/connect` ([step 1](#step-1-owner-one-time-connect-the-qasir-account)) |
| `INVALID_INPUT` | Wrong or missing inputs, page size over 100, or an error in the script | Let the assistant correct its inputs; it can check them with `search` |
| `RESULT_LIMIT_EXCEEDED` | Too many requests or too much data in one script | Ask for a smaller date range or a summary |
| `UPSTREAM_TIMEOUT` | The script or a Qasir request took too long | Ask for less data at once |
| `FORBIDDEN` | Qasir refused this data for the connected account, or the connection lacks a scope | Check the Qasir account's permissions |
| `QASIR_RATE_LIMITED` | Qasir is throttling requests | Wait a minute and try again |
| `UPSTREAM_ERROR` | Qasir returned an error or an unexpected page | Try again later; the dashboard API may have changed |
| `MUTATION_DISABLED` | A change was attempted while writes are off | Expected in production |
| `APPROVAL_REQUIRED` | A change needs owner approval | Open the `approvalUrl` and approve |

The full table is in [docs/mcp-tools.md](docs/mcp-tools.md#error-codes).

---

## 4. Keeping it working (owner tasks)

| Task | How |
| --- | --- |
| Reconnect Qasir after `QASIR_AUTH_EXPIRED` | Open `/connect`, sign in with the owner password, then the Qasir phone/email and PIN |
| Check the Qasir session | `/connect/status` while signed in as owner |
| Disconnect Qasir | **Disconnect** on the `/connect` page |
| Sign out of the owner pages on this browser | **Sign out** on the `/connect` page |
| Change the owner password | `wrangler secret put OWNER_PASSWORD`. This signs the owner out of the browser pages. Connected clients keep working until their tokens expire or are revoked |
| Revoke a client's access | See [docs/architecture/operations.md](docs/architecture/operations.md) |
| Allow AI clients older than protocol 2026-07-28 | Set `MCP_LEGACY_MODE` to `stateless` in `wrangler.jsonc` and redeploy |
| Enable approved changes | See [docs/architecture/operations.md](docs/architecture/operations.md) |

Changing `SESSION_ENCRYPTION_KEY` also makes the stored Qasir session unreadable, so reconnect afterwards.

---

## 5. Troubleshooting

| Problem | Likely cause and fix |
| --- | --- |
| The client says the server needs authentication, or keeps asking to sign in | Finish [step 3](#step-3-approve-the-connection) in the browser that opened. If no browser opened, use your client's authenticate or login action |
| The consent page says "Incorrect owner password" | Check the password. After 10 failed attempts from the same network, wait 15 minutes |
| "Session expired — review and approve again" on the consent page | The page was open too long. Start the connection again from the client |
| Every tool call returns `QASIR_AUTH_EXPIRED` | The Qasir session expired. Reconnect at `/connect` ([step 1](#step-1-owner-one-time-connect-the-qasir-account)) |
| `/connect` shows "OTP accounts are not supported" | Use a Qasir account that signs in with phone/email + PIN only |
| The client fails to connect with error `-32022` or "Unsupported protocol version" | The client uses an older MCP protocol. The owner sets `MCP_LEGACY_MODE=stateless` and redeploys |
| Answers are cut off or return `RESULT_LIMIT_EXCEEDED` | Ask for a shorter date range, fewer rows or a summary |
| The tools are missing in a Claude chat | Turn the connector on in the chat's tools menu |

More cases, including logs and `wrangler tail`, are in [docs/architecture/operations.md](docs/architecture/operations.md).

---

## 6. How it works

Qasir has no official public API. This server uses the same endpoints that the Qasir dashboard calls in the browser; they were captured and documented in [`docs/`](docs/).

```
 AI client (Claude, Cursor, ...)                      Owner's browser
        │  OAuth access token                           │  owner cookie + CSRF token
        ▼                                               ▼
┌──────────────────────── Cloudflare Worker: mcp.manujujaya.com ────────────────────────┐
│ OAuth provider: /.well-known/*, /oauth/register, /oauth/token                          │
│   verifies token and audience ─┐              /authorize   consent + owner password    │
│                                ▼              /login /logout                           │
│ /mcp  MCP handler (SDK v2, stateless)         /connect*    Qasir sign-in               │
│   tools: search · execute · [execute_mutation]  /approvals/:id  change approval        │
│   resources · prompts                                                                  │
│        │ assistant's JavaScript                                                        │
│        ▼                                                                               │
│ Sandbox isolate (Worker Loader): no internet, no bindings, no credentials              │
│        │ codemode.request({ operationId, path, query })                                │
│        ▼                                                                               │
│ Host: limits → input validation → dispatcher (fixed hosts, adds Qasir auth headers)    │
│        │                  ▲                                                            │
│        │        Qasir session (Durable Object, AES-GCM encrypted)                      │
│        │        OAuth clients, grants and hashed tokens (KV)                           │
└────────┼───────────────────────────────────────────────────────────────────────────────┘
         ▼
  pos / order / payment .qasir.id  and  bengkel-manuju-jaya-621095.qasir.id
```

- **Protocol:** MCP `2026-07-28` over Streamable HTTP, stateless. Clients discover the server with `server/discover`.
- **Two separate logins:** AI clients sign in to this server with OAuth. This server signs in to Qasir with the dashboard session captured at `/connect`. The two never mix, and Qasir credentials are never sent to the AI client.
- **Stack:** `@modelcontextprotocol/server` 2.0.0, `agents` 0.23.0, `@cloudflare/codemode` 0.5.2, `@cloudflare/workers-oauth-provider` 0.10.3, Wrangler 4.

Module-by-module detail and the compatibility table: [docs/architecture/overview.md](docs/architecture/overview.md).

---

## 7. Security and privacy

- **Only the owner can grant access.** Every connection is approved in a browser with the owner password on a CSRF-protected page. Failed password attempts are limited per network. Access tokens last 1 hour, refresh tokens 180 days, and tokens only work for `https://mcp.manujujaya.com/mcp`.
- **Read-only by default.** `execute` refuses every operation that changes data. The change tool does not exist in production, and even when enabled, the owner approves each change individually.
- **The assistant's code is sandboxed.** It runs in a separate isolate with no internet access, no bindings and strict limits. It can only call registered operations by name.
- **Qasir credentials stay on the server.** The Qasir token, CSRF token and cookies are stored encrypted and never appear in tool results, resources or logs. The PIN is never stored.
- **Fixed destinations.** The server only talks to Qasir's API hosts and the merchant's own dashboard host.
- **Your data goes to your AI provider.** Tool results can include real customer names, phone numbers and sales data, and are processed by whichever AI client and model you connect.

Full security model and residual risks: [docs/architecture/security.md](docs/architecture/security.md).

---

## 8. For developers

### Requirements

- [Bun](https://bun.sh) 1.x
- A Cloudflare account with Workers, Durable Objects, KV and the Worker Loader binding (production uses the **bisa.digital** account)

### Run locally

```bash
bun install
cp .dev.vars.example .dev.vars   # set OWNER_PASSWORD, SESSION_ENCRYPTION_KEY, DEV_PSK
bun run dev                      # http://localhost:8787
bun run e2e                      # OAuth + MCP end-to-end checks against localhost
```

`bun run e2e -- --connect --live` also signs in to Qasir through `/connect` (using `QASIR_E2E_USERNAME` and `QASIR_E2E_PIN` from `.dev.vars`) and makes read-only calls. `DEV_PSK` is a bearer key for local scripts and only works on `localhost`.

### Checks

```bash
bun run check-types        # TypeScript for the Worker and scripts
bun run test               # vitest (use this, not `bun test`)
bun run coverage:validate  # every documented endpoint has a coverage entry
bun run openapi:validate   # generated OpenAPI matches the registry
bun run build              # wrangler deploy --dry-run
```

### Deploy

```bash
bunx wrangler deploy --secrets-file .secrets.production   # first deploy, or when secrets change
bunx wrangler deploy                                      # code-only updates
OWNER_PASSWORD=... bun run e2e -- --base https://mcp.manujujaya.com --live
```

Production secrets are `OWNER_PASSWORD` (at least 16 characters) and `SESSION_ENCRYPTION_KEY` (`openssl rand -base64 32`). The Worker is served only on the custom domain `mcp.manujujaya.com`; `workers.dev` is disabled. Full setup, secret rotation and configuration: [docs/architecture/setup.md](docs/architecture/setup.md).

### Project layout

| Path | Contents |
| --- | --- |
| `src/index.ts` | Worker entry: OAuth provider, `/mcp` handler, browser routes |
| `src/auth/` | Owner password, cookies, CSRF, OAuth consent page |
| `src/mcp/` | Tools, resources, prompts, `execute_mutation` |
| `src/codemode/` | Sandbox runner, limits, error mapping, output formatting |
| `src/dispatcher/`, `src/registry/` | Operation registry, input validation, OpenAPI, coverage, upstream requests |
| `src/connect/`, `src/session/` | Qasir sign-in flow and encrypted session storage |
| `src/approvals/` | Change approvals (Durable Object and approval page) |
| `src/html/` | Parsers for the HTML-only dashboard pages |
| `docs/` | Captured Qasir API documents and project documentation |
| `scripts/` | End-to-end tests, docs bundling and validators |
| `tests/` | Unit, security, protocol and eval tests |

---

## 9. Documentation index

| Topic | Document |
| --- | --- |
| Installing in more clients, copyable prompts | [docs/install-prompts.md](docs/install-prompts.md) |
| Tools, resources, prompts, error codes, changes | [docs/mcp-tools.md](docs/mcp-tools.md) |
| Connecting the Qasir session | [docs/connect-qasir.md](docs/connect-qasir.md) |
| Local development, deploy, OAuth, secrets | [docs/architecture/setup.md](docs/architecture/setup.md) |
| Operations runbook and troubleshooting | [docs/architecture/operations.md](docs/architecture/operations.md) |
| Architecture and compatibility | [docs/architecture/overview.md](docs/architecture/overview.md) |
| Security model | [docs/architecture/security.md](docs/architecture/security.md) |
| API coverage (generated) | [docs/architecture/coverage.md](docs/architecture/coverage.md) |
| Captured Qasir API documents | `docs/products.md`, `docs/reports.md`, `docs/purchases.md` and 10 more |

## License

Private.
