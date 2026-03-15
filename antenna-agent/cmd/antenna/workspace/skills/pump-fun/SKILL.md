---
name: pump-fun
description: Create and launch tokens on pump.fun
version: 1.0.0
---

# Pump.fun Skill

Create and launch tokens on Solana pump.fun.

## Tools

[[tool]]
name: pump_create
description: Create a new token
params:
  - name: name
    type: string
    required: true
    description: Token name
  - name: ticker
    type: string
    required: true
    description: Token ticker/symbol
  - name: description
    type: string
    required: false
    description: Token description
  - name: twitter
    type: string
    required: false
    description: Twitter handle
  - name: telegram
    type: string
    required: false
    description: Telegram handle

[[tool]]
name: pump_buy
description: Buy token on pump.fun
params:
  - name: mint
    type: string
    required: true
    description: Token mint address
  - name: amount
    type: number
    required: true
    description: Amount in SOL

[[tool]]
name: pump_sell
description: Sell token on pump.fun
params:
  - name: mint
    type: string
    required: true
    description: Token mint address
  - name: percent
    type: number
    required: true
    description: Percentage to sell

[[tool]]
name: pump_trending
description: Get trending tokens
params:
  - name: limit
    type: number
    required: false
    description: Number of tokens

[[tool]]
name: pump_launch
description: Launch to Raydium
params:
  - name: mint
    type: string
    required: true
    description: Token mint address

## Script

function pump_create({ name, ticker, description = '', twitter = '', telegram = '' }) {
  return {
    name,
    ticker,
    description,
    twitter,
    telegram,
    note: 'Use pump-fun CLI or web interface',
    website: 'https://pump.fun',
    requirements: [
      'Solana wallet (Phantom, Solflare)',
      'SOL for deployment'
    ]
  };
}

function pump_buy({ mint, amount }) {
  return {
    mint,
    amount_sol: amount,
    note: 'Buy via pump.fun or Jupiter aggregator',
    caution: 'DYOR - High rug pull risk'
  };
}

function pump_sell({ mint, percent }) {
  return {
    mint,
    percent,
    note: 'Sell percentage of holdings',
    caution: 'Sell early for profit'
  };
}

function pump_trending({ limit = 20 }) {
  return {
    limit,
    note: 'Check pump.fun for trending tokens',
    website: 'https://pump.fun/tron',
    filters: ['new', 'rising', 'marketcap']
  };
}

function pump_launch({ mint }) {
  return {
    mint,
    note: 'Fair launch to Raydium pool',
    requirements: [
      '$12k+ market cap',
      'No honeypot'
    ],
    warning: 'Irreversible action'
  };
}
