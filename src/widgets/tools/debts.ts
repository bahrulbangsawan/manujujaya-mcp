import { AppError, ErrorCodes } from "../../errors/codes";
import {
  AGING_BUCKET_KEYS,
  AGING_BUCKET_LABEL,
  APP_TOOL,
  CUSTOMER_INSTALLMENT_MAX_PAGES,
  DEBT_DETAIL_MAX_INVOICES,
  DEBT_SCAN_START_DATE,
  INSTALLMENT_MAX_PAGES,
  PAGE_SIZE,
  STRUCTURED_MAX_CHARS,
  VIEW_TOOL,
  customerDebtDetailInput,
  customerDebtsInput,
  type AgingBucketKey,
  type ToolOutput,
} from "../contract";
import {
  agingBucket,
  bucketSaleDateRange,
  daysBetween,
  jakartaDateOf,
  parseIndonesianDate,
  parseQasirDateTime,
} from "../qasir-dates";
import { isRecord, toNumber, toText } from "../qasir-values";
import type { AnyWidgetToolDef, ToolContext, WidgetToolDef } from "./define";
import { capRows, envelopeData, indoDate, isUpstream404, joinLines, pageInfo, recordsAt, rupiah } from "./shared";

type DebtCustomer = ToolOutput<"show_customer_debts">["customers"][number];
type DebtInvoice = ToolOutput<"customer_debt_detail">["invoices"][number];

/** One open credit sale from order.histories.installment (status 4 only upstream). */
interface OpenCredit {
  sales_id: number;
  customer_id: number;
  customer_name: string;
  invoice: string;
  /** Jakarta calendar date of the sale (sales[].date is dashboard local time). */
  sale_date: string;
  due_date: string | null;
  /** items[].amount = installment.total_installment (the credit value, not what is still owed). */
  amount: number;
}

/**
 * Flatten one installment page. Each sales[] group holds one item; group
 * total_amount is a per-day total and is ignored. Rows without a sales_id or a
 * parseable sale date are skipped.
 */
function parseInstallmentPage(res: unknown): OpenCredit[] {
  const data = envelopeData(res, "order.histories.installment");
  const rows: OpenCredit[] = [];
  for (const group of recordsAt(data, "sales")) {
    const saleAt = parseQasirDateTime(group.date);
    if (!saleAt) continue;
    const sale_date = jakartaDateOf(saleAt);
    for (const item of recordsAt(group, "items")) {
      const sales_id = toNumber(item.sales_id);
      if (!Number.isSafeInteger(sales_id) || sales_id <= 0) continue;
      rows.push({
        sales_id,
        customer_id: toNumber(item.customer_id),
        customer_name: toText(item.customer_name),
        invoice: toText(item.invoice_number),
        sale_date,
        due_date: parseIndonesianDate(item.due_date),
        amount: toNumber(item.amount),
      });
    }
  }
  return rows;
}

/**
 * Page order.histories.installment from DEBT_SCAN_START_DATE to today. Upstream
 * returns count+1 rows per page and lower-bound totals, so follow
 * pagination.next until it is absent (or a page is empty), dedupe by sales_id,
 * and stop after maxPages. `capped` is true when the last allowed page still
 * had a next link.
 */
async function scanOpenCredit(
  ctx: ToolContext,
  outletId: string,
  maxPages: number,
  customerId?: number,
): Promise<{ rows: OpenCredit[]; capped: boolean }> {
  const bySale = new Map<number, OpenCredit>();
  for (let page = 1; page <= maxPages; page++) {
    const res = await ctx.request({
      operationId: "order.histories.installment",
      query: {
        page,
        count: PAGE_SIZE.installments,
        start_date: DEBT_SCAN_START_DATE,
        end_date: ctx.today,
        outlet_ids: outletId,
        ...(customerId !== undefined ? { customer_id: customerId } : {}),
      },
    });
    const rows = parseInstallmentPage(res);
    for (const row of rows) if (!bySale.has(row.sales_id)) bySale.set(row.sales_id, row);
    if (pageInfo(res)?.hasNext !== true || rows.length === 0) return { rows: [...bySale.values()], capped: false };
  }
  return { rows: [...bySale.values()], capped: true };
}

/** reports.summaries.installment total_receivable for the sale dates of one aging bucket. */
async function bucketReceivable(ctx: ToolContext, outletId: string, bucket: AgingBucketKey): Promise<number> {
  const range = bucketSaleDateRange(bucket, ctx.today);
  const res = await ctx.request({
    operationId: "reports.summaries.installment",
    query: { start_date: range.start_date, end_date: range.end_date, outlet_ids: outletId },
  });
  return toNumber(envelopeData(res, "reports.summaries.installment").total_receivable);
}

