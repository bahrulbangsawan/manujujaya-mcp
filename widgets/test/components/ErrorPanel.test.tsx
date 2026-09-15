import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { BridgeContext, ToolCallError, type Bridge } from "../../src/bridge/bridge";
import { createMockBridge } from "../../src/bridge/mockBridge";
import { ErrorPanel } from "../../src/components/ErrorPanel";

const CONNECT_URL = "https://mcp.example.test/connect";

function renderWithBridge(bridge: Bridge, ui: ReactNode) {
  return render(<BridgeContext.Provider value={bridge}>{ui}</BridgeContext.Provider>);
}

describe("ErrorPanel", () => {
  it("offers the Connect page when the error carries connect_url, without a retry", () => {
    const bridge = createMockBridge();
    const error = new ToolCallError({ code: "QASIR_AUTH_EXPIRED", message: "expired", connect_url: CONNECT_URL });
    renderWithBridge(bridge, <ErrorPanel error={error} onRetry={vi.fn()} />);

    expect(screen.getByRole("alert").textContent).toContain("Sesi Qasir sudah berakhir. Pemilik perlu menghubungkan ulang.");
    fireEvent.click(screen.getByRole("button", { name: "Buka halaman Connect" }));
    expect(bridge.openedLinks).toEqual([CONNECT_URL]);
    expect(screen.queryByRole("button", { name: "Coba lagi" })).toBeNull();
  });

  it("hides the Connect button when connect_url is absent", () => {
    renderWithBridge(createMockBridge(), <ErrorPanel error={new ToolCallError({ code: "QASIR_AUTH_EXPIRED", message: "expired" })} />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Buka halaman Connect" })).toBeNull();
  });

  it("shows the URL as text when the host refuses to open it", async () => {
    const bridge: Bridge = { ...createMockBridge(), openLink: () => Promise.reject(new Error("Host menolak membuka tautan")) };
    const error = new ToolCallError({ code: "QASIR_AUTH_EXPIRED", message: "expired", connect_url: CONNECT_URL });
    renderWithBridge(bridge, <ErrorPanel error={error} />);
    fireEvent.click(screen.getByRole("button", { name: "Buka halaman Connect" }));
    await waitFor(() => expect(screen.getByText(`Buka alamat ini di browser: ${CONNECT_URL}`)).toBeTruthy());
  });

  it("offers a retry for retryable errors", () => {
    const onRetry = vi.fn();
    renderWithBridge(createMockBridge(), <ErrorPanel error={new ToolCallError({ code: "UPSTREAM_TIMEOUT", message: "slow" })} onRetry={onRetry} />);
    expect(screen.getByRole("alert").textContent).toContain("Persempit rentang tanggal");
    expect(screen.queryByRole("button", { name: "Buka halaman Connect" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
