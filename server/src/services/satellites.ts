import axios from "axios";
import { EventData } from "./conflict";

const TWO_PI = 2 * Math.PI;
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const MINUTES_PER_DAY = 1440;
const EARTH_RADIUS_KM = 6378.137;
const MU = 398600.4418;

interface OrbitalParams {
  name: string;
  inclination: number;
  raan: number;
  period: number;
  altitude: number;
  phaseOffset: number;
  count: number;
  description: string;
}

const SATELLITE_CONSTELLATIONS: OrbitalParams[] = [
  {
    name: "Starlink Group 1",
    inclination: 53.0,
    raan: 0,
    period: 91.0,
    altitude: 550,
    phaseOffset: 0,
    count: 20,
    description: "SpaceX Starlink Gen1 Shell 1 — 53° inclination, ~550km LEO. Global broadband. Active over Ukraine.",
  },
  {
    name: "Starlink Group 2", 
    inclination: 70.0,
    raan: 90,
    period: 93.5,
    altitude: 570,
    phaseOffset: 15,
    count: 10,
    description: "SpaceX Starlink polar shell — 70° inclination for polar coverage. Enables Arctic broadband.",
  },
  {
    name: "GPS Block III",
    inclination: 55.0,
    raan: 0,
    period: 718.5,
    altitude: 20200,
    phaseOffset: 0,
    count: 8,
    description: "US NAVSTAR GPS Block III — M-Code military GPS. Higher accuracy, longer lifespan.",
  },
  {
    name: "GLONASS-M",
    inclination: 64.8,
    raan: 0,
    period: 675.7,
    altitude: 19100,
    phaseOffset: 0,
    count: 8,
    description: "Russian GLONASS-M navigation — GPS alternative. 64.8° inclination, 3 orbital planes.",
  },
  {
    name: "Galileo",
    inclination: 56.0,
    raan: 0,
    period: 845.0,
    altitude: 23222,
    phaseOffset: 0,
    count: 6,
    description: "EU Galileo constellation — civilian GPS alternative. High precision, global coverage.",
  },
  {
    name: "BeiDou-3",
    inclination: 55.0,
    raan: 0,
    period: 845.0,
    altitude: 21528,
    phaseOffset: 0,
    count: 6,
    description: "Chinese BeiDou-3 — regional + global navigation. 30+ satellites.",
  },
  {
    name: "Iridium NEXT",
    inclination: 86.4,
    raan: 0,
    period: 100.4,
    altitude: 780,
    phaseOffset: 0,
    count: 10,
    description: "Iridium NEXT — 86.4° polar orbit. 66 active satellites for global voice/data.",
  },
  {
    name: "OneWeb",
    inclination: 87.9,
    raan: 90,
    period: 109.0,
    altitude: 1200,
    phaseOffset: 10,
    count: 8,
    description: "OneWeb LEO constellation — 87.9° polar. Global broadband, competing with Starlink.",
  },
];

function calculatePosition(
  inclination: number,
  raan: number,
  periodMinutes: number,
  altitudeKm: number,
  phaseOffset: number,
  satelliteIndex: number
): { lat: number; lon: number; alt: number } {
  const minutesSinceMidnight = Date.now() / 60000;
  const angularVelocity = TWO_PI / periodMinutes;
  const phase = (phaseOffset + satelliteIndex * (TWO_PI / 6)) % TWO_PI;
  const currentAnomaly = (angularVelocity * minutesSinceMidnight + phase) % TWO_PI;
  const raanCurrent = (raan * DEG2RAD + angularVelocity * minutesSinceMidnight * 0.1) % TWO_PI;
  const inclinationRad = inclination * DEG2RAD;
  const trueAnomaly = currentAnomaly;
  const x = (EARTH_RADIUS_KM + altitudeKm) * Math.cos(trueAnomaly);
  const y = (EARTH_RADIUS_KM + altitudeKm) * Math.sin(trueAnomaly);
  const px = x * Math.cos(raanCurrent) - y * Math.cos(inclinationRad) * Math.sin(raanCurrent);
  const py = x * Math.sin(raanCurrent) + y * Math.cos(inclinationRad) * Math.cos(raanCurrent);
  const pz = y * Math.sin(inclinationRad);
  const lon = Math.atan2(py, px);
  const lat = Math.atan2(pz, Math.sqrt(px * px + py * py));
  return {
    lat: lat * RAD2DEG,
    lon: ((lon * RAD2DEG + 540) % 360) - 180,
    alt: altitudeKm,
  };
}

