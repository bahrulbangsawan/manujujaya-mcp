import { ResourceNotFoundError, ResourceTemplate, type McpServer } from "@modelcontextprotocol/server";
import type { CodemodeLimits } from "../codemode/budget";
import { APPROVAL_TTL_MS } from "../approvals/mutation-approvals";
import { buildCoverageManifest, coverageSummary } from "../registry/coverage";
import { API_DOC_NAMES } from "../registry/doc-endpoints";
import { buildOpenApiDocument } from "../registry/openapi";
import { listExposedOperations } from "../registry/operations";
import { sanitizeDocMarkdown } from "../observability/redact";
import { VIEWS, viewResourceUri } from "../widgets/contract";

/** Sanitized API docs served under qasir://docs/{document}. */
export const DOC_NAMES: readonly string[] = API_DOC_NAMES;

const DOC_SET = new Set<string>(DOC_NAMES);
const PROTOCOL_VERSION = "2026-07-28";

export interface CapabilitiesInfo {
  /** Tool names actually registered on this server instance. */
  tools: string[];
  mutationsEnabled: boolean;
  limits: CodemodeLimits;
  /** Whether the MCP App widget tools and ui:// views are registered (ENABLE_WIDGETS). */
  widgetsEnabled: boolean;
}

function docUri(name: string): string {
  return `qasir://docs/${name}`;
}

function jsonContents(uri: string, value: unknown) {
  return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(value, null, 2) }] };
}

export function registerResources(
  server: McpServer,
  options: {
    merchantSlug: string;
    readDoc: (name: string) => Promise<string | null>;
    capabilities: CapabilitiesInfo;
  },
): void {
  server.registerResource(
    "docs-index",
    "qasir://docs/index",
    { title: "Qasir API docs index", description: "Index of the sanitized Qasir API documents", mimeType: "application/json" },
    async (uri) =>
      jsonContents(uri.href, {
        documents: DOC_NAMES.map((name) => ({ name, uri: docUri(name) })),
      }),
  );

  server.registerResource(
    "docs",
    new ResourceTemplate("qasir://docs/{document}", {
      list: async () => ({
        resources: DOC_NAMES.map((name) => ({ uri: docUri(name), name, mimeType: "text/markdown" })),
      }),
    }),
    { title: "Qasir API document", description: "One sanitized Qasir API document (see qasir://docs/index)", mimeType: "text/markdown" },
    async (uri, variables) => {
      const name = variables.document;
      if (typeof name !== "string" || !DOC_SET.has(name)) throw new ResourceNotFoundError(uri.href);
      const raw = await options.readDoc(name);
      if (raw === null) throw new ResourceNotFoundError(uri.href);
      return { contents: [{ uri: docUri(name), mimeType: "text/markdown", text: sanitizeDocMarkdown(raw) }] };
    },
  );

  server.registerResource(
    "openapi",
    "qasir://openapi",
    { title: "Qasir OpenAPI 3.1", description: "Sanitized OpenAPI 3.1 document generated from the operation registry", mimeType: "application/json" },
    async (uri) => jsonContents(uri.href, buildOpenApiDocument(options.merchantSlug)),
  );

  server.registerResource(
    "capabilities",
    "qasir://capabilities",
    { title: "Server capabilities", description: "Tools registered for this caller, mutation policy and Code Mode limits", mimeType: "application/json" },
    async (uri) => jsonContents(uri.href, capabilitiesPayload(options.capabilities)),
  );

  server.registerResource(
    "coverage",
    "qasir://coverage",
    { title: "API coverage manifest", description: "Coverage status of every documented Qasir endpoint", mimeType: "application/json" },
    async (uri) => jsonContents(uri.href, { summary: coverageSummary(), entries: buildCoverageManifest() }),
  );
}

function capabilitiesPayload(info: CapabilitiesInfo): Record<string, unknown> {
  const ops = listExposedOperations();
  const count = (safety: string) => ops.filter((o) => o.safety === safety).length;
  return {
    protocol: PROTOCOL_VERSION,
    tools: info.tools,
    progressiveDiscovery: true,
    operations: { exposed: ops.length, read: count("read"), write: count("write"), destructive: count("destructive") },
    mutations: {
      enabled: info.mutationsEnabled,
      toolAvailable: info.tools.includes("execute_mutation"),
      approval: `Owner approves each call in the browser; single use, bound to operation + arguments, expires after ${Math.round(APPROVAL_TTL_MS / 60_000)} minutes`,
    },
    codeMode: {
      timeoutMs: info.limits.timeoutMs,
      maxRequests: info.limits.maxRequests,
      maxConcurrency: info.limits.maxConcurrency,
      maxResponseChars: info.limits.maxResponseChars,
      maxOutputChars: info.limits.maxOutputTokens * 4,
      network: "none except codemode.request() by operationId",
    },
    widgets: {
      enabled: info.widgetsEnabled,
      views: info.widgetsEnabled ? [...VIEWS] : [],
      resourceUris: info.widgetsEnabled ? VIEWS.map(viewResourceUri) : [],
    },
  };
}
