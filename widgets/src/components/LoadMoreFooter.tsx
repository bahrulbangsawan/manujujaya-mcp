import { useEffect, useRef } from "react";
import { buttonClass } from "./ui";

export interface LoadMoreFooterProps {
  hasMore: boolean;
  isFetching: boolean;
  onLoadMore: () => void;
  /** e.g. "150 baris dimuat" */
  loadedLabel: string;
}

export function LoadMoreFooter({ hasMore, isFetching, onLoadMore, loadedLabel }: LoadMoreFooterProps) {
  const sentinel = useRef<HTMLDivElement>(null);
  const latest = useRef({ hasMore, isFetching, onLoadMore });

  useEffect(() => {
    latest.current = { hasMore, isFetching, onLoadMore };
  });

  useEffect(() => {
    const element = sentinel.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    // The first notification only reports the initial state. Auto-loading waits for the footer to
    // scroll into view, so an auto-resized inline frame (always "visible") never pages by itself.
    let initial = true;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.some((entry) => entry.isIntersecting);
      if (initial) {
        initial = false;
        return;
      }
      const current = latest.current;
      if (visible && current.hasMore && !current.isFetching) current.onLoadMore();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={sentinel} className="flex flex-wrap items-center justify-between gap-2 pt-2">
      <span className="text-xs text-fg-muted" aria-live="polite">
        {loadedLabel}
      </span>
      {hasMore ? (
        <button type="button" className={buttonClass} disabled={isFetching} onClick={onLoadMore}>
          {isFetching ? "Memuat…" : "Muat lebih banyak"}
        </button>
      ) : null}
    </div>
  );
}
