# Qasir Order History Detail (Legacy)

Single-sale receipt: cart lines, payments, customer, settler, loyalty, refunds.

Captured from the Qasir web dashboard (`bengkel-manuju-jaya-621095.qasir.id` → `order.qasir.id`).

`sales_id` comes from [`order-histories-web.md`](order-histories-web.md) `data.sales[].items[].sales_id`.

## Endpoint

```
GET https://order.qasir.id/api/v5/order/histories/{sales_id}/legacy
```

Same-site CORS from the merchant dashboard origin.

## Path parameters

| Name | Type | Required | Example | Notes |
| --- | --- | --- | --- | --- |
| `sales_id` | integer | yes | `1077271206` | List-row `sales_id` |

No query parameters in this capture.

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
curl --url 'https://order.qasir.id/api/v5/order/histories/1077271206/legacy' \
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
  "data": { "sales": {} },
  "trace_id": "0486b817eebabcedf05a7f2234040830"
}
```

No `pagination`. Payload is one sale.

### `data.sales` — identity & totals

| Field | Type | Sample | Notes |
| --- | --- | --- | --- |
| `id` | integer | `1077271206` | Same as path `sales_id` / list `sales_id` |
| `mobile_sales_id` | UUID string | `00000000-0000-4000-8000-000000000000` | POS / device sale id |
| `ticket_name` | string | `""` | Empty in this capture |
| `description` | string | `""` | |
| `status` | integer | `2` | Matches list `status`. See list doc |
| `status_refund` | integer | `1` | `refunds` empty, `refund_amount` `0` — not a completed refund |
| `status_text` | string | `""` | |
| `invoice_number` | string | `65715HNN` | Matches list |
| `total_bill` | string | `"220000.00"` | **String** with 2 decimals. List `amount` is integer `220000` |
| `total_discounts` | integer | `0` | |
| `total_paid` | integer | `250000` | Tendered. Can exceed bill |
| `money_change` | integer | `30000` | `total_paid - bill` in this cash sale |
| `refund_reason` | integer | `0` | |
| `refund_other` | string | `"2026-09-14 06:35:27"` | Same value as `refunded_at` here; not a refund note |
| `refund_amount` | integer | `0` | |
| `settled_at` | `YYYY-MM-DD HH:MM:SS` | `"2026-09-14 15:35:25"` | Local. List `date_time` is `15:35` |
| `recap_id` | integer | `8700565` | Daily recap / closing id |
| `refunded_at` | `YYYY-MM-DD HH:MM:SS` | `"2026-09-14 06:35:27"` | Present even with no refund. 9h behind `settled_at` in this capture — do not treat as local settle time |
| `total_daily` | integer | `0` | |
| `total_daily_installment` | integer | `0` | |
| `created_at` | string | `""` | Empty in this capture |
| `updated_at` | string | `""` | |
| `deleted_at` | string | `""` | |
| `discount_object` | object \| `null` | `null` | Sale-level discount |
| `user_refund` | object \| `null` | `null` | |
| `merchant_id` | integer | `621095` | Dashboard slug id (`…-621095.qasir.id`) |
| `outlet_id` | integer | `645203` | List `outlet_ids` |
| `is_installment_completed` | boolean | `false` | |
| `tax_formula_type` | string | `"include_discount_transaction"` | |
| `total_tax` | string | `"0.00"` | **String** |
| `refunds` | array | `[]` | |
| `checkout_url` | string | `""` | |
| `checkout_content` | string | `""` | |
| `down_payment` | integer | `0` | |
| `link_payment` | string | `""` | |
| `link_expired_date` | string | `""` | |
| `partner_payment_id` | string | `""` | |
| `payment_expired_at` | string | `""` | |
| `total_debt` | integer | `0` | |
| `created_by_name` | string | `"Example Cashier "` | Trailing space. Same person as `user_settled` here |
| `refunded_by_name` | string | `""` | |
| `deleted_by_name` | string | `""` | |
| `tax_aggregate` | array | `[]` | |
| `sub_total` | integer | `220000` | |
| `total_price` | integer | `220000` | |
| `total_price_after_refund` | integer | `220000` | |
| `discount` | integer | `0` | |
| `status_order` | unknown \| `null` | `null` | |

Amounts mix types: `total_bill` / `total_tax` are decimal strings; most other money fields are integers.

### `data.sales.customer`

| Field | Type | Sample |
| --- | --- | --- |
| `id` | integer | `2198342` |
| `name` | string | `Example Customer (Nickname)` |
| `mobile` | string | `6281200000000` |
| `email` | string | `""` |
| `image` | string | `""` |

Absent / empty customer not observed in this capture.

### `data.sales.carts[]`

Line items. One row in the sample.

| Field | Type | Sample | Notes |
| --- | --- | --- | --- |
| `id` | integer | `2857157830` | Cart line id, not `sales_id` |
| `caption` | string | `""` | |
| `price_base` | integer | `0` | |
| `price_base_unit` | integer | `0` | |
| `price_sell` | integer | `220000` | Line sell price |
| `price_sell_unit` | integer | `220000` | Unit sell price |
| `price_sell_bargain` | integer | `0` | |
| `quantity` | integer | `1` | |
| `refund_quantity` | integer | `0` | |
| `wholesale` | object | `{ "price": 0, "quantity": 0 }` | |
| `is_additional` | integer | `0` | Flag as 0/1 |
| `total_discount` | integer | `0` | |
| `total_modifier` | integer | `0` | |
| `created_at` | string | `""` | |
| `taxes` | array | `[]` | |
| `sales_types` | unknown \| `null` | `null` | |
| `total_tax` | integer | `0` | Integer here; sale-level `total_tax` is a string |
| `variant_relations` | array | `[]` | |
| `final_quantity` | integer | `1` | |
| `total_modifier_amount` | integer | `0` | |
| `sub_total` | integer | `220000` | |
| `total` | integer | `220000` | |
| `discount_after_refund` | integer | `0` | |

#### `carts[].variant`

| Field | Type | Sample |
| --- | --- | --- |
| `id` | integer | `47761464` |
| `variant_name` | string | `""` |
| `variant_sku` | string | `""` |
| `price_base` | integer | `0` |
| `price_sell` | integer | `0` |
| `modifiers` | array | `[]` |

`variant.price_sell` is `0` while `carts[].price_sell` is `220000`. Use the cart line for charged price.

#### `carts[].variant.product`

| Field | Type | Sample |
| --- | --- | --- |
| `id` | integer | `36181347` |
| `name` | string | `BAK REM T/INV 04>15 7K EFI 7/8" TWR-S05(D03)` |
| `category_id` | integer | `2038383` |

