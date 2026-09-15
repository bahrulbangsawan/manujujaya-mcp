# Qasir dashboard routes

Catalog of merchant-web **pages** and the **XHR they fire on load**. Captured after signing in at `https://www.qasir.id/sign-in?lang=id` as the Manuju Jaya owner, then crawling every sidebar URL.

Merchant origin: `https://bengkel-manuju-jaya-621095.qasir.id`  
Outlet in this session: `645203`  
Role: `role_id=2` (staff / operator UI; owner still sees the full menu)

Do not commit PIN, cookies, or Bearer tokens. Rotate any secret that appeared in a chat dump.

## Auth

Full login API: [`auth-login.md`](auth-login.md).

| Step | Where |
| --- | --- |
| Sign-in page | `GET https://www.qasir.id/sign-in?lang=id` |
| Fields | `No. Handphone` (`+62` + local digits) **or** Email; `No. PIN` (6 digits, `input maxlength=6`) |
| Submit | `POST https://www.qasir.id/api/auth/login` then optional outlet/OTP |
| Land | `{slug}.qasir.id/dashboard?tokenWeb=…` then `/dashboard` |

Dashboard JS globals (not secrets):

| Global | Value in this capture |
| --- | --- |
| `POS_API_HOST` | `https://pos.qasir.id` |
| `ORDER_API_HOST` | `https://order.qasir.id` |
| `ACCOUNT_API_HOST` | `https://account.qasir.id` |
| `PAYMENT_BASE_URL` | `https://payment.qasir.id/api/v1/` |
| `SMS_API_HOST` | `https://sms.qasir.id/api` |
| `API_POS_HOST` | `https://{slug}.qasir.id/api/v4` |
| `OMNI_API_HOST` | `""` |
| `ajax_url` | `https://{slug}.qasir.id/ajax` |
| `session` | `"645203"` (current outlet id) |

`API_TOKEN` is a 32-char dashboard session. Most `pos` / `order` / `payment` calls send `Authorization: Bearer <token>`. [`inventories-stock-histories.md`](inventories-stock-histories.md) is the exception (raw token, no `Bearer `). Same-origin `/ajax/*` uses cookies + `X-CSRF-TOKEN`.

## Chrome XHR (every page)

Fired on all 34 crawled routes. Ignore when looking for a page’s data API.

| Method | URL | Query |
| --- | --- | --- |
| `GET` | `https://account.qasir.id/api/v1/menu/access` | `role_id` |
| `GET` | `https://{slug}.qasir.id/ajax/payment/pointofinterest` | — |
| `GET` | `https://{slug}.qasir.id/ajax/prosubs/sku1and6` | — |
| `GET` | `https://pos.qasir.id/api/v5/prosubs/users` | — |

Occasional extra chrome: `GET pos.qasir.id/api/v5/merchant-feature-purchases?status=ACTIVE` (and sometimes `iap_product_id` / `iap_product_sku`).

## Sidebar pages

