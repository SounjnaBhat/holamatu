import { describe, it, expect } from 'vitest';
import { NLUInferenceEngine } from '../src/nlu/inference';
import { NullNLUPort } from '../src/network/ports';

describe('NLUInferenceEngine', () => {
    it('should correctly fallback to mock inference and predict known intents', async () => {
        const engine = new NLUInferenceEngine(new NullNLUPort());
        
        // Ensure mock is triggered
        const frame = await engine.predict('Should I irrigate my field today?');
        
        expect(frame.intent).toBe('irrigation_advice');
        expect(frame.intentConfidence).toBeGreaterThan(0.9);
        expect(frame.lang).toBe('en');
    });

    it('predicts FAW intent correctly', async () => {
        const engine = new NLUInferenceEngine(new NullNLUPort());
        const frame = await engine.predict('faw control madodu hege');
        expect(frame.intent).toBe('pest_management');
    });

    it('predicts fertilizer intent correctly', async () => {
        const engine = new NLUInferenceEngine(new NullNLUPort());
        const frame = await engine.predict('how much urea for maize at 30 days');
        expect(frame.intent).toBe('fertilizer_dose');
    });
});
