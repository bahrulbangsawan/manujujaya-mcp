# MCP tools

Registered in `src/mcp/server.ts` via `createManujujayaServer`.

## Tools

| Name | Description |
| --- | --- |
| `search` | Search the sanitized Qasir API catalog via sandboxed JS. Only `codemode.spec()` is available (openapi + catalog + examples). No network. Return a small subset. Example: `async () => { const { catalog } = await codemode.spec(); return catalog.filter(o => o.tags.includes('products')).slice(0,10); }` |
| `execute` | Execute read-only sandboxed JS with `codemode.spec()` and `codemode.request({ operationId, path, query, body })`. Never pass method/url/headers. Credentials stay on the host. Example: `async () => { const r = await codemode.request({ operationId: 'products.list', query: { page: 1, count: 5 } }); return r.data; }` |
| `execute_mutation` | Gated mutations. Requires `ENABLE_MUTATIONS=true`, `qasir:write`, and a durable `approvalId` bound to subject+operationId+args hash. |

## Resources

Also registered (`src/mcp/resources.ts`):

| Name | URI | Notes |
| --- | --- | --- |
| `docs-index` | `qasir://docs/index` | Index of sanitized Qasir API docs |
| `doc-*` | `qasir://docs/{name}` | Per-doc markdown (`auth-login`, `products`, …) |
| `openapi` | `qasir://openapi` | Sanitized OpenAPI 3.1 from registry |
| `capabilities` | `qasir://capabilities` | Server capabilities / tool overview |
| `coverage` | `qasir://coverage` | API coverage manifest |

## Prompts

Also registered (`src/mcp/prompts.ts`):

| Name | Description |
| --- | --- |
| `sales_overview` | Summarize sales for a date range using reports + order histories |
| `trace_stock_movement` | Trace stock movements for a variant/inventory id |
| `review_purchase_orders` | Review recent purchase orders and open status |
