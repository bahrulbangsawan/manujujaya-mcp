# Copyable MCP install prompts

Replace `MCP_URL` and `MCP_TOKEN` before pasting.

Default local values:

```text
MCP_URL=http://127.0.0.1:8787/mcp
MCP_TOKEN=<DEV_PSK from .dev.vars>
```

See the main [README](../README.md) for full install paths per client.

## Universal

```text
Install the remote MCP server "manujujaya" for me.

- Transport: Streamable HTTP (MCP)
- URL: MCP_URL
- Auth header: Authorization: Bearer MCP_TOKEN
- Server name: manujujaya

This wraps unofficial Qasir dashboard APIs for Bengkel Manuju Jaya (merchant slug bengkel-manuju-jaya-621095). Tools: search, execute, execute_mutation (mutations off by default). After connecting, call search to list product-related operationIds, then execute products.list with page=1 count=5. Do not ask me for the Qasir PIN; session is provisioned via the Worker /connect UI or host secrets.
```

## Claude Code

```text
Add this remote MCP server to Claude Code (user scope):

claude mcp add --transport http manujujaya \
  --header "Authorization: Bearer MCP_TOKEN" \
  MCP_URL

Then run `claude mcp list` and `/mcp` to confirm Connected. Afterwards, use tool `search` to find products operations and `execute` with operationId products.list (page 1, count 5).
```

## Codex / ChatGPT desktop

```text
Configure Codex MCP for manujujaya:

1) export MANUJUJAYA_MCP_TOKEN='MCP_TOKEN'
2) codex mcp add manujujaya --url MCP_URL
3) In ~/.codex/config.toml set:

[mcp_servers.manujujaya]
url = "MCP_URL"
bearer_token_env_var = "MANUJUJAYA_MCP_TOKEN"

4) Restart ChatGPT desktop / Codex if needed, then `/mcp` and verify manujujaya is enabled.
```

## Claude Desktop

```text
Edit claude_desktop_config.json (macOS: ~/Library/Application Support/Claude/claude_desktop_config.json) and merge:

{
  "mcpServers": {
    "manujujaya": {
      "type": "http",
      "url": "MCP_URL",
      "headers": {
        "Authorization": "Bearer MCP_TOKEN"
      }
    }
  }
}

Fully quit and reopen Claude Desktop, then confirm the manujujaya MCP tools appear.
```

## Cursor

```text
Add an MCP server named manujujaya in Cursor:

URL: MCP_URL
Headers: Authorization: Bearer MCP_TOKEN
Transport: HTTP / Streamable HTTP

Reload MCP servers, then list tools (search, execute, execute_mutation).
```

## VS Code Copilot

```text
Create or update .vscode/mcp.json with root key "servers" (not mcpServers):

{
  "servers": {
    "manujujaya": {
      "type": "http",
      "url": "MCP_URL",
      "headers": {
        "Authorization": "Bearer MCP_TOKEN"
      }
    }
  }
}

Reload the window and confirm Copilot can see the manujujaya tools.
```
