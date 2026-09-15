import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWidgetQueryClient } from "../../src/app/queryClient";
import { createWidgetRouter } from "../../src/app/router";
import { searchFromToolArgs, viewPathWithSearch } from "../../src/app/search";
import { BridgeContext } from "../../src/bridge/bridge";
import { createMockBridge, type MockBridge } from "../../src/bridge/mockBridge";
import { customerTransactionsArgs, mergeTransactionDays, type TransactionDay } from "../../src/routes/transaksi";

// 10:00 in Jakarta on 15 Sep 2026.
const NOW = new Date("2026-09-15T03:00:00Z");

function renderAt(path: string, bridge: MockBridge = createMockBridge()) {
  const router = createWidgetRouter({ initialPath: path });
  const view = render(
    <BridgeContext.Provider value={bridge}>
      <QueryClientProvider client={createWidgetQueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </BridgeContext.Provider>,
  );
  return { ...view, bridge, router };
}

function callsTo(bridge: MockBridge, name: string) {
  return bridge.calls.filter((call) => call.name === name).map((call) => call.args);
}

function transactionButtons(): HTMLElement[] {
  const list = screen.getByRole("region", { name: "Daftar transaksi" });
  return within(list).getAllByRole("button");
}

describe("transaksi view", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens on Hari ini and lists today's sales grouped under a day header", async () => {
    const { bridge, container } = renderAt("/transaksi");

    expect(await screen.findByText("INV/20260915/0000")).toBeTruthy();
    expect(callsTo(bridge, "show_transactions")).toEqual([{ start_date: "2026-09-15", end_date: "2026-09-15" }]);
    expect(screen.getByRole("heading", { level: 1, name: "Transaksi" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hari ini" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("heading", { level: 3 }).textContent).toContain("15 Sep 2026");
    expect(transactionButtons()).toHaveLength(6);
    expect(screen.getByText("6 transaksi dimuat dari 30")).toBeTruthy();
    expect(container.querySelector("form")).toBeNull();
  });

  it("filters loaded rows by payment mode and by status", async () => {
    renderAt("/transaksi");
    await screen.findByText("INV/20260915/0000");

    fireEvent.click(screen.getByRole("button", { name: /^QRIS/ }));
    expect(transactionButtons().map((row) => within(row).getByText(/^INV\//).textContent)).toEqual([
      "INV/20260915/0001",
      "INV/20260915/0004",
    ]);
    expect(screen.getByText("6 transaksi dimuat dari 30 · 2 cocok dengan filter")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^Semua metode/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Refund sebagian/ }));
    expect(transactionButtons()).toHaveLength(1);
    expect(screen.getByText("INV/20260915/0005")).toBeTruthy();
  });

  it("loads the next page through transactions_page with the same filters", async () => {
    const { bridge } = renderAt("/transaksi");
    await screen.findByText("INV/20260915/0000");

    fireEvent.click(screen.getByRole("button", { name: "Muat lebih banyak" }));

    expect(await screen.findByText("18 transaksi dimuat dari 30")).toBeTruthy();
    expect(callsTo(bridge, "transactions_page")).toEqual([{ start_date: "2026-09-15", end_date: "2026-09-15", page: 2 }]);
    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining("8 Sep 2026")]),
    );
  });

  it("opens the order detail sheet and jumps to that customer's last 365 days", async () => {
    const { bridge } = renderAt("/transaksi");
    fireEvent.click(await screen.findByText("INV/20260915/0000"));

    const sheet = await screen.findByRole("dialog", { name: "Detail transaksi" });
    expect(await within(sheet).findByText("Kredit")).toBeTruthy();
    expect(callsTo(bridge, "order_detail")).toEqual([{ sales_id: 900_000 }]);
    expect(within(sheet).getByText("Pelanggan A")).toBeTruthy();
    expect(within(sheet).getByText("Telepon: 0800-0000-0001")).toBeTruthy();
    expect(within(sheet).getByText("Kasir: Kasir A")).toBeTruthy();

    fireEvent.click(within(sheet).getByRole("button", { name: "Lihat transaksi pelanggan ini" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(await screen.findByText("Pelanggan: Pelanggan A")).toBeTruthy();
    expect(callsTo(bridge, "show_transactions").at(-1)).toEqual({
      start_date: "2025-09-16",
      end_date: "2026-09-15",
      customer_id: 3001,
    });
  });

  it("drops customer_id from the search when the customer chip is cleared", async () => {
    const path = viewPathWithSearch("transaksi", searchFromToolArgs("transaksi", customerTransactionsArgs(3001, "2026-09-15"), "2026-09-15"));
    const { bridge, router } = renderAt(path);
    expect(await screen.findByText("Pelanggan: Pelanggan A")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Hapus filter pelanggan" }));

    await waitFor(() => expect(screen.queryByText("Pelanggan: Pelanggan A")).toBeNull());
    expect(router.state.location.search).not.toHaveProperty("customer_id");
    await waitFor(() =>
      expect(callsTo(bridge, "show_transactions").at(-1)).toEqual({ start_date: "2025-09-16", end_date: "2026-09-15" }),
    );
  });

  it("shows the reconnect panel without retrying when the Qasir session expired", async () => {
    const bridge = createMockBridge({ failWith: { show_transactions: "QASIR_AUTH_EXPIRED" } });
    renderAt("/transaksi", bridge);

    expect(await screen.findByText("Sesi Qasir sudah berakhir. Pemilik perlu menghubungkan ulang.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Buka halaman Connect" }));
    expect(bridge.openedLinks).toEqual(["https://widget.example/connect"]);
    expect(screen.queryByRole("button", { name: "Coba lagi" })).toBeNull();
    expect(callsTo(bridge, "show_transactions")).toHaveLength(1);
  });
});

describe("mergeTransactionDays", () => {
  const item = (salesId: number) => ({
    sales_id: salesId,
    time: "10:00",
    invoice: `INV${salesId}`,
    payment_mode: "Tunai",
    amount: 1000,
    status: 2,
    status_label: "Selesai",
    sales_type: "",
  });

  it("joins a day split across pages and keeps each sale once, in order", () => {
    const pageOne: TransactionDay[] = [{ date: "2026-09-15", daily_amount: 5000, items: [item(1), item(2)] }];
    const pageTwo: TransactionDay[] = [
      { date: "2026-09-15", daily_amount: 5000, items: [item(2), item(3)] },
      { date: "2026-09-14", daily_amount: 1000, items: [item(4)] },
    ];
    expect(mergeTransactionDays([...pageOne, ...pageTwo])).toEqual([
      { date: "2026-09-15", daily_amount: 5000, items: [item(1), item(2), item(3)] },
      { date: "2026-09-14", daily_amount: 1000, items: [item(4)] },
    ]);
  });
});
