import type { CallToolResult, McpServer } from "@modelcontextprotocol/server";
import type { z } from "zod";
import { SCOPES } from "../../auth/scopes";
import { requireScope, type AuthPrincipal } from "../../auth/verify";
import { toAppError } from "../../codemode/errors";
import type { CodemodeDispatcher } from "../../codemode/run";
import type { DispatchRequest } from "../../dispatcher/qasir-dispatcher";
import { AppError, ErrorCodes } from "../../errors/codes";
import { errorCodeOf, errorResult, jsonErrorResult } from "../../mcp/results";
import { log } from "../../observability/log";
import { getOperation } from "../../registry/operations";
import type { QasirSessionProvider } from "../../session/types";
import { DEFAULT_WIDGET_LIMITS, RequestBudget, type RequestBudgetLimits } from "../budget";
import {
  MCP_APP_LEGACY_RESOURCE_URI_KEY,
  OPENAI_OUTPUT_TEMPLATE_KEY,
  OPENAI_VISIBILITY_KEY,
  OPENAI_WIDGET_ACCESSIBLE_KEY,
  STRUCTURED_MAX_CHARS,
  viewResourceUri,
  type ToolName,
  type ViewName,
} from "../contract";
import { jakartaToday } from "../qasir-dates";
import { clipText } from "./shared";

export interface WidgetToolDeps {
  env: Env;
  principal: AuthPrincipal;
  sessions: QasirSessionProvider;
  dispatcher: CodemodeDispatcher;
  /** Clock for "today" and generated_at (tests). */
  now?: () => Date;
  /** Overrides for concurrency, deadline and response budget (tests). */
  limits?: Partial<Omit<RequestBudgetLimits, "maxRequests">>;
}

export interface ToolContext {
  readonly now: Date;
  /** Calendar date in Asia/Jakarta for `now`. */
  readonly today: string;
  /** Aborted on deadline, budget exhaustion or when the call finishes. */
  readonly signal: AbortSignal;
  /** input ?? (await deps.sessions.getSession()).defaultOutletId; the session is read at most once per call. */
  outletId(input?: string): Promise<string>;
  /** Budgeted read-only dispatch; resolves to DispatchResult.data. */
  request(req: DispatchRequest): Promise<unknown>;
  /** Payload fields every structured result starts with. */
  meta(outletId: string): { outlet_id: string; generated_at: string; truncated: boolean; truncated_reason: string | null };
}

export interface ToolOutcome {
  text: string;
  structured: Record<string, unknown>;
}

export interface WidgetToolDef<S extends z.ZodObject> {
  name: ToolName;
  title: string;
  description: string;
  input: S;
  maxRequests: number;
  /** Set: model-visible view tool linked to ui://manujujaya/<view>.html. Unset: app-only helper. */
  view?: ViewName;
  run(input: z.output<S>, ctx: ToolContext): Promise<ToolOutcome>;
}

/** Element type for heterogeneous tool arrays. */
export type AnyWidgetToolDef = WidgetToolDef<any>;

export const WIDGET_TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

/** `_meta` for a widget tool: resourceUri (plus ChatGPT aliases) for views, app-only visibility otherwise. */
export function widgetToolMeta(view: ViewName | undefined): Record<string, unknown> {
  if (view) {
    const uri = viewResourceUri(view);
    return {
      ui: { resourceUri: uri, visibility: ["model", "app"] },
      [MCP_APP_LEGACY_RESOURCE_URI_KEY]: uri,
      [OPENAI_OUTPUT_TEMPLATE_KEY]: uri,
      [OPENAI_WIDGET_ACCESSIBLE_KEY]: true,
    };
  }
  return {
    ui: { visibility: ["app"] },
    [OPENAI_VISIBILITY_KEY]: "private",
    [OPENAI_WIDGET_ACCESSIBLE_KEY]: true,
  };
}

/** errorResult(err), plus connect_url for QASIR_AUTH_EXPIRED so the widget can offer the reconnect link. */
export function widgetErrorResult(err: unknown, env: Env): CallToolResult {
  const app = toAppError(err);
  if (app?.code === ErrorCodes.QASIR_AUTH_EXPIRED) {
    const base = env.PUBLIC_BASE_URL.trim().replace(/\/+$/, "");
    return jsonErrorResult({ code: app.code, message: app.message, connect_url: `${base}/connect` });
  }
  return errorResult(err);
}

