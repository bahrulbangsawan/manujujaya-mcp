import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { computeWidgetSourceHash, widgetSourceFiles } from "../../scripts/lib/widget-source-hash";
import { WIDGET_HTML, WIDGET_SOURCE_HASH } from "../../src/widgets/bundled";
import { VIEW_MARKER } from "../../src/widgets/contract";

const root = path.resolve(__dirname, "../..");

describe("widget source hash", () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  function fixture(): string {
    dir = mkdtempSync(path.join(tmpdir(), "widget-hash-"));
    const files: Record<string, string> = {
      "package.json": "{}\n",
      "bun.lock": "lock\n",
      "src/widgets/contract.ts": "export const A = 1;\n",
      "widgets/index.html": "<div id=\"root\"></div>\n",
      "widgets/vite.config.ts": "export default {};\n",
      "widgets/tsconfig.json": "{}\n",
      "widgets/src/main.tsx": "export {};\n",
      "widgets/src/components/Chip.tsx": "export {};\n",
      "widgets/dev/fixtures.ts": "export {};\n",
      "widgets/test/components/Chip.test.tsx": "export {};\n",
    };
    for (const [rel, content] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      writeFileSync(path.join(dir, rel), content);
    }
    return dir;
  }

  it("lists bundle inputs in sorted order, without tests or dotfiles", () => {
    const base = fixture();
    writeFileSync(path.join(base, "widgets/src/.DS_Store"), "x");
    expect(widgetSourceFiles(base)).toEqual([
      "bun.lock",
      "package.json",
      "src/widgets/contract.ts",
      "widgets/dev/fixtures.ts",
      "widgets/index.html",
      "widgets/src/components/Chip.tsx",
      "widgets/src/main.tsx",
      "widgets/tsconfig.json",
      "widgets/vite.config.ts",
    ]);
  });

  it("changes when a widget source changes and ignores tests and line endings", () => {
    const base = fixture();
    const before = computeWidgetSourceHash(base);
    expect(before).toMatch(/^[0-9a-f]{64}$/);

    writeFileSync(path.join(base, "widgets/test/components/Chip.test.tsx"), "export const changed = true;\n");
    writeFileSync(path.join(base, "widgets/src/main.tsx"), "export {};\r\n");
    expect(computeWidgetSourceHash(base)).toBe(before);

    writeFileSync(path.join(base, "widgets/src/components/Chip.tsx"), "export const Chip = 1;\n");
    expect(computeWidgetSourceHash(base)).not.toBe(before);
  });
});

describe("bundled widget HTML (src/widgets/bundled.ts)", () => {
  it("was generated from the current widget sources", () => {
    expect(computeWidgetSourceHash(root), "widget sources changed: run bun run widgets:bundle").toBe(WIDGET_SOURCE_HASH);
  });

  it("carries the view marker exactly once and the build stamp", () => {
    expect(WIDGET_HTML.split(VIEW_MARKER)).toHaveLength(2);
    expect(WIDGET_HTML).toContain(`<meta name="mj-build" content="${WIDGET_SOURCE_HASH.slice(0, 12)}" />`);
  });

  it("loads nothing from the network", () => {
    expect(WIDGET_HTML).not.toMatch(/<script[^>]*\ssrc\s*=/i);
    expect(WIDGET_HTML).not.toMatch(/<link[^>]*rel\s*=\s*["']?stylesheet/i);
    expect(WIDGET_HTML).not.toMatch(/url\(\s*["']?https?:/i);
    expect(WIDGET_HTML).not.toMatch(/import\(\s*["'`]https?:/i);
    expect(WIDGET_HTML).not.toMatch(
      /<(?:img|link|iframe|source|audio|video|embed|object|a)\b[^>]*\s(?:src|href)\s*=\s*["']?(?:https?:)?\/\//i,
    );
  });

  it("stays under 1 MB and renders no <form>", () => {
    expect(WIDGET_HTML.length).toBeLessThan(1_000_000);
    expect(WIDGET_HTML).not.toMatch(/<form[\s>/]/i);
  });

  it("contains no credential-like strings", () => {
    const patterns: RegExp[] = [
      /Bearer\s+[A-Za-z0-9._~+/=-]{12,}/,
      /qasir_sess=|XSRF-TOKEN=|tokenWeb=/,
      /API_TOKEN/,
      /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
      /["'`][A-Za-z0-9]{32}["'`]/,
    ];
    for (const pattern of patterns) expect(WIDGET_HTML, String(pattern)).not.toMatch(pattern);
  });
});
