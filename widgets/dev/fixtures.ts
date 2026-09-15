/**
 * Synthetic, deterministic tool payloads for the mock bridge (widgets:dev, widget tests, smoke test).
 * Every payload parses with TOOL_SCHEMAS[name].output. No real names, phone numbers or invoices.
 */
import {
  AGING_BUCKET_KEYS,
  AGING_BUCKET_LABEL,
  PO_STATUSES,
  STOCK_MOVEMENT_TYPES,
  poStatusLabel,
  salesStatusLabel,
  stockMovementLabel,
  type AgingBucketKey,
  type ProductOrder,
  type ToolInput,
  type ToolName,
  type ToolOutput,
} from "../../src/widgets/contract";
import { addIsoDays, isoDaysBetween } from "../src/lib/dates";

export const FIXTURE_OUTLET_ID = "100001";
export const FIXTURE_TODAY = "2026-09-15";
const GENERATED_AT = "2026-09-15T03:00:00.000Z";
const CATEGORIES = ["Minuman", "Makanan", "Snack", "Kebutuhan Rumah"] as const;
const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;

function meta(outletId: string | undefined) {
  return { outlet_id: outletId ?? FIXTURE_OUTLET_ID, generated_at: GENERATED_AT, truncated: false, truncated_reason: null };
}

function pick<T>(items: readonly T[], index: number): T {
  return items[((index % items.length) + items.length) % items.length] as T;
}

