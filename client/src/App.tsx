import { useEffect, useState, useRef } from "react";
import Globe from "react-globe.gl";
import { io, Socket } from "socket.io-client";
import "./App.css";

interface RFIDDiscovery {
  id: string;
  tag_id: string;
  reader_id: string;
  latitude: number;
  longitude: number;
  signal_strength?: number;
  timestamp: string;
}

interface Reader {
  id: string;
  name: string;
  latitude?: number;
  longitude?: number;
  status: string;
  last_seen?: string;
}

interface Stats {
  uniqueTags: number;
  totalReaders: number;
}

interface Player {
  id: string;
  username: string;
  total_points: number;
  level: string;
}

const GLOBE_IMAGES = {
  dark: "https://unpkg.com/three-globe/example/img/earth-dark.jpg",
  light: "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg",
};

const COLORS = {
  rfid: "#06b6d4",
  reader: "#22c55e",
};

export default function App() {
  const globeEl = useRef<any>(null);
  const [discoveries, setDiscoveries] = useState<RFIDDiscovery[]>([]);
  const [readers, setReaders] = useState<Reader[]>([]);
  const [stats, setStats] = useState<Stats>({ uniqueTags: 0, totalReaders: 0 });
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [selectedDiscovery, setSelectedDiscovery] = useState<RFIDDiscovery | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [showReaders, setShowReaders] = useState(true);

  useEffect(() => {
    const socket = io(window.location.origin, { transports: ["websocket", "polling"], reconnectionAttempts: 3 });
    
    socket.on("rfid:update", (data: { discoveries: RFIDDiscovery[], readers: Reader[], stats: Stats, leaderboard: Player[] }) => {
      setDiscoveries(data.discoveries || []);
      setReaders(data.readers || []);
      setStats(data.stats || { uniqueTags: 0, totalReaders: 0 });
      setLeaderboard(data.leaderboard || []);
    });
    
    socket.on("rfid:welcome", () => {
      console.log("Connected to ProxHunt");
    });

    return () => { socket.disconnect(); };
  }, []);

  const pointData = discoveries.map(d => ({
    lat: d.latitude,
    lng: d.longitude,
    color: COLORS.rfid,
    tagId: d.tag_id,
    readerId: d.reader_id,
    signal: d.signal_strength,
    time: d.timestamp,
  }));

  const readerData = showReaders ? readers
    .filter(r => r.status === "online" && r.latitude && r.longitude)
    .map(r => ({
      lat: r.latitude,
      lng: r.longitude,
      color: COLORS.reader,
      name: r.name,
    })) : [];

  const bgColor = theme === "dark" ? "#070b14" : "#e8edf4";

  return (
    <div className="app" style={{ background: bgColor }}>
      <div className="sidebar">
        <div className="header">
          <h1>ProxHunt</h1>
          <p>RFID Wardriving</p>
        </div>

        <div className="stats-card">
          <h3>Stats</h3>
          <div className="stat-row">
            <span>Unique Tags</span>
            <strong>{stats.uniqueTags}</strong>
          </div>
          <div className="stat-row">
            <span>Readers Online</span>
            <strong>{stats.totalReaders}</strong>
          </div>
        </div>

        <div className="controls">
          <button onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}>
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          <label>
            <input type="checkbox" checked={showReaders} onChange={e => setShowReaders(e.target.checked)} />
            Show Readers
          </label>
        </div>

        {leaderboard.length > 0 && (
          <div className="leaderboard">
            <h3>Leaderboard</h3>
            {leaderboard.slice(0, 5).map((p, i) => (
              <div key={p.id} className="leader-row">
                <span>{i + 1}</span>
                <span>{p.username}</span>
                <strong>{p.total_points}pts</strong>
              </div>
            ))}
          </div>
        )}

        {selectedDiscovery && (
          <div className="detail-panel">
            <h3>Tag Details</h3>
            <p><strong>ID:</strong> {selectedDiscovery.tag_id}</p>
            <p><strong>Reader:</strong> {selectedDiscovery.reader_id}</p>
            <p><strong>Signal:</strong> {selectedDiscovery.signal_strength || "N/A"}</p>
            <p><strong>Time:</strong> {new Date(selectedDiscovery.timestamp).toLocaleString()}</p>
          </div>
        )}
      </div>

      <div className="globe-container">
        <Globe
          ref={globeEl}
          globeImageUrl={GLOBE_IMAGES[theme]}
          pointsData={pointData}
          pointLat="lat"
          pointLng="lng"
          pointColor="color"
          pointAltitude={0.01}
          pointsMerge={true}
          onPointClick={(point: any) => {
            const d = discoveries.find(x => x.latitude === point.lat && x.longitude === point.lng);
            if (d) setSelectedDiscovery(d);
          }}
          backgroundColor={bgColor}
        />
      </div>
    </div>
  );
}