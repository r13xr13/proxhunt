const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const OLLAMA_API = 'http://localhost:11434/api/chat';
const CONFLICT_GLOBE_API = 'http://localhost:8080/api/conflicts';
const STORAGE_DIR = path.join(__dirname, 'threat-data');

class ThreatAnalyzer {
    constructor() {
        this.model = 'llama3.2:latest';
        this.threatsFile = path.join(STORAGE_DIR, 'critical-threats.json');
        this.profilesFile = path.join(STORAGE_DIR, 'threat-profiles.json');
        this.reportsFile = path.join(STORAGE_DIR, 'reports.json');
    }

    async init() {
        try {
            await fs.mkdir(STORAGE_DIR, { recursive: true });
            await this.loadData();
            console.log('Threat Analyzer initialized');
        } catch (error) {
            console.error('Error initializing Threat Analyzer:', error.message);
        }
    }

    async loadData() {
        try {
            // Load critical threats
            try {
                const threatsData = await fs.readFile(this.threatsFile, 'utf8');
                this.criticalThreats = JSON.parse(threatsData);
            } catch {
                this.criticalThreats = [];
            }

            // Load threat profiles
            try {
                const profilesData = await fs.readFile(this.profilesFile, 'utf8');
                this.threatProfiles = JSON.parse(profilesData);
            } catch {
                this.threatProfiles = {};
            }

            // Load reports
            try {
                const reportsData = await fs.readFile(this.reportsFile, 'utf8');
                this.reports = JSON.parse(reportsData);
            } catch {
                this.reports = [];
            }
        } catch (error) {
            console.error('Error loading data:', error.message);
        }
    }

    async saveData() {
        try {
            await fs.writeFile(this.threatsFile, JSON.stringify(this.criticalThreats, null, 2));
            await fs.writeFile(this.profilesFile, JSON.stringify(this.threatProfiles, null, 2));
            await fs.writeFile(this.reportsFile, JSON.stringify(this.reports, null, 2));
        } catch (error) {
            console.error('Error saving data:', error.message);
        }
    }

    async analyzePattern(text, context = '') {
        const prompt = `You are a military intelligence analyst. Analyze the following text for threat patterns, severity, and indicators.

Context: ${context}

Text: ${text}

Analyze and provide:
1. Threat Level: Critical/High/Medium/Low
2. Key Indicators: List specific threat indicators
3. Pattern Type: One of: Military Mobilization, Terrorist Activity, Cyber Attack, Geopolitical Tension, Infrastructure Target, Energy Crisis, Naval Activity, Air Activity, Other
4. Confidence Score: 0-100
5. Recommended Actions: Brief recommendations

Format your response as JSON:
{
  "threatLevel": "Critical|High|Medium|Low",
  "indicators": ["indicator1", "indicator2"],
  "patternType": "Military Mobilization|Terrorist Activity|Cyber Attack|Geopolitical Tension|Infrastructure Target|Energy Crisis|Naval Activity|Air Activity|Other",
  "confidence": 0-100,
  "recommendedActions": ["action1", "action2"]
}`;

        try {
            const response = await axios.post(OLLAMA_API, {
                model: this.model,
                messages: [
                    { role: 'system', content: 'You are a military intelligence analyst.' },
                    { role: 'user', content: prompt }
                ],
                stream: false
            });

            // Parse the response
            const content = response.data.message.content;
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            return null;
        } catch (error) {
            console.error('Error analyzing pattern:', error.message);
            return null;
        }
    }

    async processEvent(event) {
        console.log(`Processing event: ${event.type}`);

        // Analyze the event description
        const analysis = await this.analyzePattern(event.description, event.type);

        if (!analysis) {
            console.log('No analysis result for event');
            return null;
        }

        // Store as critical threat if level is Critical or High
        if (analysis.threatLevel === 'Critical' || analysis.threatLevel === 'High') {
            const threat = {
                id: event.id,
                timestamp: new Date().toISOString(),
                ...event,
                analysis: analysis
            };

            this.criticalThreats.unshift(threat);
            // Keep only last 100 critical threats
            this.criticalThreats = this.criticalThreats.slice(0, 100);

            // Update threat profile
            await this.updateThreatProfile(event, analysis);

            await this.saveData();
            console.log(`Stored critical threat: ${event.type}`);
        }

        return analysis;
    }

