import type { HostKey } from "./types";

/** The upstream Qasir API docs (docs/<name>.md) bundled as qasir://docs/<name> resources. */
export const API_DOC_NAMES = [
  "auth-login",
  "customers",
  "inventories-stock-histories",
  "order-histories-installment",
  "order-histories-legacy",
  "order-histories-web",
  "products",
  "purchases",
  "reports",
  "routes",
  "stock-adjustment",
  "suppliers",
  "users",
] as const;

/**
 * Extracts every upstream METHOD + host + path documented in the API markdown,
 * so coverage can be checked against the docs instead of against the registry
 * itself. Pure (no fs): callers pass `{ "products.md": markdown, ... }`.
 *
 * Recognised shapes, all taken from docs/*.md:
 *  A. `GET https://pos.qasir.id/api/...`, `GET pos.qasir.id/...`, `GET {origin}/ajax/...`,
 *     `GET /api/v5/...` (relative /api → pos, /ajax → merchant), inline or fenced.
 *  B. Table rows `| \`POST\` | \`{origin}/ajax/category/create\` / \`update\` / \`delete\` |`
 *     (each ` / \`seg\`` replaces the last path segment).
 *  C. Table rows whose first cell is a bare `/api/...` path (reports.md: "All GET, host pos").
 *  D. A code span or fenced line that is only a qasir URL (no method) → GET, unless the same
 *     host+path is documented with an explicit method somewhere. Base URLs are skipped.
 *  E. Table rows marked **SSR HTML** → GET merchant page (routes.md sidebar).
 *  F. Prose `\`/path\` (Laravel POST ...)` → that method on the merchant host.
 */
export interface DocEndpoint {
  sourceDocument: string;
  method: string;
  host: HostKey;
  path: string;
  evidence: string;
}

const METHOD = "GET|POST|PUT|PATCH|DELETE";
const URL_BODY = "[^\\s`'\"|)<>]*";
const HOSTED = `(?:https?://)?(?:[a-z0-9-]+|\\{slug\\}|<slug>)\\.qasir\\.id(?:/${URL_BODY})?`;
const URLISH = `(?:${HOSTED}|\\{origin\\}/${URL_BODY}|/(?:api|ajax)/${URL_BODY})`;
const FIXED: ReadonlySet<string> = new Set(["pos", "order", "payment", "account", "sms", "www"]);
/** JS-global base URLs and origins (routes.md "Dashboard JS globals"), not endpoints. */
const BASE_PATH = /^\/(?:(?:api(?:\/v\d+)?|ajax)\/?)?$/;

interface Parsed {
  host: HostKey;
  path: string;
}

/** Map a URL-ish string to host + path (query stripped). Null when not a Qasir API host. */
export function parseDocUrl(raw: string): Parsed | null {
  let s = raw.trim().replace(/[.,;:]+$/, "");
  s = s.replace(/^https?:\/\//, "");
  let host: HostKey | null = null;
  let rest: string;
  if (s.startsWith("/")) {
    rest = s;
    host = s.startsWith("/api/") ? "pos" : s.startsWith("/ajax/") ? "merchant" : null;
  } else {
    const slash = s.indexOf("/");
    const hostname = slash === -1 ? s : s.slice(0, slash);
    rest = slash === -1 ? "/" : s.slice(slash);
    if (hostname === "{origin}") host = "merchant";
    const m = /^([a-z0-9-]+|\{slug\}|<slug>)\.qasir\.id$/.exec(hostname);
    const sub = m?.[1];
    if (sub && FIXED.has(sub)) host = sub as HostKey;
    else if (sub === "{slug}" || sub === "<slug>" || (sub && /-\d+$/.test(sub))) {
      host = "merchant";
    }
  }
  if (!host) return null;
  let path = rest.split(/[?#]/, 1)[0] ?? "/";
  if (path.length > 1) path = path.replace(/\/+$/, "");
  if (path.includes("…") || !path.startsWith("/")) return null;
  return { host, path };
}

function codeSpans(text: string): string[] {
  return [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1] ?? "");
}

function tableCells(line: string): string[] | null {
  const t = line.trim();
  if (!t.startsWith("|")) return null;
  return t.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
}

export function extractDocEndpoints(docs: Record<string, string>): DocEndpoint[] {
  const explicit: DocEndpoint[] = [];
  const bare: DocEndpoint[] = [];
  const add = (list: DocEndpoint[], doc: string, method: string, raw: string, line: string) => {
    const p = parseDocUrl(raw);
    if (!p || BASE_PATH.test(p.path)) return;
    list.push({ sourceDocument: doc, method, host: p.host, path: p.path, evidence: line.trim() });
  };

  for (const [doc, md] of Object.entries(docs)) {
    let fenced = false;
    for (const line of md.split("\n")) {
      if (line.trim().startsWith("```")) {
        fenced = !fenced;
        continue;
      }
      // A: explicit METHOD + URL anywhere on the line.
      for (const m of line.matchAll(new RegExp(`\\b(${METHOD}) +(${URLISH})`, "g"))) {
        add(explicit, doc, m[1] ?? "", m[2] ?? "", line);
      }
      const cells = tableCells(line);
      if (cells) {
        // B: method cell followed by a URL cell with optional `/ \`seg\`` expansions.
        cells.forEach((cell, i) => {
          const method = new RegExp(`^\`(${METHOD})\`$`).exec(cell)?.[1];
          const next = cells[i + 1];
          if (!method || !next) return;
          const spans = codeSpans(next);
          const first = spans[0];
          if (!first || !new RegExp(`^${URLISH}$`).test(first)) return;
          add(explicit, doc, method, first, line);
          for (const seg of spans.slice(1)) {
            if (/^[a-z0-9_-]+$/i.test(seg)) {
              add(explicit, doc, method, first.replace(/[^/]+$/, seg), line);
            }
          }
        });
        // C: bare /api path as the first cell (reports.md path tables are all GET on pos).
        const firstSpan = /^`(\/api\/[^`]+)`$/.exec(cells[0] ?? "")?.[1];
        if (firstSpan) add(explicit, doc, "GET", firstSpan, line);
        // E: SSR HTML data page rows.
        if (line.includes("**SSR HTML**")) {
          const page = cells.flatMap(codeSpans).find((s) => /^\/[a-z]/.test(s));
          if (page) add(explicit, doc, "GET", `{origin}${page}`, line);
        }
      }
      // F: `/path` (Laravel POST ...) prose.
      for (const m of line.matchAll(new RegExp(`\`(/[^\`]+)\` \\((?:Laravel )?(${METHOD})\\b`, "g"))) {
        add(explicit, doc, m[2] ?? "", `{origin}${m[1] ?? ""}`, line);
      }
      // D: URL-only code spans / fenced lines.
      const candidates = fenced ? [line.trim()] : codeSpans(line);
      for (const c of candidates) {
        if (/^(?:https?:\/\/|\{slug\}\.|<slug>\.)\S*qasir\.id\S*$/.test(c)) add(bare, doc, "GET", c, line);
      }
    }
  }

  const explicitPaths = new Set(explicit.map((e) => `${e.host} ${e.path}`));
  return [
    ...explicit,
    ...bare.filter((e) => !explicitPaths.has(`${e.host} ${e.path}`)),
  ];
}
