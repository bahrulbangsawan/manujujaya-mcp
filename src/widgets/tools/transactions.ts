import { AppError, ErrorCodes, isAppErrorLike } from "../../errors/codes";
import {
  APP_TOOL,
  PAGE_SIZE,
  STRUCTURED_MAX_CHARS,
  VIEW_TOOL,
  orderDetailInput,
  salesStatusLabel,
  transactionsInput,
  transactionsPageInput,
  type ToolOutput,
} from "../contract";
import { assertDateRange, jakartaDateOf, parseIndonesianDate, parseQasirDateTime } from "../qasir-dates";
import { isRecord, toNumber, toNumberOrNull, toText } from "../qasir-values";
import type { AnyWidgetToolDef, ToolContext, WidgetToolDef } from "./define";
import { capRows, envelopeData, formatQty, indoDate, joinLines, nextPageOf, pageInfo, recordsAt, rupiah, TRUNCATED_REASON } from "./shared";

type TransactionDay = ToolOutput<"show_transactions">["days"][number];
type TransactionItem = TransactionDay["items"][number];
type PaymentModeTotal = ToolOutput<"show_transactions">["payment_mode_totals"][number];
type OrderDetail = ToolOutput<"order_detail">;

/** Web status 3 = fully refunded; its amount never counts toward loaded totals. */
const STATUS_REFUND = 3;
/** Legacy status 4 = credit sale not fully paid; installment fields mean nothing otherwise. */
const STATUS_OPEN_CREDIT = 4;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}/;

/** Trim days so the payload, measured with its truncation fields set, fits STRUCTURED_MAX_CHARS. */
function fitDays<P extends object>(days: TransactionDay[], build: (days: TransactionDay[]) => P): P & { truncated: boolean; truncated_reason: string | null } {
  const capped = capRows(days, STRUCTURED_MAX_CHARS, (kept) => ({ ...build(kept), truncated: true, truncated_reason: TRUNCATED_REASON }));
  return { ...build(capped.rows), truncated: capped.truncated, truncated_reason: capped.truncated ? TRUNCATED_REASON : null };
}

function projectItem(raw: Record<string, unknown>): TransactionItem {
  const status = toNumber(raw.status);
  return {
    sales_id: toNumber(raw.sales_id),
    time: toText(raw.date_time),
    invoice: toText(raw.invoice_number),
    payment_mode: toText(raw.payment_mode),
    amount: toNumber(raw.amount),
    status,
    status_label: salesStatusLabel(status),
    sales_type: toText(raw.sales_type_name),
  };
}

/**
 * order.histories.web `data.sales[]` → contract days. Staff (`settle_by`) and outlet names are
 * dropped; groups without a YYYY-MM-DD date and items without a sales_id are skipped.
 */
export function projectDays(data: Record<string, unknown>): TransactionDay[] {
  const days: TransactionDay[] = [];
  for (const group of recordsAt(data, "sales")) {
    const date = toText(group.date);
    if (!ISO_DAY.test(date)) continue;
    days.push({
      date: date.slice(0, 10),
      daily_amount: toNumber(group.daily_amount),
      items: recordsAt(group, "items")
        .map(projectItem)
        .filter((item) => item.sales_id > 0),
    });
  }
  return days;
}

interface WebPage {
  days: TransactionDay[];
  items: TransactionItem[];
  totalResult: number | null;
  nextPage: number | null;
}

/** One order.histories.web page (count 100). `data.agg` is ignored: it does not reconcile with rows. */
async function fetchWebPage(
  ctx: ToolContext,
  input: { start_date: string; end_date: string; customer_id?: number | undefined },
  outletId: string,
  page: number,
): Promise<WebPage> {
  const res = await ctx.request({
    operationId: "order.histories.web",
    query: {
      page,
      count: PAGE_SIZE.transactions,
      start_date: input.start_date,
      end_date: input.end_date,
      outlet_ids: outletId,
      ...(input.customer_id !== undefined ? { customer_id: input.customer_id } : {}),
    },
  });
  const days = projectDays(envelopeData(res, "order.histories.web"));
  const items = days.flatMap((day) => day.items);
  return {
    days,
    items,
    totalResult: pageInfo(res)?.totalResult ?? null,
    nextPage: nextPageOf(res, page, items.length, PAGE_SIZE.transactions),
  };
}

/** Sum of amounts, excluding fully refunded (status 3) rows. */
function amountOf(items: TransactionItem[]): number {
  return items.reduce((sum, item) => (item.status === STATUS_REFUND ? sum : sum + item.amount), 0);
}

