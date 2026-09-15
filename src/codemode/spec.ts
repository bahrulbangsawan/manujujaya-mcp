import {
  buildOpenApiDocument,
  buildOperationCatalog,
} from "../registry/openapi";
import { listExposedOperations } from "../registry/operations";

export interface CodemodeSpecBundle {
  openapi: Record<string, unknown>;
  catalog: Array<Record<string, unknown>>;
  examples: string[];
}

export function createSpecBundle(merchantSlug: string): CodemodeSpecBundle {
  return {
    openapi: buildOpenApiDocument(merchantSlug),
    catalog: buildOperationCatalog(),
    examples: [
      `async () => {
  const spec = await codemode.spec();
  return spec.catalog.filter(o => o.tags.includes("products")).slice(0, 10);
}`,
      `async () => {
  const spec = await codemode.spec();
  return spec.catalog.filter(o => o.operationId.includes("reports")).map(o => o.operationId);
}`,
      `async () => {
  const { catalog } = await codemode.spec();
  return catalog.filter(o => o.safety === "read" && o.path.includes("purchases"));
}`,
    ],
  };
}

export function searchCatalog(
  bundle: CodemodeSpecBundle,
  query: string,
): Array<Record<string, unknown>> {
  const q = query.toLowerCase().trim();
  if (!q) return bundle.catalog.slice(0, 25);
  return bundle.catalog
    .filter((o) => {
      const hay = JSON.stringify(o).toLowerCase();
      return q.split(/\s+/).every((term) => hay.includes(term));
    })
    .slice(0, 40);
}

export function exposedReadIds(): string[] {
  return listExposedOperations()
    .filter((o) => o.safety === "read")
    .map((o) => o.operationId);
}
