import { describe, expect, it } from "vitest";
import type { DispatchRequest } from "../../src/dispatcher/qasir-dispatcher";
import { AppError, ErrorCodes } from "../../src/errors/codes";
import {
  purchaseOrderItemsData,
  purchaseOrderItemsInput,
  purchaseOrdersData,
  purchaseOrdersPageData,
} from "../../src/widgets/contract";
import {
  PURCHASE_TOOLS,
  purchaseOrderItemsTool,
  purchaseOrdersPageTool,
  purchaseOrdersTool,
} from "../../src/widgets/tools/purchases";
import { callWidgetTool, envelope } from "../stubs/widget-harness";

const COUNT = 100;

/** Synthetic purchases.list row shaped like the verified upstream payload. */
function po(id: number, status: string): Record<string, unknown> {
  return {
    id: String(id),
    order_no: `PO-20260904${String(id).padStart(8, "0")}000001`,
    outlet_id: "645203",
    supplier_id: "1",
    supplier_name: `Pemasok ${id % 3 === 0 ? "A" : "B"}`,
    notes: "",
    total_price: 150000,
    status,
    created_at: "2026-09-04T11:54:40Z",
    updated_at: "2026-09-05T08:00:00Z",
  };
}

/**
 * purchases.list over `totalPages` pages of 100 rows. The first row of each page has
 * status `firstStatus`; the rest are completed. Pages past the end are empty.
 */
function purchasesHandler(totalPages: number, firstStatus = "order_processed") {
  return (req: DispatchRequest) => {
    const page = Number(req.query?.page);
    const rows =
      page <= totalPages
        ? Array.from({ length: COUNT }, (_, i) => po(page * 1000 + i, i === 0 ? firstStatus : "completed"))
        : [];
    return envelope(
      { purchases: rows },
      {
        current_page: page,
        page_size: COUNT,
        total_page: totalPages,
        total_result: totalPages * COUNT,
        ...(page < totalPages ? { next: `/api/v5/purchases?count=${COUNT}&page=${page + 1}` } : {}),
      },
    );
  };
}

function pagesRequested(calls: Array<{ req: DispatchRequest }>): number[] {
  return calls.map((c) => Number(c.req.query?.page));
}

