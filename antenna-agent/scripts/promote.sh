#!/bin/bash
# Antenna Auto-Promotion Script
# Usage: ./promote.sh [post_type]

LOG_DIR="$HOME/.antenna/logs"
mkdir -p "$LOG_DIR"

POST_TYPES=("feature" "community" "engaging" "news")
TYPE="${1:-${POST_TYPES[$((RANDOM % ${#POST_TYPES[@]}))]}}"

case "$TYPE" in
  feature)
    PROMPT="Share an Antenna feature: P2P networking, XMR payments, 34 skills, Docker support, or Telegram integration. Make it engaging!"
    ;;
  community)
    PROMPT="Post about the Antenna community - mention we have skills for docker, github, crypto, k8s, and more. Encourage others to join!"
    ;;
  engaging)
    PROMPT="Create an engaging post about decentralized AI assistants. Mention Antenna's key benefits: free (Ollama), privacy (XMR), community-driven. Under 280 chars with #AI #Web3"
    ;;
  news)
    PROMPT="Share the latest Antenna news: We're running 34 skills, P2P network, and accepting XMR payments. Join the decentralized AI revolution!"
    ;;
  *)
    PROMPT="Post a short message about Antenna - the decentralized AI assistant. Keep it under 280 characters. Include relevant hashtags."
    ;;
esac

echo "[$(date)] Posting: $TYPE" >> "$LOG_DIR/promotion.log"

# Try posting via Telegram if enabled
if [ -f "$HOME/.antenna/config.json" ]; then
    TOKEN=$(grep -A2 '"telegram"' "$HOME/.antenna/config.json" | grep '"token"' | cut -d'"' -f4)
    if [ -n "$TOKEN" ] && [ "$TOKEN" != "" ]; then
        MESSAGE=$(/home/c0smic/.local/bin/antenna agent -m "$PROMPT" 2>/dev/null | head -5)
        curl -s -X POST "https://api.telegram.org/bot$TOKEN/sendMessage" \
            -d "chat_id=8419317249" \
            -d "text=$MESSAGE" >> "$LOG_DIR/promotion.log" 2>&1
        echo "[$(date)] Posted to Telegram" >> "$LOG_DIR/promotion.log"
    fi
fi

echo "[$(date)] Done" >> "$LOG_DIR/promotion.log"
