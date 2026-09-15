import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { AuthPrincipal } from "../../src/auth/verify";
import { AppError, ErrorCodes } from "../../src/errors/codes";
import { outletIdInput, searchInput, STRUCTURED_MAX_CHARS } from "../../src/widgets/contract";
import {
  invokeWidgetTool,
  registerWidgetTool,
  widgetErrorResult,
  WIDGET_TOOL_ANNOTATIONS,
  type ToolContext,
  type WidgetToolDef,
  type WidgetToolDeps,
} from "../../src/widgets/tools/define";
import {
  capRows,
  clipText,
  envelopeData,
  formatQty,
  indoDate,
  isUpstream404,
  joinLines,
  nextPageOf,
  pageInfo,
  recordsAt,
  rupiah,
} from "../../src/widgets/tools/shared";
import { abortableDelay, createFakeDispatcher, readPrincipal, testEnv, type FixtureHandler } from "../stubs/codemode-harness";
import { readWire, rpcRequest } from "../stubs/mcp-wire";
import { callWidgetTool, envelope, fakeSessions, WIDGET_TEST_NOW } from "../stubs/widget-harness";

const SUMMARY = "reports.summaries.installment";
const summaryFixture = { total_customer: 2, total_down_payment: 0, total_receivable: 150_000 };

const probeInput = z.object({
  outlet_id: outletIdInput.optional(),
  search: searchInput.optional(),
  calls: z.number().int().min(0).max(50).default(1),
});

/** App-only probe: resolves the outlet (twice), dispatches `calls` summary requests in parallel. */
function probe(overrides: Partial<WidgetToolDef<typeof probeInput>> = {}): WidgetToolDef<typeof probeInput> {
  return {
    name: "stock_page",
    title: "Probe",
    description: "Widget helper: test probe.",
    input: probeInput,
    maxRequests: 3,
    async run(input, ctx) {
      const outletId = await ctx.outletId(input.outlet_id);
      const again = await ctx.outletId(input.outlet_id);
      const results = await Promise.all(
        Array.from({ length: input.calls }, () =>
          ctx.request({ operationId: SUMMARY, query: { start_date: ctx.today, end_date: ctx.today, outlet_ids: outletId } }),
        ),
      );
      return { text: `Probe selesai: ${results.length} permintaan`, structured: { ...ctx.meta(again), today: ctx.today, results } };
    },
    ...overrides,
  };
}

const summaryHandlers: Record<string, FixtureHandler> = { [SUMMARY]: () => envelope(summaryFixture) };
const noScope: AuthPrincipal = { subject: "owner", scopes: [], via: "oauth" };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("invokeWidgetTool: success path", () => {
  it("returns one text block and structuredContent with meta, today and upstream data", async () => {
    const call = await callWidgetTool(probe(), {}, { handlers: summaryHandlers });
    expect(call.result.isError).toBeUndefined();
    expect(call.result.content).toEqual([{ type: "text", text: "Probe selesai: 1 permintaan" }]);
    expect(call.structured).toEqual({
      outlet_id: "645203",
      generated_at: "2026-09-15T03:00:00.000Z",
      truncated: false,
      truncated_reason: null,
      today: "2026-09-15",
      results: [envelope(summaryFixture)],
    });
  });

  it("dispatches with the call's abort signal and never allowMutation", async () => {
    const call = await callWidgetTool(probe(), { calls: 2 }, { handlers: summaryHandlers });
    expect(call.dispatcher.calls).toHaveLength(2);
    for (const { req, opts } of call.dispatcher.calls) {
      expect(req).toEqual({
        operationId: SUMMARY,
        query: { start_date: "2026-09-15", end_date: "2026-09-15", outlet_ids: "645203" },
      });
      expect(opts?.allowMutation).toBeUndefined();
      expect(opts?.signal).toBeInstanceOf(AbortSignal);
      // The call has finished, so its signal is aborted: nothing can outlive the tool call.
      expect(opts?.signal?.aborted).toBe(true);
    }
  });

  it("computes today in Asia/Jakarta and meta() from the injected clock", async () => {
    let seen: ToolContext | undefined;
    const def = probe({
      async run(_input, ctx) {
        seen = ctx;
        return { text: "ok", structured: ctx.meta("42") };
      },
    });
    const now = new Date("2026-09-14T18:30:00Z");
    const call = await callWidgetTool(def, {}, { handlers: {}, now });
    expect(seen?.now).toBe(now);
    expect(seen?.today).toBe("2026-09-15");
    expect(call.structured).toEqual({
      outlet_id: "42",
      generated_at: "2026-09-14T18:30:00.000Z",
      truncated: false,
      truncated_reason: null,
    });
  });
});

