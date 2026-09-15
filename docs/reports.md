# Qasir Reports

Read-only sales / stock / microsite report APIs used by `/report/*`, `/dashboard`, `/stock/inventory`, and `/microsite/*`.

Captured by crawling the dashboard (`bengkel-manuju-jaya-621095.qasir.id` → `pos.qasir.id`). Response bodies were not snapshotted in this pass — query strings and status codes were. Envelope is the usual `{ code, message, data, pagination?, trace_id }` used elsewhere.

Page map: [`routes.md`](routes.md).

## Endpoint prefix

```
GET https://pos.qasir.id/api/v5/reports/…
```

Attendance is under `/api/v5/attendance/reports`, not `/reports/`.

## Headers

| Header | Required | Notes |
| --- | --- | --- |
| `authorization` | yes | `Bearer <token>` |
| `x-csrf-token` | yes | Dashboard CSRF |
| `origin` | yes (browser) | `https://<slug>.qasir.id` |
| `accept` | no | `*/*` |

Do not commit live tokens.

## Shared query keys

Most sales reports take:

| Name | Type | Example | Notes |
| --- | --- | --- | --- |
| `start_date` | `YYYY-MM-DD` | `2026-09-08` | Inclusive. Dashboard default = today−7 |
| `end_date` | `YYYY-MM-DD` | `2026-09-15` | Inclusive |
| `outlet_ids` | integer / CSV | `645203` | Current `session` outlet |
| `page` | integer | `1` | When paginated |
| `count` | integer | `3`–`30` | When paginated |
| `sort` | string | `-quantity` | Leading `-` = desc. Not on every path |
| `search` | string | `` | Product / modifier name |
| `ids` | string | `` | Category / brand id filter (empty on load) |

## Paths

All `GET`, all **200** unless noted. Host `https://pos.qasir.id`.

### Summaries

| Path | Query keys | Page |
| --- | --- | --- |
| `/api/v5/reports/summaries/sales` | `start_date`, `end_date`, `outlet_ids` | `/report/sales/summary` |
| `/api/v5/reports/summaries/transaction` | `start_date`, `end_date`, `outlet_ids` | `/dashboard`, summary, category, item, brand |
| `/api/v5/reports/summaries/sales-insight` | `start_date`, `end_date`, `outlet_ids` | `/dashboard` |
| `/api/v5/reports/summaries/sales-types` | `start_date`, `end_date`, `outlet_ids`, `sort` | `/dashboard` |
| `/api/v5/reports/summaries/payment-methods` | `start_date`, `end_date`, `outlet_ids`, `sort`, `country_code`, `language_code` | `/dashboard` (`country_code=ID`, `language_code=id`) |
| `/api/v5/reports/summaries/installment` | `page`, `count`, `start_date`, `end_date`, `outlet_ids` | `/dashboard` |
| `/api/v5/reports/summaries/discounts` | `page`, `count`, `start_date`, `end_date`, `outlet_ids`, `sort` | `/report/sales/discount` |

### Breakdowns

| Path | Query keys | Page |
| --- | --- | --- |
| `/api/v5/reports/sales/trend` | `start_date`, `end_date`, `outlet_ids`, `trend_type`, `comparison_start_date`, `comparison_end_date` | `/report/sales/trend` |
| `/api/v5/reports/sales/payment-types` | `start_date`, `end_date`, `outlet_ids` | `/report/sales/paymentType` |
| `/api/v5/reports/order-types` | `page`, `count`, `start_date`, `end_date`, `outlet_ids`, `sort` | `/report/sales/orderType` |
| `/api/v5/reports/categories` | `page`, `count`, `start_date`, `end_date`, `outlet_ids`, `ids` | `/report/sales/category` |
| `/api/v5/reports/products` | `page`, `count`, `start_date`, `end_date`, `outlet_ids`, `search`, `sort` | `/report/sales/item` |
| `/api/v5/reports/brands` | `page`, `count`, `start_date`, `end_date`, `outlet_ids`, `ids` | `/report/sales/brand` |
| `/api/v5/reports/employees` | `page`, `count`, `start_date`, `end_date`, `outlet_ids`, `sort` | `/report/sales/staff` |
| `/api/v5/reports/discounts` | `page`, `count`, `start_date`, `end_date`, `outlet_ids`, `sort`, `discount_type` | `/report/sales/discount` |
| `/api/v5/reports/modifiers` | `page`, `count`, `start_date`, `end_date`, `outlet_ids`, `search`, `sort` | `/report/sales/modifier` |
| `/api/v5/reports/top-products` | `page`, `count`, `start_date`, `end_date`, `outlet_ids`, `sort` | `/dashboard` (`count=3`, `sort=-quantity`) |
| `/api/v5/reports/promo-insight` | — | `/dashboard`, `/add-on` |
| `/api/v5/reports/sales/total` | `outlet_ids`, `status` | `/dashboard` with `status=saved` → **500** |

### Stock / ingredients

| Path | Query keys | Page |
| --- | --- | --- |
| `/api/v5/reports/ingredients/summaries` | `page`, `count`, `start_date`, `end_date`, `outlet_ids`, `search` | `/stock/inventory` |

On-hand movement for one SKU is [`inventories-stock-histories.md`](inventories-stock-histories.md), not this list.

### Attendance

```
GET https://pos.qasir.id/api/v5/attendance/reports
```

Query: `page`, `start_date`, `end_date`, `outlet_ids`, `sort`. Page: `/report/attendance`.

### Microsite visits

| Path | Query keys | Page |
| --- | --- | --- |
| `/api/v5/reports/merchants/visits` | `date_from`, `date_to` | `/microsite/statistic`, `/microsite/linktoko` |
| `/api/v5/reports/merchants/visit_trending` | `date_from`, `date_to`, `unit` | same |

Date keys are `date_from` / `date_to`, **not** `start_date` / `end_date`.

## Example request

```bash
curl --url 'https://pos.qasir.id/api/v5/reports/summaries/sales?start_date=2026-09-08&end_date=2026-09-15&outlet_ids=645203' \
  -H 'accept: */*' \
  -H 'authorization: Bearer <TOKEN>' \
  -H 'origin: https://bengkel-manuju-jaya-621095.qasir.id' \
  -H 'referer: https://bengkel-manuju-jaya-621095.qasir.id/' \
  -H 'x-csrf-token: <CSRF_TOKEN>'
```

## Not observed on load

| Page | Note |
| --- | --- |
| `/report/sales/tax` | Chrome only. Tax report JSON not captured |
| `/report/customers` | Chrome only. Customer-report JSON not captured |

Transaction **list** is [`order-histories-web.md`](order-histories-web.md), not `/reports/*`.

## Implementation notes

- Reuse `start_date` / `end_date` / `outlet_ids` across sales reports. Microsite uses `date_from` / `date_to`.
- `sort=-quantity` is desc by qty. Do not assume other sort tokens until captured.
- `/api/v5/reports/sales/total?status=saved` 500’d in this crawl; treat as broken for parked-sale totals.
- Auth is a dashboard Bearer session, not a public API key. Expect expiry; refresh from a logged-in Qasir session.
