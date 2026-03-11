import axios from "axios";
import { EventData } from "./conflict";

// NASA EONET - Earth Observatory Natural Event Tracker (free, no key)
export async function fetchInfrastructure(): Promise<EventData[]> {
  try {
    const response = await axios.get(
      "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=30",
      { timeout: 12000 }
    );

    if (!response.data?.events) return [];

    return response.data.events
      .filter((e: any) => e.geometry?.length > 0)
      .map((e: any) => {
        const lastGeo = e.geometry[e.geometry.length - 1];
        const coords = lastGeo?.coordinates;
        if (!coords) return null;

        const categoryMap: Record<string, EventData["category"]> = {
          "Wildfires": "weather", "Severe Storms": "weather",
          "Volcanoes": "weather", "Earthquakes": "earthquakes",
          "Floods": "weather", "Drought": "weather", "Dust and Haze": "weather",
          "Sea and Lake Ice": "weather", "Snow": "weather", "Landslides": "weather",
          "Manmade": "land",
        };

        const cat = categoryMap[e.categories?.[0]?.title || ""] || "weather";

        return {
          id: `eonet-${e.id}`,
          lat: coords[1],
          lon: coords[0],
          date: lastGeo.date || new Date().toISOString(),
          type: `${e.categories?.[0]?.title || "Natural Event"}: ${e.title}`,
          description: e.title,
          source: "NASA EONET",
          category: cat,
          severity: "medium" as const,
        };
      })
      .filter(Boolean) as EventData[];
  } catch (error) {
    console.error("EONET fetch error:", error);
    return [];
  }
}

// Global power grid incidents (curated real locations)
export async function fetchPowerGrid(): Promise<EventData[]> {
  return POWER_GRID_INCIDENTS;
}

export async function fetchCriticalInfrastructure(): Promise<EventData[]> {
  return CRITICAL_INFRASTRUCTURE;
}

const POWER_GRID_INCIDENTS: EventData[] = [
  { id: "power-ua-grid", lat: 48.3794, lon: 31.1656, date: new Date().toISOString(), type: "Infrastructure Attack: Ukraine Grid", description: "Russian missile/drone strikes targeting Ukrainian energy infrastructure — Ukrenergo reports widespread damage to thermal and hydro plants", source: "Ukrenergo", category: "land", severity: "critical" },
  { id: "power-ua-zaporizhzhia", lat: 47.506, lon: 34.584, date: new Date().toISOString(), type: "Nuclear Risk: Zaporizhzhia", description: "Europe's largest nuclear plant under military control — IAEA monitoring for safety. External power repeatedly disrupted", source: "IAEA", category: "land", severity: "critical" },
  { id: "power-gaza-electricity", lat: 31.3547, lon: 34.3088, date: new Date().toISOString(), type: "Infrastructure: Gaza Power", description: "Gaza's sole power plant offline — population reliant on generators, fuel shortages critical", source: "OCHA", category: "land", severity: "critical" },
  { id: "power-texas-grid", lat: 31.9686, lon: -99.9018, date: new Date().toISOString(), type: "Grid Vulnerability: ERCOT Texas", description: "Texas independent grid isolated from national network — elevated risk during extreme weather events", source: "ERCOT", category: "land", severity: "medium" },
  { id: "power-europe-gas", lat: 50.0, lon: 15.0, date: new Date().toISOString(), type: "Energy Security: Europe", description: "European energy supply diversification post-Russia — LNG terminal expansions, storage at 65%", source: "IEA", category: "land", severity: "medium" },
];

const CRITICAL_INFRASTRUCTURE: EventData[] = [
  { id: "infra-nord-stream", lat: 55.53, lon: 15.35, date: new Date().toISOString(), type: "Sabotage: Nord Stream Pipelines", description: "Nord Stream 1 & 2 pipelines destroyed September 2022 — investigation ongoing, attributed to state actor", source: "UNCLOS", category: "land", severity: "critical" },
  { id: "infra-baltic-cables", lat: 58.0, lon: 21.0, date: new Date().toISOString(), type: "Sabotage: Baltic Undersea Cables", description: "Multiple Baltic Sea data cables and pipelines damaged 2024 — suspected Russian shadow fleet involvement", source: "NATO", category: "land", severity: "high" },
  { id: "infra-suez", lat: 30.0, lon: 32.6, date: new Date().toISOString(), type: "Chokepoint: Suez Canal", description: "Suez Canal — Houthi attacks reduced traffic 50%. $9B annual revenue at risk", source: "SCA", category: "land", severity: "high" },
  { id: "infra-strait-malacca", lat: 2.5, lon: 102.0, date: new Date().toISOString(), type: "Chokepoint: Strait of Malacca", description: "World's busiest shipping lane — $5T annual trade. Piracy and territorial tensions ongoing", source: "IMO", category: "land", severity: "medium" },
  { id: "infra-hormuz", lat: 26.6, lon: 56.3, date: new Date().toISOString(), type: "Chokepoint: Strait of Hormuz", description: "20% of global oil supply transits here — Iran IRGC seizures of tankers ongoing since 2023", source: "EIA", category: "land", severity: "high" },
  { id: "infra-panama-drought", lat: 9.0, lon: -79.6, date: new Date().toISOString(), type: "Climate Impact: Panama Canal", description: "Severe drought reducing water levels — ships limited to 24ft draft, major delays in 2024", source: "ACP", category: "land", severity: "medium" },
  { id: "infra-taiwan-chips", lat: 24.7, lon: 120.9, date: new Date().toISOString(), type: "Critical Industry: TSMC Hsinchu", description: "TSMC fabs — produce 90%+ of world's advanced chips (sub-7nm). Taiwan conflict scenario poses existential tech risk", source: "CSIS", category: "land", severity: "critical" },
  { id: "infra-russia-oil", lat: 56.8, lon: 60.6, date: new Date().toISOString(), type: "Sanctions Target: Russian Oil", description: "G7 oil price cap on Russian exports — shadow tanker fleet circumventing sanctions, estimated $180B revenue in 2024", source: "IEA", category: "land", severity: "high" },
];
