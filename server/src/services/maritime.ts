import WebSocket from "ws";
import { EventData } from "./conflict";

// ─── Constants ────────────────────────────────────────────────────────────────

const AISSTREAM_URL = "wss://stream.aisstream.io/v0/stream";

// Strategic bounding boxes — high-interest maritime zones only.
// Format: [[lat1, lon1], [lat2, lon2]]
// Global coverage would flood you with ~300 msgs/sec — use targeted boxes.
const BOUNDING_BOXES = [
  // Red Sea / Gulf of Aden (Houthi threat zone)
  [[10.0, 32.0], [25.0, 55.0]],
  // Strait of Hormuz / Persian Gulf
  [[22.0, 50.0], [30.0, 60.0]],
  // South China Sea / Taiwan
  [[5.0, 105.0], [28.0, 125.0]],
  // Black Sea (Ukraine conflict)
  [[40.5, 27.5], [47.0, 41.5]],
];

// Ship type codes → human-readable label
// Full reference: https://api.vtexplorer.com/docs/ref-aistypes.html
const SHIP_TYPE_LABELS: Record<number, string> = {
  30: "Fishing", 31: "Towing", 32: "Towing (Large)", 33: "Dredging",
  34: "Diving Ops", 35: "Military", 36: "Sailing", 37: "Pleasure Craft",
  40: "HSC", 41: "HSC", 42: "HSC", 50: "Pilot Vessel", 51: "SAR",
  52: "Tug", 53: "Port Tender", 55: "Law Enforcement", 57: "Medical",
  58: "Non-combatant", 60: "Passenger", 61: "Passenger", 69: "Passenger",
  70: "Cargo", 71: "Cargo (Hazmat A)", 72: "Cargo (Hazmat B)",
  73: "Cargo (Hazmat C)", 74: "Cargo (Hazmat D)", 79: "Cargo",
  80: "Tanker", 81: "Tanker (Hazmat A)", 82: "Tanker (Hazmat B)",
  83: "Tanker (Hazmat C)", 84: "Tanker (Hazmat D)", 89: "Tanker",
  90: "Other", 99: "Other",
};

// Navigational status codes
const NAV_STATUS: Record<number, string> = {
  0: "Underway (Engine)", 1: "Anchored", 2: "Not Under Command",
  3: "Restricted Maneuverability", 4: "Constrained by Draught",
  5: "Moored", 6: "Aground", 7: "Fishing", 8: "Underway (Sailing)",
  15: "Unknown",
};

// High-interest MMSIs — known naval/strategic vessels to always highlight.
// Update from USNI News / MarineTraffic / CSIS tracker as needed.
const HIGH_INTEREST_MMSI = new Set([
  "338234637", // USS Gerald R. Ford (CVN-78)
  "338722162", // USS Dwight D. Eisenhower (CVN-69)
  "235009915", // HMS Queen Elizabeth (R08)
  "235091557", // HMS Prince of Wales (R09)
  "271000435", // TCG Anadolu (L-400)
  "244820196", // HNLMS Johan de Witt
]);

// ─── Vessel Store ─────────────────────────────────────────────────────────────

interface VesselRecord {
  mmsi: string;
  name: string;
  lat: number;
  lon: number;
  sog: number;         // speed over ground (knots)
  cog: number;         // course over ground (degrees)
  heading: number;     // true heading (511 = not available per AIS spec)
  navStatus: number;
  shipType: number;
  destination?: string;
  imo?: string;
  callSign?: string;
  lastSeen: number;    // Date.now()
  msgCount: number;
}

// Singleton vessel store — keyed by MMSI string
const vesselStore = new Map<string, VesselRecord>();

// Connection state
let wsInstance: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let isConnected = false;
let totalMessages = 0;
let connectionAttempts = 0;
let stopped = false;

// ─── WebSocket Manager ────────────────────────────────────────────────────────

