import axios from "axios";
import { EventData } from "./conflict";

export interface ScrapedContent {
  id: string;
  source: string;
  url: string;
  title: string;
  content: string;
  published?: string;
  author?: string;
  tags: string[];
  sentiment?: "positive" | "negative" | "neutral";
  extractedEntities: {
    ips?: string[];
    domains?: string[];
    emails?: string[];
    hashes?: string[];
    urls?: string[];
  };
}

const SCRAPE_SOURCES = [
  { name: "Twitter/X", baseUrl: "https://twitter.com", keywords: ["cybersecurity", "breach", "hack", "exploit", "cve"] },
  { name: "Reddit", baseUrl: "https://reddit.com", keywords: ["cybersecurity", "hacking", "malware"] },
  { name: "GitHub", baseUrl: "https://github.com", keywords: ["exploit", "cve", "vulnerability"] },
  { name: "SecurityWeek", baseUrl: "https://www.securityweek.com", keywords: [] },
  { name: "TheHackerNews", baseUrl: "https://thehackernews.com", keywords: [] },
  { name: "BleepingComputer", baseUrl: "https://www.bleepingcomputer.com", keywords: [] },
  { name: "KrebsOnSecurity", baseUrl: "https://krebsonsecurity.com", keywords: [] },
  { name: "DarkReading", baseUrl: "https://www.darkreading.com", keywords: [] },
  { name: "CISA", baseUrl: "https://www.cisa.gov/news-events/cybersecurity-advisories", keywords: [] },
  { name: "US-CERT", baseUrl: "https://us-cert.cisa.gov/ncas/alerts", keywords: [] },
];

class ClearWebScraper {
  private cache: Map<string, { data: ScrapedContent; ts: number }> = new Map();
  private readonly CACHE_TTL = 300000;

  async scrapeSource(sourceName: string, query?: string): Promise<ScrapedContent[]> {
    const cacheKey = `${sourceName}_${query || "all"}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.ts < this.CACHE_TTL) {
      return [cached.data];
    }

    const source = SCRAPE_SOURCES.find(s => s.name === sourceName);
    if (!source) return [];

    const results: ScrapedContent[] = [];

    try {
      if (sourceName === "GitHub") {
        const ghResults = await this.scrapeGitHub(query || "exploit");
        results.push(...ghResults);
      } else if (sourceName === "Twitter/X") {
        const twResults = await this.scrapeTwitter(query);
        results.push(...twResults);
      } else {
        const webResults = await this.scrapeWebsite(source, query);
        results.push(...webResults);
      }

      if (results.length > 0) {
        this.cache.set(cacheKey, { data: results[0], ts: Date.now() });
      }
    } catch (e) {
      console.error(`[ClearWeb] Failed to scrape ${sourceName}:`, e);
    }

    return results;
  }

  private async scrapeGitHub(query: string): Promise<ScrapedContent[]> {
    const results: ScrapedContent[] = [];
    
    try {
      const searchUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}+in:readme&sort=updated&per_page=10`;
      const response = await axios.get(searchUrl, {
        timeout: 10000,
        headers: { 
          "User-Agent": "ConflictGlobe/1.0",
          "Accept": "application/vnd.github.v3+json"
        }
      });

      if (response.data?.items) {
        response.data.items.forEach((repo: any) => {
          results.push({
            id: `gh_${repo.id}`,
            source: "GitHub",
            url: repo.html_url,
            title: repo.name,
            content: repo.description || "",
            published: repo.updated_at,
            author: repo.owner?.login,
            tags: repo.topics || [],
            extractedEntities: {
              urls: [repo.html_url],
            },
          });
        });
      }
    } catch (e) {
      console.error("[ClearWeb] GitHub scrape error:", e);
    }

