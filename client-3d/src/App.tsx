import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import Globe from "react-globe.gl";
import { saveAs } from "file-saver";
import { io, Socket } from "socket.io-client";

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

interface DrawingObject {
  id: string;
  type: "polygon" | "circle" | "rectangle";
  points: [number, number][];
  color: string;
  name?: string;
}

const categoryColors: Record<string, string> = {
  conflict: "#e74c3c",
  maritime: "#3498db",
  air: "#27ae60",
  cyber: "#9b59b6",
  land: "#e67e22",
  space: "#1abc9c",
  radio: "#f39c12",
  weather: "#3498db",
  earthquakes: "#8e44ad",
  social: "#e91e63"
};

const categoryEmoji: Record<string, string> = {
  conflict: "⚔️",
  maritime: "🚢",
  air: "✈️",
  cyber: "💻",
  land: "🏗️",
  space: "🛰️",
  radio: "📡",
  weather: "🌤",
  earthquakes: "🌍",
  social: "📱"
};

const categoryInfo: Record<string, string> = {
  conflict: "Armed conflicts, battles, military operations",
  maritime: "Vessel tracking, maritime incidents, shipping routes",
  air: "Aircraft movements, air incidents, aviation routes",
  cyber: "Cyber attacks, data breaches, security threats",
  land: "Land-based incidents, territorial changes",
  space: "Satellite movements, space events, orbital data",
  radio: "Radio signals, communications intercepts",
  weather: "Weather events, storms, natural disasters",
  earthquakes: "Seismic activity, earthquake reports",
  social: "Social media, news feeds, public information"
};

const GLOBE_DARK = '//unpkg.com/three-globe/example/img/earth-dark.jpg';
const GLOBE_LIGHT = '//unpkg.com/three-globe/example/img/earth-blue-marble.jpg';
const BUMP_MAP = '//unpkg.com/three-globe/example/img/earth-topology.png';
const SKY_DARK = '//unpkg.com/three-globe/example/img/night-sky.png';
const CLOUDS = '//unpkg.com/three-globe/example/img/earth-clouds.png';

const LOCATIONS = [
  { name: "Ukraine", lat: 48.3794, lon: 31.1656 },
  { name: "Gaza Strip", lat: 31.3547, lon: 34.3088 },
  { name: "Russia", lat: 55.7558, lon: 37.6173 },
  { name: "United States", lat: 38.8951, lon: -77.0364 },
  { name: "China", lat: 39.9042, lon: 116.4074 },
  { name: "Iran", lat: 35.6892, lon: 51.3890 },
  { name: "Israel", lat: 31.7683, lon: 35.2137 },
  { name: "North Korea", lat: 39.0392, lon: 125.7625 },
  { name: "South China Sea", lat: 16.0000, lon: 115.0000 },
  { name: "Taiwan Strait", lat: 24.0000, lon: 119.5000 },
  { name: "Mediterranean Sea", lat: 35.0000, lon: 18.0000 },
  { name: "Baltic Sea", lat: 55.0000, lon: 14.0000 },
  { name: "Persian Gulf", lat: 26.0000, lon: 52.0000 },
  { name: "Red Sea", lat: 20.0000, lon: 38.0000 },
  { name: "Arctic", lat: 75.0000, lon: 40.0000 },
  { name: "Africa", lat: 0.0, lon: 20.0 },
  { name: "Europe", lat: 50.0000, lon: 10.0000 },
  { name: "Asia", lat: 35.0000, lon: 100.0000 },
  { name: "Middle East", lat: 29.0000, lon: 42.0000 },
  { name: "Pacific", lat: 0.0, lon: -150.0 },
];

