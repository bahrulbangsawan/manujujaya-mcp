import { createContext, useContext } from "react";
import { TOOL_SCHEMAS, toolErrorBody, type ToolInput, type ToolName, type ToolOutput } from "../../../src/widgets/contract";

/** A failed tool call, carrying the server's error `code` (or a widget-side code such as CONTRACT_MISMATCH). */
export class ToolCallError extends Error {
  readonly code: string;
  readonly connectUrl: string | undefined;

  constructor(body: { code: string; message: string; connect_url?: string }) {
    super(body.message);
    this.name = "ToolCallError";
    this.code = body.code;
    this.connectUrl = body.connect_url;
  }
}

export interface HostInfo {
  theme: "light" | "dark";
  displayMode: "inline" | "fullscreen" | "pip";
  canFullscreen: boolean;
  canSendMessage: boolean;
  canUpdateContext: boolean;
  canOpenLinks: boolean;
}

/** Everything a view needs from its host. Implemented by the ext-apps App and by the dev/test mock. */
export interface Bridge {
  readonly host: HostInfo;
  callTool<N extends ToolName>(name: N, args: ToolInput<N>, signal?: AbortSignal): Promise<ToolOutput<N>>;
  openLink(url: string): Promise<void>;
  sendMessage(text: string): Promise<void>;
  updateContext(text: string): Promise<void>;
  toggleFullscreen(): Promise<void>;
}

/** The subset of CallToolResult the widget reads. */
export interface ToolResultLike {
  structuredContent?: unknown;
  isError?: boolean;
  content?: Array<{ type: string; text?: string }>;
}

const SDK_INPUT_ERROR_PREFIX = "Input validation error";

function errorBodyFromText(text: string): { code: string; message: string; connect_url?: string } {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    try {
      const body = toolErrorBody.safeParse(JSON.parse(trimmed));
      if (body.success) return body.data;
    } catch {
      // Not JSON; fall through to the text rules.
    }
  }
  if (trimmed.startsWith(SDK_INPUT_ERROR_PREFIX)) return { code: "INVALID_INPUT", message: trimmed };
  return { code: "UPSTREAM_ERROR", message: trimmed === "" ? "Tool call failed" : trimmed };
}

/**
 * isError ⇒ throw ToolCallError (JSON {code,message,connect_url?} body; SDK "Input validation error…" text ⇒
 * INVALID_INPUT; other text ⇒ UPSTREAM_ERROR). Success ⇒ structuredContent parsed with the tool's contract
 * schema (unknown fields stripped); a mismatch ⇒ ToolCallError CONTRACT_MISMATCH.
 */
export function parseToolResult<N extends ToolName>(name: N, result: ToolResultLike): ToolOutput<N> {
  if (result.isError) {
    const text = result.content?.find((block) => block.type === "text" && typeof block.text === "string")?.text ?? "";
    throw new ToolCallError(errorBodyFromText(text));
  }
  const parsed = TOOL_SCHEMAS[name].output.safeParse(result.structuredContent);
  if (!parsed.success) {
    const paths = parsed.error.issues
      .slice(0, 3)
      .map((issue) => issue.path.map(String).join(".") || "(root)")
      .join(", ");
    throw new ToolCallError({ code: "CONTRACT_MISMATCH", message: `${name} returned unexpected data at ${paths}` });
  }
  return parsed.data as ToolOutput<N>;
}

/** Normalizes anything a host call can throw into a ToolCallError. */
export function toToolCallError(err: unknown): ToolCallError {
  if (err instanceof ToolCallError) return err;
  const code = typeof err === "object" && err !== null ? (err as { code?: unknown }).code : undefined;
  const message = err instanceof Error ? err.message : String(err);
  if (code === "REQUEST_TIMEOUT") return new ToolCallError({ code: "UPSTREAM_TIMEOUT", message });
  return new ToolCallError({ code: "UPSTREAM_ERROR", message });
}

export const BridgeContext = createContext<Bridge | null>(null);

export function useBridge(): Bridge {
  const bridge = useContext(BridgeContext);
  if (!bridge) throw new Error("useBridge must be used inside <BridgeContext.Provider>");
  return bridge;
}
