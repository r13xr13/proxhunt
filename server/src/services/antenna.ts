import axios from "axios";
import { EventData } from "./conflict";

const ANTENA_API_URL = process.env.ANTENA_API_URL || "http://localhost:3000";
const ANTENA_API_KEY = process.env.ANTENA_API_KEY || "ant_agent_c9f01afd59322dc2dca1daf5e436c87b";

export async function fetchAntennaSignals(): Promise<EventData[]> {
  try {
    // Fetch detected signals/transmissions from antenna system
    const response = await axios.get(
      `${ANTENA_API_URL}/api/signals`,
      {
        headers: {
          "Authorization": `Bearer ${ANTENA_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 10000
      }
    );

    if (!response.data?.signals) return [];

    return response.data.signals
      .map((signal: any) => {
        // Convert antenna signal data to EventData format
        return {
          id: `antenna-${signal.id || Math.random().toString(36).substr(2, 9)}`,
          lat: signal.latitude || 0,
          lon: signal.longitude || 0,
          date: signal.timestamp || new Date().toISOString(),
          type: `📡 ${signal.type || "Radio Signal"}`,
          description: `${signal.description || ""} Frequency: ${signal.frequency || "Unknown"} MHz, Power: ${signal.power || "Unknown"} dBm`,
          source: "Antenna Array",
          category: "radio" as const,
          severity: signal.severity || "medium" as const,
          // Additional metadata for antenna-specific visualization
          frequency: signal.frequency,
          power: signal.power,
          bandwidth: signal.bandwidth,
          modulation: signal.modulation,
          signalType: signal.type,
          antennaId: signal.antenna_id,
          confidence: signal.confidence
        };
      })
      .filter(signal => 
        // Filter out invalid coordinates
        !isNaN(signal.lat) && !isNaN(signal.lon) && 
        signal.lat !== 0 && signal.lon !== 0 &&
        signal.lat >= -90 && signal.lat <= 90 &&
        signal.lon >= -180 && signal.lon <= 180
      );
  } catch (error) {
    console.error("Antenna signals fetch error:", error);
    return [];
  }
}

// Get antenna array status and health
export async function fetchAntennaStatus(): Promise<EventData[]> {
  try {
    const response = await axios.get(
      `${ANTENA_API_URL}/api/status`,
      {
        headers: {
          "Authorization": `Bearer ${ANTENA_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 5000
      }
    );

    if (!response.data) return [];

    return [
      {
        id: "antenna-status",
        lat: response.data.latitude || 0,
        lon: response.data.longitude || 0,
        date: new Date().toISOString(),
        type: "📡 Antenna Array Status",
        description: `Status: ${response.data.status || "Unknown"} | Uptime: ${response.data.uptime || "Unknown"} | Signals/min: ${response.data.signalsPerMinute || 0}`,
        source: "Antenna Array",
        category: "radio" as const,
        severity: response.data.status === "online" ? "low" : response.data.status === "degraded" ? "medium" : "high" as const,
        // Additional metadata
        antennaId: response.data.antenna_id,
        version: response.data.version,
        status: response.data.status,
        uptime: response.data.uptime,
        signalsPerMinute: response.data.signalsPerMinute
      }
    ];
  } catch (error) {
    console.error("Antenna status fetch error:", error);
    return [];
  }
}
