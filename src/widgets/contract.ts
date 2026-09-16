/**
 * Shared contract between the Worker widget tools and the widget SPA.
 * DOM-free and Worker-free: imported by src/widgets/** and widgets/src/**.
 * Changes must be additive (hosts may cache older widget HTML for up to 10 minutes).
 */
import { z } from "zod";

// ── Views and tool names ────────────────────────────────────────────────────

export const VIEWS = ["penjualan", "produk", "stok", "pembelian", "transaksi", "piutang"] as const;
export type ViewName = (typeof VIEWS)[number];

export function viewResourceUri(view: ViewName): string {
  return `ui://manujujaya/${view}.html`;
}

/** MCP Apps constants (ext-apps 2.0.0 values, inlined so the Worker does not depend on the package). */
export const MCP_APP_MIME_TYPE = "text/html;profile=mcp-app";
export const MCP_APP_LEGACY_RESOURCE_URI_KEY = "ui/resourceUri";
/** ChatGPT alias of `_meta.ui.resourceUri`. */
export const OPENAI_OUTPUT_TEMPLATE_KEY = "openai/outputTemplate";
/** ChatGPT: widget `callTool` is denied unless this is true (default false). */
export const OPENAI_WIDGET_ACCESSIBLE_KEY = "openai/widgetAccessible";
/** ChatGPT alias of `_meta.ui.visibility: ["app"]`. */
export const OPENAI_VISIBILITY_KEY = "openai/visibility";

/** Replaced with the view name when a ui:// resource is read. */
export const VIEW_MARKER = "__MJ_VIEW__";

export const VIEW_TOOL = {
  penjualan: "show_sales_dashboard",
  produk: "show_product_ranking",
  stok: "show_stock_browser",
  pembelian: "show_purchase_orders",
  transaksi: "show_transactions",
  piutang: "show_customer_debts",
} as const satisfies Record<ViewName, string>;

export const APP_TOOL = {
  productRankingPage: "product_ranking_page",
  stockPage: "stock_page",
  stockHistory: "stock_history",
  stockVelocity: "stock_velocity",
  purchaseOrdersPage: "purchase_orders_page",
  purchaseOrderItems: "purchase_order_items",
  transactionsPage: "transactions_page",
  orderDetail: "order_detail",
  customerDebtDetail: "customer_debt_detail",
} as const;

export const WIDGET_TOOL_NAMES: readonly string[] = [...Object.values(VIEW_TOOL), ...Object.values(APP_TOOL)];

// ── Constants ───────────────────────────────────────────────────────────────

export const MAX_RANGE_DAYS = 366;
export const STRUCTURED_MAX_CHARS = 250_000;
export const DEBT_SCAN_START_DATE = "2015-01-01";
export const PAGE_SIZE = {
  products: 50,
  categories: 20,
  stock: 50,
  stockHistory: 50,
  purchases: 100,
  transactions: 100,
  installments: 100,
} as const;
export const INSTALLMENT_MAX_PAGES = 12;
export const CUSTOMER_INSTALLMENT_MAX_PAGES = 3;
export const DEBT_DETAIL_MAX_INVOICES = 40;
export const PO_STATUS_SCAN_PAGES = 5;
export const VELOCITY_WINDOW_DAYS = 30;
export const VELOCITY_MAX_PAGES = 5;

// ── Labels (Bahasa Indonesia) ───────────────────────────────────────────────

export const AGING_BUCKET_KEYS = ["0-7", "8-30", "31-90", "91-180", "181-365", "366-730", "gt-730"] as const;
export type AgingBucketKey = (typeof AGING_BUCKET_KEYS)[number];
export const AGING_BUCKET_LABEL: Record<AgingBucketKey, string> = {
  "0-7": "0–7 hari",
  "8-30": "8–30 hari",
  "31-90": "1–3 bulan",
  "91-180": "3–6 bulan",
  "181-365": "6–12 bulan",
  "366-730": "1–2 tahun",
  "gt-730": "> 2 tahun",
};

