import axios from "axios";
import * as cheerio from "cheerio";
import { EventData } from "./conflict";

const GEOLOCATION_KEYWORDS: Record<string, { lat: number; lon: number }> = {
  ukraine: { lat: 48.3794, lon: 31.1656 },
  " Donetsk": { lat: 48.0028, lon: 37.8058 },
  " Kharkiv": { lat: 49.9935, lon: 36.2304 },
  " Kryvyi Rih": { lat: 47.9108, lon: 33.3918 },
  " Odesa": { lat: 46.4825, lon: 30.7233 },
  " Mariupol": { lat: 47.0972, lon: 37.5434 },
  " Zaporizhzhia": { lat: 47.8388, lon: 35.1396 },
  russia: { lat: 55.7558, lon: 37.6173 },
  moscow: { lat: 55.7558, lon: 37.6173 },
  " st. petersburg": { lat: 59.9343, lon: 30.3351 },
  " Vladivostok": { lat: 43.1155, lon: 131.8855 },
  " Kaliningrad": { lat: 54.7104, lon: 20.4522 },
  gaza: { lat: 31.3547, lon: 34.3088 },
  " gaza strip": { lat: 31.3547, lon: 34.3088 },
  israel: { lat: 31.0461, lon: 34.8516 },
  jerusalem: { lat: 31.7683, lon: 35.2137 },
  " tel aviv": { lat: 32.0853, lon: 34.7818 },
  hezbollah: { lat: 33.8547, lon: 35.8623 },
  lebanon: { lat: 33.8547, lon: 35.8623 },
  syria: { lat: 34.8021, lon: 38.9968 },
  damascus: { lat: 33.5138, lon: 36.2765 },
  aleppo: { lat: 36.2012, lon: 37.1343 },
  iraq: { lat: 33.3152, lon: 44.3661 },
  baghdad: { lat: 33.3152, lon: 44.3661 },
  afghanistan: { lat: 33.9391, lon: 67.7099 },
  kabul: { lat: 34.5553, lon: 69.2075 },
  yemen: { lat: 15.5527, lon: 48.5164 },
  sanaa: { lat: 15.3694, lon: 44.191 },
  libya: { lat: 26.3351, lon: 17.2283 },
  tripoli: { lat: 32.8872, lon: 13.1913 },
  sudan: { lat: 12.8628, lon: 30.2176 },
  khartoum: { lat: 15.5007, lon: 32.5599 },
  ethiopia: { lat: 9.145, lon: 40.4897 },
  somalia: { lat: 5.1521, lon: 46.1996 },
  somali: { lat: 5.1521, lon: 46.1996 },
  niger: { lat: 17.6078, lon: 8.0817 },
  mali: { lat: 17.5707, lon: -3.9962 },
  burkina_faso: { lat: 12.2383, lon: -1.5616 },
  congo: { lat: -4.0383, lon: 21.7587 },
  drc: { lat: -4.0383, lon: 21.7587 },
  myanmar: { lat: 21.9162, lon: 95.956 },
  burma: { lat: 21.9162, lon: 95.956 },
  taiwan: { lat: 23.6978, lon: 120.9605 },
  " taiwan strait": { lat: 24.0, lon: 119.5 },
  " south china sea": { lat: 15.0, lon: 115.0 },
  " east china sea": { lat: 30.0, lon: 125.0 },
  china: { lat: 35.8617, lon: 104.1954 },
  beijing: { lat: 39.9042, lon: 116.4074 },
  shanghai: { lat: 31.2304, lon: 121.4737 },
  " hong kong": { lat: 22.3193, lon: 114.1694 },
  " south korea": { lat: 35.9078, lon: 127.7669 },
  seoul: { lat: 37.5665, lon: 126.978 },
  " north korea": { lat: 40.3399, lon: 127.5101 },
  pyongyang: { lat: 39.0392, lon: 125.7625 },
  japan: { lat: 36.2048, lon: 138.2529 },
  tokyo: { lat: 35.6762, lon: 139.6503 },
  india: { lat: 20.5937, lon: 78.9629 },
  pakistan: { lat: 30.3753, lon: 69.3451 },
  iran: { lat: 32.4279, lon: 53.688 },
  tehran: { lat: 35.6892, lon: 51.389 },
  " persian gulf": { lat: 26.0, lon: 52.0 },
  " gulf of oman": { lat: 24.0, lon: 58.0 },
  saudi: { lat: 23.8859, lon: 45.0792 },
  " red sea": { lat: 20.0, lon: 38.0 },
  " aden": { lat: 12.7794, lon: 45.0087 },
  nato: { lat: 50.8503, lon: 4.3517 },
  " white house": { lat: 38.8977, lon: -77.0365 },
  pentagon: { lat: 38.8719, lon: -77.0563 },
  london: { lat: 51.5074, lon: -0.1278 },
  paris: { lat: 48.8566, lon: 2.3522 },
  berlin: { lat: 52.52, lon: 13.405 },
  rome: { lat: 41.9028, lon: 12.4964 },
  warsaw: { lat: 52.2297, lon: 21.0122 },
  baltic: { lat: 55.0, lon: 14.0 },
  " black sea": { lat: 43.0, lon: 34.0 },
  mediterranean: { lat: 35.0, lon: 18.0 },
  arctic: { lat: 75.0, lon: 40.0 },
  atlantic: { lat: 30.0, lon: -40.0 },
  pacific: { lat: 0.0, lon: -150.0 },
  hamas: { lat: 31.3547, lon: 34.3088 },
  isis: { lat: 33.3152, lon: 44.3661 },
  " islamic state": { lat: 33.3152, lon: 44.3661 },
};

