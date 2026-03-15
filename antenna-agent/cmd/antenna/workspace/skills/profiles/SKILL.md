---
name: profiles
description: Agent personality profiles and role configurations
version: 1.0.0
---

# Profiles Skill

Create and manage different agent personalities and configurations.

## Setup

Profiles stored in `~/.antenna/profiles/`

## Tools

[[tool]]
name: profiles_list
description: List all available profiles
params: []

[[tool]]
name: profiles_create
description: Create a new agent profile
params:
  - name: name
    type: string
    required: true
    description: Profile name
  - name: personality
    type: string
    required: true
    description: Personality description
  - name: system_prompt
    type: string
    required: false
    description: Custom system prompt
  - name: model
    type: string
    required: false
    description: Model to use

[[tool]]
name: profiles_activate
description: Activate a profile
params:
  - name: name
    type: string
    required: true
    description: Profile name to activate

[[tool]]
name: profiles_get
description: Get current active profile
params: []

## Script

const PROFILES_DIR = home() + "/.antenna/profiles";

async function ensureProfilesDir() {
  const fs = await import('fs');
  if (!fs.existsSync(PROFILES_DIR)) {
    fs.mkdirSync(PROFILES_DIR, { recursive: true });
  }
}

async function profiles_list() {
  const fs = await import('fs');
  await ensureProfilesDir();
  
  const files = fs.readdirSync(PROFILES_DIR).filter(f => f.endsWith('.json'));
  const profiles = files.map(f => {
    const data = JSON.parse(fs.readFileSync(PROFILES_DIR + "/" + f, 'utf8'));
    return { name: f.replace('.json', ''), ...data };
  });
  
  // Check active
  const activeFile = PROFILES_DIR + "/.active";
  const active = fs.existsSync(activeFile) ? fs.readFileSync(activeFile, 'utf8').trim() : "default";
  
  return { profiles, active };
}

async function profiles_create({ name, personality, system_prompt = "", model = "ollama/llama3.2" }) {
  const fs = await import('fs');
  await ensureProfilesDir();
  
  const profile = {
    name,
    personality,
    system_prompt: system_prompt || `You are ${name}. ${personality}`,
    model,
    created: new Date().toISOString()
  };
  
  fs.writeFileSync(PROFILES_DIR + "/" + name + ".json", JSON.stringify(profile, null, 2));
  
  return { success: true, profile };
}

async function profiles_activate({ name }) {
  const fs = await import('fs');
  await ensureProfilesDir();
  
  const profileFile = PROFILES_DIR + "/" + name + ".json";
  if (!fs.existsSync(profileFile)) {
    return { error: "Profile not found" };
  }
  
  const activeFile = PROFILES_DIR + "/.active";
  fs.writeFileSync(activeFile, name);
  
  return { success: true, active: name };
}

async function profiles_get() {
  const fs = await import('fs');
  await ensureProfilesDir();
  
  const activeFile = PROFILES_DIR + "/.active";
  const active = fs.existsSync(activeFile) ? fs.readFileSync(activeFile, 'utf8').trim() : "default";
  
  const profileFile = PROFILES_DIR + "/" + active + ".json";
  if (fs.existsSync(profileFile)) {
    const profile = JSON.parse(fs.readFileSync(profileFile, 'utf8'));
    return { active, profile };
  }
  
  return { active: "default", profile: { name: "default", personality: "Helpful assistant" } };
}
