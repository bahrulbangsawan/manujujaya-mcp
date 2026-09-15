import { describe, expect, it } from "vitest";
import { redactValue, sanitizeDocMarkdown } from "../../src/observability/redact";

describe("redaction", () => {
  it("redacts secrets in objects", () => {
    const out = redactValue({
      authorization: "Bearer abcdefghijklmnop",
      nested: { cookie: "qasir_sess=abc" },
    }) as Record<string, unknown>;
    expect(out.authorization).toBe("[REDACTED]");
  });

  it("sanitizes doc markdown phones/emails", () => {
    const s = sanitizeDocMarkdown("call 6285824711802 or a@b.com Bearer TOKENTOKENTOKENTOKEN");
    expect(s).not.toContain("6285824711802");
    expect(s).not.toContain("a@b.com");
  });
});
