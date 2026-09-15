import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolOutput } from "../../../src/widgets/contract";
import { FIXTURES } from "../../dev/fixtures";
import { createWidgetQueryClient } from "../../src/app/queryClient";
import { createWidgetRouter } from "../../src/app/router";
import { BridgeContext } from "../../src/bridge/bridge";
import { createMockBridge, type MockBridge } from "../../src/bridge/mockBridge";
import { collectionMessage, filterDebtCustomers, sortDebtCustomers } from "../../src/routes/piutang";

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

/** Customer names in table order (data rows only). */
function tableNames(): string[] {
  const table = screen.getByRole("table", { name: "Pelanggan dengan piutang" });
  return within(table)
    .getAllByRole("row")
    .filter((row) => row.getAttribute("aria-rowindex") !== "1" && within(row).queryAllByRole("cell").length > 1)
    .map((row) => within(row).getAllByRole("cell")[1]!.textContent ?? "");
}

describe("piutang view", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shows the reconnect panel without retrying when the Qasir session expired", async () => {
    const bridge = createMockBridge({ failWith: { show_customer_debts: "QASIR_AUTH_EXPIRED" } });
    renderAt("/piutang", bridge);

    expect(await screen.findByText("Sesi Qasir sudah berakhir. Pemilik perlu menghubungkan ulang.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Buka halaman Connect" }));
    expect(bridge.openedLinks).toEqual(["https://widget.example/connect"]);
    expect(screen.queryByRole("button", { name: "Coba lagi" })).toBeNull();
    expect(callsTo(bridge, "show_customer_debts")).toHaveLength(1);
  });

  it("shows summary tiles, the aging strip and customers with overdue ones first", async () => {
    const { bridge, container } = renderAt("/piutang");

    expect(await screen.findByText("Sisa piutang (laporan Qasir)")).toBeTruthy();
    expect(callsTo(bridge, "show_customer_debts")).toEqual([{}]);
    for (const label of ["Pelanggan", "Nota terbuka", "Lewat jatuh tempo"]) expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    const strip = screen.getByRole("group", { name: "Umur piutang" });
    expect(within(strip).getAllByRole("button")).toHaveLength(8);
    expect(tableNames()).toEqual(["Pelanggan E", "Pelanggan C", "Pelanggan B", "Pelanggan A", "Pelanggan D", "Pelanggan F"]);
    expect(screen.getByText("lewat 200 hari")).toBeTruthy();
    expect(screen.queryByRole("region", { name: /Rincian piutang/ })).toBeNull();
    expect(container.querySelector("form")).toBeNull();
  });

  it("filters by oldest bucket, by name and re-sorts loaded customers", async () => {
    renderAt("/piutang");
    await screen.findByText("Sisa piutang (laporan Qasir)");

    fireEvent.click(within(screen.getByRole("group", { name: "Umur piutang" })).getByRole("button", { name: /^1–3 bulan/ }));
    await waitFor(() => expect(tableNames()).toEqual(["Pelanggan C"]));
    expect(screen.getByText("1 dari 6 pelanggan")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^Semua umur/ }));
    await waitFor(() => expect(tableNames()).toHaveLength(6));

    fireEvent.change(screen.getByRole("searchbox", { name: "Cari pelanggan" }), { target: { value: "pelanggan a" } });
    await waitFor(() => expect(tableNames()).toEqual(["Pelanggan A"]), { timeout: 2_000 });

    fireEvent.click(screen.getByRole("button", { name: "Hapus pencarian" }));
    fireEvent.click(screen.getByRole("button", { name: "Nilai kredit terbesar" }));
    await waitFor(() => expect(tableNames()[0]).toBe("Pelanggan A"));
    fireEvent.click(screen.getByRole("button", { name: "Nota terlama" }));
    await waitFor(() => expect(tableNames()[0]).toBe("Pelanggan F"));
  });

  it("pre-expands focus_customer_id with phone, totals, invoices and payments", async () => {
    const scrolled = vi.spyOn(Element.prototype, "scrollIntoView");
    const { bridge } = renderAt("/piutang?customer_id=3002");

    const panel = await screen.findByRole("region", { name: "Rincian piutang Pelanggan B" });
    expect(scrolled).not.toHaveBeenCalled();
    expect(await within(panel).findByText("Telepon: 0800-0000-0002")).toBeTruthy();
    expect(callsTo(bridge, "show_customer_debts")).toEqual([{ customer_id: 3002 }]);
    expect(callsTo(bridge, "customer_debt_detail")).toEqual([{ customer_id: 3002 }]);
    expect(within(panel).getByText("INV/KREDIT/3002-1")).toBeTruthy();
    expect(within(panel).getByText("Lewat 40 hari")).toBeTruthy();
    expect(within(panel).getAllByText(/^Tunai · /)).toHaveLength(2);

    fireEvent.click(within(panel).getByRole("button", { name: "Tutup rincian" }));
    await waitFor(() => expect(screen.queryByRole("region", { name: /Rincian piutang/ })).toBeNull());
  });

  it("opens a customer's detail on row click, scrolls it into view and closes it on a second click", async () => {
    const scrolled = vi.spyOn(Element.prototype, "scrollIntoView");
    const { bridge } = renderAt("/piutang");
    await screen.findByText("Sisa piutang (laporan Qasir)");

    fireEvent.click(screen.getByText("Pelanggan E"));
    const panel = await screen.findByRole("region", { name: "Rincian piutang Pelanggan E" });
    expect(callsTo(bridge, "customer_debt_detail")).toEqual([{ customer_id: 3005 }]);
    expect(scrolled).toHaveBeenCalledTimes(1);
    expect(scrolled).toHaveBeenCalledWith({ block: "nearest" });
    expect(scrolled.mock.contexts[0]).toBe(panel);

    fireEvent.click(screen.getAllByText("Pelanggan E")[0]!);
    await waitFor(() => expect(screen.queryByRole("region", { name: /Rincian piutang/ })).toBeNull());
  });

  it("asks Claude for a collection message without the phone number", async () => {
    const { bridge } = renderAt("/piutang?customer_id=3002");
    const panel = await screen.findByRole("region", { name: "Rincian piutang Pelanggan B" });

    fireEvent.click(await within(panel).findByRole("button", { name: "Minta Claude buat pesan penagihan" }));

    await waitFor(() => expect(bridge.sentMessages).toHaveLength(1));
    const message = bridge.sentMessages[0]!;
    expect(message).toContain("Pelanggan B");
    expect(message).toContain("INV/KREDIT/3002-1");
    expect(message).toContain("sisa Rp 150.000");
    expect(message).toContain("jatuh tempo");
    expect(message).not.toContain("0800");
    expect(await within(panel).findByText("Permintaan dikirim ke Claude.")).toBeTruthy();
  });

  it("hides the message button when the host cannot send messages", async () => {
    renderAt("/piutang?customer_id=3002", createMockBridge({ host: { canSendMessage: false } }));
    const panel = await screen.findByRole("region", { name: "Rincian piutang Pelanggan B" });
    expect(await within(panel).findByRole("button", { name: "Lihat semua transaksi" })).toBeTruthy();
    expect(within(panel).queryByRole("button", { name: "Minta Claude buat pesan penagihan" })).toBeNull();
  });

  it("links to the customer's transactions for the last 365 days", async () => {
    const { bridge, router } = renderAt("/piutang?customer_id=3002");
    const panel = await screen.findByRole("region", { name: "Rincian piutang Pelanggan B" });

    fireEvent.click(await within(panel).findByRole("button", { name: "Lihat semua transaksi" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/transaksi"));
    expect(await screen.findByRole("button", { name: "Hapus filter pelanggan" })).toBeTruthy();
    expect(callsTo(bridge, "show_transactions")).toEqual([{ start_date: "2025-09-16", end_date: "2026-09-15", customer_id: 3002 }]);
  });
});

describe("piutang helpers", () => {
  const debts = FIXTURES.show_customer_debts({});

  it("sorts and filters loaded customers", () => {
    expect(sortDebtCustomers(debts.customers, "credit").map((c) => c.name)).toEqual([
      "Pelanggan A",
      "Pelanggan B",
      "Pelanggan C",
      "Pelanggan D",
      "Pelanggan E",
      "Pelanggan F",
    ]);
    expect(filterDebtCustomers(debts.customers, "  PELANGGAN d ", undefined).map((c) => c.name)).toEqual(["Pelanggan D"]);
    expect(filterDebtCustomers(debts.customers, "", "gt-730").map((c) => c.name)).toEqual(["Pelanggan F"]);
  });

  it("lists only invoices with a remaining balance in the collection message", () => {
    const detail: ToolOutput<"customer_debt_detail"> = {
      ...FIXTURES.customer_debt_detail({ customer_id: 3001 }),
      invoices: [
        { ...FIXTURES.customer_debt_detail({ customer_id: 3001 }).invoices[0]!, invoice: "INV-LUNAS", remaining: 0 },
        { ...FIXTURES.customer_debt_detail({ customer_id: 3001 }).invoices[1]!, invoice: "INV-SISA", due_date: null, days_overdue: null },
      ],
    };
    const message = collectionMessage(detail);
    expect(message).not.toContain("INV-LUNAS");
    expect(message).toContain("- Nota INV-SISA");
    expect(message).toContain("tanpa tanggal jatuh tempo");
    expect(message).not.toMatch(/\u00a0/);
  });
});