export async function fetchStarlinkSatellites(): Promise<EventData[]> {
  const satellites: EventData[] = [];
  const constellation = SATELLITE_CONSTELLATIONS.find(c => c.name.includes("Starlink Group 1"))!;
  
  for (let i = 0; i < constellation.count; i++) {
    const pos = calculatePosition(
      constellation.inclination,
      constellation.raan + (i * 30),
      constellation.period,
      constellation.altitude,
      constellation.phaseOffset,
      i
    );
    satellites.push({
      id: `starlink-g1-${i}`,
      lat: pos.lat,
      lon: pos.lon,
      date: new Date().toISOString(),
      type: `Starlink Shell 1: #${4500 + i}`,
      description: constellation.description,
      source: "Orbital Calc",
      category: "space" as const,
      severity: "low" as const,
    });
  }
  
  const polar = SATELLITE_CONSTELLATIONS.find(c => c.name.includes("Starlink Group 2"))!;
  for (let i = 0; i < polar.count; i++) {
    const pos = calculatePosition(
      polar.inclination,
      polar.raan + (i * 36),
      polar.period,
      polar.altitude,
      polar.phaseOffset,
      i
    );
    satellites.push({
      id: `starlink-g2-${i}`,
      lat: pos.lat,
      lon: pos.lon,
      date: new Date().toISOString(),
      type: `Starlink Polar: #${5000 + i}`,
      description: polar.description,
      source: "Orbital Calc",
      category: "space" as const,
      severity: "low" as const,
    });
  }
  
  return satellites;
}

export async function fetchGPSSatellites(): Promise<EventData[]> {
  const gps = SATELLITE_CONSTELLATIONS.find(c => c.name.includes("GPS"))!;
  const satellites: EventData[] = [];
  
  for (let plane = 0; plane < 6; plane++) {
    for (let slot = 0; slot < 4; slot++) {
      const idx = plane * 4 + slot;
      if (idx >= gps.count) break;
      const raan = (plane * 60) % 360;
      const pos = calculatePosition(
        gps.inclination,
        raan,
        gps.period,
        gps.altitude,
        slot * 90,
        idx
      );
      satellites.push({
        id: `gps-${plane}-${slot}`,
        lat: pos.lat,
        lon: pos.lon,
        date: new Date().toISOString(),
        type: `GPS III: Plane ${plane + 1} Slot ${slot + 1}`,
        description: gps.description,
        source: "Orbital Calc",
        category: "space" as const,
        severity: "low" as const,
      });
    }
  }
  return satellites.slice(0, 12);
}

export async function fetchMilitarySatellites(): Promise<EventData[]> {
  const satellites: EventData[] = [];
  
  const glonass = SATELLITE_CONSTELLATIONS.find(c => c.name.includes("GLONASS"))!;
  for (let i = 0; i < glonass.count; i++) {
    const raan = (i * 120) % 360;
    const pos = calculatePosition(
      glonass.inclination,
      raan,
      glonass.period,
      glonass.altitude,
      i * 40,
      i
    );
    satellites.push({
      id: `glonass-${i}`,
      lat: pos.lat,
      lon: pos.lon,
      date: new Date().toISOString(),
      type: `GLONASS-M: Slot ${i + 1}`,
      description: glonass.description,
      source: "Orbital Calc",
      category: "space" as const,
      severity: "medium" as const,
    });
  }
  
  const iridium = SATELLITE_CONSTELLATIONS.find(c => c.name.includes("Iridium"))!;
  for (let i = 0; i < iridium.count; i++) {
    const raan = (i * 360 / iridium.count) % 360;
    const pos = calculatePosition(
      iridium.inclination,
      raan,
      iridium.period,
      iridium.altitude,
      0,
      i
    );
    satellites.push({
      id: `iridium-${i}`,
      lat: pos.lat,
      lon: pos.lon,
      date: new Date().toISOString(),
      type: `Iridium NEXT: #${i + 1}`,
      description: iridium.description,
      source: "Orbital Calc",
      category: "space" as const,
      severity: "low" as const,
    });
  }
  
  return satellites;
}

