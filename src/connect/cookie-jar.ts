/** Minimal cookie jar for server-side Qasir login (name=value pairs). */

export function parseSetCookieHeaders(headers: Headers): string[] {
  // Workers: getSetCookie() when available
  const anyHeaders = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === "function") {
    return anyHeaders.getSetCookie();
  }
  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

export function mergeCookies(
  existing: string,
  setCookieHeaders: string[],
): string {
  const map = new Map<string, string>();
  for (const part of existing.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (name) map.set(name, value);
  }
  for (const sc of setCookieHeaders) {
    const first = sc.split(";")[0] ?? "";
    const eq = first.indexOf("=");
    if (eq <= 0) continue;
    const name = first.slice(0, eq).trim();
    const value = first.slice(eq + 1).trim();
    if (name) map.set(name, value);
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

export function cookieHeaderFromJar(jar: string): string {
  return jar;
}

export function getCookieValue(jar: string, name: string): string | null {
  for (const part of jar.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    if (part.slice(0, eq).trim() === name) {
      return part.slice(eq + 1).trim();
    }
  }
  return null;
}
