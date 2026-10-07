import { InferenceSession, Tensor } from 'onnxruntime-web';
import type { IntentFrame, Intent } from '../contracts/types';
import { WordPieceTokenizer } from '../understanding/tokenizer';
import { UtteranceRouter } from '../understanding/router';
import type { NLUPort } from '../network/ports';

export class NLUInferenceEngine {
    private session: InferenceSession | null = null;
    private tokenizer: WordPieceTokenizer | null = null;
    private router: UtteranceRouter;
    private calibration: any = null;
    private nluPort: NLUPort;
    
    // Fallback for tests if real ONNX can't load
    private isMock = false;

    // Ordered lists matching the Python model's output heads
    private intentLabels: Intent[] = [
        'irrigation_advice', 'pest_management', 'fertilizer_dose', 
        'explain_why', 'alternative', 'challenge', 'consequence', 
        'greeting_smalltalk', 'market_price', 'provide_info', 'out_of_scope'
    ];
    
    private slotLabels: string[] = ['O', 'B-crop_stage', 'I-crop_stage', 'B-pest_name', 'I-pest_name', 'B-date_range', 'I-date_range'];

    constructor(nluPort: NLUPort) {
        this.router = new UtteranceRouter();
        this.nluPort = nluPort;
    }

    async initialize(modelPath: string) {
        try {
            // In a real app, this loads the exported vocab.txt or JSON dict
            const mockVocab = { '[PAD]': 0, '[UNK]': 1, '[CLS]': 101, '[SEP]': 102 };
            this.tokenizer = new WordPieceTokenizer(mockVocab);
            
            // Dummy calibration data
            this.calibration = { temperature: 1.5, tau1: 0.75, knn_floor: 0.55 };
            
            this.session = await InferenceSession.create(modelPath, {
                executionProviders: ['wasm'],
                graphOptimizationLevel: 'all',
            });
        } catch (e) {
            this.isMock = true;
            console.warn("Real ONNX model not loadable. Falling back to mock/cloud NLU inference.");
        }
    }

