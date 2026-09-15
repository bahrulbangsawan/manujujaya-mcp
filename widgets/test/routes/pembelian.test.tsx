// @vitest-environment happy-dom
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { ToolInput, ToolName, ToolOutput } from "../../../src/widgets/contract";
import { ToolCallError, type Bridge, type HostInfo } from "../../src/bridge/bridge";
import { createMockBridge } from "../../src/bridge/mockBridge";
import { formatNumber } from "../../src/lib/format";
import { FIXTURES } from "../../dev/fixtures";
import { pathFor, renderView } from "./testHelpers";

type PurchaseRow = ToolOutput<"show_purchase_orders">["rows"][number];

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

/**
 * Like testHelpers' makeBridge, plus `repeatOnNextPage`: a PO created while paging shifts
 * purchases.list (newest first), so purchase_orders_page's next call repeats a row.
 */
function makeBridge(options: { host?: Partial<HostInfo>; fail?: ToolCallError; repeatOnNextPage?: PurchaseRow } = {}) {
  const mock = createMockBridge();
  const callTool = vi.fn((name: ToolName, args: unknown, signal?: AbortSignal): Promise<unknown> => {
    if (options.fail) return Promise.reject(options.fail);
    const result = mock.callTool(name, args as ToolInput<ToolName>, signal);
    const repeated = options.repeatOnNextPage;
    if (name !== "purchase_orders_page" || repeated === undefined) return result;
    return result.then((page) => {
      const typed = page as ToolOutput<"purchase_orders_page">;
      return { ...typed, rows: [repeated, ...typed.rows] };
    });
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

describe("Pembelian view", () => {
  afterEach(cleanup);

  it("lists purchase orders for all statuses without a <form>", async () => {
    const { bridge, callTool } = makeBridge();
    const fixture = FIXTURES.show_purchase_orders({ status: "semua" });
    const { container } = renderView(pathFor("pembelian", {}, TODAY), bridge);

    expect(await screen.findByText(fixture.rows[0]!.order_no)).toBeTruthy();
    expect(callTool).toHaveBeenCalledWith("show_purchase_orders", { status: "semua" }, expect.anything());
    for (const header of ["No. PO", "Tanggal", "Pemasok", "Total", "Status"]) {
      expect(screen.getAllByText(header).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText(fixture.rows[0]!.status_label).length).toBeGreaterThan(0);
    expect(container.querySelector("form")).toBeNull();
  });

  it("re-queries show_purchase_orders when a status chip is chosen", async () => {
    const { bridge, callTool } = makeBridge();
    const completed = FIXTURES.show_purchase_orders({ status: "completed" });
    renderView(pathFor("pembelian", {}, TODAY), bridge);
    await screen.findByText(FIXTURES.show_purchase_orders({ status: "semua" }).rows[0]!.order_no);

    fireEvent.click(screen.getByRole("button", { name: /^Selesai/ }));

    await waitFor(() =>
      expect(callTool).toHaveBeenCalledWith("show_purchase_orders", { status: "completed" }, expect.anything()),
    );
    expect(
      await screen.findByText(
        `${formatNumber(completed.rows.length, 0)} PO Selesai dari ${formatNumber(completed.scanned_rows, 0)} baris dimuat`,
      ),
    ).toBeTruthy();
  });

  it("expands a row and loads its items through purchase_order_items", async () => {
    const { bridge, callTool } = makeBridge();
    const row = FIXTURES.show_purchase_orders({ status: "semua" }).rows[0]!;
    const items = FIXTURES.purchase_order_items({ purchase_id: row.id });
    renderView(pathFor("pembelian", {}, TODAY), bridge);

    fireEvent.click(await screen.findByText(row.order_no));

    await waitFor(() =>
      expect(callTool).toHaveBeenCalledWith("purchase_order_items", { purchase_id: row.id }, expect.anything()),
    );
    expect(await screen.findByText("Subtotal")).toBeTruthy();
    expect(screen.getAllByText(items.items[0]!.product).length).toBeGreaterThan(0);
    expect(screen.getByText("Diterima")).toBeTruthy();
  });

  it("pages older orders through purchase_orders_page and keeps the status filter client-side", async () => {
    const { bridge, callTool } = makeBridge();
    const first = FIXTURES.show_purchase_orders({ status: "semua" });
    expect(first.next_page).not.toBeNull();
    const second = FIXTURES.purchase_orders_page({ page: first.next_page! });
    const loaded = new Set([...first.rows, ...second.rows].map((row) => row.id)).size;
    renderView(pathFor("pembelian", {}, TODAY), bridge);

    fireEvent.click(await screen.findByRole("button", { name: "Muat lebih banyak" }));

    await waitFor(() =>
      expect(callTool).toHaveBeenCalledWith("purchase_orders_page", { page: first.next_page }, expect.anything()),
    );
    expect(await screen.findByText(new RegExp(`^${formatNumber(loaded, 0)} PO dimuat`))).toBeTruthy();
  });

  it("counts a row repeated on the next page only once in the status chips", async () => {
    const first = FIXTURES.show_purchase_orders({ status: "semua" });
    const repeated = first.rows.at(-1)!;
    const second = FIXTURES.purchase_orders_page({ page: first.next_page! });
    const expected =
      (first.status_counts[repeated.status] ?? 0) + second.rows.filter((row) => row.status === repeated.status).length;
    const { bridge } = makeBridge({ repeatOnNextPage: repeated });
    renderView(pathFor("pembelian", {}, TODAY), bridge);

    fireEvent.click(await screen.findByRole("button", { name: "Muat lebih banyak" }));

    expect(
      await screen.findByText(new RegExp(`^${formatNumber(first.rows.length + second.rows.length, 0)} PO dimuat`)),
    ).toBeTruthy();
    const chip = screen.getByRole("button", { name: new RegExp(`^${repeated.status_label}`) });
    expect(within(chip).getByText(formatNumber(expected, 0))).toBeTruthy();
  });

  it("updates the model context with the status filter", async () => {
    const { bridge, updateContext } = makeBridge({ host: { canUpdateContext: true } });
    renderView(pathFor("pembelian", { status: "canceled" }, TODAY), bridge);

    await waitFor(() => expect(updateContext).toHaveBeenCalled());
    const text = updateContext.mock.calls.at(-1)![0];
    expect(text).toContain("pembelian");
    expect(text).toContain("status=canceled");
  });

  it("shows the forbidden message from the error panel", async () => {
    const { bridge } = makeBridge({ fail: new ToolCallError({ code: "FORBIDDEN", message: "no scope" }) });
    renderView(pathFor("pembelian", {}, TODAY), bridge);

    expect(await screen.findByText("Akses ditolak untuk akun ini.")).toBeTruthy();
  });

  it("shows the reconnect panel without retrying when the Qasir session expired", async () => {
    const connectUrl = "https://mcp.example.test/connect";
    const { bridge, callTool, openLink } = makeBridge({
      fail: new ToolCallError({ code: "QASIR_AUTH_EXPIRED", message: "expired", connect_url: connectUrl }),
    });
    renderView(pathFor("pembelian", {}, TODAY), bridge);

    expect(await screen.findByText("Sesi Qasir sudah berakhir. Pemilik perlu menghubungkan ulang.")).toBeTruthy();
    expect(callTool).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Buka halaman Connect" }));
    expect(openLink).toHaveBeenCalledWith(connectUrl);
    expect(screen.queryByRole("button", { name: "Coba lagi" })).toBeNull();
  });
});