describe("invokeWidgetTool: outlet resolution", () => {
  it("uses outlet_id from the input without reading the session", async () => {
    const sessions = fakeSessions("777");
    const getSession = vi.spyOn(sessions, "getSession");
    const call = await callWidgetTool(probe(), { outlet_id: "123" }, { handlers: summaryHandlers, sessions });
    expect(call.structured?.outlet_id).toBe("123");
    expect(call.dispatcher.calls[0]?.req.query?.outlet_ids).toBe("123");
    expect(getSession).not.toHaveBeenCalled();
  });

  it("falls back to the session's default outlet and reads the session at most once", async () => {
    const sessions = fakeSessions("777");
    const getSession = vi.spyOn(sessions, "getSession");
    const call = await callWidgetTool(probe(), { calls: 2 }, { handlers: summaryHandlers, sessions });
    expect(call.structured?.outlet_id).toBe("777");
    expect(call.dispatcher.calls.map((c) => c.req.query?.outlet_ids)).toEqual(["777", "777"]);
    expect(getSession).toHaveBeenCalledTimes(1);
  });
});

describe("invokeWidgetTool: budget", () => {
  it("stops at maxRequests with RESULT_LIMIT_EXCEEDED", async () => {
    const call = await callWidgetTool(probe(), { calls: 5 }, { handlers: summaryHandlers });
    expect(call.result.isError).toBe(true);
    expect(call.result.structuredContent).toBeUndefined();
    expect(call.error).toEqual({
      code: "RESULT_LIMIT_EXCEEDED",
      message: "Request limit reached: at most 3 upstream requests per widget tool call",
    });
    expect(call.dispatcher.calls.length).toBeLessThanOrEqual(3);
  });

  it("keeps at most 4 upstream requests in flight", async () => {
    const handlers: Record<string, FixtureHandler> = {
      [SUMMARY]: (_req, opts) => abortableDelay(10, opts?.signal).then(() => envelope(summaryFixture)),
    };
    const call = await callWidgetTool(probe({ maxRequests: 12 }), { calls: 12 }, { handlers });
    expect(call.result.isError).toBeUndefined();
    expect(call.dispatcher.calls).toHaveLength(12);
    expect(call.dispatcher.peakInFlight).toBeLessThanOrEqual(4);
    expect(call.dispatcher.peakInFlight).toBe(4);
  });

  it("enforces the cumulative response budget", async () => {
    const handlers: Record<string, FixtureHandler> = { [SUMMARY]: () => envelope({ blob: "x".repeat(3_000) }) };
    const call = await callWidgetTool(probe(), { calls: 3 }, { handlers, limits: { maxResponseChars: 5_000, maxConcurrency: 1 } });
    expect(call.error?.code).toBe("RESULT_LIMIT_EXCEEDED");
    expect(call.error?.message).toBe("Response budget exceeded: at most 5000 characters per widget tool call");
  });

  it("maps the deadline to UPSTREAM_TIMEOUT and aborts in-flight requests", async () => {
    let aborted = false;
    const handlers: Record<string, FixtureHandler> = {
      [SUMMARY]: (_req, opts) =>
        abortableDelay(5_000, opts?.signal).catch((err: unknown) => {
          aborted = true;
          throw err;
        }),
    };
    const call = await callWidgetTool(probe(), {}, { handlers, limits: { timeoutMs: 50 } });
    expect(call.error).toEqual({ code: "UPSTREAM_TIMEOUT", message: "Widget tool timed out after 1 s" });
    expect(aborted).toBe(true);
  });

  it("times out even when run ignores the signal", async () => {
    const def = probe({
      async run(_input, ctx) {
        await new Promise((resolve) => setTimeout(resolve, 1_000));
        return { text: "late", structured: ctx.meta("1") };
      },
    });
    const started = Date.now();
    const call = await callWidgetTool(def, {}, { handlers: {}, limits: { timeoutMs: 50 } });
    expect(call.error?.code).toBe("UPSTREAM_TIMEOUT");
    expect(Date.now() - started).toBeLessThan(900);
  });

  it("refuses requests made after the call has finished", async () => {
    let leaked: ToolContext | undefined;
    const def = probe({
      async run(_input, ctx) {
        leaked = ctx;
        return { text: "ok", structured: ctx.meta("1") };
      },
    });
    const dispatcher = createFakeDispatcher(summaryHandlers);
    const deps: WidgetToolDeps = { env: testEnv(), principal: readPrincipal, sessions: fakeSessions(), dispatcher };
    await invokeWidgetTool(def, deps, probeInput.parse({}));
    const late = leaked!.request({ operationId: SUMMARY, query: { start_date: "2026-09-15", end_date: "2026-09-15", outlet_ids: "1" } });
    await expect(late).rejects.toMatchObject({ code: "INVALID_INPUT", message: "Widget tool call has already finished" });
    expect(dispatcher.calls).toHaveLength(0);
  });
});

