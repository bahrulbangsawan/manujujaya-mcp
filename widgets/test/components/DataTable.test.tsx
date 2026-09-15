import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataTable, dataColumnHelper } from "../../src/components/DataTable";

type Item = { id: number; name: string; quantity: number };

const col = dataColumnHelper<Item>();
const columns = col.columns([
  col.accessor("name", { header: "Produk" }),
  col.accessor("quantity", { header: "Terjual", meta: { align: "right" } }),
]);

function dataRows(): HTMLElement[] {
  return screen.getAllByRole("row").filter((row) => row.getAttribute("aria-rowindex") !== "1");
}

describe("DataTable", () => {
  const manyRows: Item[] = Array.from({ length: 500 }, (_, i) => ({ id: i + 1, name: `Produk ${i + 1}`, quantity: i }));

  it("virtualizes rows inside the measured scroll box", () => {
    // happy-dom has no layout: give the scroll box 440 px and each row 44 px.
    const offsetHeight = vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.getAttribute("role") === "rowgroup" ? 440 : 44;
    });
    try {
      render(<DataTable rows={manyRows} columns={columns} getRowId={(r) => String(r.id)} emptyText="Tidak ada data" />);
      expect(screen.getByRole("table").getAttribute("aria-rowcount")).toBe("501");
      expect(dataRows().length).toBeLessThan(40);
      expect(screen.getByText("Produk 1")).toBeTruthy();
      expect(screen.queryByText("Produk 300")).toBeNull();

      const scroller = screen.getAllByRole("rowgroup")[1]!;
      scroller.scrollTop = 44 * 299;
      fireEvent.scroll(scroller);
      expect(screen.getByText("Produk 300")).toBeTruthy();
      expect(screen.queryByText("Produk 1")).toBeNull();
    } finally {
      offsetHeight.mockRestore();
    }
  });

  it("shows the rows that fit in maxHeight before the scroll box is measured", () => {
    render(<DataTable rows={manyRows} columns={columns} getRowId={(r) => String(r.id)} maxHeight={440} emptyText="Tidak ada data" />);
    const rendered = dataRows();
    expect(rendered).toHaveLength(10);
    expect(within(rendered[0]!).getByText("Produk 1")).toBeTruthy();
  });

  it("sorts loaded rows when a header is clicked", () => {
    const rows: Item[] = [
      { id: 1, name: "Beta", quantity: 5 },
      { id: 2, name: "Alpha", quantity: 20 },
      { id: 3, name: "Gamma", quantity: 1 },
    ];
    render(<DataTable rows={rows} columns={columns} getRowId={(r) => String(r.id)} emptyText="Tidak ada data" />);
    const firstName = () => within(dataRows()[0]!).getAllByRole("cell")[0]!.textContent;

    expect(firstName()).toBe("Beta");
    fireEvent.click(screen.getByRole("button", { name: /Terjual/ }));
    expect(firstName()).toBe("Alpha"); // numbers sort descending first
    expect(screen.getAllByRole("columnheader")[1]!.getAttribute("aria-sort")).toBe("descending");
    fireEvent.click(screen.getByRole("button", { name: /Terjual/ }));
    expect(firstName()).toBe("Gamma");
    fireEvent.click(screen.getByRole("button", { name: /Produk/ }));
    expect(firstName()).toBe("Alpha"); // text sorts ascending first
  });

  it("calls onRowClick and toggles expanded content", () => {
    const onRowClick = vi.fn();
    const rows: Item[] = [{ id: 7, name: "Kampas rem", quantity: 3 }];
    render(
      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(r) => String(r.id)}
        onRowClick={onRowClick}
        renderExpanded={(r) => <p>Detail {r.name}</p>}
        emptyText="Tidak ada data"
      />,
    );
    const row = dataRows()[0]!;
    fireEvent.click(row);
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
    expect(screen.getByText("Detail Kampas rem")).toBeTruthy();
    fireEvent.keyDown(row, { key: "Enter" });
    expect(screen.queryByText("Detail Kampas rem")).toBeNull();
  });

  it("follows expandedRowId when expansion is controlled", () => {
    const onRowClick = vi.fn();
    const rows: Item[] = [
      { id: 1, name: "Pelanggan A", quantity: 2 },
      { id: 2, name: "Pelanggan B", quantity: 4 },
    ];
    const props = {
      rows,
      columns,
      getRowId: (r: Item) => String(r.id),
      onRowClick,
      renderExpanded: (r: Item) => <p>Detail {r.name}</p>,
      emptyText: "Tidak ada data",
    };
    const { rerender } = render(<DataTable {...props} expandedRowId={null} />);

    // A click reports the row but does not expand it: the parent owns the open id.
    fireEvent.click(dataRows()[1]!);
    expect(onRowClick).toHaveBeenCalledWith(rows[1]);
    expect(screen.queryByText(/^Detail /)).toBeNull();

    rerender(<DataTable {...props} expandedRowId="2" />);
    expect(screen.getByText("Detail Pelanggan B")).toBeTruthy();
    expect(dataRows()[1]!.getAttribute("aria-expanded")).toBe("true");
    expect(dataRows()[0]!.getAttribute("aria-expanded")).toBe("false");

    rerender(<DataTable {...props} expandedRowId="1" />);
    expect(screen.getByText("Detail Pelanggan A")).toBeTruthy();
    expect(screen.queryByText("Detail Pelanggan B")).toBeNull();
  });

  it("shows the empty text and the footer when there are no rows", () => {
    render(
      <DataTable rows={[]} columns={columns} getRowId={(r) => String(r.id)} emptyText="Belum ada produk" footer={<p>Kaki tabel</p>} />,
    );
    expect(screen.getByText("Belum ada produk")).toBeTruthy();
    expect(screen.getByText("Kaki tabel")).toBeTruthy();
  });
});
