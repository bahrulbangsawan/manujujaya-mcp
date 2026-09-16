import type { App } from "@modelcontextprotocol/ext-apps";
import type { ToolInput, ToolName, ToolOutput } from "../../../src/widgets/contract";
import { ToolCallError, parseToolResult, toToolCallError, type Bridge, type HostInfo } from "./bridge";

export const TOOL_CALL_TIMEOUT_MS = 45_000;

type OpenAiCallTool = (name: string, args: Record<string, unknown>) => Promise<unknown>;

/** ChatGPT injects `window.openai` into the widget iframe; Claude does not. */
const chatgptHost = globalThis as typeof globalThis & { openai?: { callTool?: OpenAiCallTool } };

function openaiCallTool(): OpenAiCallTool | undefined {
  const callTool = chatgptHost.openai?.callTool;
  return typeof callTool === "function" ? callTool.bind(chatgptHost.openai) : undefined;
}

function hostInfoOf(app: App): HostInfo {
  const context = app.getHostContext();
  const capabilities = app.getHostCapabilities();
  return {
    theme: context?.theme === "dark" ? "dark" : "light",
    displayMode: context?.displayMode ?? "inline",
    canFullscreen: context?.availableDisplayModes?.includes("fullscreen") ?? false,
    canSendMessage: Boolean(capabilities?.message),
    canUpdateContext: Boolean(capabilities?.updateModelContext),
    canOpenLinks: Boolean(capabilities?.openLinks),
  };
}

/** Bridge over a connected ext-apps App. `host` is read from the latest host context on every access. */
export function createExtAppsBridge(app: App): Bridge {
  return {
    get host() {
      return hostInfoOf(app);
    },

    async callTool<N extends ToolName>(name: N, args: ToolInput<N>, signal?: AbortSignal): Promise<ToolOutput<N>> {
      const toolArgs: Record<string, unknown> = { ...args };
      const attempts: Array<() => Promise<unknown>> = [
        () => app.callServerTool({ name, arguments: toolArgs }, { timeout: TOOL_CALL_TIMEOUT_MS, ...(signal ? { signal } : {}) }),
      ];
      const openai = openaiCallTool();
      if (openai) attempts.push(() => openai(name, toolArgs));

      let last: unknown;
      for (const attempt of attempts) {
        try {
          return parseToolResult(name, await attempt());
        } catch (err) {
          if (signal?.aborted) throw err;
          last = err;
        }
      }
      throw last instanceof ToolCallError ? last : toToolCallError(last);
    },

    async openLink(url: string): Promise<void> {
      const result = await app.openLink({ url });
      if (result.isError) throw new Error("Host menolak membuka tautan");
    },

    async sendMessage(text: string): Promise<void> {
      const result = await app.sendMessage({ role: "user", content: [{ type: "text", text }] });
      if (result.isError) throw new Error("Host menolak mengirim pesan");
    },

    async updateContext(text: string): Promise<void> {
      if (!app.getHostCapabilities()?.updateModelContext) return;
      await app.updateModelContext({ content: [{ type: "text", text }] });
    },

    async toggleFullscreen(): Promise<void> {
      const current = app.getHostContext()?.displayMode ?? "inline";
      await app.requestDisplayMode({ mode: current === "fullscreen" ? "inline" : "fullscreen" });
    },
  };
}