export const PRODUCT_ORDERS = ["terlaris", "kurang_laris", "omzet_tertinggi", "omzet_terendah"] as const;
export type ProductOrder = (typeof PRODUCT_ORDERS)[number];
export const PRODUCT_ORDER_LABEL: Record<ProductOrder, string> = {
  terlaris: "Terlaris",
  kurang_laris: "Kurang laris",
  omzet_tertinggi: "Omzet tertinggi",
  omzet_terendah: "Omzet terendah",
};
/** Upstream reports.products `sort` token per order. */
export const PRODUCT_ORDER_SORT: Record<ProductOrder, string> = {
  terlaris: "-quantity",
  kurang_laris: "quantity",
  omzet_tertinggi: "-total_gross",
  omzet_terendah: "total_gross",
};

export const PO_STATUSES = ["order_processed", "completed", "canceled"] as const;
export type PoStatus = (typeof PO_STATUSES)[number];
export const PO_STATUS_FILTERS = ["semua", ...PO_STATUSES] as const;
export type PoStatusFilter = (typeof PO_STATUS_FILTERS)[number];
const PO_STATUS_LABEL: Record<string, string> = {
  order_processed: "Diproses",
  completed: "Selesai",
  canceled: "Dibatalkan",
};
export function poStatusLabel(status: string): string {
  return PO_STATUS_LABEL[status] ?? status;
}

const WEB_STATUS_LABEL: Record<number, string> = { 2: "Selesai", 3: "Refund", 4: "Kredit belum lunas", 6: "Refund sebagian" };
export function salesStatusLabel(status: number): string {
  return WEB_STATUS_LABEL[status] ?? `Status ${status}`;
}

export const STOCK_MOVEMENT_TYPES = ["sales", "purchase", "transfer", "adjustment-plus", "adjustment-minus", "refund"] as const;
const STOCK_MOVEMENT_LABEL: Record<string, string> = {
  sales: "Penjualan",
  purchase: "Pembelian",
  transfer: "Transfer",
  "adjustment-plus": "Penyesuaian +",
  "adjustment-minus": "Penyesuaian −",
  refund: "Refund",
};
export function stockMovementLabel(type: string): string {
  return STOCK_MOVEMENT_LABEL[type] ?? type;
}

// ── Input primitives ────────────────────────────────────────────────────────

export const isoDate = z.iso.date();
export const outletIdInput = z
  .string()
  .regex(/^[1-9]\d{0,11}$/, "outlet_id must be a numeric outlet id")
  .describe("Qasir outlet id; defaults to the connected outlet");
export const positiveId = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const pageInput = z.number().int().min(1).max(500);
export const searchInput = z.string().trim().min(1).max(100);
const startDate = isoDate.describe("First day, YYYY-MM-DD (Asia/Jakarta)");
const endDate = isoDate.describe("Last day, YYYY-MM-DD, inclusive; range at most 366 days");

// ── Output primitives ───────────────────────────────────────────────────────

const payloadFields = {
  outlet_id: z.string(),
  generated_at: z.string(),
  truncated: z.boolean(),
  truncated_reason: z.string().nullable(),
};
export const payloadBase = z.object(payloadFields);
function viewPayload<V extends ViewName>(view: V) {
  return z.object({ view: z.literal(view), ...payloadFields });
}

export const dateRange = z.object({ start_date: isoDate, end_date: isoDate });
export const changeSchema = z.object({ percent: z.number().nullable(), direction: z.enum(["up", "down"]).nullable() });
export const nextPage = z.number().int().positive().nullable();

export const categoryRow = z.object({ id: z.number(), name: z.string(), quantity: z.number(), gross: z.number(), collected: z.number() });
export const productRankRow = z.object({
  rank: z.number().int().positive(),
  id: z.number(),
  name: z.string(),
  category: z.string(),
  sku: z.string(),
  quantity: z.number(),
  unit: z.string(),
  gross: z.number(),
  collected: z.number(),
});

// ── penjualan ───────────────────────────────────────────────────────────────

