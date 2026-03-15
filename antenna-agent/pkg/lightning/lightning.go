package lightning

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

type Config struct {
	Enabled  bool   `json:"enabled"`
	NodeType string `json:"node_type"` // cln, lnd
	RPCPath  string `json:"rpc_path"`
	RESTHost string `json:"rest_host"`
	RESTPort int    `json:"rest_port"`
	Macaroon string `json:"macaroon"`
	TLSPath  string `json:"tls_path"`
}

type Invoice struct {
	ID          string `json:"id"`
	Amount      int64  `json:"amount"`
	Invoice     string `json:"invoice"`
	Status      string `json:"status"`
	Description string `json:"description"`
	ExpiresAt   int64  `json:"expires_at"`
	CreatedAt   int64  `json:"created_at"`
}

type Channel struct {
	ID            string `json:"id"`
	Alias         string `json:"alias"`
	RemotePubKey  string `json:"remote_pubkey"`
	Capacity      int64  `json:"capacity"`
	LocalBalance  int64  `json:"local_balance"`
	RemoteBalance int64  `json:"remote_balance"`
	State         string `json:"state"`
}

type Payment struct {
	ID        string `json:"id"`
	Amount    int64  `json:"amount"`
	Fee       int64  `json:"fee"`
	Status    string `json:"status"`
	Invoice   string `json:"invoice"`
	Preimage  string `json:"preimage"`
	CreatedAt int64  `json:"created_at"`
}

type Client struct {
	config   *Config
	http     *http.Client
	grpcPort int
}

func NewClient(config *Config) *Client {
	return &Client{
		config: config,
		http: &http.Client{
			Timeout: 30 * time.Second,
		},
		grpcPort: 9735,
	}
}

func LoadConfig(workspace string) (*Config, error) {
	configPath := filepath.Join(workspace, "lightning.json")

	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return &Config{
			Enabled:  false,
			NodeType: "cln",
			RPCPath:  "/tmp/lightning/lightning-rpc",
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
	configPath := filepath.Join(workspace, "lightning.json")

	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(configPath, data, 0644)
}

func (c *Client) IsEnabled() bool {
	return c.config != nil && c.config.Enabled
}

type CLNRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      string          `json:"id"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

type CLNResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      string          `json:"id"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *CLNError       `json:"error,omitempty"`
}

type CLNError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func (c *Client) call(method string, params interface{}) ([]byte, error) {
	if c.config.NodeType == "cln" {
		return c.clnCall(method, params)
	}
	return nil, fmt.Errorf("unsupported node type: %s", c.config.NodeType)
}

func (c *Client) clnCall(method string, params interface{}) ([]byte, error) {
	unixSocket := c.config.RPCPath

	conn, err := net.Dial("unix", unixSocket)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to Lightning node: %w", err)
	}
	defer conn.Close()

	req := CLNRequest{
		JSONRPC: "2.0",
		ID:      "antenna",
		Method:  method,
	}

	if params != nil {
		paramsBytes, _ := json.Marshal(params)
		req.Params = paramsBytes
	}

	reqData, _ := json.Marshal(req)
	_, err = conn.Write(append(reqData, '\n'))
	if err != nil {
		return nil, err
	}

	reader := bufio.NewReader(conn)
	line, err := reader.ReadString('\n')
	if err != nil {
		return nil, err
	}

	var resp CLNResponse
	if err := json.Unmarshal([]byte(line), &resp); err != nil {
		return nil, err
	}

	if resp.Error != nil {
		return nil, fmt.Errorf("Lightning error: %s", resp.Error.Message)
	}

	return resp.Result, nil
}

func (c *Client) GetInfo() (map[string]interface{}, error) {
	result, err := c.call("getinfo", nil)
	if err != nil {
		return nil, err
	}

	var info map[string]interface{}
	if err := json.Unmarshal(result, &info); err != nil {
		return nil, err
	}

	return info, nil
}

func (c *Client) CreateInvoice(amount int64, description string) (*Invoice, error) {
	params := map[string]interface{}{
		"amount_msat": amount * 1000,
		"description": description,
		"expiry":      3600,
	}

	result, err := c.call("invoice", params)
	if err != nil {
		return nil, err
	}

	var resp struct {
		Invoice     string `json:"bolt11"`
		PaymentHash string `json:"payment_hash"`
		ExpiresAt   int64  `json:"expires_at"`
	}
	if err := json.Unmarshal(result, &resp); err != nil {
		return nil, err
	}

	return &Invoice{
		ID:          resp.PaymentHash,
		Amount:      amount,
		Invoice:     resp.Invoice,
		Status:      "open",
		Description: description,
		ExpiresAt:   resp.ExpiresAt,
		CreatedAt:   time.Now().Unix(),
	}, nil
}

