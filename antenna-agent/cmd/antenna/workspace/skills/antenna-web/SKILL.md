---
name: antenna-web
description: Manage Antenna web interface - dashboard, marketplace, API docs
version: 1.0.0
---

# Antenna Web Skill

Manage and configure the Antenna web interface.

## Tools

[[tool]]
name: web_status
description: Check web interface status
params: []

[[tool]]
name: web_dashboard
description: Access dashboard
params: []

[[tool]]
name: web_marketplace
description: Access marketplace
params: []

[[tool]]
name: web_api_docs
description: API documentation
params: []

[[tool]]
name: web_config
description: Configure web settings
params:
  - name: theme
    type: string
    required: false
    description: Theme (light, dark, auto)
  - name: port
    type: number
    required: false
    description: Port number

[[tool]]
name: web_start
description: Start web interface
params: []

[[tool]]
name: web_stop
description: Stop web interface
params: []

## Script

function web_status() {
  return {
    status: 'running',
    port: 3000,
    endpoints: [
      'http://localhost:3000',
      'http://localhost:3000/dashboard',
      'http://localhost:3000/marketplace',
      'http://localhost:3000/docs'
    ]
  };
}

function web_dashboard() {
  return {
    url: 'http://localhost:3000/dashboard',
    features: [
      'Agent status',
      'P2P network stats',
      'Wallet balance',
      'Channel management',
      'Skill usage'
    ]
  };
}

function web_marketplace() {
  return {
    url: 'http://localhost:3000/marketplace',
    features: [
      'Browse skills',
      'Browse agents',
      'Install packages',
      'Publish skills'
    ]
  };
}

function web_api_docs() {
  return {
    url: 'http://localhost:3000/docs',
    endpoints: [
      'POST /agent/chat',
      'GET /agent/status',
      'POST /skills/install',
      'GET /wallet/balance'
    ]
  };
}

function web_config({ theme = 'dark', port = 3000 }) {
  return {
    theme,
    port,
    note: 'Configure in antenna-web/.env',
    settings: {
      NEXT_PUBLIC_API_URL: 'http://localhost:18790',
      NEXT_PUBLIC_WS_URL: 'ws://localhost:18790'
    }
  };
}

function web_start() {
  return {
    command: 'cd antenna-web && npm run dev',
    port: 3000,
    note: 'Start Next.js web interface'
  };
}

function web_stop() {
  return {
    command: 'pkill -f "next dev"',
    note: 'Stop web interface'
  };
}
