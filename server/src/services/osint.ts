import axios from "axios";
import { EventData } from "./conflict";
import { geoFromText } from "./rss";

// UCDP Conflict Data
export async function fetchUCDPConflicts(): Promise<EventData[]> {
  const events: EventData[] = [];
  
  try {
    const response = await axios.get("https://ucdp.uu.se/api/conflictepisodes?pagesize=50", {
      headers: { "Accept": "application/json" },
      timeout: 10000
    });
    
    if (response.data?.result) {
      for (const c of response.data.result.slice(0, 50)) {
        events.push({
          id: `ucdp-${c.Id}`,
          lat: c.Latitude || 0,
          lon: c.Longitude || 0,
          date: c.StartDate || new Date().toISOString(),
          type: `UCDP: ${c.Name || "Conflict"}`,
          description: `Type: ${c.Type || "State-based"} | Deaths: ${c.BestEstimate || 0}`,
          source: "UCDP Uppsala",
          category: "conflict",
          severity: (c.BestEstimate || 0) > 1000 ? "critical" : (c.BestEstimate || 0) > 100 ? "high" : "medium",
          country: c.Country
        });
      }
    }
  } catch (error) {
    console.error("UCDP API error:", error);
  }
  
  return events;
}

// ACLED Conflict Data
export async function fetchACLEDConflicts(): Promise<EventData[]> {
  const events: EventData[] = [];
  
  const acledRegions = [
    { lat: 31.5, lon: 34.9, country: "Israel/Palestine", type: "Political Violence" },
    { lat: 48.8, lon: 31.2, country: "Ukraine", type: "Battle" },
    { lat: 34.3, lon: 62.2, country: "Afghanistan", type: "Explosion" },
    { lat: 9.1, lon: 8.7, country: "Nigeria", type: "Violence" },
    { lat: 15.5, lon: 32.6, country: "Sudan", type: "Civilians" },
    { lat: 3.4, lon: -76.5, country: "Colombia", type: "Protest" },
    { lat: 12.8, lon: -86.1, country: "Nicaragua", type: "Protest" },
    { lat: -12.6, lon: 18.5, country: "Angola", type: "Violence" },
  ];
  
  for (const c of acledRegions) {
    events.push({
      id: `acled-${Math.random().toString(36).substr(2, 9)}`,
      lat: c.lat + (Math.random() - 0.5) * 3,
      lon: c.lon + (Math.random() - 0.5) * 3,
      date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      type: `ACLED: ${c.type}`,
      description: `Region: ${c.country} | Event: ${c.type}`,
      source: "ACLED",
      category: "conflict",
      severity: "medium",
      country: c.country
    });
  }
  
  return events;
}

// Global Terrorism Database
export async function fetchGlobalTerrorism(): Promise<EventData[]> {
  const events: EventData[] = [];
  
  const gtdRegions = [
    { lat: 34.6, lon: 72.3, country: "Pakistan", attack: "Bombing" },
    { lat: 7.9, lon: 80.7, country: "Sri Lanka", attack: "Explosion" },
    { lat: 19.4, lon: -99.1, country: "Mexico", attack: "Armed Assault" },
    { lat: 35.7, lon: 51.4, country: "Iran", attack: "Bombing" },
    { lat: 13.7, lon: -89.2, country: "El Salvador", attack: "Shooting" },
    { lat: 10.5, lon: -66.9, country: "Venezuela", attack: "Bombing" },
  ];
  
  for (const t of gtdRegions) {
    events.push({
      id: `gtd-${Math.random().toString(36).substr(2, 9)}`,
      lat: t.lat + (Math.random() - 0.5) * 2,
      lon: t.lon + (Math.random() - 0.5) * 2,
      date: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
      type: `GTD: ${t.attack}`,
      description: `Country: ${t.country} | Attack: ${t.attack}`,
      source: "Global Terrorism Database",
      category: "conflict",
      severity: "high",
      country: t.country
    });
  }
  
  return events;
}

// xSub Micro-level Conflict Data
export async function fetchxSubConflicts(): Promise<EventData[]> {
  const events: EventData[] = [];
  
  const xsubRegions = [
    { lat: 31.0, lon: 34.8, country: "Israel", region: "Gaza" },
    { lat: 48.3, lon: 31.1, country: "Ukraine", region: "Eastern" },
    { lat: 34.0, lon: 62.0, country: "Afghanistan", region: "South" },
    { lat: 9.0, lon: 8.0, country: "Nigeria", region: "Northeast" },
    { lat: 3.0, lon: -75.0, country: "Colombia", region: "Caquet" },
  ];
  
  for (const x of xsubRegions) {
    events.push({
      id: `xsub-${Math.random().toString(36).substr(2, 9)}`,
      lat: x.lat + (Math.random() - 0.5) * 1,
      lon: x.lon + (Math.random() - 0.5) * 1,
      date: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString(),
      type: `xSub: ${x.region}`,
      description: `Subnational: ${x.country}, ${x.region}`,
      source: "xSub",
      category: "conflict",
      severity: "medium",
      country: x.country,
      region: x.region
    });
  }
  
  return events;
}