function saleAgeBucket(row: OpenCredit, today: string): AgingBucketKey {
  return agingBucket(daysBetween(row.sale_date, today));
}

function daysOverdue(dueDate: string | null, today: string): number {
  return dueDate === null ? 0 : Math.max(0, daysBetween(dueDate, today));
}

/** Customer names can carry merchant-typed phone numbers; text blocks never show them. */
function textSafeName(name: string): string {
  return name.replace(/\+?\d[\d\s.-]{6,}\d/g, "…");
}

function customerLabel(name: string, id: number): string {
  return name || `Pelanggan #${id}`;
}

function aggregateCustomers(rows: OpenCredit[], today: string): DebtCustomer[] {
  const byCustomer = new Map<number, DebtCustomer>();
  for (const row of rows) {
    const overdue = daysOverdue(row.due_date, today);
    const current = byCustomer.get(row.customer_id);
    if (!current) {
      byCustomer.set(row.customer_id, {
        customer_id: row.customer_id,
        name: customerLabel(row.customer_name, row.customer_id),
        invoices: 1,
        credit_total: row.amount,
        oldest_sale_date: row.sale_date,
        oldest_bucket: saleAgeBucket(row, today),
        nearest_due_date: row.due_date,
        overdue_invoices: overdue > 0 ? 1 : 0,
        max_days_overdue: overdue,
      });
      continue;
    }
    current.invoices += 1;
    current.credit_total += row.amount;
    if (row.sale_date < current.oldest_sale_date) {
      current.oldest_sale_date = row.sale_date;
      current.oldest_bucket = saleAgeBucket(row, today);
    }
    if (row.due_date !== null && (current.nearest_due_date === null || row.due_date < current.nearest_due_date)) {
      current.nearest_due_date = row.due_date;
    }
    if (overdue > 0) current.overdue_invoices += 1;
    current.max_days_overdue = Math.max(current.max_days_overdue, overdue);
    if (current.name === `Pelanggan #${row.customer_id}` && row.customer_name) current.name = row.customer_name;
  }
  // Default order: customers with overdue invoices first, then by credit value.
  return [...byCustomer.values()].sort(
    (a, b) =>
      Number(b.overdue_invoices > 0) - Number(a.overdue_invoices > 0) ||
      b.credit_total - a.credit_total ||
      a.customer_id - b.customer_id,
  );
}

