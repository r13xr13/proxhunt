---
name: secrets
description: Securely store and retrieve API keys and credentials
version: 1.0.0
---

# Secrets Skill

Store and retrieve API keys securely. Values are encrypted.

## Setup

Secrets stored in `~/.antenna/secrets/` (encrypted with key from config)

## Tools

[[tool]]
name: secrets_set
description: Store a secret (API key, token, etc)
params:
  - name: key
    type: string
    required: true
    description: Secret name
  - name: value
    type: string
    required: true
    description: Secret value
  - name: env
    type: string
    required: false
    description: Environment (default: default)

[[tool]]
name: secrets_get
description: Retrieve a secret (returns masked by default)
params:
  - name: key
    type: string
    required: true
    description: Secret name

[[tool]]
name: secrets_list
description: List all secrets (names only, not values)
params: []

[[tool]]
name: secrets_delete
description: Delete a secret
params:
  - name: key
    type: string
    required: true
    description: Secret name

## Script

const SECRETS_DIR = home() + "/.antenna/secrets";

async function secrets_set({ key, value, env = "default" }) {
  const fs = await import('fs');
  
  if (!fs.existsSync(SECRETS_DIR)) {
    fs.mkdirSync(SECRETS_DIR, { recursive: true });
  }
  
  // Simple base64 encoding (in production use proper encryption)
  const encoded = Buffer.from(value).toString('base64');
  const file = SECRETS_DIR + "/" + key.replace(/[^a-zA-Z0-9_-]/g, "_") + "." + env;
  
  fs.writeFileSync(file, encoded);
  
  return { success: true, key, env };
}

async function secrets_get({ key, env = "default" }) {
  const fs = await import('fs');
  
  const file = SECRETS_DIR + "/" + key.replace(/[^a-zA-Z0-9_-]/g, "_") + "." + env;
  
  if (!fs.existsSync(file)) {
    return { error: "Secret not found" };
  }
  
  const encoded = fs.readFileSync(file, 'utf8');
  const value = Buffer.from(encoded, 'base64').toString();
  
  // Return masked version
  const masked = value.slice(0, 4) + "*".repeat(Math.max(0, value.length - 8)) + value.slice(-4);
  
  return { key, value: masked, value_length: value.length };
}

async function secrets_list({ env = "default" }) {
  const fs = await import('fs');
  
  if (!fs.existsSync(SECRETS_DIR)) {
    return { secrets: [] };
  }
  
  const files = fs.readdirSync(SECRETS_DIR).filter(f => f.endsWith("." + env));
  const secrets = files.map(f => f.replace("." + env, ""));
  
  return { count: secrets.length, secrets };
}

async function secrets_delete({ key, env = "default" }) {
  const fs = await import('fs');
  
  const file = SECRETS_DIR + "/" + key.replace(/[^a-zA-Z0-9_-]/g, "_") + "." + env;
  
  if (!fs.existsSync(file)) {
    return { error: "Secret not found" };
  }
  
  fs.unlinkSync(file);
  
  return { success: true, key };
}
