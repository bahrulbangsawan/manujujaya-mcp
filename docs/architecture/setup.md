# Setup: local development, Cloudflare deploy, OAuth, secrets

## Prerequisites

- Bun 1.4+ (`bun --version`); dependencies are pinned in `bun.lock`
- Wrangler comes from devDependencies; run it as `bunx wrangler`
- For deploys, access to the Cloudflare account **bisa.digital** (its `account_id` is in `wrangler.jsonc`) and the `manujujaya.com` zone on that account
- For live checks, a Qasir phone/email + 6-digit PIN account for the merchant that does not require OTP

## Local development

```bash
bun install
cp .dev.vars.example .dev.vars   # never commit .dev.vars (gitignored)
```

Fill in `.dev.vars`:

| Key | Local value |
| --- | --- |
| `PUBLIC_BASE_URL` | `http://localhost:8787` (already set; it defines the OAuth resource `http://localhost:8787/mcp`) |
| `OWNER_PASSWORD` | Any string of **at least 16 characters**. Without it, `/authorize`, `/login` and `/connect` return 503 |
| `SESSION_ENCRYPTION_KEY` | `openssl rand -base64 32` |
| `REQUIRE_SESSION_ENCRYPTION` | `true` (keep it) |
| `ALLOW_DEV_PSK` / `DEV_PSK` | `true` / a random string of at least 16 characters (optional; skips OAuth for local scripts) |
| `QASIR_API_TOKEN` / `QASIR_CSRF_TOKEN` / `QASIR_COOKIE` | Leave empty and use `/connect` |
| `QASIR_E2E_USERNAME` / `QASIR_E2E_PIN` | Only for `scripts/e2e-*.ts --connect`; the Worker never reads them |

`.dev.vars` overrides the `vars` in `wrangler.jsonc`. For example, add `ENABLE_MUTATIONS=true` to try the approval flow locally. Local tests never write to Qasir unless you approve a mutation yourself.

Run the Worker:

```bash
bun run dev                      # wrangler dev, listens on 127.0.0.1:8787
curl http://localhost:8787/healthz
```

`wrangler.jsonc` sets `dev.host` to `localhost:8787`, so the Worker always sees `http://localhost:8787` and not the production custom domain. Use `localhost` in client URLs.

### Dev PSK (local only)

With `ALLOW_DEV_PSK=true` and a `DEV_PSK` of 16+ characters:

- `/mcp` accepts `Authorization: Bearer <DEV_PSK>` and grants `qasir:read` + `qasir:write`;
- `/connect*` accepts an `x-dev-psk: <DEV_PSK>` header, which is exempt from CSRF.

Both work **only when the request host is `localhost`, `127.0.0.1` or `[::1]`**. The PSK is ignored on `mcp.manujujaya.com` even if the flag is set by mistake. Production keeps `ALLOW_DEV_PSK=false` and never sets `DEV_PSK`.

```bash
claude mcp add --transport http manujujaya-local http://localhost:8787/mcp \
  --header "Authorization: Bearer $DEV_PSK"
```

### Tests and checks

```bash
bun run check-types          # tsc (Worker) + tsc -p tsconfig.scripts.json
bun run test                 # vitest; use this, not `bun test`
bun run coverage:validate    # manifest vs the 13 API docs
bun run openapi:validate
bun run build                # wrangler deploy --dry-run --outdir=dist (uploads nothing)
```

After editing any of the 13 API docs (`docs/<name>.md`), run `bun run docs:bundle` to regenerate `src/docs/bundled.ts`. Then run `bun run coverage:report` to regenerate `docs/architecture/coverage.md`. `tests/unit/docs-pii.test.ts` fails if the bundle drifts or known sample PII comes back.

### End-to-end script

`scripts/e2e-mcp.ts` runs against a live Worker. It performs the real OAuth flow (metadata, DCR, consent with the owner password, PKCE, refresh), then uses the official MCP v2 client pinned to `2026-07-28` to exercise `server/discover`, tools, resources, prompts and the sandbox guards. It reads `OWNER_PASSWORD` from the environment or `.dev.vars` and never prints secrets. It never calls a mutating operation.