export function startAISStream(): void {
  const apiKey = process.env.AISSTREAM_KEY;
  if (!apiKey) {
    console.warn("[AISStream] No AISSTREAM_KEY in .env — live vessel tracking disabled");
    return;
  }

  if (stopped) return;
  if (wsInstance && wsInstance.readyState === WebSocket.OPEN) return;

  connectionAttempts++;
  console.log(`[AISStream] Connecting... (attempt ${connectionAttempts})`);

  wsInstance = new WebSocket(AISSTREAM_URL);

  wsInstance.on("open", () => {
    isConnected = true;
    connectionAttempts = 0;
    console.log("[AISStream] Connected — subscribing to strategic bounding boxes");

    // Must send subscription within 3 seconds of open or connection is closed
    const subscriptionMessage = {
      Apikey: apiKey,             // lowercase 'key' per AISStream JS example
      BoundingBoxes: BOUNDING_BOXES,
      FilterMessageTypes: [
        "PositionReport",                   // Class A — large ships, military
        "StandardClassBPositionReport",     // Class B — smaller vessels
        "ExtendedClassBPositionReport",     // Extended Class B — includes name
        "ShipStaticData",                   // Name, IMO, destination, ship type
      ],
    };

    console.log("[AISStream] Sending subscription:", JSON.stringify(subscriptionMessage).replace(apiKey, "REDACTED"));
    wsInstance!.send(JSON.stringify(subscriptionMessage));
  });

  wsInstance.on("message", (data: WebSocket.RawData) => {
    try {
      const msg = JSON.parse(data.toString());

      // AISStream sends auth/throttle errors as { "error": "..." } messages
      if (msg.error) {
        console.error(`[AISStream] API error: ${msg.error}`);
        // Don't reconnect on auth failures — bad key won't fix itself
        if (
          msg.error.toLowerCase().includes("not valid") ||
          msg.error.toLowerCase().includes("invalid") ||
          msg.error.toLowerCase().includes("unauthorized")
        ) {
          console.error("[AISStream] Invalid API key — halting reconnection");
          stopped = true;
          stopAISStream();
        }
        return;
      }

      handleAISMessage(msg);
    } catch {
      // Malformed JSON — ignore silently
    }
  });

  wsInstance.on("close", (code) => {
    isConnected = false;
    wsInstance = null;

    if (stopped) return;

    // Exponential backoff: 10s → 15s → 22s → ... capped at 60s
    const delay = Math.min(10_000 * Math.pow(1.5, Math.min(connectionAttempts, 5)), 60_000);
    console.warn(`[AISStream] Disconnected (code=${code}). Reconnecting in ${Math.round(delay / 1000)}s...`);
    reconnectTimer = setTimeout(() => startAISStream(), delay);
  });

  wsInstance.on("error", (err) => {
    // close event fires after error and handles reconnection
    console.error("[AISStream] WebSocket error:", err.message);
  });
}

export function stopAISStream(): void {
  stopped = true;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (wsInstance) { wsInstance.close(); wsInstance = null; }
  isConnected = false;
  console.log("[AISStream] Stopped");
}

// ─── Message Handler ──────────────────────────────────────────────────────────

function handleAISMessage(msg: any): void {
  totalMessages++;

  const msgType: string = msg.MessageType;
  const meta = msg.MetaData;

  if (!meta?.MMSI) return;

  // MetaData lat/lon are lowercase per actual AISStream API response
  const lat = parseFloat(meta.latitude);
  const lon = parseFloat(meta.longitude);

  if (isNaN(lat) || isNaN(lon)) return;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return;
  if (lat === 0 && lon === 0) return; // null island — common AIS encoding error

  const mmsi = String(meta.MMSI);

  const existing: VesselRecord = vesselStore.get(mmsi) ?? {
    mmsi,
    name: meta.ShipName?.trim() || `MMSI:${mmsi}`,
    lat, lon,
    sog: 0, cog: 0, heading: 511,
    navStatus: 15,
    shipType: 0,
    lastSeen: Date.now(),
    msgCount: 0,
  };

  // Always update position from MetaData — most reliable coordinate source
  existing.lat = lat;
  existing.lon = lon;
  if (meta.ShipName?.trim()) existing.name = meta.ShipName.trim();

  if (msgType === "PositionReport") {
    const pos = msg.Message?.PositionReport;
    if (pos) {
      if (pos.Sog != null) existing.sog = pos.Sog;
      if (pos.Cog != null) existing.cog = pos.Cog;
      if (pos.TrueHeading != null) existing.heading = pos.TrueHeading;
      if (pos.NavigationalStatus != null) existing.navStatus = pos.NavigationalStatus;
    }

  } else if (msgType === "StandardClassBPositionReport") {
    const pos = msg.Message?.StandardClassBPositionReport;
    if (pos) {
      if (pos.Sog != null) existing.sog = pos.Sog;
      if (pos.Cog != null) existing.cog = pos.Cog;
      if (pos.TrueHeading != null) existing.heading = pos.TrueHeading;
      // No NavigationalStatus in Class B messages
    }

  } else if (msgType === "ExtendedClassBPositionReport") {
    const pos = msg.Message?.ExtendedClassBPositionReport;
    if (pos) {
      if (pos.Sog != null) existing.sog = pos.Sog;
      if (pos.Cog != null) existing.cog = pos.Cog;
      if (pos.TrueHeading != null) existing.heading = pos.TrueHeading;
      if (pos.Type != null) existing.shipType = pos.Type;
      if (pos.Name?.trim()) existing.name = pos.Name.trim();
    }

  } else if (msgType === "ShipStaticData") {
    const stat = msg.Message?.ShipStaticData;
    if (stat) {
      if (stat.Name?.trim()) existing.name = stat.Name.trim();
      if (stat.Type != null) existing.shipType = stat.Type;
      if (stat.Destination?.trim()) existing.destination = stat.Destination.trim();
      if (stat.ImoNumber) existing.imo = String(stat.ImoNumber);
      if (stat.CallSign?.trim()) existing.callSign = stat.CallSign.trim();
    }
  }

  existing.lastSeen = Date.now();
  existing.msgCount++;

  vesselStore.set(mmsi, existing);
}

