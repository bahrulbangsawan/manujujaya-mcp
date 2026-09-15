import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChipGroup, type ChipOption } from "../../src/components/ChipGroup";

type Status = "semua" | "order_processed" | "completed";
const options: ChipOption<Status>[] = [
  { value: "semua", label: "Semua" },
  { value: "order_processed", label: "Diproses", count: 3 },
  { value: "completed", label: "Selesai", count: 12 },
];

describe("ChipGroup", () => {
  it("single: marks the value pressed and emits only a different choice", () => {
    const onChange = vi.fn<(value: Status) => void>();
    render(<ChipGroup label="Status" options={options} value="semua" onChange={onChange} />);
    expect(screen.getByRole("group", { name: "Status" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Semua" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /Selesai/ }).textContent).toContain("12");

    fireEvent.click(screen.getByRole("button", { name: "Semua" }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Diproses/ }));
    expect(onChange).toHaveBeenCalledWith("order_processed");
  });

  it("multiple: toggles values and keeps option order", () => {
    const onChange = vi.fn<(value: Status[]) => void>();
    const { rerender } = render(<ChipGroup multiple options={options} value={["completed"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Diproses/ }));
    expect(onChange).toHaveBeenLastCalledWith(["order_processed", "completed"]);

    rerender(<ChipGroup multiple options={options} value={["order_processed", "completed"]} onChange={onChange} />);
    expect(screen.getByRole("button", { name: /Diproses/ }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /Selesai/ }));
    expect(onChange).toHaveBeenLastCalledWith(["order_processed"]);
  });
});
