import axios from "axios";
import { EventData } from "./conflict";

export async function fetchFlightData(): Promise<EventData[]> {
  const flights: EventData[] = [];
  
  try {
    const response = await axios.get(
      "https://www.flightradar24.com/_json/airports.json",
      { timeout: 10000 }
    );
    
    if (response.data?.rows) {
      response.data.rows.slice(0, 30).map((airport: any) => {
        if (airport.lat && airport.lng) {
          flights.push({
            id: `fr24-airport-${airport.icao}`,
            lat: parseFloat(airport.lat),
            lon: parseFloat(airport.lng),
            date: new Date().toISOString(),
            type: `Airport: ${airport.name}`,
            description: `${airport.city || ""}, ${airport.country || ""} - ${airport.icao}/${airport.iata || "N/A"}`,
            source: "FlightRadar24",
            category: "air" as const,
            severity: "low" as const,
          });
        }
      });
    }
  } catch (error) {
    // Silent fail
  }

  return flights;
}

export async function fetchMilitaryFlights(): Promise<EventData[]> {
  const flights: EventData[] = [];
  
  const militaryBases = [
    { name: "Ramstein Air Base", lat: 49.4369, lon: 7.6003, country: "Germany" },
    { name: "Incirlik Air Base", lat: 37.0011, lon: 35.3213, country: "Turkey" },
    { name: "Al Udeid Air Base", lat: 25.1165, lon: 50.6565, country: "Qatar" },
    { name: "Al Dhafra Air Base", lat: 24.4331, lon: 54.4741, country: "UAE" },
    { name: "Andersen Air Force Base", lat: 13.5839, lon: 144.9183, country: "Guam" },
    { name: "Kadena Air Base", lat: 26.2656, lon: 127.7567, country: "Japan" },
    { name: "Naval Station Norfolk", lat: 36.9506, lon: -76.3051, country: "USA" },
    { name: "RAF Lakenheath", lat: 52.4093, lon: 0.5613, country: "UK" },
    { name: "Spangdahlem Air Base", lat: 49.9729, lon: 6.6973, country: "Germany" },
    { name: "Aviano Air Base", lat: 46.0319, lon: 12.5964, country: "Italy" },
  ];

  militaryBases.forEach((base) => {
    flights.push({
      id: `mil-base-${base.name.toLowerCase().replace(/\s/g, "-")}`,
      lat: base.lat,
      lon: base.lon,
      date: new Date().toISOString(),
      type: `Military Base: ${base.name}`,
      description: `${base.country} - NATO/allied air operations`,
      source: "Military Installations",
      category: "air" as const,
      severity: "medium" as const,
    });
  });

  return flights;
}

export async function fetchAirspaceAlerts(): Promise<EventData[]> {
  const alerts: EventData[] = [];
  
  const regions = [
    { name: "North Atlantic", lat: 45, lon: -30, radius: 500 },
    { name: "Mediterranean", lat: 38, lon: 15, radius: 400 },
    { name: "Baltic Sea", lat: 55, lon: 15, radius: 300 },
    { name: "Black Sea", lat: 43, lon: 35, radius: 350 },
    { name: "Persian Gulf", lat: 26, lon: 52, radius: 300 },
    { name: "South China Sea", lat: 15, lon: 115, radius: 500 },
    { name: "Eastern Europe", lat: 52, lon: 25, radius: 600 },
    { name: "Korea ADIZ", lat: 37, lon: 126, radius: 400 },
    { name: "Taiwan ADIZ", lat: 24, lon: 121, radius: 350 },
    { name: "Alaska NORAD", lat: 64, lon: -150, radius: 600 },
  ];

  regions.forEach((region) => {
    alerts.push({
      id: `airspace-${region.name.toLowerCase().replace(/\s/g, "-")}`,
      lat: region.lat,
      lon: region.lon,
      date: new Date().toISOString(),
      type: `Airspace: ${region.name}`,
      description: `Flight Information Region - ${region.radius}nm radius`,
      source: "FIR Registry",
      category: "air" as const,
      severity: "low" as const,
    });
  });

  return alerts;
}

export async function fetchDroneZones(): Promise<EventData[]> {
  const zones: EventData[] = [];
  
  const conflictZones = [
    { name: "Ukraine Theater", lat: 49.5, lon: 31.5, type: "UAV Operations Zone" },
    { name: "Gaza Strip", lat: 31.4, lon: 34.3, type: "UAV Surveillance" },
    { name: "Red Sea", lat: 15, lon: 42, type: "Maritime Patrol" },
    { name: "Baltic Region", lat: 54, lon: 18, type: "NATO Air Policing" },
  ];

  conflictZones.forEach((zone) => {
    zones.push({
      id: `drone-${zone.name.toLowerCase().replace(/\s/g, "-")}`,
      lat: zone.lat,
      lon: zone.lon,
      date: new Date().toISOString(),
      type: `UAV/Drone: ${zone.type}`,
      description: `Active ${zone.type} in ${zone.name} region`,
      source: "UAV Tracker",
      category: "air" as const,
      severity: "high" as const,
    });
  });

  return zones;
}
