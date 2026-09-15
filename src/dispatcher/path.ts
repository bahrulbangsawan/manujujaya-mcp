import { AppError, ErrorCodes } from "../errors/codes";

const PATH_PARAM = /\{([a-zA-Z0-9_]+)\}/g;

/**
 * Substitute path params. Rejects absolute URLs, protocol-relative, and traversal
 * in any substituted value.
 */
export function buildPath(
  template: string,
  pathParams: Record<string, string | number>,
): string {
  const used = new Set<string>();
  const path = template.replace(PATH_PARAM, (_m, name: string) => {
    used.add(name);
    const raw = pathParams[name];
    if (raw === undefined || raw === null || raw === "") {
      throw new AppError(
        ErrorCodes.INVALID_INPUT,
        `Missing path param: ${name}`,
      );
    }
    const value = String(raw);
    assertSafePathSegment(value, name);
    return encodeURIComponent(value);
  });
  if (!path.startsWith("/")) {
    throw new AppError(ErrorCodes.INVALID_INPUT, "Path must start with /");
  }
  return path;
}

function assertSafePathSegment(value: string, name: string): void {
  if (
    value.includes("://") ||
    value.startsWith("//") ||
    value.includes("..") ||
    value.includes("/") ||
    value.includes("\\") ||
    value.includes("?") ||
    value.includes("#")
  ) {
    throw new AppError(
      ErrorCodes.INVALID_INPUT,
      `Unsafe path param ${name}`,
    );
  }
}

export function applyQuery(
  url: URL,
  query: Record<string, string | number | boolean | undefined> | undefined,
): void {
  if (!query) return;
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined) continue;
    url.searchParams.set(k, String(v));
  }
}
