# Qasir Inventory Stock Histories

Paginated stock movements for one inventory item at an outlet.

Captured from the Qasir web dashboard (`bengkel-manuju-jaya-621095.qasir.id` → `pos.qasir.id`).

`sales_id` on a history row can be passed to [`order-histories-legacy.md`](order-histories-legacy.md) as `{sales_id}`.

## Endpoint

```
GET https://pos.qasir.id/api/v5/inventories/{inventory_id}/stock-histories
```

Host is `pos.qasir.id`, not `order.qasir.id`. Same-site CORS from the merchant dashboard origin.

## Path parameters

| Name | Type | Required | Example | Notes |
| --- | --- | --- | --- | --- |
| `inventory_id` | integer | yes | `25950360` | Inventory / product-stock id. Response `data.id` is the same value as a **string** |

## Query parameters

| Name | Type | Required | Example | Notes |
| --- | --- | --- | --- | --- |
| `page` | integer | yes | `1` | 1-based page index |
| `count` | integer | yes | `10` | Page size (`pagination.page_size`) |
| `outlet_ids` | integer / CSV | yes | `645203` | Outlet filter. Sample uses a single id |
| `type` | CSV string | yes | `sales,purchase,transfer,adjustment-plus,adjustment-minus,refund` | Movement types to include. Comma-separated; URL-encoded as `%2C` |
| `sort` | string | no | `` | Empty in this capture. Sort keys not observed |

### Observed `type` values

| Value | In this page | `quantity` sign |
| --- | --- | --- |
| `sales` | yes | `-1` (stock out) |
| `refund` | yes | `+1` (stock in) |
| `purchase` | requested, none on page | — |
| `transfer` | requested, none on page | — |
| `adjustment-plus` | requested, none on page | — |
| `adjustment-minus` | requested, none on page | — |

Do not assume purchase / transfer / adjustment payloads until captured.

## Headers

| Header | Required | Notes |
| --- | --- | --- |
| `authorization` | yes | Raw token **without** `Bearer `. Order APIs use `Bearer <token>`; this POS call does not |
| `x-csrf-token` | yes | Dashboard CSRF token |
| `origin` | yes (browser) | Merchant host, e.g. `https://<slug>.qasir.id` |
| `referer` | no | Dashboard origin |
| `accept` | no | `*/*` |
| `accept-language` | no | Browser locale |

Do not commit live tokens. Rotate any token that appeared in a captured curl.

## Example request

```bash
curl --url 'https://pos.qasir.id/api/v5/inventories/25950360/stock-histories?count=10&page=1&sort=&outlet_ids=645203&type=sales%2Cpurchase%2Ctransfer%2Cadjustment-plus%2Cadjustment-minus%2Crefund' \
  -H 'accept: */*' \
  -H 'accept-language: en-US,en;q=0.9,id;q=0.8' \
  -H 'authorization: <TOKEN>' \
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
  "data": {
    "id": "25950360",
    "product_name": "FILTER UDARA M/L300E4 1500-A286(A07)-",
    "stock": 0,
    "stock_histories": [],
    "track_stock": true
  },
  "pagination": {
    "current_page": 1,
    "page_size": 10,
    "total_page": 5,
    "total_result": 43,
    "next": "/api/v5/inventories/25950360/stock-histories?count=10&outlet_ids=645203&page=2&sort=&type=sales%2Cpurchase%2Ctransfer%2Cadjustment-plus%2Cadjustment-minus%2Crefund"
  },
  "trace_id": "f5cedd365ddc6981c66f460865d3a315"
}
```

`pagination.next` is a path only (no host). Prefix `https://pos.qasir.id`.

### `data`

Item header for the **outlet**, not the current page of movements.

