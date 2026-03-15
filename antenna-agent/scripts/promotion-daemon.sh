#!/bin/bash
# Antenna Promotion Daemon
# Runs in background, posting periodically

INTERVAL_HOURS=2
LOG_DIR="$HOME/.antenna/logs"
mkdir -p "$LOG_DIR"

POST_TYPES=("feature" "community" "engaging" "news")

echo "[$(date)] Antenna Promotion Daemon started" >> "$LOG_DIR/promotion.log"

while true; do
    TYPE="${POST_TYPES[$((RANDOM % ${#POST_TYPES[@]}))]}"
    
    case "$TYPE" in
      feature)
        PROMPT="Share an Antenna feature: P2P networking, XMR payments, 34 skills, Docker support. Make it engaging!"
        ;;
      community)
        PROMPT="Post about the Antenna community - we have skills for docker, github, crypto, k8s. Join us!"
        ;;
      engaging)
        PROMPT="Decentralized AI is the future. Antenna is free (Ollama), privacy-first (XMR), community-driven. #AI #Web3"
        ;;
      news)
        PROMPT="Antenna update: 34 skills, P2P network, XMR payments. Join the decentralized AI revolution! 🚀"
        ;;
    esac
    
    echo "[$(date)] Posting: $TYPE" >> "$LOG_DIR/promotion.log"
    
    # Generate the post
    POST_CONTENT=$(/home/c0smic/.local/bin/antenna agent -m "$PROMPT" 2>/dev/null | head -280)
    
    if [ -n "$POST_CONTENT" ]; then
        echo "[$(date)] Generated: ${POST_CONTENT:0:50}..." >> "$LOG_DIR/promotion.log"
        
        # Log the post (in production, would post to Twitter/Reddit/Telegram)
        echo "[$(date)] POST: $POST_CONTENT" >> "$LOG_DIR/posts.log"
    fi
    
    # Wait for next interval
    sleep $((INTERVAL_HOURS * 3600))
done
