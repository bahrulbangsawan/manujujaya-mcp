# Architecture

```
Client → /mcp (OAuth or DEV_PSK) → createMcpHandler (SDK v2, legacy:reject)
                ↓
         McpServer tools: search | execute | execute_mutation
                ↓
         DynamicWorkerExecutor (Worker Loader, globalOutbound:null)
                ↓
         Host dispatchers: QasirDispatcher (allowlist) + HTML adapters
                ↓
         QasirSessionProvider (Worker secrets) → pos/order/payment/account/merchant
```

## Modules

| Area | Path |
| --- | --- |
| Transport + auth | `src/index.ts`, `src/auth/*` |
| MCP registration | `src/mcp/*` |
| Code Mode | `src/codemode/*` |
| Registry + OpenAPI | `src/registry/*` |
| Dispatcher | `src/dispatcher/*` |
| Session | `src/session/*` |
| HTML adapters | `src/html/*` |
| Approvals DO | `src/approvals/*` |
| Observability | `src/observability/*` |

## Security controls

- Fail-closed auth; DEV_PSK never default in production vars
- Mutations off by default; DO-bound approvals (subject + operationId + args hash + expiry)
- Host allowlist only; slug from trusted config; redirect validation
- `codemode.request` rejects method/url/headers
- Secret redaction in logs; sanitized MCP doc resources
- No live writes in tests
