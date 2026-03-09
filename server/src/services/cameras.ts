import axios from "axios";
import { EventData } from "./conflict";

interface Camera {
  id: string;
  name: string;
  lat: number;
  lon: number;
  url: string;
  thumbnail?: string;
  location: string;
  category: string;
}

const PUBLIC_CAMERAS: Camera[] = [
  { id: "cam-1", name: "Times Square", lat: 40.758, lon: -73.9855, url: "https://videos-3.earthcam.com/fecnetwork/4017.flv/playlist.m3u8", location: "New York, USA", category: "city" },
  { id: "cam-2", name: "Red Square", lat: 55.7539, lon: 37.6208, url: "", location: "Moscow, Russia", category: "city" },
  { id: "cam-3", name: "Tiananmen Square", lat: 39.9054, lon: 116.3976, url: "", location: "Beijing, China", category: "city" },
  { id: "cam-4", name: "Brandenburg Gate", lat: 52.5163, lon: 13.3777, url: "", location: "Berlin, Germany", category: "city" },
  { id: "cam-5", name: "Eiffel Tower", lat: 48.8584, lon: 2.2945, url: "", location: "Paris, France", category: "city" },
  { id: "cam-6", name: "Tokyo Tower", lat: 35.6586, lon: 139.7454, url: "", location: "Tokyo, Japan", category: "city" },
  { id: "cam-7", name: "Shibuya Crossing", lat: 35.6595, lon: 139.7004, url: "", location: "Tokyo, Japan", category: "city" },
  { id: "cam-8", name: "Hong Kong Victoria Peak", lat: 22.2948, lon: 114.1509, url: "", location: "Hong Kong", category: "city" },
  { id: "cam-9", name: "Dubai Marina", lat: 25.0762, lon: 55.1332, url: "", location: "Dubai, UAE", category: "city" },
  { id: "cam-10", name: "Las Vegas Strip", lat: 36.1147, lon: -115.1728, url: "", location: "Las Vegas, USA", category: "city" },
  { id: "cam-11", name: "Miami Beach", lat: 25.7617, lon: -80.1918, url: "", location: "Miami, USA", category: "beach" },
  { id: "cam-12", name: "Gold Coast", lat: -28.0167, lon: 153.4000, url: "", location: "Queensland, Australia", category: "beach" },
  { id: "cam-13", name: "Bondi Beach", lat: -33.8908, lon: 151.2743, url: "", location: "Sydney, Australia", category: "beach" },
  { id: "cam-14", name: "Tel Aviv Beach", lat: 32.0853, lon: 34.7818, url: "", location: "Tel Aviv, Israel", category: "beach" },
  { id: "cam-15", name: "Kremlin", lat: 55.7520, lon: 37.6175, url: "", location: "Moscow, Russia", category: "government" },
  { id: "cam-16", name: "Pentagon", lat: 38.8719, lon: -77.0563, url: "", location: "Washington DC, USA", category: "government" },
  { id: "cam-17", name: "White House", lat: 38.8977, lon: -77.0365, url: "", location: "Washington DC, USA", category: "government" },
  { id: "cam-18", name: "Capitol Hill", lat: 38.8899, lon: -77.0091, url: "", location: "Washington DC, USA", category: "government" },
  { id: "cam-19", name: "Wall Street", lat: 40.7074, lon: -74.0113, url: "", location: "New York, USA", category: "finance" },
  { id: "cam-20", name: "London Stock Exchange", lat: 51.5074, lon: -0.1278, url: "", location: "London, UK", category: "finance" },
  { id: "cam-21", name: "Frankfurt Airport", lat: 50.0379, lon: 8.5622, url: "", location: "Frankfurt, Germany", category: "airport" },
  { id: "cam-22", name: "Heathrow Airport", lat: 51.4700, lon: -0.4543, url: "", location: "London, UK", category: "airport" },
  { id: "cam-23", name: "JFK Airport", lat: 40.6413, lon: -73.7781, url: "", location: "New York, USA", category: "airport" },
  { id: "cam-24", name: "Narita Airport", lat: 35.7720, lon: 140.3929, url: "", location: "Tokyo, Japan", category: "airport" },
  { id: "cam-25", name: "Port of Singapore", lat: 1.2644, lon: 103.8198, url: "", location: "Singapore", category: "port" },
  { id: "cam-26", name: "Port of Rotterdam", lat: 51.9054, lon: 4.4725, url: "", location: "Rotterdam, Netherlands", category: "port" },
  { id: "cam-27", name: "Port of Los Angeles", lat: 33.7408, lon: -118.2723, url: "", location: "Los Angeles, USA", category: "port" },
  { id: "cam-28", name: "Panama Canal", lat: 9.1021, lon: -79.6849, url: "", location: "Panama", category: "port" },
  { id: "cam-29", name: "Suez Canal", lat: 30.4583, lon: 32.3500, url: "", location: "Egypt", category: "port" },
  { id: "cam-30", name: "Strait of Hormuz", lat: 26.4145, lon: 56.4745, url: "", location: "Oman/Iran", category: "port" },
  { id: "cam-31", name: "South China Sea", lat: 15.0, lon: 115.0, url: "", location: "South China Sea", category: "maritime" },
  { id: "cam-32", name: "Persian Gulf", lat: 26.0, lon: 52.0, url: "", location: "Persian Gulf", category: "maritime" },
  { id: "cam-33", name: "Black Sea", lat: 43.0, lon: 34.0, url: "", location: "Black Sea", category: "maritime" },
  { id: "cam-34", name: "Mediterranean Sea", lat: 35.0, lon: 18.0, url: "", location: "Mediterranean", category: "maritime" },
  { id: "cam-35", name: "Korean DMZ", lat: 37.85, lon: 126.75, url: "", location: "North/South Korea Border", category: "military" },
  { id: "cam-36", name: "Israel-Gaza Border", lat: 31.3547, lon: 34.3088, url: "", location: "Gaza Strip", category: "military" },
  { id: "cam-37", name: "Ukraine Border", lat: 48.5, lon: 32.0, url: "", location: "Ukraine", category: "military" },
  { id: "cam-38", name: "Taiwan Strait", lat: 24.0, lon: 119.5, url: "", location: "Taiwan Strait", category: "military" },
  { id: "cam-39", name: "Mount Everest", lat: 27.9881, lon: 86.9250, url: "", location: "Nepal/Tibet", category: "nature" },
  { id: "cam-40", name: "Niagara Falls", lat: 43.0962, lon: -79.0377, url: "", location: "Canada/USA", category: "nature" },
];

