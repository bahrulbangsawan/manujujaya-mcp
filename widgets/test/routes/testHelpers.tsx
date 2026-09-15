// @vitest-environment happy-dom
/**
 * Shared helpers for the view route tests (Tasks 12-14): a router path builder, a spy bridge
 * delegating to createMockBridge(), and a renderer that mounts a real router under it.
 * Extracted from the byte-identical copies that used to live in each route test file.
 */
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import type { ToolInput, ToolName, ViewName } from "../../../src/widgets/contract";
import { createWidgetQueryClient } from "../../src/app/queryClient";
import { createWidgetRouter } from "../../src/app/router";
import { searchFromToolArgs } from "../../src/app/search";
import { VIEW_PATH } from "../../src/app/viewPaths";
import { BridgeContext, type Bridge, type HostInfo, type ToolCallError } from "../../src/bridge/bridge";
import { createMockBridge } from "../../src/bridge/mockBridge";

/** Builds the router path (path + query string) for `view` from tool arguments, as of `today`. */
export function pathFor(view: ViewName, args: Record<string, unknown>, today: string): string {
  const search = searchFromToolArgs(view, args, today);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) params.set(key, typeof value === "string" ? value : JSON.stringify(value));
  const query = params.toString();
  return query === "" ? VIEW_PATH[view] : `${VIEW_PATH[view]}?${query}`;
}

/** A Bridge whose methods are spies; callTool delegates to createMockBridge() unless `fail` is set. */
export function makeBridge(options: { host?: Partial<HostInfo>; fail?: ToolCallError } = {}) {
  const mock = createMockBridge();
  const callTool = vi.fn((name: ToolName, args: unknown, signal?: AbortSignal): Promise<unknown> =>
    options.fail ? Promise.reject(options.fail) : mock.callTool(name, args as ToolInput<ToolName>, signal),
  );
  const spies = {
    callTool,
    openLink: vi.fn(async (_url: string) => {}),
    sendMessage: vi.fn(async (_text: string) => {}),
    updateContext: vi.fn(async (_text: string) => {}),
    toggleFullscreen: vi.fn(async () => {}),
  };
  const bridge: Bridge = {
    ...spies,
    host: { ...mock.host, canFullscreen: false, canSendMessage: false, canUpdateContext: false, ...options.host },
    callTool: callTool as unknown as Bridge["callTool"],
  };
  return { bridge, ...spies };
}

/** Mounts a real router at `path`, wired to `bridge` and a fresh query client. */
export function renderView(path: string, bridge: Bridge) {
  const router = createWidgetRouter({ initialPath: path });
  const utils = render(
    <BridgeContext.Provider value={bridge}>
      <QueryClientProvider client={createWidgetQueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </BridgeContext.Provider>,
  );
  return { ...utils, router };
}
