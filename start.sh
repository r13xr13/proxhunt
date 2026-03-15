#!/bin/bash

# Start Ollama in background if available
if command -v ollama &> /dev/null; then
    echo "Starting Ollama..."
    ollama serve &
    OLLAMA_PID=$!
    
    # Give Ollama a moment to start
    sleep 5
    
    # Pull required models if they don't exist (check with ollama list)
    MODELS=("llama3.2:latest" "llama3.1:8b-instruct-q4_K_M" "mistral:latest" "qwen2.5:7b" "phi3:latest")
    for model in "${MODELS[@]}"; do
        if ! ollama list | grep -q "$model"; then
            echo "Pulling model: $model"
            ollama pull "$model"
        else
            echo "Model $model already exists"
        fi
    done
else
    echo "Ollama not found. Starting server without AI features."
fi

# Start the Node.js server
node server/dist/index.js