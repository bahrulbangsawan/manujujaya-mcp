# Operations runbook

Production: Worker `manujujaya-mcp` on the Cloudflare account bisa.digital, served at `https://mcp.manujujaya.com`. Setup and deploy steps are in [setup.md](setup.md).

## Health and quick checks

```bash
curl -s https://mcp.manujujaya.com/healthz
# {"ok":true,"name":"manujujaya-mcp","version":"0.3.0","protocol":"2026-07-28","mutations":false}

curl -s https://mcp.manujujaya.com/.well-known/oauth-protected-resource/mcp   # resource + scopes
curl -si -X POST https://mcp.manujujaya.com/mcp | head -5                      # expect 401 + WWW-Authenticate
```

Full check, without writes (creates one OAuth client + grant per run):

```bash
read -rs OWNER_PASSWORD && export OWNER_PASSWORD
bun run scripts/e2e-mcp.ts --base https://mcp.manujujaya.com --live
```

Qasir session status: open `https://mcp.manujujaya.com/connect/status` while signed in as owner.

## Logs

- **Dashboard:** Workers & Pages → `manujujaya-mcp` → Observability / Logs. Every request is sampled (`head_sampling_rate: 1`).
- **Live tail:** `bunx wrangler tail manujujaya-mcp --format pretty`. Add `--status error` to see failures only.
- Log lines are JSON with `level` and `message`. Useful messages:

