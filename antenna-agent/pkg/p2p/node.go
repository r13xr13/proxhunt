package p2p

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type NodeType string

const (
	NodeTypeFull  NodeType = "full"
	NodeTypeLight NodeType = "light"
	NodeTypeAgent NodeType = "agent"
	NodeTypeUser  NodeType = "user"
)

type Node struct {
	ID           string            `json:"id"`
	Type         NodeType          `json:"type"`
	Name         string            `json:"name"`
	Version      string            `json:"version"`
	Address      string            `json:"address"`
	Port         int               `json:"port"`
	PublicKey    string            `json:"public_key"`
	Services     []string          `json:"services"`
	Capabilities []string          `json:"capabilities"`
	LastSeen     time.Time         `json:"last_seen"`
	LastPing     time.Time         `json:"last_ping"`
	Uptime       int64             `json:"uptime"`
	Trusted      bool              `json:"trusted"`
	Reputation   float64           `json:"reputation"`
	TorAddress   string            `json:"tor_address,omitempty"`
	AgentCount   int               `json:"agent_count,omitempty"`
	UserCount    int               `json:"user_count,omitempty"`
	Metadata     map[string]string `json:"metadata,omitempty"`
}

type NodeConfig struct {
	ID              string   `json:"id"`
	Type            NodeType `json:"type"`
	Name            string   `json:"name"`
	ListenPort      int      `json:"listen_port"`
	BootstrapNodes  []string `json:"bootstrap_nodes"`
	TrustedNodes    []string `json:"trusted_nodes"`
	MaxPeers        int      `json:"max_peers"`
	EnableDiscovery bool     `json:"enable_discovery"`
	EnableRelay     bool     `json:"enable_relay"`
	EnableDHT       bool     `json:"enable_dht"`
	TorEnabled      bool     `json:"tor_enabled"`
	TorServicePort  int      `json:"tor_service_port"`
	Services        []string `json:"services"`
	Capabilities    []string `json:"capabilities"`
}

type UserNode struct {
	ID           string    `json:"id"`
	NodeID       string    `json:"node_id"`
	Username     string    `json:"username"`
	PublicKey    string    `json:"public_key"`
	CreatedAt    time.Time `json:"created_at"`
	LastActive   time.Time `json:"last_active"`
	Reputation   float64   `json:"reputation"`
	Transactions int       `json:"transactions"`
	IsOnline     bool      `json:"is_online"`
}

type AgentNode struct {
	ID         string    `json:"id"`
	NodeID     string    `json:"node_id"`
	Name       string    `json:"name"`
	PublicKey  string    `json:"public_key"`
	CreatedAt  time.Time `json:"created_at"`
	LastActive time.Time `json:"last_active"`
	Reputation float64   `json:"reputation"`
	Tasks      int       `json:"tasks"`
	IsOnline   bool      `json:"is_online"`
	Skills     []string  `json:"skills"`
	Provider   string    `json:"provider"`
	Model      string    `json:"model"`
}

type NodeMessage struct {
	Type      string          `json:"type"`
	From      string          `json:"from"`
	To        string          `json:"to"`
	Payload   json.RawMessage `json:"payload"`
	Timestamp time.Time       `json:"timestamp"`
	Signature string          `json:"signature"`
	TTL       int             `json:"ttl"`
}

type NodeRegistry struct {
	mu         sync.RWMutex
	nodes      map[string]*Node
	users      map[string]*UserNode
	agents     map[string]*AgentNode
	nodeUsers  map[string][]string
	nodeAgents map[string][]string
	privateKey ed25519.PrivateKey
	publicKey  ed25519.PublicKey
	peerID     string
	workspace  string
	bootstrap  []string
}

func NewNodeRegistry(peerID, workspace string, bootstrapNodes []string) (*NodeRegistry, error) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, err
	}

	registry := &NodeRegistry{
		nodes:      make(map[string]*Node),
		users:      make(map[string]*UserNode),
		agents:     make(map[string]*AgentNode),
		nodeUsers:  make(map[string][]string),
		nodeAgents: make(map[string][]string),
		privateKey: priv,
		publicKey:  pub,
		peerID:     peerID,
		workspace:  workspace,
		bootstrap:  bootstrapNodes,
	}

	registry.loadFromDisk()

	return registry, nil
}