func (c *Client) PayInvoice(invoice string) (*Payment, error) {
	params := map[string]interface{}{
		"invoice": invoice,
	}

	result, err := c.call("pay", params)
	if err != nil {
		return nil, err
	}

	var resp struct {
		PaymentHash string `json:"payment_hash"`
		AmountMsat  int64  `json:"amount_msat"`
		FeeMsat     int64  `json:"fee_msat"`
		Status      string `json:"status"`
		Preimage    string `json:"preimage"`
	}
	if err := json.Unmarshal(result, &resp); err != nil {
		return nil, err
	}

	return &Payment{
		ID:        resp.PaymentHash,
		Amount:    resp.AmountMsat / 1000,
		Fee:       resp.FeeMsat / 1000,
		Status:    resp.Status,
		Invoice:   invoice,
		Preimage:  resp.Preimage,
		CreatedAt: time.Now().Unix(),
	}, nil
}

func (c *Client) ListChannels() ([]Channel, error) {
	result, err := c.call("listchannels", nil)
	if err != nil {
		return nil, err
	}

	var resp struct {
		Channels []Channel `json:"channels"`
	}
	if err := json.Unmarshal(result, &resp); err != nil {
		return nil, err
	}

	return resp.Channels, nil
}

func (c *Client) ListInvoices() ([]Invoice, error) {
	result, err := c.call("listinvoices", nil)
	if err != nil {
		return nil, err
	}

	var resp struct {
		Invoices []Invoice `json:"invoices"`
	}
	if err := json.Unmarshal(result, &resp); err != nil {
		return nil, err
	}

	return resp.Invoices, nil
}

func (c *Client) GetBalance() (int64, error) {
	result, err := c.call("listfunds", nil)
	if err != nil {
		return 0, err
	}

	var resp struct {
		Outputs []struct {
			Amount int64 `json:"satoshis"`
		} `json:"outputs"`
	}
	if err := json.Unmarshal(result, &resp); err != nil {
		return 0, err
	}

	var total int64
	for _, output := range resp.Outputs {
		total += output.Amount
	}

	return total, nil
}

func (c *Client) ConnectNode(nodeAddr string) error {
	parts := splitNodeAddr(nodeAddr)
	if len(parts) < 2 {
		return fmt.Errorf("invalid node address format")
	}

	params := map[string]interface{}{
		"id":   parts[0],
		"host": parts[1],
		"port": parts[2],
	}

	_, err := c.call("connect", params)
	return err
}

func (c *Client) OpenChannel(pubKey string, amount int64) (string, error) {
	params := map[string]interface{}{
		"id":            pubKey,
		"sat":           amount,
		"push_sats":     amount / 2,
		"min_htlc_msat": 1,
	}

	result, err := c.call("fundchannel", params)
	if err != nil {
		return "", err
	}

	var resp struct {
		ChannelID string `json:"channel_id"`
	}
	if err := json.Unmarshal(result, &resp); err != nil {
		return "", err
	}

	return resp.ChannelID, nil
}

func (c *Client) CloseChannel(channelID string) error {
	params := map[string]interface{}{
		"id":         channelID,
		"unilateral": false,
	}

	_, err := c.call("close", params)
	return err
}

func splitNodeAddr(addr string) []string {
	var parts []string
	current := ""
	for _, c := range addr {
		if c == '@' || c == ':' {
			parts = append(parts, current)
			current = ""
		} else {
			current += string(c)
		}
	}
	parts = append(parts, current)
	return parts
}

type LNDClient struct {
	config *Config
}

func NewLNDClient(config *Config) *LNDClient {
	return &LNDClient{config: config}
}

func (l *LNDClient) GetInfo() (map[string]interface{}, error) {
	return nil, fmt.Errorf("LND not implemented yet")
}

func (l *LNDClient) CreateInvoice(amount int64, description string) (*Invoice, error) {
	return nil, fmt.Errorf("LND not implemented yet")
}

func (l *LNDClient) PayInvoice(invoice string) (*Payment, error) {
	return nil, fmt.Errorf("LND not implemented yet")
}

type LightningService struct {
	client *Client
	lnd    *LNDClient
}

func NewService(config *Config) *LightningService {
	svc := &LightningService{}

	if config.NodeType == "lnd" {
		svc.lnd = NewLNDClient(config)
	} else {
		svc.client = NewClient(config)
	}

	return svc
}

func (s *LightningService) GetBalance() (int64, error) {
	if s.client != nil {
		return s.client.GetBalance()
	}
	return 0, fmt.Errorf("no Lightning node configured")
}

func (s *LightningService) CreateInvoice(amount int64, description string) (*Invoice, error) {
	if s.client != nil {
		return s.client.CreateInvoice(amount, description)
	}
	return nil, fmt.Errorf("no Lightning node configured")
}

func (s *LightningService) PayInvoice(invoice string) (*Payment, error) {
	if s.client != nil {
		return s.client.PayInvoice(invoice)
	}
	return nil, fmt.Errorf("no Lightning node configured")
}
