import { createMcpHandler } from "agents/mcp/server";
import { describe, expect, it } from "vitest";
import type { AuthPrincipal } from "../../src/auth/verify";
import { createManujujayaServer } from "../../src/mcp/server";
import { DOC_NAMES } from "../../src/mcp/resources";
import {
  createApprovalsHarness,
  createFakeDispatcher,
  readPrincipal,
  testEnv,
  unusedSessions,
  writePrincipal,
} from "../stubs/codemode-harness";
import { createFakeWorkerLoader } from "../stubs/fake-worker-loader";
import { MODERN_VERSION, readWire, rpcMessage, rpcRequest, type WireOptions } from "../stubs/mcp-wire";

interface Setup {
  mutations?: boolean;
  principal?: AuthPrincipal;
}

/** The production server factory behind the Agents SDK stateless handler, legacy rejected. */
function handlerFor(setup: Setup = {}) {
  const approvals = createApprovalsHarness();
  return createMcpHandler(
    () =>
      createManujujayaServer({
        env: testEnv({ LOADER: createFakeWorkerLoader(), ENABLE_MUTATIONS: setup.mutations ? "true" : "false" }),
        sessions: unusedSessions,
        principal: setup.principal ?? readPrincipal,
        readDoc: async (name) => `# ${name}\n\nSample phone 081234567890.`,
        dispatcher: createFakeDispatcher({}),
        approvals: approvals.stub,
      }),
    { route: "/mcp", legacy: "reject" },
  );
}

async function call(method: string, params: Record<string, unknown> = {}, options: WireOptions = {}, setup: Setup = {}) {
  return readWire(await handlerFor(setup).fetch(rpcRequest(method, params, options)));
}

type ToolInfo = { name: string; title?: string; description?: string; annotations?: Record<string, unknown>; inputSchema: { required?: string[] } };

describe("2026-07-28 negotiation", () => {
  it("server/discover advertises only 2026-07-28 and no list-changed notifications", async () => {
    const res = await call("server/discover");
    expect(res.status).toBe(200);
    const result = res.body.result!;
    expect(result.supportedVersions).toEqual([MODERN_VERSION]);
    expect(result.capabilities).toEqual({
      tools: { listChanged: false },
      resources: { listChanged: false },
      prompts: { listChanged: false },
    });
    expect(result._meta).toMatchObject({
      "io.modelcontextprotocol/serverInfo": { name: "manujujaya-mcp-test", version: "0.0.0-test" },
    });
  });

  it("rejects an unsupported protocol version with -32022", async () => {
    const res = await call("tools/list", {}, { version: "2025-06-18" });
    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe(-32022);
    expect(res.body.error?.data).toMatchObject({ supported: [MODERN_VERSION], requested: "2025-06-18" });
  });

  it("rejects a legacy initialize handshake", async () => {
    const res = await call(
      "initialize",
      { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "legacy", version: "1" } },
      { bare: true },
    );
    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe(-32022);
  });

  it("serves stateless Streamable HTTP: POST only, no session id, independent requests", async () => {
    const handler = handlerFor();
    const get = await handler.fetch(new Request("http://localhost/mcp", { method: "GET", headers: { host: "localhost", accept: "text/event-stream" } }));
    expect(get.status).toBe(405);
    const first = await handler.fetch(rpcRequest("tools/list"));
    expect(first.status).toBe(200);
    expect(first.headers.get("mcp-session-id")).toBeNull();
    // A second request with no session state from the first is served normally.
    const second = await readWire(await handler.fetch(rpcRequest("prompts/list", {}, { id: 2 })));
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(2);
  });

  it("rejects JSON-RPC batches", async () => {
    const request = new Request("http://localhost/mcp", {
      method: "POST",
      headers: {
        host: "localhost",
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": MODERN_VERSION,
        "mcp-method": "tools/list",
      },
      body: JSON.stringify([rpcMessage("tools/list", {}, { id: 1 }), rpcMessage("prompts/list", {}, { id: 2 })]),
    });
    const res = await readWire(await handlerFor().fetch(request));
    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe(-32600);
  });
});