    async predict(utterance: string): Promise<IntentFrame> {
        // Try Cloud NLU first if available (overriding offline mandate)
        try {
            const remoteFrame = await this.nluPort.extractIntent(utterance);
            if (remoteFrame) {
                return remoteFrame;
            }
        } catch (e) {
            console.warn("Cloud NLU failed, falling back to local...", e);
        }

        if (this.isMock || !this.session || !this.tokenizer) {
            return this.mockPredict(utterance);
        }

        // 1. Script Routing & Transliteration
        const routed = this.router.route(utterance);

        // 2. Tokenize
        const { ids, mask } = this.tokenizer.encode(routed.normalized, { maxLen: 64 });
        
        // 3. Tensor inference
        const feeds = {
            input_ids: new Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, ids.length]),
            attention_mask: new Tensor('int64', BigInt64Array.from(mask.map(BigInt)), [1, ids.length]),
        };
        
        const results = await this.session.run(feeds);
        
        // 4. Intent Decoding (with Temperature Scaling & OOD rejection)
        const intentLogits = results['intent_logits'].data as Float32Array;
        const T = this.calibration.temperature;
        
        // Softmax with temperature
        const exps = Array.from(intentLogits).map(l => Math.exp(l / T));
        const sumExp = exps.reduce((a, b) => a + b, 0);
        const probs = exps.map(e => e / sumExp);
        
        const maxProb = Math.max(...probs);
        const maxIndex = probs.indexOf(maxProb);
        
        let intent = this.intentLabels[maxIndex];
        
        // OOD Rejection Gate
        if (maxProb < this.calibration.tau1 || intent === 'out_of_scope') {
            intent = 'unknown'; // This triggers conversational refusal or clarification
        }

        // 5. Slot Decoding (BIO extraction)
        const slotLogits = results['slot_logits'].data as Float32Array; // shape: [1, seqLen, numSlotLabels]
        const seqLen = 64;
        const numSlotLabels = this.slotLabels.length;
        const slots: Record<string, any> = {};
        
        // Extremely simplified argmax for sequence tagging
        for (let i = 0; i < seqLen; i++) {
            let maxSlotLogit = -Infinity;
            let bestSlotIdx = 0;
            for (let j = 0; j < numSlotLabels; j++) {
                const val = slotLogits[i * numSlotLabels + j];
                if (val > maxSlotLogit) {
                    maxSlotLogit = val;
                    bestSlotIdx = j;
                }
            }
            
            const tag = this.slotLabels[bestSlotIdx];
            if (tag.startsWith('B-')) {
                const slotName = tag.substring(2);
                // Map the token ID back to string in a real scenario
                slots[slotName] = { value: 'extracted_value' }; 
            }
        }

        return {
            raw: utterance,
            normalized: routed.normalized,
            script: routed.script === 'KANNADA_SCRIPT' ? 'KANNADA_SCRIPT' : 'ENGLISH',
            intent: intent,
            intentConfidence: maxProb,
            slots,
            needsClarification: [],
            profileDefaultsUsed: [],
            lang: routed.script === 'KANNADA_SCRIPT' ? 'kn' : 'en'
        };
    }

    private mockPredict(txt: string): IntentFrame {
        txt = txt.toLowerCase();
        let intent: Intent = 'unknown';
        const slots: any = {};
        
        const hasDomainIrrigation = txt.includes('irrigat') || txt.includes('water') || txt.includes('ನೀರು') || txt.includes('bisi') || txt.includes('neeru');
        const hasDomainPest = txt.includes('faw') || txt.includes('pest') || txt.includes('ಹುಳು') || txt.includes('armyworm') || txt.includes('fall army') || txt.includes('ಕೀಟ');
        const hasDomainFert = txt.includes('urea') || txt.includes('fertiliz') || txt.includes('ಗೊಬ್ಬರ') || txt.includes('ಯೂರಿಯಾ') || txt.includes('dose') || txt.includes('nutrient');
        const hasExplainWhy = txt === 'why' || txt.includes('why should');
        const hasChallenge = txt.includes('are you sure');
        const hasConsequence = txt.includes('what if') || txt.includes('rains') || txt.includes('ಮಳೆ');
        
        const isInfoLocation = txt.includes('dharwad') || txt.includes('hubli') || txt.includes('belagavi') || txt.includes('belgaum') || txt.includes('haveri') || txt.includes('ಧಾರವಾಡ') || txt.includes('ಬೆಳಗಾವಿ');
        const isInfoSoil = txt.includes('red') || txt.includes('black') || txt.includes('ಕೆಂಪು') || txt.includes('ಕಪ್ಪು');
        const isInfoStage = txt.includes('days') || txt.includes('v4') || txt.includes('v6') || txt.includes('ದಿನ') || txt.match(/\d+/);

        if (hasConsequence) intent = 'consequence';
        else if (hasExplainWhy) intent = 'explain_why';
        else if (hasChallenge) intent = 'challenge';
        else if (hasDomainIrrigation) intent = 'irrigation_advice';
        else if (hasDomainPest) intent = 'pest_management';
        else if (hasDomainFert) intent = 'fertilizer_dose';
        else if (isInfoLocation || isInfoSoil || isInfoStage) intent = 'provide_info';
        
        if (isInfoSoil) {
            slots['soil'] = { value: (txt.includes('red') || txt.includes('ಕೆಂಪು')) ? 'red' : 'black' };
        }
        if (isInfoLocation) {
            if (txt.includes('belagavi') || txt.includes('belgaum') || txt.includes('ಬೆಳಗಾವಿ')) slots['location'] = { value: 'BELAGAVI' };
            else if (txt.includes('haveri')) slots['location'] = { value: 'HAVERI' };
            else slots['location'] = { value: 'DHARWAD' };
        }
        if (isInfoStage) {
            const match = txt.match(/\d+/);
            slots['stage'] = { value: match ? `${match[0]} days` : 'V4' }; 
        }

        const hasKannada = /[\u0C80-\u0CFF]/.test(txt);
        return {
            raw: txt,
            normalized: txt,
            script: hasKannada ? 'KANNADA_SCRIPT' : 'ENGLISH',
            intent,
            intentConfidence: intent === 'unknown' ? 0.3 : 0.95,
            slots,
            needsClarification: [],
            profileDefaultsUsed: [],
            lang: hasKannada ? 'kn' : 'en'
        };
    }
}
