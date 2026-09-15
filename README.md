# manujujaya-mcp

An MCP server for the **Qasir POS dashboard of Bengkel Manuju Jaya**. MCP (Model Context Protocol) is the standard way to plug tools into AI assistants. With this server, assistants such as Claude, Cursor or Codex can look up live Qasir data for you: products, sales reports, orders, stock movements, purchase orders, suppliers, customers and staff. You ask in plain language, and the assistant fetches the numbers.

The server is hosted on Cloudflare Workers, so there is nothing to install on your computer. You add one URL to your AI app and approve the connection once in your browser.

| | |
| --- | --- |
| **Server URL** | `https://mcp.manujujaya.com/mcp` |
| **Sign-in** | A browser page where the owner types the **owner password** (OAuth) |
| **Access** | Read-only. Changes to Qasir data are switched off |
| **Status** | Live. Tested end to end with Claude Code 2.1.272 and the project's E2E script; other apps are not yet tested. [Health check](https://mcp.manujujaya.com/healthz) |

---

## Contents

1. [Installation](#1-installation)
2. [Using the server](#2-using-the-server)
3. [Tools reference](#3-tools-reference)
4. [Maintenance](#4-maintenance)
5. [Troubleshooting](#5-troubleshooting)
6. [How it works](#6-how-it-works)
7. [Security and privacy](#7-security-and-privacy)
8. [For developers](#8-for-developers)
9. [Documentation index](#9-documentation-index)

---

## 1. Installation

### What you need

- **An AI app that can add a connector by URL and sign in through a browser page.** Examples: Claude.ai, Claude Desktop, Claude Code, Cursor, VS Code with GitHub Copilot, or Codex. Apps that can only run a program on your computer, or only accept an API key, cannot connect.
- **The owner password.** This is the password for this server. It is *not* the Qasir PIN and *not* your Claude password. The developer set it when deploying the server, and the owner keeps it. Every new connection is approved with it.
  **Staff:** start the connection on your own computer, then have the owner type the password on the page that opens. Never send the password in a chat or message. Anyone who knows it can approve new connections and change the Qasir connection.
- **A connected Qasir session.** The owner sets this up once (step 1). All connected apps share it.

### Step 1 (owner, one time): connect the Qasir account

The server reads Qasir through a dashboard session that the owner gives it once. **Staff:** this step is for the owner. If the owner has already connected Qasir, go to [step 2](#step-2-add-the-server-to-your-ai-app).

1. Open **<https://mcp.manujujaya.com/connect>** and enter the owner password.
2. Enter the Qasir **phone number or email** and the **6-digit PIN** of an account that can open the Bengkel Manuju Jaya dashboard.
3. If Qasir asks you to pick an outlet, pick it and enter the PIN again.
4. The page shows **Connected to bengkel-manuju-jaya-621095**.

Good to know:

- **Already connected?** While signed in as owner, open <https://mcp.manujujaya.com/connect/status>. If it shows `"connected": true`, skip this step. The `/connect` page itself does not show whether a session is stored.
- **It expires.** Qasir dashboard sessions end after some time. When the assistant reports `QASIR_AUTH_EXPIRED`, the owner repeats this step. Nothing needs to change in the AI apps.
- **PIN-only accounts.** Use a Qasir account that signs in with phone/email and PIN. Accounts that ask for an OTP code are not supported.
- **Your PIN is never stored.** Only the resulting dashboard session is kept, encrypted.
- **If sign-in cannot finish,** the page offers a paste form. It needs browser developer tools, so ask the developer; see [docs/connect-qasir.md](docs/connect-qasir.md#paste-fallback).

### Step 2: add the server to your AI app

Pick your app below. The URL is always `https://mcp.manujujaya.com/mcp`. You do not need a client ID, client secret or API key; the app registers itself automatically.

> **Only Claude Code has been tested so far.** The server accepts only the newest MCP protocol version (`2026-07-28`). If your app fails with error `-32022` or "Unsupported protocol version", it uses an older version; ask the developer to turn on legacy mode (see [Troubleshooting](#5-troubleshooting)).

#### Claude.ai, Claude Desktop and the Claude mobile apps

**Pro, Max and Free plans:**

1. Open **Customize → Connectors**, select **+**, then **Add custom connector**.
2. Name: `Manuju Jaya Qasir`. MCP server URL: `https://mcp.manujujaya.com/mcp`.
   - If the dialog has **Advanced settings**, leave OAuth Client ID and OAuth Client Secret empty.
   - If the dialog has two steps, choose **Sign in now** under **Authentication**, and **Use Claude's published identity** (or **Register automatically**) under **OAuth client**. Do not choose **Use your own OAuth client**.
3. Choose **Add**. If the sign-in page does not open by itself, find **Manuju Jaya Qasir** under **Customize → Connectors** and choose **Connect**. Then finish [step 3](#step-3-approve-the-connection).
4. In a chat, select the **+** button at the lower left, choose **Connectors**, and turn on **Manuju Jaya Qasir**.

**Team and Enterprise plans:** only an Owner of the Claude organization can add the connector: **Organization settings → Connectors → Add → Custom → Web**, enter the URL, then **Add**. Each member then opens **Customize → Connectors**, finds **Manuju Jaya Qasir**, chooses **Connect** and finishes [step 3](#step-3-approve-the-connection).

A connector added on Claude.ai also works in Claude Desktop, Cowork and the Claude mobile apps for the same account. The Free plan allows one custom connector.

Claude connects from Anthropic's cloud (`160.79.104.0/21`), not from your computer. Cloudflare security settings on `manujujaya.com` (Bot Fight Mode, WAF rules) must not block those requests. *Not yet tested against this server.*

#### Claude Code (tested with version 2.1.272)

```bash
claude mcp add --transport http manujujaya https://mcp.manujujaya.com/mcp
```

Without `--scope`, the server is only added for the current project. To use it in every project, run `claude mcp add --transport http --scope user manujujaya https://mcp.manujujaya.com/mcp` instead. To share it with the project through `.mcp.json`, use `--scope project`.

Then start Claude Code, run `/mcp`, select **manujujaya** and choose **Authenticate**, or run `claude mcp login manujujaya` in the terminal. A browser opens; finish [step 3](#step-3-approve-the-connection).

#### Cursor

Add this to `~/.cursor/mcp.json` (all projects) or `.cursor/mcp.json` (one project):

```json
{
  "mcpServers": {
    "manujujaya": { "url": "https://mcp.manujujaya.com/mcp" }
  }
}
```

Open **Customize → MCPs** in Cursor's sidebar, make sure **manujujaya** is turned on, and follow its authentication prompt. Then finish [step 3](#step-3-approve-the-connection). Cursor's sign-in returns to `http://localhost:8787/callback`, so developers should stop `bun run dev` (same port) while signing in. *Not yet tested against this server.*

#### VS Code (GitHub Copilot)

Add this to `.vscode/mcp.json` in your workspace. The top-level key is `servers`:

```json
{
  "servers": {
    "manujujaya": { "type": "http", "url": "https://mcp.manujujaya.com/mcp" }
  }
}
```

To use it in every workspace, run **MCP: Open User Configuration** from the Command Palette and add it there, or run **MCP: Add Server** and choose **Global**. Start the server from the **Start** link above it in the file, or from the MCP servers view, and accept the sign-in prompt. *Not yet tested against this server.*

#### Codex (CLI, IDE extension, ChatGPT desktop)

```bash
codex mcp add manujujaya --url https://mcp.manujujaya.com/mcp
```

Codex detects that the server uses OAuth and opens the browser sign-in right away; finish [step 3](#step-3-approve-the-connection). Run `codex mcp login manujujaya` only if that sign-in did not complete or has expired. The server is saved in `~/.codex/config.toml`, which the Codex IDE extension and the ChatGPT desktop app also read (**Settings → MCP servers**, then **Authenticate** if asked). *Not yet tested against this server.*

#### Other apps

Other apps that support remote MCP servers with browser sign-in should also work. Give them the URL and let them run the sign-in. For example, Devin Desktop (formerly Windsurf) uses `{ "mcpServers": { "manujujaya": { "serverUrl": "https://mcp.manujujaya.com/mcp" } } }` in `~/.codeium/windsurf/mcp_config.json`. Technical requirements are in [docs/install-prompts.md](docs/install-prompts.md#other-clients).

### Step 3: approve the connection

Your app opens the server's **Authorize MCP client** page in the browser.

1. **Check who is asking.** The page shows the app's self-declared name and where it redirects to:
   - Claude.ai, Claude Desktop and mobile: `https://claude.ai`
   - Claude Code, Codex and most command-line tools: `http://localhost` or `http://127.0.0.1`, with a port number
   - Cursor: `http://localhost:8787`
   - VS Code: `http://127.0.0.1:33418` or `https://vscode.dev`

   If you did not just start this connection, or the redirect does not match your app, choose **Deny**.
2. **Leave only `qasir:read` ticked.** Some apps also ask for `qasir:write` or `qasir:admin`. Leave those unticked. Changes are switched off on this server, and those scopes would grant change access if changes were ever turned on.
3. **Enter the owner password** and choose **Approve**. If the owner signed in on this browser in the last 8 hours, the password is not asked again.

The browser returns to your app, which is now connected. The connection stays signed in for up to 180 days. After that, or after you remove and re-add the server, approve it again.

### Step 4: check that it works

Ask your assistant:

> Using the Manuju Jaya Qasir tools, show me the first 5 products with their prices.

The app may ask for permission to use the tool; allow it. Within a few seconds it should answer with 5 real product names and prices from Qasir. If it does, you are done.

- **`QASIR_AUTH_EXPIRED`:** the owner does [step 1](#step-1-owner-one-time-connect-the-qasir-account) again.
- **The assistant says it has no such tools:** in Claude.ai, turn the connector on with **+ → Connectors**. In Claude Code, run `claude mcp list` and check that **manujujaya** is connected.
- **To see what is available without contacting Qasir,** ask: "List which report operations are available."

### Removing the server

Remove it in your app, for example **Customize → Connectors** on Claude.ai or `claude mcp remove manujujaya` in Claude Code. Removing it in the app does not revoke the sign-in on the server; the developer can do that ([Revoking OAuth clients and tokens](docs/architecture/operations.md#revoking-oauth-clients-and-tokens)).

---

## 2. Using the server

### How the assistant uses it

The server does not have one tool per report. It gives the assistant two general tools instead:

1. **`search`** looks through the catalog of Qasir operations (such as "sales summary" or "list purchases") and their required inputs. It never contacts Qasir.
2. **`execute`** runs a short JavaScript function, written by the assistant, that calls those operations, pages through results and adds them up. Only the final summary comes back into the chat.

You do not write any code. The assistant writes these small scripts itself, and they run in a locked-down sandbox with no internet access and no access to the Qasir credentials. See [Security and privacy](#7-security-and-privacy).

### What you can ask

**Sales**
- "What were total sales, number of transactions and average ticket last week for outlet 645203?"
- "Compare sales by payment method this month."
- "Which employees sold the most in August?"

**Products**
- "What were our top 10 products this month?"
- "Find products with 'filter' in the name."
- "Which product category sells best?"

**Orders**
- "List orders from 1 to 7 September with their totals."
- "Show the details of sale 12345."
- "Show installment (credit) sales for last month."

**Stock**
- "Show this month's stock movements for inventory item 25950360." (The item ID is a product variant ID, which the assistant can read from the product list.)
- "Show recent stock adjustments."
- "Which items have stock on hand but have not sold for a long time?"

**Purchasing**
- "Which purchase orders are still open?"
- "What items are on purchase order 1147218?"
- "List our suppliers."

**Customers and staff**
- "Show the customer survey results."
- "Look up customer 67890."
- "List staff accounts."

**Other**
- "Are there pending payments?"
- "How many visits did the online store (microsite) get last month?"
- "Show staff attendance for last week."

### Data that is available

42 read operations are available, grouped below. Three more operations that change data exist but are switched off. Ask the assistant to run `search` for the exact inputs of any operation.

| Area | Operations |
| --- | --- |
| Reports | Sales, transaction, sales-insight, sales-type, payment-method, installment and discount summaries; sales trend; payment types; order types; category, product, brand, employee, discount and modifier sales; top products; promo insight; ingredient stock summaries; online-store (microsite) visits and trend; attendance |
| Products and stock | Product list and name search; stock histories per item; on-hand stock per variant with last sale and adjustment dates; stock adjustment history; product reminders; ingredients and recipe totals |
| Orders | Order histories (web and installment); single order detail |
| Purchasing | Purchase order list and line items; supplier list |
| People | Customer profile; customer survey and survey settings; staff list |
| Payments | Pending payments and their attributes |

The full list, with the source document for each endpoint and the endpoints that are deliberately left out, is in [docs/architecture/coverage.md](docs/architecture/coverage.md).

### Tips for good answers

- **Give a date range**, in plain words or as `YYYY-MM-DD`. Most reports need a start and end date.
- **Give the outlet ID.** Most reports, order histories and stock histories need one, and the server does not fill it in. The configured Bengkel Manuju Jaya outlet is `645203` (`DEFAULT_OUTLET_ID` in `wrangler.jsonc`), so add "for outlet 645203" to your question. The owner can confirm the connected outlet at <https://mcp.manujujaya.com/connect/status> (`outletId`).
- **Ask for summaries, not full dumps.** Each script can make at most 50 requests of up to 100 rows each, and the answer is capped at about 24,000 characters. For long periods, ask for totals or top-N lists.
- **Treat answers as confidential.** They can contain real customer names, phone numbers and sales figures.

### Interactive views

In apps that support MCP Apps (interactive widgets inside the chat), the assistant can open six live views in Bahasa Indonesia instead of writing a script. In other apps the same tools answer with a short text summary.

| View | Tool | What it shows |
| --- | --- | --- |
| Penjualan | `show_sales_dashboard` | Sales, gross profit, transactions and average ticket against the previous period, a daily chart, payment methods, top categories and products |
| Produk | `show_product_ranking` | Best- and least-selling products by quantity or by revenue |
| Stok | `show_stock_browser` | Stock per variant, days since the last sale and the last stock adjustment, movement history, estimated days until stock runs out |
| Pembelian | `show_purchase_orders` | Purchase orders by status, with their items |
| Transaksi | `show_transactions` | Transactions per day for today, this week, this month, the last 30 days or any range; filters by payment method, status and customer; receipt details |
| Piutang | `show_customer_debts` | Open credit per customer, aged from 0–7 days to over 2 years, with invoices and payments, and a button that asks Claude to draft a payment reminder |

Try "Tampilkan transaksi hari ini", "Buka dashboard penjualan minggu ini" or "Tampilkan piutang pelanggan".
- The views only read data, and they fill in the connected outlet themselves.
- Like any other answer, they can show customer names and phone numbers.
- The owner can turn them off with `ENABLE_WIDGETS=false`; see [docs/mcp-tools.md § Widgets](docs/mcp-tools.md#widgets-mcp-apps).

### Built-in prompts

Apps that show MCP prompts (for example as slash commands) offer three ready-made workflows:

| Prompt | Inputs | What it does |
| --- | --- | --- |
| `sales_overview` | `start_date`, `end_date`, optional `outlet_ids` | Sales KPIs and notable invoices for a date range |
| `trace_stock_movement` | `inventory_id`, optional `outlet_ids` | Recent movements and running balance for one stock item |
| `review_purchase_orders` | optional `page` | Open purchase orders (`order_processed`) and their items, read-only |

The prompts ask for the outlet when you leave `outlet_ids` out. More copy-and-paste prompts are in [docs/install-prompts.md](docs/install-prompts.md#copyable-prompts).

### Resources

Apps that browse MCP resources can open these read-only documents:

| URI | Content |
| --- | --- |
| `qasir://docs/index` | List of the captured API documents |
| `qasir://docs/{document}` | One API document, such as `products` or `reports`, with personal data redacted |
| `qasir://openapi` | OpenAPI 3.1 description of every operation |
| `qasir://capabilities` | Tools available to your connection, change policy and limits |
| `qasir://coverage` | Which documented endpoints are implemented or excluded, and why |

---

## 3. Tools reference

### `search`: find operations

Input: `{ "code": "<async arrow function>" }`. The function can only call `codemode.spec()`. It returns `catalog` (one entry per operation, with `operationId`, `title`, `safety`, `tags`, `inputKeys` and more), `openapi` (full input schemas) and `examples`. There is no network access.

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
    query: { start_date: "2026-09-01", end_date: "2026-09-07", outlet_ids: "645203" },
  });
  return r.data;
}
```

The server enforces these rules:

- Scripts can only call registered read operations. The method, URL, headers and cookies are fixed by the operation and cannot be chosen.
- Inputs are checked against each operation's schema before anything is sent to Qasir. Page sizes (`count`, `limit`, `per_page`) must be between 1 and 100.
- `fetch()` and all other network access fail inside the sandbox.

| Limit per `search` or `execute` call | Value |
| --- | --- |
| `codemode.request()` calls | 50 |
| Requests running at the same time | 4 (the rest wait) |
| Total data returned to the script | about 5 MB |
| One Qasir response | 2 MB and 25 seconds |
| Time for the whole script | 30 seconds |
| `codemode.spec()` calls | 20 |
| Value returned by the script | 1,000,000 characters of JSON (larger fails with `RESULT_LIMIT_EXCEEDED`) |
| Answer sent back to the chat | about 24,000 characters (truncated beyond that) |

### `execute_mutation`: approved changes (switched off)

This tool only appears when the developer sets `ENABLE_MUTATIONS=true` **and** the connection was approved with `qasir:write` (or `qasir:admin`). It does not run code. It performs one change at a time, and the owner approves each change in a browser:

1. The assistant calls it with `{ operationId, path, query, body }`. The server stores a pending approval and returns an `approvalUrl` with a preview.
2. The owner opens the link, reviews the operation and its arguments, and chooses **Approve once** or **Reject**.
3. The assistant calls it again with exactly the same arguments plus `approvalId`. The change runs once.

An approval expires after 10 minutes and works only once, only for exactly those arguments. The operations that change data are `purchases.confirmation`, `purchases.cancel` and `products.inventories.bulk`. Details: [docs/mcp-tools.md](docs/mcp-tools.md).

### Error codes

| Code | Meaning | What to do |
| --- | --- | --- |
| `QASIR_AUTH_EXPIRED` | The Qasir session is missing or has expired | The owner reconnects ([step 1](#step-1-owner-one-time-connect-the-qasir-account)) |
| `INVALID_INPUT` | Wrong or missing inputs, page size over 100, or an error in the script | Let the assistant correct its inputs; it can check them with `search` |
| `UNSUPPORTED_OPERATION` | The assistant used an operation name that does not exist | Let the assistant look up the correct name with `search` |
| `RESULT_LIMIT_EXCEEDED` | Too many requests or too much data in one script | Ask for a shorter period or a summary |
| `UPSTREAM_TIMEOUT` | The script or a Qasir request took too long | Ask for less data at once |
| `FORBIDDEN` | Qasir refused this data for the connected account, or the connection lacks a scope | Check the Qasir account's permissions |
| `QASIR_RATE_LIMITED` | Qasir is throttling requests | Wait a minute and try again |
| `UPSTREAM_ERROR` | Qasir returned an error or an unexpected page | Try again later; the dashboard API may have changed |
| `MUTATION_DISABLED` | A change operation was called through `execute` (which is read-only), or changes are off | Expected; changes only go through `execute_mutation` when enabled |
| `APPROVAL_REQUIRED` | A change needs owner approval | Open the `approvalUrl` and approve |

The complete table, including rare codes, is in [docs/mcp-tools.md](docs/mcp-tools.md#error-codes).

---

## 4. Maintenance

### Owner tasks (in a browser)

| Task | How |
| --- | --- |
| Reconnect Qasir after `QASIR_AUTH_EXPIRED` | Open <https://mcp.manujujaya.com/connect>, enter the owner password, then the Qasir phone/email and PIN |
| Check the Qasir session | Open <https://mcp.manujujaya.com/connect/status> after signing in on `/connect` |
| Stop all access to Qasir at once | Choose **Disconnect** on the `/connect` page |
| Sign out of the owner pages on this browser | Choose **Sign out** on the `/connect` page |
| Approve or reject a requested change | Open the `approvalUrl` the assistant shows (only when changes are enabled) |

### Developer tasks (need Cloudflare access)

| Task | How |
| --- | --- |
| Change the owner password | `bunx wrangler secret put OWNER_PASSWORD` (at least 16 characters; takes effect immediately). This signs the owner out of the browser pages. Connected apps keep working until they are revoked |
| Revoke one app's access | [operations.md § Revoking OAuth clients and tokens](docs/architecture/operations.md#revoking-oauth-clients-and-tokens) |
| Allow apps that use an older MCP protocol | Set `MCP_LEGACY_MODE` to `stateless` in `wrangler.jsonc` and redeploy ([details](docs/architecture/operations.md#legacy-2025-era-clients-error-32022)) |
| Enable approved changes | [operations.md § Enabling mutations](docs/architecture/operations.md#enabling-mutations) |
| Rotate `SESSION_ENCRYPTION_KEY` | This also makes the stored Qasir session unreadable, so the owner reconnects afterwards ([details](docs/architecture/operations.md#rotating-secrets)) |

---

## 5. Troubleshooting

| Problem | Likely cause and fix |
| --- | --- |
| The app says the server needs authentication, or keeps asking to sign in | Finish [step 3](#step-3-approve-the-connection) in the browser page that opened. If none opened, use the app's authenticate or login action |
| "Incorrect owner password" or "Too many failed attempts from this network" | Check the password. Ten failed attempts from one network block further tries until 15 minutes after the first failure |
| "Session expired — review and approve again" on the consent page | The browser did not send the page's security cookie: cookies are blocked for `mcp.manujujaya.com`, or the page was open for more than 8 hours. Allow cookies for the site and choose **Approve** again, or restart the connection from the app |
| Every tool call returns `QASIR_AUTH_EXPIRED` | The Qasir session expired. The owner reconnects ([step 1](#step-1-owner-one-time-connect-the-qasir-account)) |
| `/connect` says "OTP accounts are not supported" | Use a Qasir account that signs in with phone/email and PIN only |
| The app fails with error `-32022` or "Unsupported protocol version" | The app uses an older MCP protocol. The developer sets `MCP_LEGACY_MODE=stateless` and redeploys |
| Claude.ai fails to connect, but Claude Code works | Cloudflare security settings may be blocking Anthropic's servers (`160.79.104.0/21`). Check Bot Fight Mode and WAF events for `mcp.manujujaya.com` |
| Answers are cut off, or `RESULT_LIMIT_EXCEEDED` | Ask for a shorter period, fewer rows or a summary |
| The tools are missing in a Claude chat | In the chat, select **+ → Connectors** and turn on **Manuju Jaya Qasir** |
| The assistant keeps asking for an outlet | Add "for outlet 645203" to the question |

More cases, including logs and `wrangler tail`, are in [docs/architecture/operations.md](docs/architecture/operations.md#troubleshooting).

---

## 6. How it works

Qasir has no official public API. This server uses the same endpoints that the Qasir dashboard calls in the browser; they were captured and documented in [`docs/`](docs/).

```
 AI app (Claude, Cursor, ...)                         Owner's browser
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
  pos / order / payment / www .qasir.id  and  bengkel-manuju-jaya-621095.qasir.id
```

- **Protocol:** MCP `2026-07-28` over Streamable HTTP, stateless. Apps discover the server with `server/discover`.
- **Two separate logins.** AI apps sign in to this server with OAuth. This server signs in to Qasir with the dashboard session captured at `/connect`. The two never mix, and Qasir credentials are never sent to the AI app.
- **Stack:** `@modelcontextprotocol/server` 2.0.0, `agents` 0.23.0, `@cloudflare/codemode` 0.5.2, `@cloudflare/workers-oauth-provider` 0.10.3, Wrangler 4.

Module-by-module detail and the compatibility table: [docs/architecture/overview.md](docs/architecture/overview.md).

---

## 7. Security and privacy

- **Only the owner can grant access.** Every connection is approved in a browser on a CSRF-protected page, with the owner password or an owner sign-in from the last 8 hours. Failed password attempts are limited per network. Access tokens last 1 hour and refresh tokens 180 days, and tokens only work for `https://mcp.manujujaya.com/mcp`.
- **Read-only by default.** `execute` refuses every operation that changes data. The change tool is not available in production, and even when enabled, the owner approves each change individually.
- **The assistant's code is sandboxed.** It runs in a separate isolate with no internet access, no bindings and strict limits. It can only call registered operations by name.
- **Qasir credentials stay on the server.** The Qasir token, CSRF token and cookies are stored encrypted and never appear in tool results, resources or logs. The PIN is never stored.
- **Fixed destinations.** Qasir requests go only to Qasir's hosts (`pos`, `order` and `payment` for data, `www` for the `/connect` sign-in) and the merchant's own dashboard host. The only other outbound request is the OAuth provider fetching a connecting app's public metadata document.
- **Your data goes to your AI provider.** Tool results can include real customer names, phone numbers and sales data, and are processed by whichever AI app and model you connect.

Full security model and residual risks: [docs/architecture/security.md](docs/architecture/security.md).

---

## 8. For developers

### Requirements

- [Bun](https://bun.sh) 1.4 or later, and Node.js 20 or later (Wrangler, Vitest and `tsc` are Node CLIs)
- A Cloudflare account with Workers, Durable Objects, KV and the Worker Loader binding. Production runs on the **bisa.digital** account

### Run locally

```bash
bun install
cp .dev.vars.example .dev.vars   # set OWNER_PASSWORD, SESSION_ENCRYPTION_KEY, DEV_PSK
bun run dev                      # http://localhost:8787; leave it running
# in a second terminal:
bun run e2e                      # OAuth + MCP end-to-end checks against localhost
```

`bun run e2e -- --connect --live` also signs in to Qasir through `/connect` (using `QASIR_E2E_USERNAME` and `QASIR_E2E_PIN` from `.dev.vars`) and makes read-only calls. `DEV_PSK` (at least 16 characters, with `ALLOW_DEV_PSK=true`) is a bearer key for local scripts. It only works on `localhost`, `127.0.0.1` or `[::1]`; see [setup.md § Dev PSK](docs/architecture/setup.md#dev-psk-local-only).

### Checks

```bash
bun run check-types        # TypeScript for the Worker and scripts
bun run test               # vitest (use this, not `bun test`)
bun run coverage:validate  # every documented endpoint has a coverage entry
bun run openapi:validate   # generated OpenAPI matches the registry
bun run build              # wrangler deploy --dry-run --outdir=dist (uploads nothing)
```

After editing a captured API document in `docs/` or an operation in `src/registry/ops/`, run `bun run docs:bundle && bun run coverage:report` before the checks. The tests fail if the bundled docs drift. Full procedure: [operations.md § Changing the upstream catalog](docs/architecture/operations.md#changing-the-upstream-catalog).

### Deploy

```bash
bun run check-types && bun run test && bun run coverage:validate && bun run openapi:validate && bun run build
bunx wrangler deploy                                      # code or wrangler.jsonc changes
# when secrets change: bunx wrangler deploy --secrets-file .secrets.production, then delete the file
curl -s https://mcp.manujujaya.com/healthz                # expect "ok":true and "mutations":false
read -rs OWNER_PASSWORD && export OWNER_PASSWORD          # keeps the password out of shell history
bun run e2e -- --base https://mcp.manujujaya.com --live   # each run adds one OAuth client and grant
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
| `src/errors/`, `src/observability/` | Error codes, structured logging and redaction |
| `src/web/`, `src/docs/` | Shared HTML page layout and the bundled API documents |
| `docs/` | Captured Qasir API documents and project documentation |
| `scripts/` | End-to-end tests, docs bundling and validators |
| `tests/` | Unit, security, protocol and eval tests |

---

## 9. Documentation index

| Topic | Document |
| --- | --- |
| Installing in more apps, copyable prompts | [docs/install-prompts.md](docs/install-prompts.md) |
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