```bash
bun run e2e                                                     # = --base http://localhost:8787
bun run scripts/e2e-mcp.ts --base http://localhost:8787 --connect --live
bun run scripts/e2e-mcp.ts --base https://mcp.manujujaya.com --live
```

- `--connect` signs in as owner, then logs in to Qasir through `/connect` using `QASIR_E2E_USERNAME` / `QASIR_E2E_PIN`. It picks `DEFAULT_OUTLET_ID` when Qasir asks for an outlet. This replaces the stored Qasir session on that Worker. A login does not write Qasir data.
- `--live` adds read-only upstream calls: `products.list`, `purchases.list`, the suppliers HTML adapter, and a page-size rejection check.
- Each run registers a new OAuth client and grant in `OAUTH_KV`. See [operations.md § Revoking clients](operations.md#revoking-oauth-clients-and-tokens) to clean them up.
- The script logs whether a 2025-era client was rejected or served (INFO, not a failure).

`bun run e2e:live-login` (`scripts/e2e-live-login-products.ts`) skips the Worker. It runs the Connect login code and `products.list` directly from Bun using `.dev.vars`.

## Cloudflare deploy

### Configuration in `wrangler.jsonc`

| Setting | Value | Why |
| --- | --- | --- |
| `account_id` | bisa.digital | Fixed target account |
| `routes` | `{ pattern: "mcp.manujujaya.com", custom_domain: true }` | Custom domain; the OAuth issuer and resource are `https://mcp.manujujaya.com` |
| `workers_dev` / `preview_urls` | `false` | No `*.workers.dev` or preview host, so tokens have one stable audience |
| `compatibility_date` / flags | `2026-09-15`, `nodejs_compat`, `global_fetch_strictly_public` | The last flag blocks CIMD metadata fetches to private addresses |
| `worker_loaders` | `LOADER` | Code Mode sandbox isolates |
| `kv_namespaces` | `OAUTH_KV` | OAuth provider storage |
| `durable_objects` | `MUTATION_APPROVALS` → `MutationApprovalsDO`, `QASIR_SESSIONS` → `QasirSessionsDO` | Approvals, Qasir session, rate limits |
| `migrations` | `v1`: `new_sqlite_classes: [MutationApprovalsDO, QasirSessionsDO]` | SQLite-backed DOs. Add a **new** tag for any class change; never edit `v1` |
| `observability` | `enabled: true`, `head_sampling_rate: 1` | Workers Logs for every request |
| `vars` | `PUBLIC_BASE_URL=https://mcp.manujujaya.com`, `MERCHANT_SLUG`, `DEFAULT_OUTLET_ID`, `ENABLE_MUTATIONS=false`, `ALLOW_DEV_PSK=false`, `REQUIRE_SESSION_ENCRYPTION=true`, `MCP_LEGACY_MODE=reject`, `MCP_SERVER_NAME`, `MCP_SERVER_VERSION` | Change vars **in this file** and redeploy. `wrangler deploy` (without `--keep-vars`) resets vars edited in the dashboard |

### First-time setup (already done for production)

```bash
bunx wrangler login
bunx wrangler kv namespace create OAUTH_KV   # put the id into wrangler.jsonc
```

The Durable Object migrations apply automatically on the first deploy. The custom domain is created on deploy if the `manujujaya.com` zone is on the same account. The account also needs Worker Loader (Dynamic Workers) access for the `LOADER` binding. bisa.digital has it. On a new account, check it before relying on `search` or `execute`.

### Secrets

| Secret | Required | Format | Used for |
| --- | --- | --- | --- |
| `OWNER_PASSWORD` | Yes | ≥ 16 characters; store it in a password manager | Consent approval, `/login`, `/connect`, `/approvals` |
| `SESSION_ENCRYPTION_KEY` | Yes | `openssl rand -base64 32` (a 32-byte base64 key; other strings are treated as a passphrase) | AES-GCM encryption of the Qasir session in the DO; HKDF root for the owner cookie HMAC |
| `QASIR_API_TOKEN`, `QASIR_CSRF_TOKEN`, `QASIR_COOKIE` | No | Values from dashboard DevTools | Bootstrap fallback, used only when no `/connect` session exists. Prefer `/connect` |
| `DEV_PSK` | **Never in production** | — | Local only |

If `OWNER_PASSWORD` or `SESSION_ENCRYPTION_KEY` is missing, owner pages return 503. With `REQUIRE_SESSION_ENCRYPTION=true`, no plaintext session is ever written or read.

Set the secrets with **either** method:

```bash
# A) one at a time (prompts for the value, nothing lands in shell history)
bunx wrangler secret put OWNER_PASSWORD
bunx wrangler secret put SESSION_ENCRYPTION_KEY

# B) with the deploy, from a dotenv/JSON file (additive: secrets not listed are kept)
bunx wrangler deploy --secrets-file .secrets.production
```

`.secrets.production` is gitignored. Move the values into a password manager and delete the file afterwards.

### Deploy

```bash
bun run check-types && bun run test && bun run coverage:validate && bun run build
bunx wrangler deploy
curl https://mcp.manujujaya.com/healthz        # {"ok":true,...,"protocol":"2026-07-28","mutations":false}
OWNER_PASSWORD='…' bun run scripts/e2e-mcp.ts --base https://mcp.manujujaya.com --live
```

`OWNER_PASSWORD='…' …` puts the password in shell history. Use `read -rs OWNER_PASSWORD && export OWNER_PASSWORD` first instead.

### Rotating secrets

| Rotate | Effect | Follow-up |
| --- | --- | --- |
| `OWNER_PASSWORD` | Every owner cookie becomes invalid (the cookie key is salted with the password), so the owner must sign in again. **Issued OAuth tokens keep working.** | To also cut off clients, [revoke grants](operations.md#revoking-oauth-clients-and-tokens) |
| `SESSION_ENCRYPTION_KEY` | Owner is signed out. The stored Qasir session and any pending outlet selection can no longer be decrypted; they are deleted on the next read. Tools return `QASIR_AUTH_EXPIRED` until someone reconnects. OAuth tokens and approvals are unaffected. | Sign in and run `/connect` again |
| Qasir PIN (in Qasir) | Existing dashboard sessions may be invalidated upstream | Reconnect at `/connect` |

Rotation with `wrangler secret put` deploys a new Worker version right away.

## OAuth setup

Nothing needs configuring beyond the secrets: the Worker is its own authorization server.

| Endpoint | Path |
| --- | --- |
| Protected resource metadata (RFC 9728) | `/.well-known/oauth-protected-resource/mcp` (resource `https://mcp.manujujaya.com/mcp`) |
| Authorization server metadata | `/.well-known/oauth-authorization-server` |
| Authorization (consent) | `/authorize` |
| Token | `/oauth/token` |
| Dynamic client registration | `/oauth/register` |

- **Client registration:** Dynamic Client Registration, or Client ID Metadata Documents (CIMD, an https URL used as `client_id`). DCR clients expire after 90 days; the client then registers again.
- **PKCE:** `S256` only. Redirect URIs must match exactly.
- **Tokens:** access tokens last 1 h; refresh tokens last 180 days and rotate; dynamically registered clients last 365 days (registration metadata is size-limited). Tokens are stored hashed in `OAUTH_KV`. Plain-HTTP requests are redirected to HTTPS and pages send HSTS.
- **Scopes:** `qasir:read` (read tools), `qasir:write` (needed for `execute_mutation`, which also needs `ENABLE_MUTATIONS=true`), `qasir:admin` (implies read + write; offered only when a client asks for it). Resource metadata advertises only `qasir:read`, so most clients request just that.
- **Consent page:** it shows the client's *self-declared* name, client ID and **redirect origin**. Only approve connections you started yourself, and only when the redirect origin matches the app (Claude.ai: `https://claude.ai`; Claude Code and other local clients: `http://localhost`). Anyone can register a client with any name, so the redirect origin is the thing to check.
- **Identity:** there is one owner. Every grant has subject `owner`, and the password on the consent page is the only credential.
