---
name: ssh
description: SSH connection management and remote execution
version: 1.0.0
---

# SSH Skill

Manage SSH connections and remote execution.

## Tools

[[tool]]
name: ssh_connect
description: Test SSH connection
params:
  - name: host
    type: string
    required: true
    description: SSH host
  - name: user
    type: string
    required: false
    description: SSH user
  - name: port
    type: number
    required: false
    description: SSH port

[[tool]]
name: ssh_exec
description: Execute command on remote host
params:
  - name: host
    type: string
    required: true
    description: SSH host
  - name: command
    type: string
    required: true
    description: Command to run
  - name: user
    type: string
    required: false
    description: SSH user

[[tool]]
name: ssh_keygen
description: Generate SSH key
params:
  - name: type
    type: string
    required: false
    description: Key type (rsa, ed25519)
  - name: comment
    type: string
    required: false
    description: Key comment

[[tool]]
name: ssh_copy_key
description: Copy SSH key to remote
params:
  - name: host
    type: string
    required: true
    description: Target host
  - name: user
    type: string
    required: false
    description: Target user

[[tool]]
name: ssh_tunnel
description: Create SSH tunnel
params:
  - name: local_port
    type: number
    required: true
    description: Local port
  - name: remote_host
    type: string
    required: true
    description: Remote host
  - name: remote_port
    type: number
    required: true
    description: Remote port

## Script

async function ssh_connect({ host, user = 'root', port = 22 }) {
  const { stdout, exitCode } = await exec(\`ssh -o ConnectTimeout=5 -p \${port} \${user}@\${host} "echo ok" 2>&1\`);
  
  return {
    host,
    user,
    port,
    connected: exitCode === 0,
    note: 'Configure SSH keys for passwordless auth'
  };
}

async function ssh_exec({ host, command, user = 'root' }) {
  const { stdout, stderr } = await exec(\`ssh \${user}@\${host} "\${command}" 2>&1\`);
  
  return {
    host,
    command,
    output: stdout || stderr,
    note: 'Use SSH keys for automation'
  };
}

async function ssh_keygen({ type = 'ed25519', comment = 'antenna' }) {
  const keyPath = \`~/.ssh/id_\${type}\`;
  const { stdout } = await exec(\`ssh-keygen -t \${type} -C "\${comment}" -f "\${keyPath}" -N "" 2>&1\`);
  
  return {
    type,
    path: keyPath,
    note: 'Add public key to remote ~/.ssh/authorized_keys'
  };
}

async function ssh_copy_key({ host, user = 'root' }) {
  const { stdout } = await exec(\`ssh-copy-id \${user}@\${host} 2>&1\`);

  return {
    host,
    user,
    note: 'Copies ~/.ssh/id_rsa.pub or specified key'
  };
}

function ssh_tunnel({ local_port, remote_host, remote_port }) {
  return {
    local_port,
    remote_host,
    remote_port,
    note: 'Use: ssh -L local_port:remote_host:remote_port user@host',
    background: 'Add & to run in background'
  };
}