describe("invokeWidgetTool: safety and errors", () => {
  it("returns FORBIDDEN JSON without a scope, before any session read or dispatch", async () => {
    const sessions = fakeSessions();
    const getSession = vi.spyOn(sessions, "getSession");
    const call = await callWidgetTool(probe(), { calls: 2 }, { handlers: summaryHandlers, principal: noScope, sessions });
    expect(call.result.isError).toBe(true);
    expect(call.error).toEqual({ code: "FORBIDDEN", message: "Missing scope qasir:read" });
    expect(call.dispatcher.calls).toHaveLength(0);
    expect(getSession).not.toHaveBeenCalled();
  });

  it("refuses non-read operations before dispatching", async () => {
    const def = probe({
      async run(_input, ctx) {
        await ctx.request({ operationId: "purchases.cancel", path: { id: "1" } });
        return { text: "unreachable", structured: ctx.meta("1") };
      },
    });
    const call = await callWidgetTool(def, {}, { handlers: { "purchases.cancel": () => ({ ok: true }) } });
    expect(call.error?.code).toBe("MUTATION_DISABLED");
    expect(call.dispatcher.calls).toHaveLength(0);
  });

  it("adds connect_url for QASIR_AUTH_EXPIRED", async () => {
    const handlers: Record<string, FixtureHandler> = {
      [SUMMARY]: () => {
        throw new AppError(ErrorCodes.QASIR_AUTH_EXPIRED, "Upstream auth failed (401); reconnect at /connect");
      },
    };
    const call = await callWidgetTool(probe(), {}, { handlers });
    expect(call.error).toEqual({
      code: "QASIR_AUTH_EXPIRED",
      message: "Upstream auth failed (401); reconnect at /connect",
      connect_url: "https://mcp.example.test/connect",
    });
  });

  it("adds connect_url when the session itself has expired", async () => {
    const sessions = fakeSessions();
    vi.spyOn(sessions, "getSession").mockRejectedValue(
      new AppError(ErrorCodes.QASIR_AUTH_EXPIRED, "Qasir is not connected; open /connect"),
    );
    const call = await callWidgetTool(probe(), {}, { handlers: summaryHandlers, sessions, env: { PUBLIC_BASE_URL: "https://mcp.example.test/" } });
    expect(call.error?.connect_url).toBe("https://mcp.example.test/connect");
    expect(call.dispatcher.calls).toHaveLength(0);
  });

  it("omits connect_url for every other code", async () => {
    const handlers: Record<string, FixtureHandler> = {
      [SUMMARY]: () => {
        throw new AppError(ErrorCodes.QASIR_RATE_LIMITED, "Upstream rate limited (429)");
      },
    };
    const call = await callWidgetTool(probe(), {}, { handlers });
    expect(call.error).toEqual({ code: "QASIR_RATE_LIMITED", message: "Upstream rate limited (429)" });
    expect(JSON.parse(call.text)).not.toHaveProperty("connect_url");
    const plain = widgetErrorResult(new AppError(ErrorCodes.FORBIDDEN, "Missing scope qasir:read"), testEnv());
    expect(plain).toEqual({ isError: true, content: [{ type: "text", text: '{"code":"FORBIDDEN","message":"Missing scope qasir:read"}' }] });
  });

  it("recognises an AppError that crossed an RPC boundary", () => {
    const crossed = Object.assign(new Error("Stored Qasir credentials are malformed; reconnect at /connect"), {
      name: "AppError",
      code: "QASIR_AUTH_EXPIRED",
    });
    const result = widgetErrorResult(crossed, testEnv());
    const first = result.content[0];
    expect(first?.type === "text" ? JSON.parse(first.text) : null).toEqual({
      code: "QASIR_AUTH_EXPIRED",
      message: "Stored Qasir credentials are malformed; reconnect at /connect",
      connect_url: "https://mcp.example.test/connect",
    });
  });

  it("hides the message of a thrown non-AppError", async () => {
    const def = probe({
      async run() {
        throw new TypeError("boom for Pelanggan A 0800-0000-0001");
      },
    });
    const call = await callWidgetTool(def, {}, { handlers: {} });
    expect(call.error).toEqual({ code: "UPSTREAM_ERROR", message: "Internal error while running the tool" });
    expect(call.text).not.toContain("Pelanggan A");
  });

  it("logs only the error code, never the input", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const handlers: Record<string, FixtureHandler> = {
      [SUMMARY]: () => {
        throw new AppError(ErrorCodes.UPSTREAM_ERROR, "Upstream 500");
      },
    };
    await callWidgetTool(probe(), { search: "Pelanggan A" }, { handlers });
    const lines = warn.mock.calls.map((args) => String(args[0]));
    const entry = lines.map((line) => JSON.parse(line) as Record<string, unknown>).find((e) => e.message === "tool.stock_page.error");
    expect(entry).toMatchObject({ level: "warn", code: "UPSTREAM_ERROR" });
    expect(lines.join("\n")).not.toContain("Pelanggan A");
  });
});

