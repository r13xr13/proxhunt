---
name: searxng
description: Privacy-respecting search using SearXNG instances
version: 1.0.0
---

# SearXNG Skill

Private web search using SearXNG metasearch engine.

## Tools

[[tool]]
name: searx_search
description: Private web search
params:
  - name: query
    type: string
    required: true
    description: Search query
  - name: engines
    type: string
    required: false
    description: Search engines to use
  - name: limit
    type: number
    required: false
    description: Number of results

[[tool]]
name: searxng_instances
description: List public SearXNG instances
params: []

[[tool]]
name: searx_images
description: Search for images privately
params:
  - name: query
    type: string
    required: true
    description: Image search query
  - name: limit
    type: number
    required: false
    description: Number of results

[[tool]]
name: searx_news
description: Search news privately
params:
  - name: query
    type: string
    required: true
    description: News search query

## Script

async function searx_search({ query, engines = '', limit = 10 }) {
  const instances = [
    'https://searx.be',
    'https://search.buscher.me',
    'https://searx.ninja'
  ];
  
  const { stdout } = await exec(\`curl -s "\${instances[0]}/search?q=\${encodeURIComponent(query)}&format=json" 2>/dev/null\`);
  
  try {
    const data = JSON.parse(stdout);
    const results = (data.results || []).slice(0, limit).map(r => ({
      title: r.title,
      url: r.url,
      snippet: r.content?.substring(0, 150)
    }));
    
    return {
      query,
      count: results.length,
      results,
      instance: instances[0]
    };
  } catch {
    return {
      query,
      error: 'Search failed',
      instances
    };
  }
}

function searxng_instances() {
  return {
    instances: [
      { url: 'https://searx.be', country: 'BE', maintained: true },
      { url: 'https://search.buscher.me', country: 'DE', maintained: true },
      { url: 'https://searx.ninja', country: 'US', maintained: true },
      { url: 'https://searx.org', country: 'US', maintained: false },
      { url: 'https://privasea.ion', country: 'US', maintained: true }
    ],
    note: 'Self-host your own: searxng.github.io/searxng'
  };
}

async function searx_images({ query, limit = 10 }) {
  const { stdout } = await exec(\`curl -s "https://searx.be/search?q=\${encodeURIComponent(query)}&format=json&categories=images" 2>/dev/null\`);
  
  try {
    const data = JSON.parse(stdout);
    const results = (data.results || []).slice(0, limit).map(r => ({
      title: r.title,
      image: r.img_src,
      url: r.url
    }));
    
    return { query, count: results.length, results };
  } catch {
    return { query, error: 'Image search failed' };
  }
}

async function searx_news({ query }) {
  const { stdout } = await exec(\`curl -s "https://searx.be/search?q=\${encodeURIComponent(query)}&format=json&categories=news" 2>/dev/null\`);
  
  try {
    const data = JSON.parse(stdout);
    const results = (data.results || []).slice(0, 10).map(r => ({
      title: r.title,
      url: r.url,
      published: r.pubdate
    }));
    
    return { query, count: results.length, results };
  } catch {
    return { query, error: 'News search failed' };
  }
}
