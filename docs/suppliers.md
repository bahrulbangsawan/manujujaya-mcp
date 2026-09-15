# Qasir Suppliers

Supplier directory. The dashboard table is **server-rendered HTML**. No working JSON list in this capture.

Captured from `https://bengkel-manuju-jaya-621095.qasir.id/suppliers`.

PO rows in [`purchases.md`](purchases.md) carry `supplier_id` / `supplier_name`. Those POS ids (`33006`, …) did **not** match HTML form ids on this page (`52887`, …). Do not join them until a mapping is captured.

## Endpoint (the page)

```
GET https://<slug>.qasir.id/suppliers
```

Same-origin. Cookie session (`qasir_sess`, `XSRF-TOKEN`), not `Authorization: Bearer`.

## Query parameters

| Name | Type | Required | Example | Notes |
| --- | --- | --- | --- | --- |
| `name` | string | no | `` | Form input `name="name"` (Nama Supplier) |
| `phone` | string | no | `` | `name="phone"` |
| `location` | string | no | `` | `name="location"` (Kota) |
| `page` | integer | no | `2` | 1-based. Links through `page=40` on this capture |

Empty filters still list everyone.

## Headers

| Header | Required | Notes |
| --- | --- | --- |
| `cookie` | yes | `qasir_sess`, `XSRF-TOKEN` |
| `x-csrf-token` | yes | Dashboard CSRF |
| `accept` | no | `text/html` |

Do not commit live cookies or tokens. Rotate any session that appeared in a captured curl.

## Example request

```bash
curl --url 'https://bengkel-manuju-jaya-621095.qasir.id/suppliers?name=&phone=&location=' \
  -H 'accept: text/html' \
  -H 'origin: https://bengkel-manuju-jaya-621095.qasir.id' \
  -b 'qasir_sess=<SESSION>; XSRF-TOKEN=<XSRF>' \
  -H 'x-csrf-token: <CSRF_TOKEN>'
```

## Response

`200` `text/html; charset=UTF-8`. Title `Supplier`. PHP/Laravel.

**15** rows per page. Pagination max link **40** (~585–600 suppliers if full). No `Total …` count in the header (unlike products / purchases).

### Table columns

| Column | Notes |
| --- | --- |
| Nama Supplier | Display name |
| No. Telepon | |
| Alamat | |
| Kota | e.g. `Kab. Tangerang`, `Kota Surabaya` |

Row actions: `/supplier/form/{id}` (edit), `/supplier/delete/{id}` (Laravel POST + `_method` / `_token`). Create: `/supplier/form`.

### Sample rows (page 1)

| `id` | name (from HTML) | city |
| --- | --- | --- |
| `52887` | MAXCOOL INDONESIA | Kota Depok |
| `49826` | GUDANG SPAREPART AUTOMOTIVE | Kab. Tangerang |
| `49698` | HOSE KENCANA INDONESIA | Kab. Tangerang |
| `49457` | Gudang Karet Mobil | Kab. Cirebon |
| `49455` | Grizi Rubber Part | Kab. Cirebon |
| `49454` | SUKSES AUTO GENUINE | Kota Jakarta Pusat |
| `49452` | Sinergi Meta Industri(Kawat Las) | Kota Tangerang |
| `49408` | ARTHA MOTOR SURABAYA | Kota Surabaya |

Ids also on page 1: `49121`, `48954`, `48950`, `48913`. Newest form-id first.

## JSON probes (failed)

Same Bearer token that works on products / purchases:

| Call | Result |
| --- | --- |
| `GET https://pos.qasir.id/api/v5/suppliers?page=1&count=10` | **400** `BAD_REQUEST` |
| same + `outlet_ids=645203` / `merchant_id=621095` / `name=` / `search=` / `sort=` | **400** |
| `GET https://pos.qasir.id/api/v5/supplier?page=1&count=10` | **404** `Data tidak ditemukan` |
| `GET https://<slug>.qasir.id/ajax/suppliers/get?name=` | **405** |
| `GET https://<slug>.qasir.id/ajax/supplier/get?name=` | **405** |
| `GET https://<slug>.qasir.id/ajax/suppliers` | **405** |

The v5 route exists (400, not 404) but rejected every query set in this capture. Required param unknown.

`app.min.js` has no suppliers list URL. `#pemasok` is a `<select>` on the purchase form (`changeSupplier`), not this table.

## Implementation notes

- Scrape `/suppliers` HTML for a directory until v5 400 is solved. Capture the Network tab on that page if a JSON call appears.
- Do not join HTML `/supplier/form/{id}` to purchase `supplier_id` without evidence.
- Auth is the dashboard cookie session, not a public API key. Expect expiry; refresh from a logged-in Qasir session.
