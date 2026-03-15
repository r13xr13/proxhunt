#!/bin/bash
# Antenna Reddit Promotion Script
# Posts to Reddit automatically

LOG_DIR="$HOME/.antenna/logs"
mkdir -p "$LOG_DIR"

# Reddit credentials from config
REDDIT_CLIENT_ID="YOUR_CLIENT_ID"
REDDIT_CLIENT_SECRET="YOUR_CLIENT_SECRET"
REDDIT_USERNAME="YOUR_USERNAME"
REDDIT_PASSWORD="YOUR_PASSWORD"

# Subreddits for promotion
SUBREDDITS=("ArtificialIntelligence" "selfhosted" "Web3" "Monero" "programming" "opensource")

# Get access token
get_reddit_token() {
    RESPONSE=$(curl -s -X POST "https://www.reddit.com/api/v1/access_token" \
        -u "$REDDIT_CLIENT_ID:$REDDIT_CLIENT_SECRET" \
        -d "grant_type=password&username=$REDDIT_USERNAME&password=$REDDIT_PASSWORD" \
        -H "User-Agent: Antenna/1.0")
    
    TOKEN=$(echo "$RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
    echo "$TOKEN"
}

# Post to subreddit
post_to_reddit() {
    local subreddit="$1"
    local title="$2"
    local content="$3"
    
    TOKEN=$(get_reddit_token)
    
    if [ -z "$TOKEN" ]; then
        echo "[$(date)] Failed to get Reddit token" >> "$LOG_DIR/reddit.log"
        return 1
    fi
    
    RESPONSE=$(curl -s -X POST "https://oauth.reddit.com/r/$subreddit/api/submit" \
        -H "Authorization: bearer $TOKEN" \
        -H "User-Agent: Antenna/1.0" \
        -d "kind=self&title=$title&text=$content")
    
    echo "[$(date)] Posted to r/$subreddit: $title" >> "$LOG_DIR/reddit.log"
    echo "$RESPONSE" >> "$LOG_DIR/reddit.log"
}

# Generate promotion content
generate_post() {
    local type="$1"
    
    case "$type" in
        feature)
            echo "Check out Antenna - the decentralized AI assistant! Runs locally with Ollama, P2P networking, XMR payments, and 34 skills. Open source and free!"
            ;;
        community)
            echo "Antenna community is growing! We have skills for docker, github, crypto, k8s, and more. Join the decentralized AI revolution!"
            ;;
        news)
            echo "Antenna update: Now with 34 skills, P2P network, and XMR payments. The future of AI is decentralized and privacy-first."
            ;;
        *)
            echo "Just discovered Antenna - a decentralized AI assistant that pays you in XMR for your skills. Pretty cool! #AI #Web3 #OpenSource"
            ;;
    esac
}

# Main promotion loop
echo "[$(date)] Starting Reddit promotion" >> "$LOG_DIR/reddit.log"

# Choose random subreddit and post type
SUBREDDIT="${SUBREDDITS[$((RANDOM % ${#SUBREDDITS[@]}))]}"
POST_TYPE="${1:-feature}"

TITLE="Antenna - Decentralized AI Assistant"
CONTENT=$(generate_post "$POST_TYPE")

if [ "$REDDIT_CLIENT_ID" != "YOUR_CLIENT_ID" ]; then
    post_to_reddit "$SUBREDDIT" "$TITLE" "$CONTENT"
    echo "[$(date)] Posted to Reddit" >> "$LOG_DIR/promotion.log"
else
    echo "[$(date)] Reddit not configured - would post:" >> "$LOG_DIR/promotion.log"
    echo "r/$SUBREDDIT: $TITLE" >> "$LOG_DIR/promotion.log"
    echo "$CONTENT" >> "$LOG_DIR/promotion.log"
fi