// ─── Stale Vessel Cleanup ─────────────────────────────────────────────────────
// Prune vessels not seen in 30 minutes to prevent unbounded memory growth

setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  let pruned = 0;
  for (const [mmsi, vessel] of vesselStore.entries()) {
    if (vessel.lastSeen < cutoff) {
      vesselStore.delete(mmsi);
      pruned++;
    }
  }
  if (pruned > 0) {
    console.log(`[AISStream] Pruned ${pruned} stale vessels. Active: ${vesselStore.size}`);
  }
}, 5 * 60 * 1000);

// ─── EventData Conversion ─────────────────────────────────────────────────────

function vesselToEventData(vessel: VesselRecord): EventData {
  const shipTypeLabel = SHIP_TYPE_LABELS[vessel.shipType] || "Vessel";
  const navLabel = NAV_STATUS[vessel.navStatus] || "Unknown";
  const isHighInterest = HIGH_INTEREST_MMSI.has(vessel.mmsi);
  const isMilitary = vessel.shipType === 35 || isHighInterest;

  const severity: EventData["severity"] =
    isMilitary ? "high" :
    vessel.sog > 20 ? "medium" :
    "low";

  const descParts = [
    navLabel,
    vessel.sog > 0 ? `${vessel.sog.toFixed(1)} kn` : null,
    vessel.heading !== 511 ? `HDG ${vessel.heading}°` : null,
    vessel.destination ? `→ ${vessel.destination}` : null,
    vessel.callSign ? `[${vessel.callSign}]` : null,
    vessel.imo ? `IMO ${vessel.imo}` : null,
    `MMSI ${vessel.mmsi}`,
  ].filter(Boolean).join(" · ");

  return {
    id: `ais-${vessel.mmsi}`,
    lat: vessel.lat,
    lon: vessel.lon,
    date: new Date(vessel.lastSeen).toISOString(),
    type: `${shipTypeLabel}: ${vessel.name}`,
    description: descParts,
    source: "AISStream.io",
    category: "maritime" as const,
    severity,
    entities: [vessel.name, vessel.mmsi].filter(Boolean),
  };
}

// ─── Health / Status ──────────────────────────────────────────────────────────

export function getAISStreamStatus() {
  return {
    connected: isConnected,
    vesselCount: vesselStore.size,
    totalMessages,
    connectionAttempts,
  };
}

// ─── Public Route-Facing API ──────────────────────────────────────────────────

export async function fetchLiveVesselPositions(): Promise<EventData[]> {
  if (vesselStore.size === 0) return [];
  const events = Array.from(vesselStore.values()).map(vesselToEventData);
  console.log(`[AISStream] Serving ${events.length} live vessels`);
  return events;
}

export async function fetchVesselData(): Promise<EventData[]> {
  const live = await fetchLiveVesselPositions();
  if (live.length > 0) return live;
  // Static fallback so the globe isn't empty before AISStream populates
  return STATIC_NAVAL_VESSELS;
}

export async function fetchMarineAlerts(): Promise<EventData[]> {
  return STATIC_MARITIME_INCIDENTS;
}

export async function fetchVesselPositions(): Promise<EventData[]> {
  return fetchLiveVesselPositions();
}

export async function fetchNavalVessels(): Promise<EventData[]> {
  // Suppress static entries once a live AIS track appears for the same vessel
  const liveIds = new Set(Array.from(vesselStore.keys()).map(m => `ais-${m}`));
  return STATIC_NAVAL_VESSELS.filter(v => !liveIds.has(v.id));
}

export async function fetchPiracyZones(): Promise<EventData[]> {
  return STATIC_MARITIME_INCIDENTS;
}

// ─── Static Fallback Data ─────────────────────────────────────────────────────
// Honest about being static: "(static)" source labels, realistic last-known dates.
// Update periodically from USNI News / CSIS tracker / Lloyd's.

const STATIC_FALLBACK_DATE = "2025-02-15T00:00:00Z";

