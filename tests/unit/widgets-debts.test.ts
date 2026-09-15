import { describe, expect, it } from "vitest";
import type { DispatchRequest } from "../../src/dispatcher/qasir-dispatcher";
import { AppError, ErrorCodes } from "../../src/errors/codes";
import { STRUCTURED_MAX_CHARS, customerDebtDetailData, customerDebtsData } from "../../src/widgets/contract";
import { customerDebtDetailTool, customerDebtsTool, DEBT_TOOLS } from "../../src/widgets/tools/debts";
import type { FixtureHandler } from "../stubs/codemode-harness";
import { callWidgetTool, envelope } from "../stubs/widget-harness";

// Fixed clock: 2026-09-15T03:00Z is 10:00 on 15 Sep 2026 in Jakarta.
const NOW = new Date("2026-09-15T03:00:00Z");

interface CreditSale {
  sales_id: number;
  customer_id: number;
  customer_name: string;
  /** Dashboard local time, "YYYY-MM-DD HH:MM:SS". */
  date: string;
  /** "DD <Bulan> YYYY" or "". */
  due: string;
  amount: number;
}

/** One order.histories.installment sales[] group (always exactly one item upstream). */
function group(sale: CreditSale): Record<string, unknown> {
  return {
    date: sale.date,
    total_amount: sale.amount * 3, // per-day total upstream; must never be used as the row amount
    items: [
      {
        sales_id: sale.sales_id,
        customer_id: sale.customer_id,
        customer_name: sale.customer_name,
        due_date: sale.due,
        amount: sale.amount,
        date_time: sale.due,
        time: sale.date.slice(11, 16),
        invoice_number: `INV-${sale.sales_id}`,
        outlet_name: "Outlet Contoh",
        status_order: "",
      },
    ],
  };
}

function installmentPage(page: number, sales: CreditSale[], hasNext: boolean): Record<string, unknown> {
  return envelope(
    { sales: sales.map(group) },
    {
      current_page: page,
      total_page: page + (hasNext ? 1 : 0),
      total_result: page * 101,
      ...(hasNext ? { next: `/api/v5/order/histories/installment?page=${page + 1}` } : {}),
    },
  );
}

const A1: CreditSale = { sales_id: 1001, customer_id: 11, customer_name: "Pelanggan A", date: "2026-09-12 13:27:33", due: "12 Oktober 2026", amount: 500_000 };
const A2: CreditSale = { sales_id: 1002, customer_id: 11, customer_name: "Pelanggan A", date: "2026-08-01 09:00:00", due: "31 Agustus 2026", amount: 250_000 };
const B1: CreditSale = { sales_id: 1003, customer_id: 12, customer_name: "Pelanggan B 0800-0000-0002", date: "2025-06-01 10:00:00", due: "01 Juli 2025", amount: 1_000_000 };
// 00:30 Jakarta on 8 Sep is still 7 Sep in UTC: the sale must land in 0–7 hari, not 8–30.
const C1: CreditSale = { sales_id: 1004, customer_id: 13, customer_name: "Pelanggan C", date: "2026-09-08 00:30:00", due: "", amount: 2_000_000 };
const D1: CreditSale = { sales_id: 1005, customer_id: 14, customer_name: "Pelanggan D", date: "2016-03-10 08:00:00", due: "10 April 2016", amount: 75_000 };

/** Receivable per bucket, keyed by the bucket's sale-date start. */
const RECEIVABLE_BY_START: Record<string, number> = {
  "2026-09-08": 2_400_000,
  "2026-06-17": 200_000,
  "2024-09-15": 900_000,
  "2015-01-01": 75_000,
};

function summaryHandler(): FixtureHandler {
  return (req) => {
    const start = String(req.query?.start_date);
    const receivable = RECEIVABLE_BY_START[start] ?? 0;
    return envelope({ total_customer: receivable > 0 ? 1 : 0, total_down_payment: 0, total_receivable: receivable });
  };
}

