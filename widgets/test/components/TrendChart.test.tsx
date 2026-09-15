import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TrendChart, type TrendPoint } from "../../src/components/TrendChart";

const points: TrendPoint[] = [
  { date: "2026-09-13", amount: 1_250_000, comparisonAmount: 900_000 },
  { date: "2026-09-14", amount: 0, comparisonAmount: null },
  { date: "2026-09-15", amount: 2_000_000, comparisonAmount: 1_500_000 },
];

describe("TrendChart", () => {
  it("renders one focusable point per item with a roving tab stop", () => {
    const { container } = render(<TrendChart points={points} />);
    const rendered = container.querySelectorAll("[data-point-index]");
    expect(rendered).toHaveLength(3);
    expect([...rendered].filter((el) => el.getAttribute("tabindex") === "0")).toHaveLength(1);
    expect(screen.getByLabelText(/13 Sep 2026: Rp\s1\.250\.000, periode sebelumnya Rp\s900\.000/)).toBeTruthy();
  });

  it("calls onSelectDate on click and on Enter", () => {
    const onSelectDate = vi.fn();
    render(<TrendChart points={points} onSelectDate={onSelectDate} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);

    fireEvent.click(buttons[2]!);
    expect(onSelectDate).toHaveBeenLastCalledWith("2026-09-15");

    fireEvent.keyDown(buttons[0]!, { key: "Enter" });
    expect(onSelectDate).toHaveBeenLastCalledWith("2026-09-13");
    expect(onSelectDate).toHaveBeenCalledTimes(2);
  });

  it("shows a tooltip for the focused point and moves with arrow keys", () => {
    render(<TrendChart points={points} />);
    const first = screen.getAllByRole("img")[0]!;
    fireEvent.focus(first);
    expect(screen.getByRole("tooltip").textContent).toContain("13 Sep 2026");
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(screen.getByRole("tooltip").textContent).toContain("14 Sep 2026");
  });

  it("renders an empty state without points", () => {
    render(<TrendChart points={[]} />);
    expect(screen.getByText("Belum ada data untuk grafik")).toBeTruthy();
  });
});
