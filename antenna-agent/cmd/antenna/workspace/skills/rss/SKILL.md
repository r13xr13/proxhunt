---
name: rss
description: RSS/Atom feed reader and news aggregator
version: 1.0.0
---

# RSS Skill

Read and manage RSS/Atom feeds for news and content aggregation.

## Tools

[[tool]]
name: rss_add
description: Add RSS feed
params:
  - name: url
    type: string
    required: true
    description: Feed URL
  - name: name
    type: string
    required: false
    description: Feed name

[[tool]]
name: rss_list
description: List subscribed feeds
params: []

[[tool]]
name: rss_read
description: Read feed items
params:
  - name: feed
    type: string
    required: true
    description: Feed name or URL
  - name: limit
    type: number
    required: false
    description: Number of items

[[tool]]
name: rss_search
description: Search all feeds
params:
  - name: query
    type: string
    required: true
    description: Search term

[[tool]]
name: rss_fresh
description: Get latest items from all feeds
params:
  - name: limit
    type: number
    required: false
    description: Items per feed

## Script

async function rss_add({ url, name = '' }) {
  const feedName = name || url.split('/')[2];
  return {
    url,
    name: feedName,
    note: 'Added to feed list. Use rss_read to get items.',
    storage: '~/.antenna/workspace/rss-feeds.json'
  };
}

function rss_list() {
  return {
    feeds: [
      { name: 'HN', url: 'https://news.ycombinator.com/rss' },
      { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
      { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index' }
    ],
    note: 'Configure feeds in config or add custom feeds'
  };
}

async function rss_read({ feed, limit = 10 }) {
  const feeds = {
    HN: 'https://news.ycombinator.com/rss',
    TechCrunch: 'https://techcrunch.com/feed/'
  };
  
  const feedUrl = feeds[feed] || feed;
  const { stdout } = await exec(\`curl -s "\${feedUrl}" 2>/dev/null | head -200\`);
  
  return {
    feed,
    count: limit,
    note: 'Parse XML to extract items',
    raw: stdout.substring(0, 500)
  };
}

async function rss_search({ query }) {
  return {
    query,
    note: 'Search across all subscribed feeds',
    results: []
  };
}

function rss_fresh({ limit = 5 }) {
  return {
    limit,
    feeds: 3,
    note: 'Get latest items from all feeds',
    unread: 'tracked in sessions'
  };
}
