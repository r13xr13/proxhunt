#!/bin/bash

# Antenna Onboarding Script
# Interactive setup wizard for configuring Antenna

set -e

INSTALL_DIR="${HOME}/.antenna"
CONFIG_FILE="${INSTALL_DIR}/config.json"
ANTENNA_BIN="${HOME}/.local/bin/antenna"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_header() {
    echo -e "${CYAN}"
    echo "╔════════════════════════════════════════╗"
    echo "║      Antenna Onboarding Wizard        ║"
    echo "╚════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_step() {
    echo -e "${BLUE}▸ $1${NC}"
}

# Check prerequisites
check_prereqs() {
    print_step "Checking prerequisites..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        echo "Please install Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    if ! command -v tor &> /dev/null; then
        print_warning "Tor is not installed"
        echo "Installing Tor..."
        if command -v apt-get &> /dev/null; then
            sudo apt-get update && sudo apt-get install -y tor
        elif command -v pacman &> /dev/null; then
            sudo pacman -S tor
        fi
    fi
    
    if ! systemctl is-active --quiet tor 2>/dev/null; then
        print_warning "Starting Tor service..."
        sudo systemctl start tor 2>/dev/null || true
    fi
    
    print_success "Prerequisites satisfied"
}

# Run antenna's built-in onboard
run_antenna_onboard() {
    print_step "Initializing Antenna..."
    
    if [ ! -f "${CONFIG_FILE}" ]; then
        ${ANTENNA_BIN} onboard
    else
        print_warning "Config already exists - skipping antenna init"
    fi
}

# Get input with default
get_input() {
    local prompt="$1"
    local default="$2"
    local var_name="$3"
    
    if [ -n "$default" ]; then
        read -p "$prompt [$default]: " input
        input=${input:-$default}
    else
        read -p "$prompt: " input
    fi
    
    eval "$var_name=\$input"
}

# Yes/No prompt
get_yes_no() {
    local prompt="$1"
    local default="$2"
    local result=""
    
    while true; do
        if [ -n "$default" ]; then
            read -p "$prompt [y/N]: " yn
        else
            read -p "$prompt [y/n]: " yn
        fi
        yn=${yn:-$default}
        case $yn in
            [Yy]*) result="yes"; return 0 ;;
            [Nn]*) result="no"; return 1 ;;
            *) echo "Please answer y or n" ;;
        esac
    done
}

# Telegram setup
setup_telegram() {
    echo ""
    echo -e "${BLUE}━━━ Telegram Setup ━━━${NC}"
    echo ""
    
    if get_yes_no "Enable Telegram integration?" "y"; then
        echo ""
        echo "To create a Telegram bot:"
        echo "  1. Open @BotFather on Telegram"
        echo "  2. Send /newbot to create a new bot"
        echo "  3. Copy the bot token"
        echo ""
        
        get_input "Enter your Telegram bot token" "" TELEGRAM_TOKEN
        
        if [ -n "$TELEGRAM_TOKEN" ]; then
            echo ""
            echo "Now get your chat ID:"
            echo "  1. Start a chat with your bot"
            echo "  2. Open @userinfobot on Telegram"
            echo "  3. It will show your chat ID"
            echo ""
            
            get_input "Enter your Telegram chat ID" "" TELEGRAM_CHAT_ID
            
            python3 << PYEOF
import json

with open("${CONFIG_FILE}", "r") as f:
    config = json.load(f)

if "channels" not in config:
    config["channels"] = {}

config["channels"]["telegram"] = {
    "enabled": True,
    "token": "${TELEGRAM_TOKEN}",
    "allow_from": ["${TELEGRAM_CHAT_ID}"],
    "chat_id": "${TELEGRAM_CHAT_ID}"
}

with open("${CONFIG_FILE}", "w") as f:
    json.dump(config, f, indent=2)
PYEOF
            
            print_success "Telegram configured!"
        fi
    else
        python3 << PYEOF
import json

with open("${CONFIG_FILE}", "r") as f:
    config = json.load(f)

if "channels" not in config:
    config["channels"] = {}

config["channels"]["telegram"] = {
    "enabled": False,
    "token": "",
    "allow_from": [],
    "chat_id": ""
}

with open("${CONFIG_FILE}", "w") as f:
    json.dump(config, f, indent=2)
PYEOF
        print_success "Telegram disabled"
    fi
}

