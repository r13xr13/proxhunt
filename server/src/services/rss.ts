import axios from "axios";
import * as cheerio from "cheerio";
import { EventData } from "./conflict";

const GEO_KEYWORDS: Record<string, [number, number]> = {
  "ukraine": [48.3794, 31.1656], "donetsk": [48.0028, 37.8058],
  "kharkiv": [49.9935, 36.2304], "zaporizhzhia": [47.8388, 35.1396],
  "odesa": [46.4825, 30.7233], "mariupol": [47.0972, 37.5434],
  "kherson": [46.6354, 32.6169], "bakhmut": [48.5956, 38.0008],
  "russia": [55.7558, 37.6173], "moscow": [55.7558, 37.6173],
  "st. petersburg": [59.9343, 30.3351], "kaliningrad": [54.7104, 20.4522],
  "gaza": [31.3547, 34.3088], "israel": [31.0461, 34.8516],
  "jerusalem": [31.7683, 35.2137], "tel aviv": [32.0853, 34.7818],
  "west bank": [31.9522, 35.2332], "rafah": [31.2968, 34.2490],
  "hezbollah": [33.8547, 35.8623], "lebanon": [33.8547, 35.8623],
  "beirut": [33.8938, 35.5018], "syria": [34.8021, 38.9968],
  "damascus": [33.5138, 36.2765], "aleppo": [36.2012, 37.1343],
  "iraq": [33.3152, 44.3661], "baghdad": [33.3152, 44.3661],
  "mosul": [36.3400, 43.1300], "afghanistan": [33.9391, 67.7099],
  "kabul": [34.5553, 69.2075], "yemen": [15.5527, 48.5164],
  "sanaa": [15.3694, 44.1910], "aden": [12.7794, 45.0087],
  "houthi": [15.5527, 48.5164], "libya": [26.3351, 17.2283],
  "tripoli": [32.8872, 13.1913], "sudan": [12.8628, 30.2176],
  "khartoum": [15.5007, 32.5599], "ethiopia": [9.1450, 40.4897],
  "tigray": [14.0, 38.5], "somalia": [5.1521, 46.1996],
  "mogadishu": [2.0469, 45.3182], "niger": [17.6078, 8.0817],
  "mali": [17.5707, -3.9962], "burkina faso": [12.2383, -1.5616],
  "congo": [-4.0383, 21.7587], "drc": [-4.0383, 21.7587],
  "myanmar": [21.9162, 95.9560], "burma": [21.9162, 95.9560],
  "taiwan": [23.6978, 120.9605], "south china sea": [15.0, 115.0],
  "east china sea": [30.0, 125.0], "china": [35.8617, 104.1954],
  "beijing": [39.9042, 116.4074], "hong kong": [22.3193, 114.1694],
  "north korea": [40.3399, 127.5101], "pyongyang": [39.0392, 125.7625],
  "south korea": [35.9078, 127.7669], "seoul": [37.5665, 126.9780],
  "japan": [36.2048, 138.2529], "tokyo": [35.6762, 139.6503],
  "india": [20.5937, 78.9629], "kashmir": [34.0837, 74.7973],
  "pakistan": [30.3753, 69.3451], "iran": [32.4279, 53.6880],
  "tehran": [35.6892, 51.3890], "persian gulf": [26.0, 52.0],
  "strait of hormuz": [26.6, 56.3], "red sea": [20.0, 38.0],
  "saudi": [23.8859, 45.0792], "riyadh": [24.7136, 46.6753],
  "nato": [50.8503, 4.3517], "pentagon": [38.8719, -77.0563],
  "ukraine war": [48.3794, 31.1656], "black sea": [43.0, 34.0],
  "baltic": [55.0, 14.0], "mediterranean": [35.0, 18.0],
  "arctic": [75.0, 40.0], "niger coup": [17.6078, 8.0817],
  "hamas": [31.3547, 34.3088], "isis": [33.3152, 44.3661],
  "al-shabaab": [5.1521, 46.1996], "wagner": [55.7558, 37.6173],
  "venezuela": [6.4238, -66.5897], "haiti": [18.9712, -72.2852],
  "mexico cartel": [23.6345, -102.5528], "colombia": [4.5709, -74.2973],
  "nagorno-karabakh": [39.8265, 46.7517], "armenia": [40.0691, 45.0382],
  "azerbaijan": [40.1431, 47.5769], "georgia": [42.3154, 43.3569],
  "serbia": [44.0165, 21.0059], "kosovo": [42.6026, 20.9030],
  "poland": [51.9194, 19.1451], "warsaw": [52.2297, 21.0122],
  "finland": [61.9241, 25.7482], "sweden": [60.1282, 18.6435],
};

