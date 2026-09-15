import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { APPROVAL_TTL_MS, type MutationApprovalsStub } from "../approvals/mutation-approvals";
import { hasScope, SCOPES } from "../auth/scopes";
import { requireScope, type AuthPrincipal } from "../auth/verify";
import { DEFAULT_CODEMODE_LIMITS, type CodemodeLimits } from "../codemode/budget";
import { runCodemode, type CodemodeDispatcher } from "../codemode/run";
import { createSpecBundle } from "../codemode/spec";
import { QasirDispatcher } from "../dispatcher/qasir-dispatcher";
import { log } from "../observability/log";
import type { QasirSessionProvider } from "../session/types";
import { EXECUTE_MUTATION_TOOL, executeMutationInput, runExecuteMutation } from "./mutation-tool";
import { registerPrompts } from "./prompts";
import { registerResources } from "./resources";
import { errorCodeOf, errorResult, textResult } from "./results";

export interface ServerDeps {
  env: Env;
  sessions: QasirSessionProvider;
  principal: AuthPrincipal;
  readDoc: (name: string) => Promise<string | null>;
  /** Per-subject approvals DO stub; execute_mutation is only offered when bound. */
  approvals?: MutationApprovalsStub;
  /** Defaults to a QasirDispatcher over `sessions`; injectable for tests. */
  dispatcher?: CodemodeDispatcher;
  /** Overrides for Code Mode limits (tests). */
  limits?: Partial<CodemodeLimits>;
}

const codeInput = z.object({
  code: z
    .string()
    .min(1)
    .max(20_000)
    .describe("An async JavaScript arrow function, e.g. async () => { ...; return result; }"),
});

function searchDescription(): string {
  return [
    "Search the Qasir POS dashboard API catalog for this merchant: operationIds, parameters, safety class and OpenAPI 3.1 schemas.",
    "Runs your async JavaScript arrow function in an isolated sandbox with no network; `codemode.spec()` resolves to { catalog, openapi, examples }.",
    "Use it before execute to find the operationId and required inputs, and return only the fields you need.",
    "Example: async () => (await codemode.spec()).catalog.filter(o => o.tags.includes('products')).map(o => ({ id: o.operationId, inputs: o.inputKeys }))",
  ].join(" ");
}

function executeDescription(limits: CodemodeLimits): string {
  return [
    "Read live data from the Qasir POS dashboard API for this merchant (products, stock, sales reports, orders, purchases, customers, suppliers).",
    "Runs your async JavaScript arrow function in an isolated sandbox where `codemode.request({ operationId, path, query })` calls one registered read operation and resolves to { operationId, status, data }.",
    "Write operations, fetch() and method/url/headers are rejected.",
    `Per run: ${limits.maxRequests} requests, ${limits.maxConcurrency} concurrent, ~${Math.round(limits.maxResponseChars / 1_000_000)} MB of responses, ${Math.round(limits.timeoutMs / 1000)} s.`,
    "Example: async () => (await codemode.request({ operationId: 'products.list', query: { page: 1, count: 20 } })).data",
  ].join(" ");
}

function mutationDescription(): string {
  return [
    "Change data through the Qasir POS dashboard API (write or destructive operations such as purchases.confirmation or purchases.cancel), one registered operation per call, only after the merchant owner approves it in a browser.",
    "Call without approvalId first: it returns APPROVAL_REQUIRED with approvalUrl, expiresAt and a preview.",
    `After approval, call again with identical operationId, path, query and body plus approvalId; an approval runs once and expires after ${Math.round(APPROVAL_TTL_MS / 60_000)} minutes.`,
    "Example: { operationId: 'purchases.cancel', path: { id: 123 } }",
  ].join(" ");
}

export function createManujujayaServer(deps: ServerDeps): McpServer {
  // Lists are fixed per request and this stateless server never notifies.
  const server = new McpServer(
    {
      name: deps.env.MCP_SERVER_NAME || "manujujaya-mcp",
      version: deps.env.MCP_SERVER_VERSION || "0.1.0",
    },
    {
      capabilities: {
        tools: { listChanged: false },
        resources: { listChanged: false },
        prompts: { listChanged: false },
      },
    },
  );

  const merchantSlug = deps.env.MERCHANT_SLUG;
  const spec = createSpecBundle(merchantSlug);
  const limits: CodemodeLimits = { ...DEFAULT_CODEMODE_LIMITS, ...deps.limits };
  const mutationsEnabled = deps.env.ENABLE_MUTATIONS === "true";
  const dispatcher: CodemodeDispatcher =
    deps.dispatcher ?? new QasirDispatcher({ sessions: deps.sessions, mutationsEnabled });
  const tools: string[] = [];
  const approvals = deps.approvals;
  const mutationToolAvailable = Boolean(
    mutationsEnabled && approvals && hasScope(deps.principal.scopes, SCOPES.WRITE),
  );

  server.registerTool(
    "search",
    {
      title: "Search Qasir API catalog",
      description: searchDescription(),
      inputSchema: codeInput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ code }) => {
      try {
        requireScope(deps.principal, SCOPES.READ);
        return textResult(await runCodemode({ loader: deps.env.LOADER, code, mode: "search", spec, limits }));
      } catch (err) {
        log("warn", "tool.search.error", { code: errorCodeOf(err) });
        return errorResult(err);
      }
    },
  );
  tools.push("search");

  server.registerTool(
    "execute",
    {
      title: "Read Qasir POS data",
      description: executeDescription(limits),
      inputSchema: codeInput,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    },
    async ({ code }) => {
      try {
        requireScope(deps.principal, SCOPES.READ);
        return textResult(
          await runCodemode({ loader: deps.env.LOADER, code, mode: "execute", spec, dispatcher, limits, mutationToolAvailable }),
        );
      } catch (err) {
        log("warn", "tool.execute.error", { code: errorCodeOf(err) });
        return errorResult(err);
      }
    },
  );
  tools.push("execute");

  // The write surface exists only when enabled, the caller may write, and approvals are bound.
  if (mutationToolAvailable && approvals) {
    server.registerTool(
      EXECUTE_MUTATION_TOOL,
      {
        title: "Run approved Qasir change",
        description: mutationDescription(),
        inputSchema: executeMutationInput,
        annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
      },
      async (input) => {
        try {
          return await runExecuteMutation(
            { env: deps.env, principal: deps.principal, approvals, dispatcher, maxOutputTokens: limits.maxOutputTokens },
            input,
          );
        } catch (err) {
          log("warn", "tool.execute_mutation.error", { code: errorCodeOf(err), operationId: input.operationId });
          return errorResult(err);
        }
      },
    );
    tools.push(EXECUTE_MUTATION_TOOL);
  }

  registerResources(server, {
    merchantSlug,
    readDoc: deps.readDoc,
    capabilities: { tools, mutationsEnabled, limits },
  });
  registerPrompts(server);

  return server;
}
