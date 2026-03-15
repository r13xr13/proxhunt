import { spawn, exec } from "child_process";
import { EventData } from "./conflict";

export interface ContainerTool {
  name: string;
  category: "recon" | "scanning" | "exploitation" | "enumeration" | "ai" | "utility";
  description: string;
  command: string;
  args: string[];
}

export interface ToolResult {
  id: string;
  tool: string;
  target: string;
  startedAt: string;
  completedAt?: string;
  status: "running" | "completed" | "failed";
  output: string;
  errors?: string;
  findings?: string[];
  parsedData?: any;
}

export interface AIRequest {
  prompt: string;
  model?: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIResponse {
  model: string;
  response: string;
  tokens: number;
  done: boolean;
}

const AVAILABLE_TOOLS: ContainerTool[] = [
  { name: "nmap", category: "scanning", description: "Network port scanner", command: "nmap", args: ["-sV", "-O", "-T4"] },
  { name: "masscan", category: "scanning", description: "Fast TCP port scanner", command: "masscan", args: ["-p1-65535"] },
  { name: "nikto", category: "scanning", description: "Web server scanner", command: "nikto", args: ["-h"] },
  { name: "dirb", category: "enumeration", description: "Directory brute force", command: "dirb", args: [] },
  { name: "gobuster", category: "enumeration", description: "DNS/Directory enumeration", command: "gobuster", args: ["dir"] },
  { name: "ffuf", category: "enumeration", description: "Fast web fuzzer", command: "ffuf", args: ["-u"] },
  { name: "subfinder", category: "recon", description: "Subdomain enumeration", command: "subfinder", args: ["-d"] },
  { name: "amass", category: "recon", description: "In-depth subdomain enumeration", command: "amass", args: ["enum"] },
  { name: "assetfinder", category: "recon", description: "Find related domains", command: "assetfinder", args: [] },
  { name: "httprobe", category: "recon", description: "Probe for alive HTTP servers", command: "httprobe", args: [] },
  { name: "waybackurls", category: "enumeration", description: "Fetch URLs from Wayback", command: "waybackurls", args: [] },
  { name: "sslyze", category: "scanning", description: "SSL/TLS scanner", command: "sslyze", args: ["--regular"] },
  { name: "sqlmap", category: "exploitation", description: "SQL injection tool", command: "sqlmap", args: [] },
  { name: "commix", category: "exploitation", description: "Command injection exploiter", command: "commix", args: [] },
  { name: "ssrfmap", category: "exploitation", description: "SSRF exploitation", command: "ssrfmap", args: [] },
  { name: "jwt_tool", category: "utility", description: "JWT analysis", command: "jwt_tool", args: [] },
  { name: "hashcat", category: "utility", description: "Password cracker", command: "hashcat", args: [] },
  { name: "john", category: "utility", description: "John the Ripper", command: "john", args: [] },
  { name: "searchsploit", category: "exploitation", description: "Exploit DB search", command: "searchsploit", args: [] },
  { name: "msfconsole", category: "exploitation", description: "Metasploit Framework", command: "msfconsole", args: ["-q"] },
];

class Sigil7Container {
  private containerName = process.env.SIGIL7_CONTAINER || "sigil7";
  private containerIP = process.env.SIGIL7_IP || "172.18.0.10";
  private results: Map<string, ToolResult> = new Map();
  private isOnline = false;

  async checkStatus(): Promise<boolean> {
    return new Promise((resolve) => {
      exec(`docker inspect -f '{{.State.Running}}' ${this.containerName}`, (err, stdout) => {
        this.isOnline = !err && stdout.trim() === "true";
        resolve(this.isOnline);
      });
    });
  }

  getTools(): ContainerTool[] {
    return AVAILABLE_TOOLS;
  }

  getToolsByCategory(category: ContainerTool["category"]): ContainerTool[] {
    return AVAILABLE_TOOLS.filter(t => t.category === category);
  }

  async runTool(tool: ContainerTool, target: string, extraArgs: string[] = []): Promise<ToolResult> {
    const result: ToolResult = {
      id: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tool: tool.name,
      target,
      startedAt: new Date().toISOString(),
      status: "running",
      output: "",
    };

    this.results.set(result.id, result);

    const args = [...tool.args, ...extraArgs, target];
    
    return new Promise((resolve) => {
      const proc = spawn("docker", ["exec", "-i", this.containerName, tool.command, ...args], {
        shell: false,
      });

      let output = "";
      let errors = "";

      proc.stdout.on("data", (data) => {
        output += data.toString();
        const current = this.results.get(result.id);
        if (current) {
          current.output = output;
          this.results.set(result.id, current);
        }
      });

      proc.stderr.on("data", (data) => {
        errors += data.toString();
      });

      proc.on("close", (code) => {
        const final = this.results.get(result.id);
        if (final) {
          final.status = code === 0 ? "completed" : "failed";
          final.completedAt = new Date().toISOString();
          final.output = output;
          final.errors = errors || undefined;
          final.findings = this.parseFindings(tool.name, output);
          this.results.set(result.id, final);
        }
        resolve(final!);
      });

      proc.on("error", (err) => {
        const failed = this.results.get(result.id);
        if (failed) {
          failed.status = "failed";
          failed.completedAt = new Date().toISOString();
          failed.errors = err.message;
          this.results.set(result.id, failed);
        }
        resolve(failed!);
      });
    });
  }

