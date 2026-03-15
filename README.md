<div align="center">

# Conflict Globe

A real-time 3D OSINT visualization platform for global conflict and geopolitical events.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.0.0-green.svg)](https://github.com/r13xr13/conflict-globe.gl/releases)
[![TypeScript](https://img.shields.io/badge/TypeScript-98%25-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](https://hub.docker.com/)

[Demo](#demo) - [Quick Start](#quick-start) - [Configuration](#configuration) - [Architecture](#architecture)

<br/>

![Conflict Globe](https://raw.githubusercontent.com/r13xr13/conflict-globe.gl/main/Screenshot_11-Mar_21-07-37_14287.png)

</div>

---

## Overview

Conflict Globe is an open-source intelligence (OSINT) platform that aggregates and visualizes global conflict, maritime, air, cyber, and geopolitical events in real time on an interactive 3D globe. Built for analysts, researchers, and journalists who need a high-signal, low-latency view of world events.

---

## Features

### Real-Time Data Pipeline

- Live OSINT feed aggregation from multiple independent sources
- WebSocket (Socket.io) push updates - no client polling required
- Configurable auto-refresh intervals per source

### Visualization Layers

| Layer | Description |
|---|---|
| Points | Individual event markers with per-category color coding |
| HexBins | Hexagonal spatial clustering for density analysis |
| Heatmap | Continuous density surface from event distribution |
| Rings | Animated pulse rings at active event locations |
| Arcs | Directional connections between correlated events |
| Paths | Movement and trajectory tracking |
| Polygons | Regional boundary and aggregation overlays |

### Globe Controls

- Dark / Light themes
- Atmospheric glow, cloud layer, and bump-mapped terrain
- Lat/long graticule grid overlay
- Auto-rotation with drag-to-pause
- Client-side point clustering for smooth performance at scale

### Interaction & Filtering

- Click any marker for a full event detail panel
- Hover tooltips for at-a-glance previews
- Timeline slider for temporal filtering
- Category filter toggles
- Full-text search across all loaded events
- Export to JSON, GeoJSON, or CSV

### AI Integration

- Built-in AI chat interface accessible from the left panel
- Supports OpenRouter (cloud) and Ollama (self-hosted) backends
- Intelligent analysis and automation of OSINT events

### Event Categories

Conflict, Maritime, Air, Cyber, Land, Space, Radio, Weather, Earthquakes, Social Media

---

## Quick Start

### Docker

Requires Docker and Docker Compose.

```bash
git clone https://github.com/r13xr13/conflict-globe.gl.git
cd conflict-globe.gl
docker compose up -d
```

Open http://localhost:8080 in your browser.

### Local Development

Requires Node.js >= 18.

```bash
git clone https://github.com/r13xr13/conflict-globe.gl.git
cd conflict-globe.gl

# Install dependencies
cd client-3d && npm install
cd ../server && npm install

# Terminal 1 - Backend
cd server && npm run dev

# Terminal 2 - Frontend
cd client-3d && npm run dev
```

---

## Configuration

Copy `.env.example` to `.env` and configure your settings. All API keys are optional - many data feeds work without authentication.

```env
# Server
PORT=8080
NODE_ENV=production

# Cesium Ion (optional - for 3D globe tiles)
REACT_APP_CESIUM_ION_TOKEN=

# Data Source API Keys (optional)
NEWS_API_KEY=
GDELT_KEY=
WINDY_KEY=
OPENSKY_CLIENT_ID=
OPENSKY_CLIENT_SECRET=
ACLED_KEY=
ACLED_EMAIL=
AISSTREAM_KEY=
```

### AI Provider Configuration

Choose one AI backend for the Antenna Agent. OpenRouter is recommended for cloud deployments, Ollama for self-hosted.

**OpenRouter (Cloud)**

```env
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=openai/gpt-4o
```

Sign up at [openrouter.ai](https://openrouter.ai) to obtain an API key.

**Ollama (Self-Hosted)**

```env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:latest
```

See [Ollama documentation](https://ollama.ai) for setup instructions.

### Radio Signal Monitoring (Optional)

The platform supports integration with external radio frequency monitoring systems (SDR/SIGINT). If configured, live signal data will appear on the globe.

```env
ANTENNA_API_URL=http://your-antenna-service:port
```

Required endpoints on your antenna service:

| Endpoint | Description |
|---|---|
| /api/signals | Returns radio signals with frequency, location, and type |
| /api/status | Returns antenna system status |

If ANTENNA_API_URL is not set, the service is skipped and all other data sources continue to function normally.

---

## Data Sources

| Source | Domain |
|---|---|
| GDELT Project | Global events and media |
| UCDP Armed Conflict | Conflict datasets |
| MarineTraffic / AISStream | Maritime vessel tracking |
| OpenSky Network / ADS-B Exchange | Live aircraft positions |
| Space-Track / CelesTrak | Satellite tracking |
| NOAA / Windy.com | Weather data |
| USGS / EMSC | Seismic events |
| RSS news aggregation | Open-source media feeds |

---

## Architecture

```
conflict-globe.gl/
├── client-3d/          # React + Vite frontend (TypeScript)
│   ├── src/
│   │   └── App.tsx     # Root globe component and state
│   └── package.json
├── server/             # Express + TypeScript backend
│   ├── src/
│   │   ├── index.ts    # Entry point and Socket.io setup
│   │   ├── routes/     # REST API endpoints
│   │   └── services/   # Per-source OSINT data fetchers
│   └── package.json
├── discord-bot/        # AI-powered Discord bot
│   ├── index.js        # Bot commands and scheduler
│   └── ai-agent.js     # AI integration
├── antenna-agent/      # Antenna AI agent framework
├── globe.gl/          # Vendored custom globe.gl build
├── Dockerfile
└── docker-compose.yml
```

**Data flow:** OSINT sources - Express REST and Socket.io - React client - globe.gl WebGL renderer

---

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React, Vite, react-globe.gl, Three.js, TypeScript |
| Backend | Node.js, Express, TypeScript, Socket.io |
| AI | OpenRouter, Ollama, Antenna Agent |
| Bot | Discord.js, node-cron |
| Data | Axios, RSS parsers, REST OSINT APIs |
| Infrastructure | Docker, Docker Compose |

---

## Performance

- Client-side point clustering keeps render time stable at large event volumes
- Configurable max point count (50-500) to match hardware capability
- Auto-refresh throttling prevents API rate-limit exhaustion
- Memoized data processing avoids redundant React renders
- Code-split lazy loading reduces initial bundle size

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| R | Force data refresh |
| F | Toggle sidebar |
| H | Toggle dark / light theme |

---

## Contributing

Contributions are welcome. Please read CONTRIBUTING.md first.

1. Fork the repository
2. Create a feature branch: git checkout -b feature/your-feature
3. Commit your changes
4. Open a pull request against main

---

## License

Distributed under the MIT License.

---

## Acknowledgements

- globe.gl - WebGL globe rendering by Vasco Asturiano
- three-globe - Three.js globe plugin
- GDELT Project - Primary open-source event data provider
- Ollama - Local AI inference
- OpenRouter - Cloud AI routing
