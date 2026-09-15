# Qasir Customer (Detail)

Single customer profile by id.

Captured from the Qasir web dashboard (`bengkel-manuju-jaya-621095.qasir.id` → `pos.qasir.id`).

Customer-page companion calls:

- [`order-histories-web.md`](order-histories-web.md) with `customer_id`
- [`order-histories-installment.md`](order-histories-installment.md) with `customer_id`

`id` is the same integer as legacy receipt `data.sales.customer.id`.

## Endpoint

```
GET https://pos.qasir.id/api/v5/customers/{customer_id}
```

Host is `pos.qasir.id`, not `order.qasir.id`. Same-site CORS from the merchant dashboard origin.

## Path parameters

| Name | Type | Required | Example | Notes |
| --- | --- | --- | --- | --- |
| `customer_id` | integer | yes | `5442932` | Customer id. Response `data.customer.id` is the same integer |

No query parameters in this capture.

## Headers

| Header | Required | Notes |
| --- | --- | --- |
| `authorization` | yes | `Bearer <token>`. Same Bearer prefix as order APIs. Unlike [`inventories-stock-histories.md`](inventories-stock-histories.md), which uses the raw token with no `Bearer ` |
| `x-csrf-token` | yes | Dashboard CSRF token |
| `origin` | yes (browser) | Merchant host, e.g. `https://<slug>.qasir.id` |
| `referer` | no | Dashboard origin |
| `accept` | no | `*/*` |
| `accept-language` | no | Browser locale |

Do not commit live tokens. Rotate any token that appeared in a captured curl.

## Example request

```bash
curl --url 'https://pos.qasir.id/api/v5/customers/5442932' \
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
  "data": { "customer": {} },
  "trace_id": "04f72746fafe5e5f4875b418628cdd41"
}
```

No `pagination`. Payload is one customer.

### `data.customer`

| Field | Type | Sample | Notes |
| --- | --- | --- | --- |
| `id` | integer | `5442932` | Same as path `customer_id` |
| `fullname` | string | `Beni Nuboba/Apv` | Display name. Slash / nickname suffix is merchant-entered, not a structured field |
| `mobile` | string | `85431846` | Phone as stored. No `62` / `+` prefix in this capture. Legacy receipt `customer.mobile` can be `62…` |
| `gender` | string | `M` | Observed: `M`. Other values not captured |
| `date_of_birth` | `YYYY-MM-DD` | `0001-01-01` | Go zero date. Treat as unset — not a real birthday |
| `email` | string | `""` | Empty in this capture |
| `address` | string | `""` | |
| `id_number` | string | `""` | KTP / national id. Empty here |
| `note` | string | `""` | |
| `location_id` | integer | `0` | `0` = unset |
| `image_name` | string | `""` | Filename when an avatar exists. Empty = none |
| `image_base64` | string | `""` | Inline image. Empty in this capture |

## Sample customer

```json
{
  "id": 5442932,
  "fullname": "Beni Nuboba/Apv",
  "mobile": "85431846",
  "gender": "M",
  "date_of_birth": "0001-01-01",
  "email": "",
  "address": "",
  "id_number": "",
  "note": "",
  "location_id": 0,
  "image_name": "",
  "image_base64": ""
}
```

## Implementation notes

- `fullname` here vs `name` on [`order-histories-legacy.md`](order-histories-legacy.md) `data.sales.customer`. Same person, different key.
- `date_of_birth === "0001-01-01"` (and likely `0001-01-01T…`) means missing. Do not show as age.
- `location_id === 0` and empty strings are unset, not errors.
- `mobile` is a free-form string. Do not assume country code or digit length.
- Auth is a dashboard Bearer session, not a public API key. Expect expiry; refresh from a logged-in Qasir session.