describe("tools", () => {
  it("read-only callers see search and execute with read-only annotations", async () => {
    const tools = (await call("tools/list")).body.result!.tools as ToolInfo[];
    expect(tools.map((t) => t.name)).toEqual(["search", "execute"]);
    const [search, execute] = tools;
    expect(search!.title).toBeTruthy();
    expect(search!.annotations).toEqual({ readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });
    expect(execute!.annotations).toEqual({ readOnlyHint: true, destructiveHint: false, openWorldHint: true });
    for (const tool of tools) {
      expect(tool.description!.length).toBeLessThanOrEqual(600);
      expect(tool.description).toContain("Qasir POS dashboard API");
      expect(tool.description).toContain("Example:");
      expect(tool.inputSchema.required).toEqual(["code"]);
    }
  });

  it("execute_mutation is listed only with ENABLE_MUTATIONS=true and qasir:write", async () => {
    const names = async (setup: Setup) =>
      ((await call("tools/list", {}, {}, setup)).body.result!.tools as ToolInfo[]).map((t) => t.name);
    expect(await names({ mutations: false, principal: writePrincipal })).not.toContain("execute_mutation");
    expect(await names({ mutations: true, principal: readPrincipal })).not.toContain("execute_mutation");
    const tools = (await call("tools/list", {}, {}, { mutations: true, principal: writePrincipal })).body.result!.tools as ToolInfo[];
    const mutation = tools.find((t) => t.name === "execute_mutation");
    expect(mutation?.annotations).toEqual({ readOnlyHint: false, destructiveHint: true, openWorldHint: true });
    expect(mutation?.description!.length).toBeLessThanOrEqual(600);
    expect(mutation?.inputSchema.required).toEqual(["operationId"]);
  });

  it("calling an unregistered execute_mutation is a protocol error", async () => {
    const res = await call("tools/call", { name: "execute_mutation", arguments: { operationId: "purchases.cancel" } });
    expect(res.body.error?.code).toBe(-32602);
  });

  it("tools/call search runs the sandbox and returns one text block", async () => {
    const res = await call("tools/call", {
      name: "search",
      arguments: { code: "async () => (await codemode.spec()).catalog.find(o => o.operationId === 'products.list').safety" },
    });
    expect(res.body.result?.content).toEqual([{ type: "text", text: "read" }]);
    expect(res.body.result?.isError).toBeUndefined();
  });

  it("tool errors come back as isError results with a typed code", async () => {
    const res = await call("tools/call", {
      name: "execute",
      arguments: { code: "async () => codemode.request({ operationId: 'purchases.cancel', path: { id: 1 } })" },
    });
    expect(res.body.result?.isError).toBe(true);
    const content = res.body.result?.content as Array<{ text: string }>;
    expect(JSON.parse(content[0]!.text)).toMatchObject({ code: "MUTATION_DISABLED" });
  });
});

describe("resources", () => {
  it("lists the static resources plus every document from the template", async () => {
    const resources = (await call("resources/list")).body.result!.resources as Array<{ uri: string }>;
    const uris = resources.map((r) => r.uri);
    expect(uris).toEqual(
      expect.arrayContaining(["qasir://docs/index", "qasir://openapi", "qasir://capabilities", "qasir://coverage"]),
    );
    for (const name of DOC_NAMES) expect(uris).toContain(`qasir://docs/${name}`);
    expect(uris).toHaveLength(4 + DOC_NAMES.length);
  });

  it("lists the qasir://docs/{document} template", async () => {
    const templates = (await call("resources/templates/list")).body.result!.resourceTemplates as Array<{ uriTemplate: string }>;
    expect(templates.map((t) => t.uriTemplate)).toEqual(["qasir://docs/{document}"]);
  });

  it("reads every listed resource", async () => {
    const resources = (await call("resources/list")).body.result!.resources as Array<{ uri: string }>;
    for (const { uri } of resources) {
      const res = await call("resources/read", { uri });
      expect(res.body.error, uri).toBeUndefined();
      const contents = res.body.result!.contents as Array<{ uri: string; text: string }>;
      expect(contents).toHaveLength(1);
      expect(contents[0]!.uri).toBe(uri);
      expect(contents[0]!.text.length).toBeGreaterThan(0);
      if (uri.startsWith("qasir://docs/") && uri !== "qasir://docs/index") {
        expect(contents[0]!.text).not.toContain("081234567890");
      }
    }
  });

  it("returns resource-not-found for unknown documents", async () => {
    for (const uri of ["qasir://docs/nope", "qasir://docs/..%2Fsecrets", "qasir://unknown"]) {
      const res = await call("resources/read", { uri });
      expect(res.body.error?.code, uri).toBe(-32602);
      expect(res.body.error?.data).toEqual({ uri });
    }
  });
});

describe("prompts", () => {
  it("lists the three prompts with argument requirements", async () => {
    const prompts = (await call("prompts/list")).body.result!.prompts as Array<{
      name: string;
      arguments: Array<{ name: string; required: boolean }>;
    }>;
    expect(prompts.map((p) => p.name)).toEqual(["sales_overview", "trace_stock_movement", "review_purchase_orders"]);
    expect(prompts[2]!.arguments).toEqual([expect.objectContaining({ name: "page", required: false })]);
    expect(prompts[0]!.arguments.filter((a) => a.required).map((a) => a.name)).toEqual(["start_date", "end_date"]);
  });

  it("gets review_purchase_orders with no arguments object at all", async () => {
    const res = await call("prompts/get", { name: "review_purchase_orders" });
    expect(res.body.error).toBeUndefined();
    const messages = res.body.result!.messages as Array<{ content: { text: string } }>;
    expect(messages[0]!.content.text).toContain("page=1");
  });

  it("gets prompts with arguments and rejects missing required ones", async () => {
    const ok = await call("prompts/get", { name: "sales_overview", arguments: { start_date: "2026-09-01", end_date: "2026-09-07" } });
    expect((ok.body.result!.messages as Array<{ content: { text: string } }>)[0]!.content.text).toContain("2026-09-01");
    const trace = await call("prompts/get", { name: "trace_stock_movement", arguments: { inventory_id: "25950360" } });
    expect(trace.body.error).toBeUndefined();
    const missing = await call("prompts/get", { name: "sales_overview", arguments: {} });
    expect(missing.body.error?.code).toBe(-32602);
  });
});