# Discord setup
setup_discord() {
    echo ""
    echo -e "${BLUE}━━━ Discord Setup ━━━${NC}"
    echo ""
    
    if get_yes_no "Enable Discord integration?" "y"; then
        echo ""
        echo "To create a Discord bot:"
        echo "  1. Go to https://discord.com/developers/applications"
        echo "  2. Create a new application"
        echo "  3. Go to Bot section and create a bot"
        echo "  4. Copy the bot token"
        echo "  5. Go to OAuth2 -> URL Generator"
        echo "     - Select 'bot' scope"
        echo "     - Select 'Send Messages' permission"
        echo "  6. Use the generated URL to invite bot to your server"
        echo ""
        
        get_input "Enter your Discord bot token" "" DISCORD_TOKEN
        
        if [ -n "$DISCORD_TOKEN" ]; then
            echo ""
            echo "Now get your channel ID:"
            echo "  1. Enable Developer Mode in Discord (Settings -> Advanced)"
            echo "  2. Right-click on the channel -> Copy Channel ID"
            echo ""
            
            get_input "Enter your Discord channel ID" "" DISCORD_CHANNEL
            
            python3 << PYEOF
import json

with open("${CONFIG_FILE}", "r") as f:
    config = json.load(f)

if "channels" not in config:
    config["channels"] = {}

config["channels"]["discord"] = {
    "enabled": True,
    "token": "${DISCORD_TOKEN}",
    "allow_from": [],
    "channel_id": "${DISCORD_CHANNEL}"
}

with open("${CONFIG_FILE}", "w") as f:
    json.dump(config, f, indent=2)
PYEOF
            
            print_success "Discord configured!"
        fi
    else
        python3 << PYEOF
import json

with open("${CONFIG_FILE}", "r") as f:
    config = json.load(f)

if "channels" not in config:
    config["channels"] = {}

config["channels"]["discord"] = {
    "enabled": False,
    "token": "",
    "allow_from": [],
    "channel_id": ""
}

with open("${CONFIG_FILE}", "w") as f:
    json.dump(config, f, indent=2)
PYEOF
        print_success "Discord disabled"
    fi
}

# LLM Provider setup
setup_llm_provider() {
    echo ""
    echo -e "${BLUE}━━━ LLM Provider Setup ━━━${NC}"
    echo ""
    
    echo "Select your LLM provider:"
    echo "  1. Ollama (local, free)"
    echo "  2. OpenAI (GPT-4, GPT-3.5)"
    echo "  3. Anthropic (Claude)"
    echo "  4. OpenRouter (aggregator - recommended)"
    echo "  5. DeepSeek"
    echo ""
    
    get_input "Enter provider number" "1" PROVIDER_CHOICE
    
    case $PROVIDER_CHOICE in
        1) # Ollama
            echo ""
            print_step "Using Ollama (local models)"
            if get_yes_no "Is Ollama running locally on port 11434?" "y"; then
                python3 << PYEOF
import json
with open("${CONFIG_FILE}", "r") as f:
    config = json.load(f)

config["agents"]["defaults"]["provider"] = "ollama"
config["agents"]["defaults"]["model"] = "ollama/llama3.2"
config["providers"]["ollama"]["api_key"] = "ollama-key"
config["providers"]["ollama"]["api_base"] = "http://localhost:11434"

with open("${CONFIG_FILE}", "w") as f:
    json.dump(config, f, indent=2)
PYEOF
                print_success "Ollama configured!"
            fi
            ;;
        2) # OpenAI
            echo ""
            get_input "Enter your OpenAI API key" "" OPENAI_KEY
            get_input "Enter model name (default: gpt-4o)" "gpt-4o" OPENAI_MODEL
            
            python3 << PYEOF
import json
with open("${CONFIG_FILE}", "r") as f:
    config = json.load(f)

config["agents"]["defaults"]["provider"] = "openai"
config["agents"]["defaults"]["model"] = "openai/${OPENAI_MODEL}"
config["providers"]["openai"]["api_key"] = "${OPENAI_KEY}"

with open("${CONFIG_FILE}", "w") as f:
    json.dump(config, f, indent=2)
PYEOF
            print_success "OpenAI configured!"
            ;;
        3) # Anthropic
            echo ""
            get_input "Enter your Anthropic API key" "" ANTHROPIC_KEY
            get_input "Enter model name (default: claude-sonnet-4-20250514)" "claude-sonnet-4-20250514" ANTHROPIC_MODEL
            
            python3 << PYEOF
import json
with open("${CONFIG_FILE}", "r") as f:
    config = json.load(f)

config["agents"]["defaults"]["provider"] = "anthropic"
config["agents"]["defaults"]["model"] = "anthropic/${ANTHROPIC_MODEL}"
config["providers"]["anthropic"]["api_key"] = "${ANTHROPIC_KEY}"

with open("${CONFIG_FILE}", "w") as f:
    json.dump(config, f, indent=2)
PYEOF
            print_success "Anthropic configured!"
            ;;
        4) # OpenRouter
            echo ""
            get_input "Enter your OpenRouter API key" "" OPENROUTER_KEY
            get_input "Enter model name (default: anthropic/claude-sonnet-4-20250514)" "anthropic/claude-sonnet-4-20250514" OPENROUTER_MODEL
            
            python3 << PYEOF
