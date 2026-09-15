import { describe, expect, it } from "vitest";
import {
  APP_TOOL,
  TOOL_SCHEMAS,
  VIEW_TOOL,
  VIEWS,
  WIDGET_TOOL_NAMES,
  salesStatusLabel,
  poStatusLabel,
  stockMovementLabel,
  transactionsPageInput,
  viewResourceUri,
} from "../../src/widgets/contract";

describe("widget contract", () => {
  it("names every tool exactly once and gives each a schema pair", () => {
    expect(new Set(WIDGET_TOOL_NAMES).size).toBe(15);
    expect(Object.keys(TOOL_SCHEMAS).sort()).toEqual([...WIDGET_TOOL_NAMES].sort());
    expect(Object.keys(VIEW_TOOL)).toEqual([...VIEWS]);
    expect(Object.values(APP_TOOL)).toHaveLength(9);
  });

  it("builds ui:// URIs that survive URL normalization", () => {
    for (const view of VIEWS) {
      const uri = viewResourceUri(view);
      expect(new URL(uri).href).toBe(uri);
    }
  });

  it("maps status codes to Indonesian labels with a fallback", () => {
    expect(salesStatusLabel(2)).toBe("Selesai");
    expect(salesStatusLabel(3)).toBe("Refund");
    expect(salesStatusLabel(6)).toBe("Refund sebagian");
    expect(salesStatusLabel(9)).toBe("Status 9");
    expect(poStatusLabel("order_processed")).toBe("Diproses");
    expect(poStatusLabel("weird")).toBe("weird");
    expect(stockMovementLabel("adjustment-minus")).toBe("Penyesuaian −");
  });

  it("bounds inputs", () => {
    const ok = { start_date: "2026-09-01", end_date: "2026-09-07", page: 1 };
    expect(transactionsPageInput.safeParse(ok).success).toBe(true);
    expect(transactionsPageInput.safeParse({ ...ok, page: 501 }).success).toBe(false);
    expect(transactionsPageInput.safeParse({ ...ok, start_date: "01-09-2026" }).success).toBe(false);
    expect(transactionsPageInput.safeParse({ ...ok, outlet_id: "0645203" }).success).toBe(false);
    expect(transactionsPageInput.safeParse({ ...ok, customer_id: -1 }).success).toBe(false);
  });

  it("strips unknown output fields instead of failing (additive contract)", () => {
    const parsed = TOOL_SCHEMAS.order_detail.output.parse({
      outlet_id: "1",
      generated_at: "2026-09-15T00:00:00.000Z",
      truncated: false,
      truncated_reason: null,
      sales_id: 1,
      invoice: "INV",
      status: 2,
      status_label: "Selesai",
      settled_at: null,
      total_bill: 0,
      total_paid: 0,
      change: 0,
      items: [],
      payments: [],
      customer: null,
      credit: null,
      cashier: null,
      future_field: true,
    });
    expect("future_field" in parsed).toBe(false);
  });
});
