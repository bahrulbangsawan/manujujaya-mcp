import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError, ErrorCodes } from "../../src/errors/codes";
import { DEFAULT_WIDGET_LIMITS, RequestBudget, type RequestBudgetLimits } from "../../src/widgets/budget";
import { abortableDelay } from "../stubs/codemode-harness";

function budget(overrides: Partial<RequestBudgetLimits> = {}): RequestBudget {
  return new RequestBudget({ ...DEFAULT_WIDGET_LIMITS, maxRequests: 10, ...overrides });
}

async function rejection(p: Promise<unknown>): Promise<AppError> {
  const err = await p.then(
    () => {
      throw new Error("expected rejection");
    },
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(AppError);
  return err as AppError;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("RequestBudget", () => {
  it("defaults to 4 concurrent requests, 30 s and 8,000,000 response chars", () => {
    expect(DEFAULT_WIDGET_LIMITS).toEqual({ maxConcurrency: 4, timeoutMs: 30_000, maxResponseChars: 8_000_000 });
  });

  it("passes its signal to fn and returns fn's value", async () => {
    const b = budget();
    let seen: AbortSignal | undefined;
    const value = await b.run(async (signal) => {
      seen = signal;
      return { ok: true };
    });
    expect(value).toEqual({ ok: true });
    expect(seen).toBe(b.signal);
  });

  it("refuses the request past maxRequests without running it, and stays stopped", async () => {
    const b = budget({ maxRequests: 3 });
    const fn = vi.fn(async () => ({ ok: true }));
    for (let i = 0; i < 3; i++) await b.run(fn);
    const err = await rejection(b.run(fn));
    expect(err.code).toBe(ErrorCodes.RESULT_LIMIT_EXCEEDED);
    expect(err.message).toBe("Request limit reached: at most 3 upstream requests per widget tool call");
    expect(fn).toHaveBeenCalledTimes(3);
    expect(b.signal.aborted).toBe(true);
    expect(await rejection(b.run(fn))).toBe(err);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("keeps at most maxConcurrency requests in flight and queues the rest", async () => {
    const b = budget({ maxRequests: 20 });
    let inFlight = 0;
    let peak = 0;
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        b.run(async (signal) => {
          inFlight++;
          peak = Math.max(peak, inFlight);
          try {
            await abortableDelay(5, signal);
            return i;
          } finally {
            inFlight--;
          }
        }),
      ),
    );
    expect(results).toEqual(Array.from({ length: 20 }, (_, i) => i));
    expect(peak).toBeLessThanOrEqual(4);
    expect(peak).toBe(4);
  });

  it("charges the JSON length of each result against the response budget", async () => {
    const b = budget({ maxResponseChars: 10_000 });
    const blob = { blob: "x".repeat(4_000) };
    await b.run(async () => blob);
    await b.run(async () => blob);
    const err = await rejection(b.run(async () => blob));
    expect(err.code).toBe(ErrorCodes.RESULT_LIMIT_EXCEEDED);
    expect(err.message).toBe("Response budget exceeded: at most 10000 characters per widget tool call");
    expect(b.signal.aborted).toBe(true);
  });

  it("aborts in-flight work with UPSTREAM_TIMEOUT when the deadline passes", async () => {
    vi.useFakeTimers();
    const b = budget();
    b.startDeadline();
    const pending = rejection(b.run((signal) => abortableDelay(60_000, signal)));
    await vi.advanceTimersByTimeAsync(30_000);
    const err = await pending;
    expect(err.code).toBe(ErrorCodes.UPSTREAM_TIMEOUT);
    expect(err.message).toBe("Widget tool timed out after 30 s");
    expect(b.signal.reason).toBe(err);
  });

  it("does not abort once the deadline is stopped", async () => {
    vi.useFakeTimers();
    const b = budget();
    const stop = b.startDeadline();
    stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(b.signal.aborted).toBe(false);
  });

  it("rejects queued requests with the abort reason and never runs them", async () => {
    const b = budget({ maxConcurrency: 1 });
    const first = rejection(b.run((signal) => abortableDelay(10_000, signal)));
    const second = vi.fn(async () => "second");
    const queued = rejection(b.run(second));
    const reason = new AppError(ErrorCodes.INVALID_INPUT, "Widget tool call has already finished");
    b.abort(reason);
    b.abort(new AppError(ErrorCodes.UPSTREAM_TIMEOUT, "ignored: the first reason wins"));
    expect(await first).toBe(reason);
    expect(await queued).toBe(reason);
    expect(second).not.toHaveBeenCalled();
  });
});
