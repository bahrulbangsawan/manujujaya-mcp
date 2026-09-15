import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { NO_RETRY, createWidgetQueryClient, shouldRetry } from "../src/app/queryClient";
import { BridgeContext, ToolCallError, type Bridge } from "../src/bridge/bridge";
import { createInitialToolCall, primeInitialQuery, seedInitialResult } from "../src/bridge/initialResult";
import { createMockBridge } from "../src/bridge/mockBridge";
import { toolQueryKey, useMorePages, useToolQuery } from "../src/bridge/useToolQuery";
import { FIXTURES } from "../dev/fixtures";

function wrapperFor(bridge: Bridge, queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <BridgeContext.Provider value={bridge}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </BridgeContext.Provider>
    );
  };
}

describe("createWidgetQueryClient", () => {
  it("sets iframe-friendly defaults", () => {
    const queries = createWidgetQueryClient().getDefaultOptions().queries;
    expect(queries).toMatchObject({
      staleTime: 60_000,
      gcTime: 600_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      networkMode: "always",
    });
    expect(queries?.retry).toBe(shouldRetry);
  });

  it("retries once, never for auth, permission, input, rate-limit or contract errors", () => {
    const err = (code: string) => new ToolCallError({ code, message: code });
    expect(shouldRetry(0, err("UPSTREAM_ERROR"))).toBe(true);
    expect(shouldRetry(1, err("UPSTREAM_ERROR"))).toBe(false);
    expect(shouldRetry(0, err("UPSTREAM_TIMEOUT"))).toBe(true);
    for (const code of ["QASIR_AUTH_EXPIRED", "FORBIDDEN", "INVALID_INPUT", "QASIR_RATE_LIMITED", "CONTRACT_MISMATCH"]) {
      expect(NO_RETRY.has(code)).toBe(true);
      expect(shouldRetry(0, err(code))).toBe(false);
    }
    expect(shouldRetry(0, new Error("plain"))).toBe(true);
  });
});

describe("seedInitialResult", () => {
  const args = { inventory_id: 5003 };
  const payload = FIXTURES.stock_velocity(args);

  it("stores a valid result under the tool query key", () => {
    const queryClient = createWidgetQueryClient();
    expect(seedInitialResult(queryClient, "stock_velocity", args, { structuredContent: payload, content: [] })).toBe(true);
    expect(queryClient.getQueryData(toolQueryKey("stock_velocity", { inventory_id: 5003 }))).toEqual(payload);
  });

  it("seeds nothing for error results, contract mismatches and non-objects", () => {
    const queryClient = createWidgetQueryClient();
    const key = toolQueryKey("stock_velocity", args);
    expect(
      seedInitialResult(queryClient, "stock_velocity", args, {
        isError: true,
        content: [{ type: "text", text: '{"code":"FORBIDDEN","message":"no"}' }],
      }),
    ).toBe(false);
    expect(seedInitialResult(queryClient, "stock_velocity", args, { structuredContent: { view: "stok" } })).toBe(false);
    expect(seedInitialResult(queryClient, "stock_velocity", args, "nope")).toBe(false);
    expect(queryClient.getQueryData(key)).toBeUndefined();
  });
});

describe("primeInitialQuery", () => {
  const args = { inventory_id: 5003 };

  it("waits for the host result instead of calling the tool", async () => {
    const queryClient = createWidgetQueryClient();
    const bridge = createMockBridge();
    const call = createInitialToolCall();
    primeInitialQuery(queryClient, bridge, "stock_velocity", args, call);
    const { result } = renderHook(() => useToolQuery("stock_velocity", args), { wrapper: wrapperFor(bridge, queryClient) });
    expect(result.current.isPending).toBe(true);
    call.setResult({ structuredContent: FIXTURES.stock_velocity(args) });
    await waitFor(() => expect(result.current.data?.stock).toBe(FIXTURES.stock_velocity(args).stock));
    expect(bridge.calls).toEqual([]);
  });

  it("seeds synchronously when the result already arrived", () => {
    const queryClient = createWidgetQueryClient();
    const bridge = createMockBridge();
    const call = createInitialToolCall();
    call.setResult({ structuredContent: FIXTURES.stock_velocity(args) });
    primeInitialQuery(queryClient, bridge, "stock_velocity", args, call);
    expect(queryClient.getQueryData(toolQueryKey("stock_velocity", args))).toBeDefined();
  });

  it("surfaces a host error result as the query error without calling the tool", async () => {
    const queryClient = createWidgetQueryClient();
    const bridge = createMockBridge();
    const call = createInitialToolCall();
    primeInitialQuery(queryClient, bridge, "stock_velocity", args, call);
    const { result } = renderHook(() => useToolQuery("stock_velocity", args), { wrapper: wrapperFor(bridge, queryClient) });
    call.setResult({ isError: true, content: [{ type: "text", text: '{"code":"QASIR_AUTH_EXPIRED","message":"expired"}' }] });
    await waitFor(() => expect(result.current.error?.code).toBe("QASIR_AUTH_EXPIRED"));
    expect(bridge.calls).toEqual([]);
  });

  it("calls the tool when the host cancels the call", async () => {
    const queryClient = createWidgetQueryClient();
    const bridge = createMockBridge();
    const call = createInitialToolCall();
    primeInitialQuery(queryClient, bridge, "stock_velocity", args, call);
    call.cancel();
    await waitFor(() => expect(queryClient.getQueryData(toolQueryKey("stock_velocity", args))).toBeDefined());
    expect(bridge.calls).toEqual([{ name: "stock_velocity", args }]);
  });
});

