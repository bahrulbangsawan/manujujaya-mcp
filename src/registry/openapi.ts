import { listExposedOperations } from "./operations";
import type { ApiOperation, HostKey } from "./types";

const HOST_URLS: Record<HostKey, string> = {
  pos: "https://pos.qasir.id",
  order: "https://order.qasir.id",
  payment: "https://payment.qasir.id",
  account: "https://account.qasir.id",
  sms: "https://sms.qasir.id",
  www: "https://www.qasir.id",
  merchant: "https://{merchant_slug}.qasir.id",
};

/** Sanitized OpenAPI 3.1 document for Code Mode search (no secrets/PII samples). */
export function buildOpenApiDocument(merchantSlug: string): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const op of listExposedOperations()) {
    const pathKey = op.pathTemplate;
    const item = paths[pathKey] ?? {};
    item[op.method.toLowerCase()] = operationToOpenApi(op);
    paths[pathKey] = item;
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Qasir Dashboard API (sanitized)",
      version: "0.1.0",
      description:
        "Generated from manujujaya-mcp operation registry. Credentials never appear here. Sample IDs in upstream docs are examples only.",
    },
    servers: Object.entries(HOST_URLS).map(([key, url]) => ({
      url: url.replace("{merchant_slug}", merchantSlug),
      description: key,
    })),
    tags: uniqueTags(listExposedOperations()).map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer" },
        rawToken: {
          type: "apiKey",
          in: "header",
          name: "Authorization",
          description: "Raw dashboard token without Bearer prefix (stock-histories only)",
        },
        cookieCsrf: {
          type: "apiKey",
          in: "cookie",
          name: "qasir_sess",
        },
      },
    },
  };
}

function operationToOpenApi(op: ApiOperation): Record<string, unknown> {
  return {
    operationId: op.operationId,
    summary: op.title,
    description: op.description,
    tags: op.tags,
    "x-qasir-host": op.host,
    "x-qasir-auth": op.authProfile,
    "x-qasir-safety": op.safety,
    "x-qasir-evidence": op.evidence,
    "x-qasir-response-kind": op.responseKind,
    "x-qasir-source": op.sourceDocument,
    requestBody:
      op.method === "GET"
        ? undefined
        : {
            required: true,
            content: {
              "application/json": { schema: op.inputSchema },
            },
          },
    parameters:
      op.method === "GET"
        ? schemaToParameters(op)
        : pathParamsOnly(op),
    responses: {
      "200": {
        description: "Success",
        content: {
          [op.responseKind === "html" ? "text/html" : "application/json"]: {
            schema: op.outputSchema ?? { type: "object" },
          },
        },
      },
    },
  };
}

function schemaToParameters(op: ApiOperation): unknown[] {
  const props = op.inputSchema.properties ?? {};
  const required = new Set(op.inputSchema.required ?? []);
  const params: unknown[] = [];
  for (const [name, schema] of Object.entries(props)) {
    const inPath = op.pathTemplate.includes(`{${name}}`);
    params.push({
      name,
      in: inPath ? "path" : "query",
      required: inPath || required.has(name),
      schema,
    });
  }
  return params;
}

function pathParamsOnly(op: ApiOperation): unknown[] {
  const props = op.inputSchema.properties ?? {};
  return Object.entries(props)
    .filter(([name]) => op.pathTemplate.includes(`{${name}}`))
    .map(([name, schema]) => ({
      name,
      in: "path",
      required: true,
      schema,
    }));
}

function uniqueTags(ops: ApiOperation[]): string[] {
  return [...new Set(ops.flatMap((o) => o.tags))].sort();
}

/** Compact catalog for search without full schemas. */
export function buildOperationCatalog(): Array<Record<string, unknown>> {
  return listExposedOperations().map((o) => ({
    operationId: o.operationId,
    title: o.title,
    description: o.description,
    method: o.method,
    host: o.host,
    path: o.pathTemplate,
    safety: o.safety,
    auth: o.authProfile,
    responseKind: o.responseKind,
    tags: o.tags,
    evidence: o.evidence,
    sourceDocument: o.sourceDocument,
    inputKeys: Object.keys(o.inputSchema.properties ?? {}),
  }));
}