func (r *NodeRegistry) RegisterNode(node *Node) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	node.LastSeen = time.Now()
	r.nodes[node.ID] = node

	return r.saveToDisk()
}

func (r *NodeRegistry) UnregisterNode(nodeID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	delete(r.nodes, nodeID)
	delete(r.nodeUsers, nodeID)
	delete(r.nodeAgents, nodeID)

	return r.saveToDisk()
}

func (r *NodeRegistry) GetNode(nodeID string) *Node {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.nodes[nodeID]
}

func (r *NodeRegistry) GetAllNodes() []*Node {
	r.mu.RLock()
	defer r.mu.RUnlock()

	nodes := make([]*Node, 0, len(r.nodes))
	for _, n := range r.nodes {
		nodes = append(nodes, n)
	}
	return nodes
}

func (r *NodeRegistry) RegisterUser(user *UserNode) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	user.LastActive = time.Now()
	r.users[user.ID] = user

	if _, exists := r.nodeUsers[user.NodeID]; !exists {
		r.nodeUsers[user.NodeID] = []string{}
	}
	r.nodeUsers[user.NodeID] = append(r.nodeUsers[user.NodeID], user.ID)

	if node, exists := r.nodes[user.NodeID]; exists {
		node.UserCount = len(r.nodeUsers[user.NodeID])
	}

	return r.saveToDisk()
}

func (r *NodeRegistry) GetUser(userID string) *UserNode {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.users[userID]
}

func (r *NodeRegistry) GetUsersByNode(nodeID string) []*UserNode {
	r.mu.RLock()
	defer r.mu.RUnlock()

	userIDs := r.nodeUsers[nodeID]
	users := make([]*UserNode, 0, len(userIDs))
	for _, id := range userIDs {
		if u, exists := r.users[id]; exists {
			users = append(users, u)
		}
	}
	return users
}

func (r *NodeRegistry) RegisterAgent(agent *AgentNode) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	agent.LastActive = time.Now()
	r.agents[agent.ID] = agent

	if _, exists := r.nodeAgents[agent.NodeID]; !exists {
		r.nodeAgents[agent.NodeID] = []string{}
	}
	r.nodeAgents[agent.NodeID] = append(r.nodeAgents[agent.NodeID], agent.ID)

	if node, exists := r.nodes[agent.NodeID]; exists {
		node.AgentCount = len(r.nodeAgents[agent.NodeID])
	}

	return r.saveToDisk()
}

func (r *NodeRegistry) GetAgent(agentID string) *AgentNode {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.agents[agentID]
}

func (r *NodeRegistry) GetAgentsByNode(nodeID string) []*AgentNode {
	r.mu.RLock()
	defer r.mu.RUnlock()

	agentIDs := r.nodeAgents[nodeID]
	agents := make([]*AgentNode, 0, len(agentIDs))
	for _, id := range agentIDs {
		if a, exists := r.agents[id]; exists {
			agents = append(agents, a)
		}
	}
	return agents
}

func (r *NodeRegistry) GetAllAgents() []*AgentNode {
	r.mu.RLock()
	defer r.mu.RUnlock()

	agents := make([]*AgentNode, 0, len(r.agents))
	for _, a := range r.agents {
		agents = append(agents, a)
	}
	return agents
}

func (r *NodeRegistry) GetAllUsers() []*UserNode {
	r.mu.RLock()
	defer r.mu.RUnlock()

	users := make([]*UserNode, 0, len(r.users))
	for _, u := range r.users {
		users = append(users, u)
	}
	return users
}

func (r *NodeRegistry) FindNodesByCapability(capability string) []*Node {
	r.mu.RLock()
	defer r.mu.RUnlock()

	nodes := make([]*Node, 0)
	for _, n := range r.nodes {
		for _, cap := range n.Capabilities {
			if cap == capability {
				nodes = append(nodes, n)
				break
			}
		}
	}
	return nodes
}

func (r *NodeRegistry) FindNodesByService(service string) []*Node {
	r.mu.RLock()
	defer r.mu.RUnlock()

	nodes := make([]*Node, 0)
	for _, n := range r.nodes {
		for _, s := range n.Services {
			if s == service {
				nodes = append(nodes, n)
				break
			}
		}
	}
	return nodes
}

