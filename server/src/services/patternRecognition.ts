import { EventData } from "./conflict";

export interface Pattern {
  id: string;
  type: "temporal" | "geographic" | "behavioral" | "network" | "anomaly";
  name: string;
  description: string;
  confidence: number;
  events: string[];
  locations: { lat: number; lon: number }[];
  frequency: number;
  firstSeen: string;
  lastSeen: string;
  threatLevel: "low" | "medium" | "high" | "critical";
  indicators: string[];
  mitigation?: string[];
}

export interface ThreatIntel {
  id: string;
  type: "apt" | "crime" | "hacktivist" | "insider" | "nation-state" | "opportunity";
  name: string;
  aliases: string[];
  description: string;
  confidence: number;
  associatedEvents: string[];
  ttps: string[];
  mitigation: string[];
  actorLinks: string[];
  lastActivity: string;
}

export interface LearnedInsight {
  id: string;
  category: "pattern" | "actor" | "infrastructure" | "campaign" | "vulnerability";
  title: string;
  description: string;
  confidence: number;
  source: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, any>;
  relatedEvents: string[];
  tags: string[];
}

class PatternRecognition {
  private patterns: Map<string, Pattern> = new Map();
  private threats: Map<string, ThreatIntel> = new Map();
  private insights: Map<string, LearnedInsight> = new Map();
  private eventHistory: EventData[] = [];
  private readonly MAX_HISTORY = 10000;

  analyzeEvents(events: EventData[]): Pattern[] {
    this.eventHistory = [...events, ...this.eventHistory].slice(0, this.MAX_HISTORY);
    const newPatterns: Pattern[] = [];

    const temporal = this.detectTemporalPatterns(events);
    const geographic = this.detectGeographicPatterns(events);
    const behavioral = this.detectBehavioralPatterns(events);
    const network = this.detectNetworkPatterns(events);
    const anomalies = this.detectAnomalies(events);

    [...temporal, ...geographic, ...behavioral, ...network, ...anomalies].forEach(p => {
      if (!this.patterns.has(p.id)) {
        this.patterns.set(p.id, p);
        newPatterns.push(p);
      }
    });

    return newPatterns;
  }

  private detectTemporalPatterns(events: EventData[]): Pattern[] {
    const patterns: Pattern[] = [];
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 3600000);
    const dayAgo = new Date(now.getTime() - 86400000);

    const recentCritical = events.filter(e => 
      e.severity === "critical" && new Date(e.date) > hourAgo
    );
    if (recentCritical.length >= 3) {
      patterns.push({
        id: `temp_spike_${Date.now()}`,
        type: "temporal",
        name: "Critical Event Spike",
        description: `${recentCritical.length} critical events in the last hour - potential escalation`,
        confidence: Math.min(0.95, recentCritical.length * 0.25),
        events: recentCritical.map(e => e.id),
        locations: recentCritical.map(e => ({ lat: e.lat, lon: e.lon })),
        frequency: recentCritical.length,
        firstSeen: hourAgo.toISOString(),
        lastSeen: now.toISOString(),
        threatLevel: "critical",
        indicators: ["rapid succession", "high severity"],
      });
    }

    const dailySpikes = new Map<string, number>();
    events.forEach(e => {
      const day = new Date(e.date).toISOString().split("T")[0];
      dailySpikes.set(day, (dailySpikes.get(day) || 0) + 1);
    });
    const avgDaily = Array.from(dailySpikes.values()).reduce((a, b) => a + b, 0) / Math.max(dailySpikes.size, 1);
    dailySpikes.forEach((count, day) => {
      if (count > avgDaily * 2) {
        patterns.push({
          id: `daily_spike_${day}`,
          type: "temporal",
          name: "Daily Activity Spike",
          description: `${count} events on ${day} - ${((count / avgDaily - 1) * 100).toFixed(0)}% above average`,
          confidence: Math.min(0.9, count / avgDaily / 3),
          events: events.filter(e => e.date.startsWith(day)).map(e => e.id),
          locations: events.filter(e => e.date.startsWith(day)).map(e => ({ lat: e.lat, lon: e.lon })),
          frequency: count,
          firstSeen: day,
          lastSeen: day,
          threatLevel: "high",
          indicators: ["spike", "anomalous volume"],
        });
      }
    });