/** Deterministic pseudo-random integer in [0, modulo). */
function noise(seed: number, modulo: number): number {
  return (seed * 7919 + 104_729) % modulo;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Inclusive day list, newest last, at most `max` days (the newest ones). */
function daysOf(start: string, end: string, max: number): string[] {
  const span = Math.max(0, isoDaysBetween(start, end));
  const first = Math.max(0, span + 1 - max);
  const days: string[] = [];
  for (let i = first; i <= span; i += 1) days.push(addIsoDays(start, i));
  return days;
}

function jakartaIso(date: string, hour: number, minute: number): string {
  return new Date(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+07:00`).toISOString();
}

// ── Products ────────────────────────────────────────────────────────────────

const PRODUCT_PAGE_SIZE = 50;
const PRODUCT_PAGES = 3;

function productRow(rank: number, order: ProductOrder) {
  const total = PRODUCT_PAGE_SIZE * PRODUCT_PAGES;
  const byQuantity = order === "terlaris" || order === "kurang_laris";
  const descending = order === "terlaris" || order === "omzet_tertinggi";
  const position = descending ? rank : total + 1 - rank;
  const quantity = byQuantity ? (total + 1 - position) * 3 : 20 + noise(position, 30);
  const gross = byQuantity ? quantity * 8_500 : (total + 1 - position) * 42_000;
  return {
    rank,
    id: 1000 + position,
    name: `Produk ${position}`,
    category: pick(CATEGORIES, position),
    sku: `SKU-${1000 + position}`,
    quantity,
    unit: "pcs",
    gross,
    collected: Math.round(gross * 0.97),
  };
}

function productPage(order: ProductOrder, page: number) {
  const rows = Array.from({ length: PRODUCT_PAGE_SIZE }, (_, i) => productRow((page - 1) * PRODUCT_PAGE_SIZE + i + 1, order));
  return { rows, next_page: page < PRODUCT_PAGES ? page + 1 : null };
}

function categoryRows(count: number) {
  return CATEGORIES.slice(0, count).map((name, i) => {
    const gross = (CATEGORIES.length - i) * 1_150_000;
    return { id: 10 + i, name, quantity: (CATEGORIES.length - i) * 64, gross, collected: Math.round(gross * 0.97) };
  });
}

// ── Stock ───────────────────────────────────────────────────────────────────

const STOCK_PAGE_SIZE = 50;
const STOCK_CATALOG = Array.from({ length: 120 }, (_, i) => {
  const n = i + 1;
  const daysSinceSale = n % 9 === 0 ? null : noise(n, 120);
  const daysSinceAdjustment = n % 4 === 0 ? null : noise(n + 3, 200);
  return {
    inventory_id: 5000 + n,
    name: `${n % 3 === 0 ? "Kopi" : "Produk"} ${n} - Reguler`,
    stock: n % 7 === 0 ? 0 : noise(n, 60),
    price_sell: 5_000 + n * 250,
    last_sale_at: daysSinceSale === null ? null : jakartaIso(addIsoDays(FIXTURE_TODAY, -daysSinceSale), 9, 15),
    days_since_sale: daysSinceSale,
    last_adjustment_at: daysSinceAdjustment === null ? null : jakartaIso(addIsoDays(FIXTURE_TODAY, -daysSinceAdjustment), 17, 40),
    days_since_adjustment: daysSinceAdjustment,
  };
});

function stockMatches(search: string | undefined) {
  const needle = search?.trim().toLowerCase() ?? "";
  return needle === "" ? STOCK_CATALOG : STOCK_CATALOG.filter((row) => row.name.toLowerCase().includes(needle));
}

function stockSlice(search: string | undefined, page: number) {
  const matches = stockMatches(search);
  const rows = matches.slice((page - 1) * STOCK_PAGE_SIZE, page * STOCK_PAGE_SIZE);
  return { matches, rows, next_page: page * STOCK_PAGE_SIZE < matches.length ? page + 1 : null };
}

const HISTORY_PAGES = 3;

// ── Purchases ───────────────────────────────────────────────────────────────

const PURCHASE_PAGE_SIZE = 100;
const PURCHASE_TOTAL = 180;

function purchaseRow(n: number) {
  const status = pick(PO_STATUSES, noise(n, 5) === 0 ? 2 : n % 3 === 0 ? 1 : 0);
  return {
    id: String(70_000 + n),
    order_no: `PO-2026-${String(n).padStart(4, "0")}`,
    supplier: `Pemasok ${pick(LETTERS, n)}`,
    total: 250_000 + noise(n, 40) * 25_000,
    status,
    status_label: poStatusLabel(status),
    created_at: jakartaIso(addIsoDays(FIXTURE_TODAY, -Math.floor(n / 3)), 10, 5),
  };
}

function purchasePage(page: number) {
  const first = (page - 1) * PURCHASE_PAGE_SIZE + 1;
  const last = Math.min(page * PURCHASE_PAGE_SIZE, PURCHASE_TOTAL);
  const rows = [];
  for (let n = first; n <= last; n += 1) rows.push(purchaseRow(n));
  return { rows, next_page: last < PURCHASE_TOTAL ? page + 1 : null };
}

// ── Transactions ────────────────────────────────────────────────────────────

const PAYMENT_MODES = ["Tunai", "QRIS", "Transfer Bank"] as const;
const WEB_STATUSES = [2, 2, 2, 3, 2, 6] as const;

function transactionDay(date: string, dayIndex: number) {
  const items = Array.from({ length: 6 }, (_, i) => {
    const seed = dayIndex * 10 + i;
    const status = pick(WEB_STATUSES, i);
    return {
      sales_id: 900_000 + seed,
      time: `${String(8 + i * 2).padStart(2, "0")}:${String(noise(seed, 60)).padStart(2, "0")}`,
      invoice: `INV/${date.replaceAll("-", "")}/${String(seed).padStart(4, "0")}`,
      payment_mode: pick(PAYMENT_MODES, seed),
      amount: status === 6 ? 0 : 35_000 + noise(seed, 20) * 5_000,
      status,
      status_label: salesStatusLabel(status),
      sales_type: i % 2 === 0 ? "Dine In" : "Take Away",
    };
  });
  const daily_amount = items.filter((item) => item.status !== 3).reduce((sum, item) => sum + item.amount, 0);
  return { date, daily_amount, items };
}

// ── Debts ───────────────────────────────────────────────────────────────────

const DEBT_CUSTOMERS = LETTERS.slice(0, 6).map((letter, i) => ({
  customer_id: 3001 + i,
  name: `Pelanggan ${letter}`,
  invoices: 1 + (i % 3),
  credit_total: (6 - i) * 275_000,
  oldest_sale_date: addIsoDays(FIXTURE_TODAY, -[3, 20, 75, 150, 300, 800][i]!),
  oldest_bucket: AGING_BUCKET_KEYS[[0, 1, 2, 3, 4, 6][i]!] as AgingBucketKey,
  nearest_due_date: i === 5 ? null : addIsoDays(FIXTURE_TODAY, [10, -5, -40, 4, -200, 0][i]!),
  overdue_invoices: [0, 1, 2, 0, 1, 0][i]!,
  max_days_overdue: [0, 5, 40, 0, 200, 0][i]!,
}));

// ── Fixtures ────────────────────────────────────────────────────────────────

export const FIXTURES: { [N in ToolName]: (args: ToolInput<N>) => ToolOutput<N> } = {
  show_sales_dashboard: (args) => {
    const length = isoDaysBetween(args.start_date, args.end_date) + 1;
    const comparison = { start_date: addIsoDays(args.start_date, -length), end_date: addIsoDays(args.start_date, -1) };
    const trend = daysOf(args.start_date, args.end_date, 366).map((date, i) => ({
      date,
      amount: 900_000 + noise(i, 11) * 55_000,
      comparison_date: addIsoDays(date, -length),
      comparison_amount: 850_000 + noise(i + 5, 11) * 50_000,
    }));
    const gross = trend.reduce((sum, point) => sum + point.amount, 0);
    const transactions = length * 24;
    return {
      view: "penjualan",
      ...meta(args.outlet_id),
      range: { start_date: args.start_date, end_date: args.end_date },
      comparison,
      kpis: {
        sales_before_discount: gross + length * 15_000,
        discount: length * 15_000,
        gross_sales: gross,
        profit: Math.round(gross * 0.31),
        capital: Math.round(gross * 0.69),
        tax: Math.round(gross * 0.1),
        transactions,
        quantity: transactions * 3,
        average_ticket: Math.round(gross / transactions),
      },
      changes: {
        gross: { percent: 12.5, direction: "up" },
        profit: { percent: 3.2, direction: "down" },
        transactions: { percent: null, direction: null },
        quantity: { percent: 8, direction: "up" },
      },
      trend,
      payment_methods: [
        { name: "Tunai", quantity: 42, amount: Math.round(gross * 0.6) },
        { name: "QRIS", quantity: 18, amount: Math.round(gross * 0.3) },
        { name: "Transfer Bank", quantity: 5, amount: Math.round(gross * 0.1) },
      ],
      categories: categoryRows(4),
      top_products: productPage("terlaris", 1).rows.slice(0, 5),
      receivable: { total: 3_450_000, customers: 6 },
    };
  },

  show_product_ranking: (args) => {
    const order = args.order ?? "terlaris";
    const { rows, next_page } = productPage(order, 1);
    return {
      view: "produk",
      ...meta(args.outlet_id),
      range: { start_date: args.start_date, end_date: args.end_date },
      order,
      rows,
      categories: categoryRows(4),
      manual_transactions: { quantity: 3, gross: 45_000 },
      next_page,
    };
  },

  product_ranking_page: (args) => ({
    ...meta(args.outlet_id),
    order: args.order,
    page: args.page,
    ...productPage(args.order, args.page),
  }),

  show_stock_browser: (args) => {
    const search = args.search?.trim() || null;
    const { matches, rows, next_page } = stockSlice(args.search, 1);
    return { view: "stok", ...meta(args.outlet_id), search, rows, total_rows: matches.length, next_page };
  },

  stock_page: (args) => {
    const { rows, next_page } = stockSlice(args.search, args.page);
    return { ...meta(args.outlet_id), search: args.search?.trim() || null, page: args.page, rows, next_page };
  },

  stock_history: (args) => {
    const item = STOCK_CATALOG.find((row) => row.inventory_id === args.inventory_id);
    const stock = item?.stock ?? 12;
    const count = args.page < HISTORY_PAGES ? 50 : 20;
    const movements = Array.from({ length: count }, (_, i) => {
      const index = (args.page - 1) * 50 + i;
      const type = pick(STOCK_MOVEMENT_TYPES, noise(index, 7) === 0 ? 5 : index % 4 === 0 ? 1 : 0);
      const quantity = type === "sales" ? -(1 + noise(index, 3)) : 2 + noise(index, 10);
      return {
        id: `mv-${args.inventory_id}-${index + 1}`,
        at: jakartaIso(addIsoDays(FIXTURE_TODAY, -Math.floor(index / 4)), 8 + (index % 10), 30),
        type,
        type_label: stockMovementLabel(type),
        quantity,
        balance: Math.max(0, stock + index),
        note: type === "adjustment-plus" ? "Stok opname" : "",
        by: type === "sales" ? "Kasir A" : "Staf Gudang A",
        sales_id: type === "sales" ? String(900_000 + index) : null,
      };
    });
    return {
      ...meta(args.outlet_id),
      inventory_id: args.inventory_id,
      product_name: item ? item.name.replace(" - ", "-") : "Produk-Reguler",
      stock,
      page: args.page,
      movements,
      next_page: args.page < HISTORY_PAGES ? args.page + 1 : null,
    };
  },

  stock_velocity: (args) => {
    const item = STOCK_CATALOG.find((row) => row.inventory_id === args.inventory_id);
    const stock = item?.stock ?? 12;
    const sold = 45;
    const refunded = 1;
    const net = sold - refunded;
    const dailyRate = round2(net / 30);
    return {
      ...meta(args.outlet_id),
      inventory_id: args.inventory_id,
      stock,
      window_days: 30,
      sold,
      refunded,
      net_sold: net,
      daily_rate: dailyRate,
      days_of_cover: dailyRate > 0 ? round2(stock / dailyRate) : null,
      oldest_scanned_at: jakartaIso(addIsoDays(FIXTURE_TODAY, -31), 7, 0),
    };
  },

  show_purchase_orders: (args) => {
    const statusFilter = args.status ?? "semua";
    const scanned = statusFilter === "semua" ? purchasePage(1).rows : [...purchasePage(1).rows, ...purchasePage(2).rows];
    const statusCounts: Record<string, number> = {};
    for (const row of scanned) statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1;
    return {
      view: "pembelian",
      ...meta(args.outlet_id),
      status_filter: statusFilter,
      rows: statusFilter === "semua" ? scanned : scanned.filter((row) => row.status === statusFilter),
      status_counts: statusCounts,
      scanned_rows: scanned.length,
      total_rows: PURCHASE_TOTAL,
      next_page: statusFilter === "semua" ? 2 : null,
    };
  },

  purchase_orders_page: (args) => ({ ...meta(args.outlet_id), page: args.page, ...purchasePage(args.page) }),

  purchase_order_items: (args) => {
    const items = [
      { product: "Produk 1", variant: "Reguler", quantity: 10, received: 10, unit: "pcs", price: 12_000 },
      { product: "Produk 2", variant: "Besar", quantity: 6, received: 4, unit: "pcs", price: 18_500 },
      { product: "Kopi 3", variant: "", quantity: 2.5, received: 2.5, unit: "kg", price: 95_000 },
    ].map((item) => ({ ...item, subtotal: Math.round(item.quantity * item.price) }));
    return {
      ...meta(args.outlet_id),
      purchase_id: args.purchase_id,
      items,
      total: items.reduce((sum, item) => sum + item.subtotal, 0),
    };
  },

  show_transactions: (args) => {
    const days = daysOf(args.start_date, args.end_date, 7)
      .reverse()
      .map((date, i) => transactionDay(date, i));
    const loaded = days.flatMap((day) => day.items);
    const totals = new Map<string, { payment_mode: string; count: number; amount: number }>();
    for (const item of loaded) {
      const entry = totals.get(item.payment_mode) ?? { payment_mode: item.payment_mode, count: 0, amount: 0 };
      entry.count += 1;
      if (item.status !== 3) entry.amount += item.amount;
      totals.set(item.payment_mode, entry);
    }
    return {
      view: "transaksi",
      ...meta(args.outlet_id),
      range: { start_date: args.start_date, end_date: args.end_date },
      customer: args.customer_id === undefined ? null : { id: args.customer_id, name: "Pelanggan A" },
      days,
      total_transactions: loaded.length + 24,
      loaded_transactions: loaded.length,
      loaded_amount: loaded.filter((item) => item.status !== 3).reduce((sum, item) => sum + item.amount, 0),
      payment_mode_totals: [...totals.values()],
      next_page: 2,
    };
  },

  transactions_page: (args) => {
    const days = [0, 1].map((k) => {
      const date = addIsoDays(args.end_date, -(7 + (args.page - 2) * 2 + k));
      return transactionDay(date, 10 * args.page + k);
    });
    return { ...meta(args.outlet_id), page: args.page, days, next_page: args.page < 3 ? args.page + 1 : null };
  },

  order_detail: (args) => {
    const credit = args.sales_id % 5 === 0;
    const items = [
      { product: "Produk 1", variant: "Reguler", quantity: 2, price: 15_000 },
      { product: "Kopi 3", variant: null, quantity: 1, price: 22_000 },
    ].map((item) => ({ ...item, total: item.quantity * item.price }));
    const totalBill = items.reduce((sum, item) => sum + item.total, 0);
    const paid = credit ? 20_000 : 60_000;
    return {
      ...meta(undefined),
      sales_id: args.sales_id,
      invoice: `INV/20260915/${String(args.sales_id % 10_000).padStart(4, "0")}`,
      status: credit ? 4 : 2,
      status_label: credit ? "Kredit belum lunas" : salesStatusLabel(2),
      settled_at: credit ? null : "2026-09-15T02:32:00.000Z",
      total_bill: totalBill,
      total_paid: paid,
      change: credit ? 0 : paid - totalBill,
      items,
      payments: [{ name: credit ? "Uang muka" : "Tunai", mode: "cash", amount: paid, paid_at: "2026-09-15T02:32:00.000Z" }],
      customer: credit ? { id: 3001, name: "Pelanggan A", mobile: "0800-0000-0001" } : null,
      credit: credit ? { period: 30, unit: "hari", due_date: "2026-10-15", total: totalBill, remaining: totalBill - paid } : null,
      cashier: "Kasir A",
    };
  },

  show_customer_debts: (args) => {
    const buckets = AGING_BUCKET_KEYS.map((key, i) => {
      const members = DEBT_CUSTOMERS.filter((customer) => customer.oldest_bucket === key);
      const creditTotal = members.reduce((sum, customer) => sum + customer.credit_total, 0);
      return {
        key,
        label: AGING_BUCKET_LABEL[key],
        invoices: members.reduce((sum, customer) => sum + customer.invoices, 0),
        customers: members.length,
        credit_total: creditTotal,
        receivable: Math.round(creditTotal * (i < 3 ? 0.8 : 1)),
      };
    });
    const overdue = DEBT_CUSTOMERS.filter((customer) => customer.overdue_invoices > 0);
    const customers = [...DEBT_CUSTOMERS].sort(
      (a, b) => Number(b.overdue_invoices > 0) - Number(a.overdue_invoices > 0) || b.credit_total - a.credit_total,
    );
    return {
      view: "piutang",
      ...meta(args.outlet_id),
      as_of: FIXTURE_TODAY,
      summary: {
        receivable_total: buckets.reduce((sum, bucket) => sum + bucket.receivable, 0),
        customers: DEBT_CUSTOMERS.length,
        open_invoices: DEBT_CUSTOMERS.reduce((sum, customer) => sum + customer.invoices, 0),
        credit_total: DEBT_CUSTOMERS.reduce((sum, customer) => sum + customer.credit_total, 0),
        overdue_invoices: overdue.reduce((sum, customer) => sum + customer.overdue_invoices, 0),
        overdue_customers: overdue.length,
      },
      buckets,
      customers,
      focus_customer_id: args.customer_id ?? null,
    };
  },

  customer_debt_detail: (args) => {
    const index = Math.max(0, (args.customer_id - 3001) % LETTERS.length);
    const invoices = [0, 1, 2].map((k) => {
      const saleDate = addIsoDays(FIXTURE_TODAY, -(10 + k * 30));
      const dueDate = addIsoDays(saleDate, 30);
      const daysOverdue = isoDaysBetween(dueDate, FIXTURE_TODAY);
      const total = 150_000 + k * 50_000;
      const paid = k * 25_000;
      return {
        sales_id: 950_000 + args.customer_id * 10 + k,
        invoice: `INV/KREDIT/${args.customer_id}-${k + 1}`,
        sale_date: saleDate,
        due_date: dueDate,
        days_overdue: daysOverdue > 0 ? daysOverdue : null,
        bucket: pick(AGING_BUCKET_KEYS, k === 0 ? 1 : 2),
        total,
        paid,
        remaining: total - paid,
        payments: paid > 0 ? [{ name: "Tunai", amount: paid, paid_at: jakartaIso(addIsoDays(saleDate, 7), 11, 0) }] : [],
      };
    });
    return {
      ...meta(args.outlet_id),
      customer: {
        id: args.customer_id,
        name: `Pelanggan ${pick(LETTERS, index)}`,
        mobile: `0800-0000-${String(index + 1).padStart(4, "0")}`,
      },
      invoices,
      totals: {
        total: invoices.reduce((sum, invoice) => sum + invoice.total, 0),
        paid: invoices.reduce((sum, invoice) => sum + invoice.paid, 0),
        remaining: invoices.reduce((sum, invoice) => sum + invoice.remaining, 0),
      },
    };
  },
};

/** One valid argument object per tool, used by tests and the smoke test. */
export const SAMPLE_ARGS: { [N in ToolName]: ToolInput<N> } = {
  show_sales_dashboard: { start_date: "2026-09-09", end_date: FIXTURE_TODAY },
  show_product_ranking: { start_date: "2026-09-09", end_date: FIXTURE_TODAY, order: "terlaris" },
  product_ranking_page: { start_date: "2026-09-09", end_date: FIXTURE_TODAY, order: "terlaris", page: 2 },
  show_stock_browser: { search: "Kopi" },
  stock_page: { page: 2 },
  stock_history: { inventory_id: 5003, page: 1 },
  stock_velocity: { inventory_id: 5003 },
  show_purchase_orders: { status: "semua" },
  purchase_orders_page: { page: 2 },
  purchase_order_items: { purchase_id: "70001" },
  show_transactions: { start_date: FIXTURE_TODAY, end_date: FIXTURE_TODAY },
  transactions_page: { start_date: "2026-09-01", end_date: FIXTURE_TODAY, page: 2 },
  order_detail: { sales_id: 900_005 },
  show_customer_debts: {},
  customer_debt_detail: { customer_id: 3002 },
};
