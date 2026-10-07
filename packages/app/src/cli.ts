import { MaizeAdvisorCore } from '../../core/src/index';
import { MockGeminiPort } from '../../core/src/network/ports';

async function runCLI() {
    const args = process.argv.slice(2);
    const query = args.join(' ');
    
    if (!query) {
        console.error("Please provide a question. Example: npm run ask 'how much water needed'");
        process.exit(1);
    }

    const core = new MaizeAdvisorCore({
        generationEnabled: false,
        generationPort: new MockGeminiPort()
    });
    await core.initialize();

    const mockState = {
        sessionId: 'cli-session',
        turnIndex: 0,
        previousAdvisory: null,
        farmerId: 'f_001',
        location: 'DHARWAD',
        stage: 'V4',
        weatherFeatures: { dToday: 60, raw: 50, taw: 100, forecastRain72h: 0, stage: 'V4' }
    };

    console.log(`\nFarmer: ${query}`);
    const response = await core.processUtterance(query, mockState);
    console.log(`Advisor: ${response.text}\n`);
}

runCLI().catch(console.error);
