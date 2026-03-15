package security

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"
)

type KeyPair struct {
	PublicKey  string `json:"public_key"`
	PrivateKey string `json:"private_key"`
	CreatedAt  int64  `json:"created_at"`
}

type EncryptionConfig struct {
	Enabled          bool   `json:"enabled"`
	X25519Public     string `json:"x25519_public"`
	X25519Private    string `json:"x25519_private"`
	ChaCha20Poly1305 bool   `json:"chacha20_poly1305"`
}

type PGPKey struct {
	KeyID      string    `json:"key_id"`
	PublicKey  string    `json:"public_key"`
	PrivateKey string    `json:"private_key"`
	UserID     string    `json:"user_id"`
	CreatedAt  time.Time `json:"created_at"`
	ExpiresAt  time.Time `json:"expires_at"`
}

type Reputation struct {
	PeerID      string  `json:"peer_id"`
	Score       float64 `json:"score"`
	TotalRating int     `json:"total_rating"`
	Positive    int     `json:"positive"`
	Negative    int     `json:"negative"`
	LastUpdated int64   `json:"last_updated"`
}

type ReputationStore struct {
	Reputations map[string]Reputation `json:"reputations"`
}

type Crypto struct {
	config    *EncryptionConfig
	keyPair   *KeyPair
	pgpKey    *PGPKey
	workspace string
}

func NewCrypto(workspace string) *Crypto {
	return &Crypto{workspace: workspace}
}

func (c *Crypto) GenerateKeyPair() (*KeyPair, error) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, err
	}

	keyPair := &KeyPair{
		PublicKey:  base64.StdEncoding.EncodeToString(pub),
		PrivateKey: base64.StdEncoding.EncodeToString(priv),
		CreatedAt:  time.Now().Unix(),
	}

	c.keyPair = keyPair
	return keyPair, nil
}

func (c *Crypto) LoadOrGenerateKeys() (*KeyPair, error) {
	keysPath := filepath.Join(c.workspace, "keys.json")

	if _, err := os.Stat(keysPath); err == nil {
		data, _ := os.ReadFile(keysPath)
		var keyPair KeyPair
		json.Unmarshal(data, &keyPair)
		c.keyPair = &keyPair
		return &keyPair, nil
	}

	return c.GenerateKeyPair()
}

func (c *Crypto) SaveKeys() error {
	if c.keyPair == nil {
		return fmt.Errorf("no key pair to save")
	}

	keysPath := filepath.Join(c.workspace, "keys.json")
	data, _ := json.MarshalIndent(c.keyPair, "", "  ")
	return os.WriteFile(keysPath, data, 0600)
}

func (c *Crypto) Encrypt(plaintext string, recipientPubKey string) (string, error) {
	key, err := base64.StdEncoding.DecodeString(recipientPubKey)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key[:32])
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	io.ReadFull(rand.Reader, nonce)

	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

func (c *Crypto) Decrypt(ciphertext string) (string, error) {
	if c.keyPair == nil {
		return "", fmt.Errorf("no key pair loaded")
	}

	key, err := base64.StdEncoding.DecodeString(c.keyPair.PrivateKey)
	if err != nil {
		return "", err
	}

	data, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key[:32])
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", fmt.Errorf("ciphertext too short")
	}

	nonce, ciphertextBytes := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertextBytes, nil)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}

func (c *Crypto) Sign(message string) (string, error) {
	if c.keyPair == nil {
		return "", fmt.Errorf("no key pair loaded")
	}

	key, err := base64.StdEncoding.DecodeString(c.keyPair.PrivateKey)
	if err != nil {
		return "", err
	}

	priv := ed25519.PrivateKey(key)
	signature := ed25519.Sign(priv, []byte(message))
	return base64.StdEncoding.EncodeToString(signature), nil
}

func (c *Crypto) Verify(message, signature, publicKey string) bool {
	pub, err := base64.StdEncoding.DecodeString(publicKey)
	if err != nil {
		return false
	}

	sig, err := base64.StdEncoding.DecodeString(signature)
	if err != nil {
		return false
	}

	return ed25519.Verify(pub, []byte(message), sig)
}

func (c *Crypto) Hash(data string) string {
	hash := sha256.Sum256([]byte(data))
	return base64.StdEncoding.EncodeToString(hash[:])
}

type ReputationManager struct {
	store     *ReputationStore
	workspace string
}

func NewReputationManager(workspace string) *ReputationManager {
	return &ReputationManager{
		store:     &ReputationStore{Reputations: make(map[string]Reputation)},
		workspace: workspace,
	}
}

func (r *ReputationManager) Load() error {
	path := filepath.Join(r.workspace, "reputation.json")

	if _, err := os.Stat(path); err != nil {
		return nil
	}

	data, _ := os.ReadFile(path)
	json.Unmarshal(data, r.store)
	return nil
}

func (r *ReputationManager) Save() error {
	path := filepath.Join(r.workspace, "reputation.json")
	data, _ := json.MarshalIndent(r.store, "", "  ")
	return os.WriteFile(path, data, 0644)
}

func (r *ReputationManager) GetReputation(peerID string) *Reputation {
	if rep, ok := r.store.Reputations[peerID]; ok {
		return &rep
	}
	return &Reputation{
		PeerID:      peerID,
		Score:       0,
		TotalRating: 0,
	}
}

func (r *ReputationManager) Rate(peerID string, positive bool) {
	rep := r.GetReputation(peerID)

	if positive {
		rep.Positive++
	} else {
		rep.Negative++
	}

	rep.TotalRating++
	rep.Score = float64(rep.Positive) / float64(rep.TotalRating) * 100
	rep.LastUpdated = time.Now().Unix()

	r.store.Reputations[peerID] = *rep
	r.Save()
}

func (r *ReputationManager) GetTopRated(limit int) []Reputation {
	var reps []Reputation
	for _, rep := range r.store.Reputations {
		reps = append(reps, rep)
	}

	for i := 0; i < len(reps)-1; i++ {
		for j := i + 1; j < len(reps); j-- {
			if reps[j].Score > reps[i].Score {
				reps[i], reps[j] = reps[j], reps[i]
			}
		}
	}

	if limit > 0 && len(reps) > limit {
		reps = reps[:limit]
	}

	return reps
}

type IdentityManager struct {
	peerID    string
	workspace string
	keys      *KeyPair
}

func NewIdentityManager(peerID, workspace string) *IdentityManager {
	return &IdentityManager{
		peerID:    peerID,
		workspace: workspace,
	}
}

func (i *IdentityManager) LoadOrCreate() (*KeyPair, error) {
	c := NewCrypto(i.workspace)
	return c.LoadOrGenerateKeys()
}

func (i *IdentityManager) SignMessage(message string) (string, error) {
	c := NewCrypto(i.workspace)
	keys, err := c.LoadOrGenerateKeys()
	if err != nil {
		return "", err
	}
	c.keyPair = keys
	return c.Sign(message)
}

func (i *IdentityManager) VerifyMessage(message, signature, publicKey string) bool {
	c := NewCrypto(i.workspace)
	return c.Verify(message, signature, publicKey)
}
