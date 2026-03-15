---
name: code-helper
description: Help with code analysis, debugging, and explanation
version: 1.0.0
---

# Code Helper Skill

Analyze code, explain errors, and help debug issues.

## Tools

[[tool]]
name: analyze_code
description: Analyze code for issues and improvements
params:
  - name: code
    type: string
    required: true
    description: The code to analyze
  - name: language
    type: string
    required: false
    description: Programming language

[[tool]]
name: explain_error
description: Explain a programming error
params:
  - name: error
    type: string
    required: true
    description: The error message
  - name: language
    type: string
    required: false
    description: Programming language

## Script

function analyze_code({ code, language = "unknown" }) {
  const issues = [];
  const lines = code.split('\n');
  
  // Basic checks
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    // Check for console.log in production code
    if (line.includes('console.log') && language === 'javascript') {
      issues.push({ line: lineNum, type: 'warning', message: 'Consider removing console.log for production' });
    }
    
    // Check for TODO
    if (line.toLowerCase().includes('todo')) {
      issues.push({ line: lineNum, type: 'info', message: 'TODO comment found' });
    }
    
    // Check for debugger
    if (line.includes('debugger')) {
      issues.push({ line: lineNum, type: 'warning', message: 'debugger statement found' });
    }
  }
  
  return {
    language,
    lines: lines.length,
    issues,
    summary: issues.length === 0 ? 'No obvious issues found' : \`Found \${issues.length} potential issue(s)\`
  };
}

function explain_error({ error, language = "unknown" }) {
  const error Explanations = {
    'javascript': {
      'undefined is not a function': 'You are trying to call something that is undefined. Check variable names and imports.',
      'cannot read property': 'You are trying to access a property on undefined or null.',
      'syntaxerror': 'There is a syntax error in your code. Check for missing brackets or quotes.',
      'referenceerror': 'A variable is being used that has not been declared.'
    },
    'python': {
      'indentationerror': 'Check your indentation - Python uses whitespace.',
      'nameerror': 'A variable or function name is not defined.',
      'syntaxerror': 'There is a syntax error in your code.',
      'typeerror': 'You are trying to use a value of the wrong type.'
    }
  };
  
  const lowerError = error.toLowerCase();
  let explanation = 'Unknown error. Please search for more details.';
  
  const langExplanations = errorExplanations[language] || errorExplanations['javascript'];
  for (const [key, value] of Object.entries(langExplanations)) {
    if (lowerError.includes(key)) {
      explanation = value;
      break;
    }
  }
  
  return { error, explanation };
}
