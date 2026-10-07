import { describe, it, expect } from 'vitest';
import { RuleEngine } from '../src/reasoning/rules';
import { irrigationRule } from '../src/reasoning/irrigation';

// Mocking 50 scenarios with a loop for structural validation in M2
describe('End-to-End Scenarios (T2.10)', () => {
    const engine = new RuleEngine();
    engine.registerRule(irrigationRule);

    const scenarios = Array.from({ length: 50 }, (_, i) => ({
        id: `scenario_${i+1}`,
        intent: 'irrigation_advice',
        features: {
            dToday: 40 + (i % 20),
            raw: 50,
            taw: 100,
            forecastRain72h: (i % 5) * 10,
            stage: i % 2 === 0 ? 'V4' : 'VT',
            location: 'DHARWAD',
            soil: 'black'
        }
    }));

    it.each(scenarios)('scenario $id passes correctly', ({ intent, features }) => {
        const frame: any = { intent: intent };
        const adv = engine.evaluate(frame, features);
        expect(adv).not.toBeNull();
        if (features.dToday >= features.raw && features.forecastRain72h < 15) {
            expect(adv?.headline).toBe('IRRIGATE');
        } else if (features.forecastRain72h >= 15) {
            expect(adv?.headline).toBe('WAIT');
        } else if (features.dToday >= 0.8 * features.raw && features.stage === 'VT') {
            expect(adv?.headline).toBe('IRRIGATE');
        }
    });
});
