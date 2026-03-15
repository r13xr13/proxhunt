---
name: plugins
description: Dynamic plugin loading and management
version: 1.0.0
---

# Plugins Skill

Load and manage dynamic plugins to extend Antenna functionality.

## Setup

Plugins stored in `~/.antenna/plugins/`

## Tools

[[tool]]
name: plugins_list
description: List loaded plugins
params: []

[[tool]]
name: plugins_install
description: Install a plugin from URL or file
params:
  - name: source
    type: string
    required: true
    description: URL or file path
  - name: name
    type: string
    required: true
    description: Plugin name

[[tool]]
name: plugins_unload
description: Unload a plugin
params:
  - name: name
    type: string
    required: true
    description: Plugin name

[[tool]]
name: plugins_reload
description: Reload all plugins
params: []

## Script

const PLUGINS_DIR = home() + "/.antenna/plugins";
const LOADED_PLUGINS = {};

async function ensurePluginsDir() {
  const fs = await import('fs');
  if (!fs.existsSync(PLUGINS_DIR)) {
    fs.mkdirSync(PLUGINS_DIR, { recursive: true });
  }
}

async function plugins_list() {
  await ensurePluginsDir();
  
  const fs = await import('fs');
  const files = fs.readdirSync(PLUGINS_DIR).filter(f => f.endsWith('.js') || f.endsWith('.so'));
  
  return {
    loaded: Object.keys(LOADED_PLUGINS),
    available: files,
    note: "Go plugins (.so) require recompilation. JS plugins experimental."
  };
}

async function plugins_install({ source, name }) {
  const fs = await import('fs');
  const path = await import('path');
  await ensurePluginsDir();
  
  // Download from URL
  if (source.startsWith('http')) {
    const { exec } = await import('child_process');
    try {
      await new Promise((resolve, reject) => {
        exec(`curl -sL "${source}" -o ${PLUGINS_DIR}/${name}.js`, (err) => {
          if (err) reject(err);
          else resolve(true);
        });
      });
      return { success: true, name, file: `${PLUGINS_DIR}/${name}.js` };
    } catch {
      return { error: "Failed to download plugin" };
    }
  }
  
  // Local file
  if (fs.existsSync(source)) {
    const dest = PLUGINS_DIR + "/" + name + path.extname(source);
    fs.copyFileSync(source, dest);
    return { success: true, name, file: dest };
  }
  
  return { error: "Source not found" };
}

async function plugins_unload({ name }) {
  if (LOADED_PLUGINS[name]) {
    delete LOADED_PLUGINS[name];
    return { success: true, unloaded: name };
  }
  return { error: "Plugin not loaded" };
}

async function plugins_reload() {
  const keys = Object.keys(LOADED_PLUGINS);
  for (const key of keys) {
    delete LOADED_PLUGINS[key];
  }
  
  return { 
    success: true, 
    reloaded: 0,
    note: "JS plugins would be re-evaluated here"
  };
}
