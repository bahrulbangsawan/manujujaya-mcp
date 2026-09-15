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

  it("sanitizes doc markdown phones/emails/tokens", () => {
    const s = sanitizeDocMarkdown(
      "call 6281200000000 or +6281200000001 or 081200000000 or a@b.com Bearer TOKENTOKENTOKENTOKEN",
    );
    expect(s).not.toContain("6281200000000");
    expect(s).not.toContain("6281200000001");
    expect(s).not.toContain("081200000000");
    expect(s).not.toContain("a@b.com");
    expect(s).not.toContain("TOKENTOKENTOKENTOKEN");
  });

  it("keeps prose that merely mentions Bearer", () => {
    expect(sanitizeDocMarkdown("Auth is a dashboard Bearer session.")).toBe(
      "Auth is a dashboard Bearer session.",
    );
  });

  it("replaces UUIDs such as device ids", () => {
    const s = sanitizeDocMarkdown("| `device_id` | UUID | `00000000-0000-4000-8000-000000000000` |");
    expect(s).toContain("`<UUID>`");
  });

  it("redacts person fields in table sample cells, including bare digits", () => {
    const md = [
      "### `data.customer`",
      "",
      "| Field | Type | Sample | Notes |",
      "| --- | --- | --- | --- |",
      "| `id` | integer | `1001` | keep |",
      "| `fullname` | string | `Example Person/Nick` | Nickname `suffix` stays |",
      "| `mobile` | string | `81200000000` | No `62` prefix |",
      "| `name` | string | `Example Person` | |",
      "| `email` | string | `\"\"` | empty stays |",
    ].join("\n");
    const s = sanitizeDocMarkdown(md);
    expect(s).toContain("| `id` | integer | `1001` | keep |");
    expect(s).toContain("| `fullname` | string | `<PII_REDACTED>` | Nickname `suffix` stays |");
    expect(s).toContain("| `mobile` | string | `<PII_REDACTED>` | No `62` prefix |");
    expect(s).toContain("| `name` | string | `<PII_REDACTED>` | |");
    expect(s).toContain('| `email` | string | `""` | empty stays |');
  });

  it("keeps `name` samples outside person sections", () => {
    const md = [
      "### `data.users[].outlets[]`",
      "",
      "| Field | Type | Sample |",
      "| --- | --- | --- |",
      "| `name` | string | `Example Outlet` |",
      "",
      "### `data.access[]`",
      "",
      "| `type` | `name` | Users on this page |",
      "| --- | --- | --- |",
      "| `3` | `Operator` | `Example Person`, `Other Person` |",
    ].join("\n");
    const s = sanitizeDocMarkdown(md);
    expect(s).toContain("`Example Outlet`");
    expect(s).toContain("| `3` | `Operator` | `<PII_REDACTED>`, `<PII_REDACTED>` |");
  });

  it("redacts names in person columns but keeps numeric ids", () => {
    const md = [
      "## Observed users",
      "",
      "| Source | id / name |",
      "| --- | --- |",
      '| history | `"1234567"` / `Example Person` |',
    ].join("\n");
    expect(sanitizeDocMarkdown(md)).toContain('| history | `"1234567"` / `<PII_REDACTED>` |');
  });

  it("redacts JSON person names by container key or sibling person fields", () => {
    const md = [
      "## Sample",
      "",
      "```json",
      "{",
      '  "customer": { "id": 1, "name": "Example Person", "mobile": "81200000000" },',
      '  "user_settled": { "id": 2, "name": "Example Cashier " },',
      '  "carts": [{ "variant": { "product": { "name": "FILTER UDARA" } } }],',
      '  "staff": [{ "name": "Other Person", "email": "x@example.com",',
      '    "outlets": [{ "id": 3, "name": "Example Outlet" }] }]',
      "}",
      "```",
    ].join("\n");
    const s = sanitizeDocMarkdown(md);
    expect(s).not.toContain("Example Person");
    expect(s).not.toContain("Example Cashier");
    expect(s).not.toContain("Other Person");
    expect(s).not.toContain("81200000000");
    expect(s).toContain('"name": "FILTER UDARA"');
    expect(s).toContain('"name": "Example Outlet"');
  });

  it("redacts inline JSON person fields outside fences", () => {
    const s = sanitizeDocMarkdown('Shape: `{ "mobile": "81200000000", "fullname": "A B" }`');
    expect(s).toBe('Shape: `{ "mobile": "<PII_REDACTED>", "fullname": "<PII_REDACTED>" }`');
  });
});
