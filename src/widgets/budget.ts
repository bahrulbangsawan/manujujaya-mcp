import { AppError, ErrorCodes } from "../errors/codes";

/** Limits for one widget tool call. */
export interface RequestBudgetLimits {
  /** Upstream requests allowed per call (counted on entry). */
  maxRequests: number;
  /** Upstream requests in flight at once; extra requests wait for a slot. */
  maxConcurrency: number;
  /** Wall-clock deadline for the whole call, started with startDeadline(). */
  timeoutMs: number;
  /** Cumulative JSON.stringify length of request results. */
  maxResponseChars: number;
}

export const DEFAULT_WIDGET_LIMITS: Omit<RequestBudgetLimits, "maxRequests"> = {
  maxConcurrency: 4,
  timeoutMs: 30_000,
  maxResponseChars: 8_000_000,
};

/**
 * Host-side accounting for one widget tool call: request count, concurrency,
 * cumulative response size and deadline. Exceeding a limit is terminal: the
 * budget aborts with that error, so every later or queued request fails too.
 */
export class RequestBudget {
  readonly #limits: RequestBudgetLimits;
  readonly #controller = new AbortController();
  readonly #waiters: Array<() => void> = [];
  #requests = 0;
  #inFlight = 0;
  #responseChars = 0;

  constructor(limits: RequestBudgetLimits) {
    this.#limits = limits;
  }

  /** Aborted when a limit is exceeded, the deadline passes or the call finishes. */
  get signal(): AbortSignal {
    return this.#controller.signal;
  }

  /** Stop the call; the first reason wins. */
  abort(reason: AppError): void {
    if (!this.#controller.signal.aborted) this.#controller.abort(reason);
  }

  /** Start the deadline timer. Returns stop(), which clears it. */
  startDeadline(): () => void {
    const seconds = Math.ceil(this.#limits.timeoutMs / 1000);
    const timer = setTimeout(() => {
      this.abort(new AppError(ErrorCodes.UPSTREAM_TIMEOUT, `Widget tool timed out after ${seconds} s`));
    }, this.#limits.timeoutMs);
    return () => clearTimeout(timer);
  }

  /** Count one request, wait for a slot, run fn(signal), charge its result, release the slot. */
  async run<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
    this.#assertActive();
    if (this.#requests >= this.#limits.maxRequests) {
      throw this.#fail(
        `Request limit reached: at most ${this.#limits.maxRequests} upstream requests per widget tool call`,
      );
    }
    this.#requests++;
    const release = await this.#acquireSlot();
    try {
      const value = await fn(this.signal);
      this.#assertActive();
      this.#charge(value);
      return value;
    } finally {
      release();
    }
  }

  #assertActive(): void {
    if (!this.signal.aborted) return;
    const reason: unknown = this.signal.reason;
    throw reason instanceof AppError ? reason : new AppError(ErrorCodes.UPSTREAM_TIMEOUT, "Widget tool call stopped");
  }

  #fail(message: string): AppError {
    const err = new AppError(ErrorCodes.RESULT_LIMIT_EXCEEDED, message);
    this.abort(err);
    return err;
  }

  async #acquireSlot(): Promise<() => void> {
    while (this.#inFlight >= this.#limits.maxConcurrency) {
      this.#assertActive();
      await new Promise<void>((resolve, reject) => {
        const onAbort = () => reject(this.signal.reason);
        this.signal.addEventListener("abort", onAbort, { once: true });
        this.#waiters.push(() => {
          this.signal.removeEventListener("abort", onAbort);
          resolve();
        });
      });
    }
    this.#assertActive();
    this.#inFlight++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.#inFlight--;
      this.#waiters.shift()?.();
    };
  }

  #charge(value: unknown): void {
    let size = 0;
    try {
      size = JSON.stringify(value)?.length ?? 0;
    } catch {
      throw new AppError(ErrorCodes.UPSTREAM_ERROR, "Upstream result is not serializable");
    }
    this.#responseChars += size;
    if (this.#responseChars > this.#limits.maxResponseChars) {
      throw this.#fail(
        `Response budget exceeded: at most ${this.#limits.maxResponseChars} characters per widget tool call`,
      );
    }
  }
}