function queriesFor(calls: Array<{ req: DispatchRequest }>, operationId: string) {
  return calls.filter((c) => c.req.operationId === operationId).map((c) => c.req.query ?? {});
}

describe("show_customer_debts", () => {
  const pages: Record<number, Record<string, unknown>> = {
    // B1 appears on both pages (row shifted across the page boundary): counted once.
    1: installmentPage(1, [A1, A2, B1], true),
    2: installmentPage(2, [B1, C1, D1], false),
  };
  const handlers: Record<string, FixtureHandler> = {
    "order.histories.installment": (req) => pages[Number(req.query?.page)] ?? installmentPage(3, [], false),
    "reports.summaries.installment": summaryHandler(),
  };

  it("pages the installment list from 2015-01-01 to Jakarta today and asks one summary per aging bucket", async () => {
    const { dispatcher, error } = await callWidgetTool(customerDebtsTool, {}, { handlers, now: NOW });
    expect(error).toBeUndefined();
    expect(queriesFor(dispatcher.calls, "order.histories.installment")).toEqual([
      { page: 1, count: 100, start_date: "2015-01-01", end_date: "2026-09-15", outlet_ids: "645203" },
      { page: 2, count: 100, start_date: "2015-01-01", end_date: "2026-09-15", outlet_ids: "645203" },
    ]);
    const summaryRanges = queriesFor(dispatcher.calls, "reports.summaries.installment")
      .map((q) => `${q.start_date}..${q.end_date}`)
      .sort();
    expect(summaryRanges).toEqual(
      [
        "2026-09-08..2026-09-15",
        "2026-08-16..2026-09-07",
        "2026-06-17..2026-08-15",
        "2026-03-19..2026-06-16",
        "2025-09-15..2026-03-18",
        "2024-09-15..2025-09-14",
        "2015-01-01..2024-09-14",
      ].sort(),
    );
    for (const call of dispatcher.calls) expect(call.opts?.allowMutation).toBeUndefined();
  });

  it("builds buckets, summary and overdue-first customers that parse with the contract", async () => {
    const { structured } = await callWidgetTool(customerDebtsTool, {}, { handlers, now: NOW });
    const data = customerDebtsData.parse(structured);
    expect(data).toMatchObject({ view: "piutang", outlet_id: "645203", as_of: "2026-09-15", truncated: false, truncated_reason: null, focus_customer_id: null });
    expect(data.generated_at).toBe(NOW.toISOString());
    expect(data.buckets.map((b) => [b.key, b.invoices, b.customers, b.credit_total, b.receivable])).toEqual([
      ["0-7", 2, 2, 2_500_000, 2_400_000],
      ["8-30", 0, 0, 0, 0],
      ["31-90", 1, 1, 250_000, 200_000],
      ["91-180", 0, 0, 0, 0],
      ["181-365", 0, 0, 0, 0],
      ["366-730", 1, 1, 1_000_000, 900_000],
      ["gt-730", 1, 1, 75_000, 75_000],
    ]);
    expect(data.buckets[0]!.label).toBe("0–7 hari");
    expect(data.summary).toEqual({
      receivable_total: 3_575_000,
      customers: 4,
      open_invoices: 5,
      credit_total: 3_825_000,
      overdue_invoices: 3,
      overdue_customers: 3,
    });
    expect(data.customers).toEqual([
      { customer_id: 12, name: "Pelanggan B 0800-0000-0002", invoices: 1, credit_total: 1_000_000, oldest_sale_date: "2025-06-01", oldest_bucket: "366-730", nearest_due_date: "2025-07-01", overdue_invoices: 1, max_days_overdue: 441 },
      { customer_id: 11, name: "Pelanggan A", invoices: 2, credit_total: 750_000, oldest_sale_date: "2026-08-01", oldest_bucket: "31-90", nearest_due_date: "2026-08-31", overdue_invoices: 1, max_days_overdue: 15 },
      { customer_id: 14, name: "Pelanggan D", invoices: 1, credit_total: 75_000, oldest_sale_date: "2016-03-10", oldest_bucket: "gt-730", nearest_due_date: "2016-04-10", overdue_invoices: 1, max_days_overdue: 3810 },
      { customer_id: 13, name: "Pelanggan C", invoices: 1, credit_total: 2_000_000, oldest_sale_date: "2026-09-08", oldest_bucket: "0-7", nearest_due_date: null, overdue_invoices: 0, max_days_overdue: 0 },
    ]);
  });

  it("summarizes in Indonesian with the top 5 customers by credit and no phone numbers", async () => {
    const { text, result } = await callWidgetTool(customerDebtsTool, {}, { handlers, now: NOW });
    expect(result.content).toHaveLength(1);
    expect(text.length).toBeLessThanOrEqual(2_000);
    expect(text).toContain("Sisa piutang (laporan Qasir): Rp 3.575.000");
    expect(text).toContain("4 pelanggan, 5 nota kredit terbuka");
    expect(text).toContain("Lewat jatuh tempo: 3 nota dari 3 pelanggan");
    expect(text).toContain("- 0–7 hari: Rp 2.400.000 (2 nota)");
    const ranking = text.split("\n").filter((line) => /^\d\. /.test(line));
    expect(ranking.map((line) => line.split(":")[0])).toEqual(["1. Pelanggan C", "2. Pelanggan B …", "3. Pelanggan A", "4. Pelanggan D"]);
    expect(text).not.toMatch(/0800/);
  });

  it("marks the focus customer from input and uses an explicit outlet", async () => {
    const { structured, text, dispatcher } = await callWidgetTool(
      customerDebtsTool,
      { customer_id: 11, outlet_id: "777" },
      { handlers, now: NOW },
    );
    const data = customerDebtsData.parse(structured);
    expect(data.focus_customer_id).toBe(11);
    expect(data.outlet_id).toBe("777");
    for (const call of dispatcher.calls) expect(call.req.query?.outlet_ids).toBe("777");
    expect(text).toContain("Pelanggan #11: 2 nota terbuka, nilai kredit Rp 750.000.");
  });

  it("follows next through count+1 pages and stops at the page cap with truncated set, within budget", async () => {
    const customerNames = Array.from({ length: 30 }, (_, i) => `Pelanggan ${i + 1}`);
    const endless: FixtureHandler = (req) => {
      const page = Number(req.query?.page);
      // count=100 returns 101 rows, every page has a next link.
      const sales = Array.from({ length: 101 }, (_, i) => ({
        sales_id: page * 1_000 + i,
        customer_id: 100 + (i % 30),
        customer_name: customerNames[i % 30]!,
        date: "2026-09-01 10:00:00",
        due: "01 Oktober 2026",
        amount: 10_000,
      }));
      return installmentPage(page, sales, true);
    };
    const { structured, dispatcher, error } = await callWidgetTool(customerDebtsTool, {}, {
      handlers: { "order.histories.installment": endless, "reports.summaries.installment": summaryHandler() },
      now: NOW,
    });
    expect(error).toBeUndefined();
    expect(queriesFor(dispatcher.calls, "order.histories.installment").map((q) => q.page)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(dispatcher.calls).toHaveLength(19);
    const data = customerDebtsData.parse(structured);
    expect(data.summary.open_invoices).toBe(12 * 101);
    expect(data.summary.customers).toBe(30);
    expect(data.truncated).toBe(true);
    expect(data.truncated_reason).toContain("12 halaman");
  });

  it("stops paging when a page is empty even if upstream still sends next", async () => {
    const { dispatcher, structured } = await callWidgetTool(customerDebtsTool, {}, {
      handlers: {
        "order.histories.installment": (req) =>
          Number(req.query?.page) === 1 ? installmentPage(1, [A1], true) : installmentPage(2, [], true),
        "reports.summaries.installment": summaryHandler(),
      },
      now: NOW,
    });
    expect(queriesFor(dispatcher.calls, "order.histories.installment")).toHaveLength(2);
    expect(customerDebtsData.parse(structured).truncated).toBe(false);
  });

  it("trims customers from the tail to stay under the structured cap", async () => {
    const longName = (id: number) => `Pelanggan ${id} ${"x".repeat(180)}`;
    const handler: FixtureHandler = (req) => {
      const page = Number(req.query?.page);
      const sales = Array.from({ length: 101 }, (_, i) => {
        const id = page * 1_000 + i;
        return { sales_id: id, customer_id: id, customer_name: longName(id), date: "2026-09-01 10:00:00", due: "", amount: 5_000 };
      });
      return installmentPage(page, sales, page < 7);
    };
    const { structured, error } = await callWidgetTool(customerDebtsTool, {}, {
      handlers: { "order.histories.installment": handler, "reports.summaries.installment": summaryHandler() },
      now: NOW,
    });
    expect(error).toBeUndefined();
    const data = customerDebtsData.parse(structured);
    expect(JSON.stringify(structured).length).toBeLessThanOrEqual(STRUCTURED_MAX_CHARS);
    expect(data.summary.customers).toBe(707);
    expect(data.customers.length).toBeLessThan(707);
    expect(data.truncated).toBe(true);
    expect(data.truncated_reason).toContain("Daftar pelanggan dipotong");
  });

  it("maps an expired Qasir session to QASIR_AUTH_EXPIRED with the connect URL", async () => {
    const { error, structured } = await callWidgetTool(customerDebtsTool, {}, {
      handlers: {
        "order.histories.installment": () => {
          throw new AppError(ErrorCodes.QASIR_AUTH_EXPIRED, "Qasir session expired");
        },
        "reports.summaries.installment": summaryHandler(),
      },
      now: NOW,
    });
    expect(structured).toBeUndefined();
    expect(error).toEqual({ code: "QASIR_AUTH_EXPIRED", message: "Qasir session expired", connect_url: "https://mcp.example.test/connect" });
  });
});

describe("customer_debt_detail", () => {
  // Sale 1006 was paid off after the list was read: legacy status 2, remaining_debt is -change.
  const PAID_OFF: CreditSale = { sales_id: 1006, customer_id: 11, customer_name: "Pelanggan A", date: "2026-07-01 10:00:00", due: "31 Juli 2026", amount: 300_000 };
  const LEGACY: Record<number, Record<string, unknown>> = {
    1001: {
      id: 1001,
      status: 4,
      invoice_number: "INV-1001",
      total_bill: "500000.00",
      total_paid: 100_000,
      settled_at: "2026-09-12 13:27:33",
      installment: { period: "30", unit: "DAY", date: "12 Oktober 2026", total_installment: 500_000, remaining_debt: 400_000 },
      payments: [
        { payment_mode: "CASH", payment_name: "TUNAI", amount: 0, paid_date: "2026-09-12 13:27:33" },
        { payment_mode: "TRANSFER", payment_name: "Transfer", amount: 100_000, paid_date: "2026-09-14 10:00:00" },
      ],
      customer: { id: 11, name: "Pelanggan A", mobile: "0800-0000-0001" },
    },
    1002: {
      id: 1002,
      status: 4,
      invoice_number: "INV-1002",
      total_bill: "250000.00",
      total_paid: 0,
      installment: { period: "30", unit: "DAY", date: "31 Agustus 2026", total_installment: 250_000, remaining_debt: 250_000 },
      payments: [{ payment_mode: "CASH", payment_name: "TUNAI", amount: 0, paid_date: "2026-08-01 09:00:00" }],
      customer: { id: 11, name: "Pelanggan A", mobile: "0800-0000-0001" },
    },
    1006: {
      id: 1006,
      status: 2,
      is_installment_completed: true,
      invoice_number: "INV-1006",
      total_bill: "300000.00",
      total_paid: 330_000,
      installment: { period: "0", unit: "", date: "", total_installment: 300_000, remaining_debt: -30_000 },
      payments: [
        { payment_mode: "CASH", payment_name: "TUNAI", amount: 0, paid_date: "2026-07-01 10:00:00" },
        { payment_mode: "CASH", payment_name: "TUNAI", amount: 330_000, paid_date: "2026-09-10 11:00:00" },
      ],
      customer: { id: 11, name: "Pelanggan A", mobile: "0800-0000-0001" },
    },
  };
  const handlers: Record<string, FixtureHandler> = {
    "order.histories.installment": () => installmentPage(1, [A1, A2, PAID_OFF], false),
    "order.histories.legacy": (req) => envelope({ sales: LEGACY[Number(req.path?.sales_id)] }),
    "customers.get": () => envelope({ customer: { id: 11, fullname: "Pelanggan A", mobile: "0800-0000-0001" } }),
  };

  it("filters the installment list by customer and loads one receipt per open sale plus the profile", async () => {
    const { dispatcher, error } = await callWidgetTool(customerDebtDetailTool, { customer_id: 11 }, { handlers, now: NOW });
    expect(error).toBeUndefined();
    expect(queriesFor(dispatcher.calls, "order.histories.installment")).toEqual([
      { page: 1, count: 100, start_date: "2015-01-01", end_date: "2026-09-15", outlet_ids: "645203", customer_id: 11 },
    ]);
    expect(dispatcher.calls.filter((c) => c.req.operationId === "order.histories.legacy").map((c) => c.req.path?.sales_id).sort()).toEqual([1001, 1002, 1006]);
    expect(dispatcher.calls.filter((c) => c.req.operationId === "customers.get").map((c) => c.req.path)).toEqual([{ customer_id: 11 }]);
    expect(dispatcher.calls).toHaveLength(5);
  });

  it("reads remaining only from status-4 receipts, paid from total_paid, and drops zero placeholder payments", async () => {
    const { structured } = await callWidgetTool(customerDebtDetailTool, { customer_id: 11 }, { handlers, now: NOW });
    const data = customerDebtDetailData.parse(structured);
    expect(data.customer).toEqual({ id: 11, name: "Pelanggan A", mobile: "0800-0000-0001" });
    expect(data.invoices).toEqual([
      { sales_id: 1006, invoice: "INV-1006", sale_date: "2026-07-01", due_date: "2026-07-31", days_overdue: null, bucket: "31-90", total: 300_000, paid: 330_000, remaining: 0, payments: [{ name: "TUNAI", amount: 330_000, paid_at: "2026-09-10T04:00:00.000Z" }] },
      { sales_id: 1002, invoice: "INV-1002", sale_date: "2026-08-01", due_date: "2026-08-31", days_overdue: 15, bucket: "31-90", total: 250_000, paid: 0, remaining: 250_000, payments: [] },
      { sales_id: 1001, invoice: "INV-1001", sale_date: "2026-09-12", due_date: "2026-10-12", days_overdue: 0, bucket: "0-7", total: 500_000, paid: 100_000, remaining: 400_000, payments: [{ name: "Transfer", amount: 100_000, paid_at: "2026-09-14T03:00:00.000Z" }] },
    ]);
    expect(data.totals).toEqual({ total: 1_050_000, paid: 430_000, remaining: 650_000 });
    expect(data).toMatchObject({ outlet_id: "645203", truncated: false, truncated_reason: null });
  });

  it("text carries totals but neither the customer's name nor phone", async () => {
    const { text } = await callWidgetTool(customerDebtDetailTool, { customer_id: 11 }, { handlers, now: NOW });
    expect(text).toContain("3 nota kredit terbuka");
    expect(text).toContain("sisa Rp 650.000");
    expect(text).toContain("Lewat jatuh tempo: 1 nota, terlama 15 hari.");
    expect(text).not.toContain("Pelanggan A");
    expect(text).not.toMatch(/0800/);
  });

  it("falls back to the list name when the customer profile is gone (upstream 404)", async () => {
    const { structured } = await callWidgetTool(customerDebtDetailTool, { customer_id: 11 }, {
      handlers: {
        ...handlers,
        "customers.get": () => {
          throw new AppError(ErrorCodes.UPSTREAM_ERROR, "Upstream 404");
        },
      },
      now: NOW,
    });
    expect(customerDebtDetailData.parse(structured).customer).toEqual({ id: 11, name: "Pelanggan A", mobile: "0800-0000-0001" });
  });

  it("caps pages and receipts in the worst case and still fits the 45-request budget", async () => {
    const pageOf: FixtureHandler = (req) => {
      const page = Number(req.query?.page);
      const sales = Array.from({ length: 101 }, (_, i) => ({
        sales_id: page * 1_000 + i,
        customer_id: 11,
        customer_name: "Pelanggan A",
        // Older sales on later pages, like upstream (date descending).
        date: `20${String(25 - page).padStart(2, "0")}-01-${String(28 - (i % 28)).padStart(2, "0")} 10:00:00`,
        due: "",
        amount: 1_000,
      }));
      return installmentPage(page, sales, true);
    };
    const receipt: FixtureHandler = (req) =>
      envelope({
        sales: {
          id: req.path?.sales_id,
          status: 4,
          invoice_number: `INV-${req.path?.sales_id}`,
          total_paid: 0,
          installment: { total_installment: 1_000, remaining_debt: 1_000, date: "" },
          payments: [],
        },
      });
    const { structured, dispatcher, error } = await callWidgetTool(customerDebtDetailTool, { customer_id: 11 }, {
      handlers: {
        "order.histories.installment": pageOf,
        "order.histories.legacy": receipt,
        "customers.get": () => envelope({ customer: { id: 11, fullname: "Pelanggan A", mobile: "" } }),
      },
      now: NOW,
    });
    expect(error).toBeUndefined();
    expect(dispatcher.calls).toHaveLength(3 + 1 + 40);
    const data = customerDebtDetailData.parse(structured);
    expect(data.invoices).toHaveLength(40);
    // The oldest open sales come from the last page scanned.
    expect(data.invoices.every((inv) => inv.sales_id >= 3_000)).toBe(true);
    expect(data.customer.mobile).toBeNull();
    expect(data.truncated).toBe(true);
    expect(data.truncated_reason).toContain("3 halaman");
    expect(data.truncated_reason).toContain("40 nota tertua dari 303");
  });

  it("returns an empty, valid payload when the customer has no open credit", async () => {
    const { structured, text, dispatcher } = await callWidgetTool(customerDebtDetailTool, { customer_id: 99 }, {
      handlers: {
        "order.histories.installment": () => envelope({ sales: [] }),
        "customers.get": () => envelope({ customer: { id: 99, fullname: "Pelanggan Z", mobile: "0800-0000-0009" } }),
      },
      now: NOW,
    });
    const data = customerDebtDetailData.parse(structured);
    expect(data.invoices).toEqual([]);
    expect(data.totals).toEqual({ total: 0, paid: 0, remaining: 0 });
    expect(text).toContain("tidak punya nota kredit terbuka");
    expect(dispatcher.calls.map((c) => c.req.operationId).sort()).toEqual(["customers.get", "order.histories.installment"]);
  });
});

describe("debt tool registration metadata", () => {
  it("exports both tools with their budgets and description rules", () => {
    expect(DEBT_TOOLS.map((t) => [t.name, t.maxRequests, t.view ?? null])).toEqual([
      ["show_customer_debts", 20, "piutang"],
      ["customer_debt_detail", 45, null],
    ]);
    expect(customerDebtsTool.description.startsWith("Open an interactive")).toBe(true);
    expect(customerDebtsTool.description.length).toBeLessThanOrEqual(600);
    expect(customerDebtDetailTool.description.startsWith("Widget helper:")).toBe(true);
    expect(customerDebtDetailTool.description.length).toBeLessThanOrEqual(300);
  });
});