export const STATIC_NAVAL_VESSELS: EventData[] = [
  { id: "static-cvn-77", lat: 35.0, lon: 25.0, date: STATIC_FALLBACK_DATE, type: "Carrier Strike Group: USS George H.W. Bush", description: "CVN-77 · Mediterranean · 6th Fleet AOR · Position approximate (last reported)", source: "USNI News (static)", category: "maritime", severity: "medium" },
  { id: "static-cvn-68", lat: 13.5, lon: 144.8, date: STATIC_FALLBACK_DATE, type: "Carrier Strike Group: USS Nimitz", description: "CVN-68 · Western Pacific · 7th Fleet AOR · Position approximate", source: "USNI News (static)", category: "maritime", severity: "medium" },
  { id: "static-liaoning", lat: 22.5, lon: 114.5, date: STATIC_FALLBACK_DATE, type: "PLA Navy: CNS Liaoning (CV-16)", description: "South China Sea operations · Position approximate", source: "CSIS (static)", category: "maritime", severity: "high" },
  { id: "static-shandong", lat: 20.0, lon: 118.0, date: STATIC_FALLBACK_DATE, type: "PLA Navy: CNS Shandong (CV-17)", description: "Taiwan Strait vicinity · Position approximate", source: "CSIS (static)", category: "maritime", severity: "high" },
  { id: "static-r08", lat: 38.0, lon: -9.5, date: STATIC_FALLBACK_DATE, type: "Royal Navy: HMS Queen Elizabeth (R08)", description: "Atlantic patrol · Position approximate", source: "Royal Navy (static)", category: "maritime", severity: "medium" },
  { id: "static-ru-black-sea", lat: 44.6, lon: 33.5, date: STATIC_FALLBACK_DATE, type: "Russian Black Sea Fleet (Degraded)", description: "Sevastopol · Severely degraded by Ukrainian maritime drone attacks · Multiple vessels sunk", source: "Ukraine MoD (static)", category: "maritime", severity: "critical" },
];

export const STATIC_MARITIME_INCIDENTS: EventData[] = [
  { id: "incident-red-sea-houthi", lat: 15.5, lon: 43.0, date: new Date().toISOString(), type: "Houthi Maritime Threat Zone: Red Sea", description: "Active anti-ship missile and drone threat · 70+ attacks since Nov 2023 · US/UK naval response ongoing", source: "UKMTO", category: "maritime", severity: "critical" },
  { id: "incident-bab-el-mandeb", lat: 12.6, lon: 43.3, date: new Date().toISOString(), type: "Chokepoint: Bab-el-Mandeb", description: "Major commercial rerouting via Cape of Good Hope · 15% of global trade affected · Lloyd's war risk surcharge active", source: "IMO", category: "maritime", severity: "critical" },
  { id: "incident-strait-hormuz", lat: 26.6, lon: 56.3, date: new Date().toISOString(), type: "Chokepoint: Strait of Hormuz", description: "20% of global oil transit · Iranian IRGC vessel seizures ongoing · US 5th Fleet presence", source: "EIA", category: "maritime", severity: "high" },
  { id: "incident-south-china-sea", lat: 15.0, lon: 115.0, date: new Date().toISOString(), type: "Contested Waters: South China Sea", description: "PLAN/CCG active near Spratlys and Paracels · Philippine confrontations ongoing · USN FONOPS continuing", source: "CSIS", category: "maritime", severity: "high" },
  { id: "incident-black-sea", lat: 43.5, lon: 33.0, date: new Date().toISOString(), type: "Conflict Zone: Black Sea", description: "Ukrainian maritime drone operations · Russian Black Sea Fleet severely degraded · Grain corridor status unstable", source: "Lloyd's", category: "maritime", severity: "critical" },
  { id: "incident-gulf-guinea", lat: 3.5, lon: 2.8, date: new Date().toISOString(), type: "High Risk Zone: Gulf of Guinea", description: "Highest maritime kidnapping concentration globally · Armed robbery and crew abduction ongoing", source: "IMB PRC", category: "maritime", severity: "high" },
  { id: "incident-malacca", lat: 1.2, lon: 104.0, date: new Date().toISOString(), type: "Piracy Risk: Malacca Strait", description: "Attempted boardings of tankers in transit · High-traffic chokepoint · Regional coast guard patrols active", source: "IMB PRC", category: "maritime", severity: "medium" },
  { id: "incident-taiwan-strait", lat: 24.0, lon: 119.5, date: new Date().toISOString(), type: "Military Activity: Taiwan Strait", description: "PLA Navy regular transits and exercises · USN carrier strike group patrols · Elevated tension", source: "CSIS", category: "maritime", severity: "critical" },
];
