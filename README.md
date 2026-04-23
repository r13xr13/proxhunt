# ProxHunt

Gameified RFID wardriving platform - WiGLE for RFID tags.

![ProxHunt](https://raw.githubusercontent.com/r13xr13/proxhunt/main/screenshot.png)

## Overview

ProxHunt aggregates and visualizes RFID tag discoveries from distributed ESP32/Raspberry Pi readers in real-time on an interactive 3D globe. Players compete to collect unique tags and earn points.

## Features

- **Real-Time Globe** - 3D visualization of RFID discoveries on WebGL globe
- **Gamification** - Points, levels, leaderboards
- **Discord Bot** - `!leaderboard`, `!stats` commands
- **REST API** - Submit discoveries from any RFID reader
- **SQLite DB** - Local discovery storage

## Quick Start

```bash
git clone https://github.com/r13xr13/proxhunt.git
cd proxhunt

# Install dependencies
cd server && npm install
cd ../client-3d && npm install

# Run
# Terminal 1: cd server && npm run dev
# Terminal 2: cd client-3d && npm run dev
```

Open http://localhost:5173

## Configuration

```bash
cp .env.example .env
# Edit .env with your settings
```

## Tech Stack

| Component | Tech |
|---|---|
| Frontend | React, Vite, react-globe.gl, Three.js |
| Backend | Express, Socket.io, SQLite |
| Bot | Discord.js |

## API

| Endpoint | Method | Use |
|---|---|---|
| `/api/rfid/discoveries` | POST | Submit discovery |
| `/api/rfid/discoveries` | GET | Query discoveries |
| `/api/rfid/readers` | POST | Register reader |
| `/api/rfid/leaderboard` | GET | Top players |

## Hardware Integration

### ESP32

```cpp
HTTPClient http;
http.begin("http://YOUR_SERVER:8080/api/rfid/discoveries");
http.addHeader("Content-Type", "application/json");
http.POST("{\"tag_id\":\"A1B2C3D4\",\"reader_id\":\"esp32-01\",\"latitude\":37.7749,\"longitude\":-122.4194,\"signal_strength\":-65}");
```

See `SPEC.md` for full hardware examples.

## License

MIT