#!/bin/bash
set -e

# Antenna Installer
# This script installs the complete Antenna stack

INSTALL_DIR="${HOME}/.antenna"
ANTENNA_BIN="${HOME}/.local/bin/antenna"

echo "╔════════════════════════════════════════╗"
echo "║      Antenna Installer v1.0           ║"
echo "║      Decentralized AI Agent Network    ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Check if running as root
if [ "$(id -u)" -eq 0 ]; then
    echo "Error: Do not run as root. Run as your user."
    exit 1
fi

# Check prerequisites
check_prereqs() {
    echo "▸ Checking prerequisites..."
    
    if ! command -v docker &> /dev/null; then
        echo "Error: Docker is not installed"
        echo "Please install Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    if ! command -v tor &> /dev/null; then
        echo "Installing Tor..."
        if command -v apt-get &> /dev/null; then
            sudo apt-get update && sudo apt-get install -y tor
        elif command -v pacman &> /dev/null; then
            sudo pacman -S tor
        elif command -v dnf &> /dev/null; then
            sudo dnf install -y tor
        fi
    fi
    
    if ! systemctl is-active --quiet tor 2>/dev/null; then
        echo "Starting Tor service..."
        sudo systemctl start tor 2>/dev/null || true
        sudo systemctl enable tor 2>/dev/null || true
    fi
    
    echo "✓ Prerequisites satisfied"
}

# Create directories
create_dirs() {
    echo "▸ Creating directories..."
    mkdir -p "${INSTALL_DIR}"/{scripts,workspace/skills,logs,backups,pgp}
    mkdir -p "${HOME}/.local/bin"
    echo "✓ Directories created"
}

# Download antenna binary
install_binary() {
    echo "▸ Installing Antenna binary..."
    
    # Check if antenna binary exists
    if [ -f "${ANTENNA_BIN}" ]; then
        echo "✓ Antenna binary already installed: ${ANTENNA_BIN}"
        return
    fi
    
    # Download from GitHub releases (placeholder)
    echo "Downloading Antenna binary..."
    # curl -L -o "${ANTENNA_BIN}" "https://github.com/your-repo/antenna/releases/latest/download/antenna"
    # chmod +x "${ANTENNA_BIN}"
    
    echo "Note: Place antenna binary at ${ANTENNA_BIN}"
    echo "You can build it from source or download from releases."
}

# Setup docker compose
setup_docker_compose() {
    echo "▸ Setting up Docker compose..."
    
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
    
    echo "✓ Docker compose configured"
}

# Setup systemd services
setup_services() {
    echo "▸ Setting up systemd services..."
    
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
    echo "✓ Systemd services configured"
}

# Main
main() {
    check_prereqs
    create_dirs
    install_binary
    setup_docker_compose
    setup_services
    
    echo ""
    echo "╔════════════════════════════════════════╗"
    echo "║         Installation Complete!         ║"
    echo "╚════════════════════════════════════════╝"
    echo ""
    echo "Next steps:"
    echo "  1. Run: ~/.antenna/scripts/onboard.sh"
    echo "  2. Configure your Telegram/Discord tokens"
    echo "  3. Set up your LLM provider"
    echo "  4. Start services: ~/.antenna/scripts/onboard.sh --start"
    echo ""
    echo "For help: ~/.antenna/scripts/onboard.sh --help"
}

main "$@"
