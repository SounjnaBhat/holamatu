import { describe, it, expect } from 'vitest';
import { UtteranceRouter } from '../src/understanding/router';

describe('Script Routing (Task 3)', () => {
    const router = new UtteranceRouter();

    it('routes romanized Kannada correctly', () => {
        const res = router.route('bisi ide, neeru hakbeka?');
        expect(res.script).toBe('LATIN_ROMANIZED');
        // Check transliteration
        expect(res.normalized).toContain('ಬಿಸಿ');
        expect(res.normalized).toContain('ಇದೆ');
        expect(res.normalized).toContain('ನೀರು');
    });

    it('routes pure English correctly', () => {
        const res = router.route('how much urea for maize');
        expect(res.script).toBe('LATIN_EN');
        expect(res.normalized).toBe('how much urea for maize'); // No transliteration
    });

    it('routes pure Kannada correctly', () => {
        const res = router.route('ನೀರು ಹಾಕಬೇಕಾ?');
        expect(res.script).toBe('KANNADA_SCRIPT');
    });

    it('routes code-mixed correctly', () => {
        const res = router.route('give me fertilizer for ಮೆಕ್ಕೆಜೋಳ');
        expect(res.script).toBe('CODE_MIXED');
    });
});
