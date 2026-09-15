# Qasir Order Histories (Installment)

Paginated installment / credit-sale history, optionally scoped to one customer.

Captured from the Qasir web dashboard (`bengkel-manuju-jaya-621095.qasir.id` → `order.qasir.id`), customer-detail tab alongside [`customers.md`](customers.md) and [`order-histories-web.md`](order-histories-web.md).

This capture returned **no rows**. Item / `agg` shape is not observed.

## Endpoint

```
GET https://order.qasir.id/api/v5/order/histories/installment
```

Same-site CORS from the merchant dashboard origin.

## Query parameters

| Name | Type | Required | Example | Notes |
| --- | --- | --- | --- | --- |
| `page` | integer | yes | `1` | 1-based page index |
| `count` | integer | yes | `25` | Page size |
| `start_date` | `YYYY-MM-DD` | yes | `2026-09-08` | Inclusive range start |
| `end_date` | `YYYY-MM-DD` | yes | `2026-09-15` | Inclusive range end |
| `outlet_ids` | integer / CSV | yes | `645203` | Outlet filter. Sample uses a single id |
| `customer_id` | integer | no | `5442932` | Same id as [`customers.md`](customers.md) path / `data.customer.id`. Present on the customer-page capture |

`settle_by` / `invoice_number` were **omitted** (not sent as empty strings) in this capture.

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
curl --url 'https://order.qasir.id/api/v5/order/histories/installment?page=1&start_date=2026-09-08&end_date=2026-09-15&count=25&customer_id=5442932&outlet_ids=645203' \
  -H 'accept: */*' \
  -H 'accept-language: en-US,en;q=0.9,id;q=0.8' \
  -H 'authorization: Bearer <TOKEN>' \
  -H 'origin: https://bengkel-manuju-jaya-621095.qasir.id' \
  -H 'referer: https://bengkel-manuju-jaya-621095.qasir.id/' \
  -H 'x-csrf-token: <CSRF_TOKEN>'
```

## Response

Empty capture envelope:

```json
{
  "code": 200,
  "message": "Berhasil",
  "data": { "sales": [] },
  "trace_id": "39a7ee479fee5949389e7959edb76a4b"
}
```

No `pagination`. No `data.agg`.

Same customer + date range on [`order-histories-web.md`](order-histories-web.md) returned one cash sale (`sales_id` `1075641138`, `amount` `50000`). Installment list stayed empty — web sales are not installment rows.

### `data.sales`

| Field | Type | Sample | Notes |
| --- | --- | --- | --- |
| `sales` | array | `[]` | Empty in this capture. Do not assume day-grouped `{ date, daily_amount, items }` from the web list until a non-empty installment payload is captured |

## Implementation notes

- Empty is `code: 200` + `data.sales: []`, not `4xx`.
- Do not reuse web-list `agg` / `pagination` parsing on this endpoint until a populated response confirms they exist. Guard both.
- Filter by `customer_id` on the API; do not client-filter a full outlet installment dump.
- Auth is a dashboard Bearer session, not a public API key. Expect expiry; refresh from a logged-in Qasir session.
