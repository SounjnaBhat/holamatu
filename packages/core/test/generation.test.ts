import { describe, it, expect } from 'vitest';
import { runGuard } from '../src/expression/guard';
import type { Advisory } from '../src/contracts/types';

describe('Generation Guard (Part 5)', () => {
    const advisoryFixture: Advisory = {
        intent: 'irrigation_advice',
        headline: 'IRRIGATE',
        facts: [{ label: 'Depletion', value: 60, unit: 'mm', source: 'FAO-56' }],
        confidence: 'HIGH',
        evidence: {},
        cautions: [],
        nextCheck: null,
        templateId: 't1'
    };

    it('passes safe generated text', () => {
        const text = "Your field has 60 mm of depletion, so please IRRIGATE.";
        expect(runGuard(text, advisoryFixture, null)).toBe(true);
    });

    it('blocks hallucinated numbers', () => {
        const text = "Your field has 80 mm of depletion, so please IRRIGATE.";
        // 80 is not in the source facts
        expect(runGuard(text, advisoryFixture, null)).toBe(false);
    });

    it('blocks unlisted chemicals', () => {
        const text = "Please apply some unlisted chemical pesticide.";
        // 'pesticide' triggers chemical check, but unlisted chemical
        expect(runGuard(text, advisoryFixture, null)).toBe(false);
    });

    it('allows whitelisted chemicals', () => {
        const text = "Please apply emamectin benzoate pesticide.";
        expect(runGuard(text, advisoryFixture, null)).toBe(true);
    });
});

import { generateParaphrase } from '../src/expression/generate';
import type { GenerationPort } from '../src/network/ports';

describe('Generation Provider (Part 5)', () => {
    const advisoryFixture: Advisory = {
        intent: 'irrigation_advice',
        headline: 'IRRIGATE',
        facts: [{ label: 'Depletion', value: 60, unit: 'mm', source: 'FAO-56' }],
        confidence: 'HIGH',
        evidence: {},
        cautions: [],
        nextCheck: null,
        templateId: 't1'
    };

    it('falls back to null (template) on timeout', async () => {
        const slowPort: GenerationPort = {
            generate: async () => new Promise(resolve => setTimeout(() => resolve("Too slow"), 5000))
        };
        const result = await generateParaphrase(slowPort, advisoryFixture, null, "water", [], "English");
        expect(result).toBeNull();
    });

    it('falls back to null (template) on provider error', async () => {
        const errorPort: GenerationPort = {
            generate: async () => { throw new Error("500 Internal Server Error"); }
        };
        const result = await generateParaphrase(errorPort, advisoryFixture, null, "water", [], "English");
        expect(result).toBeNull();
    });
});
