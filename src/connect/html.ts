import type { PendingAuthState, PendingOutlet } from "../session/types";
import { brandRow, esc, layout } from "../web/html";

/** Page chrome shared by every /connect page: status link + owner sign-out. */
function footer(csrfToken: string): string {
  return `<footer class="actions" aria-label="Connect account actions">
  <a class="btn btn-secondary" href="/connect/status">Connection status</a>
  <form method="POST" action="/logout">
    <input type="hidden" name="csrf" value="${esc(csrfToken)}"/>
    <button type="submit" class="btn btn-secondary">Sign out</button>
  </form>
</footer>`;
}

function connectLayout(title: string, csrfToken: string, body: string): string {
  return layout(title, `${body}\n${footer(csrfToken)}`, "Connect Qasir");
}

function pasteSessionCard(csrfToken: string): string {
  const csrf = esc(csrfToken);
  return `<section class="card" id="paste" aria-labelledby="paste-title">
  ${brandRow("Secure connection")}
  <header class="card-header">
    <h1 id="paste-title">Paste dashboard session</h1>
    <p class="subtitle">Use this fallback when the dashboard token cannot be detected automatically.</p>
  </header>
  <div class="panel panel-warning inline-note">
    <span class="status-icon" aria-hidden="true">!</span>
    <span>Copy these values from DevTools on the merchant dashboard. Never share them elsewhere.</span>
  </div>
  <form method="POST" action="/connect/paste" autocomplete="off" class="form-stack">
    <input type="hidden" name="csrf" value="${csrf}"/>
    <label for="apiToken">API_TOKEN <span class="muted">· 32 characters</span></label>
    <input class="field" id="apiToken" name="apiToken" required minlength="32" maxlength="32" pattern="[A-Za-z0-9]{32}" placeholder="AbCd…1234"/>
    <label for="csrfToken">Dashboard CSRF token</label>
    <input class="field" id="csrfToken" name="csrfToken" required minlength="16" maxlength="256" placeholder="Paste meta csrf-token"/>
    <label for="cookie">Cookie header</label>
    <textarea class="field" id="cookie" name="cookie" required placeholder="qasir_sess=…; XSRF-TOKEN=…"></textarea>
    <label for="outletId">Outlet ID <span class="muted">· optional</span></label>
    <input class="field" id="outletId" name="outletId" inputmode="numeric" pattern="\\d*" placeholder="645203"/>
    <div class="actions">
      <a class="btn btn-secondary" href="/connect/status">Cancel</a>
      <button type="submit" class="btn btn-primary">Save session</button>
    </div>
  </form>
  <form method="POST" action="/connect/disconnect">
    <input type="hidden" name="csrf" value="${csrf}"/>
    <button type="submit" class="btn btn-danger">Disconnect saved session</button>
  </form>
</section>`;
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
    `<section class="card" aria-labelledby="login-title">
  ${brandRow("Secure login")}
  <header class="card-header">
    <h1 id="login-title">Enter your owner PIN</h1>
    <p class="subtitle">Confirm the account owner before connecting this MCP client.</p>
  </header>
  <div class="panel panel-neutral inline-note">
    <span class="status-icon" aria-hidden="true">i</span>
    <span>Qasir has no public API. Your PIN is used for this sign-in request only and is never stored, logged, or exposed to MCP tools.</span>
  </div>
  ${status ? `<div aria-live="polite">${status}</div>` : ""}
  <form method="POST" action="/connect/login" autocomplete="off" class="form-stack">
    <label for="username">Owner phone or email</label>
    <input class="field" id="username" name="username" required autocomplete="username" placeholder="62812… or you@example.com"/>
    <div class="field-label-row"><label for="pin">6-digit PIN</label><span class="muted">Required</span></div>
    <input class="field" id="pin" name="pin" type="password" inputmode="numeric" pattern="\\d{6}" maxlength="6" required autocomplete="one-time-code" aria-describedby="pin-help"/>
    <button type="submit" class="btn btn-primary">Sign in &amp; connect</button>
  </form>
  <p class="privacy-note" id="pin-help">Forgot your PIN? Reset it in the Qasir app.</p>
</section>
${pasteSessionCard(opts.csrfToken)}`,
  );
}

