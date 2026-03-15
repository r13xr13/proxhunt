#!/bin/bash
# Antenna Guardian - Keeps Antenna running with heartbeat

LOG_FILE="$HOME/.antenna/logs/guardian.log"
PID_FILE="$HOME/.antenna/antenna.pid"

log() {
    echo "[$(date)] $1" >> "$LOG_FILE"
}

check_antenna() {
    # Check if gateway is running
    if curl -sf http://localhost:18790/health > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

start_antenna() {
    log "Antenna not running, starting..."
    cd "$HOME/.local/bin" && ./antenna gateway >> "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    sleep 3
    
    if check_antenna; then
        log "Antenna started successfully"
        return 0
    else
        log "Failed to start Antenna"
        return 1
    fi
}

# Main loop
log "Antenna Guardian started"

while true; do
    if check_antenna; then
        log "Antenna is healthy"
    else
        log "Antenna is down, restarting..."
        start_antenna
    fi
    
    # Heartbeat entry
    echo "$(date): heartbeat - antenna $(check_antenna && echo 'UP' || echo 'DOWN')" >> "$HOME/.antenna/logs/heartbeat.log"
    
    sleep 30
done
