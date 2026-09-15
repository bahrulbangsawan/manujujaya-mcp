# Qasir session setup (`/connect`)

MCP tools read Qasir as the merchant owner through a **dashboard session**: the `API_TOKEN` bearer, the dashboard CSRF token and merchant cookies. This is not an official Qasir API key, and it expires. `/connect` is the owner-only page that captures one session for the whole server.

The session is shared by the whole merchant. There is one session per `MERCHANT_SLUG`, stored in `QasirSessionsDO` instance `merchant:<MERCHANT_SLUG>`. Every OAuth client and token uses the same session. Reconnecting replaces it for everyone.

## Connect (normal path)

1. Open `https://mcp.manujujaya.com/connect`. Without an owner cookie you are sent to `/login`; sign in with the owner password.
2. Enter the Qasir **phone (62…) or email** and the **6-digit PIN**, then choose "Sign in & connect". The Worker performs the documented login server-side (see [auth-login.md](auth-login.md)):
   - `select_merchant` resolves automatically to `MERCHANT_SLUG`; there is no picker. Accounts without that merchant get an error.
   - `select_outlet` shows a list of outlets; locked outlets are disabled. **Enter the PIN again** to continue, because the PIN is never kept between steps. The pending selection expires after 10 minutes. Cancel clears it.
   - `verify_otp` is rejected with an error. OTP accounts are not supported, and `/connect/verify-otp` and `/connect/resend-otp` return 410.
   - `redirect` is followed on the configured merchant host only. The Worker then scrapes `API_TOKEN` and the CSRF meta tag from the dashboard HTML.
3. On success the page shows "Connected to …" with only a 4-character token prefix. `GET /connect/status` returns `{ connected, merchantSlug, outletId, connectedAt, source, subject }` and never secrets.

## Paste fallback

Use this when the page reports that `API_TOKEN` or the CSRF meta was not found. That is expected if Qasir changes how the token is embedded.

1. In a normal browser, sign in to the Qasir dashboard at `https://<MERCHANT_SLUG>.qasir.id/`.
2. In DevTools, collect:
   - the `API_TOKEN` (32 alphanumeric characters, from page JS or the `Authorization` header of a `pos.qasir.id` XHR);
   - the `<meta name="csrf-token">` content (16–256 characters);
   - the full `Cookie` request header for the merchant host.
3. Paste them into the "Paste fallback" form on `/connect`, optionally with a numeric outlet id, and save. The input is validated: token shape, printable-ASCII `name=value` cookie pairs, at most 8 KB.

## Expiry and reconnecting

The dispatcher maps upstream auth failures like this:

| Upstream response | Tool error | Stored session |
| --- | --- | --- |
| `401`, or a 3xx to the Qasir sign-in page | `QASIR_AUTH_EXPIRED` | Cleared, but **only if it still holds the token that failed**. A session saved by a reconnect in the meantime is kept |
| `419` (Laravel page expired: cookie/CSRF) | `QASIR_AUTH_EXPIRED` | Kept (bearer operations may still work) |
| Sign-in HTML where JSON was expected | `QASIR_AUTH_EXPIRED` | Kept |
| `403` | `FORBIDDEN` | Kept: role, outlet or feature denial, not an expired session |
| `429` | `QASIR_RATE_LIMITED` | Kept |

If there is no session at all (never connected, disconnected, cleared, or unreadable after `SESSION_ENCRYPTION_KEY` rotation), the error is `QASIR_AUTH_EXPIRED` with the message `Missing QASIR_API_TOKEN / QASIR_CSRF_TOKEN Worker secrets`. The fix is the same: reconnect at `/connect`.

Nothing refreshes the session automatically, and nobody has measured how long a dashboard session lasts.

## Routes

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/connect` | Login + paste page, or the outlet picker while a selection is pending |
| `POST` | `/connect/login` | `username`, `pin` (+ `csrf`) → connected / `select_outlet` / `needs_paste` / error |
| `POST` | `/connect/select-outlet` | `outletId`, `pin` (+ `csrf`) |
| `POST` | `/connect/cancel` | Drop the pending outlet selection |
| `POST` | `/connect/paste` | `apiToken`, `csrfToken`, `cookie`, optional `outletId` |
| `POST` | `/connect/disconnect` | Delete the stored session and pending state |
| `GET` | `/connect/status` | Connection status (no secrets) |
| any | `/connect/select-merchant`, `/connect/verify-otp`, `/connect/resend-otp` | `410 Gone` |

Forms need the double-submit CSRF token (the `mj_csrf` cookie plus a form field). JSON bodies and `Accept: application/json` get JSON responses; `scripts/e2e-mcp.ts --connect` uses these. Locally, the `x-dev-psk` header can replace the owner cookie (loopback hosts only).

## Safeguards

- **Who can use it:** only the owner. The gate is the owner cookie from `/login`, or `DEV_PSK` on loopback.
- **Rate limits on PIN attempts (login and outlet select):** 10 per IP, 6 per normalized username and 20 globally, each per 15 minutes. Keys are stored as SHA-256 hashes.
- **PIN:** used only for the upstream sign-in request. It is never stored (not even in pending state), never logged and never exposed to MCP.
- **Storage:** the session is AES-GCM encrypted with an HKDF-derived key from `SESSION_ENCRYPTION_KEY`, with associated data binding it to the DO id, record key and expiry. `REQUIRE_SESSION_ENCRYPTION=true` refuses plaintext. Records that cannot be decrypted are deleted.
- **Hosts:** login requests go only to `www.qasir.id` and the configured merchant host. Redirects to any other store or host abort the login, and nothing is saved.
- **Merchant origin:** always comes from `MERCHANT_SLUG`, never from stored or caller data.

## Static bootstrap secrets (optional)

`QASIR_API_TOKEN`, `QASIR_CSRF_TOKEN` and `QASIR_COOKIE` Worker secrets are used only when the DO holds no session. They have the same expiry problem and must be rotated with `wrangler secret put`. Prefer `/connect`.
