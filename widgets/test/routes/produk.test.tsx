// @vitest-environment happy-dom
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { toolArgsFromSearch } from "../../src/app/search";
import { VIEW_PATH } from "../../src/app/viewPaths";
import { ToolCallError } from "../../src/bridge/bridge";
import { FIXTURES } from "../../dev/fixtures";
import { makeBridge, pathFor, renderView } from "./testHelpers";

const TODAY = "2026-09-15";
const ARGS = { start_date: "2026-09-01", end_date: "2026-09-10", order: "terlaris" } as const;

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

describe("Produk view", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-15T03:00:00Z"));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders the ranking, categories and manual-transaction line without a <form>", async () => {
    const { bridge, callTool } = makeBridge();
    const fixture = FIXTURES.show_product_ranking(ARGS);
    const { container } = renderView(pathFor("produk", ARGS, TODAY), bridge);

    expect(await screen.findByText(fixture.rows[0]!.name)).toBeTruthy();
    expect(callTool).toHaveBeenCalledWith("show_product_ranking", ARGS, expect.anything());
    for (const header of ["Peringkat", "Produk", "Kategori", "Terjual", "Omzet"]) {
      expect(screen.getAllByText(header).length).toBeGreaterThan(0);
    }
    expect(screen.getByText("Omzet per kategori")).toBeTruthy();
    expect(screen.getAllByText(fixture.categories[0]!.name).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Transaksi manual \(tanpa produk\)/) !== null).toBe(fixture.manual_transactions !== null);
    expect(screen.getByText(`${fixture.rows.length} produk dimuat`)).toBeTruthy();
    expect(container.querySelector("form")).toBeNull();
  });

  it("re-queries with the chosen order", async () => {
    const { bridge, callTool } = makeBridge();
    renderView(pathFor("produk", ARGS, TODAY), bridge);
    await screen.findByText(FIXTURES.show_product_ranking(ARGS).rows[0]!.name);

    fireEvent.click(screen.getByRole("button", { name: /^Kurang laris/ }));

    await waitFor(() =>
      expect(callTool).toHaveBeenCalledWith("show_product_ranking", { ...ARGS, order: "kurang_laris" }, expect.anything()),
    );
  });

  it("loads the next ranking page through product_ranking_page", async () => {
    const { bridge, callTool } = makeBridge();
    const fixture = FIXTURES.show_product_ranking(ARGS);
    expect(fixture.next_page).not.toBeNull();
    const nextPage = FIXTURES.product_ranking_page({ ...ARGS, page: fixture.next_page! });
    renderView(pathFor("produk", ARGS, TODAY), bridge);

    fireEvent.click(await screen.findByRole("button", { name: "Muat lebih banyak" }));

    await waitFor(() =>
      expect(callTool).toHaveBeenCalledWith("product_ranking_page", { ...ARGS, page: fixture.next_page }, expect.anything()),
    );
    expect(await screen.findByText(`${fixture.rows.length + nextPage.rows.length} produk dimuat`)).toBeTruthy();
  });

  it("opens Stok searching for the clicked product", async () => {
    const { bridge } = makeBridge();
    const fixture = FIXTURES.show_product_ranking(ARGS);
    const { router } = renderView(pathFor("produk", ARGS, TODAY), bridge);

    fireEvent.click(await screen.findByText(fixture.rows[0]!.name));

    await waitFor(() => expect(router.state.location.pathname).toBe(VIEW_PATH.stok));
    const args = toolArgsFromSearch("stok", router.state.location.search as Record<string, unknown>, TODAY);
    expect(args.search).toBe(fixture.rows[0]!.name);
  });

  it("updates the model context with the view, range and order", async () => {
    const { bridge, updateContext } = makeBridge({ host: { canUpdateContext: true } });
    renderView(pathFor("produk", ARGS, TODAY), bridge);

    await waitFor(() => expect(updateContext).toHaveBeenCalled());
    const text = updateContext.mock.calls.at(-1)![0];
    expect(text).toContain("produk");
    expect(text).toContain("order=terlaris");
    expect(text).toContain("start_date=2026-09-01");
  });

  it("shows the error panel with a retry for invalid filters", async () => {
    const { bridge, callTool } = makeBridge({ fail: new ToolCallError({ code: "INVALID_INPUT", message: "bad" }) });
    renderView(pathFor("produk", ARGS, TODAY), bridge);

    expect(await screen.findByText("Filter tidak valid.")).toBeTruthy();
    const calls = callTool.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }));
    await waitFor(() => expect(callTool.mock.calls.length).toBeGreaterThan(calls));
  });

  it("shows the reconnect panel without retrying when the Qasir session expired", async () => {
    const connectUrl = "https://mcp.example.test/connect";
    const { bridge, callTool, openLink } = makeBridge({
      fail: new ToolCallError({ code: "QASIR_AUTH_EXPIRED", message: "expired", connect_url: connectUrl }),
    });
    renderView(pathFor("produk", ARGS, TODAY), bridge);

    expect(await screen.findByText("Sesi Qasir sudah berakhir. Pemilik perlu menghubungkan ulang.")).toBeTruthy();
    expect(callTool).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Buka halaman Connect" }));
    expect(openLink).toHaveBeenCalledWith(connectUrl);
    expect(screen.queryByRole("button", { name: "Coba lagi" })).toBeNull();
  });
});
