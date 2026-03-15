import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import Globe from "react-globe.gl";
import { saveAs } from "file-saver";
import { io, Socket } from "socket.io-client";
import "./App.css";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConflictEvent {
  id: string;
  lat: number;
  lon: number;
  date: string;
  type: string;
  description: string;
  source?: string;
  category: string;
  endLat?: number;
  endLon?: number;
  entities?: string[];
  relatedEvents?: string[];
  severity?: "low" | "medium" | "high" | "critical";
  country?: string;
  region?: string;
}

interface Workspace {
  id: string;
  name: string;
  createdAt: string;
  viewState: any;
  filters: Record<string, boolean>;
  layers: LayerState;
  bookmarks: Bookmark[];
  alerts?: Alert[];
  timeRange?: [string, string];
  maxPoints?: number;
  pointSize?: number;
  globeTheme?: GlobeTheme;
}

interface Bookmark {
  id: string;
  name: string;
  lat: number;
  lon: number;
  altitude: number;
  createdAt: string;
}

interface Alert {
  id: string;
  name: string;
  criteria: string;
  category?: string;
  region?: string;
  enabled: boolean;
}

interface LayerState {
  showArcs: boolean;
  showHeatmap: boolean;
  showHexBin: boolean;
  showRings: boolean;
  showPolygons: boolean;
  showPaths: boolean;
  showCityBuildings: boolean;
  showCityDensity: boolean;
  showUrbanExtents: boolean;
  showSDR: boolean;
}

type GlobeTheme = "dark" | "light" | "satellite" | "terrain";
type LeftTab = "layers" | "categories" | "filters" | "import" | "settings" | "sdr";
type RightTab = "details" | "analytics" | "entities" | "timeline";
type ReportType = "summary" | "detailed" | "analytics";
type DrawMode = "none" | "circle" | "polygon" | "line";
type TileLayerKey = keyof typeof TILE_LAYERS;

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  conflict: "C", maritime: "M", air: "A", cyber: "X",
  land: "L", space: "S", radio: "R", weather: "W",
  earthquakes: "Q", social: "S", cameras: "O", fire: "F",
};

const CATEGORY_COLORS: Record<string, string> = {
  conflict: "#ef4444", maritime: "#3b82f6", air: "#22c55e", cyber: "#a855f7",
  land: "#f97316", space: "#14b8a6", radio: "#eab308", weather: "#60a5fa",
  earthquakes: "#9333ea", social: "#ec4899", cameras: "#06b6d4", fire: "#ff4500",
};

const SEVERITY_COLORS: Record<string, string> = {
  low: "#22c55e", medium: "#eab308", high: "#f97316", critical: "#ef4444",
};

const GLOBE_IMAGES = {
  dark: "https://unpkg.com/three-globe/example/img/earth-dark.jpg",
  light: "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg",
  satellite: "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg",
  terrain: "https://unpkg.com/three-globe/example/img/earth-topology.png",
};

const TILE_LAYERS = {
  cartodb_dark: { name: "Dark", url: "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png", attribution: "CartoDB" },
  cartodb_light: { name: "Light", url: "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png", attribution: "CartoDB" },
  esri_satellite: { name: "Satellite", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attribution: "Esri" },
  osm: { name: "OSM", url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "OpenStreetMap" },
  stamen_toner: { name: "Toner", url: "https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}.png", attribution: "Stadia Maps" },
};

const QUICK_LOCATIONS = [
  { name: "Ukraine", lat: 48.3794, lon: 31.1656 },
  { name: "Gaza Strip", lat: 31.3547, lon: 34.3088 },
  { name: "Taiwan Strait", lat: 24.0, lon: 119.5 },
  { name: "South China Sea", lat: 16.0, lon: 115.0 },
  { name: "Persian Gulf", lat: 26.0, lon: 52.0 },
  { name: "Red Sea", lat: 20.0, lon: 38.0 },
  { name: "Baltic Sea", lat: 55.0, lon: 14.0 },
  { name: "Mediterranean", lat: 35.0, lon: 18.0 },
  { name: "Russia", lat: 55.7558, lon: 37.6173 },
  { name: "Iran", lat: 35.6892, lon: 51.389 },
  { name: "North Korea", lat: 39.0392, lon: 125.7625 },
  { name: "Israel", lat: 31.7683, lon: 35.2137 },
];

const NIGHT_SKY = "https://unpkg.com/three-globe/example/img/night-sky.png";

// ─── Utility ──────────────────────────────────────────────────────────────────

function cls(...args: (string | false | undefined | null)[]): string {
  return args.filter(Boolean).join(" ");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="section-label">{children}</div>;
}

function CheckRow({ checked, onChange, icon, label }: { checked: boolean; onChange: (v: boolean) => void; icon: string; label: string }) {
  return (
    <label className="check-row">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="check-icon">{icon}</span>
      <span>{label}</span>
    </label>
  );
}

function EmptyState({ icon, text, sub }: { icon: string; text: string; sub?: string }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <div className="empty-text">{text}</div>
      {sub && <div className="empty-sub">{sub}</div>}
    </div>
  );
}

