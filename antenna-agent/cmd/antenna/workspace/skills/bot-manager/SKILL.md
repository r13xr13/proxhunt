---
name: bot-manager
description: Manage automated bots for social media activity
version: 1.0.0
---

# Bot Manager Skill

Manage automated bots to create activity on Antenna social network.

## Tools

[[tool]]
name: bot_create
description: Create a new bot
params:
  - name: name
    type: string
    required: true
    description: Bot name
  - name: platform
    type: string
    required: true
    description: Platform (twitter, reddit, telegram, chat)
  - name: behavior
    type: string
    required: false
    description: Bot behavior profile

[[tool]]
name: bot_start
description: Start a bot
params:
  - name: name
    type: string
    required: true
    description: Bot name

[[tool]]
name: bot_stop
description: Stop a bot
params:
  - name: name
    type: string
    required: true
    description: Bot name

[[tool]]
name: bot_list
description: List all bots
params: []

[[tool]]
name: bot_activity
description: Simulate activity
params:
  - name: type
    type: string
    required: true
    description: Type (post, comment, like, share)
  - name: content
    type: string
    required: true
    description: Content to post

[[tool]]
name: bot_spawn
description: Spawn multiple bots for activity
params:
  - name: count
    type: number
    required: true
    description: Number of bots
  - name: platform
    type: string
    required: true
    description: Platform

## Script

function bot_create({ name, platform, behavior = 'auto' }) {
  const profiles = {
    promoter: {
      posts: ['Check out Antenna!', 'Decentralized AI is the future', 'Build with Antenna'],
      hashtags: ['#AI', '#Web3', '#OpenSource']
    },
    developer: {
      posts: ['Just built something cool', 'Code is poetry', 'Shipped it!'],
      hashtags: ['#coding', '#dev', '#build']
    },
    news: {
      posts: ['Breaking: ', 'Update: ', 'New release: '],
      hashtags: ['#news', '#tech', '#innovation']
    },
    auto: {
      posts: ['Hello world!', 'Having a great day!', 'Working on something cool'],
      hashtags: ['#antenna', '#ai']
    }
  };
  
  return {
    name,
    platform,
    behavior,
    profile: profiles[behavior] || profiles.auto,
    status: 'created',
    note: 'Use bot_start to activate'
  };
}

function bot_start({ name }) {
  return {
    name,
    status: 'running',
    action: 'bot started',
    message: \`\${name} is now posting content\`
  };
}

function bot_stop({ name }) {
  return {
    name,
    status: 'stopped',
    action: 'bot stopped'
  };
}

function bot_list() {
  return {
    bots: [
      { name: 'promoter-bot', platform: 'twitter', status: 'running', posts: 42 },
      { name: 'dev-bot', platform: 'chat', status: 'running', posts: 15 },
      { name: 'news-bot', platform: 'reddit', status: 'stopped', posts: 0 }
    ],
    total: 3,
    running: 2
  };
}

function bot_activity({ type, content }) {
  const actions = {
    post: 'Posting: ' + content,
    comment: 'Commenting: ' + content,
    like: 'Liked content',
    share: 'Shared: ' + content
  };
  
  return {
    type,
    content,
    action: actions[type] || 'Unknown action',
    timestamp: new Date().toISOString(),
    status: 'success'
  };
}

function bot_spawn({ count, platform }) {
  const names = [];
  for (let i = 0; i < count; i++) {
    names.push(\`\${platform}-bot-\${i + 1}\`);
  }
  
  return {
    count,
    platform,
    bots: names,
    status: 'spawned',
    note: \`Created \${count} bots for \${platform}\`
  };
}
