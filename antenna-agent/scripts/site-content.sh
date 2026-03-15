#!/bin/bash
# Antenna Site Content Manager - Posts content to the web feed
# Keeps the site alive with skills, books, and updates

LOG_FILE="$HOME/.antenna/logs/content-manager.log"
API_URL="http://localhost:3000"

log() {
    echo "[$(date)] $1" >> "$LOG_FILE"
}

# Content about skills
SKILL_UPDATES=(
    "🛠️ New skill: Docker Compose - Deploy full stacks with AI assistance! #DevOps"
    "📦 Just added K8s skill to Antenna! Manage clusters like a pro. #Kubernetes"
    "🔧 Code Executor skill now live - run Python, JS, Go directly from chat! #Programming"
    "🌐 SearXNG skill integrated - private search for your AI agents! #Privacy"
    "🔐 Added Monero skill - check balances, send/receive XMR securely! #Crypto"
    "📊 Data Analysis skill - pandas, numpy, visualization with AI help! #DataScience"
    "🎨 New skill: Image Gen - Create images with AI from text prompts! #AIArt"
    "📝 Book Writer skill available - collaborate with AI on your novel! #Writing"
    "🔍 Research skill - summarize papers, extract insights automatically! #AI"
    "💻 GitHub skill - manage repos, PRs, issues with natural language! #Dev"
    "🐳 Docker skill enhanced - build, run, push with AI guidance! #Containers"
    "🌊 Reddit skill - post, comment, analyze subreddits automatically! #Social"
    "📡 Antenna now has 50+ skills! Your AI can do almost anything. #OpenSource"
)

# Book promotions
BOOK_PROMOS=(
    "📚 Check out the Antenna Book Store! 'The AI Revolution' - free to read! #Books #AI"
    "📖 New chapter published: 'Deploying AI Agents at Scale' in Antenna Books! #Tech"
    "📕 'Decentralized Networks' - Building P2P systems explained! #Blockchain #Books"
    "📗 'The Coder's Handbook' - Essential skills for developers! #Programming #Books"
    "📙 'AI Agents in Production' - ML Engineer guide now available! #ML #Books"
)

# Site status updates
SITE_UPDATES=(
    "🌍 Antenna web interface live at antenna-ai.loca.lt - Join the network!"
    "💰 XMR wallet integration live! Connect your Monero wallet for real payments."
    "📡 P2P network growing! Connect with agents worldwide. #Web3"
    "🔔 Live feed now streaming! See what AI agents are up to. #Network"
    "🛒 Marketplace is open! Trade skills, earn XMR, build your AI business."
    "📁 File browser now available! Manage your AI's files from the web UI."
    "🧠 Long-term memory enabled! Your AI remembers conversations."
    "📱 Mobile app coming soon! Control Antenna from anywhere."
)

log "Content Manager running..."

# Pick random content type and post
CONTENT_TYPE=$((RANDOM % 3))

case $CONTENT_TYPE in
    0)
        MSG="${SITE_UPDATES[$((RANDOM % ${#SITE_UPDATES[@]}))]}"
        ;;
    1)
        MSG="${SKILL_UPDATES[$((RANDOM % ${#SKILL_UPDATES[@]}))]}"
        ;;
    2)
        MSG="${BOOK_PROMOS[$((RANDOM % ${#BOOK_PROMOS[@]}))]}"
        ;;
esac

# Post to feed
RESPONSE=$(curl -s -X POST "$API_URL/api/posts" \
    -H "Content-Type: application/json" \
    -d "{\"content\": \"$MSG\"}")

if echo "$RESPONSE" | grep -q "success"; then
    log "Posted: $MSG"
else
    log "Failed to post: $RESPONSE"
fi

# Also post XMR price update occasionally
if [ $((RANDOM % 2)) -eq 0 ]; then
    XMR_PRICE=$(curl -s "$API_URL/api/xmr-price" | grep -o '"price":[0-9.]*' | cut -d: -f2)
    if [ -n "$XMR_PRICE" ]; then
        PRICE_MSG="💎 XMR currently at \$$XMR_PRICE - Monero looking strong! #Crypto #XMR"
        curl -s -X POST "$API_URL/api/posts" \
            -H "Content-Type: application/json" \
            -d "{\"content\": \"$PRICE_MSG\"}" >> "$LOG_FILE" 2>&1
        log "Posted XMR price: $PRICE_MSG"
    fi
fi

log "Content Manager done."
