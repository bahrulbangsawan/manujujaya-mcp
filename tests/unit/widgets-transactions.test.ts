import { describe, expect, it } from "vitest";
import type { DispatchRequest } from "../../src/dispatcher/qasir-dispatcher";
import { AppError, ErrorCodes } from "../../src/errors/codes";
import { orderDetailData, orderDetailInput, transactionsData, transactionsPageData } from "../../src/widgets/contract";
import {
  TRANSACTION_TOOLS,
  orderDetailTool,
  transactionsPageTool,
  transactionsTool,
} from "../../src/widgets/tools/transactions";
import { callWidgetTool, envelope } from "../stubs/widget-harness";

/** Synthetic order.histories.web item (staff and outlet names included so the test proves they are dropped). */
function sale(salesId: number, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sales_id: salesId,
    status: 2,
    date_time: "10:15",
    invoice_number: `INV${salesId}`,
    outlet_name: "Toko Contoh",
    settle_by: "Kasir Contoh  ",
    payment_mode: "CASH",
    amount: 100000,
    sales_type_name: "",
    ...over,
  };
}

const WEB_DATA = {
  // data.agg deliberately disagrees with the rows: it must never be used.
  agg: { total_items: 999, total_amount: 1 },
  sales: [
    {
      date: "2026-09-15",
      daily_amount: 450000,
      items: [
        sale(11, { amount: 250000, payment_mode: "QRIS", date_time: "17:54" }),
        sale(12, { amount: 200000 }),
        sale(13, { status: 3, amount: 75000 }),
      ],
    },
    {
      date: "2026-09-14",
      daily_amount: 284000,
      items: [sale(21, { status: 6, amount: 284000, payment_mode: "QRIS" }), sale(22, { status: 6, amount: 0 })],
    },
    { date: "", daily_amount: 5, items: [sale(99)] },
  ],
};

function webHandler(pagination: Record<string, unknown> | undefined, data: Record<string, unknown> = WEB_DATA) {
  return () => envelope(data, pagination);
}

const MORE = { current_page: 1, page_size: 100, total_page: 3, total_result: 250, next: "/api/v5/order/histories/web?page=2" };
const LAST = { current_page: 3, page_size: 100, total_page: 3, total_result: 250 };

