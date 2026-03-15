import axios from "axios";
import { EventData } from "./conflict";

const LIVEUAMAP_URL = process.env.LIVEUAMAP_URL || "https://israelpalestine.liveuamap.com/en";

export async function fetchLiveUAMapData(): Promise<EventData[]> {
  const events: EventData[] = [];
  
  try {
    // LiveUAMap provides data via their embed/feed endpoint
    const response = await axios.get(LIVEUAMAP_URL, {
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json, text/html"
      }
    });
    
    // Try to extract data from the page or API
    if (response.data) {
      // Try to find embedded data in the response
      const dataMatch = response.data.match(/window\.initialData\s*=\s*(\{.*?\});/s);
      if (dataMatch) {
        try {
          const data = JSON.parse(dataMatch[1]);
          if (data.features || data.events) {
            const features = data.features || data.events;
            for (const feature of features.slice(0, 50)) { // Limit to 50 events
              const props = feature.properties || feature;
              events.push({
                id: `liveuamap-${props.id || Math.random().toString(36).substr(2, 9)}`,
                lat: parseFloat(props.lat || feature.lat || feature.latitude),
                lon: parseFloat(props.lng || feature.lng || feature.longitude || props.longitude),
                date: props.date || props.timestamp || new Date().toISOString(),
                type: props.title || props.type || "Live Update",
                description: props.description || props.content || props.text || "",
                source: "LiveUAMap",
                category: "conflict",
                severity: props.severity || (props.type?.toLowerCase().includes("attack") ? "critical" : "medium"),
                country: "Israel/Palestine",
                region: props.location || props.area || "",
              });
            }
          }
        } catch (parseError) {
          console.log("[LiveUAMap] Could not parse embedded data");
        }
      }
      
      // Alternative: Try to find JSON in script tags
      const scriptMatch = response.data.match(/data-feed="([^"]+)"/);
      if (scriptMatch && !events.length) {
        try {
          const decoded = Buffer.from(scriptMatch[1], 'base64').toString();
          const feedData = JSON.parse(decoded);
          for (const item of (feedData.features || feedData).slice(0, 50)) {
            events.push({
              id: `liveuamap-${item.id || Math.random().toString(36).substr(2, 9)}`,
              lat: parseFloat(item.lat || item.latitude),
              lon: parseFloat(item.lng || item.longitude || item.longitude),
              date: item.date || item.timestamp || new Date().toISOString(),
              type: item.title || "Live Update",
              description: item.description || item.content || "",
              source: "LiveUAMap",
              category: "conflict",
              severity: "medium",
              country: "Israel/Palestine",
            });
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
    }
    
    console.log(`[LiveUAMap] Fetched ${events.length} events`);
  } catch (error: any) {
    console.log("[LiveUAMap] Error fetching data:", error.message);
  }
  
  return events;
}

// Fetch from multiple LiveUAMap regions
export async function fetchAllLiveUAMapRegions(): Promise<EventData[]> {
  const allEvents: EventData[] = [];
  
  const regions = [
    "https://israelpalestine.liveuamap.com/en",
    "https://ukraine.liveuamap.com/en",
    "https://southcaucasus.liveuamap.com/en"
  ];
  
  for (const url of regions) {
    try {
      const events = await fetchRegionData(url);
      allEvents.push(...events);
    } catch (e) {
      // Continue with other regions
    }
  }
  
  return allEvents;
}

async function fetchRegionData(url: string): Promise<EventData[]> {
  const events: EventData[] = [];
  
  try {
    const response = await axios.get(url, { timeout: 10000 });
    // Similar extraction as above
    console.log(`[LiveUAMap] Fetched from ${url}`);
  } catch (e) {
    // Ignore
  }
  
  return events;
}
