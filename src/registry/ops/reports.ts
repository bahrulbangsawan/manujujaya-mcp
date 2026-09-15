import type { ApiOperation, JsonSchemaLike } from "../types";
import { dateRange, op } from "./helpers";

const salesDate: JsonSchemaLike = {
  type: "object",
  properties: { ...dateRange },
  required: ["start_date", "end_date", "outlet_ids"],
  additionalProperties: false,
};

const salesPaged: JsonSchemaLike = {
  type: "object",
  properties: {
    page: { type: "integer" },
    count: { type: "integer" },
    ...dateRange,
    sort: { type: "string" },
    search: { type: "string" },
    ids: { type: "string" },
    discount_type: { type: "string" },
    trend_type: { type: "string" },
    comparison_start_date: { type: "string" },
    comparison_end_date: { type: "string" },
    country_code: { type: "string" },
    language_code: { type: "string" },
  },
  required: ["start_date", "end_date", "outlet_ids"],
  additionalProperties: false,
};

type Def = {
  id: string;
  path: string;
  title: string;
  tags: string[];
  schema?: JsonSchemaLike;
};

const DEFS: Def[] = [
  { id: "reports.summaries.sales", path: "/api/v5/reports/summaries/sales", title: "Sales summary", tags: ["reports"], schema: salesDate },
  { id: "reports.summaries.transaction", path: "/api/v5/reports/summaries/transaction", title: "Transaction summary", tags: ["reports"], schema: salesDate },
  { id: "reports.summaries.salesInsight", path: "/api/v5/reports/summaries/sales-insight", title: "Sales insight summary", tags: ["reports"], schema: salesDate },
  { id: "reports.summaries.salesTypes", path: "/api/v5/reports/summaries/sales-types", title: "Sales types summary", tags: ["reports"] },
  { id: "reports.summaries.paymentMethods", path: "/api/v5/reports/summaries/payment-methods", title: "Payment methods summary", tags: ["reports"] },
  { id: "reports.summaries.installment", path: "/api/v5/reports/summaries/installment", title: "Installment summary", tags: ["reports"] },
  { id: "reports.summaries.discounts", path: "/api/v5/reports/summaries/discounts", title: "Discounts summary", tags: ["reports"] },
  { id: "reports.sales.trend", path: "/api/v5/reports/sales/trend", title: "Sales trend", tags: ["reports"] },
  { id: "reports.sales.paymentTypes", path: "/api/v5/reports/sales/payment-types", title: "Payment types report", tags: ["reports"], schema: salesDate },
  { id: "reports.orderTypes", path: "/api/v5/reports/order-types", title: "Order types report", tags: ["reports"] },
  { id: "reports.categories", path: "/api/v5/reports/categories", title: "Category sales", tags: ["reports"] },
  { id: "reports.products", path: "/api/v5/reports/products", title: "Product sales", tags: ["reports"] },
  { id: "reports.brands", path: "/api/v5/reports/brands", title: "Brand sales", tags: ["reports"] },
  { id: "reports.employees", path: "/api/v5/reports/employees", title: "Employee sales", tags: ["reports"] },
  { id: "reports.discounts", path: "/api/v5/reports/discounts", title: "Discounts report", tags: ["reports"] },
  { id: "reports.modifiers", path: "/api/v5/reports/modifiers", title: "Modifiers report", tags: ["reports"] },
  { id: "reports.topProducts", path: "/api/v5/reports/top-products", title: "Top products", tags: ["reports"] },
  {
    id: "reports.promoInsight",
    path: "/api/v5/reports/promo-insight",
    title: "Promo insight",
    tags: ["reports"],
    schema: { type: "object", properties: {}, additionalProperties: false },
  },
  { id: "reports.ingredients.summaries", path: "/api/v5/reports/ingredients/summaries", title: "Ingredient stock summaries", tags: ["reports", "inventory"] },
  {
    id: "reports.merchants.visits",
    path: "/api/v5/reports/merchants/visits",
    title: "Microsite visits",
    tags: ["reports", "microsite"],
    schema: {
      type: "object",
      properties: { date_from: { type: "string" }, date_to: { type: "string" } },
      required: ["date_from", "date_to"],
      additionalProperties: false,
    },
  },
  {
    id: "reports.merchants.visitTrending",
    path: "/api/v5/reports/merchants/visit_trending",
    title: "Microsite visit trending",
    tags: ["reports", "microsite"],
    schema: {
      type: "object",
      properties: {
        date_from: { type: "string" },
        date_to: { type: "string" },
        unit: { type: "string" },
      },
      required: ["date_from", "date_to"],
      additionalProperties: false,
    },
  },
];

export const REPORT_OPS: ApiOperation[] = DEFS.map((d) =>
  op({
    operationId: d.id,
    title: d.title,
    description: `${d.title} (observed 200 on crawl; body not snapshotted).`,
    method: "GET",
    host: "pos",
    pathTemplate: d.path,
    sourceDocument: "reports.md",
    evidence: "observed",
    authProfile: "bearer",
    responseKind: "json",
    safety: "read",
    tags: d.tags,
    exposed: true,
    inputSchema: d.schema ?? salesPaged,
  }),
);

export const ATTENDANCE_OPS: ApiOperation[] = [
  op({
    operationId: "attendance.reports",
    title: "Attendance reports",
    description: "Staff attendance report rows.",
    method: "GET",
    host: "pos",
    pathTemplate: "/api/v5/attendance/reports",
    sourceDocument: "reports.md",
    evidence: "observed",
    authProfile: "bearer",
    responseKind: "json",
    safety: "read",
    tags: ["reports", "attendance"],
    exposed: true,
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "integer" },
        ...dateRange,
        sort: { type: "string" },
      },
      required: ["page", "start_date", "end_date", "outlet_ids"],
      additionalProperties: false,
    },
  }),
];
