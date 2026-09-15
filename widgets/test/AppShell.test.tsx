import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "../src/app/AppShell";
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
});