export const customerDebtsTool: WidgetToolDef<typeof customerDebtsInput> = {
  name: VIEW_TOOL.piutang,
  title: "Piutang pelanggan",
  description:
    "Open an interactive Piutang (customer debt) widget: all open credit sales aged 0–7 days, 8–30 days, 1–3 months, 3–6 months, 6–12 months, 1–2 years and over 2 years, with the Qasir receivable per age bucket, overdue invoices and customers ranked by credit value. Use it when the user asks who still owes money, about unpaid credit (kasbon/piutang), overdue debts or debt aging. Pass customer_id to highlight one customer. Read-only.",
  input: customerDebtsInput,
  // Worst case: INSTALLMENT_MAX_PAGES (12) list pages + 7 bucket summaries = 19.
  maxRequests: 20,
  view: "piutang",
  async run(input, ctx) {
    const outletId = await ctx.outletId(input.outlet_id);
    const today = ctx.today;
    const [scan, receivables] = await Promise.all([
      scanOpenCredit(ctx, outletId, INSTALLMENT_MAX_PAGES),
      Promise.all(AGING_BUCKET_KEYS.map((key) => bucketReceivable(ctx, outletId, key))),
    ]);
    const rows = scan.rows;

    const buckets = AGING_BUCKET_KEYS.map((key, index) => {
      const inBucket = rows.filter((row) => saleAgeBucket(row, today) === key);
      return {
        key,
        label: AGING_BUCKET_LABEL[key],
        invoices: inBucket.length,
        customers: new Set(inBucket.map((row) => row.customer_id)).size,
        credit_total: inBucket.reduce((sum, row) => sum + row.amount, 0),
        receivable: receivables[index] ?? 0,
      };
    });
    const overdueRows = rows.filter((row) => daysOverdue(row.due_date, today) > 0);
    const summary = {
      receivable_total: buckets.reduce((sum, b) => sum + b.receivable, 0),
      customers: new Set(rows.map((row) => row.customer_id)).size,
      open_invoices: rows.length,
      credit_total: rows.reduce((sum, row) => sum + row.amount, 0),
      overdue_invoices: overdueRows.length,
      overdue_customers: new Set(overdueRows.map((row) => row.customer_id)).size,
    };
    const customers = aggregateCustomers(rows, today);
    const focusId = input.customer_id ?? null;

    const scanReason = scan.capped
      ? `Daftar nota kredit dibatasi ${INSTALLMENT_MAX_PAGES} halaman (${rows.length} nota dimuat); sisa piutang per umur tetap dari laporan Qasir.`
      : null;
    const build = (kept: DebtCustomer[]) => {
      const cut = kept.length < customers.length;
      const reasons = [scanReason, cut ? `Daftar pelanggan dipotong: ${kept.length} dari ${customers.length} ditampilkan.` : null];
      const reason = reasons.filter((r): r is string => r !== null).join(" ");
      return {
        view: "piutang" as const,
        ...ctx.meta(outletId),
        truncated: reason !== "",
        truncated_reason: reason === "" ? null : reason,
        as_of: today,
        summary,
        buckets,
        customers: kept,
        focus_customer_id: focusId,
      };
    };
    const capped = capRows(customers, STRUCTURED_MAX_CHARS, build);
    const structured = build(capped.rows);

    const top = [...customers].sort((a, b) => b.credit_total - a.credit_total || a.customer_id - b.customer_id).slice(0, 5);
    const focus = focusId === null ? undefined : customers.find((c) => c.customer_id === focusId);
    const text = joinLines([
      `Piutang pelanggan per ${indoDate(today)} (outlet ${outletId}).`,
      `Sisa piutang (laporan Qasir): ${rupiah(summary.receivable_total)}.`,
      `${summary.customers} pelanggan, ${summary.open_invoices} nota kredit terbuka, nilai kredit ${rupiah(summary.credit_total)}.`,
      `Lewat jatuh tempo: ${summary.overdue_invoices} nota dari ${summary.overdue_customers} pelanggan.`,
      "Sisa piutang per umur nota:",
      ...buckets.map((b) => `- ${b.label}: ${rupiah(b.receivable)} (${b.invoices} nota)`),
      top.length > 0 && "Nilai kredit terbesar:",
      ...top.map(
        (c, i) =>
          `${i + 1}. ${textSafeName(c.name)}: ${c.invoices} nota, ${rupiah(c.credit_total)}, nota tertua ${AGING_BUCKET_LABEL[c.oldest_bucket]}`,
      ),
      focusId !== null &&
        (focus
          ? `Pelanggan #${focusId}: ${focus.invoices} nota terbuka, nilai kredit ${rupiah(focus.credit_total)}.`
          : `Pelanggan #${focusId} tidak punya nota kredit terbuka.`),
      structured.truncated_reason && `Catatan: ${structured.truncated_reason}`,
    ]);
    return { text, structured };
  },
};

async function customerProfile(ctx: ToolContext, customerId: number): Promise<Record<string, unknown> | null> {
  try {
    const res = await ctx.request({ operationId: "customers.get", path: { customer_id: customerId } });
    const customer = envelopeData(res, "customers.get").customer;
    return isRecord(customer) ? customer : null;
  } catch (err) {
    if (isUpstream404(err)) return null;
    throw err;
  }
}

function legacySale(res: unknown): Record<string, unknown> {
  const sale = envelopeData(res, "order.histories.legacy").sales;
  if (!isRecord(sale)) throw new AppError(ErrorCodes.UPSTREAM_ERROR, "Unexpected order.histories.legacy response");
  return sale;
}

function invoiceFromSale(row: OpenCredit, sale: Record<string, unknown>, today: string): DebtInvoice {
  const installment = isRecord(sale.installment) ? sale.installment : {};
  // remaining_debt means "still owed" only on status 4 (open credit); elsewhere it is -change.
  const remaining = toNumber(sale.status) === 4 ? Math.max(0, toNumber(installment.remaining_debt)) : 0;
  const due = row.due_date ?? parseIndonesianDate(installment.date);
  return {
    sales_id: row.sales_id,
    invoice: toText(sale.invoice_number) || row.invoice,
    sale_date: row.sale_date,
    due_date: due,
    days_overdue: remaining > 0 && due !== null ? daysOverdue(due, today) : null,
    bucket: saleAgeBucket(row, today),
    total: toNumber(installment.total_installment) || row.amount,
    paid: toNumber(sale.total_paid),
    remaining,
    payments: recordsAt(sale, "payments")
      .filter((p) => toNumber(p.amount) !== 0)
      .map((p) => ({
        name: toText(p.payment_name) || toText(p.payment_mode) || "Pembayaran",
        amount: toNumber(p.amount),
        paid_at: parseQasirDateTime(p.paid_date),
      })),
  };
}

