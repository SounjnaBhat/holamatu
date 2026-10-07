export * from './contracts/types';
import { NLUInferenceEngine } from './nlu/inference';
import { RuleEngine } from './reasoning/rules';
import { irrigationRule } from './reasoning/irrigation';
import { pestRule } from './reasoning/pest';
import { fertilizerRule } from './reasoning/fertilizer';
import { searchHybrid } from './retrieval/index';
import type { Advisory, IntentFrame } from './contracts/types';
import { renderAdvisoryTemplate } from './expression/templates';
import { generateParaphrase } from './expression/generate';
import { NullGenerationPort, NullNLUPort, type GenerationPort, type NLUPort } from './network/ports';

export interface AppState {
    sessionId: string;
    turnIndex: number;
    farmerId: string;
    location?: string;
    stage?: string;
    weatherFeatures: Record<string, any>;
    previousAdvisory: Advisory | null;
    pendingIntent?: string;
}

export interface CoreConfig {
    generationEnabled: boolean;
    generationPort: GenerationPort;
    nluPort: NLUPort;
}

export class MaizeAdvisorCore {
    private nlu: NLUInferenceEngine;
    private ruleEngine: RuleEngine;
    private config: CoreConfig;

    constructor(config?: Partial<CoreConfig>) {
        this.config = {
            generationEnabled: config?.generationEnabled ?? false,
            generationPort: config?.generationPort ?? new NullGenerationPort(),
            nluPort: config?.nluPort ?? new NullNLUPort()
        };
        this.nlu = new NLUInferenceEngine(this.config.nluPort);
        this.ruleEngine = new RuleEngine();
        this.ruleEngine.registerRule(irrigationRule);
        this.ruleEngine.registerRule(pestRule);
        this.ruleEngine.registerRule(fertilizerRule);
    }

    async initialize() {
        await this.nlu.initialize('mock_path.onnx');
    }