function extractGeoFromText(text: string): { lat: number; lon: number } | null {
  if (!text) return null;
  const lowerText = text.toLowerCase();
  for (const [location, coords] of Object.entries(GEOLOCATION_KEYWORDS)) {
    if (lowerText.includes(location)) {
      return coords;
    }
  }
  return null;
}

async function fetchWithRetry(url: string, retries = 2): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(url, { 
        timeout: 10000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "application/rss+xml, application/xml, text/xml, */*"
        }
      });
      return response.data;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return null;
}

export async function scrapeLiveuamap(): Promise<EventData[]> {
  const events: EventData[] = [];
  try {
    const html = await fetchWithRetry("https://liveuamap.com/");
    if (!html) return events;
    
    const $ = cheerio.load(html);
    $('div.item-content, div.content-item, article.item').each((_, el) => {
      const title = $(el).find('a, .title, h3').text().trim();
      const desc = $(el).find('.description, p, .content').text().trim();
      const text = title + " " + desc;
      const geo = extractGeoFromText(text);
      
      if (geo && (title || desc)) {
        events.push({
          id: `liveuamap-${Date.now()}-${Math.random()}`,
          lat: geo.lat,
          lon: geo.lon,
          date: new Date().toISOString(),
          type: "LiveUA Map Alert",
          description: (title || desc).substring(0, 150),
          source: "LiveUAMap",
          category: "conflict"
        });
      }
    });
  } catch (error) {
    console.error("LiveUA Map scraper error:", error);
  }
  return events;
}

export async function scrapeWarShippingRadar(): Promise<EventData[]> {
  const events: EventData[] = [];
  try {
    const html = await fetchWithRetry("https://www.warshippingradar.com/");
    const $ = cheerio.load(html);
    
    $('article, .event, .incident').each((_, el) => {
      const title = $(el).find('h2, h3, .title').text();
      const desc = $(el).find('p, .desc, .content').text();
      const text = title + " " + desc;
      const geo = extractGeoFromText(text);
      
      if (geo && title) {
        events.push({
          id: `wsr-${Date.now()}-${Math.random()}`,
          lat: geo.lat,
          lon: geo.lon,
          date: new Date().toISOString(),
          type: "War Shipping Alert",
          description: title.substring(0, 150),
          source: "WarShippingRadar",
          category: "maritime"
        });
      }
    });
  } catch (error) {
    console.error("War Shipping Radar error:", error);
  }
  return events;
}

