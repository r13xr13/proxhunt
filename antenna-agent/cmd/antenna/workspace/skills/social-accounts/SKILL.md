---
name: social-accounts
description: Create and manage social media accounts for Antenna promotion
version: 1.0.0
---

# Social Accounts Skill

Manage social media accounts to promote Antenna.

## Tools

[[tool]]
name: social_setup
description: Set up social media accounts
params:
  - name: platform
    type: string
    required: true
    description: Platform (twitter, reddit, telegram)
  - name: username
    type: string
    required: true
    description: Desired username

[[tool]]
name: social_post
description: Post to social media
params:
  - name: platform
    type: string
    required: true
    description: Platform to post
  - name: content
    type: string
    required: true
    description: Post content
  - name: schedule
    type: string
    required: false
    description: Schedule time (ISO)

[[tool]]
name: social_automate
description: Automate posting
params:
  - name: platform
    type: string
    required: true
    description: Platform to automate
  - name: interval_hours
    type: number
    required: false
    description: Hours between posts

[[tool]]
name: social_analytics
description: Get analytics
params:
  - name: platform
    type: string
    required: true
    description: Platform to check

[[tool]]
name: social_trending
description: Find trending topics
params:
  - name: platform
    type: string
    required: true
    description: Platform
  - name: keyword
    type: string
    required: false
    description: Related keyword

## Script

function social_setup({ platform, username }) {
  const accounts = {
    twitter: {
      site: 'https://twitter.com/i/flow/signup',
      name: 'X/Twitter',
      tips: ['Use @antenna_ai or similar']
    },
    reddit: {
      site: 'https://reddit.com/register',
      name: 'Reddit',
      tips: ['r/ArtificialIntelligence', 'r/decentralized', 'r/selfhosted']
    },
    telegram: {
      site: 'https://t.me/BotFather',
      name: 'Telegram',
      tips: ['Create bot via BotFather']
    },
    github: {
      site: 'https://github.com/signup',
      name: 'GitHub',
      tips: ['Already: r13xr13/antenna']
    }
  };
  
  const acc = accounts[platform] || {};
  
  return {
    platform,
    username,
    signup_url: acc.site,
    tips: acc.tips || [],
    note: \`Create \${acc.name} account manually, then configure API keys\`
  };
}

function social_post({ platform, content, schedule = '' }) {
  return {
    platform,
    content,
    scheduled: schedule,
    note: 'Configure API keys for automated posting',
    content_example: '🚀 Check out Antenna - the decentralized AI assistant! #AI #Web3 #OpenSource'
  };
}

function social_automate({ platform, interval_hours = 24 }) {
  return {
    platform,
    interval_hours,
    note: 'Set up automated posting schedule',
    posts: [
      'Feature highlight',
      'Tutorial thread',
      'Community spotlight',
      'GitHub star milestone'
    ]
  };
}

function social_analytics({ platform }) {
  return {
    platform,
    metrics: ['followers', 'impressions', 'engagement', 'clicks'],
    note: 'Connect API for analytics'
  };
}

function social_trending({ platform, keyword = 'AI' }) {
  return {
    platform,
    keyword,
    hashtags: ['#AI', '#Web3', '#OpenSource', '#Decentralized'],
    note: 'Use trending topics for visibility'
  };
}
