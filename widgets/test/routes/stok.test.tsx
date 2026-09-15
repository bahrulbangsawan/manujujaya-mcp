// @vitest-environment happy-dom
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { ToolInput, ToolName } from "../../../src/widgets/contract";
import { ToolCallError, type Bridge, type HostInfo } from "../../src/bridge/bridge";
import { createMockBridge } from "../../src/bridge/mockBridge";
import { formatNumber } from "../../src/lib/format";
import { FIXTURES } from "../../dev/fixtures";
import { pathFor, renderView } from "./testHelpers";

const TODAY = "2026-09-15";

/**
 * Optional: DataTable already renders the rows that fit in maxHeight before measuring (T9).
 * happy-dom has no layout, so this stub only gives the virtualizer a size to measure.
 */
const LAYOUT_PROPS = ["offsetHeight", "offsetWidth"] as const;
const originalLayout = LAYOUT_PROPS.map((prop) => Object.getOwnPropertyDescriptor(HTMLElement.prototype, prop));
beforeAll(() => {
  for (const prop of LAYOUT_PROPS) {
    Object.defineProperty(HTMLElement.prototype, prop, { configurable: true, get: () => (prop === "offsetHeight" ? 600 : 800) });
  }
});
afterAll(() => {
  LAYOUT_PROPS.forEach((prop, i) => {
    const descriptor = originalLayout[i];
    if (descriptor) Object.defineProperty(HTMLElement.prototype, prop, descriptor);
    else Reflect.deleteProperty(HTMLElement.prototype, prop);
  });
});