#### `carts[].discount_object`

Present as a zeroed object on the line (sale-level `discount_object` was `null`).

| Field | Type | Sample |
| --- | --- | --- |
| `id` | integer | `0` |
| `caption` | string | `""` |
| `amount` | integer | `0` |
| `type` | integer | `0` |
| `created_at` | string | `""` |
| `title` | string | `""` |
| `discount_price` | integer | `0` |

### `data.sales.sales_type`

| Field | Type | Sample |
| --- | --- | --- |
| `id` | integer | `0` |
| `name` | string | `""` |
| `amount` | integer | `0` |
| `amount_type` | string | `""` |
| `amount_sales` | integer | `0` |

Matches empty list `sales_type_name`.

### `data.sales.payments[]`

| Field | Type | Sample | Notes |
| --- | --- | --- | --- |
| `id` | integer | `982229770` | |
| `payment_mode` | string | `CASH` | Matches list. Observed on list: `CASH`, `QRIS` |
| `payment_name` | string | `TUNAI` | Localized label |
| `payment_code` | string | `""` | |
| `mobile_payment_id` | string | `""` | |
| `amount` | integer | `250000` | Tendered, not bill. Equals `total_paid` here |
| `paid_date` | `YYYY-MM-DD HH:MM:SS` | `"2026-09-14 15:35:25"` | Same as `settled_at` |
| `is_onp` | boolean | `false` | Online payment flag |
| `reference_number` | string | `""` | |

Split tender not observed. `amount` on the payment is cash received; change is `sales.money_change`.

### `data.sales.user_settled`

| Field | Type | Sample | Notes |
| --- | --- | --- | --- |
| `id` | integer | `3306084` | |
| `name` | string | `Example Cashier ` | Trailing space. List `settle_by` |
| `title` | string | `""` | |

### `data.sales.installment`

| Field | Type | Sample | Notes |
| --- | --- | --- | --- |
| `period` | string | `"0"` | **String** |
| `unit` | string | `""` | |
| `date` | string | `""` | |
| `total_installment` | integer | `220000` | Equals bill here |
| `remaining_debt` | integer | `-30000` | Negative = overpay / change (`-money_change`). Not an outstanding debt |

### `data.sales.users[]`

Placeholder row in this capture: `{ "id": 0, "name": "", "title": "" }`. Do not treat as a real user.

### `data.sales.loyalty_discount`

| Field | Type | Sample | Notes |
| --- | --- | --- | --- |
| `point_redeem_origin` | integer | `0` | |
| `point_redeem` | integer | `0` | |
| `is_redeem` | boolean | `false` | |
| `point_collection` | integer | `2000` | Points earned on this sale |
| `total_point` | integer | `151000` | Customer balance after this sale — confirm before displaying as “earned” |

## Sample cart + payment

```json
{
  "id": 1077271206,
  "status": 2,
  "invoice_number": "65715HNN",
  "total_bill": "220000.00",
  "total_paid": 250000,
  "money_change": 30000,
  "settled_at": "2026-09-14 15:35:25",
  "outlet_id": 645203,
  "merchant_id": 621095,
  "customer": {
    "id": 2198342,
    "name": "Example Customer (Nickname)",
    "mobile": "6281200000000"
  },
  "carts": [
    {
      "id": 2857157830,
      "price_sell": 220000,
      "quantity": 1,
      "total": 220000,
      "variant": {
        "id": 47761464,
        "product": {
          "id": 36181347,
          "name": "BAK REM T/INV 04>15 7K EFI 7/8\" TWR-S05(D03)",
          "category_id": 2038383
        }
      }
    }
  ],
  "payments": [
    {
      "payment_mode": "CASH",
      "payment_name": "TUNAI",
      "amount": 250000,
      "paid_date": "2026-09-14 15:35:25"
    }
  ],
  "user_settled": { "id": 3306084, "name": "Example Cashier " }
}
```

## Implementation notes

- List `amount` = bill (`220000`). Detail `payments[].amount` / `total_paid` = tendered (`250000`). Display change from `money_change`, not from list amount.
- Parse `total_bill` and `total_tax` as decimal strings; do not assume integer like the list endpoint.
- Trim `user_settled.name` and `created_by_name` before grouping.
- Product name lives at `carts[].variant.product.name`. Variant name/SKU can be empty.
- `refunded_at` / `refund_other` can be set with `refunds: []` and `refund_amount: 0`. Gate refund UI on `refunds.length` / `refund_amount`, not on `refunded_at`.
- `installment.remaining_debt` can be negative on a fully paid cash sale with change.
- Auth is a dashboard Bearer session, not a public API key. Expect expiry; refresh from a logged-in Qasir session.