func (r *NodeRegistry) SearchUsers(query string) []*UserNode {
	r.mu.RLock()
	defer r.mu.RUnlock()

	users := make([]*UserNode, 0)
	for _, u := range r.users {
		if query == "" ||
			contains(u.Username, query) ||
			contains(u.ID, query) {
			users = append(users, u)
		}
	}
	return users
}

func (r *NodeRegistry) SearchAgents(query string) []*AgentNode {
	r.mu.RLock()
	defer r.mu.RUnlock()

	agents := make([]*AgentNode, 0)
	for _, a := range r.agents {
		if query == "" ||
			contains(a.Name, query) ||
			contains(a.ID, query) {
			agents = append(agents, a)
		}
	}
	return agents
}

func (r *NodeRegistry) UpdateUserReputation(userID string, delta float64) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if user, exists := r.users[userID]; exists {
		user.Reputation += delta
		if user.Reputation < 0 {
			user.Reputation = 0
		}
		if user.Reputation > 100 {
			user.Reputation = 100
		}
		return r.saveToDisk()
	}
	return fmt.Errorf("user not found")
}

func (r *NodeRegistry) UpdateAgentReputation(agentID string, delta float64) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if agent, exists := r.agents[agentID]; exists {
		agent.Reputation += delta
		if agent.Reputation < 0 {
			agent.Reputation = 0
		}
		if agent.Reputation > 100 {
			agent.Reputation = 100
		}
		return r.saveToDisk()
	}
	return fmt.Errorf("agent not found")
}

func (r *NodeRegistry) SetUserOnline(userID string, online bool) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if user, exists := r.users[userID]; exists {
		user.IsOnline = online
		if online {
			user.LastActive = time.Now()
		}
	}
}

func (r *NodeRegistry) SetAgentOnline(agentID string, online bool) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if agent, exists := r.agents[agentID]; exists {
		agent.IsOnline = online
		if online {
			agent.LastActive = time.Now()
		}
	}
}

func (r *NodeRegistry) SignMessage(msg *NodeMessage) error {
	msg.Timestamp = time.Now()
	msg.From = r.peerID

	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	signature := ed25519.Sign(r.privateKey, data)
	msg.Signature = base64.StdEncoding.EncodeToString(signature)

	return nil
}

func (r *NodeRegistry) VerifyMessage(msg *NodeMessage) bool {
	if msg.From == "" || msg.Signature == "" {
		return false
	}

	signature, err := base64.StdEncoding.DecodeString(msg.Signature)
	if err != nil {
		return false
	}

	sigCopy := msg.Signature
	msg.Signature = ""
	data, err := json.Marshal(msg)
	msg.Signature = sigCopy
	if err != nil {
		return false
	}

	node := r.GetNode(msg.From)
	if node == nil || node.PublicKey == "" {
		return false
	}

	pubKey, err := base64.StdEncoding.DecodeString(node.PublicKey)
	if err != nil {
		return false
	}

	return ed25519.Verify(pubKey, data, signature)
}

func (r *NodeRegistry) GetStats() map[string]interface{} {
	r.mu.RLock()
	defer r.mu.RUnlock()

	onlineUsers := 0
	for _, u := range r.users {
		if u.IsOnline {
			onlineUsers++
		}
	}

	onlineAgents := 0
	for _, a := range r.agents {
		if a.IsOnline {
			onlineAgents++
		}
	}

	return map[string]interface{}{
		"total_nodes":    len(r.nodes),
		"total_users":    len(r.users),
		"total_agents":   len(r.agents),
		"online_users":   onlineUsers,
		"online_agents":  onlineAgents,
		"trusted_nodes":  r.countTrustedNodes(),
		"avg_reputation": r.calculateAvgReputation(),
	}
}

func (r *NodeRegistry) countTrustedNodes() int {
	count := 0
	for _, n := range r.nodes {
		if n.Trusted {
			count++
		}
	}
	return count
}

func (r *NodeRegistry) calculateAvgReputation() float64 {
	if len(r.nodes) == 0 {
		return 0
	}
	total := 0.0
	for _, n := range r.nodes {
		total += n.Reputation
	}
	return total / float64(len(r.nodes))
}

