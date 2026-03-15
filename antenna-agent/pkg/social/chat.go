package social

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type ChatRoom struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Description  string    `json:"description"`
	CreatedBy    string    `json:"created_by"`
	CreatedAt    time.Time `json:"created_at"`
	Members      []string  `json:"members"`
	Admins       []string  `json:"admins"`
	Private      bool      `json:"private"`
	MaxMembers   int       `json:"max_members"`
	MessageCount int64     `json:"message_count"`
}

type ChatMessage struct {
	ID         string    `json:"id"`
	RoomID     string    `json:"room_id"`
	SenderID   string    `json:"sender_id"`
	SenderName string    `json:"sender_name"`
	Content    string    `json:"content"`
	Timestamp  time.Time `json:"timestamp"`
	Edited     bool      `json:"edited"`
}

type AgentTeam struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	LeaderID    string            `json:"leader_id"`
	Members     []TeamMember      `json:"members"`
	Tasks       []TeamTask        `json:"tasks"`
	CreatedAt   time.Time         `json:"created_at"`
	Config      map[string]string `json:"config"`
}

type TeamMember struct {
	AgentID   string `json:"agent_id"`
	Role      string `json:"role"` // leader, worker, coordinator
	PeerID    string `json:"peer_id"`
	Status    string `json:"status"` // active, idle, offline
	Specialty string `json:"specialty"`
}

type TeamTask struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	AssignedTo  string    `json:"assigned_to"`
	Status      string    `json:"status"` // pending, in_progress, completed, failed
	Priority    int       `json:"priority"`
	CreatedAt   time.Time `json:"created_at"`
	CompletedAt time.Time `json:"completed_at"`
	Result      string    `json:"result"`
}

type ChatRoomManager struct {
	rooms     map[string]*ChatRoom
	messages  map[string][]ChatMessage
	roomsLock sync.RWMutex
	msgLock   sync.RWMutex
	workspace string
}

func NewChatRoomManager(workspace string) *ChatRoomManager {
	return &ChatRoomManager{
		rooms:     make(map[string]*ChatRoom),
		messages:  make(map[string][]ChatMessage),
		workspace: workspace,
	}
}

func (c *ChatRoomManager) Load() error {
	roomsPath := filepath.Join(c.workspace, "rooms.json")

	if _, err := os.Stat(roomsPath); err != nil {
		return nil
	}

	data, _ := os.ReadFile(roomsPath)
	var rooms map[string]*ChatRoom
	json.Unmarshal(data, &rooms)

	if rooms != nil {
		c.rooms = rooms
	}

	return nil
}

func (c *ChatRoomManager) Save() error {
	roomsPath := filepath.Join(c.workspace, "rooms.json")
	data, _ := json.MarshalIndent(c.rooms, "", "  ")
	return os.WriteFile(roomsPath, data, 0644)
}

func (c *ChatRoomManager) CreateRoom(name, description, creatorID string, private bool) (*ChatRoom, error) {
	roomID := generateID()

	room := &ChatRoom{
		ID:          roomID,
		Name:        name,
		Description: description,
		CreatedBy:   creatorID,
		CreatedAt:   time.Now(),
		Members:     []string{creatorID},
		Admins:      []string{creatorID},
		Private:     private,
		MaxMembers:  100,
	}

	c.roomsLock.Lock()
	c.rooms[roomID] = room
	c.roomsLock.Unlock()

	c.Save()

	return room, nil
}

func (c *ChatRoomManager) GetRoom(roomID string) *ChatRoom {
	c.roomsLock.RLock()
	defer c.roomsLock.RUnlock()
	return c.rooms[roomID]
}

func (c *ChatRoomManager) ListRooms() []*ChatRoom {
	c.roomsLock.RLock()
	defer c.roomsLock.RUnlock()

	rooms := make([]*ChatRoom, 0, len(c.rooms))
	for _, room := range c.rooms {
		rooms = append(rooms, room)
	}
	return rooms
}

func (c *ChatRoomManager) JoinRoom(roomID, peerID string) error {
	c.roomsLock.Lock()
	defer c.roomsLock.Unlock()

	room, ok := c.rooms[roomID]
	if !ok {
		return fmt.Errorf("room not found")
	}

	if len(room.Members) >= room.MaxMembers {
		return fmt.Errorf("room is full")
	}

	for _, member := range room.Members {
		if member == peerID {
			return fmt.Errorf("already a member")
		}
	}

	room.Members = append(room.Members, peerID)
	return nil
}

func (c *ChatRoomManager) LeaveRoom(roomID, peerID string) error {
	c.roomsLock.Lock()
	defer c.roomsLock.Unlock()

	room, ok := c.rooms[roomID]
	if !ok {
		return fmt.Errorf("room not found")
	}

	newMembers := []string{}
	for _, m := range room.Members {
		if m != peerID {
			newMembers = append(newMembers, m)
		}
	}

	room.Members = newMembers

	newAdmins := []string{}
	for _, a := range room.Admins {
		if a != peerID {
			newAdmins = append(newAdmins, a)
		}
	}
	room.Admins = newAdmins

	return nil
}

