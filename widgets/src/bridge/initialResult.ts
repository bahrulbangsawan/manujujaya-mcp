import type { QueryClient } from "@tanstack/react-query";
import type { ToolInput, ToolName } from "../../../src/widgets/contract";
import { parseToolResult, type Bridge, type ToolResultLike } from "./bridge";
import { toolQueryKey } from "./useToolQuery";

function isToolResultLike(value: unknown): value is ToolResultLike {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Seeds queryClient with the host-delivered tool result: setQueryData(toolQueryKey(name, args), parsed).
 * Returns false (and seeds nothing) for error results, contract mismatches and non-objects.
 */
export function seedInitialResult(queryClient: QueryClient, name: ToolName, args: Record<string, unknown>, result: unknown): boolean {
  if (!isToolResultLike(result)) return false;
  try {
    const data = parseToolResult(name, result);
    queryClient.setQueryData(toolQueryKey(name, args as ToolInput<typeof name>), data);
    return true;
  } catch {
    return false;
  }
}

/** The view tool call that opened the widget, as announced by the host (toolinput → toolresult). */
export interface InitialToolCall {
  setInput(args: Record<string, unknown>): void;
  setResult(result: unknown): void;
  cancel(): void;
  /** The result if it has already arrived. */
  peekResult(): unknown;
  /** Resolves with the first arguments, or null after `timeoutMs`. */
  waitForInput(timeoutMs: number): Promise<Record<string, unknown> | null>;
  /** Resolves with the result, or null when cancelled, after `timeoutMs`, or when `signal` aborts. */
  waitForResult(timeoutMs: number, signal?: AbortSignal): Promise<unknown>;
}

export function createInitialToolCall(): InitialToolCall {
  let input: Record<string, unknown> | undefined;
  let result: unknown;
  let settled = false; // result arrived or call cancelled
  const inputWaiters = new Set<(args: Record<string, unknown>) => void>();
  const resultWaiters = new Set<(value: unknown) => void>();

  const settle = (value: unknown) => {
    if (settled) return;
    settled = true;
    result = value;
    for (const waiter of resultWaiters) waiter(value);
    resultWaiters.clear();
  };

  return {
    setInput(args) {
      if (input !== undefined) return;
      input = args;
      for (const waiter of inputWaiters) waiter(args);
      inputWaiters.clear();
    },
    setResult(value) {
      settle(value ?? null);
    },
    cancel() {
      settle(null);
    },
    peekResult() {
      return settled ? result : undefined;
    },
    waitForInput(timeoutMs) {
      if (input !== undefined) return Promise.resolve(input);
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          inputWaiters.delete(done);
          resolve(null);
        }, timeoutMs);
        const done = (args: Record<string, unknown>) => {
          clearTimeout(timer);
          resolve(args);
        };
        inputWaiters.add(done);
      });
    },
    waitForResult(timeoutMs, signal) {
      if (settled) return Promise.resolve(result);
      return new Promise((resolve) => {
        const finish = (value: unknown) => {
          clearTimeout(timer);
          resultWaiters.delete(finish);
          signal?.removeEventListener("abort", onAbort);
          resolve(value);
        };
        const onAbort = () => finish(null);
        const timer = setTimeout(() => finish(null), timeoutMs);
        resultWaiters.add(finish);
        signal?.addEventListener("abort", onAbort, { once: true });
      });
    },
  };
}

export const INITIAL_RESULT_WAIT_MS = 90_000;

/**
 * Makes the first query for the opening view tool use the host's result instead of calling the tool again.
 * Already delivered ⇒ seeded synchronously. Otherwise a fetch that awaits the host result (an error result
 * becomes the query error); if the host cancels or never delivers, it calls the tool through the bridge.
 */
export function primeInitialQuery<N extends ToolName>(
  queryClient: QueryClient,
  bridge: Bridge,
  name: N,
  args: ToolInput<N>,
  call: InitialToolCall,
  waitMs: number = INITIAL_RESULT_WAIT_MS,
): void {
  const delivered = call.peekResult();
  if (delivered != null && seedInitialResult(queryClient, name, args as Record<string, unknown>, delivered)) return;
  void queryClient.prefetchQuery({
    queryKey: toolQueryKey(name, args),
    queryFn: async ({ signal }) => {
      const hostResult = delivered != null ? delivered : await call.waitForResult(waitMs, signal);
      if (signal.aborted) throw signal.reason;
      if (isToolResultLike(hostResult)) return parseToolResult(name, hostResult);
      return bridge.callTool(name, args, signal);
    },
  });
}
