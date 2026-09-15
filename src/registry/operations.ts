import type { ApiOperation } from "./types";
import { CATALOG_OPS } from "./ops/catalog";
import { ATTENDANCE_OPS, REPORT_OPS } from "./ops/reports";
import { MISC_OPS, MUTATION_OPS } from "./ops/misc";

/** All registered operations (executable + gated). */
export const OPERATIONS: ApiOperation[] = [
  ...CATALOG_OPS,
  ...REPORT_OPS,
  ...ATTENDANCE_OPS,
  ...MISC_OPS,
  ...MUTATION_OPS,
];

export function getOperation(operationId: string): ApiOperation | undefined {
  return OPERATIONS.find((o) => o.operationId === operationId);
}

export function listExposedOperations(): ApiOperation[] {
  return OPERATIONS.filter((o) => o.exposed);
}

export function listReadOperations(): ApiOperation[] {
  return listExposedOperations().filter((o) => o.safety === "read");
}

export function listMutationOperations(): ApiOperation[] {
  return listExposedOperations().filter(
    (o) => o.safety === "write" || o.safety === "destructive",
  );
}
