import type { App, McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import { useApp, useHostStyles } from "@modelcontextprotocol/ext-apps/react";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { RouterProvider, deepEqual, defaultParseSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type JSX } from "react";
import { VIEW_TOOL, type ToolInput, type ViewName } from "../../../src/widgets/contract";
import { BridgeContext, type Bridge } from "../bridge/bridge";
import { createExtAppsBridge } from "../bridge/extAppsBridge";
import { INITIAL_RESULT_WAIT_MS, createInitialToolCall, primeInitialQuery, type InitialToolCall } from "../bridge/initialResult";
import { jakartaTodayBrowser } from "../lib/dates";
import { createWidgetQueryClient } from "./queryClient";
import { createWidgetRouter, type WidgetRouter } from "./router";
import { VIEW_SEARCH, searchFromToolArgs, toolArgsFromSearch, viewPathWithSearch } from "./search";
import { VIEW_PATH } from "./viewPaths";

export const APP_INFO = { name: "manujujaya", version: "0.3.0" } as const;
/** How long the shell waits for the host's toolinput before routing with default filters. */
export const TOOL_INPUT_WAIT_MS = 1_000;
/** How long a toolinput that missed TOOL_INPUT_WAIT_MS can still replace the default filters. */
export const LATE_TOOL_INPUT_WAIT_MS = INITIAL_RESULT_WAIT_MS;

export interface InitialViewOptions {
  view: ViewName;
  call: InitialToolCall;
  queryClient: QueryClient;
  /** The current bridge (a host context change replaces it); null while the App is not connected. */
  getBridge: () => Bridge | null;
  /** Mounts the router on its first path: the model's arguments, or the view's defaults. Called at most once. */
  open: (path: string) => void;
  /** Whether a late toolinput may still move the router (false once the viewer changed view or filters). */
  canApplyLate: () => boolean;
  /** Replaces the mounted router's location with the late toolinput's path; its query is already primed. */
  navigate: (path: string) => void;
  today?: () => string;
  inputWaitMs?: number;
  lateInputWaitMs?: number;
}

/**
 * Opening sequence of the hosted shell. Waits `inputWaitMs` for toolinput. When it arrives, the shell primes the
 * opening query and opens on the model's arguments. When it does not, the shell opens on the defaults and keeps
 * listening for `lateInputWaitMs`, applying a late input through `navigate` while `canApplyLate()` holds.
 * Returns a dispose function.
 */
export function startInitialView(opts: InitialViewOptions): () => void {
  let active = true;
  const today = opts.today ?? (() => jakartaTodayBrowser());

  /** Primes the view tool query for the model's arguments; returns the matching router path. */
  const prime = (args: Record<string, unknown>): string | null => {
    const bridge = opts.getBridge();
    if (!bridge) return null;
    const day = today();
    const search = searchFromToolArgs(opts.view, args, day);
    const toolArgs = toolArgsFromSearch(opts.view, search, day);
    primeInitialQuery(opts.queryClient, bridge, VIEW_TOOL[opts.view], toolArgs as ToolInput<(typeof VIEW_TOOL)[ViewName]>, opts.call);
    return viewPathWithSearch(opts.view, search);
  };

  void opts.call.waitForInput(opts.inputWaitMs ?? TOOL_INPUT_WAIT_MS).then((args) => {
    if (!active) return;
    if (args) {
      opts.open(prime(args) ?? VIEW_PATH[opts.view]);
      return;
    }
    opts.open(VIEW_PATH[opts.view]);
    void opts.call.waitForInput(opts.lateInputWaitMs ?? LATE_TOOL_INPUT_WAIT_MS).then((late) => {
      if (!active || !late || !opts.canApplyLate()) return;
      const path = prime(late);
      if (path) opts.navigate(path);
    });
  });

  return () => {
    active = false;
  };
}

/** True while `location` (router memory history) shows `view` with its default search params. */
export function atViewDefaults(view: ViewName, location: { pathname: string; search: string }): boolean {
  if (location.pathname !== VIEW_PATH[view]) return false;
  const schema = VIEW_SEARCH[view];
  return deepEqual(schema.parse(defaultParseSearch(location.search)), schema.parse({}));
}

function insetsStyle(context: McpUiHostContext | undefined): CSSProperties | undefined {
  const insets = context?.safeAreaInsets;
  if (!insets) return undefined;
  return { paddingTop: insets.top, paddingRight: insets.right, paddingBottom: insets.bottom, paddingLeft: insets.left };
}

function WidgetRoot(props: { bridge: Bridge; queryClient: QueryClient; router: WidgetRouter; style?: CSSProperties | undefined }) {
  return (
    <BridgeContext.Provider value={props.bridge}>
      <QueryClientProvider client={props.queryClient}>
        <div className="mx-auto w-full max-w-5xl p-3 text-sm text-fg" style={props.style}>
          <RouterProvider router={props.router} />
        </div>
      </QueryClientProvider>
    </BridgeContext.Provider>
  );
}

function StatusPanel(props: { title: string; body: string; busy?: boolean }) {
  return (
    <div className="p-3 text-sm text-fg" role={props.busy ? "status" : "alert"} aria-busy={props.busy ?? false}>
      <p className="font-semibold">{props.title}</p>
      <p className="text-fg-muted">{props.body}</p>
    </div>
  );
}

function StandaloneShell(props: { view: ViewName; bridge: Bridge }) {
  const [queryClient] = useState(createWidgetQueryClient);
  const [router] = useState(() => createWidgetRouter({ initialPath: VIEW_PATH[props.view] }));
  return <WidgetRoot bridge={props.bridge} queryClient={queryClient} router={router} />;
}

function HostedShell(props: { view: ViewName }) {
  const { view } = props;
  const [queryClient] = useState(createWidgetQueryClient);
  const [initialCall] = useState(createInitialToolCall);
  const [hostVersion, setHostVersion] = useState(0);
  const [router, setRouter] = useState<WidgetRouter | null>(null);
  const routerRef = useRef<WidgetRouter | null>(null);
  const onHostChange = useRef(() => setHostVersion((v) => v + 1));

  const { app, error } = useApp({
    appInfo: APP_INFO,
    capabilities: { availableDisplayModes: ["inline", "fullscreen"] },
    onAppCreated: (created: App) => {
      // Registered before connect(): the host may send these right after the handshake.
      created.addEventListener("toolinput", (params) => initialCall.setInput(params.arguments ?? {}));
      created.addEventListener("toolresult", (result) => initialCall.setResult(result));
      created.addEventListener("toolcancelled", () => initialCall.cancel());
      created.addEventListener("hostcontextchanged", () => onHostChange.current());
    },
  });
  useHostStyles(app, app?.getHostContext());

  // A fresh object per host-context change re-renders consumers that read bridge.host.
  const bridge = useMemo(() => (app ? createExtAppsBridge(app) : null), [app, hostVersion]);
  const bridgeRef = useRef(bridge);
  bridgeRef.current = bridge;

  useEffect(() => {
    if (!app) return;
    return startInitialView({
      view,
      call: initialCall,
      queryClient,
      getBridge: () => bridgeRef.current,
      open: (path) => {
        const created = createWidgetRouter({ initialPath: path });
        routerRef.current = created;
        setRouter(created);
      },
      canApplyLate: () => routerRef.current !== null && atViewDefaults(view, routerRef.current.history.location),
      navigate: (path) => {
        void routerRef.current?.navigate({ href: path, replace: true });
      },
    });
  }, [app, initialCall, queryClient, view]);

  if (error) return <StatusPanel title="Tidak dapat terhubung" body="Widget gagal terhubung ke aplikasi obrolan. Muat ulang percakapan." />;
  if (!bridge || router === null) return <StatusPanel title="Memuat…" body="Menyiapkan tampilan Qasir." busy />;
  return <WidgetRoot bridge={bridge} queryClient={queryClient} router={router} style={insetsStyle(app?.getHostContext())} />;
}

/**
 * Real host: no `bridge` prop (ext-apps App over postMessage, host styles, initial tool call seeding).
 * Tests and widgets:dev: pass a bridge (e.g. createMockBridge()) and the view opens with default filters.
 */
export function AppShell(props: { view: ViewName; bridge?: Bridge }): JSX.Element {
  return props.bridge ? <StandaloneShell view={props.view} bridge={props.bridge} /> : <HostedShell view={props.view} />;
}
