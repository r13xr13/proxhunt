package p2p

import (
	"fmt"
	"net"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type FileTransfer struct {
	FileID    string    `json:"file_id"`
	FileName  string    `json:"file_name"`
	FileSize  int64     `json:"file_size"`
	ChunkSize int64     `json:"chunk_size"`
	From      string    `json:"from"`
	To        string    `json:"to"`
	Status    string    `json:"status"`
	Progress  float64   `json:"progress"`
	StartedAt time.Time `json:"started_at"`
	ChunkHash string    `json:"chunk_hash"`
}

type FileTransferManager struct {
	p2p         *P2P
	workspace   string
	transfers   map[string]*FileTransfer
	transfersMu sync.RWMutex
}

type PeerGroup struct {
	p2p      *P2P
	groupID  string
	name     string
	peers    []string
	metadata map[string]interface{}
}

type GossipManager struct {
	p2p        *P2P
	messages   map[string][]GossipMessage
	messagesMu sync.RWMutex
}

type GossipMessage struct {
	ID        string      `json:"id"`
	Type      string      `json:"type"`
	From      string      `json:"from"`
	Payload   interface{} `json:"payload"`
	Timestamp time.Time   `json:"timestamp"`
	TTL       int         `json:"ttl"`
}

func NewFileTransferManager(p2p *P2P, workspace string) *FileTransferManager {
	return &FileTransferManager{
		p2p:       p2p,
		workspace: workspace,
		transfers: make(map[string]*FileTransfer),
	}
}

func (f *FileTransferManager) SendFile(to string, filePath string) (*FileTransfer, error) {
	info, err := os.Stat(filePath)
	if err != nil {
		return nil, fmt.Errorf("file not found: %w", err)
	}

	transfer := &FileTransfer{
		FileID:    fmt.Sprintf("%d", time.Now().UnixNano()),
		FileName:  filepath.Base(filePath),
		FileSize:  info.Size(),
		ChunkSize: 65536,
		From:      f.p2p.peerID,
		To:        to,
		Status:    "pending",
		StartedAt: time.Now(),
	}

	f.transfersMu.Lock()
	f.transfers[transfer.FileID] = transfer
	f.transfersMu.Unlock()

	return transfer, nil
}

func (f *FileTransferManager) GetTransfer(fileID string) (*FileTransfer, error) {
	f.transfersMu.RLock()
	defer f.transfersMu.RUnlock()

	transfer, ok := f.transfers[fileID]
	if !ok {
		return nil, fmt.Errorf("transfer not found")
	}
	return transfer, nil
}

func NewPeerGroup(p2p *P2P, groupID string, name string) *PeerGroup {
	return &PeerGroup{
		p2p:      p2p,
		groupID:  groupID,
		name:     name,
		peers:    []string{},
		metadata: make(map[string]interface{}),
	}
}

func (g *PeerGroup) AddPeer(peerID string) {
	g.peers = append(g.peers, peerID)
}

func (g *PeerGroup) RemovePeer(peerID string) {
	for i, p := range g.peers {
		if p == peerID {
			g.peers = append(g.peers[:i], g.peers[i+1:]...)
			break
		}
	}
}

func (g *PeerGroup) Broadcast(messageType string, payload interface{}) error {
	msg := Message{
		Type:      messageType,
		From:      g.p2p.peerID,
		Payload:   fmt.Sprintf("%v", payload),
		Timestamp: time.Now(),
	}

	g.p2p.Broadcast(msg)
	return nil
}

func NewGossipManager(p2p *P2P) *GossipManager {
	return &GossipManager{
		p2p:      p2p,
		messages: make(map[string][]GossipMessage),
	}
}

func (g *GossipManager) Publish(topic string, msgType string, payload interface{}) error {
	message := GossipMessage{
		ID:        fmt.Sprintf("%d", time.Now().UnixNano()),
		Type:      msgType,
		From:      g.p2p.peerID,
		Payload:   payload,
		Timestamp: time.Now(),
		TTL:       5,
	}

	g.messagesMu.Lock()
	g.messages[topic] = append(g.messages[topic], message)
	if len(g.messages[topic]) > 100 {
		g.messages[topic] = g.messages[topic][1:]
	}
	g.messagesMu.Unlock()

	msg := Message{
		Type:      "gossip",
		From:      g.p2p.peerID,
		Payload:   fmt.Sprintf("%s:%v", topic, message),
		Timestamp: time.Now(),
	}
	g.p2p.Broadcast(msg)
	return nil
}

func (g *GossipManager) GetMessages(topic string) []GossipMessage {
	g.messagesMu.RLock()
	defer g.messagesMu.RUnlock()
	return g.messages[topic]
}

type DiscoveryService struct {
	p2p *P2P
}

func NewDiscoveryService(p2p *P2P) *DiscoveryService {
	return &DiscoveryService{p2p: p2p}
}

func (d *DiscoveryService) DiscoverPeers() ([]*Peer, error) {
	d.p2p.peersMutex.RLock()
	defer d.p2p.peersMutex.RUnlock()

	peers := make([]*Peer, 0, len(d.p2p.peers))
	for _, p := range d.p2p.peers {
		peers = append(peers, p)
	}
	return peers, nil
}

func (d *DiscoveryService) PingPeer(peerID string) error {
	d.p2p.peersMutex.RLock()
	peer, ok := d.p2p.peers[peerID]
	d.p2p.peersMutex.RUnlock()

	if !ok {
		return fmt.Errorf("peer not found: %s", peerID)
	}

	conn, err := net.DialTimeout("tcp", peer.Address, 5*time.Second)
	if err != nil {
		return fmt.Errorf("ping failed: %w", err)
	}
	conn.Close()

	return nil
}
