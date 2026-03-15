import { EventData } from "./conflict";

export interface Entity {
  id: string;
  type: "actor" | "infrastructure" | "campaign" | "vulnerability" | "target";
  name: string;
  aliases: string[];
  description: string;
  confidence: number;
  firstSeen: string;
  lastSeen: string;
  associatedEvents: string[];
  indicators: string[];
  tags: string[];
  metadata: Record<string, any>;
  relationships: { targetId: string; type: string; confidence: number }[];
}

export interface Campaign {
  id: string;
  name: string;
  description: string;
  status: "active" | "dormant" | "attributed";
  startDate: string;
  endDate?: string;
  threatLevel: "low" | "medium" | "high" | "critical";
  actors: string[];
  targets: string[];
  locations: { lat: number; lon: number; name: string }[];
  ttps: string[];
  events: string[];
  attribution: string[];
  confidence: number;
}

export interface Vulnerability {
  id: string;
  cve?: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  cvss?: number;
  affectedProducts: string[];
  exploitation: "none" | "poc" | "active" | "widespread";
  mitigation: string[];
  discovered: string;
  published: string;
  relatedEvents: string[];
}

export interface Target {
  id: string;
  type: "organization" | "infrastructure" | "person" | "asset";
  name: string;
  description: string;
  priority: "low" | "medium" | "high" | "critical";
  sectors: string[];
  locations: { lat: number; lon: number; name: string }[];
  associatedIPs: string[];
  associatedDomains: string[];
  vulnerabilities: string[];
  lastAssessment?: string;
  riskScore: number;
}

class IntelligenceMemory {
  private entities: Map<string, Entity> = new Map();
  private campaigns: Map<string, Campaign> = new Map();
  private vulnerabilities: Map<string, Vulnerability> = new Map();
  private targets: Map<string, Target> = new Map();
  private eventIndex: Map<string, Set<string>> = new Map();
  private searchIndex: Map<string, Set<string>> = new Map();

  storeEvent(event: EventData): string {
    const entityId = `entity_${event.id}`;
    
    if (!this.entities.has(entityId)) {
      const entity: Entity = {
        id: entityId,
        type: "campaign",
        name: event.type || "Unknown Event",
        aliases: [],
        description: event.description || "",
        confidence: 0.7,
        firstSeen: event.date,
        lastSeen: event.date,
        associatedEvents: [event.id],
        indicators: this.extractIndicators(event),
        tags: [event.category, event.severity].filter(Boolean),
        metadata: { source: event.source, category: event.category },
        relationships: [],
      };
      this.entities.set(entityId, entity);
    } else {
      const entity = this.entities.get(entityId)!;
      entity.associatedEvents.push(event.id);
      entity.lastSeen = event.date;
      if (!entity.indicators.find(i => this.extractIndicators(event).includes(i))) {
        entity.indicators.push(...this.extractIndicators(event));
      }
    }

    if (!this.eventIndex.has(event.category)) {
      this.eventIndex.set(event.category, new Set());
    }
    this.eventIndex.get(event.category)!.add(event.id);

    const searchTerms = [
      event.type?.toLowerCase(),
      event.description?.toLowerCase(),
      event.source?.toLowerCase(),
      event.category,
    ].filter(Boolean);
    
    searchTerms.forEach(term => {
      if (term) {
        if (!this.searchIndex.has(term)) {
          this.searchIndex.set(term, new Set());
        }
        this.searchIndex.get(term)!.add(event.id);
      }
    });

    return entityId;
  }

  private extractIndicators(event: EventData): string[] {
    const indicators: string[] = [];
    const text = `${event.type} ${event.description} ${event.source}`;
    
    const ips = text.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g);
    if (ips) indicators.push(...ips);
    
    const domains = text.match(/\b[a-zA-Z0-9][-a-zA-Z0-9]*\.(com|org|net|io|ru|cn|ir|onion)\b/gi);
    if (domains) indicators.push(...domains);
    
    const hashes = text.match(/\b[a-fA-F0-9]{32,64}\b/g);
    if (hashes) indicators.push(...hashes);
    
    const emails = text.match(/\b[\w.-]+@[\w.-]+\.\w+\b/g);
    if (emails) indicators.push(...emails);

