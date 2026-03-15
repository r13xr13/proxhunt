#!/bin/bash
# Site Monitor Script - Monitors antenna-ai.loca.lt health

SITE_URL="https://antenna-ai.loca.lt"
LOG_FILE="$HOME/.antenna/logs/site-monitor.log"
ALERT_FILE="$HOME/.antenna/logs/site-alerts.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

alert() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ALERT: $1" >> "$ALERT_FILE"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ALERT: $1"
}

check_site() {
    local url=$1
    local code=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
    echo $code
}

log "Starting site monitor check..."

# Check main site
MAIN_CODE=$(check_site "$SITE_URL")
if [ "$MAIN_CODE" = "200" ]; then
    log "Main site: OK (200)"
else
    alert "Main site down! Status: $MAIN_CODE"
fi

# Check API endpoints
API_ENDPOINTS=(
    "/api/antenna/status"
    "/api/services"
    "/api/books"
    "/api/crypto"
)

for endpoint in "${API_ENDPOINTS[@]}"; do
    CODE=$(check_site "$SITE_URL$endpoint")
    if [ "$CODE" = "200" ]; then
        log "API $endpoint: OK"
    else
        alert "API $endpoint failed! Status: $CODE"
    fi
done

# Check pages
PAGES=(
    "/dashboard"
    "/services"
    "/books"
    "/files"
    "/memory"
    "/marketplace"
    "/wallet"
    "/messages"
    "/onboarding"
)

for page in "${PAGES[@]}"; do
    CODE=$(check_site "$SITE_URL$page")
    if [ "$CODE" = "200" ]; then
        log "Page $page: OK"
    else
        alert "Page $page failed! Status: $CODE"
    fi
done

# Check local services
log "Checking local services..."

# Check Docker containers
if docker ps | grep -q antenna-web; then
    log "Docker antenna-web: running"
else
    alert "Docker antenna-web container NOT running!"
fi

if docker ps | grep -q antenna-nginx; then
    log "Docker nginx: running"
else
    alert "Docker nginx container NOT running!"
fi

# Check antenna gateway
if curl -s http://localhost:18790/health > /dev/null 2>&1; then
    log "Antenna gateway: OK"
else
    alert "Antenna gateway (localhost:18790) NOT responding!"
fi

log "Site monitor check complete."
