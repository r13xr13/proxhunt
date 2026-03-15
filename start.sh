#!/bin/bash

# Start Ollama in background
ollama serve &

# Give Ollama a moment to start
sleep 5

# Pull the required models if they don't exist
ollama pull llama3.2:latest
ollama pull llama3.1:8b-instruct-q4_K_M
ollama pull mistral:latest
ollama pull qwen2.5:7b
ollama pull phi3:latest

# Start the Node.js server
node server/dist/index.js