export async function scrapeGlobalConflictTracker(): Promise<EventData[]> {
  const events: EventData[] = [];
  try {
    const html = await fetchWithRetry("https://www.crisiswatch.org/");
    const $ = cheerio.load(html);
    
    $('.item, .crisis, article').each((_, el) => {
      const title = $(el).find('h2, h3, a').first().text();
      const desc = $(el).find('p, .excerpt').text();
      const text = title + " " + desc;
      const geo = extractGeoFromText(text);
      
      if (geo) {
        events.push({
          id: `crisiswatch-${Date.now()}-${Math.random()}`,
          lat: geo.lat,
          lon: geo.lon,
          date: new Date().toISOString(),
          type: "Crisis Watch Alert",
          description: (title || desc).substring(0, 150),
          source: "CrisisWatch",
          category: "conflict"
        });
      }
    });
  } catch (error) {
    console.error("CrisisWatch scraper error:", error);
  }
  return events;
}

export async function scrapeArmedConflictLocation(): Promise<EventData[]> {
  const events: EventData[] = [];
  try {
    const html = await fetchWithRetry("https://acleddata.com/");
    const $ = cheerio.load(html);
    
    $('article, .post, .conflict').each((_, el) => {
      const title = $(el).find('h2, h3, .title').text();
      const content = $(el).find('p, .content, .excerpt').text();
      const text = title + " " + content;
      const geo = extractGeoFromText(text);
      
      if (geo && title) {
        events.push({
          id: `acled-${Date.now()}-${Math.random()}`,
          lat: geo.lat,
          lon: geo.lon,
          date: new Date().toISOString(),
          type: "ACLED Conflict",
          description: title.substring(0, 150),
          source: "ACLED",
          category: "conflict"
        });
      }
    });
  } catch (error) {
    console.error("ACLED scraper error:", error);
  }
  return events;
}

export async function scrapeReutersArmed(): Promise<EventData[]> {
  const events: EventData[] = [];
  try {
    const xml = await fetchWithRetry("https://www.reutersagency.com/feed/?best-topics=armed-conflict");
    if (!xml) return events;
    
    const $ = cheerio.load(xml, { xmlMode: true });
    $('item').slice(0, 15).each((_, el) => {
      const title = $(el).find('title').text();
      const desc = $(el).find('description').text();
      const text = title + " " + desc;
      const geo = extractGeoFromText(text);
      const dateStr = $(el).find('pubDate').text();
      
      if (title) {
        events.push({
          id: `reuters-armed-${Date.now()}-${Math.random()}`,
          lat: geo?.lat || 0,
          lon: geo?.lon || 0,
          date: dateStr || new Date().toISOString(),
          type: "Reuters Armed Conflict",
          description: title.substring(0, 150),
          source: "Reuters",
          category: "conflict"
        });
      }
    });
  } catch (error) {
    console.error("Reuters Armed scraper error:", error);
  }
  return events;
}

export async function scrapeDefenseUpdate(): Promise<EventData[]> {
  const events: EventData[] = [];
  try {
    const xml = await fetchWithRetry("https://www.reutersagency.com/feed/?best-topics=defence");
    if (!xml) return events;
    
    const $ = cheerio.load(xml, { xmlMode: true });
    $('item').slice(0, 15).each((_, el) => {
      const title = $(el).find('title').text();
      const desc = $(el).find('description').text();
      const text = title + " " + desc;
      const geo = extractGeoFromText(text);
      const dateStr = $(el).find('pubDate').text();
      
      if (title) {
        events.push({
          id: `reuters-def-${Date.now()}-${Math.random()}`,
          lat: geo?.lat || 0,
          lon: geo?.lon || 0,
          date: dateStr || new Date().toISOString(),
          type: "Defense News",
          description: title.substring(0, 150),
          source: "Reuters Defense",
          category: "conflict"
        });
      }
    });
  } catch (error) {
    console.error("Defense Update scraper error:", error);
  }
  return events;
}

export async function scrapeMilitaryTimes(): Promise<EventData[]> {
  const events: EventData[] = [];
  try {
    const html = await fetchWithRetry("https://www.militarytimes.com/news/");
    const $ = cheerio.load(html);
    
    $('article, .story, .post').each((_, el) => {
      const title = $(el).find('h2, h3, a').first().text();
      const desc = $(el).find('p, .excerpt').text();
      const text = title + " " + desc;
      const geo = extractGeoFromText(text);
      
      if (title && geo) {
        events.push({
          id: `miltimes-${Date.now()}-${Math.random()}`,
          lat: geo.lat,
          lon: geo.lon,
          date: new Date().toISOString(),
          type: "Military Times",
          description: title.substring(0, 150),
          source: "MilitaryTimes",
          category: "conflict"
        });
      }
    });
  } catch (error) {
    console.error("Military Times scraper error:", error);
  }
  return events;
}

