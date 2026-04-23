# ProxHunt - RFID Wardriving Platform

Gameified RFID discovery platform for RFID tag mapping

## Overview

ProxHunt aggregates and visualizes RFID tag discoveries from distributed ESP32/Raspberry Pi readers in real-time on an interactive 3D globe. Players compete to collect unique tags and earn points.

## Data Flow

```
ESP32/RPi Readers → REST API → Backend → Socket.io → React Globe
                                          ↓
                                      Discord Bot
```

## Architecture

| Component | Description |
|---|---|
| client-3d | React + Vite + react-globe.gl (WebGL 3D globe) |
| server | Express + TypeScript + Socket.io |
| discord-bot | Leaderboards, check-ins, notifications |
| Database | SQLite/PostgreSQL (discoveries, players, points) |

## Features

### Real-Time Data Pipeline

- REST API endpoint for RFID reader submissions
- WebSocket push to all connected clients
- Configurable auto-refresh intervals
- Device check-in/heartbeat system

### Globe Visualization

| Layer | Description |
|---|---|
| Points | Individual RFID tag discoveries |
| Rings | Animated pulse at discovery locations |
| Heatmap | Tag density clustering |
| Paths | Reader movement/trajectory |

### Gamification

| Mechanic | Points |
|---|---|
| First discovery | +100 pts |
| Unique tag collection | +50 pts/tag |
| Signal strength bonus | +10 to +25 |
| Geographic diversity | +100 pts/region |
| Daily streak | +20 pts/day |

### Level System

| Level | Points Required |
|---|---|
| Novice | 0 |
| Scout | 500 |
| Hunter | 2,500 |
| Tracker | 10,000 |
| Ranger | 50,000 |
| Legend | 200,000 |

### Discord Integration

- `/leaderboard` - Top collectors
- `/stats` - Personal stats
- `/checkin` - Manual discovery check-in
- New discovery notifications
- Weekly/monthly challenges

## Data Model

### Discovery

```
{
  id: UUID,
  tag_id: string (RFID tag identifier),
  reader_id: string (device identifier),
  latitude: number,
  longitude: number,
  signal_strength: number (RSSI),
  timestamp: datetime,
  tag_type: string (LF/HF/UHF),
  first_discovered_by: player_id
}
```

### Player

```
{
  id: UUID,
  username: string,
  discord_id: string?,
  total_points: number,
  level: string,
  discovery_count: number,
  unique_tags: number[],
  created_at: datetime
}
```

### Reader Device

```
{
  id: string,
  name: string,
  owner: player_id,
  location: { lat, lng },
  last_seen: datetime,
  status: online/offline
}
```

## REST API

| Endpoint | Method | Description |
|---|---|---|
| `/api/discoveries` | POST | Submit new discovery |
| `/api/discoveries` | GET | Query discoveries |
| `/api/readers` | POST | Register new reader |
| `/api/readers/:id/heartbeat` | POST | Reader heartbeat |
| `/api/players` | GET | Leaderboard |
| `/api/players/:id/stats` | GET | Player stats |

## Configuration

```bash
# Server
PORT=8080
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/proxhunt

# Discord Bot
DISCORD_BOT_TOKEN=
DISCORD_GUILD_ID=
DISCORD_CHANNEL_ID=

# Optional: Public RFID enrichment
# (future integration)
```

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React, Vite, react-globe.gl, Three.js, TypeScript |
| Backend | Node.js, Express, TypeScript, Socket.io, SQLite/PostgreSQL |
| Bot | Discord.js |
| Hardware | ESP32, Raspberry Pi, RC522, PN532 |

## Setup

```bash
# Clone and install
git clone https://github.com/<your-org>/ProxHunt.git
cd ProxHunt

# Install dependencies
cd client-3d && npm install
cd ../server && npm install

# Configure
cp .env.example .env
# Edit .env with your settings

# Run
# Terminal 1 - Backend
cd server && npm run dev

# Terminal 2 - Frontend
cd client-3d && npm run dev
```

## Hardware Integration

### ESP32 RFID Reader

```cpp
#include <WiFi.h>
#include <HTTPClient.h>

const char* serverUrl = "http://your-server:8080/api/discoveries";

void sendDiscovery(String tagId, float lat, float lng, int rssi) {
  HTTPClient http;
  http.begin(serverUrl);
  http.addHeader("Content-Type", "application/json");
  
  StaticJsonDocument<256> doc;
  doc["tag_id"] = tagId;
  doc["reader_id"] = DEVICE_ID;
  doc["latitude"] = lat;
  doc["longitude"] = lng;
  doc["signal_strength"] = rssi;
  
  String payload;
  serializeJson(doc, payload);
  http.POST(payload);
}
```

### RPi + USB RFID Reader

```python
import requests
import serial
import gpsd

gpsd.connect()
ser = serial.Serial('/dev/ttyUSB0', 9600)

while True:
  tag = ser.readline().decode().strip()
  pos = gpsd.get_current()
  
  requests.post('http://your-server:8080/api/discoveries', json={
    'tag_id': tag,
    'reader_id': DEVICE_ID,
    'latitude': pos.lat,
    'longitude': pos.lon,
    'signal_strength': -50  # USB readers may not have RSSI
  })
```

## License

MIT License