export const salesDashboardInput = z.object({ start_date: startDate, end_date: endDate, outlet_id: outletIdInput.optional() });
export const salesDashboardData = viewPayload("penjualan").extend({
  range: dateRange,
  comparison: dateRange,
  kpis: z.object({
    sales_before_discount: z.number(),
    discount: z.number(),
    gross_sales: z.number(),
    profit: z.number(),
    capital: z.number(),
    tax: z.number(),
    transactions: z.number(),
    quantity: z.number(),
    average_ticket: z.number(),
  }),
  changes: z.object({ gross: changeSchema, profit: changeSchema, transactions: changeSchema, quantity: changeSchema }),
  trend: z.array(
    z.object({ date: isoDate, amount: z.number(), comparison_date: isoDate.nullable(), comparison_amount: z.number().nullable() }),
  ),
  payment_methods: z.array(z.object({ name: z.string(), quantity: z.number(), amount: z.number() })),
  categories: z.array(categoryRow),
  top_products: z.array(productRankRow),
  receivable: z.object({ total: z.number(), customers: z.number() }),
});

// ── produk ──────────────────────────────────────────────────────────────────

export const productRankingInput = z.object({
  start_date: startDate,
  end_date: endDate,
  order: z.enum(PRODUCT_ORDERS).optional().describe("terlaris (default), kurang_laris, omzet_tertinggi or omzet_terendah"),
  outlet_id: outletIdInput.optional(),
});
export const productRankingPageInput = z.object({
  start_date: startDate,
  end_date: endDate,
  order: z.enum(PRODUCT_ORDERS),
  page: pageInput,
  outlet_id: outletIdInput.optional(),
});
export const productRankingData = viewPayload("produk").extend({
  range: dateRange,
  order: z.enum(PRODUCT_ORDERS),
  rows: z.array(productRankRow),
  categories: z.array(categoryRow),
  manual_transactions: z.object({ quantity: z.number(), gross: z.number() }).nullable(),
  next_page: nextPage,
});
export const productRankingPageData = payloadBase.extend({
  order: z.enum(PRODUCT_ORDERS),
  page: z.number().int().positive(),
  rows: z.array(productRankRow),
  next_page: nextPage,
});

// ── stok ────────────────────────────────────────────────────────────────────

export const stockRow = z.object({
  inventory_id: z.number(),
  name: z.string(),
  stock: z.number(),
  price_sell: z.number(),
  last_sale_at: z.string().nullable(),
  days_since_sale: z.number().nullable(),
  last_adjustment_at: z.string().nullable(),
  days_since_adjustment: z.number().nullable(),
});
export const stockBrowserInput = z.object({
  search: searchInput.optional().describe("Product name fragment; pass it whenever the user names a product"),
  outlet_id: outletIdInput.optional(),
});
export const stockPageInput = z.object({ search: searchInput.optional(), page: pageInput, outlet_id: outletIdInput.optional() });
export const stockBrowserData = viewPayload("stok").extend({
  search: z.string().nullable(),
  rows: z.array(stockRow),
  total_rows: z.number().nullable(),
  next_page: nextPage,
});
export const stockPageData = payloadBase.extend({
  search: z.string().nullable(),
  page: z.number().int().positive(),
  rows: z.array(stockRow),
  next_page: nextPage,
});
export const stockHistoryInput = z.object({ inventory_id: positiveId, page: pageInput, outlet_id: outletIdInput.optional() });
export const stockMovement = z.object({
  id: z.string(),
  at: z.string().nullable(),
  type: z.string(),
  type_label: z.string(),
  quantity: z.number(),
  balance: z.number(),
  note: z.string(),
  by: z.string().nullable(),
  sales_id: z.string().nullable(),
});
export const stockHistoryData = payloadBase.extend({
  inventory_id: z.number(),
  product_name: z.string(),
  stock: z.number(),
  page: z.number().int().positive(),
  movements: z.array(stockMovement),
  next_page: nextPage,
});
export const stockVelocityInput = z.object({ inventory_id: positiveId, outlet_id: outletIdInput.optional() });
export const stockVelocityData = payloadBase.extend({
  inventory_id: z.number(),
  stock: z.number(),
  window_days: z.number().int().positive(),
  sold: z.number(),
  refunded: z.number(),
  net_sold: z.number(),
  daily_rate: z.number(),
  days_of_cover: z.number().nullable(),
  oldest_scanned_at: z.string().nullable(),
});

