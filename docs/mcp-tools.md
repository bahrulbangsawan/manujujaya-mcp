# MCP tools, resources and prompts

Registered per request in `src/mcp/server.ts` (`createManujujayaServer`). Capabilities are `tools`, `resources` and `prompts`, all with `listChanged: false`. The server is stateless and never sends notifications.

## Tools

| Tool | Scope | When listed | Annotations |
| --- | --- | --- | --- |
| `search` | `qasir:read` | Always | readOnly, idempotent, closed world |
| `execute` | `qasir:read` | Always | readOnly, open world |
| `execute_mutation` | `qasir:write` | Only if `ENABLE_MUTATIONS=true` **and** the token has `qasir:write` (or `qasir:admin`) | destructive, open world |

`search` and `execute` take one argument: `{ "code": string }` (1–20,000 characters). It must be an async arrow function, for example `async () => { ...; return value; }`. Whatever it returns is serialized as JSON and becomes the tool text. Return small, already-filtered values.

### `search`: find operations (no network)

The sandbox has only `codemode.spec()`. It resolves to:

- `catalog`: one entry per exposed operation, with fields `{ operationId, title, description, method, host, path, safety, auth, responseKind, tags, evidence, sourceDocument, inputKeys }`;
- `openapi`: the sanitized OpenAPI 3.1 document, with full input schemas;
- `examples`: example search functions.

```js
async () => {
  const { catalog } = await codemode.spec();
  return catalog
    .filter((o) => o.tags.includes("reports") && o.safety === "read")
    .map((o) => ({ id: o.operationId, inputs: o.inputKeys }));
}
```

```js
async () => {
  const { openapi } = await codemode.spec();
  return openapi.paths["/api/v5/purchases"];   // full parameter schema for one path
}
```

### `execute`: read live data

The sandbox has `codemode.spec()` plus `codemode.request({ operationId, path?, query?, body? })`. A call resolves to `{ operationId, status, data }`.

```js
async () => {
  const r = await codemode.request({ operationId: "products.list", query: { page: 1, count: 20 } });
  return r.data;
}
```

```js
async () => {
  // pagination + aggregation inside the sandbox; only the summary leaves
  const open = [];
  for (let page = 1; page <= 5; page++) {
    const r = await codemode.request({ operationId: "purchases.list", query: { page, count: 50 } });
    for (const po of r.data?.data?.purchases ?? []) {
      if (po.status === "order_processed") open.push({ id: po.id, total: po.total_price, status: po.status });
    }
    if (page >= (r.data?.pagination?.total_page ?? 1)) break;
  }
  return { open: open.length, sample: open.slice(0, 10) };
}
```

Rules enforced on the host:

- **Registered operations only.** Only exposed operations with `safety: "read"` are allowed. Write or destructive ones get `MUTATION_DISABLED`; unknown ids get `UNSUPPORTED_OPERATION`.
- **Allowed request keys:** `operationId`, `path`, `query` and `body`. `method`, `url`, `headers` or anything else gets `INVALID_INPUT`. `path` values must be strings or numbers; `query` values may also be booleans.
- **Validation:** input is checked against the operation schema before any upstream call. Required keys, types and unknown keys are reported together. Page-size keys (`count`, `limit`, `per_page`) are capped at 100, and paging keys must be ≥ 1.
- **No network from the sandbox.** `fetch()` and sockets fail because the isolate has `globalOutbound: null` and no bindings.
- **HTML operations:** `suppliers.listHtml` and `stockAdjustment.historyHtml` return parsed rows plus paging info, not raw HTML.

### Limits (per `search` / `execute` call)

| Limit | Value | Error when exceeded |
| --- | --- | --- |
| `codemode.request()` calls | 50 | `RESULT_LIMIT_EXCEEDED` (terminal for the run) |
| Concurrent upstream requests | 4 (extra calls wait) | — |
| Total response size handed to the sandbox | ~5 MB (5,000,000 JSON characters) | `RESULT_LIMIT_EXCEEDED` |
| Single upstream body | 2 MB | `RESULT_LIMIT_EXCEEDED` |
| Wall clock | 30 s for the whole script (25 s per upstream request) | `UPSTREAM_TIMEOUT` |
| Sandbox CPU | 10 s (requested on the isolate) | Run fails |
| `codemode.spec()` calls | 20 | `RESULT_LIMIT_EXCEEDED` |
| Tool output | ~6,000 tokens (~24,000 characters); larger values are truncated structurally, then hard-capped | — (truncated, not an error) |

Hitting a limit aborts the run. A script cannot catch the error and keep going. `qasir://capabilities` returns the live values.

### `execute_mutation`: approved changes (two calls)

This tool takes no code. Input: `{ operationId, path?, query?, body?, approvalId? }`. Mutating operations today are `purchases.confirmation` (write), `purchases.cancel` (destructive, even though it is a GET) and `products.inventories.bulk` (destructive).

