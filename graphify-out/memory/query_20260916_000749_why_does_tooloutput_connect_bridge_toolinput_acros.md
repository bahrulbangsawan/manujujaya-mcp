---
type: "query"
date: "2026-09-16T00:07:49.337258+00:00"
question: "Why does ToolOutput connect Bridge Toolinput across 17 different widget, route, and fixture communities?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["ToolOutput", "ToolInput", "useToolQuery()", "PembelianPage()"]
---

# Q: Why does ToolOutput connect Bridge Toolinput across 17 different widget, route, and fixture communities?

## Answer

Expanded from original query via vocab: ['tool', 'output', 'bridge', 'input', 'widget', 'route', 'fixture', 'connect']. ToolOutput (src/widgets/contract.ts:L478) is the TypeScript discriminated union type inferred from TOOL_SCHEMAS for all MCP widget tools. It acts as the shared single source of truth across the entire system: backend server tools (sales, stock, purchases, debts, transactions), frontend bridge runtime (bridge.ts, extAppsBridge.ts, mockBridge.ts, useToolQuery.ts), all React route screens (penjualan, pembelian, piutang, produk, stok, transaksi), UI components (OrderDetailSheet), and development test fixtures.

## Outcome

- Signal: useful

## Source Nodes

- ToolOutput
- ToolInput
- useToolQuery()
- PembelianPage()