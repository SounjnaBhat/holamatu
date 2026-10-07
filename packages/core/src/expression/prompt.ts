import type { Advisory } from '../contracts/types';

export function buildParaphrasePrompt(
    advisory: Advisory | null, 
    cardText: string | null, 
    normalizedUtterance: string, 
    lastTwoTurns: string[], 
    targetLanguage: string
): string {
    // G13 Privacy: Strip PII from utterance (mocked simple regex for example)
    const sanitizedUtterance = normalizedUtterance.replace(/\b\d{10}\b/g, '[PHONE]');
    
    // Convert advisory to a strict JSON string
    const advisoryJson = advisory ? JSON.stringify({
        headline: advisory.headline,
        facts: advisory.facts.map(f => ({ label: f.label, value: f.value, unit: f.unit }))
    }, null, 2) : 'None';

    return `
You are a conversational agronomic advisor for maize farmers.
Target Language: ${targetLanguage}
User Input: "${sanitizedUtterance}"
Context (last 2 turns): ${lastTwoTurns.join(' | ')}

Strict Rules:
1. Rewrite the supplied facts below conversationally.
2. NEVER invent doses, numbers, or chemicals.
3. NEVER answer from your own knowledge.

Supplied Facts (Advisory):
${advisoryJson}

Knowledge Base Card Text:
${cardText || 'None'}

Output only the conversational response in ${targetLanguage}.
`;
}