export async function scrapeJanes(): Promise<EventData[]> {
  const events: EventData[] = [];
  try {
    const html = await fetchWithRetry("https://www.janes.com/defence-news");
    const $ = cheerio.load(html);
    
    $('article, .news-item, .story').each((_, el) => {
      const title = $(el).find('h2, h3, a').first().text();
      const desc = $(el).find('p, .excerpt').text();
      const text = title + " " + desc;
      const geo = extractGeoFromText(text);
      
      if (title && geo) {
        events.push({
          id: `janes-${Date.now()}-${Math.random()}`,
          lat: geo.lat,
          lon: geo.lon,
          date: new Date().toISOString(),
          type: "Janes Defense",
          description: title.substring(0, 150),
          source: "Janes",
          category: "conflict"
        });
      }
    });
  } catch (error) {
    console.error("Janes scraper error:", error);
  }
  return events;
}

export async function scrapeBreakingDefense(): Promise<EventData[]> {
  const events: EventData[] = [];
  try {
    const html = await fetchWithRetry("https://breakingdefense.com/");
    const $ = cheerio.load(html);
    
    $('article, .post, .story').each((_, el) => {
      const title = $(el).find('h2, h3, a').first().text();
      const desc = $(el).find('p, .excerpt').text();
      const text = title + " " + desc;
      const geo = extractGeoFromText(text);
      
      if (title && geo) {
        events.push({
          id: `breakdef-${Date.now()}-${Math.random()}`,
          lat: geo.lat,
          lon: geo.lon,
          date: new Date().toISOString(),
          type: "Breaking Defense",
          description: title.substring(0, 150),
          source: "BreakingDefense",
          category: "conflict"
        });
      }
    });
  } catch (error) {
    console.error("Breaking Defense scraper error:", error);
  }
  return events;
}

export async function scrapeBellingcat(): Promise<EventData[]> {
  const events: EventData[] = [];
  try {
    const html = await fetchWithRetry("https://www.bellingcat.com/category/news/");
    const $ = cheerio.load(html);
    
    $('article, .post').each((_, el) => {
      const title = $(el).find('h2, h3').first().text();
      const desc = $(el).find('p, .excerpt').text();
      const text = title + " " + desc;
      const geo = extractGeoFromText(text);
      
      if (title) {
        events.push({
          id: `bellingcat-${Date.now()}-${Math.random()}`,
          lat: geo?.lat || 0,
          lon: geo?.lon || 0,
          date: new Date().toISOString(),
          type: "Bellingcat OSINT",
          description: title.substring(0, 150),
          source: "Bellingcat",
          category: "conflict"
        });
      }
    });
  } catch (error) {
    console.error("Bellingcat scraper error:", error);
  }
  return events;
}

export async function scrapeISWPress(): Promise<EventData[]> {
  const events: EventData[] = [];
  try {
    const html = await fetchWithRetry("https://www.understandingwar.org/press-releases");
    const $ = cheerio.load(html);
    
    $('article, .press-release, .view-content .views-row').each((_, el) => {
      const title = $(el).find('h2, h3, a').first().text();
      const desc = $(el).find('p, .excerpt').text();
      const text = title + " " + desc;
      const geo = extractGeoFromText(text);
      
      if (title) {
        events.push({
          id: `isw-${Date.now()}-${Math.random()}`,
          lat: geo?.lat || 0,
          lon: geo?.lon || 0,
          date: new Date().toISOString(),
          type: "ISW Press",
          description: title.substring(0, 150),
          source: "ISW",
          category: "conflict"
        });
      }
    });
  } catch (error) {
    console.error("ISW scraper error:", error);
  }
  return events;
}

