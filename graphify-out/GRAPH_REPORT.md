# Graph Report - manujujaya-mcp  (2026-09-16)

## Corpus Check
- 233 files · ~265,700 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2033 nodes · 5292 edges · 143 communities (87 shown, 56 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 97 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bb790422`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- contract.ts
- codemode-harness.ts
- run.ts
- widgets-sales.test.ts
- validate-coverage.ts
- stock.ts
- qasir-dates.ts
- API Coverage Manifest
- server.ts
- debts.ts
- formatNumber
- Qasir Order Histories (Web)
- connect/routes.ts
- purchases.ts
- widgets-smoke.ts
- validate.ts
- dates.ts
- bridge.ts
- penjualan.tsx
- operations.ts
- mutation-tool.ts
- text.ts
- search.ts
- e2e-mcp.ts
- Execution lanes
- CookieJar
- SessionStore
- fixtures.ts
- OrderDetailSheet.tsx
- devDependencies
- compilerOptions
- define.ts
- compilerOptions
- AppShell.tsx
- query.test.tsx
- sales.ts
- session/types.ts
- transaksi.tsx
- scripts
- widgets-define.test.ts
- login-continue.ts
- connect.test.ts
- redact.ts
- session-store.test.ts
- produk.tsx
- piutang.tsx
- QasirDispatcher
- AppError
- stok.tsx
- testHelpers.tsx
- scenarios.test.ts
- transactions.ts
- openapi.ts
- session-store.ts
- MCP App widgets (TanStack) — design
- coverage.test.ts
- codes.ts
- Qasir Purchases
- Qasir Users
- mockBridge.ts
- paste.ts
- dispatcher.test.ts
- pembelian.tsx
- exclusions.ts
- MutationApprovalsDO
- dispatcher-transport.test.ts
- dependencies
- 2. Product picker — stock-turnover
- Bridge
- tsconfig.scripts.json
- Qasir Reports
- connect-routes.test.ts
- Qasir dashboard routes
- package.json
- cloudflare-workers.ts
- Qasir Products
- MemoryStorage
- Durable Objects Storage Model
- Execute Mutation Two-Call Workflow
- Customer Profile Data Model
- Widget View Tools Specification
- vite.config.ts
- worker-configuration.d.ts
- OAuth Grant and Token Revocation
- Troubleshooting and Error Catalog
- Code Mode Sandbox Architecture
- Widget View Request Flow
- Claude Code Installation
- inventories.stockHistories Endpoint
- Execute Tool Specification
- MCP Resources Specification
- Search Tool Specification
- Qasir Suppliers
- ExecutionBudget
- Login Page HTML Test Fixture
- Stock Adjustment Table HTML Test Fixture
- Connect Fixture UI Coverage Audit Gates
- happy-dom
- @modelcontextprotocol/ext-apps
- react-dom
- @tailwindcss/vite
- @tanstack/react-form
- @tanstack/react-router
- @tanstack/react-table
- @tanstack/react-virtual
- @testing-library/dom
- @types/react
- typescript
- vite
- vite-plugin-singlefile
- @vitejs/plugin-react
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
- `data.products[].variants[]`
- Q: Why does ToolOutput connect Bridge Toolinput across 17 different widget, route, and fixture communities?
- Gate G1 Fixture Classification
- Gate G2 Canvas Inventory
- Gate G4 Missing States Added
- Suppliers Scraping Edge Case HTML Test Fixture
- Suppliers Scraping Standard HTML Test Fixture
- Gate G3 Coverage Matrix
- Gate G5 Visual Polish Validation
- MCP App Singlefile Widget HTML Shell

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
- `setup()` --calls--> `QasirDispatcher`  [EXTRACTED]
  tests/unit/dispatcher-transport.test.ts → src/dispatcher/qasir-dispatcher.ts
- `upstream404()` --calls--> `AppError`  [EXTRACTED]
  tests/unit/widgets-stock.test.ts → src/errors/codes.ts
- `Qasir Dashboard Session Connect` --implements--> `Qasir Connect Architecture and Guide`  [INFERRED]
  README.md → docs/connect-qasir.md
- `FixedSessionProvider` --implements--> `QasirSessionProvider`  [EXTRACTED]
  scripts/e2e-live-login-products.ts → src/session/types.ts

## Import Cycles
- 3-file cycle: `widgets/src/app/router.tsx -> widgets/src/routes/index.ts -> widgets/src/routes/piutang.tsx -> widgets/src/app/router.tsx`
- 3-file cycle: `widgets/src/app/router.tsx -> widgets/src/routes/index.ts -> widgets/src/routes/stok.tsx -> widgets/src/app/router.tsx`
- 3-file cycle: `widgets/src/app/router.tsx -> widgets/src/routes/index.ts -> widgets/src/routes/pembelian.tsx -> widgets/src/app/router.tsx`
- 3-file cycle: `widgets/src/app/router.tsx -> widgets/src/routes/index.ts -> widgets/src/routes/penjualan.tsx -> widgets/src/app/router.tsx`
- 3-file cycle: `widgets/src/app/router.tsx -> widgets/src/routes/index.ts -> widgets/src/routes/produk.tsx -> widgets/src/app/router.tsx`
- 3-file cycle: `widgets/src/app/router.tsx -> widgets/src/routes/index.ts -> widgets/src/routes/transaksi.tsx -> widgets/src/app/router.tsx`
- 4-file cycle: `widgets/src/app/router.tsx -> widgets/src/routes/index.ts -> widgets/src/routes/piutang.tsx -> widgets/src/routes/transaksi.tsx -> widgets/src/app/router.tsx`

## Hyperedges (group relationships)
- **Qasir Connect Session Lifecycle** — docs_auth_login_qasir_auth_login_spec, docs_connect_qasir_connect_login_flow, docs_architecture_overview_durable_objects_storage, docs_architecture_security_session_encryption [INFERRED 0.95]
- **Two-Call Mutation Approval Pipeline** — docs_mcp_tools_execute_mutation_spec, docs_architecture_security_mutation_gates, docs_architecture_operations_mutation_enablement, docs_architecture_overview_durable_objects_storage [INFERRED 0.95]

## Communities (143 total, 56 thin omitted)

### Community 0 - "contract.ts"
Cohesion: 0.04
Nodes (45): APP_TOOL, categoryRow, changeSchema, dateRange, debtBucket, debtCustomer, debtInvoice, endDate (+37 more)

### Community 1 - "codemode-harness.ts"
Cohesion: 0.16
Nodes (30): VIEW_MARKER, execute(), capabilities(), WIDGET_TOOLS, call(), handlerFor(), ToolInfo, WIDGET_TOOL_ORDER (+22 more)

### Community 2 - "run.ts"
Cohesion: 0.09
Nodes (30): CodemodeLimits, DEFAULT_CODEMODE_LIMITS, clip(), executorFailure(), KNOWN_CODES, SandboxErrorBridge, timeoutError(), formatResult() (+22 more)

### Community 3 - "widgets-sales.test.ts"
Cohesion: 0.06
Nodes (28): orderDetailData, orderDetailInput, PRODUCT_ORDER_SORT, productRankingData, productRankingPageData, salesDashboardData, transactionsData, transactionsPageData (+20 more)

### Community 4 - "validate-coverage.ts"
Cohesion: 0.14
Nodes (17): lines, out, root, docEndpoints, docs, problems, root, summary (+9 more)

### Community 5 - "stock.ts"
Cohesion: 0.08
Nodes (42): pageInput, stockBrowserInput, stockHistoryInput, stockPageInput, stockVelocityInput, STRUCTURED_MAX_CHARS, VELOCITY_MAX_PAGES, VELOCITY_WINDOW_DAYS (+34 more)

### Community 6 - "qasir-dates.ts"
Cohesion: 0.20
Nodes (17): DEBT_SCAN_START_DATE, MAX_RANGE_DAYS, addDays(), agingBucket(), assertDateRange(), BUCKET_BOUNDS, bucketSaleDateRange(), daysBetween() (+9 more)

### Community 7 - "API Coverage Manifest"
Cohesion: 0.12
Nodes (26): API Coverage Manifest, Legacy 2025 MCP Client Handling, Operations Runbook, Architecture Overview, MCP Request Processing Flow, MCP Client OAuth Controls, Security Model and Trust Boundaries, Local Dev PSK Bypass (+18 more)

### Community 8 - "server.ts"
Cohesion: 0.11
Nodes (28): APPROVAL_TTL_MS, hasScope(), Scope, SCOPES, KNOWN_SCOPES, LOOPBACK_HOSTS, requireScope(), EXECUTE_MUTATION_TOOL (+20 more)

### Community 9 - "debts.ts"
Cohesion: 0.06
Nodes (34): CUSTOMER_INSTALLMENT_MAX_PAGES, customerDebtDetailData, customerDebtDetailInput, customerDebtsData, customerDebtsInput, DEBT_DETAIL_MAX_INVOICES, INSTALLMENT_MAX_PAGES, aggregateCustomers() (+26 more)

### Community 10 - "formatNumber"
Cohesion: 0.12
Nodes (23): ChangeLine(), KpiChange, OrderDetailContent(), compact, pointLabel(), TrendChart(), TrendChartProps, TrendPoint (+15 more)

### Community 11 - "Qasir Order Histories (Web)"
Cohesion: 0.15
Nodes (13): `data.agg`, `data.sales[]`, `data.sales[].items[]`, Endpoint, Example request, Headers, Implementation notes, Observed `status` values (+5 more)

### Community 12 - "connect/routes.ts"
Cohesion: 0.05
Nodes (103): approvalsStubFor(), approvalPage(), ApprovalRoutesEnv, handleApprovalRoutes(), NoticeTone, assertConfigured(), assertCsrf(), b64url() (+95 more)

### Community 13 - "purchases.ts"
Cohesion: 0.10
Nodes (22): PAGE_SIZE, PO_STATUS_SCAN_PAGES, PoStatusFilter, purchaseOrderItemsData, purchaseOrderItemsInput, purchaseOrdersData, purchaseOrdersInput, purchaseOrdersPageData (+14 more)

### Community 14 - "widgets-smoke.ts"
Cohesion: 0.10
Nodes (25): built, hash, head, out, root, computeWidgetSourceHash(), listFiles(), WIDGET_SOURCE_DIRS (+17 more)

### Community 15 - "validate.ts"
Cohesion: 0.12
Nodes (30): checkArray(), checkBody(), checkBounds(), checkEnum(), checkObject(), checkPathParam(), checkValue(), coerce() (+22 more)

### Community 16 - "dates.ts"
Cohesion: 0.15
Nodes (21): daysOf(), rangeSearch(), CustomRangeFields(), customRangeSchema, PRESET_OPTIONS, PresetRangePicker(), PresetRangePickerProps, PresetRangeValue (+13 more)

### Community 17 - "bridge.ts"
Cohesion: 0.17
Nodes (17): ToolInput, ToolOutput, errorBodyFromText(), parseToolResult(), ToolCallError, ToolResultLike, toToolCallError(), TOOL_CALL_TIMEOUT_MS (+9 more)

### Community 18 - "penjualan.tsx"
Cohesion: 0.13
Nodes (31): compact(), rangeArgs(), searchFromToolArgs(), toolArgsFromSearch(), useBridge(), ErrorPanel(), ViewFrame(), formatTime() (+23 more)

### Community 19 - "operations.ts"
Cohesion: 0.14
Nodes (23): RFC-3339, CATALOG_OPS, countParam, dateRange, op(), pageCount, pageParam, MISC_OPS (+15 more)

### Community 20 - "mutation-tool.ts"
Cohesion: 0.15
Nodes (17): ApprovalRecord, hashArgs(), MutationApprovalsStub, MutationPreview, stableStringify(), AuthPrincipal, CodemodeDispatcher, approvalOrigin() (+9 more)

### Community 21 - "text.ts"
Cohesion: 0.15
Nodes (24): normalizeResponse(), PAGE_MARKERS, parseStockAdjustmentHtml(), ParseStockAdjustmentOptions, StockAdjustmentPage, StockAdjustmentRow, extractRowId(), PAGE_MARKERS (+16 more)

### Community 22 - "search.ts"
Cohesion: 0.14
Nodes (20): ViewName, VIEWS, customerIdParam, dateParam, DEBT_SORTS, DebtSort, DEFAULT_PRESET, outletIdParam (+12 more)

### Community 23 - "e2e-mcp.ts"
Cohesion: 0.13
Nodes (20): args, b64url(), BASE, check(), CONNECT, connectQasirSession(), cookiesFrom(), Jar (+12 more)

### Community 24 - "Execution lanes"
Cohesion: 0.10
Nodes (20): Execution lanes, File Structure, Global Constraints, MCP App Widgets (TanStack) Implementation Plan, Task 10: Widget bundle pipeline, Task 11: Registration, protocol and security tests, Task 12: Views Penjualan and Produk, Task 13: Views Stok and Pembelian (+12 more)

### Community 25 - "CookieJar"
Cohesion: 0.17
Nodes (12): CookieJar, domainMatches(), isQasirDomain(), isStoredCookie(), parseSetCookieHeaders(), pathMatches(), RFC-6265, StoredCookie (+4 more)

### Community 26 - "SessionStore"
Cohesion: 0.19
Nodes (5): SessionKeys, isStoredSession(), isV2Record(), sameRecord(), SessionStore

### Community 27 - "fixtures.ts"
Cohesion: 0.10
Nodes (24): AGING_BUCKET_KEYS, AGING_BUCKET_LABEL, AgingBucketKey, PO_STATUSES, ProductOrder, STOCK_MOVEMENT_TYPES, CATEGORIES, DEBT_CUSTOMERS (+16 more)

### Community 28 - "OrderDetailSheet.tsx"
Cohesion: 0.15
Nodes (12): OrderDetail, OrderDetailSheet(), OrderDetailSheetProps, Sheet(), SheetProps, StatusBadge(), StatusTone, buttonClass (+4 more)

### Community 29 - "devDependencies"
Cohesion: 0.08
Nodes (25): @cloudflare/workers-types, @modelcontextprotocol/client, devDependencies, @cloudflare/workers-types, @modelcontextprotocol/client, playwright-core, react, tailwindcss (+17 more)

### Community 30 - "compilerOptions"
Cohesion: 0.08
Nodes (24): dev, DOM, DOM.Iterable, ES2023, src, test, vite/client, vite.config.ts (+16 more)

### Community 31 - "define.ts"
Cohesion: 0.24
Nodes (12): toAppError(), errorCodeOf(), errorResult(), jsonErrorResult(), MCP_APP_LEGACY_RESOURCE_URI_KEY, createToolContext(), invokeWidgetTool(), registerWidgetTool() (+4 more)

### Community 32 - "compilerOptions"
Cohesion: 0.08
Nodes (23): @cloudflare/workers-types, ES2022, scripts/**, src/**/*.ts, tests/**/*.ts, worker-configuration.d.ts, compilerOptions, esModuleInterop (+15 more)

### Community 33 - "AppShell.tsx"
Cohesion: 0.09
Nodes (19): APP_INFO, AppShell(), atViewDefaults(), HostedShell(), InitialViewOptions, insetsStyle(), LATE_TOOL_INPUT_WAIT_MS, startInitialView() (+11 more)

### Community 34 - "query.test.tsx"
Cohesion: 0.14
Nodes (15): StandaloneShell(), createWidgetQueryClient(), NO_RETRY, shouldRetry(), createWidgetRouter(), NotFoundPanel(), WidgetRouter, BridgeContext (+7 more)

### Community 35 - "sales.ts"
Cohesion: 0.12
Nodes (18): isoDate, PRODUCT_ORDER_LABEL, productRankingInput, productRankingPageInput, salesDashboardInput, parsePercent(), categoriesRequest(), CategoryRow (+10 more)

### Community 36 - "session/types.ts"
Cohesion: 0.12
Nodes (10): CompositeSessionOptions, SessionEnv, QasirSessionsDO, SaveSessionInput, PendingAuthDraft, PendingAuthState, QasirSessionPublicStatus, QasirSessionSecrets (+2 more)

### Community 37 - "transaksi.tsx"
Cohesion: 0.12
Nodes (20): useMorePages(), ChipGroup(), ChipGroupBase, ChipGroupProps, ChipOption, salesStatusTone(), CUSTOMER_HISTORY_DAYS, DAY_HEADER_HEIGHT (+12 more)

### Community 38 - "scripts"
Cohesion: 0.09
Nodes (22): scripts, build, cf-typegen, check-types, coverage:report, coverage:validate, deploy, deploy:dry-run (+14 more)

### Community 39 - "widgets-define.test.ts"
Cohesion: 0.09
Nodes (26): listReadOperations(), QasirSessionProvider, ToolErrorBody, WIDGET_TOOL_ANNOTATIONS, WidgetToolDeps, ALLOWED_OPS, emptyReadHandlers(), NO_SCOPES (+18 more)

### Community 40 - "login-continue.ts"
Cohesion: 0.14
Nodes (28): extractCsrfFromHtml(), AuthContext, continueWithOutlet(), defaultFetch(), DEVICE_LANG_URL, FetchLike, followRedirectAndScrape(), LOGIN_URL (+20 more)

### Community 41 - "connect.test.ts"
Cohesion: 0.11
Nodes (19): buildDashboardRedirect(), LoginNextStep, matchConfiguredMerchant(), MatchConfiguredMerchantResult, normalizeMerchants(), normalizeOutlets(), ParsedLoginResponse, ParsedMerchant (+11 more)

### Community 42 - "redact.ts"
Cohesion: 0.14
Nodes (16): BUNDLED_DOCS, Frame, isPersonHeading(), PERSON_FIELDS, PERSON_JSON_FIELD, redactCodeSpans(), redactJsonNames(), redactRow() (+8 more)

### Community 43 - "session-store.test.ts"
Cohesion: 0.10
Nodes (7): PENDING_TTL_MS, SessionStorage, draft, ENC_ENV, KEY, MemoryStorage, RacyStorage

### Community 44 - "produk.tsx"
Cohesion: 0.18
Nodes (12): PRODUCT_ORDERS, ProdukSearch, BarList(), BarListItem, KpiTile(), LoadMoreFooter(), LoadMoreFooterProps, Skeleton() (+4 more)

### Community 45 - "piutang.tsx"
Cohesion: 0.08
Nodes (24): ColumnDef, dataColumnHelper(), DataColumnMeta, DataTable(), DataTableFeatures, DataTableProps, EmptyState(), SearchInput() (+16 more)

### Community 46 - "QasirDispatcher"
Cohesion: 0.24
Nodes (8): FixedSessionProvider, loadDevVars(), main(), mask(), summarizeProducts(), QasirDispatcher, createRequestSignals(), QasirSessionContext

### Community 47 - "AppError"
Cohesion: 0.15
Nodes (28): assertAllowedUrl(), assertSafeSlug(), FIXED_HOSTS, isQasirLoginUrl(), resolveHost(), applyQuery(), assertSafePathSegment(), buildPath() (+20 more)

### Community 48 - "stok.tsx"
Cohesion: 0.14
Nodes (19): useToolQuery(), OrderDetailBody(), COLD_LOAD_NOTE, coverLabel(), isOutOfStock(), isStale(), Movement, MOVEMENT_COLUMNS (+11 more)

### Community 49 - "testHelpers.tsx"
Cohesion: 0.17
Nodes (16): FIXTURES, createMockBridge(), LAYOUT_PROPS, makeBridge(), originalLayout, PurchaseRow, ARGS, ARGS (+8 more)

### Community 50 - "scenarios.test.ts"
Cohesion: 0.09
Nodes (19): createSpecBundle(), exposedReadIds(), buildOperationCatalog(), listExposedOperations(), listMutationOperations(), fixtures, PRODUCTS, PURCHASES (+11 more)

### Community 51 - "transactions.ts"
Cohesion: 0.12
Nodes (42): isAppErrorLike(), salesStatusLabel(), transactionsInput, parseIndonesianDate(), parseQasirDateTime(), isRecord(), toNumber(), toNumberOrNull() (+34 more)

### Community 52 - "openapi.ts"
Cohesion: 0.22
Nodes (14): checkOpenApi(), OpenApiOperation, UNSUPPORTED_EVIDENCE, buildOpenApiDocument(), HOST_URLS, hostBaseUrl(), operationToOpenApi(), pathParamsOnly() (+6 more)

### Community 53 - "session-store.ts"
Cohesion: 0.13
Nodes (21): b64Decode(), b64Encode(), Ciphertext, decryptJson(), enc, EncryptedBlobV1, encryptJson(), importSessionKeys() (+13 more)

### Community 54 - "MCP App widgets (TanStack) — design"
Cohesion: 0.12
Nodes (16): 1. Goal, 2. Verified facts this design relies on, 3.1 Layout, 3.2 Serving, 3.3 Widget runtime, 3. Architecture, 4.1 Rules for every new tool, 4.2 View tools (model-visible, `_meta.ui.resourceUri` set) (+8 more)

### Community 55 - "coverage.test.ts"
Cohesion: 0.13
Nodes (20): checkCoverage(), buildCoverageManifest(), coverageKey(), coverageSummary(), HTML_ADAPTERS, OPERATION_CONTRACT_TEST, operationEntry(), cell() (+12 more)

### Community 56 - "codes.ts"
Cohesion: 0.18
Nodes (7): ErrorCodes, KNOWN_CODES, statusFor(), DEFAULT_WIDGET_LIMITS, RequestBudget, RequestBudgetLimits, budget()

### Community 57 - "Qasir Purchases"
Cohesion: 0.13
Nodes (15): Confirm / cancel (from `app.min.js`, not this capture’s Network), Dashboard HTML, `data.purchases[]`, Endpoint, Example request, Headers, Implementation notes, Line items (+7 more)

### Community 58 - "Qasir Users"
Cohesion: 0.13
Nodes (15): `data.access[]`, `data.is_limit`, `data.users[]`, `data.users[].outlets[]`, Endpoint, Example request, Headers, `image_file` (+7 more)

### Community 59 - "mockBridge.ts"
Cohesion: 0.21
Nodes (11): answer(), host, isToolName(), SmokeMountOptions, Window, TOOL_SCHEMAS, ToolName, HostInfo (+3 more)

### Community 60 - "paste.ts"
Cohesion: 0.26
Nodes (11): extractApiTokenFromHtml(), isApiTokenShape(), isCsrfTokenShape(), metaContent(), metaTags(), PATTERNS, normalizeCookie(), PasteSessionInput (+3 more)

### Community 61 - "dispatcher.test.ts"
Cohesion: 0.25
Nodes (4): dispatcher(), FetchArgs, fixtures, mockSession()

### Community 62 - "pembelian.tsx"
Cohesion: 0.21
Nodes (13): PO_STATUS_FILTERS, rootRoute, COLUMNS, combinedStatusCounts(), newPagedRows(), PembelianPage(), pembelianRoute(), PurchaseArgs (+5 more)

### Community 63 - "exclusions.ts"
Cohesion: 0.31
Nodes (8): excluded(), EXCLUSIONS, Method, NonOpEntry, SESSION_ONLY, sessionOnly(), AuthProfile, SafetyClass

### Community 65 - "dispatcher-transport.test.ts"
Cohesion: 0.17
Nodes (5): DispatcherLimits, FetchArgs, Handler, LIST, setup()

### Community 66 - "dependencies"
Cohesion: 0.18
Nodes (11): agents, @cloudflare/codemode, @cloudflare/workers-oauth-provider, @modelcontextprotocol/server, dependencies, agents, @cloudflare/codemode, @cloudflare/workers-oauth-provider (+3 more)

### Community 67 - "2. Product picker — stock-turnover"
Cohesion: 0.14
Nodes (14): 1. History table (the page), 2. Product picker — stock-turnover, 3. Save — bulk inventories, `data.variants[]`, Example request, Headers, Implementation notes, JSON list probe (+6 more)

### Community 69 - "tsconfig.scripts.json"
Cohesion: 0.22
Nodes (8): scripts/**/*.ts, ./tsconfig.json, compilerOptions, types, exclude, extends, include, node

### Community 70 - "Qasir Reports"
Cohesion: 0.15
Nodes (13): Attendance, Breakdowns, Endpoint prefix, Example request, Headers, Implementation notes, Microsite visits, Not observed on load (+5 more)

### Community 71 - "connect-routes.test.ts"
Cohesion: 0.18
Nodes (9): Call, doFor(), fixtures, installQasir(), load(), MemoryStorage, namespace(), post() (+1 more)

### Community 72 - "Qasir dashboard routes"
Cohesion: 0.15
Nodes (13): Auth, Chrome XHR (every page), Crawl stats, Customer survey, Dashboard-only APIs, Ingredients / recipes, JSON lists that the HTML page does **not** call, Mutations (from `app.min.js`, not fired on crawl) (+5 more)

### Community 73 - "package.json"
Cohesion: 0.29
Nodes (6): engines, node, name, private, type, version

### Community 74 - "cloudflare-workers.ts"
Cohesion: 0.29
Nodes (4): DurableObject, env, RpcTarget, WorkerEntrypoint

### Community 75 - "Qasir Products"
Cohesion: 0.17
Nodes (12): Dashboard HTML (the `/products` page), Endpoint, Example request, Headers, Implementation notes, Inventories list (not documented here), Pagination, Qasir Products (+4 more)

### Community 77 - "Durable Objects Storage Model"
Cohesion: 0.50
Nodes (4): Durable Objects Storage Model, IP and User Rate Limiting, AES-GCM Session Encryption and AAD Binding, Single Merchant Shared Session Model

### Community 78 - "Execute Mutation Two-Call Workflow"
Cohesion: 0.67
Nodes (3): Mutation Enablement Workflow, Four-Gate Mutation Security Model, Execute Mutation Two-Call Workflow

### Community 79 - "Customer Profile Data Model"
Cohesion: 0.67
Nodes (3): Customer Profile Data Model, Credit Sales and Customer Debt Tracking, Legacy Receipt Cart and Payment Model

### Community 80 - "Widget View Tools Specification"
Cohesion: 0.67
Nodes (3): Widget App-Only Helper Tools, Widget View Tools Specification, MCP Interactive Widget Views

### Community 92 - "Qasir Suppliers"
Cohesion: 0.20
Nodes (10): Endpoint (the page), Example request, Headers, Implementation notes, JSON probes (failed), Qasir Suppliers, Query parameters, Response (+2 more)

### Community 128 - "`data.products[].variants[]`"
Cohesion: 0.29
Nodes (7): `data.products[]`, `data.products[].images`, `data.products[].variants[]`, Response, `variants[].images`, `variants[].stock`, `variants[].unit_label`

### Community 129 - "Q: Why does ToolOutput connect Bridge Toolinput across 17 different widget, route, and fixture communities?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Why does ToolOutput connect Bridge Toolinput across 17 different widget, route, and fixture communities?, Source Nodes

## Knowledge Gaps
- **624 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+619 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **56 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppError` connect `AppError` to `contract.ts`, `codemode-harness.ts`, `run.ts`, `widgets-sales.test.ts`, `stock.ts`, `qasir-dates.ts`, `server.ts`, `debts.ts`, `connect/routes.ts`, `purchases.ts`, `validate.ts`, `mutation-tool.ts`, `text.ts`, `define.ts`, `session/types.ts`, `widgets-define.test.ts`, `login-continue.ts`, `connect.test.ts`, `QasirDispatcher`, `scenarios.test.ts`, `transactions.ts`, `session-store.ts`, `codes.ts`, `paste.ts`, `dispatcher.test.ts`, `MutationApprovalsDO`, `ExecutionBudget`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._
- **Why does `ErrorCodes` connect `codes.ts` to `contract.ts`, `codemode-harness.ts`, `run.ts`, `widgets-sales.test.ts`, `stock.ts`, `qasir-dates.ts`, `server.ts`, `debts.ts`, `connect/routes.ts`, `purchases.ts`, `validate.ts`, `mutation-tool.ts`, `text.ts`, `define.ts`, `session/types.ts`, `widgets-define.test.ts`, `connect.test.ts`, `AppError`, `scenarios.test.ts`, `transactions.ts`, `session-store.ts`, `paste.ts`, `dispatcher.test.ts`, `dispatcher-transport.test.ts`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Why does `log()` connect `connect/routes.ts` to `run.ts`, `server.ts`, `QasirDispatcher`, `AppError`, `mutation-tool.ts`, `session-store.ts`, `SessionStore`, `define.ts`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `handleConnectRoutes()` (e.g. with `.clear()` and `.clearPending()`) actually correct?**
  _`handleConnectRoutes()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _624 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `contract.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04242424242424243 - nodes in this community are weakly interconnected._
- **Should `run.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09146341463414634 - nodes in this community are weakly interconnected._