describe("show_purchase_orders", () => {
  it("loads only page 1 for semua and counts statuses on it", async () => {
    const call = await callWidgetTool(purchaseOrdersTool, {}, { handlers: { "purchases.list": purchasesHandler(38) } });

    expect(call.error).toBeUndefined();
    expect(call.dispatcher.calls).toHaveLength(1);
    expect(call.dispatcher.calls[0]!.req).toEqual({
      operationId: "purchases.list",
      query: { page: 1, count: 100, outlet_ids: "645203" },
    });
    expect(call.dispatcher.calls[0]!.opts?.allowMutation).toBeUndefined();

    const data = purchaseOrdersData.parse(call.structured);
    expect(data.view).toBe("pembelian");
    expect(data.outlet_id).toBe("645203");
    expect(data.generated_at).toBe("2026-09-15T03:00:00.000Z");
    expect(data.status_filter).toBe("semua");
    expect(data.rows).toHaveLength(100);
    expect(data.scanned_rows).toBe(100);
    expect(data.total_rows).toBe(3800);
    expect(data.status_counts).toEqual({ order_processed: 1, completed: 99, canceled: 0 });
    expect(data.next_page).toBe(2);
    expect(data.truncated).toBe(false);
    expect(data.rows[0]).toEqual({
      id: "1000",
      order_no: "PO-2026090400001000000001",
      supplier: "Pemasok B",
      total: 150000,
      status: "order_processed",
      status_label: "Diproses",
      created_at: "2026-09-04T11:54:40.000Z",
    });

    expect(call.text).toContain("filter: Semua status");
    expect(call.text).toContain("Dipindai 100 PO terbaru dari 3800 PO: Diproses 1, Selesai 99, Dibatalkan 0.");
    expect(call.text).toContain("- PO-2026090400001000000001 · 4 Sep 2026 · Pemasok B · Rp 150.000 · Diproses");
    expect(call.text.split("\n").filter((l) => l.startsWith("- "))).toHaveLength(10);
    expect(call.text.length).toBeLessThanOrEqual(2000);
  });

  it("scans at most 5 pages for a specific status and points next_page past the scan", async () => {
    const call = await callWidgetTool(
      purchaseOrdersTool,
      { status: "order_processed" },
      { handlers: { "purchases.list": purchasesHandler(38) } },
    );

    expect(pagesRequested(call.dispatcher.calls)).toEqual([1, 2, 3, 4, 5]);
    const data = purchaseOrdersData.parse(call.structured);
    expect(data.status_filter).toBe("order_processed");
    expect(data.rows.map((r) => r.id)).toEqual(["1000", "2000", "3000", "4000", "5000"]);
    expect(data.rows.every((r) => r.status === "order_processed")).toBe(true);
    expect(data.scanned_rows).toBe(500);
    expect(data.status_counts).toEqual({ order_processed: 5, completed: 495, canceled: 0 });
    expect(data.next_page).toBe(6);
    expect(call.text).toContain("PO berstatus Diproses (5 dari 5):");
  });

  it("stops scanning when upstream has no next page", async () => {
    const call = await callWidgetTool(
      purchaseOrdersTool,
      { status: "canceled" },
      { handlers: { "purchases.list": purchasesHandler(2, "canceled") } },
    );

    expect(pagesRequested(call.dispatcher.calls)).toEqual([1, 2]);
    const data = purchaseOrdersData.parse(call.structured);
    expect(data.rows).toHaveLength(2);
    expect(data.scanned_rows).toBe(200);
    expect(data.status_counts).toEqual({ order_processed: 0, completed: 198, canceled: 2 });
    expect(data.next_page).toBeNull();
    expect(call.text).not.toContain("Masih ada PO");
  });

  it("reports when no scanned PO has the requested status", async () => {
    const call = await callWidgetTool(
      purchaseOrdersTool,
      { status: "canceled" },
      { handlers: { "purchases.list": purchasesHandler(1, "completed") } },
    );

    const data = purchaseOrdersData.parse(call.structured);
    expect(data.rows).toEqual([]);
    expect(data.next_page).toBeNull();
    expect(call.text).toContain("Tidak ada PO berstatus Dibatalkan di PO yang dipindai.");
  });

  it("keeps unknown statuses and drops rows without an id", async () => {
    const call = await callWidgetTool(purchaseOrdersTool, {}, {
      handlers: {
        "purchases.list": () =>
          envelope({ purchases: [po(1, "draft"), { ...po(2, "completed"), id: "" }, po(3, "completed")] }, { current_page: 1, total_result: 3 }),
      },
    });

    const data = purchaseOrdersData.parse(call.structured);
    expect(data.rows.map((r) => [r.id, r.status_label])).toEqual([
      ["1", "draft"],
      ["3", "Selesai"],
    ]);
    expect(data.status_counts).toEqual({ order_processed: 0, completed: 1, canceled: 0, draft: 1 });
    expect(data.next_page).toBeNull();
  });

  it("uses the input outlet_id instead of the session outlet", async () => {
    const call = await callWidgetTool(purchaseOrdersTool, { outlet_id: "777" }, { handlers: { "purchases.list": purchasesHandler(1) } });

    expect(call.dispatcher.calls[0]!.req.query).toEqual({ page: 1, count: 100, outlet_ids: "777" });
    expect(purchaseOrdersData.parse(call.structured).outlet_id).toBe("777");
  });

  it("returns the upstream error as {code,message} JSON", async () => {
    const call = await callWidgetTool(purchaseOrdersTool, {}, {
      handlers: {
        "purchases.list": () => {
          throw new AppError(ErrorCodes.QASIR_RATE_LIMITED, "Qasir rate limit");
        },
      },
    });

    expect(call.result.isError).toBe(true);
    expect(call.error).toEqual({ code: "QASIR_RATE_LIMITED", message: "Qasir rate limit" });
    expect(call.structured).toBeUndefined();
  });
});

describe("purchase_orders_page", () => {
  it("loads the requested page unfiltered", async () => {
    const call = await callWidgetTool(purchaseOrdersPageTool, { page: 3 }, { handlers: { "purchases.list": purchasesHandler(3) } });

    expect(call.dispatcher.calls.map((c) => c.req.query)).toEqual([{ page: 3, count: 100, outlet_ids: "645203" }]);
    const data = purchaseOrdersPageData.parse(call.structured);
    expect(data.page).toBe(3);
    expect(data.rows).toHaveLength(100);
    expect(data.rows[0]!.status).toBe("order_processed");
    expect(data.next_page).toBeNull();
    expect(call.text).toBe("Halaman 3 PO: 100 PO.\nTidak ada halaman berikutnya.");
  });

  it("returns next_page when upstream has more", async () => {
    const call = await callWidgetTool(purchaseOrdersPageTool, { page: 2 }, { handlers: { "purchases.list": purchasesHandler(38) } });

    expect(purchaseOrdersPageData.parse(call.structured).next_page).toBe(3);
  });

  it("trims rows from the tail to keep structuredContent under 250,000 chars", async () => {
    const wide = Array.from({ length: 100 }, (_, i) => ({ ...po(i + 1, "completed"), supplier_name: `Pemasok ${"x".repeat(3000)}` }));
    const call = await callWidgetTool(purchaseOrdersPageTool, { page: 1 }, {
      handlers: { "purchases.list": () => envelope({ purchases: wide }, { current_page: 1, total_result: 100 }) },
    });

    const data = purchaseOrdersPageData.parse(call.structured);
    expect(data.truncated).toBe(true);
    expect(data.truncated_reason).toBe("Baris terakhir dipangkas karena hasil melebihi 250 KB.");
    expect(data.rows.length).toBeGreaterThan(0);
    expect(data.rows.length).toBeLessThan(100);
    expect(data.rows[0]!.id).toBe("1");
    expect(JSON.stringify(call.structured).length).toBeLessThanOrEqual(250_000);
  });
});

