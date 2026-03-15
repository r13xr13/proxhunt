---
name: docker-compose
description: Manage multi-container Docker applications
version: 1.0.0
---

# Docker Compose Skill

Manage Docker Compose applications for Antenna.

## Tools

[[tool]]
name: dc_up
description: Start compose services
params:
  - name: file
    type: string
    required: false
    description: Compose file path
  - name: services
    type: string
    required: false
    description: Specific services

[[tool]]
name: dc_down
description: Stop compose services
params:
  - name: file
    type: string
    required: false
    description: Compose file path

[[tool]]
name: dc_logs
description: View compose logs
params:
  - name: service
    type: string
    required: false
    description: Service name
  - name: lines
    type: number
    required: false
    description: Number of lines

[[tool]]
name: dc_ps
description: List compose services
params:
  - name: file
    type: string
    required: false
    description: Compose file path

[[tool]]
name: dc_build
description: Build compose services
params:
  - name: file
    type: string
    required: false
    description: Compose file path

[[tool]]
name: dc_full
description: Full stack up with bots
params: []

## Script

async function dc_up({ file = 'docker-compose.yml', services = '' }) {
  const args = services ? \`\${services}\` : '';
  const { stdout } = await exec(\`docker compose -f \${file} up -d \${args} 2>&1\`);
  
  return {
    file,
    services,
    status: 'started',
    output: stdout
  };
}

async function dc_down({ file = 'docker-compose.yml' }) {
  const { stdout } = await exec(\`docker compose -f \${file} down 2>&1\`);
  
  return {
    file,
    status: 'stopped',
    output: stdout
  };
}

async function dc_logs({ service = '', lines = 50 }) {
  const svc = service ? service : '';
  const { stdout } = await exec(\`docker compose logs --tail \${lines} \${svc} 2>&1\`);
  
  return {
    service: service || 'all',
    lines,
    logs: stdout.substring(0, 2000)
  };
}

async function dc_ps({ file = 'docker-compose.yml' }) {
  const { stdout } = await exec(\`docker compose -f \${file} ps 2>&1\`);
  
  return {
    file,
    services: stdout
  };
}

async function dc_build({ file = 'docker-compose.yml' }) {
  const { stdout } = await exec(\`docker compose -f \${file} build 2>&1\`);
  
  return {
    file,
    status: 'built',
    output: stdout.substring(0, 1000)
  };
}

async function dc_full() {
  const { stdout } = await exec(\`docker compose -f docker-compose.full.yml up -d 2>&1\`);
  
  return {
    file: 'docker-compose.full.yml',
    services: ['antenna-gateway', 'antenna-web', 'bot-twitter', 'bot-reddit', 'bot-chat', 'bot-news'],
    status: 'started',
    output: stdout
  };
}
