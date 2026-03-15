---
name: email
description: Email management via SMTP/IMAP
version: 1.0.0
---

# Email Skill

Send and receive emails via SMTP/IMAP.

## Tools

[[tool]]
name: email_send
description: Send email
params:
  - name: to
    type: string
    required: true
    description: Recipient email
  - name: subject
    type: string
    required: true
    description: Email subject
  - name: body
    type: string
    required: true
    description: Email body
  - name: from
    type: string
    required: false
    description: Sender email

[[tool]]
name: email_inbox
description: Get inbox messages
params:
  - name: limit
    type: number
    required: false
    description: Number of messages
  - name: unread_only
    type: boolean
    required: false
    description: Only unread messages

[[tool]]
name: email_search
description: Search emails
params:
  - name: query
    type: string
    required: true
    description: Search query
  - name: folder
    type: string
    required: false
    description: Folder to search

## Script

async function email_send({ to, subject, body, from = '' }) {
  return {
    to,
    subject,
    from: from || 'configured@email',
    note: 'Configure SMTP in ~/.antenna/config.json',
    config: {
      smtp: {
        host: 'smtp.example.com',
        port: 587,
        username: 'user@example.com',
        password: 'APP_PASSWORD'
      }
    }
  };
}

function email_inbox({ limit = 10, unread_only = false }) {
  return {
    limit,
    unread_only,
    note: 'Configure IMAP in config.json',
    messages: []
  };
}

function email_search({ query, folder = 'INBOX' }) {
  return {
    query,
    folder,
    note: 'Search emails via IMAP',
    results: []
  };
}
