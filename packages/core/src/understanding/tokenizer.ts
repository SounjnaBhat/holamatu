// packages/core/src/understanding/tokenizer.ts

export interface TokenizerOptions {
    maxLen?: number;
}

export interface EncodedOutput {
    ids: number[];
    mask: number[];
}

export class WordPieceTokenizer {
    private vocab: Map<string, number>;
    private unkTokenId: number;
    private clsTokenId: number;
    private sepTokenId: number;
    private padTokenId: number;
    private maxInputCharsPerWord = 100;

    constructor(vocabDict: Record<string, number>) {
        this.vocab = new Map(Object.entries(vocabDict));
        this.unkTokenId = this.vocab.get('[UNK]') ?? 100;
        this.clsTokenId = this.vocab.get('[CLS]') ?? 104;
        this.sepTokenId = this.vocab.get('[SEP]') ?? 105;
        this.padTokenId = this.vocab.get('[PAD]') ?? 0;
    }

    /**
     * Splits punctuation into separate tokens. 
     * E.g. "Hello, world!" -> ["Hello", ",", "world", "!"]
     */
    private basicTokenize(text: string): string[] {
        // Simple whitespace split + punctuation split
        // MuRIL is cased, so we don't lowercase.
        const tokens: string[] = [];
        let currentWord = "";
        
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            
            if (this.isWhitespace(char)) {
                if (currentWord.length > 0) {
                    tokens.push(currentWord);
                    currentWord = "";
                }
            } else if (this.isPunctuation(char)) {
                if (currentWord.length > 0) {
                    tokens.push(currentWord);
                    currentWord = "";
                }
                tokens.push(char);
            } else {
                currentWord += char;
            }
        }
        
        if (currentWord.length > 0) {
            tokens.push(currentWord);
        }
        
        return tokens;
    }

    private isWhitespace(char: string): boolean {
        return /\s/.test(char);
    }

    private isPunctuation(char: string): boolean {
        const cp = char.charCodeAt(0);
        if ((cp >= 33 && cp <= 47) || (cp >= 58 && cp <= 64) ||
            (cp >= 91 && cp <= 96) || (cp >= 123 && cp <= 126)) {
            return true;
        }
        // Additional unicode punctuation can be added here
        return false;
    }

    /**
     * WordPiece Tokenization: greedy longest-match-first
     */
    private wordPieceTokenize(tokens: string[]): string[] {
        const outputTokens: string[] = [];
        
        for (const token of tokens) {
            const chars = Array.from(token);
            if (chars.length > this.maxInputCharsPerWord) {
                outputTokens.push('[UNK]');
                continue;
            }

            let isBad = false;
            let start = 0;
            const subTokens: string[] = [];

            while (start < chars.length) {
                let end = chars.length;
                let curStr = "";
                
                while (start < end) {
                    const substr = chars.slice(start, end).join('');
                    if (start > 0) {
                        curStr = "##" + substr;
                    } else {
                        curStr = substr;
                    }
                    
                    if (this.vocab.has(curStr)) {
                        break;
                    }
                    end -= 1;
                }

                if (curStr === "" || start === end) {
                    isBad = true;
                    break;
                }
                
                subTokens.push(curStr);
                start = end;
            }

            if (isBad) {
                outputTokens.push('[UNK]');
            } else {
                outputTokens.push(...subTokens);
            }
        }
        
        return outputTokens;
    }

    private cleanText(text: string): string {
        let cleaned = "";
        for (const char of text) {
            if (char === '\t' || char === '\n' || char === '\r') {
                cleaned += char;
                continue;
            }
            // Strip control (Cc) and format (Cf) characters (e.g. ZWNJ \u200C)
            if (/\p{Cc}|\p{Cf}/u.test(char)) {
                continue;
            }
            cleaned += char;
        }
        return cleaned;
    }

    public encode(text: string, options: TokenizerOptions = {}): EncodedOutput {
        const maxLen = options.maxLen || 64;
        
        // 1. Clean Text (strip control chars)
        const cleanedText = this.cleanText(text);
        
        // 2. Basic Tokenization
        const basicTokens = this.basicTokenize(cleanedText);
        
        // 2. WordPiece Tokenization
        const wpTokens = this.wordPieceTokenize(basicTokens);
        
        // 3. Add special tokens [CLS] ... [SEP]
        const ids = [this.clsTokenId];
        for (const token of wpTokens) {
            if (ids.length >= maxLen - 1) break;
            ids.push(this.vocab.get(token) ?? this.unkTokenId);
        }
        ids.push(this.sepTokenId);
        
        // 4. Padding
        const mask = new Array(ids.length).fill(1);
        while (ids.length < maxLen) {
            ids.push(this.padTokenId);
            mask.push(0);
        }
        
        return { ids, mask };
    }
}
