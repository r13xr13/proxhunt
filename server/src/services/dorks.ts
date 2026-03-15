import axios from 'axios';
import * as cheerio from 'cheerio';

interface DorkCategory {
  name: string;
  dorks: string[];
}

const dorkCategories: DorkCategory[] = [
  {
    name: "Cameras & Surveillance",
    dorks: [
      "inurl:view/index.shtml inurl:axis",
      "inurl:view/view.shtml inurl:axis",
      "intitle:\"Live View\" -intitle:\"AXIS\"",
      "inurl:control/userimage.html",
      "intitle:\"FlexWatch\"",
      "\"WebcamXP\" \"Home\"",
      "intitle:\"webcam 7\"",
      "inurl:\"CgiStart\" \"page=\"",
      "\"Honeywell\" \"webcam\"",
      "\"Taxis\" \"Camera\""
    ]
  },
  {
    name: "Traffic & Roads",
    dorks: [
      "\"Traffic Camera\" \"live\"",
      "\"Road Camera\" \"mjpg\"",
      "\"Highway Camera\" \"view\"",
      "\"Traffic Monitoring\" \"Camera\"",
      "\"DOT\" \"Camera\" \"Live\"",
      "\"City Traffic\" \"Camera\"",
      "\"Traffic Management\" \"Video\""
    ]
  },
  {
    name: "Network Devices",
    dorks: [
      "intitle:\"Network Camera\" \"Welcome\"",
      "intitle:\"Sony Network Camera\" \"Login\"",
      "intitle:\"Panasonic\" \"Network Camera\"",
      "intitle:\"Mobotix\" \"Mobotix\"",
      "\"webcam\" \"snapshot\" \"cgi-bin\"",
      "inurl:\"snapshot.cgi\"",
      "intitle:\"i-Catcher\" \"Web Monitor\"",
      "\"DVIP Camera\" \"Web\""
    ]
  },
  {
    name: "Industrial & SCADA",
    dorks: [
      "intitle:\"SCADA\" \"Login\"",
      "\"Siemens\" \"PLC\" \"webcam\"",
      "\"Industrial Camera\" \"web\"",
      "\"Machine Vision\" \"Camera\"",
      "\"Factory Camera\" \"Live\""
    ]
  },
  {
    name: "Default Credentials",
    dorks: [
      "\"admin\" \"admin\" \"webcam\"",
      "\"default password\" \"camera\"",
      "\"user: admin\" \"pass: admin\" \"camera\"",
      "\"Authorization\" \"Basic\" \"camera\""
    ]
  },
  {
    name: "Exposed Files",
    dorks: [
      "site:github.com \"password\" \"camera\"",
      "filetype:log \"webcam\"",
      "filetype:cfg \"webcam\"",
      "filetype:txt \"webcam\" \"password\""
    ]
  }
];

export interface DorkResult {
  category: string;
  query: string;
  fullDork: string;
  description: string;
}