export async function scrapeRFI(): Promise<EventData[]> {
  const events: EventData[] = [];
  try {
    const xml = await fetchWithRetry("https://en.rfi.fr/rss/en/news.xml");
    if (!xml) return events;
    
    const $ = cheerio.load(xml, { xmlMode: true });
    $('item').slice(0, 20).each((_, el) => {
      const title = $(el).find('title').text();
      const desc = $(el).find('description').text();
      const text = title + " " + desc;
      const geo = extractGeoFromText(text);
      const dateStr = $(el).find('pubDate').text();
      
      if (title) {
        events.push({
          id: `rfi-${Date.now()}-${Math.random()}`,
          lat: geo?.lat || 0,
          lon: geo?.lon || 0,
          date: dateStr || new Date().toISOString(),
          type: "RFI News",
          description: title.substring(0, 150),
          source: "RFI",
          category: "social"
        });
      }
    });
  } catch (error) {
    console.error("RFI scraper error:", error);
  }
  return events;
}

export async function scrapeFrance24(): Promise<EventData[]> {
  const events: EventData[] = [];
  try {
    const xml = await fetchWithRetry("https://www.france24.com/en/rss");
    if (!xml) return events;
    
    const $ = cheerio.load(xml, { xmlMode: true });
    $('item').slice(0, 20).each((_, el) => {
      const title = $(el).find('title').text();
      const desc = $(el).find('description').text();
      const text = title + " " + desc;
      const geo = extractGeoFromText(text);
      const dateStr = $(el).find('pubDate').text();
      
      if (title) {
        events.push({
          id: `france24-${Date.now()}-${Math.random()}`,
          lat: geo?.lat || 0,
          lon: geo?.lon || 0,
          date: dateStr || new Date().toISOString(),
          type: "France 24",
          description: title.substring(0, 150),
          source: "France24",
          category: "social"
        });
      }
    });
  } catch (error) {
    console.error("France24 scraper error:", error);
  }
  return events;
}

export async function scrapeDW(): Promise<EventData[]> {
  const events: EventData[] = [];
  try {
    const xml = await fetchWithRetry("https://rss.dw.com/rdf/rss-en-all");
    if (!xml) return events;
    
    const $ = cheerio.load(xml, { xmlMode: true });
    $('item').slice(0, 20).each((_, el) => {
      const title = $(el).find('title').text();
      const desc = $(el).find('description').text();
      const text = title + " " + desc;
      const geo = extractGeoFromText(text);
      const dateStr = $(el).find('dc\\:date').text();
      
      if (title) {
        events.push({
          id: `dw-${Date.now()}-${Math.random()}`,
          lat: geo?.lat || 0,
          lon: geo?.lon || 0,
          date: dateStr || new Date().toISOString(),
          type: "DW News",
          description: title.substring(0, 150),
          source: "Deutsche Welle",
          category: "social"
        });
      }
    });
  } catch (error) {
    console.error("DW scraper error:", error);
  }
  return events;
}

export async function scrapeVOA(): Promise<EventData[]> {
  const events: EventData[] = [];
  try {
    const xml = await fetchWithRetry("https://www.voanews.com/api/epiqqrdoo -zmc");
    if (!xml) return events;
    
    const $ = cheerio.load(xml, { xmlMode: true });
    $('item').slice(0, 20).each((_, el) => {
      const title = $(el).find('title').text();
      const desc = $(el).find('description').text();
      const text = title + " " + desc;
      const geo = extractGeoFromText(text);
      const dateStr = $(el).find('pubDate').text();
      
      if (title) {
        events.push({
          id: `voa-${Date.now()}-${Math.random()}`,
          lat: geo?.lat || 0,
          lon: geo?.lon || 0,
          date: dateStr || new Date().toISOString(),
          type: "VOA News",
          description: title.substring(0, 150),
          source: "VOA",
          category: "social"
        });
      }
    });
  } catch (error) {
    console.error("VOA scraper error:", error);
  }
  return events;
}

export async function scrapeKyivIndependent(): Promise<EventData[]> {
  const events: EventData[] = [];
  try {
    const html = await fetchWithRetry("https://kyivindependent.com/");
    const $ = cheerio.load(html);
    
    $('article, .post, .story').each((_, el) => {
      const title = $(el).find('h2, h3').first().text();
      const desc = $(el).find('p, .excerpt').text();
      const text = title + " " + desc;
      const geo = extractGeoFromText(text);
      
      if (title) {
        events.push({
          id: `kyiv-${Date.now()}-${Math.random()}`,
          lat: geo?.lat || 48.3794,
          lon: geo?.lon || 31.1656,
          date: new Date().toISOString(),
          type: "Kyiv Independent",
          description: title.substring(0, 150),
          source: "KyivIndependent",
          category: "conflict"
        });
      }
    });
  } catch (error) {
    console.error("Kyiv Independent scraper error:", error);
  }
  return events;
}

