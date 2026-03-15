---
name: google-tasks
description: Manage Google Tasks todos and task lists
version: 1.0.0
---

# Google Tasks Skill

Manage Google Tasks (todo lists).

## Setup

1. Go to Google Cloud Console: https://console.cloud.google.com/
2. Enable Google Tasks API
3. Create OAuth credentials (Desktop App)
4. Download JSON to: `~/.antenna/credentials/google-tasks.json`
5. Run OAuth: `source ~/.antenna/venv/bin/activate && python ~/.antenna/scripts/setup-google.py tasks`

## Tools

[[tool]]
name: gt_lists
description: List all task lists
params: []

[[tool]]
name: gt_tasks
description: List tasks in a task list
params:
  - name: tasklist
    type: string
    required: false
    description: Task list ID (default: @default)
  - name: status
    type: string
    required: false
    description: Filter by status (needsAction, completed)

[[tool]]
name: gt_add
description: Add a new task/todo
params:
  - name: title
    type: string
    required: true
    description: Task title
  - name: tasklist
    type: string
    required: false
    description: Task list ID (default: @default)
  - name: due
    type: string
    required: false
    description: Due date (ISO format)

[[tool]]
name: gt_complete
description: Mark a task as complete
params:
  - name: id
    type: string
    required: true
    description: Task ID
  - name: tasklist
    type: string
    required: false
    description: Task list ID (default: @default)

[[tool]]
name: gt_delete
description: Delete a task
params:
  - name: id
    type: string
    required: true
    description: Task ID
  - name: tasklist
    type: string
    required: false
    description: Task list ID (default: @default)

## Script

const SCRIPTS_DIR = home() + "/.antenna/scripts";

async function gt_lists() {
  const { stdout } = await exec(`${SCRIPTS_DIR}/google-tasks.py list_tasklists`);
  try {
    return JSON.parse(stdout);
  } catch {
    return { error: stdout };
  }
}

async function gt_tasks({ tasklist = "@default", status = "" }) {
  const { stdout } = await exec(`${SCRIPTS_DIR}/google-tasks.py list_tasks '${JSON.stringify({tasklist})}'`);
  try {
    let result = JSON.parse(stdout);
    if (status && result.tasks) {
      result.tasks = result.tasks.filter(t => t.status === status);
    }
    return result;
  } catch {
    return { error: stdout };
  }
}

async function gt_add({ title, tasklist = "@default", due = "" }) {
  const { stdout } = await exec(`${SCRIPTS_DIR}/google-tasks.py create '${JSON.stringify({title, tasklist, due})}'`);
  try {
    return JSON.parse(stdout);
  } catch {
    return { error: stdout };
  }
}

async function gt_complete({ id, tasklist = "@default" }) {
  const { stdout } = await exec(`${SCRIPTS_DIR}/google-tasks.py complete '${JSON.stringify({id, tasklist})}'`);
  try {
    return JSON.parse(stdout);
  } catch {
    return { error: stdout };
  }
}

async function gt_delete({ id, tasklist = "@default" }) {
  const { stdout } = await exec(`${SCRIPTS_DIR}/google-tasks.py delete '${JSON.stringify({id, tasklist})}'`);
  try {
    return JSON.parse(stdout);
  } catch {
    return { error: stdout };
  }
}
