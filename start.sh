#!/bin/bash

# Start the Node.js server
echo "Starting Conflict Globe server..."
echo "OLLAMA_BASE_URL: ${OLLAMA_BASE_URL:-not set}"
echo "OLLAMA_MODEL: ${OLLAMA_MODEL:-llama3.2:latest}"

node server/dist/index.js