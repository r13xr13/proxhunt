import axios from "axios";
import { EventData } from "./conflict";
import { geoFromText } from "./rss";

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