export async function scrapeMeduza(): Promise<EventData[]> {
  const events: EventData[] = [];
  try {
    const html = await fetchWithRetry("https://meduza.io/api/v3/search?chrono=news&locale=en");
    if (!html?.documents) return events;
    
    for (const doc of Object.values(html.documents).slice(0, 15)) {
      const title = (doc as any).title;
      const text = (doc as any).subtitle || "";
      const geo = extractGeoFromText(title + " " + text);
      
      if (title) {
        events.push({
          id: `meduza-${Date.now()}-${Math.random()}`,
          lat: geo?.lat || 0,
          lon: geo?.lon || 0,
          date: (doc as any).published_at || new Date().toISOString(),
          type: "Meduza News",
          description: title.substring(0, 150),
          source: "Meduza",
          category: "social"
        });
      }
    }
  } catch (error) {
    console.error("Meduza scraper error:", error);
  }
  return events;
}

export async function scrapeTerrorMonitoring(): Promise<EventData[]> {
  const events: EventData[] = [];
  try {
    const html = await fetchWithRetry("https://www.start.org/data");
    const $ = cheerio.load(html);
    
    $('tr, .incident, .terror-event').each((_, el) => {
      const text = $(el).text();
      const geo = extractGeoFromText(text);
      
      if (geo) {
        events.push({
          id: `terror-${Date.now()}-${Math.random()}`,
          lat: geo.lat,
          lon: geo.lon,
          date: new Date().toISOString(),
          type: "Terrorism Monitor",
          description: "Terrorism incident detected",
          source: "START",
          category: "conflict"
        });
      }
    });
  } catch (error) {
    console.error("Terror monitoring error:", error);
  }
  return events;
}

export async function fetchEMSCearthquakes(): Promise<EventData[]> {
  const events: EventData[] = [];
  try {
    const response = await axios.get(
      "https://www.seismicportal.eu/fdsnws/event/1/query?limit=20&orderby=magnitude",
      { timeout: 10000 }
    );
    
    if (response.data?.features) {
      for (const feature of response.data.features) {
        const props = feature.properties;
        const [lon, lat] = feature.geometry.coordinates;
        
        events.push({
          id: `emsc-${props.eventid}`,
          lat,
          lon,
          date: props.time || new Date().toISOString(),
          type: `Earthquake M${props.magnitude?.toFixed(1) || "?"}`,
          description: props.place || "Seismic event",
          source: "EMSC",
          category: "earthquakes"
        });
      }
    }
  } catch (error) {
    console.error("EMSC earthquake fetch error:", error);
  }
  return events;
}

export async function fetchUSGSearthquakes(): Promise<EventData[]> {
  const events: EventData[] = [];
  try {
    const response = await axios.get(
      "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&limit=25&orderby=magnitude",
      { timeout: 10000 }
    );
    
    if (response.data?.features) {
      for (const feature of response.data.features) {
        const props = feature.properties;
        const [lon, lat] = feature.geometry.coordinates;
        
        events.push({
          id: `usgs-${props.code}`,
          lat,
          lon,
          date: props.time ? new Date(props.time).toISOString() : new Date().toISOString(),
          type: `Earthquake M${props.mag?.toFixed(1) || "?"}`,
          description: props.place || "Seismic event",
          source: "USGS",
          category: "earthquakes"
        });
      }
    }
  } catch (error) {
    console.error("USGS earthquake fetch error:", error);
  }
  return events;
}

