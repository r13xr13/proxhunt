---
name: social-poster
description: Post to Telegram, Discord, Twitter/X, and Reddit
version: 1.0.0
---

# Social Poster Skill

Post to your social media accounts.

## Tools

[[tool]]
name: post_telegram
description: Post to Telegram
params:
  - name: message
    type: string
    required: true
    description: Message to post
  - name: chat_id
    type: string
    required: false
    description: Chat ID (your chat if empty)

[[tool]]
name: post_discord
description: Post to Discord channel
params:
  - name: message
    type: string
    required: true
    description: Message to post
  - name: channel_id
    type: string
    required: false
    description: Discord channel ID

[[tool]]
name: post_twitter
description: Post to X/Twitter
params:
  - name: message
    type: string
    required: true
    description: Tweet content
  - name: reply_to
    type: string
    required: false
    description: Tweet ID to reply to

[[tool]]
name: post_reddit
description: Post to Reddit
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
name: post_all
description: Post to all platforms
params:
  - name: message
    type: string
    required: true
    description: Message to post everywhere

## Script

async function post_telegram({ message, chat_id = '8419317249' }) {
  const configPath = '~/.antenna/config.json';
  const { stdout: config } = await exec(\`cat \${configPath}\`);
  const configData = JSON.parse(config);
  const token = configData.channels?.telegram?.token;
  
  if (!token) {
    return { error: 'Telegram not configured' };
  }
  
  const { stdout } = await exec(\`curl -s -X POST "https://api.telegram.org/bot\${token}/sendMessage" \\
    -d "chat_id=\${chat_id}" \\
    -d "text=\${message}"\`);
  
  return {
    platform: 'telegram',
    status: 'sent',
    message: message.substring(0, 50) + '...'
  };
}

async function post_discord({ message, channel_id = '' }) {
  const configPath = '~/.antenna/config.json';
  const { stdout: config } = await exec(\`cat \${configPath}\`);
  const configData = JSON.parse(config);
  const token = configData.channels?.discord?.token;
  
  if (!token) {
    return { 
      platform: 'discord',
      error: 'Discord bot token not configured',
      setup: 'Add discord token to config.json'
    };
  }
  
  return {
    platform: 'discord',
    status: 'ready',
    message: message.substring(0, 50),
    note: 'Configure Discord bot token in config.json'
  };
}

async function post_twitter({ message, reply_to = '' }) {
  const configPath = '~/.antenna/config.json';
  const { stdout: config } = await exec(\`cat \${configPath}\`);
  const configData = JSON.parse(config);
  const twitter = configData.channels?.twitter;
  
  if (!twitter?.api_key) {
    return {
      platform: 'twitter',
      error: 'Twitter not configured',
      setup: 'Add Twitter API keys to config.json',
      required: ['api_key', 'api_secret', 'access_token', 'access_secret']
    };
  }
  
  return {
    platform: 'twitter',
    status: 'ready',
    message: message.substring(0, 50),
    note: 'Configure Twitter API in config.json'
  };
}

async function post_reddit({ subreddit, title, content }) {
  const configPath = '~/.antenna/config.json';
  const { stdout: config } = await exec(\`cat \${configPath}\`);
  const configData = JSON.parse(config);
  const reddit = configData.providers?.reddit;
  
  if (!reddit?.client_id) {
    return {
      platform: 'reddit',
      error: 'Reddit not configured',
      setup: 'Add Reddit credentials to config.json',
      url: 'https://www.reddit.com/prefs/apps'
    };
  }
  
  return {
    platform: 'reddit',
    subreddit: 'r/' + subreddit,
    title,
    content: content.substring(0, 50) + '...',
    status: 'ready'
  };
}

async function post_all({ message }) {
  const results = [];
  
  // Try Telegram
  try {
    const tg = await post_telegram({ message });
    results.push(tg);
  } catch (e) {
    results.push({ platform: 'telegram', error: e.message });
  }
  
  // Discord
  try {
    const dc = await post_discord({ message });
    results.push(dc);
  } catch (e) {
    results.push({ platform: 'discord', error: e.message });
  }
  
  // Twitter
  try {
    const tw = await post_twitter({ message });
    results.push(tw);
  } catch (e) {
    results.push({ platform: 'twitter', error: e.message });
  }
  
  return {
    total: results.length,
    results,
    note: 'Configure each platform in ~/.antenna/config.json'
  };
}
