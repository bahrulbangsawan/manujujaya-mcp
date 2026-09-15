import type { ApiOperation, JsonSchemaLike } from "../types";

export function op(partial: ApiOperation): ApiOperation {
  return partial;
}

export const pageCount: JsonSchemaLike = {
  type: "object",
  properties: {
    page: { type: "integer", description: "1-based page index" },
    count: { type: "integer", description: "Page size" },
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
