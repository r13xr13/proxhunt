package wallet

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

type Config struct {
	Enabled    bool   `json:"enabled"`
	RPCURL     string `json:"rpc_url"`
	WalletPath string `json:"wallet_path"`
	Password   string `json:"password"`
}

type WalletInfo struct {
	Address         string  `json:"address"`
	Balance         float64 `json:"balance"`
	UnlockedBalance float64 `json:"unlocked_balance"`
}

type Transaction struct {
	ID            string    `json:"id"`
	Amount        float64   `json:"amount"`
	Fee           float64   `json:"fee"`
	Timestamp     time.Time `json:"timestamp"`
	Direction     string    `json:"direction"`
	Address       string    `json:"address"`
	Confirmations int       `json:"confirmations"`
}

type Client struct {
	config *Config
	rpcURL string
}

func NewClient(config *Config) *Client {
	rpcURL := config.RPCURL
	if rpcURL == "" {
		rpcURL = "http://localhost:18081"
	}
	return &Client{
		config: config,
		rpcURL: rpcURL,
	}
}

func (c *Client) IsEnabled() bool {
	return c.config != nil && c.config.Enabled
}

func LoadConfig(workspace string) (*Config, error) {
	configPath := filepath.Join(workspace, "wallet.json")

	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return &Config{
			Enabled: false,
			RPCURL:  "http://localhost:18081",
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
	configPath := filepath.Join(workspace, "wallet.json")

	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(configPath, data, 0644)
}

type JSONRPCRequest struct {
	ID     string      `json:"jsonrpc"`
	Method string      `json:"method"`
	Params interface{} `json:"params,omitempty"`
}

type JSONRPCResponse struct {
	ID     string          `json:"jsonrpc"`
	Result json.RawMessage `json:"result,omitempty"`
	Error  *RPCError       `json:"error,omitempty"`
}

type RPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func (c *Client) call(method string, params interface{}) ([]byte, error) {
	req := JSONRPCRequest{
		ID:     "1",
		Method: method,
		Params: params,
	}

	reqData, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}

	resp, err := http.Post(c.rpcURL+"/json_rpc", "application/json", bytes.NewReader(reqData))
	if err != nil {
		return nil, fmt.Errorf("RPC call failed: %w", err)
	}
	defer resp.Body.Close()

	var rpcResp JSONRPCResponse
	if err := json.NewDecoder(resp.Body).Decode(&rpcResp); err != nil {
		return nil, err
	}

	if rpcResp.Error != nil {
		return nil, fmt.Errorf("RPC error: %s", rpcResp.Error.Message)
	}

	return rpcResp.Result, nil
}

func (c *Client) GetVersion() (string, error) {
	result, err := c.call("get_version", nil)
	if err != nil {
		return "", err
	}

	var resp struct {
		Version uint `json:"version"`
	}
	if err := json.Unmarshal(result, &resp); err != nil {
		return "", err
	}

	return fmt.Sprintf("v%d", resp.Version), nil
}

func (c *Client) GetAddress() (string, error) {
	result, err := c.call("get_address", map[string]interface{}{"account_index": 0})
	if err != nil {
		return "", err
	}

	var resp struct {
		Address string `json:"address"`
	}
	if err := json.Unmarshal(result, &resp); err != nil {
		return "", err
	}

	return resp.Address, nil
}

func (c *Client) GetBalance() (*WalletInfo, error) {
	result, err := c.call("get_balance", map[string]interface{}{"account_index": 0})
	if err != nil {
		return nil, err
	}

	var resp struct {
		Balance         uint64 `json:"balance"`
		UnlockedBalance uint64 `json:"unlocked_balance"`
	}
	if err := json.Unmarshal(result, &resp); err != nil {
		return nil, err
	}

	address, _ := c.GetAddress()

	return &WalletInfo{
		Address:         address,
		Balance:         float64(resp.Balance) / 1e12,
		UnlockedBalance: float64(resp.UnlockedBalance) / 1e12,
	}, nil
}

func (c *Client) GetTransfers() ([]Transaction, error) {
	result, err := c.call("get_transfers", map[string]interface{}{
		"account_index": 0,
		"in":            true,
		"out":           true,
	})
	if err != nil {
		return nil, err
	}

	var resp struct {
		In  []Transaction `json:"in,omitempty"`
		Out []Transaction `json:"out,omitempty"`
	}
	if err := json.Unmarshal(result, &resp); err != nil {
		return nil, err
	}

	transactions := append(resp.In, resp.Out...)
	return transactions, nil
}

func (c *Client) Transfer(destAddress string, amount float64) (string, error) {
	amountAtomic := uint64(amount * 1e12)

	params := map[string]interface{}{
		"destinations": []map[string]interface{}{
			{"address": destAddress, "amount": amountAtomic},
		},
		"account_index": 0,
	}

	result, err := c.call("transfer", params)
	if err != nil {
		return "", err
	}

	var resp struct {
		TxHash string `json:"tx_hash"`
	}
	if err := json.Unmarshal(result, &resp); err != nil {
		return "", err
	}

	return resp.TxHash, nil
}

func (c *Client) MakeIntegratedAddress(paymentID string) (string, error) {
	params := map[string]interface{}{
		"payment_id": paymentID,
	}

	result, err := c.call("make_integrated_address", params)
	if err != nil {
		return "", err
	}

	var resp struct {
		IntegratedAddress string `json:"integrated_address"`
	}
	if err := json.Unmarshal(result, &resp); err != nil {
		return "", err
	}

	return resp.IntegratedAddress, nil
}
