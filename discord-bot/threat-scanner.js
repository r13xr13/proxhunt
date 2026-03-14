const ThreatAnalyzer = require('./threat-analysis');

async function main() {
    console.log('Starting Threat Scanner...');
    const analyzer = new ThreatAnalyzer();
    await analyzer.init();

    // Run analysis immediately
    console.log('Running initial analysis...');
    const count = await analyzer.fetchAndAnalyze();
    console.log(`Analyzed ${count} events`);

    // Schedule continuous scanning every 30 minutes
    setInterval(async () => {
        console.log('Running scheduled analysis...');
        const count = await analyzer.fetchAndAnalyze();
        console.log(`Analyzed ${count} events`);
    }, 30 * 60 * 1000); // 30 minutes

    // Keep the process running
    process.stdin.resume();
}

main().catch(console.error);
