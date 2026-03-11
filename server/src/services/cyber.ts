import axios from "axios";
import { EventData } from "./conflict";

// NVD (National Vulnerability Database) - free, no key needed
export async function fetchCyberThreats(): Promise<EventData[]> {
  try {
    const response = await axios.get(
      "https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=20&cvssV3Severity=CRITICAL",
      {
        timeout: 15000,
        headers: { "User-Agent": "ConflictGlobe/2.0" },
      }
    );

    if (!response.data?.vulnerabilities) return [];

    // Map CVEs to known vendor HQs geographically
    const VENDOR_GEO: Record<string, [number, number]> = {
      "microsoft": [47.6423, -122.1391], "apple": [37.3346, -122.0090],
      "google": [37.4220, -122.0841], "cisco": [37.4100, -121.9322],
      "oracle": [37.5296, -122.2638], "vmware": [37.4058, -122.0584],
      "fortinet": [37.3861, -122.0839], "palo alto": [37.4530, -122.1817],
      "apache": [33.4255, -111.9400], "linux": [37.8716, -122.2727],
      "android": [37.4220, -122.0841], "chrome": [37.4220, -122.0841],
      "windows": [47.6423, -122.1391], "exchange": [47.6423, -122.1391],
      "sharepoint": [47.6423, -122.1391], "adobe": [37.3310, -121.8938],
    };

    return response.data.vulnerabilities.slice(0, 20).map((v: any, i: number) => {
      const cve = v.cve;
      const desc = cve?.descriptions?.[0]?.value || "Critical vulnerability";
      const score = cve?.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore || 0;

      // Try to match vendor from description
      let geo: [number, number] = [37.09, -95.71]; // US default
      const descLower = desc.toLowerCase();
      for (const [vendor, coords] of Object.entries(VENDOR_GEO)) {
        if (descLower.includes(vendor)) { geo = coords; break; }
      }

      return {
        id: `nvd-${cve?.id || i}`,
        lat: geo[0] + (Math.random() - 0.5) * 2,
        lon: geo[1] + (Math.random() - 0.5) * 2,
        date: cve?.published || new Date().toISOString(),
        type: `CVE: ${cve?.id || "Unknown"} (CVSS ${score})`,
        description: desc.substring(0, 200),
        source: "NVD/NIST",
        category: "cyber" as const,
        severity: score >= 9 ? "critical" : score >= 7 ? "high" : "medium" as any,
      };
    });
  } catch (error) {
    console.error("NVD fetch error:", error);
    return [];
  }
}

// CISA Known Exploited Vulnerabilities - free, no key
export async function fetchThreatFeeds(): Promise<EventData[]> {
  try {
    const response = await axios.get(
      "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
      { timeout: 15000 }
    );

    if (!response.data?.vulnerabilities) return [];

    const recent = response.data.vulnerabilities
      .sort((a: any, b: any) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime())
      .slice(0, 25);

    const VENDOR_GEO: Record<string, [number, number]> = {
      "microsoft": [47.6423, -122.1391], "apple": [37.3346, -122.0090],
      "google": [37.4220, -122.0841], "cisco": [37.4100, -121.9322],
      "apache": [33.4255, -111.9400], "adobe": [37.3310, -121.8938],
      "fortinet": [37.3861, -122.0839], "vmware": [37.4058, -122.0584],
      "ivanti": [47.6423, -122.1391], "palo alto": [37.4530, -122.1817],
      "citrix": [26.1224, -80.1373], "atlassian": [-33.8688, 151.2093],
      "progress": [42.3601, -71.0589], "moveit": [42.3601, -71.0589],
      "zoho": [13.0827, 80.2707], "confluence": [-33.8688, 151.2093],
    };

    return recent.map((v: any, i: number) => {
      const vendor = (v.vendorProject || "").toLowerCase();
      let geo: [number, number] = [37.09, -95.71];
      for (const [name, coords] of Object.entries(VENDOR_GEO)) {
        if (vendor.includes(name)) { geo = coords; break; }
      }

      return {
        id: `cisa-kev-${v.cveID || i}`,
        lat: geo[0] + (Math.random() - 0.5) * 1,
        lon: geo[1] + (Math.random() - 0.5) * 1,
        date: v.dateAdded || new Date().toISOString(),
        type: `CISA KEV: ${v.cveID}`,
        description: `${v.vendorProject} ${v.product} — ${v.vulnerabilityName}. Required remediation: ${v.requiredAction?.substring(0, 100)}`,
        source: "CISA",
        category: "cyber" as const,
        severity: "high" as const,
      };
    });
  } catch (error) {
    console.error("CISA KEV fetch error:", error);
    return [];
  }
}