| Field | Type | Sample | Notes |
| --- | --- | --- | --- |
| `id` | string | `"25950360"` | Path `inventory_id` as string |
| `product_name` | string | `FILTER UDARA M/L300E4 1500-A286(A07)-` | Trailing hyphen in this capture |
| `stock` | integer | `0` | Current on-hand qty at the filtered outlet |
| `stock_histories` | array | 10 rows | Newest first |
| `track_stock` | boolean | `true` | Stock tracking enabled for this item |

### `data.stock_histories[]`

| Field | Type | Sample | Notes |
| --- | --- | --- | --- |
| `id` | string | `01M1WP6829ZGWW9X2973RWF0TF` | ULID |
| `opname` | integer | `0` | On-hand stock **after** this movement. Walking newest→oldest: `opname` of row N equals next-older row’s post-qty ± that row’s `quantity` |
| `quantity` | integer | `-1` | Delta. Negative = out, positive = in |
| `notes` | string | `650100IC` | Invoice number on many `sales` rows (same 8-char shape as order `invoice_number`). Empty on all `refund` rows in this page, and on some `sales` |
| `type` | string | `sales` | See type table |
| `created_date` | string | `2026-09-07 01:02:14.608837 +0000 +0000` | UTC. Go `time.Time` string (`offset` + zone both `+0000`). **Not** local `settled_at` from the order detail API |
| `created_by` | object | see below | Can be empty `{ "id": "", "name": "" }` |
| `sales_id` | string | `"1073282611"` | **String**. Order APIs use integer `sales_id` / path param |
| `is_saved_transaction` | boolean | `false` | Held / parked sale |
| `is_deleted_saved_transaction` | boolean | `false` | Saved sale later deleted; paired refunds in this page set this `true` |

`opname` is not “stock opname / physical count” in this capture. It is the running balance after the row.

### `data.stock_histories[].created_by`

| Field | Type | Sample | Notes |
| --- | --- | --- | --- |
| `id` | string | `"2745714"` | **String**. Empty when unknown |
| `name` | string | `Example Staff   ` | Trailing spaces. Empty when `id` is empty |

### Saved-transaction pairing (this page)

Same `sales_id` can appear twice: a `sales` row then a later `refund`.

| `sales_id` | `sales` flags | later `refund` flags |
| --- | --- | --- |
| `1020562902` | `is_saved_transaction: true`, `is_deleted_saved_transaction: false` | `true` / `true` |
| `1012676612` | `true` / `false` | `true` / `true` |
| `1003090301` | `true` / `false` | `true` / `true` |

Working guess: parked sale (`is_saved_transaction`) undone by a refund that marks `is_deleted_saved_transaction`. Do not encode as fact until confirmed.

## Pagination

Sample: `page=1`, `count=10` → `total_page=5`, `total_result=43`.

Walk pages with `page=N` or follow `pagination.next` on `https://pos.qasir.id`.

`data.stock` / `data.product_name` are item-level; repeating them on every page is expected.

## Sample item

```json
{
  "id": "01M1WP6829ZGWW9X2973RWF0TF",
  "opname": 0,
  "quantity": -1,
  "notes": "650100IC",
  "type": "sales",
  "created_date": "2026-09-07 01:02:14.608837 +0000 +0000",
  "created_by": { "id": "2745714", "name": "Example Staff   " },
  "sales_id": "1073282611",
  "is_saved_transaction": false,
  "is_deleted_saved_transaction": false
}
```

## Implementation notes

- `authorization` is the raw dashboard token, no `Bearer ` prefix.
- Parse `created_date` as UTC. Order detail `settled_at` is local (`YYYY-MM-DD HH:MM:SS` with no offset). Do not string-compare them.
- Display running stock from `opname` (after) and delta from `quantity`. Reconstruct before as `opname - quantity`.
- Trim `created_by.name` before grouping.
- `sales_id` and `created_by.id` are strings here; coerce to integer before calling order APIs.
- `notes` is not a free-text reason on `sales` — it is often the invoice number. Refunds in this page have `notes: ""`.
- Auth is a dashboard session, not a public API key. Expect expiry; refresh from a logged-in Qasir session.
