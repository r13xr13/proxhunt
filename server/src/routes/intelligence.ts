import { Router } from "express";
import { patternRecognition, Pattern } from "../services/patternRecognition";
import { intelligenceMemory, Entity, Campaign, Vulnerability, Target } from "../services/memory";
import { darkWebScraper } from "../services/darkweb";
import { clearWebScraper, ScrapedContent } from "../services/clearweb";
import { bugBountyHunter } from "../services/bugbounty";
import { sigil7Container, AIRequest } from "../services/sigil7";
import { portainerService } from "../services/portainer";
import { generateDorks, scanCameras, executeDorkSearch, DorkResult, getCameraMarkers } from "../services/dorks";
import { groqWhisper } from "../services/groqWhisper";
import { ObsidianVaultService, initObsidianVault } from "../services/obsidian";

const router = Router();

// Initialize Obsidian vault service
let obsidianVault: ObsidianVaultService | null = null;

const initVault = async () => {
  if (process.env.OBSIDIAN_VAULT_PATH) {
    obsidianVault = await initObsidianVault({
      vaultPath: process.env.OBSIDIAN_VAULT_PATH,
      notesFolder: process.env.OBSIDIAN_NOTES_FOLDER || 'conflict-globe'
    });
  }
};

initVault();

router.get("/health", (_req, res) => {
  res.json({ 
    status: "healthy",
    services: {
      patternRecognition: "active",
      memory: "active",
      darkweb: "active",
      clearweb: "active",
      bugbounty: "active",
      sigil7: "checking"
    },
    timestamp: new Date().toISOString()
  });
});

router.get("/patterns", (_req, res) => {
  const patterns = patternRecognition.getPatterns();
  res.json({ patterns });
});

router.get("/patterns/:id", (req, res) => {
  const pattern = patternRecognition.searchPatterns(req.params.id);
  res.json({ pattern });
});

router.get("/insights", (_req, res) => {
  const patterns = patternRecognition.getPatterns();
  res.json({ insights: patterns });
});

router.post("/insights", (req, res) => {
  const pattern = patternRecognition.analyzeEvents(req.body.events || []);
  res.json({ pattern });
});

router.get("/entities", (req, res) => {
  const { type, q } = req.query;
  const entities = intelligenceMemory.searchEntities(q as string || "", type as string);
  res.json({ entities });
});

router.post("/entities", (req, res) => {
  const entity = intelligenceMemory.storeEntity(req.body);
  res.json({ entity });
});

router.get("/entities/:id", (req, res) => {
  const entity = intelligenceMemory.getEntity(req.params.id);
  if (entity) {
    res.json({ entity });
  } else {
    res.status(404).json({ error: "Entity not found" });
  }
});

router.get("/campaigns", (req, res) => {
  const { status } = req.query;
  const campaigns = intelligenceMemory.getCampaigns(status as any);
  res.json({ campaigns });
});

router.post("/campaigns", (req, res) => {
  const campaign = intelligenceMemory.storeCampaign(req.body);
  res.json({ campaign });
});

router.get("/vulnerabilities", (req, res) => {
  const { severity, exploitation } = req.query;
  const vulns = intelligenceMemory.getVulnerabilities(severity as string, exploitation as string);
  res.json({ vulnerabilities: vulns });
});

router.post("/vulnerabilities", (req, res) => {
  const vuln = intelligenceMemory.storeVulnerability(req.body);
  res.json({ vulnerability: vuln });
});

router.get("/targets", (req, res) => {
  const { priority, sector } = req.query;
  const targets = intelligenceMemory.getTargets(priority as string, sector as string);
  res.json({ targets });
});

router.post("/targets", (req, res) => {
  const target = intelligenceMemory.storeTarget(req.body);
  res.json({ target });
});

router.get("/statistics", (_req, res) => {
  const stats = intelligenceMemory.getStatistics();
  res.json({ statistics: stats });
});

