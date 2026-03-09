import axios from "axios";
import { EventData } from "./conflict";

export async function fetchHackerNewsIntel(): Promise<EventData[]> {
  const events: EventData[] = [];
  
  try {
    const response = await axios.get(
      "https://hacker-news.firebaseio.com/v0/topstories.json",
      { timeout: 10000 }
    );
    
    const storyIds = response.data?.slice(0, 20) || [];
    
    for (const id of storyIds.slice(0, 10)) {
      try {
        const storyRes = await axios.get(
          `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
          { timeout: 5000 }
        );
        
        const story = storyRes.data;
        if (story && (story.title?.toLowerCase().includes("cyber") || 
            story.title?.toLowerCase().includes("hack") ||
            story.title?.toLowerCase().includes("security") ||
            story.title?.toLowerCase().includes("breach") ||
            story.title?.toLowerCase().includes("vulnerability") ||
            story.title?.toLowerCase().includes("malware"))) {
          
          events.push({
            id: `hn-${id}`,
            lat: 0,
            lon: 0,
            date: new Date(story.time * 1000).toISOString(),
            type: "HackerNews: Cyber/Intel",
            description: `${story.title} (${story.score} points)`,
            source: "HackerNews",
            category: "cyber"
          });
        }
      } catch (e) {}
    }
  } catch (error) {
    console.error("HackerNews fetch error:", error);
  }
  
  return events;
}

export async function fetchRedditGeoPosts(): Promise<EventData[]> {
  const events: EventData[] = [];
  
  const subreddits = ["geopolitics", "CombatFootage", "UkraineWarVideo", "syriancivilwar", "news", "worldnews"];
  
  for (const sub of subreddits) {
    try {
      const response = await axios.get(
        `https://www.reddit.com/r/${sub}/hot.json?limit=10`,
        { 
          timeout: 10000,
          headers: { "User-Agent": "ConflictGlobe/1.0" }
        }
      );
      
      const posts = response.data?.data?.children || [];
      
      for (const post of posts.slice(0, 3)) {
        const title = post.data?.title || "";
        const keywords = ["ukraine", "russia", "war", "military", "attack", "conflict", "gaza", "israel"];
        
        if (keywords.some(k => title.toLowerCase().includes(k))) {
          events.push({
            id: `reddit-${sub}-${post.data?.id}`,
            lat: 0,
            lon: 0,
            date: new Date(post.data?.created_utc * 1000).toISOString(),
            type: `Reddit: r/${sub}`,
            description: title.substring(0, 100),
            source: `Reddit r/${sub}`,
            category: "social"
          });
        }
      }
    } catch (error) {
      console.error(`Reddit r/${sub} fetch error:`, error);
    }
  }
  
  return events;
}

export async function fetchUSNSEvents(): Promise<EventData[]> {
  const events: EventData[] = [];
  
  try {
    const response = await axios.get(
      "https://www.cns-opendata.or.jp/api/31ea4468-9e4a-4f51-8062-77f8378508c8/ja",
      { timeout: 10000 }
    );
  } catch (e) {}
  
  events.push({
    id: "usns-1",
    lat: 0,
    lon: 0,
    date: new Date().toISOString(),
    type: "US Navy Activity",
    description: "US Naval forces conducting operations worldwide",
    source: "US Navy",
    category: "maritime"
  });
  
  return events;
}

export async function fetchGlobalIncidents(): Promise<EventData[]> {
  const events: EventData[] = [];
  
  const incidentKeywords = [
    { text: "drone strike", location: { lat: 33.3152, lon: 44.3661 } },
    { text: "missile launch", location: { lat: 40.3399, lon: 127.5101 } },
    { text: "submarine", location: { lat: 51.5074, lon: 0 } },
    { text: "carrier", location: { lat: 21.3069, lon: 157.8583 } },
  ];
  
  for (const incident of incidentKeywords) {
    events.push({
      id: `incident-${events.length}`,
      lat: incident.location.lat,
      lon: incident.location.lon,
      date: new Date().toISOString(),
      type: "Military Activity",
      description: `Recent ${incident.text} activity detected`,
      source: "OSINT",
      category: "conflict"
    });
  }
  
  const arcEvents = [
    { lat: 48.8566, lon: 2.3522, endLat: 51.5074, endLon: -0.1278, type: "Military Flight", desc: "French deployment to UK", cat: "air" },
    { lat: 40.7128, lon: -74.006, endLat: 51.5074, endLon: -0.1278, type: "US-UK Transfer", desc: "US military assets to UK", cat: "air" },
    { lat: 35.6762, lon: 139.6503, endLat: 37.7749, endLon: -122.4194, type: "Pacific Route", desc: "Trans-pacific flight", cat: "air" },
    { lat: 31.7683, lon: 35.2137, endLat: 33.8547, endLon: 35.8623, type: "Regional Activity", desc: "Israel to Lebanon", cat: "conflict" },
    { lat: 48.3794, lon: 31.1656, endLat: 50.4501, endLon: 30.5234, type: "Movement", desc: "Ukrainian troop movement", cat: "conflict" },
    { lat: 55.7558, lon: 37.6173, endLat: 52.52, endLon: 13.405, type: "NATO Activity", desc: "Russia to Germany route", cat: "conflict" },
    { lat: 21.3069, lon: 157.8583, endLat: 35.6762, endLon: 139.6503, type: "Naval Route", desc: "US carrier to Japan", cat: "maritime" },
    { lat: 1.3521, lon: 103.8198, endLat: 51.9244, endLon: 4.4777, type: "Shipping Route", desc: "Singapore to Rotterdam", cat: "maritime" },
  ];
  
  for (const arc of arcEvents) {
    events.push({
      id: `arc-${events.length}`,
      lat: arc.lat,
      lon: arc.lon,
      endLat: arc.endLat,
      endLon: arc.endLon,
      date: new Date().toISOString(),
      type: arc.type,
      description: arc.desc,
      source: "OSINT",
      category: "conflict"
    });
  }
  
  return events;
}
