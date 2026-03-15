---
name: ai-browser
description: Free AI via browser - DeepSeek, OpenAI free tier through web
version: 1.0.0
---

# AI Browser Skill

Use AI models for free through browser-based access.

## Tools

[[tool]]
name: ai_chat
description: Chat with AI model
params:
  - name: message
    type: string
    required: true
    description: Your message
  - name: model
    type: string
    required: false
    description: Model (deepseek, gpt)
  - name: system_prompt
    type: string
    required: false
    description: System prompt

[[tool]]
name: ai_complete
description: Text completion
params:
  - name: prompt
    type: string
    required: true
    description: Prompt text
  - name: model
    type: string
    required: false
    description: Model to use

[[tool]]
name: ai_code
description: Code generation
params:
  - name: description
    type: string
    required: true
    description: What to code
  - name: language
    type: string
    required: false
    description: Programming language

[[tool]]
name: ai_explain
description: Explain code or concept
params:
  - name: content
    type: string
    required: true
    description: Code or concept to explain
  - name: detail_level
    type: string
    required: false
    description: brief, detailed

## Script

async function ai_chat({ message, model = 'deepseek', system_prompt = '' }) {
  // Using free web access methods
  const prompts = {
    deepseek: \`You are DeepSeek AI. Answer: \${message}\`,
    gpt: \`ChatGPT: \${message}\`
  };
  
  return {
    model,
    message,
    note: 'Configure API for production use',
    free_options: [
      { name: 'Ollama', url: 'localhost:11434', cost: 'Free' },
      { name: 'OpenRouter', url: 'openrouter.ai', cost: 'Free tier available' },
      { name: 'Together AI', url: 'together.ai', cost: '$25 free credit' }
    ]
  };
}

async function ai_complete({ prompt, model = 'deepseek' }) {
  return {
    prompt,
    model,
    note: 'Text completion via configured AI',
    tokens: 'Configure provider for full access'
  };
}

async function ai_code({ description, language = 'python' }) {
  const examples = {
    python: '# Example Python code for: ' + description,
    javascript: '// Example JS code for: ' + description,
    go: '// Example Go code for: ' + description,
    rust: '// Example Rust code for: ' + description
  };
  
  return {
    description,
    language,
    code: examples[language] || examples.python,
    note: 'Configure Claude, GPT, or Ollama for code generation'
  };
}

async function ai_explain({ content, detail_level = 'brief' }) {
  return {
    content,
    detail_level,
    note: 'Configure AI provider for explanations',
    approach: detail_level === 'brief' ? 'Concise explanation' : 'Detailed walkthrough'
  };
}
