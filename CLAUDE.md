# manujujaya-mcp

Cloudflare Workers MCP server with interactive embedded BI widgets for Qasir merchants.

## Development Commands

- `bun test` or `bun run test`: Run backend unit and security tests
- `bun run check-types`: TypeScript verification across server, scripts, and widgets
- `bun run dev`: Start local development server via Wrangler
- `bun run widgets:dev`: Vite dev server for frontend widgets
- `bun run widgets:bundle`: Bundle widgets into single-file HTML for MCP resources
- `bun run coverage:validate`: Validate OpenAPI coverage against Qasir endpoints

## graphify

This project has a knowledge graph at `graphify-out/` with god nodes, community structure, and cross-file relationships.

Rules:
- **Always update graphify**: After modifying code or files in this project, always run `graphify update .` (or `graphify .`) to keep the knowledge graph current (AST-only, no API cost).
- **Before committing**: ALWAYS run `graphify update .` (or `graphify .`) first before creating any git commit. Ensure the latest graph artifacts in `graphify-out/` are updated and staged.
- **Codebase questions**: For codebase questions, first run `graphify query "<question>"` when `graphify-out/graph.json` exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- **Dirty graph artifacts**: Dirty `graphify-out/` files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- **Architecture & navigation**: If `graphify-out/wiki/index.md` exists, use it for broad navigation instead of raw source browsing. Read `graphify-out/GRAPH_REPORT.md` only for broad architecture review or when query/path/explain do not surface enough context.