    async updateThreatProfile(event, analysis) {
        const profileKey = `${event.source}_${analysis.patternType}`;

        if (!this.threatProfiles[profileKey]) {
            this.threatProfiles[profileKey] = {
                source: event.source,
                patternType: analysis.patternType,
                firstSeen: event.date,
                lastSeen: event.date,
                eventCount: 0,
                totalConfidence: 0,
                locations: [],
                keyIndicators: []
            };
        }

        const profile = this.threatProfiles[profileKey];
        profile.lastSeen = event.date;
        profile.eventCount++;
        profile.totalConfidence += analysis.confidence;

        // Add location if not already present
        const locationKey = `${event.lat.toFixed(2)},${event.lon.toFixed(2)}`;
        if (!profile.locations.includes(locationKey)) {
            profile.locations.push(locationKey);
        }

        // Add key indicators
        analysis.indicators.forEach(indicator => {
            if (!profile.keyIndicators.includes(indicator)) {
                profile.keyIndicators.push(indicator);
            }
        });

        // Update average confidence
        profile.avgConfidence = profile.totalConfidence / profile.eventCount;
    }

    async fetchAndAnalyze() {
        try {
            console.log('Fetching new events from Conflict Globe...');
            const response = await axios.get(CONFLICT_GLOBE_API, { timeout: 15000 });
            const events = response.data.events || [];

            console.log(`Found ${events.length} events`);

            // Process each event
            for (const event of events) {
                // Skip if already processed (check by ID and timestamp)
                const exists = this.criticalThreats.find(t => t.id === event.id);
                if (exists) continue;

                await this.processEvent(event);
                // Small delay to avoid overwhelming Ollama
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            return events.length;
        } catch (error) {
            console.error('Error fetching and analyzing:', error.message);
            return 0;
        }
    }

    async generateReport() {
        const report = {
            id: `report-${Date.now()}`,
            timestamp: new Date().toISOString(),
            summary: {
                totalEvents: this.criticalThreats.length,
                criticalCount: this.criticalThreats.filter(t => t.analysis?.threatLevel === 'Critical').length,
                highCount: this.criticalThreats.filter(t => t.analysis?.threatLevel === 'High').length,
                profileCount: Object.keys(this.threatProfiles).length
            },
            topThreats: [],
            patternAnalysis: {},
            recommendations: []
        };

        // Get top 5 critical threats
        report.topThreats = this.criticalThreats.slice(0, 5).map(t => ({
            type: t.type,
            location: `${t.lat.toFixed(2)}, ${t.lon.toFixed(2)}`,
            threatLevel: t.analysis?.threatLevel,
            patternType: t.analysis?.patternType
        }));

        // Analyze patterns
        const patternCounts = {};
        this.criticalThreats.forEach(t => {
            const pattern = t.analysis?.patternType || 'Unknown';
            patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
        });
        report.patternAnalysis = patternCounts;

        // Generate recommendations based on patterns
        if (patternCounts['Military Mobilization'] > 3) {
            report.recommendations.push('Monitor military movements closely');
        }
        if (patternCounts['Energy Crisis'] > 2) {
            report.recommendations.push('Assess energy infrastructure vulnerabilities');
        }
        if (patternCounts['Terrorist Activity'] > 2) {
            report.recommendations.push('Review security protocols for high-risk areas');
        }

        this.reports.unshift(report);
        this.reports = this.reports.slice(0, 50); // Keep last 50 reports
        await this.saveData();

        return report;
    }

    getCriticalThreats(limit = 10) {
        return this.criticalThreats.slice(0, limit);
    }

    getThreatProfiles() {
        return Object.values(this.threatProfiles);
    }
}

module.exports = ThreatAnalyzer;
