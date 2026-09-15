import type { McpServer } from "@modelcontextprotocol/server";
import { MCP_APP_MIME_TYPE, VIEW_MARKER, VIEWS, viewResourceUri, type ViewName } from "./contract";

/** Hosts may reuse a view's HTML for this long; the HTML holds no data, only the SPA. */
export const WIDGET_RESOURCE_TTL_MS = 600_000;

const VIEW_RESOURCE_LABEL: Record<ViewName, string> = {
  penjualan: "Penjualan",
  produk: "Produk",
  stok: "Stok",
  pembelian: "Pembelian",
  transaksi: "Transaksi",
  piutang: "Piutang",
};

/** The SPA HTML with its `data-view` marker set to `view`. */
export function renderViewHtml(html: string, view: ViewName): string {
  return html.replaceAll(VIEW_MARKER, view);
}

/**
 * Six static ui:// resources sharing one HTML string. Rendering happens at read
 * time so the per-request server factory never copies the bundle six times.
 */
export function registerWidgetResources(server: McpServer, html: string): void {
  for (const view of VIEWS) {
    const uri = viewResourceUri(view);
    server.registerResource(
      `view-${view}`,
      uri,
      {
        title: `Tampilan ${VIEW_RESOURCE_LABEL[view]}`,
        description: `Interactive ${VIEW_RESOURCE_LABEL[view]} view (MCP App) for the manujujaya widget tools`,
        mimeType: MCP_APP_MIME_TYPE,
        _meta: { ui: { prefersBorder: true } },
      },
      async () => ({
        contents: [{ uri, mimeType: MCP_APP_MIME_TYPE, text: renderViewHtml(html, view), _meta: { ui: { prefersBorder: true } } }],
        ttlMs: WIDGET_RESOURCE_TTL_MS,
      }),
    );
  }
}
