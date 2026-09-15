# API coverage

<!-- Generated from src/registry (operations + exclusions). Do not edit by hand: run `bun run scripts/validate-coverage.ts --write-report`. -->

Every METHOD + host + path documented in the 13 API docs under `docs/` has exactly one entry below.
`tests/unit/coverage.test.ts` extracts the endpoints from the markdown and fails on any gap, duplicate,
undocumented entry, exposed failed probe, or missing impl/test file.

```bash
bun run coverage:validate
bun run openapi:validate
```

## Totals

| Status | Count |
| --- | --- |
| implemented | 40 |
| html-adapter | 2 |
| mutation-gated | 3 |
| session-only | 5 |
| excluded | 32 |
| **total** | **82** |

## Policy

- Endpoint-specific docs win over `routes.md`
- Failed probes → `excluded` (not executable)
- Auth login / tokenWeb hop → `session-only` (host-only Connect flow; login OTP is unsupported and excluded)
- HTML-only suppliers / stock-adjustment history → `html-adapter`
- Mutations → `mutation-gated` (disabled by default, owner approval required); ungated mutations are `excluded`
- Dashboard chrome XHRs and SSR pages without a JSON API or HTML fixture → `excluded`
- Implemented JSON operations cite `tests/unit/coverage.test.ts`, which runs a per-operation registry/OpenAPI contract block; dispatcher behaviour is covered in `tests/unit/dispatcher.test.ts`

Sample merchant IDs in capture docs are examples only and are not defaults for tool calls (outlet may be supplied by the caller; merchant origin always comes from `MERCHANT_SLUG`).

## Entries

