import { useState } from "react";
import { useBridge, type ToolCallError } from "../bridge/bridge";
import { errorCopy } from "../lib/errors";
import { buttonClass } from "./ui";

export function ErrorPanel({ error, onRetry }: { error: ToolCallError; onRetry?: () => void }) {
  const bridge = useBridge();
  const copy = errorCopy(error);
  const [linkFailed, setLinkFailed] = useState(false);
  const connectUrl = copy.connectUrl;

  return (
    <div role="alert" className="rounded-lg border border-line bg-danger-soft p-4">
      <p className="font-medium text-danger">{copy.title}</p>
      <p className="mt-1 text-sm text-fg">{copy.body}</p>
      {connectUrl && linkFailed ? (
        <p className="mt-2 break-all text-sm text-fg-muted">Buka alamat ini di browser: {connectUrl}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {connectUrl ? (
          <button
            type="button"
            className={buttonClass}
            onClick={() => {
              bridge.openLink(connectUrl).catch(() => setLinkFailed(true));
            }}
          >
            Buka halaman Connect
          </button>
        ) : null}
        {copy.retryable && onRetry ? (
          <button type="button" className={buttonClass} onClick={onRetry}>
            Coba lagi
          </button>
        ) : null}
      </div>
    </div>
  );
}
