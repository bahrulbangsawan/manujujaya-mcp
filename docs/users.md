# Qasir Users

Paginated staff list for the merchant, with access-type catalog.

Captured from the Qasir web dashboard (`bengkel-manuju-jaya-621095.qasir.id` → `pos.qasir.id`).

`users[].id` / trimmed `users[].name` join [`order-histories-legacy.md`](order-histories-legacy.md) `user_settled` and [`order-histories-web.md`](order-histories-web.md) `settle_by`.

## Endpoint

```
GET https://pos.qasir.id/api/v5/users
```

Host is `pos.qasir.id`, not `order.qasir.id`. Same-site CORS from the merchant dashboard origin.

## Query parameters

| Name | Type | Required | Example | Notes |
| --- | --- | --- | --- | --- |
| `page` | integer | yes | `1` | 1-based page index |
| `count` | integer | yes | `30` | Page size (`pagination.page_size`) |
| `name` | string | no | `` | Name search. Empty = all. Sent as `name=` in this capture |
| `outlet_ids` | integer / CSV | no | `` | Empty string, not omitted. Unlike [`products.md`](products.md), empty `outlet_ids` did **not** 500 |
| `outlet_ids_filter` | integer / CSV | no | `` | Second outlet filter. Empty in this capture. Distinct from `outlet_ids`; neither was exercised with a value |
| `access` | integer | no | `` | Filter by `data.access[].type`. Empty = all types |

Empty filters are sent as empty query values, not dropped (unlike customer-page order-history curls).

## Headers

| Header | Required | Notes |
| --- | --- | --- |
| `authorization` | yes | `Bearer <token>`. Same Bearer prefix as order APIs and [`customers.md`](customers.md). Unlike [`inventories-stock-histories.md`](inventories-stock-histories.md), which uses the raw token with no `Bearer ` |
| `x-csrf-token` | yes | Dashboard CSRF token |
| `origin` | yes (browser) | Merchant host, e.g. `https://<slug>.qasir.id` |
| `referer` | no | Dashboard origin |
| `accept` | no | `*/*` |
| `accept-language` | no | Browser locale |

Do not commit live tokens. Rotate any token that appeared in a captured curl.

## Example request

```bash
curl --url 'https://pos.qasir.id/api/v5/users?page=1&count=30&name=&outlet_ids_filter=&outlet_ids=&access=' \
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
    "access": [],
    "is_limit": false,
    "users": []
  },
  "pagination": {
    "current_page": 1,
    "page_size": 30,
    "total_page": 1,
    "total_result": 6
  },
  "trace_id": "d76949f7b364857b98f6e58aa13c73c3"
}
```

`pagination.next` **omitted** (`total_page: 1`). Same last-page behavior as customer-filtered [`order-histories-web.md`](order-histories-web.md).

### `data.access[]`

Role catalog for the `access` query param and `users[].access`. Not the user list.

| Field | Type | Sample |
| --- | --- | --- |
| `type` | integer | `3` |
| `name` | string | `Operator` |

Observed in this capture:

| `type` | `name` | Users on this page |
| --- | --- | --- |
| `3` | `Operator` | `Example Cashier`, `Example Operator` |
| `4` | `Non Operator` | `EXAMPLE MECHANIC A`, `EXAMPLE MECHANIC B`, `EXAMPLE MECHANIC C`, `Example Mechanic D` |

Owner / other types not in `data.access` here. Do not assume this is the full Qasir role enum.

### `data.is_limit`

| Field | Type | Sample | Notes |
| --- | --- | --- | --- |
| `is_limit` | boolean | `false` | Present at `data` root. Meaning not observed (plan seat cap?). All six users `is_locked: false` |

### `data.users[]`

