# Graph Report - manujujaya-mcp  (2026-09-16)

## Corpus Check
- 235 files · ~268,166 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2066 nodes · 5330 edges · 139 communities (81 shown, 58 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 97 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `715e2843`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- OwnerEnv
- transactions.ts
- AppError
- codemode-harness.ts
- contract.ts
- widgets-stock.test.ts
- debts.ts
- server.ts
- pembelian.tsx
- stock.ts
- formatNumber
- widgets-sales.test.ts
- scripts
- transaksi.tsx
- define.ts
- session/types.ts
- login-continue.ts
- search.ts
- mutation-tool.ts
- validate.ts
- owner-routes.ts
- session-store.test.ts
- src/index.ts
- piutang.tsx
- widget-tools.test.ts
- SessionStore
- API Coverage Manifest
- e2e-mcp.ts
- connect/html.ts
- compilerOptions
- coverage.test.ts
- ExecutionBudget
- registry/types.ts
- mcp/resources.ts
- MutationApprovalsDO
- connect/routes.ts
- redact.ts
- validate-coverage.ts
- text.ts
- Execution lanes
- Qasir Products
- e2e-live-login-products.ts
- exclusions.ts
- openapi.ts
- crypto.ts
- MCP App widgets (TanStack) — design
- devDependencies
- scenarios.test.ts
- sales.ts
- Qasir Purchases
- Qasir Users
- compilerOptions
- Qasir Order Histories (Web)
- Qasir Reports
- Qasir dashboard routes
- 2. Product picker — stock-turnover
- dispatcher.test.ts
- fixtures.ts
- OMP OAuth account pools on macOS
- Qasir Suppliers
- operations.ts
- tsconfig.scripts.json
- manujujaya-mcp
- QasirSessionsDO
- viewPaths.ts
- cloudflare-workers.ts
- MemoryStorage
- ErrorPanel.tsx
- Q: Why does ToolOutput connect Bridge Toolinput across 17 different widget, route, and fixture communities?
- .constructor
- Durable Objects Storage Model
- Execute Mutation Two-Call Workflow
- Customer Profile Data Model
- Widget View Tools Specification
- vite.config.ts
- OAuth Grant and Token Revocation
- Troubleshooting and Error Catalog
- Code Mode Sandbox Architecture
- Widget View Request Flow
- Claude Code Installation
- inventories.stockHistories Endpoint
- Execute Tool Specification
- MCP Resources Specification
- Search Tool Specification
- RequestBudget
- @modelcontextprotocol/ext-apps
- @tanstack/react-form
- connect-routes.test.ts
- @tanstack/react-router
- @tanstack/react-table
- @testing-library/dom
- @types/react
- AppShell.tsx
- typescript
- vite
- vite-plugin-singlefile
- @vitejs/plugin-react
- QasirDispatcher
- dependencies
- worker-configuration.d.ts
- Agents Navigation and Graphify Guide
- Graphify Knowledge Graph Workflow
- Coverage Validation Policy
- Endpoint Status Categories
- Stateless MCP Server Design
- Cloudflare Production Deployment
- E2E Verification Script
- customers.get Endpoint
- Claude.ai Connector Installation
- Codex and ChatGPT Desktop Installation
- Copyable Prompt Templates
- Cursor MCP Installation
- VS Code GitHub Copilot Installation
- Opname Running Balance Semantics
- Raw Token Header Auth Profile
- order.histories.installment Endpoint
- Connect Fixture UI Coverage Audit Gates
- Gate G1 Fixture Classification
- Gate G2 Canvas Inventory
- Gate G3 Coverage Matrix
- Gate G4 Missing States Added
- Gate G5 Visual Polish Validation
- Login Page HTML Test Fixture
- Stock Adjustment Table HTML Test Fixture
- Suppliers Scraping Edge Case HTML Test Fixture
- Suppliers Scraping Standard HTML Test Fixture
- MCP App Singlefile Widget HTML Shell
- `data.products[].variants[]`
- package.json
- happy-dom
- react-dom
- @tailwindcss/vite
- @tanstack/react-virtual

## God Nodes (most connected - your core abstractions)
1. `AppError` - 123 edges
2. `ErrorCodes` - 52 edges
3. `handleConnectRoutes()` - 35 edges
4. `log()` - 30 edges
5. `SessionStore` - 28 edges
6. `formatNumber()` - 28 edges
7. `createManujujayaServer()` - 27 edges
8. `formatRupiah()` - 26 edges
9. `QasirSessionProvider` - 23 edges
10. `ToolOutput` - 23 edges

## Surprising Connections (you probably didn't know these)
- `Call` --calls--> `handleConnectRoutes()`  [EXTRACTED]
  tests/unit/connect-routes.test.ts → src/connect/routes.ts
- `upstream404()` --calls--> `AppError`  [EXTRACTED]
  tests/unit/widgets-stock.test.ts → src/errors/codes.ts
- `Qasir Dashboard Session Connect` --implements--> `Qasir Connect Architecture and Guide`  [INFERRED]
  README.md → docs/connect-qasir.md
- `FixedSessionProvider` --implements--> `QasirSessionProvider`  [EXTRACTED]
  scripts/e2e-live-login-products.ts → src/session/types.ts
- `main()` --calls--> `continueWithOutlet()`  [EXTRACTED]
  scripts/e2e-live-login-products.ts → src/connect/login-continue.ts

## Import Cycles
- 3-file cycle: `widgets/src/app/router.tsx -> widgets/src/routes/index.ts -> widgets/src/routes/stok.tsx -> widgets/src/app/router.tsx`
- 3-file cycle: `widgets/src/app/router.tsx -> widgets/src/routes/index.ts -> widgets/src/routes/pembelian.tsx -> widgets/src/app/router.tsx`
- 3-file cycle: `widgets/src/app/router.tsx -> widgets/src/routes/index.ts -> widgets/src/routes/penjualan.tsx -> widgets/src/app/router.tsx`
- 3-file cycle: `widgets/src/app/router.tsx -> widgets/src/routes/index.ts -> widgets/src/routes/piutang.tsx -> widgets/src/app/router.tsx`
- 3-file cycle: `widgets/src/app/router.tsx -> widgets/src/routes/index.ts -> widgets/src/routes/produk.tsx -> widgets/src/app/router.tsx`
- 3-file cycle: `widgets/src/app/router.tsx -> widgets/src/routes/index.ts -> widgets/src/routes/transaksi.tsx -> widgets/src/app/router.tsx`
- 4-file cycle: `widgets/src/app/router.tsx -> widgets/src/routes/index.ts -> widgets/src/routes/piutang.tsx -> widgets/src/routes/transaksi.tsx -> widgets/src/app/router.tsx`

## Hyperedges (group relationships)
- **Qasir Connect Session Lifecycle** — docs_auth_login_qasir_auth_login_spec, docs_connect_qasir_connect_login_flow, docs_architecture_overview_durable_objects_storage, docs_architecture_security_session_encryption [INFERRED 0.95]
- **Two-Call Mutation Approval Pipeline** — docs_mcp_tools_execute_mutation_spec, docs_architecture_security_mutation_gates, docs_architecture_operations_mutation_enablement, docs_architecture_overview_durable_objects_storage [INFERRED 0.95]

## Communities (139 total, 58 thin omitted)

### Community 0 - "OwnerEnv"
Cohesion: 0.33
Nodes (6): ApprovalRoutesEnv, OwnerEnv, OwnerRoutesEnv, DevPskEnv, ConnectGateEnv, ConnectEnv

### Community 1 - "transactions.ts"
Cohesion: 0.08
Nodes (24): orderDetailData, orderDetailInput, transactionsData, transactionsInput, transactionsPageData, DEBT_TOOLS, AnyWidgetToolDef, WidgetToolDef (+16 more)

### Community 2 - "AppError"
Cohesion: 0.16
Nodes (28): assertAllowedUrl(), assertSafeSlug(), FIXED_HOSTS, isQasirLoginUrl(), resolveHost(), applyQuery(), assertSafePathSegment(), buildPath() (+20 more)

### Community 3 - "codemode-harness.ts"
Cohesion: 0.12
Nodes (40): createManujujayaServer(), executeDescription(), mutationDescription(), searchDescription(), MCP_APP_MIME_TYPE, VIEW_MARKER, viewResourceUri(), registerWidgetResources() (+32 more)

### Community 4 - "contract.ts"
Cohesion: 0.05
Nodes (54): APP_TOOL, categoryRow, changeSchema, CUSTOMER_INSTALLMENT_MAX_PAGES, customerDebtDetailInput, customerDebtsInput, dateRange, DEBT_DETAIL_MAX_INVOICES (+46 more)

### Community 5 - "widgets-stock.test.ts"
Cohesion: 0.09
Nodes (15): stockBrowserData, stockHistoryData, stockPageData, stockVelocityData, stockBrowserTool, stockHistoryTool, stockPageTool, stockVelocityTool (+7 more)

### Community 6 - "debts.ts"
Cohesion: 0.10
Nodes (47): isAppErrorLike(), salesStatusLabel(), stockMovementLabel(), parseIndonesianDate(), parseQasirDateTime(), isRecord(), toNumber(), toNumberOrNull() (+39 more)

### Community 7 - "server.ts"
Cohesion: 0.08
Nodes (34): CodemodeLimits, DEFAULT_CODEMODE_LIMITS, SandboxErrorBridge, timeoutError(), formatResult(), hardCap(), NO_VALUE_MESSAGE, assertReadOperation() (+26 more)

### Community 8 - "pembelian.tsx"
Cohesion: 0.09
Nodes (51): startInitialView(), NotFoundPanel(), rootRoute, WidgetRouter, compact(), searchFromToolArgs(), toolArgsFromSearch(), useBridge() (+43 more)

### Community 9 - "stock.ts"
Cohesion: 0.08
Nodes (40): pageInput, stockBrowserInput, stockHistoryInput, stockPageInput, stockVelocityInput, STRUCTURED_MAX_CHARS, VELOCITY_MAX_PAGES, VELOCITY_WINDOW_DAYS (+32 more)

### Community 10 - "formatNumber"
Cohesion: 0.11
Nodes (29): ChangeLine(), OrderDetailContent(), compact, pointLabel(), TrendChart(), TrendChartProps, TrendPoint, dateFormat (+21 more)

### Community 11 - "widgets-sales.test.ts"
Cohesion: 0.06
Nodes (34): customerDebtDetailData, customerDebtsData, PRODUCT_ORDER_SORT, productRankingData, productRankingPageData, salesDashboardData, customerDebtDetailTool, customerDebtsTool (+26 more)

### Community 12 - "scripts"
Cohesion: 0.09
Nodes (22): scripts, build, cf-typegen, check-types, coverage:report, coverage:validate, deploy, deploy:dry-run (+14 more)

### Community 13 - "transaksi.tsx"
Cohesion: 0.14
Nodes (16): viewPathWithSearch(), salesStatusTone(), CUSTOMER_HISTORY_DAYS, DAY_HEADER_HEIGHT, entryHeight(), firstScreen(), ListEntry, mergeTransactionDays() (+8 more)

### Community 14 - "define.ts"
Cohesion: 0.10
Nodes (30): clip(), executorFailure(), KNOWN_CODES, toAppError(), ErrorCodes, KNOWN_CODES, errorCodeOf(), errorResult() (+22 more)

### Community 15 - "session/types.ts"
Cohesion: 0.17
Nodes (13): CompositeSessionOptions, SessionEnv, PlainRecord, RateEntry, RecordKind, SaveSessionInput, SealedRecord, PendingAuthDraft (+5 more)

### Community 16 - "login-continue.ts"
Cohesion: 0.05
Nodes (70): CookieJar, domainMatches(), isQasirDomain(), isStoredCookie(), parseSetCookieHeaders(), pathMatches(), RFC-6265, extractApiTokenFromHtml() (+62 more)

### Community 17 - "search.ts"
Cohesion: 0.08
Nodes (33): MAX_RANGE_DAYS, PO_STATUS_FILTERS, PRODUCT_ORDERS, daysOf(), customerIdParam, dateParam, DEBT_SORTS, DebtSort (+25 more)

### Community 18 - "mutation-tool.ts"
Cohesion: 0.12
Nodes (21): APPROVAL_TTL_MS, ApprovalRecord, hashArgs(), MutationApprovalsStub, MutationPreview, stableStringify(), hasScope(), Scope (+13 more)

### Community 19 - "validate.ts"
Cohesion: 0.12
Nodes (32): getOperation(), checkArray(), checkBody(), checkBounds(), checkEnum(), checkObject(), checkPathParam(), checkValue() (+24 more)

### Community 20 - "owner-routes.ts"
Cohesion: 0.11
Nodes (43): assertConfigured(), assertCsrf(), b64url(), b64urlDecode(), clearOwnerCookie(), clientIp(), constantTimeEqual(), cookieName() (+35 more)

### Community 21 - "session-store.test.ts"
Cohesion: 0.10
Nodes (7): PENDING_TTL_MS, SessionStorage, draft, ENC_ENV, KEY, MemoryStorage, RacyStorage

### Community 22 - "src/index.ts"
Cohesion: 0.22
Nodes (15): approvalsStubFor(), approvalPage(), handleApprovalRoutes(), NoticeTone, principalFromProps(), appHandler, fetch(), mcpApiHandler (+7 more)

### Community 23 - "piutang.tsx"
Cohesion: 0.04
Nodes (61): ChipGroup(), ChipGroupBase, ChipGroupProps, ChipOption, ColumnDef, dataColumnHelper(), DataColumnMeta, DataTable() (+53 more)

### Community 24 - "widget-tools.test.ts"
Cohesion: 0.13
Nodes (21): AuthPrincipal, QasirSessionProvider, ToolErrorBody, WidgetToolDeps, Setup, ALLOWED_OPS, emptyReadHandlers(), NO_SCOPES (+13 more)

### Community 25 - "SessionStore"
Cohesion: 0.16
Nodes (7): isEncryptedBlobV1(), SessionKeys, isPendingState(), isStoredSession(), isV2Record(), sameRecord(), SessionStore

### Community 26 - "API Coverage Manifest"
Cohesion: 0.12
Nodes (26): API Coverage Manifest, Legacy 2025 MCP Client Handling, Operations Runbook, Architecture Overview, MCP Request Processing Flow, MCP Client OAuth Controls, Security Model and Trust Boundaries, Local Dev PSK Bypass (+18 more)

### Community 27 - "e2e-mcp.ts"
Cohesion: 0.13
Nodes (20): args, b64url(), BASE, check(), CONNECT, connectQasirSession(), cookiesFrom(), Jar (+12 more)

### Community 28 - "connect/html.ts"
Cohesion: 0.29
Nodes (18): consentPage(), ConsentPageOptions, ownerLoginPage(), SCOPE_LABELS, simpleErrorPage(), connectLayout(), connectLoginPage(), connectPasteNeededHtml() (+10 more)

### Community 29 - "compilerOptions"
Cohesion: 0.08
Nodes (24): dev, DOM, DOM.Iterable, ES2023, src, test, vite/client, vite.config.ts (+16 more)

### Community 30 - "coverage.test.ts"
Cohesion: 0.13
Nodes (20): lines, out, root, checkCoverage(), coverageKey(), API_DOC_NAMES, codeSpans(), DocEndpoint (+12 more)

### Community 32 - "registry/types.ts"
Cohesion: 0.15
Nodes (20): RFC-3339, countParam, dateRange, op(), pageCount, pageParam, ATTENDANCE_OPS, Def (+12 more)

### Community 33 - "mcp/resources.ts"
Cohesion: 0.22
Nodes (12): CapabilitiesInfo, capabilitiesPayload(), DOC_NAMES, DOC_SET, docUri(), jsonContents(), registerResources(), buildCoverageManifest() (+4 more)

### Community 35 - "connect/routes.ts"
Cohesion: 0.13
Nodes (23): withSetCookies(), connectErrorHtml(), appErrorLike, jsonResponse(), mapConnectError(), readBody(), respondLoginResult(), wantsJson() (+15 more)

### Community 36 - "redact.ts"
Cohesion: 0.14
Nodes (16): BUNDLED_DOCS, Frame, isPersonHeading(), PERSON_FIELDS, PERSON_JSON_FIELD, redactCodeSpans(), redactJsonNames(), redactRow() (+8 more)

### Community 37 - "validate-coverage.ts"
Cohesion: 0.19
Nodes (11): docEndpoints, docs, problems, root, summary, cell(), code(), renderCoverageMarkdown() (+3 more)

### Community 38 - "text.ts"
Cohesion: 0.16
Nodes (23): PAGE_MARKERS, parseStockAdjustmentHtml(), ParseStockAdjustmentOptions, StockAdjustmentPage, StockAdjustmentRow, extractRowId(), PAGE_MARKERS, parseSuppliersHtml() (+15 more)

### Community 39 - "Execution lanes"
Cohesion: 0.10
Nodes (20): Execution lanes, File Structure, Global Constraints, MCP App Widgets (TanStack) Implementation Plan, Task 10: Widget bundle pipeline, Task 11: Registration, protocol and security tests, Task 12: Views Penjualan and Produk, Task 13: Views Stok and Pembelian (+12 more)

### Community 40 - "Qasir Products"
Cohesion: 0.17
Nodes (12): Dashboard HTML (the `/products` page), Endpoint, Example request, Headers, Implementation notes, Inventories list (not documented here), Pagination, Qasir Products (+4 more)

### Community 41 - "e2e-live-login-products.ts"
Cohesion: 0.27
Nodes (7): FixedSessionProvider, loadDevVars(), main(), mask(), summarizeProducts(), readSecrets(), QasirSessionContext

### Community 42 - "exclusions.ts"
Cohesion: 0.31
Nodes (8): excluded(), EXCLUSIONS, Method, NonOpEntry, SESSION_ONLY, sessionOnly(), AuthProfile, SafetyClass

### Community 43 - "openapi.ts"
Cohesion: 0.22
Nodes (14): checkOpenApi(), OpenApiOperation, UNSUPPORTED_EVIDENCE, buildOpenApiDocument(), HOST_URLS, hostBaseUrl(), operationToOpenApi(), pathParamsOnly() (+6 more)

### Community 44 - "crypto.ts"
Cohesion: 0.19
Nodes (13): b64Decode(), b64Encode(), Ciphertext, decryptJson(), enc, EncryptedBlobV1, encryptJson(), importSessionKeys() (+5 more)

### Community 45 - "MCP App widgets (TanStack) — design"
Cohesion: 0.12
Nodes (16): 1. Goal, 2. Verified facts this design relies on, 3.1 Layout, 3.2 Serving, 3.3 Widget runtime, 3. Architecture, 4.1 Rules for every new tool, 4.2 View tools (model-visible, `_meta.ui.resourceUri` set) (+8 more)

### Community 46 - "devDependencies"
Cohesion: 0.08
Nodes (25): @cloudflare/workers-types, @modelcontextprotocol/client, devDependencies, @cloudflare/workers-types, @modelcontextprotocol/client, playwright-core, react, tailwindcss (+17 more)

### Community 47 - "scenarios.test.ts"
Cohesion: 0.13
Nodes (10): fixtures, PRODUCTS, PURCHASES, spec, CodeExecutorClass, CodeExecutorInstance, createSandboxContext(), EvaluateResponse (+2 more)

### Community 48 - "sales.ts"
Cohesion: 0.09
Nodes (34): AGING_BUCKET_KEYS, AgingBucketKey, DEBT_SCAN_START_DATE, isoDate, PRODUCT_ORDER_LABEL, productRankingInput, productRankingPageInput, salesDashboardInput (+26 more)

### Community 49 - "Qasir Purchases"
Cohesion: 0.13
Nodes (15): Confirm / cancel (from `app.min.js`, not this capture’s Network), Dashboard HTML, `data.purchases[]`, Endpoint, Example request, Headers, Implementation notes, Line items (+7 more)

### Community 50 - "Qasir Users"
Cohesion: 0.13
Nodes (15): `data.access[]`, `data.is_limit`, `data.users[]`, `data.users[].outlets[]`, Endpoint, Example request, Headers, `image_file` (+7 more)

### Community 51 - "compilerOptions"
Cohesion: 0.08
Nodes (23): @cloudflare/workers-types, ES2022, scripts/**, src/**/*.ts, tests/**/*.ts, worker-configuration.d.ts, compilerOptions, esModuleInterop (+15 more)

### Community 52 - "Qasir Order Histories (Web)"
Cohesion: 0.15
Nodes (13): `data.agg`, `data.sales[]`, `data.sales[].items[]`, Endpoint, Example request, Headers, Implementation notes, Observed `status` values (+5 more)

### Community 53 - "Qasir Reports"
Cohesion: 0.15
Nodes (13): Attendance, Breakdowns, Endpoint prefix, Example request, Headers, Implementation notes, Microsite visits, Not observed on load (+5 more)

### Community 54 - "Qasir dashboard routes"
Cohesion: 0.15
Nodes (13): Auth, Chrome XHR (every page), Crawl stats, Customer survey, Dashboard-only APIs, Ingredients / recipes, JSON lists that the HTML page does **not** call, Mutations (from `app.min.js`, not fired on crawl) (+5 more)

### Community 55 - "2. Product picker — stock-turnover"
Cohesion: 0.14
Nodes (14): 1. History table (the page), 2. Product picker — stock-turnover, 3. Save — bulk inventories, `data.variants[]`, Example request, Headers, Implementation notes, JSON list probe (+6 more)

### Community 56 - "dispatcher.test.ts"
Cohesion: 0.25
Nodes (4): dispatcher(), FetchArgs, fixtures, mockSession()

### Community 57 - "fixtures.ts"
Cohesion: 0.05
Nodes (51): built, hash, head, out, root, computeWidgetSourceHash(), listFiles(), WIDGET_SOURCE_DIRS (+43 more)

### Community 58 - "OMP OAuth account pools on macOS"
Cohesion: 0.08
Nodes (25): 1. Connect Grok OAuth accounts, 2. Create the Grok account pool, 3. Start the broker once and create its token, 4. Install the macOS LaunchAgent, 5. Configure OMP clients, 6. Verify the complete setup, Account selection and quota behavior, Broker health (+17 more)

### Community 59 - "Qasir Suppliers"
Cohesion: 0.20
Nodes (10): Endpoint (the page), Example request, Headers, Implementation notes, JSON probes (failed), Qasir Suppliers, Query parameters, Response (+2 more)

### Community 60 - "operations.ts"
Cohesion: 0.29
Nodes (9): exposedReadIds(), buildOperationCatalog(), listExposedOperations(), listMutationOperations(), listReadOperations(), CATALOG_OPS, MAX_PAGE_SIZE, MISC_OPS (+1 more)

### Community 61 - "tsconfig.scripts.json"
Cohesion: 0.22
Nodes (8): scripts/**/*.ts, ./tsconfig.json, compilerOptions, types, exclude, extends, include, node

### Community 62 - "manujujaya-mcp"
Cohesion: 0.50
Nodes (3): Development Commands, graphify, manujujaya-mcp

### Community 65 - "viewPaths.ts"
Cohesion: 0.16
Nodes (16): VIEW_TOOL, ViewName, VIEWS, AppShell(), PenjualanSearch, PiutangSearch, StokSearch, TransaksiSearch (+8 more)

### Community 66 - "cloudflare-workers.ts"
Cohesion: 0.29
Nodes (4): DurableObject, env, RpcTarget, WorkerEntrypoint

### Community 69 - "ErrorPanel.tsx"
Cohesion: 0.39
Nodes (4): ErrorPanel(), errorCopy, safeHttpUrl(), stockVelocity

### Community 70 - "Q: Why does ToolOutput connect Bridge Toolinput across 17 different widget, route, and fixture communities?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Why does ToolOutput connect Bridge Toolinput across 17 different widget, route, and fixture communities?, Source Nodes

### Community 72 - "Durable Objects Storage Model"
Cohesion: 0.50
Nodes (4): Durable Objects Storage Model, IP and User Rate Limiting, AES-GCM Session Encryption and AAD Binding, Single Merchant Shared Session Model

### Community 73 - "Execute Mutation Two-Call Workflow"
Cohesion: 0.67
Nodes (3): Mutation Enablement Workflow, Four-Gate Mutation Security Model, Execute Mutation Two-Call Workflow

### Community 74 - "Customer Profile Data Model"
Cohesion: 0.67
Nodes (3): Customer Profile Data Model, Credit Sales and Customer Debt Tracking, Legacy Receipt Cart and Payment Model

### Community 75 - "Widget View Tools Specification"
Cohesion: 0.67
Nodes (3): Widget App-Only Helper Tools, Widget View Tools Specification, MCP Interactive Widget Views

### Community 90 - "connect-routes.test.ts"
Cohesion: 0.18
Nodes (9): Call, doFor(), fixtures, installQasir(), load(), MemoryStorage, namespace(), post() (+1 more)

### Community 96 - "AppShell.tsx"
Cohesion: 0.06
Nodes (61): TOOL_SCHEMAS, ToolInput, ToolName, ToolOutput, FIXTURES, APP_INFO, atViewDefaults(), HostedShell() (+53 more)

### Community 101 - "QasirDispatcher"
Cohesion: 0.13
Nodes (7): DispatcherLimits, QasirDispatcher, createRequestSignals(), FetchArgs, Handler, LIST, setup()

### Community 102 - "dependencies"
Cohesion: 0.18
Nodes (11): agents, @cloudflare/codemode, @cloudflare/workers-oauth-provider, @modelcontextprotocol/server, dependencies, agents, @cloudflare/codemode, @cloudflare/workers-oauth-provider (+3 more)

### Community 136 - "`data.products[].variants[]`"
Cohesion: 0.29
Nodes (7): `data.products[]`, `data.products[].images`, `data.products[].variants[]`, Response, `variants[].images`, `variants[].stock`, `variants[].unit_label`

### Community 137 - "package.json"
Cohesion: 0.29
Nodes (6): engines, node, name, private, type, version

## Knowledge Gaps
- **647 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+642 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **58 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppError` connect `AppError` to `transactions.ts`, `codemode-harness.ts`, `contract.ts`, `widgets-stock.test.ts`, `debts.ts`, `server.ts`, `stock.ts`, `widgets-sales.test.ts`, `define.ts`, `session/types.ts`, `login-continue.ts`, `mutation-tool.ts`, `validate.ts`, `owner-routes.ts`, `src/index.ts`, `widget-tools.test.ts`, `ExecutionBudget`, `MutationApprovalsDO`, `connect/routes.ts`, `text.ts`, `e2e-live-login-products.ts`, `crypto.ts`, `scenarios.test.ts`, `sales.ts`, `dispatcher.test.ts`, `.constructor`, `RequestBudget`, `QasirDispatcher`?**
  _High betweenness centrality (0.121) - this node is a cross-community bridge._
- **Why does `ErrorCodes` connect `define.ts` to `transactions.ts`, `AppError`, `codemode-harness.ts`, `contract.ts`, `widgets-stock.test.ts`, `debts.ts`, `server.ts`, `stock.ts`, `widgets-sales.test.ts`, `session/types.ts`, `login-continue.ts`, `mutation-tool.ts`, `validate.ts`, `owner-routes.ts`, `widget-tools.test.ts`, `connect/routes.ts`, `text.ts`, `crypto.ts`, `scenarios.test.ts`, `sales.ts`, `dispatcher.test.ts`, `QasirDispatcher`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Why does `ToolOutput` connect `AppShell.tsx` to `transactions.ts`, `contract.ts`, `widgets-stock.test.ts`, `debts.ts`, `pembelian.tsx`, `stock.ts`, `widgets-sales.test.ts`, `transaksi.tsx`, `sales.ts`, `piutang.tsx`, `fixtures.ts`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `handleConnectRoutes()` (e.g. with `.clear()` and `.clearPending()`) actually correct?**
  _`handleConnectRoutes()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _647 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `transactions.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07956989247311828 - nodes in this community are weakly interconnected._
- **Should `codemode-harness.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11690821256038647 - nodes in this community are weakly interconnected._