export function geoFromText(text: string): [number, number] | null {
  const lower = text.toLowerCase();
  for (const [kw, coords] of Object.entries(GEO_KEYWORDS)) {
    if (lower.includes(kw)) return coords;
  }
  return null;
}

async function fetchRSS(url: string, sourceName: string, category: EventData["category"]): Promise<EventData[]> {
  try {
    const response = await axios.get(url, {
      timeout: 12000,
      headers: {
        "User-Agent": "ConflictGlobe/2.0 OSINT aggregator",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
      },
    });

    const $ = cheerio.load(response.data, { xmlMode: true });
    const events: EventData[] = [];

    $("item").slice(0, 20).each((_, el) => {
      const title = $(el).find("title").text().trim();
      const desc = $(el).find("description").text().replace(/<[^>]+>/g, "").trim();
      const dateStr = $(el).find("pubDate, dc\\:date, updated").first().text().trim();
      const link = $(el).find("link").text().trim() || $(el).find("link").attr("href") || "";
      const text = `${title} ${desc}`;
      const geo = geoFromText(text);

      if (title && geo) {
        events.push({
          id: `${sourceName.toLowerCase().replace(/\s/g, "-")}-${Buffer.from(title).toString("base64").substring(0, 12)}`,
          lat: geo[0] + (Math.random() - 0.5) * 0.5,
          lon: geo[1] + (Math.random() - 0.5) * 0.5,
          date: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
          type: `${sourceName}: ${title.substring(0, 50)}`,
          description: desc ? desc.substring(0, 200) : title.substring(0, 200),
          source: sourceName,
          category,
        });
      }
    });

    return events;
  } catch (err) {
    console.error(`RSS fetch failed for ${sourceName}:`, (err as any)?.message);
    return [];
  }
}

// BBC World News RSS
export async function fetchRSSNews(): Promise<EventData[]> {
  const feeds = [
    { url: "https://feeds.bbci.co.uk/news/world/rss.xml", name: "BBC World News", cat: "conflict" as const },
    { url: "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml", name: "BBC Middle East", cat: "conflict" as const },
    { url: "https://feeds.bbci.co.uk/news/world/europe/rss.xml", name: "BBC Europe", cat: "conflict" as const },
    { url: "https://rss.dw.com/rdf/rss-en-world", name: "Deutsche Welle", cat: "social" as const },
    { url: "https://en.rfi.fr/rss/en/world-news.xml", name: "RFI World", cat: "social" as const },
    { url: "https://feeds.aljazeera.net/aljazeera/English/rss.xml", name: "Al Jazeera", cat: "conflict" as const },
  ];

  const results = await Promise.allSettled(feeds.map(f => fetchRSS(f.url, f.name, f.cat)));
  return results.flatMap(r => r.status === "fulfilled" ? r.value : []);
}

// Defense-focused RSS feeds
export async function fetchDefenseNews(): Promise<EventData[]> {
  const feeds = [
    { url: "https://www.defensenews.com/arc/outboundfeeds/rss/", name: "Defense News", cat: "conflict" as const },
    { url: "https://feeds.feedburner.com/defense-aerospace", name: "Defense Aerospace", cat: "air" as const },
    { url: "https://www.janes.com/feeds/news", name: "Janes Defense", cat: "conflict" as const },
    { url: "https://breakingdefense.com/feed/", name: "Breaking Defense", cat: "conflict" as const },
    { url: "https://www.militarytimes.com/arc/outboundfeeds/rss/", name: "Military Times", cat: "conflict" as const },
  ];

  const results = await Promise.allSettled(feeds.map(f => fetchRSS(f.url, f.name, f.cat)));
  return results.flatMap(r => r.status === "fulfilled" ? r.value : []);
}

// Ukraine-specific
export async function fetchUkraineNews(): Promise<EventData[]> {
  const feeds = [
    { url: "https://kyivindependent.com/feed/", name: "Kyiv Independent", cat: "conflict" as const },
    { url: "https://www.ukrinform.net/rss/block-lastnews", name: "Ukrinform", cat: "conflict" as const },
  ];
  const results = await Promise.allSettled(feeds.map(f => fetchRSS(f.url, f.name, f.cat)));
  return results.flatMap(r => r.status === "fulfilled" ? r.value : []);
}

// Middle East focused
export async function fetchMiddleEastNews(): Promise<EventData[]> {
  const feeds = [
    { url: "https://feeds.aljazeera.net/aljazeera/English/rss.xml", name: "Al Jazeera", cat: "conflict" as const },
    { url: "https://www.timesofisrael.com/feed/", name: "Times of Israel", cat: "conflict" as const },
  ];
  const results = await Promise.allSettled(feeds.map(f => fetchRSS(f.url, f.name, f.cat)));
  return results.flatMap(r => r.status === "fulfilled" ? r.value : []);
}
