---
name: google-sheets
description: Read, write, and manage Google Sheets / Excel spreadsheets
version: 1.0.0
---

# Google Sheets Skill

Read, write, and manage Google Sheets (Excel-like spreadsheets).

## Setup

1. Go to Google Cloud Console: https://console.cloud.google.com/
2. Create a project and Sheets API
3 enable Google. Create OAuth credentials (Desktop App)
4. Download JSON to: `~/.antenna/credentials/google-sheets.json`
5. Run: `source ~/.antenna/venv/bin/activate && python -m gspread oauth --credentials ~/.antenna/credentials/google-sheets.json`

## Tools

[[tool]]
name: gs_list
description: List all Google Sheets
params: []

[[tool]]
name: gs_read
description: Read data from a Google Sheet
params:
  - name: title
    type: string
    required: true
    description: Spreadsheet title
  - name: sheet
    type: string
    required: false
    description: Sheet name (default: Sheet1)

[[tool]]
name: gs_write
description: Write data to a Google Sheet
params:
  - name: title
    type: string
    required: true
    description: Spreadsheet title
  - name: data
    type: array
    required: true
    description: 2D array of data
  - name: sheet
    type: string
    required: false
    description: Sheet name (default: Sheet1)

[[tool]]
name: gs_create
description: Create a new Google Sheet
params:
  - name: title
    type: string
    required: true
    description: New spreadsheet title

## Script

const SCRIPTS_DIR = home() + "/.antenna/scripts";

async function gs_list() {
  const { stdout } = await exec(`${SCRIPTS_DIR}/google-sheets.py list`);
  try {
    return JSON.parse(stdout);
  } catch {
    return { error: stdout };
  }
}

async function gs_read({ title, sheet = "Sheet1" }) {
  const { stdout } = await exec(`${SCRIPTS_DIR}/google-sheets.py read '${JSON.stringify({title, sheet})}'`);
  try {
    return JSON.parse(stdout);
  } catch {
    return { error: stdout };
  }
}

async function gs_write({ title, data, sheet = "Sheet1" }) {
  const { stdout } = await exec(`${SCRIPTS_DIR}/google-sheets.py write '${JSON.stringify({title, data, sheet})}'`);
  try {
    return JSON.parse(stdout);
  } catch {
    return { error: stdout };
  }
}

async function gs_create({ title }) {
  const { stdout } = await exec(`${SCRIPTS_DIR}/google-sheets.py create '${JSON.stringify({title})}'`);
  try {
    return JSON.parse(stdout);
  } catch {
    return { error: stdout };
  }
}
