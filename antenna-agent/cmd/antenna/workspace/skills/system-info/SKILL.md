---
name: system-info
description: Get system information and perform system operations
version: 1.0.0
---

# System Info Skill

Get system information, check services, and perform system operations.

## Tools

[[tool]]
name: get_system_info
description: Get system information
params: []

[[tool]]
name: check_port
description: Check if a port is open
params:
  - name: port
    type: number
    required: true
    description: Port number to check

[[tool]]
name: list_processes
description: List running processes
params:
  - name: filter
    type: string
    required: false
    description: Filter process name

## Script

function get_system_info() {
  return {
    platform: 'linux',
    arch: 'amd64',
    timestamp: new Date().toISOString()
  };
}

function check_port({ port }) {
  return {
    port,
    status: 'unknown',
    note: 'Use exec tool to check with: nc -zv localhost ' + port
  };
}

function list_processes({ filter = '' }) {
  return {
    filter,
    note: 'Use exec tool to list: ps aux' + (filter ? ' | grep ' + filter : '')
  };
}
