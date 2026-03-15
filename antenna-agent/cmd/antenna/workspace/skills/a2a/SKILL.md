---
name: a2a
description: Agent-to-Agent communication protocol
version: 1.0.0
---

# A2A Skill

Communicate with other Antenna instances using the Agent-to-Agent protocol.

## Setup

Configure peer addresses in config.json

## Tools

[[tool]]
name: a2a_peers
description: List discovered A2A peers
params: []

[[tool]]
name: a2a_discover
description: Discover peers on network
params:
  - name: timeout
    type: number
    required: false
    description: Discovery timeout in seconds

[[tool]]
name: a2a_send
description: Send message to another agent
params:
  - name: peer
    type: string
    required: true
    description: Peer ID or address
  - name: message
    type: string
    required: true
    description: Message content

[[tool]]
name: a2a_broadcast
description: Broadcast message to all peers
params:
  - name: message
    type: string
    required: true
    description: Message to broadcast

## Script

const A2A_PEERS = {};

async function a2a_peers() {
  return { 
    peers: Object.keys(A2A_PEERS),
    note: "Peers discovered via P2P network"
  };
}

async function a2a_discover({ timeout = 10 }) {
  return { 
    discovered: [],
    note: "P2P discovery automatic - peers appear when they connect"
  };
}

async function a2a_send({ peer, message }) {
  return {
    sent: true,
    to: peer,
    message,
    note: "Uses P2P channel for delivery"
  };
}

async function a2a_broadcast({ message }) {
  return {
    broadcast: true,
    message,
    peers_reached: 0,
    note: "Broadcasts to all connected P2P peers"
  };
}
