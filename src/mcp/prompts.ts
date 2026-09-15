import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    "sales_overview",
    {
      title: "Sales overview",
      description: "Summarize sales for a date range using reports + order histories",
      argsSchema: z.object({
        start_date: z.string().describe("YYYY-MM-DD"),
        end_date: z.string().describe("YYYY-MM-DD"),
        outlet_ids: z.string().optional().describe("Outlet id CSV"),
      }),
    },
    ({ start_date, end_date, outlet_ids }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `Prepare a sales overview for ${start_date} → ${end_date}`,
              outlet_ids ? `outlet_ids=${outlet_ids}` : "outlet_ids is required by these operations; ask the user which outlet(s) to use",
              "1) search the catalog for sales report and order history operations (e.g. reports.* and order.histories.web) and read their required params",
              "2) execute small pages; aggregate totals; do not dump full catalogs",
              "3) return concise KPI bullets + notable invoices only",
            ].join("\n"),
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "trace_stock_movement",
    {
      title: "Trace stock movement",
      description: "Trace stock movements for a variant/inventory id",
      argsSchema: z.object({
        inventory_id: z.string().describe("Variant / inventory id"),
        outlet_ids: z.string().optional().describe("Outlet id CSV"),
      }),
    },
    ({ inventory_id, outlet_ids }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `Trace stock for inventory_id=${inventory_id}`,
              outlet_ids ? `outlet_ids=${outlet_ids}` : "outlet_ids is required; ask the user which outlet(s) to use",
              "Use inventories.stockHistories (requires page, count <= 100, outlet_ids and type); join sales_id to order.histories.legacy when useful",
              "Keep result to recent movements + running balance explanation",
            ].join("\n"),
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "review_purchase_orders",
    {
      title: "Review purchase orders",
      description: "Review recent purchase orders and open status",
      // .default({}) so prompts/get without `arguments` is valid (every argument is optional).
      argsSchema: z
        .object({ page: z.string().optional().describe("Page number, default 1") })
        .default({}),
    },
    ({ page }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `Review purchases page=${page ?? "1"}`,
              "Page purchases.list (count <= 100) and keep rows whose status is order_processed; call purchases.items (requires outlet_id) only for those",
              "This review is read-only: do not call purchases.confirmation or purchases.cancel",
            ].join("\n"),
          },
        },
      ],
    }),
  );
}
