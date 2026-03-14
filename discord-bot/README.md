# Conflict Globe Discord Bot

AI-powered Discord bot for the Conflict Globe OSINT platform. Analyzes real-time conflict data using Ollama AI and posts updates to Discord channels.

## Installation

```bash
npm install @c0smic/conflict-globe-discord
```

## Configuration

Create a `.env` file:

```env
DISCORD_BOT_TOKEN=your_bot_token
CONFLICT_GLOBE_API=http://localhost:8080/api/conflicts
OLLAMA_BASE_URL=http://localhost:11434
LIVE_UPDATES_CHANNEL_ID=
THREAT_ALERTS_CHANNEL_ID=
GENERAL_CHANNEL_ID=
DEV_CHANNEL_ID=
```

## Usage

```bash
npm start
```

## Features

- Real-time conflict event updates (every 15 min)
- AI-written news articles (every hour)
- Server stats posting (every hour)
- Threat alert analysis (every 30 min)
- Slash commands: /status, /threats, /news, /events

## AI Models

The bot automatically selects the best Ollama model per category:
- `llama3.2:latest` - Conflict, cyber, social, cameras
- `qwen2.5:7b` - Maritime, space
- `llama3.1:8b-instruct` - Air
- `mistral:latest` - Weather, earthquakes
- `phi3:latest` - Radio

## License

MIT
