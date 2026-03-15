---
name: crypto
description: General cryptocurrency tools - prices, conversions, and wallet management
version: 1.0.0
---

# Crypto Skill

General cryptocurrency tools for prices, conversions, and multi-chain operations.

## Tools

[[tool]]
name: crypto_price
description: Get cryptocurrency prices
params:
  - name: coin
    type: string
    required: false
    description: Coin symbol (XMR, BTC, ETH)
  - name: currency
    type: string
    required: false
    description: Fiat currency (USD, EUR)

[[tool]]
name: crypto_convert
description: Convert between cryptocurrencies
params:
  - name: from
    type: string
    required: true
    description: Source coin
  - name: to
    type: string
    required: true
    description: Target coin
  - name: amount
    type: number
    required: true
    description: Amount to convert

[[tool]]
name: crypto_wallets
description: List configured crypto wallets
params: []

[[tool]]
name: crypto_explorers
description: Get blockchain explorers
params:
  - name: coin
    type: string
    required: false
    description: Coin symbol

[[tool]]
name: crypto_tx_status
description: Check transaction status
params:
  - name: txid
    type: string
    required: true
    description: Transaction ID
  - name: coin
    type: string
    required: false
    description: Coin symbol

## Script

async function crypto_price({ coin = 'XMR', currency = 'USD' }) {
  const { stdout } = await exec(\`curl -s "https://api.coingecko.com/api/v3/simple/price?ids=\${coin.toLowerCase()}&vs_currencies=\${currency.toLowerCase()}" 2>/dev/null\`);
  
  try {
    const data = JSON.parse(stdout);
    return {
      coin: coin.toUpperCase(),
      currency: currency.toUpperCase(),
      price: data[coin.toLowerCase()]?.[currency.toLowerCase()] || 'N/A'
    };
  } catch {
    return { coin, currency, price: ' unavailable' };
  }
}

async function crypto_convert({ from, to, amount }) {
  const { stdout } = await exec(\`curl -s "https://api.coingecko.com/api/v3/simple/price?ids=\${from.toLowerCase()},\${to.toLowerCase()}&vs_currencies=usd" 2>/dev/null\`);
  
  try {
    const data = JSON.parse(stdout);
    const fromPrice = data[from.toLowerCase()]?.usd || 0;
    const toPrice = data[to.toLowerCase()]?.usd || 0;
    const usdValue = amount * fromPrice;
    const converted = usdValue / toPrice;
    
    return {
      from: { coin: from, amount, price_usd: fromPrice },
      to: { coin: to, amount: converted, price_usd: toPrice },
      usd_value: usdValue
    };
  } catch {
    return { error: 'Conversion failed' };
  }
}

function crypto_wallets() {
  return {
    configured: ['monero'],
    available: ['bitcoin', 'ethereum', 'litecoin'],
    note: 'Configure in ~/.antenna/wallet.json',
    cli: 'antenna wallet'
  };
}

function crypto_explorers({ coin = 'XMR' }) {
  const explorers = {
    XMR: ['https://xmrchain.net', 'https://monerohash.com/explorer'],
    BTC: ['https://blockstream.info', 'https://explorer.btc.com'],
    ETH: ['https://etherscan.io', 'https://blockchair.com/ethereum']
  };
  
  return {
    coin: coin.toUpperCase(),
    explorers: explorers[coin.toUpperCase()] || ['N/A']
  };
}

function crypto_tx_status({ txid, coin = 'XMR' }) {
  return {
    txid,
    coin: coin.toUpperCase(),
    note: 'Use blockchain explorer for status',
    explorer: coin === 'XMR' ? 'https://xmrchain.net' : 'N/A'
  };
}
