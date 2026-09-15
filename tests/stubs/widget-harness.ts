import type { CallToolResult } from "@modelcontextprotocol/server";
import type { z } from "zod";
import type { AuthPrincipal } from "../../src/auth/verify";
import type { QasirSessionProvider } from "../../src/session/types";
import { toolErrorBody, type ToolErrorBody } from "../../src/widgets/contract";
import { invokeWidgetTool, type WidgetToolDef, type WidgetToolDeps } from "../../src/widgets/tools/define";
import {
  createFakeDispatcher,
  MERCHANT_SLUG,
  readPrincipal,
  testEnv,
  type FakeDispatcher,
  type FixtureHandler,
} from "./codemode-harness";

/** 10:00 on 15 Sep 2026 in Asia/Jakarta. */
export const WIDGET_TEST_NOW = new Date("2026-09-15T03:00:00Z");
export const TEST_OUTLET_ID = "645203";

/** A Qasir JSON envelope as the dispatcher returns it in DispatchResult.data. */
export function envelope(data: unknown, pagination?: Record<string, unknown>): Record<string, unknown> {
  return { code: 200, message: "OK", data, ...(pagination ? { pagination } : {}), trace_id: "test" };
}

/** Session provider with dummy secrets; spy on getSession with vi.spyOn to count reads. */
export function fakeSessions(defaultOutletId: string = TEST_OUTLET_ID): QasirSessionProvider {
  return {
    async getSession() {
      return {
        merchantSlug: MERCHANT_SLUG,
        merchantOrigin: `https://${MERCHANT_SLUG}.qasir.id`,
        defaultOutletId,
        secrets: { apiToken: "test-api-token", csrfToken: "test-csrf-token", cookie: "test_session=1" },
        source: "static",
      };
    },
    markExpired: () => undefined,
  };
}

export interface WidgetCall {
  result: CallToolResult;
  dispatcher: FakeDispatcher;
  /** content[0].text */
  text: string;
  structured: Record<string, unknown> | undefined;
  /** Parsed JSON error body when result.isError. */
  error: ToolErrorBody | undefined;
}

export interface WidgetCallOptions {
  handlers: Record<string, FixtureHandler>;
  now?: Date;
  principal?: AuthPrincipal;
  env?: Partial<Env>;
  sessions?: QasirSessionProvider;
  limits?: WidgetToolDeps["limits"];
}

/**
 * Run a widget tool the way the registered handler does, against the fake
 * dispatcher (real registry validation) and a fixed clock. `rawInput` is parsed
 * with the tool's input schema first, so invalid input throws like the SDK rejects it.
 */
export async function callWidgetTool<S extends z.ZodObject>(
  def: WidgetToolDef<S>,
  rawInput: unknown,
  opts: WidgetCallOptions,
): Promise<WidgetCall> {
  const dispatcher = createFakeDispatcher(opts.handlers);
  const now = opts.now ?? WIDGET_TEST_NOW;
  const deps: WidgetToolDeps = {
    env: testEnv(opts.env),
    principal: opts.principal ?? readPrincipal,
    sessions: opts.sessions ?? fakeSessions(),
    dispatcher,
    now: () => now,
    ...(opts.limits ? { limits: opts.limits } : {}),
  };
  const input: z.output<S> = def.input.parse(rawInput);
  const result = await invokeWidgetTool(def, deps, input);
  const first = result.content[0];
  const text = first?.type === "text" ? first.text : "";
  const error = result.isError ? toolErrorBody.parse(JSON.parse(text)) : undefined;
  const structured = result.structuredContent as Record<string, unknown> | undefined;
  return { result, dispatcher, text, structured, error };
}
