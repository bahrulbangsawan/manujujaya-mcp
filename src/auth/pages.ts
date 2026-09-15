import { esc, layout } from "../web/html";
import { SCOPES } from "./scopes";

const SCOPE_LABELS: Record<string, string> = {
  [SCOPES.READ]: "Read Qasir data (products, sales, stock, purchases, reports)",
  [SCOPES.WRITE]: "Request gated write operations (still needs per-operation approval and ENABLE_MUTATIONS=true)",
  [SCOPES.ADMIN]: "Administrative access (implies read and write)",
};

export function ownerLoginPage(opts: { csrf: string; next: string; error?: string }): string {
  const err = opts.error ? `<div class="err">${esc(opts.error)}</div>` : "";
  return layout(
    "Owner sign-in",
    `<div class="card">
  <h1>Owner sign-in</h1>
  <p class="muted">This server belongs to a single owner. Enter the owner password to continue.</p>
  ${err}
  <form method="POST" action="/login" autocomplete="off">
    <input type="hidden" name="csrf" value="${esc(opts.csrf)}"/>
    <input type="hidden" name="next" value="${esc(opts.next)}"/>
    <label for="password">Owner password</label>
    <input id="password" name="password" type="password" required autocomplete="current-password"/>
    <button type="submit">Sign in</button>
  </form>
</div>`,
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
  const err = o.error ? `<div class="err">${esc(o.error)}</div>` : "";
  const scopes = o.offeredScopes
    .map((s) => {
      const checked = o.defaultScopes.includes(s) ? " checked" : "";
      return `<label class="check"><input type="checkbox" name="scope" value="${esc(s)}"${checked}/><span><code>${esc(s)}</code><br/><span class="muted">${esc(SCOPE_LABELS[s] ?? s)}</span></span></label>`;
    })
    .join("\n");
  const password = o.needsPassword
    ? `<label for="password">Owner password</label>
    <input id="password" name="password" type="password" required autocomplete="current-password"/>`
    : `<p class="muted">Signed in as owner.</p>`;
  let redirectOrigin = o.redirectUri;
  try {
    redirectOrigin = new URL(o.redirectUri).origin;
  } catch {
    // keep raw value
  }
  return layout(
    "Authorize MCP client",
    `<div class="card">
  <h1>Authorize MCP client</h1>
  <p>An application wants to access this Qasir MCP server.</p>
  <div class="warn">Client name (self-declared): <strong>${esc(o.clientName)}</strong><br/>
  Redirects to: <code>${esc(redirectOrigin)}</code><br/>
  <span class="muted">Only approve if you started this connection yourself and the redirect matches the app you use (for Claude: <code>https://claude.ai</code> or <code>http://localhost</code>).</span></div>
  <p class="muted">Client ID: <code>${esc(o.clientId)}</code></p>
  ${err}
  <form method="POST" action="${esc(o.actionUrl)}" autocomplete="off">
    <input type="hidden" name="csrf" value="${esc(o.csrf)}"/>
    ${scopes}
    ${password}
    <div class="row">
      <button type="submit" name="decision" value="approve">Approve</button>
      <button type="submit" name="decision" value="deny" class="secondary" formnovalidate>Deny</button>
    </div>
  </form>
</div>`,
  );
}

export function simpleErrorPage(title: string, message: string): string {
  return layout(title, `<div class="card"><h1>${esc(title)}</h1><div class="err">${esc(message)}</div></div>`);
}
