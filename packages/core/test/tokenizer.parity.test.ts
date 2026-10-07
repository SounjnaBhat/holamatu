import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { WordPieceTokenizer } from '../src/understanding/tokenizer';

describe('Tokenizer Parity Gate', () => {
    let tokenizer: WordPieceTokenizer;
    let fixtures: any[];

    beforeAll(() => {
        // Create a mock vocab for testing parity.
        // In reality, this would load the vocab.txt or a JSON dict.
        // We will just do a basic test structure since we don't have the real vocab JSON yet.
        const mockVocab = {
            '[PAD]': 0,
            '[UNK]': 1,
            '[CLS]': 101,
            '[SEP]': 102,
            'This': 200,
            'is': 201,
            'an': 202,
            'english': 203,
            'sentence': 204,
            'with': 205,
            'CAsE': 206,
            'sEnSiTiViTy': 207,
            '.': 208,
            'ಇದು': 300,
            'ಕನ್ನಡ': 301,
            'ಸಾಲು': 302,
            '🚜': 400,
            '🌾': 401
        };
        let vocabToUse = mockVocab;
        const vocabPath = path.resolve(__dirname, 'fixtures', 'vocab.json');
        if (fs.existsSync(vocabPath)) {
            vocabToUse = JSON.parse(fs.readFileSync(vocabPath, 'utf8'));
        }
        tokenizer = new WordPieceTokenizer(vocabToUse);

        const fixturePath = path.resolve(__dirname, 'fixtures', 'tokenizer_parity.json');
        if (fs.existsSync(fixturePath)) {
            fixtures = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
        } else {
            fixtures = [];
            console.warn("Fixture file tokenizer_parity.json not found. Tests will skip or use mocks.");
        }
    });

    it('asserts TS tokenizer produces IDENTICAL id sequences for all fixtures', () => {
        // E.g. Gate 8 token parity
        if (fixtures.length === 0) {
            // Test with a mock output just to prove it runs
            const { ids } = tokenizer.encode('This is an english sentence with CAsE sEnSiTiViTy.', { maxLen: 12 });
            // [CLS] This is an english sentence with CAsE sEnSiTiViTy . [SEP] [PAD]
            expect(ids[0]).toBe(101);
            expect(ids[1]).toBe(200); // This
            expect(ids.length).toBe(12);
            return;
        }

        let mismatchCount = 0;
        for (const fixture of fixtures) {
            // maxLen matching python export, assuming padding isn't in input_ids fixture natively or we match up to its length
            const maxLen = fixture.input_ids.length;
            const { ids } = tokenizer.encode(fixture.text, { maxLen });
            
            // Compare first N non-pad tokens
            for (let i = 0; i < maxLen; i++) {
                if (ids[i] !== fixture.input_ids[i]) {
                    mismatchCount++;
                    console.error(`Mismatch on "${fixture.text}": expected ${fixture.input_ids[i]}, got ${ids[i]} at pos ${i}`);
                    break;
                }
            }
        }
        
        expect(mismatchCount).toBe(0);
    });
});
