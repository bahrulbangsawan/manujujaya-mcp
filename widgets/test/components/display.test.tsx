import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BarList } from "../../src/components/BarList";
import { EmptyState } from "../../src/components/EmptyState";
import { KpiTile } from "../../src/components/KpiTile";
import { LoadMoreFooter } from "../../src/components/LoadMoreFooter";
import { Skeleton } from "../../src/components/Skeleton";
import { StatusBadge } from "../../src/components/StatusBadge";

describe("display components", () => {
  it("KpiTile shows value and change direction", () => {
    const { rerender } = render(
      <KpiTile label="Penjualan kotor" value="Rp 1.250.000" change={{ percent: 12.5, direction: "up" }} />,
    );
    expect(screen.getByText("Rp 1.250.000")).toBeTruthy();
    expect(screen.getByText(/▲/).parentElement?.textContent).toContain("Naik 12,5%");

    rerender(<KpiTile label="Laba kotor" value="Rp 0" change={{ percent: null, direction: null }} hint="Periode kosong" />);
    expect(screen.getByText("Belum ada pembanding")).toBeTruthy();
    expect(screen.getByText("Periode kosong")).toBeTruthy();
  });

  it("BarList renders selectable rows and the empty text", () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <BarList
        emptyText="Belum ada kategori"
        items={[
          { key: "1", label: "Oli", value: 300, valueLabel: "Rp 300", onSelect },
          { key: "2", label: "Busi", value: 100, valueLabel: "Rp 100" },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Oli/ }));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: /Busi/ })).toBeNull();

    rerender(<BarList emptyText="Belum ada kategori" items={[]} />);
    expect(screen.getByText("Belum ada kategori")).toBeTruthy();
  });

  it("StatusBadge, EmptyState and Skeleton render their copy", () => {
    render(
      <>
        <StatusBadge tone="danger">Refund</StatusBadge>
        <EmptyState title="Tidak ada transaksi" body="Coba periode lain." />
        <Skeleton rows={3} note="Memuat stok, bisa sampai 15 detik" />
      </>,
    );
    expect(screen.getByText("Refund")).toBeTruthy();
    expect(screen.getByText("Coba periode lain.")).toBeTruthy();
    expect(screen.getByText("Memuat stok, bisa sampai 15 detik")).toBeTruthy();
    expect(document.querySelectorAll('[aria-busy="true"] [aria-hidden="true"]')).toHaveLength(3);
  });

  it("LoadMoreFooter loads on click, disables while fetching and hides when done", () => {
    const onLoadMore = vi.fn();
    const { rerender } = render(
      <LoadMoreFooter hasMore isFetching={false} onLoadMore={onLoadMore} loadedLabel="50 baris dimuat" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Muat lebih banyak" }));
    expect(onLoadMore).toHaveBeenCalledOnce();

    rerender(<LoadMoreFooter hasMore isFetching onLoadMore={onLoadMore} loadedLabel="50 baris dimuat" />);
    expect(screen.getByRole("button", { name: "Memuat…" })).toHaveProperty("disabled", true);

    rerender(<LoadMoreFooter hasMore={false} isFetching={false} onLoadMore={onLoadMore} loadedLabel="100 baris dimuat" />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("100 baris dimuat")).toBeTruthy();
  });
});
