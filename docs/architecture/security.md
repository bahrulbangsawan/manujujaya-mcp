# Security model

## Assets and trust boundaries

| Asset | Where it lives | Who may touch it |
| --- | --- | --- |
| Qasir dashboard session (`API_TOKEN`, CSRF, cookies) | `QasirSessionsDO`, AES-GCM encrypted | Host code only (dispatcher, Connect) |
| Owner password | Worker secret `OWNER_PASSWORD` | Compared in constant time; never stored elsewhere |
| OAuth tokens | `OAUTH_KV` (hashed) | OAuth provider |
| Merchant data (sales, customers, stock) | Upstream Qasir; flows through tool results | The MCP client and its model, for a token with `qasir:read` |
| Ability to change Qasir data | `execute_mutation` + approvals DO | Owner, per call, in a browser |

Untrusted inputs: model-written code, tool arguments, OAuth client metadata (name, redirect URIs, CIMD documents), upstream responses (JSON and HTML), and anything posted to the browser routes.

## Controls

### MCP client authentication (`src/index.ts`, `src/auth/*`)

- `/mcp` sits behind `OAuthProvider`. Tokens are verified, including the audience `https://mcp.manujujaya.com/mcp`, before any MCP code runs. A malformed `props` object fails closed with 401.
- Tokens are issued only through `/authorize`, which requires the **owner password** (≥ 16 chars, or 503) or a valid owner cookie, plus a double-submit CSRF token. The provider re-validates the untampered query on the POST.
- The consent page shows the client's self-declared name, its client ID and the **redirect origin**, and warns that only connections the owner started should be approved. Deny redirects with `access_denied`.
- Scopes: `qasir:read` is pre-ticked. `qasir:write` is offered only if requested or if mutations are enabled. `qasir:admin` is offered only if requested. The token's scopes are exactly the ticked boxes, and `tokenExchangeCallback` keeps `props.scopes` in sync with the issued scope.
- PKCE S256 only, exact redirect URIs, refresh token rotation. CIMD fetches run under `global_fetch_strictly_public`, which blocks private and internal addresses.
- `DEV_PSK` is honoured only if `ALLOW_DEV_PSK=true`, the key is ≥ 16 characters **and** the request host is loopback. Production has `ALLOW_DEV_PSK=false` and no `DEV_PSK`.

### Browser routes (`/authorize`, `/login`, `/connect*`, `/approvals/:id`)

- Owner cookie: `payload.HMAC`, valid 8 h. The HMAC key is derived with HKDF from `SESSION_ENCRYPTION_KEY`, salted with a digest of `OWNER_PASSWORD`, so rotating either secret invalidates every cookie.
- Cookies are `__Host-` prefixed, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/` on https.
- Every state-changing form requires the double-submit CSRF token (`mj_csrf`, 1 h). `/logout` is POST + CSRF.
- HTML responses send `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `default-src 'none'`, `no-store`, `nosniff` and `no-referrer`. `form-action` is left out on purpose so the OAuth redirect back to the client still works.
- Post-login `next` accepts same-origin relative paths only.
- Rate limits, fixed windows of 15 min stored in DOs with hashed keys:
  - owner password: 10 failed attempts per IP / IPv6 /64 (no global bucket, so nobody can lock the owner out from another network);
  - Qasir PIN: 10 per IP, 6 per username, 20 globally.

### Code Mode sandbox (`src/codemode/*`)

- Model code runs in a fresh Worker Loader isolate with `globalOutbound: null`, no env bindings and a 10 s CPU limit. It cannot reach the network, KV, DOs or secrets.
- The only host functions are `codemode.spec()` (static, sanitized catalog) and, in `execute`, `codemode.request()`.
- `request()` rejects every key except `operationId`/`path`/`query`/`body`. The method, host, path template, headers, Origin/Referer and credentials all come from the registry and session on the host.
- Budgets are enforced on the host and are terminal: 50 requests, 4 concurrent, ~5 MB of responses, 20 spec calls, a 30 s deadline that aborts in-flight upstream fetches, and a ~24 KB output cap.
- Error bridging returns only `CODE: message` to the sandbox and the client, never stacks, `details` or causes.

