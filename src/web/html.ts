/** Shared HTML helpers for browser-facing pages (/authorize, /login, /connect). */

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function layout(title: string, body: string, suffix = "manujujaya-mcp"): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta name="referrer" content="no-referrer"/>
  <title>${esc(title)} · ${esc(suffix)}</title>
  <style>
    :root { font-family: system-ui, sans-serif; color: #0f172a; background: #f8fafc; }
    body { max-width: 32rem; margin: 2rem auto; padding: 0 1rem; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem; }
    h1 { font-size: 1.25rem; margin: 0 0 .5rem; }
    .warn { background: #fff7ed; border: 1px solid #fed7aa; padding: .75rem; border-radius: 8px; font-size: .875rem; margin: .75rem 0; }
    .ok { background: #ecfdf5; border: 1px solid #a7f3d0; padding: .75rem; border-radius: 8px; font-size: .875rem; margin: .75rem 0; }
    .err { background: #fef2f2; border: 1px solid #fecaca; padding: .75rem; border-radius: 8px; font-size: .875rem; margin: .75rem 0; }
    label { display: block; font-size: .8rem; font-weight: 600; margin: .75rem 0 .25rem; }
    label.check { display: flex; gap: .5rem; align-items: flex-start; font-weight: 400; font-size: .875rem; }
    label.check input { width: auto; margin-top: .2rem; }
    input, textarea { width: 100%; box-sizing: border-box; padding: .5rem .6rem; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; }
    textarea { min-height: 4.5rem; font-family: ui-monospace, monospace; font-size: .8rem; }
    button { margin-top: 1rem; background: #0f766e; color: #fff; border: 0; border-radius: 8px; padding: .6rem 1rem; font: inherit; cursor: pointer; }
    button.secondary { background: #64748b; }
    button.choice { display: block; width: 100%; text-align: left; margin-top: .5rem; background: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1; }
    button.choice:disabled { opacity: .5; cursor: not-allowed; }
    .muted { color: #64748b; font-size: .8rem; }
    code { font-family: ui-monospace, monospace; font-size: .8rem; background: #f1f5f9; padding: .05rem .3rem; border-radius: 4px; word-break: break-all; }
    a { color: #0f766e; }
    .badge { font-size: .7rem; background: #ccfbf1; color: #115e59; padding: .1rem .4rem; border-radius: 999px; margin-left: .35rem; }
    .row { display: flex; gap: .5rem; flex-wrap: wrap; }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

/**
 * HTML response with anti-framing, no-store and a strict CSP.
 * `form-action` is intentionally omitted: browsers apply it to the post-submit
 * redirect, which would block the OAuth redirect back to the client.
 */
export function htmlResponse(html: string, status = 200, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("x-frame-options", "DENY");
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "no-referrer");
  headers.set("strict-transport-security", "max-age=31536000");
  headers.set(
    "content-security-policy",
    "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'",
  );
  return new Response(html, { status, headers });
}
