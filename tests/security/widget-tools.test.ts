import { createMcpHandler } from "agents/mcp/server";
import { describe, expect, it } from "vitest";
import type { AuthPrincipal } from "../../src/auth/verify";
import { AppError, ErrorCodes } from "../../src/errors/codes";
import { createManujujayaServer } from "../../src/mcp/server";
import { getOperation, listReadOperations } from "../../src/registry/operations";
import type { QasirSessionProvider } from "../../src/session/types";
import { VIEW_MARKER, WIDGET_TOOL_NAMES, type ToolName } from "../../src/widgets/contract";
import { ALL_WIDGET_TOOLS } from "../../src/widgets/tools";
import { createFakeDispatcher, MERCHANT_SLUG, readPrincipal, testEnv, type FakeDispatcher, type FixtureHandler } from "../stubs/codemode-harness";
import { createFakeWorkerLoader } from "../stubs/fake-worker-loader";
import { readWire, rpcRequest } from "../stubs/mcp-wire";
import { envelope, fakeSessions } from "../stubs/widget-harness";

const NOW = new Date("2026-09-15T03:00:00Z");
const TEST_WIDGET_HTML = `<!doctype html><html><body><div id="root" data-view="${VIEW_MARKER}"></div></body></html>`;
const NO_SCOPES: AuthPrincipal = { subject: "owner", scopes: [], via: "oauth" };

/** Arguments that pass every input schema and date-range rule (today is 2026-09-15 in Jakarta). */
const VALID_ARGS: Record<ToolName, Record<string, unknown>> = {
  show_sales_dashboard: { start_date: "2026-09-08", end_date: "2026-09-14" },
  show_product_ranking: { start_date: "2026-09-08", end_date: "2026-09-14", order: "terlaris" },
  product_ranking_page: { start_date: "2026-09-08", end_date: "2026-09-14", order: "kurang_laris", page: 2 },
  show_stock_browser: { search: "Filter" },
  stock_page: { search: "Filter", page: 2 },
  stock_history: { inventory_id: 25950360, page: 1 },
  stock_velocity: { inventory_id: 25950360 },
  show_purchase_orders: { status: "order_processed" },
  purchase_orders_page: { page: 2 },
  purchase_order_items: { purchase_id: "123456" },
  show_transactions: { start_date: "2026-09-08", end_date: "2026-09-14", customer_id: 11 },
  transactions_page: { start_date: "2026-09-08", end_date: "2026-09-14", customer_id: 11, page: 2 },
  order_detail: { sales_id: 1001 },
  show_customer_debts: { customer_id: 11 },
  customer_debt_detail: { customer_id: 11 },
};

/** The only upstream operations each tool may dispatch (spec §4.2). */
const ALLOWED_OPS: Record<ToolName, readonly string[]> = {
  show_sales_dashboard: [
    "reports.summaries.transaction",
    "reports.sales.trend",
    "reports.summaries.paymentMethods",
    "reports.categories",
    "reports.products",
    "reports.summaries.installment",
  ],
  show_product_ranking: ["reports.products", "reports.categories"],
  product_ranking_page: ["reports.products"],
  show_stock_browser: ["inventories.stockTurnover"],
  stock_page: ["inventories.stockTurnover"],
  stock_history: ["inventories.stockHistories"],
  stock_velocity: ["inventories.stockHistories"],
  show_purchase_orders: ["purchases.list"],
  purchase_orders_page: ["purchases.list"],
  purchase_order_items: ["purchases.items"],
  show_transactions: ["order.histories.web", "customers.get"],
  transactions_page: ["order.histories.web"],
  order_detail: ["order.histories.legacy"],
  show_customer_debts: ["order.histories.installment", "reports.summaries.installment"],
  customer_debt_detail: ["order.histories.installment", "order.histories.legacy", "customers.get"],
};

/** Every exposed read operation answers with an empty but well-formed envelope. */
function emptyReadHandlers(): Record<string, FixtureHandler> {
  return Object.fromEntries(listReadOperations().map((op) => [op.operationId, () => envelope({})]));
}

interface WireSetup {
  principal?: AuthPrincipal;
  sessions?: QasirSessionProvider;
  handlers?: Record<string, FixtureHandler>;
}

interface ToolWireResult {
  isError?: boolean;
  content: Array<{ type: string; text: string }>;
  structuredContent?: Record<string, unknown>;
}

