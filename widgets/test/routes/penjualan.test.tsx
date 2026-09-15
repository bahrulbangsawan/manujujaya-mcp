// @vitest-environment happy-dom
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolInput, ToolName } from "../../../src/widgets/contract";
import { createWidgetQueryClient } from "../../src/app/queryClient";
import { createWidgetRouter } from "../../src/app/router";
import { searchFromToolArgs, toolArgsFromSearch } from "../../src/app/search";
import { VIEW_PATH } from "../../src/app/viewPaths";
import { BridgeContext, ToolCallError, type Bridge, type HostInfo } from "../../src/bridge/bridge";
import { createMockBridge } from "../../src/bridge/mockBridge";
import { formatDate, formatRupiah } from "../../src/lib/format";
import { FIXTURES } from "../../dev/fixtures";

// The real chart is covered by component tests; here each point is a plain button.
vi.mock("../../src/components/TrendChart", async () => {
  const { createElement } = await import("react");
  return {
    TrendChart: (props: { points: Array<{ date: string }>; onSelectDate?: (date: string) => void }) =>
      createElement(
        "div",
        null,
        props.points.map((point) =>
          createElement("button", { key: point.date, type: "button", onClick: () => props.onSelectDate?.(point.date) }, `Titik ${point.date}`),
        ),
      ),
  };
});

const TODAY = "2026-09-15";
const ARGS = { start_date: "2026-09-01", end_date: "2026-09-10" };

/** Testing Library collapses whitespace (including the NBSP Intl puts after "Rp"). */
function norm(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function pathFor(view: "penjualan", args: Record<string, unknown>): string {
  const search = searchFromToolArgs(view, args, TODAY);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) params.set(key, typeof value === "string" ? value : JSON.stringify(value));
  const query = params.toString();
  return query === "" ? VIEW_PATH[view] : `${VIEW_PATH[view]}?${query}`;
}

