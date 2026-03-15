#!/bin/bash
# Memos Auto-start - starts memos when accessed, stops after inactivity

MEMOS_CONTAINER="memos"
MEMOS_PORT=5230
INACTIVITY_TIMEOUT=30  # minutes before stopping

start_memos() {
    if ! docker ps --format '{{.Names}}' | grep -q "^${MEMOS_CONTAINER}$"; then
        docker start "$MEMOS_CONTAINER" 2>/dev/null
        echo "[$(date)] Memos started" >> ~/.antenna/logs/memos.log
    fi
}

stop_memos() {
    if docker ps --format '{{.Names}}' | grep -q "^${MEMOS_CONTAINER}$"; then
        docker stop "$MEMOS_CONTAINER" 2>/dev/null
        echo "[$(date)] Memos stopped" >> ~/.antenna/logs/memos.log
    fi
}

check_memos() {
    if curl -sf "http://localhost:$MEMOS_PORT/api/v1/ping" >/dev/null 2>&1; then
        return 0
    fi
    return 1
}

case "$1" in
    start)
        start_memos
        ;;
    stop)
        stop_memos
        ;;
    check)
        if check_memos; then
            echo "running"
        else
            echo "stopped"
        fi
        ;;
    access)
        start_memos
        ;;
esac
