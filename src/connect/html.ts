import type { PendingAuthState, PendingOutlet } from "../session/types";
import { esc, layout } from "../web/html";

/** Page chrome shared by every /connect page: status link + owner sign-out. */
function footer(csrfToken: string): string {
  return `<div class="row" style="margin-top:1rem;align-items:center">
  <a class="muted" href="/connect/status">Status</a>
  <form method="POST" action="/logout" style="margin:0">
    <input type="hidden" name="csrf" value="${esc(csrfToken)}"/>
    <button type="submit" class="secondary" style="margin-top:0">Sign out</button>
  </form>
</div>`;
}

function connectLayout(title: string, csrfToken: string, body: string): string {
  return layout(title, `${body}\n${footer(csrfToken)}`, "Connect Qasir");
}

export function connectLoginPage(opts: {
  csrfToken: string;
  statusHtml?: string;
}): string {
  const status = opts.statusHtml ?? "";
  const csrf = esc(opts.csrfToken);
  return connectLayout(
    "Connect Qasir",
    opts.csrfToken,
    `<div class="card">
  <h1>Connect Qasir</h1>
  <p class="muted">Captures an unofficial dashboard session (phone/email + PIN) for this MCP worker. This is <strong>not</strong> official OAuth.</p>
  <div class="warn">Qasir has no public API. Credentials stay in Durable Object storage (AES-GCM). The PIN is used for the sign-in request only and is never stored, logged or exposed to MCP tools.</div>
  ${status}
  <form method="POST" action="/connect/login" autocomplete="off">
    <input type="hidden" name="csrf" value="${csrf}"/>
    <label for="username">Phone (62…) or email</label>
    <input id="username" name="username" required placeholder="62812… or you@example.com"/>
    <label for="pin">PIN (6 digits)</label>
    <input id="pin" name="pin" type="password" inputmode="numeric" pattern="\\d{6}" maxlength="6" required autocomplete="one-time-code"/>
    <button type="submit">Sign in &amp; connect</button>
  </form>
</div>
<div class="card" style="margin-top:1rem" id="paste">
  <h1>Paste fallback</h1>
  <p class="muted">If API_TOKEN cannot be scraped after login (mint hop undocumented), paste values from DevTools on the merchant dashboard.</p>
  <form method="POST" action="/connect/paste" autocomplete="off">
    <input type="hidden" name="csrf" value="${csrf}"/>
    <label for="apiToken">API_TOKEN (32 chars)</label>
    <input id="apiToken" name="apiToken" required minlength="32" maxlength="32" pattern="[A-Za-z0-9]{32}"/>
    <label for="csrfToken">CSRF token (dashboard &lt;meta name="csrf-token"&gt;)</label>
    <input id="csrfToken" name="csrfToken" required minlength="16" maxlength="256"/>
    <label for="cookie">Cookie header</label>
    <textarea id="cookie" name="cookie" required placeholder="qasir_sess=…; XSRF-TOKEN=…"></textarea>
    <label for="outletId">Outlet id (optional)</label>
    <input id="outletId" name="outletId" inputmode="numeric" pattern="\\d*"/>
    <button type="submit">Save pasted session</button>
  </form>
  <form method="POST" action="/connect/disconnect" style="margin-top:.75rem">
    <input type="hidden" name="csrf" value="${csrf}"/>
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

function outletChoice(o: PendingOutlet, firstUnlocked: boolean): string {
  const badge = o.is_main ? '<span class="badge">Utama</span>' : "";
  const loc = o.location_name ? `<br/><span class="muted">${esc(o.location_name)}</span>` : "";
  const lock = o.is_lock ? '<br/><span class="muted">Locked — no access</span>' : "";
  const attrs = `${o.is_lock ? " disabled" : ""}${firstUnlocked ? " checked" : ""}`;
  return `<label class="check"><input type="radio" name="outletId" value="${o.id}" required${attrs}/><span><strong>${esc(o.name)}</strong>${badge}${loc}${lock}</span></label>`;
}

/** Outlet picker. The PIN is asked again because pending state never stores it. */
export function connectSelectOutletHtml(opts: {
  csrfToken: string;
  outlets: PendingOutlet[];
  message?: string;
}): string {
  const firstUnlocked = opts.outlets.find((o) => !o.is_lock)?.id;
  const choices = opts.outlets.map((o) => outletChoice(o, o.id === firstUnlocked)).join("\n");
  const message = opts.message ? `<div class="err">${esc(opts.message)}</div>` : "";
  return connectLayout(
    "Select outlet",
    opts.csrfToken,
    `<div class="card">
  <h1>Select outlet</h1>
  <p class="muted">Pick an unlocked outlet and confirm your PIN to finish sign-in. The PIN is not kept between steps.</p>
  ${message}
  <form method="POST" action="/connect/select-outlet" autocomplete="off">
    <input type="hidden" name="csrf" value="${esc(opts.csrfToken)}"/>
    ${choices || '<div class="err">No outlets returned</div>'}
    <label for="pin">PIN (6 digits)</label>
    <input id="pin" name="pin" type="password" inputmode="numeric" pattern="\\d{6}" maxlength="6" required autocomplete="one-time-code"/>
    <button type="submit"${firstUnlocked === undefined ? " disabled" : ""}>Continue</button>
  </form>
  <form method="POST" action="/connect/cancel" style="margin-top:.5rem">
    <input type="hidden" name="csrf" value="${esc(opts.csrfToken)}"/>
    <button type="submit" class="secondary">Cancel</button>
  </form>
</div>`,
  );
}

export function connectPendingHtml(
  csrfToken: string,
  pending: PendingAuthState,
  message?: string,
): string {
  return connectSelectOutletHtml({ csrfToken, outlets: pending.outlets, message });
}
