package p2p

import (
	"bufio"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type Config struct {
	Enabled        bool     `json:"enabled"`
	ListenPort     int      `json:"listen_port"`
	BootstrapNodes []string `json:"bootstrap_nodes"`
	RelayEnabled   bool     `json:"relay_enabled"`
}

type Peer struct {
	ID        string    `json:"id"`
	Address   string    `json:"address"`
	Port      int       `json:"port"`
	Version   string    `json:"version"`
	LastSeen  time.Time `json:"last_seen"`
	AgentName string    `json:"agent_name"`
}

type Message struct {
	Type      string    `json:"type"`
	From      string    `json:"from"`
	To        string    `json:"to"`
	Payload   string    `json:"payload"`
	Timestamp time.Time `json:"timestamp"`
	Signature string    `json:"signature"`
}

type P2P struct {
	config      *Config
	peerID      string
	privateKey  ed25519.PrivateKey
	listener    net.Listener
	peers       map[string]*Peer
	peersMutex  sync.RWMutex
	messageChan chan *Message
	running     bool
}

func GeneratePeerID() (string, error) {
	_, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return "", err
	}

	pubBytes := priv.Public().(ed25519.PublicKey)
	return base64.StdEncoding.EncodeToString(pubBytes[:]), nil
}

func LoadConfig(workspace string) (*Config, error) {
	configPath := filepath.Join(workspace, "p2p.json")

	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return &Config{
			Enabled:      false,
			ListenPort:   18792,
			RelayEnabled: true,
			BootstrapNodes: []string{
				"p2p1.antenna.io:18792",
				"p2p2.antenna.io:18792",
			},
		}, nil
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, err
	}

	var config Config
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, err
	}

	return &config, nil
}

func SaveConfig(workspace string, config *Config) error {
	configPath := filepath.Join(workspace, "p2p.json")

	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(configPath, data, 0644)
}

func New(config *Config, peerID string) (*P2P, error) {
	p2p := &P2P{
		config:      config,
		peerID:      peerID,
		peers:       make(map[string]*Peer),
		messageChan: make(chan *Message, 100),
	}

	var err error
	p2p.privateKey = ed25519.PrivateKey{}
	_, err = rand.Read(p2p.privateKey[:])
	if err != nil {
		return nil, err
	}

	return p2p, nil
}

func (p *P2P) IsEnabled() bool {
	return p.config != nil && p.config.Enabled
}

func (p *P2P) PeerID() string {
	return p.peerID
}

func (p *P2P) Start() error {
	if !p.IsEnabled() {
		return fmt.Errorf("P2P is not enabled")
	}

	addr := fmt.Sprintf("0.0.0.0:%d", p.config.ListenPort)
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("failed to listen on %s: %w", addr, err)
	}

	p.listener = listener
	p.running = true

	go p.acceptLoop()
	go p.discoveryLoop()

	fmt.Printf("[P2P] Listening on %s\n", addr)
	fmt.Printf("[P2P] Peer ID: %s\n", p.peerID)

	return nil
}

func (p *P2P) Stop() {
	p.running = false
	if p.listener != nil {
		p.listener.Close()
	}
}

func (p *P2P) acceptLoop() {
	for p.running {
		conn, err := p.listener.Accept()
		if err != nil {
			if p.running {
				continue
			}
			break
		}
		go p.handleConnection(conn)
	}
}

func (p *P2P) handleConnection(conn net.Conn) {
	defer conn.Close()

	reader := bufio.NewReader(conn)

	for p.running {
		line, err := reader.ReadString('\n')
		if err != nil {
			break
		}

		var msg Message
		if err := json.Unmarshal([]byte(line), &msg); err != nil {
			continue
		}

		switch msg.Type {
		case "ping":
			p.handlePing(conn, &msg)
		case "pong":
			p.handlePong(&msg)
		case "announce":
			p.handleAnnounce(&msg)
		case "message":
			p.handlePeerMessage(&msg)
		}
	}
}

func (p *P2P) handlePing(conn net.Conn, msg *Message) {
	pong := Message{
		Type:      "pong",
		From:      p.peerID,
		To:        msg.From,
		Timestamp: time.Now(),
	}
	p.sendMessage(conn, pong)
}

func (p *P2P) handlePong(msg *Message) {
	peer := &Peer{
		ID:       msg.From,
		LastSeen: time.Now(),
	}
	p.peersMutex.Lock()
	p.peers[msg.From] = peer
	p.peersMutex.Unlock()
}

