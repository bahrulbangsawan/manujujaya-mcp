import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VIEWS } from "../../../src/widgets/contract";
import { VIEW_PATH } from "../../src/app/viewPaths";
import { BridgeContext, type Bridge } from "../../src/bridge/bridge";
import { createMockBridge } from "../../src/bridge/mockBridge";
import { ViewFrame } from "../../src/components/ViewFrame";

/** Six stub routes rendering ViewFrame, so the switcher can navigate between real paths. */
function renderFrame(bridge: Bridge, queryClient = new QueryClient()) {
  const rootRoute = createRootRoute();
  const routes = VIEWS.map((view) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: VIEW_PATH[view],
      component: () => (
        <ViewFrame title={`Judul ${view}`} subtitle="Outlet 100001 · Diperbarui 10.00">
          <p>Isi {view}</p>
        </ViewFrame>
      ),
    }),
  );
  const router = createRouter({ routeTree: rootRoute.addChildren(routes), history: createMemoryHistory({ initialEntries: ["/stok"] }) });
  render(
    <BridgeContext.Provider value={bridge}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </BridgeContext.Provider>,
  );
}

describe("ViewFrame", () => {
  it("renders the header and main landmark, marks the current view and navigates", async () => {
    renderFrame(createMockBridge({ host: { canFullscreen: false } }));
    expect(await screen.findByRole("heading", { name: "Judul stok" })).toBeTruthy();
    expect(screen.getByText("Outlet 100001 · Diperbarui 10.00")).toBeTruthy();
    expect(screen.getByRole("main").textContent).toBe("Isi stok");
    expect(screen.getByRole("link", { name: "Stok" }).getAttribute("aria-current")).toBe("page");
    expect(screen.queryByRole("button", { name: "Layar penuh" })).toBeNull();

    fireEvent.click(screen.getByRole("link", { name: "Piutang" }));
    expect(await screen.findByRole("heading", { name: "Judul piutang" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Piutang" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Stok" }).getAttribute("aria-current")).toBeNull();
  });

  it("refetches active queries and toggles fullscreen when the host allows it", async () => {
    const bridge = createMockBridge({ host: { canFullscreen: true } });
    const queryClient = new QueryClient();
    const refetch = vi.spyOn(queryClient, "refetchQueries");
    renderFrame(bridge, queryClient);

    fireEvent.click(await screen.findByRole("button", { name: "Muat ulang" }));
    expect(refetch).toHaveBeenCalledWith({ type: "active" });
    fireEvent.click(screen.getByRole("button", { name: "Layar penuh" }));
    expect(bridge.host.displayMode).toBe("fullscreen");
  });
});
