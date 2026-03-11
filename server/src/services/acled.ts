import axios from "axios";
import { EventData } from "./conflict";

// ACLED API — free for researchers, best conflict dataset globally
// Register at: developer.acleddata.com
export async function fetchACLEDEvents(): Promise<EventData[]> {
  const key = process.env.ACLED_KEY;
  const email = process.env.ACLED_EMAIL;

  if (!key || !email) {
    console.log("[ACLED] No credentials — set ACLED_KEY and ACLED_EMAIL in .env");
    return [];
  }

  try {
    // Last 30 days of events, sorted by fatalities
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString().split("T")[0].replace(/-/g, "");

    const response = await axios.get("https://api.acleddata.com/acled/read", {
      params: {
        key,
        email,
        limit: 200,
        fields: "event_id_cnty|event_date|event_type|sub_event_type|actor1|actor2|country|location|latitude|longitude|fatalities|notes|source",
        event_date: `${dateStr}|${new Date().toISOString().split("T")[0].replace(/-/g, "")}`,
        event_date_where: "BETWEEN",
        order: "fatalities|DESC",
      },
      timeout: 15000,
    });

    if (!response.data?.data) return [];

    return response.data.data.map((e: any) => {
      const fatalities = parseInt(e.fatalities) || 0;
      const severity: EventData["severity"] =
        fatalities >= 50 ? "critical" :
        fatalities >= 10 ? "high" :
        fatalities >= 1  ? "medium" : "low";

      return {
        id: `acled-${e.event_id_cnty}`,
        lat: parseFloat(e.latitude),
        lon: parseFloat(e.longitude),
        date: e.event_date
          ? new Date(e.event_date.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3")).toISOString()
          : new Date().toISOString(),
        type: `ACLED: ${e.event_type} — ${e.location}`,
        description: `${e.actor1}${e.actor2 ? " vs " + e.actor2 : ""} — ${e.notes?.substring(0, 150) || e.event_type}. Fatalities: ${fatalities}`,
        source: e.source || "ACLED",
        category: "conflict" as const,
        severity,
        country: e.country,
        entities: [e.actor1, e.actor2].filter(Boolean),
      };
    }).filter((e: EventData) => !isNaN(e.lat) && !isNaN(e.lon) && e.lat !== 0);
  } catch (err: any) {
    console.error("[ACLED] Fetch failed:", err?.response?.data || err?.message);
    return [];
  }
}
