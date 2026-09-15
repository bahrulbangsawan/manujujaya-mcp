# Qasir Purchases

Paginated purchase orders (PO list). Optional per-PO line items.

Captured from the Qasir web dashboard (`bengkel-manuju-jaya-621095.qasir.id` → `pos.qasir.id`).

`supplier_id` / `supplier_name` match rows on [`suppliers.md`](suppliers.md). Line `variant_id` is `{inventory_id}` in [`inventories-stock-histories.md`](inventories-stock-histories.md).

The `/purchase` HTML table is **server-rendered**. Same first ids as this JSON list.

## Endpoint

```
GET https://pos.qasir.id/api/v5/purchases
```

Host is `pos.qasir.id`. Same-site CORS from the merchant dashboard origin.

## Query parameters

| Name | Type | Required | Example | Notes |
| --- | --- | --- | --- | --- |
| `page` | integer | yes | `1` | 1-based page index |
| `count` | integer | yes | `10` | Page size (`pagination.page_size`). Honored |
| `outlet_ids` | integer / CSV | no | `645203` | Optional. Sample with and without it returned the same first POs (`outlet_id` already `645203`) |

HTML filters `order_no`, `supplier_name`, `status` were **not** observed on this v5 list. Do not assume they work here until captured.

## Headers

| Header | Required | Notes |
| --- | --- | --- |
| `authorization` | yes | `Bearer <token>` |
| `x-csrf-token` | yes | Dashboard CSRF token |
| `origin` | yes (browser) | Merchant host, e.g. `https://<slug>.qasir.id` |
| `referer` | no | Dashboard origin |
| `accept` | no | `*/*` |
| `accept-language` | no | Browser locale |

Do not commit live tokens. Rotate any token that appeared in a captured curl.

## Example request

```bash
curl --url 'https://pos.qasir.id/api/v5/purchases?page=1&count=10' \
  -H 'accept: */*' \
  -H 'accept-language: en-US,en;q=0.9,id;q=0.8' \
  -H 'authorization: Bearer <TOKEN>' \
  -H 'origin: https://bengkel-manuju-jaya-621095.qasir.id' \
  -H 'referer: https://bengkel-manuju-jaya-621095.qasir.id/' \
  -H 'x-csrf-token: <CSRF_TOKEN>'
```

## Response

Envelope:

```json
{
  "code": 200,
  "message": "Berhasil",
  "data": { "purchases": [] },
  "pagination": {
    "current_page": 1,
    "page_size": 10,
    "total_page": 380,
    "total_result": 3795,
    "next": "/api/v5/purchases?count=10&page=2"
  },
  "trace_id": "…"
}
```

`pagination.next` is a path only. Prefix `https://pos.qasir.id`.

HTML header on the same merchant: `Total Pembelian: Rp4.722.426.915` (sum of amounts, not `total_result`).

### `data.purchases[]`

Newest first in this capture.

| Field | Type | Sample | Notes |
| --- | --- | --- | --- |
| `id` | string | `"1147217"` | **String**. Dashboard `/purchase/detail/1147217` |
| `order_no` | string | `PO-20260904001147217621095` | `PO-` + date + id + merchant id |
| `outlet_id` | string | `"645203"` | |
| `supplier_id` | string | `"33006"` | Not the HTML `/supplier/form/{id}` in this sample (`33006` vs dashboard form ids like `52887`). Treat as POS supplier id until a join is captured |
| `supplier_name` | string | `JNM (Sparepart Factory)` | |
| `notes` | string | `SUNGAI RIMBO SBY 28-08-26 No. 11167` | Free text / shipment ref |
| `total_price` | integer | `1632000` | IDR. PO total, not unit cost |
| `status` | string | `completed` | See status table |
| `created_at` | ISO-8601 UTC | `2026-09-04T11:54:40Z` | |
| `updated_at` | ISO-8601 UTC | `2026-09-12T11:55:09Z` | Receive/complete time can be days after `created_at` |

### Observed `status` values

This page:

| `status` | In sample |
| --- | --- |
| `completed` | received |
| `order_processed` | still open |
| `canceled` | one row (`1146985`) |

Do not assume other statuses until captured.

## Pagination

`count=5` → `total_page=759`. `count=10` → `total_page=380`. Same `total_result` **3795**.

HTML `/purchase` is **15** rows/page × **253** pages = 3795. Same population as this API.

Walk pages with `page=N` or `https://pos.qasir.id{pagination.next}`.

## Sample item

```json
{
  "id": "1147217",
  "order_no": "PO-20260904001147217621095",
  "outlet_id": "645203",
  "supplier_id": "33006",
  "supplier_name": "JNM (Sparepart Factory)",
  "notes": "SUNGAI RIMBO SBY 28-08-26 No. 11167",
  "total_price": 1632000,
  "status": "completed",
  "created_at": "2026-09-04T11:54:40Z",
  "updated_at": "2026-09-12T11:55:09Z"
}
```

## Line items

```
GET https://pos.qasir.id/api/v5/purchases/{purchase_id}/items?outlet_id=645203
```

Same Bearer headers. `purchase_id` = list `id`. `outlet_id` required in `app.min.js` (`session`).

Sample (`1147217`):

```json
{
  "code": 200,
  "message": "Berhasil",
  "data": {
    "purchase_items": [
      {
        "id": "7775551",
        "price_base": 163200,
        "price_sell": 350000,
        "price_unit": 163200,
        "product_id": "20562817",
        "product_name": "MASTER KOPLING M/L300 PS100 PS120 5/8\"(C03)",
        "quantity": 10,
        "receive_quantity": 10,
        "stock": 10,
        "total_modifier": 0,
        "unit_label_id": "745580",
        "unit_label_name": "Set",
        "variant_id": "36288690",
        "variant_is_ingredient": false,
        "variant_name": "MCM-S01 BIRKENS"
      }
    ]
  }
}
```

| Field | Type | Sample | Notes |
| --- | --- | --- | --- |
| `id` | string | `"7775551"` | Line id |
| `product_id` | string | `"20562817"` | [`products.md`](products.md) `id` |
| `variant_id` | string | `"36288690"` | Stock-histories path |
| `quantity` | integer | `10` | Ordered |
| `receive_quantity` | integer | `10` | Received. Equals `quantity` on this completed PO |
| `price_unit` / `price_base` | integer | `163200` | Unit cost. `10 × 163200 = 1632000` = PO `total_price` |
| `price_sell` | integer | `350000` | Current sell, not PO cost |
| `stock` | integer | `10` | On-hand after receive in this capture — confirm before treating as live stock |
| `unit_label_name` | string | `Set` | |

No pagination on this items call (single PO).

## Related endpoints

### Dashboard HTML

```
GET https://<slug>.qasir.id/purchase?order_no=&supplier_name=&status=
```

Cookie session. 15 rows/page. Columns: Tanggal Pembelian, No. Order, Supplier, Jumlah Pembelian, Status (+ expandable lines: Nama Produk, Jumlah Diterima, Jumlah Dibeli, Harga Beli Satuan, Harga Modal Satuan).

Create `/purchase/form`. Edit `/purchase/form/{id}`. Detail `/purchase/detail/{id}`.

### Confirm / cancel (from `app.min.js`, not this capture’s Network)

| Call | Role |
| --- | --- |
| `POST https://pos.qasir.id/api/v5/purchases/confirmation` | Finish receive. Body `{ purchase_id, outlet_id, is_modified_price, items }` |
| `GET https://<slug>.qasir.id/ajax/purchase/cancel/{id}` | Cancel PO |

Do not POST these unless you intend to mutate stock.

## Implementation notes

- Prefer this v5 list for JSON. HTML scrape only for filters (`order_no` / `supplier_name` / `status`) until those query params are proven on v5.
- Ids are strings. Coerce before joining to HTML integer paths.
- Amounts are integer IDR.
- Auth is a dashboard Bearer session, not a public API key. Expect expiry; refresh from a logged-in Qasir session.
