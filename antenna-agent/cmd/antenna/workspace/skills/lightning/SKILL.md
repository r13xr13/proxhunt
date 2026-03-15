---
name: lightning
description: Bitcoin Lightning Network payments and channel management
version: 1.0.0
---

# Lightning Network Skill

Manage Lightning Network payments, invoices, and channels.

## Tools

[[tool]]
name: ln_balance
description: Get Lightning balance
params: []

[[tool]]
name: ln_invoice
description: Create Lightning invoice
params:
  - name: amount
    type: number
    required: true
    description: Amount in sats
  - name: description
    type: string
    required: false
    description: Invoice description

[[tool]]
name: ln_pay
description: Pay Lightning invoice
params:
  - name: invoice
    type: string
    required: true
    description: Lightning invoice (lnbc...)
  - name: amount
    type: number
    required: false
    description: Amount in sats (if invoice doesn't have amount)

[[tool]]
name: ln_channels
description: List Lightning channels
params: []

[[tool]]
name: ln_connect
description: Connect to Lightning node
params:
  - name: node_address
    type: string
    required: true
    description: Node public key@host:port

## Script

function ln_balance() {
  return {
    note: 'Requires Lightning node configuration',
    cli_command: 'antenna lightning balance',
    providers: ['c-lightning', 'lnd', 'lncli']
  };
}

function ln_invoice({ amount, description = 'Antenna payment' }) {
  return {
    amount_sats: amount,
    description,
    note: 'Use: antenna lightning invoice <sats>',
    expiry: '3600 seconds (1 hour)'
  };
}

function ln_pay({ invoice, amount }) {
  return {
    invoice: invoice.substring(0, 50) + '...',
    amount_sats: amount || 'auto',
    note: 'Use: antenna lightning pay <invoice>'
  };
}

function ln_channels() {
  return {
    note: 'Use: antenna lightning channels',
    info: 'List all open Lightning channels'
  };
}

function ln_connect({ node_address }) {
  return {
    node: node_address,
    note: 'Use: antenna lightning connect <node_address>',
    warning: 'Only connect to trusted nodes'
  };
}
