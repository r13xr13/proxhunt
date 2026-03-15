---
name: k8s
description: Kubernetes cluster management
version: 1.0.0
---

# Kubernetes Skill

Manage Kubernetes clusters via kubectl.

## Tools

[[tool]]
name: k8s_pods
description: List pods
params:
  - name: namespace
    type: string
    required: false
    description: Kubernetes namespace
  - name: all_namespaces
    type: boolean
    required: false
    description: List from all namespaces

[[tool]]
name: k8s_deploy
description: List deployments
params:
  - name: namespace
    type: string
    required: false
    description: Namespace

[[tool]]
name: k8s_logs
description: Get pod logs
params:
  - name: pod
    type: string
    required: true
    description: Pod name
  - name: namespace
    type: string
    required: false
    description: Namespace
  - name: lines
    type: number
    required: false
    description: Number of lines

[[tool]]
name: k8s_scale
description: Scale deployment
params:
  - name: deployment
    type: string
    required: true
    description: Deployment name
  - name: replicas
    type: number
    required: true
    description: Number of replicas
  - name: namespace
    type: string
    required: false
    description: Namespace

[[tool]]
name: k8s_exec
description: Execute command in pod
params:
  - name: pod
    type: string
    required: true
    description: Pod name
  - name: command
    type: string
    required: true
    description: Command to run
  - name: namespace
    type: string
    required: false
    description: Namespace

[[tool]]
name: k8s_status
description: Get cluster status
params: []

## Script

async function k8s_pods({ namespace = 'default', all_namespaces = false }) {
  const nsArg = all_namespaces ? '--all-namespaces' : \`-n \${namespace}\`;
  const { stdout } = await exec(\`kubectl get pods \${nsArg} -o wide 2>&1\`);
  
  return {
    namespace: all_namespaces ? 'all' : namespace,
    pods: stdout,
    note: 'Requires kubectl configured'
  };
}

async function k8s_deploy({ namespace = 'default' }) {
  const { stdout } = await exec(\`kubectl get deployments -n \${namespace} 2>&1\`);
  return { namespace, deployments: stdout };
}

async function k8s_logs({ pod, namespace = 'default', lines = 100 }) {
  const { stdout } = await exec(\`kubectl logs \${pod} -n \${namespace} --tail \${lines} 2>&1\`);
  return { pod, namespace, lines, logs: stdout.substring(0, 2000) };
}

async function k8s_scale({ deployment, replicas, namespace = 'default' }) {
  const { stdout } = await exec(\`kubectl scale deployment \${deployment} -n \${namespace} --replicas=\${replicas} 2>&1\`);
  return { deployment, replicas, namespace, status: 'scaled' };
}

async function k8s_exec({ pod, command, namespace = 'default' }) {
  const { stdout } = await exec(\`kubectl exec \${pod} -n \${namespace} -- \${command} 2>&1\`);
  return { pod, command, output: stdout };
}

async function k8s_status() {
  const { stdout: nodes } = await exec('kubectl get nodes 2>&1');
  const { stdout: svc } = await exec('kubectl get svc --all-namespaces 2>&1');
  
  return {
    nodes: nodes,
    services: svc,
    note: 'Requires kubectl and kubeconfig'
  };
}