    return results;
  }

  private async scrapeTwitter(query?: string): Promise<ScrapedContent[]> {
    const results: ScrapedContent[] = [];
    
    if (!query) return results;

    try {
      const searchUrl = `https://nitter.net/search?type=all&q=${encodeURIComponent(query)}`;
      const response = await axios.get(searchUrl, {
        timeout: 10000,
        headers: { "User-Agent": "Mozilla/5.0" }
      });

      const html = response.data;
      const tweetMatches = html.match(/<a[^>]*class="tweet-link"[^>]*href="([^"]+)"[^>]*>/gi) || [];
      const contentMatches = html.match(/<p[^>]*class="tweet-content"[^>]*>([^<]+)/gi) || [];

      tweetMatches.slice(0, 10).forEach((match, i) => {
        const url = match.match(/href="([^"]+)"/)?.[1] || "";
        const content = contentMatches[i]?.replace(/<[^>]+>/g, "").trim() || "";
        
        if (content) {
          results.push({
            id: `twitter_${Date.now()}_${i}`,
            source: "Twitter/X",
            url: url.startsWith("http") ? url : `https://nitter.net${url}`,
            title: content.substring(0, 80),
            content,
            published: new Date().toISOString(),
            tags: [query],
            extractedEntities: this.extractEntities(content),
          });
        }
      });
    } catch (e) {
      console.error("[ClearWeb] Twitter scrape error:", e);
    }

    return results;
  }

  private async scrapeWebsite(source: { name: string; baseUrl: string; keywords: string[] }, query?: string): Promise<ScrapedContent[]> {
    const results: ScrapedContent[] = [];
    
    try {
      const searchQuery = query || source.keywords[0] || "security";
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery + " " + source.name)}`;
      
      const response = await axios.get(searchUrl, {
        timeout: 10000,
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
      });

      const html = response.data;
      const linkMatches = html.match(/href="(https?:\/\/[^"]+)"/gi) || [];
      const titleMatches = html.match(/<a[^>]*class="result__a"[^>]*>([^<]+)/gi) || [];
      const snippetMatches = html.match(/<a[^>]*class="result__snippet"[^>]*>([^<]+)/gi) || [];

      const uniqueUrls = new Set<string>();
      linkMatches.slice(0, 15).forEach((match, i) => {
        const url = match.replace(/href="/, "").replace(/"/, "");
        const title = titleMatches[i]?.replace(/<[^>]+>/g, "").trim() || "";
        const snippet = snippetMatches[i]?.replace(/<[^>]+>/g, "").trim() || "";

        if (url && !uniqueUrls.has(url) && !url.includes("duckduckgo") && !url.includes("google")) {
          uniqueUrls.add(url);
          
          if (title && (snippet || title)) {
            results.push({
              id: `web_${Date.now()}_${i}`,
              source: source.name,
              url,
              title: title.substring(0, 100),
              content: snippet || title,
              published: new Date().toISOString(),
              tags: [searchQuery],
              extractedEntities: this.extractEntities(title + " " + snippet),
            });
          }
        }
      });
    } catch (e) {
      console.error(`[ClearWeb] ${source.name} scrape error:`, e);
    }

    return results;
  }

  private extractEntities(text: string): ScrapedContent["extractedEntities"] {
    const entities: ScrapedContent["extractedEntities"] = {};
    
    const ips = text.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g);
    if (ips) entities.ips = [...new Set(ips)];
    
    const domains = text.match(/\b[a-zA-Z0-9][-a-zA-Z0-9]*\.(com|org|net|io|ru|cn|gov|edu)\b/gi);
    if (domains) entities.domains = [...new Set(domains.map(d => d.toLowerCase()))];
    
    const emails = text.match(/\b[\w.-]+@[\w.-]+\.\w+\b/g);
    if (emails) entities.emails = [...new Set(emails)];
    
    const hashes = text.match(/\b[a-fA-F0-9]{32,64}\b/g);
    if (hashes) entities.hashes = [...new Set(hashes)];
    
    const urls = text.match(/https?:\/\/[^\s]+/gi);
    if (urls) entities.urls = [...new Set(urls)];

    return entities;
  }

  async searchAll(query: string, limit = 100): Promise<ScrapedContent[]> {
    const allResults: ScrapedContent[] = [];
    
    const sourcesToSearch = SCRAPE_SOURCES.slice(0, 5);
    
    const promises = sourcesToSearch.map(source => 
      this.scrapeSource(source.name, query).catch(() => [])
    );
    
    const results = await Promise.all(promises);
    results.forEach(r => allResults.push(...r));
    
    return allResults.slice(0, limit);
  }

  getCachedResults(): ScrapedContent[] {
    return Array.from(this.cache.values()).map(c => c.data);
  }

  toEventData(results: ScrapedContent[]): EventData[] {
    return results.map(r => ({
      id: `clearweb_${r.id}`,
      lat: 0,
      lon: 0,
      date: r.published || new Date().toISOString(),
      type: `[CLEAR WEB] ${r.title}`,
      description: `${r.content}\n\nSource: ${r.source}\nURL: ${r.url}\nEntities: ${JSON.stringify(r.extractedEntities)}`,
      source: r.source,
      category: "cyber" as const,
      severity: "medium" as const,
    }));
  }
}

export const clearWebScraper = new ClearWebScraper();
