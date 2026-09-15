/**
 * Fingerprint of every input that shapes the widget bundle in src/widgets/bundled.ts.
 * scripts/bundle-widgets.ts stores it as WIDGET_SOURCE_HASH and
 * tests/unit/widgets-bundle.test.ts recomputes it to catch a stale bundle.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/** Single files, relative to the repo root. */
export const WIDGET_SOURCE_FILES: readonly string[] = [
  "widgets/index.html",
  "widgets/vite.config.ts",
  "widgets/tsconfig.json",
  "src/widgets/contract.ts",
  "bun.lock",
  "package.json",
];

/** Directories hashed recursively (dotfiles such as .DS_Store are skipped). */
export const WIDGET_SOURCE_DIRS: readonly string[] = ["widgets/src", "widgets/dev"];

function listFiles(root: string, dir: string): string[] {
  const absolute = path.join(root, dir);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".")) return [];
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return listFiles(root, relative);
    return entry.isFile() ? [relative] : [];
  });
}

/** Repo-relative POSIX paths of the hashed files, sorted by code unit. */
export function widgetSourceFiles(root: string): string[] {
  const files = WIDGET_SOURCE_FILES.filter((file) => existsSync(path.join(root, file)));
  return [...files, ...WIDGET_SOURCE_DIRS.flatMap((dir) => listFiles(root, dir))].sort();
}

/** sha256 hex over each file's path and content (CRLF normalized to LF). */
export function computeWidgetSourceHash(root: string): string {
  const hash = createHash("sha256");
  for (const file of widgetSourceFiles(root)) {
    const content = readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");
    hash.update(`${file}\0`);
    hash.update(content);
    hash.update("\0");
  }
  return hash.digest("hex");
}