func (r *NodeRegistry) saveToDisk() error {
	data := struct {
		Nodes  map[string]*Node      `json:"nodes"`
		Users  map[string]*UserNode  `json:"users"`
		Agents map[string]*AgentNode `json:"agents"`
	}{
		Nodes:  r.nodes,
		Users:  r.users,
		Agents: r.agents,
	}

	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}

	path := filepath.Join(r.workspace, "registry.json")
	return os.WriteFile(path, jsonData, 0644)
}

func (r *NodeRegistry) loadFromDisk() error {
	path := filepath.Join(r.workspace, "registry.json")

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	var loaded struct {
		Nodes  map[string]*Node      `json:"nodes"`
		Users  map[string]*UserNode  `json:"users"`
		Agents map[string]*AgentNode `json:"agents"`
	}

	if err := json.Unmarshal(data, &loaded); err != nil {
		return err
	}

	r.nodes = loaded.Nodes
	r.users = loaded.Users
	r.agents = loaded.Agents

	for nodeID, users := range r.nodeUsers {
		for _, userID := range users {
			if _, exists := r.nodeUsers[nodeID]; !exists {
				r.nodeUsers[nodeID] = []string{}
			}
			r.nodeUsers[nodeID] = append(r.nodeUsers[nodeID], userID)
		}
	}

	return nil
}

func (r *NodeRegistry) Bootstrap() error {
	for _, addr := range r.bootstrap {
		go r.connectToBootstrap(addr)
	}
	return nil
}

func (r *NodeRegistry) connectToBootstrap(addr string) {
	conn, err := net.DialTimeout("tcp", addr, 10*time.Second)
	if err != nil {
		return
	}
	defer conn.Close()

	msg := NodeMessage{
		Type: "bootstrap_request",
		To:   "broadcast",
	}
	r.SignMessage(&msg)

	encoder := json.NewEncoder(conn)
	encoder.Encode(msg)

	decoder := json.NewDecoder(conn)
	var response NodeMessage
	if err := decoder.Decode(&response); err == nil {
		r.handleBootstrapResponse(&response)
	}
}

func (r *NodeRegistry) handleBootstrapResponse(msg *NodeMessage) {
	var nodes []*Node
	if err := json.Unmarshal(msg.Payload, &nodes); err != nil {
		return
	}

	for _, node := range nodes {
		r.RegisterNode(node)
	}
}

func (r *NodeRegistry) Announce() {
	msg := NodeMessage{
		Type: "node_announce",
	}

	self := r.GetNode(r.peerID)
	if self != nil {
		payload, _ := json.Marshal(self)
		msg.Payload = payload
	}

	r.SignMessage(&msg)
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || (len(s) > 0 && containsHelper(s, substr)))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

func GenerateNodeID() (string, error) {
	_, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return "", err
	}

	pubBytes := priv.Public().(ed25519.PublicKey)
	hash := sha256.Sum256(pubBytes[:])
	return base64.URLEncoding.EncodeToString(hash[:16]), nil
}

func LoadNodeConfig(workspace string) (*NodeConfig, error) {
	path := filepath.Join(workspace, "node.json")

	if _, err := os.Stat(path); os.IsNotExist(err) {
		nodeID, err := GenerateNodeID()
		if err != nil {
			return nil, err
		}

		defaultConfig := &NodeConfig{
			ID:              nodeID,
			Type:            NodeTypeFull,
			Name:            "antenna-node",
			ListenPort:      18792,
			MaxPeers:        50,
			EnableDiscovery: true,
			EnableRelay:     true,
			EnableDHT:       true,
			BootstrapNodes: []string{
				"antenna.social:18792",
				"7kmmw5jrgk7lfgyvyutz47kj4bxhm6g3mgi7us2g25wby2w2ibqk4sad.onion:18792",
			},
			Services: []string{
				"web",
				"api",
				"p2p",
				"escrow",
				"marketplace",
			},
			Capabilities: []string{
				"chat",
				"skills",
				"trading",
				"file_transfer",
				"swarm_tasks",
			},
		}

		SaveNodeConfig(workspace, defaultConfig)
		return defaultConfig, nil
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var config NodeConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, err
	}

	return &config, nil
}

func SaveNodeConfig(workspace string, config *NodeConfig) error {
	path := filepath.Join(workspace, "node.json")
	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}
