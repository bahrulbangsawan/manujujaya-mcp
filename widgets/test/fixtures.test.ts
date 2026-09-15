import { describe, expect, it } from "vitest";
import { TOOL_SCHEMAS, WIDGET_TOOL_NAMES, type ToolName } from "../../src/widgets/contract";
import { ToolCallError } from "../src/bridge/bridge";
import { MOCK_CONNECT_URL, createMockBridge } from "../src/bridge/mockBridge";
import { FIXTURES, SAMPLE_ARGS } from "../dev/fixtures";

const TOOL_NAMES = Object.keys(TOOL_SCHEMAS) as ToolName[];

describe("FIXTURES", () => {
  it("covers all 15 widget tools", () => {
    expect(Object.keys(FIXTURES).sort()).toEqual([...WIDGET_TOOL_NAMES].sort());
    expect(Object.keys(SAMPLE_ARGS).sort()).toEqual([...WIDGET_TOOL_NAMES].sort());
  });

  it.each(TOOL_NAMES)("%s: sample args are valid input and the payload parses with the contract", (name) => {
    const args = SAMPLE_ARGS[name];
    expect(TOOL_SCHEMAS[name].input.safeParse(args).success).toBe(true);
    const payload = (FIXTURES[name] as (a: unknown) => unknown)(args);
    const parsed = TOOL_SCHEMAS[name].output.safeParse(payload);
    expect(parsed.error?.issues ?? []).toEqual([]);
  });

  it("is deterministic", () => {
    expect(FIXTURES.show_customer_debts({})).toEqual(FIXTURES.show_customer_debts({}));
    expect(FIXTURES.stock_page({ page: 2 })).toEqual(FIXTURES.stock_page({ page: 2 }));
  });

  it("contains no real-looking Indonesian phone numbers", () => {
    const all = JSON.stringify(TOOL_NAMES.map((name) => (FIXTURES[name] as (a: unknown) => unknown)(SAMPLE_ARGS[name])));
    expect(all).not.toMatch(/(?:\+62|62|0)8[1-9]\d{6,}/);
  });

  it("pages until next_page is null", () => {
    let page: number | null = 1;
    let rows = 0;
    while (page !== null) {
      const result: ReturnType<typeof FIXTURES.stock_page> = FIXTURES.stock_page({ page });
      rows += result.rows.length;
      page = result.next_page;
    }
    expect(rows).toBe(FIXTURES.show_stock_browser({}).total_rows);
  });
});

describe("createMockBridge", () => {
  it("answers from fixtures and records calls", async () => {
    const bridge = createMockBridge();
    const data = await bridge.callTool("show_stock_browser", { search: "Kopi" });
    expect(data.view).toBe("stok");
    expect(data.rows.every((row) => row.name.includes("Kopi"))).toBe(true);
    expect(bridge.calls).toEqual([{ name: "show_stock_browser", args: { search: "Kopi" } }]);
  });

  it("rejects invalid input like the server", async () => {
    const bridge = createMockBridge();
    await expect(bridge.callTool("stock_page", { page: 501 })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("fails configured tools with a ToolCallError", async () => {
    const bridge = createMockBridge({ failWith: { show_customer_debts: "QASIR_AUTH_EXPIRED" } });
    const err = await bridge.callTool("show_customer_debts", {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ToolCallError);
    expect(err).toMatchObject({ code: "QASIR_AUTH_EXPIRED", connectUrl: MOCK_CONNECT_URL });
  });

  it("honours abort signals during simulated latency", async () => {
    const bridge = createMockBridge({ latencyMs: 1_000 });
    const controller = new AbortController();
    const pending = bridge.callTool("stock_velocity", { inventory_id: 5003 }, controller.signal);
    controller.abort(new Error("cancelled"));
    await expect(pending).rejects.toThrow("cancelled");
  });

  it("records host actions", async () => {
    const bridge = createMockBridge({ host: { canFullscreen: false } });
    await bridge.openLink("https://mcp.example/connect");
    await bridge.sendMessage("Halo");
    await bridge.updateContext("Tampilan: stok");
    await bridge.toggleFullscreen();
    expect(bridge.openedLinks).toEqual(["https://mcp.example/connect"]);
    expect(bridge.sentMessages).toEqual(["Halo"]);
    expect(bridge.contextUpdates).toEqual(["Tampilan: stok"]);
    expect(bridge.host).toMatchObject({ canFullscreen: false, displayMode: "fullscreen" });
  });
});
