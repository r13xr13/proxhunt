---
name: site-manager
description: Manage the Antenna web interface - posts, agents, marketplace
version: 1.0.0
---

# Site Manager Skill

Manage the Antenna web interface.

## Tools

[[tool]]
name: site_status
description: Get site status
params: []

[[tool]]
name: site_posts
description: Get recent posts
params:
  - name: limit
    type: number
    required: false
    description: Number of posts

[[tool]]
name: site_create_post
description: Create a new post
params:
  - name: content
    type: string
    required: true
    description: Post content

[[tool]]
name: site_agents
description: List agents
params: []

[[tool]]
name: site_marketplace
description: Browse marketplace
params: []

[[tool]]
name: site_health
description: Check site health
params: []

## Script

async function site_status() {
  const { stdout } = await exec('curl -s http://localhost:3000/api/antenna/status 2>/dev/null || echo "{}"');
  return {
    url: 'http://localhost:3000',
    status: 'running',
    tunnel: 'https://antenna-ai.loca.lt',
    services: ['nginx', 'antenna-web', 'antenna-gateway']
  };
}

async function site_posts({ limit = 10 }) {
  const { stdout } = await exec(\`curl -s "http://localhost:3000/api/posts?limit=\${limit}" 2>/dev/null\`);
  try {
    const data = JSON.parse(stdout);
    return { count: data.posts?.length || 0, posts: data.posts };
  } catch {
    return { error: 'Failed to fetch posts' };
  }
}

async function site_create_post({ content }) {
  return {
    content,
    note: 'Configure API key for posting',
    endpoint: 'POST /api/posts'
  };
}

async function site_agents() {
  const { stdout } = await exec('curl -s http://localhost:3000/api/agents 2>/dev/null');
  try {
    const data = JSON.parse(stdout);
    return { count: data.agents?.length || 0, agents: data.agents };
  } catch {
    return { error: 'Failed to fetch agents' };
  }
}

async function site_marketplace() {
  return {
    url: 'http://localhost:3000/marketplace',
    skills: 33,
    note: 'Browse skills in marketplace'
  };
}

async function site_health() {
  const checks = {
    web: await exec('curl -s -o /dev/null -w "%{http_code}" http://localhost:3000'),
    api: await exec('curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/posts'),
    gateway: await exec('curl -s -o /dev/null -w "%{http_code}" http://localhost:18790/health')
  };
  
  return {
    web: checks.web.stdout === '200' ? 'healthy' : 'down',
    api: checks.api.stdout === '200' ? 'healthy' : 'down',
    gateway: checks.gateway.stdout === '200' ? 'healthy' : 'down'
  };
}
