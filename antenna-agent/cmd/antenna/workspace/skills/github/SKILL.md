---
name: github
description: Manage GitHub repos, issues, PRs, and actions
version: 1.0.0
---

# GitHub Skill

Manage GitHub repositories, issues, pull requests, and workflows.

## Tools

[[tool]]
name: gh_repos
description: List GitHub repositories
params:
  - name: limit
    type: number
    required: false
    description: Number of repos to list

[[tool]]
name: gh_issues
description: List issues for a repository
params:
  - name: repo
    type: string
    required: false
    description: Repository (owner/repo), defaults to current
  - name: state
    type: string
    required: false
    description: open, closed, or all

[[tool]]
name: gh_pr_status
description: Check pull request status
params:
  - name: repo
    type: string
    required: false
    description: Repository

[[tool]]
name: gh_runners
description: List GitHub Actions runners
params:
  - name: repo
    type: string
    required: false
    description: Repository

## Script

async function gh_repos({ limit = 10 }) {
  const { stdout } = await exec(\`gh repo list \$(gh api user --jq .login) --limit \${limit} 2>/dev/null\`);
  if (!stdout) return { error: 'gh CLI not authenticated. Run: gh auth login' };
  
  const repos = stdout.trim().split('\n').filter(r => r).map(line => {
    const [name, desc] = line.split('\t');
    return { name: name.trim(), description: desc?.trim() || '' };
  });
  
  return { count: repos.length, repos };
}

async function gh_issues({ repo = '', state = 'open' }) {
  const repoArg = repo ? \`\${repo}\` : '';
  const { stdout } = await exec(\`gh issue list \${repoArg} --state \${state} --limit 20 2>&1\`);
  
  if (stdout.includes('run `gh auth`')) {
    return { error: 'gh CLI not authenticated' };
  }
  
  const issues = stdout.trim().split('\n').filter(i => i).map(line => {
    const parts = line.split('\t');
    return { number: parts[0], title: parts[1], labels: parts[2] || '' };
  });
  
  return { state, count: issues.length, issues };
}

async function gh_pr_status({ repo = '' }) {
  const repoArg = repo ? \`\${repo}\` : '';
  const { stdout } = await exec(\`gh pr list \${repoArg} --state open --limit 10 2>&1\`);
  
  if (stdout.includes('run `gh auth`')) {
    return { error: 'gh CLI not authenticated' };
  }
  
  const prs = stdout.trim().split('\n').filter(p => p).map(line => {
    const parts = line.split('\t');
    return { number: parts[0], title: parts[1], branch: parts[2] };
  });
  
  return { count: prs.length, prs };
}

async function gh_runners({ repo = '' }) {
  const repoArg = repo ? \`\${repo}\` : '';
  const { stdout } = await exec(\`gh run list \${repoArg} --limit 10 2>&1\`);
  
  if (stdout.includes('run `gh auth`')) {
    return { error: 'gh CLI not authenticated' };
  }
  
  return { runs: stdout.trim() };
}