router.post("/analyze", async (req, res) => {
  try {
    const { events } = req.body;
    const patterns = patternRecognition.analyzeEvents(events || []);
    res.json({ patterns, count: patterns.length });
  } catch (error) {
    res.status(500).json({ error: "Analysis failed" });
  }
});

router.get("/darkweb/search", async (req, res) => {
  try {
    const { q, limit } = req.query;
    const results = await darkWebScraper.search(q as string, limit ? parseInt(limit as string) : 50);
    res.json({ results, count: results.length });
  } catch (error) {
    res.status(500).json({ error: "Dark web search failed" });
  }
});

router.get("/darkweb/monitor", async (req, res) => {
  try {
    const sites = req.query.sites ? (req.query.sites as string).split(",") : [];
    const results = await darkWebScraper.monitorOnionSites(sites);
    res.json({ results, count: results.length });
  } catch (error) {
    res.status(500).json({ error: "Monitoring failed" });
  }
});

router.get("/clearweb/search", async (req, res) => {
  try {
    const { q, limit, source } = req.query;
    let results: ScrapedContent[];
    
    if (source) {
      results = await clearWebScraper.scrapeSource(source as string, q as string);
    } else {
      results = await clearWebScraper.searchAll(q as string, limit ? parseInt(limit as string) : 100);
    }
    
    res.json({ results, count: results.length });
  } catch (error) {
    res.status(500).json({ error: "Clear web search failed" });
  }
});

router.get("/bugbounty/programs", async (req, res) => {
  try {
    const { q } = req.query;
    const programs = await bugBountyHunter.searchPrograms(q as string || "bug bounty");
    res.json({ programs, count: programs.length });
  } catch (error) {
    res.status(500).json({ error: "Program search failed" });
  }
});

router.get("/bugbounty/cve/:cveId", async (req, res) => {
  try {
    const cveData = await bugBountyHunter.checkCVE(req.params.cveId);
    res.json({ cve: cveData });
  } catch (error) {
    res.status(500).json({ error: "CVE lookup failed" });
  }
});

router.post("/bugbounty/recon", async (req, res) => {
  try {
    const { target, tool } = req.body;
    const scan = await bugBountyHunter.runRecon(target, tool);
    res.json({ scan });
  } catch (error) {
    res.status(500).json({ error: "Recon failed" });
  }
});

router.get("/bugbounty/recon/:scanId", (req, res) => {
  const scan = bugBountyHunter.getScanResults(req.params.scanId);
  if (scan) {
    res.json({ scan });
  } else {
    res.status(404).json({ error: "Scan not found" });
  }
});

router.get("/sigil7/status", async (_req, res) => {
  const isOnline = await sigil7Container.checkStatus();
  const tools = sigil7Container.getTools();
  res.json({ online: isOnline, tools: tools.length, container: process.env.SIGIL7_CONTAINER || "sigil7" });
});

router.get("/sigil7/tools", (_req, res) => {
  const { category } = _req.query;
  const tools = category 
    ? sigil7Container.getToolsByCategory(category as any)
    : sigil7Container.getTools();
  res.json({ tools });
});

router.post("/sigil7/tool", async (req, res) => {
  try {
    const { toolName, target, args } = req.body;
    const tool = sigil7Container.getTools().find(t => t.name === toolName);
    
    if (!tool) {
      return res.status(404).json({ error: "Tool not found" });
    }

    const result = await sigil7Container.runTool(tool, target, args || []);
    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: "Tool execution failed" });
  }
});

router.post("/sigil7/recon", async (req, res) => {
  try {
    const { target } = req.body;
    const results = await sigil7Container.runFullRecon(target);
    res.json({ results, count: results.length });
  } catch (error) {
    res.status(500).json({ error: "Recon failed" });
  }
});

router.post("/sigil7/vulnscan", async (req, res) => {
  try {
    const { target } = req.body;
    const results = await sigil7Container.runVulnScan(target);
    res.json({ results, count: results.length });
  } catch (error) {
    res.status(500).json({ error: "Vuln scan failed" });
  }
});

