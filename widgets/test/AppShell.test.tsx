import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell, hostInsetsStyle } from "../src/app/AppShell";
import { createWidgetQueryClient } from "../src/app/queryClient";
import { createWidgetRouter } from "../src/app/router";
import { toolArgsFromSearch } from "../src/app/search";
import { BridgeContext } from "../src/bridge/bridge";
import { createMockBridge } from "../src/bridge/mockBridge";
import { jakartaTodayBrowser } from "../src/lib/dates";

describe("AppShell with the mock bridge", () => {
  it("opens a registered view with its default filters", async () => {
    const bridge = createMockBridge();
    const { container } = render(<AppShell view="penjualan" bridge={bridge} />);
    expect(await screen.findByText("Penjualan kotor")).toBeTruthy();
    await waitFor(() => expect(bridge.calls.length).toBeGreaterThan(0));
    expect(bridge.calls[0]).toEqual({
      name: "show_sales_dashboard",
      args: toolArgsFromSearch("penjualan", {}, jakartaTodayBrowser()),
    });
    expect(container.querySelector("form")).toBeNull();
  });

  it("renders the not-found panel for an unknown path", async () => {
    const bridge = createMockBridge();
    const router = createWidgetRouter({ initialPath: "/tidak-ada" });
    const { container } = render(
      <BridgeContext.Provider value={bridge}>
        <QueryClientProvider client={createWidgetQueryClient()}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </BridgeContext.Provider>,
    );
    expect(await screen.findByText("Tampilan belum tersedia")).toBeTruthy();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(container.querySelector("form")).toBeNull();
    expect(bridge.calls).toEqual([]);
  });

  it("creates independent routers over memory history", () => {
    const first = createWidgetRouter({ initialPath: "/stok?search=Kopi" });
    const second = createWidgetRouter({ initialPath: "/piutang" });
    expect(first.history.location.pathname).toBe("/stok");
    expect(first.history.location.search).toBe("?search=Kopi");
    expect(second.history.location.pathname).toBe("/piutang");
  });

  it("keeps 16px left and right padding on the chat preview", async () => {
    const { container } = render(<AppShell view="penjualan" bridge={createMockBridge()} />);
    expect(await screen.findByText("Penjualan kotor")).toBeTruthy();
    expect(container.querySelector(".px-4")).toBeTruthy();
  });
});

describe("hostInsetsStyle", () => {
  it("ignores missing and all-zero insets so they cannot wipe content padding", () => {
    expect(hostInsetsStyle(undefined)).toBeUndefined();
    expect(hostInsetsStyle({} as never)).toBeUndefined();
    expect(hostInsetsStyle({ safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 } } as never)).toBeUndefined();
  });

  it("applies only non-zero host safe-area sides", () => {
    expect(hostInsetsStyle({ safeAreaInsets: { top: 0, right: 8, bottom: 48, left: 0 } } as never)).toEqual({
      paddingRight: 8,
      paddingBottom: 48,
    });
  });
});