describe("createInitialToolCall", () => {
  it("keeps the first input and times out when none arrives", async () => {
    const call = createInitialToolCall();
    expect(await call.waitForInput(5)).toBeNull();
    call.setInput({ search: "Kopi" });
    call.setInput({ search: "Teh" });
    expect(await call.waitForInput(5)).toEqual({ search: "Kopi" });
  });
});

describe("useToolQuery", () => {
  it("fetches through the bridge", async () => {
    const bridge = createMockBridge();
    const { result } = renderHook(() => useToolQuery("show_purchase_orders", { status: "completed" }), {
      wrapper: wrapperFor(bridge, createWidgetQueryClient()),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.rows.every((row) => row.status === "completed")).toBe(true);
  });

  it("exposes ToolCallError codes", async () => {
    const bridge = createMockBridge({ failWith: { show_purchase_orders: "FORBIDDEN" } });
    const { result } = renderHook(() => useToolQuery("show_purchase_orders", {}), {
      wrapper: wrapperFor(bridge, createWidgetQueryClient()),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.code).toBe("FORBIDDEN");
    expect(bridge.calls).toHaveLength(1); // FORBIDDEN is never retried
  });
});

describe("useMorePages", () => {
  it("loads nothing until asked, then follows next_page", async () => {
    const bridge = createMockBridge();
    const { result } = renderHook(
      () =>
        useMorePages({
          tool: "stock_page",
          args: {},
          startPage: 2,
          rowsOf: (page) => page.rows,
        }),
      { wrapper: wrapperFor(bridge, createWidgetQueryClient()) },
    );
    expect(result.current.rows).toEqual([]);
    expect(result.current.hasMore).toBe(true);
    expect(bridge.calls).toEqual([]);

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.rows).toHaveLength(50));
    expect(result.current.hasMore).toBe(true);

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.rows).toHaveLength(70));
    expect(result.current.hasMore).toBe(false);
    expect(bridge.calls).toEqual([
      { name: "stock_page", args: { page: 2 } },
      { name: "stock_page", args: { page: 3 } },
    ]);

    act(() => result.current.loadMore());
    expect(bridge.calls).toHaveLength(2);
    expect(result.current.error).toBeNull();
  });

  it("does nothing when there is no next page or it is disabled", () => {
    const bridge = createMockBridge();
    const wrapper = wrapperFor(bridge, createWidgetQueryClient());
    const none = renderHook(() => useMorePages({ tool: "stock_page", args: {}, startPage: null, rowsOf: (page) => page.rows }), {
      wrapper,
    });
    const disabled = renderHook(
      () => useMorePages({ tool: "stock_page", args: {}, startPage: 2, rowsOf: (page) => page.rows, enabled: false }),
      { wrapper },
    );
    act(() => {
      none.result.current.loadMore();
      disabled.result.current.loadMore();
    });
    expect(none.result.current.hasMore).toBe(false);
    expect(disabled.result.current.hasMore).toBe(false);
    expect(bridge.calls).toEqual([]);
  });

  it("reports page errors", async () => {
    const bridge = createMockBridge({ failWith: { transactions_page: "QASIR_RATE_LIMITED" } });
    const { result } = renderHook(
      () =>
        useMorePages({
          tool: "transactions_page",
          args: { start_date: "2026-09-01", end_date: "2026-09-15" },
          startPage: 2,
          rowsOf: (page) => page.days,
        }),
      { wrapper: wrapperFor(bridge, createWidgetQueryClient()) },
    );
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.error?.code).toBe("QASIR_RATE_LIMITED"));
  });
});
