import { buildOpenApiDocument } from "../src/registry/openapi";
import { listExposedOperations } from "../src/registry/operations";

const doc = buildOpenApiDocument("bengkel-manuju-jaya-621095") as {
  openapi: string;
  paths: Record<string, unknown>;
};
if (doc.openapi !== "3.1.0") {
  console.error("Expected OpenAPI 3.1.0");
  process.exit(1);
}
const ops = listExposedOperations();
for (const op of ops) {
  const pathItem = doc.paths[op.pathTemplate] as Record<string, unknown> | undefined;
  if (!pathItem || !pathItem[op.method.toLowerCase()]) {
    console.error("Missing path in OpenAPI", op.operationId, op.pathTemplate);
    process.exit(1);
  }
}
const raw = JSON.stringify(doc);
if (/Bearer [A-Za-z0-9_\-]{16,}/.test(raw) || raw.includes("qasir_sess=")) {
  console.error("OpenAPI appears to contain secrets");
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, paths: Object.keys(doc.paths).length, ops: ops.length }));
