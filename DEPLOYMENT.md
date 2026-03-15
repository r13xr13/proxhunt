# Conflict Globe Deployment Guide

## Stack Overview

### Core Application
- **Web Server** (Port 8080) - Main React UI + Node.js API
- **Discord Bot** (Port 3001) - AI-powered OSINT notifications
- **Portainer** (Port 9000) - Container management UI
- **Ollama** (Port 11434) - Local AI models
- **Sigil7** (Port 11435) - Kali Linux pentest tools
- **MemOS** (Port 5230) - Self-hosted notes
- **SearXNG** (Port 8888) - Meta search engine
- **Antenna Agent** (Port 18790) - AI OSINT agent

## Deployment Options

### 1. Local Docker (Development)
```bash
cd /home/c0smic/conflict-globe
docker compose up -d
```

### 2. Railway/VPS Deployment
1. Push repo to GitHub
2. Connect Railway to GitHub repo
3. Add environment variables:
   - `DISCORD_BOT_TOKEN` - Discord bot token
   - `OPENROUTER_API_KEY` - For AI (optional)
   - `PORTAINER_ADMIN_PASSWORD` - Portainer admin password

### 3. Environment Variables

```env
# AI Configuration
OPENROUTER_API_KEY=your_key_here
OLLAMA_BASE_URL=http://localhost:11434

# Discord
DISCORD_BOT_TOKEN=your_discord_token

# API Keys (Optional)
CESIUM_ION_TOKEN=your_cesium_token

# Portainer
PORTAINER_ADMIN_PASSWORD=admin123
```

## API Endpoints

### Camera Scanner
- `GET /api/intelligence/cameras` - Get all cameras + markers
- `GET /api/intelligence/cameras/insecam` - Get Insecam cameras
- `GET /api/intelligence/cameras/traffic` - Get traffic cameras

### Google Dork Generator
- `GET /api/intelligence/dorks?target=example.com` - Generate dorks
- `GET /api/intelligence/dorks/execute?query=...` - Execute search

### AI Chat
- `POST /api/ai/chat` - Chat with local Ollama/OpenRouter

### Intelligence Services
- `GET /api/intelligence/health` - Service health check
- `GET /api/intelligence/patterns` - Get pattern recognition results
- `POST /api/intelligence/insights` - Analyze events

## UI Features

### Panels (Right Side)
- **CAM** - Camera viewer with Google Dork generator
- **OSNT** - OSINT tools (IP, domain, email lookup)
- **AGNT** - AI Agent (Antenna) chat
- **INT** - Intelligence center (threats, bug bounty, pentest)
- **Portainer** - Container management

### Globe Features
- 3D camera markers (▲) at major locations
- Color-coded: Pink = Traffic, Purple = Public webcams
- Click markers to view camera feeds

## Monitoring

```bash
# View logs
docker logs conflict-globe-web
docker logs conflict-globe-discord-bot

# Check containers
docker ps
```

## Railway Configuration

Create `railway.json`:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "nixpacks",
    "buildCommand": "cd server && npm install && npm run build && cd ../client-3d && npm install && npm run build",
    "startCommand": "cd server && npm start"
  },
  "deploy": {
    "startCommand": "cd server && npm start"
  }
}
```

## Security Notes

- Change default passwords before deployment
- Use HTTPS in production
- Restrict Portainer access
- Keep API keys secure in environment variables
