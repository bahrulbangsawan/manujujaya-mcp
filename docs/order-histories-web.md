# Qasir Order Histories (Web)

Paginated sales history for an outlet, grouped by day, with period totals. Optional `customer_id` scopes the list to one customer (customer-detail page).

Captured from the Qasir web dashboard (`bengkel-manuju-jaya-621095.qasir.id` → `order.qasir.id`).

Customer-page companion: [`customers.md`](customers.md), [`order-histories-installment.md`](order-histories-installment.md).

## Endpoint

```
GET https://order.qasir.id/api/v5/order/histories/web
```

Same-site CORS from the merchant dashboard origin.

## Query parameters

| Name | Type | Required | Example | Notes |
| --- | --- | --- | --- | --- |
| `page` | integer | yes | `1` | 1-based page index |
| `count` | integer | yes | `25` | Page size (`pagination.page_size`) |
| `start_date` | `YYYY-MM-DD` | yes | `2026-09-07` | Inclusive range start |
| `end_date` | `YYYY-MM-DD` | yes | `2026-09-14` | Inclusive range end |
| `outlet_ids` | integer / CSV | yes | `645203` | Outlet filter. Sample uses a single id |
| `settle_by` | string | no | `` | Cashier / settler name. Empty = all. Omitted (not `""`) on the customer-page capture |
| `invoice_number` | string | no | `` | Invoice search. Empty = all. Omitted on the customer-page capture |
| `customer_id` | integer | no | `5442932` | Same id as [`customers.md`](customers.md). Omit for outlet-wide history |

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
curl --url 'https://order.qasir.id/api/v5/order/histories/web?page=1&start_date=2026-09-07&end_date=2026-09-14&settle_by=&invoice_number=&count=25&outlet_ids=645203' \
  -H 'accept: */*' \
  -H 'accept-language: en-US,en;q=0.9,id;q=0.8' \
  -H 'authorization: Bearer <TOKEN>' \
  -H 'origin: https://bengkel-manuju-jaya-621095.qasir.id' \
  -H 'referer: https://bengkel-manuju-jaya-621095.qasir.id/' \
  -H 'x-csrf-token: <CSRF_TOKEN>'
```

Customer-page capture (no `settle_by` / `invoice_number`):

```bash
curl --url 'https://order.qasir.id/api/v5/order/histories/web?page=1&start_date=2026-09-08&end_date=2026-09-15&count=25&customer_id=5442932&outlet_ids=645203' \
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
  "data": {
    "agg": { "total_items": 187, "total_amount": 75046500 },
    "sales": []
  },
  "pagination": {
    "current_page": 1,
    "page_size": 25,
    "total_page": 8,
    "total_result": 191,
    "next": "/api/v5/order/histories/web?count=25&end_date=2026-09-14&invoice_number=&outlet_ids=645203&page=2&settle_by=&start_date=2026-09-07"
  },
  "trace_id": "03b842c9df246d94645f93656544856d"
}
```

`pagination.next` is a path only (no host). **Omitted** when there is no next page (`total_page: 1` on the customer-filtered capture). Do not require the key.

### `data.agg`

Period-wide totals for the **filtered range**, not the current page.

| Field | Type | Sample | Notes |
| --- | --- | --- | --- |
| `total_items` | integer | `187` | Distinct from `pagination.total_result` (`191` in this capture) |
| `total_amount` | integer | `75046500` | IDR, integer (no decimals) |

Treat `total_items` vs `total_result` as different counters. Likely cancelled / voided rows are in pagination but excluded from `agg`.

### `data.sales[]`

One object per calendar day that has rows on this page. Newest day first in the sample.

| Field | Type | Sample |
| --- | --- | --- |
| `date` | `YYYY-MM-DD` | `2026-09-14` |
| `daily_amount` | integer | `9170000` |
| `items` | array | Sales on that day, newest first |

`daily_amount` is the day's total as returned by the API. Do not assume it equals `sum(items[].amount)` on a partial page.

### `data.sales[].items[]`

| Field | Type | Sample | Notes |
| --- | --- | --- | --- |
| `sales_id` | integer | `1077350403` | Primary id |
| `status` | integer | `2` | See status table |
| `date_time` | `HH:MM` | `17:54` | Local time, no timezone / seconds |
| `invoice_number` | string | `65717IV0` | 8-char invoice code |
| `outlet_name` | string | `Toko Manuju Jaya` | Display name |
| `settle_by` | string | `D'Talli` | Cashier. May have trailing spaces |
| `payment_mode` | string | `CASH` | Observed: `CASH`, `QRIS` |
| `amount` | integer | `830000` | IDR. Can be `0` |
| `sales_type_name` | string | `""` | Empty in this capture |

### Observed `status` values

Not documented by Qasir in this capture. Inferred only from the sample:

| `status` | In sample | Amount | Working guess |
| --- | --- | --- | --- |
| `2` | most rows | > 0 or `0` | Completed / settled |
| `3` | `657134LF` | `0` | Cancelled / void |
| `6` | `65710NZA` | `284000` | Unknown (not completed-2) |

Do not encode these guesses as fact until confirmed.

## Pagination

Outlet-wide sample: `page=1`, `count=25` → `total_page=8`, `total_result=191`.

Customer-filtered sample (`customer_id=5442932`, `2026-09-08`–`2026-09-15`): `total_page=1`, `total_result=1`, no `next`.

Walk pages with `page=N` or follow `pagination.next` on the same host:

```
https://order.qasir.id{pagination.next}
```

`agg` is range-level; repeating it on every page is expected. On the customer capture `agg.total_items` (`1`) matched `pagination.total_result`.

## Sample item

```json
{
  "sales_id": 1077348318,
  "status": 2,
  "date_time": "17:51",
  "invoice_number": "6571725N",
  "outlet_name": "Toko Manuju Jaya",
  "settle_by": "Hj_Uni Suwarni  ",
  "payment_mode": "CASH",
  "amount": 830000,
  "sales_type_name": ""
}
```

## Implementation notes

- Amounts are integer IDR. Format on the client (`75046500` → `Rp 75.046.500`).
- Trim `settle_by` before grouping; names can include trailing whitespace.
- `date_time` is time-of-day only. Combine with parent `sales[].date` for a timestamp.
- Filter cashiers / invoices / customers via `settle_by`, `invoice_number`, and `customer_id`; do not client-filter the full range if the API already supports it.
- Auth is a dashboard Bearer session, not a public API key. Expect expiry; refresh from a logged-in Qasir session.