    async processUtterance(utterance: string, state: AppState): Promise<{ text: string; advisory: Advisory | null }> {
        // 1. UNDERSTANDING (NLU)
        const frame = await this.nlu.predict(utterance);

        // 3. OOD / Fallback Logic (T5.3)
        if (frame.intent === 'unknown' || frame.intentConfidence < 0.6) {
            return { text: "I can help you with irrigation planning, pest control (like Fall Armyworm), and fertilizer application. Would you like to ask about one of those?", advisory: null };
        }

        // 4. Handle info provisioning (Clarification responses)
        if (frame.intent === 'provide_info') {
            if (frame.slots['location']) state.location = frame.slots['location'].value as string;
            if (frame.slots['stage']) state.stage = frame.slots['stage'].value as string;
            if (frame.slots['soil']) state.weatherFeatures['soil'] = frame.slots['soil'].value;

            if (state.pendingIntent) {
                frame.intent = state.pendingIntent as any; // Resume pending goal
                state.pendingIntent = undefined; // Clear it
            } else {
                return { text: frame.lang === 'kn' ? "ಧನ್ಯವಾದಗಳು. ಈಗ ನಿಮ್ಮ ಪ್ರಶ್ನೆಯನ್ನು ಕೇಳಿ." : "Thanks for the information. What is your question?", advisory: null };
            }
        }

        // Handle meta-intents first
        if (frame.intent === 'greeting_smalltalk') {
            const isKnRequest = frame.normalized.includes('kannada') || frame.normalized.includes('ಕನ್ನಡ') || frame.lang === 'kn';
            return { text: isKnRequest ? 
                "ನಮಸ್ಕಾರ! ನೀವು ಕನ್ನಡದಲ್ಲಿಯೂ ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳಬಹುದು. ಮೆಕ್ಕೆಜೋಳದ ಕೀಟ, ರಸಗೊಬ್ಬರ, ಮತ್ತು ನೀರಿನ ನಿರ್ವಹಣೆ ಬಗ್ಗೆ ನಾನು ಸಹಾಯ ಮಾಡುತ್ತೇನೆ." : 
                "Hello! I can answer your questions in English or Kannada. Ask me about irrigation, pests, or fertilizers for your maize crop.", advisory: null };
        }
        if (frame.intent === 'explain_why' && state.previousAdvisory) {
            return { text: `You are advised to ${state.previousAdvisory.headline} because ${state.previousAdvisory.facts.map(f => `${f.label} is ${f.value}`).join(' and ')}.`, advisory: null };
        }
        if (frame.intent === 'alternative' && state.previousAdvisory) {
            const prevIntent = state.previousAdvisory.intent;
            if (prevIntent === 'pest_management') {
                return { text: `For an organic alternative, you can use Neem oil (10,000 ppm) at 2 ml/litre of water or apply Bacillus thuringiensis (Bt) formulation.`, advisory: null };
            } else if (prevIntent === 'fertilizer_dose') {
                return { text: `For an organic approach, you can substitute chemical fertilizers with Farm Yard Manure (FYM) or vermicompost, though it is best applied during field preparation rather than top-dressing.`, advisory: null };
            } else {
                return { text: `I'm sorry, based on the current weather and crop stage, ${state.previousAdvisory.headline} is the most scientifically sound action right now.`, advisory: null };
            }
        }
        if (frame.intent === 'challenge' && state.previousAdvisory) {
            return { text: `Yes, the advice to ${state.previousAdvisory.headline} is based strictly on local agronomic models and current data.`, advisory: null };
        }
        if (frame.intent === 'consequence' && state.previousAdvisory) {
            const prevIntent = state.previousAdvisory.intent;
            if (prevIntent === 'irrigation_advice') {
                return { text: `If it rains significantly (more than 10-15mm), the soil moisture will be replenished and you can delay irrigation by 3-4 days.`, advisory: null };
            } else if (prevIntent === 'pest_management') {
                return { text: `Heavy rains can wash away recently applied pesticides, reducing their effectiveness. Wait for a clear window before spraying.`, advisory: null };
            } else if (prevIntent === 'fertilizer_dose') {
                return { text: `Rain after applying urea is beneficial as it washes the fertilizer into the root zone. However, heavy downpours can cause leaching.`, advisory: null };
            } else {
                return { text: `Weather changes can impact the effectiveness of any field intervention. Always check the forecast.`, advisory: null };
            }
        }
        // Meta-intent without context — ask the user to start with a domain question first
        if (['explain_why', 'alternative', 'challenge', 'consequence'].includes(frame.intent) && !state.previousAdvisory) {
            return { text: "Could you first ask me a question about irrigation, pests, or fertilizer? Then I can explain my reasoning or suggest alternatives.", advisory: null };
        }

        // 2. REASONING (Rules + Retrieval)
        const combinedFeatures = { ...state.weatherFeatures, location: state.location, stage: state.stage };
        let advisory: Advisory | null = null;
        try {
            advisory = this.ruleEngine.evaluate(frame, combinedFeatures);
        } catch (e: any) {
            if (e.message?.startsWith('MISSING_FEATURE:')) {
                const missingKey = e.message.split(':')[1];
                state.pendingIntent = frame.intent; // Save the goal
                if (missingKey.includes('soil')) {
                    return { text: frame.lang === 'kn' ? "ನಿಮ್ಮ ಜಮೀನಿನಲ್ಲಿ ಯಾವ ರೀತಿಯ ಮಣ್ಣು ಇದೆ? (ಉದಾಹರಣೆಗೆ: ಕೆಂಪು ಮಣ್ಣು, ಕಪ್ಪು ಮಣ್ಣು)" : "What type of soil do you have in your field? (e.g., red soil, black soil)", advisory: null };
                }
                if (missingKey.includes('location')) {
                    return { text: frame.lang === 'kn' ? "ನಿಮ್ಮ ಜಮೀನು ಯಾವ ತಾಲೂಕು/ಜಿಲ್ಲೆಯಲ್ಲಿದೆ?" : "Which district or location is your field in?", advisory: null };
                }
                if (missingKey.includes('stage')) {
                    return { text: frame.lang === 'kn' ? "ಮೆಕ್ಕೆಜೋಳ ಬಿತ್ತನೆ ಮಾಡಿ ಎಷ್ಟು ದಿನಗಳಾಗಿವೆ?" : "How many days has it been since you planted the maize?", advisory: null };
                }
                return { text: frame.lang === 'kn' ? `ನನಗೆ ಹೆಚ್ಚಿನ ಮಾಹಿತಿ ಬೇಕು: ${missingKey}` : `I need more information about: ${missingKey}`, advisory: null };
            }
            throw e;
        }
        
        let response = "";
        if (advisory) {
            state.previousAdvisory = advisory;
            response = renderAdvisoryTemplate(advisory, state.sessionId, state.turnIndex, state.stage || 'V4', frame.lang);
            if (advisory.suggestedFollowUps && advisory.suggestedFollowUps.length > 0) {
                response += `\n\n---\n**Suggested Follow-ups:**\n${advisory.suggestedFollowUps.map(s => `- ${s}`).join('\n')}`;
            }
        } else {
            const docs = searchHybrid(utterance, [1,0,0,0]);
            if (docs.length > 0) {
                response = docs[0].text_en;
            } else {
                response = "I can help you with irrigation planning, pest control (like Fall Armyworm), and fertilizer application. Would you like to ask about one of those?";
            }
        }

        // T4: Grounded Paraphrase Integration
        if (this.config.generationEnabled) {
            const docs = !advisory ? searchHybrid(utterance, [1,0,0,0]) : [];
            const cardText = docs.length > 0 ? docs[0].text_en : null;
            const paraphrase = await generateParaphrase(
                this.config.generationPort,
                advisory,
                cardText,
                frame.normalized,
                [], // mock conversation history for now
                frame.lang
            );
            if (paraphrase) {
                response = paraphrase;
            }
        }

        return { text: response, advisory };
    }
}