describe("show_transactions", () => {
  it("loads web histories page 1 and summarizes loaded rows without data.agg", async () => {
    const call = await callWidgetTool(
      transactionsTool,
      { start_date: "2026-09-14", end_date: "2026-09-15" },
      { handlers: { "order.histories.web": webHandler(MORE) } },
    );

    expect(call.error).toBeUndefined();
    expect(call.dispatcher.calls.map((c) => c.req)).toEqual([
      {
        operationId: "order.histories.web",
        query: { page: 1, count: 100, start_date: "2026-09-14", end_date: "2026-09-15", outlet_ids: "645203" },
      },
    ]);

    const data = transactionsData.parse(call.structured);
    expect(data.view).toBe("transaksi");
    expect(data.outlet_id).toBe("645203");
    expect(data.range).toEqual({ start_date: "2026-09-14", end_date: "2026-09-15" });
    expect(data.customer).toBeNull();
    expect(data.days.map((d) => [d.date, d.daily_amount, d.items.length])).toEqual([
      ["2026-09-15", 450000, 3],
      ["2026-09-14", 284000, 2],
    ]);
    expect(data.days[0]!.items[0]).toEqual({
      sales_id: 11,
      time: "17:54",
      invoice: "INV11",
      payment_mode: "QRIS",
      amount: 250000,
      status: 2,
      status_label: "Selesai",
      sales_type: "",
    });
    expect(data.days[0]!.items[2]!.status_label).toBe("Refund");
    expect(data.days[1]!.items[0]!.status_label).toBe("Refund sebagian");
    expect(data.total_transactions).toBe(250);
    expect(data.loaded_transactions).toBe(5);
    // 250000 + 200000 + 284000 + 0; the status-3 row (75000) is excluded.
    expect(data.loaded_amount).toBe(734000);
    expect(data.payment_mode_totals).toEqual([
      { payment_mode: "QRIS", count: 2, amount: 534000 },
      { payment_mode: "CASH", count: 3, amount: 200000 },
    ]);
    expect(data.next_page).toBe(2);
    expect(data.truncated).toBe(false);

    const json = JSON.stringify(call.structured);
    expect(json).not.toContain("Kasir Contoh");
    expect(json).not.toContain("Toko Contoh");
    expect(json).not.toContain("999");

    expect(call.text).toContain("Transaksi 14 Sep 2026 – 15 Sep 2026 · outlet 645203");
    expect(call.text).toContain("Jumlah transaksi: 250.");
    expect(call.text).toContain("Baris dimuat: 5 transaksi, Rp 734.000 (tanpa refund penuh).");
    expect(call.text).toContain("- QRIS: 2 transaksi · Rp 534.000");
    expect(call.text).toContain("Masih ada transaksi lain");
  });

  it("filters by customer and fetches the customer name without putting it in the text", async () => {
    const call = await callWidgetTool(
      transactionsTool,
      { start_date: "2026-09-15", end_date: "2026-09-15", customer_id: 5001, outlet_id: "777" },
      {
        handlers: {
          "order.histories.web": webHandler(LAST),
          "customers.get": () => envelope({ customer: { id: 5001, fullname: "Pelanggan A", mobile: "0800-0000-0001" } }),
        },
      },
    );

    const web = call.dispatcher.calls.find((c) => c.req.operationId === "order.histories.web")!;
    expect(web.req.query).toEqual({
      page: 1,
      count: 100,
      start_date: "2026-09-15",
      end_date: "2026-09-15",
      outlet_ids: "777",
      customer_id: 5001,
    });
    const customer = call.dispatcher.calls.find((c) => c.req.operationId === "customers.get")!;
    expect(customer.req.path).toEqual({ customer_id: 5001 });

    const data = transactionsData.parse(call.structured);
    expect(data.customer).toEqual({ id: 5001, name: "Pelanggan A" });
    expect(data.next_page).toBeNull();
    expect(JSON.stringify(call.structured)).not.toContain("0800-0000-0001");
    expect(call.text).toContain("Transaksi 15 Sep 2026 · outlet 777 · pelanggan #5001");
    expect(call.text).not.toContain("Pelanggan A");
    expect(call.text).not.toContain("Masih ada transaksi lain");
  });

  it("keeps the list when customers.get fails upstream", async () => {
    const call = await callWidgetTool(
      transactionsTool,
      { start_date: "2026-09-15", end_date: "2026-09-15", customer_id: 5002 },
      {
        handlers: {
          "order.histories.web": webHandler(LAST),
          "customers.get": () => {
            throw new AppError(ErrorCodes.UPSTREAM_ERROR, "Upstream 404");
          },
        },
      },
    );

    const data = transactionsData.parse(call.structured);
    expect(data.customer).toEqual({ id: 5002, name: null });
    expect(data.loaded_transactions).toBe(5);
  });

  it("fails the call when customers.get reports an expired session", async () => {
    const call = await callWidgetTool(
      transactionsTool,
      { start_date: "2026-09-15", end_date: "2026-09-15", customer_id: 5002 },
      {
        handlers: {
          "order.histories.web": webHandler(LAST),
          "customers.get": () => {
            throw new AppError(ErrorCodes.QASIR_AUTH_EXPIRED, "Qasir session expired");
          },
        },
      },
    );

    expect(call.error).toEqual({
      code: "QASIR_AUTH_EXPIRED",
      message: "Qasir session expired",
      connect_url: "https://mcp.example.test/connect",
    });
  });

  it("reports an empty range", async () => {
    const call = await callWidgetTool(
      transactionsTool,
      { start_date: "2026-09-15", end_date: "2026-09-15" },
      { handlers: { "order.histories.web": webHandler({ current_page: 1, page_size: 100, total_page: 0, total_result: 0 }, { agg: {}, sales: [] }) } },
    );

    const data = transactionsData.parse(call.structured);
    expect(data.days).toEqual([]);
    expect(data.loaded_amount).toBe(0);
    expect(data.payment_mode_totals).toEqual([]);
    expect(data.next_page).toBeNull();
    expect(call.text).toContain("Tidak ada transaksi pada rentang ini.");
  });

  it("rejects ranges over 366 days before any dispatch", async () => {
    const call = await callWidgetTool(
      transactionsTool,
      { start_date: "2025-09-14", end_date: "2026-09-15" },
      { handlers: { "order.histories.web": webHandler(LAST) } },
    );

    expect(call.error?.code).toBe("INVALID_INPUT");
    expect(call.dispatcher.calls).toHaveLength(0);
  });
});

