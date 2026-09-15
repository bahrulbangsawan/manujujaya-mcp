/// <reference lib="dom" />
/**
 * Browser side of scripts/widgets-smoke.ts (bundled into an IIFE, never shipped).
 * Plays the MCP Apps host: mounts one widget view in <iframe sandbox="allow-scripts">, connects an
 * ext-apps AppBridge over postMessage, delivers the opening tool call (toolinput + toolresult) and
 * answers every tools/call from widgets/dev/fixtures.ts.
 */
import type { CallToolResult } from "@modelcontextprotocol/client";
import { AppBridge, PostMessageTransport } from "@modelcontextprotocol/ext-apps/app-bridge";
import { TOOL_SCHEMAS, type ToolName } from "../src/widgets/contract";
import { FIXTURES } from "../widgets/dev/fixtures";

export interface SmokeMountOptions {
  html: string;
  tool: ToolName;
  args: Record<string, unknown>;
}

export interface SmokeHost {
  /** tools/call requests the widget sent, in order. */
  calls: Array<{ name: string; arguments: Record<string, unknown> }>;
  /** Host-side lifecycle events ("initialized", "toolinput", "toolresult", "message", "openlink", "error: …"). */
  events: string[];
  mount(options: SmokeMountOptions): Promise<void>;
}

declare global {
  interface Window {
    __smoke: SmokeHost;
  }
}

function isToolName(name: string): name is ToolName {
  return Object.hasOwn(TOOL_SCHEMAS, name);
}

/** The result a real server would return: fixture structuredContent, or the SDK's input-validation error text. */
function answer(name: string, args: Record<string, unknown>): CallToolResult {
  if (!isToolName(name)) {
    return { isError: true, content: [{ type: "text", text: JSON.stringify({ code: "UNSUPPORTED_OPERATION", message: `Unknown tool ${name}` }) }] };
  }
  const input = TOOL_SCHEMAS[name].input.safeParse(args);
  if (!input.success) {
    return { isError: true, content: [{ type: "text", text: `Input validation error: Invalid arguments for tool ${name}` }] };
  }
  const fixture = FIXTURES[name] as (fixtureArgs: unknown) => Record<string, unknown>;
  return { content: [{ type: "text", text: `Fixture result for ${name}` }], structuredContent: fixture(input.data) };
}

const host: SmokeHost = {
  calls: [],
  events: [],
  async mount({ html, tool, args }) {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("sandbox", "allow-scripts");
    iframe.title = "Widget";
    iframe.style.cssText = "width: 820px; height: 1400px; border: 0;";
    document.body.appendChild(iframe);
    const target = iframe.contentWindow;
    if (!target) throw new Error("iframe has no contentWindow");

    const bridge = new AppBridge(
      null,
      { name: "manujujaya-widgets-smoke", version: "1.0.0" },
      { serverTools: {}, openLinks: {}, message: { text: {} }, updateModelContext: { text: {} } },
      {
        hostContext: {
          theme: "light",
          displayMode: "inline",
          availableDisplayModes: ["inline"],
          locale: "id-ID",
          timeZone: "Asia/Jakarta",
          platform: "web",
        },
      },
    );
    bridge.oncalltool = async (params) => {
      const callArgs = (params.arguments ?? {}) as Record<string, unknown>;
      host.calls.push({ name: params.name, arguments: callArgs });
      return answer(params.name, callArgs);
    };
    bridge.onopenlink = async () => {
      host.events.push("openlink");
      return {};
    };
    bridge.onmessage = async () => {
      host.events.push("message");
      return {};
    };
    bridge.onupdatemodelcontext = async () => ({});
    bridge.onrequestdisplaymode = async () => ({ mode: "inline" });
    bridge.oninitialized = () => {
      host.events.push("initialized");
      void (async () => {
        await bridge.sendToolInput({ arguments: args });
        host.events.push("toolinput");
        await bridge.sendToolResult(answer(tool, args));
        host.events.push("toolresult");
      })().catch((err: unknown) => host.events.push(`error: ${String(err)}`));
    };

    // The transport listens before the frame loads, so the widget's ui/initialize is never missed.
    await bridge.connect(new PostMessageTransport(target, target));
    iframe.srcdoc = html;
  },
};

window.__smoke = host;
