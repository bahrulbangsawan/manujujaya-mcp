import type { McpServer } from "@modelcontextprotocol/server";
import { buildCoverageManifest, coverageSummary } from "../registry/coverage";
import { buildOpenApiDocument } from "../registry/openapi";
import { listExposedOperations } from "../registry/operations";
import { sanitizeDocMarkdown } from "../observability/redact";

const DOC_NAMES = [
  "auth-login",
  "customers",
  "inventories-stock-histories",
  "order-histories-installment",
  "order-histories-legacy",
  "order-histories-web",
  "products",
  "purchases",
  "reports",
  "routes",
  "stock-adjustment",
  "suppliers",
  "users",
] as const;

export function registerResources(
  server: McpServer,
  options: {
    merchantSlug: string;
    readDoc: (name: string) => Promise<string | null>;
  },
): void {
  server.registerResource(
    "docs-index",
    "qasir://docs/index",
    {
      description: "Index of sanitized Qasir API docs",
      mimeType: "application/json",
    },
    async (_uri) => ({
      contents: [
        {
          uri: "qasir://docs/index",
          mimeType: "application/json",
          text: JSON.stringify(
            {
              documents: DOC_NAMES.map((d) => ({
                name: d,
                uri: `qasir://docs/${d}`,
              })),
            },
            null,
            2,
          ),
        },
      ],
    }),
  );

  for (const name of DOC_NAMES) {
    server.registerResource(
      `doc-${name}`,
      `qasir://docs/${name}`,
      {
        description: `Sanitized ${name}.md`,
        mimeType: "text/markdown",
      },
      async (_uri) => {
        const raw = (await options.readDoc(name)) ?? `# ${name}\n\n(not bundled)`;
        return {
          contents: [
            {
              uri: `qasir://docs/${name}`,
              mimeType: "text/markdown",
              text: sanitizeDocMarkdown(raw),
            },
          ],
        };
      },
    );
  }

  server.registerResource(
    "openapi",
    "qasir://openapi",
    {
      description: "Sanitized OpenAPI 3.1 generated from registry",
      mimeType: "application/json",
    },
    async (_uri) => ({
      contents: [
        {
          uri: "qasir://openapi",
          mimeType: "application/json",
          text: JSON.stringify(buildOpenApiDocument(options.merchantSlug), null, 2),
        },
      ],
    }),
  );

  server.registerResource(
    "capabilities",
    "qasir://capabilities",
    {
      description: "Server capabilities and tool overview",
      mimeType: "application/json",
    },
    async (_uri) => ({
      contents: [
        {
          uri: "qasir://capabilities",
          mimeType: "application/json",
          text: JSON.stringify(
            {
              protocol: "2026-07-28",
              tools: ["search", "execute", "execute_mutation"],
              operations: listExposedOperations().length,
              mutationsDefault: false,
              progressiveDiscovery: true,
            },
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerResource(
    "coverage",
    "qasir://coverage",
    {
      description: "API coverage manifest",
      mimeType: "application/json",
    },
    async (_uri) => ({
      contents: [
        {
          uri: "qasir://coverage",
          mimeType: "application/json",
          text: JSON.stringify(
            { summary: coverageSummary(), entries: buildCoverageManifest() },
            null,
            2,
          ),
        },
      ],
    }),
  );
}
