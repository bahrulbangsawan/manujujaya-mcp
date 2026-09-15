import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { VIEWS } from "../../../src/widgets/contract";
import { VIEW_PATH } from "../app/viewPaths";
import { useBridge } from "../bridge/bridge";
import { ViewSwitcher } from "./ViewSwitcher";
import { buttonClass } from "./ui";

export interface ViewFrameProps {
  title: string;
  /** e.g. "Outlet 100001 · Diperbarui 14.32" */
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function ViewFrame({ title, subtitle, actions, children }: ViewFrameProps) {
  const bridge = useBridge();
  const queryClient = useQueryClient();
  const fetching = useIsFetching() > 0;
  const pathname = useLocation({ select: (location) => location.pathname });
  const current = VIEWS.find((view) => VIEW_PATH[view] === pathname) ?? "penjualan";
  const fullscreen = bridge.host.displayMode === "fullscreen";

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-fg">{title}</h1>
          {subtitle ? <p className="text-xs text-fg-muted">{subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          <button
            type="button"
            className={buttonClass}
            disabled={fetching}
            onClick={() => {
              void queryClient.refetchQueries({ type: "active" });
            }}
          >
            {fetching ? "Memuat…" : "Muat ulang"}
          </button>
          {bridge.host.canFullscreen ? (
            <button
              type="button"
              className={buttonClass}
              onClick={() => {
                void bridge.toggleFullscreen();
              }}
            >
              {fullscreen ? "Keluar layar penuh" : "Layar penuh"}
            </button>
          ) : null}
        </div>
      </header>
      <ViewSwitcher current={current} />
      <main className="space-y-4">{children}</main>
    </div>
  );
}