func (c *ChatRoomManager) SendMessage(roomID, senderID, senderName, content string) (*ChatMessage, error) {
	c.roomsLock.RLock()
	room, ok := c.rooms[roomID]
	c.roomsLock.RUnlock()

	if !ok {
		return nil, fmt.Errorf("room not found")
	}

	isMember := false
	for _, m := range room.Members {
		if m == senderID {
			isMember = true
			break
		}
	}

	if !isMember {
		return nil, fmt.Errorf("not a member of this room")
	}

	msg := &ChatMessage{
		ID:         generateID(),
		RoomID:     roomID,
		SenderID:   senderID,
		SenderName: senderName,
		Content:    content,
		Timestamp:  time.Now(),
	}

	c.msgLock.Lock()
	c.messages[roomID] = append(c.messages[roomID], *msg)
	room.MessageCount++
	c.msgLock.Unlock()

	return msg, nil
}

func (c *ChatRoomManager) GetMessages(roomID string, limit int) []ChatMessage {
	c.msgLock.RLock()
	defer c.msgLock.RUnlock()

	messages := c.messages[roomID]
	if limit > 0 && len(messages) > limit {
		return messages[len(messages)-limit:]
	}

	return messages
}

type TeamManager struct {
	teams     map[string]*AgentTeam
	teamsLock sync.RWMutex
	workspace string
}

func NewTeamManager(workspace string) *TeamManager {
	return &TeamManager{
		teams:     make(map[string]*AgentTeam),
		workspace: workspace,
	}
}

func (t *TeamManager) CreateTeam(name, description, leaderID string) (*AgentTeam, error) {
	teamID := generateID()

	team := &AgentTeam{
		ID:          teamID,
		Name:        name,
		Description: description,
		LeaderID:    leaderID,
		Members: []TeamMember{
			{AgentID: leaderID, Role: "leader", Status: "active"},
		},
		Tasks:     []TeamTask{},
		CreatedAt: time.Now(),
		Config:    make(map[string]string),
	}

	t.teamsLock.Lock()
	t.teams[teamID] = team
	t.teamsLock.Unlock()

	return team, nil
}

func (t *TeamManager) GetTeam(teamID string) *AgentTeam {
	t.teamsLock.RLock()
	defer t.teamsLock.RUnlock()
	return t.teams[teamID]
}

func (t *TeamManager) ListTeams() []*AgentTeam {
	t.teamsLock.RLock()
	defer t.teamsLock.RUnlock()

	teams := make([]*AgentTeam, 0, len(t.teams))
	for _, team := range t.teams {
		teams = append(teams, team)
	}
	return teams
}

func (t *TeamManager) AddMember(teamID, agentID, peerID, role, specialty string) error {
	t.teamsLock.Lock()
	defer t.teamsLock.Unlock()

	team, ok := t.teams[teamID]
	if !ok {
		return fmt.Errorf("team not found")
	}

	member := TeamMember{
		AgentID:   agentID,
		PeerID:    peerID,
		Role:      role,
		Status:    "active",
		Specialty: specialty,
	}

	team.Members = append(team.Members, member)
	return nil
}

func (t *TeamManager) RemoveMember(teamID, agentID string) error {
	t.teamsLock.Lock()
	defer t.teamsLock.Unlock()

	team, ok := t.teams[teamID]
	if !ok {
		return fmt.Errorf("team not found")
	}

	newMembers := []TeamMember{}
	for _, m := range team.Members {
		if m.AgentID != agentID {
			newMembers = append(newMembers, m)
		}
	}

	team.Members = newMembers
	return nil
}

func (t *TeamManager) AssignTask(teamID, title, description, assignedTo string, priority int) (*TeamTask, error) {
	t.teamsLock.Lock()
	defer t.teamsLock.Unlock()

	team, ok := t.teams[teamID]
	if !ok {
		return nil, fmt.Errorf("team not found")
	}

	task := &TeamTask{
		ID:          generateID(),
		Title:       title,
		Description: description,
		AssignedTo:  assignedTo,
		Status:      "pending",
		Priority:    priority,
		CreatedAt:   time.Now(),
	}

	team.Tasks = append(team.Tasks, *task)
	return task, nil
}

func (t *TeamManager) UpdateTaskStatus(teamID, taskID, status, result string) error {
	t.teamsLock.Lock()
	defer t.teamsLock.Unlock()

	team, ok := t.teams[teamID]
	if !ok {
		return fmt.Errorf("team not found")
	}

	for i := range team.Tasks {
		if team.Tasks[i].ID == taskID {
			team.Tasks[i].Status = status
			if status == "completed" {
				team.Tasks[i].CompletedAt = time.Now()
				team.Tasks[i].Result = result
			}
			return nil
		}
	}

	return fmt.Errorf("task not found")
}

func generateID() string {
	timestamp := time.Now().UnixNano()
	return fmt.Sprintf("%x", timestamp)[:16]
}

type BroadcastManager struct {
	p2p       interface{ Broadcast(msg string) }
	workspace string
}

func NewBroadcastManager(p2p interface{ Broadcast(msg string) }, workspace string) *BroadcastManager {
	return &BroadcastManager{
		p2p:       p2p,
		workspace: workspace,
	}
}

func (b *BroadcastManager) Broadcast(senderID, message string) error {
	b.p2p.Broadcast(message)
	return nil
}

func (b *BroadcastManager) BroadcastToPeers(peerIDs []string, senderID, message string) error {
	return nil
}
