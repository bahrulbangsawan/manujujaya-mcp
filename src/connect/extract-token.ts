/**
 * Best-effort scrape of dashboard API_TOKEN from HTML/JS.
 * How API_TOKEN is minted after tokenWeb redirect is not fully documented —
 * these are common patterns only; paste fallback is expected when none match.
 */

const PATTERNS: RegExp[] = [
  /\bAPI_TOKEN\s*=\s*["']([a-zA-Z0-9]{32})["']/,
  /\bwindow\.API_TOKEN\s*=\s*["']([a-zA-Z0-9]{32})["']/,
  /\bAPI_TOKEN\s*:\s*["']([a-zA-Z0-9]{32})["']/,
  /["']API_TOKEN["']\s*:\s*["']([a-zA-Z0-9]{32})["']/,
  /authorization["']?\s*[:=]\s*["']Bearer\s+([a-zA-Z0-9]{32})["']/i,
];

/** Laravel session CSRF tokens are 40 alphanumerics; allow a safe superset. */
const CSRF_RE = /^[A-Za-z0-9+/=._-]{16,256}$/;

/** Attributes of every `<meta …>` tag, in any attribute order and quote style. */
function metaTags(html: string): Array<Map<string, string>> {
  const out: Array<Map<string, string>> = [];
  for (const tag of html.matchAll(/<meta\b([^>]*)>/gi)) {
    const attrs = new Map<string, string>();
    const body = tag[1] ?? "";
    for (const m of body.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`/]+))/g)) {
      const name = (m[1] ?? "").toLowerCase();
      if (!attrs.has(name)) attrs.set(name, m[2] ?? m[3] ?? m[4] ?? "");
    }
    out.push(attrs);
  }
  return out;
}

function metaContent(html: string, names: string[]): string | null {
  for (const attrs of metaTags(html)) {
    const name = attrs.get("name")?.toLowerCase();
    if (name && names.includes(name)) {
      const content = attrs.get("content")?.trim();
      if (content) return content;
    }
  }
  return null;
}

export function extractApiTokenFromHtml(html: string): string | null {
  const meta = metaContent(html, ["api_token", "api-token", "apitoken"]);
  if (meta && isApiTokenShape(meta)) return meta;
  for (const re of PATTERNS) {
    const m = html.match(re);
    if (m?.[1] && isApiTokenShape(m[1])) return m[1];
  }
  return null;
}

/** `<meta name="csrf-token" content="…">` only; attribute-order independent. */
export function extractCsrfFromHtml(html: string): string | null {
  const token = metaContent(html, ["csrf-token"]);
  return token && isCsrfTokenShape(token) ? token : null;
}

export function isCsrfTokenShape(token: string): boolean {
  return CSRF_RE.test(token);
}

export function isApiTokenShape(token: string): boolean {
  return /^[a-zA-Z0-9]{32}$/.test(token);
}