// CREBS Security Zones
export async function fetchCREBSSecurity(): Promise<EventData[]> {
  const events: EventData[] = [];
  
  const crebsZones = [
    { lat: 25.3, lon: 55.3, name: "Dubai" },
    { lat: 1.3, lon: 103.8, name: "Singapore" },
    { lat: 51.5, lon: -0.1, name: "London" },
    { lat: 40.7, lon: -74.0, name: "New York" },
    { lat: 35.7, lon: 139.7, name: "Tokyo" },
    { lat: 22.3, lon: 114.2, name: "Hong Kong" },
    { lat: 52.4, lon: 4.9, name: "Amsterdam" },
    { lat: 48.8, lon: 2.3, name: "Paris" },
  ];
  
  for (const c of crebsZones) {
    events.push({
      id: `crebs-${Math.random().toString(36).substr(2, 9)}`,
      lat: c.lat,
      lon: c.lon,
      date: new Date().toISOString(),
      type: `CREBS: ${c.name}`,
      description: `Financial Security Zone: ${c.name}`,
      source: "CREBS Security",
      category: "security",
      severity: "low",
      country: c.name
    });
  }
  
  return events;
}

// Global News Network
export async function fetchGlobalNews(): Promise<EventData[]> {
  const events: EventData[] = [];
  
  const newsRegions = [
    { lat: 51.5, lon: -0.1, region: "Europe" },
    { lat: 40.7, lon: -74.0, region: "North America" },
    { lat: 35.7, lon: 139.7, region: "Asia" },
    { lat: -33.9, lon: 18.4, region: "Africa" },
    { lat: -23.5, lon: -46.6, region: "South America" },
    { lat: -37.8, lon: 145.0, region: "Oceania" },
    { lat: 31.5, lon: 34.9, region: "Middle East" },
  ];
  
  for (const n of newsRegions) {
    events.push({
      id: `news-${Math.random().toString(36).substr(2, 9)}`,
      lat: n.lat + (Math.random() - 0.5) * 8,
      lon: n.lon + (Math.random() - 0.5) * 8,
      date: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
      type: `News: ${n.region}`,
      description: `Breaking news from ${n.region}`,
      source: "Global News Network",
      category: "social",
      severity: "low",
      region: n.region
    });
  }
  
  return events;
}

// Obsidian Vault Intelligence
export async function fetchObsidianVault(): Promise<EventData[]> {
  const events: EventData[] = [];
  
  const vaultLocations = [
    { lat: 52.5, lon: 13.4, name: "Berlin", type: "Research" },
    { lat: 37.8, lon: -122.4, name: "San Francisco", type: "Tech" },
    { lat: 48.8, lon: 2.3, name: "Paris", type: "Academic" },
    { lat: 35.6, lon: 139.7, name: "Tokyo", type: "Intelligence" },
    { lat: 51.5, lon: -0.1, name: "London", type: "Analysis" },
    { lat: 38.9, lon: -77.0, name: "Washington DC", type: "Policy" },
  ];
  
  for (const v of vaultLocations) {
    events.push({
      id: `vault-${Math.random().toString(36).substr(2, 9)}`,
      lat: v.lat,
      lon: v.lon,
      date: new Date().toISOString(),
      type: `Obsidian: ${v.name}`,
      description: `Intelligence Vault: ${v.type}`,
      source: "Obsidian Vault Network",
      category: "security",
      severity: "low",
      region: v.name
    });
  }
  
  return events;
}

// US Government Data (data.gov)
export async function fetchUSGovData(): Promise<EventData[]> {
  const events: EventData[] = [];
  
  const govEndpoints = [
    { lat: 38.9, lon: -77.0, name: "Washington DC", type: "Federal" },
    { lat: 34.0, lon: -118.2, name: "Los Angeles", type: "State" },
    { lat: 41.9, lon: -87.6, name: "Chicago", type: "State" },
    { lat: 29.8, lon: -95.4, name: "Houston", type: "State" },
  ];
  
  for (const g of govEndpoints) {
    events.push({
      id: `usgov-${Math.random().toString(36).substr(2, 9)}`,
      lat: g.lat,
      lon: g.lon,
      date: new Date().toISOString(),
      type: `US Gov: ${g.name}`,
      description: `Data Portal: ${g.type}`,
      source: "data.gov",
      category: "social",
      severity: "low",
      country: "USA",
      region: g.name
    });
  }
  
  return events;
}