/** Like testHelpers' makeBridge, plus a `pending` call that never resolves, for the cold-load test. */
function makeBridge(options: { host?: Partial<HostInfo>; fail?: ToolCallError; pending?: boolean } = {}) {
  const mock = createMockBridge();
  const callTool = vi.fn((name: ToolName, args: unknown, signal?: AbortSignal): Promise<unknown> => {
    if (options.pending) return new Promise(() => {});
    if (options.fail) return Promise.reject(options.fail);
    return mock.callTool(name, args as ToolInput<ToolName>, signal);
  });
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

describe("Stok view", () => {
  afterEach(cleanup);

  it("searches by the search param and renders stock rows without a <form>", async () => {
    const { bridge, callTool } = makeBridge();
    const fixture = FIXTURES.show_stock_browser({ search: "Kopi" });
    expect(fixture.rows.length).toBeGreaterThan(0);
    const { container } = renderView(pathFor("stok", { search: "Kopi" }, TODAY), bridge);

    expect(await screen.findByText(fixture.rows[0]!.name)).toBeTruthy();
    expect(callTool).toHaveBeenCalledWith("show_stock_browser", { search: "Kopi" }, expect.anything());
    for (const header of ["Produk", "Stok", "Harga jual", "Terakhir terjual", "Terakhir penyesuaian"]) {
      expect(screen.getAllByText(header).length).toBeGreaterThan(0);
    }
    expect(container.querySelector("form")).toBeNull();
  });

  it("shows the cold-load note only while loading without a search", async () => {
    const cold = makeBridge({ pending: true });
    renderView(pathFor("stok", {}, TODAY), cold.bridge);
    expect(await screen.findByText("Memuat stok, bisa sampai 15 detik")).toBeTruthy();
    cleanup();

    const searching = makeBridge({ pending: true });
    renderView(pathFor("stok", { search: "Kopi" }, TODAY), searching.bridge);
    await waitFor(() => expect(searching.callTool).toHaveBeenCalled());
    expect(screen.queryByText("Memuat stok, bisa sampai 15 detik")).toBeNull();
  });

  it("re-queries show_stock_browser with the debounced search text", async () => {
    const { bridge, callTool } = makeBridge();
    renderView(pathFor("stok", {}, TODAY), bridge);
    await screen.findByText(FIXTURES.show_stock_browser({}).rows[0]!.name);

    fireEvent.change(screen.getByPlaceholderText("Cari nama produk"), { target: { value: "Kopi" } });

    await waitFor(() => expect(callTool).toHaveBeenCalledWith("show_stock_browser", { search: "Kopi" }, expect.anything()), {
      timeout: 3_000,
    });
  });

  it("filters loaded rows with the chips and reports 'dari N baris dimuat'", async () => {
    const { bridge } = makeBridge();
    const rows = FIXTURES.show_stock_browser({}).rows;
    const out = rows.filter((row) => row.stock <= 0);
    const outAndStale = out.filter((row) => row.days_since_sale === null || row.days_since_sale >= 90);
    renderView(pathFor("stok", {}, TODAY), bridge);
    await screen.findByText(rows[0]!.name);

    fireEvent.click(screen.getByRole("button", { name: /^Stok habis/ }));
    expect(await screen.findByText(`${formatNumber(out.length, 0)} dari ${formatNumber(rows.length, 0)} baris dimuat`)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^Belum terjual ≥ 90 hari/ }));
    expect(
      await screen.findByText(`${formatNumber(outAndStale.length, 0)} dari ${formatNumber(rows.length, 0)} baris dimuat`),
    ).toBeTruthy();
  });

  it("loads more rows through stock_page", async () => {
    const { bridge, callTool } = makeBridge();
    const fixture = FIXTURES.show_stock_browser({});
    expect(fixture.next_page).not.toBeNull();
    renderView(pathFor("stok", {}, TODAY), bridge);

    fireEvent.click(await screen.findByRole("button", { name: "Muat lebih banyak" }));

    await waitFor(() => expect(callTool).toHaveBeenCalledWith("stock_page", { page: fixture.next_page }, expect.anything()));
  });

  it("opens a sheet with the velocity card and the paged movement history", async () => {
    const { bridge, callTool } = makeBridge();
    const row = FIXTURES.show_stock_browser({}).rows[0]!;
    const velocity = FIXTURES.stock_velocity({ inventory_id: row.inventory_id });
    const history = FIXTURES.stock_history({ inventory_id: row.inventory_id, page: 1 });
    renderView(pathFor("stok", {}, TODAY), bridge);

    fireEvent.click(await screen.findByText(row.name));

    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(await screen.findByText("Perkiraan habis")).toBeTruthy();
    expect(screen.getByText(`Terjual ${velocity.window_days} hari`)).toBeTruthy();
    expect(callTool).toHaveBeenCalledWith("stock_velocity", { inventory_id: row.inventory_id }, expect.anything());
    await waitFor(() =>
      expect(callTool).toHaveBeenCalledWith("stock_history", { inventory_id: row.inventory_id, page: 1 }, expect.anything()),
    );
    expect(await screen.findByText(`${formatNumber(history.movements.length, 0)} pergerakan dimuat`)).toBeTruthy();
    expect(screen.getAllByText(history.movements[0]!.type_label).length).toBeGreaterThan(0);
  });

  it("updates the model context with the search filter", async () => {
    const { bridge, updateContext } = makeBridge({ host: { canUpdateContext: true } });
    renderView(pathFor("stok", { search: "Kopi" }, TODAY), bridge);

    await waitFor(() => expect(updateContext).toHaveBeenCalled());
    const text = updateContext.mock.calls.at(-1)![0];
    expect(text).toContain("stok");
    expect(text).toContain("search=Kopi");
  });

  it("shows the rate-limit message from the error panel", async () => {
    const { bridge } = makeBridge({ fail: new ToolCallError({ code: "QASIR_RATE_LIMITED", message: "slow down" }) });
    renderView(pathFor("stok", { search: "Kopi" }, TODAY), bridge);

    expect(await screen.findByText("Qasir sedang membatasi permintaan. Coba lagi sebentar lagi.")).toBeTruthy();
  });

  it("shows the reconnect panel without retrying when the Qasir session expired", async () => {
    const connectUrl = "https://mcp.example.test/connect";
    const { bridge, callTool, openLink } = makeBridge({
      fail: new ToolCallError({ code: "QASIR_AUTH_EXPIRED", message: "expired", connect_url: connectUrl }),
    });
    renderView(pathFor("stok", { search: "Kopi" }, TODAY), bridge);

    expect(await screen.findByText("Sesi Qasir sudah berakhir. Pemilik perlu menghubungkan ulang.")).toBeTruthy();
    expect(callTool).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Buka halaman Connect" }));
    expect(openLink).toHaveBeenCalledWith(connectUrl);
    expect(screen.queryByRole("button", { name: "Coba lagi" })).toBeNull();
  });
});