router.post("/sigil7/ai", async (req, res) => {
  try {
    const aiRequest: AIRequest = req.body;
    const response = await sigil7Container.runAI(aiRequest);
    res.json({ response });
  } catch (error) {
    res.status(500).json({ error: "AI request failed" });
  }
});

router.post("/sigil7/ai/context", async (req, res) => {
  try {
    const { context, question } = req.body;
    const response = await sigil7Container.runAIWithContext(context, question);
    res.json({ response });
  } catch (error) {
    res.status(500).json({ error: "AI context request failed" });
  }
});

// === Portainer Container Management ===
router.get("/containers", async (_req, res) => {
  try {
    const containers = await portainerService.listContainers();
    res.json({ containers, count: containers.length });
  } catch (error) {
    res.status(500).json({ error: "Failed to list containers" });
  }
});

router.get("/containers/:id", async (req, res) => {
  try {
    const container = await portainerService.getContainer(req.params.id);
    if (container) {
      res.json({ container });
    } else {
      res.status(404).json({ error: "Container not found" });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to get container" });
  }
});

router.post("/containers/:id/start", async (req, res) => {
  try {
    const success = await portainerService.startContainer(req.params.id);
    res.json({ success });
  } catch (error) {
    res.status(500).json({ error: "Failed to start container" });
  }
});

router.post("/containers/:id/stop", async (req, res) => {
  try {
    const success = await portainerService.stopContainer(req.params.id);
    res.json({ success });
  } catch (error) {
    res.status(500).json({ error: "Failed to stop container" });
  }
});

router.post("/containers/:id/restart", async (req, res) => {
  try {
    const success = await portainerService.restartContainer(req.params.id);
    res.json({ success });
  } catch (error) {
    res.status(500).json({ error: "Failed to restart container" });
  }
});

router.delete("/containers/:id", async (req, res) => {
  try {
    const { force } = req.query;
    const success = await portainerService.removeContainer(req.params.id, force === "true");
    res.json({ success });
  } catch (error) {
    res.status(500).json({ error: "Failed to remove container" });
  }
});

router.get("/containers/:id/logs", async (req, res) => {
  try {
    const { lines } = req.query;
    const logs = await portainerService.getContainerLogs(req.params.id, lines ? parseInt(lines as string) : 100);
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: "Failed to get logs" });
  }
});

router.get("/containers/:id/stats", async (req, res) => {
  try {
    const stats = await portainerService.getContainerStats(req.params.id);
    res.json({ stats });
  } catch (error) {
    res.status(500).json({ error: "Failed to get stats" });
  }
});

router.get("/images", async (_req, res) => {
  try {
    const images = await portainerService.listImages();
    res.json({ images, count: images.length });
  } catch (error) {
    res.status(500).json({ error: "Failed to list images" });
  }
});

router.get("/volumes", async (_req, res) => {
  try {
    const volumes = await portainerService.listVolumes();
    res.json({ volumes, count: volumes.length });
  } catch (error) {
    res.status(500).json({ error: "Failed to list volumes" });
  }
});

router.get("/networks", async (_req, res) => {
  try {
    const networks = await portainerService.listNetworks();
    res.json({ networks, count: networks.length });
  } catch (error) {
    res.status(500).json({ error: "Failed to list networks" });
  }
});

router.get("/system", async (_req, res) => {
  try {
    const info = await portainerService.getSystemInfo();
    res.json({ system: info });
  } catch (error) {
    res.status(500).json({ error: "Failed to get system info" });
  }
});