| Menu | Page | Title | Data on load | Detail doc |
| --- | --- | --- | --- | --- |
| Beranda | `/dashboard` | Beranda | reports summaries + top-products (see below) | [`reports.md`](reports.md) |
| Laporan → Ringkasan Penjualan | `/report/sales/summary` | Ringkasan Penjualan | `GET /api/v5/reports/summaries/sales` + `…/summaries/transaction` | [`reports.md`](reports.md) |
| Laporan → Tren Penjualan | `/report/sales/trend` | Tren Penjualan | `GET /api/v5/reports/sales/trend` | [`reports.md`](reports.md) |
| Laporan → Metode Pembayaran | `/report/sales/paymentType` | Metode Pembayaran | `GET /api/v5/reports/sales/payment-types` | [`reports.md`](reports.md) |
| Laporan → Tipe Order | `/report/sales/orderType` | Laporan Tipe Order | `GET /api/v5/reports/order-types` | [`reports.md`](reports.md) |
| Laporan → Penjualan Per Kategori | `/report/sales/category` | Penjualan Per Kategori | `GET /api/v5/reports/categories` + `…/summaries/transaction` | [`reports.md`](reports.md) |
| Laporan → Penjualan Per Produk | `/report/sales/item` | Penjualan per Produk | `GET /api/v5/reports/products` + `…/summaries/transaction` | [`reports.md`](reports.md) |
| Laporan → Penjualan Per Merek | `/report/sales/brand` | Penjualan Per Merek | `GET /api/v5/reports/brands` + `…/summaries/transaction` | [`reports.md`](reports.md) |
| Laporan → Laporan Pajak | `/report/sales/tax` | Laporan Pajak | **none** (chrome only) | — |
| Laporan → Laporan Pelanggan | `/report/customers` | Laporan Pelanggan | **none** (chrome only) | — |
| Laporan → Laporan Pegawai | `/report/sales/staff` | Laporan Pegawai | `GET /api/v5/reports/employees` | [`reports.md`](reports.md) |
| Laporan → Laporan Diskon | `/report/sales/discount` | Laporan Diskon | `GET /api/v5/reports/discounts` + `…/summaries/discounts` | [`reports.md`](reports.md) |
| Laporan → Laporan Absensi | `/report/attendance` | Laporan Absensi | `GET /api/v5/attendance/reports` | [`reports.md`](reports.md) |
| Laporan → Opsi Tambahan | `/report/sales/modifier` | Opsi Tambahan | `GET /api/v5/reports/modifiers` | [`reports.md`](reports.md) |
| Riwayat Transaksi | `/report/transaction` | Riwayat Transaksi | `GET order.qasir.id/api/v5/order/histories/web` | [`order-histories-web.md`](order-histories-web.md) |
| Pembayaran → Menunggu Pembayaran | `/payment/pending` | Menunggu Pembayaran | `GET payment.qasir.id/api/v1/payments/pending` + `…/pending/attributes` | below |
| Produk → Katalog Produk | `/products` | Produk | **SSR HTML** | [`products.md`](products.md) |
| Produk → Bahan Baku & Resep | `/ingredients-recipes` | Bahan Baku | `GET {origin}/ajax/product/ingredients` + `…/ingredients-recipes/total` | below |
| Produk → Pajak | `/taxes` | Pajak | **SSR HTML** | — |
| Produk → Pengingat | `/product-reminder` | (generic title) | `GET /api/v5/reminders/products` | below |
| Pegawai | `/users` | Pegawai | `GET /api/v5/users` | [`users.md`](users.md) |
| Inventaris → Ringkasan | `/stock/inventory` | Ringkasan Stok Bahan Baku | `GET /api/v5/reports/ingredients/summaries` | [`reports.md`](reports.md) |
| Inventaris → Supplier | `/suppliers` | Supplier | **SSR HTML** | [`suppliers.md`](suppliers.md) |
| Inventaris → Pembelian | `/purchase` | Pembelian | **SSR HTML** (JSON list exists if called) | [`purchases.md`](purchases.md) |
| Inventaris → Pemindahan Stok | `/stock/transfer` | Pemindahan Stok | **SSR HTML** | — |
| Inventaris → Penyesuaian Stok | `/stock/adjustment` | (generic title) | **SSR HTML** | [`stock-adjustment.md`](stock-adjustment.md) |
| Inventaris → Perputaran Stok | `/stock/movement` | Perputaran Stok | **SSR HTML** | [`stock-adjustment.md`](stock-adjustment.md) (picker is `stock-turnover`) |
| Pelanggan → Data Pelanggan | `/customers` | Pelanggan | **SSR HTML** | [`customers.md`](customers.md) (detail JSON) |
| Pelanggan → Survei Pelanggan | `/customers/survey` | Survei Pelanggan | `GET /api/v5/customers/survey` + `…/survey/setting` | below |
| Website Usaha → Statistik | `/microsite/statistic` | (generic title) | `GET /api/v5/reports/merchants/visits` + `…/visit_trending` | [`reports.md`](reports.md) |
| Website Usaha → Laporan Link Toko | `/microsite/linktoko` | (generic title) | same visit APIs | [`reports.md`](reports.md) |
| Integrasi | `/add-on` | Integrasi | `GET /api/v5/reports/promo-insight` | — |
| Profil | `/account/profile` | Profil | chrome only | — |
| Pro | `/prosubs/features` | (title leaked as Profil) | chrome only | — |

**SSR HTML** = table is in the document; no catalog XHR on load. JSON may still exist (products, purchases) if you call `pos.qasir.id` directly.

