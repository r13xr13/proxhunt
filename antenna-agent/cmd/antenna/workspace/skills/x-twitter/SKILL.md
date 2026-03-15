---
name: x-twitter
description: X/Twitter management - tweets, timeline, likes, and searches
version: 1.0.0
---

# X (Twitter) Skill

Manage X/Twitter posts, timeline, and interactions.

## Tools

[[tool]]
name: x_timeline
description: Get home timeline
params:
  - name: limit
    type: number
    required: false
    description: Number of tweets

[[tool]]
name: x_tweet
description: Post a tweet
params:
  - name: text
    type: string
    required: true
    description: Tweet text
  - name: reply_to
    type: string
    required: false
    description: Tweet ID to reply to

[[tool]]
name: x_search
description: Search tweets
params:
  - name: query
    type: string
    required: true
    description: Search query
  - name: limit
    type: number
    required: false
    description: Number of results

[[tool]]
name: x_like
description: Like a tweet
params:
  - name: tweet_id
    type: string
    required: true
    description: Tweet ID

[[tool]]
name: x_retweet
description: Retweet
params:
  - name: tweet_id
    type: string
    required: true
    description: Tweet ID

[[tool]]
name: x_follow
description: Follow a user
params:
  - name: username
    type: string
    required: true
    description: Username to follow

[[tool]]
name: x_trending
description: Get trending topics
params:
  - name: location
    type: string
    required: false
    description: Location (worldwide, us, etc)

## Script

function x_timeline({ limit = 20 }) {
  return {
    limit,
    note: 'Requires X API. Configure in ~/.antenna/config.json',
    config: {
      twitter: {
        api_key: 'YOUR_API_KEY',
        api_secret: 'YOUR_API_SECRET',
        access_token: 'YOUR_ACCESS_TOKEN',
        access_secret: 'YOUR_ACCESS_SECRET'
      }
    }
  };
}

function x_tweet({ text, reply_to = '' }) {
  return {
    text,
    reply_to,
    note: 'Post tweet via X API',
    char_limit: 280
  };
}

function x_search({ query, limit = 20 }) {
  return {
    query,
    limit,
    note: 'Search tweets via X API',
    results: []
  };
}

function x_like({ tweet_id }) {
  return {
    tweet_id,
    action: 'like',
    note: 'Like a tweet'
  };
}

function x_retweet({ tweet_id }) {
  return {
    tweet_id,
    action: 'retweet',
    note: 'Retweet a post'
  };
}

function x_follow({ username }) {
  return {
    username,
    action: 'follow',
    note: 'Follow a user'
  };
}

function x_trending({ location = 'worldwide' }) {
  return {
    location,
    note: 'Get trending topics',
    trends: []
  };
}
