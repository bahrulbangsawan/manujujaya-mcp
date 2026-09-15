import { createMcpHandler } from "agents/mcp/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { APPROVAL_TTL_MS } from "../../src/approvals/mutation-approvals";
import type { AuthPrincipal } from "../../src/auth/verify";
import { AppError, ErrorCodes } from "../../src/errors/codes";
import { runExecuteMutation } from "../../src/mcp/mutation-tool";
import { createManujujayaServer } from "../../src/mcp/server";
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const confirmArgs = {
  operationId: "purchases.confirmation",
  body: { purchase_id: "1147217", outlet_id: "645203", items: [{ id: "1", quantity: 2 }] },
};

/** One MCP handler whose approvals DO and dispatcher persist across tools/call requests. */
function mutationServer(opts: { principal?: AuthPrincipal; mutations?: boolean } = {}) {
  const approvals = createApprovalsHarness();
  const dispatcher = createFakeDispatcher(
    {
      "purchases.confirmation": () => ({ code: 200, message: "Berhasil" }),
      "purchases.cancel": () => ({ code: 200, message: "Berhasil" }),
    },
    { mutationsEnabled: true },
  );
  const handler = createMcpHandler(
    () =>
      createManujujayaServer({
        env: testEnv({ LOADER: createFakeWorkerLoader(), ENABLE_MUTATIONS: opts.mutations === false ? "false" : "true" }),
        sessions: unusedSessions,
        principal: opts.principal ?? writePrincipal,
        readDoc: async () => null,
        dispatcher,
        approvals: approvals.stub,
      }),
    { route: "/mcp", legacy: "reject" },
  );
  const callTool = async (args: Record<string, unknown>) => {
    const res = await readWire(await handler.fetch(rpcRequest("tools/call", { name: "execute_mutation", arguments: args })));
    const content = res.body.result?.content as Array<{ text: string }> | undefined;
    const text = content?.[0]?.text ?? "null";
    return { isError: res.body.result?.isError === true, json: parseJson(text), text, raw: res };
  };
  const approve = (id: string, decision: "approve" | "reject" = "approve") =>
    approvals.stub.decide({ id, subject: writePrincipal.subject, decision });
  return { callTool, approve, approvals, dispatcher };
}

