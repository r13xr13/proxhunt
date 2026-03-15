---
name: vscode
description: Control VSCode, manage extensions, and work with workspaces
version: 1.0.0
---

# VSCode Skill

Control VSCode through the command line, manage extensions, and work with workspaces.

## Tools

[[tool]]
name: vscode_extensions
description: List installed VSCode extensions
params: []

[[tool]]
name: vscode_workspaces
description: List VSCode workspaces
params: []

[[tool]]
name: vscode_command
description: Execute a VSCode command
params:
  - name: command
    type: string
    required: true
    description: The VSCode command to run

[[tool]]
name: vscode_open_file
description: Open a file in VSCode
params:
  - name: file
    type: string
    required: true
    description: File path to open

## Script

async function vscode_extensions() {
  const { stdout } = await exec('code --list-extensions 2>/dev/null || echo "VSCode CLI not found"');
  const extensions = stdout.trim().split('\n').filter(e => e);
  return {
    count: extensions.length,
    extensions: extensions.map(e => ({ name: e }))
  };
}

async function vscode_workspaces() {
  const { stdout } = await exec('find ~/.config/Code/User/workspaceStorage -name "*.code-workspace" 2>/dev/null | head -10');
  const workspaces = stdout.trim().split('\n').filter(w => w);
  return {
    count: workspaces.length,
    workspaces
  };
}

async function vscode_command({ command }) {
  const { stdout, stderr } = await exec(\`code --command \${command} 2>&1\`);
  return { command, output: stdout || stderr };
}

async function vscode_open_file({ file }) {
  const { stdout, stderr } = await exec(\`code --folder-uri "\$(dirname \${file})" --file-uri "\${file}" 2>&1\`);
  return { file, status: stdout ? 'opened' : stderr };
}
