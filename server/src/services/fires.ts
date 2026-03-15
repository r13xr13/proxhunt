import axios from "axios";
import { EventData } from "./conflict";

const NASA_FIRMS_API_KEY = process.env.NASA_FIRMS_API_KEY || "";
const FIRMS_BASE_URL = "https://firms.modaps.eosdis.nasa.gov/api/area";

export async function fetchFiresData(): Promise<EventData[]> {
  const fires: EventData[] = [];
  
  if (!NASA_FIRMS_API_KEY) {
    console.log("[FIRMS] No API key configured");
    return fires;
  }
  
  try {
    // Fetch active fires for the Middle East region
    // VIIRS 24h active fires
    const response = await axios.get(FIRMS_BASE_URL, {
      params: {
        token: NASA_FIRMS_API_KEY,
        area_id: "-10,30,50,50", // Middle East bounding box
        product: "VIIRS_SNPP_NRT",
        format: "json"
      },
      timeout: 15000
    });
    
    if (response.data && Array.isArray(response.data)) {
      for (const fire of response.data) {
        fires.push({
          id: `fire-${fire.id || Math.random().toString(36).substr(2, 9)}`,
          lat: parseFloat(fire.latitude),
          lon: parseFloat(fire.longitude),
          date: new Date(fire.acq_datetime).toISOString(),
          type: `Fire Detection - ${fire.confidence}% confidence`,
          description: `Active fire detected. Brightness: ${fire.brightness_temp}K. FRP: ${fire.frp} MW. Source: ${fire.satellite}`,
          source: "NASA FIRMS",
          category: "weather",
          severity: fire.confidence > 80 ? "high" : fire.confidence > 50 ? "medium" : "low",
          country: fire.country || "",
          region: fire.state || "",
        });
      }
    }
    
    console.log(`[FIRMS] Fetched ${fires.length} fire events`);
  } catch (error: any) {
    console.error("[FIRMS] Error fetching fire data:", error.message);
  }
  
  return fires;
}

// Fetch MODIS active fires
export async function fetchModisFires(): Promise<EventData[]> {
  const fires: EventData[] = [];
  
  if (!NASA_FIRMS_API_KEY) {
    return fires;
  }
  
  try {
    const response = await axios.get(FIRMS_BASE_URL, {
      params: {
        token: NASA_FIRMS_API_KEY,
        area_id: "-10,30,50,50",
        product: "MODIS_NRT",
        format: "json"
      },
      timeout: 15000
    });
    
    if (response.data && Array.isArray(response.data)) {
      for (const fire of response.data) {
        fires.push({
          id: `modis-fire-${fire.id || Math.random().toString(36).substr(2, 9)}`,
          lat: parseFloat(fire.latitude),
          lon: parseFloat(fire.longitude),
          date: new Date(fire.acq_datetime).toISOString(),
          type: `MODIS Fire - ${fire.confidence}% confidence`,
          description: `Active fire detected. Brightness: ${fire.brightness_temp}K. FRP: ${fire.frp} MW`,
          source: "NASA FIRMS MODIS",
          category: "weather",
          severity: fire.confidence > 80 ? "high" : fire.confidence > 50 ? "medium" : "low",
          country: fire.country || "",
          region: fire.state || "",
        });
      }
    }
  } catch (error: any) {
    console.error("[FIRMS MODIS] Error:", error.message);
  }
  
  return fires;
}
