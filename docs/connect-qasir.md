# Connect Qasir

Hosted Worker UI to capture an unofficial Qasir dashboard session for MCP tools.

**This is not official OAuth.** Qasir has no public API. Login is phone/email + 6-digit PIN → optional outlet/OTP pickers → `tokenWeb` redirect → dashboard session. The 32-char `API_TOKEN` used as Bearer is **not** `tokenWeb`. How `API_TOKEN` is minted after redirect is not fully documented — Connect scrapes common HTML/JS patterns and falls back to paste-from-DevTools.

**Merchant is fixed.** Connect always uses wrangler `MERCHANT_SLUG` (`bengkel-manuju-jaya-621095` / Manuju Jaya origin `https://bengkel-manuju-jaya-621095.qasir.id`). There is **no merchant picker** in the UI: if Qasir returns `select_merchant`, the Worker auto-continues with that store’s `merchant_id`. Accounts that do not include the configured merchant get an error.

## Routes

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/connect` | Login + paste UI (or pending step UI) |
| `POST` | `/connect/login` | Server-side sign-in per [`auth-login.md`](auth-login.md) |
| `POST` | `/connect/select-merchant` | Legacy continue after `select_merchant` (auto-resolves via `MERCHANT_SLUG`; client `merchant_id` ignored unless it matches) |
| `POST` | `/connect/select-outlet` | Continue after `next_step: select_outlet` (`outlet-select`) |
| `POST` | `/connect/verify-otp` | Continue after `next_step: verify_otp` |
| `POST` | `/connect/resend-otp` | Resend login OTP |
| `POST` | `/connect/paste` | Save `API_TOKEN` + CSRF + Cookie from DevTools |
| `POST` | `/connect/disconnect` | Clear Durable Object session + pending auth |
| `GET` | `/connect/status` | `{ connected, merchantSlug, outletId, connectedAt, source, pendingStep }` — **no secrets** |

## Multi-step auth

Per [`auth-login.md`](auth-login.md), login may return:

1. **`select_merchant`** — **auto-resolved** to `MERCHANT_SLUG` (Manuju Jaya); no picker. Worker re-POSTs login with `merchant_id`. Missing slug → error (not UI).
2. **`select_outlet`** — UI lists outlets (locked outlets disabled); POST `/api/auth/outlet-select`.
3. **`verify_otp`** — 4-digit code + resend; POST `/api/auth/login/otp-verify` / `resend-otp`.
4. **`redirect`** — follow allowlisted `*.qasir.id` dashboard URL and scrape `API_TOKEN`.

Pending state lives in `QasirSessionsDO` (TTL ~10 minutes). Hosts stay on the Qasir allowlist only.

## Gate

- Local: `ALLOW_DEV_PSK=true` + `DEV_PSK` via `Authorization: Bearer`, `X-Dev-Psk`, or `?psk=` once → signed connect cookie
- Production-ish: same MCP Bearer principal when available; otherwise `CONNECT_NONCE` via header/query once
- Our forms require CSRF (`mj_csrf` cookie + form field)
- Login attempts rate-limited in the subject's `QasirSessionsDO`

## Session storage

`QasirSessionsDO` (binding `QASIR_SESSIONS`) stores per subject:

`apiToken`, `csrfToken`, `cookieJar`, `merchantSlug`, `outletId`, `deviceId`, `connectedAt`, `expiresAt?`, `subject`

Never logged.

### Encryption

Worker secret `SESSION_ENCRYPTION_KEY` (prefer `openssl rand -base64 32`) encrypts DO blobs with **Web Crypto AES-GCM**.

- Key set → encrypt session + pending auth at rest
- `REQUIRE_SESSION_ENCRYPTION=true` and key missing → **fail closed** on DO writes (no plaintext)
- Local: leave key empty + `REQUIRE_SESSION_ENCRYPTION=false` for plaintext DO (dev only); document clearly in `.dev.vars.example`

## Provider order

`CompositeQasirSessionProvider`:

1. DO session for authenticated MCP subject (`principal.subject` → `idFromName(subject)`)
2. Else Worker secrets `QASIR_API_TOKEN` / `QASIR_CSRF_TOKEN` / `QASIR_COOKIE` (ops bootstrap)
3. Upstream 401/403 → clear DO + `QASIR_AUTH_EXPIRED`

## Paste fallback

Expected when scrape misses. After manual login in a browser:

1. Open DevTools on `https://{slug}.qasir.id/…`
2. Copy `API_TOKEN` (32 alphanumeric), CSRF meta/header, and Cookie header
3. Paste into `/connect` → Save

## Security

- PIN never appears in logs, MCP tools, or resources (pending DO may hold PIN encrypted ≤ TTL for merchant/outlet continue)
- Redirects allowlisted to `*.qasir.id` only
- Do not commit real tokens, cookies, or PINs
