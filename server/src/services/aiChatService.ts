import axios from "axios";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_API = `${OLLAMA_BASE_URL}/api`;

export async function chatWithOllama(message: string, history: {role: string, content: string}[] = []): Promise<string> {
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
      model: 'llama3.2:latest', // You can make this configurable
      messages: messages,
      stream: false
    });
    
    return response.data.message.content;
  } catch (error) {
    console.error('Error chatting with Ollama:', error);
    throw new Error('Failed to get response from AI');
  }
}