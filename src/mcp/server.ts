import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { AuthPrincipal } from "../auth/verify";
import { requireScope } from "../auth/verify";
import { SCOPES } from "../auth/scopes";
import { runCodemode } from "../codemode/run";
import { createSpecBundle } from "../codemode/spec";
import { QasirDispatcher } from "../dispatcher/qasir-dispatcher";
import { AppError, ErrorCodes } from "../errors/codes";
import { log } from "../observability/log";
import { hashArgs, type ApprovalRecord } from "../approvals/mutation-approvals";
import type { QasirSessionProvider } from "../session/types";
import { registerPrompts } from "./prompts";
import { registerResources } from "./resources";

export interface ServerDeps {
  env: Env;
  sessions: QasirSessionProvider;
  principal: AuthPrincipal;
  readDoc: (name: string) => Promise<string | null>;
  approvals?: {
    get(id: string): Promise<ApprovalRecord | null>;
    consume(input: {
      subject: string;
      operationId: string;
      argsHash: string;
      executionId: string;
    }): Promise<ApprovalRecord>;
  };
}

const codeField = z
  .string()
  .min(1)
  .describe(
    "Async JavaScript function body or async () => {...} using codemode.* APIs",
  );

function textResult(data: unknown) {
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return { content: [{ type: "text" as const, text }] };
}

function errorResult(err: unknown) {
  if (err instanceof AppError) {
    return {
      isError: true as const,
      content: [{ type: "text" as const, text: JSON.stringify(err.toJSON()) }],
    };
  }
  const message = err instanceof Error ? err.message : String(err);
  return {
    isError: true as const,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ code: "UPSTREAM_ERROR", message }),
      },
    ],
  };
}

export function createManujujayaServer(deps: ServerDeps): McpServer {
  const server = new McpServer({
    name: deps.env.MCP_SERVER_NAME || "manujujaya-mcp",
    version: deps.env.MCP_SERVER_VERSION || "0.1.0",
  });

  const merchantSlug = deps.env.MERCHANT_SLUG;
  const spec = createSpecBundle(merchantSlug);
  const mutationsEnabled = deps.env.ENABLE_MUTATIONS === "true";
  const dispatcher = new QasirDispatcher({
    sessions: deps.sessions,
    mutationsEnabled,
  });

  registerResources(server, { merchantSlug, readDoc: deps.readDoc });
  registerPrompts(server);

  server.registerTool(
    "search",
    {
      description: [
        "Search the sanitized Qasir API catalog via sandboxed JS.",
        "Only codemode.spec() is available (openapi + catalog + examples).",
        "No network. Return a small subset.",
        "Example: async () => { const { catalog } = await codemode.spec(); return catalog.filter(o => o.tags.includes('products')).slice(0,10); }",
      ].join(" "),
      inputSchema: { code: codeField },
    },
    async ({ code }) => {
      try {
        requireScope(deps.principal, SCOPES.READ);
        const result = await runCodemode({
          loader: deps.env.LOADER,
          code,
          mode: "search",
          spec,
        });
        return textResult(result);
      } catch (err) {
        log("warn", "tool.search.error", { err: String(err) });
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "execute",
    {
      description: [
        "Execute read-only sandboxed JS with codemode.spec() and",
        "codemode.request({ operationId, path, query, body }).",
        "Never pass method/url/headers. Credentials stay on the host.",
        "Example: async () => { const r = await codemode.request({ operationId: 'products.list', query: { page: 1, count: 5 } }); return r.data; }",
      ].join(" "),
      inputSchema: { code: codeField },
    },
    async ({ code }) => {
      try {
        requireScope(deps.principal, SCOPES.READ);
        const result = await runCodemode({
          loader: deps.env.LOADER,
          code,
          mode: "execute",
          spec,
          dispatcher,
        });
        return textResult(result);
      } catch (err) {
        log("warn", "tool.execute.error", { err: String(err) });
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "execute_mutation",
    {
      description: [
        "Gated mutations. Requires ENABLE_MUTATIONS=true, qasir:write,",
        "and a durable approvalId bound to subject+operationId+args hash.",
      ].join(" "),
      inputSchema: {
        code: codeField,
        operationId: z.string().describe("Primary mutation operationId"),
        args: z.unknown().describe("Args hash basis for approval binding"),
        approvalId: z.string().describe("Durable approval id"),
      },
    },
    async ({ code, operationId, args, approvalId }) => {
      try {
        requireScope(deps.principal, SCOPES.WRITE);
        if (!mutationsEnabled) {
          throw new AppError(
            ErrorCodes.MUTATION_DISABLED,
            "Mutations disabled",
          );
        }
        if (!deps.approvals) {
          throw new AppError(
            ErrorCodes.APPROVAL_REQUIRED,
            "Approvals DO not bound",
          );
        }
        const argsHash = await hashArgs({ operationId, args });
        const executionId = crypto.randomUUID();
        const record = await deps.approvals.get(approvalId);
        if (
          !record ||
          record.subject !== deps.principal.subject ||
          record.operationId !== operationId ||
          record.argsHash !== argsHash ||
          record.status !== "approved"
        ) {
          throw new AppError(
            ErrorCodes.APPROVAL_REQUIRED,
            "Valid approved approval required",
          );
        }
        await deps.approvals.consume({
          subject: deps.principal.subject,
          operationId,
          argsHash,
          executionId,
        });
        const result = await runCodemode({
          loader: deps.env.LOADER,
          code,
          mode: "execute_mutation",
          spec,
          dispatcher,
        });
        return textResult({ executionId, result });
      } catch (err) {
        log("warn", "tool.execute_mutation.error", { err: String(err) });
        return errorResult(err);
      }
    },
  );

  return server;
}