router.post("/containers", async (req, res) => {
  try {
    const containerId = await portainerService.runContainer(req.body);
    if (containerId) {
      res.json({ id: containerId, success: true });
    } else {
      res.status(500).json({ error: "Failed to create container" });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to create container" });
  }
});

router.get("/plugins", async (_req, res) => {
  try {
    const containers = await portainerService.listContainers();
    const plugins = containers.filter(c => 
      c.name.includes("sigil7") || 
      c.name.includes("antenna") || 
      c.name.includes("discord") ||
      c.name.includes("memos") ||
      c.name.includes("ollama")
    );
    res.json({ plugins, count: plugins.length });
  } catch (error) {
    res.status(500).json({ error: "Failed to get plugins" });
  }
});

// === Google Dorks & Camera Scanner ===
router.get("/dorks", async (req, res) => {
  try {
    const { target, category } = req.query;
    if (!target) {
      return res.status(400).json({ error: "Target is required" });
    }
    const dorks = await generateDorks(target as string, category as string);
    res.json({ dorks, count: dorks.length });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate dorks" });
  }
});

router.get("/dorks/execute", async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }
    const results = await executeDorkSearch(query as string);
    res.json({ results, count: results.length });
  } catch (error) {
    res.status(500).json({ error: "Failed to execute dork" });
  }
});

router.get("/cameras", async (req, res) => {
  try {
    const { region } = req.query;
    // Get live cameras + static camera markers
    const cameras = await scanCameras(region as string);
    const markers = await getCameraMarkers();
    res.json({ 
      cameras: [...cameras, ...markers], 
      count: cameras.length + markers.length,
      markers
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to scan cameras" });
  }
});

router.get("/cameras/insecam", async (_req, res) => {
  try {
    const cameras = await scanCameras();
    const insecam = cameras.filter(c => c.source === 'Insecam');
    res.json({ cameras: insecam, count: insecam.length });
  } catch (error) {
    res.status(500).json({ error: "Failed to get Insecam cameras" });
  }
});

router.get("/cameras/traffic", async (_req, res) => {
  try {
    const cameras = await scanCameras();
    const traffic = cameras.filter(c => c.type === 'traffic');
    res.json({ cameras: traffic, count: traffic.length });
  } catch (error) {
    res.status(500).json({ error: "Failed to get traffic cameras" });
  }
});

// === Groq Whisper Audio Transcription ===
router.post("/audio/transcribe", async (req, res) => {
  try {
    const { audioUrl, language, model } = req.body;
    const groqApiKey = process.env.GROQ_API_KEY;
    
    if (!groqApiKey) {
      return res.status(400).json({ error: "GROQ_API_KEY not configured" });
    }
    
    if (!audioUrl) {
      return res.status(400).json({ error: "audioUrl is required" });
    }

    const result = await groqWhisper.transcribeUrl(
      groqApiKey,
      audioUrl,
      {
        model: model || 'whisper-large-v3-turbo',
        language: language || 'en'
      }
    );
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Transcription failed" });
  }
});

// === Obsidian Vault Management ===
router.get("/vault/notes", async (_req, res) => {
  try {
    if (!obsidianVault) {
      return res.status(400).json({ error: "Obsidian vault not configured" });
    }
    const notes = await obsidianVault.getAllNotes();
    res.json({ notes, count: notes.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to get notes" });
  }
});

router.get("/vault/notes/:title", async (req, res) => {
  try {
    if (!obsidianVault) {
      return res.status(400).json({ error: "Obsidian vault not configured" });
    }
    const note = await obsidianVault.readNote(`${req.params.title}.md`);
    if (note) {
      res.json(note);
    } else {
      res.status(404).json({ error: "Note not found" });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to get note" });
  }
});

router.post("/vault/notes", async (req, res) => {
  try {
    if (!obsidianVault) {
      return res.status(400).json({ error: "Obsidian vault not configured" });
    }
    const { title, content, tags } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: "Title and content are required" });
    }
    const note = await obsidianVault.saveNote(title, content, tags);
    res.json(note);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to save note" });
  }
});

router.post("/vault/search", async (req, res) => {
  try {
    if (!obsidianVault) {
      return res.status(400).json({ error: "Obsidian vault not configured" });
    }
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }
    const notes = await obsidianVault.searchNotes(query);
    res.json({ notes, count: notes.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Search failed" });
  }
});

export default router;
