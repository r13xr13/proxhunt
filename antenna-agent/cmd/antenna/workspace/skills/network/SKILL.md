---
name: network
description: Network diagnostics, port scanning, and speed testing
version: 1.0.0
---

# Network Skill

Network diagnostics, monitoring, and testing tools.

## Tools

[[tool]]
name: net_ping
description: Ping a host
params:
  - name: host
    type: string
    required: true
    description: Host to ping
  - name: count
    type: number
    required: false
    description: Number of pings

[[tool]]
name: net_dns
description: DNS lookup
params:
  - name: domain
    type: string
    required: true
    description: Domain to lookup
  - name: record_type
    type: string
    required: false
    description: Record type (A, AAAA, MX, etc)

[[tool]]
name: net_ports
description: Check open ports
params:
  - name: host
    type: string
    required: true
    description: Host to scan
  - name: ports
    type: string
    required: false
    description: Port range (e.g., 80,443 or 1-1000)

[[tool]]
name: net_speed
description: Run speed test
params: []

[[tool]]
name: net_trace
description: Trace route to host
params:
  - name: host
    type: string
    required: true
    description: Host to trace

[[tool]]
name: net_interfaces
description: List network interfaces
params: []

## Script

async function net_ping({ host, count = 4 }) {
  const { stdout } = await exec(\`ping -c \${count} \${host} 2>&1\`);
  const lines = stdout.split('\n').filter(l => l.includes('time='));
  const times = lines.map(l => l.match(/time=([0-9.]+)/)?.[1]).filter(Boolean);
  
  return {
    host,
    packets: count,
    times_ms: times,
    avg_ms: times.length ? times.reduce((a,b)=>parseFloat(a)+parseFloat(b),0)/times.length : null,
    loss: ((count - times.length) / count * 100).toFixed(0) + '%'
  };
}

async function net_dns({ domain, record_type = 'A' }) {
  const { stdout } = await exec(\`dig +\short \${domain} \${record_type} 2>/dev/null || nslookup \${domain}\`);
  return {
    domain,
    type: record_type,
    results: stdout.trim().split('\n').filter(r => r)
  };
}

async function net_ports({ host = 'localhost', ports = '80,443,22,3389' }) {
  const portList = ports.split(',').map(p => p.trim());
  const results = [];
  
  for (const port of portList.slice(0, 10)) {
    const { stdout } = await exec(\`nc -zw 2 \${host} \${port} 2>&1 && echo "open" || echo "closed"\`);
    results.push({ port, status: stdout.includes('open') ? 'open' : 'closed' });
  }
  
  return { host, results };
}

async function net_speed() {
  return {
    note: 'Use speedtest-cli: speedtest-cli --simple',
    cli: 'curl -s https://speed.cloudflare.com/__down?bytes=25000000',
    alternative: 'Install: pip install speedtest-cli'
  };
}

async function net_trace({ host }) {
  const { stdout } = await exec(\`traceroute -m 15 \${host} 2>/dev/null || tracepath \${host}\`);
  const hops = stdout.trim().split('\n').map(l => l.trim()).filter(Boolean);
  return { host, hops: hops.slice(0, 15) };
}

async function net_interfaces() {
  const { stdout } = await exec('ip addr show 2>/dev/null || ifconfig');
  return {
    interfaces: stdout,
    note: 'Use: ip addr or ifconfig'
  };
}
