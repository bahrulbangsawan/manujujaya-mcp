import { assertCsrf, ensureCsrf, readOwner, type OwnerEnv } from "../auth/owner";
import { toAppError } from "../errors/codes";
import { log } from "../observability/log";
import { redactValue } from "../observability/redact";
import { esc, htmlResponse, layout } from "../web/html";
import { approvalsStubFor, type ApprovalRecord } from "./mutation-approvals";

export interface ApprovalRoutesEnv extends OwnerEnv {
  MUTATION_APPROVALS: DurableObjectNamespace;
}

const ID_RE = /^\/approvals\/([0-9a-f-]{36})$/;

function approvalPage(record: ApprovalRecord, csrf: string, message?: string): string {
  const p = record.preview;
  const expired = Date.now() > record.expiresAt;
  const details = JSON.stringify(
    { path: p.path, query: p.query, body: redactValue(p.body) },
    null,
    2,
  );
  const actions =
    record.status === "pending" && !expired
      ? `<form method="POST">
    <input type="hidden" name="csrf" value="${esc(csrf)}"/>
    <div class="row">
      <button type="submit" name="decision" value="approve">Approve once</button>
      <button type="submit" name="decision" value="reject" class="secondary">Reject</button>
    </div>
  </form>`
      : `<p class="muted">Status: <strong>${esc(expired && record.status === "pending" ? "expired" : record.status)}</strong></p>`;
  return layout(
    "Approve mutation",
    `<div class="card">
  <h1>Approve Qasir change</h1>
  ${message ? `<div class="ok">${esc(message)}</div>` : ""}
  <div class="warn"><strong>${esc(p.title)}</strong> (<code>${esc(p.operationId)}</code>)<br/>
  Safety: <strong>${esc(p.safety)}</strong> · ${esc(p.method)} ${esc(p.host)}${esc(p.pathTemplate)}</div>
  <label>Arguments</label>
  <pre style="white-space:pre-wrap;word-break:break-all" class="muted">${esc(details)}</pre>
  <p class="muted">Approval is single-use, bound to exactly these arguments, and expires ${esc(new Date(record.expiresAt).toISOString())}.</p>
  ${actions}
</div>`,
  );
}

/** Owner-only approval page for pending execute_mutation requests. */
export async function handleApprovalRoutes(request: Request, env: ApprovalRoutesEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const match = ID_RE.exec(url.pathname);
  if (!match) return null;
  const owner = await readOwner(request, env);
  if (!owner) {
    if (request.method === "GET") {
      return new Response(null, {
        status: 302,
        headers: { location: `/login?next=${encodeURIComponent(url.pathname)}`, "cache-control": "no-store" },
      });
    }
    return Response.json({ code: "UNAUTHORIZED", message: "Owner sign-in required" }, { status: 401 });
  }
  const stub = approvalsStubFor(env.MUTATION_APPROVALS, owner.subject);
  const csrf = ensureCsrf(request);
  const cookies = csrf.setCookie ? { "set-cookie": csrf.setCookie } : undefined;
  const record = await stub.get(match[1]!);
  if (!record || record.subject !== owner.subject) {
    return htmlResponse(layout("Not found", `<div class="card"><div class="err">Approval not found.</div></div>`), 404);
  }
  if (request.method === "GET") return htmlResponse(approvalPage(record, csrf.token), 200, cookies);
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const form = await request.formData();
  try {
    await assertCsrf(request, String(form.get("csrf") ?? ""));
    const decision = form.get("decision") === "approve" ? "approve" : "reject";
    const updated = await stub.decide({ id: record.id, subject: owner.subject, decision });
    log("info", "mutation.approval.decided", { operationId: updated.operationId, decision });
    const note = decision === "approve" ? "Approved. Ask the assistant to run execute_mutation again with this approvalId." : "Rejected.";
    return htmlResponse(approvalPage(updated, csrf.token, note), 200, cookies);
  } catch (err) {
    // DO RPC errors arrive as plain Errors with name/code copied.
    const app = toAppError(err);
    return htmlResponse(approvalPage(record, csrf.token, app?.message ?? "Could not record decision"), app?.status ?? 500, cookies);
  }
}
