import axios from "axios";
import { EventData } from "./conflict";

export interface DarkWebResult {
  id: string;
  source: string;
  url: string;
  title: string;
  snippet: string;
  date: string;
  type: "forum" | "marketplace" | "blog" | "leak" | "tool" | "credential";
  threatLevel: "low" | "medium" | "high" | "critical";
  indicators: string[];
}

const ONION_DIRECTORIES = [
  "http://directorynnm2feb.onion",
  "http://onionlandsearchengine5mpx63l3fw5plaztidbits5mx3p77bhxmhw6daase6qujr6dr3pcyd.onion",
];

const DARK_WEB_PATTERNS = [
  { pattern: /breach|leak|hacked|password|credential/i, type: "credential" as const, threat: "critical" as const },
  { pattern: /cve-\d{4}-\d{4,}/i, type: "leak" as const, threat: "high" as const },
  { pattern: /exploit|poc|0day|vulnerability/i, type: "tool" as const, threat: "high" as const },
  { pattern: /ransomware|malware|botnet/i, type: "tool" as const, threat: "critical" as const },
  { pattern: /fake (id|passport|document)|counterfeit/i, type: "marketplace" as const, threat: "high" as const },
  { pattern: /stolen (card|data|info)|dump/i, type: "marketplace" as const, threat: "critical" as const },
  { pattern: /apt|advanced persistent|nation.*state/i, type: "forum" as const, threat: "critical" as const },
  { pattern: /attack|target|victim/i, type: "forum" as const, threat: "high" as const },
];

class DarkWebScraper {
  private results: DarkWebResult[] = [];
  private isRunning = false;
  private torProxy = process.env.TOR_PROXY || "socks5://127.0.0.1:9050";

  async search(query: string, limit = 50): Promise<DarkWebResult[]> {
    if (this.isRunning) {
      return this.results.filter(r => 
        r.title.toLowerCase().includes(query.toLowerCase()) ||
        r.snippet.toLowerCase().includes(query.toLowerCase())
      ).slice(0, limit);
    }

    this.isRunning = true;
    const searchResults: DarkWebResult[] = [];

    try {
      const clearWebDarkResults = await this.searchClearWebDark(query);
      searchResults.push(...clearWebDarkResults);
    } catch (e) {
      console.error("[DarkWeb] Clear web search failed:", e);
    }

    try {
      const leakDatabaseResults = await this.searchLeakDatabases(query);
      searchResults.push(...leakDatabaseResults);
    } catch (e) {
      console.error("[DarkWeb] Leak DB search failed:", e);
    }

    try {
      const pasteSiteResults = await this.searchPasteSites(query);
      searchResults.push(...pasteSiteResults);
    } catch (e) {
      console.error("[DarkWeb] Paste site search failed:", e);
    }

    this.results = searchResults;
    this.isRunning = false;
    return searchResults.slice(0, limit);
  }