function makeBridge(options: { host?: Partial<HostInfo>; fail?: ToolCallError } = {}) {
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

function renderView(path: string, bridge: Bridge) {
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

describe("Penjualan view", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-15T03:00:00Z")); // 10:00 in Jakarta
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("loads the dashboard for the requested range and renders KPIs and lists without a <form>", async () => {
    const { bridge, callTool } = makeBridge();
    const fixture = FIXTURES.show_sales_dashboard(ARGS);
    const { container } = renderView(pathFor("penjualan", ARGS), bridge);

    expect(await screen.findByText("Penjualan kotor")).toBeTruthy();
    expect(callTool).toHaveBeenCalledWith("show_sales_dashboard", ARGS, expect.anything());
    expect(screen.getAllByText(norm(formatRupiah(fixture.kpis.gross_sales))).length).toBeGreaterThan(0);
    expect(screen.getByText("Laba kotor")).toBeTruthy();
    expect(screen.getByText("Rata-rata per transaksi")).toBeTruthy();
    expect(screen.getByText("Sisa piutang (laporan Qasir)")).toBeTruthy();
    expect(screen.getByText("Metode pembayaran")).toBeTruthy();
    expect(screen.getByText(fixture.top_products[0]!.name)).toBeTruthy();
    expect(screen.getByText(fixture.categories[0]!.name)).toBeTruthy();
    expect(container.querySelector("form")).toBeNull();
  });

  it("re-queries the dashboard when a preset is chosen", async () => {
    const { bridge, callTool } = makeBridge();
    renderView(pathFor("penjualan", ARGS), bridge);
    await screen.findByText("Penjualan kotor");

    fireEvent.click(screen.getByRole("button", { name: "Kemarin" }));

    await waitFor(() =>
      expect(callTool).toHaveBeenCalledWith("show_sales_dashboard", { start_date: "2026-09-14", end_date: "2026-09-14" }, expect.anything()),
    );
  });

  it("opens Transaksi for the chart day that was clicked", async () => {
    const { bridge } = makeBridge();
    const { router } = renderView(pathFor("penjualan", ARGS), bridge);

    fireEvent.click(await screen.findByRole("button", { name: "Titik 2026-09-03" }));

    await waitFor(() => expect(router.state.location.pathname).toBe(VIEW_PATH.transaksi));
    const args = toolArgsFromSearch("transaksi", router.state.location.search as Record<string, unknown>, TODAY);
    expect(args.start_date).toBe("2026-09-03");
    expect(args.end_date).toBe("2026-09-03");
  });

  it("links the receivable tile to Piutang, the ranking link to Produk and a top product to Produk with order terlaris", async () => {
    const { bridge } = makeBridge();
    const fixture = FIXTURES.show_sales_dashboard(ARGS);
    const first = renderView(pathFor("penjualan", ARGS), bridge);

    fireEvent.click(await screen.findByRole("button", { name: /buka tampilan Piutang/ }));
    await waitFor(() => expect(first.router.state.location.pathname).toBe(VIEW_PATH.piutang));
    cleanup();

    const second = renderView(pathFor("penjualan", ARGS), bridge);
    fireEvent.click(await screen.findByRole("button", { name: "Lihat peringkat produk" }));
    await waitFor(() => expect(second.router.state.location.pathname).toBe(VIEW_PATH.produk));
    const produkArgs = toolArgsFromSearch("produk", second.router.state.location.search as Record<string, unknown>, TODAY);
    expect(produkArgs).toMatchObject({ ...ARGS, order: "terlaris" });
    cleanup();

    const third = renderView(pathFor("penjualan", ARGS), bridge);
    fireEvent.click(await screen.findByText(fixture.top_products[0]!.name));
    await waitFor(() => expect(third.router.state.location.pathname).toBe(VIEW_PATH.produk));
    const topProductArgs = toolArgsFromSearch("produk", third.router.state.location.search as Record<string, unknown>, TODAY);
    expect(topProductArgs).toMatchObject({ ...ARGS, order: "terlaris" });
  });

  it("offers 'Tanya Claude tentang periode ini' only when the host accepts messages", async () => {
    const hidden = makeBridge({ host: { canSendMessage: false } });
    renderView(pathFor("penjualan", ARGS), hidden.bridge);
    await screen.findByText("Penjualan kotor");
    expect(screen.queryByRole("button", { name: "Tanya Claude tentang periode ini" })).toBeNull();
    cleanup();

    const shown = makeBridge({ host: { canSendMessage: true } });
    const fixture = FIXTURES.show_sales_dashboard(ARGS);
    renderView(pathFor("penjualan", ARGS), shown.bridge);
    fireEvent.click(await screen.findByRole("button", { name: "Tanya Claude tentang periode ini" }));

    await waitFor(() => expect(shown.sendMessage).toHaveBeenCalledTimes(1));
    const message = norm(shown.sendMessage.mock.calls[0]![0]);
    expect(message).toContain(norm(formatDate("2026-09-01")));
    expect(message).toContain(norm(formatDate("2026-09-10")));
    expect(message).toContain(norm(formatRupiah(fixture.kpis.gross_sales)));
    expect(await screen.findByText("Pertanyaan dikirim ke Claude.")).toBeTruthy();
  });

  it("updates the model context with the view and filters when the host supports it", async () => {
    const off = makeBridge({ host: { canUpdateContext: false } });
    renderView(pathFor("penjualan", ARGS), off.bridge);
    await screen.findByText("Penjualan kotor");
    expect(off.updateContext).not.toHaveBeenCalled();
    cleanup();

    const on = makeBridge({ host: { canUpdateContext: true } });
    renderView(pathFor("penjualan", ARGS), on.bridge);
    await waitFor(() => expect(on.updateContext).toHaveBeenCalled());
    const text = on.updateContext.mock.calls.at(-1)![0];
    expect(text).toContain("penjualan");
    expect(text).toContain("start_date=2026-09-01");
    expect(text).toContain("end_date=2026-09-10");
  });

  it("shows the reconnect panel when the Qasir session expired", async () => {
    const connectUrl = "https://mcp.example.test/connect";
    const { bridge, openLink } = makeBridge({
      fail: new ToolCallError({ code: "QASIR_AUTH_EXPIRED", message: "expired", connect_url: connectUrl }),
    });
    renderView(pathFor("penjualan", ARGS), bridge);

    expect(await screen.findByText("Sesi Qasir sudah berakhir. Pemilik perlu menghubungkan ulang.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Buka halaman Connect" }));
    expect(openLink).toHaveBeenCalledWith(connectUrl);
    expect(screen.queryByRole("button", { name: "Coba lagi" })).toBeNull();
  });
});
