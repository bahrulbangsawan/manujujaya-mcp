import { Outlet, createMemoryHistory, createRootRoute, createRouter } from "@tanstack/react-router";
import { VIEW_ROUTES } from "../routes";

function AppLayout() {
  return (
    <div className="flex min-h-0 flex-col gap-3">
      <Outlet />
    </div>
  );
}

export function NotFoundPanel() {
  return (
    <section role="alert" className="rounded-md border border-line bg-surface-muted p-4">
      <p className="font-semibold text-fg">Tampilan belum tersedia</p>
      <p className="mt-1 text-sm text-fg-muted">Tampilan ini belum ada di versi widget ini. Minta Claude membuka tampilan lain.</p>
    </section>
  );
}

export const rootRoute = createRootRoute({ component: AppLayout, notFoundComponent: NotFoundPanel });

/** Code-based route tree over in-memory history (the sandboxed iframe must not touch window.history). */
export function createWidgetRouter(opts: { initialPath: string }) {
  const routeTree = rootRoute.addChildren(VIEW_ROUTES.map((createViewRoute) => createViewRoute(rootRoute)));
  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [opts.initialPath] }),
    defaultPreload: false,
    scrollRestoration: false,
    defaultNotFoundComponent: NotFoundPanel,
  });
}

export type WidgetRouter = ReturnType<typeof createWidgetRouter>;
