import type { PendingAuthState, PendingMerchant, PendingOutlet } from "../session/types";

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
    button.choice { display: block; width: 100%; text-align: left; margin-top: .5rem; background: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1; }
    button.choice:disabled { opacity: .5; cursor: not-allowed; }
    .muted { color: #64748b; font-size: .8rem; }
    a { color: #0f766e; }
    .badge { font-size: .7rem; background: #ccfbf1; color: #115e59; padding: .1rem .4rem; border-radius: 999px; margin-left: .35rem; }
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
  <div class="warn">Qasir has no public API. Credentials stay in Durable Object storage (AES-GCM when SESSION_ENCRYPTION_KEY is set). PIN is never logged or exposed to MCP tools.</div>
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

export function connectSelectMerchantHtml(opts: {
  csrfToken: string;
  merchants: PendingMerchant[];
  /** When set (MERCHANT_SLUG), picker is disabled — show error only. */
  merchantSlugConfigured?: string;
}): string {
  if (opts.merchantSlugConfigured) {
    return connectErrorHtml({
      csrfToken: opts.csrfToken,
      message:
        `Merchant is fixed to ${opts.merchantSlugConfigured} (Manuju Jaya). ` +
        `Picker is disabled — retry login; Connect auto-selects the configured store.`,
    });
  }
  const choices = opts.merchants
    .map(
      (m) => `<form method="POST" action="/connect/select-merchant">
    <input type="hidden" name="csrf" value="${esc(opts.csrfToken)}"/>
    <input type="hidden" name="merchantId" value="${m.id}"/>
    <button type="submit" class="choice"><strong>${esc(m.business_name)}</strong><span class="muted"> · id ${m.id}</span></button>
  </form>`,
    )
    .join("\n");
  return LAYOUT(
    "Select merchant",
    `<div class="card">
  <h1>Select merchant</h1>
  <p class="muted">Your account has multiple stores. Choose one to continue Connect.</p>
  ${choices || '<div class="err">No merchants returned</div>'}
  <p class="muted" style="margin-top:1rem"><a href="/connect">Cancel</a></p>
</div>`,
  );
}

export function connectSelectOutletHtml(opts: {
  csrfToken: string;
  outlets: PendingOutlet[];
}): string {
  const choices = opts.outlets
    .map((o) => {
      const badge = o.is_main ? '<span class="badge">Utama</span>' : "";
      const loc = o.location_name
        ? `<div class="muted">${esc(o.location_name)}</div>`
        : "";
      const disabled = o.is_lock ? " disabled" : "";
      const lockNote = o.is_lock
        ? '<div class="muted">Locked — no access</div>'
        : "";
      return `<form method="POST" action="/connect/select-outlet">
    <input type="hidden" name="csrf" value="${esc(opts.csrfToken)}"/>
    <input type="hidden" name="outletId" value="${o.id}"/>
    <button type="submit" class="choice"${disabled}><strong>${esc(o.name)}</strong>${badge}${loc}${lockNote}</button>
  </form>`;
    })
    .join("\n");
  return LAYOUT(
    "Select outlet",
    `<div class="card">
  <h1>Select outlet</h1>
  <p class="muted">Pick an unlocked outlet to finish sign-in.</p>
  ${choices || '<div class="err">No outlets returned</div>'}
  <p class="muted" style="margin-top:1rem"><a href="/connect">Cancel</a></p>
</div>`,
  );
}

/** @deprecated stub page — prefer dedicated select UIs */
export function connectNextStepHtml(opts: {
  csrfToken: string;
  step: string;
  detail: string;
}): string {
  return connectLoginPage({
    csrfToken: opts.csrfToken,
    statusHtml: `<div class="warn"><strong>Next step: ${esc(opts.step)}</strong><pre class="muted" style="white-space:pre-wrap">${esc(opts.detail)}</pre></div>`,
  });
}

export function connectPendingHtml(
  csrfToken: string,
  pending: PendingAuthState,
  message?: string,
  opts?: { merchantSlugConfigured?: string },
): string {
  if (pending.step === "select_merchant") {
    return connectSelectMerchantHtml({
      csrfToken,
      merchants: pending.merchants ?? [],
      merchantSlugConfigured: opts?.merchantSlugConfigured,
    });
  }
  if (pending.step === "select_outlet") {
    return connectSelectOutletHtml({
      csrfToken,
      outlets: pending.outlets ?? [],
    });
  }
  return connectErrorHtml({
    csrfToken,
    message:
      message ??
      "OTP accounts are not supported. Use phone/email + PIN that lands on redirect / merchant / outlet only.",
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
