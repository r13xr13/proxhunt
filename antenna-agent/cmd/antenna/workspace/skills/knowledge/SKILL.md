---
name: knowledge
description: RAG knowledge base for Q&A over documents
version: 1.0.0
---

# Knowledge Skill

Search and query your knowledge base using RAG (Retrieval Augmented Generation).

## Setup

Knowledge files stored in `~/.antenna/knowledge/`

## Tools

[[tool]]
name: knowledge_add
description: Add a document to knowledge base
params:
  - name: name
    type: string
    required: true
    description: Document name
  - name: content
    type: string
    required: true
    description: Document content

[[tool]]
name: knowledge_search
description: Search knowledge base
params:
  - name: query
    type: string
    required: true
    description: Search query
  - name: limit
    type: number
    required: false
    description: Max results (default 5)

[[tool]]
name: knowledge_list
description: List all knowledge documents
params: []

## Script

const KNOWLEDGE_DIR = home() + "/.antenna/knowledge";

async function knowledge_add({ name, content }) {
  const fs = await import('fs');
  
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
  }
  
  const file = KNOWLEDGE_DIR + "/" + name.replace(/[^a-zA-Z0-9.-]/g, "_") + ".txt";
  fs.writeFileSync(file, content);
  
  return { success: true, document: name, file };
}

async function knowledge_search({ query, limit = 5 }) {
  const fs = await import('fs');
  
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    return { results: [], message: "No knowledge base yet" };
  }
  
  const files = fs.readdirSync(KNOWLEDGE_DIR).filter(f => f.endsWith('.txt'));
  const results = [];
  
  for (const file of files) {
    const content = fs.readFileSync(KNOWLEDGE_DIR + "/" + file, 'utf8');
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();
    
    if (lowerContent.includes(lowerQuery)) {
      const lines = content.split('\n');
      const matchedLines = lines.filter(l => l.toLowerCase().includes(lowerQuery));
      results.push({
        document: file.replace('.txt', ''),
        matched: matchedLines.slice(0, 3).join('\n'),
        relevance: matchedLines.length
      });
    }
  }
  
  results.sort((a, b) => b.relevance - a.relevance);
  
  return { query, results: results.slice(0, limit) };
}

async function knowledge_list() {
  const fs = await import('fs');
  
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    return { documents: [] };
  }
  
  const files = fs.readdirSync(KNOWLEDGE_DIR).filter(f => f.endsWith('.txt'));
  
  return { 
    count: files.length, 
    documents: files.map(f => ({
      name: f.replace('.txt', ''),
      added: fs.statSync(KNOWLEDGE_DIR + "/" + f).mtime
    }))
  };
}
