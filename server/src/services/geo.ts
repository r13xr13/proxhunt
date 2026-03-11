import axios from "axios";
import { EventData } from "./conflict";

// USGS Earthquake Hazards Program - completely free, no key
export async function fetchEarthquakes(): Promise<EventData[]> {
  try {
    const response = await axios.get(
      "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&limit=100&minmagnitude=4.0&orderby=time",
      { timeout: 15000 }
    );

    if (!response.data?.features) return [];

    return response.data.features.map((f: any) => {
      const mag = f.properties.mag;
      const severity: EventData["severity"] =
        mag >= 7 ? "critical" : mag >= 6 ? "high" : mag >= 5 ? "medium" : "low";

      return {
        id: `usgs-${f.properties.code}`,
        lat: f.geometry.coordinates[1],
        lon: f.geometry.coordinates[0],
        date: new Date(f.properties.time).toISOString(),
        type: `Earthquake M${mag?.toFixed(1)}`,
        description: `${f.properties.place} — Magnitude ${mag?.toFixed(1)}, Depth ${f.geometry.coordinates[2]?.toFixed(0)}km`,
        source: "USGS",
        category: "earthquakes" as const,
        severity,
      };
    });
  } catch (error) {
    console.error("USGS earthquake fetch error:", error);
    return [];
  }
}

// EMSC - European Mediterranean Seismological Centre
export async function fetchEMSCEarthquakes(): Promise<EventData[]> {
  try {
    const response = await axios.get(
      "https://www.seismicportal.eu/fdsnws/event/1/query?limit=50&orderby=time&minmag=4.0&format=json",
      { timeout: 15000 }
    );

    if (!response.data?.features) return [];

    return response.data.features.map((f: any) => {
      const mag = f.properties.mag;
      return {
        id: `emsc-${f.properties.eventid}`,
        lat: f.geometry.coordinates[1],
        lon: f.geometry.coordinates[0],
        date: f.properties.time || new Date().toISOString(),
        type: `Earthquake M${mag?.toFixed(1)}`,
        description: `${f.properties.place || "Seismic event"} — Magnitude ${mag?.toFixed(1)}`,
        source: "EMSC",
        category: "earthquakes" as const,
        severity: mag >= 7 ? "critical" : mag >= 6 ? "high" : mag >= 5 ? "medium" : "low" as any,
      };
    });
  } catch (error) {
    console.error("EMSC fetch error:", error);
    return [];
  }
}

// NOAA Weather Alerts - US severe weather, free
export async function fetchWeatherAlerts(): Promise<EventData[]> {
  try {
    const response = await axios.get(
      "https://api.weather.gov/alerts/active?status=actual&message_type=alert&urgency=Immediate,Expected",
      {
        timeout: 15000,
        headers: { "User-Agent": "ConflictGlobe/1.0 (contact@conflictglobe.io)" },
      }
    );

    if (!response.data?.features) return [];

    return response.data.features
      .slice(0, 40)
      .map((f: any, i: number) => {
        const p = f.properties;
        const severity: EventData["severity"] =
          p.severity === "Extreme" ? "critical"
          : p.severity === "Severe" ? "high"
          : p.severity === "Moderate" ? "medium" : "low";

        // NOAA alerts often have a centroid in the geometry
        const coords = f.geometry?.coordinates?.[0]?.[0];
        const lat = coords ? coords[1] : 37 + (Math.random() - 0.5) * 20;
        const lon = coords ? coords[0] : -95 + (Math.random() - 0.5) * 40;

        return {
          id: `noaa-${p.id || i}`,
          lat,
          lon,
          date: p.sent || new Date().toISOString(),
          type: p.event || "Weather Alert",
          description: (p.headline || p.description || "Severe weather alert").substring(0, 200),
          source: "NOAA",
          category: "weather" as const,
          severity,
          country: "United States",
        };
      })
      .filter((e: EventData) => !isNaN(e.lat) && !isNaN(e.lon));
  } catch (error) {
    console.error("NOAA weather fetch error:", error);
    return [];
  }
}

// Global Volcanism Program - Smithsonian, free
export async function fetchVolcanoAlerts(): Promise<EventData[]> {
  try {
    const response = await axios.get(
      "https://www.volcano.si.edu/gvp_api/reports/weekly",
      { timeout: 10000 }
    );
    // GVP doesn't have a clean JSON API, use known active volcanoes
    return ACTIVE_VOLCANOES;
  } catch {
    return ACTIVE_VOLCANOES;
  }
}

