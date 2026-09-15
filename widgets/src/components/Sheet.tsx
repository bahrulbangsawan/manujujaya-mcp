import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { buttonClass } from "./ui";

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Side panel rendered in place (no portal). Escape and the backdrop close it; Tab stays inside. */
export function Sheet({ open, title, onClose, children }: SheetProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.focus();
    function onDocumentKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      }
    }
    document.addEventListener("keydown", onDocumentKeyDown);
    return () => {
      document.removeEventListener("keydown", onDocumentKeyDown);
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);

  if (!open) return null;

  function trapTab(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab" || !panel.current) return;
    const focusable = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (element) => !element.hasAttribute("disabled"),
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) {
      event.preventDefault();
      return;
    }
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === panel.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div aria-hidden="true" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={trapTab}
        className="relative flex h-full w-full max-w-lg flex-col bg-surface text-fg shadow-xl focus:outline-none"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 id={titleId} className="min-w-0 truncate text-base font-semibold">
            {title}
          </h2>
          <button type="button" className={buttonClass} onClick={onClose}>
            Tutup
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