describe("invokeWidgetTool: output caps", () => {
  it("cuts the text block to 2,000 characters ending with …", async () => {
    const def = probe({
      async run(_input, ctx) {
        return { text: "a".repeat(5_000), structured: ctx.meta("1") };
      },
    });
    const call = await callWidgetTool(def, {}, { handlers: {} });
    expect(call.text).toHaveLength(2_000);
    expect(call.text.endsWith("…")).toBe(true);
    expect(call.result.content).toHaveLength(1);
  });

  it("leaves text of exactly 2,000 characters alone", async () => {
    const def = probe({
      async run(_input, ctx) {
        return { text: "b".repeat(2_000), structured: ctx.meta("1") };
      },
    });
    const call = await callWidgetTool(def, {}, { handlers: {} });
    expect(call.text).toBe("b".repeat(2_000));
  });

  it("refuses structuredContent over STRUCTURED_MAX_CHARS with RESULT_LIMIT_EXCEEDED", async () => {
    const def = probe({
      async run(_input, ctx) {
        return { text: "besar", structured: { ...ctx.meta("1"), blob: "x".repeat(STRUCTURED_MAX_CHARS) } };
      },
    });
    const call = await callWidgetTool(def, {}, { handlers: {} });
    expect(call.result.isError).toBe(true);
    expect(call.result.structuredContent).toBeUndefined();
    expect(call.error?.code).toBe("RESULT_LIMIT_EXCEEDED");
    expect(call.error?.message).toMatch(/at most 250000 are allowed$/);
  });
});

