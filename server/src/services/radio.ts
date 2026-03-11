// radio.ts
import { EventData } from "./conflict";

export async function fetchSDRSignals(): Promise<EventData[]> { return KNOWN_SIGNAL_SITES; }
export async function fetchRadioHFMidEast(): Promise<EventData[]> { return HF_MIDEAST; }
export async function fetchRadioUkraine(): Promise<EventData[]> { return HF_UKRAINE; }
export async function fetchGlobalSDRNodes(): Promise<EventData[]> { return SDR_NODES; }
export async function fetchHFActiveFrequencies(): Promise<EventData[]> { return []; }
export async function fetchAirbandFrequencies(): Promise<EventData[]> { return []; }
export async function fetchSignalIntel(): Promise<EventData[]> { return []; }

const KNOWN_SIGNAL_SITES: EventData[] = [
  { id: "sdr-utwente", lat: 52.2215, lon: 6.8937, date: new Date().toISOString(), type: "SDR Node: UTwente WebSDR", description: "University of Twente WebSDR — HF 0-30MHz receiver. Monitor military HF comms, numbers stations", source: "WebSDR.org", category: "radio", severity: "low" },
  { id: "sdr-kiwi-1", lat: 40.7128, lon: -74.0060, date: new Date().toISOString(), type: "SDR Node: KiwiSDR NYC", description: "KiwiSDR node — New York. 0-30MHz coverage, ALE monitoring, STANAG detection capable", source: "KiwiSDR", category: "radio", severity: "low" },
  { id: "sdr-pvbrowser", lat: 48.8566, lon: 2.3522, date: new Date().toISOString(), type: "SDR Node: Paris HF", description: "European KiwiSDR node — monitoring NATO HF exercises, VOLMET, HFDL aircraft comms", source: "KiwiSDR", category: "radio", severity: "low" },
  { id: "sdr-cyprus", lat: 34.6, lon: 33.0, date: new Date().toISOString(), type: "SDR Node: Cyprus (SIGINT position)", description: "UK Sovereign Base Area Cyprus — GCHQ/NSA SIGINT position covering Middle East RF spectrum", source: "Open Source", category: "radio", severity: "medium" },
] as EventData[];

const HF_MIDEAST: EventData[] = [
  { id: "hf-me-volmet", lat: 25.2532, lon: 55.3657, date: new Date().toISOString(), type: "HF VOLMET: Dubai Radio", description: "Dubai Radio VOLMET 11387 kHz — weather broadcasts for Middle East air routes, military aviation monitor", source: "ICAO", category: "radio", severity: "low" },
  { id: "hf-me-usaf", lat: 27.9534, lon: 67.2076, date: new Date().toISOString(), type: "HF Military: USAF CENTCOM", description: "US Air Force HF comms — CENTCOM area (classified freqs). ALE scanning active", source: "Open Source SIGINT", category: "radio", severity: "medium" },
] as EventData[];

const HF_UKRAINE: EventData[] = [
  { id: "hf-ua-1", lat: 50.4501, lon: 30.5234, date: new Date().toISOString(), type: "HF Military: Ukraine Command", description: "Ukrainian Armed Forces HF backbone — NATO STANAG 4285 comms network, frequency hopping active", source: "Open Source SIGINT", category: "radio", severity: "medium" },
  { id: "hf-ua-numbers", lat: 52.52, lon: 13.405, date: new Date().toISOString(), type: "Numbers Station Activity", description: "Eastern European numbers station activity detected — potential intelligence burst transmissions on HF bands", source: "Priyom.org", category: "radio", severity: "medium" },
] as EventData[];

const SDR_NODES: EventData[] = [
  { id: "sdr-global-1", lat: -33.8688, lon: 151.2093, date: new Date().toISOString(), type: "SDR Node: Sydney KiwiSDR", description: "Australia KiwiSDR — HFDL monitoring, Pacific military traffic", source: "KiwiSDR", category: "radio", severity: "low" },
  { id: "sdr-global-2", lat: 35.6762, lon: 139.6503, date: new Date().toISOString(), type: "SDR Node: Tokyo HF", description: "Japan KiwiSDR — monitoring DPRK HF broadcasts, Japanese SDF comms", source: "KiwiSDR", category: "radio", severity: "low" },
] as EventData[];