export async function generateDorks(target: string, category?: string): Promise<DorkResult[]> {
  const results: DorkResult[] = [];
  const categories = category 
    ? dorkCategories.filter(c => c.name.toLowerCase().includes(category.toLowerCase()))
    : dorkCategories;

  for (const cat of categories) {
    for (const dork of cat.dorks) {
      results.push({
        category: cat.name,
        query: dork.replace(/"/g, ''),
        fullDork: `${dork} "${target}"`,
        description: `${cat.name} search for ${target}`
      });
    }
  }

  return results;
}

export async function scanCameras(region?: string): Promise<any[]> {
  const cameras: any[] = [];
  
  // Scrape Insecam for public webcams
  try {
    const response = await axios.get('http://www.insecam.org/en/', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    $('a[href*="/view/"]').each((_, el) => {
      const href = $(el).attr('href');
      const title = $(el).text();
      if (href && title) {
        cameras.push({
          source: 'Insecam',
          url: `http://www.insecam.org${href}`,
          title: title.trim(),
          type: 'public',
          feedType: 'insecam'
        });
      }
    });
  } catch (e) {
    console.log('Insecam scan error:', e);
  }

  // Traffic camera sources with better scraping
  const trafficSources = [
    { name: 'Trafficland', url: 'https://www.trafficland.com/', selector: 'a[href*="viewcam"]' },
    { name: 'Camroads', url: 'https://www.camroads.com/', selector: 'a[href*="camera"]' },
    { name: 'i-Transport', url: 'https://www.i-transport.org/', selector: 'img' },
  ];

  for (const source of trafficSources) {
    try {
      const resp = await axios.get(source.url, { 
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      
      if (resp.status === 200) {
        cameras.push({
          source: source.name,
          url: source.url,
          status: 'active',
          type: 'traffic',
          feedType: 'traffic'
        });
      }
    } catch {
      // Keep checking other sources
    }
  }

  // Add hardcoded traffic camera directory
  const trafficCameras = [
    { name: 'Los Angeles DOT', url: 'https://traffic.lacity.org/', type: 'traffic', region: 'CA' },
    { name: 'Caltrans District 7', url: 'http://www.dot.ca.gov/d7/cctv/', type: 'traffic', region: 'CA' },
    { name: 'NYC DOT', url: 'https://www.nyc.gov/html/dot/html/motorist/traffic-cams.shtml', type: 'traffic', region: 'NY' },
    { name: 'Florida 511', url: 'https://www.fl511.com/', type: 'traffic', region: 'FL' },
    { name: 'Texas DOT', url: 'https://drivetexas.org/', type: 'traffic', region: 'TX' },
    { name: 'Illinois DOT', url: 'https://www.idotillinois.org/', type: 'traffic', region: 'IL' },
    { name: 'Michigan MiDrive', url: 'https://www.michigan.gov/mdrive/', type: 'traffic', region: 'MI' },
    { name: 'Washington WSDOT', url: 'https://www.wsdot.com/traffic/cameras/', type: 'traffic', region: 'WA' },
    { name: 'Oregon TripCheck', url: 'https://www.tripcheck.com/', type: 'traffic', region: 'OR' },
    { name: 'BC DriveBC', url: 'https://www.drivesbc.ca/', type: 'traffic', region: 'BC' },
  ];

  trafficCameras.forEach(cam => {
    if (!region || cam.region === region || region === 'all') {
      cameras.push({
        source: cam.name,
        url: cam.url,
        status: 'active',
        type: 'traffic',
        region: cam.region,
        feedType: 'traffic'
      });
    }
  });

  return cameras;
}

export async function executeDorkSearch(dork: string): Promise<any[]> {
  const results: any[] = [];
  
  try {
    // Use Google search via SerpAPI or DuckDuckGo
    const response = await axios.get(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(dork)}`,
      {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );

    const $ = cheerio.load(response.data);
    $('.result__a').each((i, el) => {
      if (i < 20) {
        results.push({
          title: $(el).text(),
          url: $(el).attr('href'),
          snippet: $(el).closest('.result').find('.result__snippet').text()
        });
      }
    });
  } catch (e) {
    console.log('Dork search error:', e);
  }

  return results;
}

// Export camera locations with coordinates
export const cameraLocations = [
  // US Traffic Cams
  { name: 'Los Angeles DOT', lat: 34.0522, lon: -118.2437, type: 'traffic', region: 'US' },
  { name: 'NYC DOT', lat: 40.7128, lon: -74.0060, type: 'traffic', region: 'US' },
  { name: 'Caltrans District 7', lat: 34.05, lon: -118.25, type: 'traffic', region: 'US' },
  { name: 'Florida 511', lat: 25.7617, lon: -80.1918, type: 'traffic', region: 'US' },
  { name: 'Texas DOT', lat: 30.2672, lon: -97.7431, type: 'traffic', region: 'US' },
  { name: 'Illinois DOT', lat: 41.8781, lon: -87.6298, type: 'traffic', region: 'US' },
  { name: 'Michigan MiDrive', lat: 42.3314, lon: -83.0458, type: 'traffic', region: 'US' },
  { name: 'Washington WSDOT', lat: 47.6062, lon: -122.3321, type: 'traffic', region: 'US' },
  { name: 'Oregon TripCheck', lat: 45.5152, lon: -122.6784, type: 'traffic', region: 'US' },
  { name: 'BC DriveBC', lat: 49.2827, lon: -123.1207, type: 'traffic', region: 'Canada' },
  
  // Major International Cities
  { name: 'Tokyo Traffic', lat: 35.6762, lon: 139.6503, type: 'traffic', region: 'JP' },
  { name: 'London Traffic', lat: 51.5074, lon: -0.1278, type: 'traffic', region: 'UK' },
  { name: 'Paris Traffic', lat: 48.8566, lon: 2.3522, type: 'traffic', region: 'FR' },
  { name: 'Sydney Traffic', lat: -33.8688, lon: 151.2093, type: 'traffic', region: 'AU' },
  { name: 'Singapore Traffic', lat: 1.3521, lon: 103.8198, type: 'traffic', region: 'SG' },
  
  // Public webcams (Insecam approximate locations)
  { name: 'Public Webcam - Buenos Aires', lat: -34.6037, lon: -58.3816, type: 'public', region: 'AR' },
  { name: 'Public Webcam - Tokyo', lat: 35.6762, lon: 139.6503, type: 'public', region: 'JP' },
  { name: 'Public Webcam - Berlin', lat: 52.5200, lon: 13.4050, type: 'public', region: 'DE' },
  { name: 'Public Webcam - Paris', lat: 48.8566, lon: 2.3522, type: 'public', region: 'FR' },
  { name: 'Public Webcam - London', lat: 51.5074, lon: -0.1278, type: 'public', region: 'UK' },
];

export async function getCameraMarkers(): Promise<any[]> {
  return cameraLocations.map(cam => ({
    ...cam,
    id: `cam-${cam.name.replace(/\s+/g, '-').toLowerCase()}`,
    size: 4,
    color: cam.type === 'traffic' ? '#ec4899' : '#8b5cf6',
    icon: '▲',
  }));
}

export async function scanNetwork(target: string, tool: string): Promise<string> {
  const tools: Record<string, string> = {
    'nmap': `nmap -sV -O ${target}`,
    'nikto': `nikto -h ${target}`,
    'gobuster': `gobuster dir -u ${target} -w /usr/share/wordlists/dirb/common.txt`,
    'subfinder': `subfinder -d ${target}`,
    'amass': `amass enum -d ${target}`,
    'whatweb': `whatweb ${target}`,
    'wpscan': `wpscan --url ${target}`
  };

  return tools[tool] || `Tool ${tool} not found`;
}
