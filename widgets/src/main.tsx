import "./styles.css";
import { createRoot } from "react-dom/client";
import { AppShell } from "./app/AppShell";
import { viewFromMarker } from "./app/viewPaths";

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root element");
const root = createRoot(container);

// No StrictMode: its double mount would close and re-create the ext-apps App (a second ui/initialize).
if (import.meta.env.DEV && window.parent === window) {
  // widgets:dev opened directly in a browser tab: fixture data, view from ?view=.
  // The dynamic import sits in a branch that production builds drop, so fixtures never ship.
  void import("./bridge/mockBridge").then(({ createMockBridge }) => {
    const view = viewFromMarker(new URLSearchParams(window.location.search).get("view") ?? undefined);
    root.render(<AppShell view={view} bridge={createMockBridge({ latencyMs: 400 })} />);
  });
} else {
  // Inside a host iframe: ext-apps App; the Worker replaced the data-view marker with the view name.
  root.render(<AppShell view={viewFromMarker(container.dataset.view)} />);
}