function FloatPanel({ title, onClose, children, style }: { title: string; onClose: () => void; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="float-panel" style={style}>
      <div className="float-header">
        <span className="float-title">{title}</span>
        <button className="float-close" onClick={onClose}>X</button>
      </div>
      <div className="float-body">{children}</div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const globeEl = useRef<any>(null);
  const socketRef = useRef<Socket | null>(null);

  // Data
  const [events, setEvents] = useState<ConflictEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Globe settings
  const [globeTheme, setGlobeTheme] = useState<GlobeTheme>("dark");
  const [showAtmosphere, setShowAtmosphere] = useState(true);
  const [showGraticules, setShowGraticules] = useState(false);
  const [showClouds, setShowClouds] = useState(false);
  const [globeRotation, setGlobeRotation] = useState(true);
  const [showTerrain, setShowTerrain] = useState(false);
  const [showCameras, setShowCameras] = useState(true);
  const [pointSize, setPointSize] = useState(10);
  const [pointQuality, setPointQuality] = useState<"low" | "medium" | "high">("medium");
  const [enableClustering, setEnableClustering] = useState(true);
  const [maxPoints, setMaxPoints] = useState(2000);
  const [tileLayer, setTileLayer] = useState<TileLayerKey>("cartodb_dark");
  const [useTiles, setUseTiles] = useState(true);

  // Layers
  const [layers, setLayers] = useState<LayerState>({
    showArcs: false, showHeatmap: false, showHexBin: false,
    showRings: false, showPolygons: false, showPaths: false,
    showCityBuildings: false, showCityDensity: false, showUrbanExtents: false, showSDR: false,
  });
  const setLayer = (key: keyof LayerState, val: boolean) => setLayers(l => ({ ...l, [key]: val }));

  // Filters
  const [filters, setFilters] = useState<Record<string, boolean>>({
    conflict: true, maritime: true, air: true, cyber: true,
    land: true, space: true, radio: true, weather: true,
    earthquakes: true, social: true, cameras: true,
  });
  const [severityFilters, setSeverityFilters] = useState<Record<string, boolean>>({
    low: true, medium: true, high: true, critical: true,
  });
  const [customFilter, setCustomFilter] = useState("");
  const [booleanFilter, setBooleanFilter] = useState<"AND" | "OR">("AND");
  const [timeRange, setTimeRange] = useState<[Date, Date]>([
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    new Date(Date.now() + 24 * 60 * 60 * 1000), // +1 day to catch live events
  ]);
  // Keep timeRange end moving forward so live events always show
  useEffect(() => {
    const tick = setInterval(() => {
      setTimeRange(prev => [prev[0], new Date(Date.now() + 24 * 60 * 60 * 1000)]);
    }, 60_000);
    return () => clearInterval(tick);
  }, []);

  // UI state
  const [activeLeftTab, setActiveLeftTab] = useState<LeftTab>("layers");
  const [activeRightTab, setActiveRightTab] = useState<RightTab>("details");
  const [selectedEvent, setSelectedEvent] = useState<ConflictEvent | null>(null);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [showBottomPanel, setShowBottomPanel] = useState(false);
  const [roomInput, setRoomInput] = useState("");
  
  // Floating panel positions (for draggable panels)
  const [sdrPosition, setSdrPosition] = useState({ x: 440, y: 90 });
  const [antennaPosition, setAntennaPosition] = useState({ x: 860, y: 90 });
  const [analyticsPosition, setAnalyticsPosition] = useState({ x: 20, y: 620 });
  const [liveFeedPosition, setLiveFeedPosition] = useState({ x: 440, y: 620 });
  
  // Dragging state
  const [draggingPanel, setDraggingPanel] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [panelStartPos, setPanelStartPos] = useState({ x: 0, y: 0 });
  
  const handleDragStart = (panelId: string, e: React.MouseEvent) => {
    e.preventDefault();
    setDraggingPanel(panelId);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    
    // Get current position based on panel
    if (panelId === 'sdr') setPanelStartPos(sdrPosition);
    else if (panelId === 'antenna') setPanelStartPos(antennaPosition);
    else if (panelId === 'analytics') setPanelStartPos(analyticsPosition);
    else if (panelId === 'liveFeed') setPanelStartPos(liveFeedPosition);
  };
  
  useEffect(() => {
    if (!draggingPanel) return;
    
    const handleDragMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartPos.x;
      const dy = e.clientY - dragStartPos.y;
      const newX = panelStartPos.x + dx;
      const newY = panelStartPos.y + dy;
      
      // Boundary checks
      const boundedX = Math.max(0, Math.min(window.innerWidth - 400, newX));
      const boundedY = Math.max(50, Math.min(window.innerHeight - 600, newY));
      
      if (draggingPanel === 'sdr') setSdrPosition({ x: boundedX, y: boundedY });
      else if (draggingPanel === 'antenna') setAntennaPosition({ x: boundedX, y: boundedY });
      else if (draggingPanel === 'analytics') setAnalyticsPosition({ x: boundedX, y: boundedY });
      else if (draggingPanel === 'liveFeed') setLiveFeedPosition({ x: boundedX, y: boundedY });
    };
    
    const handleDragEnd = () => {
      setDraggingPanel(null);
    };
    
    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
    
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
    };
  }, [draggingPanel, dragStartPos, panelStartPos]);
  
  // Antenna Agent Chat state (handles all AI)
  const [antennaChatInput, setAntennaChatInput] = useState("");
  const [antennaChatMessages, setAntennaChatMessages] = useState<{role: string, content: string}[]>([]);
  const [antennaChatLoading, setAntennaChatLoading] = useState(false);
  
  // AI Chat state (Agent/Antenna chat)
  const [aiChatInput, setAIChatInput] = useState("");
  const [aiChatMessages, setAIChatMessages] = useState<{role: string, content: string}[]>([]);
  const [aiChatLoading, setAIChatLoading] = useState(false);
  
  // SDR Radio state
  const [sdrSignals, setSdrSignals] = useState<any[]>([]);
  const [selectedSdrSignal, setSelectedSdrSignal] = useState<any>(null);
  const [sdrFrequency, setSdrFrequency] = useState(11000);
  const [sdrMode, setSdrMode] = useState("USB");
  const [sdrBandwidth, setSdrBandwidth] = useState(2400);
  const [drawMode, setDrawMode] = useState<"none" | "circle" | "polygon" | "line">("none");

  // Graph/Visualization Panel
  const [showGraphPanel, setShowGraphPanel] = useState(false);
  const [graphType, setGraphType] = useState<"arcs"|"heatmap"|"clusters"|"rings"|"paths">("arcs");

  // Intelligence Panel - All OSINT Tools
  const [showIntelligencePanel, setShowIntelligencePanel] = useState(false);
  const [intelligenceTab, setIntelligenceTab] = useState<"bounty"|"research"|"patterns"|"threats"|"pentest"|"reports">("threats");
  const [intelligenceQuery, setIntelligenceQuery] = useState("");
  const [intelligenceResults, setIntelligenceResults] = useState<any[]>([]);
  const [intelligenceLoading, setIntelligenceLoading] = useState(false);
  const [patterns, setPatterns] = useState<any[]>([]);
  const [plugins, setPlugins] = useState<any[]>([]);

  // Live feed
  const [liveFeedItems, setLiveFeedItems] = useState<{ id: string; time: Date; message: string; type: string; severity: string }[]>([]);

  // Camera Viewer
  const [cameraViewer, setCameraViewer] = useState<{ event: ConflictEvent; url: string } | null>(null);
  
  // Camera markers on globe
  const [cameraMarkers, setCameraMarkers] = useState<any[]>([]);

  // Threat
  const [threatScore, setThreatScore] = useState(0);
  const [threatLevel, setThreatLevel] = useState<"low" | "medium" | "high" | "critical">("low");

  // Bookmarks, Alerts, Workspaces (for localStorage)
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);

  // Timeline playback
  const [isPlaying, setIsPlaying] = useState(false);
  const [timelinePosition, setTimelinePosition] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Voice commands
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [transcript, setTranscript] = useState("");

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Workspace
  const [currentWorkspace, setCurrentWorkspace] = useState<string | null>(null);

  // Collaboration
  const [collaborationRoom, setCollaborationRoom] = useState<string | null>(null);
  const [collaborators, setCollaborators] = useState<{id: string; username: string; color: string; lat?: number; lng?: number}[]>([]);
  const [username, setUsername] = useState("User-" + Math.random().toString(36).substring(2, 6));

  // Drawings
  const [drawnShapes, setDrawnShapes] = useState<any[]>([]);

  // Handle enter key for search
  const [handleEnter, setHandleEnter] = useState<() => void>(() => () => {});

  // Report
  const [reportType, setReportType] = useState<ReportType>("summary");

  // API Keys
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});

  // Analytics
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Entity Graph
  const [showEntityGraph, setShowEntityGraph] = useState(false);

  // Time Machine
  const [showTimeMachine, setShowTimeMachine] = useState(false);
  const [historicalDate, setHistoricalDate] = useState<Date>(new Date());
  const [timeLapseMode, setTimeLapseMode] = useState(false);

  // UI Panels
  const [showCollaborators, setShowCollaborators] = useState(false);
  const [showReportPanel, setShowReportPanel] = useState(false);
  const [showLiveFeed, setShowLiveFeed] = useState(false);
  const [showDrawTools, setShowDrawTools] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Hover state
  const [hoveredEvent, setHoveredEvent] = useState<ConflictEvent | null>(null);

  // Dedicated SDR Panel
  const [showSDRPanel, setShowSDRPanel] = useState(false);

  // Dedicated Antenna Agent Panel (handles AI + SDR analysis)
  const [showAntennaPanel, setShowAntennaPanel] = useState(false);

  // OSINT Tools Panel
  const [showOSINTPanel, setShowOSINTPanel] = useState(false);
  const [osintQuery, setOsintQuery] = useState("");
  const [osintResults, setOsintResults] = useState<any[]>([]);
  const [osintLoading, setOsintLoading] = useState(false);

  // Camera Viewer Panel
  const [showCameraPanel, setShowCameraPanel] = useState(false);
  const [cameraResults, setCameraResults] = useState<any[]>([]);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState<any>(null);
  const [dorkQuery, setDorkQuery] = useState("");
  const [dorkResults, setDorkResults] = useState<any[]>([]);


  // ── Data loading ──
  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/conflicts");
      const data = await res.json();
      const evts = data.events || [];
      setEvents(evts);
      checkAlerts(evts);
      // Load camera markers
      loadCameraMarkers();
    } catch (e) {
      console.error("Failed to load data:", e);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line

  useEffect(() => { loadData(); }, [loadData]);

  // ── Camera markers on globe ──
  const loadCameraMarkers = async () => {
    try {
      const res = await fetch("/api/intelligence/cameras");
      const data = await res.json();
      const markers = (data.cameras || []).map((cam: any, i: number) => ({
        id: `cam-${i}`,
        lat: 30 + Math.random() * 20, // Random lat for demo (would use geolocation in production)
        lon: -120 + Math.random() * 60, // Random lon for demo
        size: 4,
        color: cam.type === 'traffic' ? '#ec4899' : '#8b5cf6',
        icon: '▲',
        title: cam.title || cam.source,
        data: cam
      }));
      setCameraMarkers(markers);
    } catch (e) {
      console.error("Failed to load camera markers:", e);
    }
  };

  // ── SDR Radio functions ──
  const loadSDRSignals = useCallback(async () => {
    try {
      const res = await fetch("/api/radio");
      const data = await res.json();
      setSdrSignals(data.events || []);
    } catch (e) {
      console.error("Failed to load SDR signals:", e);
    }
  }, []);

  useEffect(() => { loadSDRSignals(); }, [loadSDRSignals]);

  // ── Antenna Agent Chat functions (handles all AI) ──
  const sendAntennaMessage = async (message: string) => {
    if (!message.trim()) return;
    
    setAntennaChatLoading(true);
    setAntennaChatMessages(prev => [...prev, { role: "user", content: message }]);
    
    try {
      const antennaGateway = process.env.ANTENNA_GATEWAY_URL || "http://localhost:18790";
      const response = await fetch(`${antennaGateway}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message })
      });
      
      const data = await response.json();
      setAntennaChatMessages(prev => [...prev, { role: "assistant", content: data.response || data.message || "No response" }]);
    } catch (error) {
      console.error("Antenna agent chat error:", error);
      setAntennaChatMessages(prev => [...prev, { role: "assistant", content: "Could not connect to Antenna agent. Ensure it's running on port 18790." }]);
    } finally {
      setAntennaChatLoading(false);
    }
  };

  // ── OSINT Search functions ──
  const runOSINTSearch = async (query: string) => {
    if (!query.trim()) return;
    setOsintLoading(true);
    setOsintResults([]);
    
    try {
      const results: any[] = [];
      
      // Check local data for matching events
      const matchingEvents = events.filter(e => 
        e.type?.toLowerCase().includes(query.toLowerCase()) ||
        e.description?.toLowerCase().includes(query.toLowerCase()) ||
        e.id?.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 5);
      
      if (matchingEvents.length > 0) {
        results.push({
          source: "Conflict Globe Database",
          description: `Found ${matchingEvents.length} matching events in local OSINT data`,
          severity: "low",
          data: matchingEvents.map(e => ({ type: e.type, location: `${e.lat?.toFixed(2)}, ${e.lon?.toFixed(2)}`, source: e.source }))
        });
      }
      
      // Query Shodan-like endpoint if available
      try {
        const response = await fetch(`/api/cyber?search=${encodeURIComponent(query)}`);
        const data = await response.json();
        if (data.events?.length > 0) {
          results.push({
            source: "Cyber Threat Intel",
            description: `Found ${data.events.length} cyber threat events`,
            severity: "high",
            data: data.events.slice(0, 3).map((e: any) => ({ type: e.type, description: e.description?.substring(0, 100) }))
          });
        }
      } catch {}
      
      // Add placeholder for external OSINT results
      if (results.length === 0) {
        results.push({
          source: "External OSINT",
          description: `Search query: "${query}"`,
          severity: "low",
          data: { query, note: "Use quick tools below to search external databases" }
        });
      }
      
      setOsintResults(results);
    } catch (error) {
      console.error("OSINT search error:", error);
    } finally {
      setOsintLoading(false);
    }
  };

  // ── Camera Scanner Functions ──
  const loadCameras = async (type: string) => {
    setCameraLoading(true);
    setCameraResults([]);
    try {
      const endpoint = type === 'insecam' ? '/api/intelligence/cameras/insecam' 
        : type === 'traffic' ? '/api/intelligence/cameras/traffic'
        : '/api/intelligence/cameras';
      const res = await fetch(endpoint);
      const data = await res.json();
      setCameraResults(data.cameras || []);
    } catch (error) {
      console.error("Camera load error:", error);
      setCameraResults([{ source: 'Demo', title: 'Traffic Cam 1', url: 'https://www.trafficland.com/', type: 'traffic' }]);
    } finally {
      setCameraLoading(false);
    }
  };

  const generateDorks = async (target: string) => {
    setCameraLoading(true);
    setDorkResults([]);
    try {
      const res = await fetch(`/api/intelligence/dorks?target=${encodeURIComponent(target)}`);
      const data = await res.json();
      setDorkResults(data.dorks || []);
    } catch (error) {
      console.error("Dork generation error:", error);
    } finally {
      setCameraLoading(false);
    }
  };

  const executeDork = async (query: string) => {
    setCameraLoading(true);
    try {
      const res = await fetch(`/api/intelligence/dorks/execute?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      setDorkResults(data.results || []);
    } catch (error) {
      console.error("Dork execution error:", error);
    } finally {
      setCameraLoading(false);
    }
  };

  // ── Intelligence Panel Functions ──
  const runIntelligenceSearch = async () => {
    if (!intelligenceQuery.trim()) return;
    setIntelligenceLoading(true);
    setIntelligenceResults([]);
    
    try {
      const response = await fetch(`/api/intelligence/patterns?q=${encodeURIComponent(intelligenceQuery)}`);
      const data = await response.json();
      setIntelligenceResults(data.pattern || []);
    } catch (error) {
      console.error("Intelligence search error:", error);
    } finally {
      setIntelligenceLoading(false);
    }
  };

  const loadPatterns = async () => {
    setIntelligenceLoading(true);
    try {
      const response = await fetch("/api/intelligence/patterns");
      const data = await response.json();
      setPatterns(data.patterns || []);
      setIntelligenceResults(data.patterns?.slice(0, 10).map((p: any) => ({
        title: p.name,
        description: p.description,
        severity: p.threatLevel,
        data: { confidence: p.confidence, type: p.type, indicators: p.indicators }
      })) || []);
    } catch (error) {
      console.error("Load patterns error:", error);
    } finally {
      setIntelligenceLoading(false);
    }
  };

  const loadPlugins = async () => {
    setIntelligenceLoading(true);
    try {
      const response = await fetch("/api/intelligence/plugins");
      const data = await response.json();
      setPlugins(data.plugins || []);
      setIntelligenceResults(data.plugins?.map((p: any) => ({
        title: p.name,
        description: `${p.image} - ${p.status}`,
        severity: p.state === "running" ? "low" : "medium",
        data: p
      })) || []);
    } catch (error) {
      console.error("Load plugins error:", error);
    } finally {
      setIntelligenceLoading(false);
    }
  };

  const runBugBountySearch = async () => {
    if (!intelligenceQuery.trim()) return;
    setIntelligenceLoading(true);
    try {
      const response = await fetch(`/api/intelligence/bugbounty/programs?q=${encodeURIComponent(intelligenceQuery)}`);
      const data = await response.json();
      setIntelligenceResults(data.programs?.slice(0, 10).map((p: any) => ({
        title: p.name,
        description: `${p.platform} - Bounty: $${p.bounty}`,
        severity: p.bounty > 10000 ? "high" : "medium",
        data: p
      })) || []);
    } catch (error) {
      console.error("Bug bounty search error:", error);
    } finally {
      setIntelligenceLoading(false);
    }
  };

  const runCVELookup = async () => {
    if (!intelligenceQuery.trim()) return;
    setIntelligenceLoading(true);
    try {
      const cveId = intelligenceQuery.toUpperCase().includes("CVE") ? intelligenceQuery : `CVE-${intelligenceQuery}`;
      const response = await fetch(`/api/intelligence/bugbounty/cve/${cveId}`);
      const data = await response.json();
      setIntelligenceResults([{
        title: cveId,
        description: data.cve ? "Found in NVD" : "Not found",
        severity: "high",
        data: data.cve
      }]);
    } catch (error) {
      console.error("CVE lookup error:", error);
    } finally {
      setIntelligenceLoading(false);
    }
  };

  const analyzePatterns = async () => {
    setIntelligenceLoading(true);
    try {
      const response = await fetch("/api/intelligence/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: events })
      });
      const data = await response.json();
      setIntelligenceResults(data.patterns?.slice(0, 10).map((p: any) => ({
        title: p.name,
        description: p.description,
        severity: p.threatLevel,
        data: { confidence: p.confidence, type: p.type, events: p.events?.length }
      })) || []);
    } catch (error) {
      console.error("Analyze patterns error:", error);
    } finally {
      setIntelligenceLoading(false);
    }
  };

  const runDarkWebSearch = async () => {
    if (!intelligenceQuery.trim()) return;
    setIntelligenceLoading(true);
    try {
      const response = await fetch(`/api/intelligence/darkweb/search?q=${encodeURIComponent(intelligenceQuery)}`);
      const data = await response.json();
      setIntelligenceResults(data.results?.slice(0, 10).map((r: any) => ({
        title: r.title,
        description: r.snippet,
        severity: r.threatLevel,
        data: r
      })) || []);
    } catch (error) {
      console.error("Dark web search error:", error);
    } finally {
      setIntelligenceLoading(false);
    }
  };

  const runClearWebSearch = async () => {
    if (!intelligenceQuery.trim()) return;
    setIntelligenceLoading(true);
    try {
      const response = await fetch(`/api/intelligence/clearweb/search?q=${encodeURIComponent(intelligenceQuery)}`);
      const data = await response.json();
      setIntelligenceResults(data.results?.slice(0, 10).map((r: any) => ({
        title: r.title,
        description: r.content?.substring(0, 150),
        severity: "low",
        data: r
      })) || []);
    } catch (error) {
      console.error("Clear web search error:", error);
    } finally {
      setIntelligenceLoading(false);
    }
  };

  const runRecon = async () => {
    if (!intelligenceQuery.trim()) return;
    setIntelligenceLoading(true);
    try {
      const response = await fetch("/api/intelligence/sigil7/recon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: intelligenceQuery })
      });
      const data = await response.json();
      setIntelligenceResults(data.results?.map((r: any) => ({
        title: `${r.tool} on ${r.target}`,
        description: `Status: ${r.status}`,
        severity: r.status === "failed" ? "medium" : "low",
        data: { output: r.output?.substring(0, 500), findings: r.findings }
      })) || [{ title: "Container offline", description: "Sigil7 container not running", severity: "medium" }]);
    } catch (error) {
      console.error("Recon error:", error);
    } finally {
      setIntelligenceLoading(false);
    }
  };

  const runVulnScan = async () => {
    if (!intelligenceQuery.trim()) return;
    setIntelligenceLoading(true);
    try {
      const response = await fetch("/api/intelligence/sigil7/vulnscan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: intelligenceQuery })
      });
      const data = await response.json();
      setIntelligenceResults(data.results?.map((r: any) => ({
        title: `${r.tool} - ${r.target}`,
        description: `Findings: ${r.findings?.length || 0}`,
        severity: r.findings?.length > 0 ? "high" : "low",
        data: r
      })) || [{ title: "Container offline", description: "Sigil7 container not running", severity: "medium" }]);
    } catch (error) {
      console.error("Vuln scan error:", error);
    } finally {
      setIntelligenceLoading(false);
    }
  };

  const runPentestAI = async () => {
    if (!intelligenceQuery.trim()) return;
    setIntelligenceLoading(true);
    try {
      const response = await fetch("/api/intelligence/sigil7/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: `Analyze this target for vulnerabilities: ${intelligenceQuery}` })
      });
      const data = await response.json();
      setIntelligenceResults([{
        title: "AI Analysis",
        description: data.response?.response?.substring(0, 500) || "No response",
        severity: "medium",
        data: data.response
      }]);
    } catch (error) {
      console.error("AI analysis error:", error);
    } finally {
      setIntelligenceLoading(false);
    }
  };

  const runTool = async (toolName: string) => {
    if (!intelligenceQuery.trim()) {
      setIntelligenceQuery(toolName);
      return;
    }
    setIntelligenceLoading(true);
    try {
      const response = await fetch("/api/intelligence/sigil7/tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolName, target: intelligenceQuery })
      });
      const data = await response.json();
      setIntelligenceResults([{
        title: `${toolName} results`,
        description: data.result?.output?.substring(0, 300) || "No output",
        severity: "low",
        data: data.result
      }]);
    } catch (error) {
      console.error("Tool error:", error);
    } finally {
      setIntelligenceLoading(false);
    }
  };

  const filterPattern = (type: string) => {
    const filtered = patterns.filter(p => p.type === type);
    setIntelligenceResults(filtered.map(p => ({
      title: p.name,
      description: p.description,
      severity: p.threatLevel,
      data: { confidence: p.confidence }
    })));
  };

  const exportReport = (format: string) => {
    const data = { events, patterns, plugins, exported: new Date().toISOString() };
    let content = "";
    let mime = "text/plain";
    let ext = "txt";
    
    if (format === "json") {
      content = JSON.stringify(data, null, 2);
      mime = "application/json";
      ext = "json";
    } else if (format === "csv") {
      content = "id,type,category,severity,date,source\n";
      events.forEach(e => {
        content += `${e.id},${e.type},${e.category},${e.severity},${e.date},${e.source}\n`;
      });
      mime = "text/csv";
      ext = "csv";
    } else if (format === "ioc") {
      content = "Indicator,Type,Source\n";
      events.forEach(e => {
        if (e.description) {
          const ips = e.description.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g);
          ips?.forEach(ip => content += `${ip},IP,${e.source}\n`);
        }
      });
      mime = "text/plain";
      ext = "ioc";
    }
    
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `intelligence-report.${ext}`;
    a.click();
  };

  // ── LocalStorage ──
  useEffect(() => {
    try {
      const b = localStorage.getItem("cg_bookmarks"); if (b) setBookmarks(JSON.parse(b));
      const a = localStorage.getItem("cg_alerts"); if (a) setAlerts(JSON.parse(a));
      const w = localStorage.getItem("cg_workspaces"); if (w) setWorkspaces(JSON.parse(w));
    } catch {}
  }, []);
  useEffect(() => { localStorage.setItem("cg_bookmarks", JSON.stringify(bookmarks)); }, [bookmarks]);
  useEffect(() => { localStorage.setItem("cg_alerts", JSON.stringify(alerts)); }, [alerts]);
  useEffect(() => { localStorage.setItem("cg_workspaces", JSON.stringify(workspaces)); }, [workspaces]);

  // ── Antenna Chat auto-scroll ──
  useEffect(() => {
    const container = document.getElementById("antenna-chat-messages");
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [antennaChatMessages]);

  // ── Mobile detection ──
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Auto-refresh ──
  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(loadData, refreshInterval * 1000);
    return () => clearInterval(t);
  }, [autoRefresh, refreshInterval, loadData]);

  // ── WebSocket ──
  useEffect(() => {
    const socket = io(window.location.origin, { transports: ["websocket", "polling"], reconnectionAttempts: 3 });
    socket.on("conflicts:update", (data: { events: ConflictEvent[] }) => {
      setEvents(data.events || []); setLoading(false);
    });
    socket.on("collab:update", (data: { collaborators: typeof collaborators }) => {
      setCollaborators(data.collaborators.filter((c: any) => c.id !== socket.id));
    });
    socket.on("collab:cursor", (data: { id: string; lat: number; lng: number; color?: string }) => {
      setCollaborators(prev => prev.map(c => c.id === data.id ? { ...c, lat: data.lat, lng: data.lng } : c));
    });
    socket.on("collab:draw", (data: { id: string; shapes: any[] }) => {
      setDrawnShapes(data.shapes);
    });
    socket.on("collab:focus", (data: { id: string; lat: number; lng: number; zoom: number }) => {
      if (globeEl.current) {
        (globeEl.current as any).pointOfView({ lat: data.lat, lng: data.lng, altitude: data.zoom }, 1000);
      }
    });
    socket.on("collab:annotation", (data: { id: string; annotation: any }) => {
      setDrawnShapes(prev => {
        const exists = prev.find(s => s.id === data.annotation.id);
        if (exists) return prev.map(s => s.id === data.annotation.id ? data.annotation : s);
        return [...prev, data.annotation];
      });
    });
    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, []); // eslint-disable-line

  // ── Timeline playback ──
  useEffect(() => {
    if (!isPlaying) return;
    const t = setInterval(() => {
      setTimelinePosition(p => {
        if (p >= 100) { setIsPlaying(false); return 100; }
        return Math.min(100, p + playbackSpeed);
      });
    }, 100);
    return () => clearInterval(t);
  }, [isPlaying, playbackSpeed]);

  // ── Globe auto-rotate ──
  useEffect(() => {
    if (!globeRotation || !globeEl.current) return;
    const globe = globeEl.current;
    let id: number;
    const rotate = () => {
      const pov = globe.pointOfView();
      if (pov) globe.pointOfView({ lng: (pov.lng || 0) + 0.1 }, 0);
      id = requestAnimationFrame(rotate);
    };
    rotate();
    return () => cancelAnimationFrame(id);
  }, [globeRotation]);

  // ── Fly to selected event ──
  useEffect(() => {
    if (selectedEvent && globeEl.current && selectedEvent.lat !== 0) {
      globeEl.current.pointOfView({ lat: selectedEvent.lat, lng: selectedEvent.lon, altitude: 1.5 }, 1000);
    }
  }, [selectedEvent]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "r" || e.key === "R") loadData();
      if (e.key === "h" || e.key === "H") setGlobeTheme(t => t === "dark" ? "light" : "dark");
      if (e.key === " ") { e.preventDefault(); setIsPlaying(p => !p); }
      if (e.key === "Escape") setSelectedEvent(null);
      if (e.key === "1") setShowLeftPanel(p => !p);
      if (e.key === "2") setShowRightPanel(p => !p);
      if (e.key === "3") setShowBottomPanel(p => !p);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [loadData]);

  // ── Voice commands ──
  useEffect(() => {
    if (!voiceEnabled) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Voice recognition not supported"); setVoiceEnabled(false); return; }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      const t = Array.from(e.results).map((r: any) => r[0].transcript).join("");
      setTranscript(t);
      const l = t.toLowerCase();
      if (l.includes("go to") || l.includes("fly to")) {
        const loc = QUICK_LOCATIONS.find(x => l.includes(x.name.toLowerCase()));
        if (loc) focusLocation(loc.lat, loc.lon, 2);
      }
      if (l.includes("zoom in")) {
        const pov = globeEl.current?.pointOfView();
        if (pov) globeEl.current.pointOfView({ ...pov, altitude: pov.altitude * 0.5 }, 500);
      }
      if (l.includes("zoom out")) {
        const pov = globeEl.current?.pointOfView();
        if (pov) globeEl.current.pointOfView({ ...pov, altitude: pov.altitude * 2 }, 500);
      }
      if (l.includes("refresh")) loadData();
      if (l.includes("dark mode")) setGlobeTheme("dark");
      if (l.includes("light mode")) setGlobeTheme("light");
    };
    rec.start();
    return () => rec.stop();
  }, [voiceEnabled]);

  // ── AI Chat handling ──
  useEffect(() => {
    const input = document.getElementById("ai-chat-input");
    const sendBtn = document.getElementById("ai-chat-send");
    
    const handleSend = async () => {
      const message = aiChatInput.trim();
      if (!message) return;
      
      setAIChatLoading(true);
      setAIChatInput("");
      
      // Add user message to chat
      setAIChatMessages(prev => [...prev, { role: "user", content: message }]);
      
      try {
        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            message,
            history: aiChatMessages
          })
        });
        
        const data = await response.json();
        if (data.response) {
          setAIChatMessages(prev => [...prev, { role: "assistant", content: data.response }]);
        }
      } catch (error) {
        console.error("AI chat error:", error);
        setAIChatMessages(prev => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
      } finally {
        setAIChatLoading(false);
      }
    };
    
    if (sendBtn) {
      sendBtn.removeEventListener("click", handleSend);
      sendBtn.addEventListener("click", handleSend);
    }
    
    if (input) {
      input.removeEventListener("keypress", handleEnter);
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleSend();
        }
      });
    }
    
    return () => {
      if (sendBtn) sendBtn.removeEventListener("click", handleSend);
      if (input) input.removeEventListener("keypress", handleEnter);
    };
  }, [aiChatInput, aiChatMessages]); // eslint-disable-line

  // ── Helpers ──
  const checkAlerts = useCallback((currentEvents: ConflictEvent[]) => {
    alerts.filter(a => a.enabled).forEach(alert => {
      const matches = currentEvents.filter(e => {
        if (alert.category && e.category !== alert.category) return false;
        if (alert.region && !e.description?.toLowerCase().includes(alert.region.toLowerCase())) return false;
        return true;
      });
      if (matches.length > 0 && Notification.permission === "granted") {
        new Notification(`Conflict Globe: ${alert.name}`, { body: `${matches.length} events match` });
      }
    });
  }, [alerts]);

  const focusLocation = useCallback((lat: number, lon: number, altitude = 1.5) => {
    globeEl.current?.pointOfView({ lat, lng: lon, altitude }, 1000);
  }, []);

  const exportGeoJSON = () => {
    const geojson = {
      type: "FeatureCollection",
      features: validEvents.map(e => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [e.lon, e.lat] },
        properties: { ...e },
      })),
    };
    saveAs(new Blob([JSON.stringify(geojson, null, 2)], { type: "application/geo+json" }), "conflict-globe.geojson");
  };

  const exportKML = () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Conflict Globe</name>${validEvents.map(e => `<Placemark><name>${e.type}</name><description><![CDATA[${e.description || ""}]]></description><Point><coordinates>${e.lon},${e.lat},0</coordinates></Point></Placemark>`).join("")}</Document></kml>`;
    saveAs(new Blob([kml], { type: "application/vnd.google-earth.kml+xml" }), "conflict-globe.kml");
  };

  const exportCSV = () => {
    const rows = [["ID","Type","Category","Date","Lat","Lon","Severity","Source","Description"],
      ...validEvents.map(e => [e.id,e.type,e.category,e.date,e.lat,e.lon,e.severity||"",e.source||"",e.description||""])];
    saveAs(new Blob([rows.map(r => r.map(String).join(",")).join("\n")], { type: "text/csv" }), "conflict-globe.csv");
  };

  const saveWorkspace = () => {
    const name = prompt("Workspace name:");
    if (!name) return;
    const ws: Workspace = {
      id: Date.now().toString(), name, createdAt: new Date().toISOString(),
      viewState: globeEl.current?.pointOfView(), filters, layers, bookmarks,
      timeRange: [timeRange[0].toISOString(), timeRange[1].toISOString()],
      maxPoints, pointSize, globeTheme,
    };
    setWorkspaces(w => [...w, ws]);
    setCurrentWorkspace(ws.id);
  };

  const loadWorkspace = (id: string) => {
    const ws = workspaces.find(w => w.id === id);
    if (!ws) return;
    setFilters(ws.filters);
    setLayers(ws.layers);
    if (ws.maxPoints) setMaxPoints(ws.maxPoints);
    if (ws.pointSize) setPointSize(ws.pointSize);
    if (ws.globeTheme) setGlobeTheme(ws.globeTheme);
    if (ws.viewState) globeEl.current?.pointOfView(ws.viewState, 1000);
    setCurrentWorkspace(ws.id);
  };

  const deleteWorkspace = (id: string) => {
    setWorkspaces(w => w.filter(x => x.id !== id));
    if (currentWorkspace === id) setCurrentWorkspace(null);
  };

  const shareWorkspace = (ws: Workspace) => {
    const url = `${window.location.origin}?ws=${btoa(JSON.stringify({ filters: ws.filters, layers: ws.layers, globeTheme: ws.globeTheme }))}`;
    navigator.clipboard.writeText(url);
    alert("Workspace URL copied!");
  };

  const exportWorkspace = (ws: Workspace) => {
    saveAs(new Blob([JSON.stringify(ws, null, 2)], { type: "application/json" }), `${ws.name.replace(/\s+/g, "_")}.json`);
  };

  const importWorkspace = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const ws = JSON.parse(ev.target?.result as string);
        if (ws.name && ws.filters) {
          setWorkspaces(w => [...w, { ...ws, id: Date.now().toString(), createdAt: new Date().toISOString() }]);
          alert(`Imported "${ws.name}"`);
        }
      } catch { alert("Invalid workspace file"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        let imported: ConflictEvent[] = [];
        if (file.name.endsWith(".json") || file.name.endsWith(".geojson")) {
          const data = JSON.parse(ev.target?.result as string);
          if (data.features) {
            imported = data.features.map((f: any) => ({
              id: f.id || String(Date.now()),
              lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0],
              date: f.properties?.date || new Date().toISOString(),
              type: f.properties?.type || "Imported",
              description: f.properties?.description || "",
              source: "Import", category: f.properties?.category || "conflict",
            }));
          } else if (Array.isArray(data)) { imported = data; }
        } else if (file.name.endsWith(".csv")) {
          const lines = (ev.target?.result as string).split("\n");
          for (let i = 1; i < lines.length; i++) {
            const v = lines[i].split(",");
            if (v.length >= 3) {
              imported.push({ id: String(Date.now() + i), lat: parseFloat(v[0]), lon: parseFloat(v[1]), date: v[2] || new Date().toISOString(), type: v[3] || "Imported", description: v[4] || "", source: "CSV", category: v[5] || "conflict" });
            }
          }
        }
        setEvents(ev2 => [...ev2, ...imported]);
        alert(`Imported ${imported.length} events`);
      } catch { alert("Failed to import"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Sync drawings to collab room
  const prevDrawnRef = useRef<string>("");
  useEffect(() => {
    const serialized = JSON.stringify(drawnShapes);
    if (collaborationRoom && socketRef.current && serialized !== prevDrawnRef.current) {
      prevDrawnRef.current = serialized;
      socketRef.current.emit("collab:draw", { room: collaborationRoom, shapes: drawnShapes });
    }
  }, [drawnShapes, collaborationRoom]);

  // Broadcast focus to room
  const broadcastFocus = (lat: number, lng: number, zoom: number) => {
    if (collaborationRoom && socketRef.current) {
      socketRef.current.emit("collab:focus", { room: collaborationRoom, lat, lng, zoom });
    }
  };

  const generateReport = () => {
    const date = new Date().toISOString().split("T")[0];
    let content = "";
    if (reportType === "summary") {
      content = `# Conflict Globe — Summary Report\nGenerated: ${date}\nTotal Events: ${validEvents.length}\n\n## By Category\n${Object.entries(analytics.byCategory).map(([c, n]) => `- ${c}: ${n}`).join("\n")}\n\n## By Severity\n${Object.entries(analytics.bySeverity).map(([s, n]) => `- ${s}: ${n}`).join("\n")}`;
    } else if (reportType === "detailed") {
      content = `# Conflict Globe — Detailed Report\nGenerated: ${date}\n\n${validEvents.map(e => `## ${e.type}\n- Category: ${e.category}\n- Severity: ${e.severity || "N/A"}\n- Date: ${e.date}\n- Location: ${e.lat}, ${e.lon}\n- Description: ${e.description}\n- Source: ${e.source}\n`).join("\n")}`;
    } else {
      content = `# Conflict Globe — Analytics Report\nGenerated: ${date}\n\nTotal Events: ${validEvents.length}\nAverage Per Day: ${analytics.avgPerDay}\n\n## Distribution\n${Object.entries(analytics.byCategory).map(([c, n]) => `${c}: ${n} (${((n / validEvents.length) * 100).toFixed(1)}%)`).join("\n")}`;
    }
    saveAs(new Blob([content], { type: "text/markdown" }), `conflict-report-${reportType}-${date}.md`);
  };

  // ── Derived data ──
  const filteredEvents = useMemo(() => {
    let result = events.filter(e => filters[e.category] && severityFilters[e.severity || "medium"]);
    if (customFilter) {
      try {
        result = result.filter(e => {
          const ctx = { category: e.category, type: e.type, severity: e.severity, source: e.source, description: e.description?.toLowerCase() || "", lat: e.lat, lon: e.lon };
          return new Function(...Object.keys(ctx), `return ${customFilter}`)(...Object.values(ctx));
        });
      } catch {}
    }
    result = result.filter(e => {
      const d = new Date(e.date);
      return d >= timeRange[0] && d <= timeRange[1];
    });
    return result.slice(0, maxPoints);
  }, [events, filters, severityFilters, customFilter, timeRange, maxPoints]);

  const searchFilteredEvents = useMemo(() => {
    if (!searchQuery) return filteredEvents;
    const q = searchQuery.toLowerCase();
    return filteredEvents.filter(e =>
      e.description?.toLowerCase().includes(q) || e.type?.toLowerCase().includes(q) ||
      e.category?.toLowerCase().includes(q) || e.source?.toLowerCase().includes(q)
    );
  }, [filteredEvents, searchQuery]);

  const timelineEvents = useMemo(() => {
    const sorted = [...searchFilteredEvents].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const cut = Math.floor((timelinePosition / 100) * sorted.length);
    return sorted.slice(0, cut + 1);
  }, [searchFilteredEvents, timelinePosition]);

  const validEvents = useMemo(() =>
    timelineEvents
      .filter(e => e.lat !== 0 && e.lon !== 0 && !isNaN(e.lat) && !isNaN(e.lon))
      .map(e => ({ ...e, endLat: e.endLat ?? e.lat, endLon: e.endLon ?? e.lon })),
    [timelineEvents]
  );

  const analytics = useMemo(() => {
    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    const bySource: Record<string, number> = {};
    const byDay: Record<string, number> = {};
    validEvents.forEach(e => {
      byCategory[e.category] = (byCategory[e.category] || 0) + 1;
      bySeverity[e.severity || "medium"]++;
      bySource[e.source || "unknown"] = (bySource[e.source || "unknown"] || 0) + 1;
      const day = new Date(e.date).toISOString().split("T")[0];
      byDay[day] = (byDay[day] || 0) + 1;
    });
    const days = Object.keys(byDay).length;
    return { byCategory, bySeverity, bySource, byDay, total: validEvents.length, avgPerDay: days > 0 ? (validEvents.length / days).toFixed(1) : "0" };
  }, [validEvents]);

  // Threat score — computed separately, set via state with ref guard
  const prevThreatRef = useRef({ score: -1, level: "" });
  useEffect(() => {
    const score = Math.min(100, (analytics.bySeverity.critical || 0) * 15 + (analytics.bySeverity.high || 0) * 8 + (analytics.bySeverity.medium || 0) * 3 + analytics.total * 0.5);
    const rounded = Math.round(score);
    const level: "low" | "medium" | "high" | "critical" = score >= 75 ? "critical" : score >= 50 ? "high" : score >= 25 ? "medium" : "low";
    if (prevThreatRef.current.score !== rounded || prevThreatRef.current.level !== level) {
      prevThreatRef.current = { score: rounded, level };
      setThreatScore(rounded);
      setThreatLevel(level);
    }
  }, [analytics]);

  // Globe layer data
  // Arc connections: connect related events across the globe
  const arcData = useMemo(() => {
    if (!layers.showArcs) return [];
    const arcs: any[] = [];
    
    // Explicit arc events (have endLat/endLon defined - like arms transfers, flight paths)
    const explicit = timelineEvents
      .filter(e => e.endLat !== undefined && e.endLon !== undefined && e.endLat !== e.lat && e.lat !== 0)
      .slice(0, 50)
      .map(e => ({
        startLat: e.lat, startLng: e.lon, endLat: e.endLat!, endLng: e.endLon!,
        color: CATEGORY_COLORS[e.category] || "#ffd700",
        event: e,
        type: "explicit",
      }));
    arcs.push(...explicit);
    
    // Connect high/critical severity events (conflict chains)
    const significant = timelineEvents.filter(e => 
      (e.severity === "critical" || e.severity === "high") && e.lat !== 0
    );
    
    for (let i = 0; i < Math.min(significant.length, 40); i++) {
      for (let j = i + 1; j < Math.min(significant.length, 40); j++) {
        const a = significant[i], b = significant[j];
        const dist = Math.sqrt(Math.pow(a.lat - b.lat, 2) + Math.pow(a.lon - b.lon, 2));
        if (dist < 5 && dist > 0.3) { // ~500km threshold
          arcs.push({
            startLat: a.lat, startLng: a.lon, endLat: b.lat, endLng: b.lon,
            color: (a.severity === "critical" ? "#ef4444" : "#f97316") + "88",
            event: a,
            type: "severity",
          });
          if (arcs.length >= 60) break;
        }
      }
      if (arcs.length >= 60) break;
    }
    
    // Connect events from same source (intel feeds, agencies)
    const sourceGroups = new Map<string, typeof timelineEvents>();
    timelineEvents.forEach(e => {
      if (e.source && e.lat !== 0) {
        const source = e.source.toLowerCase();
        if (!sourceGroups.has(source)) sourceGroups.set(source, []);
        sourceGroups.get(source)!.push(e);
      }
    });
    
    sourceGroups.forEach((events) => {
      if (events.length < 2) return;
      const sorted = events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      for (let i = 0; i < Math.min(sorted.length - 1, 8); i++) {
        const a = sorted[i], b = sorted[i + 1];
        const dist = Math.sqrt(Math.pow(a.lat - b.lat, 2) + Math.pow(a.lon - b.lon, 2));
        if (dist < 15 && dist > 0.5) {
          arcs.push({
            startLat: a.lat, startLng: a.lon, endLat: b.lat, endLng: b.lon,
            color: "#8b5cf6" + "66",
            event: a,
            type: "source",
          });
        }
        if (arcs.length >= 80) break;
      }
    });
    
    // Connect events in same category that are geographically close (conflict zones)
    const categories = ["conflict", "land", "air", "maritime"];
    categories.forEach(cat => {
      const catEvents = timelineEvents.filter(e => e.category === cat && e.lat !== 0);
      for (let i = 0; i < Math.min(catEvents.length, 20); i++) {
        for (let j = i + 1; j < Math.min(catEvents.length, 20); j++) {
          const a = catEvents[i], b = catEvents[j];
          const dist = Math.sqrt(Math.pow(a.lat - b.lat, 2) + Math.pow(a.lon - b.lon, 2));
          if (dist < 3 && dist > 0.2) {
            arcs.push({
              startLat: a.lat, startLng: a.lon, endLat: b.lat, endLng: b.lon,
              color: CATEGORY_COLORS[cat] + "44",
              event: a,
              type: "category",
            });
          }
          if (arcs.length >= 100) break;
        }
        if (arcs.length >= 100) break;
      }
    });
    
    return arcs.slice(0, 100);
  }, [timelineEvents, layers.showArcs]);

  const ringsData = useMemo(() => !layers.showRings ? [] : validEvents.slice(0, 300), [validEvents, layers.showRings]);
  const hexBinData = useMemo(() => !layers.showHexBin ? [] : validEvents, [validEvents, layers.showHexBin]);
  const heatmapData = useMemo(() => !layers.showHeatmap ? [] : validEvents, [validEvents, layers.showHeatmap]);
  const pathsData = useMemo(() => !layers.showPaths ? [] :
    timelineEvents
      .filter(e => e.endLat !== undefined && e.endLon !== undefined && e.endLat !== e.lat && e.lat !== 0)
      .slice(0, 50)
      .map(e => ({
        path: [[e.lat, e.lon], [e.endLat!, e.endLon!]], color: CATEGORY_COLORS[e.category] || "#ffd700",
      })), [timelineEvents, layers.showPaths]);

  const tilesData = useMemo(() => !useTiles ? undefined : [{
    url: TILE_LAYERS[tileLayer].url, maxZoom: 19, attribution: TILE_LAYERS[tileLayer].attribution,
  }], [useTiles, tileLayer]);

  // Live feed — track truly new events arriving via WebSocket
  const prevEventIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (validEvents.length === 0) return;
    const currentIds = new Set(validEvents.map(e => e.id));
    const newEvents = prevEventIdsRef.current.size === 0
      ? validEvents.slice(0, 25) // first load: show most recent 25
      : validEvents.filter(e => !prevEventIdsRef.current.has(e.id));
    prevEventIdsRef.current = currentIds;
    if (newEvents.length === 0) return;
    const newItems = newEvents
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 25)
      .map((e, i) => ({
        id: e.id || `e-${i}`,
        time: new Date(e.date),
        message: (e.description || "").substring(0, 90) + ((e.description?.length || 0) > 90 ? "…" : ""),
        type: e.category.toUpperCase(),
        severity: e.severity || "low",
        event: e,
      }));
    setLiveFeedItems(prev => [...newItems, ...prev].slice(0, 50));
  }, [validEvents]);

  // Search suggestions
  const searchSuggestions = useMemo(() => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase();
    return QUICK_LOCATIONS.filter(l => l.name.toLowerCase().includes(q)).slice(0, 5);
  }, [searchQuery]);

  // Collaboration
  const joinCollaboration = () => {
    if (!roomInput) return;
    setCollaborationRoom(roomInput);
    socketRef.current?.emit("collab:join", { room: roomInput, username });
  };
  const leaveCollaboration = () => {
    socketRef.current?.emit("collab:leave");
    setCollaborationRoom(null);
    setCollaborators([]);
  };

  // Entity graph
  const entityGraph = useMemo(() => {
    const nodeMap = new Map<string, { id: string; type: string; events: number }>();
    const links: { source: string; target: string }[] = [];
    validEvents.forEach(e => {
      const key = e.category;
      if (!nodeMap.has(key)) nodeMap.set(key, { id: key, type: "category", events: 0 });
      nodeMap.get(key)!.events++;
      e.entities?.forEach(ent => {
        if (!nodeMap.has(ent)) nodeMap.set(ent, { id: ent, type: "entity", events: 0 });
        nodeMap.get(ent)!.events++;
        links.push({ source: ent, target: key });
      });
    });
    return { nodes: Array.from(nodeMap.values()).slice(0, 50), links: links.slice(0, 100) };
  }, [validEvents]);

  const bgColor = globeTheme === "dark" ? "#070b14" : "#e8edf4";

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="app">
      {/* ── Left Panel ── */}
      {showLeftPanel && (
        <div className="panel panel-left">
          <div className="panel-header">
            <div className="panel-logo">
              <span className="panel-logo-icon">⊕</span>
              <span className="panel-logo-text">CONFLICT GLOBE</span>
            </div>
            <div className="panel-meta">
              <span className="live-dot" />
              <span>LIVE</span>
              <span style={{ color: "var(--border-hi)" }}>·</span>
              <span style={{ color: "var(--text-2)" }}>{validEvents.length}</span>
              <span>EVENTS</span>
              {currentWorkspace && <>
                <span style={{ color: "var(--border-hi)" }}>·</span>
                <span style={{ color: "var(--accent)" }}>WS</span>
              </>}
            </div>
          </div>

          <div className="tab-bar">
             {([
                ["layers", "LYR", "Layers"],
                ["categories", "CAT", "Categories"],
                ["filters", "FLT", "Filters"],
                ["import", "IMP", "Import"],
                ["settings", "CFG", "Settings"],
              ] as [LeftTab, string, string][]).map(([tab, icon, label]) => (
              <button key={tab} className={cls("tab-btn", activeLeftTab === tab && "active")} onClick={() => setActiveLeftTab(tab)}>
                <span className="tab-icon">{icon}</span>
                {label}
              </button>
            ))}
          </div>

          <div className="panel-scroll">
            {/* ── Layers tab ── */}
            {activeLeftTab === "layers" && (
              <>
                <div className="section">
                  <SectionLabel>Globe Style</SectionLabel>
                  <div className="style-grid">
                    {(["dark", "light", "satellite", "terrain"] as GlobeTheme[]).map(s => (
                      <button key={s} className={cls("style-btn", globeTheme === s && "active")} onClick={() => setGlobeTheme(s)}>
                        <span className="style-btn-icon">{s === "dark" ? "D" : s === "light" ? "L" : s === "satellite" ? "S" : "T"}</span>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="section">
                  <SectionLabel>Globe Options</SectionLabel>
                  <CheckRow checked={showAtmosphere} onChange={setShowAtmosphere} icon="○" label="Atmosphere Glow" />
                  <CheckRow checked={showGraticules} onChange={setShowGraticules} icon="⊞" label="Grid Lines" />
                  <CheckRow checked={showClouds} onChange={setShowClouds} icon="◌" label="Cloud Layer" />
                  <CheckRow checked={globeRotation} onChange={setGlobeRotation} icon="R" label="Auto Rotate" />
                  <CheckRow checked={showTerrain} onChange={setShowTerrain} icon="◬" label="3D Terrain" />
                  <CheckRow checked={showCameras} onChange={setShowCameras} icon="◆" label="Camera Feeds" />
                </div>

                <div className="section">
                  <SectionLabel>Tile Layer</SectionLabel>
                  <CheckRow checked={useTiles} onChange={setUseTiles} icon="⊠" label="Enable Tiles" />
                  {useTiles && (
                    <div className="chip-group" style={{ marginTop: 8 }}>
                      {(Object.keys(TILE_LAYERS) as TileLayerKey[]).map(k => (
                        <button key={k} className={cls("chip", tileLayer === k && "active")} onClick={() => setTileLayer(k)}>
                          {TILE_LAYERS[k].name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                 <div className="section">
                   <SectionLabel>Data Layers</SectionLabel>
<CheckRow checked={layers.showHexBin} onChange={v => setLayer("showHexBin", v)} icon="X" label="Heat Clusters" />
                   <CheckRow checked={layers.showRings} onChange={v => setLayer("showRings", v)} icon="O" label="Pulse Rings" />
                   <CheckRow checked={layers.showPolygons} onChange={v => setLayer("showPolygons", v)} icon="P" label="Regions" />
                   <CheckRow checked={layers.showSDR} onChange={v => setLayer("showSDR", v)} icon="S" label="SDR Signals" />
                 </div>

                 <div className="section">
                   <SectionLabel>Performance</SectionLabel>
                   <div className="quality-group" style={{ marginBottom: 12 }}>
                     {(["low", "medium", "high"] as const).map(q => (
                       <button key={q} className={cls("quality-btn", pointQuality === q && "active")} onClick={() => setPointQuality(q)}>{q}</button>
                     ))}
                   </div>
                   <div className="range-row">
                     <div className="range-label"><span>Max Points</span><span>{maxPoints}</span></div>
                     <input type="range" min={50} max={5000} step={50} value={maxPoints} onChange={e => setMaxPoints(+e.target.value)} />
                   </div>
                   <div className="range-row">
                     <div className="range-label"><span>Point Size</span><span>{pointSize}</span></div>
                     <input type="range" min={1} max={10} value={pointSize} onChange={e => setPointSize(+e.target.value)} />
                   </div>
                   <CheckRow checked={enableClustering} onChange={v => setEnableClustering(v)} icon="M" label="Point Clustering (disabled: breaks clicks)" />
                  </div>
                </>
              )}

            {/* ── Categories tab ── */}
            {activeLeftTab === "categories" && (
              <>
                <div className="section">
                  <SectionLabel>Event Categories</SectionLabel>
                  <div style={{ marginBottom: 8, display: "flex", gap: 6 }}>
                    <button className="chip active" onClick={() => setFilters(Object.fromEntries(Object.keys(filters).map(k => [k, true])))}>All</button>
                    <button className="chip" onClick={() => setFilters(Object.fromEntries(Object.keys(filters).map(k => [k, false])))}>None</button>
                  </div>
                  <div className="pill-group">
                    {Object.keys(filters).map(cat => (
                      <button
                        key={cat}
                        className={cls("pill", !filters[cat] && "pill-inactive")}
                        style={{ background: filters[cat] ? CATEGORY_COLORS[cat] : undefined, color: "white" }}
                        onClick={() => setFilters(f => ({ ...f, [cat]: !f[cat] }))}
                      >
                        {CATEGORY_ICONS[cat]} {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="divider" />

                <div className="section">
                  <SectionLabel>Severity</SectionLabel>
                  {Object.keys(severityFilters).map(sev => (
                    <div
                      key={sev}
                      className="sev-row"
                      style={{ cursor: "pointer", opacity: severityFilters[sev] ? 1 : 0.4 }}
                      onClick={() => setSeverityFilters(f => ({ ...f, [sev]: !f[sev] }))}
                    >
                      <span className="sev-dot" style={{ background: SEVERITY_COLORS[sev] }} />
                      <span className="sev-name">{sev}</span>
                      <span className="sev-count" style={{ color: SEVERITY_COLORS[sev] }}>
                        {analytics.bySeverity[sev] || 0}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="divider" />

                <div className="section">
                  <SectionLabel>Quick Locations</SectionLabel>
                  <div className="chip-group">
                    {QUICK_LOCATIONS.map(loc => (
                      <button key={loc.name} className="chip" onClick={() => focusLocation(loc.lat, loc.lon, 2)}>
                        {loc.name}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

             {/* ── Filters tab ── */}
             {activeLeftTab === "filters" && (
               <>
                 <div className="section">
                   <SectionLabel>Event Overview</SectionLabel>
                   <div className="stats-graph">
                     {[
                       { label: "land", count: events.filter(e => e.category === "land").length, color: "var(--accent)" },
                       { label: "air", count: events.filter(e => e.category === "air").length, color: "#22c55e" },
                       { label: "conflict", count: events.filter(e => e.category === "conflict").length, color: "#ef4444" },
                       { label: "weather", count: events.filter(e => e.category === "weather").length, color: "#06b6d4" },
                       { label: "cyber", count: events.filter(e => e.category === "cyber").length, color: "#8b5cf6" },
                       { label: "space", count: events.filter(e => e.category === "space").length, color: "#14b8a6" },
                     ].map(cat => (
                       <div
                         key={cat.label}
                         className="graph-bar"
                         style={{ height: `${Math.max(4, (cat.count / Math.max(...events.filter(e => e.category).map(e => 1))) * 60)}px`, background: cat.color }}
                         title={`${cat.label}: ${cat.count}`}
                       />
                     ))}
                   </div>
                   <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6rem", color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>
                     {["LAND", "AIR", "CONFLICT", "WEATHER", "CYBER", "SPACE"].map((l, i) => <span key={l}>{l}</span>)}
                   </div>
                 </div>

                 <div className="section">
                   <SectionLabel>Filters</SectionLabel>
                   <div className="filter-group">
                     <div className="filter-row">
                       <span>Show Labels</span>
                       <CheckRow checked={layers.showLabels} onChange={v => setLayer("showLabels", v)} icon="T" />
                     </div>
                     <div className="filter-row">
                       <span>Show Connections</span>
                       <CheckRow checked={layers.showConnections} onChange={v => setLayer("showConnections", v)} icon="↔" />
                     </div>
                     <div className="filter-row">
                       <span>Show Heatmap</span>
                       <CheckRow checked={layers.showHeatmap} onChange={v => setLayer("showHeatmap", v)} icon="≡" />
                     </div>
                   </div>
                 </div>
                 
                 <div className="section">
                   <SectionLabel>Severity Filters</SectionLabel>
                   <div className="filter-grid">
                     {(["low", "medium", "high", "critical"] as const).map(sev => (
                       <CheckboxLabel key={sev}>
                         <input
                           type="checkbox"
                           checked={severityFilters[sev] || false}
                           onChange={e => setSeverityFilters(prev => ({ ...prev, [sev]: e.target.checked }))}
                         />
                         {sev.toUpperCase()}
                       </CheckboxLabel>
                     ))}
                   </div>
                 </div>
                 
                 <div className="section">
                   <SectionLabel>Category Filters</SectionLabel>
                   <div className="filter-grid">
                     {Object.keys(CATEGORY_COLORS).map(cat => (
                       <CheckboxLabel key={cat}>
                         <input
                           type="checkbox"
                           checked={filters[cat] || false}
                           onChange={e => setFilters(prev => ({ ...prev, [cat]: e.target.checked }))}
                         />
                         {cat.toUpperCase()}
                       </CheckboxLabel>
                     ))}
                   </div>
                 </div>
                 
                 <div className="section">
                   <SectionLabel>Custom Filter</SectionLabel>
                   <input
                     type="text"
                     placeholder="Enter custom filter (e.g., type:conflict AND severity:high)"
                     value={customFilter}
                     onChange={e => setCustomFilter(e.target.value)}
                     className="text-input"
                   />
                 </div>
                 
                 <div className="section">
                   <SectionLabel>Boolean Logic</SectionLabel>
                   <div className="filter-row">
                     <span>Combine with:</span>
                     <select value={booleanFilter} onChange={e => setBooleanFilter(e.target.value as "AND" | "OR")} className="text-input">
                       <option value="AND">AND</option>
                       <option value="OR">OR</option>
                     </select>
                   </div>
                 </div>
               </>
             )}

            {/* ── Import tab ── */}
            {activeLeftTab === "import" && (
              <>
                <div className="section">
                  <SectionLabel>Import Data</SectionLabel>
                  <label className="dropzone">
                    <input type="file" accept=".json,.geojson,.csv,.kml" onChange={handleFileImport} style={{ display: "none" }} />
                    <div className="dropzone-icon">⊕</div>
                    <div className="dropzone-label">Click to import file</div>
                    <div className="dropzone-sub">JSON · GeoJSON · CSV · KML</div>
                  </label>
                </div>

                <div className="section">
                  <SectionLabel>Workspaces</SectionLabel>
                  <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                    <button className="full-btn full-btn-green" style={{ flex: 1 }} onClick={saveWorkspace}>
                      ⊕ Save Current
                    </button>
                    <label className="full-btn" style={{ flex: 1, background: "var(--accent)", color: "#fff", cursor: "pointer" }}>
                      ↓ Import
                      <input type="file" accept=".json" onChange={importWorkspace} style={{ display: "none" }} />
                    </label>
                  </div>
                  {workspaces.length === 0 ? (
                    <EmptyState icon="⊟" text="No saved workspaces" sub="Save your current view above" />
                  ) : (
                    workspaces.map(ws => (
                      <div key={ws.id} className={cls("ws-card", currentWorkspace === ws.id && "active")} onClick={() => loadWorkspace(ws.id)}>
                        <div className="ws-top">
                          <span className="ws-name">{ws.name}</span>
                          <span className="ws-date">{ws.createdAt.split("T")[0]}</span>
                        </div>
                        <div className="ws-actions" onClick={e => e.stopPropagation()}>
                          <button className="ws-action-btn" onClick={() => exportWorkspace(ws)}>↓ Export</button>
                          <button className="ws-action-btn" onClick={() => shareWorkspace(ws)}>⊕ Share</button>
                          <button className="ws-action-btn danger" onClick={() => deleteWorkspace(ws.id)}>X Delete</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {/* ── Settings tab ── */}
            {activeLeftTab === "settings" && (
              <>
                <div className="section">
                  <SectionLabel>Data APIs</SectionLabel>
                  <p style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 12 }}>
                    Configure API keys to enhance data coverage. Keys stored locally.
                  </p>
                  
                  <div className="api-key-section">
                    <label className="api-key-label">AISStream (Vessels)</label>
                    <input
                      type="password"
                      className="text-input"
                      placeholder="AISStream API key"
                      value={apiKeys.aisstream || ""}
                      onChange={e => setApiKeys(k => ({ ...k, aisstream: e.target.value }))}
                    />
                    <div className="api-key-hint">aisstream.io - Global ship tracking</div>
                  </div>

                  <div className="api-key-section">
                    <label className="api-key-label">OpenSky Network (Aircraft)</label>
                    <input
                      type="text"
                      className="text-input"
                      placeholder="Client ID"
                      value={apiKeys.opensky_id || ""}
                      onChange={e => setApiKeys(k => ({ ...k, opensky_id: e.target.value }))}
                    />
                    <input
                      type="password"
                      className="text-input"
                      style={{ marginTop: 4 }}
                      placeholder="Client Secret"
                      value={apiKeys.opensky_secret || ""}
                      onChange={e => setApiKeys(k => ({ ...k, opensky_secret: e.target.value }))}
                    />
                    <div className="api-key-hint">opensky-network.org - Aircraft positions</div>
                  </div>

                  <div className="api-key-section">
                    <label className="api-key-label">ACLED (Conflict Data)</label>
                    <input
                      type="password"
                      className="text-input"
                      placeholder="ACLED API key"
                      value={apiKeys.acled || ""}
                      onChange={e => setApiKeys(k => ({ ...k, acled: e.target.value }))}
                    />
                    <div className="api-key-hint">acleddata.com - Armed conflict events</div>
                  </div>

                  <div className="api-key-section">
                    <label className="api-key-label">NewsAPI (Headlines)</label>
                    <input
                      type="password"
                      className="text-input"
                      placeholder="NewsAPI key"
                      value={apiKeys.newsapi || ""}
                      onChange={e => setApiKeys(k => ({ ...k, newsapi: e.target.value }))}
                    />
                    <div className="api-key-hint">newsapi.org - Global news feed</div>
                  </div>

                  <div className="api-key-section">
                    <label className="api-key-label">GDELT (Events)</label>
                    <input
                      type="text"
                      className="text-input"
                      placeholder="GDELT API key (optional)"
                      value={apiKeys.gdelt || ""}
                      onChange={e => setApiKeys(k => ({ ...k, gdelt: e.target.value }))}
                    />
                    <div className="api-key-hint">gdeltproject.org - Global events database</div>
                  </div>

                  <div className="api-key-section">
                    <label className="api-key-label">Windy.com (Weather)</label>
                    <input
                      type="password"
                      className="text-input"
                      placeholder="Windy API key"
                      value={apiKeys.windy || ""}
                      onChange={e => setApiKeys(k => ({ ...k, windy: e.target.value }))}
                    />
                    <div className="api-key-hint">openweathermap.org - Weather data</div>
                  </div>

                  <div className="api-key-section">
                    <label className="api-key-label">Cesium Ion (3D Tiles)</label>
                    <input
                      type="password"
                      className="text-input"
                      placeholder="Cesium Ion token"
                      value={apiKeys.cesium || ""}
                      onChange={e => setApiKeys(k => ({ ...k, cesium: e.target.value }))}
                    />
                    <div className="api-key-hint">cesium.com/ion - 3D mapping</div>
                  </div>
                </div>

                <div className="section">
                  <SectionLabel>Automation</SectionLabel>
                  
                  <div className="api-key-section">
                    <label className="api-key-label">n8n Webhook URL</label>
                    <input
                      type="text"
                      className="text-input"
                      placeholder="https://your-n8n.com/webhook/conflicts"
                      value={apiKeys.n8n_webhook || ""}
                      onChange={e => setApiKeys(k => ({ ...k, n8n_webhook: e.target.value }))}
                    />
                    <div className="api-key-hint">Connect n8n workflows for custom data processing</div>
                  </div>

                  <div className="api-key-section">
                    <label className="api-key-label">n8n API Key</label>
                    <input
                      type="password"
                      className="text-input"
                      placeholder="n8n API key"
                      value={apiKeys.n8n_api_key || ""}
                      onChange={e => setApiKeys(k => ({ ...k, n8n_api_key: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="section">
                  <SectionLabel>MCP Server</SectionLabel>
                  
                  <div className="api-key-section">
                    <label className="api-key-label">MCP Server URL</label>
                    <input
                      type="text"
                      className="text-input"
                      placeholder="https://mcp.example.com"
                      value={apiKeys.mcp_url || ""}
                      onChange={e => setApiKeys(k => ({ ...k, mcp_url: e.target.value }))}
                    />
                    <div className="api-key-hint">Model Context Protocol server for AI tool access</div>
                  </div>

                  <div className="api-key-section">
                    <label className="api-key-label">MCP API Key</label>
                    <input
                      type="password"
                      className="text-input"
                      placeholder="MCP access token"
                      value={apiKeys.mcp_api_key || ""}
                      onChange={e => setApiKeys(k => ({ ...k, mcp_api_key: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="section">
                  <button 
                    className="full-btn" 
                    style={{ background: "var(--accent)", color: "#fff" }}
                    onClick={async () => {
                      // Save webhook URL to server if configured
                      if (apiKeys.n8n_webhook) {
                        try {
                          await fetch("/api/webhook/config", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ url: apiKeys.n8n_webhook })
                          });
                        } catch (e) {
                          console.error("Failed to configure webhook:", e);
                        }
                      }
                      const count = Object.keys(apiKeys).filter(k => apiKeys[k]).length;
                      alert(`Saved ${count} API key(s). Webhook configured!`);
                    }}
                  >
                    💾 Save API Keys
                  </button>
                  <button
                    className="full-btn"
                    style={{ marginTop: 8, background: "var(--green)", color: "#fff" }}
                    onClick={async () => {
                      try {
                        const res = await fetch("/api/webhook/test", { method: "POST" });
                        if (res.ok) {
                          alert("✅ Test message sent to Discord!");
                        } else {
                          alert("❌ Failed to send test message");
                        }
                      } catch (e) {
                        alert("❌ Error: " + e);
                      }
                    }}
                  >
                    🧪 Test Discord Webhook
                  </button>
                  <button 
                    className="full-btn" 
                    style={{ marginTop: 8, background: "var(--border)", color: "var(--text)" }}
                    onClick={() => {
                      if (confirm("Clear all API keys?")) {
                        setApiKeys({});
                      }
                    }}
                  >
                    🗑 Clear All Keys
                  </button>
                </div>

                <div className="section">
                  <SectionLabel>Current Configuration</SectionLabel>
                  <div style={{ fontSize: 11, color: "var(--text-2)", wordBreak: "break-all" }}>
                    {Object.keys(apiKeys).filter(k => apiKeys[k]).length === 0 ? (
                      <div style={{ color: "var(--text-3)" }}>No custom keys configured</div>
                    ) : (
                      <ul style={{ paddingLeft: 16, margin: 0 }}>
                        {Object.entries(apiKeys).filter(([, v]) => v).map(([k]) => (
                          <li key={k} style={{ marginBottom: 4 }}>• {k}</li>
                        ))}
                      </ul>
                    )}
                   </div>
                </div>

                <div className="section">
                  <SectionLabel>OSINT Tools</SectionLabel>
                  <p style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 12 }}>
                    External OSINT resources for data collection
                  </p>
                  <div className="osint-grid">
                    {[
                      { name: "Shodan", url: "https://www.shodan.io", desc: "IoT devices" },
                      { name: "Censys", url: "https://censys.io", desc: "Infrastructure" },
                      { name: "SpiderFoot", url: "https://www.spiderfoot.com", desc: "Automation" },
                      { name: "theHarvester", url: "https://github.com/laramies/theHarvester", desc: "Emails" },
                      { name: "Maltego", url: "https://www.maltego.com", desc: "Visualization" },
                      { name: "Have I Been Pwned", url: "https://haveibeenpwned.com", desc: "Breaches" },
                      { name: "DNSDumpster", url: "https://dnsdumpster.com", desc: "Subdomains" },
                      { name: "ExifTool", url: "https://exiftool.org", desc: "Metadata" },
                      { name: "Google Dorks", url: "https://www.google.com/search?q=site:exploit.in+password", desc: "Search" },
                      { name: "OSINT Combine", url: "https://www.osintcombine.com", desc: "Aggregated" },
                    ].map(tool => (
                      <a
                        key={tool.name}
                        href={tool.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="osint-card"
                      >
                        <span className="osint-name">{tool.name}</span>
                        <span className="osint-desc">{tool.desc}</span>
                      </a>
                    ))}
                  </div>
                </div>
               </>
             )}

            {/* ── SDR Radio tab ── */}
            {activeLeftTab === "sdr" && (
              <>
                <div className="section">
                  <SectionLabel>SDR Radio Signals</SectionLabel>
                  <p style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 12 }}>
                    Monitor Software Defined Radio signals for conflict intelligence.
                  </p>
                  
                  <div style={{ marginBottom: 12 }}>
                    <div className="range-row">
                      <div className="range-label"><span>Frequency</span><span>{sdrFrequency} kHz</span></div>
                      <input 
                        type="range" 
                        min={100} 
                        max={30000} 
                        step={100} 
                        value={sdrFrequency} 
                        onChange={e => setSdrFrequency(+e.target.value)} 
                      />
                    </div>
                    
                    <div className="range-row">
                      <div className="range-label"><span>Bandwidth</span><span>{sdrBandwidth} Hz</span></div>
                      <input 
                        type="range" 
                        min={100} 
                        max={10000} 
                        step={100} 
                        value={sdrBandwidth} 
                        onChange={e => setSdrBandwidth(+e.target.value)} 
                      />
                    </div>
                    
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      {["LSB", "USB", "AM", "FM", "CW"].map(mode => (
                        <button 
                          key={mode}
                          className={cls("quality-btn", sdrMode === mode && "active")}
                          onClick={() => setSdrMode(mode)}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="section">
                  <SectionLabel>Detected Signals</SectionLabel>
                  <div style={{ maxHeight: 300, overflow: "auto" }}>
                    {sdrSignals.length === 0 ? (
                      <div style={{ color: "var(--text-3)", fontSize: 12, padding: "8px" }}>
                        No signals detected or SDR source not configured.
                      </div>
                    ) : (
                      sdrSignals.map(signal => (
                        <div 
                          key={signal.id}
                          className={cls("event-item", selectedSdrSignal?.id === signal.id && "selected")}
                          onClick={() => {
                            setSelectedSdrSignal(signal);
                            if (signal.lat && signal.lon) {
                              if (globeEl.current) {
                                (globeEl.current as any).pointOfView({ lat: signal.lat, lng: signal.lon, altitude: 0.5 }, 1500);
                              }
                            }
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ color: "var(--accent)" }}>S</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 500, fontSize: 12 }}>{signal.type}</div>
                              <div style={{ fontSize: 11, color: "var(--text-2)" }}>
                                {signal.frequency ? `${signal.frequency} kHz` : ""} 
                                {signal.power ? ` • ${signal.power} dBm` : ""}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {selectedSdrSignal && (
                  <div className="section">
                    <SectionLabel>Signal Details</SectionLabel>
                    <div style={{ fontSize: 11, color: "var(--text-2)" }}>
                      <div style={{ marginBottom: 4 }}><strong>Type:</strong> {selectedSdrSignal.type}</div>
                      {selectedSdrSignal.frequency && <div style={{ marginBottom: 4 }}><strong>Frequency:</strong> {selectedSdrSignal.frequency} kHz</div>}
                      {selectedSdrSignal.power && <div style={{ marginBottom: 4 }}><strong>Power:</strong> {selectedSdrSignal.power} dBm</div>}
                      {selectedSdrSignal.bandwidth && <div style={{ marginBottom: 4 }}><strong>Bandwidth:</strong> {selectedSdrSignal.bandwidth} Hz</div>}
                      {selectedSdrSignal.modulation && <div style={{ marginBottom: 4 }}><strong>Modulation:</strong> {selectedSdrSignal.modulation}</div>}
                      {selectedSdrSignal.description && <div style={{ marginBottom: 4, marginTop: 8 }}>{selectedSdrSignal.description}</div>}
                      <div style={{ marginTop: 8, color: "var(--text-3)" }}>
                        {selectedSdrSignal.lat && selectedSdrSignal.lon && (
                          <div>POS {selectedSdrSignal.lat.toFixed(4)}, {selectedSdrSignal.lon.toFixed(4)}</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Globe Area ── */}
      <div className="globe-area">
        {/* Topbar */}
        <div className="topbar">
          <div className="topbar-left">
            <button className={cls("panel-toggle", showLeftPanel && "active")} onClick={() => setShowLeftPanel(p => !p)}>
              <span className="panel-toggle-icon">☰</span>
              <kbd>1</kbd>
            </button>
            <button className={cls("panel-toggle", showRightPanel && "active")} onClick={() => setShowRightPanel(p => !p)}>
              <span className="panel-toggle-icon">◫</span>
              <kbd>2</kbd>
            </button>
            <button className={cls("panel-toggle", showBottomPanel && "active")} onClick={() => setShowBottomPanel(p => !p)}>
              <span className="panel-toggle-icon">▾</span>
              <kbd>3</kbd>
            </button>
          </div>

          <div className="topbar-center">
            <div className="search-wrap">
              <input
                type="text"
                className="search-input"
                placeholder="Search locations, events, sources…"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setShowSearchDropdown(true); }}
                onFocus={() => setShowSearchDropdown(true)}
                onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    // Try quick locations first
                    const q = searchQuery.toLowerCase();
                    const loc = searchSuggestions[0];
                    if (loc) {
                      focusLocation(loc.lat, loc.lon, 1.8);
                      setShowSearchDropdown(false);
                      return;
                    }
                    // Try matching a visible event
                    const match = validEvents.find(ev =>
                      (ev.type || "").toLowerCase().includes(q) ||
                      (ev.description || "").toLowerCase().includes(q) ||
                      (ev.country || "").toLowerCase().includes(q) ||
                      (ev.source || "").toLowerCase().includes(q)
                    );
                    if (match) {
                      focusLocation(match.lat, match.lon, 1.2);
                      setSelectedEvent(match);
                      setActiveRightTab("details");
                      setShowSearchDropdown(false);
                    }
                  }
                  if (e.key === "Escape") { setShowSearchDropdown(false); setSearchQuery(""); }
                }}
              />
              <span className="search-icon">⊕</span>
              {showSearchDropdown && searchQuery.length > 1 && (
                <div className="search-dropdown">
                  {searchSuggestions.length > 0 && (
                    <>
                      <div className="search-group-label">LOCATIONS</div>
                      {searchSuggestions.slice(0, 4).map((loc, i) => (
                        <div key={i} className="search-item" onClick={() => { focusLocation(loc.lat, loc.lon, 1.8); setSearchQuery(loc.name); setShowSearchDropdown(false); }}>
                          <span className="search-item-icon">⊕</span>
                          <span className="search-item-name">{loc.name}</span>
                          <span className="search-item-coords">{loc.lat.toFixed(2)}, {loc.lon.toFixed(2)}</span>
                        </div>
                      ))}
                    </>
                  )}
                  {(() => {
                    const q = searchQuery.toLowerCase();
                    const eventMatches = validEvents.filter(ev =>
                      (ev.type || "").toLowerCase().includes(q) ||
                      (ev.description || "").toLowerCase().includes(q) ||
                      (ev.country || "").toLowerCase().includes(q) ||
                      (ev.source || "").toLowerCase().includes(q)
                    ).slice(0, 5);
                    if (eventMatches.length === 0) return null;
                    return (
                      <>
                        <div className="search-group-label">EVENTS</div>
                        {eventMatches.map((ev, i) => (
                          <div key={i} className="search-item" onClick={() => {
                            focusLocation(ev.lat, ev.lon, 1.2);
                            setSelectedEvent(ev);
                            setActiveRightTab("details");
                            setSearchQuery(ev.type || "");
                            setShowSearchDropdown(false);
                          }}>
                            <span className="search-item-icon" style={{ color: CATEGORY_COLORS[ev.category] }}>{CATEGORY_ICONS[ev.category]}</span>
                            <span className="search-item-name">{(ev.type || "").substring(0, 45)}</span>
                            <span className="search-item-coords" style={{ color: SEVERITY_COLORS[ev.severity || "medium"] }}>{ev.severity || "med"}</span>
                          </div>
                        ))}
                      </>
                    );
                  })()}
                  {searchSuggestions.length === 0 && validEvents.filter(ev => (ev.type||"").toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                    <div className="search-item" style={{ color: "var(--text-3)", fontStyle: "italic" }}>
                      <span className="search-item-name">No results for "{searchQuery}"</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="topbar-right">
            {/* Threat badge */}
            <div className="threat-badge">
              <span className="threat-label">THREAT</span>
              <span className="threat-dot" style={{ background: SEVERITY_COLORS[threatLevel], boxShadow: `0 0 6px ${SEVERITY_COLORS[threatLevel]}` }} />
              <span className="threat-value" style={{ color: SEVERITY_COLORS[threatLevel] }}>{threatLevel}</span>
              <span className="threat-label">({threatScore})</span>
            </div>

            {/* Feature toggles */}
            {([
              ["RFSH", "Refresh", () => loadData(), false],
              [globeTheme === "dark" ? "DRK" : "LIT", "Theme", () => setGlobeTheme(t => t === "dark" ? "light" : "dark"), false],
              ["SDR", "SDR", () => setShowSDRPanel(p => !p), showSDRPanel],
              ["AGNT", "Agent", () => setShowAntennaPanel(p => !p), showAntennaPanel],
              ["OSNT", "OSINT", () => setShowOSINTPanel(p => !p), showOSINTPanel],
              ["CAM", "Cams", () => { setShowCameraPanel(p => !p); loadCameras('all'); }, showCameraPanel],
              ["GRPH", "Graph", () => setShowGraphPanel(p => !p), showGraphPanel],
              ["INT", "Intel", () => setShowIntelligencePanel(p => !p), showIntelligencePanel],
              ["DATA", "Analytics", () => setShowAnalytics(p => !p), showAnalytics],
              ["NET", "Network", () => setShowEntityGraph(p => !p), showEntityGraph],
              ["TIME", "Time", () => setShowTimeMachine(p => !p), showTimeMachine],
              ["VOICE", "Voice", () => setVoiceEnabled(p => !p), voiceEnabled],
              ["DISC", "Discord", () => window.open("https://discord.gg/zRyBE6S7YG", "_blank"), false],
              ["MARK", "Markers", () => {}, showCollaborators],
              ["TEAM", "Team", () => setShowCollaborators(p => !p), showCollaborators],
              ["RPT", "Report", () => setShowReportPanel(p => !p), showReportPanel],
              ["LIVE", "Feed", () => setShowLiveFeed(p => !p), showLiveFeed],
              ["DRAW", "Draw", () => setShowDrawTools(p => !p), showDrawTools],
              ["HELP", "Help", () => setShowHelp(p => !p), showHelp],
              ["SHR", "Share", () => {
                const s = { theme: globeTheme, filters, view: globeEl.current?.pointOfView() };
                navigator.clipboard.writeText(`${window.location.origin}?s=${btoa(JSON.stringify(s))}`);
                alert("Share URL copied!");
              }, false],
            ] as [string, string, () => void, boolean][]).map(([icon, label, action, active]) => (
              <button key={label} className={cls("icon-btn", active && "active")} onClick={action} title={label}>
                <div className="icon-btn-label">
                  <span>{icon}</span>
                  <span className="icon-btn-sub">{label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Globe canvas */}
        <div className="globe-canvas" style={{ flex: 1, position: "relative" }}>
          {(() => {
            const G = Globe as any;
            const overlayEvents = validEvents.filter((e: any) => ["air","maritime","space","cameras"].includes(e.category));
            return (
              <G
                ref={globeEl}
                globeImageUrl={GLOBE_IMAGES[globeTheme]}
                backgroundImageUrl={NIGHT_SKY}
                backgroundColor={bgColor}
                showAtmosphere={showAtmosphere}
                showGraticules={showGraticules}
                 objectsData={overlayEvents}
                 objectLat={(d: any) => d.lat}
                 objectLng={(d: any) => d.lon}
                 objectAltitude={0.02}
                  objectThreeObject={(d: any) => {
                    const cat = d.category;
                    const THREE = (window as any).THREE;
                    let mesh;
                    
                    if (cat === "air") {
                      // Detailed Airplane
                      const plane = new THREE.Group();
                      
                      // Fuselage - elongated cylinder
                      const fuselageGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.5, 8);
                      const fuselageMat = new THREE.MeshBasicMaterial({ color: 0xe5e7eb });
                      const fuselage = new THREE.Mesh(fuselageGeo, fuselageMat);
                      fuselage.rotation.z = Math.PI / 2;
                      plane.add(fuselage);
                      
                      // Nose cone
                      const noseGeo = new THREE.ConeGeometry(0.06, 0.15, 8);
                      const noseMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
                      const nose = new THREE.Mesh(noseGeo, noseMat);
                      nose.rotation.z = -Math.PI / 2;
                      nose.position.x = 0.32;
                      plane.add(nose);
                      
                      // Main wings
                      const wingGeo = new THREE.BoxGeometry(0.08, 0.02, 0.7);
                      const wingMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
                      const wings = new THREE.Mesh(wingGeo, wingMat);
                      wings.position.y = 0.02;
                      wings.position.x = 0.02;
                      plane.add(wings);
                      
                      // Horizontal stabilizer (tail wings)
                      const hStabGeo = new THREE.BoxGeometry(0.05, 0.015, 0.25);
                      const hStab = new THREE.Mesh(hStabGeo, wingMat);
                      hStab.position.x = -0.22;
                      hStab.position.y = 0.02;
                      plane.add(hStab);
                      
                      // Vertical stabilizer (tail fin)
                      const vStabGeo = new THREE.BoxGeometry(0.06, 0.12, 0.015);
                      const vStabMat = new THREE.MeshBasicMaterial({ color: 0x16a34a });
                      const vStab = new THREE.Mesh(vStabGeo, vStabMat);
                      vStab.position.x = -0.22;
                      vStab.position.y = 0.07;
                      plane.add(vStab);
                      
                      // Engines
                      const engineGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.12, 6);
                      const engineMat = new THREE.MeshBasicMaterial({ color: 0x374151 });
                      
                      const engineL = new THREE.Mesh(engineGeo, engineMat);
                      engineL.rotation.z = Math.PI / 2;
                      engineL.position.set(0.05, -0.05, 0.2);
                      plane.add(engineL);
                      
                      const engineR = new THREE.Mesh(engineGeo, engineMat);
                      engineR.rotation.z = Math.PI / 2;
                      engineR.position.set(0.05, -0.05, -0.2);
                      plane.add(engineR);
                      
                      mesh = plane;
                     
                   } else if (cat === "maritime") {
                     // Ship - elongated box with deck
                     const hullGeo = new THREE.BoxGeometry(0.5, 0.1, 0.15);
                     const hullMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });
                     const hull = new THREE.Mesh(hullGeo, hullMat);
                     
                      const deckGeo = new THREE.BoxGeometry(0.35, 0.08, 0.1);
                      const deckMat = new THREE.MeshBasicMaterial({ color: 0x60a5fa });
                      const deck = new THREE.Mesh(deckGeo, deckMat);
                      deck.position.y = 0.08;
                      
                      // Bridge
                      const bridgeGeo = new THREE.BoxGeometry(0.15, 0.1, 0.08);
                      const bridgeMat = new THREE.MeshBasicMaterial({ color: 0x1e40af });
                      const bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
                      bridge.position.set(0.1, 0.14, 0);
                      hull.add(bridge);
                      
                      // Mast/radar
                      const mastGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.12, 4);
                      const mastMat = new THREE.MeshBasicMaterial({ color: 0x374151 });
                      const mast = new THREE.Mesh(mastGeo, mastMat);
                      mast.position.set(-0.05, 0.16, 0);
                      hull.add(mast);
                      
                      // Radar dish
                      const radarGeo = new THREE.SphereGeometry(0.025, 6, 6);
                      const radarMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
                      const radar = new THREE.Mesh(radarGeo, radarMat);
                      radar.position.set(-0.05, 0.22, 0);
                      hull.add(radar);
                      
                      mesh = new THREE.Group();
                      mesh.add(hull);
                      mesh.add(deck);
                     
                   } else if (cat === "space") {
                     // Satellite - octahedron with panels
                     const bodyGeo = new THREE.OctahedronGeometry(0.12, 0);
                     const bodyMat = new THREE.MeshBasicMaterial({ color: 0x14b8a6 });
                     const body = new THREE.Mesh(bodyGeo, bodyMat);
                     
                     // Solar panels
                     const panelGeo = new THREE.BoxGeometry(0.4, 0.01, 0.15);
                     const panelMat = new THREE.MeshBasicMaterial({ color: 0x0d9488 });
                     const panels = new THREE.Mesh(panelGeo, panelMat);
                     
                     mesh = new THREE.Group();
                     mesh.add(body);
                     mesh.add(panels);
                     mesh.rotation.z = Math.PI / 4;
                     
                   } else {
                     // Default - icosahedron
                     const geo = new THREE.IcosahedronGeometry(0.15, 0);
                     const mat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
                     mesh = new THREE.Mesh(geo, mat);
                   }
                   
                   return mesh;
                 }}
                 htmlElementsData={overlayEvents}
                htmlLat={(d: any) => d.lat}
                htmlLng={(d: any) => d.lon}
                htmlAltitude={0.015}
                htmlElement={(d: any) => {
                  const el = document.createElement("div");
                  const cat = d.category;
                  // Use geometric symbols instead of emojis
                  const icon = cat === "air" ? "▲" : cat === "maritime" ? "▬" : cat === "space" ? "◇" : "●";
                  const color = cat === "air" ? "#22c55e" : cat === "maritime" ? "#3b82f6" : cat === "space" ? "#14b8a6" : "#06b6d4";
                  const size = 14;
                  el.innerHTML = `<div style="
                    width: ${size}px;
                    height: ${size}px;
                    background: ${color};
                    border-radius: ${cat === "air" ? "2px" : cat === "maritime" ? "1px" : "50%"};
                    border: 2px solid white;
                    box-shadow: 0 0 8px ${color}, 0 0 16px ${color}66;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 8px;
                    font-weight: bold;
                    color: white;
                  ">${icon}</div>`;
                  el.style.pointerEvents = "auto";
                  el.style.cursor = "pointer";
                  return el;
                }}
                pointsData={validEvents}
                pointLat={(d: any) => d.lat}
                pointLng={(d: any) => d.lon}
pointColor={(d: any) => {
                    const sev = (d as any).severity;
                    const cat = (d as any).category;
                    let color = "#ffd700";
                    if (cat === "air") {
                      color = "#22c55e";
                    } else if (cat === "maritime") {
                      color = "#3b82f6";
                    } else if (cat === "space") {
                      color = "#14b8a6";
                    } else if (cat === "cameras") {
                      color = "#06b6d4";
                    } else if (cat === "radio") {
                      // Check if it's an SDR signal
                      if ((d as any).frequency !== undefined || (d as any).signalType !== undefined) {
                        color = "#ff6b6d"; // Reddish-orange for SDR
                      } else {
                        color = "#eab308"; // Default radio color
                      }
                    } else if (cat === "conflict") {
                        color = "#ef4444";
                    } else if (cat === "cyber") {
                        color = "#a855f7";
                    } else if (cat === "land") {
                        color = "#f97316";
                    } else if (cat === "weather") {
                        color = "#60a5fa";
                    } else if (cat === "earthquakes") {
                        color = "#9333ea";
                    } else if (cat === "social") {
                        color = "#ec4899";
                    }
                    
                    if (sev === "critical") return "#ef4444";
                    if (sev === "high") return "#f97316";
                    if (sev === "low") return color + "99";
                    return color;
                  }}
                pointAltitude={0.005}
                pointRadius={(d: any) => {
                  const sev = (d as any).severity;
                  const base = pointSize / 100;
                  if (sev === "critical") return base * 1.8;
                  if (sev === "high") return base * 1.3;
                  if (sev === "low") return base * 0.6;
                  return base;
                }}
                pointsMerge={false} /* clustering disabled: merging destroys click data */ /* clustering disabled: merging destroys click data */
                onPointClick={(p: any) => {
                  if (!p?.id) return;
                  if (p.category === "cameras" && p.streamUrl) {
                    setCameraViewer({ event: p, url: p.streamUrl });
                  } else {
                    setSelectedEvent(p);
                    setActiveRightTab("details");
                  }
                }}
                onPointHover={(h: any) => setHoveredEvent(h || null)}
                onGlobeClick={({ lat, lng }: { lat: number; lng: number }) => {
                  if (collaborationRoom && socketRef.current) {
                    socketRef.current.emit("collab:cursor", { room: collaborationRoom, lat, lng });
                  }
                }}
                hexBinPointsData={hexBinData}
                hexBinPointLat={(d: any) => d.lat}
                hexBinPointLng={(d: any) => d.lon}
                hexBinPointWeight={1}
                hexBinResolution={2}
                hexBinColor={(d: any) => {
                  const n = d.points.length;
                  return n > 30 ? "#ef4444" : n > 20 ? "#f97316" : n > 10 ? "#eab308" : "#22c55e";
                }}
                ringsData={ringsData}
                ringLat={(d: any) => d.lat}
                ringLng={(d: any) => d.lon}
                ringColor={(d: any) => {
                  const sev = d.severity;
                  if (sev === "critical") return "rgba(239,68,68,0.8)";
                  if (sev === "high") return "rgba(249,115,22,0.7)";
                  return CATEGORY_COLORS[d.category] || "rgba(255,200,0,0.5)";
                }}
                ringAltitude={0.005}
                ringRadius={0.3}
                arcsData={arcData}
                arcStartLat={(d: any) => d.startLat}
                arcStartLng={(d: any) => d.startLng}
                arcEndLat={(d: any) => d.endLat}
                arcEndLng={(d: any) => d.endLng}
                arcColor={(d: any) => d.color}
                arcAltitude={0.2}
                arcDashLength={0.3}
                arcDashGap={0.2}
                arcDashAnimateTime={1500}
                heatmapsData={heatmapData}
                heatmapPointLat={(p: any) => p.lat}
                heatmapPointLng={(p: any) => p.lon}
                heatmapPointWeight={1}
                heatmapBandwidth={2}
                pathsData={pathsData}
                pathPoints={(d: any) => d.path}
                pathPointLat={(p: any) => p[0]}
                pathPointLng={(p: any) => p[1]}
                pathColor={(d: any) => d.color}
                pathStroke={1.5}
                
                // Camera markers layer
                markersData={cameraMarkers}
                markerLat={(d: any) => d.lat}
                markerLng={(d: any) => d.lon}
                markerSize={(d: any) => d.size}
                markerColor={(d: any) => d.color}
                markerRadius={0.3}
                markerAltitude={0.02}
                
                animateIn
                enablePointerInteraction
              />
            );
          })()}

          {/* Hover tooltip */}
          {hoveredEvent && !selectedEvent && (
            <div className="hover-tooltip" style={{ bottom: showBottomPanel ? 92 : 20, left: showLeftPanel ? 300 : 20 }}>
              <div className="ht-header">
                <span className="ht-icon">{CATEGORY_ICONS[hoveredEvent.category]}</span>
                <div>
                  <div className="ht-type">{hoveredEvent.type}</div>
                  <div className="ht-cat" style={{ color: CATEGORY_COLORS[hoveredEvent.category] }}>{hoveredEvent.category.toUpperCase()}</div>
                </div>
              </div>
              <div className="ht-date">{hoveredEvent.date}</div>
              <div className="ht-desc">{hoveredEvent.description?.substring(0, 100)}…</div>
            </div>
          )}

          {/* Loading overlay */}
          {loading && (
            <div className="loading-overlay">
              <div className="loading-card">
                <div className="loading-spinner" />
                <span className="loading-text">Loading OSINT Data…</span>
              </div>
            </div>
          )}

          {/* Voice transcript */}
          {voiceEnabled && transcript && (
            <div className="voice-transcript">VC {transcript}</div>
          )}
        </div>

        {/* Bottom timeline */}
        {showBottomPanel && (
          <div className="panel panel-bottom">
            <div className="timeline-bar">
              <div className="timeline-controls">
                <button
                  className="play-btn"
                  style={{ background: isPlaying ? "var(--red)" : "var(--accent)" }}
                  onClick={() => setIsPlaying(p => !p)}
                >
                  {isPlaying ? "⏸" : "▶"}
                </button>
                <select value={playbackSpeed} onChange={e => setPlaybackSpeed(+e.target.value)}>
                  <option value={0.5}>0.5×</option>
                  <option value={1}>1×</option>
                  <option value={2}>2×</option>
                  <option value={5}>5×</option>
                </select>
                <input type="range" min={0} max={100} value={timelinePosition} onChange={e => setTimelinePosition(+e.target.value)} style={{ flex: 1 }} />
                <div className="timeline-meta">
                  <span>{timeRange[0].toLocaleDateString()}</span>
                  {" → "}
                  <span>{timeRange[1].toLocaleDateString()}</span>
                  {"  "}
                  <span style={{ color: "var(--green)" }}>{validEvents.length} events</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Right Panel ── */}
      {showRightPanel && (
        <div className="panel panel-right">
          <div className="tab-bar">
            {([
              ["details", "EVT", "Event"],
              ["analytics", "ANA", "Analytics"],
              ["entities", "NET", "Network"],
              ["timeline", "TML", "Timeline"],
            ] as [RightTab, string, string][]).map(([tab, icon, label]) => (
              <button key={tab} className={cls("tab-btn", activeRightTab === tab && "active")} onClick={() => setActiveRightTab(tab)}>
                <span className="tab-icon">{icon}</span>
                {label}
              </button>
            ))}
          </div>

          <div className="panel-scroll">
            {/* ── Details ── */}
            {activeRightTab === "details" && (
              selectedEvent ? (
                <div>
                  <div className="event-header">
                    <div className="event-title">
                      <span className="event-icon" style={{ color: CATEGORY_COLORS[selectedEvent.category] }}>{CATEGORY_ICONS[selectedEvent.category]}</span>
                      <div>
                        <div className="event-type">{selectedEvent.type}</div>
                        <span className="event-cat-badge" style={{ background: `${CATEGORY_COLORS[selectedEvent.category]}22`, color: CATEGORY_COLORS[selectedEvent.category] }}>
                          {selectedEvent.category.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <button style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: "1rem" }} onClick={() => setSelectedEvent(null)}>X</button>
                  </div>

                  <div className="event-date">{selectedEvent.date}</div>
                  <div className="event-desc">{selectedEvent.description}</div>

                  <div className="event-grid">
                    <div className="event-field">
                      <div className="event-field-label">Coordinates</div>
                      <div className="event-field-value" style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem" }}>
                        {selectedEvent.lat.toFixed(4)}, {selectedEvent.lon.toFixed(4)}
                      </div>
                    </div>
                    <div className="event-field">
                      <div className="event-field-label">Severity</div>
                      <div className="event-field-value" style={{ color: SEVERITY_COLORS[selectedEvent.severity || "medium"], fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>
                        {selectedEvent.severity || "medium"}
                      </div>
                    </div>
                    <div className="event-field">
                      <div className="event-field-label">Source</div>
                      <div className="event-field-value">{selectedEvent.source || "Unknown"}</div>
                    </div>
                    <div className="event-field">
                      <div className="event-field-label">Country</div>
                      <div className="event-field-value">{selectedEvent.country || "N/A"}</div>
                    </div>
                  </div>

                  <div className="event-actions">
                    <button className="action-btn action-btn-primary" onClick={() => {
                      saveAs(new Blob([JSON.stringify(selectedEvent, null, 2)], { type: "application/json" }), `event-${selectedEvent.id}.json`);
                    }}>↓ JSON</button>
                    <button className="action-btn action-btn-ghost" onClick={exportKML}>⊞ KML</button>
                    <button className="action-btn action-btn-ghost" onClick={exportGeoJSON}>⊕ GeoJSON</button>
                    <button className="action-btn action-btn-ghost" onClick={() => focusLocation(selectedEvent.lat, selectedEvent.lon, 0.8)}>⊕ Zoom</button>
                  </div>

                  {/* Nearby events */}
                  {(() => {
                    const nearby = validEvents.filter(e =>
                      e.id !== selectedEvent.id &&
                      Math.abs(e.lat - selectedEvent.lat) < 5 &&
                      Math.abs(e.lon - selectedEvent.lon) < 5
                    ).slice(0, 6);
                    if (nearby.length === 0) return null;
                    return (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "1px", color: "var(--text-3)", textTransform: "uppercase", marginBottom: 6 }}>
                          Nearby Events ({nearby.length})
                        </div>
                        {nearby.map(e => (
                          <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                            onClick={() => { setSelectedEvent(e); focusLocation(e.lat, e.lon, 1.5); }}>
                            <span style={{ color: CATEGORY_COLORS[e.category], fontSize: "0.8rem" }}>{CATEGORY_ICONS[e.category]}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: "0.7rem", color: "var(--text-1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.type}</div>
                              <div style={{ fontSize: "0.62rem", color: "var(--text-3)" }}>{e.source} · {new Date(e.date).toLocaleDateString()}</div>
                            </div>
                            <span style={{ fontSize: "0.6rem", color: SEVERITY_COLORS[e.severity || "medium"], flexShrink: 0 }}>● {e.severity || "med"}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Nearby events */}
                  {(() => {
                    const nearby = validEvents.filter(e =>
                      e.id !== selectedEvent.id &&
                      Math.abs(e.lat - selectedEvent.lat) < 5 &&
                      Math.abs(e.lon - selectedEvent.lon) < 5
                    ).slice(0, 6);
                    if (nearby.length === 0) return null;
                    return (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "1px", color: "var(--text-3)", textTransform: "uppercase", marginBottom: 6 }}>
                          Nearby Events ({nearby.length})
                        </div>
                        {nearby.map(e => (
                          <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                            onClick={() => { setSelectedEvent(e); focusLocation(e.lat, e.lon, 1.5); }}>
                            <span style={{ color: CATEGORY_COLORS[e.category], fontSize: "0.8rem" }}>{CATEGORY_ICONS[e.category]}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: "0.7rem", color: "var(--text-1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.type}</div>
                              <div style={{ fontSize: "0.62rem", color: "var(--text-3)" }}>{e.source} · {new Date(e.date).toLocaleDateString()}</div>
                            </div>
                            <span style={{ fontSize: "0.6rem", color: SEVERITY_COLORS[e.severity || "medium"], flexShrink: 0 }}>● {e.severity || "med"}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <EmptyState icon="D" text="Select an event on the globe" sub="Click any point to inspect it" />
              )
            )}

            {/* ── Analytics ── */}
            {activeRightTab === "analytics" && (
              <>
                <div className="stat-card">
                  <div className="stat-num">{analytics.total}</div>
                  <div className="stat-sub">Avg {analytics.avgPerDay} events / day</div>
                </div>

                <div className="section">
                  <SectionLabel>By Category</SectionLabel>
                  {Object.entries(analytics.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                    <div key={cat} className="cat-row">
                      <span className="cat-icon" style={{ color: CATEGORY_COLORS[cat] }}>{CATEGORY_ICONS[cat]}</span>
                      <span className="cat-name">{cat}</span>
                      <span className="cat-count" style={{ color: CATEGORY_COLORS[cat] }}>{count}</span>
                      <div style={{ width: 48 }}>
                        <div className="bar-track">
                          <div className="bar-fill" style={{ background: CATEGORY_COLORS[cat], width: `${Math.round((count / analytics.total) * 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="section">
                  <SectionLabel>By Severity</SectionLabel>
                  {Object.entries(analytics.bySeverity).map(([sev, count]) => (
                    <div key={sev} className="sev-row">
                      <span className="sev-dot" style={{ background: SEVERITY_COLORS[sev] }} />
                      <span className="sev-name">{sev}</span>
                      <span className="sev-count" style={{ color: SEVERITY_COLORS[sev] }}>{count}</span>
                    </div>
                  ))}
                </div>

                <div className="section">
                  <SectionLabel>Export</SectionLabel>
                  <div style={{ display: "flex", gap: 7 }}>
                    <button className="action-btn action-btn-primary" style={{ flex: 1 }} onClick={exportCSV}>↓ CSV</button>
                    <button className="action-btn action-btn-ghost" style={{ flex: 1 }} onClick={exportGeoJSON}>GeoJSON</button>
                    <button className="action-btn action-btn-ghost" style={{ flex: 1 }} onClick={exportKML}>KML</button>
                  </div>
                </div>
              </>
            )}

            {/* ── Entities ── */}
            {activeRightTab === "entities" && (
              entityGraph.nodes.length === 0 ? (
                <EmptyState icon="⊕" text="No entity data" sub="Add entities to events to build the graph" />
              ) : (
                <>
                  <div className="section">
                    <SectionLabel>Nodes: {entityGraph.nodes.length} · Links: {entityGraph.links.length}</SectionLabel>
                    <div className="pill-group">
                      {entityGraph.nodes.slice(0, 40).map((n, i) => (
                        <span key={i} className="entity-chip"
                          style={{
                            background: n.type === "entity" ? "rgba(239,68,68,0.15)" : "rgba(59,130,246,0.15)",
                            color: n.type === "entity" ? "#ef4444" : "#3b82f6",
                          }}>
                          {n.id}{n.events > 0 && <span style={{ opacity: 0.6 }}> ×{n.events}</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )
            )}

            {/* ── Timeline ── */}
            {activeRightTab === "timeline" && (() => {
              const sorted = [...searchFilteredEvents].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
              const oldest = sorted.length > 0 ? new Date(sorted[sorted.length - 1].date) : new Date();
              const newest = sorted.length > 0 ? new Date(sorted[0].date) : new Date();
              const fmtDate = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
              const fmtTime = (d: Date) => {
                const diff = Date.now() - d.getTime();
                if (diff < 3600000) return `${Math.round(diff/60000)}m ago`;
                if (diff < 86400000) return `${Math.round(diff/3600000)}h ago`;
                return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
              };
              // Group by day
              const byDay: Record<string, typeof sorted> = {};
              sorted.slice(0, 100).forEach(e => {
                const day = new Date(e.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
                if (!byDay[day]) byDay[day] = [];
                byDay[day].push(e);
              });
              return (
                <div>
                  <div style={{ marginBottom: 10 }}>
                    <SectionLabel>{searchFilteredEvents.length} Events</SectionLabel>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: "var(--text-3)", fontFamily: "var(--font-mono)", marginTop: 4 }}>
                      <span>{fmtDate(oldest)}</span>
                      <span>{fmtDate(newest)}</span>
                    </div>
                    <input
                      type="range" min={0} max={100} value={timelinePosition}
                      onChange={e => setTimelinePosition(+e.target.value)}
                      style={{ width: "100%", marginTop: 6, accentColor: "var(--accent)" }}
                    />
                    <div style={{ fontSize: "0.65rem", color: "var(--accent)", fontFamily: "var(--font-mono)", textAlign: "center" }}>
                      Showing {validEvents.length} of {searchFilteredEvents.length} events
                    </div>
                  </div>
                  {Object.entries(byDay).map(([day, dayEvents]) => (
                    <div key={day}>
                      <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "1px", color: "var(--text-3)", textTransform: "uppercase", padding: "8px 0 4px", borderBottom: "1px solid var(--border)" }}>
                        {day} · {dayEvents.length} events
                      </div>
                      {dayEvents.map((e, i) => (
                        <div
                          key={e.id || i}
                          className={cls("tl-item", selectedEvent?.id === e.id && "selected")}
                          style={{ borderLeftColor: selectedEvent?.id === e.id ? "var(--accent)" : CATEGORY_COLORS[e.category] }}
                          onClick={() => { setSelectedEvent(e); focusLocation(e.lat, e.lon, 1.5); setActiveRightTab("details"); }}
                        >
                          <div className="tl-item-top">
                            <span className="tl-item-title">{(e.type || "").substring(0, 45)}</span>
                            <span className="tl-item-date">{fmtTime(new Date(e.date))}</span>
                          </div>
                          <div className="tl-item-meta">
                            <span style={{ color: CATEGORY_COLORS[e.category] }}>{CATEGORY_ICONS[e.category]} {e.category}</span>
                            <span style={{ color: SEVERITY_COLORS[e.severity || "medium"] }}>● {e.severity || "medium"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── Floating panels ── */}

      {/* Analytics overlay */}
      {showAnalytics && (
        <FloatPanel title="A Deep Analytics" onClose={() => setShowAnalytics(false)} style={{ top: 80, left: 20, width: 400 }}>
          <div className="stat-card" style={{ marginBottom: 12 }}>
            <div className="stat-num">{analytics.total}</div>
            <div className="stat-sub">Total events · {analytics.avgPerDay}/day avg</div>
          </div>
          <SectionLabel>Category Breakdown</SectionLabel>
          {Object.entries(analytics.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
            <div key={cat} className="cat-row">
              <span className="cat-icon" style={{ color: CATEGORY_COLORS[cat] }}>{CATEGORY_ICONS[cat]}</span>
              <span className="cat-name">{cat}</span>
              <span className="cat-count" style={{ color: CATEGORY_COLORS[cat] }}>{count}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", color: "var(--text-3)" }}>
                {((count / analytics.total) * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </FloatPanel>
      )}

      {/* Entity graph overlay */}
      {showEntityGraph && (
        <FloatPanel title="⊕ Entity Graph" onClose={() => setShowEntityGraph(false)} style={{ top: 80, left: 20, width: 440, maxHeight: "60vh" }}>
          {entityGraph.nodes.length === 0 ? (
            <EmptyState icon="⊕" text="No entities in current data" />
          ) : (
            <div className="pill-group">
              {entityGraph.nodes.map((n, i) => (
                <span key={i} className="entity-chip"
                  style={{
                    padding: "8px 14px", borderRadius: 20,
                    background: n.type === "entity" ? "rgba(239,68,68,0.15)" : "rgba(59,130,246,0.15)",
                    color: n.type === "entity" ? "#ef4444" : "#3b82f6",
                  }}>
                  {n.id}
                </span>
              ))}
            </div>
          )}
        </FloatPanel>
      )}

      {/* Time Machine */}
      {showTimeMachine && (
        <FloatPanel title="⏲ Time Machine" onClose={() => setShowTimeMachine(false)} style={{ top: 80, left: 20, width: 360 }}>
          <div style={{ marginBottom: 16 }}>
            <div className="range-label" style={{ marginBottom: 6 }}><span>Historical Date</span><span>{historicalDate.toLocaleDateString()}</span></div>
            <input type="date" className="text-input" value={historicalDate.toISOString().split("T")[0]} onChange={e => setHistoricalDate(new Date(e.target.value))} />
          </div>
          <CheckRow checked={timeLapseMode} onChange={setTimeLapseMode} icon="▶" label="Time-lapse Mode" />
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button className="full-btn" style={{ flex: 1, background: "var(--surface2)", color: "var(--text-2)" }} onClick={() => setHistoricalDate(new Date(historicalDate.getTime() - 86400000))}>
              ← Prev
            </button>
            <button className="full-btn full-btn-primary" style={{ flex: 1 }} onClick={() => setHistoricalDate(new Date())}>Today</button>
            <button className="full-btn" style={{ flex: 1, background: "var(--surface2)", color: "var(--text-2)" }} onClick={() => setHistoricalDate(new Date(historicalDate.getTime() + 86400000))}>
              Next →
            </button>
          </div>
        </FloatPanel>
      )}

      {/* Report panel */}
      {showReportPanel && (
        <FloatPanel title="R Generate Report" onClose={() => setShowReportPanel(false)} style={{ top: 80, right: 20, width: 340 }}>
          <SectionLabel>Report Type</SectionLabel>
          <div className="report-grid">
            {(["summary", "detailed", "analytics"] as ReportType[]).map(t => (
              <button key={t} className={cls("report-btn", reportType === t && "active")} onClick={() => setReportType(t)}>
                <div className="report-btn-icon">{t === "summary" ? "S" : t === "detailed" ? "D" : "A"}</div>
                <div className="report-btn-label">{t}</div>
              </button>
            ))}
          </div>
          <div className="report-desc">
            {reportType === "summary" && "Quick overview: category counts, severity breakdown, and key stats."}
            {reportType === "detailed" && "Full event-by-event listing with all fields and metadata."}
            {reportType === "analytics" && "Statistical analysis with distribution percentages."}
          </div>
          <button className="full-btn" style={{ background: "#7c3aed", color: "#fff" }} onClick={generateReport}>
            ↓ Download Markdown
          </button>
        </FloatPanel>
      )}

      {/* Draw tools */}
      {showDrawTools && (
        <FloatPanel title="D Drawing Tools" onClose={() => setShowDrawTools(false)} style={{ top: 80, left: 20, width: 300 }}>
          <SectionLabel>Mode</SectionLabel>
          <div className="draw-grid">
            {(["none", "circle", "polygon", "line"] as DrawMode[]).map(m => (
              <button key={m} className={cls("draw-btn", drawMode === m && "active")} onClick={() => setDrawMode(m)}>
                <div className="draw-btn-icon">{m === "none" ? "N" : m === "circle" ? "C" : m === "polygon" ? "P" : "L"}</div>
                <div className="draw-btn-label">{m === "none" ? "select" : m}</div>
              </button>
            ))}
          </div>
          {drawMode !== "none" && (
            <div style={{ marginTop: 12, padding: "10px 12px", background: "var(--surface1)", borderRadius: 6, fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--text-3)" }}>
              Click on the globe to place {drawMode} points
            </div>
          )}
          {drawnShapes.length > 0 && (
            <>
              <div className="divider" />
              <SectionLabel>{drawnShapes.length} Shapes</SectionLabel>
              {drawnShapes.map(s => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-2)" }}>{s.type} · {s.points.length}pts</span>
                  <button style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: "0.8rem" }} onClick={() => setDrawnShapes(x => x.filter(y => y.id !== s.id))}>X</button>
                </div>
              ))}
            </>
          )}
        </FloatPanel>
      )}

      {/* Help */}
      {showHelp && (
        <FloatPanel title="⌨ Keyboard Shortcuts" onClose={() => setShowHelp(false)} style={{ top: 80, right: 20, width: 340 }}>
          <div className="shortcut-grid">
            {[["1", "Left panel"], ["2", "Right panel"], ["3", "Timeline"], ["Space", "Play/Pause"], ["R", "Refresh data"], ["H", "Toggle theme"], ["Esc", "Close event"], ["F", "Fullscreen"]].map(([key, action]) => (
              <div key={key} className="shortcut-item">
                <kbd style={{ background: "var(--accent)", color: "#fff", padding: "4px 8px", borderRadius: 4, fontSize: "0.72rem" }}>{key}</kbd>
                <span className="shortcut-action">{action}</span>
              </div>
            ))}
          </div>
          {voiceEnabled && (
            <>
              <div className="divider" />
              <SectionLabel>Voice Commands</SectionLabel>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem", color: "var(--text-3)", lineHeight: 1.8 }}>
                "go to [location]" · "zoom in/out"<br />
                "dark mode" · "light mode" · "refresh"
              </div>
            </>
          )}
        </FloatPanel>
      )}

      {/* Collaboration */}
      {showCollaborators && (
        <FloatPanel title="C Collaboration" onClose={() => setShowCollaborators(false)} style={{ top: 80, right: showRightPanel ? 340 : 20, width: 280 }}>
          {!collaborationRoom ? (
            <>
              <div style={{ marginBottom: 10 }}>
                <div className="range-label" style={{ marginBottom: 5 }}><span>Display Name</span></div>
                <input type="text" className="text-input" value={username} onChange={e => setUsername(e.target.value)} placeholder="Your name" />
              </div>
              <div style={{ marginBottom: 12 }}>
                <div className="range-label" style={{ marginBottom: 5 }}><span>Room</span></div>
                <input type="text" className="text-input" value={roomInput} onChange={e => setRoomInput(e.target.value)} placeholder="Room name" />
              </div>
              <button className="full-btn full-btn-primary" onClick={joinCollaboration}>Join Room</button>
            </>
          ) : (
            <>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--green)", marginBottom: 12 }}>
                ● Connected · {collaborationRoom}
              </div>
              <SectionLabel>Active Users ({collaborators.length + 1})</SectionLabel>
              <div className="collab-user" style={{ color: "var(--accent)" }}>• {username} (you)</div>
               {collaborators.map(c => (
                 <div key={c.id} className="collab-user" style={{ color: c.color }}>• {c.username}</div>
               ))}
              <div style={{ marginTop: 16 }}>
                <button className="full-btn full-btn-red" onClick={leaveCollaboration}>Leave Room</button>
              </div>
            </>
          )}
        </FloatPanel>
      )}

      {/* Live Feed */}
      {showLiveFeed && (
        <div className="float-panel live-feed">
          <div className="float-header">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="live-dot" style={{ background: "var(--red)", boxShadow: "0 0 6px var(--red)" }} />
              <span className="float-title">Live Incidents</span>
            </div>
            <button className="float-close" onClick={() => setShowLiveFeed(false)}>X</button>
          </div>
          <div style={{ overflow: "auto", maxHeight: 280, padding: "10px 14px" }}>
            {liveFeedItems.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text-3)", padding: "20px", fontFamily: "var(--font-mono)", fontSize: "0.72rem" }}>
                Awaiting live feed…
              </div>
            ) : liveFeedItems.map(item => (
              <div key={item.id} className="feed-item" 
                style={{ borderLeftColor: SEVERITY_COLORS[item.severity] || "var(--accent)", cursor: (item as any).event ? "pointer" : "default" }}
                onClick={() => {
                  const ev = (item as any).event;
                  if (ev) { setSelectedEvent(ev); focusLocation(ev.lat, ev.lon, 1.5); setActiveRightTab("details"); }
                }}>
                <div className="feed-item-top">
                  <span className="feed-type" style={{ color: CATEGORY_COLORS[item.type.toLowerCase()] || "var(--text-2)" }}>{item.type}</span>
                  <span className="feed-time">{item.time.toLocaleTimeString()}</span>
                </div>
                <div className="feed-msg">{item.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* OSINT Tools Panel */}
      {showOSINTPanel && (
        <div 
          className="float-panel" 
          style={{ 
            left: 400, 
            top: 100, 
            width: 500, 
            height: 600,
          }}
        >
          <div className="float-header" style={{ background: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)", cursor: 'grab' }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "1.2rem" }}>OSINT</span>
              <span className="float-title" style={{ color: "#fff" }}>OSINT Tools</span>
            </div>
            <button className="float-close" style={{ color: "#fff" }} onClick={() => setShowOSINTPanel(false)}>X</button>
          </div>
          <div className="float-body" style={{ padding: 14, overflow: "auto" }}>
            <div style={{ marginBottom: 14 }}>
              <input 
                type="text" 
                placeholder="Search IPs, domains, emails, usernames..." 
                style={{ 
                  width: "100%", 
                  padding: "10px 14px", 
                  border: "1px solid var(--border)", 
                  borderRadius: 8, 
                  background: "var(--surface2)", 
                  color: "var(--text)",
                  fontSize: "0.85rem",
                }}
                value={osintQuery}
                onChange={e => setOsintQuery(e.target.value)}
                onKeyPress={e => {
                  if (e.key === "Enter" && osintQuery.trim()) {
                    runOSINTSearch(osintQuery);
                  }
                }}
              />
            </div>
            
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              {[
                { label: "IP Lookup", icon: "IP", action: () => runOSINTSearch(osintQuery || "ip") },
                { label: "Domain", icon: "DN", action: () => runOSINTSearch(osintQuery || "domain") },
                { label: "Email", icon: "EM", action: () => runOSINTSearch(osintQuery || "email") },
                { label: "Username", icon: "UN", action: () => runOSINTSearch(osintQuery || "username") },
                { label: "Phone", icon: "PH", action: () => runOSINTSearch(osintQuery || "phone") },
                { label: "Breach Check", icon: "HB", action: () => runOSINTSearch(osintQuery || "breach") },
              ].map(btn => (
                <button 
                  key={btn.label}
                  className="full-btn full-btn-primary"
                  style={{ padding: "6px 12px", fontSize: "0.7rem", borderRadius: 6 }}
                  onClick={btn.action}
                >
                  {btn.icon} {btn.label}
                </button>
              ))}
            </div>

            {osintLoading && (
              <div style={{ textAlign: "center", padding: 20, color: "var(--text-3)" }}>
                Searching OSINT databases...
              </div>
            )}

            {osintResults.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {osintResults.map((result, i) => (
                  <div key={i} style={{ 
                    background: "var(--surface2)", 
                    padding: 12, 
                    borderRadius: 8,
                    borderLeft: `3px solid ${result.severity === "critical" ? "#ef4444" : result.severity === "high" ? "#f97316" : "#22c55e"}`
                  }}>
                    <div style={{ fontWeight: "bold", marginBottom: 4, color: "var(--text)" }}>
                      {result.source}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-2)", marginBottom: 6 }}>
                      {result.description}
                    </div>
                    {result.data && (
                      <pre style={{ fontSize: "0.7rem", background: "var(--bg)", padding: 8, borderRadius: 4, overflow: "auto", maxHeight: 100 }}>
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 14 }}>
              <SectionLabel>Quick Tools</SectionLabel>
              <div className="osint-grid" style={{ marginTop: 8 }}>
                {[
                  { name: "Shodan", url: "https://www.shodan.io/search?query=", desc: "IoT Search", icon: "S" },
                  { name: "Censys", url: "https://censys.io/ipv4/", desc: "Host Search", icon: "C" },
                  { name: "VirusTotal", url: "https://www.virustotal.com/gui/search/", desc: "Malware", icon: "V" },
                  { name: "HaveIBeenPwned", url: "https://haveibeenpwned.com/", desc: "Breaches", icon: "H" },
                  { name: "Hunter", url: "https://hunter.io/", desc: "Emails", icon: "Hu" },
                  { name: "GreyNoise", url: "https://viz.greynoise.io/", desc: "Threats", icon: "G" },
                  { name: "ZoomEye", url: "https://www.zoomeye.org/", desc: "China IoT", icon: "Z" },
                  { name: "Crt.sh", url: "https://crt.sh/", desc: "Certificates", icon: "Cr" },
                ].map(tool => (
                  <a
                    key={tool.name}
                    href={tool.url + osintQuery}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="osint-card"
                    style={{ textDecoration: "none" }}
                  >
                    <span className="osint-name">{tool.icon} {tool.name}</span>
                    <span className="osint-desc">{tool.desc}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Camera Viewer Panel */}
      {showCameraPanel && (
        <div 
          className="float-panel" 
          style={{ 
            left: 400, 
            top: 100, 
            width: 550, 
            height: 620,
          }}
        >
          <div className="float-header" style={{ background: "linear-gradient(135deg, #ec4899 0%, #be185d 100%)", cursor: 'grab' }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "1.2rem" }}>CAM</span>
              <span className="float-title" style={{ color: "#fff" }}>Camera Scanner</span>
            </div>
            <button className="float-close" style={{ color: "#fff" }} onClick={() => setShowCameraPanel(false)}>X</button>
          </div>
          <div className="float-body" style={{ padding: 14, overflow: "auto", height: "calc(100% - 45px)" }}>
            {/* Dork Generator Section */}
            <div style={{ marginBottom: 16 }}>
              <SectionLabel>Google Dork Generator</SectionLabel>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input 
                  type="text" 
                  placeholder="Enter target domain or keyword..." 
                  style={{ 
                    flex: 1,
                    padding: "10px 14px", 
                    border: "1px solid var(--border)", 
                    borderRadius: 8, 
                    background: "var(--surface2)", 
                    color: "var(--text)",
                    fontSize: "0.85rem",
                  }}
                  value={dorkQuery}
                  onChange={e => setDorkQuery(e.target.value)}
                />
                <button 
                  className="full-btn full-btn-primary"
                  style={{ padding: "10px 16px", fontSize: "0.8rem" }}
                  onClick={() => generateDorks(dorkQuery)}
                >
                  Generate
                </button>
              </div>
              
              {dorkResults.length > 0 && (
                <div style={{ marginTop: 12, maxHeight: 120, overflow: "auto" }}>
                  {dorkResults.slice(0, 5).map((d, i) => (
                    <div key={i} style={{ 
                      background: "var(--surface2)", 
                      padding: 8, 
                      borderRadius: 6,
                      marginBottom: 4,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "0.75rem",
                    }}>
                      <span style={{ color: "var(--text-2)" }}>{d.category}</span>
                      <code style={{ color: "var(--accent)" }}>{d.query}</code>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Camera Scanner Section */}
            <div style={{ marginBottom: 16 }}>
              <SectionLabel>Camera Sources</SectionLabel>
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                <button 
                  className="full-btn"
                  style={{ padding: "6px 12px", fontSize: "0.7rem", background: cameraResults.some(c => c.source === 'Insecam') ? "var(--accent)" : "var(--surface2)" }}
                  onClick={() => loadCameras('insecam')}
                >
                  Insecam
                </button>
                <button 
                  className="full-btn"
                  style={{ padding: "6px 12px", fontSize: "0.7rem" }}
                  onClick={() => loadCameras('traffic')}
                >
                  Traffic Cams
                </button>
                <button 
                  className="full-btn"
                  style={{ padding: "6px 12px", fontSize: "0.7rem" }}
                  onClick={() => loadCameras('all')}
                >
                  All Sources
                </button>
              </div>
            </div>

            {/* Camera Display Section */}
            {cameraLoading && (
              <div style={{ textAlign: "center", padding: 20, color: "var(--text-3)" }}>
                Loading camera feeds...
              </div>
            )}

            {selectedCamera ? (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: "bold", color: "var(--text)" }}>{selectedCamera.title || selectedCamera.source}</span>
                  <button 
                    onClick={() => setSelectedCamera(null)}
                    style={{ background: "var(--surface2)", border: "none", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: "0.7rem" }}
                  >
                    Close
                  </button>
                </div>
                <div style={{ 
                  background: "#000", 
                  borderRadius: 8, 
                  overflow: "hidden",
                  height: 250,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-3)",
                }}>
                  {selectedCamera.url ? (
                    <iframe 
                      src={selectedCamera.url} 
                      style={{ width: "100%", height: "100%", border: "none" }}
                      title={selectedCamera.title || selectedCamera.source}
                    />
                  ) : (
                    <span>Camera feed unavailable</span>
                  )}
                </div>
              </div>
            ) : null}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {cameraResults.length > 0 ? (
                cameraResults.map((cam, i) => (
                  <div key={i} style={{ 
                    background: "var(--surface2)", 
                    padding: 12, 
                    borderRadius: 8,
                    borderLeft: `3px solid ${cam.type === 'traffic' ? '#ec4899' : '#8b5cf6'}`,
                    cursor: 'pointer',
                    opacity: cam.status === 'unavailable' ? 0.5 : 1,
                  }}
                  onClick={() => setSelectedCamera(cam)}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div style={{ fontWeight: "bold", marginBottom: 4, color: "var(--text)" }}>
                        {cam.title || cam.source}
                      </div>
                      <span style={{ fontSize: "0.7rem", color: cam.status === 'active' ? '#22c55e' : '#f97316' }}>
                        {cam.status || 'active'}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-2)" }}>
                      {cam.url}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: "center", padding: 20, color: "var(--text-3)", fontSize: "0.8rem" }}>
                  No cameras loaded. Click a source button above.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Graph/Visualization Panel */}
      {showGraphPanel && (
        <div 
          className="float-panel" 
          style={{ 
            left: 450, 
            top: 100, 
            width: 420, 
            height: 520,
          }}
        >
          <div className="float-header" style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", cursor: 'grab' }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "1.2rem" }}>GRPH</span>
              <span className="float-title" style={{ color: "#fff" }}>Data Visualizations</span>
            </div>
            <button className="float-close" style={{ color: "#fff" }} onClick={() => setShowGraphPanel(false)}>X</button>
          </div>
          <div className="float-body" style={{ padding: 14, overflow: "auto" }}>
            <div style={{ marginBottom: 14 }}>
              <SectionLabel>Overlay Type</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                {[
                  { id: "arcs", label: "Arc Connections", icon: "↗", desc: "Connect related events" },
                  { id: "heatmap", label: "Heat Map", icon: "≡", desc: "Density visualization" },
                  { id: "clusters", label: "Heat Clusters", icon: "◉", desc: "Hex bin clustering" },
                  { id: "rings", label: "Pulse Rings", icon: "○", desc: "Event ripples" },
                  { id: "paths", label: "Path Lines", icon: "╱", desc: "Movement routes" },
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setGraphType(opt.id as any);
                      setLayer(`show${opt.id.charAt(0).toUpperCase() + opt.id.slice(1)}` as any, true);
                    }}
                    style={{
                      padding: "10px 12px",
                      background: graphType === opt.id ? "var(--accent)" : "var(--surface2)",
                      border: `1px solid ${graphType === opt.id ? "var(--accent)" : "var(--border)"}`,
                      borderRadius: 8,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div style={{ fontSize: "0.85rem", fontWeight: "bold", color: graphType === opt.id ? "#fff" : "var(--text)" }}>
                      {opt.icon} {opt.label}
                    </div>
                    <div style={{ fontSize: "0.65rem", color: graphType === opt.id ? "#fff99" : "var(--text-3)", marginTop: 2 }}>
                      {opt.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="section">
              <SectionLabel>Active Layers</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                <CheckRow checked={layers.showArcs} onChange={v => setLayer("showArcs", v)} icon="↗" label="Arc Connections" />
                <CheckRow checked={layers.showHeatmap} onChange={v => setLayer("showHeatmap", v)} icon="≡" label="Heat Map" />
                <CheckRow checked={layers.showHexBin} onChange={v => setLayer("showHexBin", v)} icon="◉" label="Heat Clusters" />
                <CheckRow checked={layers.showRings} onChange={v => setLayer("showRings", v)} icon="○" label="Pulse Rings" />
                <CheckRow checked={layers.showPaths} onChange={v => setLayer("showPaths", v)} icon="╱" label="Path Lines" />
              </div>
            </div>

            <div className="section">
              <SectionLabel>Statistics</SectionLabel>
              <div style={{ fontSize: "0.75rem", color: "var(--text-2)", marginTop: 8, fontFamily: "var(--font-mono)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                  <span>Arc Connections:</span>
                  <span style={{ color: "var(--accent)" }}>{arcData.length}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                  <span>Heatmap Points:</span>
                  <span style={{ color: "#ef4444" }}>{heatmapData.length}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                  <span>Cluster Cells:</span>
                  <span style={{ color: "#f59e0b" }}>{hexBinData.length}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                  <span>Pulse Rings:</span>
                  <span style={{ color: "#8b5cf6" }}>{ringsData.length}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                  <span>Path Lines:</span>
                  <span style={{ color: "#06b6d4" }}>{pathsData.length}</span>
                </div>
              </div>
            </div>

            <div className="section">
              <SectionLabel>Description</SectionLabel>
              <p style={{ fontSize: "0.75rem", color: "var(--text-2)", marginTop: 4, lineHeight: 1.5 }}>
                {graphType === "arcs" && "Arc connections show relationships between events - severity chains, source networks, and category clusters."}
                {graphType === "heatmap" && "Heat map displays event density - warmer colors indicate higher concentration of activity."}
                {graphType === "clusters" && "Hex bin clustering groups nearby events into hexagonal cells for density analysis."}
                {graphType === "rings" && "Pulse rings animate outward from events to show temporal spread of incidents."}
                {graphType === "paths" && "Path lines show movement routes - arms transfers, flight paths, naval routes."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Intelligence Panel - All OSINT Tools */}
      {showIntelligencePanel && (
        <div className="float-panel" style={{ left: 450, top: 80, width: 600, height: 700 }}>
          <div className="float-header" style={{ background: "linear-gradient(135deg, #dc2626 0%, #991b1b 100%)", cursor: 'grab' }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "1.2rem" }}>INT</span>
              <span className="float-title" style={{ color: "#fff" }}>Intelligence Center</span>
            </div>
            <button className="float-close" style={{ color: "#fff" }} onClick={() => setShowIntelligencePanel(false)}>X</button>
          </div>
          <div className="float-body" style={{ padding: 10, overflow: "auto", height: "calc(100% - 50px)" }}>
            {/* Intelligence Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
              {[
                { id: "threats", label: "Threats", icon: "⚠" },
                { id: "bounty", label: "Bug Bounty", icon: "B" },
                { id: "patterns", label: "Patterns", icon: "◈" },
                { id: "research", label: "Research", icon: "R" },
                { id: "pentest", label: "Pentest", icon: "P" },
                { id: "reports", label: "Reports", icon: "📋" },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setIntelligenceTab(tab.id as any)}
                  style={{
                    padding: "6px 12px",
                    background: intelligenceTab === tab.id ? "var(--accent)" : "var(--surface2)",
                    border: `1px solid ${intelligenceTab === tab.id ? "var(--accent)" : "var(--border)"}`,
                    borderRadius: 6,
                    color: intelligenceTab === tab.id ? "#fff" : "var(--text)",
                    fontSize: "0.7rem",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div style={{ marginBottom: 12 }}>
              <input
                type="text"
                placeholder={intelligenceTab === "threats" ? "Search threats, actors, CVE..." : 
                             intelligenceTab === "bounty" ? "Search bug bounty programs..." :
                             intelligenceTab === "pentest" ? "Enter target for pentest..." :
                             "Search..."}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  color: "var(--text)",
                  fontSize: "0.85rem",
                }}
                value={intelligenceQuery}
                onChange={e => setIntelligenceQuery(e.target.value)}
                onKeyPress={e => {
                  if (e.key === "Enter" && intelligenceQuery.trim()) {
                    runIntelligenceSearch();
                  }
                }}
              />
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {intelligenceTab === "threats" && (
                <>
                  <button className="full-btn full-btn-primary" style={{ fontSize: "0.7rem" }} onClick={() => runIntelligenceSearch()}>Search Threats</button>
                  <button className="full-btn" style={{ fontSize: "0.7rem" }} onClick={loadPatterns}>Load Patterns</button>
                  <button className="full-btn" style={{ fontSize: "0.7rem" }} onClick={loadPlugins}>Check Plugins</button>
                </>
              )}
              {intelligenceTab === "bounty" && (
                <>
                  <button className="full-btn full-btn-primary" style={{ fontSize: "0.7rem" }} onClick={() => runBugBountySearch()}>Search Programs</button>
                  <button className="full-btn" style={{ fontSize: "0.7rem" }} onClick={() => runCVELookup()}>CVE Lookup</button>
                </>
              )}
              {intelligenceTab === "patterns" && (
                <button className="full-btn full-btn-primary" style={{ fontSize: "0.7rem" }} onClick={analyzePatterns}>Analyze Patterns</button>
              )}
              {intelligenceTab === "research" && (
                <>
                  <button className="full-btn full-btn-primary" style={{ fontSize: "0.7rem" }} onClick={() => runDarkWebSearch()}>Dark Web</button>
                  <button className="full-btn" style={{ fontSize: "0.7rem" }} onClick={() => runClearWebSearch()}>Clear Web</button>
                </>
              )}
              {intelligenceTab === "pentest" && (
                <>
                  <button className="full-btn full-btn-primary" style={{ fontSize: "0.7rem" }} onClick={() => runRecon()}>Run Recon</button>
                  <button className="full-btn" style={{ fontSize: "0.7rem" }} onClick={() => runVulnScan()}>Vuln Scan</button>
                  <button className="full-btn" style={{ fontSize: "0.7rem" }} onClick={() => runPentestAI()}>AI Analysis</button>
                </>
              )}
              {intelligenceTab === "reports" && (
                <button className="full-btn full-btn-primary" style={{ fontSize: "0.7rem" }} onClick={generateReport}>Generate Report</button>
              )}
            </div>

            {intelligenceLoading && (
              <div style={{ textAlign: "center", padding: 20, color: "var(--text-3)" }}>
                Processing...
              </div>
            )}

            {/* Results */}
            {intelligenceResults.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 300, overflow: "auto" }}>
                {intelligenceResults.map((r, i) => (
                  <div key={i} style={{ background: "var(--surface2)", padding: 10, borderRadius: 8, borderLeft: `3px solid ${r.severity === "critical" ? "#ef4444" : r.severity === "high" ? "#f97316" : "#22c55e"}` }}>
                    <div style={{ fontWeight: "bold", fontSize: "0.8rem", color: "var(--text)" }}>{r.title || r.name || "Result"}</div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-2)", marginTop: 4 }}>{r.description || r.description?.substring(0, 150)}</div>
                    {r.data && (
                      <pre style={{ fontSize: "0.6rem", background: "var(--bg)", padding: 6, borderRadius: 4, marginTop: 6, overflow: "auto", maxHeight: 80 }}>
                        {JSON.stringify(r.data, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Quick Tools Grid */}
            <div style={{ marginTop: 12 }}>
              <SectionLabel>
                {intelligenceTab === "threats" && "Threat Intel Sources"}
                {intelligenceTab === "bounty" && "Bug Bounty Platforms"}
                {intelligenceTab === "patterns" && "Pattern Categories"}
                {intelligenceTab === "research" && "Research Tools"}
                {intelligenceTab === "pentest" && "Pentest Tools"}
                {intelligenceTab === "reports" && "Report Options"}
              </SectionLabel>
              <div className="osint-grid" style={{ marginTop: 8 }}>
                {intelligenceTab === "threats" && [
                  { name: "AlienVault", url: "https://otx.alienvault.com", desc: "Pulse" },
                  { name: "VirusTotal", url: "https://virustotal.com", desc: "Malware" },
                  { name: "GreyNoise", url: "https://greynoise.io", desc: "Internet" },
                  { name: "Shodan", url: "https://shodan.io", desc: "IoT" },
                  { name: "Censys", url: "https://censys.io", desc: "SSL" },
                  { name: "RiskIQ", url: "https://community.riskiq.com", desc: "Threat" },
                ].map(tool => (
                  <a key={tool.name} href={tool.url + intelligenceQuery} target="_blank" rel="noopener" className="osint-card">
                    <span className="osint-name">{tool.name}</span>
                    <span className="osint-desc">{tool.desc}</span>
                  </a>
                ))}
                {intelligenceTab === "bounty" && [
                  { name: "HackerOne", url: "https://hackerone.com/programs", desc: "Programs" },
                  { name: "Bugcrowd", url: "https://bugcrowd.com/programs", desc: "Programs" },
                  { name: "OpenBugBounty", url: "https://openbugbounty.org", desc: "XSS" },
                  { name: "Intigriti", url: "https://intigriti.com", desc: "EU" },
                  { name: "YesWeHack", url: "https://yeswehack.com", desc: "Programs" },
                  { name: "Synack", url: "https://synack.com", desc: "Elite" },
                ].map(tool => (
                  <a key={tool.name} href={tool.url} target="_blank" rel="noopener" className="osint-card">
                    <span className="osint-name">{tool.name}</span>
                    <span className="osint-desc">{tool.desc}</span>
                  </a>
                ))}
                {intelligenceTab === "patterns" && [
                  { name: "Temporal", desc: "Time-based" },
                  { name: "Geographic", desc: "Location-based" },
                  { name: "Behavioral", desc: "Actor patterns" },
                  { name: "Network", desc: "Connections" },
                  { name: "Anomaly", desc: "Outliers" },
                  { name: "Campaign", desc: "Attacks" },
                ].map(tool => (
                  <div key={tool.name} className="osint-card" style={{ cursor: "pointer" }} onClick={() => filterPattern(tool.name)}>
                    <span className="osint-name">{tool.name}</span>
                    <span className="osint-desc">{tool.desc}</span>
                  </div>
                ))}
                {intelligenceTab === "research" && [
                  { name: "DeHashed", url: "https://dehashed.com", desc: "Breaches" },
                  { name: "HaveIBeenPwned", url: "https://haveibeenpwned.com", desc: "Accounts" },
                  { name: "Pastebin", url: "https://pastebin.com", desc: "Leaks" },
                  { name: "GitHub", url: "https://github.com", desc: "Code" },
                  { name: "SecurityWeek", url: "https://securityweek.com", desc: "News" },
                  { name: "The Hacker News", url: "https://thehackernews.com", desc: "News" },
                ].map(tool => (
                  <a key={tool.name} href={tool.url} target="_blank" rel="noopener" className="osint-card">
                    <span className="osint-name">{tool.name}</span>
                    <span className="osint-desc">{tool.desc}</span>
                  </a>
                ))}
                {intelligenceTab === "pentest" && [
                  { name: "Nmap", desc: "Port Scan" },
                  { name: "Nikto", desc: "Web Vulns" },
                  { name: "SQLMap", desc: "SQLi" },
                  { name: "Amass", desc: "Subdomains" },
                  { name: "FFuF", desc: "Fuzzing" },
                  { name: "Metasploit", desc: "Exploits" },
                ].map(tool => (
                  <div key={tool.name} className="osint-card" style={{ cursor: "pointer" }} onClick={() => runTool(tool.name)}>
                    <span className="osint-name">{tool.name}</span>
                    <span className="osint-desc">{tool.desc}</span>
                  </div>
                ))}
                {intelligenceTab === "reports" && [
                  { name: "PDF Report", action: "pdf" },
                  { name: "JSON Export", action: "json" },
                  { name: "CSV Export", action: "csv" },
                  { name: "IOC List", action: "ioc" },
                  { name: "Timeline", action: "timeline" },
                  { name: "Executive", action: "exec" },
                ].map(tool => (
                  <div key={tool.name} className="osint-card" style={{ cursor: "pointer" }} onClick={() => exportReport(tool.action)}>
                    <span className="osint-name">{tool.name}</span>
                    <span className="osint-desc">Export</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated SDR Panel */}
      {showSDRPanel && (
        <div 
          className="float-panel" 
          style={{ 
            left: sdrPosition.x, 
            top: sdrPosition.y, 
            width: 360, 
            height: 480,
            cursor: draggingPanel === 'sdr' ? 'grabbing' : 'grab',
          }}
          onMouseDown={(e) => handleDragStart('sdr', e)}
        >
          <div className="float-header" style={{ background: "linear-gradient(135deg, #f97316 0%, #c2410c 100%)", cursor: 'grab' }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "1.2rem" }}>SDR</span>
              <span className="float-title" style={{ color: "#fff" }}>SDR Radio Signals</span>
            </div>
            <button className="float-close" style={{ color: "#fff" }} onClick={() => setShowSDRPanel(false)}>X</button>
          </div>
          <div className="float-body" style={{ padding: 0, display: "flex", flexDirection: "column", height: "calc(100% - 50px)" }}>
            <div style={{ padding: 12, borderBottom: "1px solid var(--border)", display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <label style={{ fontSize: "0.75rem", color: "var(--text-2)" }}>Freq:</label>
                <input 
                  type="number" 
                  value={sdrFrequency} 
                  onChange={e => setSdrFrequency(+e.target.value)}
                  style={{ width: 80, padding: "6px 8px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text)", fontSize: "0.8rem" }}
                />
                <span style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>kHz</span>
              </div>
              <select value={sdrMode} onChange={e => setSdrMode(e.target.value)} style={{ padding: "6px 8px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text)", fontSize: "0.75rem" }}>
                <option value="USB">USB</option>
                <option value="LSB">LSB</option>
                <option value="CW">CW</option>
                <option value="AM">AM</option>
                <option value="FM">FM</option>
              </select>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: 10 }}>
              {sdrSignals.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-3)", padding: "30px 20px", fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
                  No signals detected.<br/>Configure SDR source in settings.
                </div>
              ) : sdrSignals.map(signal => (
                <div 
                  key={signal.id}
                  style={{ 
                    padding: "10px 12px", 
                    marginBottom: 6, 
                    background: selectedSdrSignal?.id === signal.id ? "var(--accent-lo)" : "var(--surface1)",
                    borderRadius: 6,
                    cursor: "pointer",
                    borderLeft: "3px solid var(--accent)"
                  }}
                  onClick={() => {
                    setSelectedSdrSignal(signal);
                    if (signal.lat && signal.lon && globeEl.current) {
                      (globeEl.current as any).pointOfView({ lat: signal.lat, lng: signal.lon, altitude: 0.5 }, 1500);
                    }
                  }}
                >
                  <div style={{ fontWeight: 500, fontSize: "0.85rem", color: "var(--text)" }}>{signal.type}</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-2)", marginTop: 4 }}>
                    {signal.frequency ? `${signal.frequency} kHz` : ""} {signal.power ? ` | ${signal.power} dBm` : ""}
                  </div>
                  {signal.lat && signal.lon && (
                    <div style={{ fontSize: "0.68rem", color: "var(--text-3)", marginTop: 4 }}>
                      POS: {signal.lat.toFixed(4)}, {signal.lon.toFixed(4)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Antenna Agent Panel */}
      {showAntennaPanel && (
        <div className="float-panel" style={{ right: 20, bottom: 90, width: 380, height: 520 }}>
          <div className="float-header" style={{ background: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "1.2rem" }}>ANT</span>
              <span className="float-title" style={{ color: "#fff" }}>Antenna Agent</span>
            </div>
            <button className="float-close" style={{ color: "#fff" }} onClick={() => setShowAntennaPanel(false)}>X</button>
          </div>
          <div className="float-body" style={{ padding: 0, display: "flex", flexDirection: "column", height: "calc(100% - 50px)" }}>
            <div style={{ flex: 1, overflow: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              {antennaChatMessages.length === 0 && (
                <div style={{ textAlign: "center", color: "var(--text-3)", padding: "30px 20px" }}>
                  <div style={{ fontSize: "2rem", marginBottom: 10 }}>ANT</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
                    Antenna Agent can analyze SDR signals and provide insights.<br/>
                    Ask about signal patterns or threat analysis.
                  </div>
                </div>
              )}
              {antennaChatMessages.map((msg, i) => (
                <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ 
                    maxWidth: "80%", 
                    padding: "10px 14px", 
                    borderRadius: 12,
                    background: msg.role === "user" ? "var(--accent)" : "#8b5cf620",
                    color: msg.role === "user" ? "#fff" : "var(--text)",
                    fontSize: "0.82rem",
                    lineHeight: 1.5,
                    border: msg.role === "assistant" ? "1px solid #8b5cf6" : "none",
                  }}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {antennaChatLoading && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{ 
                    padding: "10px 14px", 
                    borderRadius: 12,
                    background: "#8b5cf620",
                    color: "var(--text-3)",
                    fontSize: "0.82rem",
                    fontStyle: "italic",
                    border: "1px solid #8b5cf6",
                  }}>
                    Processing signal analysis...
                  </div>
                </div>
              )}
              <div ref={(el) => { if (el) el.scrollIntoView({ behavior: "smooth" }); }} />
            </div>
            <div style={{ padding: 14, borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
              <input 
                type="text" 
                placeholder="Analyze signals, ask about patterns..." 
                style={{ 
                  flex: 1, 
                  padding: "10px 14px", 
                  border: "1px solid var(--border)", 
                  borderRadius: 8, 
                  background: "var(--surface2)", 
                  color: "var(--text)",
                  fontSize: "0.85rem",
                }}
                value={antennaChatInput}
                onChange={e => setAntennaChatInput(e.target.value)}
                onKeyPress={e => {
                  if (e.key === "Enter" && antennaChatInput.trim()) {
                    sendAntennaMessage(antennaChatInput);
                    setAntennaChatInput("");
                  }
                }}
              />
              <button 
                className="full-btn"
                style={{ padding: "10px 16px", borderRadius: 8, background: "#8b5cf6", color: "#fff" }}
                onClick={() => {
                  sendAntennaMessage(antennaChatInput);
                  setAntennaChatInput("");
                }}
                disabled={antennaChatLoading || !antennaChatInput.trim()}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Camera Viewer Modal ── */}
      {cameraViewer && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.85)",
          display: "flex", alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(4px)",
        }} onClick={() => setCameraViewer(null)}>
          <div style={{
            background: "#0f172a",
            border: "1px solid #1e293b",
            borderRadius: 12, overflow: "hidden",
            width: "min(900px, 90vw)",
            boxShadow: "0 25px 60px rgba(0,0,0,0.8)",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid #1e293b" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#fff" }}>{cameraViewer.event.type}</div>
                <div style={{ fontSize: "0.7rem", color: "#64748b", marginTop: 2 }}>
                  {cameraViewer.event.source} · {cameraViewer.event.country || ""} · {cameraViewer.event.lat.toFixed(4)}, {cameraViewer.event.lon.toFixed(4)}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <a href={cameraViewer.url} target="_blank" rel="noopener noreferrer"
                  style={{ padding: "6px 12px", background: "#3b82f6", color: "#fff", borderRadius: 6, fontSize: "0.72rem", textDecoration: "none", fontWeight: 600 }}>
                  ↗ Open
                </a>
                <button onClick={() => setCameraViewer(null)}
                  style={{ padding: "6px 12px", background: "#1e293b", color: "#fff", border: "none", borderRadius: 6, fontSize: "0.72rem", cursor: "pointer" }}>
                  X
                </button>
              </div>
            </div>
            <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
              <iframe
                src={cameraViewer.url}
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={cameraViewer.event.type}
              />
            </div>
            <div style={{ padding: "10px 18px", fontSize: "0.7rem", color: "#64748b", borderTop: "1px solid #1e293b" }}>
              {cameraViewer.event.description}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