function assertReadOperation(operationId: string): void {
  const op = getOperation(operationId);
  if (!op || !op.exposed) throw new AppError(ErrorCodes.UNSUPPORTED_OPERATION, `Unknown operationId ${operationId}`);
  if (op.safety !== "read") {
    throw new AppError(ErrorCodes.MUTATION_DISABLED, `${operationId} is a ${op.safety} operation; widget tools are read-only`);
  }
}

function createToolContext(deps: WidgetToolDeps, budget: RequestBudget): ToolContext {
  const now = deps.now?.() ?? new Date();
  let sessionOutlet: Promise<string> | undefined;
  return {
    now,
    today: jakartaToday(now),
    signal: budget.signal,
    outletId(input) {
      if (input) return Promise.resolve(input);
      sessionOutlet ??= deps.sessions.getSession().then((session) => session.defaultOutletId);
      return sessionOutlet;
    },
    async request(req) {
      assertReadOperation(req.operationId);
      // Never allowMutation: the dispatcher refuses non-read operations as a second gate.
      const result = await budget.run((signal) => deps.dispatcher.dispatch(req, { signal }));
      return result.data;
    },
    meta(outletId) {
      return { outlet_id: outletId, generated_at: now.toISOString(), truncated: false, truncated_reason: null };
    },
  };
}

/** Settles only by rejecting, with the signal's reason, when the signal aborts. */
function rejectOnAbort(signal: AbortSignal): Promise<never> {
  const stopped = new Promise<never>((_, reject) => {
    if (signal.aborted) reject(signal.reason);
    else signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
  stopped.catch(() => undefined);
  return stopped;
}

/**
 * The whole widget tool handler: scope check, per-call budget and deadline,
 * run, text cap, structured-content cap, and error mapping with a code-only log.
 */
export async function invokeWidgetTool<S extends z.ZodObject>(
  def: WidgetToolDef<S>,
  deps: WidgetToolDeps,
  input: z.output<S>,
): Promise<CallToolResult> {
  const budget = new RequestBudget({ ...DEFAULT_WIDGET_LIMITS, ...deps.limits, maxRequests: def.maxRequests });
  let stopDeadline: (() => void) | undefined;
  try {
    requireScope(deps.principal, SCOPES.READ);
    stopDeadline = budget.startDeadline();
    const running = def.run(input, createToolContext(deps, budget));
    // If the budget stops the call first, the run settles later with nothing listening.
    running.catch(() => undefined);
    const outcome = await Promise.race([running, rejectOnAbort(budget.signal)]);
    const size = JSON.stringify(outcome.structured).length;
    if (size > STRUCTURED_MAX_CHARS) {
      throw new AppError(
        ErrorCodes.RESULT_LIMIT_EXCEEDED,
        `Widget result is ${size} characters of JSON; at most ${STRUCTURED_MAX_CHARS} are allowed`,
      );
    }
    return {
      content: [{ type: "text", text: clipText(outcome.text) }],
      structuredContent: outcome.structured,
      // ChatGPT's widget callTool path sometimes drops structuredContent and only forwards _meta.
      _meta: { structuredContent: outcome.structured },
    };

  } catch (err) {
    log("warn", `tool.${def.name}.error`, { code: errorCodeOf(err) });
    return widgetErrorResult(err, deps.env);
  } finally {
    stopDeadline?.();
    // Cancels in-flight dispatches and refuses any request the run left behind.
    budget.abort(new AppError(ErrorCodes.INVALID_INPUT, "Widget tool call has already finished"));
  }
}

/** Register one widget tool on the per-request server. No outputSchema: the contract is enforced by tests and the widget. */
export function registerWidgetTool<S extends z.ZodObject>(server: McpServer, deps: WidgetToolDeps, def: WidgetToolDef<S>): void {
  // Widen to the non-generic schema type so the SDK's callback type resolves; it still parses with def.input.
  const inputSchema: z.ZodObject = def.input;
  server.registerTool(
    def.name,
    {
      title: def.title,
      description: def.description,
      inputSchema,
      annotations: { ...WIDGET_TOOL_ANNOTATIONS },
      _meta: widgetToolMeta(def.view),
    },
    (input) => invokeWidgetTool(def, deps, input as z.output<S>),
  );
}
