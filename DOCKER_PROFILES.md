# Docker Profiles - Resource Management

## On-Demand Containers (Spin up when needed)

### AI Models (Profile: ai)
```bash
docker compose --profile ai up -d ollama
```
- **Ollama** (11434) - Local AI models
- Used by: Discord bot, Antenna agent
- Cost: ~2GB RAM when running

### Pentest Tools (Profile: pentest)
```bash
docker compose --profile pentest up -d sigil7
```
- **Sigil7** (11435) - Kali Linux tools
- Used by: Manual pentesting from UI
- Cost: ~1GB RAM when running

### Discord Bot (Profile: discord)
```bash
docker compose --profile discord up -d discord-bot
```
- **Discord Bot** (3001) - AI notifications
- Requires: Valid DISCORD_BOT_TOKEN in .env
- Cost: Minimal (~100MB RAM)

## Always-On Containers (Core Services)

### Web Application (Port 8080)
```bash
docker compose up -d web
```
- Main Conflict Globe UI
- API server
- Intelligence services

### Portainer (Port 9000)
```bash
docker compose up -d portainer
```
- Container management UI
- Admin dashboard

### MemOS (Port 5230)
```bash
docker compose up -d memos
```
- Self-hosted notes

### SearXNG (Port 8888)
```bash
docker compose up -d searxng
```
- Meta search engine

## Resource-Optimized Deployment

### Minimal (Always-On Only)
```bash
docker compose up -d web portainer memos searxng
```

### Full Stack (All Services)
```bash
docker compose up -d
```

### With Profiles
```bash
# AI + Discord
docker compose --profile ai --profile discord up -d

# Full with profiles
docker compose --profile ai --profile pentest --profile discord up -d
```

## Container Status Check
```bash
docker ps
docker ps -a  # Include stopped containers
```

## Stop On-Demand Containers
```bash
docker stop ollama sigil7 conflict-globe-discord-bot
```
