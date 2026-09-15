import { createMcpHandler } from "agents/mcp/server";
import { describe, expect, it } from "vitest";
import type { AuthPrincipal } from "../../src/auth/verify";
import { createManujujayaServer } from "../../src/mcp/server";
import { listExposedOperations } from "../../src/registry/operations";
import { APP_TOOL, VIEW_MARKER, VIEW_TOOL, VIEWS, viewResourceUri } from "../../src/widgets/contract";
import {
  createApprovalsHarness,
  createFakeDispatcher,
  readPrincipal,
  testEnv,
  unusedSessions,
  writePrincipal,
} from "../stubs/codemode-harness";
import { createFakeWorkerLoader } from "../stubs/fake-worker-loader";
import { readWire, rpcRequest } from "../stubs/mcp-wire";

const WIDGET_TOOLS = [...VIEWS.map((view) => VIEW_TOOL[view]), ...Object.values(APP_TOOL)];

/** qasir://capabilities must describe what this caller actually gets, not a hard-coded list. */
async function capabilities(opts: { mutations: boolean; principal: AuthPrincipal; approvals?: boolean; widgets?: boolean }) {
  const handler = createMcpHandler(
    () =>
      createManujujayaServer({
        env: testEnv({
          LOADER: createFakeWorkerLoader(),
          ENABLE_MUTATIONS: opts.mutations ? "true" : "false",
          ENABLE_WIDGETS: opts.widgets === false ? "false" : "true",
        }),
        sessions: unusedSessions,
        principal: opts.principal,
        readDoc: async () => null,
        dispatcher: createFakeDispatcher({}),
        approvals: opts.approvals === false ? undefined : createApprovalsHarness().stub,
        widgetHtml: `<div data-view="${VIEW_MARKER}"></div>`,
      }),
    { route: "/mcp", legacy: "reject" },
  );
  const res = await readWire(await handler.fetch(rpcRequest("resources/read", { uri: "qasir://capabilities" })));
  const contents = res.body.result!.contents as Array<{ text: string }>;
  return JSON.parse(contents[0]!.text) as {
    protocol: string;
    tools: string[];
    operations: { exposed: number };
    mutations: { enabled: boolean; toolAvailable: boolean };
    codeMode: { maxRequests: number; maxConcurrency: number; timeoutMs: number };
    widgets: { enabled: boolean; views: string[]; resourceUris: string[] };
  };
}

describe("qasir://capabilities", () => {
  it("read-only production default: no mutation tool, mutations disabled", async () => {
    const caps = await capabilities({ mutations: false, principal: writePrincipal });
    expect(caps.protocol).toBe("2026-07-28");
    expect(caps.tools).toEqual(["search", "execute", ...WIDGET_TOOLS]);
    expect(caps.mutations).toMatchObject({ enabled: false, toolAvailable: false });
    expect(caps.operations.exposed).toBe(listExposedOperations().length);
    expect(caps.codeMode).toMatchObject({ maxRequests: 50, maxConcurrency: 4, timeoutMs: 30_000 });
  });

  it("mutations enabled but caller lacks qasir:write: tool not offered", async () => {
    const caps = await capabilities({ mutations: true, principal: readPrincipal });
    expect(caps.tools).toEqual(["search", "execute", ...WIDGET_TOOLS]);
    expect(caps.mutations).toMatchObject({ enabled: true, toolAvailable: false });
  });

  it("mutations enabled without an approvals binding: tool not offered", async () => {
    const caps = await capabilities({ mutations: true, principal: writePrincipal, approvals: false });
    expect(caps.tools).toEqual(["search", "execute", ...WIDGET_TOOLS]);
  });

  it("mutations enabled for a writer: execute_mutation is listed", async () => {
    const caps = await capabilities({ mutations: true, principal: writePrincipal });
    expect(caps.tools).toEqual(["search", "execute", "execute_mutation", ...WIDGET_TOOLS]);
    expect(caps.mutations).toMatchObject({ enabled: true, toolAvailable: true });
  });

  it("lists the widget views and their ui:// resources", async () => {
    const caps = await capabilities({ mutations: false, principal: readPrincipal });
    expect(caps.widgets).toEqual({ enabled: true, views: [...VIEWS], resourceUris: VIEWS.map(viewResourceUri) });
  });

  it("ENABLE_WIDGETS=false: no widget tools or views", async () => {
    const caps = await capabilities({ mutations: false, principal: readPrincipal, widgets: false });
    expect(caps.tools).toEqual(["search", "execute"]);
    expect(caps.widgets).toEqual({ enabled: false, views: [], resourceUris: [] });
  });
});
