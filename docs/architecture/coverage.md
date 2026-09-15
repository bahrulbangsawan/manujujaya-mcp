# API coverage

Generated from the typed operation registry + explicit exclusion list.

Run:

```bash
bun run coverage:validate
bun run openapi:validate
```

## Policy

- Endpoint-specific docs win over `routes.md`
- Failed probes → `excluded` (not executable)
- Auth login → `session-only`
- HTML-only suppliers / stock-adjustment history → `html-adapter`
- Mutations → `mutation-gated` (disabled by default)

Sample merchant IDs in capture docs are examples only and are not defaults for tool calls (outlet may be supplied by the caller; merchant origin always comes from `MERCHANT_SLUG`).
