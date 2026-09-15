# Qasir Stock Adjustment

Three different surfaces:

1. **History table** — SSR HTML at `/stock/adjustment` (no JSON list in this capture).
2. **Product picker** — `GET /api/v5/inventories/stock-turnover` (form infinite scroll).
3. **Save** — `POST /api/v5/products/inventories/bulk` (from `app.min.js`; not live-posted here).

Captured from the Qasir web dashboard (`bengkel-manuju-jaya-621095.qasir.id` → `pos.qasir.id`).

Picker `variants[].id` is `{inventory_id}` in [`inventories-stock-histories.md`](inventories-stock-histories.md) (integer here; string on products / stock-histories).

## 1. History table (the page)

```
GET https://<slug>.qasir.id/stock/adjustment
```

Cookie session. Title in this capture: `Qasir | Sistem Dagang Pake Jempol` (not “Penyesuaian”). Vue root `#stockAdjustment`.

### Query parameters

| Name | Type | Required | Example | Notes |
| --- | --- | --- | --- | --- |
| `searchdate` | string | no | `` | Date range. Empty on the open page |
| `variant` | string | no | `` | Product search |
| `sort` | string | no | `` | `<select name="sort">` |
| `type_product` | string | no | `` | `<select name="type_product">` |
| `page` | integer | no | `2` | `?page=2` present. Page size / total not in the header |

### Table columns

Tanggal Penyesuaian, Nama Produk, Jenis Barang, Outlet, Penyesuaian, Catatan.

New adjustment: `/stock/adjustment/form`. Sibling nav: `/stock/inventory`, `/stock/transfer`, `/stock/movement`.

### JSON list probe

`GET https://pos.qasir.id/api/v5/inventories/adjustments` → **500** wrapped **405 Method Not Allowed**. Not a GET list.

Scrape the HTML for history until a list API is captured.

## 2. Product picker — stock-turnover

Used by `#stockAdjustment` form `loadMore` / dashboard `getMovements` in `app.min.js`.

```
GET https://pos.qasir.id/api/v5/inventories/stock-turnover
```

### Query parameters

| Name | Type | Required | Example | Notes |
| --- | --- | --- | --- | --- |
| `outlet_ids` | integer / CSV | yes | `645203` | Form uses `session` / `localStorage.outletlist` |
| `page` | integer | yes | `1` | |
| `count` | integer | yes | `5` / `30` | Honored. Form uses `30`; dashboard promo card uses `3` if Pro else `1` |
| `sort` | string | yes in JS | `created_at` | Echoed in `pagination.next`. Other keys not captured |
| `search` | string | no | `` | Form `searchItem`. Not sent in the sample below |

### Headers

| Header | Required | Notes |
| --- | --- | --- |
| `authorization` | yes | `Bearer <token>` (`app.min.js` sets `Authorization` to `API_TOKEN`; Bearer worked in this capture) |
| `x-csrf-token` | yes | Dashboard CSRF |
| `origin` | yes (browser) | Merchant host |
| `accept` | no | `*/*` |

Do not commit live tokens.

### Example request

```bash
curl --url 'https://pos.qasir.id/api/v5/inventories/stock-turnover?outlet_ids=645203&page=1&count=5&sort=created_at' \
  -H 'accept: */*' \
  -H 'authorization: Bearer <TOKEN>' \
  -H 'origin: https://bengkel-manuju-jaya-621095.qasir.id' \
  -H 'referer: https://bengkel-manuju-jaya-621095.qasir.id/' \
  -H 'x-csrf-token: <CSRF_TOKEN>'
```

### Response

```json
{
  "code": 200,
  "message": "Berhasil",
  "data": { "variants": [] },
  "pagination": {
    "current_page": 1,
    "page_size": 5,
    "total_page": 2757,
    "total_result": 13784,
    "next": "/api/v5/inventories/stock-turnover?count=5&outlet_ids=645203&page=2&sort=created_at"
  }
}
```

`total_result` **13784** is outlet variants (larger than [`products.md`](products.md) `8056` products). Prefix `pagination.next` with `https://pos.qasir.id`.

### `data.variants[]`

| Field | Type | Sample | Notes |
| --- | --- | --- | --- |
| `id` | integer | `25952218` | **Integer** here. Products / stock-histories use string ids |
| `product_name` | string | `FILTER SOLAR N/CWM330 E2 ATAS FC-1817(A15)` | |
| `stock` | integer | `0` | Outlet on-hand |
| `price_sell` | integer | `80000` | IDR |
| `latest_adjustment_date` | ISO-8601 UTC | `2022-01-21T14:53:44.893348Z` | Fractional seconds. Empty string if none — not observed; sales empty uses `""` |
| `latest_sales_date` | string | `""` | Empty when no sales |
| `latest_adjustment_till_now` | string | `"1697"` | **String** day count (working guess). Not an integer |
| `latest_sales_till_now` | string | `"0"` | Same |

This is **not** the adjustment history. It is current stock plus last-touch dates, for picking what to adjust.

### Sample item

```json
{
  "id": 25952218,
  "product_name": "FILTER SOLAR N/CWM330 E2 ATAS FC-1817(A15)",
  "stock": 0,
  "price_sell": 80000,
  "latest_adjustment_date": "2022-01-21T14:53:44.893348Z",
  "latest_sales_date": "",
  "latest_adjustment_till_now": "1697",
  "latest_sales_till_now": "0"
}
```

## 3. Save — bulk inventories

From `app.min.js` (form submit). **Not executed** in this capture. Mutates stock.

```
POST https://pos.qasir.id/api/v5/products/inventories/bulk
Authorization: Bearer <token>
Content-Type: application/json
```

Body shape assembled in JS:

```json
{
  "data": [
    {
      "variant_id": 0,
      "product_id": 0,
      "outlet_id": 645203,
      "stock": 0,
      "notes": "",
      "stock_min": 0,
      "track_stock": true
    }
  ]
}
```

`stock` is `selectedVariants[].adjustment` (the new qty / delta — confirm before writing). Success → `localStorage.adjustment_success` and redirect `/stock/adjustment`.

Do not POST unless you intend to change on-hand.

## Implementation notes

- History: scrape `/stock/adjustment` HTML. Picker / current stock: this turnover API.
- Coerce `id` to string before stock-histories (`/inventories/{id}/stock-histories`).
- `latest_*_till_now` are strings. Parse as numbers if you chart them.
- Amounts are integer IDR.
- Auth is a dashboard Bearer session, not a public API key. Expect expiry; refresh from a logged-in Qasir session.
