import type { ApiOperation, JsonSchemaLike } from "../types";

export function op(partial: ApiOperation): ApiOperation {
  return partial;
}

/** Upper bound for any page-size field; keeps one call from pulling a whole catalog. */
export const MAX_PAGE_SIZE = 100;

/** 1-based page index. */
export const pageParam: JsonSchemaLike = {
  type: "integer",
  minimum: 1,
  description: "1-based page index",
};

/** Page size (`count`), bounded to MAX_PAGE_SIZE. */
export const countParam: JsonSchemaLike = {
  type: "integer",
  minimum: 1,
  maximum: MAX_PAGE_SIZE,
  description: `Page size (1-${MAX_PAGE_SIZE})`,
};

export const pageCount: JsonSchemaLike = {
  type: "object",
  properties: {
    page: pageParam,
    count: countParam,
  },
  required: ["page", "count"],
  additionalProperties: false,
};

export const dateRange: Record<string, JsonSchemaLike> = {
  start_date: { type: "string", description: "YYYY-MM-DD inclusive" },
  end_date: { type: "string", description: "YYYY-MM-DD inclusive" },
  outlet_ids: {
    type: "string",
    description: "Outlet id or CSV",
  },
};
