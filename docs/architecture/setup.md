# Setup

## Prerequisites

- Bun 1.4+
- Cloudflare account + Wrangler
- Pre-provisioned Qasir dashboard session (token + CSRF + cookies)

## Local

1. `bun install`
2. Copy `.dev.vars.example` → `.dev.vars`
3. Set wrangler var `ALLOW_DEV_PSK=true` for local only
4. `bun run dev`
5. Point an MCP client at `http://127.0.0.1:8787/mcp` with bearer DEV_PSK

## Deploy (when ready — not part of this PR)

1. `wrangler secret put …` for Qasir secrets
2. Set `ALLOW_DEV_PSK=false`, configure OAuth IdP verification
3. `wrangler deploy` (do not enable `ENABLE_MUTATIONS` until approvals UX is live)

## Qasir session notes

Dashboard sessions expire. Rotate tokens without committing them. Do not ask the model for PIN. Auth login endpoints are session-only (not Code Mode tools).
