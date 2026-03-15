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
ENV OLLAMA_BASE_URL=http://localhost:11434

# Install Ollama dependencies
RUN apt-get update && apt-get install -y curl zstd && \
    curl -fsSL https://ollama.com/install.sh | sh && \
    rm -rf /var/lib/apt/lists/*

COPY --from=server-build /app/server/dist ./server/dist
COPY --from=server-build /app/server/node_modules ./server/node_modules
COPY --from=client-build /app/client-3d/dist ./client-build
COPY server/package*.json ./server/

# Create a startup script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 8080

CMD ["/app/start.sh"]