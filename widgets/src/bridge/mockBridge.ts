import { TOOL_SCHEMAS, type ToolInput, type ToolName, type ToolOutput } from "../../../src/widgets/contract";
import { FIXTURES } from "../../dev/fixtures";
import { ToolCallError, parseToolResult, type Bridge, type HostInfo } from "./bridge";

export interface MockBridgeOptions {
  latencyMs?: number;
  /** Tool name → error code the call fails with. */
  failWith?: Partial<Record<ToolName, string>>;
  host?: Partial<HostInfo>;
}

/** A Bridge answering from widgets/dev/fixtures.ts, recording what the view asked for. */
export interface MockBridge extends Bridge {
  readonly calls: Array<{ name: ToolName; args: unknown }>;
  readonly openedLinks: string[];
  readonly sentMessages: string[];
  readonly contextUpdates: string[];
}

export const MOCK_CONNECT_URL = "https://widget.example/connect";

function wait(ms: number, signal: AbortSignal | undefined): Promise<void> {
  if (signal?.aborted) return Promise.reject(signal.reason);
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

export function createMockBridge(options: MockBridgeOptions = {}): MockBridge {
  const host: HostInfo = {
    theme: "light",
    displayMode: "inline",
    canFullscreen: true,
    canSendMessage: true,
    canUpdateContext: true,
    canOpenLinks: true,
    ...options.host,
  };
  const calls: MockBridge["calls"] = [];
  const openedLinks: string[] = [];
  const sentMessages: string[] = [];
  const contextUpdates: string[] = [];

  return {
    host,
    calls,
    openedLinks,
    sentMessages,
    contextUpdates,

    async callTool<N extends ToolName>(name: N, args: ToolInput<N>, signal?: AbortSignal): Promise<ToolOutput<N>> {
      calls.push({ name, args });
      await wait(options.latencyMs ?? 0, signal);
      const failCode = options.failWith?.[name];
      if (failCode) {
        throw new ToolCallError({
          code: failCode,
          message: `Mock failure ${failCode}`,
          ...(failCode === "QASIR_AUTH_EXPIRED" ? { connect_url: MOCK_CONNECT_URL } : {}),
        });
      }
      const input = TOOL_SCHEMAS[name].input.safeParse(args);
      if (!input.success) {
        throw new ToolCallError({ code: "INVALID_INPUT", message: `Input validation error: Invalid arguments for tool ${name}` });
      }
      const fixture = FIXTURES[name] as (fixtureArgs: ToolInput<N>) => ToolOutput<N>;
      return parseToolResult(name, { structuredContent: fixture(args) });
    },

    async openLink(url: string): Promise<void> {
      openedLinks.push(url);
    },

    async sendMessage(text: string): Promise<void> {
      sentMessages.push(text);
    },

    async updateContext(text: string): Promise<void> {
      contextUpdates.push(text);
    },

    async toggleFullscreen(): Promise<void> {
      host.displayMode = host.displayMode === "fullscreen" ? "inline" : "fullscreen";
    },
  };
}
