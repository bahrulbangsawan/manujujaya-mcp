import { Link } from "@tanstack/react-router";
import { VIEWS, type ViewName } from "../../../src/widgets/contract";
import { VIEW_LABEL, VIEW_PATH } from "../app/viewPaths";
import { cx } from "./ui";

export function ViewSwitcher({ current }: { current: ViewName }) {
  return (
    <nav aria-label="Pilih tampilan" className="-mx-1 flex w-full min-w-0 gap-1 overflow-x-auto px-1 pb-1">
      {VIEWS.map((view) => {
        const active = view === current;
        return (
          <Link
            key={view}
            to={VIEW_PATH[view]}
            aria-current={active ? "page" : undefined}
            className={cx(
              "inline-flex min-h-8 shrink-0 items-center rounded-md px-3 text-sm",
              active ? "bg-info-soft font-medium text-info" : "text-fg-muted hover:bg-surface-muted",
            )}
          >
            {VIEW_LABEL[view]}
          </Link>
        );
      })}
    </nav>
  );
}
