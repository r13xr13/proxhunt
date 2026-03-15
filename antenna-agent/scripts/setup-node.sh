#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
# 📡 Antenna Node Setup Script
# Deploy your own Antenna P2P node and join the decentralized AI network
# ═══════════════════════════════════════════════════════════════════════════════

set -e

NODE_VERSION="1.0.0"
CONFIG_DIR="$HOME/.antenna-node"
COMPOSE_FILE="docker-compose.node.yml"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

print_banner() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                                                               ║"
    echo "║   📡 Antenna P2P Node Setup                                   ║"
    echo "║   Decentralized AI Agent Network                              ║"
    echo "║                                                               ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_dependencies() {
    print_step "Checking dependencies..."
    
    local missing=()
    
    if ! command -v docker &> /dev/null; then
        missing+=("docker")
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        missing+=("docker-compose")
    fi
    
    if [ ${#missing[@]} -ne 0 ]; then
        print_error "Missing dependencies: ${missing[*]}"
        echo ""
        echo "Please install:"
        for dep in "${missing[@]}"; do
            case $dep in
                docker)
                    echo "  Docker: https://docs.docker.com/get-docker/"
                    ;;
                docker-compose)
                    echo "  Docker Compose: https://docs.docker.com/compose/install/"
                    ;;
            esac
        done
        exit 1
    fi
    
    print_success "All dependencies satisfied"
}

generate_node_id() {
    openssl rand -hex 16
}

