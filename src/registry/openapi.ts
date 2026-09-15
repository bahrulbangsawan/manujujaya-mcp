import { listExposedOperations } from "./operations";
import type { ApiOperation, HostKey } from "./types";

export const HOST_URLS: Record<HostKey, string> = {
  pos: "https://pos.qasir.id",
  order: "https://order.qasir.id",
  payment: "https://payment.qasir.id",
  account: "https://account.qasir.id",
  sms: "https://sms.qasir.id",
  www: "https://www.qasir.id",
  merchant: "https://{merchant_slug}.qasir.id",
};

/** Base URL for one host; the merchant host is bound to the configured slug. */
export function hostBaseUrl(host: HostKey, merchantSlug: string): string {
  return HOST_URLS[host].replace("{merchant_slug}", merchantSlug);
}

/**
 * Sanitized OpenAPI 3.1 document for Code Mode search (no secrets/PII samples).
 * Each operation carries its own single `servers` entry, so tooling never
 * resolves an op against the wrong host. OpenAPI paths are keyed without the
 * host, so two ops sharing method+path on different hosts cannot both be
 * represented; that is a registry bug and throws.
 */
export function buildOpenApiDocument(
  merchantSlug: string,
  operations: ApiOperation[] = listExposedOperations(),
): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const op of operations) {
    const pathKey = op.pathTemplate;
    const method = op.method.toLowerCase();
    const item = paths[pathKey] ?? {};
    const existing = item[method] as { operationId?: string } | undefined;
    if (existing) {
      throw new Error(
        `OpenAPI path collision: ${op.method} ${pathKey} used by ${existing.operationId} and ${op.operationId}`,
      );
    }
    item[method] = operationToOpenApi(op, merchantSlug);
    paths[pathKey] = item;
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Qasir Dashboard API (sanitized)",
      version: "0.1.0",
      description:
        "Generated from manujujaya-mcp operation registry. Hosts differ per operation: use each operation's `servers` entry. Credentials never appear here. Sample IDs in upstream docs are examples only.",
    },
    tags: uniqueTags(operations).map((name) => ({ name })),
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

function operationToOpenApi(
  op: ApiOperation,
  merchantSlug: string,
): Record<string, unknown> {
  return {
    operationId: op.operationId,
    summary: op.title,
    description: op.description,
    tags: op.tags,
    servers: [{ url: hostBaseUrl(op.host, merchantSlug), description: op.host }],
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
