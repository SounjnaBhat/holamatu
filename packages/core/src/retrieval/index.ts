/**
 * T3.7 Hybrid Retrieval Engine (BM25 + Cosine)
 * A pure TS implementation over kb.json
 */
import kb from './kb.json';

export interface RetrievalResult {
    id: string;
    score: number;
    text_en: string;
}

// Simple cosine similarity for testing
function cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
    }
    return dot / (Math.sqrt(magA) * Math.sqrt(magB) + 1e-9);
}

// Very basic TF-IDF/BM25 mock for lexical match
function lexicalScore(query: string, text: string): number {
    const qWords = query.toLowerCase().split(/\s+/);
    const tWords = text.toLowerCase().split(/\s+/);
    let matchCount = 0;
    for (const qw of qWords) {
        if (tWords.includes(qw)) matchCount++;
    }
    return matchCount / (qWords.length + 0.1);
}

export function searchHybrid(query: string, queryEmbedding: number[]): RetrievalResult[] {
    const results = kb.map(card => {
        const dense = cosineSimilarity(queryEmbedding, card.embedding);
        const lexical = lexicalScore(query, card.text_en);
        
        // Reciprocal rank fusion proxy (linear blend for mock)
        const score = (dense * 0.5) + (lexical * 0.5);
        return { id: card.id, score, text_en: card.text_en };
    });
    
    results.sort((a, b) => b.score - a.score);
    return results;
}
