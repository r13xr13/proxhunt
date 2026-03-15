---
name: memos
description: Create and manage notes in Memos (self-hosted open source)
version: 1.0.0
---

# Memos Skill

Open-source self-hosted note-taking. Your data stays with you.

## Setup

1. Memos is already running at http://localhost:5230
2. Open in browser and create first admin account
3. Set environment: `MEMOS_USER=your_username MEMOS_PASSWORD=your_password`

## Tools

[[tool]]
name: memos_list
description: List all memos/notes
params: []

[[tool]]
name: memos_create
description: Create a new memo/note
params:
  - name: content
    type: string
    required: true
    description: Note content (markdown supported)

[[tool]]
name: memos_search
description: Search memos by content
params:
  - name: query
    type: string
    required: true
    description: Search query

[[tool]]
name: memos_update
description: Update a memo
params:
  - name: id
    type: string
    required: true
    description: Memo ID
  - name: content
    type: string
    required: true
    description: New content

[[tool]]
name: memos_delete
description: Delete a memo
params:
  - name: id
    type: string
    required: true
    description: Memo ID

## Script

const SCRIPTS_DIR = home() + "/.antenna/scripts";

async function memos_list() {
  const { stdout } = await exec(`${SCRIPTS_DIR}/memos.py list`);
  try {
    return JSON.parse(stdout);
  } catch {
    return { error: stdout };
  }
}

async function memos_create({ content }) {
  const { stdout } = await exec(`${SCRIPTS_DIR}/memos.py create '${JSON.stringify({content})}'`);
  try {
    return JSON.parse(stdout);
  } catch {
    return { error: stdout };
  }
}

async function memos_search({ query }) {
  const { stdout } = await exec(`${SCRIPTS_DIR}/memos.py search '${JSON.stringify({query})}'`);
  try {
    return JSON.parse(stdout);
  } catch {
    return { error: stdout };
  }
}

async function memos_update({ id, content }) {
  const { stdout } = await exec(`${SCRIPTS_DIR}/memos.py update '${JSON.stringify({id, content})}'`);
  try {
    return JSON.parse(stdout);
  } catch {
    return { error: stdout };
  }
}

async function memos_delete({ id }) {
  const { stdout } = await exec(`${SCRIPTS_DIR}/memos.py delete '${JSON.stringify({id})}'`);
  try {
    return JSON.parse(stdout);
  } catch {
    return { error: stdout };
  }
}
