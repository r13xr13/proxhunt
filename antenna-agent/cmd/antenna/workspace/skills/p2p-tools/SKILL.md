---
name: p2p-tools
description: P2P network operations, peer discovery, and file sharing
version: 1.0.0
---

# P2P Tools Skill

Manage P2P networking, discover peers, and transfer files.

## Tools

[[tool]]
name: p2p_status
description: Get P2P network status
params: []

[[tool]]
name: p2p_peers
description: List connected peers
params: []

[[tool]]
name: p2p_discover
description: Discover new peers
params: []

[[tool]]
name: p2p_send
description: Send a message to a peer
params:
  - name: peer_id
    type: string
    required: true
    description: Peer ID to send to
  - name: message
    type: string
    required: true
    description: Message to send

[[tool]]
name: p2p_broadcast
description: Broadcast message to all peers
params:
  - name: message
    type: string
    required: true
    description: Message to broadcast

[[tool]]
name: p2p_share_file
description: Share a file with peers
params:
  - name: file_path
    type: string
    required: true
    description: Path to file to share
  - name: peer_id
    type: string
    required: false
    description: Specific peer (broadcast if empty)

## Script

function p2p_status() {
  return {
    status: 'Use antenna p2p status command',
    note: 'P2P functionality available via antenna CLI',
    commands: [
      'antenna p2p status',
      'antenna p2p peers',
      'antenna p2p discover'
    ]
  };
}

function p2p_peers() {
  return {
    note: 'Run: antenna p2p peers',
    alternative: 'Use exec tool to run antenna p2p peers'
  };
}

function p2p_discover() {
  return {
    note: 'Run: antenna p2p discover',
    description: 'Discovers new peers on the P2P network'
  };
}

async function p2p_send({ peer_id, message }) {
  const { stdout, stderr } = await exec(\`echo "\${message}" | antenna p2p send \${peer_id} 2>&1\`);
  return { peer_id, message, result: stdout || stderr };
}

async function p2p_broadcast({ message }) {
  const { stdout, stderr } = await exec(\`antenna p2p broadcast "\${message}" 2>&1\`);
  return { broadcasted: true, result: stdout || stderr };
}

async function p2p_share_file({ file_path, peer_id = '' }) {
  const cmd = peer_id 
    ? \`antenna p2p send-file \${peer_id} \${file_path}\`
    : \`antenna p2p broadcast-file \${file_path}\`;
  
  const { stdout, stderr } = await exec(\`\${cmd} 2>&1\`);
  return { file: file_path, peer: peer_id || 'broadcast', result: stdout || stderr };
}
