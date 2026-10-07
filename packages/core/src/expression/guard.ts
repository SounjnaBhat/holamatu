import type { Advisory } from '../contracts/types';

const CHEMICAL_WHITELIST = ['emamectin benzoate', 'spinetoram', 'chlorantraniliprole'];

export function runGuard(generatedText: string, advisory: Advisory | null, cardText: string | null): boolean {
    const textLower = generatedText.toLowerCase();

    // 1. Chemical Whitelist Guard (G4)
    // If the text mentions ANY chemical, it MUST be in the whitelist
    const mentionsChemical = textLower.includes('chemical') || textLower.includes('pesticide') || textLower.includes('insecticide');
    if (mentionsChemical) {
        let whitelisted = false;
        for (const chem of CHEMICAL_WHITELIST) {
            if (textLower.includes(chem)) whitelisted = true;
        }
        if (!whitelisted) {
            console.warn("Guard failed: Mentioned chemical but no whitelisted chemical found.");
            return false;
        }
    }

    // 2. Numeric Grounding Guard
    // Extract numbers from generated text and ensure they exist in Advisory or Card
    const numbers = generatedText.match(/\d+(\.\d+)?/g);
    if (numbers) {
        const sourceData = JSON.stringify(advisory) + (cardText || '');
        for (const num of numbers) {
            if (!sourceData.includes(num)) {
                console.warn(`Guard failed: Hallucinated number ${num} not found in source facts.`);
                return false;
            }
        }
    }

    return true;
}