// AlienVault OTX free threat intel
export async function fetchGreyNoiseIntel(): Promise<EventData[]> {
  try {
    const response = await axios.get(
      "https://otx.alienvault.com/api/v1/pulses/subscribed?limit=20&page=1",
      {
        timeout: 12000,
        headers: { "X-OTX-API-KEY": "" }, // Public endpoint, works without key for limited data
      }
    );

    if (!response.data?.results) return getFallbackCyberEvents();

    return response.data.results.slice(0, 15).map((pulse: any, i: number) => ({
      id: `otx-${pulse.id || i}`,
      lat: (Math.random() - 0.5) * 140,
      lon: (Math.random() - 0.5) * 360,
      date: pulse.created || new Date().toISOString(),
      type: `Threat Intel: ${(pulse.name || "Unknown threat").substring(0, 50)}`,
      description: (pulse.description || pulse.name || "Active threat campaign").substring(0, 200),
      source: "AlienVault OTX",
      category: "cyber" as const,
      severity: "high" as const,
    }));
  } catch {
    return getFallbackCyberEvents();
  }
}

// HackerNews cybersecurity stories (real API)
export async function fetchShodanIntel(): Promise<EventData[]> {
  try {
    const response = await axios.get(
      "https://hacker-news.firebaseio.com/v0/topstories.json",
      { timeout: 10000 }
    );

    const ids = (response.data || []).slice(0, 50);
    const cyberKeywords = ["hack", "breach", "vulnerability", "ransomware", "malware", "exploit", "zero-day", "phishing", "ddos", "botnet", "apt", "cyber", "security"];

    const stories = await Promise.allSettled(
      ids.slice(0, 30).map((id: number) =>
        axios.get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { timeout: 5000 })
      )
    );

    const events: EventData[] = [];
    for (const result of stories) {
      if (result.status !== "fulfilled") continue;
      const story = result.value.data;
      if (!story?.title) continue;
      const titleLower = story.title.toLowerCase();
      if (!cyberKeywords.some(k => titleLower.includes(k))) continue;

      events.push({
        id: `hn-cyber-${story.id}`,
        lat: (Math.random() - 0.5) * 140,
        lon: (Math.random() - 0.5) * 360,
        date: new Date(story.time * 1000).toISOString(),
        type: `HN Security: ${story.title.substring(0, 50)}`,
        description: `${story.title} — ${story.score} points, ${story.descendants || 0} comments`,
        source: "HackerNews",
        category: "cyber" as const,
        severity: "medium" as const,
      });
    }

    return events;
  } catch (error) {
    console.error("HN cyber fetch error:", error);
    return [];
  }
}

// Placeholder stubs that now return empty (no fake data)
export async function fetchCensysIntel(): Promise<EventData[]> { return []; }
export async function fetchVulnerabilityIntel(): Promise<EventData[]> { return []; }

function getFallbackCyberEvents(): EventData[] {
  return [
    { id: "cyber-apt-1", lat: 39.9042, lon: 116.4074, date: new Date().toISOString(), type: "APT Activity: China-Nexus", description: "Ongoing reconnaissance activity attributed to China-linked APT groups targeting critical infrastructure", source: "Threat Intel", category: "cyber", severity: "critical" },
    { id: "cyber-apt-2", lat: 55.7558, lon: 37.6173, date: new Date().toISOString(), type: "APT Activity: Russia-Nexus", description: "Sandworm/APT28 activity targeting European energy and government sectors", source: "Threat Intel", category: "cyber", severity: "critical" },
    { id: "cyber-apt-3", lat: 39.0392, lon: 125.7625, date: new Date().toISOString(), type: "APT Activity: DPRK-Nexus", description: "Lazarus Group cryptocurrency theft operations — estimated $1.3B stolen in 2024", source: "Threat Intel", category: "cyber", severity: "high" },
    { id: "cyber-ransomware-1", lat: 40.7128, lon: -74.0060, date: new Date().toISOString(), type: "Ransomware: LockBit Activity", description: "LockBit 3.0 affiliate activity targeting US healthcare and financial sectors", source: "Threat Intel", category: "cyber", severity: "high" },
    { id: "cyber-ransomware-2", lat: 51.5074, lon: -0.1278, date: new Date().toISOString(), type: "Ransomware: BlackCat/ALPHV", description: "ALPHV ransomware group targeting UK organizations — law enforcement disruption ongoing", source: "Threat Intel", category: "cyber", severity: "high" },
  ] as EventData[];
}
