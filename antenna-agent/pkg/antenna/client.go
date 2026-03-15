package antenna

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"time"
)

type Config struct {
	Enabled      bool     `json:"enabled"`
	APIURL       string   `json:"api_url"`
	OnionURL     string   `json:"onion_url"`
	APIKey       string   `json:"api_key"`
	AgentID      string   `json:"agent_id"`
	AutoRegister bool     `json:"auto_register"`
	SyncSkills   bool     `json:"sync_skills"`
	Capabilities []string `json:"capabilities"`
}

type MarketplaceSkill struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Price       float64  `json:"price"`
	Author      string   `json:"author"`
	Version     string   `json:"version"`
	Categories  []string `json:"categories"`
	DownloadURL string   `json:"download_url"`
}

type Agent struct {
	ID           interface{} `json:"id"`
	Name         string      `json:"name"`
	Avatar       string      `json:"avatar"`
	Bio          string      `json:"bio"`
	Status       string      `json:"status"`
	Channels     []string    `json:"channels"`
	Hostname     string      `json:"hostname"`
	Version      string      `json:"version"`
	Capabilities []string    `json:"capabilities"`
	Fingerprint  string      `json:"fingerprint"`
}

type PeerAgent struct {
	ID           interface{} `json:"id"`
	Name         string      `json:"name"`
	Avatar       string      `json:"avatar"`
	Status       string      `json:"status"`
	Capabilities []string    `json:"capabilities"`
	LastSeen     string      `json:"last_seen"`
	Hostname     string      `json:"hostname"`
	Version      string      `json:"version"`
}

type HeartbeatResponse struct {
	Success bool        `json:"success"`
	Agent   *Agent      `json:"agent"`
	Peers   []PeerAgent `json:"peers"`
}

type Client struct {
	config    *Config
	client    *http.Client
	publicKey string
}

func NewClient(config *Config) *Client {
	return &Client{
		config: config,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (c *Client) SetPublicKey(key string) {
	c.publicKey = key
}

func (c *Client) IsEnabled() bool {
	return c.config != nil && c.config.Enabled
}

func (c *Client) GetAPIURL() string {
	if c.config == nil {
		return "http://localhost:3000"
	}
	if c.config.OnionURL != "" {
		return c.config.OnionURL
	}
	return c.config.APIURL
}

func (c *Client) GetOnionURL() string {
	if c.config == nil {
		return ""
	}
	return c.config.OnionURL
}

func LoadConfig(workspace string) (*Config, error) {
	configPath := filepath.Join(workspace, "antenna.json")

	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return &Config{
			Enabled:      false,
			APIURL:       "http://localhost:3000",
			AutoRegister: true,
			SyncSkills:   true,
			Capabilities: []string{"chat", "tools", "skills"},
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
	configPath := filepath.Join(workspace, "antenna.json")

	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(configPath, data, 0644)
}

func (c *Client) TestConnection() error {
	if !c.IsEnabled() {
		return fmt.Errorf("antenna integration is disabled")
	}

	resp, err := c.client.Get(c.GetAPIURL() + "/api/health")
	if err != nil {
		return fmt.Errorf("failed to connect to Antenna: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("antenna returned status %d", resp.StatusCode)
	}

	return nil
}

func (c *Client) ListSkills() ([]MarketplaceSkill, error) {
	resp, err := c.client.Get(c.GetAPIURL() + "/api/skills")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API returned status %d", resp.StatusCode)
	}

	var result struct {
		Skills []MarketplaceSkill `json:"skills"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result.Skills, nil
}

func (c *Client) GetSkill(skillID string) (*MarketplaceSkill, error) {
	resp, err := c.client.Get(c.GetAPIURL() + "/api/skills/" + skillID)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("skill not found")
	}

	var skill MarketplaceSkill
	if err := json.NewDecoder(resp.Body).Decode(&skill); err != nil {
		return nil, err
	}

	return &skill, nil
}

func (c *Client) DownloadSkill(skillID string, destPath string) error {
	skill, err := c.GetSkill(skillID)
	if err != nil {
		return err
	}

	resp, err := c.client.Get(skill.DownloadURL)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download failed with status %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	skillPath := filepath.Join(destPath, skill.Name)
	return os.WriteFile(skillPath, data, 0644)
}

func (c *Client) RegisterAgent(agent *Agent) error {
	payload := map[string]interface{}{
		"public_key":   c.publicKey,
		"name":         agent.Name,
		"description":  agent.Bio,
		"category":     "General",
		"avatar":       agent.Avatar,
		"capabilities": agent.Capabilities,
		"version":      agent.Version,
		"hostname":     agent.Hostname,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", c.GetAPIURL()+"/api/antenna/register", bytes.NewReader(jsonData))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	if c.config.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.config.APIKey)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("registration failed with status %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		Success bool `json:"success"`
		Agent   struct {
			ID          string `json:"id"`
			Name        string `json:"name"`
			APIKey      string `json:"api_key"`
			Fingerprint string `json:"fingerprint"`
			Status      string `json:"status"`
		} `json:"agent"`
		Existing bool `json:"existing"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return err
	}

	c.config.AgentID = result.Agent.ID
	c.config.APIKey = result.Agent.APIKey

	return nil
}

func (c *Client) Heartbeat(status string, metrics map[string]int64) (*HeartbeatResponse, error) {
	if c.config == nil || c.config.APIKey == "" {
		return nil, fmt.Errorf("API key not configured")
	}

	payload := map[string]interface{}{
		"api_key": c.config.APIKey,
		"status":  status,
		"metrics": metrics,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", c.GetAPIURL()+"/api/antenna/heartbeat", bytes.NewReader(jsonData))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("heartbeat failed with status %d: %s", resp.StatusCode, string(body))
	}

	var result HeartbeatResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &result, nil
}

func (c *Client) GetPeers() ([]PeerAgent, error) {
	if c.config == nil || c.config.APIKey == "" {
		return nil, fmt.Errorf("API key not configured")
	}

	req, err := http.NewRequest("GET", c.GetAPIURL()+"/api/antenna/heartbeat?api_key="+c.config.APIKey, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get peers: status %d", resp.StatusCode)
	}

	var result struct {
		Peers []PeerAgent `json:"peers"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result.Peers, nil
}

func (c *Client) GetAgentStatus() (*Agent, error) {
	if c.config == nil || c.config.AgentID == "" {
		return nil, fmt.Errorf("agent not registered")
	}

	resp, err := c.client.Get(c.GetAPIURL() + "/api/agents/" + c.config.AgentID)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("agent not found")
	}

	var agent Agent
	if err := json.NewDecoder(resp.Body).Decode(&agent); err != nil {
		return nil, err
	}

	return &agent, nil
}

func GetHostname() string {
	hostname, err := os.Hostname()
	if err != nil {
		return "unknown"
	}
	return hostname
}

func GetVersion() string {
	return "1.0.0"
}

func GetCapabilities() []string {
	return []string{"chat", "tools", "skills", "voice", "vision"}
}

func GetSystemInfo() map[string]string {
	return map[string]string{
		"os":   runtime.GOOS,
		"arch": runtime.GOARCH,
		"go":   runtime.Version(),
		"cpus": fmt.Sprintf("%d", runtime.NumCPU()),
	}
}