describe("registerWidgetTool on the wire", () => {
  const viewDef: WidgetToolDef<typeof probeInput> = probe({
    name: "show_stock_browser",
    title: "Stok",
    description: "Open an interactive stock browser widget (test).",
    view: "stok",
  });
  const appDef = probe();

  function handler(principal: AuthPrincipal = readPrincipal) {
    return createMcpHandler(
      () => {
        const server = new McpServer({ name: "widget-test", version: "0.0.0" }, { capabilities: { tools: { listChanged: false } } });
        const deps: WidgetToolDeps = {
          env: testEnv(),
          principal,
          sessions: fakeSessions(),
          dispatcher: createFakeDispatcher(summaryHandlers),
          now: () => WIDGET_TEST_NOW,
        };
        registerWidgetTool(server, deps, viewDef);
        registerWidgetTool(server, deps, appDef);
        return server;
      },
      { route: "/mcp", legacy: "reject" },
    );
  }

  async function wire(method: string, params: Record<string, unknown> = {}, principal?: AuthPrincipal) {
    return readWire(await handler(principal).fetch(rpcRequest(method, params)));
  }

  type ListedTool = {
    name: string;
    title?: string;
    description?: string;
    annotations?: Record<string, unknown>;
    inputSchema: { properties?: Record<string, unknown> };
    outputSchema?: unknown;
    _meta?: Record<string, unknown>;
  };

  it("lists the view tool with resourceUri (plus legacy key) and the helper as app-only", async () => {
    const tools = (await wire("tools/list")).body.result!.tools as ListedTool[];
    expect(tools.map((t) => t.name)).toEqual(["show_stock_browser", "stock_page"]);
    const [view, app] = tools;
    expect(view!._meta).toEqual({
      ui: { resourceUri: "ui://manujujaya/stok.html" },
      "ui/resourceUri": "ui://manujujaya/stok.html",
    });
    expect(app!._meta).toEqual({ ui: { visibility: ["app"] } });
    for (const tool of tools) {
      expect(tool.annotations).toEqual({ ...WIDGET_TOOL_ANNOTATIONS });
      expect(tool.outputSchema).toBeUndefined();
      expect(Object.keys(tool.inputSchema.properties ?? {}).sort()).toEqual(["calls", "outlet_id", "search"]);
    }
    expect(view!.title).toBe("Stok");
  });

  it("tools/call returns text plus structuredContent with schema defaults applied", async () => {
    const res = await wire("tools/call", { name: "stock_page", arguments: {} });
    const result = res.body.result!;
    expect(result.isError).toBeUndefined();
    expect(result.content).toEqual([{ type: "text", text: "Probe selesai: 1 permintaan" }]);
    expect(result.structuredContent).toMatchObject({ outlet_id: "645203", today: "2026-09-15" });
  });

  it("tools/call without qasir:read is an isError FORBIDDEN result", async () => {
    const res = await wire("tools/call", { name: "stock_page", arguments: {} }, noScope);
    const result = res.body.result!;
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: '{"code":"FORBIDDEN","message":"Missing scope qasir:read"}' }]);
  });

  it("tools/call with out-of-bounds input is rejected by the SDK", async () => {
    const res = await wire("tools/call", { name: "stock_page", arguments: { outlet_id: "0645203" } });
    const result = res.body.result!;
    expect(result.isError).toBe(true);
    const content = result.content as Array<{ text: string }>;
    expect(content[0]!.text).toMatch(/^Input validation error/);
  });
});

