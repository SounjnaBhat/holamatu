// packages/core/src/understanding/router.ts

export type ScriptType = 'KANNADA_SCRIPT' | 'CODE_MIXED' | 'LATIN_EN' | 'LATIN_ROMANIZED';

export interface RoutedUtterance {
    raw: string;
    normalized: string;
    script: ScriptType;
}

// Simple rule-based transliteration from Romanized Kannada to Kannada Script
// (In a real app, this would be a full transliteration library like indic-transliteration)
const TRANSLITERATION_MAP: Record<string, string> = {
    'neeru': 'ನೀರು',
    'hakbeka': 'ಹಾಕಬೇಕಾ',
    'bisi': 'ಬಿಸಿ',
    'ide': 'ಇದೆ',
    'hege': 'ಹೇಗೆ',
    'madodu': 'ಮಾಡೋದು',
    'faw': 'ಫಾಲ್ ಆರ್ಮಿವರ್ಮ್',
    'urea': 'ಯೂರಿಯಾ'
};

export class UtteranceRouter {
    /**
     * Normalizes and routes the utterance to the correct script.
     * Applies transliteration if the script is Romanized Kannada.
     */
    public route(input: string): RoutedUtterance {
        // 1. NFC Normalize
        const nfc = input.normalize('NFC');
        
        // 2. Count Kannada characters (U+0C80 - U+0CFF)
        const kannadaCharCount = (nfc.match(/[\u0C80-\u0CFF]/g) || []).length;
        const totalChars = nfc.replace(/\s+/g, '').length;
        const ratio = totalChars === 0 ? 0 : kannadaCharCount / totalChars;
        
        let script: ScriptType;
        let normalized = nfc;
        
        if (ratio > 0.5) {
            script = 'KANNADA_SCRIPT';
        } else if (ratio > 0 && ratio <= 0.5) {
            script = 'CODE_MIXED';
        } else {
            // ratio == 0, so it's Latin.
            // 3. We use a simple heuristic to classify EN vs ROMANIZED.
            // (In production, this is a char n-gram logistic regression)
            const romanizedKeywords = ['beku', 'ide', 'hege', 'madodu', 'neeru', 'bisi'];
            const isRomanized = romanizedKeywords.some(kw => nfc.toLowerCase().includes(kw));
            
            script = isRomanized ? 'LATIN_ROMANIZED' : 'LATIN_EN';
            
            // 4. Transliterate if Romanized
            if (script === 'LATIN_ROMANIZED') {
                normalized = this.transliterate(nfc);
            }
        }
        
        return {
            raw: input,
            normalized,
            script
        };
    }

    private transliterate(text: string): string {
        let result = text.toLowerCase();
        // Simple word-boundary replacement for demonstration
        for (const [roman, kannada] of Object.entries(TRANSLITERATION_MAP)) {
            const regex = new RegExp(`\\b${roman}\\b`, 'gi');
            result = result.replace(regex, kannada);
        }
        return result;
    }
}
