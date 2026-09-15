import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchInput } from "../../src/components/SearchInput";

describe("SearchInput", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("emits one trimmed value after typing pauses", () => {
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} placeholder="Cari produk" debounceMs={400} />);
    const input = screen.getByRole("searchbox", { name: "Cari produk" });

    for (const text of ["k", "ka", "kam", "kampas "]) {
      fireEvent.change(input, { target: { value: text } });
      act(() => {
        vi.advanceTimersByTime(100);
      });
    }
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("kampas");
  });

  it("emits immediately on Enter and on clear", () => {
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} placeholder="Cari produk" />);
    const input = screen.getByRole("searchbox");

    fireEvent.change(input, { target: { value: "oli" } });
    act(() => {
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(onChange).toHaveBeenLastCalledWith("oli");

    fireEvent.click(screen.getByRole("button", { name: "Hapus pencarian" }));
    expect(onChange).toHaveBeenLastCalledWith("");
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("follows an outside value change without echoing it", () => {
    const onChange = vi.fn();
    const { rerender } = render(<SearchInput value="" onChange={onChange} placeholder="Cari" />);
    rerender(<SearchInput value="busi" onChange={onChange} placeholder="Cari" />);
    expect(screen.getByRole("searchbox")).toHaveProperty("value", "busi");
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});