| Source md | Method host path | operationId | Auth | R/W | Impl module | Test file | Status | Exclusion reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `auth-login.md` | `GET merchant /dashboard` | — | none | R | `src/connect/login-continue.ts` | `tests/unit/connect.test.ts` | session-only | tokenWeb redirect hop Connect follows to mint the dashboard session and read API_TOKEN; tokenWeb never exposed |
| `auth-login.md` | `POST www /api/auth/device-language` | — | www-csrf | W | `src/connect/login-flow.ts` | `tests/unit/connect.test.ts` | session-only | Auth bootstrap helper; Connect only, not exposed via Code Mode |
| `auth-login.md` | `POST www /api/auth/login` | — | www-csrf | W | `src/connect/login-flow.ts` | `tests/unit/connect.test.ts` | session-only | Connect UI / host-only session bootstrap; PIN never accepted from model |
| `auth-login.md` | `POST www /api/auth/login/otp-verify` | — | www-csrf | W | — | — | excluded | Login OTP not supported by Connect (verify/resend routes return 410); documented only |
| `auth-login.md` | `POST www /api/auth/login/resend-otp` | — | www-csrf | W | — | — | excluded | Login OTP not supported by Connect (verify/resend routes return 410); documented only |
| `auth-login.md` | `POST www /api/auth/otp-verify` | — | www-csrf | W | — | — | excluded | Forgot-PIN OTP (authkey); out of Connect scope |
| `auth-login.md` | `POST www /api/auth/outlet-select` | — | www-csrf | W | `src/connect/login-continue.ts` | `tests/unit/connect.test.ts` | session-only | Connect select_outlet step only; not exposed via Code Mode |
| `auth-login.md` | `POST www /api/auth/reset-pin` | — | www-csrf | W | — | — | excluded | Forgot-PIN flow out of Connect scope; use Qasir UI |
| `auth-login.md` | `POST www /api/auth/reset-pin/create` | — | www-csrf | W | — | — | excluded | Forgot-PIN create; out of Connect scope |
| `auth-login.md` | `GET www /sign-in` | — | none | R | `src/connect/login-flow.ts` | `tests/unit/connect.test.ts` | session-only | Connect loads the sign-in page for the www CSRF cookie pair before login; host-only |
| `auth-login.md` | `GET www /sign-in/verification` | — | none | R | — | — | excluded | Login OTP not supported by Connect (verify/resend routes return 410); documented only |
| `customers.md` | `GET pos /api/v5/customers/{customer_id}` | `customers.get` | bearer | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
| `inventories-stock-histories.md` | `GET pos /api/v5/inventories/{inventory_id}/stock-histories` | `inventories.stockHistories` | raw-token | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
| `order-histories-installment.md` | `GET order /api/v5/order/histories/installment` | `order.histories.installment` | bearer | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
| `order-histories-legacy.md` | `GET order /api/v5/order/histories/{sales_id}/legacy` | `order.histories.legacy` | bearer | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
| `order-histories-web.md` | `GET order /api/v5/order/histories/web` | `order.histories.web` | bearer | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
| `products.md` | `GET merchant /ajax/products/get` | `products.searchAjax` | cookie-csrf | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
| `products.md` | `GET merchant /products` | — | cookie-csrf | R | — | — | excluded | SSR HTML table duplicates products.list JSON; no captured fixture for an adapter; name search via products.searchAjax |
| `products.md` | `GET pos /api/v5/inventories` | — | bearer | R | — | — | excluded | count ignored (~1.5MB); unsafe as paginated catalog; use products.list / inventories.stockTurnover |
| `products.md` | `GET pos /api/v5/products` | `products.list` | bearer | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
| `purchases.md` | `GET merchant /ajax/purchase/cancel/{id}` | `purchases.cancel` | cookie-csrf | W (destructive) | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | mutation-gated | — |
| `purchases.md` | `GET merchant /purchase` | — | cookie-csrf | R | — | — | excluded | SSR HTML list (only documented order_no/supplier_name/status filter) but no captured HTML fixture to build a verified adapter; use purchases.list and filter status in code |
| `purchases.md` | `GET pos /api/v5/purchases` | `purchases.list` | bearer | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
| `purchases.md` | `GET pos /api/v5/purchases/{purchase_id}/items` | `purchases.items` | bearer | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
| `purchases.md` | `POST pos /api/v5/purchases/confirmation` | `purchases.confirmation` | bearer | W | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | mutation-gated | — |
| `reports.md` | `GET pos /api/v5/attendance/reports` | `attendance.reports` | bearer | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
| `reports.md` | `GET pos /api/v5/reports/brands` | `reports.brands` | bearer | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
| `reports.md` | `GET pos /api/v5/reports/categories` | `reports.categories` | bearer | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
| `reports.md` | `GET pos /api/v5/reports/discounts` | `reports.discounts` | bearer | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
| `reports.md` | `GET pos /api/v5/reports/employees` | `reports.employees` | bearer | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
| `reports.md` | `GET pos /api/v5/reports/ingredients/summaries` | `reports.ingredients.summaries` | bearer | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
| `reports.md` | `GET pos /api/v5/reports/merchants/visit_trending` | `reports.merchants.visitTrending` | bearer | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
| `reports.md` | `GET pos /api/v5/reports/merchants/visits` | `reports.merchants.visits` | bearer | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
| `reports.md` | `GET pos /api/v5/reports/modifiers` | `reports.modifiers` | bearer | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
| `reports.md` | `GET pos /api/v5/reports/order-types` | `reports.orderTypes` | bearer | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
| `reports.md` | `GET pos /api/v5/reports/products` | `reports.products` | bearer | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
| `reports.md` | `GET pos /api/v5/reports/promo-insight` | `reports.promoInsight` | bearer | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
| `reports.md` | `GET pos /api/v5/reports/sales/payment-types` | `reports.sales.paymentTypes` | bearer | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
| `reports.md` | `GET pos /api/v5/reports/sales/total` | — | bearer | R | — | — | excluded | Failed probe: HTTP 500 with status=saved on crawl |
| `reports.md` | `GET pos /api/v5/reports/sales/trend` | `reports.sales.trend` | bearer | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
| `reports.md` | `GET pos /api/v5/reports/summaries/discounts` | `reports.summaries.discounts` | bearer | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
| `reports.md` | `GET pos /api/v5/reports/summaries/installment` | `reports.summaries.installment` | bearer | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
| `reports.md` | `GET pos /api/v5/reports/summaries/payment-methods` | `reports.summaries.paymentMethods` | bearer | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
| `reports.md` | `GET pos /api/v5/reports/summaries/sales` | `reports.summaries.sales` | bearer | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
| `reports.md` | `GET pos /api/v5/reports/summaries/sales-insight` | `reports.summaries.salesInsight` | bearer | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
| `reports.md` | `GET pos /api/v5/reports/summaries/sales-types` | `reports.summaries.salesTypes` | bearer | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
| `reports.md` | `GET pos /api/v5/reports/summaries/transaction` | `reports.summaries.transaction` | bearer | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
| `reports.md` | `GET pos /api/v5/reports/top-products` | `reports.topProducts` | bearer | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
| `routes.md` | `GET account /api/v1/menu/access` | — | bearer | R | — | — | excluded | Dashboard chrome XHR; UI-only, not a business data API for MCP (sidebar menu permissions per role_id) |
| `routes.md` | `POST merchant /ajax/brand/create` | — | cookie-csrf | W | — | — | excluded | Documented-not-executed mutation from app.min.js; not in the approval-gated set |
| `routes.md` | `POST merchant /ajax/brand/delete` | — | cookie-csrf | W (destructive) | — | — | excluded | Documented-not-executed mutation from app.min.js; not in the approval-gated set |
| `routes.md` | `POST merchant /ajax/brand/update` | — | cookie-csrf | W | — | — | excluded | Documented-not-executed mutation from app.min.js; not in the approval-gated set |
| `routes.md` | `POST merchant /ajax/category/create` | — | cookie-csrf | W | — | — | excluded | Documented-not-executed mutation from app.min.js; not in the approval-gated set |
| `routes.md` | `POST merchant /ajax/category/delete` | — | cookie-csrf | W (destructive) | — | — | excluded | Documented-not-executed mutation from app.min.js; not in the approval-gated set |
| `routes.md` | `POST merchant /ajax/category/update` | — | cookie-csrf | W | — | — | excluded | Documented-not-executed mutation from app.min.js; not in the approval-gated set |
| `routes.md` | `GET merchant /ajax/payment/pointofinterest` | — | cookie-csrf | R | — | — | excluded | Dashboard chrome XHR; UI-only, not a business data API for MCP |
| `routes.md` | `GET merchant /ajax/product/ingredients` | `ingredients.listAjax` | cookie-csrf | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
| `routes.md` | `GET merchant /ajax/product/ingredients-recipes/total` | `ingredients.recipesTotalAjax` | cookie-csrf | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
| `routes.md` | `GET merchant /ajax/prosubs/sku1and6` | — | cookie-csrf | R | — | — | excluded | Dashboard chrome XHR; UI-only, not a business data API for MCP |
| `routes.md` | `GET merchant /customers` | — | cookie-csrf | R | — | — | excluded | SSR HTML page with no JSON API and no captured HTML fixture to build a verified adapter; customer detail via customers.get |
| `routes.md` | `GET merchant /stock/movement` | — | cookie-csrf | R | — | — | excluded | SSR HTML page with no JSON API and no captured HTML fixture to build a verified adapter; picker data via inventories.stockTurnover |
| `routes.md` | `GET merchant /stock/transfer` | — | cookie-csrf | R | — | — | excluded | SSR HTML page with no JSON API and no captured HTML fixture to build a verified adapter |
| `routes.md` | `GET merchant /taxes` | — | cookie-csrf | R | — | — | excluded | SSR HTML page with no JSON API and no captured HTML fixture to build a verified adapter |
| `routes.md` | `GET payment /api/v1/payments/pending` | `payments.pending` | bearer | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
| `routes.md` | `GET payment /api/v1/payments/pending/attributes` | `payments.pendingAttributes` | bearer | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
| `routes.md` | `GET pos /api/v5/customers/survey` | `customers.survey` | bearer | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
| `routes.md` | `GET pos /api/v5/customers/survey/setting` | `customers.surveySetting` | bearer | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
| `routes.md` | `GET pos /api/v5/merchant-feature-purchases` | — | bearer | R | — | — | excluded | Dashboard chrome XHR; UI-only, not a business data API for MCP (plan feature purchases) |
| `routes.md` | `GET pos /api/v5/prosubs/users` | — | bearer | R | — | — | excluded | Dashboard chrome XHR; UI-only, not a business data API for MCP |
| `routes.md` | `GET pos /api/v5/reminders/products` | `reminders.products` | bearer | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
| `stock-adjustment.md` | `GET merchant /stock/adjustment` | `stockAdjustment.historyHtml` | cookie-csrf | R | `src/html/stock-adjustment.ts` | `tests/unit/html-adapters.test.ts` | html-adapter | — |
| `stock-adjustment.md` | `GET pos /api/v5/inventories/adjustments` | — | bearer | R | — | — | excluded | Failed probe: 500 wrapped 405 Method Not Allowed |
| `stock-adjustment.md` | `GET pos /api/v5/inventories/stock-turnover` | `inventories.stockTurnover` | bearer | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
| `stock-adjustment.md` | `POST pos /api/v5/products/inventories/bulk` | `products.inventories.bulk` | bearer | W (destructive) | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | mutation-gated | — |
| `suppliers.md` | `GET merchant /ajax/supplier/get` | — | cookie-csrf | R | — | — | excluded | Failed probe: 405 |
| `suppliers.md` | `GET merchant /ajax/suppliers` | — | cookie-csrf | R | — | — | excluded | Failed probe: 405 |
| `suppliers.md` | `GET merchant /ajax/suppliers/get` | — | cookie-csrf | R | — | — | excluded | Failed probe: 405 |
| `suppliers.md` | `POST merchant /supplier/delete/{id}` | — | cookie-csrf | W (destructive) | — | — | excluded | Documented-not-executed mutation from app.min.js; not in the approval-gated set; deletes a supplier (Laravel form POST) |
| `suppliers.md` | `GET merchant /suppliers` | `suppliers.listHtml` | cookie-csrf | R | `src/html/suppliers.ts` | `tests/unit/html-adapters.test.ts` | html-adapter | — |
| `suppliers.md` | `GET pos /api/v5/supplier` | — | bearer | R | — | — | excluded | Failed probe: 404 |
| `suppliers.md` | `GET pos /api/v5/suppliers` | — | bearer | R | — | — | excluded | Failed probe: 400 BAD_REQUEST for all query sets tried |
| `users.md` | `GET pos /api/v5/users` | `users.list` | bearer | R | `src/dispatcher/qasir-dispatcher.ts` | `tests/unit/coverage.test.ts` | implemented | — |
