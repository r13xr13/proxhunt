#!/bin/bash
# Agent 24/7 Loop - Runs all agent tasks in a continuous loop

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$HOME/.antenna/logs"
API_BASE="https://antenna-ai.loca.lt/api"

mkdir -p "$LOG_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_DIR/agent-loop.log"
}

log "=== Agent 24/7 Loop Started ==="

# Main loop - runs every 5 minutes
while true; do
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    log "=== Loop started at $TIMESTAMP ==="
    
    # 1. Fetch and display agent status
    log "Checking agent status..."
    AGENTS_RESPONSE=$(curl -s "$API_BASE/agents")
    AGENT_COUNT=$(echo "$AGENTS_RESPONSE" | grep -o '"id"' | wc -l)
    log "Active agents: $AGENT_COUNT"
    
    # 2. Update marketplace listings (every 10 minutes - every 2nd loop)
    if [ $(( $(date +%s) / 300 % 2 )) -eq 0 ]; then
        log "Checking marketplace activity..."
        MARKETPLACE_RESPONSE=$(curl -s "$API_BASE/marketplace?limit=10")
        LISTING_COUNT=$(echo "$MARKETPLACE_RESPONSE" | grep -o '"id"' | wc -l)
        log "Active listings: $LISTING_COUNT"
    fi
    
    # 3. Post to social feed (every 15 minutes - every 3rd loop)
    if [ $(( $(date +%s) / 300 % 3 )) -eq 0 ]; then
        log "Posting social update..."
        CONTENT="🤖 Antenna Network Update - $(date '+%Y-%m-%d %H:%M') - $AGENT_COUNT agents online, 24/7 autonomous operation 🚀"
        curl -s -X POST "$API_BASE/posts" \
            -H "Content-Type: application/json" \
            -d "{\"content\": \"$CONTENT\", \"agent\": \"ContentPoster\", \"avatar\": \"📰\"}" \
            >> "$LOG_DIR/agent-loop.log" 2>&1
        log "Social post published"
    fi
    
    # 4. Check crypto prices (every 5 minutes)
    log "Fetching crypto prices..."
    CRYPTO_RESPONSE=$(curl -s "$API_BASE/crypto")
    XMR_PRICE=$(echo "$CRYPTO_RESPONSE" | grep -o '"xmr":[0-9.]*' | cut -d: -f2)
    if [ -n "$XMR_PRICE" ]; then
        log "XMR Price: $XMR_PRICE"
    fi
    
    # 5. Site health check (every 5 minutes)
    log "Checking site health..."
    SITE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://antenna-ai.loca.lt")
    if [ "$SITE_STATUS" = "200" ]; then
        log "Site: OK"
    else
        log "Site: ERROR (status $SITE_STATUS)"
    fi
    
    # 6. Antenna gateway health (every 5 minutes)
    log "Checking antenna gateway..."
    GATEWAY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:18790/health")
    if [ "$GATEWAY_STATUS" = "200" ]; then
        log "Gateway: OK"
    else
        log "Gateway: ERROR (status $GATEWAY_STATUS)"
    fi
    
    # 7. Check localtunnel (every 10 minutes)
    if [ $(( $(date +%s) / 300 % 2 )) -eq 0 ]; then
        log "Checking localtunnel..."
        LT_PID=$(pgrep -f "localtunnel" | head -1)
        if [ -n "$LT_PID" ]; then
            log "Localtunnel: running (PID $LT_PID)"
        else
            log "Localtunnel: NOT RUNNING - restarting..."
            nohup npx -y localtunnel --port 80 --subdomain antenna-ai > /tmp/lt.log 2>&1 &
        fi
    fi
    
    # 8. Cleanup old logs (every hour - every 12th loop)
    if [ $(( $(date +%s) / 300 % 12 )) -eq 0 ]; then
        log "Cleaning old logs..."
        find "$LOG_DIR" -type f -name "*.log" -mtime +7 -delete 2>/dev/null
    fi
    
    log "=== Loop completed ==="
    
    # Sleep 5 minutes
    sleep 300
done
