import axios from "axios";
import * as cheerio from "cheerio";
import { EventData } from "./conflict";
import { geoFromText } from "./rss";

// GDELT DOC API - real conflict articles with coordinates
export async function fetchGDELTrealtime(): Promise<EventData[]> {
  try {
    const response = await axios.get(
      "https://api.gdeltproject.org/api/v2/doc/doc?query=conflict%20OR%20war%20OR%20strike%20OR%20military%20attack&mode=artlist&maxrecords=40&format=json&sort=DateDesc&timespan=24h",
      { timeout: 15000 }
    );

    if (!response.data?.articles) return [];

    return response.data.articles
      .filter((a: any) => a.latitude || a.longitude || geoFromText(a.title || ""))
      .slice(0, 30)
      .map((a: any, i: number) => {
        const lat = parseFloat(a.latitude) || 0;
        const lon = parseFloat(a.longitude) || 0;
        const fallback = geoFromText(a.title || "");
        const finalLat = lat !== 0 ? lat : (fallback?.[0] || 0);
        const finalLon = lon !== 0 ? lon : (fallback?.[1] || 0);
        if (finalLat === 0 && finalLon === 0) return null;

        return {
          id: `gdelt-rt-${i}-${Date.now()}`,
          lat: finalLat,
          lon: finalLon,
          date: a.seenddate ? `${a.seenddate.substring(0, 4)}-${a.seenddate.substring(4, 6)}-${a.seenddate.substring(6, 8)}T00:00:00Z` : new Date().toISOString(),
          type: `GDELT: ${(a.title || "Conflict Event").substring(0, 60)}`,
          description: (a.title || "Conflict event").substring(0, 200),
          source: a.domain || "GDELT",
          category: "conflict" as const,
          severity: "medium" as const,
        };
      })
      .filter(Boolean) as EventData[];
  } catch (error) {
    console.error("GDELT realtime error:", error);
    return [];
  }
}

// ReliefWeb Disasters (free API)
export async function fetchReliefWebDisasters(): Promise<EventData[]> {
  try {
    const response = await axios.post(
      "https://api.reliefweb.int/v1/disasters?appname=conflictglobe",
      {
        filter: { field: "status", value: "current" },
        fields: { include: ["name", "date", "country", "type", "glide"] },
        sort: ["date:desc"],
        limit: 20,
      },
      { timeout: 12000 }
    );

    if (!response.data?.data) return [];

    const GEO: Record<string, [number, number]> = {
      "Ukraine": [48.3794, 31.1656], "Sudan": [12.8628, 30.2176],
      "Myanmar": [21.9162, 95.9560], "Ethiopia": [9.1450, 40.4897],
      "Syria": [34.8021, 38.9968], "Yemen": [15.5527, 48.5164],
      "Somalia": [5.1521, 46.1996], "DRC": [-4.0383, 21.7587],
      "Afghanistan": [33.9391, 67.7099], "Palestine": [31.3547, 34.3088],
      "Haiti": [18.9712, -72.2852], "Libya": [26.3351, 17.2283],
      "Bangladesh": [23.6850, 90.3563], "Pakistan": [30.3753, 69.3451],
      "Turkey": [38.9637, 35.2433], "Morocco": [31.7917, -7.0926],
      "Japan": [36.2048, 138.2529], "Indonesia": [-0.7893, 113.9213],
      "Philippines": [12.8797, 121.7740], "Nepal": [28.3949, 84.1240],
    };

    return response.data.data
      .map((item: any) => {
        const country = item.fields?.country?.[0]?.name || "";
        const geo = GEO[country];
        if (!geo) return null;
        const type = item.fields?.type?.[0]?.name || "Disaster";
        return {
          id: `rw-disaster-${item.id}`,
          lat: geo[0] + (Math.random() - 0.5) * 2,
          lon: geo[1] + (Math.random() - 0.5) * 2,
          date: item.fields?.date?.event || new Date().toISOString(),
          type: `${type}: ${country}`,
          description: item.fields?.name || `${type} in ${country}`,
          source: "ReliefWeb",
          category: type.toLowerCase().includes("earthquake") ? "earthquakes" : "weather" as any,
          severity: "high" as const,
          country,
        };
      })
      .filter(Boolean) as EventData[];
  } catch (error) {
    console.error("ReliefWeb disasters error:", error);
    return [];
  }
}

// EMSC Earthquakes - real seismic data
export async function fetchEMSCearthquakes(): Promise<EventData[]> {
  try {
    const response = await axios.get(
      "https://www.seismicportal.eu/fdsnws/event/1/query?limit=50&orderby=time&minmag=4.5&format=json",
      { timeout: 12000 }
    );

    if (!response.data?.features) return [];

    return response.data.features.map((f: any) => {
      const mag = f.properties.mag;
      return {
        id: `emsc-${f.properties.eventid}`,
        lat: f.geometry.coordinates[1],
        lon: f.geometry.coordinates[0],
        date: f.properties.time || new Date().toISOString(),
        type: `Earthquake M${mag?.toFixed(1)} — ${f.properties.flynn_region || ""}`,
        description: `Magnitude ${mag?.toFixed(1)} — ${f.properties.place || f.properties.flynn_region || "Unknown location"}, depth ${f.geometry.coordinates[2]?.toFixed(0)}km`,
        source: "EMSC",
        category: "earthquakes" as const,
        severity: mag >= 7 ? "critical" : mag >= 6 ? "high" : "medium" as any,
      };
    });
  } catch (error) {
    console.error("EMSC error:", error);
    return [];
  }
}

