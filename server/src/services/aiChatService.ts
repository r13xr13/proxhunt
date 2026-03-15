import axios from "axios";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_API = `${OLLAMA_BASE_URL}/api`;
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:latest';

export async function chatWithOllama(message: string, history: {role: string, content: string}[] = []): Promise<string> {
  // Check if Ollama is configured
  if (!process.env.OLLAMA_BASE_URL) {
    return "AI chat is not configured. Please set OLLAMA_BASE_URL environment variable to connect to an Ollama instance.";
  }

  try {
    // Prepare the messages for Ollama
    const messages = [
      { role: 'system', content: 'You are a helpful AI assistant for the Conflict Globe OSINT platform. Provide concise, accurate, and helpful responses.' }
    ];
    
    // Add history
    history.forEach(h => {
      messages.push({ role: h.role, content: h.content });
    });
    
    // Add the current message
    messages.push({ role: 'user', content: message });
    
    const response = await axios.post(`${OLLAMA_API}/chat`, {
      model: OLLAMA_MODEL,
      messages: messages,
      stream: false
    }, {
      timeout: 30000 // 30 second timeout
    });
    
    return response.data.message.content;
  } catch (error: any) {
    console.error('Error chatting with Ollama:', error.message);
    if (error.code === 'ECONNREFUSED') {
      return "Could not connect to Ollama. Please ensure Ollama is running and OLLAMA_BASE_URL is set correctly.";
    }
    if (error.code === 'ENOTFOUND') {
      return "Ollama host not found. Please check your OLLAMA_BASE_URL configuration.";
    }
    return "Sorry, I encountered an error while contacting the AI service. Please try again later.";
  }
}