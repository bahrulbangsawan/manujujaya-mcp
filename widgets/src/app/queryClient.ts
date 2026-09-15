import { QueryClient } from "@tanstack/react-query";
import { ToolCallError } from "../bridge/bridge";

/**
 * Codes that must not be retried automatically. QASIR_AUTH_EXPIRED especially: a second 401 clears the
 * shared Qasir session. CONTRACT_MISMATCH is deterministic.
 */
export const NO_RETRY: ReadonlySet<string> = new Set([
  "QASIR_AUTH_EXPIRED",
  "FORBIDDEN",
  "INVALID_INPUT",
  "QASIR_RATE_LIMITED",
  "CONTRACT_MISMATCH",
]);

/** At most one retry, never for NO_RETRY codes. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ToolCallError && NO_RETRY.has(error.code)) return false;
  return failureCount < 1;
}

/** Query defaults for a widget inside a chat iframe: no focus/reconnect refetches, 60 s fresh data. */
export function createWidgetQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        staleTime: 60_000,
        gcTime: 600_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        networkMode: "always",
      },
    },
  });
}
