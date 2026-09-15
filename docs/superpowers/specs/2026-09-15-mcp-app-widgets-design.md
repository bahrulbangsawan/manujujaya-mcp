# MCP App widgets (TanStack) — design

Date: 2026-09-15 · Status: approved for implementation · Branch: `feat/mcp-app-widgets`

## 1. Goal

Add interactive **MCP Apps** widgets (extension `io.modelcontextprotocol/ui`, `@modelcontextprotocol/ext-apps` 2.0.0) to `manujujaya-mcp`, so Claude/ChatGPT render live Qasir views inline in the chat. The UI is in **Bahasa Indonesia** and built with React 19 + the TanStack client libraries (Router, Query, Table, Virtual, Form, Pacer), inlined into one HTML file served by the existing Cloudflare Worker.

The owner's questions (`q.md`) the views must answer:

| # | Question | Answered by |
|---|---|---|
| 1 | Best- and least-selling products, per day / week / month | `produk` view: ranking by quantity or gross, both directions, with period presets |
| 2 | Products that sell out fastest; time since last opname | `stok` view: days since last sale, days since last adjustment, 30-day sales velocity and days of cover per variant |
| 3 | Transactions today, this week, this month, last 30 days | `transaksi` view with presets |
| 4 | Daily, weekly and monthly reports (today's transactions, products sold today, debts) | `penjualan` dashboard with presets, links to `produk`, `transaksi`, `piutang` |
| 5 | Debts with each person's transactions, aged by 7 days, 30 days, 3 months, 6 months, 1 year, over 2 years | `piutang` view: aging buckets, per-customer invoices and payments, link to their transactions |

Non-goals: writes/mutations, a standalone web dashboard (TanStack Start), never-sold dead-stock scans across the full catalog (upstream sort on `stockTurnover` is ineffective and a full scan is 138 pages × ~15 s), customer lists beyond customers with open credit (no upstream list endpoint).

## 2. Verified facts this design relies on

All verified on 2026-09-15 against the installed packages and live data (outlet 645203), recorded in the research workflow.

**Stack**
- The ext-apps `/server` helpers (561 B, no imports) work with `@modelcontextprotocol/server` 2.0.0 under TS 7. `registerAppTool` only mirrors `_meta.ui.resourceUri` to the legacy `_meta["ui/resourceUri"]` key; `registerAppResource` only defaults `mimeType` to `text/html;profile=mcp-app`.
- SDK v2 emits tool `_meta` in `tools/list`, passes `structuredContent` + `_meta` through `tools/call`, validates `structuredContent` against `outputSchema` (a mismatch becomes an `isError` result), and adds no text fallback for object `structuredContent`.
- A thrown handler error reaches the client as raw `err.message`. Input-schema failures come back as `isError` text `Input validation error: ...`.
- The server never filters `visibility: ["app"]` tools; any token holder can call them.
- In stateless 2026-07-28 mode, client capabilities arrive per request, after the server factory runs. Tool registration therefore cannot depend on UI support: always register, always return meaningful text.
- A `ui://` URI must satisfy `new URL(uri).href === uri`. Resources have no size limit; `resources/read` defaults to `ttlMs: 0`.
- The agents Origin check rejects requests carrying a non-allow-listed `Origin` (not set today; production clients evidently send none).

**Widget runtime**
- Vite 8 + `vite-plugin-singlefile` + React 19 + TanStack + Tailwind 4 + ext-apps `App` builds one HTML of ~700 KB raw / ~200 KB gzip. It renders, routes and pages inside `<iframe sandbox="allow-scripts">`.
- In that sandbox `localStorage`, `sessionStorage` and cookies throw; the libraries tolerate it.
- **`<form>` submission, including Enter in an input, is blocked without `allow-forms`.** Use `type="button"` plus explicit key handlers; render no `<form>` elements.
- Router needs `createMemoryHistory`. Zod 4 search schemas use `.default(x).catch(x)` so links stay optional.
- Query defaults would re-call tools whenever the chat tab regains focus; override them.
- TanStack Table is v9: `useTable({ features: tableFeatures({...}) })`, not v8's `useReactTable`.
- Calls made before the host handshake completes can leave the iframe hidden; `useApp` sets `app` only after `connect()` resolves.
- `data:` fonts are blocked by the default host CSP. Use system fonts or host fonts.

**Qasir data**
- `reports.summaries.transaction`: `summary_sales {sales, total_gross_sales, total_profit, total_transaction, total_quantity, discount, tax, sales_trend {comparison_date "MM/DD/YYYY - MM/DD/YYYY", gross|profit|transaction|quantity {value "2,41%", status "up"|"down"}}}`. Empty strings when there is no data.
- `reports.sales.trend`: `data_trends[] {date, amount, comparison_date, comparison_amount, percentage_change, status}` plus `current_period`/`comparison_period {date, total_amount}`. A multi-day range needs an equal-length comparison range or upstream returns 400.
- `reports.summaries.paymentMethods`: `payment_method[] {id, name, quantity, amount}`.
- `reports.categories`: `report_categories[] {id, name, quantity, total_gross, total_collected, total_tax, unit_label}` plus pagination.
- `reports.products`: `report_products[] {id, name, category_name, sku, quantity (may be fractional), total_gross, total_collected, unit_label, type}`.
  - `sort` accepts `-quantity`, `quantity`, `-total_gross`, `total_gross`.
  - Page 1 prepends a pseudo row `id 0` / `category_name "Transaksi Manual"` (count+1 rows); exclude it from rankings.
  - `total_result` overstates (the last page can be empty).
  - Ascending order includes 0-quantity (refunded) rows.
- `reports.summaries.installment`: `{total_customer, total_down_payment, total_receivable}` for a sale-date range.
  - `total_receivable` ≈ Σ `remaining_debt` (it can exceed by loyalty-point redemptions, a few thousand IDR).
  - Rows near range edges can shift between neighbouring ranges.
- `order.histories.installment` holds **only open credit sales** (status 4); paid-off sales leave it.
  - Groups `sales[] {date "YYYY-MM-DD HH:MM:SS", total_amount (per-day total), items[1] {sales_id, customer_id, customer_name, due_date "DD <Bulan> YYYY" | "", amount (= total_installment), date_time (= due_date), time "HH:MM", invoice_number, outlet_name, status_order}}`.
  - Each page returns count+1 rows; `total_result`/`total_page` are lower bounds; follow `pagination.next` until absent.
  - Open credit exists back to 2015: use `start_date` 2015-01-01.
- `order.histories.legacy` (per sale): `installment {period, unit, date, total_installment, remaining_debt}`, `total_paid` (= Σ `payments[].amount`), `payments[] {payment_mode, payment_name, amount, paid_date "YYYY-MM-DD HH:MM:SS"}`, `customer {id, name, mobile}`, `carts[]`, `total_bill` (decimal string), `settled_at`, `status`. `remaining_debt` and `is_installment_completed` are meaningful only when `status === 4`.
- `order.histories.web`: `sales[] {date, daily_amount, items[] {sales_id, status, date_time "HH:MM", invoice_number, outlet_name, settle_by (staff name), payment_mode, amount, sales_type_name}}` plus pagination.
  - Status 2 = selesai, 3 = refund, 6 = refund sebagian (amount can be 0).
  - `data.agg` does not reconcile with rows; do not display it.
  - `customer_id` filter works. Open credit sales are excluded.
- `inventories.stockTurnover`: `variants[] {id (number = inventory_id), product_name "P - V", stock, price_sell, latest_sales_date (ISO or ""), latest_adjustment_date, latest_sales_till_now (string days), latest_adjustment_till_now}`.
  - ~15 s without `search`, ~1 s with.
  - `search` matches names, not SKUs. A no-match search returns upstream 404, which becomes `UPSTREAM_ERROR "Upstream 404"`: map it to empty.
  - `sort` values are accepted but do not reorder.
- `inventories.stockHistories` (`inventory_id` integer, `type` CSV of 6 types): `stock_histories[] {id, opname (balance after), quantity (signed), notes, type, created_date "2026-09-07 01:02:14.608837 +0000 +0000", created_by {name}, sales_id}`, `data.stock`, `data.product_name "P-V"`.
- `purchases.list`: `purchases[] {id, order_no, supplier_name, total_price, status completed|order_processed|canceled, created_at}`; no status filter (INVALID_INPUT). `purchases.items {purchase_id, outlet_id (int)}` returns `purchase_items[] {product_name, variant_name, quantity, receive_quantity, price_unit, unit_label_name}`.
- `customers.get`: `customer {id, fullname, mobile, ...}`.

## 3. Architecture

### 3.1 Layout

```
widgets/                              Vite project; deps in root devDependencies; own tsconfig (DOM, react-jsx)
  index.html                          <div id="root" data-view="__MJ_VIEW__">
  vite.config.ts                      react() + tailwindcss() + viteSingleFile(); modulePreload polyfill off
  tsconfig.json
  src/main.tsx                        mount; no StrictMode in production build
  src/app/AppShell.tsx                useApp + host styles + QueryClientProvider + RouterProvider
  src/app/router.tsx                  code-based routes, createMemoryHistory({ initialEntries: [initialPath] })
  src/app/queryClient.ts              retry policy, staleTime 60 s, no focus/reconnect refetch, networkMode 'always'
  src/bridge/bridge.ts                Bridge interface: callTool(name, args, signal) → structuredContent | ToolError
  src/bridge/extAppsBridge.ts         ext-apps App implementation (waits for connect; maps isError)
  src/bridge/mockBridge.ts            dev-only fixture bridge (widgets:dev)
  src/bridge/initialResult.ts         seeds Query cache from ontoolinput/ontoolresult
  src/routes/{penjualan,produk,stok,pembelian,transaksi,piutang}.tsx
  src/components/                     ViewHeader, PresetRangePicker, KpiTile, TrendChart (SVG), BarList,
                                      DataTable (Table v9 + Virtual), InfiniteFooter, Sheet, StatusBadge,
                                      ErrorPanel, EmptyState, Skeleton
  src/lib/{format,dates,errors,labels}.ts
  src/styles.css                      @import "tailwindcss" source("./"); host CSS variable fallbacks; dark
  test/                               vitest (happy-dom) unit tests for lib/ and components
src/widgets/
  contract.ts                         DOM-free zod schemas + inferred types for every tool's input and structuredContent
  bundled.ts                          GENERATED + committed: WIDGET_HTML, WIDGET_SOURCE_HASH
  resources.ts                        registers six ui:// resources
  tools/                              view tools + app-only tools (one file per view) + shared helpers
  budget.ts                           generic per-call request budget (extracted core of ExecutionBudget)
  qasir-dates.ts                      Jakarta "today", ISO ⇄ "DD Bulan YYYY", comparison ranges, aging buckets
  outlet.ts                           resolve outlet_id (input → stored session outlet → DEFAULT_OUTLET_ID)
scripts/bundle-widgets.ts             vite build → src/widgets/bundled.ts (header "Generated by …; do not edit")
scripts/widgets-smoke.ts              headless Chrome: each view inside sandbox="allow-scripts" + AppBridge fixture host
```

### 3.2 Serving

- `WIDGET_HTML` is one string. `resources.ts` registers `ui://manujujaya/<view>.html` for the six views, replacing `__MJ_VIEW__` with the view name at read time.
- Each resource sets `mimeType` `text/html;profile=mcp-app`, `_meta.ui.prefersBorder: true`, no CSP domains (everything is inline; data goes through `callServerTool`), and a cache hint of 10 minutes (the HTML holds no data).
- **Versioning.** URIs stay stable across deploys; the HTML carries `<meta name="mj-build" content="<source hash>">` for debugging. Because a host may keep the previous HTML for up to the cache TTL, contract changes must be additive (new optional fields), and the widget ignores unknown fields.
- `bundled.ts` is committed so `tsc`, `vitest` and `wrangler` work on a clean checkout. `tests/unit/widgets-bundle.test.ts` recomputes the source hash (`widgets/src/**`, `widgets/index.html`, `widgets/vite.config.ts`, `src/widgets/contract.ts`, `bun.lock`) and fails with "run bun run widgets:bundle" on drift. It also checks the HTML:
  - no external `src=`/`href=`/`url(http`
  - the marker is present
  - under 1 MB
  - no token-like strings

### 3.3 Widget runtime

- **Startup.** `main.tsx` reads `data-view` and maps it to the initial route. `AppShell` creates the App through `useApp({ appInfo: {name: "manujujaya", version}, capabilities: { availableDisplayModes: ["inline", "fullscreen"] } })`. Until `app` is set the shell shows a skeleton; no query runs (`enabled: bridge.ready`).
- **Initial data.** `ontoolinput` stores the view tool's arguments. `ontoolresult` validates `structuredContent` with the contract and seeds `queryClient.setQueryData([toolName, args], data)`, so the first render needs no extra call. Changing filters calls the same view tool again through `callServerTool` (view tools default to `visibility ["model","app"]`).
- **Navigation.** A compact view switcher (Penjualan · Produk · Stok · Pembelian · Transaksi · Piutang) plus cross-links:
  - chart day → transaksi for that day
  - top product → stok search
  - customer → transaksi with `customer_id`
  - piutang tile on the dashboard → piutang

  Switching views navigates in memory; the target route fetches with default filters.
- **Query policy.**
  - Tunables: `retry` 1 (never for `QASIR_AUTH_EXPIRED`, `FORBIDDEN`, `INVALID_INPUT`, `QASIR_RATE_LIMITED`), `staleTime` 60 s, `gcTime` 10 min, `refetchOnWindowFocus`/`refetchOnReconnect` false, `networkMode: "always"`.
  - The query `signal` is passed into `callServerTool(..., { signal, timeout: 45_000 })`.
- **Host integration.**
  - `useHostStyles` for variables, theme and fonts; Tailwind tokens read `--color-*` host variables with `light-dark()` fallbacks; `color-scheme` follows the theme.
  - Honors `safeAreaInsets`.
  - `openLink` for the reconnect URL; no `<a target>`.
  - `requestDisplayMode("fullscreen")` button only when the host lists it.
  - `updateModelContext` with the current view + filters (no personal data) when the host supports it.
  - `sendMessage` buttons (see §5) only when `hostCapabilities.message` is present.
- **Forms.** TanStack Form for the date-range and search fields, rendered without `<form>`: apply via `type="button"` and an Enter `onKeyDown`. Pacer `useDebouncedValue(search, { wait: 400 })` for the stock and customer search.
- **Formatting.**
  - Money: `Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 })`.
  - Dates: `id-ID`, Asia/Jakarta.
  - Quantities: up to 2 decimals.

## 4. Tools and data flow (server)

### 4.1 Rules for every new tool

- Try/catch around the whole handler: `requireScope(principal, qasir:read)`, then `errorResult(err)` and `log("warn", "tool.<name>.error", { code })` on failure. Never log arguments or results. For `QASIR_AUTH_EXPIRED` only, the JSON error body also carries `connect_url` (`${PUBLIC_BASE_URL}/connect`) so the widget can offer the reconnect link.
- Inputs are zod-bounded:
  - dates `YYYY-MM-DD` with `start ≤ end` and a range ≤ 366 days
  - positive integer ids
  - `page` 1–500
  - `search` 1–100 chars
  - enums for order and status
- The `operationId` is hard-coded per tool. Dispatch goes through the per-request `dispatcher` from `createManujujayaServer` (injectable in tests) and never sets `allowMutation`.
- A per-call `RequestBudget`: `maxRequests` per tool (listed below), concurrency 4, 30 s deadline (the dispatcher's own 25 s per-request limit still applies).
- Result = one Indonesian `text` block (≤ 2,000 chars, meaningful on hosts without widgets) + `structuredContent` that matches `contract.ts`.
  - Every structured payload carries `view`, `outlet_id`, `generated_at` (ISO), `truncated: boolean` (plus `truncated_reason`).
  - Hard cap: serialized `structuredContent` ≤ 250 KB. Rows are trimmed from the tail with `truncated` set.
- `outputSchema` is not declared (hosts may validate strictly; SDK accepts extra keys). The contract is enforced by server unit tests and parsed in the widget.
- **Outlet.** `outlet_id` is optional; resolution order is input → stored session `outletId` → `env.DEFAULT_OUTLET_ID`. Documented in `overview.md` (replacing the "not injected" note).
- Upstream `UPSTREAM_ERROR` with message `Upstream 404` from `stockTurnover` with `search` maps to an empty page.

### 4.2 View tools (model-visible, `_meta.ui.resourceUri` set)

Descriptions start with "Open an interactive … widget" and mention when to use it.

1. **`show_sales_dashboard`** `{start_date, end_date, outlet_id?}` → `ui://manujujaya/penjualan.html`. Budget 6.
   - Parallel calls:
     - `reports.summaries.transaction`
     - `reports.sales.trend` (`trend_type sales`, comparison = the immediately preceding range of equal length)
     - `reports.summaries.paymentMethods`
     - `reports.categories` (count 10)
     - `reports.products` (`-quantity`, count 5, pseudo row removed)
     - `reports.summaries.installment` (2015-01-01 → today, for the piutang tile)
   - Structured:
     - `kpis {gross, net_sales, profit, transactions, quantity, discount, tax, average_ticket}`
     - `changes {gross|profit|transactions|quantity: {percent: number|null, direction: up|down|null}}`
     - `comparison {start_date, end_date}`
     - `trend[] {date, amount, comparison_date, comparison_amount}`
     - `payment_methods[] {name, quantity, amount}`
     - `categories[] {id, name, quantity, gross}`
     - `top_products[] {id, name, category, quantity, unit, gross}`
     - `receivable {total, customers}`
   - Text: range, gross, profit, transactions, average ticket, % change vs comparison, top payment method, top 3 products, receivable total.
2. **`show_product_ranking`** `{start_date, end_date, order?: "terlaris"|"kurang_laris"|"omzet_tertinggi"|"omzet_terendah" (default terlaris), outlet_id?}` → `produk.html`. Budget 2.
   - `reports.products` with sort `-quantity` | `quantity` | `-total_gross` | `total_gross`, page 1, count 50, pseudo row removed and reported as `manual_transactions {quantity, gross}`; plus `reports.categories` count 20.
   - Structured: `rows[] {rank, id, name, category, sku, quantity, unit, gross, collected}`, `categories[]`, `next_page: number|null`.
   - Text: order label, range, top 10 names with quantity and gross.
   - App-only pager: `product_ranking_page {start_date, end_date, order, page, outlet_id?}` (budget 1).
3. **`show_stock_browser`** `{search?, outlet_id?}` → `stok.html`. Budget 1.
   - `inventories.stockTurnover` page 1, count 50, `sort created_at`, `search` if given.
   - Structured: `rows[] {inventory_id, name, stock, price_sell, last_sale_at|null, days_since_sale|null, last_adjustment_at|null, days_since_adjustment|null}`, `next_page`, `search`.
   - Text: hit count and the first 10 items with stock. Description: "pass `search` whenever the user names a product; without it the first load takes ~15 s".
   - App-only:
     - `stock_page {search?, page, outlet_id?}` (budget 1)
     - `stock_history {inventory_id, page, outlet_id?}` (budget 1, count 50, all 6 types): `movements[] {id, at (ISO), type, quantity, balance, note, by}`, `stock`, `product_name`, `next_page`
     - `stock_velocity {inventory_id, outlet_id?}` (budget 5): pages histories until movements are older than 30 days; returns `sold_30d`, `refunded_30d`, `stock`, `days_of_cover|null` (stock ÷ daily net sales), `oldest_scanned_at`, `truncated`
4. **`show_purchase_orders`** `{status?: "semua"|"order_processed"|"completed"|"canceled" (default semua), outlet_id?}` → `pembelian.html`. Budget 5.
   - `purchases.list` count 100, page 1; for a specific status scan pages 1–5 and filter.
   - Structured: `rows[] {id, order_no, supplier, total, status, created_at}`, `status_counts`, `scanned_rows`, `next_page`.
   - Text: counts per status in scanned rows, up to 10 matching POs.
   - App-only:
     - `purchase_orders_page {page, outlet_id?}` (budget 1)
     - `purchase_order_items {purchase_id, outlet_id?}` (budget 1): `items[] {product, variant, quantity, received, unit, price, subtotal}`
5. **`show_transactions`** `{start_date, end_date, customer_id?, outlet_id?}` → `transaksi.html`. Budget 2.
   - `order.histories.web` count 100 page 1; `customers.get` when `customer_id` is given (name only).
   - Structured: `days[] {date, daily_amount, items[] {sales_id, time, invoice, payment_mode, amount, status, status_label, sales_type}}`, `total_transactions` (pagination), `loaded_transactions`, `loaded_amount` (status ≠ 3), `payment_mode_totals` (loaded rows), `customer {id, name}|null`, `next_page`.
   - Text: range, total count, loaded sum labelled as loaded rows, payment-mode split.
   - App-only:
     - `transactions_page {start_date, end_date, page, customer_id?, outlet_id?}` (budget 1)
     - `order_detail {sales_id}` (budget 1): `{sales_id, invoice, status, status_label, settled_at, outlet_id, total_bill, total_paid, change, items[] {product, variant, quantity, price, total}, payments[] {name, mode, amount, paid_at}, customer {id, name, mobile}|null, credit {period, unit, due_date, total, remaining}|null (status 4 only), cashier}`
6. **`show_customer_debts`** `{customer_id?, outlet_id?}` → `piutang.html`. Budget 20.
   - Pages `order.histories.installment` from 2015-01-01 to today (Jakarta), count 100, following `next` (≤ 12 pages), deduped by `sales_id`.
   - Plus 7 `reports.summaries.installment` calls, one per aging bucket, by sale date.
   - Buckets by sale age in days (Jakarta): `0-7`, `8-30`, `31-90`, `91-180`, `181-365`, `366-730`, `>730`.
   - Structured:
     - `summary {receivable_total (sum of bucket receivables), customers, open_invoices, credit_total, overdue_invoices, overdue_customers}`
     - `buckets[] {key, label, invoices, customers, credit_total, receivable}`
     - `customers[] {customer_id, name, invoices, credit_total, oldest_sale_date, oldest_bucket, nearest_due_date|null, overdue_invoices, max_days_overdue}`
     - `focus_customer_id`
   - Default sort: overdue first, then credit total desc.
   - Text: receivable total, customer and invoice counts, overdue counts, per-bucket receivable, top 5 customers by credit (name, invoices, oldest bucket); never phone numbers.
   - App-only: `customer_debt_detail {customer_id, outlet_id?}` (budget 45).
     - `order.histories.installment` filtered by `customer_id` (≤ 3 pages), `order.histories.legacy` for each open sale (≤ 40, concurrency 4), `customers.get`.
     - Returns `customer {id, name, mobile}`, `invoices[] {sales_id, invoice, sale_date, due_date|null, days_overdue|null, bucket, total, paid, remaining, payments[] {name, amount, paid_at}}`, `totals {total, paid, remaining}`, `truncated`.

`remaining` is read only from status-4 sales. Receivable tiles are labelled "Sisa piutang (laporan Qasir)". Per-customer `credit_total` is labelled "Nilai kredit"; exact per-customer "Sisa" appears once the detail loads.

### 4.3 Registration and compatibility

- `createManujujayaServer` calls `registerWidgetResources(server)` and `registerWidgetTools(server, deps)` after `search`/`execute`, when `env.ENABLE_WIDGETS !== "false"` (new var, default `"true"` in `wrangler.jsonc`, so widgets can be switched off by configuration alone, without a code change).
- `capabilities` resource (`qasir://capabilities`) lists the widget tools and views.
- The server does not declare `capabilities.extensions` (helpers do not need it; `server/discover` stays unchanged).
- `MCP_SERVER_VERSION` and `package.json` go to `0.3.0`.

## 5. Views (UI, Bahasa Indonesia)

Common shell: title and subtitle (outlet, "Diperbarui 14.32"), refresh button, fullscreen button when available, view switcher, error panel, skeletons, empty states. Tables are virtualized (row height 44 px, container height min(560 px, content)), sortable on loaded rows, with an infinite footer ("Muat lebih banyak" button plus auto-load when visible).

- **Penjualan.**
  - Presets: Hari ini · Kemarin · 7 hari terakhir · Minggu ini · Bulan ini · 30 hari terakhir · Pilih tanggal (two date inputs + "Terapkan").
  - KPI tiles with ▲/▼ change: Penjualan kotor, Laba kotor, Transaksi, Rata-rata per transaksi.
  - SVG line chart, current vs comparison, with hover/focus tooltip; clicking a day opens Transaksi for that date.
  - Bar lists: Metode pembayaran, Kategori teratas, Produk terlaris (link to Produk).
  - Tile "Sisa piutang" links to Piutang.
  - Button "Tanya Claude tentang periode ini" sends a message with the range and KPIs.
- **Produk.**
  - Same presets.
  - Toggle Terlaris · Kurang laris · Omzet tertinggi · Omzet terendah.
  - Ranking table (Peringkat, Produk, Kategori, Terjual + satuan, Omzet); manual-transaction line shown separately.
  - Category bar list; clicking a product opens Stok with `search = name`.
- **Stok.**
  - Debounced search.
  - Table: Produk, Stok, Harga jual, Terakhir terjual ("43 hari lalu"), Terakhir penyesuaian.
  - Chips "Stok habis" / "Belum terjual ≥ 90 hari" filter loaded rows, with "dari N baris dimuat".
  - Row click opens a sheet:
    - movement history (Waktu, Jenis, ±Qty, Saldo, Catatan) with infinite paging
    - velocity card: terjual 30 hari, stok, perkiraan habis dalam N hari
- **Pembelian.**
  - Status chips (Semua · Diproses · Selesai · Dibatalkan); a status change calls the view tool again with that status.
  - Table: No. PO, Tanggal, Pemasok, Total, Status.
  - Row expand shows items (Produk, Varian, Dipesan, Diterima, Harga, Subtotal).
- **Transaksi.**
  - Presets as Penjualan (default Hari ini).
  - Customer filter chip when `customer_id` is set.
  - Payment-mode and status chips filter loaded rows.
  - Day-grouped virtualized list with sticky day header (date + daily amount): time, invoice, method, amount, status badge.
  - Row click opens the order detail sheet: items, payments, credit block, customer, and "Lihat transaksi pelanggan ini".
- **Piutang.**
  - Summary tiles: Sisa piutang, Pelanggan, Nota terbuka, Lewat jatuh tempo.
  - Aging bucket strip (0–7 hari · 8–30 hari · 1–3 bulan · 3–6 bulan · 6–12 bulan · 1–2 tahun · > 2 tahun), each with receivable and count; clicking one filters customers by oldest bucket.
  - Customer search (debounced, client-side) and sort (Lewat jatuh tempo · Nilai kredit terbesar · Nota terlama).
  - Table: Pelanggan, Nota, Nilai kredit, Nota tertua, Jatuh tempo terdekat (red "lewat N hari").
  - Row expand loads `customer_debt_detail`: phone, totals (Total · Dibayar · Sisa), per-invoice rows with payments, plus buttons:
    - "Lihat semua transaksi" (Transaksi, `customer_id`, last 365 days)
    - "Minta Claude buat pesan penagihan" (`sendMessage` with name, invoices, remaining; user-initiated)

Error messages (mapped from `code`, also parsing the SDK `Input validation error` text):
- `QASIR_AUTH_EXPIRED`: "Sesi Qasir sudah berakhir. Pemilik perlu menghubungkan ulang." Button "Buka halaman Connect" (`openLink` to the error body's `connect_url`; the button is hidden when it is absent).
- `QASIR_RATE_LIMITED`: "Qasir sedang membatasi permintaan. Coba lagi sebentar lagi."
- `UPSTREAM_TIMEOUT` and `RESULT_LIMIT_EXCEEDED`: "Data terlalu besar atau lambat. Persempit rentang tanggal."
- `FORBIDDEN`: "Akses ditolak untuk akun ini."
- `INVALID_INPUT`: "Filter tidak valid."
- Anything else: "Terjadi kesalahan saat mengambil data Qasir."

All have "Coba lagi" except auth expiry, which does not auto-retry because a 401 clears the shared session.

## 6. Security

- The new tools are read-only, scope-checked and hard-coded to their operations. App-only visibility is treated as cosmetic: every app-only tool is as safe as `execute` for any token holder. The per-call budgets stop them becoming an unbounded fan-out path (largest: `customer_debt_detail` at 45 requests).
- No credentials in any output (asserted). No arguments or results in logs.
- **Personal data.** `structuredContent` carries customer names (piutang, detail), mobile numbers (`order_detail`, `customer_debt_detail` only) and staff names (`cashier`). Text blocks carry customer names only in the piutang top 5, never phone numbers. `security.md` documents this alongside the existing `execute` exposure.
- The widget makes no network requests (host CSP `connect-src 'none'` compatible), uses no storage, and renders all text with React (no `dangerouslySetInnerHTML`).

## 7. Testing

- **Server unit tests** (vitest, fake dispatcher with synthetic fixtures shaped like §2, no real personal data):
  - date helpers (Jakarta today, comparison range, `DD Bulan YYYY` parsing incl. "", buckets at boundaries)
  - each tool's projection
  - `reports.products` pseudo-row removal
  - installment paging (count+1 rows, `next` following, dedupe, page cap, `truncated`)
  - debt grouping/overdue/sorting with a fixed clock
  - `remaining` only for status 4
  - web status labels
  - stock 404 → empty
  - velocity maths
  - structured-content cap
  - outlet resolution
  - budget exhaustion → `RESULT_LIMIT_EXCEEDED`
- **Security tests.**
  - Every widget tool without `qasir:read` → JSON `FORBIDDEN` and zero dispatches.
  - Each tool dispatches only its allowed operationIds.
  - No dispatch ever targets a non-read op.
  - Bounds rejected (range > 366 days, page > 500, bad dates, start > end).
  - Thrown upstream errors surface as `{code,message}` only.
  - No credential strings in results.
- **Protocol tests.** Existing assertions updated:
  - tool list = search, execute + 6 view tools + 9 app-only tools
  - view tools carry `_meta.ui.resourceUri` and app-only tools `_meta.ui.visibility ["app"]`
  - description rules split by tool family
  - resources list includes six `ui://` entries with the MCP App mime type
  - `resources/read` of each returns the HTML with its own `data-view`
  - resource count arithmetic updated
- **Bundle test.** Source-hash drift and HTML checks (§3.2).
- **Widget tests** (`widgets/test`, vitest + happy-dom + Testing Library):
  - formatters, error mapping, preset ranges
  - bridge seeding
  - one render test per route with the mock bridge (renders rows, no `<form>` in the DOM, error panel on `QASIR_AUTH_EXPIRED`)
- **Smoke test** (`bun run widgets:smoke`): headless Chrome loads each view in `sandbox="allow-scripts"` through ext-apps `AppBridge` with fixture tool results. It asserts that each view renders its main landmark, there are no console errors, no network requests, and a pager call round-trips.
- **Live E2E** (`bun run e2e -- --live`): calls each view tool once with small ranges and validates `structuredContent` against the contract; reports shapes only.
- **Manual acceptance:** add the connector in Claude.ai (custom connector) and open each view. If the host fails on protocol negotiation (`-32022`), set `MCP_LEGACY_MODE=stateless` (widgets still work; UI capability is never required).

## 8. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Claude.ai/ChatGPT connector protocol era unverified (server rejects pre-2026-07-28) | Manual acceptance step; documented `MCP_LEGACY_MODE=stateless` switch; tools never depend on client UI capability |
| Host sends `Origin` → 403 | Documented; add `allowedOriginHostnames` only if observed |
| 700 KB HTML re-fetched per URI | 10-minute cache hint; six URIs share one string in the Worker bundle |
| stockTurnover cold load ~15 s | Model told to pass `search`; widget skeleton says "Memuat stok, bisa sampai 15 detik" |
| Undocumented upstream semantics change | Contract parsing in widget shows the error panel instead of broken UI; live E2E validates shapes |
| 401 during widget paging clears the shared session | No auto-retry on `QASIR_AUTH_EXPIRED` |
| TanStack Table v9 API differs from common examples | Plan pins v9 API usage in code |
| WebKit sandbox behaviour untested | Manual check on Claude iOS/Safari during acceptance |

## 9. Documentation

- `docs/mcp-tools.md`: new "Widgets" section (tools, inputs, views, app-only tools).
- `docs/architecture/overview.md`: widget module, outlet resolution change, `ENABLE_WIDGETS`.
- `docs/architecture/security.md`: app-only tools and the personal-data exposure in `structuredContent`.
- `docs/architecture/setup.md`: `widgets:dev`, `widgets:bundle`, `widgets:smoke`.
- `README.md`: short "Interactive views" subsection (the file has uncommitted owner edits; changes are layered on top and left for the owner to commit).