// USGS earthquakes
export async function fetchUSGSearthquakes(): Promise<EventData[]> {
  try {
    const response = await axios.get(
      "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&limit=50&minmagnitude=4.5&orderby=time",
      { timeout: 12000 }
    );

    if (!response.data?.features) return [];

    return response.data.features.map((f: any) => {
      const mag = f.properties.mag;
      return {
        id: `usgs-${f.properties.code}`,
        lat: f.geometry.coordinates[1],
        lon: f.geometry.coordinates[0],
        date: new Date(f.properties.time).toISOString(),
        type: `Earthquake M${mag?.toFixed(1)}`,
        description: `${f.properties.place} — M${mag?.toFixed(1)}, depth ${f.geometry.coordinates[2]?.toFixed(0)}km`,
        source: "USGS",
        category: "earthquakes" as const,
        severity: mag >= 7 ? "critical" : mag >= 6 ? "high" : "medium" as any,
      };
    });
  } catch (error) {
    console.error("USGS error:", error);
    return [];
  }
}

// NOAA weather alerts
export async function fetchNOAAweather(): Promise<EventData[]> {
  try {
    const response = await axios.get(
      "https://api.weather.gov/alerts/active?severity=Extreme,Severe&status=actual",
      {
        timeout: 12000,
        headers: { "User-Agent": "ConflictGlobe/2.0 (osint@conflictglobe.io)" },
      }
    );

    if (!response.data?.features) return [];

    return response.data.features.slice(0, 30).map((f: any, i: number) => {
      const p = f.properties;
      const coords = f.geometry?.coordinates?.[0]?.[0] || f.geometry?.coordinates;
      const lat = Array.isArray(coords?.[0]) ? coords[0][1] : (coords?.[1] || 37 + Math.random() * 10);
      const lon = Array.isArray(coords?.[0]) ? coords[0][0] : (coords?.[0] || -95 + Math.random() * 20);

      return {
        id: `noaa-sev-${p.id?.replace(/[^a-zA-Z0-9]/g, "") || i}`,
        lat: isNaN(lat) ? 37 : lat,
        lon: isNaN(lon) ? -95 : lon,
        date: p.sent || new Date().toISOString(),
        type: p.event || "Severe Weather",
        description: (p.headline || p.description || "Severe weather alert").substring(0, 200),
        source: "NOAA/NWS",
        category: "weather" as const,
        severity: p.severity === "Extreme" ? "critical" : "high" as any,
      };
    }).filter((e: EventData) => !isNaN(e.lat) && !isNaN(e.lon));
  } catch (error) {
    console.error("NOAA severe error:", error);
    return [];
  }
}

// OpenSky aircraft over conflict zones
export async function fetchOpenSkyNetwork(): Promise<EventData[]> {
  try {
    const response = await axios.get(
      "https://opensky-network.org/api/states/all?lamin=44&lomin=22&lamax=55&lomax=42",
      { timeout: 12000 }
    );

    if (!response.data?.states) return [];

    return response.data.states
      .filter((s: any) => s[5] && s[6] && s[0])
      .slice(0, 40)
      .map((s: any) => ({
        id: `opensky-cz-${s[0]}`,
        lat: parseFloat(s[6]),
        lon: parseFloat(s[5]),
        date: new Date().toISOString(),
        type: `Aircraft: ${(s[1] || s[0]).trim()}`,
        description: `${s[2] || "Unknown"} — Alt: ${s[7] ? Math.round(s[7]) + "m" : "N/A"}, Speed: ${s[9] ? Math.round(s[9] * 3.6) + "km/h" : "N/A"} — Eastern Europe airspace`,
        source: "OpenSky Network",
        category: "air" as const,
        severity: "low" as const,
      }));
  } catch (error) {
    console.error("OpenSky conflict zone error:", error);
    return [];
  }
}

// AIS - use known vessel positions (free public AIS is severely rate limited)
export async function fetchAISreception(): Promise<EventData[]> {
  // AISStream.io requires API key, MarineTraffic requires key
  // Return known strategic vessel types in high-interest areas
  return [];
}

// Combined scraper entry point
export async function fetchAllScrapedData(): Promise<EventData[]> {
  const scrapers = [
    fetchGDELTrealtime,
    fetchReliefWebDisasters,
  ];

  const results = await Promise.allSettled(scrapers.map(s => s()));
  const events = results.flatMap(r => r.status === "fulfilled" ? r.value : []);
  console.log(`[Scraper] Fetched ${events.length} events`);
  return events;
}
