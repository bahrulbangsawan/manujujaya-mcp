# Graph Report - manujujaya-mcp  (2026-09-16)

## Corpus Check
- 235 files · ~268,572 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2068 nodes · 5335 edges · 148 communities (89 shown, 59 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 97 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b14607a2`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- AppShell.tsx
- bridge.ts
- AppError
- codemode-harness.ts
- contract.ts
- widgets-stock.test.ts
- transactions.ts
- codes.ts
- pembelian.tsx
- stock.ts
- OrderDetailSheet.tsx
- widgets-sales.test.ts
- scripts
- transaksi.tsx
- define.ts
- session/types.ts
- login-continue.ts
- search.ts
- server.ts
- validate.ts
- owner-routes.ts
- session-store.test.ts
- src/index.ts
- produk.tsx
- widget-tools.test.ts
- SessionStore
- API Coverage Manifest
- e2e-mcp.ts
- connect/html.ts
- compilerOptions
- coverage.test.ts
- ExecutionBudget
- operations.ts
- mcp/resources.ts
- MutationApprovalsDO
- connect/routes.ts
- redact.ts
- validate-coverage.ts
- text.ts
- Execution lanes
- Qasir Products
- stok.tsx
- registry/types.ts
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
- QasirDispatcher
- widgets-smoke.ts
- OMP OAuth account pools on macOS
- Qasir Suppliers
- debts.ts
- tsconfig.scripts.json
- manujujaya-mcp
- fixtures.ts
- piutang.tsx
- cloudflare-workers.ts
- mockBridge.ts
- MemoryStorage
- penjualan.tsx
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
- RequestBudget
- @modelcontextprotocol/ext-apps
- widgets-debts.test.ts
- @tanstack/react-form
- MemoryStorage
- @tanstack/react-router
- @tanstack/react-table
- @testing-library/dom
- gate.ts
- @types/react
- testHelpers.tsx
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
- QasirSessionsDO
- `data.products[].variants[]`
- package.json
- happy-dom
- react-dom
- @tailwindcss/vite
- @tanstack/react-virtual
- dispatcher.test.ts
- ChipGroup.tsx
- tools/index.ts
- StaticQasirSessionProvider
- connect-routes.test.ts
- ToolContext

## God Nodes (most connected - your core abstractions)
1. `AppError` - 123 edges
2. `ErrorCodes` - 52 edges
3. `handleConnectRoutes()` - 35 edges
4. `log()` - 30 edges
5. `SessionStore` - 28 edges
6. `formatNumber()` - 28 edges
7. `createManujujayaServer()` - 27 edges
8. `formatRupiah()` - 26 edges
9. `ToolOutput` - 23 edges
10. `searchFromToolArgs()` - 23 edges

## Surprising Connections (you probably didn't know these)
- `setup()` --calls--> `QasirDispatcher`  [EXTRACTED]
  tests/unit/dispatcher-transport.test.ts → src/dispatcher/qasir-dispatcher.ts
- `upstream404()` --calls--> `AppError`  [EXTRACTED]
  tests/unit/widgets-stock.test.ts → src/errors/codes.ts
- `budget()` --calls--> `RequestBudget`  [EXTRACTED]
  tests/unit/widgets-budget.test.ts → src/widgets/budget.ts
- `Call` --calls--> `handleConnectRoutes()`  [EXTRACTED]
  tests/unit/connect-routes.test.ts → src/connect/routes.ts
- `mockDo()` --calls--> `sha256Hex()`  [EXTRACTED]
  tests/unit/connect.test.ts → src/session/crypto.ts

## Import Cycles
- 3-file cycle: `widgets/src/app/router.tsx -> widgets/src/routes/index.ts -> widgets/src/routes/transaksi.tsx -> widgets/src/app/router.tsx`
- 3-file cycle: `widgets/src/app/router.tsx -> widgets/src/routes/index.ts -> widgets/src/routes/produk.tsx -> widgets/src/app/router.tsx`
- 3-file cycle: `widgets/src/app/router.tsx -> widgets/src/routes/index.ts -> widgets/src/routes/piutang.tsx -> widgets/src/app/router.tsx`
- 3-file cycle: `widgets/src/app/router.tsx -> widgets/src/routes/index.ts -> widgets/src/routes/pembelian.tsx -> widgets/src/app/router.tsx`
- 3-file cycle: `widgets/src/app/router.tsx -> widgets/src/routes/index.ts -> widgets/src/routes/penjualan.tsx -> widgets/src/app/router.tsx`
- 3-file cycle: `widgets/src/app/router.tsx -> widgets/src/routes/index.ts -> widgets/src/routes/stok.tsx -> widgets/src/app/router.tsx`
- 4-file cycle: `widgets/src/app/router.tsx -> widgets/src/routes/index.ts -> widgets/src/routes/piutang.tsx -> widgets/src/routes/transaksi.tsx -> widgets/src/app/router.tsx`

## Hyperedges (group relationships)
- **Qasir Connect Session Lifecycle** — docs_auth_login_qasir_auth_login_spec, docs_connect_qasir_connect_login_flow, docs_architecture_overview_durable_objects_storage, docs_architecture_security_session_encryption [INFERRED 0.95]
- **Two-Call Mutation Approval Pipeline** — docs_mcp_tools_execute_mutation_spec, docs_architecture_security_mutation_gates, docs_architecture_operations_mutation_enablement, docs_architecture_overview_durable_objects_storage [INFERRED 0.95]

## Communities (148 total, 59 thin omitted)

### Community 0 - "AppShell.tsx"
Cohesion: 0.13
Nodes (22): APP_INFO, AppShell(), atViewDefaults(), HostedShell(), hostInsetsStyle(), LATE_TOOL_INPUT_WAIT_MS, StandaloneShell(), startInitialView() (+14 more)

### Community 1 - "bridge.ts"
Cohesion: 0.15
Nodes (16): ToolOutput, isRecord(), contentText(), errorBodyFromText(), parseToolResult(), structuredContentOf(), ToolCallError, toToolCallError() (+8 more)

### Community 2 - "AppError"
Cohesion: 0.14
Nodes (29): assertAllowedUrl(), assertSafeSlug(), FIXED_HOSTS, isQasirLoginUrl(), resolveHost(), applyQuery(), assertSafePathSegment(), buildPath() (+21 more)

### Community 3 - "codemode-harness.ts"
Cohesion: 0.11
Nodes (39): APP_TOOL, MCP_APP_MIME_TYPE, VIEW_MARKER, viewResourceUri(), VIEWS, VIEW_RESOURCE_LABEL, WIDGET_RESOURCE_TTL_MS, execute() (+31 more)

### Community 4 - "contract.ts"
Cohesion: 0.05
Nodes (53): categoryRow, changeSchema, dateRange, debtBucket, debtCustomer, debtInvoice, endDate, nextPage (+45 more)

### Community 5 - "widgets-stock.test.ts"
Cohesion: 0.09
Nodes (15): stockBrowserData, stockHistoryData, stockPageData, stockVelocityData, stockBrowserTool, stockHistoryTool, stockPageTool, stockVelocityTool (+7 more)

### Community 6 - "transactions.ts"
Cohesion: 0.12
Nodes (38): salesStatusLabel(), transactionsInput, transactionsPageInput, parseQasirDateTime(), toNumber(), toNumberOrNull(), toText(), bucketReceivable() (+30 more)

### Community 7 - "codes.ts"
Cohesion: 0.07
Nodes (37): CodemodeLimits, DEFAULT_CODEMODE_LIMITS, clip(), executorFailure(), KNOWN_CODES, SandboxErrorBridge, timeoutError(), formatResult() (+29 more)

### Community 8 - "pembelian.tsx"
Cohesion: 0.19
Nodes (27): compact(), searchFromToolArgs(), toolArgsFromSearch(), useMorePages(), useToolQuery(), jakartaTodayBrowser(), COLUMNS, combinedStatusCounts() (+19 more)

### Community 9 - "stock.ts"
Cohesion: 0.10
Nodes (28): stockBrowserInput, stockHistoryInput, stockMovementLabel(), stockPageInput, stockVelocityInput, VELOCITY_MAX_PAGES, VELOCITY_WINDOW_DAYS, jakartaDateOf() (+20 more)

### Community 10 - "OrderDetailSheet.tsx"
Cohesion: 0.09
Nodes (28): OrderDetail, OrderDetailBody(), OrderDetailContent(), OrderDetailSheet(), OrderDetailSheetProps, compact, pointLabel(), TrendChart() (+20 more)

### Community 11 - "widgets-sales.test.ts"
Cohesion: 0.06
Nodes (30): orderDetailData, orderDetailInput, PRODUCT_ORDER_SORT, productRankingData, productRankingPageData, salesDashboardData, transactionsData, transactionsPageData (+22 more)

### Community 12 - "scripts"
Cohesion: 0.09
Nodes (22): scripts, build, cf-typegen, check-types, coverage:report, coverage:validate, deploy, deploy:dry-run (+14 more)

### Community 13 - "transaksi.tsx"
Cohesion: 0.10
Nodes (22): rootRoute, viewPathWithSearch(), salesStatusTone(), VIEW_ROUTES, penjualanRoute(), piutangRoute(), produkRoute(), stokRoute() (+14 more)

### Community 14 - "define.ts"
Cohesion: 0.13
Nodes (24): toAppError(), errorCodeOf(), errorResult(), jsonErrorResult(), MCP_APP_LEGACY_RESOURCE_URI_KEY, OPENAI_OUTPUT_TEMPLATE_KEY, OPENAI_VISIBILITY_KEY, OPENAI_WIDGET_ACCESSIBLE_KEY (+16 more)

### Community 15 - "session/types.ts"
Cohesion: 0.17
Nodes (13): CompositeSessionOptions, SessionEnv, PlainRecord, RateEntry, RecordKind, SaveSessionInput, SealedRecord, PendingAuthDraft (+5 more)

### Community 16 - "login-continue.ts"
Cohesion: 0.05
Nodes (69): CookieJar, domainMatches(), isQasirDomain(), isStoredCookie(), parseSetCookieHeaders(), pathMatches(), RFC-6265, extractApiTokenFromHtml() (+61 more)

### Community 17 - "search.ts"
Cohesion: 0.08
Nodes (35): PO_STATUS_FILTERS, PRODUCT_ORDERS, daysOf(), customerIdParam, dateParam, DEBT_SORTS, DebtSort, DEFAULT_PRESET (+27 more)

### Community 18 - "server.ts"
Cohesion: 0.10
Nodes (33): APPROVAL_TTL_MS, ApprovalRecord, hashArgs(), MutationApprovalsStub, MutationPreview, stableStringify(), hasScope(), Scope (+25 more)

### Community 19 - "validate.ts"
Cohesion: 0.12
Nodes (32): getOperation(), checkArray(), checkBody(), checkBounds(), checkEnum(), checkObject(), checkPathParam(), checkValue() (+24 more)

### Community 20 - "owner-routes.ts"
Cohesion: 0.13
Nodes (38): assertConfigured(), assertCsrf(), b64url(), b64urlDecode(), clearOwnerCookie(), clientIp(), constantTimeEqual(), cookieName() (+30 more)

### Community 21 - "session-store.test.ts"
Cohesion: 0.10
Nodes (7): PENDING_TTL_MS, SessionStorage, draft, ENC_ENV, KEY, MemoryStorage, RacyStorage

### Community 22 - "src/index.ts"
Cohesion: 0.24
Nodes (14): approvalsStubFor(), approvalPage(), handleApprovalRoutes(), NoticeTone, appHandler, fetch(), mcpApiHandler, providerFor() (+6 more)

### Community 23 - "produk.tsx"
Cohesion: 0.12
Nodes (15): ColumnDef, dataColumnHelper(), DataColumnMeta, DataTable(), DataTableFeatures, DataTableProps, LoadMoreFooter(), LoadMoreFooterProps (+7 more)

### Community 24 - "widget-tools.test.ts"
Cohesion: 0.13
Nodes (18): QasirSessionProvider, ToolErrorBody, WIDGET_TOOL_NAMES, WidgetToolDeps, ALLOWED_OPS, emptyReadHandlers(), NO_SCOPES, NOW (+10 more)

### Community 25 - "SessionStore"
Cohesion: 0.15
Nodes (8): isEncryptedBlobV1(), SessionCryptoEnv, SessionKeys, isPendingState(), isStoredSession(), isV2Record(), sameRecord(), SessionStore

### Community 26 - "API Coverage Manifest"
Cohesion: 0.12
Nodes (26): API Coverage Manifest, Legacy 2025 MCP Client Handling, Operations Runbook, Architecture Overview, MCP Request Processing Flow, MCP Client OAuth Controls, Security Model and Trust Boundaries, Local Dev PSK Bypass (+18 more)

### Community 27 - "e2e-mcp.ts"
Cohesion: 0.14
Nodes (19): args, b64url(), BASE, check(), CONNECT, connectQasirSession(), cookiesFrom(), Jar (+11 more)

### Community 28 - "connect/html.ts"
Cohesion: 0.29
Nodes (18): consentPage(), ConsentPageOptions, ownerLoginPage(), SCOPE_LABELS, simpleErrorPage(), connectLayout(), connectLoginPage(), connectPasteNeededHtml() (+10 more)

### Community 29 - "compilerOptions"
Cohesion: 0.08
Nodes (24): dev, DOM, DOM.Iterable, ES2023, src, test, vite/client, vite.config.ts (+16 more)

### Community 30 - "coverage.test.ts"
Cohesion: 0.12
Nodes (23): lines, out, root, checkCoverage(), OpenApiOperation, UNSUPPORTED_EVIDENCE, coverageKey(), OPERATION_CONTRACT_TEST (+15 more)

### Community 32 - "operations.ts"
Cohesion: 0.16
Nodes (20): RFC-3339, CATALOG_OPS, countParam, dateRange, op(), pageCount, pageParam, MISC_OPS (+12 more)

### Community 33 - "mcp/resources.ts"
Cohesion: 0.33
Nodes (9): CapabilitiesInfo, capabilitiesPayload(), DOC_NAMES, DOC_SET, docUri(), jsonContents(), registerResources(), buildCoverageManifest() (+1 more)

### Community 35 - "connect/routes.ts"
Cohesion: 0.17
Nodes (22): assertFormCsrf(), withSetCookies(), connectErrorHtml(), appErrorLike, jsonResponse(), mapConnectError(), readBody(), respondLoginResult() (+14 more)

### Community 36 - "redact.ts"
Cohesion: 0.14
Nodes (16): BUNDLED_DOCS, Frame, isPersonHeading(), PERSON_FIELDS, PERSON_JSON_FIELD, redactCodeSpans(), redactJsonNames(), redactRow() (+8 more)

### Community 37 - "validate-coverage.ts"
Cohesion: 0.21
Nodes (10): docEndpoints, docs, problems, root, summary, cell(), code(), renderCoverageMarkdown() (+2 more)

### Community 38 - "text.ts"
Cohesion: 0.15
Nodes (24): normalizeResponse(), PAGE_MARKERS, parseStockAdjustmentHtml(), ParseStockAdjustmentOptions, StockAdjustmentPage, StockAdjustmentRow, extractRowId(), PAGE_MARKERS (+16 more)

### Community 39 - "Execution lanes"
Cohesion: 0.10
Nodes (20): Execution lanes, File Structure, Global Constraints, MCP App Widgets (TanStack) Implementation Plan, Task 10: Widget bundle pipeline, Task 11: Registration, protocol and security tests, Task 12: Views Penjualan and Produk, Task 13: Views Stok and Pembelian (+12 more)

### Community 40 - "Qasir Products"
Cohesion: 0.17
Nodes (12): Dashboard HTML (the `/products` page), Endpoint, Example request, Headers, Implementation notes, Inventories list (not documented here), Pagination, Qasir Products (+4 more)

### Community 41 - "stok.tsx"
Cohesion: 0.09
Nodes (19): SearchInput(), SearchInputProps, Sheet(), SheetProps, COLD_LOAD_NOTE, coverLabel(), isOutOfStock(), isStale() (+11 more)

### Community 42 - "registry/types.ts"
Cohesion: 0.18
Nodes (14): HTML_ADAPTERS, operationEntry(), excluded(), EXCLUSIONS, Method, NonOpEntry, SESSION_ONLY, sessionOnly() (+6 more)

### Community 43 - "openapi.ts"
Cohesion: 0.17
Nodes (18): exposedReadIds(), checkOpenApi(), buildOpenApiDocument(), buildOperationCatalog(), HOST_URLS, hostBaseUrl(), operationToOpenApi(), pathParamsOnly() (+10 more)

### Community 44 - "crypto.ts"
Cohesion: 0.23
Nodes (13): b64Decode(), b64Encode(), Ciphertext, decryptJson(), enc, EncryptedBlobV1, encryptJson(), importSessionKeys() (+5 more)

### Community 45 - "MCP App widgets (TanStack) — design"
Cohesion: 0.12
Nodes (16): 1. Goal, 2. Verified facts this design relies on, 3.1 Layout, 3.2 Serving, 3.3 Widget runtime, 3. Architecture, 4.1 Rules for every new tool, 4.2 View tools (model-visible, `_meta.ui.resourceUri` set) (+8 more)

### Community 46 - "devDependencies"
Cohesion: 0.08
Nodes (25): @cloudflare/workers-types, @modelcontextprotocol/client, devDependencies, @cloudflare/workers-types, @modelcontextprotocol/client, playwright-core, react, tailwindcss (+17 more)

### Community 47 - "scenarios.test.ts"
Cohesion: 0.12
Nodes (11): DispatchRequest, fixtures, PRODUCTS, PURCHASES, spec, CodeExecutorClass, CodeExecutorInstance, createSandboxContext() (+3 more)

### Community 48 - "sales.ts"
Cohesion: 0.10
Nodes (29): isoDate, PRODUCT_ORDER_LABEL, productRankingInput, productRankingPageInput, salesDashboardInput, parseIndonesianDate(), parsePercent(), poLine() (+21 more)

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
Cohesion: 0.20
Nodes (9): FixedSessionProvider, loadDevVars(), main(), mask(), summarizeProducts(), definedQuery(), QasirDispatcher, createRequestSignals() (+1 more)

### Community 57 - "widgets-smoke.ts"
Cohesion: 0.10
Nodes (25): built, hash, head, out, root, computeWidgetSourceHash(), listFiles(), WIDGET_SOURCE_DIRS (+17 more)

### Community 58 - "OMP OAuth account pools on macOS"
Cohesion: 0.08
Nodes (25): 1. Connect Grok OAuth accounts, 2. Create the Grok account pool, 3. Start the broker once and create its token, 4. Install the macOS LaunchAgent, 5. Configure OMP clients, 6. Verify the complete setup, Account selection and quota behavior, Broker health (+17 more)

### Community 59 - "Qasir Suppliers"
Cohesion: 0.20
Nodes (10): Endpoint (the page), Example request, Headers, Implementation notes, JSON probes (failed), Qasir Suppliers, Query parameters, Response (+2 more)

### Community 60 - "debts.ts"
Cohesion: 0.11
Nodes (28): AGING_BUCKET_KEYS, AgingBucketKey, CUSTOMER_INSTALLMENT_MAX_PAGES, customerDebtDetailInput, customerDebtsInput, DEBT_DETAIL_MAX_INVOICES, DEBT_SCAN_START_DATE, INSTALLMENT_MAX_PAGES (+20 more)

### Community 61 - "tsconfig.scripts.json"
Cohesion: 0.22
Nodes (8): scripts/**/*.ts, ./tsconfig.json, compilerOptions, types, exclude, extends, include, node

### Community 62 - "manujujaya-mcp"
Cohesion: 0.50
Nodes (3): Development Commands, graphify, manujujaya-mcp

### Community 64 - "fixtures.ts"
Cohesion: 0.11
Nodes (22): AGING_BUCKET_LABEL, PO_STATUSES, ProductOrder, STOCK_MOVEMENT_TYPES, CATEGORIES, DEBT_CUSTOMERS, FIXTURE_OUTLET_ID, FIXTURE_TODAY (+14 more)

### Community 65 - "piutang.tsx"
Cohesion: 0.08
Nodes (35): VIEW_TOOL, ViewName, PenjualanSearch, PiutangSearch, StokSearch, TransaksiSearch, VIEW_LABEL, VIEW_PATH (+27 more)

### Community 66 - "cloudflare-workers.ts"
Cohesion: 0.29
Nodes (4): DurableObject, env, RpcTarget, WorkerEntrypoint

### Community 67 - "mockBridge.ts"
Cohesion: 0.16
Nodes (14): answer(), host, isToolName(), SmokeMountOptions, Window, TOOL_SCHEMAS, ToolName, FIXTURES (+6 more)

### Community 69 - "penjualan.tsx"
Cohesion: 0.17
Nodes (15): BarList(), BarListItem, EmptyState(), ChangeLine(), KpiChange, KpiTile(), Skeleton(), formatPercent() (+7 more)

### Community 70 - "Q: Why does ToolOutput connect Bridge Toolinput across 17 different widget, route, and fixture communities?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Why does ToolOutput connect Bridge Toolinput across 17 different widget, route, and fixture communities?, Source Nodes

### Community 71 - "query.test.tsx"
Cohesion: 0.19
Nodes (8): NO_RETRY, shouldRetry(), ToolResultLike, InitialToolCall, isToolResultLike(), primeInitialQuery(), seedInitialResult(), toolQueryKey()

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

### Community 88 - "widgets-debts.test.ts"
Cohesion: 0.13
Nodes (14): customerDebtDetailData, customerDebtsData, customerDebtDetailTool, customerDebtsTool, A1, A2, B1, C1 (+6 more)

### Community 90 - "MemoryStorage"
Cohesion: 0.25
Nodes (3): doFor(), MemoryStorage, namespace()

### Community 94 - "gate.ts"
Cohesion: 0.20
Nodes (11): ApprovalRoutesEnv, OwnerEnv, OwnerRoutesEnv, DevPskEnv, principalFromProps(), resolveDevPsk(), ConnectGateEnv, ConnectIdentity (+3 more)

### Community 96 - "testHelpers.tsx"
Cohesion: 0.11
Nodes (17): ToolInput, InitialViewOptions, Bridge, BridgeContext, createMockBridge(), LAYOUT_PROPS, makeBridge(), originalLayout (+9 more)

### Community 101 - "dispatcher-transport.test.ts"
Cohesion: 0.17
Nodes (5): DispatcherLimits, FetchArgs, Handler, LIST, setup()

### Community 102 - "dependencies"
Cohesion: 0.18
Nodes (11): agents, @cloudflare/codemode, @cloudflare/workers-oauth-provider, @modelcontextprotocol/server, dependencies, agents, @cloudflare/codemode, @cloudflare/workers-oauth-provider (+3 more)

### Community 136 - "`data.products[].variants[]`"
Cohesion: 0.29
Nodes (7): `data.products[]`, `data.products[].images`, `data.products[].variants[]`, Response, `variants[].images`, `variants[].stock`, `variants[].unit_label`

### Community 137 - "package.json"
Cohesion: 0.29
Nodes (6): engines, node, name, private, type, version

### Community 142 - "dispatcher.test.ts"
Cohesion: 0.25
Nodes (4): dispatcher(), FetchArgs, fixtures, mockSession()

### Community 143 - "ChipGroup.tsx"
Cohesion: 0.28
Nodes (6): ChipGroup(), ChipGroupBase, ChipGroupProps, ChipOption, options, Status

### Community 144 - "tools/index.ts"
Cohesion: 0.25
Nodes (7): DEBT_TOOLS, AnyWidgetToolDef, ALL_WIDGET_TOOLS, BY_NAME, SALES_TOOLS, STOCK_TOOLS, TRANSACTION_TOOLS

### Community 146 - "connect-routes.test.ts"
Cohesion: 0.48
Nodes (6): Call, fixtures, installQasir(), load(), post(), startOutletFlow()

## Knowledge Gaps
- **650 isolated node(s):** `ROOT`, `LANDMARK`, `PoStatus`, `PO_STATUS_LABEL`, `WEB_STATUS_LABEL` (+645 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **59 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppError` connect `AppError` to `codemode-harness.ts`, `contract.ts`, `widgets-stock.test.ts`, `transactions.ts`, `codes.ts`, `widgets-sales.test.ts`, `define.ts`, `session/types.ts`, `login-continue.ts`, `dispatcher.test.ts`, `server.ts`, `validate.ts`, `owner-routes.ts`, `src/index.ts`, `widget-tools.test.ts`, `ExecutionBudget`, `MutationApprovalsDO`, `connect/routes.ts`, `text.ts`, `crypto.ts`, `scenarios.test.ts`, `QasirDispatcher`, `debts.ts`, `RequestBudget`, `widgets-debts.test.ts`, `gate.ts`?**
  _High betweenness centrality (0.098) - this node is a cross-community bridge._
- **Why does `ErrorCodes` connect `codes.ts` to `AppError`, `codemode-harness.ts`, `contract.ts`, `widgets-stock.test.ts`, `transactions.ts`, `widgets-sales.test.ts`, `define.ts`, `session/types.ts`, `login-continue.ts`, `dispatcher.test.ts`, `server.ts`, `validate.ts`, `owner-routes.ts`, `widget-tools.test.ts`, `connect/routes.ts`, `text.ts`, `crypto.ts`, `scenarios.test.ts`, `debts.ts`, `widgets-debts.test.ts`, `gate.ts`, `dispatcher-transport.test.ts`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `ToolOutput` connect `bridge.ts` to `fixtures.ts`, `testHelpers.tsx`, `piutang.tsx`, `mockBridge.ts`, `contract.ts`, `widgets-stock.test.ts`, `transactions.ts`, `penjualan.tsx`, `pembelian.tsx`, `stock.ts`, `OrderDetailSheet.tsx`, `widgets-sales.test.ts`, `stok.tsx`, `transaksi.tsx`, `sales.ts`, `produk.tsx`, `debts.ts`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `handleConnectRoutes()` (e.g. with `.clear()` and `.clearPending()`) actually correct?**
  _`handleConnectRoutes()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ROOT`, `LANDMARK`, `PoStatus` to the rest of the system?**
  _650 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `AppShell.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13227513227513227 - nodes in this community are weakly interconnected._
- **Should `bridge.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14814814814814814 - nodes in this community are weakly interconnected._