describe("transactions_page", () => {
  it("loads the requested page with the same filters", async () => {
    const call = await callWidgetTool(
      transactionsPageTool,
      { start_date: "2026-09-01", end_date: "2026-09-15", customer_id: 5001, page: 3 },
      { handlers: { "order.histories.web": webHandler(LAST) } },
    );

    expect(call.dispatcher.calls.map((c) => c.req.query)).toEqual([
      { page: 3, count: 100, start_date: "2026-09-01", end_date: "2026-09-15", outlet_ids: "645203", customer_id: 5001 },
    ]);
    const data = transactionsPageData.parse(call.structured);
    expect(data.page).toBe(3);
    expect(data.days).toHaveLength(2);
    expect(data.next_page).toBeNull();
    expect(call.text).toBe("Halaman 3 transaksi 1 Sep 2026 – 15 Sep 2026: 5 transaksi, Rp 734.000 (tanpa refund penuh).\nTidak ada halaman berikutnya.");
  });

  it("returns next_page while upstream has a next link", async () => {
    const call = await callWidgetTool(
      transactionsPageTool,
      { start_date: "2026-09-01", end_date: "2026-09-15", page: 2 },
      { handlers: { "order.histories.web": webHandler({ ...MORE, current_page: 2 }) } },
    );

    expect(transactionsPageData.parse(call.structured).next_page).toBe(3);
  });

  it("rejects a reversed range", async () => {
    const call = await callWidgetTool(
      transactionsPageTool,
      { start_date: "2026-09-15", end_date: "2026-09-01", page: 1 },
      { handlers: { "order.histories.web": webHandler(LAST) } },
    );

    expect(call.error?.code).toBe("INVALID_INPUT");
    expect(call.dispatcher.calls).toHaveLength(0);
  });
});

/** Synthetic order.histories.legacy `data.sales`, shaped like the verified payload. */
function legacySale(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 1077271206,
    status: 2,
    status_refund: 1,
    invoice_number: "65715HNN",
    total_bill: "220000.00",
    total_paid: 250000,
    money_change: 30000,
    settled_at: "2026-09-14 15:35:25",
    outlet_id: 645203,
    is_installment_completed: false,
    created_by_name: "Kasir Cadangan ",
    customer: { id: 2001, name: "Pelanggan A", mobile: "0800-0000-0001", email: "" },
    carts: [
      {
        id: 1,
        price_sell: 220000,
        price_sell_unit: 110000,
        quantity: 2,
        total: 220000,
        variant: { id: 3, variant_name: "", product: { id: 4, name: "Kampas Rem Depan", category_id: 5 } },
      },
      {
        id: 2,
        price_sell: 15000,
        quantity: 1.5,
        total: 22500,
        variant: { id: 6, variant_name: "Tipe X", product: { id: 7, name: "Oli Mesin 1L", category_id: 5 } },
      },
    ],
    payments: [{ payment_mode: "CASH", payment_name: "TUNAI", amount: 250000, paid_date: "2026-09-14 15:35:25" }],
    user_settled: { id: 9, name: "Kasir Contoh ", title: "" },
    installment: { period: "0", unit: "", date: "", total_installment: 220000, remaining_debt: -30000 },
    ...over,
  };
}

function legacyHandler(sales: Record<string, unknown>) {
  return (req: DispatchRequest) => envelope({ sales: { ...sales, id: Number(req.path?.sales_id) } });
}