| Field | Type | Sample | Notes |
| --- | --- | --- | --- |
| `id` | integer | `3306084` | Same integer as legacy `user_settled.id`. Stock-histories `created_by.id` is a **string** |
| `name` | string | `Example Cashier ` | Trailing spaces. Trim before matching `settle_by` |
| `email` | string | `staff@example.com` | Always set in this page |
| `mobile` | string | `6281200000000` | Free-form. Observed `62…` and `0813…` on the same page |
| `title` | string | `Asisten Kasir` | Job label, not `access` name. Can be `""`. Case / spelling vary (`MEKANIK`, `Mekanik`, `MEKANIK KEPALA`) |
| `access` | integer | `3` | `data.access[].type` |
| `image_file` | URL | see below | Always a URL. Default staff art when `is_default_image` |
| `is_default_image` | boolean | `false` | `true` → placeholder, not an upload |
| `is_locked` | boolean | `false` | Locked users not observed |
| `outlets` | array | one row | Assigned outlets |

### `data.users[].outlets[]`

| Field | Type | Sample |
| --- | --- | --- |
| `id` | integer | `645203` |
| `name` | string | `Toko Manuju Jaya` |

Every user on this page has exactly that one outlet. Multi-outlet assignment not observed.

### `image_file`

| `is_default_image` | Host / path |
| --- | --- |
| `true` | `https://etalastic.s3.ap-southeast-1.amazonaws.com/assets/images/img-staff.png` |
| `false` | `https://etalastic.s3.ap-southeast-1.amazonaws.com/production/newuser/original/…` |

S3 host uses `s3.` (dot). Product images in [`products.md`](products.md) use `s3-` (hyphen). Do not assume one host.

## Pagination

Sample: `page=1`, `count=30` → `total_page=1`, `total_result=6`. No `next`.

Walk further pages with `page=N` if `total_page > 1`. Prefix any `pagination.next` with `https://pos.qasir.id`.

`data.access` / `data.is_limit` are merchant-level; repeating them on every page is expected.

## Observed users (this page)

Trimmed names. Full `name` still has trailing spaces.

| `id` | `name` | `title` | `access` | Notes |
| --- | --- | --- | --- | --- |
| `2783902` | `EXAMPLE MECHANIC A` | `MEKANIK` | `4` | |
| `2783908` | `EXAMPLE MECHANIC B` | `MEKANIK` | `4` | |
| `2783909` | `EXAMPLE MECHANIC C` | `MEKANIK KEPALA` | `4` | |
| `2901567` | `Example Mechanic D` | `Mekanik` | `4` | `is_default_image: true` |
| `3306084` | `Example Cashier` | `Asisten Kasir` | `3` | Legacy `user_settled` for `65715HNN` |
| `3393629` | `Example Operator` | `""` | `3` | Web `settle_by` on `65418CRQ` |

Not in this list, but seen on sales / stock history:

| Source | id / name |
| --- | --- |
| Stock-histories `created_by` | `"2745714"` / `Example Staff` |
| Products `created_by` | `"2504993"` |

Do not treat this 6-row page as the complete settler set.

## Sample item

```json
{
  "id": 3306084,
  "name": "Example Cashier ",
  "email": "staff@example.com",
  "mobile": "6281200000000",
  "title": "Asisten Kasir",
  "access": 3,
  "image_file": "https://etalastic.s3.ap-southeast-1.amazonaws.com/production/newuser/original/example_staff_image.jpg",
  "is_default_image": false,
  "is_locked": false,
  "outlets": [{ "id": 645203, "name": "Toko Manuju Jaya" }]
}
```

## Implementation notes

- Trim `name` before grouping or matching `settle_by` / `user_settled.name`.
- Map `access` through `data.access[]`; do not hard-code `3` / `4` as the full role list.
- `title` is free text. Empty ≠ missing user.
- `mobile` is a free-form string. Do not assume country code.
- Display avatar from `image_file` even when `is_default_image` is true (placeholder PNG).
- Auth is a dashboard Bearer session, not a public API key. Expect expiry; refresh from a logged-in Qasir session.
