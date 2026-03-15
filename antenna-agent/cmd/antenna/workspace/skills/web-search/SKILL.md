---
name: web-search
description: Search the web for information
version: 1.0.0
---

# Web Search Skill

Search the web for current information, news, and answers.

## Tools

[[tool]]
name: web_search
description: Search the web for information
params:
  - name: query
    type: string
    required: true
    description: The search query
  - name: max_results
    type: number
    required: false
    description: Maximum number of results (default 5)

## Script

async function web_search({ query, max_results = 5 }) {
  const results = await fetch(\`https://ddg-api.herokuapp.com/search?q=\${encodeURIComponent(query)}&max_results=\${max_results}\`)
    .then(r => r.json());
  
  return {
    query,
    results: results.map(r => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet
    }))
  };
}
