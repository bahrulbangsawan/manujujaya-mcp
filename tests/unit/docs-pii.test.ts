import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BUNDLED_DOCS } from "../../src/docs/bundled";
import { sanitizeDocMarkdown } from "../../src/observability/redact";
import { API_DOC_NAMES } from "../../src/registry/doc-endpoints";

const root = path.resolve(__dirname, "../..");
const docsDir = path.join(root, "docs");

/**
 * SHA-256 (lowercased) + length of real sample PII that used to be in docs/*.md
 * (customer/staff names, phones, emails, device/sale UUIDs, a staff photo file).
 * Hashed so this test does not reintroduce the values as greppable plain text.
 */
const KNOWN_PII: ReadonlyArray<readonly [string, number]> = [
  ["c64548253e40ebdc046a552990bd2cd2086d14c8fbfd7fe6729954c0bfd86652", 15],
  ["2d80202ec68d6aa5ee02ef1f785268dec94e7f7398bdbd484c307a0f5cb47780", 8],
  ["aae80dfaf9b29043f2a90fbf7ff226c66ae31072ae6b78e1659277c86ee9ebda", 21],
  ["4210572c2379ca13042bf3aa723a8f8e37ae657dc7089e912de4a1291303acb1", 14],
  ["d220658597b6869a1b0973f89b77e5f1020968d0aa1eb47c1208ce46de082f50", 7],
  ["327f529bc923969e1222c2683eb52f3d98b25d8ce105c76601225d143cc5d40b", 36],
  ["1992ec12fef65f7fff1a3b39edac717c75c2b14240b4c64356f95096a5a9c601", 36],
  ["f93f7027d93313a0d2b9a4cf0f27daf5ff96706ebf0f172893e894f79d0190d9", 23],
  ["e47ea50b6c222736084e7afdffcde03b011c7b72cfffd26a41899c38d6ba47c6", 13],
  ["fed30ddcc53ece3468587a4a3d7e8ead0d1790515783428149df5170d16e1a7f", 13],
  ["fc9aa6713f48f41fefa80e6354b9e4aca19b63b0bcf57917ba0229f2552d77c0", 40],
  ["ec403d035ac3f9f3e850260de4c8e1df79cfb1a5917d71bf3fd0394b55227d3a", 5],
  ["39a730ec6a78a2d9a2662424ccc0cf957f9be204c213340cc857f4b4ba65c5f1", 4],
  ["b4e0365ddaee24dc417c9315878128f71d89894acdccefe6534ec49aff82a30d", 6],
  ["e60894401f4685c85486fa249b995dcd8036401b3b30b2251455b2e05cac58cd", 4],
  ["571a360dde9b119ecb57c79b1cc42bff8ddf977fe308196b71085ea25de080d3", 4],
  ["803732bd3ff49b7c0e73a032ca42fb25b3a79a429da514039b364ed5e5500ca6", 12],
];

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/** Word-bounded substrings whose hash matches a known PII value. */
function findKnownPii(text: string): string[] {
  const lower = text.toLowerCase();
  const hashes = new Map<number, Set<string>>();
  for (const [h, len] of KNOWN_PII) {
    const set = hashes.get(len) ?? new Set<string>();
    set.add(h);
    hashes.set(len, set);
  }
  const word = /[a-z0-9]/;
  const hits: string[] = [];
  for (let i = 0; i < lower.length; i++) {
    if (i > 0 && word.test(lower[i - 1] ?? "")) continue;
    for (const [len, set] of hashes) {
      const end = i + len;
      if (end > lower.length || word.test(lower[end] ?? "")) continue;
      const candidate = lower.slice(i, end);
      if (set.has(sha(candidate))) hits.push(`offset ${i} (${len} chars)`);
    }
  }
  return hits;
}

function allMarkdown(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory()
      ? allMarkdown(path.join(dir, d.name))
      : d.name.endsWith(".md")
        ? [path.join(dir, d.name)]
        : [],
  );
}

describe("bundled docs", () => {
  it("bundle exposes exactly the API docs, byte-equal to docs/*.md", () => {
    expect(Object.keys(BUNDLED_DOCS).sort()).toEqual([...API_DOC_NAMES].sort());
    for (const name of API_DOC_NAMES) {
      const onDisk = readFileSync(path.join(docsDir, `${name}.md`), "utf8");
      // Regenerate with `bun run scripts/bundle-docs.ts` when this fails.
      expect(BUNDLED_DOCS[name], name).toBe(onDisk);
    }
  });

  it("the PII detector finds a planted value (guards against a vacuous pass)", () => {
    // A 4-char known value, reconstructed from char codes so it is not plain text here.
    const planted = String.fromCharCode(0x69, 0x77, 0x61, 0x6e).toUpperCase();
    expect(findKnownPii(`| \`${planted}\` | x |`)).toHaveLength(1);
    expect(findKnownPii(`${planted}x`)).toHaveLength(0);
  });

  it("no docs markdown contains known real sample PII", () => {
    for (const file of allMarkdown(docsDir)) {
      const hits = findKnownPii(readFileSync(file, "utf8"));
      expect(hits, path.relative(root, file)).toEqual([]);
    }
  });

  it("bundled docs contain no known PII", () => {
    for (const [name, md] of Object.entries(BUNDLED_DOCS)) {
      expect(findKnownPii(md), name).toEqual([]);
    }
  });
});

describe("sanitizeDocMarkdown over bundled docs", () => {
  const sanitized = Object.fromEntries(
    Object.entries(BUNDLED_DOCS).map(([name, md]) => [name, sanitizeDocMarkdown(md)]),
  );
  const all = Object.values(sanitized).join("\n");

  it("removes UUIDs, emails and phone numbers", () => {
    expect(all).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    expect(all).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    expect(all).not.toMatch(/\b62\d{8,13}\b|\b08\d{7,12}\b/);
  });

  it("redacts person fields in tables and JSON samples even when values are placeholders", () => {
    for (const placeholder of [
      "Example Customer",
      "Example Cashier",
      "Example Staff",
      "Example Operator",
      "EXAMPLE MECHANIC",
      "81200000000",
    ]) {
      expect(all, placeholder).not.toContain(placeholder);
    }
    expect(sanitized.customers).toContain('"fullname": "<PII_REDACTED>"');
    expect(sanitized["order-histories-legacy"]).toContain(
      '"user_settled": { "id": 3306084, "name": "<PII_REDACTED>" }',
    );
  });

  it("keeps non-personal samples useful", () => {
    expect(sanitized.products).toContain("FILTER UDARA M/L300E4 1500-A286(A07)");
    expect(sanitized["order-histories-legacy"]).toContain("BAK REM T/INV");
    expect(sanitized.users).toContain("`Operator`");
    expect(sanitized.users).toContain('"name": "Toko Manuju Jaya"');
    expect(sanitized.customers).toContain("Auth is a dashboard Bearer session");
  });
});
