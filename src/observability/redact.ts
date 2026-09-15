const SECRET_KEYS =
  /^(authorization|cookie|x-csrf-token|xsrf-token|password|pin|token|api[_-]?token|tokenweb|qasir_sess|laravel-session|bearer)$/i;

const TOKENISH =
  /\b(Bearer\s+[A-Za-z0-9._~+/=-]{8,}|[A-Fa-f0-9]{32}|[A-Za-z0-9_-]{40,})\b/g;

export function redactValue(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    return value.replace(TOKENISH, "[REDACTED]");
  }
  if (Array.isArray(value)) return value.map(redactValue);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEYS.test(k) ? "[REDACTED]" : redactValue(v);
    }
    return out;
  }
  return value;
}

export function redactText(text: string): string {
  return text.replace(TOKENISH, "[REDACTED]");
}

/** Strip sample phones/emails/tokens from markdown before exposing as MCP resources. */
export function sanitizeDocMarkdown(md: string): string {
  return md
    .replace(/\b628\d{8,12}\b/g, "<PHONE_REDACTED>")
    .replace(/\b08\d{8,12}\b/g, "<PHONE_REDACTED>")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "<EMAIL_REDACTED>")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer <TOKEN>")
    .replace(/authorization:\s*<TOKEN>/gi, "authorization: <TOKEN>")
    .replace(/qasir_sess=[^;\s"']+/gi, "qasir_sess=<SESSION>")
    .replace(/XSRF-TOKEN=[^;\s"']+/gi, "XSRF-TOKEN=<XSRF>")
    .replace(/tokenWeb=[^&\s"']+/gi, "tokenWeb=<TOKEN_WEB>")
    .replace(TOKENISH, "[REDACTED]");
}