export async function fetchNOAAweather(): Promise<EventData[]> {
  const events: EventData[] = [];
  try {
    const response = await axios.get(
      "https://api.weather.gov/alerts/active?area=US",
      { timeout: 10000 }
    );
    
    if (response.data?.features) {
      for (const alert of response.data.features.slice(0, 15)) {
        const props = alert.properties;
        
        events.push({
          id: `noaa-${props.id}`,
          lat: 39.0,
          lon: -98.0,
          date: props.sent || new Date().toISOString(),
          type: `Weather: ${props.event}`,
          description: props.headline || props.description?.substring(0, 150),
          source: "NOAA",
          category: "weather"
        });
      }
    }
  } catch (error) {
    console.error("NOAA weather fetch error:", error);
  }
  return events;
}

export async function fetchMarineTrafficOpen(): Promise<EventData[]> {
  const events: EventData[] = [];
  try {
    const response = await axios.get(
      "https://www.marinetraffic.com/api/v1/vessel-screening/vessel-group/find-by-mmsi?mmsi=636018000&vesselGroupId=0",
      { timeout: 10000 }
    );
    
    if (response.data?.data) {
      events.push({
        id: `mt-open-${Date.now()}`,
        lat: 0,
        lon: 0,
        date: new Date().toISOString(),
        type: "Marine Traffic (Demo)",
        description: "Marine tracking available",
        source: "MarineTraffic",
        category: "maritime"
      });
    }
  } catch (error) {
    console.log("MarineTraffic demo mode");
  }
  return events;
}

export async function fetchFlightRadar24demo(): Promise<EventData[]> {
  const events: EventData[] = [];
  const demoFlights = [
    { lat: 40.7128, lon: -74.006, callsign: "AAL123", type: "American Airlines" },
    { lat: 51.5074, lon: -0.1278, callsign: "BAW456", type: "British Airways" },
    { lat: 35.6762, lon: 139.6503, callsign: "JAL789", type: "Japan Airlines" },
    { lat: 48.8566, lon: 2.3522, callsign: "AFR012", type: "Air France" },
    { lat: 31.0461, lon: 34.8516, callsign: "ELY34", type: "El Al" },
  ];
  
  for (const flight of demoFlights) {
    events.push({
      id: `fr24-${flight.callsign}`,
      lat: flight.lat,
      lon: flight.lon,
      date: new Date().toISOString(),
      type: `Flight: ${flight.callsign}`,
      description: `${flight.type} in flight`,
      source: "FlightRadar24",
      category: "air"
    });
  }
  
  return events;
}

export async function fetchOpenSkyNetwork(): Promise<EventData[]> {
  const events: EventData[] = [];
  try {
    const response = await axios.get(
      "https://opensky-network.org/api/states/all?lamin=35&lamin=35&lomin=-10&lomax=40",
      { timeout: 10000 }
    );
    
    if (response.data?.states) {
      for (const state of response.data.states.slice(0, 20)) {
        const [icao24, callsign, country, time, lat, lon, alt, velocity] = state;
        
        if (lat && lon) {
          events.push({
            id: `opensky-${icao24}`,
            lat,
            lon,
            date: new Date().toISOString(),
            type: `Aircraft: ${callsign || icao24}`,
            description: `${country} - Alt: ${alt?.toFixed(0)}m`,
            source: "OpenSky Network",
            category: "air"
          });
        }
      }
    }
  } catch (error) {
    console.error("OpenSky fetch error:", error);
  }
  return events;
}

export async function fetchAISreception(): Promise<EventData[]> {
  const events: EventData[] = [];
  const demoVessels = [
    { lat: 25.276987, lon: 55.296249, mmsi: "538001234", name: "Vessel UAE" },
    { lat: 1.3521, lon: 103.8198, mmsi: "538005678", name: "Vessel Singapore" },
    { lat: 51.9244, lon: 4.4777, mmsi: "538009012", name: "Vessel Rotterdam" },
    { lat: 22.2855, lon: 114.1577, mmsi: "538003456", name: "Vessel Hong Kong" },
    { lat: 33.7408, lon: -118.2723, mmsi: "538007890", name: "Vessel LA" },
  ];
  
  for (const vessel of demoVessels) {
    events.push({
      id: `ais-${vessel.mmsi}`,
      lat: vessel.lat,
      lon: vessel.lon,
      date: new Date().toISOString(),
      type: `Vessel: ${vessel.name}`,
      description: `MMSI: ${vessel.mmsi}`,
      source: "AIS Stream",
      category: "maritime"
    });
  }
  
  return events;
}

