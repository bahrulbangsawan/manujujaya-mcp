import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "../src/app/AppShell";
import { createWidgetRouter } from "../src/app/router";
import { createMockBridge } from "../src/bridge/mockBridge";
import { VIEW_ROUTES } from "../src/routes";

describe("AppShell with the mock bridge", () => {
  it("renders the not-found panel while no view routes are registered", async () => {
    expect(VIEW_ROUTES).toHaveLength(0);
    const bridge = createMockBridge();
    const { container } = render(<AppShell view="stok" bridge={bridge} />);
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
