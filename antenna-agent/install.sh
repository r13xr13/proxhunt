#!/bin/bash
# Antenna Installer - One command to install Antenna

set -e

VERSION="${VERSION:-latest}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"
ANTENNA_HOME="${ANTENNA_HOME:-$HOME/.antenna}"
SKIP_MODELS="${SKIP_MODELS:-false}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Detect OS
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "darwin"
    elif [[ "$OSTYPE" == "linux"* ]]; then
        echo "linux"
    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        echo "windows"
    else
        echo "linux"
    fi
}

# Detect architecture
detect_arch() {
    local arch=$(uname -m)
    case "$arch" in
        x86_64) echo "amd64" ;;
        aarch64|arm64) echo "arm64" ;;
        armv7l) echo "armv7" ;;
        *) echo "amd64" ;;
    esac
}

# Check dependencies
check_deps() {
    log_info "Checking dependencies..."
    
    if ! command -v curl &> /dev/null && ! command -v wget &> /dev/null; then
        log_error "curl or wget required"
        exit 1
    fi
    
    if ! command -v tar &> /dev/null; then
        log_error "tar required"
        exit 1
    fi
    
    log_success "Dependencies OK"
}

# Create directories
setup_dirs() {
    log_info "Creating directories..."
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$ANTENNA_HOME/workspace/skills"
    mkdir -p "$ANTENNA_HOME/logs"
    log_success "Directories created"
}

