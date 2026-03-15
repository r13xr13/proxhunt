#!/bin/bash
# Antenna Daily Briefing - Sends daily status to user

LOG_FILE="$HOME/.antenna/logs/briefing.log"
DISCORD_WEBHOOK_URL_FILE="$HOME/.antenna/.discord_webhook"
TELEGRAM_BOT_TOKEN_FILE="$HOME/.antenna/.telegram_bot_token"
TELEGRAM_CHAT_ID_FILE="$HOME/.antenna/.telegram_chat_id"

log() {
    echo "[$(date)] $1" >> "$LOG_FILE"
}

send_discord() {
    local message="$1"
    local webhook_url
    webhook_url=$(cat "$DISCORD_WEBHOOK_URL_FILE" 2>/dev/null)
    
    if [[ -z "$webhook_url" ]]; then
        log "No Discord webhook configured"
        return 1
    fi
    
    curl -s -X POST "$webhook_url" \
        -H "Content-Type: application/json" \
        -d "{\"content\": \"$message\"}" > /dev/null 2>&1
}

send_telegram() {
    local message="$1"
    local bot_token chat_id
    bot_token=$(cat "$TELEGRAM_BOT_TOKEN_FILE" 2>/dev/null)
    chat_id=$(cat "$TELEGRAM_CHAT_ID_FILE" 2>/dev/null)
    
    if [[ -z "$bot_token" || -z "$chat_id" ]]; then
        log "No Telegram credentials configured"
        return 1
    fi
    
    curl -s -X POST "https://api.telegram.org/bot$bot_token/sendMessage" \
        -d "chat_id=$chat_id" \
        -d "text=$message" > /dev/null 2>&1
}

generate_briefing() {
    local uptime
    local antenna_status
    local memory_used
    local disk_used
    local recent_logs
    
    # System uptime
    uptime=$(uptime -p 2>/dev/null || uptime)
    
    # Antenna status
    if curl -sf http://localhost:18790/health > /dev/null 2>&1; then
        antenna_status="✅ Running"
    else
        antenna_status="❌ Down"
    fi
    
    # Memory usage
    memory_used=$(free -h | awk '/^Mem:/ {print $3 "/" $2}')
    
    # Disk usage
    disk_used=$(df -h ~ | awk 'NR==2 {print $3 "/" $2 " (" $5 ")"}')
    
    # Recent activity (last 5 lines from guardian log)
    recent_logs=$(tail -5 "$HOME/.antenna/logs/guardian.log" 2>/dev/null | tr '\n' ' | ')
    
    local briefing="📡 *Antenna Daily Briefing*
━━━━━━━━━━━━━━━━━━━━━━
🟢 Status: $antenna_status
💾 Memory: $memory_used
💿 Disk: $disk_used
⏱️ Uptime: $uptime
📋 Recent: $recent_logs"

    echo "$briefing"
}

# Main
log "Generating daily briefing..."

briefing=$(generate_briefing)
log "Briefing: $briefing"

send_discord "$briefing"
send_telegram "$briefing"

log "Daily briefing sent"