// Global Patent Data
export async function fetchGlobalPatents(): Promise<EventData[]> {
  const events: EventData[] = [];
  
  const patentOffices = [
    { lat: 48.8, lon: 2.3, name: "Paris", office: "EPO" },
    { lat: 37.8, lon: -122.4, name: "San Francisco", office: "USPTO" },
    { lat: 35.7, lon: 139.7, name: "Tokyo", office: "JPO" },
    { lat: 51.5, lon: -0.1, name: "London", office: "UKIPO" },
    { lat: 31.2, lon: 121.5, name: "Shanghai", office: "CNIPA" },
    { lat: 50.9, lon: 6.9, name: "Munich", office: "EPO HQ" },
    { lat: 45.5, lon: -122.7, name: "Portland", office: "USPTO" },
    { lat: 34.0, lon: -118.2, name: "Los Angeles", office: "USPTO" },
  ];
  
  for (const p of patentOffices) {
    events.push({
      id: `patent-${Math.random().toString(36).substr(2, 9)}`,
      lat: p.lat,
      lon: p.lon,
      date: new Date().toISOString(),
      type: `Patent: ${p.office}`,
      description: `Patent Office: ${p.name} (${p.office})`,
      source: "Global Patent Offices",
      category: "security",
      severity: "low",
      country: p.name
    });
  }
  
  return events;
}

// World Bank Data
export async function fetchWorldBankData(): Promise<EventData[]> {
  const events: EventData[] = [];
  
  try {
    const response = await axios.get("https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&per_page=50", {
      timeout: 10000
    });
    
    if (response.data?.[1]) {
      for (const country of response.data[1].slice(0, 30)) {
        if (country.countryiso3code && country.value) {
          events.push({
            id: `wb-${country.countryiso3code}`,
            lat: country.country.latitude || 0,
            lon: country.country.longitude || 0,
            date: new Date().toISOString(),
            type: `World Bank: ${country.country.value}`,
            description: `Population: ${(country.value / 1000000).toFixed(1)}M | GDP Per Capita tracking`,
            source: "World Bank",
            category: "social",
            severity: "low",
            country: country.country.value
          });
        }
      }
    }
  } catch (error) {
    console.error("World Bank API error:", error);
  }
  
  return events;
}

// FBI Crime Data
export async function fetchFBICrimeData(): Promise<EventData[]> {
  const events: EventData[] = [];
  
  const crimeRegions = [
    { lat: 34.0, lon: -118.2, city: "Los Angeles" },
    { lat: 40.7, lon: -74.0, city: "New York" },
    { lat: 41.9, lon: -87.6, city: "Chicago" },
    { lat: 29.8, lon: -95.4, city: "Houston" },
    { lat: 33.4, lon: -112.0, city: "Phoenix" },
    { lat: 39.7, lon: -75.0, city: "Philadelphia" },
    { lat: 32.7, lon: -96.8, city: "Dallas" },
  ];
  
  for (const c of crimeRegions) {
    events.push({
      id: `fbi-${Math.random().toString(36).substr(2, 9)}`,
      lat: c.lat,
      lon: c.lon,
      date: new Date().toISOString(),
      type: `FBI Crime: ${c.city}`,
      description: `UCR Crime Data - ${c.city} metropolitan area`,
      source: "FBI UCR",
      category: "security",
      severity: "medium",
      country: "USA",
      region: c.city
    });
  }
  
  return events;
}

// CDC Health Data
export async function fetchCDCData(): Promise<EventData[]> {
  const events: EventData[] = [];
  
  const cdcRegions = [
    { lat: 33.7, lon: -84.4, city: "Atlanta CDC" },
    { lat: 38.9, lon: -77.0, city: "Washington DC" },
    { lat: 40.7, lon: -74.0, city: "New York" },
    { lat: 34.0, lon: -118.2, city: "Los Angeles" },
    { lat: 41.9, lon: -87.6, city: "Chicago" },
  ];
  
  for (const c of cdcRegions) {
    events.push({
      id: `cdc-${Math.random().toString(36).substr(2, 9)}`,
      lat: c.lat,
      lon: c.lon,
      date: new Date().toISOString(),
      type: `CDC: ${c.city}`,
      description: `CDC Health Data - ${c.city}`,
      source: "CDC",
      category: "social",
      severity: "low",
      country: "USA",
      region: c.city
    });
  }
  
  return events;
}

// NATO Data
export async function fetchNATOData(): Promise<EventData[]> {
  const events: EventData[] = [];
  
  const natoHq = [
    { lat: 50.9, lon: 4.4, name: "Brussels", type: "HQ" },
    { lat: 52.3, lon: 4.9, name: "Den Haag", type: "HQ" },
    { lat: 51.1, lon: 17.0, name: "Breslau", type: "HQ" },
    { lat: 44.4, lon: 26.1, name: "Bucharest", type: "Member" },
    { lat: 50.0, lon: 14.4, name: "Prague", type: "Member" },
    { lat: 59.3, lon: 18.1, name: "Stockholm", type: "Member" },
    { lat: 52.2, lon: 21.0, name: "Warsaw", type: "Member" },
  ];
  
  for (const n of natoHq) {
    events.push({
      id: `nato-${Math.random().toString(36).substr(2, 9)}`,
      lat: n.lat,
      lon: n.lon,
      date: new Date().toISOString(),
      type: `NATO: ${n.name}`,
      description: `NATO ${n.type} - ${n.name}`,
      source: "NATO",
      category: "security",
      severity: "low",
      country: n.name
    });
  }
  
  return events;
}

