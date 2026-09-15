import { AppError, ErrorCodes } from "../errors/codes";

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/**
 * Decode the entities Blade/`htmlspecialchars` emit, in a single pass so
 * `&amp;lt;` becomes the literal text `&lt;` rather than `<`.
 */
export function decodeEntities(s: string): string {
  return s.replace(/&(#\d{1,7}|#x[0-9a-f]{1,6}|[a-z]{2,8});/gi, (whole, ref: string) => {
    if (ref[0] === "#") {
      const hex = ref[1] === "x" || ref[1] === "X";
      const cp = Number.parseInt(ref.slice(hex ? 2 : 1), hex ? 16 : 10);
      const valid = cp > 0 && cp <= 0x10ffff && (cp < 0xd800 || cp > 0xdfff);
      return valid ? String.fromCodePoint(cp) : whole;
    }
    return NAMED_ENTITIES[ref.toLowerCase()] ?? whole;
  });
}

/** Cell text: drop tags first, then decode, then collapse whitespace. */
export function cellText(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

export interface HtmlTable {
  headers: string[];
  /** Raw `<tr>` markup of body rows (rows without `<th>`). */
  rows: string[];
}

/** All `<table>` blocks with header texts and body row markup. */
export function extractTables(html: string): HtmlTable[] {
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
  return tables.map((table) => {
    const trs = table.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
    const headerRow = trs.find((tr) => /<th[\s>]/i.test(tr));
    return {
      headers: headerRow ? rowCells(headerRow) : [],
      rows: trs.filter((tr) => !/<th[\s>]/i.test(tr)),
    };
  });
}

export function rowCells(tr: string): string[] {
  return [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => cellText(m[1] ?? ""));
}

/** Index of the first header matching `pattern` (and not `exclude`), else `fallback`. */
export function columnIndex(
  headers: string[],
  pattern: RegExp,
  fallback: number,
  exclude?: RegExp,
): number {
  const i = headers.findIndex((h) => pattern.test(h) && !(exclude?.test(h) ?? false));
  return i >= 0 ? i : fallback;
}

/**
 * Markers of a Qasir sign-in page (www `window.__AUTH`, PIN/password inputs,
 * login form actions or titles). Used to turn an expired session into
 * QASIR_AUTH_EXPIRED instead of an "empty" result.
 */
export function looksLikeLoginPage(html: string): boolean {
  return (
    /window\.__AUTH\b/.test(html) ||
    /<input[^>]*\btype\s*=\s*["']?password\b/i.test(html) ||
    /<input[^>]*\bname\s*=\s*["']?(pin|password)["'\s/>]/i.test(html) ||
    /<form[^>]*\baction\s*=\s*["'][^"']*(login|sign-?in)[^"']*["']/i.test(html) ||
    /<title>\s*(sign[\s-]?in|log[\s-]?in|masuk)\b[^<]*<\/title>/i.test(html)
  );
}

/**
 * Guard for SSR adapters: only parse pages that carry the expected marker.
 * A login page becomes QASIR_AUTH_EXPIRED; anything else UPSTREAM_ERROR.
 */
export function assertExpectedPage(html: string, markers: RegExp[], pageName: string): void {
  if (markers.some((m) => m.test(html))) return;
  if (looksLikeLoginPage(html)) {
    throw new AppError(
      ErrorCodes.QASIR_AUTH_EXPIRED,
      `Qasir returned a sign-in page instead of ${pageName}; reconnect at /connect`,
    );
  }
  throw new AppError(
    ErrorCodes.UPSTREAM_ERROR,
    `Unexpected HTML: ${pageName} page marker not found`,
  );
}

export interface PaginationInfo {
  /** Current page from the active pagination item, else the requested page. */
  page: number | null;
  hasNext: boolean;
}

/** Laravel/bootstrap pagination: `<ul class="pagination">` with an active item. */
export function readPagination(html: string, requestedPage?: number): PaginationInfo {
  const block = html.match(/<ul[^>]*class\s*=\s*["'][^"']*\bpagination\b[^"']*["'][^>]*>[\s\S]*?<\/ul>/i)?.[0];
  const fallback = requestedPage ?? null;
  if (!block) return { page: fallback, hasNext: false };
  let page: number | null = null;
  const items = block.match(/<li[\s\S]*?<\/li>/gi) ?? [];
  for (const li of items) {
    const open = li.match(/^<li[^>]*>/i)?.[0] ?? "";
    const active = /\bactive\b/i.test(open) || /aria-current\s*=\s*["']page["']/i.test(li);
    const text = cellText(li);
    if (active && /^\d{1,6}$/.test(text)) {
      page = Number(text);
      break;
    }
  }
  const current = page ?? fallback;
  const hasNext =
    /rel\s*=\s*["']next["']/i.test(block) ||
    (current !== null && new RegExp(`[?&]page=${current + 1}(?!\\d)`).test(block));
  return { page: current, hasNext };
}