describe("shared helpers", () => {
  it("envelopeData returns data or throws UPSTREAM_ERROR", () => {
    expect(envelopeData(envelope({ a: 1 }), "summary")).toEqual({ a: 1 });
    for (const bad of [null, "x", { data: [] }, { data: null }, {}]) {
      expect(() => envelopeData(bad, "summary")).toThrow(
        expect.objectContaining({ code: "UPSTREAM_ERROR", message: "Unexpected summary response" }),
      );
    }
  });

  it("recordsAt returns only records and [] for missing or non-array values", () => {
    expect(recordsAt({ rows: [{ id: 1 }, null, 3, [4], { id: 2 }] }, "rows")).toEqual([{ id: 1 }, { id: 2 }]);
    expect(recordsAt({}, "rows")).toEqual([]);
    expect(recordsAt({ rows: { id: 1 } }, "rows")).toEqual([]);
  });

  it("pageInfo reads the pagination block", () => {
    expect(pageInfo(envelope([], { current_page: 2, page_size: 50, total_page: "5", total_result: 230, next: "/api?page=3" }))).toEqual({
      currentPage: 2,
      totalPage: 5,
      totalResult: 230,
      hasNext: true,
    });
    expect(pageInfo(envelope([], { current_page: 5, total_page: 5, total_result: 230 }))).toEqual({
      currentPage: 5,
      totalPage: 5,
      totalResult: 230,
      hasNext: false,
    });
    expect(pageInfo(envelope([], { next: "" }))?.hasNext).toBe(false);
    expect(pageInfo(envelope([]))).toBeNull();
    expect(pageInfo(null)).toBeNull();
  });

  it("nextPageOf follows next, ignores totals, and guesses from a full page without pagination", () => {
    expect(nextPageOf(envelope([], { current_page: 1, total_page: 1, next: "/p2" }), 1, 101, 100)).toBe(2);
    // total_page says more pages exist, but next is missing: stop.
    expect(nextPageOf(envelope([], { current_page: 3, total_page: 9, total_result: 900 }), 3, 100, 100)).toBeNull();
    expect(nextPageOf(envelope([]), 1, 50, 50)).toBe(2);
    expect(nextPageOf(envelope([]), 1, 49, 50)).toBeNull();
    expect(nextPageOf(envelope([], { next: "/p501" }), 500, 50, 50)).toBeNull();
  });

  it("isUpstream404 matches only the dispatcher's JSON 404 error", () => {
    expect(isUpstream404(new AppError(ErrorCodes.UPSTREAM_ERROR, "Upstream 404"))).toBe(true);
    expect(isUpstream404(Object.assign(new Error("Upstream 404"), { name: "AppError", code: "UPSTREAM_ERROR" }))).toBe(true);
    expect(isUpstream404(new AppError(ErrorCodes.UPSTREAM_ERROR, "Upstream 500"))).toBe(false);
    expect(isUpstream404(new AppError(ErrorCodes.UPSTREAM_ERROR, "Upstream 404 (non-JSON body)"))).toBe(false);
    expect(isUpstream404(new AppError(ErrorCodes.UNSUPPORTED_OPERATION, "Upstream 404"))).toBe(false);
    expect(isUpstream404(new Error("Upstream 404"))).toBe(false);
  });

  it("capRows keeps the longest head that fits", () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Produk ${i}` }));
    const build = (r: typeof rows) => ({ truncated: true, rows: r });
    expect(capRows(rows, 1_000_000, build)).toEqual({ rows, truncated: false });
    const capped = capRows(rows, 500, build);
    expect(capped.truncated).toBe(true);
    expect(JSON.stringify(build(capped.rows)).length).toBeLessThanOrEqual(500);
    expect(JSON.stringify(build(rows.slice(0, capped.rows.length + 1))).length).toBeGreaterThan(500);
    expect(capped.rows).toEqual(rows.slice(0, capped.rows.length));
    expect(capRows(rows, 5, build)).toEqual({ rows: [], truncated: true });
  });

  it("formats rupiah, quantities and Indonesian dates", () => {
    expect(rupiah(1_250_000)).toBe("Rp 1.250.000");
    expect(rupiah(0)).toBe("Rp 0");
    expect(rupiah(1_250_000.6)).toBe("Rp 1.250.001");
    expect(formatQty(1234.567)).toBe("1.234,57");
    expect(formatQty(2)).toBe("2");
    expect(indoDate("2026-09-15")).toBe("15 Sep 2026");
    expect(indoDate("2026-08-02")).toBe("2 Agu 2026");
  });

  it("joinLines drops falsy lines and cuts to maxChars with …", () => {
    expect(joinLines(["Penjualan", null, "", undefined, false, "Laba"])).toBe("Penjualan\nLaba");
    expect(joinLines(["a".repeat(3_000)])).toHaveLength(2_000);
    expect(joinLines(["abcdef", "ghij"], 8)).toBe("abcdef\n…");
    expect(clipText("abc", 3)).toBe("abc");
    expect(clipText("abcd", 3)).toBe("ab…");
  });
});