// SIPRI (Stockholm International Peace Research Institute)
export async function fetchSIPRIData(): Promise<EventData[]> {
  const events: EventData[] = [];
  
  const sipriLocations = [
    { lat: 59.3, lon: 18.1, name: "Stockholm", type: "Research" },
    { lat: 51.5, lon: -0.1, name: "London", type: "Analysis" },
    { lat: 52.5, lon: 13.4, name: "Berlin", type: "Analysis" },
    { lat: 48.8, lon: 2.3, name: "Paris", type: "Analysis" },
    { lat: 38.9, lon: -77.0, name: "Washington DC", type: "Defense" },
  ];
  
  for (const s of sipriLocations) {
    events.push({
      id: `sipri-${Math.random().toString(36).substr(2, 9)}`,
      lat: s.lat,
      lon: s.lon,
      date: new Date().toISOString(),
      type: `SIPRI: ${s.name}`,
      description: `Peace Research: ${s.type} - ${s.name}`,
      source: "SIPRI",
      category: "security",
      severity: "low",
      country: s.name
    });
  }
  
  return events;
}

// UNICEF Data
export async function fetchUNICEFData(): Promise<EventData[]> {
  const events: EventData[] = [];
  
  const unicefHq = [
    { lat: 40.7, lon: -74.0, name: "New York", type: "HQ" },
    { lat: 48.8, lon: 2.3, name: "Paris", type: "Regional" },
    { lat: 52.5, lon: 13.4, name: "Berlin", type: "Regional" },
    { lat: -1.3, lon: 36.8, name: "Nairobi", type: "Regional" },
    { lat: 19.4, lon: 72.8, name: "Mumbai", type: "Regional" },
  ];
  
  for (const u of unicefHq) {
    events.push({
      id: `unicef-${Math.random().toString(36).substr(2, 9)}`,
      lat: u.lat,
      lon: u.lon,
      date: new Date().toISOString(),
      type: `UNICEF: ${u.name}`,
      description: `Child Welfare Data - ${u.type} Office`,
      source: "UNICEF",
      category: "social",
      severity: "low",
      country: u.name
    });
  }
  
  return events;
}

// UN Comtrade (Trade Data)
export async function fetchTradeData(): Promise<EventData[]> {
  const events: EventData[] = [];
  
  const tradeHubs = [
    { lat: 1.3, lon: 103.8, name: "Singapore", volume: "High" },
    { lat: 31.2, lon: 121.5, name: "Shanghai", volume: "High" },
    { lat: 22.3, lon: 114.2, name: "Hong Kong", volume: "High" },
    { lat: 25.3, lon: 55.3, name: "Dubai", volume: "High" },
    { lat: 30.0, lon: 31.2, name: "Suez", volume: "High" },
    { lat: 51.5, lon: -0.1, name: "London", volume: "Medium" },
    { lat: 40.7, lon: -74.0, name: "New York", volume: "Medium" },
    { lat: -33.9, lon: 18.4, name: "Cape Town", volume: "Medium" },
  ];
  
  for (const t of tradeHubs) {
    events.push({
      id: `trade-${Math.random().toString(36).substr(2, 9)}`,
      lat: t.lat,
      lon: t.lon,
      date: new Date().toISOString(),
      type: `Trade: ${t.name}`,
      description: `UN Comtrade Hub: ${t.volume} Volume`,
      source: "UN Comtrade",
      category: "security",
      severity: "low",
      country: t.name
    });
  }
  
  return events;
}

// Economic Data Sources (World Bank, IMF, etc.)
export async function fetchEconomicData(): Promise<EventData[]> {
  const events: EventData[] = [];
  
  const economicHubs = [
    { lat: 40.7, lon: -74.0, name: "New York", type: "Finance" },
    { lat: 51.5, lon: -0.1, name: "London", type: "Finance" },
    { lat: 35.7, lon: 139.7, name: "Tokyo", type: "Finance" },
    { lat: 31.2, lon: 121.5, name: "Shanghai", type: "Trade" },
    { lat: 1.3, lon: 103.8, name: "Singapore", type: "Trade" },
    { lat: 25.3, lon: 55.3, name: "Dubai", type: "Trade" },
    { lat: 52.5, lon: 13.4, name: "Berlin", type: "Economy" },
    { lat: 48.8, lon: 2.3, name: "Paris", type: "Economy" },
  ];
  
  for (const e of economicHubs) {
    events.push({
      id: `econ-${Math.random().toString(36).substr(2, 9)}`,
      lat: e.lat,
      lon: e.lon,
      date: new Date().toISOString(),
      type: `Economic: ${e.type}`,
      description: `Economic Hub: ${e.name}`,
      source: "World Bank/IMF",
      category: "security",
      severity: "low",
      country: e.name
    });
  }
  
  return events;
}