func (p *P2P) handleAnnounce(msg *Message) {
	var peer Peer
	if err := json.Unmarshal([]byte(msg.Payload), &peer); err != nil {
		return
	}

	peer.LastSeen = time.Now()
	p.peersMutex.Lock()
	p.peers[peer.ID] = &peer
	p.peersMutex.Unlock()
}

func (p *P2P) handlePeerMessage(msg *Message) {
	if msg.To == p.peerID {
		p.messageChan <- msg
	}
}

func (p *P2P) sendMessage(conn net.Conn, msg Message) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	_, err = conn.Write(append(data, '\n'))
	return err
}

func (p *P2P) ConnectToPeer(address string) error {
	conn, err := net.Dial("tcp", address)
	if err != nil {
		return err
	}
	defer conn.Close()

	ping := Message{
		Type:      "ping",
		From:      p.peerID,
		Timestamp: time.Now(),
	}

	if err := p.sendMessage(conn, ping); err != nil {
		return err
	}

	reader := bufio.NewReader(conn)
	line, err := reader.ReadString('\n')
	if err != nil {
		return err
	}

	var pong Message
	if err := json.Unmarshal([]byte(line), &pong); err != nil {
		return err
	}

	peer := &Peer{
		ID:       pong.From,
		Address:  address,
		LastSeen: time.Now(),
	}

	p.peersMutex.Lock()
	p.peers[pong.From] = peer
	p.peersMutex.Unlock()

	return nil
}

func (p *P2P) discoveryLoop() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for p.running {
		select {
		case <-ticker.C:
			p.discoverPeers()
		}
	}
}

func (p *P2P) discoverPeers() {
	p.peersMutex.RLock()
	peerCount := len(p.peers)
	p.peersMutex.RUnlock()

	if peerCount < 5 && len(p.config.BootstrapNodes) > 0 {
		for _, node := range p.config.BootstrapNodes {
			p.ConnectToPeer(node)
		}
	}

	p.announceToPeers()
}

func (p *P2P) announceToPeers() {
	peerJSON, _ := json.Marshal(Peer{
		ID:        p.peerID,
		AgentName: "Antenna",
		Version:   "1.0.0",
	})

	msg := Message{
		Type:      "announce",
		From:      p.peerID,
		Payload:   string(peerJSON),
		Timestamp: time.Now(),
	}

	p.Broadcast(msg)
}

func (p *P2P) Broadcast(msg Message) {
	p.peersMutex.RLock()
	peers := make([]*Peer, 0, len(p.peers))
	for _, peer := range p.peers {
		peers = append(peers, peer)
	}
	p.peersMutex.RUnlock()

	for _, peer := range peers {
		if peer.Address == "" {
			continue
		}
		go func(addr string) {
			conn, err := net.Dial("tcp", addr)
			if err != nil {
				return
			}
			defer conn.Close()
			p.sendMessage(conn, msg)
		}(peer.Address)
	}
}

func (p *P2P) SendTo(peerID string, payload string) error {
	p.peersMutex.RLock()
	peer, exists := p.peers[peerID]
	p.peersMutex.RUnlock()

	if !exists {
		return fmt.Errorf("peer not found: %s", peerID)
	}

	msg := Message{
		Type:      "message",
		From:      p.peerID,
		To:        peerID,
		Payload:   payload,
		Timestamp: time.Now(),
	}

	conn, err := net.Dial("tcp", peer.Address)
	if err != nil {
		return err
	}
	defer conn.Close()

	return p.sendMessage(conn, msg)
}

func (p *P2P) GetPeers() []*Peer {
	p.peersMutex.RLock()
	defer p.peersMutex.RUnlock()

	peers := make([]*Peer, 0, len(p.peers))
	for _, peer := range p.peers {
		peers = append(peers, peer)
	}
	return peers
}

func (p *P2P) MessageChan() <-chan *Message {
	return p.messageChan
}

func (p *P2P) RelayMessage(toPeerID string, payload string) error {
	msg := Message{
		Type:    "relay",
		From:    p.peerID,
		To:      toPeerID,
		Payload: payload,
	}

	p.Broadcast(msg)
	return nil
}

func (p *P2P) GetNetworkStats() map[string]interface{} {
	p.peersMutex.RLock()
	defer p.peersMutex.RUnlock()

	return map[string]interface{}{
		"peer_id":    p.peerID,
		"peer_count": len(p.peers),
		"enabled":    p.config.Enabled,
		"listening":  p.listener != nil,
	}
}
