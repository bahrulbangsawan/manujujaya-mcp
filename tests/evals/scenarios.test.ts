import { describe, expect, it } from "vitest";
import { buildOperationCatalog } from "../../src/registry/openapi";
import { getOperation } from "../../src/registry/operations";

/**
 * Code Mode eval scenarios (offline): verify catalog supports the intended workflows.
 * Live Qasir / WorkerLoader sandboxes are not invoked here.
 */
const scenarios = [
  { name: "find product ops", query: "products", need: "products.list" },
  { name: "stock movement", query: "stock histories", need: "inventories.stockHistories" },
  { name: "sales overview", query: "reports summaries sales", need: "reports.summaries.sales" },
  { name: "order detail", query: "legacy order", need: "order.histories.legacy" },
  { name: "purchases review", query: "purchases", need: "purchases.list" },
  { name: "suppliers html", query: "suppliers html", need: "suppliers.listHtml" },
  { name: "stock turnover", query: "stock-turnover", need: "inventories.stockTurnover" },
  { name: "users staff", query: "users", need: "users.list" },
  { name: "customer get", query: "customers", need: "customers.get" },
  { name: "mutation gated", query: "bulk inventories", need: "products.inventories.bulk" },
];

describe("code mode eval scenarios (catalog)", () => {
  const catalog = buildOperationCatalog();
  for (const s of scenarios) {
    it(s.name, () => {
      const hits = catalog.filter((o) =>
        JSON.stringify(o).toLowerCase().includes(s.query.split(" ")[0]!.toLowerCase()),
      );
      expect(hits.length).toBeGreaterThan(0);
      expect(getOperation(s.need)).toBeTruthy();
    });
  }
});
