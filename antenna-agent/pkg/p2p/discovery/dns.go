package discovery

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"sync"
	"time"
)

type ServiceInfo struct {
	PeerID    string `json:"peer_id"`
	Port      int    `json:"port"`
	AgentName string `json:"agent_name"`
	Version   string `json:"version"`
}

type DNSDiscovery struct {
	domain     string
	peerID     string
	port       int
	agentName  string
	version    string
	localPeers map[string]*ServiceInfo
	peersMutex sync.RWMutex
	responses  chan *ServiceInfo
	ctx        context.Context
	cancel     context.CancelFunc
}

func NewDNS(peerID, agentName, version string, port int, domain string) *DNSDiscovery {
	if domain == "" {
		domain = "antenna.io"
	}

	return &DNSDiscovery{
		domain:     domain,
		peerID:     peerID,
		port:       port,
		agentName:  agentName,
		version:    version,
		localPeers: make(map[string]*ServiceInfo),
		responses:  make(chan *ServiceInfo, 10),
	}
}

func (d *DNSDiscovery) Start() error {
	d.ctx, d.cancel = context.WithCancel(context.Background())

	go d.lookupLoop()

	return nil
}

func (d *DNSDiscovery) advertise() {
	txtRecord := fmt.Sprintf("%s|%d|%s|%s",
		d.peerID, d.port, d.agentName, d.version)

	records := []string{txtRecord}

	_, err := net.LookupTXT("_antenna._tcp." + d.domain)
	if err != nil {
		return
	}

	_ = records
}

func (d *DNSDiscovery) lookupLoop() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-d.ctx.Done():
			return
		case <-ticker.C:
			d.lookupPeers()
		}
	}
}

func (d *DNSDiscovery) lookupPeers() {
	_, srvs, err := net.LookupSRV("_antenna._tcp", "tcp", d.domain)
	if err != nil {
		return
	}

	for _, srv := range srvs {
		peerAddr := fmt.Sprintf("%s:%d", srv.Target, srv.Port)

		txts, err := net.LookupTXT("_antenna._tcp." + d.domain)
		if err != nil {
			continue
		}

		for _, txt := range txts {
			var info ServiceInfo
			if err := json.Unmarshal([]byte(txt), &info); err != nil {
				continue
			}

			if info.PeerID == d.peerID {
				continue
			}

			info.Port = int(srv.Port)

			d.peersMutex.Lock()
			d.localPeers[peerAddr] = &info
			d.peersMutex.Unlock()

			select {
			case d.responses <- &info:
			default:
			}
		}
	}
}

func (d *DNSDiscovery) GetPeers() []*ServiceInfo {
	d.peersMutex.RLock()
	defer d.peersMutex.RUnlock()

	peers := make([]*ServiceInfo, 0, len(d.localPeers))
	for _, peer := range d.localPeers {
		peers = append(peers, peer)
	}
	return peers
}

func (d *DNSDiscovery) Responses() <-chan *ServiceInfo {
	return d.responses
}

func (d *DNSDiscovery) Stop() {
	if d.cancel != nil {
		d.cancel()
	}
}

type PeerDiscovery struct {
	peerID     string
	port       int
	peers      map[string]string
	peersMutex sync.RWMutex
	responses  chan string
	ctx        context.Context
	cancel     context.CancelFunc
}

func NewPeerDiscovery(peerID string, port int) *PeerDiscovery {
	return &PeerDiscovery{
		peerID:    peerID,
		port:      port,
		peers:     make(map[string]string),
		responses: make(chan string, 10),
	}
}

func (p *PeerDiscovery) AddPeer(peerID, address string) {
	p.peersMutex.Lock()
	defer p.peersMutex.Unlock()
	p.peers[peerID] = address
}

func (p *PeerDiscovery) RemovePeer(peerID string) {
	p.peersMutex.Lock()
	defer p.peersMutex.Unlock()
	delete(p.peers, peerID)
}

func (p *PeerDiscovery) GetPeerAddress(peerID string) string {
	p.peersMutex.RLock()
	defer p.peersMutex.RUnlock()
	return p.peers[peerID]
}

func (p *PeerDiscovery) GetAllPeers() map[string]string {
	p.peersMutex.RLock()
	defer p.peersMutex.RUnlock()

	result := make(map[string]string)
	for k, v := range p.peers {
		result[k] = v
	}
	return result
}

func DiscoverLocalPeers(timeout time.Duration) ([]string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	addrs, err := net.DefaultResolver.LookupHost(ctx, "localhost")
	if err != nil {
		return nil, err
	}

	var peers []string
	for _, addr := range addrs {
		peers = append(peers, fmt.Sprintf("%s:18792", addr))
	}

	return peers, nil
}

func DiscoverNetworkPeers(port int, timeout time.Duration) ([]string, error) {
	var peers []string

	ifaces, err := net.Interfaces()
	if err != nil {
		return nil, err
	}

	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}

		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}

		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}

			if ip == nil || ip.To4() == nil {
				continue
			}

			for i := 1; i < 255; i++ {
				peerIP := fmt.Sprintf("%d.%d.%d.%d", ip[0], ip[1], ip[2], i)
				addr := fmt.Sprintf("%s:%d", peerIP, port)

				conn, err := net.DialTimeout("tcp", addr, 100*time.Millisecond)
				if err == nil {
					peers = append(peers, addr)
					conn.Close()
				}
			}
		}
	}

	return peers, nil
}