function parseJson(text: string): Record<string, unknown> {
  try {
    return (JSON.parse(text) ?? {}) as Record<string, unknown>;
  } catch {
    return {};
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe("execute_mutation approval flow", () => {
  it("does not burn an approval when the dispatcher pre-flight fails", async () => {
    const s = mutationServer();
    const first = await s.callTool(confirmArgs);
    const approvalId = String(first.json.approvalId);
    await s.approve(approvalId);
    const preflight = vi.fn(async () => {
      throw new AppError(ErrorCodes.QASIR_AUTH_EXPIRED, "Missing session");
    });
    (s.dispatcher as { preflight?: typeof preflight }).preflight = preflight;
    const run = await s.callTool({ ...confirmArgs, approvalId });
    expect(run.json).toMatchObject({ code: ErrorCodes.QASIR_AUTH_EXPIRED });
    expect(preflight).toHaveBeenCalledTimes(1);
    expect(s.dispatcher.calls).toHaveLength(0);
    expect(await s.approvals.stub.get(approvalId)).toMatchObject({ status: "approved" });
  });

  it("first call records a pending approval and returns APPROVAL_REQUIRED without dispatching", async () => {
    const s = mutationServer();
    const { isError, json } = await s.callTool(confirmArgs);
    expect(isError).toBe(true);
    expect(json.code).toBe(ErrorCodes.APPROVAL_REQUIRED);
    expect(json.approvalId).toMatch(UUID);
    expect(json.approvalUrl).toBe(`https://mcp.example.test/approvals/${String(json.approvalId)}`);
    expect(new Date(String(json.expiresAt)).toISOString()).toBe(json.expiresAt);
    expect(json.next).toMatch(/approvalUrl/);
    // Preview shows the normalized arguments the owner is approving.
    expect(json.preview).toMatchObject({
      operationId: "purchases.confirmation",
      safety: "write",
      method: "POST",
      body: { purchase_id: "1147217", outlet_id: 645203 },
    });
    expect(s.dispatcher.calls).toHaveLength(0);
    const stored = await s.approvals.stub.get(String(json.approvalId));
    expect(stored).toMatchObject({ status: "pending", subject: "owner", operationId: "purchases.confirmation" });
  });

  it("runs exactly once after the owner approves, with the normalized arguments", async () => {
    const s = mutationServer();
    const first = await s.callTool(confirmArgs);
    const approvalId = String(first.json.approvalId);
    await s.approve(approvalId);

    // Same arguments in a different but equivalent spelling hash identically after validation.
    const run = await s.callTool({ ...confirmArgs, body: { ...confirmArgs.body, outlet_id: 645203 }, approvalId });
    expect(run.isError).toBe(false);
    expect(run.json).toMatchObject({ operationId: "purchases.confirmation", status: 200, data: { message: "Berhasil" } });
    expect(String(run.json.executionId)).toMatch(UUID);
    expect(s.dispatcher.calls).toHaveLength(1);
    expect(s.dispatcher.calls[0]!.opts).toEqual({ allowMutation: true });
    expect(s.dispatcher.calls[0]!.req.body).toEqual({ purchase_id: "1147217", outlet_id: 645203, items: [{ id: "1", quantity: 2 }] });
    expect(await s.approvals.stub.get(approvalId)).toMatchObject({ status: "consumed", executionId: run.json.executionId });

    const reuse = await s.callTool({ ...confirmArgs, approvalId });
    expect(reuse.json).toMatchObject({ code: ErrorCodes.APPROVAL_REQUIRED, message: expect.stringMatching(/consumed/) });
    expect(s.dispatcher.calls).toHaveLength(1);
  });

  it("refuses an approval used with different arguments", async () => {
    const s = mutationServer();
    const first = await s.callTool({ operationId: "purchases.cancel", path: { id: "111" } });
    const approvalId = String(first.json.approvalId);
    await s.approve(approvalId);
    const other = await s.callTool({ operationId: "purchases.cancel", path: { id: "222" }, approvalId });
    expect(other.json).toMatchObject({ code: ErrorCodes.APPROVAL_REQUIRED, message: expect.stringMatching(/does not match/) });
    const otherOp = await s.callTool({ ...confirmArgs, approvalId });
    expect(otherOp.json.code).toBe(ErrorCodes.APPROVAL_REQUIRED);
    expect(s.dispatcher.calls).toHaveLength(0);
  });

  it("refuses pending, rejected and expired approvals", async () => {
    const s = mutationServer();
    const pending = String((await s.callTool(confirmArgs)).json.approvalId);
    expect((await s.callTool({ ...confirmArgs, approvalId: pending })).json).toMatchObject({
      code: ErrorCodes.APPROVAL_REQUIRED,
      message: expect.stringMatching(/pending/),
    });

    const rejected = String((await s.callTool(confirmArgs)).json.approvalId);
    await s.approve(rejected, "reject");
    expect((await s.callTool({ ...confirmArgs, approvalId: rejected })).json.code).toBe(ErrorCodes.APPROVAL_REQUIRED);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now());
    const expiring = String((await s.callTool(confirmArgs)).json.approvalId);
    await s.approve(expiring);
    vi.setSystemTime(Date.now() + APPROVAL_TTL_MS + 1_000);
    expect((await s.callTool({ ...confirmArgs, approvalId: expiring })).json).toMatchObject({
      code: ErrorCodes.APPROVAL_REQUIRED,
      message: expect.stringMatching(/expired/),
    });
    expect(s.dispatcher.calls).toHaveLength(0);
  });

  it("refuses another subject's approval and unknown ids", async () => {
    const s = mutationServer();
    const foreign = await s.approvals.stub.request({
      subject: "someone-else",
      operationId: "purchases.confirmation",
      argsHash: "x",
      preview: { operationId: "purchases.confirmation", title: "t", safety: "write", method: "POST", host: "pos", pathTemplate: "/" },
    });
    const res = await s.callTool({ ...confirmArgs, approvalId: foreign.id });
    expect(res.json).toMatchObject({ code: ErrorCodes.APPROVAL_REQUIRED, message: "Approval not found" });
    const unknown = await s.callTool({ ...confirmArgs, approvalId: crypto.randomUUID() });
    expect(unknown.json.code).toBe(ErrorCodes.APPROVAL_REQUIRED);
    expect(s.dispatcher.calls).toHaveLength(0);
  });

  it("validates arguments before creating an approval", async () => {
    const s = mutationServer();
    const bad = await s.callTool({ operationId: "purchases.confirmation", body: { purchase_id: "1" } });
    expect(bad.json).toMatchObject({ code: ErrorCodes.INVALID_INPUT, message: expect.stringMatching(/outlet_id/) });
    expect((await s.callTool({ operationId: "products.list", query: { page: 1, count: 5 } })).json.code).toBe(
      ErrorCodes.INVALID_INPUT,
    );
    expect((await s.callTool({ operationId: "nope.nothing" })).json.code).toBe(ErrorCodes.UNSUPPORTED_OPERATION);
    expect(s.approvals.spies.request).not.toHaveBeenCalled();
  });

  it("rejects a malformed approvalId at the schema layer", async () => {
    const s = mutationServer();
    const res = await s.callTool({ ...confirmArgs, approvalId: "not-a-uuid" });
    expect(res.isError).toBe(true);
    expect(res.text).toMatch(/approvalId/);
    expect(s.approvals.spies.consume).not.toHaveBeenCalled();
  });
});

describe("execute_mutation gates (handler level, defence in depth)", () => {
  const approvals = () => createApprovalsHarness();
  const dispatcher = () => createFakeDispatcher({}, { mutationsEnabled: true });

  it("requires qasir:write", async () => {
    const a = approvals();
    await expect(
      runExecuteMutation(
        { env: testEnv({ ENABLE_MUTATIONS: "true" }), principal: readPrincipal, approvals: a.stub, dispatcher: dispatcher() },
        confirmArgs,
      ),
    ).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN });
    expect(a.spies.request).not.toHaveBeenCalled();
  });

  it("requires ENABLE_MUTATIONS=true", async () => {
    const a = approvals();
    await expect(
      runExecuteMutation(
        { env: testEnv({ ENABLE_MUTATIONS: "false" }), principal: writePrincipal, approvals: a.stub, dispatcher: dispatcher() },
        confirmArgs,
      ),
    ).rejects.toMatchObject({ code: ErrorCodes.MUTATION_DISABLED });
    expect(a.spies.request).not.toHaveBeenCalled();
  });

  it("fails closed without a usable PUBLIC_BASE_URL", async () => {
    const a = approvals();
    for (const PUBLIC_BASE_URL of ["", "http://mcp.example.test"]) {
      await expect(
        runExecuteMutation(
          { env: testEnv({ ENABLE_MUTATIONS: "true", PUBLIC_BASE_URL }), principal: writePrincipal, approvals: a.stub, dispatcher: dispatcher() },
          confirmArgs,
        ),
      ).rejects.toMatchObject({ code: ErrorCodes.MUTATION_DISABLED });
    }
    expect(a.spies.request).not.toHaveBeenCalled();
  });

  it("is not reachable over MCP when mutations are disabled", async () => {
    const s = mutationServer({ mutations: false });
    const res = await s.callTool(confirmArgs);
    expect(res.raw.body.error?.code).toBe(-32602);
  });

  it("is not reachable over MCP without qasir:write", async () => {
    const s = mutationServer({ principal: readPrincipal });
    const res = await s.callTool(confirmArgs);
    expect(res.raw.body.error?.code).toBe(-32602);
  });
});
