import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PresetRangePicker, type PresetRangeValue } from "../../src/components/PresetRangePicker";

const TODAY = "2026-09-15";
const week: PresetRangeValue = { preset: "7_hari", start_date: "2026-09-09", end_date: "2026-09-15" };

function openCustom() {
  fireEvent.click(screen.getByRole("button", { name: "Pilih tanggal" }));
  return { start: screen.getByLabelText("Dari"), end: screen.getByLabelText("Sampai") };
}

describe("PresetRangePicker", () => {
  it("emits the preset range for a preset chip", () => {
    const onChange = vi.fn();
    render(<PresetRangePicker value={week} onChange={onChange} today={TODAY} />);
    expect(screen.getByRole("button", { name: "7 hari terakhir" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Kemarin" }));
    expect(onChange).toHaveBeenCalledWith({ preset: "kemarin", start_date: "2026-09-14", end_date: "2026-09-14" });
  });

  it("applies a custom range with the Terapkan button without rendering a <form>", async () => {
    const onChange = vi.fn();
    const { container } = render(<PresetRangePicker value={week} onChange={onChange} today={TODAY} />);
    const { start, end } = openCustom();
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(start, { target: { value: "2026-08-01" } });
    fireEvent.change(end, { target: { value: "2026-08-31" } });
    const apply = screen.getByRole("button", { name: "Terapkan" });
    expect(apply.getAttribute("type")).toBe("button");
    fireEvent.click(apply);

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({ preset: "custom", start_date: "2026-08-01", end_date: "2026-08-31" }),
    );
    expect(container.querySelector("form")).toBeNull();
  });

  it("applies a custom range when Enter is pressed in a date input", async () => {
    const onChange = vi.fn();
    render(<PresetRangePicker value={week} onChange={onChange} today={TODAY} />);
    const { start } = openCustom();
    fireEvent.change(start, { target: { value: "2026-09-01" } });
    fireEvent.keyDown(start, { key: "Enter" });
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({ preset: "custom", start_date: "2026-09-01", end_date: "2026-09-15" }),
    );
  });

  it("shows an Indonesian error and does not apply a reversed range", async () => {
    const onChange = vi.fn();
    render(<PresetRangePicker value={week} onChange={onChange} today={TODAY} />);
    const { start, end } = openCustom();
    fireEvent.change(start, { target: { value: "2026-09-20" } });
    fireEvent.change(end, { target: { value: "2026-09-10" } });
    fireEvent.click(screen.getByRole("button", { name: "Terapkan" }));
    expect(await screen.findByText("Tanggal akhir harus sama dengan atau setelah tanggal awal")).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("rejects ranges longer than 366 days", async () => {
    const onChange = vi.fn();
    render(<PresetRangePicker value={week} onChange={onChange} today={TODAY} />);
    const { start } = openCustom();
    fireEvent.change(start, { target: { value: "2025-09-14" } });
    fireEvent.click(screen.getByRole("button", { name: "Terapkan" }));
    expect(await screen.findByText("Rentang tanggal paling panjang 366 hari")).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });
});
