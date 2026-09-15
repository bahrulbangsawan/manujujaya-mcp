import type { McpServer } from "@modelcontextprotocol/server";
import { APP_TOOL, VIEW_TOOL, VIEWS } from "../contract";
import { DEBT_TOOLS } from "./debts";
import { registerWidgetTool, type AnyWidgetToolDef, type WidgetToolDeps } from "./define";
import { PURCHASE_TOOLS } from "./purchases";
import { SALES_TOOLS } from "./sales";
import { STOCK_TOOLS } from "./stock";
import { TRANSACTION_TOOLS } from "./transactions";

const BY_NAME = new Map<string, AnyWidgetToolDef>(
  [...SALES_TOOLS, ...STOCK_TOOLS, ...PURCHASE_TOOLS, ...TRANSACTION_TOOLS, ...DEBT_TOOLS].map((def) => [def.name, def]),
);

/** Every widget tool: the six view tools in VIEWS order, then the app-only tools in APP_TOOL order. */
export const ALL_WIDGET_TOOLS: readonly AnyWidgetToolDef[] = [
  ...VIEWS.map((view) => VIEW_TOOL[view]),
  ...Object.values(APP_TOOL),
].map((name) => {
  const def = BY_NAME.get(name);
  if (!def) throw new Error(`Widget tool ${name} has no definition`);
  return def;
});

/** Register all widget tools on `server`; returns their names in registration order. */
export function registerWidgetTools(server: McpServer, deps: WidgetToolDeps): string[] {
  for (const def of ALL_WIDGET_TOOLS) registerWidgetTool(server, deps, def);
  return ALL_WIDGET_TOOLS.map((def) => def.name);
}
