import { describe, it, expect } from 'vitest';
import { RuleEngine } from '../src/reasoning/rules';
import { irrigationRule } from '../src/reasoning/irrigation';
import { intentFrameFixture } from '../src/contracts/fixtures';

describe('Rule Engine & Irrigation Logic (T2.4 & T2.5)', () => {
    it('evaluates irrigation rule correctly (IRRIGATE)', () => {
        const engine = new RuleEngine();
        engine.registerRule(irrigationRule);
        
        const features = { dToday: 60, raw: 50, forecastRain72h: 0, stage: 'V4', location: 'DHARWAD', soil: 'red' };
        const adv = engine.evaluate(intentFrameFixture, features);
        
        expect(adv).not.toBeNull();
        expect(adv?.headline).toBe('IRRIGATE');
    });

    it('evaluates irrigation rule correctly (WAIT due to rain)', () => {
        const engine = new RuleEngine();
        engine.registerRule(irrigationRule);
        
        const features = { dToday: 60, raw: 50, taw: 100, forecastRain72h: 25, stage: 'V4', location: 'DHARWAD', soil: 'red' };
        const adv = engine.evaluate(intentFrameFixture, features);
        
        expect(adv?.headline).toBe('WAIT');
    });

    it('evaluates irrigation rule correctly (IRRIGATE early for critical stage)', () => {
        const engine = new RuleEngine();
        engine.registerRule(irrigationRule);
        
        const features = { dToday: 45, raw: 50, taw: 100, forecastRain72h: 0, stage: 'VT', location: 'DHARWAD', soil: 'red' };
        const adv = engine.evaluate(intentFrameFixture, features);
        
        expect(adv?.headline).toBe('IRRIGATE'); // 45 >= 40 (0.8*50)
    });
});