import json
with open("${CONFIG_FILE}", "r") as f:
    config = json.load(f)

config["agents"]["defaults"]["provider"] = "openrouter"
config["agents"]["defaults"]["model"] = "${OPENROUTER_MODEL}"
config["providers"]["openrouter"]["api_key"] = "${OPENROUTER_KEY}"

with open("${CONFIG_FILE}", "w") as f:
    json.dump(config, f, indent=2)
PYEOF
            print_success "OpenRouter configured!"
            ;;
        5) # DeepSeek
            echo ""
            get_input "Enter your DeepSeek API key" "" DEEPSEEK_KEY
            
            python3 << PYEOF
import json
with open("${CONFIG_FILE}", "r") as f:
    config = json.load(f)

config["agents"]["defaults"]["provider"] = "deepseek"
config["agents"]["defaults"]["model"] = "deepseek/deepseek-chat"
config["providers"]["deepseek"]["api_key"] = "${DEEPSEEK_KEY}"

with open("${CONFIG_FILE}", "w") as f:
    json.dump(config, f, indent=2)
PYEOF
            print_success "DeepSeek configured!"
            ;;
        *)
            print_error "Invalid choice"
            ;;
    esac
}

# Database setup
setup_database() {
    echo ""
    echo -e "${BLUE}━━━ Database Setup ━━━${NC}"
    echo ""
    
    get_input "Enter PostgreSQL password (for antenna user)" "antenna_password" DB_PASSWORD
    
    # Update docker-compose with password
    if [ -f "${INSTALL_DIR}/docker-compose.yml" ]; then
        sed -i "s/change_me_in_onboarding/${DB_PASSWORD}/g" "${INSTALL_DIR}/docker-compose.yml"
    fi
    
    print_success "Database password configured!"
    echo "   You can connect with: postgresql://antenna:${DB_PASSWORD}@localhost:5432/antenna"
}

# Docker stack setup
setup_docker() {
    echo ""
    echo -e "${BLUE}━━━ Docker Stack Setup ━━━${NC}"
    echo ""
    
    if get_yes_no "Setup Docker stack (PostgreSQL, Web UI, Onion service)?" "y"; then
        print_step "Setting up Docker stack..."
        
        # Check if docker-compose files exist
        if [ ! -f "${INSTALL_DIR}/docker-compose.yml" ]; then
            cat > "${INSTALL_DIR}/docker-compose.yml" << 'DOCKEREOF'
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: antenna-postgres
    environment:
      POSTGRES_USER: antenna
      POSTGRES_PASSWORD: antenna_password
      POSTGRES_DB: antenna
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U antenna"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  antenna-dashboard:
    build:
      context: ./antenna-web
      dockerfile: Dockerfile
    container_name: antenna-dashboard
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://antenna:antenna_password@postgres:5432/antenna
      - NEXT_PUBLIC_API_URL=http://localhost:3000
    ports:
      - "127.0.0.1:3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  antenna-matrix:
    build:
      context: ./antenna-web
      dockerfile: Dockerfile
    container_name: antenna-matrix
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://antenna:antenna_password@postgres:5432/antenna
      - NEXT_PUBLIC_API_URL=http://localhost:3000
    ports:
      - "3000:3000"
    volumes:
      - ./tor_data:/var/lib/tor/antenna
      - ./torrc:/etc/tor/torrc
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  antenna-nginx:
    image: nginx:alpine
    container_name: antenna-nginx
    ports:
      - "80:80"
    volumes:
      - ./antenna-web/nginx.onion.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - antenna-matrix
    restart: unless-stopped

volumes:
  postgres_data:
DOCKEREOF
        fi
        
        # Start docker stack
        cd "${INSTALL_DIR}"
        if command -v docker-compose &> /dev/null; then
            docker-compose up -d
        else
            docker compose up -d
        fi
        
        print_success "Docker stack started!"
    fi
}