// ── pembelian ───────────────────────────────────────────────────────────────

export const purchaseRow = z.object({
  id: z.string(),
  order_no: z.string(),
  supplier: z.string(),
  total: z.number(),
  status: z.string(),
  status_label: z.string(),
  created_at: z.string().nullable(),
});
export const purchaseOrdersInput = z.object({
  status: z.enum(PO_STATUS_FILTERS).optional().describe("semua (default), order_processed, completed or canceled"),
  outlet_id: outletIdInput.optional(),
});
export const purchaseOrdersData = viewPayload("pembelian").extend({
  status_filter: z.enum(PO_STATUS_FILTERS),
  rows: z.array(purchaseRow),
  status_counts: z.record(z.string(), z.number()),
  scanned_rows: z.number(),
  total_rows: z.number().nullable(),
  next_page: nextPage,
});
export const purchaseOrdersPageInput = z.object({ page: pageInput, outlet_id: outletIdInput.optional() });
export const purchaseOrdersPageData = payloadBase.extend({
  page: z.number().int().positive(),
  rows: z.array(purchaseRow),
  next_page: nextPage,
});
export const purchaseOrderItemsInput = z.object({
  purchase_id: z.string().regex(/^[1-9]\d{0,19}$/),
  outlet_id: outletIdInput.optional(),
});
export const purchaseOrderItemsData = payloadBase.extend({
  purchase_id: z.string(),
  items: z.array(
    z.object({
      product: z.string(),
      variant: z.string(),
      quantity: z.number(),
      received: z.number(),
      unit: z.string(),
      price: z.number(),
      subtotal: z.number(),
    }),
  ),
  total: z.number(),
});

// ── transaksi ───────────────────────────────────────────────────────────────

export const transactionsInput = z.object({
  start_date: startDate,
  end_date: endDate,
  customer_id: positiveId.optional().describe("Only this customer's sales"),
  outlet_id: outletIdInput.optional(),
});
export const transactionsPageInput = transactionsInput.extend({ page: pageInput });
export const transactionItem = z.object({
  sales_id: z.number(),
  time: z.string(),
  invoice: z.string(),
  payment_mode: z.string(),
  amount: z.number(),
  status: z.number(),
  status_label: z.string(),
  sales_type: z.string(),
});
export const transactionDay = z.object({ date: isoDate, daily_amount: z.number(), items: z.array(transactionItem) });
export const transactionsData = viewPayload("transaksi").extend({
  range: dateRange,
  customer: z.object({ id: z.number(), name: z.string().nullable() }).nullable(),
  days: z.array(transactionDay),
  total_transactions: z.number().nullable(),
  loaded_transactions: z.number(),
  loaded_amount: z.number(),
  payment_mode_totals: z.array(z.object({ payment_mode: z.string(), count: z.number(), amount: z.number() })),
  next_page: nextPage,
});
export const transactionsPageData = payloadBase.extend({
  page: z.number().int().positive(),
  days: z.array(transactionDay),
  next_page: nextPage,
});
export const orderDetailInput = z.object({ sales_id: positiveId });
export const orderDetailData = payloadBase.extend({
  sales_id: z.number(),
  invoice: z.string(),
  status: z.number(),
  status_label: z.string(),
  settled_at: z.string().nullable(),
  total_bill: z.number(),
  total_paid: z.number(),
  change: z.number(),
  items: z.array(z.object({ product: z.string(), variant: z.string().nullable(), quantity: z.number(), price: z.number(), total: z.number() })),
  payments: z.array(z.object({ name: z.string(), mode: z.string(), amount: z.number(), paid_at: z.string().nullable() })),
  customer: z.object({ id: z.number(), name: z.string(), mobile: z.string().nullable() }).nullable(),
  credit: z
    .object({ period: z.number().nullable(), unit: z.string(), due_date: isoDate.nullable(), total: z.number(), remaining: z.number() })
    .nullable(),
  cashier: z.string().nullable(),
});

