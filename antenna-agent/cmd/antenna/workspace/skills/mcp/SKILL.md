---
name: mcp
description: Connect to MCP (Model Context Protocol) servers for external tools
version: 1.0.0
---

# MCP Skill

Connect to MCP servers to extend Antenna's capabilities.

## Setup

Add MCP servers in config or use built-in ones.

## Tools

[[tool]]
name: mcp_list
description: List available MCP servers
params: []

[[tool]]
name: mcp_servers
description: List configured MCP servers
params: []

[[tool]]
name: mcp_tools
description: List tools available from MCP servers
params:
  - name: server
    type: string
    required: false
    description: Server name (optional, lists all if not specified)

[[tool]]
name: mcp_call
description: Call an MCP tool
params:
  - name: server
    type: string
    required: true
    description: Server name
  - name: tool
    type: string
    required: true
    description: Tool name
  - name: args
    type: object
    required: false
    description: Tool arguments

## Script

const MCP_SERVERS = {
  "filesystem": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
    "description": "File system operations"
  },
  "brave-search": {
    "command": "npx", 
    "args": ["-y", "@modelcontextprotocol/server-brave-search"],
    "description": "Web search",
    "env": { "BRAVE_API_KEY": "" }
  },
  "github": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-github"],
    "description": "GitHub API",
    "env": { "GITHUB_TOKEN": "" }
  }
};

async function mcp_servers() {
  return { 
    servers: Object.entries(MCP_SERVERS).map(([name, config]) => ({
      name,
      description: config.description,
      command: config.command,
      args: config.args
    }))
  };
}

async function mcp_list() {
  return { 
    note: "MCP servers run as separate processes",
    setup: "Configure in config.json or start manually"
  };
}

async function mcp_tools({ server = "" }) {
  return {
    note: "MCP tools loaded dynamically",
    server,
    docs: "See https://modelcontextprotocol.io"
  };
}

async function mcp_call({ server, tool, args = {} }) {
  return {
    error: "MCP requires server process running",
    server,
    tool,
    note: "Start MCP server manually or configure in antenna"
  };
}
