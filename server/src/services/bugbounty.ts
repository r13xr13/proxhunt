import axios from "axios";
import { EventData } from "./conflict";

export interface BugBountyProgram {
  id: string;
  name: string;
  platform: string;
  url: string;
  bounty: number;
  scope: string[];
  exclusions: string[];
  severityRewards: Record<string, number>;
  lastUpdated: string;
}

export interface BugBountyFinding {
  id: string;
  program: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  status: "open" | "resolved" | "wontfix" | "duplicate";
  reportedAt: string;
  bounty?: number;
  cve?: string;
  description: string;
  affectedAsset: string;
  remediation?: string;
}

export interface VulnerabilityScan {
  id: string;
  target: string;
  tool: string;
  startedAt: string;
  completedAt?: string;
  status: "running" | "completed" | "failed";
  findings: Finding[];
  rawOutput?: string;
}

export interface Finding {
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  cve?: string;
  cwe?: string;
  affectedUrl?: string;
  remediation?: string;
  evidence?: string;
}

class BugBountyHunter {
  private programs: BugBountyProgram[] = [];
  private findings: BugBountyFinding[] = [];
  private scans: VulnerabilityScan[] = [];

  async searchPrograms(query: string): Promise<BugBountyProgram[]> {
    const results: BugBountyProgram[] = [];
    
    try {
      const hackerone = await this.searchHackerOne(query);
      results.push(...hackerone);
    } catch (e) {
      console.error("[BugBounty] HackerOne search failed:", e);
    }

    try {
      const bugcrowd = await this.searchBugcrowd(query);
      results.push(...bugcrowd);
    } catch (e) {
      console.error("[BugBounty] Bugcrowd search failed:", e);
    }

    this.programs = results;
    return results;
  }

  private async searchHackerOne(query: string): Promise<BugBountyProgram[]> {
    const results: BugBountyProgram[] = [];
    
    try {
      const searchUrl = `https://api.hackerone.com/v1/programs?search[handle]=${encodeURIComponent(query)}`;
      const response = await axios.get(searchUrl, {
        timeout: 10000,
        auth: {
          username: process.env.HACKERONE_API_KEY || "",
          password: "x"
        }
      });

      if (response.data?.data) {
        response.data.data.forEach((prog: any) => {
          results.push({
            id: `h1_${prog.id}`,
            name: prog.attributes.handle,
            platform: "HackerOne",
            url: `https://hackerone.com/${prog.attributes.handle}`,
            bounty: prog.attributes.max_bounty || 0,
            scope: prog.attributes.scopes || [],
            exclusions: prog.attributes.exclusion_vectors || [],
            severityRewards: prog.attributes.assets || {},
            lastUpdated: prog.attributes.updated_at,
          });
        });
      }
    } catch {}

    return results;
  }

  private async searchBugcrowd(query: string): Promise<BugBountyProgram[]> {
    const results: BugBountyProgram[] = [];
    
    try {
      const searchUrl = `https://bugcrowd.com/api/programs/${query}`;
      const response = await axios.get(searchUrl, {
        timeout: 10000,
      });

      if (response.data) {
        results.push({
          id: `bc_${query}`,
          name: response.data.name || query,
          platform: "Bugcrowd",
          url: `https://bugcrowd.com/${query}`,
          bounty: response.data.priority_reward_amount || 0,
          scope: response.data.scope || [],
          exclusions: [],
          severityRewards: {},
          lastUpdated: new Date().toISOString(),
        });
      }
    } catch {}

    return results;
  }

  async getProgramScope(programHandle: string): Promise<{ inScope: string[]; outOfScope: string[] }> {
    return { inScope: [], outOfScope: [] };
  }

  async runRecon(target: string, tool: string = "nmap"): Promise<VulnerabilityScan> {
    const scan: VulnerabilityScan = {
      id: `scan_${Date.now()}`,
      target,
      tool,
      startedAt: new Date().toISOString(),
      status: "running",
      findings: [],
    };

    this.scans.push(scan);

    return scan;
  }

  getActiveScans(): VulnerabilityScan[] {
    return this.scans.filter(s => s.status === "running");
  }

  getScanResults(scanId: string): VulnerabilityScan | undefined {
    return this.scans.find(s => s.id === scanId);
  }

  async checkCVE(cveId: string): Promise<any> {
    try {
      const response = await axios.get(`https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${cveId}`, {
        timeout: 15000,
      });
      return response.data;
    } catch (e) {
      console.error("[BugBounty] CVE check failed:", e);
      return null;
    }
  }

  async checkDomain(target: string): Promise<any> {
    const results: any = { target, checks: [] };
    
    try {
      const dns = await axios.get(`https://dns.google/resolve?name=${target}&type=A`, { timeout: 5000 });
      results.checks.push({ type: "DNS_A", result: dns.data });
    } catch {}

    try {
      const whois = await axios.get(`https://jsonwhois.com/api/v1/whois?domain=${target}`, {
        timeout: 5000,
        headers: { "Authorization": process.env.WHOIS_API_KEY || "" }
      });
      results.checks.push({ type: "WHOIS", result: whois.data });
    } catch {}

    try {
      const subdomains = await axios.get(`https://api.api-nin.com/api/v1/dns?domain=${target}&type=NS`, {
        timeout: 5000,
        headers: { "X-Api-Key": process.env.NINJA_API_KEY || "" }
      });
      results.checks.push({ type: "NS", result: subdomains.data });
    } catch {}

    return results;
  }

  async subdomainEnum(target: string): Promise<string[]> {
    const subdomains: string[] = [];
    
    const wordlists = [
      "www", "mail", "ftp", "localhost", "webmail", "smtp", "pop", "ns1", "webdisk",
      "ns2", "cpanel", "whm", "autodiscover", "autoconfig", "m", "imap", "test",
      "ns", "email", "cdn", "static", "docs", "beta", "shop", "store", "dev",
      "staging", "admin", "login", "blog", "git", "ssh", "S3", "cloud",
    ];

    const promises = wordlists.map(async (sub) => {
      try {
        const host = `${sub}.${target}`;
        const dns = await axios.get(`https://dns.google/resolve?name=${host}&type=A`, { timeout: 3000 });
        if (dns.data.Answer && dns.data.Answer.length > 0) {
          subdomains.push(host);
        }
      } catch {}
    });

    await Promise.allSettled(promises);
    return subdomains;
  }

  toEventData(findings: BugBountyFinding[]): EventData[] {
    return findings.map(f => ({
      id: `bounty_${f.id}`,
      lat: 0,
      lon: 0,
      date: f.reportedAt,
      type: `[BUG BOUNTY] ${f.title}`,
      description: `Program: ${f.program}\nSeverity: ${f.severity}\nStatus: ${f.status}\n${f.description}\n\nAffected: ${f.affectedAsset}${f.remediation ? `\nRemediation: ${f.remediation}` : ""}`,
      source: "BugBountyHunter",
      category: "cyber" as const,
      severity: f.severity === "critical" ? "critical" : f.severity === "high" ? "high" : "medium" as const,
    }));
  }
}

export const bugBountyHunter = new BugBountyHunter();
