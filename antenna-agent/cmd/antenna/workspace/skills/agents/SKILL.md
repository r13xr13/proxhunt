---
name: agents
description: Spawn background subagents for parallel task execution
version: 1.0.0
---

# Agents Skill

Spawn background subagents to handle multiple tasks in parallel.

## Tools

[[tool]]
name: spawn_researcher
description: Spawn a research subagent to gather information
params:
  - name: topic
    type: string
    required: true
    description: Topic to research
  - name: depth
    type: string
    required: false
    description: shallow, medium, or deep

[[tool]]
name: spawn_coder
description: Spawn a coding subagent to write or debug code
params:
  - name: task
    type: string
    required: true
    description: Coding task description
  - name: language
    type: string
    required: false
    description: Programming language

[[tool]]
name: spawn_writer
description: Spawn a writing subagent for content creation
params:
  - name: topic
    type: string
    required: true
    description: Topic to write about
  - name: style
    type: string
    required: false
    description: casual, formal, technical

[[tool]]
name: list_agents
description: List all active subagents
params: []

## Script

async function spawn_researcher({ topic, depth = "medium" }) {
  const depthPrompts = {
    shallow: "Quick 2-3 sentence summary",
    medium: "Comprehensive overview with key points",
    deep: "In-depth analysis with sources and details"
  };
  
  const task = `Research: ${topic}. ${depthPrompts[depth] || depthPrompts.medium}. Format as concise report.`;
  
  const { stdout } = await exec(`echo 'Spawning researcher for: ${topic}'`);
  return { status: "spawned", type: "researcher", topic, task };
}

async function spawn_coder({ task, language = "general" }) {
  const { stdout } = await exec(`echo 'Spawning coder for: ${task}'`);
  return { status: "spawned", type: "coder", task, language };
}

async function spawn_writer({ topic, style = "casual" }) {
  const { stdout } = await exec(`echo 'Spawning writer for: ${topic}'`);
  return { status: "spawned", type: "writer", topic, style };
}

async function list_agents() {
  return { 
    agents: [
      { name: "researcher", description: "Web research & information gathering" },
      { name: "coder", description: "Code writing, debugging & review" },
      { name: "writer", description: "Content creation & editing" },
      { name: "analyst", description: "Data analysis & reporting" }
    ]
  };
}
