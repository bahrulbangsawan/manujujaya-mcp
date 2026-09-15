# Qasir Auth (Login)

Phone/email + 6-digit PIN sign-in for the web dashboard.

Captured from `https://www.qasir.id/sign-in?lang=id` (`auth-C41Isb5Y.js`, `window.__AUTH.routes`). Live POST observed; this account skipped merchant/outlet/OTP pickers and redirected straight to the store dashboard.

Envelope is **`{ status, message, next_step, data }`**, not the POS `{ code: 200, message: "Berhasil" }`.

Do not commit PIN, `tokenWeb`, or session cookies.

## Page

```
GET https://www.qasir.id/sign-in?lang=id
```

Tabs: `No. Handphone` (default) or `Email`. PIN field `maxlength=6`. Submit `Masuk`.

`window.__AUTH.routes` on this page:

| Key | URL |
| --- | --- |
| `deviceLanguage` | `https://www.qasir.id/api/auth/device-language` |
| `login` | `https://www.qasir.id/api/auth/login` |
| `outletSelect` | `https://www.qasir.id/api/auth/outlet-select` |
| `verification` | `https://www.qasir.id/sign-in/verification` |

## 1. Device language (fires first)

```
POST https://www.qasir.id/api/auth/device-language
```

Same-origin. Called immediately before login on submit.

### Headers

| Header | Required | Notes |
| --- | --- | --- |
| `content-type` | yes | `application/json` |
| `x-csrf-token` | yes | `<meta name="csrf-token">` |
| `x-requested-with` | yes (browser) | `XMLHttpRequest` |
| `origin` | yes | `https://www.qasir.id` |
| cookie | yes | `laravel-session`, `XSRF-TOKEN`, `qasir_device_id` |

### Body

| Field | Type | Sample | Notes |
| --- | --- | --- | --- |
| `language_code` | string | `"id"` | From `__AUTH.locale` |
| `device_id` | UUID | `13ce8cb0-96f6-40d1-af84-d39561b90cdd` | Cookie + `localStorage.qasir_device_id`. Created if missing; max-age 730 days |

### Live response

```json
{ "status": 1, "message": "", "status_code": 200 }
```

## 2. Login

```
POST https://www.qasir.id/api/auth/login
```

### Headers

Same as device-language.

### Body

| Field | Type | Sample | Notes |
| --- | --- | --- | --- |
| `username` | string | `"62812xxxxxxxx"` | Phone tab: `{dialing_code}{local}` with **no** `+`. Default code `62`. Email tab: the email |
| `password` | string | `"••••••"` | 6-digit PIN |
| `device_id` | UUID | same as above | |
| `device_type` | string | `"Chrome 150 · macOS"` | Parsed UA: `{Browser} {major} · {OS}` |
| `timezone` | string | `"Asia/Makassar"` | `Intl.DateTimeFormat().resolvedOptions().timeZone` |
| `merchant_id` | integer | omitted | Sent only when the user picks a store after `next_step: "select_merchant"` |

### Example request

```bash
curl --url 'https://www.qasir.id/api/auth/login' \
  -H 'content-type: application/json' \
  -H 'origin: https://www.qasir.id' \
  -H 'x-csrf-token: <CSRF_TOKEN>' \
  -H 'x-requested-with: XMLHttpRequest' \
  --data '{"username":"62XXXXXXXXXXX","password":"<PIN>","device_id":"<UUID>","device_type":"Chrome 150 · macOS","timezone":"Asia/Makassar"}'
```

Needs a live `www.qasir.id` CSRF cookie pair (`laravel-session` + `XSRF-TOKEN`). Load `/sign-in` first.

### Success (`status === 1`)

`next_step` from `auth-C41Isb5Y.js`. This capture took **`redirect`** (no picker UI).

| `next_step` | `data` | Client |
| --- | --- | --- |
| `redirect` | `{ "redirect_url": "https://<slug>.qasir.id/dashboard?tokenWeb=…" }` | `window.location.href = data.redirect_url` |
| `select_merchant` | `{ "merchants": [ { "id", "business_name", "subdomain_url" } ] }` | Store picker; next login POST adds `merchant_id` |
| `select_outlet` | `{ "outlets": […], "merchant": { "id" } }` | Outlet picker → [`outlet-select`](#3-outlet-select) |
| `verify_otp` | `{ "mobile", "merchant_id", "verify_key" }` | `sessionStorage` then `/sign-in/verification` |

`status !== 1` → show `message`. HTTP error → `responseJSON.message`.

Live land URL shape:

```
https://bengkel-manuju-jaya-621095.qasir.id/dashboard?tokenWeb=<TOKEN_WEB>
```

`tokenWeb` is **not** the later `API_TOKEN` Bearer. Dashboard JS still issues a 32-char `API_TOKEN` after this hop (see [`routes.md`](routes.md)).

### Outlet object (JS, not this capture)

| Field | Notes |
| --- | --- |
| `id` | integer |
| `name` | |
| `images` | URL; fallback `cdn.qasir.id/assets/images/outlet-default.png` |
| `location_name` | optional |
| `is_main` | badge “Utama” |
| `is_lock` | locked → no-access overlay, no POST |

## 3. Outlet select

Only if `next_step === "select_outlet"`. Not fired in this capture.

```
POST https://www.qasir.id/api/auth/outlet-select
```

Body = login body + `merchant_id` + `outlet_id`.

On `status === 1`:

```
{slug}.qasir.id/dashboard?tokenWeb={data.token_web}
```

`data.subdomain_url` + `data.token_web`.

## 4. Login OTP (optional)

Pages/routes from `__AUTH` on `/sign-in/verification`. Not observed live.

```
POST https://www.qasir.id/api/auth/login/otp-verify
```

Body: `{ mobile, merchant_id, code, verify_key, device_id }` — `code` is 4 digits.

```
POST https://www.qasir.id/api/auth/login/resend-otp
```

Body: `{ mobile, merchant_id }`.

Success: `status === 1` and `next_step === "redirect"` → `data.redirect_url`.

## Related: reset PIN

| Method | URL | Body (from JS) |
| --- | --- | --- |
| `POST` | `https://www.qasir.id/api/auth/reset-pin` | `{ mobile, device_id }` then optional `merchant_id` |
| `POST` | `https://www.qasir.id/api/auth/otp-verify` | forgot-PIN OTP uses `authkey` (4 digits), not `code` / `verify_key` |
| `POST` | `https://www.qasir.id/api/auth/reset-pin/create` | `{ merchant_id, auth_key, password, user_id }` |

Pages: `/forgot-pin` → `/forgot-pin/verification` → `/forgot-pin/change`.

## Device id

Cookie `qasir_device_id` + `localStorage.qasir_device_id`. UUID v4. Same id is sent on every auth POST. Persist it if you script login.

## Implementation notes

- `username` for phone is digits only: `62` + local, no `+`, no spaces. UI local field is **without** country code (`8212…` not `628212…`).
- PIN is exactly 6 digits. Field name is `password`.
- CSRF: GET `/sign-in` first; send `X-CSRF-TOKEN` matching the page meta / `XSRF-TOKEN` cookie.
- After `tokenWeb` redirect, use dashboard `API_TOKEN` for [`routes.md`](routes.md) APIs. Do not send `tokenWeb` as `Authorization`.
- Auth `status: 1` ≠ POS `code: 200`.