  private parseFindings(tool: string, output: string): string[] {
    const findings: string[] = [];
    
    if (tool === "nmap") {
      const openPorts = output.match(/(\d+)\/(tcp|udp)\s+open/g);
      if (openPorts) findings.push(...openPorts);
      const osMatch = output.match(/OS details: ([^\n]+)/);
      if (osMatch) findings.push(`OS: ${osMatch[1]}`);
    } else if (tool === "nikto") {
      const vulns = output.match(/- \+ ([^\n]+)/g);
      if (vulns) findings.push(...vulns.map(v => v.replace("- + ", "")));
    } else if (tool === "gobuster" || tool === "dirb" || tool === "ffuf") {
      const dirs = output.match(/\/(\S+)\s+/g);
      if (dirs) findings.push(...dirs.slice(0, 20));
    } else if (tool === "subfinder" || tool === "amass" || tool === "assetfinder") {
      const subs = output.split("\n").filter(l => l.includes("."));
      findings.push(...subs.slice(0, 50));
    }

    return findings;
  }

  async runAI(request: AIRequest): Promise<AIResponse> {
    const model = request.model || "llama3";
    const prompt = request.prompt;
    const system = request.system || "You are a cybersecurity expert assistant. Provide detailed, actionable intelligence.";
    const maxTokens = request.maxTokens || 1024;

    return new Promise((resolve) => {
      const args = [
        "-m", "/models/llama3.bin",
        "-p", prompt,
        "-n", maxTokens.toString(),
        "--temp", (request.temperature || 0.7).toString(),
        "--ctx", "4096",
        "-t", "8"
      ];

      if (system) {
        args.unshift(`[INST]<<SYS>>\n${system}\n<</SYS>>\n`);
      }

      const proc = spawn("docker", ["exec", "-i", this.containerName, "llama.cpp/llama", ...args], {
        shell: false,
      });

      let output = "";
      let fullResponse = "";

      proc.stdout.on("data", (data) => {
        output = data.toString();
        fullResponse += output;
      });

      proc.on("close", () => {
        resolve({
          model,
          response: fullResponse.trim(),
          tokens: fullResponse.split(" ").length,
          done: true,
        });
      });

      proc.on("error", () => {
        resolve({
          model,
          response: "Error: Could not connect to AI container",
          tokens: 0,
          done: false,
        });
      });
    });
  }

  async runAIWithContext(context: string, question: string): Promise<AIResponse> {
    const prompt = `Context:\n${context}\n\nQuestion: ${question}\n\nAnswer:`;
    return this.runAI({
      prompt,
      system: "You are a cybersecurity intelligence analyst. Analyze the provided context and answer questions about threats, vulnerabilities, and security events.",
      maxTokens: 2048,
    });
  }

  async runFullRecon(target: string): Promise<ToolResult[]> {
    const results: ToolResult[] = [];
    const targetClean = target.replace(/[^a-zA-Z0-9.-]/g, "");

    const reconTools: ContainerTool[] = [
      AVAILABLE_TOOLS.find(t => t.name === "subfinder")!,
      AVAILABLE_TOOLS.find(t => t.name === "httprobe")!,
    ];

    for (const tool of reconTools) {
      if (tool) {
        const result = await this.runTool(tool, targetClean);
        results.push(result);
      }
    }

    return results;
  }

  async runVulnScan(target: string): Promise<ToolResult[]> {
    const results: ToolResult[] = [];
    const targetClean = target.replace(/[^a-zA-Z0-9.-]/g, "");

    const scanTools: ContainerTool[] = [
      AVAILABLE_TOOLS.find(t => t.name === "nmap")!,
      AVAILABLE_TOOLS.find(t => t.name === "nikto")!,
      AVAILABLE_TOOLS.find(t => t.name === "sslyze")!,
    ];

    for (const tool of scanTools) {
      if (tool) {
        const result = await this.runTool(tool, targetClean);
        results.push(result);
      }
    }

    return results;
  }

  getResult(resultId: string): ToolResult | undefined {
    return this.results.get(resultId);
  }

  getRecentResults(limit = 10): ToolResult[] {
    return Array.from(this.results.values())
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, limit);
  }

  toEventData(results: ToolResult[]): EventData[] {
    return results.map(r => ({
      id: `sigil7_${r.id}`,
      lat: 0,
      lon: 0,
      date: r.startedAt,
      type: `[PENTEST] ${r.tool} on ${r.target}`,
      description: `Tool: ${r.tool}\nTarget: ${r.target}\nStatus: ${r.status}\n\nOutput:\n${r.output.substring(0, 2000)}${r.output.length > 2000 ? "\n...(truncated)" : ""}${r.findings ? `\n\nFindings:\n${r.findings.join("\n")}` : ""}`,
      source: "Sigil7 Pentest",
      category: "cyber" as const,
      severity: r.status === "failed" ? "low" : "medium" as const,
    }));
  }
}

export const sigil7Container = new Sigil7Container();