/** tools/call through the production server factory behind the Agents SDK handler. */
async function callTool(name: string, args: Record<string, unknown>, setup: WireSetup = {}) {
  // mutationsEnabled: the fake would even serve writes, so only the tools themselves keep dispatch read-only.
  const dispatcher: FakeDispatcher = createFakeDispatcher(setup.handlers ?? emptyReadHandlers(), { mutationsEnabled: true });
  const handler = createMcpHandler(
    () =>
      createManujujayaServer({
        env: testEnv({ LOADER: createFakeWorkerLoader() }),
        sessions: setup.sessions ?? fakeSessions(),
        principal: setup.principal ?? readPrincipal,
        readDoc: async () => null,
        dispatcher,
        widgetHtml: TEST_WIDGET_HTML,
        now: () => NOW,
      }),
    { route: "/mcp", legacy: "reject" },
  );
  const wire = await readWire(await handler.fetch(rpcRequest("tools/call", { name, arguments: args })));
  expect(wire.body.error, name).toBeUndefined();
  const result = wire.body.result as unknown as ToolWireResult;
  const text = result.content[0]?.text ?? "";
  return { wire, result, text, dispatcher };
}

function errorBody(text: string): Record<string, unknown> {
  return JSON.parse(text) as Record<string, unknown>;
}

const TOOL_NAMES = ALL_WIDGET_TOOLS.map((def) => def.name);

describe("widget tool inventory", () => {
  it("covers every contract tool once, each with a bounded request budget", () => {
    expect([...TOOL_NAMES].sort()).toEqual([...WIDGET_TOOL_NAMES].sort());
    expect(Object.keys(VALID_ARGS).sort()).toEqual([...TOOL_NAMES].sort());
    for (const def of ALL_WIDGET_TOOLS) {
      expect(def.maxRequests, def.name).toBeGreaterThan(0);
      expect(def.maxRequests, def.name).toBeLessThanOrEqual(45);
    }
  });

  it("every allowed operation is a registered, exposed read operation", () => {
    for (const [tool, ops] of Object.entries(ALLOWED_OPS)) {
      for (const id of ops) {
        const op = getOperation(id);
        expect(op, `${tool} → ${id}`).toBeDefined();
        expect(op!.exposed).toBe(true);
        expect(op!.safety).toBe("read");
      }
    }
  });
});

describe("scope enforcement", () => {
  it.each(TOOL_NAMES)("%s without qasir:read returns FORBIDDEN JSON and dispatches nothing", async (name) => {
    const { result, text, dispatcher } = await callTool(name, VALID_ARGS[name], { principal: NO_SCOPES });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    expect(errorBody(text)).toEqual({ code: "FORBIDDEN", message: "Missing scope qasir:read" });
    expect(dispatcher.calls).toHaveLength(0);
  });
});

describe("read-only dispatch", () => {
  it.each(TOOL_NAMES)("%s dispatches only its own read operations, never with allowMutation", async (name) => {
    const { dispatcher } = await callTool(name, VALID_ARGS[name]);
    expect(dispatcher.calls.length, name).toBeGreaterThan(0);
    for (const { req, opts } of dispatcher.calls) {
      expect(ALLOWED_OPS[name], `${name} dispatched ${req.operationId}`).toContain(req.operationId);
      expect(getOperation(req.operationId)?.safety).toBe("read");
      expect(opts?.allowMutation).toBeUndefined();
    }
  });
});

