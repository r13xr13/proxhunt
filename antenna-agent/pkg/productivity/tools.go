package productivity

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type CalendarConfig struct {
	Enabled    bool   `json:"enabled"`
	Provider   string `json:"provider"` // caldav, google, outlook
	URL        string `json:"url"`
	Username   string `json:"username"`
	Password   string `json:"password"`
	CalendarID string `json:"calendar_id"`
}

type CalendarEvent struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	StartTime   time.Time `json:"start_time"`
	EndTime     time.Time `json:"end_time"`
	Location    string    `json:"location"`
	Attendees   []string  `json:"attendees"`
	Reminder    int       `json:"reminder_minutes"`
}

type CalendarClient struct {
	config *Config
	client *http.Client
}

type Config = CalendarConfig

func NewCalendarClient(config *CalendarConfig) *CalendarClient {
	return &CalendarClient{
		config: config,
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

func LoadConfig(workspace string) (*CalendarConfig, error) {
	configPath := filepath.Join(workspace, "calendar.json")

	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return &CalendarConfig{Enabled: false}, nil
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, err
	}

	var config CalendarConfig
	json.Unmarshal(data, &config)
	return &config, nil
}

func (c *CalendarClient) IsEnabled() bool {
	return c.config != nil && c.config.Enabled
}

func (c *CalendarClient) ListEvents(start, end time.Time) ([]CalendarEvent, error) {
	if c.config.Provider == "caldav" {
		return c.listCalDAVEvents(start, end)
	}
	return nil, fmt.Errorf("unsupported provider: %s", c.config.Provider)
}

func (c *CalendarClient) listCalDAVEvents(start, end time.Time) ([]CalendarEvent, error) {
	req, err := http.NewRequest("REPORT", c.config.URL, nil)
	if err != nil {
		return nil, err
	}

	req.SetBasicAuth(c.config.Username, c.config.Password)
	req.Header.Set("Content-Type", "application/xml")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var events []CalendarEvent
	return events, nil
}

func (c *CalendarClient) CreateEvent(event *CalendarEvent) error {
	if c.config.Provider == "caldav" {
		return c.createCalDAVEvent(event)
	}
	return fmt.Errorf("unsupported provider: %s", c.config.Provider)
}

func (c *CalendarClient) createCalDAVEvent(event *CalendarEvent) error {
	ics := fmt.Sprintf(`BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:%s
DTSTART:%s
DTEND:%s
SUMMARY:%s
DESCRIPTION:%s
LOCATION:%s
END:VEVENT
END:VCALENDAR`,
		event.ID,
		event.StartTime.Format("20060102T150405Z"),
		event.EndTime.Format("20060102T150405Z"),
		event.Title,
		event.Description,
		event.Location,
	)

	req, err := http.NewRequest("PUT", c.config.URL+"/"+event.ID+".ics", nil)
	if err != nil {
		return err
	}

	req.SetBasicAuth(c.config.Username, c.config.Password)
	req.Header.Set("Content-Type", "text/calendar")
	req.Body = io.NopCloser(strings.NewReader(ics))

	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

func (c *CalendarClient) DeleteEvent(eventID string) error {
	req, err := http.NewRequest("DELETE", c.config.URL+"/"+eventID+".ics", nil)
	if err != nil {
		return err
	}

	req.SetBasicAuth(c.config.Username, c.config.Password)

	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

func (c *CalendarClient) GetFreeBusy(start, end time.Time) ([]time.Time, error) {
	return nil, nil
}

type EmailConfig struct {
	Enabled  bool   `json:"enabled"`
	Provider string `json:"provider"` // smtp, imap
	SMTPHost string `json:"smtp_host"`
	SMTPPort int    `json:"smtp_port"`
	IMAPHost string `json:"imap_host"`
	IMAPPort int    `json:"imap_port"`
	Username string `json:"username"`
	Password string `json:"password"`
	FromAddr string `json:"from_addr"`
	FromName string `json:"from_name"`
}

type Email struct {
	ID          string    `json:"id"`
	From        string    `json:"from"`
	To          []string  `json:"to"`
	CC          []string  `json:"cc"`
	Subject     string    `json:"subject"`
	Body        string    `json:"body"`
	HTML        string    `json:"html"`
	Attachments []string  `json:"attachments"`
	Date        time.Time `json:"date"`
	Read        bool      `json:"read"`
}

type EmailClient struct {
	config *EmailConfig
}

func NewEmailClient(config *EmailConfig) *EmailClient {
	return &EmailClient{config: config}
}

func LoadEmailConfig(workspace string) (*EmailConfig, error) {
	configPath := filepath.Join(workspace, "email.json")

	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return &EmailConfig{Enabled: false}, nil
	}

	data, _ := os.ReadFile(configPath)
	var config EmailConfig
	json.Unmarshal(data, &config)
	return &config, nil
}

func (e *EmailClient) IsEnabled() bool {
	return e.config != nil && e.config.Enabled
}

func (e *EmailClient) Send(email *Email) error {
	// Simple SMTP send - in production would use proper SMTP library
	fmt.Printf("Sending email to %v: %s\n", email.To, email.Subject)
	return nil
}

func (e *EmailClient) Receive(limit int) ([]Email, error) {
	return []Email{}, nil
}

func (e *EmailClient) Read(emailID string) (*Email, error) {
	return nil, nil
}

func (e *EmailClient) Delete(emailID string) error {
	return nil
}

type WebhookConfig struct {
	Enabled       bool              `json:"enabled"`
	Port          int               `json:"port"`
	Path          string            `json:"path"`
	Secret        string            `json:"secret"`
	Events        []string          `json:"events"`
	OutgoingHooks []OutgoingWebhook `json:"outgoing_hooks"`
}

type OutgoingWebhook struct {
	Name    string            `json:"name"`
	URL     string            `json:"url"`
	Events  []string          `json:"events"`
	Headers map[string]string `json:"headers"`
}

type WebhookPayload struct {
	Event     string                 `json:"event"`
	Timestamp time.Time              `json:"timestamp"`
	Data      map[string]interface{} `json:"data"`
}

type WebhookServer struct {
	config   *WebhookConfig
	server   *http.Server
	handlers map[string]func(payload WebhookPayload)
}

func NewWebhookServer(config *WebhookConfig) *WebhookServer {
	return &WebhookServer{
		config:   config,
		handlers: make(map[string]func(WebhookPayload)),
	}
}

func (w *WebhookServer) Start() error {
	mux := http.NewServeMux()
	mux.HandleFunc(w.config.Path, w.handleWebhook)

	w.server = &http.Server{
		Addr:    fmt.Sprintf(":%d", w.config.Port),
		Handler: mux,
	}

	return w.server.ListenAndServe()
}

func (w *WebhookServer) Stop() error {
	if w.server != nil {
		return w.server.Close()
	}
	return nil
}

func (w *WebhookServer) handleWebhook(wr http.ResponseWriter, req *http.Request) {
	body, _ := io.ReadAll(req.Body)

	var payload WebhookPayload
	json.Unmarshal(body, &payload)

	if handler, ok := w.handlers[payload.Event]; ok {
		handler(payload)
	}

	wr.WriteHeader(http.StatusOK)
}

func (w *WebhookServer) RegisterHandler(event string, handler func(WebhookPayload)) {
	w.handlers[event] = handler
}

func (w *WebhookServer) SendWebhook(hookName string, event string, data map[string]interface{}) error {
	var hook *OutgoingWebhook
	for _, h := range w.config.OutgoingHooks {
		if h.Name == hookName {
			hook = &h
			break
		}
	}

	if hook == nil {
		return fmt.Errorf("webhook not found: %s", hookName)
	}

	payload := WebhookPayload{
		Event:     event,
		Timestamp: time.Now(),
		Data:      data,
	}

	payloadBytes, _ := json.Marshal(payload)

	http.Post(hook.URL, "application/json", bytes.NewReader(payloadBytes))
	return nil
}

type BrowserConfig struct {
	Enabled    bool   `json:"enabled"`
	Provider   string `json:"provider"` // playwright, puppeteer, none
	WSEndpoint string `json:"ws_endpoint"`
	Headless   bool   `json:"headless"`
}

type BrowserClient struct {
	config *BrowserConfig
}

func NewBrowserClient(config *BrowserConfig) *BrowserClient {
	return &BrowserClient{config: config}
}

func LoadBrowserConfig(workspace string) (*BrowserConfig, error) {
	configPath := filepath.Join(workspace, "browser.json")

	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return &BrowserConfig{Enabled: false, Provider: "none"}, nil
	}

	data, _ := os.ReadFile(configPath)
	var config BrowserConfig
	json.Unmarshal(data, &config)
	return &config, nil
}

func (b *BrowserClient) IsEnabled() bool {
	return b.config != nil && b.config.Enabled && b.config.Provider != "none"
}

func (b *BrowserClient) Navigate(url string) error {
	fmt.Printf("Navigating to: %s\n", url)
	return nil
}

func (b *BrowserClient) Screenshot() ([]byte, error) {
	return []byte{}, nil
}

func (b *BrowserClient) Click(selector string) error {
	fmt.Printf("Clicking: %s\n", selector)
	return nil
}

func (b *BrowserClient) Fill(selector, value string) error {
	fmt.Printf("Filling %s with %s\n", selector, value)
	return nil
}

func (b *BrowserClient) Evaluate(script string) (string, error) {
	fmt.Printf("Evaluating: %s\n", script)
	return "{}", nil
}

func (b *BrowserClient) Close() error {
	return nil
}