describe("purchase_order_items", () => {
  const items = [
    {
      id: "1",
      product_id: "10",
      variant_id: "20",
      product_name: "Kampas Rem Depan",
      variant_name: "Tipe X",
      quantity: 10,
      receive_quantity: 8,
      price_unit: 163200,
      price_base: 163200,
      price_sell: 350000,
      unit_label_name: "Set",
    },
    {
      id: "2",
      product_id: "11",
      variant_id: "21",
      product_name: "Oli Mesin 1L",
      variant_name: "",
      quantity: 2.5,
      receive_quantity: 0,
      price_base: 40000,
      price_sell: 55000,
      unit_label_name: "Liter",
    },
  ];

  it("passes purchase_id in the path and outlet_id as an integer", async () => {
    const call = await callWidgetTool(purchaseOrderItemsTool, { purchase_id: "1147217" }, {
      handlers: { "purchases.items": () => envelope({ purchase_items: items }) },
    });

    expect(call.dispatcher.calls).toHaveLength(1);
    expect(call.dispatcher.calls[0]!.req).toEqual({
      operationId: "purchases.items",
      path: { purchase_id: "1147217" },
      query: { outlet_id: 645203 },
    });

    const data = purchaseOrderItemsData.parse(call.structured);
    expect(data.purchase_id).toBe("1147217");
    expect(data.items).toEqual([
      { product: "Kampas Rem Depan", variant: "Tipe X", quantity: 10, received: 8, unit: "Set", price: 163200, subtotal: 1632000 },
      { product: "Oli Mesin 1L", variant: "", quantity: 2.5, received: 0, unit: "Liter", price: 40000, subtotal: 100000 },
    ]);
    expect(data.total).toBe(1732000);
    expect(call.text).toContain("Rincian PO 1147217: 2 item, total Rp 1.732.000.");
    expect(call.text).toContain("- Kampas Rem Depan (Tipe X): dipesan 10, diterima 8 Set × Rp 163.200 = Rp 1.632.000");
  });

  it("returns an empty list when the PO has no items", async () => {
    const call = await callWidgetTool(purchaseOrderItemsTool, { purchase_id: "5", outlet_id: "777" }, {
      handlers: { "purchases.items": () => envelope({ purchase_items: [] }) },
    });

    expect(call.dispatcher.calls[0]!.req.query).toEqual({ outlet_id: 777 });
    const data = purchaseOrderItemsData.parse(call.structured);
    expect(data.items).toEqual([]);
    expect(data.total).toBe(0);
  });

  it("rejects non-numeric purchase ids before dispatch", () => {
    expect(purchaseOrderItemsInput.safeParse({ purchase_id: "../1" }).success).toBe(false);
    expect(purchaseOrderItemsInput.safeParse({ purchase_id: "0" }).success).toBe(false);
  });
});

describe("purchase tool definitions", () => {
  it("exports the three tools with their budgets and description rules", () => {
    expect(PURCHASE_TOOLS.map((t) => [t.name, t.maxRequests, t.view ?? null])).toEqual([
      ["show_purchase_orders", 5, "pembelian"],
      ["purchase_orders_page", 1, null],
      ["purchase_order_items", 1, null],
    ]);
    expect(purchaseOrdersTool.description.startsWith("Open an interactive")).toBe(true);
    expect(purchaseOrdersTool.description.length).toBeLessThanOrEqual(600);
    for (const tool of [purchaseOrdersPageTool, purchaseOrderItemsTool]) {
      expect(tool.description.startsWith("Widget helper:")).toBe(true);
      expect(tool.description.length).toBeLessThanOrEqual(300);
    }
  });
});
