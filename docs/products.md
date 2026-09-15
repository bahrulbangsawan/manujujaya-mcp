# Qasir Products

Paginated merchant product catalog (name, variants, prices, images). Not per-outlet stock.

Captured from the Qasir web dashboard (`bengkel-manuju-jaya-621095.qasir.id` → `pos.qasir.id`).

`variants[].id` is the `{inventory_id}` in [`inventories-stock-histories.md`](inventories-stock-histories.md). Product `id` is the dashboard edit path `/product/form/{id}`.

The `/products` HTML table is **server-rendered**. It is not this JSON call. See [Related endpoints](#related-endpoints).

## Endpoint

```
GET https://pos.qasir.id/api/v5/products
```

Host is `pos.qasir.id`, not `order.qasir.id`. Same-site CORS from the merchant dashboard origin.

## Query parameters

| Name | Type | Required | Example | Notes |
| --- | --- | --- | --- | --- |
| `page` | integer | yes | `1` | 1-based page index |
| `count` | integer | yes | `25` | Page size (`pagination.page_size`). Honored (unlike `GET /api/v5/inventories?count=10`) |
| `name` | string | no | `filter` | Echoed in `pagination.next`. **Did not filter** in this capture: `total_result` stayed `8056` with or without it. First page is still id-order (`20562593`…) |
| `outlet_ids` | integer / CSV | no | `645203` | **Do not send.** `GET /api/v5/products?outlet_ids=645203` returned HTTP 500 `INTERNAL_SERVER_ERROR` |

## Headers

| Header | Required | Notes |
| --- | --- | --- |
| `authorization` | yes | `Bearer <token>` (same as order APIs). Stock-histories uses the raw token without `Bearer ` |
| `x-csrf-token` | yes | Dashboard CSRF token |
| `origin` | yes (browser) | Merchant host, e.g. `https://<slug>.qasir.id` |
| `referer` | no | Dashboard origin |
| `accept` | no | `*/*` |
| `accept-language` | no | Browser locale |

Do not commit live tokens. Rotate any token that appeared in a captured curl.

## Example request

```bash
curl --url 'https://pos.qasir.id/api/v5/products?page=1&count=25' \
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
  "data": { "products": [] },
  "pagination": {
    "current_page": 1,
    "page_size": 25,
    "total_page": 323,
    "total_result": 8056,
    "next": "/api/v5/products?count=25&page=2"
  },
  "trace_id": "…"
}
```

`pagination.next` is a path only (no host). Prefix `https://pos.qasir.id`. HTML dashboard header on the same merchant: `Total Produk: 8023` (not equal to `8056`).

### `data.products[]`

Merchant-global rows. Sample: every row `is_global: true`, `outlet_id: null`.

| Field | Type | Sample | Notes |
| --- | --- | --- | --- |
| `id` | string | `"20562593"` | **String**. Dashboard `/product/form/20562593` |
| `merchant_id` | string | `"621095"` | Dashboard slug id (`…-621095.qasir.id`) |
| `is_global` | boolean | `true` | |
| `outlet_id` | integer \| `null` | `null` | Null on this capture |
| `name` | string | `FILTER UDARA M/L300E4 1500-A286(A07)` | Stock-histories `product_name` may append a trailing `-` |
| `created_at` | ISO-8601 UTC | `2022-01-20T14:24:16Z` | Trailing `Z` |
| `created_by` | string | `"2504993"` | User id as string |
| `updated_at` | ISO-8601 UTC | `2025-06-27T10:16:29Z` | |
| `updated_by` | string | `"2504993"` | |
| `deleted_at` | string | `""` | Empty string, not `null` |
| `deleted_by` | string | `"0"` | `"0"` = not deleted |
| `has_tax` | boolean | `false` | `tax_ids` can still be non-empty |
| `brand_id` | string | `"2621659"` | |
| `category_ids` | string[] | `["2038362"]` | HTML category label for `2038362`: `FILTER UDARA A/F` |
| `modifier_ids` | unknown \| `null` | `null` | |
| `tax_ids` | string[] | `["10358"]` | Present even when `has_tax` is false |
| `total_stock` | integer | `0` | **Not outlet on-hand.** All `0` on this unscoped list. Use stock-histories / inventories for real qty |
| `is_favorite` | boolean | `false` | HTML checkbox `product-favorite-checkbox-{id}` |
| `images` | object | see below | Product photo. Variant images are often the placeholder |
| `variants` | array | 1–2 in this page | |

Ids in this payload are strings. Coerce before joining to HTML / ajax integer ids.

### `data.products[].images`

| Field | Type | Sample |
| --- | --- | --- |
| `file_name` | string | `uCGN8Qhxud2q-temp_image_1702134985404.jpg` |
| `large` | URL | `https://etalastic.s3-ap-southeast-1.amazonaws.com/production/newproduct/large/…` |
| `medium` | URL | `…/newproduct/medium/…` |
| `small` | URL | `…/newproduct/original/…` — path is **`original`**, not `small` |

### `data.products[].variants[]`

| Field | Type | Sample | Notes |
| --- | --- | --- | --- |
| `id` | string | `"25950360"` | `{inventory_id}` for stock-histories |
| `name` | string | `""` or `MB-120476 ORI` | Empty on single-variant products |
| `barcode` | string | `""` | Empty in this capture |
| `sku` | string | `1500A286 Felicia Mobil ` | Trailing space |
| `price_base` | integer | `50000` | Cost. IDR integer |
| `price_sell` | integer | `180000` | Matches HTML `checkPriceSale(180000)` |
| `type` | integer | `0` | |
| `is_microsite` | boolean | `false` | |
| `ingredients` | unknown \| `null` | `null` | |
| `images` | object | placeholder | See below |
| `unit_label` | object | empty ids | See below |
| `stock` | object | zeros / false | See below |

Multi-variant sample: product `20562617` (`FILTER UDARA M/PS135(RA08)`) has two variants (`25950385` `MB-120476 ORI`, `26305158` `A-1031 SAKURA`). HTML shows `2 Harga`.

#### `variants[].images`

Empty `file_name` → Qasir placeholder:

`https://etalastic.s3-ap-southeast-1.amazonaws.com/_locationseeder/no-image.png`

Use **product** `images`, not variant images, unless `file_name` is set.

#### `variants[].unit_label`

| Field | Type | Sample |
| --- | --- | --- |
| `id` | string | `""` |
| `name` | string | `""` |
| `is_default` | boolean | `false` |

#### `variants[].stock`

| Field | Type | Sample | Notes |
| --- | --- | --- | --- |
| `alert_stock` | boolean | `false` | |
| `track_stock` | boolean | `false` | Stock-histories for the same `25950360` returned `track_stock: true`. This list object is not outlet-scoped |
| `stock_min` | integer | `0` | |
| `stock_opname` | integer | `0` | Not the running balance from stock-histories `opname` |
| `price_base` | integer | `0` | Duplicate of variant `price_base`; `0` here |

Do not display `variants[].stock` as on-hand. Call [`inventories-stock-histories.md`](inventories-stock-histories.md) (or a future outlet inventories list).

## Pagination

Sample: `page=1`, `count=25` → `total_page=323`, `total_result=8056`.

`count=5` → `total_page=1612`, same `total_result`.

Walk pages with `page=N` or follow `pagination.next` on `https://pos.qasir.id`.

Default order is ascending product `id`. First catalog ids are air-filter SKUs, so a `name=filter` URL still *looks* filtered on page 1.

## Sample item

```json
{
  "id": "20562593",
  "merchant_id": "621095",
  "is_global": true,
  "outlet_id": null,
  "name": "FILTER UDARA M/L300E4 1500-A286(A07)",
  "has_tax": false,
  "brand_id": "2621659",
  "category_ids": ["2038362"],
  "total_stock": 0,
  "is_favorite": false,
  "variants": [
    {
      "id": "25950360",
      "name": "",
      "sku": "1500A286 Felicia Mobil ",
      "price_base": 50000,
      "price_sell": 180000
    }
  ]
}
```

## Related endpoints

Not substitutes for this list. Different hosts, auth, and shapes.

### Dashboard HTML (the `/products` page)

```
GET https://<slug>.qasir.id/products?product_name=filter&stock_max=&category=&brand=&search=
```

Cookie session (`qasir_sess`, `XSRF-TOKEN`), not Bearer. SSR table, **30** rows/page. Columns: Foto, Nama Produk, Kategori, Harga Jual, Stok, Merek, Produk Favorit, Grosir.

Edit link: `/product/form/{product_id}`. Header `Total Produk: 8023` / `Total Stok: 382762.4` on this capture.

### Typeahead (does filter by name)

```
GET https://<slug>.qasir.id/ajax/products/get?name=filter
```

Same-origin, `X-Requested-With: XMLHttpRequest`, CSRF cookie. Laravel paginator (`total`, `per_page`, `data[]`). Sample: `name=filter` → **237** hits, `per_page` 50. Integer `id`. Select2 in `app.min.js`, not the products table.

### Inventories list (not documented here)

`GET https://pos.qasir.id/api/v5/inventories?outlet_ids=645203&page=1&count=10` returned 200 with `variant_id` rows, but **`count` was ignored** (~1.5MB). Do not use as a paginated catalog.

## Implementation notes

- Prefer this v5 list for JSON. Scrape `/products` HTML only if you need the dashboard’s 30-row table / favorite checkbox.
- Search: do not rely on `name=` on v5. Use `/ajax/products/get?name=` until a working v5 search param is captured.
- `variants[].id` (string) → stock-histories path. `products[].id` (string) → `/product/form/{id}`.
- Amounts are integer IDR (`180000` → `Rp 180.000`).
- Trim `sku`.
- Auth is a dashboard Bearer session, not a public API key. Expect expiry; refresh from a logged-in Qasir session.
