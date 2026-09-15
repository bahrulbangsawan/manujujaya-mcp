import type { App } from "@modelcontextprotocol/ext-apps";
import type { ToolInput, ToolName, ToolOutput } from "../../../src/widgets/contract";
import { parseToolResult, toToolCallError, type Bridge, type HostInfo } from "./bridge";

export const TOOL_CALL_TIMEOUT_MS = 45_000;

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
      let result;
      try {
        result = await app.callServerTool(
          { name, arguments: args as Record<string, unknown> },
          { timeout: TOOL_CALL_TIMEOUT_MS, ...(signal ? { signal } : {}) },
        );
      } catch (err) {
        if (signal?.aborted) throw err;
        throw toToolCallError(err);
      }
      return parseToolResult(name, result);
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
