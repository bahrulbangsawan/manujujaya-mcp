# Graph Report - manujujaya-mcp  (2026-09-16)

## Corpus Check
- 234 files · ~266,025 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2035 nodes · 5294 edges · 146 communities (91 shown, 55 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 97 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `95c37405`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- connect/routes.ts
- formatNumber
- qasir-dispatcher.ts
- widgets-define.test.ts
- contract.ts
- widgets-stock.test.ts
- transactions.ts
- AppError
- penjualan.tsx
- stock.ts
- transaksi.tsx
- widgets-sales.test.ts
- scripts
- AppShell.tsx
- fixtures.ts
- session/types.ts
- CookieJar
- dates.ts
- server.ts
- validate.ts
- connect.test.ts
- session-store.test.ts
- piutang.tsx
- stok.tsx
- widget-harness.ts
- SessionStore
- API Coverage Manifest
- e2e-mcp.ts
- piutang.test.tsx
- compilerOptions
- validate-coverage.ts
- login-continue.ts
- operations.ts
- mcp/resources.ts
- MutationApprovalsStub
- QasirSessionContext
- redact.ts
- sales.ts
- text.ts
- Execution lanes
- Qasir Products
- connect-login.test.ts
- registry/types.ts
- openapi.ts
- crypto.ts
- MCP App widgets (TanStack) — design
- devDependencies
- scenarios.test.ts
- debts.ts
- Qasir Purchases
- Qasir Users
- compilerOptions
- Qasir Order Histories (Web)
- Qasir Reports
- Qasir dashboard routes
- 2. Product picker — stock-turnover
- QasirDispatcher
- widgets-smoke.ts
- coverage.test.ts
- Qasir Suppliers
- purchases.ts
- tsconfig.scripts.json
- manujujaya-mcp
- bridge.ts
- search.ts
- cloudflare-workers.ts
- produk.tsx
- MemoryStorage
- testHelpers.tsx
- Q: Why does ToolOutput connect Bridge Toolinput across 17 different widget, route, and fixture communities?
- query.test.tsx
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
- codes.ts
- @modelcontextprotocol/ext-apps
- mockBridge.ts
- @tanstack/react-form
- connect-routes.test.ts
- @tanstack/react-router
- @tanstack/react-table
- @testing-library/dom
- paste.ts
- @types/react
- upstream.ts
- typescript
- vite
- vite-plugin-singlefile
- @vitejs/plugin-react
- dispatcher-transport.test.ts
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
- pembelian.tsx
- `data.products[].variants[]`
- package.json
- happy-dom
- react-dom
- @tailwindcss/vite
- @tanstack/react-virtual
- ToolOutput
- QasirSessionsDO
- ChipGroup.tsx
- widgets/resources.ts

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
- `setup()` --calls--> `QasirDispatcher`  [EXTRACTED]
  tests/unit/dispatcher-transport.test.ts → src/dispatcher/qasir-dispatcher.ts
- `upstream404()` --calls--> `AppError`  [EXTRACTED]
  tests/unit/widgets-stock.test.ts → src/errors/codes.ts
- `Call` --calls--> `handleConnectRoutes()`  [EXTRACTED]
  tests/unit/connect-routes.test.ts → src/connect/routes.ts
- `mockDo()` --calls--> `sha256Hex()`  [EXTRACTED]
  tests/unit/connect.test.ts → src/session/crypto.ts
- `Qasir Dashboard Session Connect` --implements--> `Qasir Connect Architecture and Guide`  [INFERRED]
  README.md → docs/connect-qasir.md

## Import Cycles
- 3-file cycle: `widgets/src/app/router.tsx -> widgets/src/routes/index.ts -> widgets/src/routes/transaksi.tsx -> widgets/src/app/router.tsx`
- 3-file cycle: `widgets/src/app/router.tsx -> widgets/src/routes/index.ts -> widgets/src/routes/produk.tsx -> widgets/src/app/router.tsx`
- 3-file cycle: `widgets/src/app/router.tsx -> widgets/src/routes/index.ts -> widgets/src/routes/piutang.tsx -> widgets/src/app/router.tsx`
- 3-file cycle: `widgets/src/app/router.tsx -> widgets/src/routes/index.ts -> widgets/src/routes/pembelian.tsx -> widgets/src/app/router.tsx`
- 3-file cycle: `widgets/src/app/router.tsx -> widgets/src/routes/index.ts -> widgets/src/routes/stok.tsx -> widgets/src/app/router.tsx`
- 3-file cycle: `widgets/src/app/router.tsx -> widgets/src/routes/index.ts -> widgets/src/routes/penjualan.tsx -> widgets/src/app/router.tsx`
- 4-file cycle: `widgets/src/app/router.tsx -> widgets/src/routes/index.ts -> widgets/src/routes/piutang.tsx -> widgets/src/routes/transaksi.tsx -> widgets/src/app/router.tsx`

## Hyperedges (group relationships)
- **Qasir Connect Session Lifecycle** — docs_auth_login_qasir_auth_login_spec, docs_connect_qasir_connect_login_flow, docs_architecture_overview_durable_objects_storage, docs_architecture_security_session_encryption [INFERRED 0.95]
- **Two-Call Mutation Approval Pipeline** — docs_mcp_tools_execute_mutation_spec, docs_architecture_security_mutation_gates, docs_architecture_operations_mutation_enablement, docs_architecture_overview_durable_objects_storage [INFERRED 0.95]

## Communities (146 total, 55 thin omitted)

### Community 0 - "connect/routes.ts"
Cohesion: 0.06
Nodes (92): approvalsStubFor(), approvalPage(), ApprovalRoutesEnv, handleApprovalRoutes(), NoticeTone, assertConfigured(), assertCsrf(), b64url() (+84 more)

### Community 1 - "formatNumber"
Cohesion: 0.13
Nodes (23): OrderDetailContent(), compact, pointLabel(), TrendChart(), TrendChartProps, TrendPoint, dateFormat, dateTimeFormat (+15 more)

### Community 2 - "qasir-dispatcher.ts"
Cohesion: 0.22
Nodes (15): assertAllowedUrl(), assertSafeSlug(), FIXED_HOSTS, resolveHost(), applyQuery(), assertSafePathSegment(), buildPath(), resolveUrl() (+7 more)

### Community 3 - "widgets-define.test.ts"
Cohesion: 0.09
Nodes (46): VIEW_MARKER, WIDGET_TOOL_ANNOTATIONS, execute(), capabilities(), WIDGET_TOOLS, call(), handlerFor(), ToolInfo (+38 more)

### Community 4 - "contract.ts"
Cohesion: 0.05
Nodes (39): APP_TOOL, categoryRow, changeSchema, dateRange, debtBucket, debtCustomer, debtInvoice, endDate (+31 more)

### Community 5 - "widgets-stock.test.ts"
Cohesion: 0.09
Nodes (15): stockBrowserData, stockHistoryData, stockPageData, stockVelocityData, stockBrowserTool, stockHistoryTool, stockPageTool, stockVelocityTool (+7 more)

### Community 6 - "transactions.ts"
Cohesion: 0.12
Nodes (42): isAppErrorLike(), PAGE_SIZE, salesStatusLabel(), transactionsInput, parseIndonesianDate(), parseQasirDateTime(), isRecord(), toNumber() (+34 more)

### Community 7 - "AppError"
Cohesion: 0.10
Nodes (29): CodemodeLimits, DEFAULT_CODEMODE_LIMITS, ExecutionBudget, clip(), executorFailure(), KNOWN_CODES, SandboxErrorBridge, timeoutError() (+21 more)

### Community 8 - "penjualan.tsx"
Cohesion: 0.18
Nodes (26): compact(), searchFromToolArgs(), toolArgsFromSearch(), useBridge(), useToolQuery(), ViewFrame(), Change, changeText() (+18 more)

### Community 9 - "stock.ts"
Cohesion: 0.10
Nodes (27): stockBrowserInput, stockHistoryInput, stockPageInput, stockVelocityInput, VELOCITY_MAX_PAGES, VELOCITY_WINDOW_DAYS, rankingPageText(), clipText() (+19 more)

### Community 10 - "transaksi.tsx"
Cohesion: 0.07
Nodes (36): BarList(), BarListItem, EmptyState(), ErrorPanel(), ChangeLine(), KpiChange, KpiTile(), LoadMoreFooter() (+28 more)

### Community 11 - "widgets-sales.test.ts"
Cohesion: 0.06
Nodes (34): customerDebtDetailData, customerDebtsData, PRODUCT_ORDER_SORT, productRankingData, productRankingPageData, salesDashboardData, customerDebtDetailTool, customerDebtsTool (+26 more)

### Community 12 - "scripts"
Cohesion: 0.09
Nodes (22): scripts, build, cf-typegen, check-types, coverage:report, coverage:validate, deploy, deploy:dry-run (+14 more)

### Community 13 - "AppShell.tsx"
Cohesion: 0.12
Nodes (18): APP_INFO, AppShell(), atViewDefaults(), HostedShell(), insetsStyle(), LATE_TOOL_INPUT_WAIT_MS, startInitialView(), TOOL_INPUT_WAIT_MS (+10 more)

### Community 14 - "fixtures.ts"
Cohesion: 0.11
Nodes (22): AGING_BUCKET_LABEL, PO_STATUSES, ProductOrder, STOCK_MOVEMENT_TYPES, CATEGORIES, DEBT_CUSTOMERS, FIXTURE_OUTLET_ID, FIXTURE_TODAY (+14 more)

### Community 15 - "session/types.ts"
Cohesion: 0.18
Nodes (13): CompositeSessionOptions, SessionEnv, PlainRecord, RateEntry, RecordKind, SaveSessionInput, SealedRecord, PendingAuthDraft (+5 more)

### Community 16 - "CookieJar"
Cohesion: 0.15
Nodes (13): CookieJar, domainMatches(), isQasirDomain(), isStoredCookie(), parseSetCookieHeaders(), pathMatches(), RFC-6265, wwwCsrfFrom() (+5 more)

### Community 17 - "dates.ts"
Cohesion: 0.15
Nodes (21): daysOf(), rangeSearch(), CustomRangeFields(), customRangeSchema, PRESET_OPTIONS, PresetRangePicker(), PresetRangePickerProps, PresetRangeValue (+13 more)

### Community 18 - "server.ts"
Cohesion: 0.10
Nodes (38): APPROVAL_TTL_MS, ApprovalRecord, hashArgs(), MutationPreview, stableStringify(), hasScope(), Scope, SCOPES (+30 more)

### Community 19 - "validate.ts"
Cohesion: 0.12
Nodes (31): OPERATIONS, checkArray(), checkBody(), checkBounds(), checkEnum(), checkObject(), checkPathParam(), checkValue() (+23 more)

### Community 20 - "connect.test.ts"
Cohesion: 0.15
Nodes (18): buildDashboardRedirect(), LoginNextStep, matchConfiguredMerchant(), MatchConfiguredMerchantResult, normalizeMerchants(), normalizeOutlets(), ParsedLoginResponse, ParsedMerchant (+10 more)

### Community 21 - "session-store.test.ts"
Cohesion: 0.10
Nodes (7): PENDING_TTL_MS, SessionStorage, draft, ENC_ENV, KEY, MemoryStorage, RacyStorage

### Community 22 - "piutang.tsx"
Cohesion: 0.13
Nodes (17): rootRoute, VIEW_ROUTES, bucketClass(), col, DEBT_SORT_LABEL, DebtCustomer, DebtDetail, DebtsArgs (+9 more)

### Community 23 - "stok.tsx"
Cohesion: 0.12
Nodes (19): SearchInput(), SearchInputProps, COLD_LOAD_NOTE, coverLabel(), isOutOfStock(), isStale(), Movement, MOVEMENT_COLUMNS (+11 more)

### Community 24 - "widget-harness.ts"
Cohesion: 0.16
Nodes (17): AuthPrincipal, CodemodeDispatcher, DispatchRequest, DispatchResult, MutationToolDeps, ServerDeps, QasirSessionProvider, ToolErrorBody (+9 more)

### Community 25 - "SessionStore"
Cohesion: 0.16
Nodes (7): SessionCryptoEnv, SessionKeys, isPendingState(), isStoredSession(), isV2Record(), sameRecord(), SessionStore

### Community 26 - "API Coverage Manifest"
Cohesion: 0.12
Nodes (26): API Coverage Manifest, Legacy 2025 MCP Client Handling, Operations Runbook, Architecture Overview, MCP Request Processing Flow, MCP Client OAuth Controls, Security Model and Trust Boundaries, Local Dev PSK Bypass (+18 more)

### Community 27 - "e2e-mcp.ts"
Cohesion: 0.13
Nodes (20): args, b64url(), BASE, check(), CONNECT, connectQasirSession(), cookiesFrom(), Jar (+12 more)

### Community 28 - "piutang.test.tsx"
Cohesion: 0.16
Nodes (12): StandaloneShell(), createWidgetQueryClient(), NO_RETRY, shouldRetry(), createWidgetRouter(), NotFoundPanel(), MockBridge, TransactionDay (+4 more)

### Community 29 - "compilerOptions"
Cohesion: 0.08
Nodes (24): dev, DOM, DOM.Iterable, ES2023, src, test, vite/client, vite.config.ts (+16 more)

### Community 30 - "validate-coverage.ts"
Cohesion: 0.14
Nodes (17): lines, out, root, docEndpoints, docs, problems, root, summary (+9 more)

### Community 31 - "login-continue.ts"
Cohesion: 0.24
Nodes (17): AuthContext, continueWithOutlet(), defaultFetch(), DEVICE_LANG_URL, FetchLike, LOGIN_URL, loginBody(), LoginFlowResult (+9 more)

### Community 32 - "operations.ts"
Cohesion: 0.13
Nodes (25): RFC-3339, exposedReadIds(), buildOperationCatalog(), listExposedOperations(), listMutationOperations(), listReadOperations(), CATALOG_OPS, countParam (+17 more)

### Community 33 - "mcp/resources.ts"
Cohesion: 0.33
Nodes (9): CapabilitiesInfo, capabilitiesPayload(), DOC_NAMES, DOC_SET, docUri(), jsonContents(), registerResources(), buildCoverageManifest() (+1 more)

### Community 35 - "QasirSessionContext"
Cohesion: 0.18
Nodes (5): FixedSessionProvider, CompositeQasirSessionProvider, readSecrets(), StaticQasirSessionProvider, QasirSessionContext

### Community 36 - "redact.ts"
Cohesion: 0.13
Nodes (17): BUNDLED_DOCS, Frame, isPersonHeading(), PERSON_FIELDS, PERSON_JSON_FIELD, redactCodeSpans(), redactJsonNames(), redactRow() (+9 more)

### Community 37 - "sales.ts"
Cohesion: 0.10
Nodes (24): isoDate, PRODUCT_ORDER_LABEL, productRankingInput, productRankingPageInput, salesDashboardInput, parsePercent(), WidgetToolDef, categoriesRequest() (+16 more)

### Community 38 - "text.ts"
Cohesion: 0.16
Nodes (23): PAGE_MARKERS, parseStockAdjustmentHtml(), ParseStockAdjustmentOptions, StockAdjustmentPage, StockAdjustmentRow, extractRowId(), PAGE_MARKERS, parseSuppliersHtml() (+15 more)

### Community 39 - "Execution lanes"
Cohesion: 0.10
Nodes (20): Execution lanes, File Structure, Global Constraints, MCP App Widgets (TanStack) Implementation Plan, Task 10: Widget bundle pipeline, Task 11: Registration, protocol and security tests, Task 12: Views Penjualan and Produk, Task 13: Views Stok and Pembelian (+12 more)

### Community 40 - "Qasir Products"
Cohesion: 0.17
Nodes (12): Dashboard HTML (the `/products` page), Endpoint, Example request, Headers, Implementation notes, Inventories list (not documented here), Pagination, Qasir Products (+4 more)

### Community 41 - "connect-login.test.ts"
Cohesion: 0.19
Nodes (12): loadDevVars(), main(), mask(), summarizeProducts(), runQasirLoginFlow(), normalizeUsername(), fixtures, Handler (+4 more)

### Community 42 - "registry/types.ts"
Cohesion: 0.16
Nodes (15): HTML_ADAPTERS, OPERATION_CONTRACT_TEST, operationEntry(), excluded(), EXCLUSIONS, Method, NonOpEntry, SESSION_ONLY (+7 more)

### Community 43 - "openapi.ts"
Cohesion: 0.23
Nodes (13): checkOpenApi(), OpenApiOperation, UNSUPPORTED_EVIDENCE, buildOpenApiDocument(), HOST_URLS, hostBaseUrl(), operationToOpenApi(), pathParamsOnly() (+5 more)

### Community 44 - "crypto.ts"
Cohesion: 0.21
Nodes (14): b64Decode(), b64Encode(), Ciphertext, decryptJson(), enc, EncryptedBlobV1, encryptJson(), importSessionKeys() (+6 more)

### Community 45 - "MCP App widgets (TanStack) — design"
Cohesion: 0.12
Nodes (16): 1. Goal, 2. Verified facts this design relies on, 3.1 Layout, 3.2 Serving, 3.3 Widget runtime, 3. Architecture, 4.1 Rules for every new tool, 4.2 View tools (model-visible, `_meta.ui.resourceUri` set) (+8 more)

### Community 46 - "devDependencies"
Cohesion: 0.08
Nodes (25): @cloudflare/workers-types, @modelcontextprotocol/client, devDependencies, @cloudflare/workers-types, @modelcontextprotocol/client, playwright-core, react, tailwindcss (+17 more)

### Community 47 - "scenarios.test.ts"
Cohesion: 0.09
Nodes (14): fixtures, PRODUCTS, PURCHASES, spec, spec, execute(), spec, MERCHANT_SLUG (+6 more)

### Community 48 - "debts.ts"
Cohesion: 0.08
Nodes (38): AGING_BUCKET_KEYS, AgingBucketKey, CUSTOMER_INSTALLMENT_MAX_PAGES, customerDebtDetailInput, customerDebtsInput, DEBT_DETAIL_MAX_INVOICES, DEBT_SCAN_START_DATE, INSTALLMENT_MAX_PAGES (+30 more)

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

### Community 56 - "QasirDispatcher"
Cohesion: 0.18
Nodes (5): QasirDispatcher, dispatcher(), FetchArgs, fixtures, mockSession()

### Community 57 - "widgets-smoke.ts"
Cohesion: 0.11
Nodes (24): built, hash, head, out, root, computeWidgetSourceHash(), listFiles(), WIDGET_SOURCE_DIRS (+16 more)

### Community 58 - "coverage.test.ts"
Cohesion: 0.17
Nodes (14): checkCoverage(), coverageKey(), cell(), code(), renderCoverageMarkdown(), SAFETY_LABEL, Summary, CoverageEntry (+6 more)

### Community 59 - "Qasir Suppliers"
Cohesion: 0.20
Nodes (10): Endpoint (the page), Example request, Headers, Implementation notes, JSON probes (failed), Qasir Suppliers, Query parameters, Response (+2 more)

### Community 60 - "purchases.ts"
Cohesion: 0.08
Nodes (31): pageInput, PO_STATUS_SCAN_PAGES, PoStatusFilter, purchaseOrderItemsData, purchaseOrderItemsInput, purchaseOrdersData, purchaseOrdersInput, purchaseOrdersPageData (+23 more)

### Community 61 - "tsconfig.scripts.json"
Cohesion: 0.22
Nodes (8): scripts/**/*.ts, ./tsconfig.json, compilerOptions, types, exclude, extends, include, node

### Community 62 - "manujujaya-mcp"
Cohesion: 0.50
Nodes (3): Development Commands, graphify, manujujaya-mcp

### Community 64 - "bridge.ts"
Cohesion: 0.18
Nodes (9): BridgeContext, errorBodyFromText(), ToolCallError, ToolResultLike, toToolCallError(), MorePages, errorCopy, safeHttpUrl() (+1 more)

### Community 65 - "search.ts"
Cohesion: 0.11
Nodes (25): PO_STATUS_FILTERS, PRODUCT_ORDERS, VIEW_TOOL, ViewName, VIEWS, customerIdParam, dateParam, DEBT_SORTS (+17 more)

### Community 66 - "cloudflare-workers.ts"
Cohesion: 0.29
Nodes (4): DurableObject, env, RpcTarget, WorkerEntrypoint

### Community 67 - "produk.tsx"
Cohesion: 0.14
Nodes (13): ColumnDef, dataColumnHelper(), DataColumnMeta, DataTable(), DataTableFeatures, DataTableProps, COLUMNS, ORDER_OPTIONS (+5 more)

### Community 69 - "testHelpers.tsx"
Cohesion: 0.17
Nodes (16): FIXTURES, createMockBridge(), LAYOUT_PROPS, makeBridge(), originalLayout, PurchaseRow, ARGS, ARGS (+8 more)

### Community 70 - "Q: Why does ToolOutput connect Bridge Toolinput across 17 different widget, route, and fixture communities?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Why does ToolOutput connect Bridge Toolinput across 17 different widget, route, and fixture communities?, Source Nodes

### Community 71 - "query.test.tsx"
Cohesion: 0.23
Nodes (7): InitialViewOptions, parseToolResult(), InitialToolCall, isToolResultLike(), primeInitialQuery(), seedInitialResult(), toolQueryKey()

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

### Community 86 - "codes.ts"
Cohesion: 0.13
Nodes (18): toAppError(), ErrorCodes, KNOWN_CODES, statusFor(), errorCodeOf(), errorResult(), jsonErrorResult(), DEFAULT_WIDGET_LIMITS (+10 more)

### Community 88 - "mockBridge.ts"
Cohesion: 0.21
Nodes (11): answer(), host, isToolName(), SmokeMountOptions, Window, TOOL_SCHEMAS, ToolName, HostInfo (+3 more)

### Community 90 - "connect-routes.test.ts"
Cohesion: 0.18
Nodes (9): Call, doFor(), fixtures, installQasir(), load(), MemoryStorage, namespace(), post() (+1 more)

### Community 94 - "paste.ts"
Cohesion: 0.24
Nodes (13): extractApiTokenFromHtml(), extractCsrfFromHtml(), isApiTokenShape(), isCsrfTokenShape(), metaContent(), metaTags(), PATTERNS, followRedirectAndScrape() (+5 more)

### Community 96 - "upstream.ts"
Cohesion: 0.25
Nodes (13): isQasirLoginUrl(), abortError(), createRequestSignals(), discardBody(), fetchUpstream(), guardedFetch(), readBodyCapped(), REDIRECT_STATUSES (+5 more)

### Community 101 - "dispatcher-transport.test.ts"
Cohesion: 0.17
Nodes (5): DispatcherLimits, FetchArgs, Handler, LIST, setup()

### Community 102 - "dependencies"
Cohesion: 0.18
Nodes (11): agents, @cloudflare/codemode, @cloudflare/workers-oauth-provider, @modelcontextprotocol/server, dependencies, agents, @cloudflare/codemode, @cloudflare/workers-oauth-provider (+3 more)

### Community 135 - "pembelian.tsx"
Cohesion: 0.23
Nodes (12): PageToolName, useMorePages(), COLUMNS, combinedStatusCounts(), newPagedRows(), PembelianPage(), pembelianRoute(), PurchaseArgs (+4 more)

### Community 136 - "`data.products[].variants[]`"
Cohesion: 0.29
Nodes (7): `data.products[]`, `data.products[].images`, `data.products[].variants[]`, Response, `variants[].images`, `variants[].stock`, `variants[].unit_label`

### Community 137 - "package.json"
Cohesion: 0.29
Nodes (6): engines, node, name, private, type, version

### Community 142 - "ToolOutput"
Cohesion: 0.22
Nodes (4): ToolInput, ToolOutput, Bridge, TOOL_CALL_TIMEOUT_MS

### Community 144 - "ChipGroup.tsx"
Cohesion: 0.28
Nodes (6): ChipGroup(), ChipGroupBase, ChipGroupProps, ChipOption, options, Status

### Community 145 - "widgets/resources.ts"
Cohesion: 0.38
Nodes (6): MCP_APP_MIME_TYPE, viewResourceUri(), registerWidgetResources(), renderViewHtml(), VIEW_RESOURCE_LABEL, WIDGET_RESOURCE_TTL_MS

## Knowledge Gaps
- **626 isolated node(s):** `Development Commands`, `graphify`, `OwnerIdentity`, `GrantProps`, `BarListItem` (+621 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **55 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppError` connect `AppError` to `connect/routes.ts`, `qasir-dispatcher.ts`, `widgets-define.test.ts`, `contract.ts`, `widgets-stock.test.ts`, `transactions.ts`, `widgets-sales.test.ts`, `session/types.ts`, `server.ts`, `validate.ts`, `connect.test.ts`, `login-continue.ts`, `MutationApprovalsStub`, `QasirSessionContext`, `text.ts`, `crypto.ts`, `scenarios.test.ts`, `debts.ts`, `QasirDispatcher`, `purchases.ts`, `codes.ts`, `paste.ts`, `upstream.ts`?**
  _High betweenness centrality (0.127) - this node is a cross-community bridge._
- **Why does `ErrorCodes` connect `codes.ts` to `connect/routes.ts`, `qasir-dispatcher.ts`, `widgets-define.test.ts`, `contract.ts`, `widgets-stock.test.ts`, `transactions.ts`, `AppError`, `widgets-sales.test.ts`, `session/types.ts`, `server.ts`, `validate.ts`, `connect.test.ts`, `text.ts`, `crypto.ts`, `scenarios.test.ts`, `debts.ts`, `QasirDispatcher`, `purchases.ts`, `paste.ts`, `upstream.ts`, `dispatcher-transport.test.ts`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `ToolOutput` connect `ToolOutput` to `contract.ts`, `widgets-stock.test.ts`, `transactions.ts`, `pembelian.tsx`, `penjualan.tsx`, `stock.ts`, `transaksi.tsx`, `widgets-sales.test.ts`, `fixtures.ts`, `piutang.tsx`, `stok.tsx`, `piutang.test.tsx`, `sales.ts`, `debts.ts`, `purchases.ts`, `bridge.ts`, `produk.tsx`, `testHelpers.tsx`, `mockBridge.ts`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `handleConnectRoutes()` (e.g. with `.clear()` and `.clearPending()`) actually correct?**
  _`handleConnectRoutes()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Development Commands`, `graphify`, `OwnerIdentity` to the rest of the system?**
  _626 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `connect/routes.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0568234746157429 - nodes in this community are weakly interconnected._
- **Should `formatNumber` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._