    return indicators;
  }

  storeEntity(entity: Omit<Entity, "id">): Entity {
    const id = `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newEntity: Entity = { ...entity, id };
    this.entities.set(id, newEntity);
    return newEntity;
  }

  updateEntity(id: string, updates: Partial<Entity>): Entity | null {
    const existing = this.entities.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    this.entities.set(id, updated);
    return updated;
  }

  getEntity(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  searchEntities(query: string, type?: string): Entity[] {
    const q = query.toLowerCase();
    let results = Array.from(this.entities.values());
    
    if (type) {
      results = results.filter(e => e.type === type);
    }
    
    return results.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.aliases.some(a => a.toLowerCase().includes(q)) ||
      e.description.toLowerCase().includes(q) ||
      e.indicators.some(i => i.toLowerCase().includes(q)) ||
      e.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  storeCampaign(campaign: Omit<Campaign, "id">): Campaign {
    const id = `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newCampaign: Campaign = { ...campaign, id };
    this.campaigns.set(id, newCampaign);
    return newCampaign;
  }

  getCampaigns(status?: "active" | "dormant" | "attributed"): Campaign[] {
    let results = Array.from(this.campaigns.values());
    if (status) {
      results = results.filter(c => c.status === status);
    }
    return results.sort((a, b) => {
      if (a.threatLevel === "critical" && b.threatLevel !== "critical") return -1;
      if (b.threatLevel === "critical" && a.threatLevel !== "critical") return 1;
      return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
    });
  }

  storeVulnerability(vuln: Omit<Vulnerability, "id">): Vulnerability {
    const id = `vuln_${vuln.cve || Date.now()}`;
    const newVuln: Vulnerability = { ...vuln, id };
    this.vulnerabilities.set(id, newVuln);
    return newVuln;
  }

  getVulnerabilities(severity?: string, exploitation?: string): Vulnerability[] {
    let results = Array.from(this.vulnerabilities.values());
    if (severity) results = results.filter(v => v.severity === severity);
    if (exploitation) results = results.filter(v => v.exploitation === exploitation);
    return results.sort((a, b) => (b.cvss || 0) - (a.cvss || 0));
  }

  storeTarget(target: Omit<Target, "id">): Target {
    const id = `target_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newTarget: Target = { ...target, id };
    this.targets.set(id, newTarget);
    return newTarget;
  }

  getTargets(priority?: string, sector?: string): Target[] {
    let results = Array.from(this.targets.values());
    if (priority) results = results.filter(t => t.priority === priority);
    if (sector) results = results.filter(t => t.sectors.includes(sector));
    return results.sort((a, b) => b.riskScore - a.riskScore);
  }

  findRelated(eventId: string): Entity[] {
    const related: Entity[] = [];
    const event = this.entities.get(`entity_${eventId}`);
    if (!event) return related;

    event.relationships.forEach(rel => {
      const entity = this.entities.get(rel.targetId);
      if (entity) related.push(entity);
    });

    return related;
  }

  getStatistics() {
    const entities = Array.from(this.entities.values());
    const campaigns = Array.from(this.campaigns.values());
    const vulns = Array.from(this.vulnerabilities.values());
    const targets = Array.from(this.targets.values());

    return {
      totalEntities: entities.length,
      entitiesByType: entities.reduce((acc, e) => {
        acc[e.type] = (acc[e.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      totalCampaigns: campaigns.length,
      activeCampaigns: campaigns.filter(c => c.status === "active").length,
      criticalCampaigns: campaigns.filter(c => c.threatLevel === "critical").length,
      totalVulnerabilities: vulns.length,
      criticalVulnerabilities: vulns.filter(v => v.severity === "critical").length,
      exploitedVulnerabilities: vulns.filter(v => v.exploitation === "active" || v.exploitation === "widespread").length,
      totalTargets: targets.length,
      highPriorityTargets: targets.filter(t => t.priority === "high" || t.priority === "critical").length,
      avgRiskScore: targets.length > 0 
        ? targets.reduce((sum, t) => sum + t.riskScore, 0) / targets.length 
        : 0,
    };
  }

  exportData() {
    return {
      entities: Array.from(this.entities.values()),
      campaigns: Array.from(this.campaigns.values()),
      vulnerabilities: Array.from(this.vulnerabilities.values()),
      targets: Array.from(this.targets.values()),
      exportedAt: new Date().toISOString(),
    };
  }

  importData(data: any) {
    if (data.entities) {
      data.entities.forEach((e: Entity) => this.entities.set(e.id, e));
    }
    if (data.campaigns) {
      data.campaigns.forEach((c: Campaign) => this.campaigns.set(c.id, c));
    }
    if (data.vulnerabilities) {
      data.vulnerabilities.forEach((v: Vulnerability) => this.vulnerabilities.set(v.id, v));
    }
    if (data.targets) {
      data.targets.forEach((t: Target) => this.targets.set(t.id, t));
    }
  }

  clear() {
    this.entities.clear();
    this.campaigns.clear();
    this.vulnerabilities.clear();
    this.targets.clear();
    this.eventIndex.clear();
    this.searchIndex.clear();
  }
}

export const intelligenceMemory = new IntelligenceMemory();
