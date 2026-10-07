export interface GenerationPort {
    generate(prompt: string): Promise<string>;
}

export class NullGenerationPort implements GenerationPort {
    async generate(prompt: string): Promise<string> {
        throw new Error("Null generation port invoked. Network disabled.");
    }
}

export interface NLUPort {
    extractIntent(utterance: string): Promise<any>;
}

export class NullNLUPort implements NLUPort {
    async extractIntent(utterance: string): Promise<any> {
        return null;
    }
}

export class MockGeminiPort implements GenerationPort {
    async generate(prompt: string): Promise<string> {
        // Mock successful LLM generation by parsing the prompt's JSON slightly
        const isIrrigation = prompt.includes('IRRIGATE');
        const isPest = prompt.includes('APPLY') && prompt.includes('Pest Name');
        const isFertilizer = prompt.includes('APPLY') && prompt.includes('Recommended Dose');
        const isKannada = prompt.includes('Target Language: kn');
        
        if (isIrrigation) {
            if (isKannada) return "ನಮಸ್ಕಾರ!\nನಿಮ್ಮ ಹೊಲದಲ್ಲಿ ನೀರಿನ ಕೊರತೆ ಇದೆ. ಮುಂದಿನ 72 ಗಂಟೆಗಳಲ್ಲಿ ಮಳೆಯ ಮುನ್ಸೂಚನೆ ಇಲ್ಲದ ಕಾರಣ, ತಕ್ಷಣ ನೀರು ಹಾಯಿಸುವುದು ಉತ್ತಮ.";
            return "Hey there!\nI see your field's moisture is getting a bit low. Since we aren't expecting rain in the next 72 hours, I'd strongly suggest you go ahead and irrigate to replenish that deficit. Let me know if you need help planning the schedule!";
        } else if (isPest) {
            if (isKannada) return "ನಮಸ್ಕಾರ!\nಫಾಲ್ ಆರ್ಮಿವರ್ಮ್ ಹಾನಿ ಮಿತಿಯನ್ನು ಮೀರಿದೆ. ನಿಯಂತ್ರಣಕ್ಕಾಗಿ ಎಮಾಮೆಕ್ಟಿನ್ ಬೆಂಜೊಯೇಟ್ ಬಳಸಿ. ಸಿಂಪಡಿಸುವಾಗ ಸುರಕ್ಷತಾ ಸಾಧನಗಳನ್ನು ಬಳಸಿ!";
            return "Hello!\nIt looks like Fall Armyworm damage is above the safe threshold in your area right now. For effective control, you should apply Emamectin benzoate. Please remember to wear your protective gear!";
        } else if (isFertilizer) {
            if (isKannada) return "ನಮಸ್ಕಾರ!\nನಿಮ್ಮ ಬೆಳೆ ಈಗ V4 ಹಂತದಲ್ಲಿದೆ. ಒಂದು ಎಕರೆಗೆ 25 ಕೆಜಿ ಯೂರಿಯಾ ಕೊಡುವುದು ಬಹಳ ಒಳ್ಳೆಯದು. ಗೊಬ್ಬರ ಹಾಕುವಾಗ ಮಣ್ಣಿನಲ್ಲಿ ತೇವಾಂಶ ಇರಲಿ.";
            return "Hi!\nSince your crop is at the V4 stage, now is the perfect time for a top-dressing. Applying 25 kg/acre of Urea will really help boost growth in your soil type. Do you have any questions about mixing it?";
        }
        
        return isKannada ? "ಇದು ಕೃತಕ ಬುದ್ಧಿಮತ್ತೆಯಿಂದ ರಚಿಸಲಾದ ಪ್ರತಿಕ್ರಿಯೆ!" : "I am a dynamically generated response based on your facts!";
    }
}

export class MockSarvamPort implements GenerationPort {
    async generate(prompt: string): Promise<string> {
        return "ಇದು ಸರ್ವಮ್ ಮಾದರಿಯಿಂದ ರಚಿಸಲಾದ ಕೃತಕ ಪ್ರತಿಕ್ರಿಯೆ.";
    }
}