    return patterns;
  }

  private detectGeographicPatterns(events: EventData[]): Pattern[] {
    const patterns: Pattern[] = [];
    const clusters = new Map<string, EventData[]>();

    events.forEach(e => {
      if (e.lat === 0 || !e.lat) return;
      const gridKey = `${Math.floor(e.lat / 5)}_${Math.floor(e.lon / 5)}`;
      if (!clusters.has(gridKey)) clusters.set(gridKey, []);
      clusters.get(gridKey)!.push(e);
    });

    clusters.forEach((clusterEvents, grid) => {
      if (clusterEvents.length >= 5) {
        const [latGrid, lonGrid] = grid.split("_").map(Number);
        const centerLat = latGrid * 5 + 2.5;
        const centerLon = lonGrid * 5 + 2.5;
        
        const categories = new Set(clusterEvents.map(e => e.category));
        const severities = clusterEvents.filter(e => e.severity === "critical" || e.severity === "high");
        
        patterns.push({
          id: `geo_cluster_${grid}_${Date.now()}`,
          type: "geographic",
          name: `Hotspot: ${centerLat.toFixed(1)}, ${centerLon.toFixed(1)}`,
          description: `${clusterEvents.length} events in area - Categories: ${Array.from(categories).join(", ")}`,
          confidence: Math.min(0.95, clusterEvents.length / 20),
          events: clusterEvents.map(e => e.id),
          locations: clusterEvents.map(e => ({ lat: e.lat, lon: e.lon })),
          frequency: clusterEvents.length,
          firstSeen: clusterEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0].date,
          lastSeen: clusterEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date,
          threatLevel: severities.length > 2 ? "critical" : severities.length > 0 ? "high" : "medium",
          indicators: Array.from(categories),
        });
      }
    });

    return patterns;
  }

  private detectBehavioralPatterns(events: EventData[]): Pattern[] {
    const patterns: Pattern[] = [];
    const sourceGroups = new Map<string, EventData[]>();

    events.forEach(e => {
      if (e.source) {
        const sourceKey = e.source.toLowerCase();
        if (!sourceGroups.has(sourceKey)) sourceGroups.set(sourceKey, []);
        sourceGroups.get(sourceKey)!.push(e);
      }
    });

    sourceGroups.forEach((sourceEvents, source) => {
      if (sourceEvents.length >= 10) {
        const categories = new Set(sourceEvents.map(e => e.category));
        const avgInterval = this.calculateAvgInterval(sourceEvents);
        
        patterns.push({
          id: `behavior_${source.replace(/\s/g, "_")}`,
          type: "behavioral",
          name: `Source Pattern: ${source}`,
          description: `${sourceEvents.length} events from ${source} - avg interval: ${(avgInterval / 60000).toFixed(1)}min`,
          confidence: Math.min(0.9, sourceEvents.length / 30),
          events: sourceEvents.map(e => e.id),
          locations: sourceEvents.map(e => ({ lat: e.lat, lon: e.lon })),
          frequency: sourceEvents.length,
          firstSeen: sourceEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0].date,
          lastSeen: sourceEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date,
          threatLevel: categories.has("cyber") || categories.has("conflict") ? "high" : "medium",
          indicators: Array.from(categories),
        });
      }
    });

    return patterns;
  }

  private detectNetworkPatterns(events: EventData[]): Pattern[] {
    const patterns: Pattern[] = [];
    const ipConnections = new Map<string, Set<string>>();
    const domainConnections = new Map<string, Set<string>>();

    events.forEach(e => {
      if (e.description) {
        const ips = e.description.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g);
        const domains = e.description.match(/\b[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}\b/g);
        
        if (ips) ips.forEach(ip => {
          if (!ipConnections.has(ip)) ipConnections.set(ip, new Set());
          events.forEach(other => {
            if (other.description?.includes(ip)) {
              ipConnections.get(ip)!.add(other.id);
            }
          });
        });
      }
    });

    ipConnections.forEach((connectedEvents, ip) => {
      if (connectedEvents.size >= 3) {
        patterns.push({
          id: `network_ip_${ip.replace(/\./g, "_")}`,
          type: "network",
          name: `IP Network: ${ip}`,
          description: `${ip} connected to ${connectedEvents.size} events`,
          confidence: 0.8,
          events: Array.from(connectedEvents),
          locations: events.filter(e => connectedEvents.has(e.id)).map(e => ({ lat: e.lat, lon: e.lon })),
          frequency: connectedEvents.size,
          firstSeen: events[0]?.date || new Date().toISOString(),
          lastSeen: new Date().toISOString(),
          threatLevel: "high",
          indicators: ["ip", "network"],
          mitigation: ["block IP", "investigate connections"],
        });
      }
    });

    return patterns;
  }

  private detectAnomalies(events: EventData[]): Pattern[] {
    const patterns: Pattern[] = [];
    const avgLat = events.reduce((sum, e) => sum + (e.lat || 0), 0) / events.length;
    const avgLon = events.reduce((sum, e) => sum + (e.lon || 0), 0) / events.length;
    
    events.forEach(e => {
      const dist = Math.sqrt(Math.pow((e.lat || 0) - avgLat, 2) + Math.pow((e.lon || 0) - avgLon, 2));
      if (dist > 100) {
        patterns.push({
          id: `anomaly_${e.id}`,
          type: "anomaly",
          name: `Outlier: ${e.type}`,
          description: `Event significantly distant from normal activity patterns`,
          confidence: Math.min(0.9, dist / 200),
          events: [e.id],
          locations: [{ lat: e.lat, lon: e.lon }],
          frequency: 1,
          firstSeen: e.date,
          lastSeen: e.date,
          threatLevel: "medium",
          indicators: ["outlier", "unusual location"],
        });
      }
    });

    return patterns.slice(0, 10);
  }

  private calculateAvgInterval(events: EventData[]): number {
    if (events.length < 2) return 0;
    const sorted = events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let total = 0;
    for (let i = 1; i < sorted.length; i++) {
      total += new Date(sorted[i].date).getTime() - new Date(sorted[i-1].date).getTime();
    }
    return total / (sorted.length - 1);
  }

  getPatterns(): Pattern[] {
    return Array.from(this.patterns.values()).sort((a, b) => b.confidence - a.confidence);
  }

  getThreats(): ThreatIntel[] {
    return Array.from(this.threats.values());
  }

  getInsights(): LearnedInsight[] {
    return Array.from(this.insights.values()).sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  addInsight(insight: Omit<LearnedInsight, "id" | "createdAt" | "updatedAt">): LearnedInsight {
    const newInsight: LearnedInsight = {
      ...insight,
      id: `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.insights.set(newInsight.id, newInsight);
    return newInsight;
  }

  updateInsight(id: string, updates: Partial<LearnedInsight>): LearnedInsight | null {
    const existing = this.insights.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.insights.set(id, updated);
    return updated;
  }

  searchPatterns(query: string): Pattern[] {
    const q = query.toLowerCase();
    return this.getPatterns().filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.description.toLowerCase().includes(q) ||
      p.indicators.some(i => i.toLowerCase().includes(q))
    );
  }
}

export const patternRecognition = new PatternRecognition();