  private async searchClearWebDark(query: string): Promise<DarkWebResult[]> {
    const results: DarkWebResult[] = [];
    const keywords = query.split(" ").filter(k => k.length > 2);
    
    try {
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query + " onion site")}`;
      const response = await axios.get(searchUrl, { 
        timeout: 10000,
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
      });
      
      const html = response.data;
      const urlMatches = html.match(/href="(http[^"]+onion[^"]*)"/gi) || [];
      const titleMatches = html.match(/<a[^>]*class="result__a"[^>]*>([^<]+)/gi) || [];
      
      urlMatches.slice(0, 10).forEach((urlMatch, i) => {
        const url = urlMatch.replace(/href="/, "").replace(/"/, "");
        const title = titleMatches[i]?.replace(/<[^>]+>/g, "").trim() || "Dark Web Result";
        
        if (!url.includes("duckduckgo") && !url.includes("google")) {
          results.push({
            id: `darkweb_${Date.now()}_${i}`,
            source: "Clear Web Search",
            url,
            title: title.substring(0, 100),
            snippet: `Search result for: ${query}`,
            date: new Date().toISOString(),
            type: this.detectType(title + " " + query),
            threatLevel: this.detectThreatLevel(title + " " + query),
            indicators: keywords,
          });
        }
      });
    } catch (e) {
      console.error("[DarkWeb] Search error:", e);
    }

    return results;
  }

  private async searchLeakDatabases(query: string): Promise<DarkWebResult[]> {
    const results: DarkWebResult[] = [];
    const keywords = query.split(" ").filter(k => k.length > 2);

    const leakDBs = [
      { name: "DeHashed", url: "https://www.dehashed.com/search?q=" },
      { name: "HaveIBeenPwned", url: "https://haveibeenpwned.com/unifiedsearch/" },
      { name: "BreachDirectory", url: "https://breachdirectory.org/" },
    ];

    for (const db of leakDBs) {
      try {
        const response = await axios.get(`${db.url}${encodeURIComponent(query)}`, {
          timeout: 8000,
          headers: { "User-Agent": "Mozilla/5.0" }
        });

        if (response.status === 200 && response.data) {
          results.push({
            id: `leak_${db.name.toLowerCase()}_${Date.now()}`,
            source: db.name,
            url: `${db.url}${encodeURIComponent(query)}`,
            title: `${db.name} Search: ${query}`,
            snippet: `Database query returned results for ${query}`,
            date: new Date().toISOString(),
            type: "credential",
            threatLevel: "high",
            indicators: keywords,
          });
        }
      } catch {
        // Silently continue to next DB
      }
    }

    return results;
  }

  private async searchPasteSites(query: string): Promise<DarkWebResult[]> {
    const results: DarkWebResult[] = [];
    const keywords = query.split(" ").filter(k => k.length > 2);

    const pasteSites = [
      { name: "Pastebin", search: "https://pastebin.com/raw/", trending: "https://pastebin.com/trends" },
      { name: "Paste_org", search: "https://paste.org/" },
      { name: "Sull", search: "https://sull.org/" },
    ];

    for (const site of pasteSites) {
      try {
        const response = await axios.get(site.trending || site.search, {
          timeout: 8000,
          headers: { "User-Agent": "Mozilla/5.0" }
        });

        if (response.status === 200) {
          const matches = response.data.toString().match(new RegExp(keywords.join("|"), "gi"));
          if (matches && matches.length > 0) {
            results.push({
              id: `paste_${site.name.toLowerCase()}_${Date.now()}`,
              source: site.name,
              url: site.trending || site.search,
              title: `${site.name}: Potential match for ${query}`,
              snippet: `Found ${matches.length} potential matches`,
              date: new Date().toISOString(),
              type: "leak",
              threatLevel: matches.length > 5 ? "high" : "medium",
              indicators: keywords,
            });
          }
        }
      } catch {
        // Silently continue
      }
    }

    return results;
  }

  private detectType(text: string): DarkWebResult["type"] {
    for (const { pattern, type } of DARK_WEB_PATTERNS) {
      if (pattern.test(text)) return type;
    }
    return "forum";
  }

  private detectThreatLevel(text: string): DarkWebResult["threatLevel"] {
    for (const { pattern, threat } of DARK_WEB_PATTERNS) {
      if (pattern.test(text)) return threat;
    }
    return "medium";
  }

  async monitorOnionSites(sites: string[] = []): Promise<DarkWebResult[]> {
    const monitored: DarkWebResult[] = [];
    
    const defaultSites = [
      { name: "ProPublica", url: "http://p53foi4xqs4iuq5.onion" },
      { name: "SecureDrop", url: "http://sdolvtfhatvsysc6l34d65ymdwyfc53kf7jt3mkqtxejpcyvy7i7cyd.onion" },
    ];

    const toMonitor = sites.length > 0 ? sites.map(s => ({ name: s, url: s })) : defaultSites;

    for (const site of toMonitor) {
      try {
        const response = await axios.get(site.url, {
          timeout: 15000,
          proxy: false,
        });

        monitored.push({
          id: `onion_${site.name.toLowerCase()}_${Date.now()}`,
          source: site.name,
          url: site.url,
          title: `${site.name} - Status: Online`,
          snippet: `Onion site is accessible. Content length: ${response.data.length} bytes`,
          date: new Date().toISOString(),
          type: "blog",
          threatLevel: "low",
          indicators: [],
        });
      } catch {
        monitored.push({
          id: `onion_${site.name.toLowerCase()}_${Date.now()}`,
          source: site.name,
          url: site.url,
          title: `${site.name} - Status: Offline/Unreachable`,
          snippet: `Could not reach onion site`,
          date: new Date().toISOString(),
          type: "blog",
          threatLevel: "low",
          indicators: [],
        });
      }
    }

    return monitored;
  }

  getRecentResults(): DarkWebResult[] {
    return this.results.slice(0, 100);
  }

  getResultsByThreatLevel(level: DarkWebResult["threatLevel"]): DarkWebResult[] {
    return this.results.filter(r => r.threatLevel === level);
  }

  toEventData(results: DarkWebResult[]): EventData[] {
    return results.map(r => ({
      id: `darkweb_${r.id}`,
      lat: 0,
      lon: 0,
      date: r.date,
      type: `[DARK WEB] ${r.title}`,
      description: `${r.snippet}\n\nSource: ${r.source}\nURL: ${r.url}\nThreat Level: ${r.threatLevel}`,
      source: r.source,
      category: "cyber" as const,
      severity: r.threatLevel === "critical" ? "critical" : r.threatLevel === "high" ? "high" : "medium" as const,
    }));
  }
}

export const darkWebScraper = new DarkWebScraper();