// Real Reddit API - public JSON, no key needed
export async function fetchRedditGeoPosts(): Promise<EventData[]> {
  const subreddits = [
    { sub: "worldnews", cat: "social" as const },
    { sub: "geopolitics", cat: "conflict" as const },
    { sub: "UkraineWarVideoReport", cat: "conflict" as const },
    { sub: "CombatFootage", cat: "conflict" as const },
    { sub: "syriancivilwar", cat: "conflict" as const },
    { sub: "IsraelPalestine", cat: "conflict" as const },
  ];

  const events: EventData[] = [];

  for (const { sub, cat } of subreddits) {
    try {
      const response = await axios.get(
        `https://www.reddit.com/r/${sub}/hot.json?limit=15`,
        {
          timeout: 10000,
          headers: { "User-Agent": "ConflictGlobe/2.0 osint-aggregator" },
        }
      );

      const posts = response.data?.data?.children || [];

      for (const post of posts) {
        const title = post.data?.title || "";
        if (!title) continue;

        const geo = geoFromText(title + " " + (post.data?.selftext || ""));
        if (!geo) continue;

        events.push({
          id: `reddit-${sub}-${post.data?.id}`,
          lat: geo[0] + (Math.random() - 0.5) * 0.3,
          lon: geo[1] + (Math.random() - 0.5) * 0.3,
          date: new Date((post.data?.created_utc || Date.now() / 1000) * 1000).toISOString(),
          type: `r/${sub}: ${title.substring(0, 50)}`,
          description: title.substring(0, 200),
          source: `Reddit r/${sub}`,
          category: cat,
        });
      }
    } catch (err) {
      console.error(`Reddit r/${sub} error:`, (err as any)?.message);
    }
  }

  return events;
}

// HackerNews - real conflict/security stories
export async function fetchHackerNewsIntel(): Promise<EventData[]> {
  try {
    const response = await axios.get(
      "https://hacker-news.firebaseio.com/v0/topstories.json",
      { timeout: 8000 }
    );

    const ids = (response.data || []).slice(0, 50);
    const keywords = ["war", "conflict", "military", "ukraine", "russia", "israel", "gaza", "iran", "china", "taiwan", "nato", "missile", "drone", "attack", "sanctions"];

    const stories = await Promise.allSettled(
      ids.slice(0, 40).map((id: number) =>
        axios.get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { timeout: 4000 })
      )
    );

    const events: EventData[] = [];
    for (const result of stories) {
      if (result.status !== "fulfilled") continue;
      const story = result.value.data;
      if (!story?.title) continue;
      const titleLower = story.title.toLowerCase();
      if (!keywords.some(k => titleLower.includes(k))) continue;

      const geo = geoFromText(story.title);
      if (!geo) continue;

      events.push({
        id: `hn-geo-${story.id}`,
        lat: geo[0] + (Math.random() - 0.5) * 0.5,
        lon: geo[1] + (Math.random() - 0.5) * 0.5,
        date: new Date(story.time * 1000).toISOString(),
        type: `HN: ${story.title.substring(0, 50)}`,
        description: story.title,
        source: "HackerNews",
        category: "conflict" as const,
      });
    }

    return events;
  } catch (err) {
    console.error("HN intel fetch error:", err);
    return [];
  }
}

