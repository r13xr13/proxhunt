import axios from "axios";
import { EventData } from "./conflict";
import { geoFromText } from "./rss";

// Real Reddit public JSON API for social intelligence
export async function fetchTwitterGeoAlerts(): Promise<EventData[]> {
  // Twitter/X requires paid API. Use Mastodon public timeline as free alternative
  try {
    const response = await axios.get(
      "https://mastodon.social/api/v1/timelines/public?limit=40&remote=true",
      { timeout: 10000 }
    );

    const events: EventData[] = [];
    const keywords = ["war", "conflict", "attack", "military", "strike", "invasion", "troops", "missiles", "ukraine", "russia", "gaza", "israel", "nato"];

    for (const post of (response.data || [])) {
      const content = post.content?.replace(/<[^>]+>/g, "") || "";
      if (!keywords.some(k => content.toLowerCase().includes(k))) continue;
      const geo = geoFromText(content);
      if (!geo) continue;

      events.push({
        id: `mastodon-${post.id}`,
        lat: geo[0] + (Math.random() - 0.5) * 0.5,
        lon: geo[1] + (Math.random() - 0.5) * 0.5,
        date: post.created_at || new Date().toISOString(),
        type: `Social Intel: ${content.substring(0, 40)}`,
        description: content.substring(0, 200),
        source: "Mastodon Social",
        category: "social" as const,
      });
    }

    return events.slice(0, 15);
  } catch {
    return [];
  }
}

// Reddit live threads - real API
export async function fetchRedditLiveThreads(): Promise<EventData[]> {
  const liveSubs = ["ukraine", "worldnews", "geopolitics"];
  const events: EventData[] = [];

  for (const sub of liveSubs) {
    try {
      const response = await axios.get(
        `https://www.reddit.com/r/${sub}/new.json?limit=10`,
        {
          timeout: 8000,
          headers: { "User-Agent": "ConflictGlobe/2.0" },
        }
      );

      for (const post of response.data?.data?.children || []) {
        const title = post.data?.title || "";
        const geo = geoFromText(title);
        if (!geo) continue;

        events.push({
          id: `reddit-live-${post.data?.id}`,
          lat: geo[0] + (Math.random() - 0.5) * 0.3,
          lon: geo[1] + (Math.random() - 0.5) * 0.3,
          date: new Date((post.data?.created_utc || Date.now() / 1000) * 1000).toISOString(),
          type: `r/${sub}: ${title.substring(0, 50)}`,
          description: title.substring(0, 200),
          source: `Reddit r/${sub}`,
          category: "social" as const,
        });
      }
    } catch { /* continue */ }
  }

  return events;
}

// Telegram is not publicly scrapable - return curated channel summaries
export async function fetchTelegramChannels(): Promise<EventData[]> {
  // These are known OSINT Telegram channels with fixed geographic focus
  return [
    { id: "tg-rybar", lat: 48.3794, lon: 31.1656, date: new Date().toISOString(), type: "Telegram: Rybar (Ukraine front)", description: "High-frequency military maps channel — Russian perspective on Donetsk/Zaporizhzhia front updates", source: "Telegram/Rybar", category: "social", severity: "medium" },
    { id: "tg-deepstate", lat: 48.5, lon: 38.0, date: new Date().toISOString(), type: "Telegram: DeepState (Ukraine)", description: "Ukrainian military map tracking — real-time front line changes and geolocated incidents", source: "Telegram/DeepStateUA", category: "social", severity: "medium" },
    { id: "tg-israelisint", lat: 31.3547, lon: 34.3088, date: new Date().toISOString(), type: "Telegram: Gaza Intel", description: "IDF spokesperson + Gaza-focused channels — strikes, hostage updates, humanitarian corridors", source: "Telegram/IDF", category: "social", severity: "high" },
    { id: "tg-osint-ukraine", lat: 50.4501, lon: 30.5234, date: new Date().toISOString(), type: "Telegram: Ukraine OSINTers", description: "Aggregated from @Ukraine_war_status, @UkraineNow — Kyiv-based verified OSINT updates", source: "Telegram OSINT", category: "social", severity: "high" },
  ] as EventData[];
}

// Dark/cyber web - use CISA alerts instead of fake data
export async function fetchWebIntrusionAlerts(): Promise<EventData[]> { return []; }
export async function fetchDarkWebAlerts(): Promise<EventData[]> { return []; }