### Dispatcher (`src/dispatcher/*`, `src/registry/validate.ts`)

- Operations must be registered and `exposed`. Failed probes and ungated mutations are `excluded` in the coverage manifest and cannot be called.
- Input is validated against the doc-derived schema before any network call. Unknown keys are rejected, path segments are typed and pattern-checked, strings are length-bounded, and page sizes are ≤ 100.
- Hosts are fixed per operation: `pos`, `order`, `payment`, `account`, `sms`, `www` `.qasir.id`, plus `<MERCHANT_SLUG>.qasir.id` from trusted config. `https` only, with no userinfo, no non-default port, no `..` and no `//`.
- Redirects are handled manually. They are followed only for GET, on the same host, on the allowlist, at most 3 hops. Sign-in redirects are reported as expiry. Non-GET redirects are never followed, so a write is not replayed.
- Limits: a 25 s deadline per request and a 2 MB streamed body cap.
- A 401 or sign-in redirect clears the stored session only if it still holds the failing token (compare-and-delete). A 403 keeps the session.

### Mutations (`src/mcp/mutation-tool.ts`, `src/approvals/*`)

Four gates, all required:

1. `ENABLE_MUTATIONS=true`, or the tool is not registered and the dispatcher refuses.
2. The token has `qasir:write` or `qasir:admin`.
3. The operation is a registered write/destructive op. Its safety class is based on what it does, not the HTTP verb: `purchases.cancel` is a GET but destructive.
4. An owner-approved, unexpired, unconsumed approval in `MutationApprovalsDO` bound to subject + `operationId` + SHA-256 of the normalized arguments.

Only the owner can approve, in a browser, with the owner cookie and CSRF. The MCP client that asked for the approval cannot approve it. Consumption is atomic and single-use, and every execution gets an `executionId` in the logs.

### Upstream session storage (`src/session/*`)

- AES-256-GCM with a key derived by HKDF from `SESSION_ENCRYPTION_KEY`. The key is distinct from the cookie key.
- The AAD binds each record to the DO id, storage key, record kind and expiry, so blobs cannot be swapped between records.
- `REQUIRE_SESSION_ENCRYPTION=true` refuses plaintext on both write and read. Undecryptable records are deleted.
- Pending outlet-selection state never contains the PIN and hard-expires after 10 minutes (alarm).
- The merchant origin is always taken from `MERCHANT_SLUG`, never from stored or caller data.

### Logging and output hygiene (`src/observability/*`)

- Logs are JSON lines to Workers Logs. Keys such as `authorization`, `cookie`, `x-csrf-token`, `password`, `pin` and `token` are redacted, and so are bearer-like or long token-like strings.
- Session events log only a 4-character token prefix. Usernames are logged as a length only.
- `qasir://docs/*` resources are sanitized at read time (UUIDs, emails, phone numbers, person fields). `qasir://openapi` and the spec bundle contain no credentials or sample PII.

## Residual risks and operator responsibilities

- **Live data reaches the model provider.** `execute` results are not PII-redacted. Customer names, phone numbers and sales figures go to whichever MCP client or model the owner connected. Grant access only to clients you trust with that data.
- **The owner password is the single factor.** Anyone with it can mint tokens (180-day refresh), read all data and approve mutations. Use a long random password stored in a password manager.
- **Rotating the password does not revoke tokens.** See [operations.md § Revoking OAuth clients](operations.md#revoking-oauth-clients-and-tokens).
- **Consent phishing.** A malicious site can start an OAuth flow against this server with any client name. The redirect origin on the consent page is the defence. Never approve a flow you did not start.
- **Shared Qasir session.** Every token uses the same dashboard session with the owner's Qasir permissions. Qasir enforces nothing per client.
- **Unofficial upstream.** Schema drift can make the server misread data. Mutation previews show the arguments you send, not what Qasir will do with them.
- **Git history.** Sample PII removed from `docs/` still exists in earlier commits.
