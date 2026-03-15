---
name: docker
description: Manage Docker containers, images, and compose
version: 1.0.0
---

# Docker Skill

Manage Docker containers, images, volumes, and compose stacks.

## Tools

[[tool]]
name: docker_ps
description: List running containers
params:
  - name: all
    type: boolean
    required: false
    description: Show all containers

[[tool]]
name: docker_images
description: List Docker images
params: []

[[tool]]
name: docker_logs
description: Get container logs
params:
  - name: container
    type: string
    required: true
    description: Container name or ID
  - name: lines
    type: number
    required: false
    description: Number of lines

[[tool]]
name: docker_stats
description: Get container resource usage
params: []

[[tool]]
name: docker_cleanup
description: Clean up unused containers, images, and volumes
params: []

## Script

async function docker_ps({ all = false }) {
  const allArg = all ? '-a' : '';
  const { stdout } = await exec(\`docker ps \${allArg} --format "table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}" 2>&1\`);
  return { containers: stdout };
}

async function docker_images() {
  const { stdout } = await exec(\`docker images --format "table {{.Repository}}\\t{{.Tag}}\\t{{.Size}}\\t{{.ID}}" 2>&1\`);
  return { images: stdout };
}

async function docker_logs({ container, lines = 50 }) {
  const { stdout, stderr } = await exec(\`docker logs --tail \${lines} \${container} 2>&1\`);
  return { container, lines, logs: stdout || stderr };
}

async function docker_stats() {
  const { stdout } = await exec(\`docker stats --no-stream --format "table {{.Name}}\\t{{.CPUPerc}}\\t{{.MemUsage}}\\t{{.NetIO}}" 2>&1\`);
  return { stats: stdout };
}

async function docker_cleanup() {
  const results = {};
  
  const { stdout: c } = await exec('docker container prune -f 2>&1');
  results.containers = c;
  
  const { stdout: i } = await exec('docker image prune -f 2>&1');
  results.images = i;
  
  const { stdout: v } = await exec('docker volume prune -f 2>&1');
  results.volumes = v;
  
  return results;
}