# Download and install binary
install_binary() {
    local os=$(detect_os)
    local arch=$(detect_arch)
    
    log_info "Detected: $os/$arch"
    
    local base_url="https://github.com/r13xr/antenna/releases"
    
    if [[ "$VERSION" == "latest" ]]; then
        log_info "Fetching latest version..."
        local latest=$(curl -sL "https://api.github.com/repos/r13xr/antenna/releases/latest" | grep -o '"tag_name":.*' | cut -d'"' -f4)
        VERSION=${latest#v}
    fi
    
    log_info "Installing Antenna v$VERSION..."
    
    local filename="antenna-${os}-${arch}"
    local url="$base_url/download/v${VERSION}/${filename}"
    
    # Try direct download
    if command -v curl &> /dev/null; then
        curl -sL "$url" -o "$INSTALL_DIR/antenna" || {
            log_warn "Release not found, building from source..."
            build_from_source
            return
        }
    else
        wget -q "$url" -O "$INSTALL_DIR/antenna" || {
            log_warn "Release not found, building from source..."
            build_from_source
            return
        }
    fi
    
    chmod +x "$INSTALL_DIR/antenna"
    log_success "Binary installed to $INSTALL_DIR/antenna"
}

# Build from source (fallback)
build_from_source() {
    log_info "Building from source (Go required)..."
    
    if ! command -v go &> /dev/null; then
        log_error "Go not installed. Install from https://go.dev/"
        exit 1
    fi
    
    cd /tmp
    rm -rf antenna
    git clone --depth 1 https://github.com/r13xr/antenna.git
    cd antenna
    make build
    cp build/antenna "$INSTALL_DIR/antenna"
    chmod +x "$INSTALL_DIR/antenna"
    
    log_success "Built and installed from source"
}

# Create default config
setup_config() {
    log_info "Creating configuration..."
    
    if [[ -f "$ANTENNA_HOME/config.json" ]]; then
        log_warn "Config already exists, skipping"
        return
    fi
    
    cat > "$ANTENNA_HOME/config.json" << 'EOF'
{
  "agents": {
    "defaults": {
      "workspace": "~/.antenna/workspace",
      "restrict_to_workspace": true,
      "provider": "ollama",
      "model": "llama3.2",
      "max_tokens": 32768,
      "max_tool_iterations": 20,
      "memory_enabled": true
    }
  },
  "session": {
    "memory_file": "~/.antenna/workspace/memory.json"
  },
  "channels": {
    "telegram": { "enabled": false },
    "discord": { "enabled": false },
    "web": { "enabled": true }
  },
  "providers": {
    "ollama": {
      "api_key": "ollama-key",
      "api_base": "http://localhost:11434"
    }
  },
  "gateway": {
    "host": "0.0.0.0",
    "port": 18790
  },
  "subagents": {
    "researcher": { "model": "llama3.2:1b" },
    "coder": { "model": "codellama:7b" },
    "writer": { "model": "llama3.2" },
    "analyst": { "model": "llama3.2" }
  }
}
EOF
    
    log_success "Config created at $ANTENNA_HOME/config.json"
}

# Create workspace files
setup_workspace() {
    log_info "Setting up workspace..."
    
    # AGENT.md
    cat > "$ANTENNA_HOME/workspace/AGENT.md" << 'EOF'
# Agent Instructions

You are **Antenna**, a decentralized AI assistant. Be concise, accurate, and helpful.

## Core Personality
- Helpful, Efficient, Proactive, Creative

## Guidelines
- Use tools wisely
- Delegate with spawn {task: "...", type: "research"}
- Remember important info in memory.json
EOF

    # SOUL.md
    cat > "$ANTENNA_HOME/workspace/SOUL.md" << 'EOF'
# Soul

I am Antenna, a decentralized AI assistant. 

## Personality
Helpful, Efficient, Creative, Honest

## Values
User privacy, Transparency, Continuous improvement
EOF

    log_success "Workspace setup complete"
}

# Add to PATH
add_to_path() {
    if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
        log_info "Adding $INSTALL_DIR to PATH..."
        
        local shell_rc=""
        if [[ -n "$ZSH_VERSION" ]]; then
            shell_rc="$HOME/.zshrc"
        elif [[ -n "$BASH_VERSION" ]]; then
            shell_rc="$HOME/.bashrc"
        fi
        
        if [[ -n "$shell_rc" ]]; then
            echo "" >> "$shell_rc"
            echo "# Antenna" >> "$shell_rc"
            echo "export PATH=\"\$PATH:$INSTALL_DIR\"" >> "$shell_rc"
            log_success "Added to $shell_rc"
            log_info "Run 'source $shell_rc' or restart terminal"
        fi
    fi
}

# Install Ollama
install_ollama() {
    log_info "Setting up Ollama (AI models)..."
    
    if command -v ollama &> /dev/null; then
        log_success "Ollama already installed"
        return
    fi
    
    local os=$(detect_os)
    
    log_info "Installing Ollama..."
    
    # Install Ollama
    if [[ "$os" == "darwin" ]]; then
        brew install ollama
    elif [[ "$os" == "linux" ]]; then
        curl -fsSL https://ollama.com/install.sh | sh
    else
        # Windows - use winget or download
        winget install Ollama.Ollama
    fi
    
    log_success "Ollama installed"
}

# Pull default models
install_models() {
    if [[ "$SKIP_MODELS" == "true" ]]; then
        log_info "Skipping model download (SKIP_MODELS=true)"
        return
    fi
    
    log_info "Downloading AI models (this may take a few minutes)..."
    
    # Check if ollama is available
    if ! command -v ollama &> /dev/null; then
        log_warn "Ollama not installed, skipping models"
        return
    fi
    
    # Start ollama service in background
    if [[ "$os" == "linux" ]]; then
        (ollama serve &) 2>/dev/null || true
        sleep 3
    fi
    
    # Pull lightweight models (under 5GB total)
    local models=(
        "llama3.2:1b"      # Lightweight - 1.3GB
        "llama3.2"         # General - 4.7GB  
        "codellama:7b"     # Coding - 3.8GB
        "nomic-embed-text" # Embeddings - 274MB
    )
    
    for model in "${models[@]}"; do
        log_info "Downloading $model..."
        ollama pull "$model" 2>/dev/null || log_warn "Failed to pull $model"
    done
    
    log_success "AI models ready!"
}

# Add to PATH

# Start antenna
start_antenna() {
    log_info "Starting Antenna..."
    
    # Start ollama first if installed
    if command -v ollama &> /dev/null; then
        log_info "Starting Ollama..."
        (ollama serve &) 2>/dev/null || true
        sleep 2
    fi
    
    # Start in background
    nohup "$INSTALL_DIR/antenna" gateway > "$ANTENNA_HOME/logs/antenna.log" 2>&1 &
    
    sleep 2
    
    if curl -s http://localhost:18790/health > /dev/null 2>&1; then
        log_success "Antenna is running!"
        echo ""
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}  Antenna installed successfully!${NC}"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        echo "  Web UI:    http://localhost:3000"
        echo "  API:       http://localhost:18790"
        echo "  Config:    $ANTENNA_HOME/config.json"
        echo ""
        echo "  Next steps:"
        echo "    1. Configure Telegram/Discord bots (optional)"
        echo "    2. Set up LLM provider (ollama recommended)"
        echo "    3. Run 'antenna gateway' to start"
        echo ""
    else
        log_error "Failed to start Antenna"
        log_info "Check logs: tail $ANTENNA_HOME/logs/antenna.log"
    fi
}

# Main
main() {
    echo ""
    echo -e "${BLUE}╔═══════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║       📡 Antenna Installer v1.0              ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════╝${NC}"
    echo ""
    
    check_deps
    setup_dirs
    install_binary
    install_ollama
    install_models
    setup_config
    setup_workspace
    add_to_path
    
    echo ""
    read -p "Start Antenna now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        start_antenna
    else
        log_info "Run 'antenna gateway' to start"
    fi
}

main "$@"
