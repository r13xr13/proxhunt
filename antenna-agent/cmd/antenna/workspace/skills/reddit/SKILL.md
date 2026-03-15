---
name: reddit
description: Reddit management - posts, comments, upvotes, and subreddit browsing
version: 1.0.0
---

# Reddit Skill

Manage Reddit posts, comments, and browse subreddits.

## Tools

[[tool]]
name: reddit_post
description: Post to Reddit (configured in config.json)
params:
  - name: subreddit
    type: string
    required: true
    description: Subreddit name (without r/)
  - name: title
    type: string
    required: true
    description: Post title
  - name: content
    type: string
    required: true
    description: Post content

[[tool]]
name: reddit_hot
description: Get hot posts from subreddit
params:
  - name: subreddit
    type: string
    required: true
    description: Subreddit name (without r/)
  - name: limit
    type: number
    required: false
    description: Number of posts

[[tool]]
name: reddit_search
description: Search Reddit
params:
  - name: query
    type: string
    required: true
    description: Search query
  - name: subreddit
    type: string
    required: false
    description: Limit to subreddit

[[tool]]
name: reddit_subreddits
description: Get suggested subreddits for promotion
params: []
  - name: content
    type: string
    required: true
    description: Post content
  - name: nsfw
    type: boolean
    required: false
    description: Mark as NSFW

[[tool]]
name: reddit_comment
description: Comment on a post
params:
  - name: post_id
    type: string
    required: true
    description: Post ID
  - name: comment
    type: string
    required: true
    description: Comment text

[[tool]]
name: reddit_upvote
description: Upvote/downvote a post
params:
  - name: post_id
    type: string
    required: true
    description: Post ID
  - name: direction
    type: string
    required: true
    description: up, down, or neutral

## Script

async function reddit_post({ subreddit, title, content }) {
  const configPath = '~/.antenna/config.json';
  const { stdout: configExists } = await exec(\`test -f \${configPath} && echo "yes"\`);
  
  if (!configExists.includes('yes')) {
    return { error: 'No config found. Configure Reddit OAuth in ~/.antenna/config.json' };
  }
  
  return {
    subreddit: 'r/' + subreddit,
    title,
    content,
    note: 'Configure Reddit OAuth for automated posting',
    config: {
      reddit: {
        client_id: 'YOUR_REDDIT_CLIENT_ID',
        client_secret: 'YOUR_REDDIT_CLIENT_SECRET',
        username: 'YOUR_REDDIT_USERNAME',
        password: 'YOUR_REDDIT_PASSWORD'
      }
    },
    subreddits_for_promotion: [
      'r/ArtificialIntelligence',
      'r/selfhosted',
      'r/Web3',
      'r/Monero',
      'r/programming',
      'r/opensource'
    ]
  };
}

async function reddit_subreddits() {
  return {
    suggested: [
      { name: 'r/ArtificialIntelligence', members: '15M', description: 'AI discussions' },
      { name: 'r/selfhosted', members: '800K', description: 'Self-hosted software' },
      { name: 'r/Web3', members: '500K', description: 'Decentralized tech' },
      { name: 'r/Monero', members: '300K', description: 'Privacy cryptocurrency' },
      { name: 'r/programming', members: '8M', description: 'Programming' },
      { name: 'r/opensource', members: '200K', description: 'Open source' }
    ]
  };
}

async function reddit_hot({ subreddit, limit = 10 }) {
  const { stdout } = await exec(\`curl -s "https://www.reddit.com/r/\${subreddit}/hot.json?limit=\${limit}" \\
    -H "User-Agent: Antenna/1.0" 2>/dev/null\`);
  
  try {
    const data = JSON.parse(stdout);
    const posts = data.data.children.map(c => ({
      title: c.data.title,
      score: c.data.score,
      author: c.data.author,
      url: 'https://reddit.com' + c.data.permalink,
      comments: c.data.num_comments
    }));
    
    return { subreddit, count: posts.length, posts };
  } catch {
    return { error: 'Failed to fetch posts', subreddit };
  }
}

async function reddit_search({ query, subreddit = '' }) {
  const sub = subreddit ? \`r/\${subreddit}/\` : '';
  const { stdout } = await exec(\`curl -s "https://www.reddit.com/\${sub}search.json?q=\${encodeURIComponent(query)}&limit=10" \\
    -H "User-Agent: Antenna/1.0" 2>/dev/null\`);
  
  try {
    const data = JSON.parse(stdout);
    const results = data.data.children.map(c => ({
      title: c.data.title,
      subreddit: c.data.subreddit,
      score: c.data.score,
      url: 'https://reddit.com' + c.data.permalink
    }));
    
    return { query, count: results.length, results };
  } catch {
    return { error: 'Search failed' };
  }
}

function reddit_post({ subreddit, title, content, nsfw = false }) {
  return {
    subreddit,
    title,
    content,
    nsfw,
    note: 'Requires Reddit OAuth. Configure in ~/.antenna/config.json',
    config: {
      reddit: {
        client_id: 'YOUR_CLIENT_ID',
        client_secret: 'YOUR_CLIENT_SECRET',
        username: 'YOUR_USERNAME',
        password: 'YOUR_PASSWORD'
      }
    }
  };
}

function reddit_comment({ post_id, comment }) {
  return {
    post_id,
    comment,
    note: 'Requires Reddit OAuth authentication'
  };
}

function reddit_upvote({ post_id, direction }) {
  return {
    post_id,
    direction,
    note: 'Vote on Reddit posts'
  };
}
