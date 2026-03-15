# Build frontend
FROM node:20-slim AS client-build
WORKDIR /app/client-3d
COPY client-3d/package*.json ./
RUN npm install
COPY client-3d/ ./
RUN npm run build

# Build backend
FROM node:20-slim AS server-build
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install
COPY server/ ./
RUN npm run build

# Runtime
FROM node:20-slim
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
# OLLAMA_BASE_URL should be set via Railway environment variables
# Example: OLLAMA_BASE_URL=http://host.docker.internal:11434 (for local machine access)
# Or: OLLAMA_BASE_URL=https://your-ollama-server.com

COPY --from=server-build /app/server/dist ./server/dist
COPY --from=server-build /app/server/node_modules ./server/node_modules
COPY --from=client-build /app/client-3d/dist ./client-build
COPY server/package*.json ./server/

EXPOSE 8080

# Start the Node.js server directly (no Ollama installation needed)
CMD ["node", "server/dist/index.js"]