import { createMcpHandler } from "agents/mcp/server";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { MutationApprovalsDO } from "./approvals/mutation-approvals";
import { authenticateRequest, type AuthPrincipal } from "./auth/verify";
import {
  createSessionProvider,
  handleConnectRoutes,
} from "./connect/routes";
import { BUNDLED_DOCS } from "./docs/bundled";
import { AppError } from "./errors/codes";
import { createManujujayaServer } from "./mcp/server";
import { log } from "./observability/log";
import { QasirSessionsDO } from "./session/qasir-sessions-do";

export { MutationApprovalsDO, QasirSessionsDO };

function buildAuthInfo(principal: AuthPrincipal): AuthInfo {
  return {
    token: "redacted",
    clientId: principal.clientId ?? principal.subject,
    scopes: principal.scopes,
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    extra: { principal },
  };
}

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/healthz") {
      return Response.json({
        ok: true,
        name: env.MCP_SERVER_NAME,
        version: env.MCP_SERVER_VERSION,
        mutations: env.ENABLE_MUTATIONS === "true",
        protocol: "2026-07-28",
        connect: true,
      });
    }

    const connectRes = await handleConnectRoutes(request, env);
    if (connectRes) return connectRes;

    if (url.pathname === "/mcp") {
      try {
        const principal = await authenticateRequest(request, env);
        const sessions = createSessionProvider(env, principal.subject);
        const approvalId = env.MUTATION_APPROVALS.idFromName(principal.subject);
        const handler = createMcpHandler(
          () =>
            createManujujayaServer({
              env,
              sessions,
              principal,
              readDoc: async (name) => BUNDLED_DOCS[name] ?? null,
              approvals: env.MUTATION_APPROVALS.get(
                approvalId,
              ) as unknown as import("./mcp/server").ServerDeps["approvals"],
            }),
          {
            route: "/mcp",
            legacy: "reject",
          },
        );
        return handler.fetch(request, { authInfo: buildAuthInfo(principal) });
      } catch (err) {
        log("warn", "mcp.auth.failed", {
          err: err instanceof Error ? err.message : String(err),
        });
        if (err instanceof AppError) {
          return Response.json(err.toJSON(), {
            status: err.status,
            headers: {
              "WWW-Authenticate":
                'Bearer realm="manujujaya-mcp", error="invalid_token"',
            },
          });
        }
        return new Response("Unauthorized", { status: 401 });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