export default function App() {
  const globeEl = useRef<any>(null);
  const socketRef = useRef<Socket | null>(null);
  
  const [events, setEvents] = useState<ConflictEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<typeof LOCATIONS>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [pointSize, setPointSize] = useState(2);
  
  const [viewMode, setViewMode] = useState<"3d" | "2d">("3d");
  
  const [showArcs, setShowArcs] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showHexBin, setShowHexBin] = useState(false);
  const [showRings, setShowRings] = useState(false);
  const [showPolygons, setShowPolygons] = useState(false);
  const [showPaths, setShowPaths] = useState(false);
  
  const [enableClustering, setEnableClustering] = useState(true);
  const [showGraticules, setShowGraticules] = useState(false);
  const [showAtmosphere, setShowAtmosphere] = useState(true);
  const [showClouds, setShowClouds] = useState(false);
  const [globeRotation, setGlobeRotation] = useState(false);
  
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(60);
  const [maxPoints, setMaxPoints] = useState(200);
  
  const [selectedEvent, setSelectedEvent] = useState<ConflictEvent | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<ConflictEvent | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [globeTheme, setGlobeTheme] = useState<'dark' | 'light'>('dark');
  const [pointPrecision, setPointPrecision] = useState(32);
  
  const [timelinePosition, setTimelinePosition] = useState(100);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showDrawTools, setShowDrawTools] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [drawingMode, setDrawingMode] = useState<"none" | "polygon" | "circle" | "rectangle">("none");
  const [drawings, setDrawings] = useState<DrawingObject[]>([]);
  const [currentDrawing, setCurrentDrawing] = useState<DrawingObject | null>(null);
  
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  
  const [activeTab, setActiveTab] = useState<"layers" | "categories" | "analytics" | "draw" | "bookmarks" | "alerts">("layers");
  const [measurementMode, setMeasurementMode] = useState<"none" | "distance" | "area">("none");
  const [measurePoints, setMeasurePoints] = useState<[number, number][]>([]);

  const [filters, setFilters] = useState<Record<string, boolean>>({
    conflict: true, maritime: true, air: true, cyber: true,
    land: true, space: true, radio: true, weather: true,
    earthquakes: true, social: true
  });

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/conflicts');
      const data = await res.json();
      setEvents(data.events || []);
      checkAlerts(data.events || []);
    } catch (e) {
      console.error('Failed to load data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shared = params.get('s');
    if (shared) {
      try {
        const state = JSON.parse(atob(shared));
        if (state.theme) setGlobeTheme(state.theme);
        if (state.filters) setFilters(state.filters);
        if (state.view && globeEl.current) {
          setTimeout(() => globeEl.current.pointOfView(state.view, 1500), 1000);
        }
      } catch (e) { console.error('Failed to load shared state:', e); }
    }
  }, []);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadData, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, loadData]);

  useEffect(() => {
    const socket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 3
    });
    socket.on('connect', () => console.log('WebSocket connected'));
    socket.on('disconnect', () => console.log('WebSocket disconnected'));
    socket.on('conflicts:update', (data: { events: ConflictEvent[] }) => {
      setEvents(data.events || []);
      setLoading(false);
    });
    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, []);

  useEffect(() => {
    if (!isPlaying || !globeEl.current) return;
    const interval = setInterval(() => {
      setTimelinePosition(p => {
        if (p >= 100) {
          setIsPlaying(false);
          return 100;
        }
        return p + playbackSpeed;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed]);

  useEffect(() => {
    if (searchQuery.length > 0) {
      const q = searchQuery.toLowerCase();
      const results = LOCATIONS.filter(l => 
        l.name.toLowerCase().includes(q) ||
        l.name.toLowerCase().startsWith(q)
      ).slice(0, 5);
      setSearchResults(results);
      setShowSearchResults(results.length > 0);
    } else {
      setShowSearchResults(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') loadData();
      if (e.key === 'f' || e.key === 'F') setShowSidebar(p => !p);
      if (e.key === 'h' || e.key === 'H') setGlobeTheme(t => t === 'dark' ? 'light' : 'dark');
      if (e.key === ' ') { e.preventDefault(); setIsPlaying(p => !p); }
      if (e.key === 'Escape') { setSelectedEvent(null); setDrawingMode("none"); setMeasurementMode("none"); }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [loadData]);

  useEffect(() => {
    const saved = localStorage.getItem('conflictGlobe_bookmarks');
    if (saved) setBookmarks(JSON.parse(saved));
    const savedAlerts = localStorage.getItem('conflictGlobe_alerts');
    if (savedAlerts) setAlerts(JSON.parse(savedAlerts));
  }, []);

  useEffect(() => {
    localStorage.setItem('conflictGlobe_bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  useEffect(() => {
    localStorage.setItem('conflictGlobe_alerts', JSON.stringify(alerts));
  }, [alerts]);

  const checkAlerts = useCallback((currentEvents: ConflictEvent[]) => {
    alerts.filter(a => a.enabled).forEach(alert => {
      const matches = currentEvents.filter(e => {
        if (alert.category && e.category !== alert.category) return false;
        if (alert.region && !e.description?.toLowerCase().includes(alert.region.toLowerCase())) return false;
        return true;
      });
      if (matches.length > 0) {
        if (Notification.permission === "granted") {
          new Notification(`Conflict Globe Alert: ${alert.name}`, {
            body: `${matches.length} events match criteria: ${alert.criteria}`,
          });
        }
      }
    });
  }, [alerts]);

  const focusLocation = useCallback((lat: number, lon: number, altitude = 1.5) => {
    if (globeEl.current) {
      globeEl.current.pointOfView({ lat, lng: lon, altitude }, 1000);
    }
  }, []);

  const handleSearchSelect = (location: typeof LOCATIONS[0]) => {
    focusLocation(location.lat, location.lon, 2);
    setSearchQuery(location.name);
    setShowSearchResults(false);
  };

  const addBookmark = () => {
    const pov = globeEl.current?.pointOfView();
    if (pov) {
      const bookmark: Bookmark = {
        id: Date.now().toString(),
        name: `Location ${bookmarks.length + 1}`,
        lat: pov.lat || 0,
        lon: pov.lng || 0,
        altitude: pov.altitude || 1.5,
        createdAt: new Date().toISOString()
      };
      setBookmarks([...bookmarks, bookmark]);
    }
  };

  const deleteBookmark = (id: string) => {
    setBookmarks(bookmarks.filter(b => b.id !== id));
  };

  const addAlert = (name: string, criteria: string, category?: string, region?: string) => {
    const alert: Alert = {
      id: Date.now().toString(),
      name,
      criteria,
      category,
      region,
      enabled: true
    };
    setAlerts([...alerts, alert]);
  };

  const toggleAlert = (id: string) => {
    setAlerts(alerts.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  };

  const deleteAlert = (id: string) => {
    setAlerts(alerts.filter(a => a.id !== id));
  };

  useEffect(() => {
    if (selectedEvent && globeEl.current && selectedEvent.lat !== 0) {
      globeEl.current.pointOfView({
        lat: selectedEvent.lat,
        lng: selectedEvent.lon,
        altitude: 1.5
      }, 1000);
    }
  }, [selectedEvent]);

  useEffect(() => {
    if (!globeRotation || !globeEl.current) return;
    const globe = globeEl.current;
    let animationId: number;
    const rotate = () => {
      const current = globe.pointOfView()?.lng || 0;
      globe.pointOfView({ lng: current + 0.1, lat: undefined });
      animationId = requestAnimationFrame(rotate);
    };
    rotate();
    return () => cancelAnimationFrame(animationId);
  }, [globeRotation]);

  const filteredEvents = useMemo(() => {
    return events.filter(event => filters[event.category]).slice(0, maxPoints);
  }, [events, filters, maxPoints]);

  const searchFilteredEvents = useMemo(() => {
    if (!searchQuery) return filteredEvents;
    const q = searchQuery.toLowerCase();
    return filteredEvents.filter(e => 
      e.description?.toLowerCase().includes(q) ||
      e.type?.toLowerCase().includes(q) ||
      e.category?.toLowerCase().includes(q) ||
      e.source?.toLowerCase().includes(q)
    );
  }, [filteredEvents, searchQuery]);

  const timelineEvents = useMemo(() => {
    const sorted = [...searchFilteredEvents].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    if (sorted.length === 0) return [];
    const cutoffIndex = Math.floor((timelinePosition / 100) * sorted.length);
    return sorted.slice(0, cutoffIndex + 1);
  }, [searchFilteredEvents, timelinePosition]);

  const eventsWithDestinations = useMemo(() => {
    return timelineEvents.map((e, idx) => {
      if (e.endLat !== undefined && e.endLon !== undefined) return e;
      const destLat = e.lat + (Math.random() - 0.5) * 30;
      const destLon = e.lon + (Math.random() - 0.5) * 30;
      return { ...e, endLat: destLat, endLon: destLon };
    });
  }, [timelineEvents]);

  const validEvents = useMemo(() => {
    return eventsWithDestinations.filter(e => e.lat !== 0 && e.lon !== 0 && !isNaN(e.lat) && !isNaN(e.lon));
  }, [eventsWithDestinations]);

  const arcData = useMemo(() => {
    if (!showArcs) return [];
    return validEvents.filter(e => e.endLat !== 0).slice(0, 100).map(e => ({
      startLat: e.lat, startLng: e.lon, endLat: e.endLat!, endLng: e.endLon!, color: categoryColors[e.category]
    }));
  }, [validEvents, showArcs]);

  const hexBinPointsData = useMemo(() => showHexBin ? validEvents : [], [validEvents, showHexBin]);
  const ringsData = useMemo(() => showRings ? validEvents.slice(0, 300) : [], [validEvents, showRings]);

  const polygonsData = useMemo(() => {
    if (!showPolygons) return [];
    const regions: Record<string, any> = {};
    validEvents.forEach(e => {
      const latKey = Math.floor(e.lat / 10) * 10;
      const lonKey = Math.floor(e.lon / 10) * 10;
      const key = `${latKey}-${lonKey}`;
      if (!regions[key]) regions[key] = { lat: latKey + 5, lng: lonKey + 5, points: [], count: 0 };
      regions[key].points.push(e);
      regions[key].count++;
    });
    return Object.values(regions).filter((r: any) => r.count > 0);
  }, [validEvents, showPolygons]);

  const pathsData = useMemo(() => {
    if (!showPaths) return [];
    return validEvents.filter(e => e.endLat !== 0).slice(0, 50).map(e => ({
      path: [[e.lat, e.lon], [e.endLat!, e.endLon!]], color: categoryColors[e.category]
    }));
  }, [validEvents, showPaths]);

  const heatmapsData = useMemo(() => showHeatmap ? [validEvents] : [], [validEvents, showHeatmap]);

  const bgColor = globeTheme === 'dark' ? '#000011' : '#f0f0f0';

  const analytics = useMemo(() => {
    const byCategory: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    const bySeverity: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    validEvents.forEach(e => {
      byCategory[e.category] = (byCategory[e.category] || 0) + 1;
      bySource[e.source || 'unknown'] = (bySource[e.source || 'unknown'] || 0) + 1;
      bySeverity[e.severity || 'medium']++;
    });
    return { byCategory, bySource, bySeverity, total: validEvents.length };
  }, [validEvents]);

  const linkData = useMemo(() => {
    const links: any[] = [];
    const entities = new Set<string>();
    validEvents.forEach(e => {
      if (e.entities) e.entities.forEach(ent => entities.add(ent));
    });
    const entityArray = Array.from(entities);
    entityArray.forEach((e1, i) => {
      entityArray.slice(i + 1).forEach(e2 => {
        if (Math.random() > 0.7) {
          links.push({ source: e1, target: e2, value: Math.random() });
        }
      });
    });
    return { nodes: entityArray.map(e => ({ id: e })), links: links.slice(0, 50) };
  }, [validEvents]);

  const handlePointClick = useCallback((point: ConflictEvent) => {
    setSelectedEvent(point);
  }, []);

  const handleHover = useCallback((hoverObj: any) => {
    if (hoverObj && hoverObj.type === 'hover' && hoverObj.object) {
      setHoveredEvent(hoverObj.object);
    } else {
      setHoveredEvent(null);
    }
  }, []);

  const handleGlobeClick = useCallback((coords: any) => {
    if (drawingMode !== "none" && coords) {
      if (currentDrawing) {
        setCurrentDrawing({
          ...currentDrawing,
          points: [...currentDrawing.points, [coords.lat, coords.lng]]
        });
      } else {
        setCurrentDrawing({
          id: Date.now().toString(),
          type: drawingMode as any,
          points: [[coords.lat, coords.lng]],
          color: '#e74c3c'
        });
      }
    }
    if (measurementMode !== "none" && coords) {
      setMeasurePoints([...measurePoints, [coords.lat, coords.lng]]);
    }
  }, [drawingMode, currentDrawing, measurementMode, measurePoints]);

  const finishDrawing = () => {
    if (currentDrawing) {
      setDrawings([...drawings, currentDrawing]);
      setCurrentDrawing(null);
      setDrawingMode("none");
    }
  };

  const calculateDistance = (p1: [number, number], p2: [number, number]) => {
    const R = 6371;
    const dLat = (p2[0] - p1[0]) * Math.PI / 180;
    const dLon = (p2[1] - p1[1]) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const totalDistance = useMemo(() => {
    let dist = 0;
    for (let i = 0; i < measurePoints.length - 1; i++) {
      dist += calculateDistance(measurePoints[i], measurePoints[i + 1]);
    }
    return dist.toFixed(2);
  }, [measurePoints]);

  return (
    <div style={{ width: "100vw", height: "100vh", background: bgColor, position: 'relative', overflow: 'hidden' }}>
      {viewMode === "3d" ? (
        <Globe
          ref={globeEl}
          globeImageUrl={globeTheme === 'dark' ? GLOBE_DARK : GLOBE_LIGHT}
          backgroundImageUrl={globeTheme === 'dark' ? SKY_DARK : ''}
          backgroundColor={bgColor}
          bumpImageUrl={BUMP_MAP}
          showAtmosphere={showAtmosphere}
          atmosphereColor={globeTheme === 'dark' ? '#3a228a' : '#88ccff'}
          atmosphereAltitude={0.15}
          showGraticules={showGraticules}
          graticuleColor={() => globeTheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}
          cloudsUrl={showClouds ? CLOUDS : undefined}
          cloudsOpacity={0.4}
          pointsData={validEvents}
          pointLat={(d: any) => d.lat}
          pointLng={(d: any) => d.lon}
          pointColor={(d: any) => categoryColors[d.category] || '#ffff00'}
          pointAltitude={0.01}
          pointRadius={pointSize / 100}
          pointsMerge={enableClustering}
          pointResolution={pointPrecision}
          onPointClick={handlePointClick}
          onPointHover={handleHover}
          hexBinPointsData={hexBinPointsData}
          hexBinPointWeight={1}
          hexBinResolution={2}
          hexBinPointLat={(d: any) => d.lat}
          hexBinPointLng={(d: any) => d.lon}
          hexBinColor={(d: any) => {
            const count = d.points.length;
            if (count > 30) return '#ff0000';
            if (count > 20) return '#ff4400';
            if (count > 10) return '#ff8800';
            if (count > 5) return '#ffcc00';
            return '#88ff00';
          }}
          ringsData={ringsData}
          ringLat={(d: any) => d.lat}
          ringLng={(d: any) => d.lng || d.lon}
          ringColor={(d: any) => categoryColors[d.category] || 'rgba(255,200,0,0.5)'}
          ringAltitude={0.005}
          ringRadius={0.3}
          ringResolution={16}
          polygonsData={polygonsData}
          polygonCapColor={(d: any) => {
            const count = d.count || d.points?.length || 0;
            const alpha = Math.min(0.8, count / 10);
            return `rgba(255, 100, 100, ${alpha})`;
          }}
          polygonSideColor={() => 'rgba(255,100,100,0.2)'}
          polygonStrokeColor={() => 'rgba(255,100,100,0.8)'}
          polygonAltitude={0.01}
          pathsData={pathsData}
          pathPoints={(d: any) => d.path}
          pathPointLat={(p: any) => p[0]}
          pathPointLng={(p: any) => p[1]}
          pathColor={(d: any) => d.color || 'rgba(255,255,255,0.5)'}
          pathStroke={1.5}
          pathDashLength={0.4}
          pathDashGap={0.2}
          pathDashAnimateTime={2000}
          arcsData={arcData}
          arcStartLat={(d: any) => d.startLat}
          arcStartLng={(d: any) => d.startLng}
          arcEndLat={(d: any) => d.endLat}
          arcEndLng={(d: any) => d.endLng}
          arcColor={(d: any) => d.color}
          arcAltitude={0.2}
          arcStroke={1}
          arcDashLength={0.3}
          arcDashGap={0.2}
          arcDashAnimateTime={1500}
          heatmapsData={heatmapsData}
          heatmapPoints={(d: any) => d}
          heatmapPointLat={(p: any) => p.lat}
          heatmapPointLng={(p: any) => p.lon}
          heatmapPointWeight={1}
          heatmapBandwidth={2}
          labelsData={validEvents}
          labelLat={(d: any) => d.lat}
          labelLng={(d: any) => d.lng || d.lon}
          labelText={(d: any) => categoryEmoji[d.category] || '•'}
          labelSize={1}
          labelDotRadius={0.3}
          labelColor={() => 'rgba(255,255,255,0.8)'}
          labelAltitude={0.02}
          onGlobeClick={handleGlobeClick}
          animateIn={true}
          waitForGlobeReady={true}
          enablePointerInteraction={true}
        />
      ) : (
        <div style={{ width: '100%', height: '100%', background: bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
          <div style={{ color: globeTheme === 'dark' ? 'white' : 'black', fontSize: '2rem', marginBottom: '20px' }}>2D Map View</div>
          <div style={{ color: '#888', fontSize: '1rem' }}>Map tiles loading...</div>
          <div style={{ marginTop: '20px', padding: '20px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px' }}>
            <div style={{ color: globeTheme === 'dark' ? 'white' : 'black' }}>Switch to 3D for full experience</div>
          </div>
        </div>
      )}

      {measurementMode !== "none" && measurePoints.length > 0 && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.8)', padding: '12px 20px', borderRadius: '8px', color: 'white', zIndex: 150 }}>
          <div>Distance: {totalDistance} km</div>
          <div style={{ fontSize: '0.8rem', color: '#888' }}>{measurePoints.length} points</div>
        </div>
      )}

      {hoveredEvent && !selectedEvent && (
        <div style={{
          position: 'absolute', bottom: '180px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(10,10,20,0.95)', borderRadius: '12px', padding: '16px 20px',
          color: 'white', minWidth: '300px', maxWidth: '400px', zIndex: 150,
          border: `2px solid ${categoryColors[hoveredEvent.category]}`,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <span style={{ fontSize: '1.5rem' }}>{categoryEmoji[hoveredEvent.category]}</span>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>{hoveredEvent.type}</div>
              <div style={{ fontSize: '0.75rem', color: categoryColors[hoveredEvent.category] }}>{hoveredEvent.category.toUpperCase()}</div>
            </div>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: '8px' }}>{hoveredEvent.date}</div>
          <div style={{ fontSize: '0.85rem', lineHeight: '1.4', marginBottom: '8px' }}>
            {hoveredEvent.description?.substring(0, 120)}...
          </div>
          <div style={{ fontSize: '0.7rem', color: '#666', display: 'flex', justifyContent: 'space-between' }}>
            <span>📍 {hoveredEvent.lat.toFixed(2)}, {hoveredEvent.lon.toFixed(2)}</span>
            <span style={{ color: '#4a9' }}>Click for details →</span>
          </div>
        </div>
      )}

      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        padding: '16px 24px',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.9), transparent)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => setShowSidebar(p => !p)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '4px', padding: '8px 12px', color: 'white', cursor: 'pointer' }}>☰</button>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', color: 'white', fontWeight: 600, letterSpacing: '1px' }}>⚔️ CONFLICT GLOBE</h1>
            <p style={{ margin: 0, color: '#888', fontSize: '0.75rem' }}>{validEvents.length} ACTIVE EVENTS • {autoRefresh ? 'LIVE' : 'STATIC'} • {viewMode.toUpperCase()}</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, maxWidth: '500px', margin: '0 20px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input 
              type="text" 
              placeholder="🔍 Search locations, events..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery && setShowSearchResults(true)}
              onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
              style={{ width: '100%', padding: '10px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: '0.9rem' }} 
            />
            {showSearchResults && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'rgba(20,20,30,0.98)', borderRadius: '8px', marginTop: '4px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', zIndex: 200 }}>
                {searchResults.map((loc, i) => (
                  <div key={i} onClick={() => handleSearchSelect(loc)} style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'white' }}>{loc.name}</span>
                    <span style={{ color: '#888', fontSize: '0.8rem' }}>{loc.lat.toFixed(2)}, {loc.lon.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setViewMode(v => v === "3d" ? "2d" : "3d")} style={{ background: viewMode === "3d" ? '#3498db' : 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '4px', padding: '8px 12px', color: 'white', cursor: 'pointer' }}>🌐</button>
          <button onClick={loadData} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '4px', padding: '8px 12px', color: 'white', cursor: 'pointer' }}>🔄</button>
          <button onClick={() => setGlobeTheme(t => t === 'dark' ? 'light' : 'dark')} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '4px', padding: '8px 12px', color: 'white', cursor: 'pointer' }}>{globeTheme === 'dark' ? '☀️' : '🌙'}</button>
          <button onClick={() => setGlobeRotation(r => !r)} style={{ background: globeRotation ? '#e74c3c' : 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '4px', padding: '8px 12px', color: 'white', cursor: 'pointer' }}>🔁</button>
          <button onClick={() => {
            const state = { theme: globeTheme, filters, view: globeEl.current?.pointOfView() };
            const url = `${window.location.origin}?s=${btoa(JSON.stringify(state))}`;
            navigator.clipboard.writeText(url);
            alert('Share URL copied to clipboard!');
          }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '4px', padding: '8px 12px', color: 'white', cursor: 'pointer' }}>🔗</button>
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 24px', background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)', zIndex: 100 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ color: 'white', fontSize: '0.9rem' }}>📅 TIMELINE</span>
            <button onClick={() => setIsPlaying(!isPlaying)} style={{ background: isPlaying ? '#e74c3c' : 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isPlaying ? '⏸' : '▶'}
            </button>
            <span style={{ color: '#888', fontSize: '0.75rem' }}>Speed:</span>
            <select value={playbackSpeed} onChange={(e) => setPlaybackSpeed(Number(e.target.value))} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', borderRadius: '4px', padding: '2px 8px' }}>
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={5}>5x</option>
            </select>
          </div>
          <span style={{ color: '#888', fontSize: '0.8rem' }}>{validEvents.length} EVENTS</span>
        </div>
        <input type="range" min="0" max="100" value={timelinePosition} onChange={(e) => setTimelinePosition(Number(e.target.value))} style={{ width: '100%', cursor: 'pointer' }} />
      </div>

      {showSidebar && (
        <div style={{ position: 'absolute', top: '80px', left: '16px', width: isMobile ? 'calc(100% - 32px)' : '360px', maxHeight: 'calc(100vh - 180px)', background: 'rgba(10,10,20,0.95)', borderRadius: '12px', padding: '20px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.1)', zIndex: 100 }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {(['layers', 'categories', 'analytics', 'draw', 'bookmarks', 'alerts'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{ 
                background: activeTab === tab ? '#3498db' : 'rgba(255,255,255,0.1)', 
                border: 'none', padding: '8px 12px', borderRadius: '6px', color: 'white', cursor: 'pointer', fontSize: '0.75rem' 
              }}>
                {tab === 'layers' && '📊'}
                {tab === 'categories' && '🏷️'}
                {tab === 'analytics' && '📈'}
                {tab === 'draw' && '✏️'}
                {tab === 'bookmarks' && '🔖'}
                {tab === 'alerts' && '🔔'}
              </button>
            ))}
          </div>

          {activeTab === 'layers' && (
            <>
              <div style={{ marginBottom: '20px' }}>
                <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: '10px', letterSpacing: '1px' }}>GLOBE LAYERS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: 'white', fontSize: '0.9rem' }}>
                    <input type="checkbox" checked={showAtmosphere} onChange={(e) => setShowAtmosphere(e.target.checked)} /> 🌫️ Atmosphere
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: 'white', fontSize: '0.9rem' }}>
                    <input type="checkbox" checked={showGraticules} onChange={(e) => setShowGraticules(e.target.checked)} /> 🌍 Grid Lines
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: 'white', fontSize: '0.9rem' }}>
                    <input type="checkbox" checked={showClouds} onChange={(e) => setShowClouds(e.target.checked)} /> ☁️ Clouds
                  </label>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: '10px', letterSpacing: '1px' }}>DATA VISUALIZATIONS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: 'white', fontSize: '0.9rem' }}>
                    <input type="checkbox" checked={showHexBin} onChange={(e) => setShowHexBin(e.target.checked)} /> ⬡ Heat Clusters
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: 'white', fontSize: '0.9rem' }}>
                    <input type="checkbox" checked={showRings} onChange={(e) => setShowRings(e.target.checked)} /> ⭕ Pulse Rings
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: 'white', fontSize: '0.9rem' }}>
                    <input type="checkbox" checked={showPolygons} onChange={(e) => setShowPolygons(e.target.checked)} /> 🗺️ Regions
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: 'white', fontSize: '0.9rem' }}>
                    <input type="checkbox" checked={showHeatmap} onChange={(e) => setShowHeatmap(e.target.checked)} /> 🔥 Density Map
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: 'white', fontSize: '0.9rem' }}>
                    <input type="checkbox" checked={showArcs} onChange={(e) => setShowArcs(e.target.checked)} /> 🏹 Connections
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: 'white', fontSize: '0.9rem' }}>
                    <input type="checkbox" checked={showPaths} onChange={(e) => setShowPaths(e.target.checked)} /> 🛤️ Movement
                  </label>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: '8px' }}>OPTIONS</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', cursor: 'pointer', color: 'white', fontSize: '0.9rem' }}>
                  <input type="checkbox" checked={enableClustering} onChange={(e) => setEnableClustering(e.target.checked)} /> 📍 Point Clustering
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', cursor: 'pointer', color: 'white', fontSize: '0.9rem' }}>
                  <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} /> 🔄 Auto Refresh
                </label>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: '4px' }}>MAX POINTS: {maxPoints}</div>
                <input type="range" min="50" max="500" value={maxPoints} onChange={(e) => setMaxPoints(Number(e.target.value))} style={{ width: '100%' }} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: '4px' }}>POINT SIZE: {pointSize}</div>
                <input type="range" min="1" max="10" value={pointSize} onChange={(e) => setPointSize(Number(e.target.value))} style={{ width: '100%' }} />
              </div>
            </>
          )}

          {activeTab === 'categories' && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: '10px', letterSpacing: '1px' }}>CATEGORIES</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {Object.keys(filters).map(cat => (
                  <button key={cat} onClick={() => setFilters(f => ({ ...f, [cat]: !f[cat] }))} 
                    style={{ background: filters[cat] ? categoryColors[cat] : 'rgba(255,255,255,0.1)', 
                      border: 'none', padding: '6px 12px', borderRadius: '16px', color: 'white', 
                      fontSize: '0.75rem', cursor: 'pointer', opacity: filters[cat] ? 1 : 0.4 }}>
                    {categoryEmoji[cat]} {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div>
              <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: '10px', letterSpacing: '1px' }}>📈 ANALYTICS</div>
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', marginBottom: '12px' }}>
                <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: '4px' }}>TOTAL EVENTS</div>
                <div style={{ color: 'white', fontSize: '2rem', fontWeight: 'bold' }}>{analytics.total}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', marginBottom: '12px' }}>
                <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: '8px' }}>BY CATEGORY</div>
                {Object.entries(analytics.byCategory).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cat, count]) => (
                  <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: 'white', fontSize: '0.85rem' }}>
                    <span>{categoryEmoji[cat]} {cat}</span>
                    <span style={{ color: categoryColors[cat] }}>{count}</span>
                  </div>
                ))}
              </div>
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', marginBottom: '12px' }}>
                <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: '8px' }}>BY SOURCE</div>
                {Object.entries(analytics.bySource).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([src, count]) => (
                  <div key={src} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: 'white', fontSize: '0.85rem' }}>
                    <span>{src}</span>
                    <span>{count}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => {
                const csv = [['ID', 'Type', 'Category', 'Date', 'Lat', 'Lon', 'Source', 'Description']];
                validEvents.forEach(e => csv.push([e.id, e.type, e.category, e.date, e.lat.toString(), e.lon.toString(), e.source || '', e.description || '']));
                const blob = new Blob([csv.map(r => r.join(',')).join('\n')], { type: 'text/csv' });
                saveAs(blob, 'conflict-globe-data.csv');
              }} style={{ width: '100%', background: '#27ae60', border: 'none', padding: '12px', borderRadius: '8px', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>
                📥 Export CSV
              </button>
            </div>
          )}

          {activeTab === 'draw' && (
            <div>
              <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: '10px', letterSpacing: '1px' }}>✏️ DRAWING TOOLS</div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <button onClick={() => setDrawingMode(d => d === 'polygon' ? 'none' : 'polygon')} style={{ background: drawingMode === 'polygon' ? '#e74c3c' : 'rgba(255,255,255,0.1)', border: 'none', padding: '8px 12px', borderRadius: '6px', color: 'white', cursor: 'pointer', fontSize: '0.8rem' }}>⬡ Polygon</button>
                <button onClick={() => setDrawingMode(d => d === 'circle' ? 'none' : 'circle')} style={{ background: drawingMode === 'circle' ? '#e74c3c' : 'rgba(255,255,255,0.1)', border: 'none', padding: '8px 12px', borderRadius: '6px', color: 'white', cursor: 'pointer', fontSize: '0.8rem' }}>⭕ Circle</button>
                <button onClick={finishDrawing} disabled={!currentDrawing} style={{ background: currentDrawing ? '#27ae60' : 'rgba(255,255,255,0.2)', border: 'none', padding: '8px 12px', borderRadius: '6px', color: 'white', cursor: currentDrawing ? 'pointer' : 'not-allowed', fontSize: '0.8rem' }}>✓ Finish</button>
              </div>
              <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: '10px', letterSpacing: '1px' }}>📏 MEASUREMENT</div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <button onClick={() => { setMeasurementMode('distance'); setMeasurePoints([]); }} style={{ background: measurementMode === 'distance' ? '#3498db' : 'rgba(255,255,255,0.1)', border: 'none', padding: '8px 12px', borderRadius: '6px', color: 'white', cursor: 'pointer', fontSize: '0.8rem' }}>📐 Distance</button>
                <button onClick={() => setMeasurePoints([])} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', padding: '8px 12px', borderRadius: '6px', color: 'white', cursor: 'pointer', fontSize: '0.8rem' }}>Clear</button>
              </div>
              {measurePoints.length > 0 && (
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', color: 'white', fontSize: '0.85rem' }}>
                  Distance: {totalDistance} km • {measurePoints.length} points
                </div>
              )}
            </div>
          )}

          {activeTab === 'bookmarks' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ color: '#888', fontSize: '0.7rem', letterSpacing: '1px' }}>🔖 BOOKMARKS</div>
                <button onClick={addBookmark} style={{ background: '#3498db', border: 'none', padding: '6px 12px', borderRadius: '4px', color: 'white', cursor: 'pointer', fontSize: '0.75rem' }}>+ Add Current</button>
              </div>
              {bookmarks.length === 0 ? (
                <div style={{ color: '#666', fontSize: '0.85rem', textAlign: 'center', padding: '20px' }}>No bookmarks yet</div>
              ) : (
                bookmarks.map(b => (
                  <div key={b.id} style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ color: 'white', fontSize: '0.9rem' }}>{b.name}</div>
                      <div style={{ color: '#666', fontSize: '0.75rem' }}>{b.lat.toFixed(2)}, {b.lon.toFixed(2)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => focusLocation(b.lat, b.lon, b.altitude)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', padding: '6px', borderRadius: '4px', color: 'white', cursor: 'pointer' }}>📍</button>
                      <button onClick={() => deleteBookmark(b.id)} style={{ background: 'rgba(231,76,60,0.3)', border: 'none', padding: '6px', borderRadius: '4px', color: '#e74c3c', cursor: 'pointer' }}>✕</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'alerts' && (
            <div>
              <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: '10px', letterSpacing: '1px' }}>🔔 ALERTS</div>
              {alerts.length === 0 ? (
                <div style={{ color: '#666', fontSize: '0.85rem', textAlign: 'center', padding: '20px' }}>No alerts configured</div>
              ) : (
                alerts.map(a => (
                  <div key={a.id} style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ color: 'white', fontSize: '0.9rem' }}>{a.name}</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => toggleAlert(a.id)} style={{ background: a.enabled ? '#27ae60' : 'rgba(255,255,255,0.1)', border: 'none', padding: '4px 8px', borderRadius: '4px', color: 'white', cursor: 'pointer', fontSize: '0.7rem' }}>
                          {a.enabled ? 'ON' : 'OFF'}
                        </button>
                        <button onClick={() => deleteAlert(a.id)} style={{ background: 'rgba(231,76,60,0.3)', border: 'none', padding: '4px 8px', borderRadius: '4px', color: '#e74c3c', cursor: 'pointer', fontSize: '0.7rem' }}>✕</button>
                      </div>
                    </div>
                    <div style={{ color: '#666', fontSize: '0.75rem' }}>{a.criteria}</div>
                  </div>
                ))
              )}
              <button onClick={() => {
                const name = prompt('Alert name:');
                if (name) {
                  const criteria = prompt('Criteria (keywords):') || '';
                  addAlert(name, criteria);
                }
              }} style={{ width: '100%', background: '#e74c3c', border: 'none', padding: '12px', borderRadius: '8px', color: 'white', cursor: 'pointer', fontWeight: 'bold', marginTop: '12px' }}>
                + Create Alert
              </button>
            </div>
          )}
        </div>
      )}

      {selectedEvent && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          background: 'rgba(10,10,20,0.98)', borderRadius: '16px', padding: '28px',
          maxWidth: '500px', width: '90%', border: `2px solid ${categoryColors[selectedEvent.category]}`,
          zIndex: 200, boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ fontSize: '3rem' }}>{categoryEmoji[selectedEvent.category]}</span>
              <div>
                <h2 style={{ margin: 0, color: 'white', fontSize: '1.4rem' }}>{selectedEvent.type}</h2>
                <div style={{ display: 'inline-block', background: categoryColors[selectedEvent.category], padding: '4px 12px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold', marginTop: '4px' }}>
                  {selectedEvent.category.toUpperCase()}
                </div>
              </div>
            </div>
            <button onClick={() => setSelectedEvent(null)} style={{ background: 'none', border: 'none', color: '#888', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
          </div>
          
          <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: '16px' }}>{selectedEvent.date}</div>
          
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
            <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: '6px', textTransform: 'uppercase' }}>Description</div>
            <div style={{ color: 'white', fontSize: '0.95rem', lineHeight: '1.6' }}>{selectedEvent.description}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: '4px' }}>COORDINATES</div>
              <div style={{ color: 'white', fontSize: '0.9rem' }}>{selectedEvent.lat.toFixed(4)}, {selectedEvent.lon.toFixed(4)}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: '4px' }}>SOURCE</div>
              <div style={{ color: 'white', fontSize: '0.9rem' }}>{selectedEvent.source || 'Unknown'}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button onClick={() => {
              const blob = new Blob([JSON.stringify(selectedEvent, null, 2)], { type: "application/json" });
              saveAs(blob, `event-${selectedEvent.id}.json`);
            }} style={{ background: categoryColors[selectedEvent.category], border: 'none', padding: '12px 20px', borderRadius: '8px', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>
              💾 Export JSON
            </button>
            <button onClick={() => {
              const geojson = { type: 'Feature', geometry: { type: 'Point', coordinates: [selectedEvent.lon, selectedEvent.lat] }, properties: selectedEvent };
              const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: "application/json" });
              saveAs(blob, `event-${selectedEvent.id}.geojson`);
            }} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', padding: '12px 20px', borderRadius: '8px', color: 'white', cursor: 'pointer' }}>
              🌍 Export GeoJSON
            </button>
          </div>
        </div>
      )}

      {loading && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'white', fontSize: '1.5rem' }}>Loading OSINT Data...</div>}
    </div>
  );
}