export async function fetchPublicCameras(): Promise<EventData[]> {
  const events: EventData[] = [];
  
  for (const camera of PUBLIC_CAMERAS) {
    events.push({
      id: `camera-${camera.id}`,
      lat: camera.lat,
      lon: camera.lon,
      date: new Date().toISOString(),
      type: `📷 ${camera.name}`,
      description: `Live camera: ${camera.location}`,
          source: "Public Cams",
          category: "cameras"
        });
  }
  
  return events;
}

export async function fetchEarthCamFeeds(): Promise<EventData[]> {
  const events: EventData[] = [];
  
  const earthcamUrls = [
    "https://www.earthcam.com/",
  ];
  
  try {
    const response = await axios.get("https://www.earthcam.com/api/v1/cams/", { timeout: 10000 });
    if (response.data?.cams) {
      for (const cam of response.data.cams.slice(0, 20)) {
        events.push({
          id: `earthcam-${cam.id}`,
          lat: cam.lat || 0,
          lon: cam.lon || 0,
          date: new Date().toISOString(),
          type: `📷 ${cam.name}`,
          description: cam.description || "Live webcam",
          source: "EarthCam",
          category: "cameras"
        });
      }
    }
  } catch (error) {
    console.error("EarthCam API error:", error);
  }
  
  return events;
}

export async function fetchWebCamTaxi(): Promise<EventData[]> {
  const events: EventData[] = [];
  
  const regions = [
    { name: "Europe", lat: 50.0, lon: 10.0 },
    { name: "Asia", lat: 35.0, lon: 100.0 },
    { name: "Americas", lat: 40.0, lon: -100.0 },
    { name: "Middle East", lat: 25.0, lon: 45.0 },
    { name: "Africa", lat: 0.0, lon: 20.0 },
  ];
  
  for (const region of regions) {
    events.push({
      id: `webcamtaxi-${region.name.toLowerCase()}`,
      lat: region.lat,
      lon: region.lon,
      date: new Date().toISOString(),
      type: `📷 WebCamTaxi: ${region.name}`,
      description: `Webcams in ${region.name}`,
          source: "WebCamTaxi",
          category: "cameras"
        });
  }
  
  return events;
}