export async function scrapeDeepState(): Promise<EventData[]> {
  const events: EventData[] = [];
  try {
    const html = await fetchWithRetry("https://deepstatemap.live/");
    const $ = cheerio.load(html);
    
    $('[class*="point"], [class*="marker"], [class*="incident"]').each((_, el) => {
      const text = $(el).text();
      const geo = extractGeoFromText(text);
      
      if (geo) {
        events.push({
          id: `deepstate-${Date.now()}-${Math.random()}`,
          lat: geo.lat,
          lon: geo.lon,
          date: new Date().toISOString(),
          type: "DeepState Map",
          description: "Conflict activity in Ukraine",
          source: "DeepStateMap",
          category: "conflict"
        });
      }
    });
  } catch (error) {
    console.error("DeepState scraper error:", error);
  }
  return events;
}

export async function scrapeUkraineOffensive(): Promise<EventData[]> {
  const events: EventData[] = [];
  try {
    const html = await fetchWithRetry("https://www.understandingwar.org/backgrounder/russian-offensive-campaign-assessment");
    const $ = cheerio.load(html);
    
    const title = $('h1').text();
    const content = $('article').text();
    const geo = extractGeoFromText(content);
    
    if (geo) {
      events.push({
        id: `isw-ua-${Date.now()}`,
        lat: geo.lat,
        lon: geo.lon,
        date: new Date().toISOString(),
        type: "ISW Ukraine Assessment",
        description: title.substring(0, 150),
        source: "ISW",
        category: "conflict"
      });
    }
  } catch (error) {
    console.error("ISW Ukraine scraper error:", error);
  }
  return events;
}

export async function fetchGDELTrealtime(): Promise<EventData[]> {
  const events: EventData[] = [];
  try {
    const response = await axios.get(
      "https://api.gdeltproject.org/api/v2/doc/doc?query=domaincode:1&mode=artlist&maxrecords=30&format=json&sort=DateDesc",
      { timeout: 15000 }
    );
    
    if (response.data?.articles) {
      for (const article of response.data.articles) {
        const geo = extractGeoFromText(article.title + " " + article.se_name);
        
        if (geo && article.title) {
          events.push({
            id: `gdelt-realtime-${article.url}`,
            lat: geo.lat,
            lon: geo.lon,
            date: article.seenddate || new Date().toISOString(),
            type: "GDELT Breaking",
            description: article.title.substring(0, 150),
            source: article.domain || "GDELT",
            category: "conflict"
          });
        }
      }
    }
  } catch (error) {
    console.error("GDELT realtime fetch error:", error);
  }
  return events;
}

export async function scrapeTwitterTrends(): Promise<EventData[]> {
  const events: EventData[] = [];
  try {
    const html = await fetchWithRetry("https://twitter.com/i/trends");
    const $ = cheerio.load(html);
    
    $('[data-testid="trend"]').each((_, el) => {
      const text = $(el).text();
      const geo = extractGeoFromText(text);
      
      if (geo) {
        events.push({
          id: `trend-${Date.now()}-${Math.random()}`,
          lat: geo.lat,
          lon: geo.lon,
          date: new Date().toISOString(),
          type: "Twitter Trend",
          description: text.substring(0, 100),
          source: "Twitter",
          category: "social"
        });
      }
    });
  } catch (error) {
    console.error("Twitter trends scraper error:", error);
  }
  return events;
}

export async function fetchAllScrapedData(): Promise<EventData[]> {
  const allEvents: EventData[] = [];
  
  const scrapers = [
    scrapeLiveuamap,
    scrapeReutersArmed,
    scrapeDefenseUpdate,
    scrapeRFI,
    scrapeFrance24,
    scrapeDW,
    scrapeKyivIndependent,
    scrapeBellingcat,
    scrapeBreakingDefense,
    scrapeDeepState,
    scrapeUkraineOffensive,
    fetchGDELTrealtime,
  ];
  
  const results = await Promise.allSettled(scrapers.map(s => s()));
  
  results.forEach((result) => {
    if (result.status === "fulfilled") {
      allEvents.push(...result.value);
    }
  });
  
  console.log(`Scraper fetched ${allEvents.length} events`);
  return allEvents;
}