const ACTIVE_VOLCANOES: EventData[] = [
  { id: "volcano-etna", lat: 37.748, lon: 14.999, date: new Date().toISOString(), type: "Active Volcano: Etna", description: "Mount Etna, Sicily — persistent activity with lava flows and ash emissions", source: "GVP", category: "weather", severity: "medium" },
  { id: "volcano-stromboli", lat: 38.789, lon: 15.213, date: new Date().toISOString(), type: "Active Volcano: Stromboli", description: "Stromboli — near-continuous explosive activity", source: "GVP", category: "weather", severity: "medium" },
  { id: "volcano-kilauea", lat: 19.421, lon: -155.287, date: new Date().toISOString(), type: "Active Volcano: Kilauea", description: "Kilauea, Hawaii — ongoing eruption in summit caldera", source: "GVP", category: "weather", severity: "medium" },
  { id: "volcano-merapi", lat: -7.541, lon: 110.446, date: new Date().toISOString(), type: "Active Volcano: Merapi", description: "Mount Merapi, Indonesia — elevated activity with pyroclastic flows", source: "GVP", category: "weather", severity: "high" },
  { id: "volcano-sakurajima", lat: 31.585, lon: 130.659, date: new Date().toISOString(), type: "Active Volcano: Sakurajima", description: "Sakurajima, Japan — frequent explosions and ash plumes", source: "GVP", category: "weather", severity: "medium" },
  { id: "volcano-popocatepetl", lat: 19.023, lon: -98.622, date: new Date().toISOString(), type: "Active Volcano: Popocatépetl", description: "Popocatépetl, Mexico — steam and gas emissions with occasional explosions", source: "GVP", category: "weather", severity: "high" },
  { id: "volcano-ruapehu", lat: -39.281, lon: 175.564, date: new Date().toISOString(), type: "Active Volcano: Ruapehu", description: "Mount Ruapehu, New Zealand — crater lake heating", source: "GVP", category: "weather", severity: "low" },
  { id: "volcano-nyiragongo", lat: -1.52, lon: 29.25, date: new Date().toISOString(), type: "Active Volcano: Nyiragongo", description: "Nyiragongo, DRC — active lava lake, high risk for nearby Goma", source: "GVP", category: "weather", severity: "critical" },
  { id: "volcano-yasur", lat: -19.532, lon: 169.447, date: new Date().toISOString(), type: "Active Volcano: Yasur", description: "Yasur, Vanuatu — continuous strombolian activity", source: "GVP", category: "weather", severity: "medium" },
  { id: "volcano-erebus", lat: -77.53, lon: 167.153, date: new Date().toISOString(), type: "Active Volcano: Erebus", description: "Mount Erebus, Antarctica — persistent lava lake", source: "GVP", category: "weather", severity: "low" },
];

// Nuclear facilities (static but realistic)
export async function fetchNuclearFacilities(): Promise<EventData[]> {
  return [
    { id: "nuclear-zaporizhzhia", lat: 47.506, lon: 34.584, date: new Date().toISOString(), type: "Nuclear Plant: Zaporizhzhia", description: "Europe's largest nuclear power plant — under Russian control since March 2022, IAEA monitoring", source: "IAEA", category: "land" as any, severity: "critical" },
    { id: "nuclear-chernobyl", lat: 51.389, lon: 30.099, date: new Date().toISOString(), type: "Nuclear Site: Chernobyl", description: "Chernobyl Exclusion Zone — IAEA monitoring radiation levels", source: "IAEA", category: "land" as any, severity: "high" },
    { id: "nuclear-natanz", lat: 33.724, lon: 51.727, date: new Date().toISOString(), type: "Nuclear Facility: Natanz", description: "Iran uranium enrichment facility — under IAEA monitoring", source: "IAEA", category: "land" as any, severity: "high" },
    { id: "nuclear-fordow", lat: 34.884, lon: 50.993, date: new Date().toISOString(), type: "Nuclear Facility: Fordow", description: "Iran underground enrichment facility", source: "IAEA", category: "land" as any, severity: "high" },
    { id: "nuclear-yongbyon", lat: 39.794, lon: 125.755, date: new Date().toISOString(), type: "Nuclear Facility: Yongbyon", description: "North Korea main nuclear research center — 5MW reactor active", source: "38 North", category: "land" as any, severity: "critical" },
    { id: "nuclear-dimona", lat: 30.996, lon: 35.147, date: new Date().toISOString(), type: "Nuclear Facility: Dimona", description: "Israel nuclear research center — undeclared nuclear weapons program", source: "FAS", category: "land" as any, severity: "high" },
  ];
}
