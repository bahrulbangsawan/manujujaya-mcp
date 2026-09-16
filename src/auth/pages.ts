import { brandRow, esc, layout } from "../web/html";
import { SCOPES } from "./scopes";

const SCOPE_LABELS: Record<string, string> = {
  [SCOPES.READ]: "Read products, sales, stock, purchases, and reports",
  [SCOPES.WRITE]: "Request gated changes that still require approval for each operation",
  [SCOPES.ADMIN]: "Administrative access, including read and write permissions",
};

export function ownerLoginPage(opts: { csrf: string; next: string; error?: string }): string {
  const err = opts.error
    ? `<div class="panel panel-danger" role="alert"><div class="panel-heading"><span class="status-icon" aria-hidden="true">!</span><div><strong>Sign-in failed</strong><br/>${esc(opts.error)}</div></div></div>`
    : "";
  return layout(
    "Owner sign-in",
    `<section class="card card-compact" aria-labelledby="login-title">
  ${brandRow("Secure owner access")}
  <header class="card-header">
    <h1 id="login-title">Owner sign-in</h1>
    <p class="subtitle">Enter the owner password to continue to this Qasir server.</p>
  </header>
  <div class="panel panel-neutral">
    <strong>Private server access</strong>
    <span>Only the server owner can authorize clients and approve Qasir changes.</span>
  </div>
  ${err}
  <form method="POST" action="/login" autocomplete="off" class="form-stack">
    <input type="hidden" name="csrf" value="${esc(opts.csrf)}"/>
    <input type="hidden" name="next" value="${esc(opts.next)}"/>
    <div class="field">
      <div class="field-label-row">
        <label for="password">Owner password</label>
        <span class="field-hint">Required</span>
      </div>
      <input id="password" name="password" type="password" required autocomplete="current-password" placeholder="Enter owner password"${opts.error ? ' aria-invalid="true" aria-describedby="login-error"' : ""}/>
      ${opts.error ? '<span class="sr-only" id="login-error">The owner password was not accepted.</span>' : ""}
    </div>
    <div class="actions">
      <button type="submit" class="btn btn-primary">Sign in securely</button>
    </div>
  </form>
  <p class="privacy-note">Your password is used only to verify owner access.</p>
</section>`,
  );
}

export interface ConsentPageOptions {
  csrf: string;
  actionUrl: string;
  clientName: string;
  clientId: string;
  redirectUri: string;
  offeredScopes: string[];
  defaultScopes: string[];
  needsPassword: boolean;
  error?: string;
}

export function consentPage(o: ConsentPageOptions): string {
  const err = o.error
    ? `<div class="panel panel-danger" role="alert"><div class="panel-heading"><span class="status-icon" aria-hidden="true">!</span><div><strong>Authorization needs attention</strong><br/>${esc(o.error)}</div></div></div>`
    : "";
  const scopes = o.offeredScopes
    .map((scope) => {
      const checked = o.defaultScopes.includes(scope) ? " checked" : "";
      return `<label class="radio-card">
      <input type="checkbox" name="scope" value="${esc(scope)}"${checked}/>
      <span class="radio-card-copy">
        <span class="scope-name">${esc(scope)}</span>
        <span class="scope-description">${esc(SCOPE_LABELS[scope] ?? scope)}</span>
      </span>
    </label>`;
    })
    .join("\n");
  const password = o.needsPassword
    ? `<div class="field">
      <div class="field-label-row">
        <label for="password">Owner password</label>
        <span class="field-hint">Required to approve</span>
      </div>
      <input id="password" name="password" type="password" required autocomplete="current-password" placeholder="Enter owner password"${o.error ? ' aria-invalid="true" aria-describedby="authorization-error"' : ""}/>
      ${o.error ? '<span class="sr-only" id="authorization-error">Review the authorization error above.</span>' : ""}
    </div>`
    : `<p class="inline-note">Signed in as owner</p>`;
  let redirectOrigin = o.redirectUri;
  try {
    redirectOrigin = new URL(o.redirectUri).origin;
  } catch {
    // Display the raw value when an origin cannot be derived.
  }
  return layout(
    "Authorize MCP client",
    `<section class="card" aria-labelledby="authorization-title">
  ${brandRow()}
  <header class="card-header">
    <h1 id="authorization-title">Authorize MCP client</h1>
    <p class="subtitle">${esc(o.clientName)} is requesting access to your Qasir workspace.</p>
  </header>
  <div class="panel panel-neutral">
    <div class="panel-heading">
      <span class="client-mark" aria-hidden="true">&gt;_</span>
      <span class="panel-copy">
        <strong class="panel-title">${esc(o.clientName)}</strong>
        <span class="eyebrow">Self-declared client</span>
      </span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Redirects to</span>
      <code class="detail-value">${esc(redirectOrigin)}</code>
    </div>
    <span class="eyebrow">Only approve if you started this connection and recognize the redirect.</span>
  </div>
  <div class="meta-list">
    <div class="meta-row">
      <span class="meta-label">Client ID</span>
      <code class="meta-value">${esc(o.clientId)}</code>
    </div>
  </div>
  ${err}
  <form method="POST" action="${esc(o.actionUrl)}" autocomplete="off" class="form-stack">
    <input type="hidden" name="csrf" value="${esc(o.csrf)}"/>
    <fieldset style="min-width:0;margin:0;padding:0;border:0">
      <legend class="section-label" style="margin-bottom:8px">Requested permission</legend>
      ${scopes}
    </fieldset>
    ${password}
    <div class="actions">
      <button type="submit" name="decision" value="approve" class="btn btn-primary">Approve access</button>
      <button type="submit" name="decision" value="deny" class="btn btn-danger" formnovalidate>Deny</button>
    </div>
  </form>
  <p class="privacy-note">Your password is used only to verify this authorization.</p>
</section>`,
  );
}

export function simpleErrorPage(title: string, message: string): string {
  return layout(
    title,
    `<section class="card card-compact" aria-labelledby="error-title">
  ${brandRow("Request closed")}
  <header class="card-header">
    <h1 id="error-title">${esc(title)}</h1>
    <p class="subtitle">This request could not be completed.</p>
  </header>
  <div class="panel panel-danger" role="alert">
    <div class="panel-heading">
      <span class="status-icon" aria-hidden="true">!</span>
      <span>${esc(message)}</span>
    </div>
  </div>
  <p class="privacy-note">No Qasir data was shared.</p>
</section>`,
  );
}
