function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const LAYOUT = (title: string, body: string) => `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${esc(title)} · Connect Qasir</title>
  <style>
    :root { font-family: system-ui, sans-serif; color: #0f172a; background: #f8fafc; }
    body { max-width: 32rem; margin: 2rem auto; padding: 0 1rem; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem; }
    h1 { font-size: 1.25rem; margin: 0 0 .5rem; }
    .warn { background: #fff7ed; border: 1px solid #fed7aa; padding: .75rem; border-radius: 8px; font-size: .875rem; margin: .75rem 0; }
    .ok { background: #ecfdf5; border: 1px solid #a7f3d0; padding: .75rem; border-radius: 8px; font-size: .875rem; margin: .75rem 0; }
    .err { background: #fef2f2; border: 1px solid #fecaca; padding: .75rem; border-radius: 8px; font-size: .875rem; margin: .75rem 0; }
    label { display: block; font-size: .8rem; font-weight: 600; margin: .75rem 0 .25rem; }
    input, textarea { width: 100%; box-sizing: border-box; padding: .5rem .6rem; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; }
    textarea { min-height: 4.5rem; font-family: ui-monospace, monospace; font-size: .8rem; }
    button { margin-top: 1rem; background: #0f766e; color: #fff; border: 0; border-radius: 8px; padding: .6rem 1rem; font: inherit; cursor: pointer; }
    button.secondary { background: #64748b; }
    .muted { color: #64748b; font-size: .8rem; }
    a { color: #0f766e; }
  </style>
</head>
<body>
${body}
</body>
</html>`;

export function connectLoginPage(opts: {
  csrfToken: string;
  statusHtml?: string;
}): string {
  const status = opts.statusHtml ?? "";
  return LAYOUT(
    "Connect Qasir",
    `<div class="card">
  <h1>Connect Qasir</h1>
  <p class="muted">Captures an unofficial dashboard session (phone/email + PIN) for this MCP worker. This is <strong>not</strong> official OAuth.</p>
  <div class="warn">Qasir has no public API. Credentials stay in Durable Object storage (and optional Worker secrets for bootstrap). PIN is never logged or exposed to MCP tools.</div>
  ${status}
  <form method="POST" action="/connect/login" autocomplete="off">
    <input type="hidden" name="csrf" value="${esc(opts.csrfToken)}"/>
    <label for="username">Phone (62…) or email</label>
    <input id="username" name="username" required placeholder="62812… or you@example.com"/>
    <label for="pin">PIN (6 digits)</label>
    <input id="pin" name="pin" type="password" inputmode="numeric" pattern="\\d{6}" maxlength="6" required autocomplete="one-time-code"/>
    <button type="submit">Sign in &amp; connect</button>
  </form>
  <p class="muted" style="margin-top:1rem"><a href="/connect/status">Status</a> · <a href="/connect#paste">Paste fallback</a></p>
</div>
<div class="card" style="margin-top:1rem" id="paste">
  <h1>Paste fallback</h1>
  <p class="muted">If API_TOKEN cannot be scraped after login (mint hop undocumented), paste values from DevTools on the merchant dashboard.</p>
  <form method="POST" action="/connect/paste" autocomplete="off">
    <input type="hidden" name="csrf" value="${esc(opts.csrfToken)}"/>
    <label for="apiToken">API_TOKEN (32 chars)</label>
    <input id="apiToken" name="apiToken" required minlength="32" maxlength="32" pattern="[A-Za-z0-9]{32}"/>
    <label for="csrfToken">CSRF token</label>
    <input id="csrfToken" name="csrfToken" required/>
    <label for="cookie">Cookie string</label>
    <textarea id="cookie" name="cookie" required placeholder="qasir_sess=…; XSRF-TOKEN=…"></textarea>
    <label for="outletId">Outlet id (optional)</label>
    <input id="outletId" name="outletId"/>
    <label for="merchantSlug">Merchant slug (optional)</label>
    <input id="merchantSlug" name="merchantSlug" placeholder="your-store-123"/>
    <button type="submit">Save pasted session</button>
  </form>
  <form method="POST" action="/connect/disconnect" style="margin-top:.75rem">
    <input type="hidden" name="csrf" value="${esc(opts.csrfToken)}"/>
    <button type="submit" class="secondary">Disconnect</button>
  </form>
</div>`,
  );
}

export function connectSuccessHtml(opts: {
  csrfToken: string;
  merchantSlug: string;
  tokenPrefix: string;
  via: string;
}): string {
  return connectLoginPage({
    csrfToken: opts.csrfToken,
    statusHtml: `<div class="ok">Connected to <strong>${esc(opts.merchantSlug)}</strong> (${esc(opts.via)}). Token ${esc(opts.tokenPrefix)}</div>`,
  });
}

export function connectErrorHtml(opts: {
  csrfToken: string;
  message: string;
}): string {
  return connectLoginPage({
    csrfToken: opts.csrfToken,
    statusHtml: `<div class="err">${esc(opts.message)}</div>`,
  });
}

export function connectNextStepHtml(opts: {
  csrfToken: string;
  step: string;
  detail: string;
}): string {
  return connectLoginPage({
    csrfToken: opts.csrfToken,
    statusHtml: `<div class="warn"><strong>Next step: ${esc(opts.step)}</strong><pre class="muted" style="white-space:pre-wrap">${esc(opts.detail)}</pre><p class="muted">UI for merchant/outlet/OTP pickers is stubbed — complete in the Qasir dashboard, then use paste fallback.</p></div>`,
  });
}

export function connectPasteNeededHtml(opts: {
  csrfToken: string;
  merchantSlug: string;
  reason: string;
}): string {
  return connectLoginPage({
    csrfToken: opts.csrfToken,
    statusHtml: `<div class="warn">Login reached <strong>${esc(opts.merchantSlug)}</strong> but ${esc(opts.reason)}</div>`,
  });
}

export function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
