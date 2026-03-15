import axios from "axios";

// Provider configurations
interface AIProvider {
  name: string;
  baseUrl: string;
  apiKey?: string;
  model: string;
  apiPath: string;
}

// Get active provider based on environment variables
function getActiveProvider(): AIProvider | null {
  // Priority: OPENROUTER > OLLAMA
  if (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_MODEL) {
    return {
      name: 'openrouter',
      baseUrl: 'https://openrouter.ai',
      apiKey: process.env.OPENROUTER_API_KEY,
      model: process.env.OPENROUTER_MODEL,
      apiPath: '/api/v1/chat/completions'
    };
  }
  
  if (process.env.OLLAMA_BASE_URL) {
    return {
      name: 'ollama',
      baseUrl: process.env.OLLAMA_BASE_URL,
      model: process.env.OLLAMA_MODEL || 'llama3.2:latest',
      apiPath: '/api/chat'
    };
  }
  
  return null;
}

// System prompt for Conflict Globe
const SYSTEM_PROMPT = `You are a helpful AI assistant for the Conflict Globe OSINT platform. 
You help users analyze global conflicts, maritime events, air traffic, cyber threats, and other geopolitical intelligence.
Provide concise, accurate, and helpful responses.
If you don't know something, say so rather than making up information.`;

export async function chatWithAI(message: string, history: {role: string, content: string}[] = []): Promise<string> {
  const provider = getActiveProvider();
  
  if (!provider) {
    return "AI chat is not configured. Please set either OPENROUTER_API_KEY or OLLAMA_BASE_URL environment variables.";
  }

  try {
    // Prepare messages
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT }
    ];
    
    // Add history
    history.forEach(h => {
      messages.push({ role: h.role, content: h.content });
    });
    
    // Add the current message
    messages.push({ role: 'user', content: message });
    
    let response;
    
    if (provider.name === 'openrouter') {
      // OpenRouter uses OpenAI-compatible API
      response = await axios.post(
        `${provider.baseUrl}${provider.apiPath}`,
        {
          model: provider.model,
          messages: messages,
          max_tokens: 2000,
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${provider.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000 // 60 second timeout for external APIs
        }
      );
      return response.data.choices[0].message.content;
    } else {
      // Ollama
      response = await axios.post(
        `${provider.baseUrl}${provider.apiPath}`,
        {
          model: provider.model,
          messages: messages,
          stream: false
        },
        {
          timeout: 30000
        }
      );
      return response.data.message.content;
    }
  } catch (error: any) {
    console.error(`Error with ${provider?.name || 'AI'}:`, error.message);
    
    if (error.response) {
      // API returned an error
      const status = error.response.status;
      const data = error.response.data;
      console.error(`API Error ${status}:`, data);
      
      if (status === 401) {
        return `Authentication error with ${provider.name}. Please check your API key.`;
      }
      if (status === 429) {
        return `Rate limit exceeded for ${provider.name}. Please try again later.`;
      }
      if (status === 404) {
        return `Model not found for ${provider.name}. Please check your model configuration.`;
      }
    }
    
    if (error.code === 'ECONNREFUSED') {
      return `Could not connect to ${provider.name}. Please ensure it's running and configured correctly.`;
    }
    if (error.code === 'ENOTFOUND') {
      return `${provider.name} host not found. Please check your configuration.`;
    }
    
    return `Sorry, I encountered an error while contacting ${provider.name}. Please try again later.`;
  }
}

// Legacy function for backward compatibility
export async function chatWithOllama(message: string, history: {role: string, content: string}[] = []): Promise<string> {
  return chatWithAI(message, history);
}