describe("input bounds through the wire", () => {
  const schemaViolations: Array<[ToolName, Record<string, unknown>]> = [
    ["show_sales_dashboard", { start_date: "01-09-2026", end_date: "2026-09-07" }],
    ["show_transactions", { start_date: "2026-09-01", end_date: "2026-13-01" }],
    ["product_ranking_page", { start_date: "2026-09-01", end_date: "2026-09-07", order: "terlaris", page: 501 }],
    ["product_ranking_page", { start_date: "2026-09-01", end_date: "2026-09-07", order: "terlaris", page: 0 }],
    ["transactions_page", { start_date: "2026-09-01", end_date: "2026-09-07", page: 1.5 }],
    ["show_product_ranking", { start_date: "2026-09-01", end_date: "2026-09-07", order: "terbaik" }],
    ["stock_page", { search: "   ", page: 1 }],
    ["stock_page", { search: "x".repeat(101), page: 1 }],
    ["stock_history", { inventory_id: -1, page: 1 }],
    ["stock_velocity", { inventory_id: 2 ** 53 }],
    ["order_detail", { sales_id: "1001" }],
    ["show_purchase_orders", { status: "draft" }],
    ["purchase_order_items", { purchase_id: "../1" }],
    ["show_customer_debts", { outlet_id: "0645203" }],
    ["show_customer_debts", { outlet_id: "1234567890123" }],
    ["customer_debt_detail", {}],
  ];

  it.each(schemaViolations)("%s rejects %j as an input validation error without dispatching", async (name, args) => {
    const { result, text, dispatcher } = await callTool(name, args);
    expect(result.isError).toBe(true);
    expect(text).toMatch(/^Input validation error/);
    expect(dispatcher.calls).toHaveLength(0);
  });

  const rangeViolations: Array<[ToolName, Record<string, unknown>]> = [
    ["show_sales_dashboard", { start_date: "2025-09-14", end_date: "2026-09-15" }],
    ["show_product_ranking", { start_date: "2026-09-08", end_date: "2026-09-07" }],
    ["product_ranking_page", { start_date: "2025-01-01", end_date: "2026-09-15", order: "terlaris", page: 1 }],
    ["show_transactions", { start_date: "2026-09-15", end_date: "2026-09-01" }],
    ["transactions_page", { start_date: "2025-09-14", end_date: "2026-09-15", page: 1 }],
  ];

  it.each(rangeViolations)("%s rejects the reversed or over-366-day range %j with INVALID_INPUT", async (name, args) => {
    const { result, text, dispatcher } = await callTool(name, args);
    expect(result.isError).toBe(true);
    const code = text.startsWith("Input validation error") ? ErrorCodes.INVALID_INPUT : errorBody(text).code;
    expect(code).toBe(ErrorCodes.INVALID_INPUT);
    expect(dispatcher.calls).toHaveLength(0);
  });
});

describe("error surface", () => {
  const failing = (err: unknown): Record<string, FixtureHandler> => ({
    ...emptyReadHandlers(),
    "order.histories.legacy": () => {
      throw err;
    },
  });

  it("an upstream AppError reaches the client as code and message only", async () => {
    const err = new AppError(ErrorCodes.UPSTREAM_ERROR, "Upstream 500", { details: { body: "secret-upstream-detail" } });
    const { result, text } = await callTool("order_detail", { sales_id: 1001 }, { handlers: failing(err) });
    expect(result.isError).toBe(true);
    expect(errorBody(text)).toEqual({ code: "UPSTREAM_ERROR", message: "Upstream 500" });
    expect(text).not.toContain("secret-upstream-detail");
  });

  it("an unexpected exception is replaced by a generic message", async () => {
    const { text } = await callTool("order_detail", { sales_id: 1001 }, { handlers: failing(new Error("boom at /internal/secret-path")) });
    expect(errorBody(text)).toEqual({ code: "UPSTREAM_ERROR", message: "Internal error while running the tool" });
  });

  it("QASIR_AUTH_EXPIRED adds only the Connect URL", async () => {
    const err = new AppError(ErrorCodes.QASIR_AUTH_EXPIRED, "Qasir session expired");
    const { text } = await callTool("order_detail", { sales_id: 1001 }, { handlers: failing(err) });
    expect(errorBody(text)).toEqual({
      code: "QASIR_AUTH_EXPIRED",
      message: "Qasir session expired",
      connect_url: "https://mcp.example.test/connect",
    });
  });
});

describe("credentials never leave the host", () => {
  const API_TOKEN = "TOKEN-must-never-reach-widget-output-0000";
  const CSRF = "CSRF-must-never-reach-widget-output";
  const COOKIE = "qasir_sess=COOKIE-must-never-reach-widget-output";
  const secretSessions: QasirSessionProvider = {
    getSession: async () => ({
      merchantSlug: MERCHANT_SLUG,
      merchantOrigin: `https://${MERCHANT_SLUG}.qasir.id`,
      defaultOutletId: "645203",
      secrets: { apiToken: API_TOKEN, csrfToken: CSRF, cookie: COOKIE },
    }),
    markExpired: () => undefined,
  };

  it.each(TOOL_NAMES)("%s output contains no session secrets", async (name) => {
    const { wire } = await callTool(name, VALID_ARGS[name], { sessions: secretSessions });
    const body = JSON.stringify(wire.body);
    for (const secret of [API_TOKEN, CSRF, "COOKIE-must-never"]) expect(body).not.toContain(secret);
  });
});
