import axios from "axios";
import { EventData } from "./conflict";

// OpenSky OAuth2 token cache
let _osToken: string | null = null;
let _osTokenExpiry = 0;

async function getOpenSkyToken(): Promise<string | null> {
  const clientId = process.env.OPENSKY_CLIENT_ID;
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (_osToken && Date.now() < _osTokenExpiry - 30000) return _osToken;

  try {
    const resp = await axios.post(
      "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token",
      new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 10000,
      }
    );
    _osToken = resp.data.access_token;
    _osTokenExpiry = Date.now() + (resp.data.expires_in || 3600) * 1000;
    console.log("[OpenSky] OAuth2 token obtained, expires in", resp.data.expires_in, "s");
    return _osToken;
  } catch (err: any) {
    console.error("[OpenSky] Token fetch failed:", err?.response?.data || err?.message);
    return null;
  }
}

async function openSkyGet(url: string): Promise<any> {
  const token = await getOpenSkyToken();
  const headers: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};
  const resp = await axios.get(url, { headers, timeout: 15000 });
  return resp.data;
}

// Live aircraft over all regions (global)
export async function fetchAirTraffic(): Promise<EventData[]> {
  const regions = [
    { name: "Global", lamin: -90, lomin: -180, lamax: 90, lomax: 180 },
  ];

  const all: EventData[] = [];

  for (const region of regions) {
    try {
      const data = await openSkyGet(
        `https://opensky-network.org/api/states/all?lamin=${region.lamin}&lomin=${region.lomin}&lamax=${region.lamax}&lomax=${region.lomax}`
      );
      if (!data?.states) continue;

      const aircraft = data.states
        .filter((s: any) => s[5] && s[6] && s[0])
        .slice(0, 300)
        .map((s: any) => ({
          id: `opensky-${s[0]}-${region.name.replace(/\s/g,"")}`,
          lat: parseFloat(s[6]),
          lon: parseFloat(s[5]),
          date: new Date().toISOString(),
          type: `Aircraft: ${(s[1] || s[0] || "Unknown").trim()}`,
          description: `${s[2] || "Unknown"} — Callsign: ${(s[1] || "N/A").trim()}, Alt: ${s[7] ? Math.round(s[7]) + "m" : "N/A"}, ${s[9] ? Math.round(s[9] * 3.6) + "km/h" : ""} [${region.name}]`,
          source: "OpenSky Network",
          category: "air" as const,
          severity: "low" as const,
        }));

      all.push(...aircraft);
    } catch (e: any) {
      console.error(`[OpenSky] Region ${region.name} failed:`, e?.message);
    }
  }

  console.log(`[OpenSky] Fetched ${all.length} aircraft`);
  return all;
}

// Military aircraft by callsign pattern
export async function fetchMilitaryAircraft(): Promise<EventData[]> {
  try {
    const data = await openSkyGet("https://opensky-network.org/api/states/all");
    if (!data?.states) return [];

    const milPrefixes = ["RCH", "REACH", "RRR", "JAKE", "BART", "VENUS", "FURY",
      "WOLF", "VIPER", "COBRA", "EAGLE", "HAWK", "MAGMA", "GHOST",
      "REAPER", "CHAOS", "SPAD", "MARLIN", "DRAGON", "BONE", "KNIGHT",
      "QUID", "TOPGUN", "DUKE", "FURY", "BISON", "SWIFT"];

    return data.states
      .filter((s: any) => {
        const cs = (s[1] || "").trim().toUpperCase();
        return s[5] && s[6] && cs && milPrefixes.some(p => cs.startsWith(p));
      })
      .slice(0, 30)
      .map((s: any) => ({
        id: `mil-air-${s[0]}`,
        lat: parseFloat(s[6]),
        lon: parseFloat(s[5]),
        date: new Date().toISOString(),
        type: `Military Aircraft: ${(s[1] || s[0]).trim()}`,
        description: `${s[2] || "Unknown"} military — Callsign: ${(s[1] || "N/A").trim()}, Alt: ${s[7] ? Math.round(s[7]) + "m" : "N/A"}`,
        source: "OpenSky Network",
        category: "air" as const,
        severity: "medium" as const,
      }));
  } catch (e: any) {
    console.error("[OpenSky] Military aircraft failed:", e?.message);
    return [];
  }
}

// ISS live position
export async function fetchISSTracking(): Promise<EventData[]> {
  try {
    const resp = await axios.get("http://api.open-notify.org/iss-now.json", { timeout: 8000 });
    if (!resp.data?.iss_position) return [];
    return [{
      id: "iss-live",
      lat: parseFloat(resp.data.iss_position.latitude),
      lon: parseFloat(resp.data.iss_position.longitude),
      date: new Date().toISOString(),
      type: "ISS — International Space Station",
      description: "Live ISS position. Orbital altitude ~408km, speed ~27,600km/h",
      source: "Open-Notify",
      category: "space" as const,
      severity: "low" as const,
    }];
  } catch { return []; }
}

export async function fetchRocketLaunches(): Promise<EventData[]> {
  return LAUNCH_SITES;
}

const LAUNCH_SITES: EventData[] = [
  { id: "launch-ksc",       lat: 28.5721, lon: -80.648,  date: new Date().toISOString(), type: "Launch Site: Kennedy Space Center", description: "SpaceX primary — Falcon 9/Heavy, Starship", source: "SpaceX", category: "space", severity: "low" },
  { id: "launch-vafb",      lat: 34.742,  lon: -120.580, date: new Date().toISOString(), type: "Launch Site: Vandenberg SFB", description: "Polar orbit, NRO/USSF/SpaceX launches", source: "USSF", category: "space", severity: "low" },
  { id: "launch-baikonur",  lat: 45.965,  lon: 63.305,   date: new Date().toISOString(), type: "Launch Site: Baikonur Cosmodrome", description: "Roscosmos primary — Soyuz, Proton-M", source: "Roscosmos", category: "space", severity: "low" },
  { id: "launch-plesetsk",  lat: 62.927,  lon: 40.577,   date: new Date().toISOString(), type: "Launch Site: Plesetsk (Military)", description: "Russian military — Angara rocket, classified payloads", source: "Roscosmos", category: "space", severity: "medium" },
  { id: "launch-kourou",    lat: 5.240,   lon: -52.768,  date: new Date().toISOString(), type: "Launch Site: Guiana Space Centre", description: "ESA/Arianespace — Ariane 6, Vega", source: "ESA", category: "space", severity: "low" },
  { id: "launch-wenchang",  lat: 19.614,  lon: 110.951,  date: new Date().toISOString(), type: "Launch Site: Wenchang (CNSA)", description: "Long March 5B — lunar/Mars/space station", source: "CNSA", category: "space", severity: "medium" },
  { id: "launch-jiuquan",   lat: 40.958,  lon: 100.290,  date: new Date().toISOString(), type: "Launch Site: Jiuquan (Military)", description: "CNSA crewed missions + military satellites", source: "CNSA", category: "space", severity: "medium" },
  { id: "launch-sriharikota",lat: 13.733, lon: 80.235,   date: new Date().toISOString(), type: "Launch Site: Sriharikota (ISRO)", description: "PSLV/GSLV launches — Indian space program", source: "ISRO", category: "space", severity: "low" },
  { id: "launch-imam",      lat: 35.234,  lon: 53.921,   date: new Date().toISOString(), type: "Launch Site: Imam Khomeini SC", description: "Iran — dual-use ballistic/space program", source: "IRNA", category: "space", severity: "high" },
] as EventData[];
