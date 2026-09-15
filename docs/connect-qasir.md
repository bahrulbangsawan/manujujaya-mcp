# Connect Qasir

Hosted Worker UI to capture an unofficial Qasir dashboard session for MCP tools.

**This is not official OAuth.** Qasir has no public API. Login is phone/email + 6-digit PIN → `tokenWeb` redirect → dashboard session. The 32-char `API_TOKEN` used as Bearer is **not** `tokenWeb`. How `API_TOKEN` is minted after redirect is not fully documented — Connect scrapes common HTML/JS patterns and falls back to paste-from-DevTools.

## Routes

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/connect` | Login + paste UI |
| `POST` | `/connect/login` | Server-side sign-in per [`auth-login.md`](auth-login.md) |
| `POST` | `/connect/paste` | Save `API_TOKEN` + CSRF + Cookie from DevTools |
| `POST` | `/connect/disconnect` | Clear Durable Object session |
| `GET` | `/connect/status` | `{ connected, merchantSlug, outletId, connectedAt, source }` — **no secrets** |

## Gate

- Local: `ALLOW_DEV_PSK=true` + `DEV_PSK` via `Authorization: Bearer`, `X-Dev-Psk`, or `?psk=` once → signed connect cookie
- Production-ish: same MCP Bearer principal when available; otherwise `CONNECT_NONCE` via header/query once
- Our forms require CSRF (`mj_csrf` cookie + form field)
- Login attempts rate-limited in the subject's `QasirSessionsDO`

## Session storage

`QasirSessionsDO` (binding `QASIR_SESSIONS`) stores per subject:

`apiToken`, `csrfToken`, `cookieJar`, `merchantSlug`, `outletId`, `deviceId`, `connectedAt`, `expiresAt?`, `subject`

Never logged. Optional Worker secret `SESSION_ENCRYPTION_KEY` is reserved for encrypt-at-rest; until wired, DO storage holds session material directly — treat DO access as sensitive.

## Provider order

`CompositeQasirSessionProvider`:

1. DO session for authenticated MCP subject
2. Else Worker secrets `QASIR_API_TOKEN` / `QASIR_CSRF_TOKEN` / `QASIR_COOKIE` (ops bootstrap)
3. Upstream 401/403 → clear DO + `QASIR_AUTH_EXPIRED`

## Paste fallback

Expected when scrape misses. After manual login in a browser:

1. Open DevTools on `https://{slug}.qasir.id/…`
2. Copy `API_TOKEN` (32 alphanumeric), CSRF meta/header, and Cookie header
3. Paste into `/connect` → Save

## Security

- PIN never appears in logs, MCP tools, or resources
- Redirects allowlisted to `*.qasir.id` only
- Do not commit real tokens, cookies, or PINs
