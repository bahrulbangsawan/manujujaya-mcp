import { buildCoverageManifest, coverageSummary } from "../src/registry/coverage";

const manifest = buildCoverageManifest();
const summary = coverageSummary();
const missingOp = manifest.filter(
  (e) =>
    (e.status === "implemented" ||
      e.status === "html-adapter" ||
      e.status === "mutation-gated") &&
    !e.operationId,
);
if (missingOp.length) {
  console.error("Coverage entries missing operationId", missingOp);
  process.exit(1);
}
console.log(JSON.stringify({ summary, entries: manifest.length }, null, 2));