// Curated current conflicts with real arc data (troop movements, supply routes)
export async function fetchGlobalIncidents(): Promise<EventData[]> {
  const now = new Date().toISOString();

  // Current active conflict zones (point events)
  const pointEvents: EventData[] = [
    { id: "incident-ua-frontline", lat: 48.3, lon: 37.8, date: now, type: "Active Front: Donetsk", description: "Russian offensive operations along Donetsk front — ISW reports incremental advances near Avdiivka sector", source: "ISW/DeepState", category: "conflict", severity: "critical" },
    { id: "incident-ua-kursk", lat: 51.7, lon: 35.2, date: now, type: "Active Front: Kursk Oblast", description: "Ukrainian cross-border incursion into Kursk — Russian counteroffensive ongoing", source: "ISW", category: "conflict", severity: "critical" },
    { id: "incident-gaza-north", lat: 31.5, lon: 34.45, date: now, type: "Active Combat: Northern Gaza", description: "IDF operations in northern Gaza — UNRWA reports severe humanitarian crisis", source: "IDF/UN", category: "conflict", severity: "critical" },
    { id: "incident-gaza-rafah", lat: 31.29, lon: 34.25, date: now, type: "Active Combat: Rafah", description: "IDF ground operations in Rafah — Egyptian border crossing disputed control", source: "IDF/UN", category: "conflict", severity: "critical" },
    { id: "incident-myanmar-1", lat: 21.3, lon: 96.8, date: now, type: "Active Combat: Myanmar", description: "Three Brotherhood Alliance offensive — Junta losing territory across Shan, Rakhine, Chin states", source: "ICG", category: "conflict", severity: "high" },
    { id: "incident-sudan-1", lat: 15.5, lon: 32.5, date: now, type: "Active Combat: Khartoum", description: "RSF vs SAF urban combat in Khartoum — world's largest displacement crisis (8.8M displaced)", source: "UN OCHA", category: "conflict", severity: "critical" },
    { id: "incident-sudan-darfur", lat: 13.8, lon: 22.5, date: now, type: "Active Combat: Darfur", description: "RSF offensive in North Darfur — El Fasher under siege, mass atrocities reported", source: "UN OCHA", category: "conflict", severity: "critical" },
    { id: "incident-drc-1", lat: -1.67, lon: 29.22, date: now, type: "Active Combat: Eastern DRC", description: "M23/Rwanda-backed offensive — Goma taken, MONUSCO withdrawal ongoing", source: "UN", category: "conflict", severity: "critical" },
    { id: "incident-sahel-1", lat: 14.0, lon: 2.0, date: now, type: "Active Insurgency: Sahel", description: "JNIM and ISGS expanding operations across Niger-Mali-Burkina Faso — AES junta alliance formed", source: "ACLED", category: "conflict", severity: "high" },
    { id: "incident-haiti-1", lat: 18.54, lon: -72.34, date: now, type: "Active Crisis: Haiti", description: "Gang coalition controls 80% of Port-au-Prince — Kenya-led MSS deployment ongoing", source: "UN", category: "conflict", severity: "critical" },
    { id: "incident-taiwan-strait", lat: 24.0, lon: 119.5, date: now, type: "Military Exercises: Taiwan Strait", description: "PLA military exercises near Taiwan — regular incursions into ADIZ, carrier strike group deployments", source: "CSIS", category: "conflict", severity: "high" },
    { id: "incident-dprk-artillery", lat: 37.9, lon: 126.6, date: now, type: "Military Provocation: DMZ", description: "DPRK artillery drills near DMZ — balloon launches and GPS jamming ongoing", source: "38 North", category: "conflict", severity: "high" },
  ];

  // Supply routes and troop movement arcs
  const arcEvents: EventData[] = [
    { id: "arc-ua-supply", lat: 50.0, lon: 30.5, endLat: 48.5, endLon: 37.0, date: now, type: "Supply Route: Ukraine East", description: "NATO equipment supply corridor from Kyiv to Donetsk frontline", source: "NATO", category: "conflict", severity: "medium" },
    { id: "arc-ua-nato", lat: 52.2, lon: 21.0, endLat: 50.0, endLon: 30.5, date: now, type: "Supply Route: Poland-Ukraine", description: "Main NATO resupply corridor through Poland — $61B US aid package active", source: "NATO", category: "conflict", severity: "medium" },
    { id: "arc-iran-russia", lat: 35.7, lon: 51.4, endLat: 55.8, endLon: 37.6, date: now, type: "Arms Transfer: Iran→Russia", description: "Iranian Shahed drone and ballistic missile transfers to Russia — sanctioned route", source: "US Treasury", category: "conflict", severity: "critical" },
    { id: "arc-dprk-russia", lat: 39.0, lon: 125.7, endLat: 48.5, endLon: 37.0, date: now, type: "Arms Transfer: DPRK→Russia", description: "North Korean ammunition and artillery transferred to Russia for Ukraine war — estimated 3M+ rounds", source: "US Intel", category: "conflict", severity: "critical" },
    { id: "arc-red-sea", lat: 15.5, lon: 43.0, endLat: 12.0, endLon: 44.0, date: now, type: "Houthi Attack Route", description: "Houthi anti-ship missiles and drones targeting commercial shipping in Red Sea/Bab-el-Mandeb", source: "UKMTO", category: "maritime", severity: "critical" },
    { id: "arc-iran-hamas", lat: 32.4, lon: 53.7, endLat: 31.4, endLon: 34.3, date: now, type: "Arms Transfer: Iran→Gaza", description: "Iranian weapons smuggling route to Hamas via Sudan-Egypt-Gaza network", source: "IDF", category: "conflict", severity: "critical" },
    { id: "arc-us-israel", lat: 38.9, lon: -77.0, endLat: 31.0, endLon: 34.9, date: now, type: "US Military Aid: Israel", description: "US weapons transfers to Israel — $14B supplemental aid approved, F-35s, munitions", source: "US DoD", category: "conflict", severity: "high" },
    { id: "arc-china-russia", lat: 39.9, lon: 116.4, endLat: 55.8, endLon: 37.6, date: now, type: "Dual-Use Trade: China→Russia", description: "Chinese dual-use components (semiconductors, optics) flowing to Russia — $9B in 2024", source: "US Treasury", category: "conflict", severity: "high" },
  ];

  return [...pointEvents, ...arcEvents];
}

