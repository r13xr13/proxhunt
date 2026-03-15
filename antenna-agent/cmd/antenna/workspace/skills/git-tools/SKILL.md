---
name: git-tools
description: Git operations, branching, and repository management
version: 1.0.0
---

# Git Tools Skill

Manage git repositories, branches, commits, and workflows.

## Tools

[[tool]]
name: git_status
description: Get git repository status
params:
  - name: path
    type: string
    required: false
    description: Repository path (default: current)

[[tool]]
name: git_branches
description: List git branches
params:
  - name: path
    type: string
    required: false
    description: Repository path

[[tool]]
name: git_log
description: Get recent commits
params:
  - name: path
    type: string
    required: false
    description: Repository path
  - name: count
    type: number
    required: false
    description: Number of commits

[[tool]]
name: git_diff
description: Get uncommitted changes
params:
  - name: path
    type: string
    required: false
    description: Repository path

[[tool]]
name: git_find_repos
description: Find git repositories in a directory
params:
  - name: path
    type: string
    required: false
    description: Directory to search

## Script

async function git_status({ path = '.' }) {
  const { stdout, stderr } = await exec(\`cd \${path} && git status --porcelain 2>&1\`);
  if (stderr.includes('not a git')) return { error: 'Not a git repository' };
  
  const lines = stdout.trim().split('\n').filter(l => l);
  const staged = lines.filter(l => l.startsWith(' '));
  const modified = lines.filter(l => l.startsWith(' M'));
  const untracked = lines.filter(l => l.startsWith('??'));
  
  return {
    path,
    staged: staged.length,
    modified: modified.length,
    untracked: untracked.length,
    clean: lines.length === 0
  };
}

async function git_branches({ path = '.' }) {
  const { stdout } = await exec(\`cd \${path} && git branch -a 2>&1\`);
  const branches = stdout.trim().split('\n').filter(b => b);
  return { count: branches.length, branches };
}

async function git_log({ path = '.', count = 10 }) {
  const { stdout } = await exec(\`cd \${path} && git log --oneline -\${count} 2>&1\`);
  const commits = stdout.trim().split('\n').filter(c => c);
  return { count: commits.length, commits };
}

async function git_diff({ path = '.' }) {
  const { stdout } = await exec(\`cd \${path} && git diff --stat 2>&1\`);
  return { diff: stdout || 'No changes' };
}

async function git_find_repos({ path = '~' }) {
  const expanded = path.replace('~', process.env.HOME || '~');
  const { stdout } = await exec(\`find \${expanded} -type d -name ".git" -maxdepth 3 2>/dev/null | head -20\`);
  const repos = stdout.trim().split('\n').filter(r => r).map(r => r.replace('/.git', ''));
  return { count: repos.length, repos };
}
