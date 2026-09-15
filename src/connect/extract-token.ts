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
  /<meta\s+name=["']api[_-]?token["']\s+content=["']([a-zA-Z0-9]{32})["']/i,
  /authorization["']?\s*[:=]\s*["']Bearer\s+([a-zA-Z0-9]{32})["']/i,
];

export function extractApiTokenFromHtml(html: string): string | null {
  for (const re of PATTERNS) {
    const m = html.match(re);
    if (m?.[1] && isApiTokenShape(m[1])) return m[1];
  }
  return null;
}

export function extractCsrfFromHtml(html: string): string | null {
  const meta = html.match(
    /<meta\s+name=["']csrf-token["']\s+content=["']([^"']+)["']/i,
  );
  if (meta?.[1]) return meta[1];
  const meta2 = html.match(
    /content=["']([^"']+)["']\s+name=["']csrf-token["']/i,
  );
  return meta2?.[1] ?? null;
}

export function isApiTokenShape(token: string): boolean {
  return /^[a-zA-Z0-9]{32}$/.test(token);
}
