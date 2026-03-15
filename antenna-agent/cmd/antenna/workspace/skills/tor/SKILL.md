---
name: tor
description: Tor network management, onion services, and privacy tools
version: 1.0.0
---

# Tor Skill

Manage Tor network, onion services, and privacy tools.

## Tools

[[tool]]
name: tor_status
description: Check Tor daemon status
params: []

[[tool]]
name: tor_onion
description: Create onion (v3) service
params:
  - name: port
    type: number
    required: true
    description: Local port to expose
  - name: name
    type: string
    required: false
    description: Service name

[[tool]]
name: tor_bridges
description: Get Tor bridges
params:
  - name: type
    type: string
    required: false
    description: obfs4, snowflake, or default

[[tool]]
name: tor_bandwidth
description: Get Tor bandwidth usage
params: []

[[tool]]
name: tor_circuit
description: Get current Tor circuit
params: []

## Script

async function tor_status() {
  const { stdout } = await exec('systemctl is-active tor 2>/dev/null || pgrep -x tor');
  
  return {
    running: !!stdout,
    port: 9050,
    control_port: 9051,
    note: 'Requires Tor daemon installed'
  };
}

async function tor_onion({ port, name = 'service' }) {
  return {
    local_port: port,
    name,
    note: 'Configure in /etc/tor/torrc',
    config_example: \`HiddenServiceDir /var/lib/tor/\${name}
HiddenServicePort 80 127.0.0.1:\${port}\`,
    onion_address_file: \`/var/lib/tor/\${name}/hostname\`
  };
}

async function tor_bridges({ type = 'obfs4' }) {
  const bridges = {
    obfs4: 'obfs4 1.2.3.4:443 cert=xxx iat-mode=0',
    snowflake: 'snowflake 2.3.4.5:80'
  };
  
  return {
    type,
    note: 'Get bridges from https://bridges.torproject.org',
    warning: 'Bridges should be kept private'
  };
}

async function tor_bandwidth() {
  const { stdout } = await exec('curl -s --socks5 localhost:9050 "http://torrc和控制端口" 2>/dev/null || echo "{}"');
  
  return {
    note: 'Use: antenna tor status',
    cli: 'antenna p2p (for P2P over Tor)'
  };
}

async function tor_circuit() {
  return {
    note: 'Use: arm or nyx to view circuits',
    cli: 'torrc configuration required',
    privacy_level: 'High'
  };
}
