import { describe, it, expect } from 'vitest';
import { MaizeAdvisorCore } from '../src/index';

describe('Conversational Layer (Parts 1-3)', () => {
    it('rotates templates based on turn index (Part 1)', async () => {
        const core = new MaizeAdvisorCore();
        await core.initialize();
        
        const state1 = { sessionId: 's1', turnIndex: 0, farmerId: 'f1', location: 'DWD', stage: 'V4', weatherFeatures: { dToday: 60, raw: 50, forecastRain72h: 0 }, previousAdvisory: null };
        const state2 = { ...state1, turnIndex: 1 };
        
        const res1 = await core.processUtterance('how much water', state1);
        const res2 = await core.processUtterance('how much water', state2);
        
        expect(res1.text).not.toBe(res2.text);
        expect(res1.text).toMatch(/Irrigate/i);
        expect(res2.text).toMatch(/Irrigate/i);
    });

    it('answers meta-intents from previous advisory (Part 2)', async () => {
        const core = new MaizeAdvisorCore();
        await core.initialize();
        
        const state = { sessionId: 's1', turnIndex: 0, farmerId: 'f1', location: 'DWD', stage: 'V4', weatherFeatures: { dToday: 60, raw: 50, forecastRain72h: 0 }, previousAdvisory: null };
        
        // Trigger irrigation advisory
        await core.processUtterance('how much water', state);
        expect(state.previousAdvisory).not.toBeNull();
        
        // Ask why (should pull from facts)
        const whyRes = await core.processUtterance('why', state);
        expect(whyRes.text).toContain('Depletion is 60');
        
        // Challenge
        const sureRes = await core.processUtterance('are you sure', state);
        expect(sureRes.text).toContain('strictly on local agronomic models');
    });

    it('provides graceful refusal (Part 3)', async () => {
        const core = new MaizeAdvisorCore();
        await core.initialize();
        
        const state = { sessionId: 's1', turnIndex: 0, farmerId: 'f1', location: 'DWD', stage: 'V4', weatherFeatures: { dToday: 60, raw: 50, forecastRain72h: 0 }, previousAdvisory: null };
        
        // Utterance that gets matched as unknown
        const res = await core.processUtterance('who is the prime minister', state);
        expect(res.text).toContain('I can help you with irrigation planning, pest control');
    });
});
