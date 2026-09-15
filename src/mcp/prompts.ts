import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    "sales_overview",
    {
      description: "Summarize sales for a date range using reports + order histories",
      argsSchema: {
        start_date: z.string().describe("YYYY-MM-DD"),
        end_date: z.string().describe("YYYY-MM-DD"),
        outlet_ids: z.string().optional().describe("Outlet id CSV"),
      },
    },
    ({ start_date, end_date, outlet_ids }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `Prepare a sales overview for ${start_date} → ${end_date}`,
              outlet_ids ? `outlet_ids=${outlet_ids}` : "use default outlet",
              "1) search for reports.summaries.sales and order.histories.web",
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
      description: "Trace stock movements for a variant/inventory id",
      argsSchema: {
        inventory_id: z.string().describe("Variant / inventory id"),
        outlet_ids: z.string().optional(),
      },
    },
    ({ inventory_id, outlet_ids }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `Trace stock for inventory_id=${inventory_id}`,
              outlet_ids ? `outlet_ids=${outlet_ids}` : "use default outlet",
              "Use inventories.stockHistories; join sales_id to order.histories.legacy when useful",
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
      description: "Review recent purchase orders and open status",
      argsSchema: {
        page: z.string().optional().describe("Page number, default 1"),
      },
    },
    ({ page }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `Review purchases page=${page ?? "1"}`,
              "Call purchases.list then purchases.items for open/order_processed POs only",
              "Never call purchases.confirmation or purchases.cancel unless explicitly approved",
            ].join("\n"),
          },
        },
      ],
    }),
  );
}