setup_config() {
    print_step "Setting up node configuration..."
    
    mkdir -p "$CONFIG_DIR"
    
    NODE_ID=$(generate_node_id)
    NODE_NAME="${NODE_NAME:-Antenna-Node-$(hostname 2>/dev/null || echo 'local')}"
    NODE_TYPE="${NODE_TYPE:-full}"
    
    cat > "$CONFIG_DIR/.env" << EOF
# Antenna Node Configuration
NODE_ID=$NODE_ID
NODE_NAME=$NODE_NAME
NODE_TYPE=$NODE_TYPE
BOOTSTRAP_NODES=antenna.social:18792,7kmmw5jrgk7lfgyvyutz47kj4bxhm6g3mgi7us2g25wby2w2ibqk4sad.onion:18792

# Database
POSTGRES_USER=antenna
POSTGRES_PASSWORD=$(openssl rand -base64 32)
POSTGRES_DB=antenna

# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF
    
    cat > "$CONFIG_DIR/node.json" << EOF
{
  "id": "$NODE_ID",
  "type": "$NODE_TYPE",
  "name": "$NODE_NAME",
  "listen_port": 18792,
  "max_peers": 50,
  "enable_discovery": true,
  "enable_relay": true,
  "enable_dht": true,
  "bootstrap_nodes": [
    "antenna.social:18792",
    "7kmmw5jrgk7lfgyvyutz47kj4bxhm6g3mgi7us2g25wby2w2ibqk4sad.onion:18792"
  ],
  "services": ["web", "api", "p2p", "escrow", "marketplace"],
  "capabilities": ["chat", "skills", "trading", "file_transfer", "swarm_tasks"],
  "created_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
    
    print_success "Node configuration created"
    echo -e "  ${CYAN}Node ID:${NC} $NODE_ID"
    echo -e "  ${CYAN}Node Name:${NC} $NODE_NAME"
    echo -e "  ${CYAN}Node Type:${NC} $NODE_TYPE"
}

pull_images() {
    print_step "Pulling Docker images..."
    
    docker pull r13xr/antenna:latest 2>/dev/null || {
        print_warning "Could not pull antenna image, building locally..."
        if [ -d "antenna" ]; then
            docker build -t r13xr/antenna:latest ./antenna
        fi
    }
    
    docker pull r13xr/antenna-web:latest 2>/dev/null || {
        print_warning "Could not pull antenna-web image, building locally..."
        if [ -d "antenna-web" ]; then
            docker build -t r13xr/antenna-web:latest ./antenna-web
        fi
    }
    
    docker pull postgres:16-alpine
    docker pull nginx:alpine
    docker pull goldy/tor-hidden-service:latest
    
    print_success "Images pulled"
}

create_init_db() {
    print_step "Creating database initialization script..."
    
    cat > "$CONFIG_DIR/init-db.sql" << 'EOF'
-- Antenna Node Database Schema
CREATE TABLE IF NOT EXISTS nodes (
    id VARCHAR(64) PRIMARY KEY,
    type VARCHAR(32) NOT NULL,
    name VARCHAR(255),
    address VARCHAR(255),
    port INTEGER,
    public_key TEXT,
    services JSONB DEFAULT '[]',
    capabilities JSONB DEFAULT '[]',
    last_seen TIMESTAMP,
    reputation FLOAT DEFAULT 50.0,
    trusted BOOLEAN DEFAULT false,
    tor_address VARCHAR(255),
    agent_count INTEGER DEFAULT 0,
    user_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    node_id VARCHAR(64) REFERENCES nodes(id),
    username VARCHAR(255),
    public_key TEXT,
    last_active TIMESTAMP,
    reputation FLOAT DEFAULT 50.0,
    transactions INTEGER DEFAULT 0,
    is_online BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agents (
    id VARCHAR(64) PRIMARY KEY,
    node_id VARCHAR(64) REFERENCES nodes(id),
    name VARCHAR(255),
    public_key TEXT,
    last_active TIMESTAMP,
    reputation FLOAT DEFAULT 50.0,
    tasks INTEGER DEFAULT 0,
    is_online BOOLEAN DEFAULT false,
    skills JSONB DEFAULT '[]',
    provider VARCHAR(64),
    model VARCHAR(128),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS escrow_deals (
    id SERIAL PRIMARY KEY,
    buyer_id VARCHAR(64),
    seller_id VARCHAR(64),
    agent_id VARCHAR(64),
    amount_xmr FLOAT,
    escrow_address VARCHAR(128),
    status VARCHAR(32) DEFAULT 'pending',
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    funded_at TIMESTAMP,
    completed_at TIMESTAMP,
    cancelled_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_goods (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64),
    node_id VARCHAR(64),
    title VARCHAR(255),
    description TEXT,
    price_xmr FLOAT,
    category VARCHAR(64),
    status VARCHAR(32) DEFAULT 'active',
    images JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deal_reviews (
    id SERIAL PRIMARY KEY,
    deal_id INTEGER REFERENCES escrow_deals(id),
    reviewer_id VARCHAR(64),
    reviewee_id VARCHAR(64),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS p2p_messages (
    id SERIAL PRIMARY KEY,
    from_node VARCHAR(64),
    to_node VARCHAR(64),
    message_type VARCHAR(64),
    payload JSONB,
    signature TEXT,
    ttl INTEGER DEFAULT 3,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
CREATE INDEX IF NOT EXISTS idx_nodes_trusted ON nodes(trusted);
CREATE INDEX IF NOT EXISTS idx_users_node ON users(node_id);
CREATE INDEX IF NOT EXISTS idx_agents_node ON agents(node_id);
CREATE INDEX IF NOT EXISTS idx_escrow_status ON escrow_deals(status);
CREATE INDEX IF NOT EXISTS idx_goods_user ON user_goods(user_id);
EOF
    
    print_success "Database schema created"
}

create_nginx_config() {
    print_step "Creating nginx configuration..."
    
    cat > "$CONFIG_DIR/nginx.conf" << 'EOF'
events {
    worker_connections 1024;
}

http {
    upstream web {
        server antenna-web:3000;
    }
    
    upstream gateway {
        server antenna-gateway:18790;
    }
    
    server {
        listen 80;
        server_name _;
        
        client_max_body_size 100M;
        
        location / {
            proxy_pass http://web;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
        
        location /api/antenna/ {
            proxy_pass http://gateway/api/antenna/;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
        
        location /ws {
            proxy_pass http://gateway/ws;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }
    }
}
EOF
    
    print_success "Nginx configured"
}

download_compose() {
    print_step "Downloading docker-compose configuration..."
    
    curl -sL "https://raw.githubusercontent.com/r13xr/antenna/main/docker-compose.node.yml" \
        -o "$CONFIG_DIR/docker-compose.node.yml" 2>/dev/null || {
        print_warning "Could not download compose file, creating local..."
        cat > "$CONFIG_DIR/docker-compose.node.yml" << 'COMPOSE_EOF'
version: '3.8'

services:
  antenna-postgres:
    image: postgres:16-alpine
    container_name: antenna-postgres
    restart: unless-stopped
    env_file:
      - .env
    environment:
      POSTGRES_USER: antenna
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: antenna
    volumes:
      - antenna-postgres-data:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init.sql:ro
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U antenna"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - antenna-network

  antenna-web:
    image: r13xr/antenna-web:latest
    container_name: antenna-web
    restart: unless-stopped
    env_file:
      - .env
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://antenna:${POSTGRES_PASSWORD}@antenna-postgres:5432/antenna
      - NEXT_PUBLIC_P2P_ENABLED=true
      - NEXT_PUBLIC_NODE_ID=${NODE_ID}
      - NEXT_PUBLIC_NODE_NAME=${NODE_NAME}
    ports:
      - "3000:3000"
    depends_on:
      antenna-postgres:
        condition: service_healthy
    networks:
      - antenna-network

  antenna-gateway:
    image: r13xr/antenna:latest
    container_name: antenna-gateway
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "18790:18790"
      - "18792:18792"
    volumes:
      - antenna-workspace:/root/.antenna/workspace
      - ./node.json:/root/.antenna/workspace/node.json:ro
    environment:
      - ANTENNA_P2P_ENABLED=true
      - ANTENNA_P2P_PORT=18792
      - ANTENNA_NODE_ID=${NODE_ID}
      - ANTENNA_NODE_TYPE=${NODE_TYPE}
      - ANTENNA_NODE_NAME=${NODE_NAME}
      - ANTENNA_BOOTSTRAP_NODES=${BOOTSTRAP_NODES}
    command: ["gateway", "--p2p"]
    depends_on:
      antenna-postgres:
        condition: service_healthy
    networks:
      - antenna-network

  antenna-tor:
    image: goldy/tor-hidden-service:latest
    container_name: antenna-tor
    restart: unless-stopped
    environment:
      - SERVICE1_TOR_SERVICE_HOSTS=80:antenna-web:3000,18792:antenna-gateway:18792
      - SERVICE1_TOR_SERVICE_VERSION=3
    volumes:
      - antenna-tor-keys:/var/lib/tor/hidden_service
    depends_on:
      - antenna-web
      - antenna-gateway
    networks:
      - antenna-network

volumes:
  antenna-postgres-data:
  antenna-workspace:
  antenna-tor-keys:

networks:
  antenna-network:
    driver: bridge
COMPOSE_EOF
    }
    
    print_success "Compose file ready"
}

start_node() {
    print_step "Starting Antenna node..."
    
    cd "$CONFIG_DIR"
    
    docker-compose -f docker-compose.node.yml up -d
    
    echo ""
    sleep 5
    
    if docker-compose -f docker-compose.node.yml ps | grep -q "Up"; then
        print_success "Node started successfully!"
        return 0
    else
        print_error "Failed to start node"
        docker-compose -f docker-compose.node.yml logs
        return 1
    fi
}

get_tor_address() {
    print_step "Getting Tor hidden service address..."
    
    local tor_file="$CONFIG_DIR/tor_address.txt"
    
    for i in {1..30}; do
        if docker exec antenna-tor cat /var/lib/tor/hidden_service/hostname 2>/dev/null > "$tor_file"; then
            TOR_ADDR=$(cat "$tor_file")
            if [ -n "$TOR_ADDR" ]; then
                print_success "Tor address: ${CYAN}http://${TOR_ADDR}${NC}"
                return 0
            fi
        fi
        sleep 2
    done
    
    print_warning "Could not retrieve Tor address (may take a few minutes)"
    return 1
}

print_final_info() {
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║           🎉 Antenna Node Successfully Deployed!              ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${CYAN}📡 Your Node Endpoints:${NC}"
    echo -e "  • Web UI:     ${GREEN}http://localhost:3000${NC}"
    echo -e "  • API:        ${GREEN}http://localhost:18790${NC}"
    echo -e "  • P2P Port:   ${GREEN}18792${NC}"
    echo ""
    
    if [ -f "$CONFIG_DIR/tor_address.txt" ]; then
        TOR_ADDR=$(cat "$CONFIG_DIR/tor_address.txt")
        echo -e "${PURPLE}🧅 Tor Hidden Service:${NC}"
        echo -e "  • ${GREEN}http://${TOR_ADDR}${NC}"
        echo ""
    fi
    
    echo -e "${CYAN}📁 Configuration:${NC}"
    echo -e "  • Config dir:  $CONFIG_DIR"
    echo -e "  • Node ID:     $(grep NODE_ID "$CONFIG_DIR/.env" | cut -d= -f2)"
    echo ""
    echo -e "${CYAN}🔧 Management Commands:${NC}"
    echo -e "  • View logs:   ${YELLOW}cd $CONFIG_DIR && docker-compose logs -f${NC}"
    echo -e "  • Stop node:   ${YELLOW}cd $CONFIG_DIR && docker-compose down${NC}"
    echo -e "  • Restart:     ${YELLOW}cd $CONFIG_DIR && docker-compose restart${NC}"
    echo -e "  • Update:      ${YELLOW}cd $CONFIG_DIR && docker-compose pull && docker-compose up -d${NC}"
    echo ""
    echo -e "${GREEN}🌐 You are now part of the Antenna P2P network!${NC}"
    echo ""
}

show_help() {
    echo "Antenna Node Setup Script v$NODE_VERSION"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  install    Full installation (default)"
    echo "  start      Start the node"
    echo "  stop       Stop the node"
    echo "  restart    Restart the node"
    echo "  logs       Show logs"
    echo "  status     Show node status"
    echo "  update     Update to latest version"
    echo "  uninstall  Remove all data"
    echo ""
    echo "Environment Variables:"
    echo "  NODE_NAME    Custom node name (default: Antenna-Node-<hostname>)"
    echo "  NODE_TYPE    Node type: full, light, agent (default: full)"
    echo ""
}

cmd_start() {
    cd "$CONFIG_DIR"
    docker-compose -f docker-compose.node.yml up -d
    get_tor_address
    print_final_info
}

cmd_stop() {
    cd "$CONFIG_DIR"
    docker-compose -f docker-compose.node.yml down
    print_success "Node stopped"
}

cmd_restart() {
    cmd_stop
    cmd_start
}

cmd_logs() {
    cd "$CONFIG_DIR"
    docker-compose -f docker-compose.node.yml logs -f
}

cmd_status() {
    cd "$CONFIG_DIR"
    docker-compose -f docker-compose.node.yml ps
    echo ""
    get_tor_address
}

cmd_update() {
    print_step "Updating Antenna node..."
    cd "$CONFIG_DIR"
    docker-compose -f docker-compose.node.yml pull
    docker-compose -f docker-compose.node.yml up -d
    print_success "Update complete"
}

cmd_uninstall() {
    print_warning "This will remove all Antenna node data!"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cd "$CONFIG_DIR"
        docker-compose -f docker-compose.node.yml down -v --remove-orphans
        cd ~
        rm -rf "$CONFIG_DIR"
        print_success "Antenna node uninstalled"
    fi
}

main() {
    print_banner
    
    case "${1:-install}" in
        install)
            check_dependencies
            setup_config
            create_init_db
            create_nginx_config
            download_compose
            pull_images
            start_node
            get_tor_address
            print_final_info
            ;;
        start) cmd_start ;;
        stop) cmd_stop ;;
        restart) cmd_restart ;;
        logs) cmd_logs ;;
        status) cmd_status ;;
        update) cmd_update ;;
        uninstall) cmd_uninstall ;;
        help|--help|-h) show_help ;;
        *)
            print_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
