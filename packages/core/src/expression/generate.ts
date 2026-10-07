import { buildParaphrasePrompt } from './prompt';
import { runGuard } from './guard';
import type { Advisory } from '../contracts/types';
import type { GenerationPort } from '../network/ports';

export async function generateParaphrase(
    port: GenerationPort,
    advisory: Advisory | null,
    cardText: string | null,
    normalizedUtterance: string,
    lastTwoTurns: string[],
    targetLanguage: string
): Promise<string | null> {
    const prompt = buildParaphrasePrompt(advisory, cardText, normalizedUtterance, lastTwoTurns, targetLanguage);
    
    try {
        // Enforce 4-second timeout per non-negotiable constraints
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        
        // Passing abort signal into standard fetch inside a port is ideal, 
        // but since our ports are mocked interfaces, we use Promise.race
        const timeoutPromise = new Promise<string>((_, reject) => {
            setTimeout(() => reject(new Error("Timeout")), 4000);
        });

        const generatedText = await Promise.race([
            port.generate(prompt),
            timeoutPromise
        ]);
        
        clearTimeout(timeoutId);

        if (!generatedText) return null;

        // Run non-negotiable numeric and chemical guards
        const isSafe = runGuard(generatedText, advisory, cardText);
        if (!isSafe) {
            return null; // Fallback to template
        }

        return generatedText;
    } catch (e) {
        console.warn("LLM Generation failed or timed out. Falling back to template.");
        return null;
    }
}