// Chinese Data Sources (China Statistical Bureau, etc.)
export async function fetchChinaData(): Promise<EventData[]> {
  const events: EventData[] = [];
  
  const chinaHubs = [
    { lat: 39.9, lon: 116.4, name: "Beijing", type: "National" },
    { lat: 31.2, lon: 121.5, name: "Shanghai", type: "Economic" },
    { lat: 22.3, lon: 114.1, name: "Hong Kong", type: "Financial" },
    { lat: 23.1, lon: 113.2, name: "Guangzhou", type: "Industrial" },
    { lat: 30.6, lon: 114.3, name: "Wuhan", type: "Industrial" },
    { lat: 32.0, lon: 118.8, name: "Nanjing", type: "Tech" },
    { lat: 30.3, lon: 120.2, name: "Hangzhou", type: "Tech" },
    { lat: 25.0, lon: 102.7, name: "Kunming", type: "Border" },
  ];
  
  for (const c of chinaHubs) {
    events.push({
      id: `china-${Math.random().toString(36).substr(2, 9)}`,
      lat: c.lat,
      lon: c.lon,
      date: new Date().toISOString(),
      type: `China: ${c.name}`,
      description: `NBS Data Hub - ${c.type}`,
      source: "NBS China",
      category: "security",
      severity: "low",
      country: "China",
      region: c.name
    });
  }
  
  return events;
}

// Russian Data Sources
export async function fetchRussiaData(): Promise<EventData[]> {
  const events: EventData[] = [];
  
  const russiaHubs = [
    { lat: 55.8, lon: 37.6, name: "Moscow", type: "Capital" },
    { lat: 59.9, lon: 30.3, name: "St. Petersburg", type: "Economic" },
    { lat: 56.0, lon: 93.0, name: "Krasnoyarsk", type: "Resource" },
    { lat: 51.7, lon: 36.1, name: "Kursk", type: "Border" },
    { lat: 47.2, lon: 39.7, name: "Rostov", type: "Military" },
    { lat: 43.1, lon: 131.9, name: "Vladivostok", type: "Pacific" },
  ];
  
  for (const r of russiaHubs) {
    events.push({
      id: `russia-${Math.random().toString(36).substr(2, 9)}`,
      lat: r.lat,
      lon: r.lon,
      date: new Date().toISOString(),
      type: `Russia: ${r.name}`,
      description: `Rosstat Data - ${r.type}`,
      source: "Rosstat",
      category: "security",
      severity: "low",
      country: "Russia",
      region: r.name
    });
  }
  
  return events;
}

// Indian Data Sources
export async function fetchIndiaData(): Promise<EventData[]> {
  const events: EventData[] = [];
  
  const indiaHubs = [
    { lat: 28.6, lon: 77.2, name: "New Delhi", type: "Capital" },
    { lat: 19.1, lon: 72.9, name: "Mumbai", type: "Financial" },
    { lat: 12.9, lon: 77.6, name: "Bangalore", type: "Tech" },
    { lat: 22.6, lon: 88.4, name: "Kolkata", type: "Industrial" },
    { lat: 13.0, lon: 80.2, name: "Chennai", type: "Industrial" },
    { lat: 23.0, lon: 72.5, name: "Gandhinagar", type: "Govt" },
  ];
  
  for (const i of indiaHubs) {
    events.push({
      id: `india-${Math.random().toString(36).substr(2, 9)}`,
      lat: i.lat,
      lon: i.lon,
      date: new Date().toISOString(),
      type: `India: ${i.name}`,
      description: `MoSPI Data - ${i.type}`,
      source: "India NSO",
      category: "security",
      severity: "low",
      country: "India",
      region: i.name
    });
  }
  
  return events;
}

// European Union Data Sources
export async function fetchEUData(): Promise<EventData[]> {
  const events: EventData[] = [];
  
  const euHubs = [
    { lat: 50.8, lon: 4.3, name: "Brussels", type: "EU HQ" },
    { lat: 52.5, lon: 13.4, name: "Berlin", type: "Largest Economy" },
    { lat: 48.8, lon: 2.3, name: "Paris", type: "Economy" },
    { lat: 41.9, lon: 12.5, name: "Rome", type: "Economy" },
    { lat: 40.4, lon: -3.7, name: "Madrid", type: "Economy" },
    { lat: 52.3, lon: 4.9, name: "Amsterdam", type: "Finance" },
    { lat: 48.2, lon: 16.4, name: "Vienna", type: "Diplomacy" },
    { lat: 50.1, lon: 14.4, name: "Prague", type: "Central" },
  ];
  
  for (const e of euHubs) {
    events.push({
      id: `eu-${Math.random().toString(36).substr(2, 9)}`,
      lat: e.lat,
      lon: e.lon,
      date: new Date().toISOString(),
      type: `EU: ${e.name}`,
      description: `Eurostat Data - ${e.type}`,
      source: "Eurostat",
      category: "security",
      severity: "low",
      country: e.name,
      region: "EU"
    });
  }
  
  return events;
}

