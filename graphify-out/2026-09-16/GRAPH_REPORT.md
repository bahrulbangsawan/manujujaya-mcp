# Graph Report - manujujaya-mcp  (2026-09-16)

## Corpus Check
- 238 files · ~308,197 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1915 nodes · 5151 edges · 142 communities (80 shown, 62 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 114 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Widgets Contract Ts
- Security Widget Tools Mcp
- Codemode Run Codemode/Budget Ts
- Unit Widgets Sales Customerdebtdetaildata
- Registry Doc Endpoints Bundle
- Tools Sales Debt Scan
- Widgets Qasir Dates Aging
- Docs Auth Login Api
- Mcp Mutation Tool Approvals
- Tools Transactions App Tool
- Lib Format Usetoolquery
- Docs Reports Qasir Order
- Session Qasir Withsetcookies
- Tools Purchases Page Size
- Scripts Widgets Smoke Bundle
- Registry Validate Ts
- Lib Dates Max Range
- Bridge Toolinput
- Routes Pembelian Compact
- Ops Reports Rfc 3339
- Auth Owner Ts
- Html Text Stock Adjustment
- App Search Isodate
- Scripts E2E Mcp Ts
- Auth Owner Routes Approvalroutesenv
- Connect Cookie Jar Ts
- Session Store Sessionkeys
- Dev Fixtures Aging Bucket
- Components Ui Barlist Tsx
- Package @Cloudflare/Workers Types
- Widgets Tsconfig Dom Iterable
- Tools Define Toapperror
- Tsconfig @Cloudflare/Workers Types
- App Appshell Viewname
- App Router Standaloneshell
- Tools Shared Isapperrorlike
- Session Types Qasir Ts
- Routes Transaksi Chipgroup Tsx
- Package Scripts
- Stubs Widget Harness Authprincipal
- Connect Login Continue Ts
- Connect Login Parse Ts
- Observability Redact Docs/Bundled Ts
- Unit Session Store Pending
- Components Datatable Product Orders
- Routes Piutang Searchinput Tsx
- Scripts E2E Live Login
- Dispatcher Qasir Allowlist Ts
- Routes Stok Rootroute
- Routes Pembelian Createmockbridge
- Evals Scenarios Spec Ts
- Widgets Qasir Values Salesstatuslabel
- Registry Openapi Validate Ts
- Session Crypto Ts
- Connect Html Pages Ts
- Mcp Resources Exposedreadids
- Widgets Budget Widgets/Budget Ts
- Index Approvalsstubfor
- Components Trendchart Usebridge
- Scripts Widgets Smoke Host
- Connect Extract Token Ts
- Unit Dispatcher Qasirdispatcher
- Dispatcher Upstream Isqasirloginurl
- Registry Exclusions Coverage Ts
- Approvals Mutation Mutationapprovalsdo
- Unit Dispatcher Transport Dispatcherlimits
- Package Agents
- Unit Connect Routes Devpskenv
- Bridge Module
- Tsconfig.Scripts Scripts/**/* Ts
- Session Qasir Sessions Qasirsessionsdo
- Unit Connect Routes Dofor
- Unit Connect Login Test
- Package Json
- Stubs Cloudflare Workers Ts
- Bridge Initialresult Initialtoolcall
- Stubs Codemode Harness Memorystorage
- Architecture Security Durable Objects
- Architecture Operations Mutation Enablement
- Docs Customers Customer Profile
- Docs Mcp Tools Widget
- Widgets Vite.Config Vite Config
- Worker Configuration.D Configuration D
- Architecture Operations Oauth Grant
- Architecture Operations Troubleshooting And
- Architecture Overview Code Mode
- Architecture Overview Widget View
- Docs Install Prompts Claude
- Docs Inventories Stock Stockhistories
- Docs Mcp Tools Execute
- Docs Mcp Tools Resources
- Docs Mcp Tools Search
- Docs Order Histories Sales
- Docs Products Product Typeahead
- Docs Routes Qasir Dashboard
- Docs Stock Adjustment Ssr
- Gates Connect Fixture
- Package Happy Dom
- Package @Modelcontextprotocol/Ext Apps
- Package React Dom
- Package @Tailwindcss/Vite
- Package @Tanstack/React Form
- Package @Tanstack/React Router
- Package @Tanstack/React Table
- Package @Tanstack/React Virtual
- Package @Testing Library/Dom
- Package @Types/React
- Package Typescript
- Package Vite
- Package Vite Plugin
- Package @Vitejs/Plugin React
- Agents Navigation And
- Agents Graphify Knowledge
- Architecture Coverage Validation Policy
- Architecture Coverage Endpoint Status
- Architecture Overview Stateless Mcp
- Architecture Setup Cloudflare Production
- Architecture Setup E2E Verification
- Docs Customers Get Endpoint
- Docs Install Prompts Claude
- Docs Install Prompts Codex
- Docs Install Prompts Copyable
- Docs Install Prompts Cursor
- Docs Install Prompts Vs
- Docs Inventories Stock Opname
- Docs Inventories Stock Raw
- Docs Order Histories Installment
- Docs Order Histories Aggregation
- Docs Order Histories History
- Docs Purchases Purchase Order
- Docs Purchases Purchase Order
- Docs Reports Microsite Visits
- Docs Reports Sales Summary
- Docs Stock Adjustment Bulk
- Specs 2026 09 App
- Docs Users Staff Access
- Gates Gate G3
- Gates Gate G5

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
- `login()` --calls--> `runQasirLoginFlow()`  [EXTRACTED]
  tests/unit/connect-login.test.ts → src/connect/login-flow.ts
- `Call` --calls--> `handleConnectRoutes()`  [EXTRACTED]
  tests/unit/connect-routes.test.ts → src/connect/routes.ts
- `setup()` --calls--> `QasirDispatcher`  [EXTRACTED]
  tests/unit/dispatcher-transport.test.ts → src/dispatcher/qasir-dispatcher.ts
- `upstream404()` --calls--> `AppError`  [EXTRACTED]
  tests/unit/widgets-stock.test.ts → src/errors/codes.ts
- `Authorize MCP Client UI` --conceptually_related_to--> `MCP Client OAuth Controls`  [INFERRED]
  .pencil-handoff.html → docs/architecture/security.md

## Import Cycles
- 3-file cycle: `widgets/src/app/router.tsx -> widgets/src/routes/index.ts -> widgets/src/routes/pembelian.tsx -> widgets/src/app/router.tsx`
- 3-file cycle: `widgets/src/app/router.tsx -> widgets/src/routes/index.ts -> widgets/src/routes/penjualan.tsx -> widgets/src/app/router.tsx`
- 3-file cycle: `widgets/src/app/router.tsx -> widgets/src/routes/index.ts -> widgets/src/routes/piutang.tsx -> widgets/src/app/router.tsx`
- 3-file cycle: `widgets/src/app/router.tsx -> widgets/src/routes/index.ts -> widgets/src/routes/produk.tsx -> widgets/src/app/router.tsx`
- 3-file cycle: `widgets/src/app/router.tsx -> widgets/src/routes/index.ts -> widgets/src/routes/stok.tsx -> widgets/src/app/router.tsx`
- 3-file cycle: `widgets/src/app/router.tsx -> widgets/src/routes/index.ts -> widgets/src/routes/transaksi.tsx -> widgets/src/app/router.tsx`
- 4-file cycle: `widgets/src/app/router.tsx -> widgets/src/routes/index.ts -> widgets/src/routes/piutang.tsx -> widgets/src/routes/transaksi.tsx -> widgets/src/app/router.tsx`

## Hyperedges (group relationships)
- **Qasir Connect Session Lifecycle** — docs_auth_login_qasir_auth_login_spec, docs_connect_qasir_connect_login_flow, docs_architecture_overview_durable_objects_storage, docs_architecture_security_session_encryption [INFERRED 0.95]
- **Two-Call Mutation Approval Pipeline** — docs_mcp_tools_execute_mutation_spec, docs_architecture_security_mutation_gates, docs_architecture_operations_mutation_enablement, docs_architecture_overview_durable_objects_storage [INFERRED 0.95]
- **MCP Client Onboarding and Consent Flow** — readme_claude_code_connector, docs_install_prompts_claude_code_install, docs_architecture_security_oauth_client_auth, pencil_handoff_authorize_mcp_client [INFERRED 0.95]
- **Procurement and Stock Replenishment Flow** — docs_purchases_list_endpoint, docs_purchases_confirmation_api, docs_stock_adjustment_stock_turnover_api, docs_products_variant_entity [INFERRED 0.85]
- **MCP App Interactive BI Widget System** — q_owner_business_questions, docs_superpowers_specs_2026_09_15_mcp_app_widgets_design_specification, docs_superpowers_specs_2026_09_15_mcp_app_widgets_design_view_tools, widgets_index_widget_root [INFERRED 0.95]
- **Hybrid SSR and Background JSON Synchronization Architecture** — docs_routes_dashboard_routes_catalog, docs_routes_ssr_vs_json_pattern, docs_products_catalog_endpoint, docs_suppliers_suppliers_page [INFERRED 0.85]

## Communities (142 total, 62 thin omitted)

### Community 0 - "Widgets Contract Ts"
Cohesion: 0.04
Nodes (55): categoryRow, changeSchema, dateRange, debtBucket, debtCustomer, debtInvoice, endDate, nextPage (+47 more)

### Community 1 - "Security Widget Tools Mcp"
Cohesion: 0.08
Nodes (51): MCP_APP_MIME_TYPE, VIEW_MARKER, viewResourceUri(), registerWidgetResources(), renderViewHtml(), VIEW_RESOURCE_LABEL, WIDGET_RESOURCE_TTL_MS, execute() (+43 more)

### Community 2 - "Codemode Run Codemode/Budget Ts"
Cohesion: 0.09
Nodes (31): CodemodeLimits, DEFAULT_CODEMODE_LIMITS, ExecutionBudget, clip(), executorFailure(), KNOWN_CODES, SandboxErrorBridge, timeoutError() (+23 more)

### Community 3 - "Unit Widgets Sales Customerdebtdetaildata"
Cohesion: 0.06
Nodes (34): customerDebtDetailData, customerDebtsData, PRODUCT_ORDER_SORT, productRankingData, productRankingPageData, salesDashboardData, customerDebtDetailTool, customerDebtsTool (+26 more)

### Community 4 - "Registry Doc Endpoints Bundle"
Cohesion: 0.09
Nodes (31): lines, out, root, docEndpoints, docs, problems, root, summary (+23 more)

### Community 5 - "Tools Sales Debt Scan"
Cohesion: 0.10
Nodes (35): DEBT_SCAN_START_DATE, PRODUCT_ORDER_LABEL, productRankingInput, productRankingPageInput, salesDashboardInput, poLine(), categoriesRequest(), CategoryRow (+27 more)

### Community 6 - "Widgets Qasir Dates Aging"
Cohesion: 0.12
Nodes (31): AGING_BUCKET_KEYS, AgingBucketKey, CUSTOMER_INSTALLMENT_MAX_PAGES, customerDebtDetailInput, customerDebtsInput, DEBT_DETAIL_MAX_INVOICES, INSTALLMENT_MAX_PAGES, addDays() (+23 more)

### Community 7 - "Docs Auth Login Api"
Cohesion: 0.09
Nodes (34): API Coverage Manifest, Legacy 2025 MCP Client Handling, Operations Runbook, Architecture Overview, MCP Request Processing Flow, MCP Client OAuth Controls, Security Model and Trust Boundaries, Local Dev PSK Bypass (+26 more)

### Community 8 - "Mcp Mutation Tool Approvals"
Cohesion: 0.13
Nodes (28): APPROVAL_TTL_MS, ApprovalRecord, hashArgs(), MutationPreview, stableStringify(), hasScope(), Scope, SCOPES (+20 more)

### Community 9 - "Tools Transactions App Tool"
Cohesion: 0.08
Nodes (26): APP_TOOL, orderDetailData, orderDetailInput, transactionsData, transactionsInput, transactionsPageData, transactionsPageInput, VIEW_TOOL (+18 more)

### Community 10 - "Lib Format Usetoolquery"
Cohesion: 0.11
Nodes (26): useToolQuery(), OrderDetail, OrderDetailBody(), OrderDetailContent(), OrderDetailSheet(), OrderDetailSheetProps, StatusTone, pointLabel() (+18 more)

### Community 11 - "Docs Reports Qasir Order"
Cohesion: 0.07
Nodes (32): Qasir Order Histories Web Endpoint, Qasir Products Catalog Endpoint, Product Catalog Entity, Product Catalog Unscoped Stock Limitation, Product Variant Entity, Qasir Purchase Orders Endpoint, Purchase Order Record, Ingredients Inventory Summary API (+24 more)

### Community 12 - "Session Qasir Withsetcookies"
Cohesion: 0.17
Nodes (22): withSetCookies(), connectErrorHtml(), connectSuccessHtml(), appErrorLike, jsonResponse(), mapConnectError(), readBody(), respondLoginResult() (+14 more)

### Community 13 - "Tools Purchases Page Size"
Cohesion: 0.08
Nodes (26): PAGE_SIZE, PO_STATUS_SCAN_PAGES, PoStatusFilter, poStatusLabel(), purchaseOrderItemsData, purchaseOrderItemsInput, purchaseOrdersData, purchaseOrdersInput (+18 more)

### Community 14 - "Scripts Widgets Smoke Bundle"
Cohesion: 0.11
Nodes (24): built, hash, head, out, root, computeWidgetSourceHash(), listFiles(), WIDGET_SOURCE_DIRS (+16 more)

### Community 15 - "Registry Validate Ts"
Cohesion: 0.13
Nodes (29): checkArray(), checkBody(), checkBounds(), checkEnum(), checkObject(), checkPathParam(), checkValue(), coerce() (+21 more)

### Community 16 - "Lib Dates Max Range"
Cohesion: 0.13
Nodes (23): MAX_RANGE_DAYS, daysOf(), rangeSearch(), CustomRangeFields(), customRangeSchema, PRESET_OPTIONS, PresetRangePicker(), PresetRangePickerProps (+15 more)

### Community 17 - "Bridge Toolinput"
Cohesion: 0.16
Nodes (18): ToolInput, ToolOutput, errorBodyFromText(), HostInfo, parseToolResult(), ToolCallError, ToolResultLike, toToolCallError() (+10 more)

### Community 18 - "Routes Pembelian Compact"
Cohesion: 0.13
Nodes (28): compact(), rangeArgs(), searchFromToolArgs(), toolArgsFromSearch(), COLUMNS, combinedStatusCounts(), newPagedRows(), PembelianPage() (+20 more)

### Community 19 - "Ops Reports Rfc 3339"
Cohesion: 0.15
Nodes (23): RFC-3339, CATALOG_OPS, countParam, dateRange, op(), pageCount, pageParam, MISC_OPS (+15 more)

### Community 20 - "Auth Owner Ts"
Cohesion: 0.17
Nodes (25): assertConfigured(), b64url(), b64urlDecode(), constantTimeEqual(), cookieName(), enc, ensureCsrf(), hmac() (+17 more)

### Community 21 - "Html Text Stock Adjustment"
Cohesion: 0.16
Nodes (23): PAGE_MARKERS, parseStockAdjustmentHtml(), ParseStockAdjustmentOptions, StockAdjustmentPage, StockAdjustmentRow, extractRowId(), PAGE_MARKERS, parseSuppliersHtml() (+15 more)

### Community 22 - "App Search Isodate"
Cohesion: 0.12
Nodes (22): isoDate, PO_STATUS_FILTERS, VIEWS, customerIdParam, dateParam, DEBT_SORTS, DebtSort, DEFAULT_PRESET (+14 more)

### Community 23 - "Scripts E2E Mcp Ts"
Cohesion: 0.13
Nodes (20): args, b64url(), BASE, check(), CONNECT, connectQasirSession(), cookiesFrom(), Jar (+12 more)

### Community 24 - "Auth Owner Routes Approvalroutesenv"
Cohesion: 0.16
Nodes (22): ApprovalRoutesEnv, assertCsrf(), clearOwnerCookie(), clientIp(), OwnerEnv, checkPassword(), clientNetwork(), GrantProps (+14 more)

### Community 25 - "Connect Cookie Jar Ts"
Cohesion: 0.16
Nodes (12): CookieJar, domainMatches(), isQasirDomain(), isStoredCookie(), parseSetCookieHeaders(), pathMatches(), RFC-6265, StoredCookie (+4 more)

### Community 26 - "Session Store Sessionkeys"
Cohesion: 0.17
Nodes (6): SessionKeys, isPendingState(), isStoredSession(), isV2Record(), sameRecord(), SessionStore

### Community 27 - "Dev Fixtures Aging Bucket"
Cohesion: 0.11
Nodes (22): AGING_BUCKET_LABEL, PO_STATUSES, ProductOrder, STOCK_MOVEMENT_TYPES, CATEGORIES, DEBT_CUSTOMERS, FIXTURE_OUTLET_ID, FIXTURE_TODAY (+14 more)

### Community 28 - "Components Ui Barlist Tsx"
Cohesion: 0.13
Nodes (16): BarList(), BarListItem, ChangeLine(), KpiChange, KpiTile(), LoadMoreFooter(), LoadMoreFooterProps, Sheet() (+8 more)

### Community 29 - "Package @Cloudflare/Workers Types"
Cohesion: 0.08
Nodes (25): @cloudflare/workers-types, @modelcontextprotocol/client, devDependencies, @cloudflare/workers-types, @modelcontextprotocol/client, playwright-core, react, tailwindcss (+17 more)

### Community 30 - "Widgets Tsconfig Dom Iterable"
Cohesion: 0.08
Nodes (24): dev, DOM, DOM.Iterable, ES2023, src, test, vite/client, vite.config.ts (+16 more)

### Community 31 - "Tools Define Toapperror"
Cohesion: 0.15
Nodes (19): toAppError(), errorCodeOf(), errorResult(), jsonErrorResult(), MCP_APP_LEGACY_RESOURCE_URI_KEY, createToolContext(), invokeWidgetTool(), registerWidgetTool() (+11 more)

### Community 32 - "Tsconfig @Cloudflare/Workers Types"
Cohesion: 0.08
Nodes (23): @cloudflare/workers-types, ES2022, scripts/**, src/**/*.ts, tests/**/*.ts, worker-configuration.d.ts, compilerOptions, esModuleInterop (+15 more)

### Community 33 - "App Appshell Viewname"
Cohesion: 0.13
Nodes (18): ViewName, APP_INFO, AppShell(), atViewDefaults(), HostedShell(), InitialViewOptions, insetsStyle(), LATE_TOOL_INPUT_WAIT_MS (+10 more)

### Community 34 - "App Router Standaloneshell"
Cohesion: 0.14
Nodes (14): StandaloneShell(), createWidgetQueryClient(), NO_RETRY, shouldRetry(), createWidgetRouter(), NotFoundPanel(), WidgetRouter, MockBridge (+6 more)

### Community 35 - "Tools Shared Isapperrorlike"
Cohesion: 0.17
Nodes (21): isAppErrorLike(), pageInput, STRUCTURED_MAX_CHARS, isRecord(), bucketReceivable(), customerProfile(), legacySale(), scanOpenCredit() (+13 more)

### Community 36 - "Session Types Qasir Ts"
Cohesion: 0.17
Nodes (13): CompositeSessionOptions, SessionEnv, PlainRecord, RateEntry, RecordKind, SaveSessionInput, SealedRecord, PendingAuthDraft (+5 more)

### Community 37 - "Routes Transaksi Chipgroup Tsx"
Cohesion: 0.12
Nodes (19): ChipGroup(), ChipGroupBase, ChipGroupProps, ChipOption, salesStatusTone(), CUSTOMER_HISTORY_DAYS, DAY_HEADER_HEIGHT, entryHeight() (+11 more)

### Community 38 - "Package Scripts"
Cohesion: 0.09
Nodes (22): scripts, build, cf-typegen, check-types, coverage:report, coverage:validate, deploy, deploy:dry-run (+14 more)

### Community 39 - "Stubs Widget Harness Authprincipal"
Cohesion: 0.16
Nodes (17): AuthPrincipal, CodemodeDispatcher, DispatchRequest, DispatchResult, MutationToolDeps, ServerDeps, QasirSessionProvider, ToolErrorBody (+9 more)

### Community 40 - "Connect Login Continue Ts"
Cohesion: 0.22
Nodes (20): AuthContext, continueWithOutlet(), defaultFetch(), DEVICE_LANG_URL, FetchLike, LOGIN_URL, loginBody(), LoginFlowResult (+12 more)

### Community 41 - "Connect Login Parse Ts"
Cohesion: 0.16
Nodes (17): buildDashboardRedirect(), LoginNextStep, matchConfiguredMerchant(), MatchConfiguredMerchantResult, normalizeMerchants(), normalizeOutlets(), ParsedLoginResponse, ParsedMerchant (+9 more)

### Community 42 - "Observability Redact Docs/Bundled Ts"
Cohesion: 0.14
Nodes (16): BUNDLED_DOCS, Frame, isPersonHeading(), PERSON_FIELDS, PERSON_JSON_FIELD, redactCodeSpans(), redactJsonNames(), redactRow() (+8 more)

### Community 43 - "Unit Session Store Pending"
Cohesion: 0.10
Nodes (7): PENDING_TTL_MS, SessionStorage, draft, ENC_ENV, KEY, MemoryStorage, RacyStorage

### Community 44 - "Components Datatable Product Orders"
Cohesion: 0.11
Nodes (16): PRODUCT_ORDERS, ProdukSearch, ColumnDef, dataColumnHelper(), DataColumnMeta, DataTable(), DataTableFeatures, DataTableProps (+8 more)

### Community 45 - "Routes Piutang Searchinput Tsx"
Cohesion: 0.12
Nodes (17): SearchInput(), SearchInputProps, bucketClass(), col, DEBT_SORT_LABEL, DebtCustomer, DebtDetail, DebtsArgs (+9 more)

### Community 46 - "Scripts E2E Live Login"
Cohesion: 0.13
Nodes (11): FixedSessionProvider, loadDevVars(), main(), mask(), summarizeProducts(), sha256Hex(), CompositeQasirSessionProvider, readSecrets() (+3 more)

### Community 47 - "Dispatcher Qasir Allowlist Ts"
Cohesion: 0.20
Nodes (16): assertAllowedUrl(), assertSafeSlug(), FIXED_HOSTS, resolveHost(), applyQuery(), assertSafePathSegment(), buildPath(), resolveUrl() (+8 more)

### Community 48 - "Routes Stok Rootroute"
Cohesion: 0.14
Nodes (19): rootRoute, useMorePages(), penjualanRoute(), produkRoute(), COLD_LOAD_NOTE, isOutOfStock(), isStale(), Movement (+11 more)

### Community 49 - "Routes Pembelian Createmockbridge"
Cohesion: 0.17
Nodes (15): createMockBridge(), LAYOUT_PROPS, makeBridge(), originalLayout, PurchaseRow, ARGS, ARGS, LAYOUT_PROPS (+7 more)

### Community 50 - "Evals Scenarios Spec Ts"
Cohesion: 0.13
Nodes (9): createSpecBundle(), fixtures, PRODUCTS, PURCHASES, spec, spec, execute(), spec (+1 more)

### Community 51 - "Widgets Qasir Values Salesstatuslabel"
Cohesion: 0.19
Nodes (19): salesStatusLabel(), parsePercent(), toNumber(), toNumberOrNull(), toText(), projectPurchaseItem(), isManualRow(), projectCategories() (+11 more)

### Community 52 - "Registry Openapi Validate Ts"
Cohesion: 0.22
Nodes (14): checkOpenApi(), OpenApiOperation, UNSUPPORTED_EVIDENCE, buildOpenApiDocument(), HOST_URLS, hostBaseUrl(), operationToOpenApi(), pathParamsOnly() (+6 more)

### Community 53 - "Session Crypto Ts"
Cohesion: 0.18
Nodes (14): b64Decode(), b64Encode(), Ciphertext, decryptJson(), enc, EncryptedBlobV1, encryptJson(), importSessionKeys() (+6 more)

### Community 54 - "Connect Html Pages Ts"
Cohesion: 0.29
Nodes (14): consentPage(), ConsentPageOptions, ownerLoginPage(), SCOPE_LABELS, simpleErrorPage(), connectLayout(), connectLoginPage(), connectPasteNeededHtml() (+6 more)

### Community 55 - "Mcp Resources Exposedreadids"
Cohesion: 0.21
Nodes (15): exposedReadIds(), CapabilitiesInfo, capabilitiesPayload(), DOC_NAMES, DOC_SET, docUri(), jsonContents(), registerResources() (+7 more)

### Community 56 - "Widgets Budget Widgets/Budget Ts"
Cohesion: 0.21
Nodes (5): DEFAULT_WIDGET_LIMITS, RequestBudget, RequestBudgetLimits, abortableDelay(), budget()

### Community 57 - "Index Approvalsstubfor"
Cohesion: 0.26
Nodes (13): approvalsStubFor(), approvalPage(), handleApprovalRoutes(), appHandler, fetch(), mcpApiHandler, providerFor(), publicBaseUrl() (+5 more)

### Community 58 - "Components Trendchart Usebridge"
Cohesion: 0.19
Nodes (11): useBridge(), EmptyState(), ErrorPanel(), compact, TrendChartProps, TrendPoint, ViewFrame(), Change (+3 more)

### Community 59 - "Scripts Widgets Smoke Host"
Cohesion: 0.22
Nodes (11): answer(), host, isToolName(), SmokeMountOptions, Window, TOOL_SCHEMAS, ToolName, FIXTURES (+3 more)

### Community 60 - "Connect Extract Token Ts"
Cohesion: 0.24
Nodes (13): extractApiTokenFromHtml(), extractCsrfFromHtml(), isApiTokenShape(), isCsrfTokenShape(), metaContent(), metaTags(), PATTERNS, followRedirectAndScrape() (+5 more)

### Community 61 - "Unit Dispatcher Qasirdispatcher"
Cohesion: 0.18
Nodes (5): QasirDispatcher, dispatcher(), FetchArgs, fixtures, mockSession()

### Community 62 - "Dispatcher Upstream Isqasirloginurl"
Cohesion: 0.25
Nodes (13): isQasirLoginUrl(), abortError(), createRequestSignals(), discardBody(), fetchUpstream(), guardedFetch(), readBodyCapped(), REDIRECT_STATUSES (+5 more)

### Community 63 - "Registry Exclusions Coverage Ts"
Cohesion: 0.20
Nodes (11): HTML_ADAPTERS, OPERATION_CONTRACT_TEST, operationEntry(), excluded(), EXCLUSIONS, Method, NonOpEntry, SESSION_ONLY (+3 more)

### Community 65 - "Unit Dispatcher Transport Dispatcherlimits"
Cohesion: 0.17
Nodes (5): DispatcherLimits, FetchArgs, Handler, LIST, setup()

### Community 66 - "Package Agents"
Cohesion: 0.18
Nodes (11): agents, @cloudflare/codemode, @cloudflare/workers-oauth-provider, @modelcontextprotocol/server, dependencies, agents, @cloudflare/codemode, @cloudflare/workers-oauth-provider (+3 more)

### Community 67 - "Unit Connect Routes Devpskenv"
Cohesion: 0.29
Nodes (9): DevPskEnv, ConnectGateEnv, ConnectEnv, Call, fixtures, installQasir(), load(), post() (+1 more)

### Community 69 - "Tsconfig.Scripts Scripts/**/* Ts"
Cohesion: 0.22
Nodes (8): scripts/**/*.ts, ./tsconfig.json, compilerOptions, types, exclude, extends, include, node

### Community 71 - "Unit Connect Routes Dofor"
Cohesion: 0.25
Nodes (3): doFor(), MemoryStorage, namespace()

### Community 72 - "Unit Connect Login Test"
Cohesion: 0.29
Nodes (6): fixtures, Handler, load(), login(), qasirMock(), Recorded

### Community 73 - "Package Json"
Cohesion: 0.29
Nodes (6): engines, node, name, private, type, version

### Community 74 - "Stubs Cloudflare Workers Ts"
Cohesion: 0.29
Nodes (4): DurableObject, env, RpcTarget, WorkerEntrypoint

### Community 77 - "Architecture Security Durable Objects"
Cohesion: 0.50
Nodes (4): Durable Objects Storage Model, IP and User Rate Limiting, AES-GCM Session Encryption and AAD Binding, Single Merchant Shared Session Model

### Community 78 - "Architecture Operations Mutation Enablement"
Cohesion: 0.67
Nodes (3): Mutation Enablement Workflow, Four-Gate Mutation Security Model, Execute Mutation Two-Call Workflow

### Community 79 - "Docs Customers Customer Profile"
Cohesion: 0.67
Nodes (3): Customer Profile Data Model, Credit Sales and Customer Debt Tracking, Legacy Receipt Cart and Payment Model

### Community 80 - "Docs Mcp Tools Widget"
Cohesion: 0.67
Nodes (3): Widget App-Only Helper Tools, Widget View Tools Specification, MCP Interactive Widget Views

## Knowledge Gaps
- **520 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+515 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **62 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppError` connect `Codemode Run Codemode/Budget Ts` to `Widgets Contract Ts`, `Security Widget Tools Mcp`, `Unit Widgets Sales Customerdebtdetaildata`, `Widgets Qasir Dates Aging`, `Mcp Mutation Tool Approvals`, `Tools Transactions App Tool`, `Session Qasir Withsetcookies`, `Tools Purchases Page Size`, `Registry Validate Ts`, `Auth Owner Ts`, `Html Text Stock Adjustment`, `Auth Owner Routes Approvalroutesenv`, `Tools Define Toapperror`, `Tools Shared Isapperrorlike`, `Session Types Qasir Ts`, `Connect Login Continue Ts`, `Connect Login Parse Ts`, `Scripts E2E Live Login`, `Dispatcher Qasir Allowlist Ts`, `Evals Scenarios Spec Ts`, `Session Crypto Ts`, `Widgets Budget Widgets/Budget Ts`, `Index Approvalsstubfor`, `Connect Extract Token Ts`, `Unit Dispatcher Qasirdispatcher`, `Dispatcher Upstream Isqasirloginurl`, `Approvals Mutation Mutationapprovalsdo`?**
  _High betweenness centrality (0.119) - this node is a cross-community bridge._
- **Why does `ErrorCodes` connect `Codemode Run Codemode/Budget Ts` to `Widgets Contract Ts`, `Security Widget Tools Mcp`, `Unit Widgets Sales Customerdebtdetaildata`, `Widgets Qasir Dates Aging`, `Mcp Mutation Tool Approvals`, `Tools Transactions App Tool`, `Session Qasir Withsetcookies`, `Tools Purchases Page Size`, `Registry Validate Ts`, `Auth Owner Ts`, `Html Text Stock Adjustment`, `Auth Owner Routes Approvalroutesenv`, `Tools Define Toapperror`, `Tools Shared Isapperrorlike`, `Session Types Qasir Ts`, `Connect Login Parse Ts`, `Dispatcher Qasir Allowlist Ts`, `Evals Scenarios Spec Ts`, `Session Crypto Ts`, `Widgets Budget Widgets/Budget Ts`, `Connect Extract Token Ts`, `Unit Dispatcher Qasirdispatcher`, `Dispatcher Upstream Isqasirloginurl`, `Unit Dispatcher Transport Dispatcherlimits`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `ToolOutput` connect `Bridge Toolinput` to `Widgets Contract Ts`, `App Router Standaloneshell`, `Unit Widgets Sales Customerdebtdetaildata`, `Tools Sales Debt Scan`, `Widgets Qasir Dates Aging`, `Routes Transaksi Chipgroup Tsx`, `Tools Transactions App Tool`, `Scripts Widgets Smoke Host`, `Lib Format Usetoolquery`, `Components Datatable Product Orders`, `Tools Purchases Page Size`, `Routes Piutang Searchinput Tsx`, `Routes Stok Rootroute`, `Routes Pembelian Createmockbridge`, `Routes Pembelian Compact`, `Components Trendchart Usebridge`, `Dev Fixtures Aging Bucket`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `handleConnectRoutes()` (e.g. with `.clear()` and `.clearPending()`) actually correct?**
  _`handleConnectRoutes()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _520 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Widgets Contract Ts` be split into smaller, more focused modules?**
  _Cohesion score 0.03822843822843823 - nodes in this community are weakly interconnected._
- **Should `Security Widget Tools Mcp` be split into smaller, more focused modules?**
  _Cohesion score 0.0814207650273224 - nodes in this community are weakly interconnected._