/** Per payment mode: count of every loaded row, amount excluding status 3; largest amount first. */
function paymentModeTotals(items: TransactionItem[]): PaymentModeTotal[] {
  const byMode = new Map<string, PaymentModeTotal>();
  for (const item of items) {
    const entry = byMode.get(item.payment_mode) ?? { payment_mode: item.payment_mode, count: 0, amount: 0 };
    entry.count += 1;
    if (item.status !== STATUS_REFUND) entry.amount += item.amount;
    byMode.set(item.payment_mode, entry);
  }
  return [...byMode.values()].sort(
    (a, b) => b.amount - a.amount || b.count - a.count || a.payment_mode.localeCompare(b.payment_mode),
  );
}

function rangeLabel(start: string, end: string): string {
  return start === end ? indoDate(start) : `${indoDate(start)} – ${indoDate(end)}`;
}

/** customers.get fullname; an upstream failure (e.g. deleted customer) degrades to null. */
async function customerName(ctx: ToolContext, customerId: number): Promise<string | null> {
  try {
    const res = await ctx.request({ operationId: "customers.get", path: { customer_id: customerId } });
    const customer = envelopeData(res, "customers.get").customer;
    return isRecord(customer) ? toText(customer.fullname) || null : null;
  } catch (err) {
    if (isAppErrorLike(err) && err.code === ErrorCodes.UPSTREAM_ERROR) return null;
    throw err;
  }
}

export const transactionsTool: WidgetToolDef<typeof transactionsInput> = {
  name: VIEW_TOOL.transaksi,
  title: "Riwayat transaksi",
  description:
    "Open an interactive sales-transaction widget for a date range: transactions grouped by day with time, invoice, payment method, amount and status, plus a receipt detail per sale. Use it for today, this week, this month or the last 30 days, or for one customer's purchases (`customer_id`). Open (unpaid) credit sales are not listed; use the customer debts widget for those.",
  input: transactionsInput,
  maxRequests: 2,
  view: "transaksi",
  async run(input, ctx) {
    assertDateRange(input.start_date, input.end_date);
    const outletId = await ctx.outletId(input.outlet_id);
    const [page, name] = await Promise.all([
      fetchWebPage(ctx, input, outletId, 1),
      input.customer_id !== undefined ? customerName(ctx, input.customer_id) : Promise.resolve(null),
    ]);

    const loadedAmount = amountOf(page.items);
    const totals = paymentModeTotals(page.items);
    const build = (days: TransactionDay[]) => ({
      view: "transaksi" as const,
      ...ctx.meta(outletId),
      range: { start_date: input.start_date, end_date: input.end_date },
      customer: input.customer_id !== undefined ? { id: input.customer_id, name } : null,
      days,
      total_transactions: page.totalResult,
      loaded_transactions: page.items.length,
      loaded_amount: loadedAmount,
      payment_mode_totals: totals,
      next_page: page.nextPage,
    });
    const structured: ToolOutput<"show_transactions"> = fitDays(page.days, build);

    const total = page.totalResult ?? page.items.length;
    const text = joinLines([
      `Transaksi ${rangeLabel(input.start_date, input.end_date)} · outlet ${outletId}${input.customer_id !== undefined ? ` · pelanggan #${input.customer_id}` : ""}`,
      `Jumlah transaksi: ${total}.`,
      page.items.length === 0
        ? "Tidak ada transaksi pada rentang ini."
        : `Baris dimuat: ${page.items.length} transaksi, ${rupiah(loadedAmount)} (tanpa refund penuh).`,
      totals.length > 0 && "Per metode pembayaran (baris dimuat):",
      ...totals.slice(0, 8).map((t) => `- ${t.payment_mode || "Tanpa metode"}: ${t.count} transaksi · ${rupiah(t.amount)}`),
      page.nextPage !== null && "Masih ada transaksi lain; buka widget untuk memuat halaman berikutnya.",
    ]);
    return { text, structured };
  },
};

export const transactionsPageTool: WidgetToolDef<typeof transactionsPageInput> = {
  name: APP_TOOL.transactionsPage,
  title: "Halaman transaksi berikutnya",
  description: "Widget helper: loads one more page (100 rows) of day-grouped sales transactions for the transaksi view, with the same range and customer filter.",
  input: transactionsPageInput,
  maxRequests: 1,
  async run(input, ctx) {
    assertDateRange(input.start_date, input.end_date);
    const outletId = await ctx.outletId(input.outlet_id);
    const page = await fetchWebPage(ctx, input, outletId, input.page);
    const build = (days: TransactionDay[]) => ({ ...ctx.meta(outletId), page: input.page, days, next_page: page.nextPage });
    const structured: ToolOutput<"transactions_page"> = fitDays(page.days, build);
    const text = joinLines([
      `Halaman ${input.page} transaksi ${rangeLabel(input.start_date, input.end_date)}: ${page.items.length} transaksi, ${rupiah(amountOf(page.items))} (tanpa refund penuh).`,
      page.nextPage === null ? "Tidak ada halaman berikutnya." : `Halaman berikutnya: ${page.nextPage}.`,
    ]);
    return { text, structured };
  },
};

