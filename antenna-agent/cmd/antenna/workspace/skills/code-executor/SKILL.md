---
name: code-executor
description: Execute code in multiple languages with full system access
version: 1.0.0
---

# Code Executor Skill

Execute code in Python, JavaScript, Go, Rust, Bash, and more. Full system access with no limits.

## Setup

Install runtimes (optional - will use system default if available):
- Python3
- Node.js
- Go
- Rust (rustc)
- Bash

## Tools

[[tool]]
name: run_code
description: Execute code in specified language
params:
  - name: code
    type: string
    required: true
    description: Code to execute
  - name: language
    type: string
    required: true
    description: Language (python, javascript, go, rust, bash, ruby, php)
  - name: file
    type: string
    required: false
    description: Optional filename for syntax detection

[[tool]]
name: run_python
description: Execute Python code
params:
  - name: code
    type: string
    required: true
    description: Python code

[[tool]]
name: run_javascript
description: Execute JavaScript/Node.js code
params:
  - name: code
    type: string
    required: true
    description: JavaScript code

[[tool]]
name: run_bash
description: Execute bash/shell commands
params:
  - name: command
    type: string
    required: true
    description: Shell command

[[tool]]
name: run_go
description: Execute Go code
params:
  - name: code
    type: string
    required: true
    description: Go code

[[tool]]
name: list_runtimes
description: List available language runtimes
params: []

## Script

const TEMP_DIR = "/tmp/antenna-code";

async function ensureTempDir() {
  const fs = await import('fs');
  const path = await import('path');
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
}

async function run_code({ code, language, file = "" }) {
  // Detect language from file extension
  if (file) {
    if (file.endsWith(".py")) language = "python";
    else if (file.endsWith(".js")) language = "javascript";
    else if (file.endsWith(".go")) language = "go";
    else if (file.endsWith(".rs")) language = "rust";
    else if (file.endsWith(".sh")) language = "bash";
    else if (file.endsWith(".rb")) language = "ruby";
    else if (file.endsWith(".php")) language = "php";
  }
  
  switch (language.toLowerCase()) {
    case "python": return run_python({ code });
    case "javascript": return run_javascript({ code });
    case "go": return run_go({ code });
    case "bash": return run_bash({ command: code });
    default:
      return { error: `Unsupported language: ${language}` };
  }
}

async function run_python({ code }) {
  const fs = await import('fs');
  await ensureTempDir();
  
  const filename = TEMP_DIR + "/script_" + Date.now() + ".py";
  fs.writeFileSync(filename, code);
  
  const { exec } = await import('child_process');
  const { stdout, stderr } = await new Promise((resolve) => {
    exec(`python3 "${filename}"`, { timeout: 60000 }, (err, stdout, stderr) => {
      resolve({ stdout, stderr });
    });
  });
  
  fs.unlinkSync(filename);
  
  return {
    language: "python",
    stdout: stdout || "",
    stderr: stderr || "",
    success: !stderr && !stdout.startsWith("Traceback")
  };
}

async function run_javascript({ code }) {
  const fs = await import('fs');
  await ensureTempDir();
  
  const filename = TEMP_DIR + "/script_" + Date.now() + ".js";
  fs.writeFileSync(filename, code);
  
  const { exec } = await import('child_process');
  const { stdout, stderr } = await new Promise((resolve) => {
    exec(`node "${filename}"`, { timeout: 60000 }, (err, stdout, stderr) => {
      resolve({ stdout, stderr });
    });
  });
  
  fs.unlinkSync(filename);
  
  return {
    language: "javascript",
    stdout: stdout || "",
    stderr: stderr || "",
    success: !stderr
  };
}

async function run_go({ code }) {
  const fs = await import('fs');
  await ensureTempDir();
  
  const filename = TEMP_DIR + "/script_" + Date.now() + ".go";
  fs.writeFileSync(filename, code);
  
  const { exec } = await import('child_process');
  
  // Build
  const buildResult = await new Promise((resolve) => {
    exec(`go run "${filename}"`, { timeout: 120000 }, (err, stdout, stderr) => {
      resolve({ stdout, stderr });
    });
  });
  
  fs.unlinkSync(filename);
  
  return {
    language: "go",
    stdout: buildResult.stdout || "",
    stderr: buildResult.stderr || "",
    success: !buildResult.stderr?.includes("error")
  };
}

async function run_bash({ command }) {
  const { exec } = await import('child_process');
  
  const { stdout, stderr } = await new Promise((resolve) => {
    exec(command, { timeout: 120000, shell: "/bin/bash" }, (err, stdout, stderr) => {
      resolve({ stdout, stderr });
    });
  });
  
  return {
    language: "bash",
    stdout: stdout || "",
    stderr: stderr || "",
    success: !stderr
  };
}

async function list_runtimes() {
  const { exec } = await import('child_process');
  const runtimes = [];
  
  const checks = [
    { cmd: "python3 --version", name: "python" },
    { cmd: "node --version", name: "node" },
    { cmd: "go version", name: "go" },
    { cmd: "rustc --version", name: "rust" },
    { cmd: "ruby --version", name: "ruby" },
    { cmd: "php --version", name: "php" },
    { cmd: "bash --version | head -1", name: "bash" }
  ];
  
  for (const check of checks) {
    try {
      const { stdout } = await new Promise((resolve) => {
        exec(check.cmd, (err, stdout) => resolve({ stdout: stdout || "" }));
      });
      if (stdout) {
        runtimes.push({ language: check.name, version: stdout.trim() });
      }
    } catch {}
  }
  
  return { runtimes };
}