// ── piutang ─────────────────────────────────────────────────────────────────

export const customerDebtsInput = z.object({
  customer_id: positiveId.optional().describe("Highlight and pre-expand this customer"),
  outlet_id: outletIdInput.optional(),
});
export const debtBucket = z.object({
  key: z.enum(AGING_BUCKET_KEYS),
  label: z.string(),
  invoices: z.number(),
  customers: z.number(),
  credit_total: z.number(),
  receivable: z.number(),
});
export const debtCustomer = z.object({
  customer_id: z.number(),
  name: z.string(),
  invoices: z.number(),
  credit_total: z.number(),
  oldest_sale_date: isoDate,
  oldest_bucket: z.enum(AGING_BUCKET_KEYS),
  nearest_due_date: isoDate.nullable(),
  overdue_invoices: z.number(),
  max_days_overdue: z.number(),
});
export const customerDebtsData = viewPayload("piutang").extend({
  as_of: isoDate,
  summary: z.object({
    receivable_total: z.number(),
    customers: z.number(),
    open_invoices: z.number(),
    credit_total: z.number(),
    overdue_invoices: z.number(),
    overdue_customers: z.number(),
  }),
  buckets: z.array(debtBucket),
  customers: z.array(debtCustomer),
  focus_customer_id: z.number().nullable(),
});
export const customerDebtDetailInput = z.object({ customer_id: positiveId, outlet_id: outletIdInput.optional() });
export const debtInvoice = z.object({
  sales_id: z.number(),
  invoice: z.string(),
  sale_date: isoDate,
  due_date: isoDate.nullable(),
  days_overdue: z.number().nullable(),
  bucket: z.enum(AGING_BUCKET_KEYS),
  total: z.number(),
  paid: z.number(),
  remaining: z.number(),
  payments: z.array(z.object({ name: z.string(), amount: z.number(), paid_at: z.string().nullable() })),
});
export const customerDebtDetailData = payloadBase.extend({
  customer: z.object({ id: z.number(), name: z.string(), mobile: z.string().nullable() }),
  invoices: z.array(debtInvoice),
  totals: z.object({ total: z.number(), paid: z.number(), remaining: z.number() }),
});

// ── Errors ──────────────────────────────────────────────────────────────────

export const toolErrorBody = z.object({ code: z.string(), message: z.string(), connect_url: z.string().optional() });
export type ToolErrorBody = z.infer<typeof toolErrorBody>;

// ── Tool registry (names → schemas) ─────────────────────────────────────────

export const TOOL_SCHEMAS = {
  show_sales_dashboard: { input: salesDashboardInput, output: salesDashboardData },
  show_product_ranking: { input: productRankingInput, output: productRankingData },
  product_ranking_page: { input: productRankingPageInput, output: productRankingPageData },
  show_stock_browser: { input: stockBrowserInput, output: stockBrowserData },
  stock_page: { input: stockPageInput, output: stockPageData },
  stock_history: { input: stockHistoryInput, output: stockHistoryData },
  stock_velocity: { input: stockVelocityInput, output: stockVelocityData },
  show_purchase_orders: { input: purchaseOrdersInput, output: purchaseOrdersData },
  purchase_orders_page: { input: purchaseOrdersPageInput, output: purchaseOrdersPageData },
  purchase_order_items: { input: purchaseOrderItemsInput, output: purchaseOrderItemsData },
  show_transactions: { input: transactionsInput, output: transactionsData },
  transactions_page: { input: transactionsPageInput, output: transactionsPageData },
  order_detail: { input: orderDetailInput, output: orderDetailData },
  show_customer_debts: { input: customerDebtsInput, output: customerDebtsData },
  customer_debt_detail: { input: customerDebtDetailInput, output: customerDebtDetailData },
} as const;

export type ToolName = keyof typeof TOOL_SCHEMAS;
export type ToolInput<N extends ToolName> = z.input<(typeof TOOL_SCHEMAS)[N]["input"]>;
export type ToolOutput<N extends ToolName> = z.infer<(typeof TOOL_SCHEMAS)[N]["output"]>;
