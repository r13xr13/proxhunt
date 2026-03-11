import axios from "axios";
import { EventData } from "./conflict";

// OpenSky Network - real ADSB data, free
export async function fetchADSBExchange(): Promise<EventData[]> {
  try {
    // ADSBExchange requires API key now. Use OpenSky free tier
    const response = await axios.get(
      "https://opensky-network.org/api/states/all",
      { timeout: 15000 }
    );

    if (!response.data?.states) return [];

    // Filter interesting callsigns
    const interestingPrefixes = [
      "RCH", "REACH", "RRR", "JAKE", "BART", "VENUS", "FURY", "WOLF", "VIPER",
      "COBRA", "EAGLE", "HAWK", "MAGMA", "GHOST", "REAPER", "DARKSTAR",
      "CHAOS", "SPAD", "MARLIN", "DRAGON", "BONE", "KNIGHT"
    ];

    return response.data.states
      .filter((s: any) => {
        const cs = (s[1] || "").trim().toUpperCase();
        return s[5] && s[6] && cs && interestingPrefixes.some(p => cs.startsWith(p));
      })
      .slice(0, 25)
      .map((s: any) => ({
        id: `adsb-mil-${s[0]}`,
        lat: parseFloat(s[6]),
        lon: parseFloat(s[5]),
        date: new Date().toISOString(),
        type: `Military Aircraft: ${(s[1] || s[0]).trim()}`,
        description: `${s[2] || "Unknown"} — Callsign: ${(s[1] || "N/A").trim()}, Alt: ${s[7] ? Math.round(s[7]) + "m" : "N/A"}, ${s[9] ? Math.round(s[9] * 3.6) + "km/h" : ""}`,
        source: "OpenSky Network",
        category: "air" as const,
        severity: "medium" as const,
      }));
  } catch (error) {
    console.error("ADSB fetch error:", error);
    return [];
  }
}

export async function fetchMilitaryAircraft(): Promise<EventData[]> {
  // Already covered by fetchADSBExchange + air.ts fetchMilitaryAircraft
  return [];
}

export async function fetchPrivateJets(): Promise<EventData[]> {
  // Not security relevant - removed
  return [];
}
