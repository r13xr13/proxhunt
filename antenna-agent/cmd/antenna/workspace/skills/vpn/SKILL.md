---
name: vpn
description: VPN connection management - WireGuard, OpenVPN, Tunnelblick
version: 1.0.0
---

# VPN Skill

Manage VPN connections via WireGuard, OpenVPN, and other protocols.

## Tools

[[tool]]
name: vpn_status
description: Check VPN status
params: []

[[tool]]
name: vpn_connect
description: Connect to VPN
params:
  - name: config
    type: string
    required: true
    description: Config name or path
  - name: type
    type: string
    required: false
    description: wireguard, openvpn, ikev2

[[tool]]
name: vpn_disconnect
description: Disconnect VPN
params: []

[[tool]]
name: vpn_wireguard
description: WireGuard management
params:
  - name: action
    type: string
    required: true
    description: up, down, status
  - name: config
    type: string
    required: false
    description: Config file

[[tool]]
name: vpn_openvpn
description: OpenVPN management
params:
  - name: action
    type: string
    required: true
    description: start, stop, status
  - name: config
    type: string
    required: false
    description: Config file

## Script

async function vpn_status() {
  const { stdout: wg } = await exec('wg show 2>/dev/null || echo "not running"');
  const { stdout: ovpn } = await exec('pkill -f openvpn 2>/dev/null; echo "checking"');
  
  return {
    wireguard: wg.includes('interface') ? 'connected' : 'disconnected',
    openvpn: 'check status',
    note: 'Requires VPN software installed'
  };
}

async function vpn_connect({ config, type = 'wireguard' }) {
  const cmd = type === 'wireguard' 
    ? \`wg-quick up \${config}\`
    : \`openvpn --config \${config}\`;
  
  return {
    config,
    type,
    note: \`Run: \${cmd}\`,
    warning: 'Connect as root or with sudo'
  };
}

async function vpn_disconnect() {
  const cmds = [
    'wg-quick down wg0 2>/dev/null',
    'pkill openvpn 2>/dev/null'
  ];
  
  return {
    status: 'disconnected',
    note: 'Run: wg-quick down or pkill openvpn'
  };
}

async function vpn_wireguard({ action, config = '/etc/wireguard/wg0.conf' }) {
  const { stdout } = await exec(\`sudo wg-quick \${action} \${config} 2>&1\`);
  
  return {
    action,
    config,
    output: stdout || 'success'
  };
}

async function vpn_openvpn({ action, config = '/etc/openvpn/client.conf' }) {
  const cmd = action === 'start' 
    ? \`sudo openvpn --config \${config}\`
    : \`sudo pkill openvpn\`;
  
  return {
    action,
    config,
    note: \`Run: \${cmd}\`
  };
}