export function connectSuccessHtml(opts: {
  csrfToken: string;
  merchantSlug: string;
  tokenPrefix: string;
  via: string;
}): string {
  const csrf = esc(opts.csrfToken);
  return connectLayout(
    "Qasir connected",
    opts.csrfToken,
    `<section class="card" aria-labelledby="success-title">
  ${brandRow("Session verified")}
  <header class="card-header">
    <h1 id="success-title">Dashboard token found</h1>
    <p class="subtitle">Your Qasir session is ready to continue.</p>
  </header>
  <div class="panel panel-success">
    <span class="status-icon" aria-hidden="true">✓</span>
    <div><strong>API token detected</strong><br/><span class="muted">The connected workspace can now read approved Qasir data.</span></div>
  </div>
  <dl class="meta-list">
    <div class="meta-row"><dt>Workspace</dt><dd>${esc(opts.merchantSlug)}</dd></div>
    <div class="meta-row"><dt>Source</dt><dd>${esc(opts.via)}</dd></div>
  </dl>
  <p class="privacy-note">The complete token value stays hidden throughout this flow.</p>
  <div class="actions">
    <a class="btn btn-primary" href="/connect/status">Done</a>
    <form method="POST" action="/connect/disconnect">
      <input type="hidden" name="csrf" value="${csrf}"/>
      <button type="submit" class="btn btn-danger">Disconnect</button>
    </form>
  </div>
</section>`,
  );
}

function otpUnsupportedHtml(csrfToken: string): string {
  return connectLayout(
    "OTP account unsupported",
    csrfToken,
    `<section class="card" aria-labelledby="otp-title">
  ${brandRow("Unsupported account")}
  <header class="card-header">
    <h1 id="otp-title">OTP accounts aren’t supported</h1>
    <p class="subtitle">Use a Qasir account that completes sign-in with phone or email and a 6-digit PIN.</p>
  </header>
  <div class="panel panel-danger">
    <span class="status-icon" aria-hidden="true">!</span>
    <div><strong>OTP verification required</strong><br/><span class="muted">This connector intentionally stops before the OTP step.</span></div>
  </div>
  <dl class="meta-list">
    <div class="meta-row"><dt>Source</dt><dd>Login response</dd></div>
    <div class="meta-row"><dt>Workspace</dt><dd>Not connected</dd></div>
  </dl>
  <div class="actions">
    <a class="btn btn-secondary" href="/connect/status">Close</a>
    <a class="btn btn-primary" href="/connect">Use another account</a>
  </div>
  <p class="privacy-note">No PIN, OTP, or dashboard session was stored.</p>
</section>`,
  );
}

export function connectErrorHtml(opts: {
  csrfToken: string;
  message: string;
}): string {
  if (/\botp\b/i.test(opts.message)) return otpUnsupportedHtml(opts.csrfToken);
  const pinError = /\bpin\b/i.test(opts.message);
  return connectLoginPage({
    csrfToken: opts.csrfToken,
    statusHtml: `<div class="panel panel-danger err" role="alert">
  <span class="status-icon" aria-hidden="true">!</span>
  <div><strong>${pinError ? "PIN tidak cocok" : "Sign-in failed"}</strong><br/><span>${esc(opts.message)}</span></div>
</div>`,
  });
}

export function connectPasteNeededHtml(opts: {
  csrfToken: string;
  merchantSlug: string;
  reason: string;
}): string {
  return connectLayout(
    "Dashboard token not found",
    opts.csrfToken,
    `<section class="card" aria-labelledby="missing-title">
  ${brandRow("Needs attention")}
  <header class="card-header">
    <h1 id="missing-title">Dashboard token not found</h1>
    <p class="subtitle">The dashboard loaded, but no usable API token was detected.</p>
  </header>
  <div class="panel panel-warning">
    <span class="status-icon" aria-hidden="true">!</span>
    <div><strong>Token unavailable</strong><br/><span class="muted">${esc(opts.reason)}</span></div>
  </div>
  <dl class="meta-list">
    <div class="meta-row"><dt>Source</dt><dd>Dashboard HTML</dd></div>
    <div class="meta-row"><dt>Workspace</dt><dd>${esc(opts.merchantSlug)}</dd></div>
  </dl>
  <div class="actions">
    <a class="btn btn-secondary" href="/connect/status">Cancel</a>
    <a class="btn btn-primary" href="#paste">Open paste fallback</a>
  </div>
  <p class="privacy-note">No API token was collected from this page.</p>
</section>
${pasteSessionCard(opts.csrfToken)}`,
  );
}

