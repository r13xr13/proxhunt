#!/bin/bash
# Antenna Heartbeat - Checks system health and posts status

CONFIG_FILE="${HOME}/.antenna/config.json"
LOG_FILE="${HOME}/.antenna/logs/heartbeat.log"

# Read config values
if [ -f "${CONFIG_FILE}" ]; then
    TELEGRAM_BOT=$(python3 -c "import json; c=json.load(open('${CONFIG_FILE}')); print(c.get('channels',{}).get('telegram',{}).get('token',''))" 2>/dev/null)
    TELEGRAM_CHAT=$(python3 -c "import json; c=json.load(open('${CONFIG_FILE}')); print(c.get('channels',{}).get('telegram',{}).get('chat_id',''))" 2>/dev/null)
else
    exit 1
fi

# Check services
ANTENNA_STATUS=$(systemctl is-active antenna 2>/dev/null || echo "inactive")
TOR_STATUS=$(systemctl is-active tor 2>/dev/null || echo "inactive")
WEBSITE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "000")
DB_STATUS=$(docker exec antenna-postgres pg_isready -U antenna 2>/dev/null && echo "OK" || echo "FAIL")
AGENT_COUNT=$(docker exec antenna-postgres psql -U antenna -d antenna -t -c "SELECT COUNT(*) FROM agents;" 2>/dev/null | tr -d ' ' || echo "?")

# Check if all OK
if [ "$ANTENNA_STATUS" = "active" ] && [ "$TOR_STATUS" = "active" ] && [ "$WEBSITE_STATUS" = "200" ] && [ "$DB_STATUS" = "OK" ]; then
    STATUS="🟢 ALL SYSTEMS OPERATIONAL"
else
    STATUS="🔴 ISSUES DETECTED"
    # Send alert if Telegram is configured
    if [ -n "$TELEGRAM_BOT" ] && [ -n "$TELEGRAM_CHAT" ]; then
        ALERT="⚠️ *ANTENNA ALERT*%0A%0A"
        ALERT+="Gateway: $ANTENNA_STATUS%0A"
        ALERT+="Tor: $TOR_STATUS%0A"
        ALERT+="Website: HTTP $WEBSITE_STATUS%0A"
        ALERT+="Database: $DB_STATUS%0A"
        
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT}/sendMessage" \
            -d "chat_id=${TELEGRAM_CHAT}" \
            -d "parse_mode=Markdown" \
            -d "text=${ALERT}" > /dev/null 2>&1
    fi
fi

# Log heartbeat
echo "[$(date)] $STATUS | Agents: $AGENT_COUNT | Website: $WEBSITE_STATUS | DB: $DB_STATUS" >> "$LOG_FILE"