## Dashboard-only APIs

`/dashboard` additionally calls:

| Method | Path | Query keys | Status |
| --- | --- | --- | --- |
| `GET` | `pos.qasir.id/api/v5/reports/summaries/sales-types` | `start_date`, `end_date`, `outlet_ids`, `sort` | 200 |
| `GET` | `pos.qasir.id/api/v5/reports/summaries/transaction` | `start_date`, `end_date`, `outlet_ids` | 200 |
| `GET` | `pos.qasir.id/api/v5/reports/top-products` | `sort`, `page`, `count`, `start_date`, `end_date`, `outlet_ids` | 200 |
| `GET` | `pos.qasir.id/api/v5/reports/summaries/installment` | `page`, `count`, `start_date`, `end_date`, `outlet_ids` | 200 |
| `GET` | `pos.qasir.id/api/v5/reports/summaries/payment-methods` | `start_date`, `end_date`, `outlet_ids`, `sort`, `country_code`, `language_code` | 200 |
| `GET` | `pos.qasir.id/api/v5/reports/promo-insight` | — | 200 |
| `GET` | `pos.qasir.id/api/v5/reports/summaries/sales-insight` | `start_date`, `end_date`, `outlet_ids` | 200 |
| `GET` | `pos.qasir.id/api/v5/reports/sales/total` | `outlet_ids`, `status=saved` | **500** |

Default date window in this crawl: `start_date=2026-09-08`, `end_date=2026-09-15` (rolling last 7 days).

## Other page-specific APIs (not reports)

### Pending payments

```
GET https://payment.qasir.id/api/v1/payments/pending?page=&start_date=&end_date=&invoice_number=&status=
GET https://payment.qasir.id/api/v1/payments/pending/attributes?is_read=&status=
```

Page: `/payment/pending`. Host is `payment.qasir.id`, not `pos`.

### Ingredients / recipes

```
GET https://{slug}.qasir.id/ajax/product/ingredients?count=&page=&outlet_ids=&search=&status_stock=
GET https://{slug}.qasir.id/ajax/product/ingredients-recipes/total
```

Page: `/ingredients-recipes`. Cookie ajax, not Bearer.

### Product reminders

```
GET https://pos.qasir.id/api/v5/reminders/products?count=&page=&outlet_ids=&type=
```

Page: `/product-reminder`.

### Customer survey

```
GET https://pos.qasir.id/api/v5/customers/survey?count=&page=&outlet_ids=&start_date=&end_date=
GET https://pos.qasir.id/api/v5/customers/survey/setting
```

Page: `/customers/survey`.

## JSON lists that the HTML page does **not** call

Probed earlier; usable for MCP even though the table is SSR:

| Page | JSON |
| --- | --- |
| `/products` | [`products.md`](products.md) `GET pos.qasir.id/api/v5/products` |
| `/purchase` | [`purchases.md`](purchases.md) `GET pos.qasir.id/api/v5/purchases` |
| `/report/transaction` detail | [`order-histories-legacy.md`](order-histories-legacy.md) |
| `/stock/adjustment` form picker | [`stock-adjustment.md`](stock-adjustment.md) `GET …/inventories/stock-turnover` |
| stock card | [`inventories-stock-histories.md`](inventories-stock-histories.md) |
| `/customers` row | [`customers.md`](customers.md) `GET …/customers/{id}` |
| `/suppliers` | no working JSON ([`suppliers.md`](suppliers.md)) |

## Mutations (from `app.min.js`, not fired on crawl)

Do not POST unless you intend to change data.

| Method | URL | Action |
| --- | --- | --- |
| `POST` | `pos.qasir.id/api/v5/products/inventories/bulk` | Save stock adjustment |
| `POST` | `pos.qasir.id/api/v5/purchases/confirmation` | Finish PO receive |
| `GET` | `{origin}/ajax/purchase/cancel/{id}` | Cancel PO |
| `POST` | `{origin}/ajax/category/create` / `update` / `delete` | Categories |
| `POST` | `{origin}/ajax/brand/create` / `update` / `delete` | Brands |

## Crawl stats

34 pages, all `ok`. 193 XHRs → **37** unique method+path (including 4 chrome). Date of crawl: 2026-09-15.