function outletChoice(o: PendingOutlet, selected: boolean): string {
  const id = esc(String(o.id));
  const badge = o.is_lock
    ? '<span class="badge">LOCKED</span>'
    : o.is_main
      ? '<span class="badge">MAIN</span>'
      : "";
  const location = o.is_lock
    ? `Access restricted · Outlet ID ${id}`
    : `${o.location_name ? `${esc(o.location_name)} · ` : ""}Outlet ID ${id}`;
  const attrs = `${o.is_lock ? " disabled" : ""}${selected ? " checked" : ""}`;
  return `<label class="radio-card${o.is_lock ? " muted" : ""}">
  <input type="radio" name="outletId" value="${id}" required${attrs}/>
  <span><strong>${esc(o.name)}</strong> ${badge}<br/><span class="muted">${location}</span></span>
</label>`;
}

/** Outlet picker. The PIN is asked again because pending state never stores it. */
export function connectSelectOutletHtml(opts: {
  csrfToken: string;
  outlets: PendingOutlet[];
  message?: string;
}): string {
  const firstUnlocked = opts.outlets.find((o) => !o.is_lock)?.id;
  const choices = opts.outlets.map((o) => outletChoice(o, o.id === firstUnlocked)).join("\n");
  const message = opts.message
    ? `<div class="panel panel-danger err" role="alert"><span class="status-icon" aria-hidden="true">!</span><span>${esc(opts.message)}</span></div>`
    : "";
  return connectLayout(
    "Select outlet",
    opts.csrfToken,
    `<section class="card" aria-labelledby="outlet-title">
  ${brandRow("Secure connection")}
  <div class="section-label"><span class="badge">STEP 2 OF 2</span> Choose outlet</div>
  <header class="card-header">
    <h1 id="outlet-title">Select an outlet</h1>
    <p class="subtitle">Choose the location this MCP connection can read from.</p>
  </header>
  <div class="panel panel-neutral"><strong>Configured Qasir workspace</strong><br/><span class="muted">Confirm an available outlet below.</span></div>
  ${message}
  <form method="POST" action="/connect/select-outlet" autocomplete="off" class="form-stack">
    <input type="hidden" name="csrf" value="${esc(opts.csrfToken)}"/>
    <fieldset aria-describedby="outlet-help">
      <legend class="section-label">AVAILABLE OUTLETS</legend>
      ${choices || '<div class="panel panel-danger err" role="alert">No outlets returned</div>'}
    </fieldset>
    <p class="inline-note" id="outlet-help">Locked outlets must be unlocked in Qasir before they can be connected.</p>
    <label for="pin">Confirm 6-digit PIN</label>
    <input class="field" id="pin" name="pin" type="password" inputmode="numeric" pattern="\\d{6}" maxlength="6" required autocomplete="one-time-code"/>
    <div class="actions">
      <button type="submit" class="btn btn-primary"${firstUnlocked === undefined ? " disabled" : ""}>Connect outlet</button>
    </div>
  </form>
  <form method="POST" action="/connect/cancel">
    <input type="hidden" name="csrf" value="${esc(opts.csrfToken)}"/>
    <button type="submit" class="btn btn-secondary">Cancel</button>
  </form>
</section>`,
  );
}

export function connectPendingHtml(
  csrfToken: string,
  pending: PendingAuthState,
  message?: string,
): string {
  return connectSelectOutletHtml({ csrfToken, outlets: pending.outlets, message });
}