1. **First call, without `approvalId`.** The input is validated, and a pending approval is stored with the SHA-256 of `{ operationId, normalized path, query, body }`. The call returns an error result:

   ```json
   { "code": "APPROVAL_REQUIRED", "approvalId": "…uuid…", "approvalUrl": "https://mcp.manujujaya.com/approvals/…",
     "expiresAt": "…", "preview": { "operationId": "purchases.cancel", "method": "GET", "path": { "id": 123 }, … },
     "next": "Ask the owner to open approvalUrl, approve, then call execute_mutation again with the same arguments and approvalId" }
   ```

2. **The owner opens `approvalUrl`.** This requires the owner cookie; `/login` comes first if needed. The owner reviews the operation, safety class, method/host/path and redacted arguments, then chooses **Approve once** or **Reject**.
3. **Second call, with identical `operationId`/`path`/`query`/`body` plus `approvalId`.** The approval is consumed atomically and the operation is dispatched once. The result is `{ executionId, operationId, status, data }`.

The second call fails with `APPROVAL_REQUIRED` if the approval is pending, rejected, already consumed, expired (after 10 minutes), belongs to another subject, or the arguments hash differs. A write that gets a redirect is **not** retried: `REDIRECT_NOT_ALLOWED` warns that the change may or may not have been applied.

To enable mutations, see [operations.md § Enabling mutations](architecture/operations.md#enabling-mutations).

## Error codes

Tool errors are `isError: true` results with a JSON text body `{ "code", "message" }`. Only the code and message leave the server.

| Code | Typical cause | What to do |
| --- | --- | --- |
| `INVALID_INPUT` | Schema validation (missing/unknown/mistyped keys, page size > 100), bad `request()` shape, script syntax error or thrown exception, non-serializable return | Fix the arguments listed in the message; check `inputKeys` / OpenAPI via `search` |
| `UNAUTHORIZED` / `FORBIDDEN` | Token lacks the scope; upstream `403` (role/outlet) | Re-authorize with the right scope; check Qasir staff permissions |
| `QASIR_AUTH_EXPIRED` | No stored session, upstream `401`/`419`, sign-in redirect or sign-in HTML | Owner reconnects at `/connect` |
| `QASIR_RATE_LIMITED` | Upstream `429` | Wait; issue fewer requests |
| `UPSTREAM_TIMEOUT` | Run over 30 s, or an upstream request over 25 s | Smaller pages, fewer calls |
| `UPSTREAM_ERROR` | Upstream 4xx/5xx or non-JSON body | Retry later; the endpoint may have changed |
| `UNSUPPORTED_OPERATION` | Unknown or unexposed `operationId` | Use `search` |
| `MUTATION_DISABLED` | Write op via `execute`, or `ENABLE_MUTATIONS` is not true | Use `execute_mutation` if enabled |
| `APPROVAL_REQUIRED` | Mutation needs, or failed, approval | Follow `approvalUrl`, retry with identical arguments |
| `RESULT_LIMIT_EXCEEDED` | Request, spec, response or body budget hit | Fewer or smaller pages; aggregate before returning |
| `HOST_NOT_ALLOWED` / `REDIRECT_NOT_ALLOWED` | Allowlist or redirect policy refused a URL | Not fixable by the caller; report it |

## Resources

| URI | MIME | Content |
| --- | --- | --- |
| `qasir://docs/index` | JSON | `{ documents: [{ name, uri }] }` for the 13 API docs |
| `qasir://docs/{document}` (template) | Markdown | One API doc (`auth-login`, `customers`, `inventories-stock-histories`, `order-histories-installment`, `order-histories-legacy`, `order-histories-web`, `products`, `purchases`, `reports`, `routes`, `stock-adjustment`, `suppliers`, `users`). Sanitized at read time: UUIDs, emails, phone numbers and person fields are redacted. The template's list callback also puts all 13 in `resources/list` |
| `qasir://openapi` | JSON | OpenAPI 3.1 generated from the registry (no credentials) |
| `qasir://capabilities` | JSON | Protocol, tools registered **for this token**, operation counts by safety, mutation policy, Code Mode limits |
| `qasir://coverage` | JSON | Coverage summary plus every manifest entry (see [coverage.md](architecture/coverage.md)) |

## Prompts

| Name | Arguments | Guides the model to |
| --- | --- | --- |
| `sales_overview` | `start_date`, `end_date` (YYYY-MM-DD), optional `outlet_ids` (CSV) | Use `reports.summaries.sales` + `order.histories.web` with small pages and return KPI bullets |
| `trace_stock_movement` | `inventory_id`, optional `outlet_ids` | Use `inventories.stockHistories`, joining `sales_id` to `order.histories.legacy` |
| `review_purchase_orders` | optional `page` | Use `purchases.list` + `purchases.items` for open POs; never confirm or cancel |

`outlet_ids` is not filled in automatically. The server does not expose `DEFAULT_OUTLET_ID` to the model, so pass the outlet id when an operation requires it.