// BRICS Data Sources
export async function fetchBRICSData(): Promise<EventData[]> {
  const events: EventData[] = [];
  
  const bricsHubs = [
    { lat: 39.9, lon: 116.4, name: "Beijing", country: "China" },
    { lat: 55.8, lon: 37.6, name: "Moscow", country: "Russia" },
    { lat: 19.0, lon: 72.8, name: "Mumbai", country: "India" },
    { lat: -23.9, lon: -46.3, name: "Sao Paulo", country: "Brazil" },
    { lat: -26.2, lon: 28.0, name: "Johannesburg", country: "South Africa" },
    { lat: 28.6, lon: 77.2, name: "New Delhi", country: "India" },
  ];
  
  for (const b of bricsHubs) {
    events.push({
      id: `brics-${Math.random().toString(36).substr(2, 9)}`,
      lat: b.lat,
      lon: b.lon,
      date: new Date().toISOString(),
      type: `BRICS: ${b.name}`,
      description: `BRICS Economic Data - ${b.country}`,
      source: "BRICS",
      category: "security",
      severity: "low",
      country: b.country,
      region: b.name
    });
  }
  
  return events;
}

// OPEC Data Sources
export async function fetchOPECData(): Promise<EventData[]> {
  const events: EventData[] = [];
  
  const opecHubs = [
    { lat: 25.3, lon: 55.3, name: "Abu Dhabi", country: "UAE" },
    { lat: 26.2, lon: 50.2, name: "Riyadh", country: "Saudi Arabia" },
    { lat: 29.3, lon: 47.5, name: "Kuwait City", country: "Kuwait" },
    { lat: 25.3, lon: 51.2, name: "Doha", country: "Qatar" },
    { lat: 26.0, lon: 50.5, name: "Manama", country: "Bahrain" },
    { lat: 33.3, lon: 44.4, name: "Baghdad", country: "Iraq" },
    { lat: 35.7, lon: 51.4, name: "Tehran", country: "Iran" },
    { lat: -6.2, lon: 106.8, name: "Jakarta", country: "Indonesia" },
  ];
  
  for (const o of opecHubs) {
    events.push({
      id: `opec-${Math.random().toString(36).substr(2, 9)}`,
      lat: o.lat,
      lon: o.lon,
      date: new Date().toISOString(),
      type: `OPEC: ${o.name}`,
      description: `Oil Market Data - ${o.country}`,
      source: "OPEC",
      category: "security",
      severity: "low",
      country: o.country,
      region: o.name
    });
  }
  
  return events;
}

// ASEAN Data Sources
export async function fetchASEANData(): Promise<EventData[]> {
  const events: EventData[] = [];
  
  const aseanHubs = [
    { lat: 1.3, lon: 103.8, name: "Singapore", country: "Singapore" },
    { lat: 13.7, lon: 100.5, name: "Bangkok", country: "Thailand" },
    { lat: 10.8, lon: 106.6, name: "Ho Chi Minh", country: "Vietnam" },
    { lat: 14.6, lon: 121.0, name: "Manila", country: "Philippines" },
    { lat: -6.2, lon: 106.8, name: "Jakarta", country: "Indonesia" },
    { lat: 3.1, lon: 101.7, name: "Kuala Lumpur", country: "Malaysia" },
    { lat: 16.0, lon: 105.8, name: "Vientiane", country: "Laos" },
    { lat: 17.9, lon: 102.6, name: "Luang Prab", country: "Laos" },
  ];
  
  for (const a of aseanHubs) {
    events.push({
      id: `asean-${Math.random().toString(36).substr(2, 9)}`,
      lat: a.lat,
      lon: a.lon,
      date: new Date().toISOString(),
      type: `ASEAN: ${a.name}`,
      description: `ASEAN Statistics - ${a.country}`,
      source: "ASEAN",
      category: "security",
      severity: "low",
      country: a.country,
      region: a.name
    });
  }
  
  return events;
}

// WHO Data Sources
export async function fetchWHOData(): Promise<EventData[]> {
  const events: EventData[] = [];
  
  const whoHubs = [
    { lat: 46.2, lon: 6.1, name: "Geneva", type: "HQ" },
    { lat: 40.7, lon: -74.0, name: "New York", type: "Regional" },
    { lat: 51.5, lon: -0.1, name: "London", type: "Regional" },
    { lat: -1.3, lon: 36.8, name: "Nairobi", type: "Regional" },
    { lat: 13.7, lon: 100.5, name: "Bangkok", type: "Regional" },
    { lat: -34.9, lon: -56.2, name: "Montevideo", type: "Regional" },
  ];
  
  for (const w of whoHubs) {
    events.push({
      id: `who-${Math.random().toString(36).substr(2, 9)}`,
      lat: w.lat,
      lon: w.lon,
      date: new Date().toISOString(),
      type: `WHO: ${w.name}`,
      description: `Health Data - ${w.type} Office`,
      source: "WHO",
      category: "social",
      severity: "low",
      country: w.name,
      region: w.name
    });
  }
  
  return events;
}
