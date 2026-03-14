# Conflict Globe Discord Bot Integration

## Current Status

### Conflict Globe Application
- ✅ **Running**: All Docker containers are active
- ✅ **Web Interface**: http://localhost:8080 (HTTP 200)
- ✅ **API**: http://localhost:8080/api/conflicts (returning data)
- ✅ **N8N Workflow**: Discord alerts configured

### Discord Bot (Separate)
- ✅ **Running**: Bot process active (PID 2489294)
- ✅ **Commands**: `!conflict news`, `!conflict status`, `!conflict help`
- ⚠️ **Integration**: Not yet connected to Conflict Globe data

## Integration Options

### Option 1: Use Built-in N8N Discord Webhook
The Conflict Globe application already has a Discord webhook configured in N8N.

**Webhook URL**: `https://discord.com/api/webhooks/1482135247977054419/...`

To use this:
1. Open N8N at http://localhost:5678
2. Login with: admin / conflict
3. Enable the "Conflict Globe - Discord Alerts" workflow
4. Alerts will be sent to your Discord channel

### Option 2: Custom Bot Integration
Modify the Discord bot to fetch data from Conflict Globe API:

1. Update `index.js` to poll the Conflict Globe API
2. Send formatted alerts to Discord

Example API endpoint: `http://localhost:8080/api/conflicts`

### Option 3: Webhook Relay
Set up a webhook relay that forwards Conflict Globe alerts to your bot.

## Next Steps

1. **Choose integration method** (Option 1, 2, or 3)
2. **Configure Discord channel** for alerts
3. **Test the integration**

## Troubleshooting

### OpenSky API Rate Limiting
The logs show "Too many requests" (429) from OpenSky API.
- This is expected for free API tiers
- Application continues to work with other data sources

### Bot Token
The bot token in the code may need verification:
- Check Discord Developer Portal: https://discord.com/developers/applications
- Verify token is valid and not expired

## Access Points

- **Conflict Globe Web**: http://localhost:8080
- **N8N Dashboard**: http://localhost:5678 (admin/conflict)
- **Discord Bot**: Already running in background
