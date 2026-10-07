import { describe, it, expect, beforeAll } from 'vitest';
import { searchHybrid } from '../src/retrieval/index';
import * as fs from 'fs';
import * as path from 'path';

// Make sure kb.json exists before testing
beforeAll(() => {
    const kbPath = path.join(__dirname, '..', 'src', 'retrieval', 'kb.json');
    if (!fs.existsSync(kbPath)) {
        fs.writeFileSync(kbPath, JSON.stringify([
            { id: 'faw_01', text_en: 'fall armyworm control', embedding: [1, 0, 0, 0] },
            { id: 'irrigation_01', text_en: 'irrigation requirement', embedding: [0, 1, 0, 0] }
        ]));
    }
});

describe('Hybrid Retrieval (T3.7)', () => {
    it('retrieves correct card based on lexical and dense score', () => {
        const res = searchHybrid('fall armyworm', [0.9, 0, 0, 0]);
        expect(res.length).toBeGreaterThan(0);
        expect(res[0].id).toBe('faw_01');
    });
});