/** Legacy installment.date: "DD <Bulan> YYYY", or an ISO day; "" and zero dates → null. */
function dueDateOf(value: unknown): string | null {
  const text = toText(value);
  if (ISO_DAY.test(text)) return text.startsWith("0001-01-01") ? null : text.slice(0, 10);
  return parseIndonesianDate(text);
}

/** order.histories.legacy `data.sales` → contract detail (without payload meta). */
export function projectOrderDetail(sale: Record<string, unknown>, salesId: number): Omit<OrderDetail, "outlet_id" | "generated_at" | "truncated" | "truncated_reason"> {
  const status = toNumber(sale.status);
  const items = recordsAt(sale, "carts").map((cart) => {
    const variant = isRecord(cart.variant) ? cart.variant : {};
    const product = isRecord(variant.product) ? variant.product : {};
    return {
      product: toText(product.name),
      variant: toText(variant.variant_name) || null,
      quantity: toNumber(cart.quantity),
      price: toNumberOrNull(cart.price_sell_unit) ?? toNumber(cart.price_sell),
      total: toNumber(cart.total),
    };
  });
  const payments = recordsAt(sale, "payments").map((p) => ({
    name: toText(p.payment_name),
    mode: toText(p.payment_mode),
    amount: toNumber(p.amount),
    paid_at: parseQasirDateTime(p.paid_date),
  }));
  const rawCustomer = isRecord(sale.customer) ? sale.customer : null;
  const customerId = rawCustomer ? toNumber(rawCustomer.id) : 0;
  const installment = isRecord(sale.installment) ? sale.installment : null;
  const settled = isRecord(sale.user_settled) ? toText(sale.user_settled.name) : "";
  return {
    sales_id: toNumber(sale.id) || salesId,
    invoice: toText(sale.invoice_number),
    status,
    status_label: salesStatusLabel(status),
    settled_at: parseQasirDateTime(sale.settled_at),
    total_bill: toNumber(sale.total_bill),
    total_paid: toNumber(sale.total_paid),
    change: toNumber(sale.money_change),
    items,
    payments,
    customer:
      rawCustomer && customerId > 0
        ? { id: customerId, name: toText(rawCustomer.name), mobile: toText(rawCustomer.mobile) || null }
        : null,
    credit:
      status === STATUS_OPEN_CREDIT && installment
        ? {
            period: toNumberOrNull(installment.period),
            unit: toText(installment.unit),
            due_date: dueDateOf(installment.date),
            total: toNumber(installment.total_installment),
            remaining: toNumber(installment.remaining_debt),
          }
        : null,
    cashier: settled || toText(sale.created_by_name) || null,
  };
}

export const orderDetailTool: WidgetToolDef<typeof orderDetailInput> = {
  name: APP_TOOL.orderDetail,
  title: "Rincian transaksi",
  description: "Widget helper: receipt detail of one sale (items, payments, customer, credit status, cashier) for the transaksi and piutang views.",
  input: orderDetailInput,
  maxRequests: 1,
  async run(input, ctx) {
    const res = await ctx.request({ operationId: "order.histories.legacy", path: { sales_id: input.sales_id } });
    const sale = envelopeData(res, "order.histories.legacy").sales;
    if (!isRecord(sale)) throw new AppError(ErrorCodes.UPSTREAM_ERROR, "Unexpected order.histories.legacy response");
    const detail = projectOrderDetail(sale, input.sales_id);
    const outletId = toText(sale.outlet_id) || (await ctx.outletId());
    const structured: OrderDetail = { ...ctx.meta(outletId), ...detail };

    const settled = detail.settled_at ? ` · ${indoDate(jakartaDateOf(detail.settled_at))}` : "";
    const text = joinLines([
      `Nota ${detail.invoice || `#${detail.sales_id}`} · ${detail.status_label}${settled}`,
      `Total ${rupiah(detail.total_bill)} · dibayar ${rupiah(detail.total_paid)} · kembalian ${rupiah(detail.change)}`,
      `${detail.items.length} item:`,
      ...detail.items.slice(0, 10).map((item) => `- ${item.product}${item.variant ? ` (${item.variant})` : ""} × ${formatQty(item.quantity)} = ${rupiah(item.total)}`),
      detail.items.length > 10 && `…dan ${detail.items.length - 10} item lainnya.`,
      detail.payments.length > 0 && `Pembayaran: ${detail.payments.map((p) => `${p.name || p.mode} ${rupiah(p.amount)}`).join(", ")}`,
      detail.credit &&
        `Kredit belum lunas: sisa ${rupiah(detail.credit.remaining)} dari ${rupiah(detail.credit.total)}${detail.credit.due_date ? `, jatuh tempo ${indoDate(detail.credit.due_date)}` : ""}.`,
    ]);
    return { text, structured };
  },
};

export const TRANSACTION_TOOLS: readonly AnyWidgetToolDef[] = [transactionsTool, transactionsPageTool, orderDetailTool];