describe("order_detail", () => {
  it("projects a paid sale and never reports credit outside status 4", async () => {
    const call = await callWidgetTool(orderDetailTool, { sales_id: 1077271206 }, {
      handlers: { "order.histories.legacy": legacyHandler(legacySale()) },
    });

    expect(call.dispatcher.calls.map((c) => c.req)).toEqual([
      { operationId: "order.histories.legacy", path: { sales_id: 1077271206 } },
    ]);
    const data = orderDetailData.parse(call.structured);
    expect(data).toEqual({
      outlet_id: "645203",
      generated_at: "2026-09-15T03:00:00.000Z",
      truncated: false,
      truncated_reason: null,
      sales_id: 1077271206,
      invoice: "65715HNN",
      status: 2,
      status_label: "Selesai",
      settled_at: "2026-09-14T08:35:25.000Z",
      total_bill: 220000,
      total_paid: 250000,
      change: 30000,
      items: [
        { product: "Kampas Rem Depan", variant: null, quantity: 2, price: 110000, total: 220000 },
        { product: "Oli Mesin 1L", variant: "Tipe X", quantity: 1.5, price: 15000, total: 22500 },
      ],
      payments: [{ name: "TUNAI", mode: "CASH", amount: 250000, paid_at: "2026-09-14T08:35:25.000Z" }],
      customer: { id: 2001, name: "Pelanggan A", mobile: "0800-0000-0001" },
      credit: null,
      cashier: "Kasir Contoh",
    });

    expect(call.text).toContain("Nota 65715HNN · Selesai · 14 Sep 2026");
    expect(call.text).toContain("Total Rp 220.000 · dibayar Rp 250.000 · kembalian Rp 30.000");
    expect(call.text).toContain("- Oli Mesin 1L (Tipe X) × 1,5 = Rp 22.500");
    expect(call.text).not.toContain("0800-0000-0001");
    expect(call.text).not.toContain("Pelanggan A");
    expect(call.text).not.toContain("Kredit");
  });

  it("reports credit for an open credit sale (status 4)", async () => {
    const call = await callWidgetTool(orderDetailTool, { sales_id: 42 }, {
      handlers: {
        "order.histories.legacy": legacyHandler(
          legacySale({
            status: 4,
            total_paid: 50000,
            money_change: 0,
            payments: [
              { payment_mode: "CASH", payment_name: "TUNAI", amount: 0, paid_date: "2026-08-01 09:00:00" },
              { payment_mode: "CASH", payment_name: "TUNAI", amount: 50000, paid_date: "2026-08-20 16:00:00" },
            ],
            installment: { period: "30", unit: "DAY", date: "31 Agustus 2026", total_installment: 242500, remaining_debt: 192500 },
          }),
        ),
      },
    });

    const data = orderDetailData.parse(call.structured);
    expect(data.sales_id).toBe(42);
    expect(data.status_label).toBe("Kredit belum lunas");
    expect(data.credit).toEqual({ period: 30, unit: "DAY", due_date: "2026-08-31", total: 242500, remaining: 192500 });
    expect(data.payments.map((p) => p.amount)).toEqual([0, 50000]);
    expect(call.text).toContain("Kredit belum lunas: sisa Rp 192.500 dari Rp 242.500, jatuh tempo 31 Agu 2026.");
  });

  it("handles missing customer, cashier and settle time", async () => {
    const call = await callWidgetTool(orderDetailTool, { sales_id: 7 }, {
      handlers: {
        "order.histories.legacy": legacyHandler(
          legacySale({
            customer: { id: 0, name: "", mobile: "" },
            user_settled: { id: 0, name: "", title: "" },
            created_by_name: "",
            settled_at: "",
            outlet_id: undefined,
            status: 4,
            installment: { period: "0", unit: "", date: "", total_installment: 1000, remaining_debt: 1000 },
          }),
        ),
      },
    });

    const data = orderDetailData.parse(call.structured);
    expect(data.customer).toBeNull();
    expect(data.cashier).toBeNull();
    expect(data.settled_at).toBeNull();
    // No sales.outlet_id: falls back to the session outlet.
    expect(data.outlet_id).toBe("645203");
    expect(data.credit).toEqual({ period: 0, unit: "", due_date: null, total: 1000, remaining: 1000 });
  });

  it("maps a malformed upstream payload to UPSTREAM_ERROR", async () => {
    const call = await callWidgetTool(orderDetailTool, { sales_id: 7 }, {
      handlers: { "order.histories.legacy": () => envelope({ sales: null }) },
    });

    expect(call.error).toEqual({ code: "UPSTREAM_ERROR", message: "Unexpected order.histories.legacy response" });
  });

  it("rejects non-positive sales ids", () => {
    expect(orderDetailInput.safeParse({ sales_id: 0 }).success).toBe(false);
    expect(orderDetailInput.safeParse({ sales_id: 1.5 }).success).toBe(false);
  });
});

describe("transaction tool definitions", () => {
  it("exports the three tools with their budgets and description rules", () => {
    expect(TRANSACTION_TOOLS.map((t) => [t.name, t.maxRequests, t.view ?? null])).toEqual([
      ["show_transactions", 2, "transaksi"],
      ["transactions_page", 1, null],
      ["order_detail", 1, null],
    ]);
    expect(transactionsTool.description.startsWith("Open an interactive")).toBe(true);
    expect(transactionsTool.description.length).toBeLessThanOrEqual(600);
    for (const tool of [transactionsPageTool, orderDetailTool]) {
      expect(tool.description.startsWith("Widget helper:")).toBe(true);
      expect(tool.description.length).toBeLessThanOrEqual(300);
    }
  });
});
