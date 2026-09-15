import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Sheet } from "../../src/components/Sheet";

describe("Sheet", () => {
  it("renders nothing while closed", () => {
    render(
      <Sheet open={false} title="Riwayat stok" onClose={vi.fn()}>
        isi
      </Sheet>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("is a labelled modal dialog that takes focus and closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <Sheet open title="Riwayat stok" onClose={onClose}>
        <button type="button">Muat lebih banyak</button>
      </Sheet>,
    );
    const dialog = screen.getByRole("dialog", { name: "Riwayat stok" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(dialog);

    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes from the Tutup button and keeps Tab inside the panel", () => {
    const onClose = vi.fn();
    render(
      <Sheet open title="Detail nota" onClose={onClose}>
        <button type="button">Lihat transaksi pelanggan ini</button>
      </Sheet>,
    );
    const close = screen.getByRole("button", { name: "Tutup" });
    const last = screen.getByRole("button", { name: "Lihat transaksi pelanggan ini" });
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(close);

    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