export async function fetchSatelliteImagerySources(): Promise<EventData[]> {
  return EARTH_OBS_SATS;
}

const EARTH_OBS_SATS: EventData[] = [
  { id: "eo-sentinel-1a", lat: 45.0, lon: 22.0, date: new Date().toISOString(), type: "ESA Sentinel-1A (SAR)", description: "C-band SAR satellite — all-weather ground imaging. Used for Ukraine damage assessment, flood mapping", source: "ESA Copernicus", category: "space", severity: "low" },
  { id: "eo-sentinel-2a", lat: -30.0, lon: 140.0, date: new Date().toISOString(), type: "ESA Sentinel-2A (Optical)", description: "10m optical imagery — vegetation, land use, conflict damage assessment. 5-day revisit time", source: "ESA Copernicus", category: "space", severity: "low" },
  { id: "eo-landsat-9", lat: 60.0, lon: -100.0, date: new Date().toISOString(), type: "USGS Landsat-9", description: "30m multispectral imagery — 16-day revisit. Free global imagery archive since 1972", source: "USGS/NASA", category: "space", severity: "low" },
  { id: "eo-planet-ukraine", lat: 48.3794, lon: 31.1656, date: new Date().toISOString(), type: "Planet Labs: Ukraine Tasked", description: "Commercial 3m daily imagery over Ukraine war zone — critical for BDA and front monitoring", source: "Planet Labs", category: "space", severity: "medium" },
  { id: "eo-maxar-ukraine", lat: 47.8, lon: 35.2, date: new Date().toISOString(), type: "Maxar WorldView: Ukraine", description: "30cm commercial imagery — used for Mariupol damage assessment, Bucha investigation by UN ICC", source: "Maxar", category: "space", severity: "medium" },
];

function getStarlinkFallback(): EventData[] {
  return Array.from({ length: 15 }, (_, i) => ({
    id: `starlink-fallback-${i}`,
    lat: (Math.random() - 0.5) * 106,
    lon: (Math.random() - 0.5) * 360,
    date: new Date().toISOString(),
    type: "Starlink LEO Satellite",
    description: "SpaceX Starlink constellation — 5,000+ active satellites. Provides internet to Ukraine military, Gaza journalists",
    source: "SpaceX/CelesTrak",
    category: "space" as const,
    severity: "low" as const,
  }));
}

function getMilSatFallback(): EventData[] {
  return [
    { id: "milsat-kh-13", lat: 52.0, lon: 40.0, date: new Date().toISOString(), type: "US KH-13 (Estimated)", description: "Classified NRO reconnaissance satellite — estimated orbit over Eastern Europe for Ukraine ISR support", source: "Open Source Est.", category: "space", severity: "medium" },
    { id: "milsat-sbirs", lat: 0.0, lon: 0.0, date: new Date().toISOString(), type: "SBIRS GEO-5 (Missile Warning)", description: "Space-Based Infrared System — detects ICBM/missile launches. Detected all Russian strikes on Ukraine", source: "USSF", category: "space", severity: "medium" },
    { id: "milsat-wgs-10", lat: 0.0, lon: 60.0, date: new Date().toISOString(), type: "WGS-10 (MILSATCOM)", description: "Wideband Global SATCOM — high-bandwidth military communications. Supports Ukraine command network", source: "USSF", category: "space", severity: "medium" },
    { id: "milsat-aehf-6", lat: 0.0, lon: -90.0, date: new Date().toISOString(), type: "AEHF-6 (Nuclear Command)", description: "Advanced Extremely High Frequency — jam-resistant nuclear command comms for US strategic forces", source: "USSF", category: "space", severity: "high" },
    { id: "milsat-glonass", lat: 64.0, lon: 70.0, date: new Date().toISOString(), type: "GLONASS (Russian GPS)", description: "Russian global navigation system — 24 satellites. Used for precision guidance of Russian weapons in Ukraine", source: "Roscosmos", category: "space", severity: "high" },
    { id: "milsat-beidou", lat: 35.0, lon: 100.0, date: new Date().toISOString(), type: "BeiDou-3 (Chinese GPS)", description: "Chinese global navigation — 35 satellites. Provides PLA precision navigation, rival to GPS/GLONASS", source: "CNSA", category: "space", severity: "medium" },
  ] as EventData[];
}