| `message` | Meaning |
| --- | --- |
| `oauth.error` | Provider rejected a token/authorize/register call (`code`, `status`, `reason`) |
| `owner.password.invalid` / `owner.password.rate_limited` | Wrong owner password / attempt limit hit |
| `oauth.authorize.approved` / `.denied` | Consent decisions (`clientId`, `scopes`) |
| `tool.search.error` / `tool.execute.error` / `tool.execute_mutation.error` | Tool failed with `code` |
| `qasir.dispatch` | One upstream call (`operationId`, `host`, `path`) |
| `qasir.session_expired` | 401 or sign-in redirect; stored session cleared if the token matched |
| `session.record_dropped` | A DO record was deleted (`decrypt_failed` after key rotation, `malformed`, `plaintext_rejected`) |
| `connect.login.success` / `connect.paste.success` / `connect.disconnect` | Qasir session changes (4-char token prefix only) |
| `mutation.approval.requested` / `.decided`, `mutation.execute.start` / `.done` | Mutation audit trail with `approvalId` / `executionId` |
| `worker.unhandled`, `mcp.handler.error` | Unexpected errors |

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Client keeps returning to sign-in / 401 loop on `/mcp` | Token expired and refresh failed; DCR client expired (90 days); grant revoked; client using a URL other than `https://mcp.manujujaya.com/mcp` (audience mismatch) | Remove and re-add the connector using exactly `https://mcp.manujujaya.com/mcp`; check `oauth.error` logs |
| Consent page says "Owner auth is not configured" (503) | `OWNER_PASSWORD` shorter than 16 characters or missing, or `SESSION_ENCRYPTION_KEY` missing | `bunx wrangler secret put …` (see [setup.md § Secrets](setup.md#secrets)) |
| "Incorrect owner password" / "Too many failed attempts from this network" | Wrong password / 10 failed attempts per IP (IPv6 /64) per 15 min; correct passwords never count | Wait 15 min or use another network; check logs for attempts you did not make |
| Consent page "Client metadata document could not be fetched" | CIMD URL unreachable or private | Client-side problem; try a client that uses DCR |
| Tool error `QASIR_AUTH_EXPIRED` | No Qasir session, dashboard session expired (401/419/sign-in redirect), or key rotated. The message `Missing QASIR_API_TOKEN / QASIR_CSRF_TOKEN Worker secrets` means no session is stored | Owner reconnects at `/connect` ([connect-qasir.md](../connect-qasir.md)) |
| Tool error `FORBIDDEN` "Upstream forbidden (403)" | The Qasir account lacks the role, outlet or feature | Use a Qasir account with access; the session is kept |
| Tool error `INVALID_INPUT` | Schema validation (lists missing/unknown/invalid keys), page size > 100, script syntax/runtime error | Fix the arguments; `search` for `inputKeys` and the OpenAPI schema |
| Tool error `RESULT_LIMIT_EXCEEDED` | > 50 requests, > ~5 MB of results, > 2 MB single body, > 20 spec calls | Fewer or smaller pages; aggregate in the sandbox |
| Tool error `UPSTREAM_TIMEOUT` | Script over 30 s, or one upstream request over 25 s | Fewer sequential calls; use up to 4 in parallel |
| Tool error `UPSTREAM_ERROR` on an operation that used to work | Qasir changed the endpoint | Re-capture it, update `docs/<name>.md` + `src/registry/ops/*`, redeploy |
| Connect: "OTP accounts are not supported" | Account requires OTP | Use a PIN-only account |
| Connect: "API_TOKEN … not found in the dashboard HTML" | Token scrape failed | Use the paste fallback |
| Connect: 429 "Too many sign-in attempts" | PIN limits (10/IP, 6/user, 20 global per 15 min) | Wait for `Retry-After` |
| Client error `-32022` / "unsupported protocol version" | Client speaks 2025-era MCP only | See [below](#legacy-2025-era-clients-error-32022) |
| `execute_mutation` missing from tools/list | `ENABLE_MUTATIONS=false`, or token lacks `qasir:write` | See [Enabling mutations](#enabling-mutations) |
| Approval page "Approval not found" / "expired" | Wrong id, over 10 minutes old, or already decided | Call `execute_mutation` again without `approvalId` |

## Legacy 2025-era clients (error 32022)

Production runs `legacy: "reject"`, which serves only `2026-07-28`. An `initialize`-based client, or one sending an older `MCP-Protocol-Version`, gets HTTP 400 with JSON-RPC error `-32022` whose `data` lists `supported: ["2026-07-28"]`.

To serve such clients too (stateless, per request, same auth and tools):

1. Set `"MCP_LEGACY_MODE": "stateless"` in `wrangler.jsonc` `vars`. Do not change it in the dashboard, because the next deploy resets it.
2. `bunx wrangler deploy`
3. Verify: `bun run scripts/e2e-mcp.ts --base https://mcp.manujujaya.com` should print `INFO legacy (2025 initialize) client connected`.

Set it back to `reject` when the clients no longer need it.

## Enabling mutations

Production is read-only. To allow approved changes:

1. Set `"ENABLE_MUTATIONS": "true"` in `wrangler.jsonc` and run `bunx wrangler deploy`. `/healthz` then shows `"mutations": true`.
2. Re-authorize the client. Existing `qasir:read` tokens do not gain write access. Remove and re-add the connector (or run `/mcp` → re-authenticate in Claude Code). On the consent page, **tick `qasir:write`**.
3. `tools/list` now includes `execute_mutation` for that token. Each call returns an `approvalUrl`. Open it, sign in, review, and choose **Approve once**. The assistant then repeats the call with the same arguments plus `approvalId`. Approvals expire after 10 minutes and run once. See [mcp-tools.md § execute_mutation](../mcp-tools.md#execute_mutation-approved-changes-two-calls).
4. Afterwards, set `ENABLE_MUTATIONS` back to `false` and redeploy. With the flag off, the tool disappears and the dispatcher refuses writes even for `qasir:write` tokens.

## Reconnecting Qasir

Open `/connect`, sign in with the owner password, then enter phone/email + PIN (and the PIN again if an outlet has to be chosen). To stop all upstream access at once, choose **Disconnect** on `/connect`, which deletes the stored session. Also make sure no `QASIR_*` bootstrap secrets are set (`bunx wrangler secret list`).

## Revoking OAuth clients and tokens

The server has no UI for revoking grants. The OAuth provider (0.10.3) stores grants as `grant:owner:<grantId>` and tokens as `token:owner:<grantId>:<tokenId>` in `OAUTH_KV`. Deleting a grant stops its refresh token. Delete its tokens too so current access tokens stop working immediately.

```bash
bunx wrangler kv key list --binding OAUTH_KV --remote --prefix "grant:owner:"
bunx wrangler kv key list --binding OAUTH_KV --remote --prefix "token:owner:<grantId>:"
bunx wrangler kv key delete --binding OAUTH_KV --remote "grant:owner:<grantId>"
bunx wrangler kv key delete --binding OAUTH_KV --remote "token:owner:<grantId>:<tokenId>"
```

To see which client a grant belongs to, run `bunx wrangler kv key get --binding OAUTH_KV --remote "grant:owner:<grantId>"`. It prints JSON with `clientId`, `scope`, `createdAt` and `metadata.clientName` in plain text; only the props are encrypted. To revoke **everything** (for example after a suspected password leak): rotate `OWNER_PASSWORD`, delete every `grant:owner:*` and `token:owner:*` key, then re-add the connectors you still use.

## Rotating secrets

See [setup.md § Rotating secrets](setup.md#rotating-secrets). In short:

- rotating `OWNER_PASSWORD` signs the owner out;
- rotating `SESSION_ENCRYPTION_KEY` signs the owner out **and** requires reconnecting Qasir at `/connect`;
- neither revokes OAuth tokens.

## Changing the upstream catalog

1. Update the capture doc `docs/<name>.md` (no real personal data; `tests/unit/docs-pii.test.ts` checks this).
2. Update or add the operation in `src/registry/ops/*.ts`, or add an exclusion in `src/registry/exclusions.ts`.
3. `bun run docs:bundle && bun run coverage:report && bun run check-types && bun run test && bun run coverage:validate && bun run openapi:validate`
4. `bunx wrangler deploy`