# Systemd services setup
setup_systemd() {
    echo ""
    echo -e "${BLUE}━━━ Systemd Services Setup ━━━${NC}"
    echo ""
    
    if get_yes_no "Setup systemd services (gateway, timers)?" "y"; then
        print_step "Installing systemd services..."
        
        # Create antenna service
        sudo tee /etc/systemd/system/antenna.service > /dev/null << 'SVCEOF'
[Unit]
Description=Antenna AI Agent Gateway
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=simple
User=%u
WorkingDirectory=%h/.antenna
Environment="PATH=%h/.antenna/venv/bin:%h/.local/bin:/usr/local/bin:/usr/bin:/bin"
ExecStart=%h/.local/bin/antenna gateway
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
SVCEOF

        # Create heartbeat timer
        sudo tee /etc/systemd/system/antenna-heartbeat.timer > /dev/null << 'TIMEREOF'
[Unit]
Description=Antenna Heartbeat Timer

[Timer]
OnBootSec=1min
OnUnitActiveSec=30min
Unit=antenna-heartbeat.service

[Install]
WantedBy=timers.target
TIMEREOF

        sudo tee /etc/systemd/system/antenna-heartbeat.service > /dev/null << 'SVCEOF'
[Unit]
Description=Antenna Heartbeat
After=network.target

[Service]
Type=oneshot
ExecStart=%h/.antenna/scripts/heartbeat.sh
User=%u
SVCEOF

        # Create news timer
        sudo tee /etc/systemd/system/antenna-news.timer > /dev/null << 'TIMEREOF'
[Unit]
Description=Antenna News Poster Timer - Every 6 hours

[Timer]
OnBootSec=10min
OnUnitActiveSec=6h
Unit=antenna-news.service

[Install]
WantedBy=timers.target
TIMEREOF

        sudo tee /etc/systemd/system/antenna-news.service > /dev/null << 'SVCEOF'
[Unit]
Description=Antenna News Poster
After=network.target

[Service]
Type=oneshot
ExecStart=%h/.antenna/scripts/news-poster.sh
User=%u
SVCEOF

        # Create signal timer
        sudo tee /etc/systemd/system/antenna-signal.timer > /dev/null << 'TIMEREOF'
[Unit]
Description=Antenna Signal Timer - 4x Daily

[Timer]
OnBootSec=5min
OnUnitActiveSec=4h
Unit=antenna-signal.service

[Install]
WantedBy=timers.target
TIMEREOF

        sudo tee /etc/systemd/system/antenna-signal.service > /dev/null << 'SVCEOF'
[Unit]
Description=Antenna Signal Poster
After=network.target

[Service]
Type=oneshot
ExecStart=/usr/bin/python3 %h/.antenna/scripts/signal-poster.py
User=%u
SVCEOF

        sudo systemctl daemon-reload
        print_success "Systemd services installed!"
    fi
}

# Start services
start_services() {
    echo ""
    echo -e "${BLUE}━━━ Starting Services ━━━${NC}"
    echo ""
    
    if get_yes_no "Start all Antenna services now?" "y"; then
        # Start antenna gateway
        sudo systemctl start antenna
        sudo systemctl enable antenna
        print_success "Antenna gateway started"
        
        # Enable timers
        sudo systemctl enable antenna-heartbeat.timer 2>/dev/null || true
        sudo systemctl enable antenna-news.timer 2>/dev/null || true
        sudo systemctl enable antenna-signal.timer 2>/dev/null || true
        sudo systemctl start antenna-heartbeat.timer 2>/dev/null || true
        sudo systemctl start antenna-news.timer 2>/dev/null || true
        sudo systemctl start antenna-signal.timer 2>/dev/null || true
        print_success "Timers enabled"
        
        echo ""
        print_success "All services started!"
    fi
}

# Show final status
show_status() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║         Setup Complete! 🎉            ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
    echo ""
    
    echo "Your Antenna setup:"
    echo "  • Gateway:   http://localhost:18790"
    echo "  • Web UI:   http://localhost:3000"
    
    if [ -f /var/lib/tor/antenna/hostname ]; then
        echo "  • Onion:    $(cat /var/lib/tor/antenna/hostname)"
    fi
    
    echo ""
    echo "Commands:"
    echo "  • Check status:  ${ANTENNA_BIN} status"
    echo "  • Chat:         ${ANTENNA_BIN} agent"
    echo "  • View logs:    journalctl -u antenna -f"
    echo "  • Stop:         sudo systemctl stop antenna"
    echo ""
}

# Show help
show_help() {
    echo "Usage: $(basename $0) [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --telegram    Setup Telegram only"
    echo "  --discord     Setup Discord only"
    echo "  --llm         Setup LLM provider only"
    echo "  --docker      Setup Docker stack"
    echo "  --systemd     Setup systemd services"
    echo "  --start       Start all services"
    echo "  --status      Show status"
    echo "  --help        Show this help"
    echo ""
}

# Main
main() {
    print_header
    
    # Parse arguments for single-step runs
    case "$1" in
        --telegram)
            setup_telegram
            exit 0
            ;;
        --discord)
            setup_discord
            exit 0
            ;;
        --llm)
            setup_llm_provider
            exit 0
            ;;
        --docker)
            setup_docker
            exit 0
            ;;
        --systemd)
            setup_systemd
            exit 0
            ;;
        --start)
            start_services
            exit 0
            ;;
        --status)
            ${ANTENNA_BIN} status
            exit 0
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
    esac
    
    # Full onboarding
    check_prereqs
    run_antenna_onboard
    setup_llm_provider
    setup_telegram
    setup_discord
    setup_database
    setup_docker
    setup_systemd
    start_services
    show_status
}

main "$@"