export const customerDebtDetailTool: WidgetToolDef<typeof customerDebtDetailInput> = {
  name: APP_TOOL.customerDebtDetail,
  title: "Detail piutang pelanggan",
  description:
    "Widget helper: one customer's open credit invoices with due dates, payments and remaining debt from each receipt. Used by the Piutang widget when a customer row is expanded.",
  input: customerDebtDetailInput,
  // Worst case: CUSTOMER_INSTALLMENT_MAX_PAGES (3) + customers.get (1) + DEBT_DETAIL_MAX_INVOICES (40) = 44.
  maxRequests: 45,
  async run(input, ctx) {
    const outletId = await ctx.outletId(input.outlet_id);
    const today = ctx.today;
    const [scan, profile] = await Promise.all([
      scanOpenCredit(ctx, outletId, CUSTOMER_INSTALLMENT_MAX_PAGES, input.customer_id),
      customerProfile(ctx, input.customer_id),
    ]);
    // Oldest debt first; the detail fan-out covers the oldest DEBT_DETAIL_MAX_INVOICES.
    const open = scan.rows
      .filter((row) => row.customer_id === input.customer_id)
      .sort((a, b) => (a.sale_date < b.sale_date ? -1 : a.sale_date > b.sale_date ? 1 : a.sales_id - b.sales_id));
    const selected = open.slice(0, DEBT_DETAIL_MAX_INVOICES);
    const sales = await Promise.all(
      selected.map(async (row) => ({
        row,
        sale: legacySale(await ctx.request({ operationId: "order.histories.legacy", path: { sales_id: row.sales_id } })),
      })),
    );
    const invoices = sales.map(({ row, sale }) => invoiceFromSale(row, sale, today));

    const legacyCustomer = sales.map(({ sale }) => sale.customer).find(isRecord);
    const customer = {
      id: input.customer_id,
      name:
        toText(profile?.fullname) ||
        open[0]?.customer_name ||
        toText(legacyCustomer?.name) ||
        `Pelanggan #${input.customer_id}`,
      mobile: toText(profile?.mobile) || toText(legacyCustomer?.mobile) || null,
    };

    const reasons = [
      scan.capped ? `Daftar nota kredit dibatasi ${CUSTOMER_INSTALLMENT_MAX_PAGES} halaman.` : null,
      open.length > selected.length ? `Detail dibatasi ${selected.length} nota tertua dari ${open.length} nota terbuka.` : null,
    ].filter((r): r is string => r !== null);
    const build = (kept: DebtInvoice[]) => {
      const all = kept.length < invoices.length ? [...reasons, `Daftar nota dipotong: ${kept.length} dari ${invoices.length} ditampilkan.`] : reasons;
      return {
        ...ctx.meta(outletId),
        truncated: all.length > 0,
        truncated_reason: all.length > 0 ? all.join(" ") : null,
        customer,
        invoices: kept,
        totals: {
          total: kept.reduce((sum, inv) => sum + inv.total, 0),
          paid: kept.reduce((sum, inv) => sum + inv.paid, 0),
          remaining: kept.reduce((sum, inv) => sum + inv.remaining, 0),
        },
      };
    };
    const structured = build(capRows(invoices, STRUCTURED_MAX_CHARS, build).rows);

    const overdue = structured.invoices.filter((inv) => (inv.days_overdue ?? 0) > 0);
    const oldest = structured.invoices[0];
    const text =
      structured.invoices.length === 0
        ? joinLines([`Pelanggan #${input.customer_id} tidak punya nota kredit terbuka (outlet ${outletId}).`, structured.truncated_reason && `Catatan: ${structured.truncated_reason}`])
        : joinLines([
            `Piutang pelanggan #${input.customer_id} (outlet ${outletId}): ${structured.invoices.length} nota kredit terbuka.`,
            `Total kredit ${rupiah(structured.totals.total)}, dibayar ${rupiah(structured.totals.paid)}, sisa ${rupiah(structured.totals.remaining)}.`,
            overdue.length > 0
              ? `Lewat jatuh tempo: ${overdue.length} nota, terlama ${Math.max(...overdue.map((inv) => inv.days_overdue ?? 0))} hari.`
              : "Belum ada nota yang lewat jatuh tempo.",
            oldest && `Nota tertua: ${indoDate(oldest.sale_date)} (${AGING_BUCKET_LABEL[oldest.bucket]}).`,
            structured.truncated_reason && `Catatan: ${structured.truncated_reason}`,
          ]);
    return { text, structured };
  },
};

export const DEBT_TOOLS: readonly AnyWidgetToolDef[] = [customerDebtsTool, customerDebtDetailTool];
