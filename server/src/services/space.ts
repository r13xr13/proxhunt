import axios from "axios";
import { EventData } from "./conflict";

// ISS live position - completely free
export async function fetchISSTracking(): Promise<EventData[]> {
  try {
    const response = await axios.get("http://api.open-notify.org/iss-now.json", { timeout: 8000 });
    if (!response.data?.iss_position) return [];
    return [{
      id: "iss-live",
      lat: parseFloat(response.data.iss_position.latitude),
      lon: parseFloat(response.data.iss_position.longitude),
      date: new Date().toISOString(),
      type: "ISS — International Space Station",
      description: "Live ISS position. Orbital altitude ~408km, speed ~27,600km/h. Crew: Expedition 71",
      source: "Open-Notify",
      category: "space" as const,
      severity: "low" as const,
    }];
  } catch {
    return [];
  }
}

// These are now handled in satellites.ts — re-export for route compatibility
export async function fetchN2YOSatellites(): Promise<EventData[]> { return []; }
export async function fetchSpaceDebris(): Promise<EventData[]> { return []; }
export async function fetchSatellitePasses(): Promise<EventData[]> { return []; }

// Rocket launches from Launch Library 2 (free, no key)
export async function fetchRocketLaunches(): Promise<EventData[]> {
  try {
    const response = await axios.get(
      "https://ll.thespacedevs.com/2.2.0/launch/upcoming/?format=json&limit=10&status=1,2",
      { timeout: 12000 }
    );

    if (!response.data?.results) return getFallbackLaunches();

    return response.data.results.map((launch: any, i: number) => ({
      id: `launch-ll2-${launch.id || i}`,
      lat: launch.pad?.latitude ? parseFloat(launch.pad.latitude) : 0,
      lon: launch.pad?.longitude ? parseFloat(launch.pad.longitude) : 0,
      date: launch.net || new Date().toISOString(),
      type: `Upcoming Launch: ${launch.name || "Unknown"}`,
      description: `${launch.launch_service_provider?.name || "Unknown"} — ${launch.mission?.description?.substring(0, 150) || launch.name}`,
      source: "The Space Devs / Launch Library 2",
      category: "space" as const,
      severity: "low" as const,
    })).filter((e: EventData) => e.lat !== 0 && e.lon !== 0);
  } catch {
    return getFallbackLaunches();
  }
}

function getFallbackLaunches(): EventData[] {
  return [
    { id: "launch-ksc", lat: 28.5721, lon: -80.648, date: new Date().toISOString(), type: "Launch Site: Kennedy Space Center", description: "SpaceX primary launch facility — Falcon 9/Heavy, Starship development. Active commercial and national security launches", source: "SpaceX", category: "space", severity: "low" },
    { id: "launch-vafb", lat: 34.742, lon: -120.580, date: new Date().toISOString(), type: "Launch Site: Vandenberg SFB", description: "Vandenberg — polar orbit launches for NRO recon satellites, USSF missions, SpaceX Starlink shells", source: "USSF", category: "space", severity: "low" },
    { id: "launch-baikonur", lat: 45.965, lon: 63.305, date: new Date().toISOString(), type: "Launch Site: Baikonur Cosmodrome", description: "Russia's primary launch facility — Soyuz, Proton-M. Post-sanctions activity reduced. Kazakhstan leased to 2050", source: "Roscosmos", category: "space", severity: "low" },
    { id: "launch-plesetsk", lat: 62.927, lon: 40.577, date: new Date().toISOString(), type: "Launch Site: Plesetsk (Military)", description: "Russian military launch site — Angara rocket, classified payloads, GLONASS resupply. Northern Russia", source: "Roscosmos", category: "space", severity: "medium" },
    { id: "launch-wenchang", lat: 19.614, lon: 110.951, date: new Date().toISOString(), type: "Launch Site: Wenchang (CNSA)", description: "China's equatorial launch site — Long March 5B for space station, lunar/Mars missions", source: "CNSA", category: "space", severity: "medium" },
    { id: "launch-jiuquan", lat: 40.958, lon: 100.290, date: new Date().toISOString(), type: "Launch Site: Jiuquan (Military)", description: "CNSA crewed missions and military satellites — Long March 2F. China Manned Space Agency launches", source: "CNSA", category: "space", severity: "medium" },
  ] as EventData[];
}
