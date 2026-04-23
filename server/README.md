# ProxHunt Server

API server for ProxHunt RFID platform.

## Installation

```bash
npm install
```

## Usage

```bash
# Development
npm run dev

# Production
npm run build
npm run start
```

## API Endpoints

- `POST /api/rfid/discoveries` - Submit RFID discovery
- `GET /api/rfid/discoveries` - Query discoveries
- `POST /api/rfid/readers` - Register reader
- `POST /api/rfid/readers/:id/heartbeat` - Device heartbeat
- `GET /api/rfid/leaderboard` - Top players

## Environment Variables

```env
PORT=8080
DISCORD_BOT_TOKEN=
DISCORD_CHANNEL_ID=
```

## License

MIT