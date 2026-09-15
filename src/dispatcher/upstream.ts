import { AppError, ErrorCodes, toAppError } from "../errors/codes";
import { assertAllowedUrl, isQasirLoginUrl } from "./allowlist";

/** Everything one upstream exchange needs; shared by every redirect hop. */
export interface UpstreamContext {
  fetchImpl: typeof fetch;
  /** Fires at the single per-request deadline. */
  deadline: AbortSignal;
  /** deadline combined with the caller's signal; passed to every fetch. */
  signal: AbortSignal;
  timeoutMs: number;
  merchantSlug: string;
  maxRedirects: number;
}

export type UpstreamOutcome =
  | { kind: "response"; response: Response; url: URL }
  /** 3xx to a Qasir sign-in page: the stored session no longer works. */
  | { kind: "login-redirect"; location: URL };

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * One deadline for the whole request: combine a timeout with the caller's
 * signal (e.g. the Code Mode execution deadline).
 */
export function createRequestSignals(
  timeoutMs: number,
  callerSignal: AbortSignal | undefined,
): { deadline: AbortSignal; signal: AbortSignal } {
  const deadline = AbortSignal.timeout(timeoutMs);
  const signal = callerSignal ? AbortSignal.any([deadline, callerSignal]) : deadline;
  return { deadline, signal };
}

/**
 * Fetch `url`, following redirects only when they stay on the same host with a
 * GET (so Authorization / cookie / CSRF are never replayed elsewhere and
 * 307/308 bodies are never silently dropped). Sign-in redirects are reported
 * instead of followed, so an expired session never looks like a valid page.
 */
export async function fetchUpstream(
  url: URL,
  init: RequestInit,
  ctx: UpstreamContext,
): Promise<UpstreamOutcome> {
  let current = url;
  for (let hop = 0; ; hop++) {
    const response = await guardedFetch(current, init, ctx);
    if (!REDIRECT_STATUSES.has(response.status)) {
      return { kind: "response", response, url: current };
    }
    discardBody(response);
    const location = response.headers.get("location");
    let next: URL;
    try {
      if (!location) throw new Error("missing Location");
      next = new URL(location, current);
    } catch {
      throw new AppError(ErrorCodes.REDIRECT_NOT_ALLOWED, "Upstream redirect has no usable Location");
    }
    if (isQasirLoginUrl(next)) return { kind: "login-redirect", location: next };
    if ((init.method ?? "GET") !== "GET") {
      throw new AppError(
        ErrorCodes.REDIRECT_NOT_ALLOWED,
        `Upstream answered ${init.method} with ${response.status}; not following. ` +
          "The write may or may not have been applied: verify before retrying",
      );
    }
    if (next.host !== current.host) {
      throw new AppError(
        ErrorCodes.REDIRECT_NOT_ALLOWED,
        `Cross-host redirect to ${next.hostname} refused (credentials stay on ${current.hostname})`,
      );
    }
    try {
      assertAllowedUrl(next, ctx.merchantSlug);
    } catch {
      throw new AppError(ErrorCodes.REDIRECT_NOT_ALLOWED, "Redirect target not allowlisted");
    }
    if (hop >= ctx.maxRedirects) {
      throw new AppError(ErrorCodes.REDIRECT_NOT_ALLOWED, "Too many redirects");
    }
    current = next;
  }
}

async function guardedFetch(url: URL, init: RequestInit, ctx: UpstreamContext): Promise<Response> {
  if (ctx.signal.aborted) throw abortError(ctx);
  // Call through a local: workerd's fetch throws "Illegal invocation" when
  // invoked with any `this` other than globalThis/undefined.
  const fetchImpl = ctx.fetchImpl;
  try {
    return await fetchImpl(url.toString(), { ...init, signal: ctx.signal });
  } catch (err) {
    if (ctx.signal.aborted) throw abortError(ctx);
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new AppError(ErrorCodes.UPSTREAM_TIMEOUT, "Upstream timed out");
    }
    throw toAppError(err) ??
      new AppError(ErrorCodes.UPSTREAM_ERROR, "Upstream fetch failed", { cause: err });
  }
}

/** Map an aborted request to a typed error (deadline wins over caller abort). */
export function abortError(ctx: Pick<UpstreamContext, "deadline" | "signal" | "timeoutMs">): AppError {
  if (ctx.deadline.aborted) {
    return new AppError(ErrorCodes.UPSTREAM_TIMEOUT, `Upstream timed out after ${ctx.timeoutMs}ms`);
  }
  const reason: unknown = ctx.signal.reason;
  const typed = toAppError(reason);
  if (typed) return typed;
  if (reason instanceof Error && reason.name === "TimeoutError") {
    return new AppError(ErrorCodes.UPSTREAM_TIMEOUT, "Upstream timed out");
  }
  return new AppError(ErrorCodes.UPSTREAM_ERROR, "Upstream request aborted");
}

/** Release an unread body without waiting on it. */
export function discardBody(response: Response): void {
  const body = response.body;
  if (!body || body.locked) return;
  body.cancel().catch(() => undefined);
}

/**
 * Read at most `maxBytes` of the body as UTF-8. Rejects on a larger declared
 * Content-Length before reading, counts bytes while streaming and cancels the
 * stream as soon as the cap or the deadline is hit, so an oversized or stalled
 * body is never fully buffered.
 */
export async function readBodyCapped(
  response: Response,
  maxBytes: number,
  ctx: Pick<UpstreamContext, "deadline" | "signal" | "timeoutMs">,
): Promise<string> {
  const declared = response.headers.get("content-length");
  if (declared !== null && /^\d+$/.test(declared.trim()) && Number(declared) > maxBytes) {
    discardBody(response);
    throw tooLarge(maxBytes);
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let rejectAborted: (err: AppError) => void = () => undefined;
  const aborted = new Promise<never>((_, reject) => {
    rejectAborted = reject;
  });
  aborted.catch(() => undefined);
  const onAbort = (): void => rejectAborted(abortError(ctx));
  if (ctx.signal.aborted) onAbort();
  else ctx.signal.addEventListener("abort", onAbort, { once: true });
  try {
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), aborted]);
      if (done) break;
      const chunk = toBytes(value);
      total += chunk.byteLength;
      if (total > maxBytes) throw tooLarge(maxBytes);
      chunks.push(chunk);
    }
  } catch (err) {
    reader.cancel().catch(() => undefined);
    if (err instanceof AppError) throw err;
    if (ctx.signal.aborted) throw abortError(ctx);
    throw new AppError(ErrorCodes.UPSTREAM_ERROR, "Upstream body read failed", { cause: err });
  } finally {
    ctx.signal.removeEventListener("abort", onAbort);
  }
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buf.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(buf);
}

function toBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (typeof value === "string") return new TextEncoder().encode(value);
  throw new AppError(ErrorCodes.UPSTREAM_ERROR, "Unexpected upstream body chunk");
}

function tooLarge(maxBytes: number): AppError {
  return new AppError(
    ErrorCodes.RESULT_LIMIT_EXCEEDED,
    `Upstream body exceeds ${maxBytes} bytes`,
  );
}
