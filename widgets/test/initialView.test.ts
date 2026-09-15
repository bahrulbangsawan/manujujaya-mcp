import { describe, expect, it, vi } from "vitest";
import { atViewDefaults, startInitialView, type InitialViewOptions } from "../src/app/AppShell";
import { createWidgetQueryClient } from "../src/app/queryClient";
import { createWidgetRouter } from "../src/app/router";
import { createInitialToolCall } from "../src/bridge/initialResult";
import { createMockBridge } from "../src/bridge/mockBridge";
import { toolQueryKey } from "../src/bridge/useToolQuery";
import { FIXTURES } from "../dev/fixtures";

const today = "2026-09-15";
const kopiKey = toolQueryKey("show_stock_browser", { search: "Kopi" });

function setup(overrides: Partial<InitialViewOptions> = {}) {
  const queryClient = createWidgetQueryClient();
  const bridge = createMockBridge();
  const call = createInitialToolCall();
  const opened: string[] = [];
  const navigated: string[] = [];
  const options: InitialViewOptions = {
    view: "stok",
    call,
    queryClient,
    getBridge: () => bridge,
    open: (path) => {
      opened.push(path);
    },
    canApplyLate: () => true,
    navigate: (path) => {
      navigated.push(path);
    },
    today: () => today,
    inputWaitMs: 10,
    lateInputWaitMs: 1_000,
    ...overrides,
  };
  return { queryClient, bridge, call, opened, navigated, options };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

describe("startInitialView", () => {
  it("opens on the model's arguments when toolinput arrives in time", async () => {
    const t = setup();
    const payload = FIXTURES.show_stock_browser({ search: "Kopi" });
    startInitialView(t.options);
    t.call.setInput({ search: "  Kopi " });
    t.call.setResult({ structuredContent: payload });
    await vi.waitFor(() => expect(t.opened).toEqual(["/stok?search=Kopi"]));
    expect(t.queryClient.getQueryData(kopiKey)).toEqual(payload);
    await settle();
    expect(t.navigated).toEqual([]);
    expect(t.bridge.calls).toEqual([]);
  });

  it("opens on the defaults, then moves to a late toolinput and uses the host's result", async () => {
    const t = setup();
    const payload = FIXTURES.show_stock_browser({ search: "Kopi" });
    startInitialView(t.options);
    await vi.waitFor(() => expect(t.opened).toEqual(["/stok"]));
    expect(t.navigated).toEqual([]);

    t.call.setInput({ search: "Kopi" });
    await vi.waitFor(() => expect(t.navigated).toEqual(["/stok?search=Kopi"]));
    expect(t.queryClient.getQueryState(kopiKey)?.status).toBe("pending");

    t.call.setResult({ structuredContent: payload });
    await vi.waitFor(() => expect(t.queryClient.getQueryData(kopiKey)).toEqual(payload));
    expect(t.opened).toEqual(["/stok"]);
    expect(t.bridge.calls).toEqual([]);
  });

  it("ignores a late toolinput once the viewer has changed view or filters", async () => {
    const t = setup({ canApplyLate: () => false });
    startInitialView(t.options);
    await vi.waitFor(() => expect(t.opened).toEqual(["/stok"]));
    t.call.setInput({ search: "Kopi" });
    await settle();
    expect(t.navigated).toEqual([]);
    expect(t.queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(t.bridge.calls).toEqual([]);
  });

  it("stops listening when disposed, before or after opening", async () => {
    const before = setup();
    startInitialView(before.options)();
    before.call.setInput({ search: "Kopi" });
    await settle();
    expect(before.opened).toEqual([]);

    const after = setup();
    const stop = startInitialView(after.options);
    await vi.waitFor(() => expect(after.opened).toEqual(["/stok"]));
    stop();
    after.call.setInput({ search: "Kopi" });
    await settle();
    expect(after.navigated).toEqual([]);
    expect(after.queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});

describe("atViewDefaults", () => {
  it("is true only while the location shows the view with its default search params", () => {
    expect(atViewDefaults("stok", { pathname: "/stok", search: "" })).toBe(true);
    expect(atViewDefaults("stok", { pathname: "/stok", search: "?search=" })).toBe(true);
    expect(atViewDefaults("stok", { pathname: "/stok", search: "?search=Kopi" })).toBe(false);
    expect(atViewDefaults("stok", { pathname: "/piutang", search: "" })).toBe(false);
    expect(atViewDefaults("transaksi", { pathname: "/transaksi", search: "?preset=hari_ini" })).toBe(true);
    expect(atViewDefaults("transaksi", { pathname: "/transaksi", search: "?preset=kemarin" })).toBe(false);
    expect(atViewDefaults("piutang", { pathname: "/piutang", search: "?sort=credit" })).toBe(false);
  });

  it("follows the router's memory history", async () => {
    const router = createWidgetRouter({ initialPath: "/stok" });
    expect(atViewDefaults("stok", router.history.location)).toBe(true);
    await router.navigate({ href: "/stok?search=Kopi", replace: true });
    expect(router.history.location.search).toBe("?search=Kopi");
    expect(router.history.length).toBe(1);
    expect(atViewDefaults("stok", router.history.location)).toBe(false);
  });
});
