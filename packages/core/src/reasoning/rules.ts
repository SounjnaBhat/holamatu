// @ts-ignore
import * as yaml from 'js-yaml';
import { KNOWLEDGE } from '../knowledge_compiled';
import { CropStage, calculatePhenology } from './phenology';
import { updateWaterBalance, calculateHargreavesET0, calculateDrySpell, calculateHeatStress } from './features';
import type { IntentFrame, Advisory } from '../contracts/types';

export interface RuleContext {
    intent: string;
    stage: CropStage;
    depletion: number; // mm
    taw: number; // mm
    mad_p: number; // fraction
    forecastRain72h: number; // mm
    pestObserved?: string;
    infestationLevel?: number;
    daysSinceSowing?: number;
}

export interface RuleAction {
    advise: 'IRRIGATE' | 'WAIT' | 'SCOUT' | 'APPLY_CHEMICAL' | 'OUT_OF_SCOPE' | 'APPLY_FERTILIZER' | 'SOW';
    ruleId: string;
    reason: string;
    source: string;
}

export interface Rule {
    id: string;
    intent: string;
    type?: string;
    priority?: number;
    evaluate?: (frame: any, features: any) => boolean;
    generateAdvisory?: (frame: any, features: any) => Advisory;
    stage?: string[];
    threshold?: number;
    action?: RuleAction;
}

export interface Rulepack {
    name: string;
    rules: Rule[];
}

export class RuleEngine {
    private rulepacks: Rulepack[] = [];

    constructor() {
        // Automatically load YAML rulepacks for the 4 scoped intents from compiled knowledge
        if (KNOWLEDGE.rulepacks) {
            if (KNOWLEDGE.rulepacks.irrigation) this.rulepacks.push(KNOWLEDGE.rulepacks.irrigation as Rulepack);
            if (KNOWLEDGE.rulepacks.pest_faw) this.rulepacks.push(KNOWLEDGE.rulepacks.pest_faw as Rulepack);
            if (KNOWLEDGE.rulepacks.fertilizer_n) this.rulepacks.push(KNOWLEDGE.rulepacks.fertilizer_n as Rulepack);
            if (KNOWLEDGE.rulepacks.sowing) this.rulepacks.push(KNOWLEDGE.rulepacks.sowing as Rulepack);
        }
    }
    
    // Kept for interface compatibility with index.ts (which passes rule objects)
    // We will just ignore legacy TS rules since we're replacing them with YAML rulepacks.
    registerRule(rule: any) {
        // Legacy support ignored.
    }

    /** Map farmer-provided stage descriptions to CropStage */
    private mapStageString(stageStr: string | undefined): CropStage {
        if (!stageStr) return 'vegetative';
        const s = stageStr.toLowerCase();
        if (s.includes('sow') || s.includes('seed') || s.includes('planted')) return 'sowing';
        if (s === 'vt' || s.includes('vt') || s.includes('flower') || s.includes('tassel') || s.includes('silk')) return 'flowering';
        if (s.includes('grain') || s.includes('cob') || s.includes('yield')) return 'yield_formation';
        if (s.includes('ripe') || s.includes('mature') || s.includes('dry') || s.includes('harvest')) return 'ripening';
        // Try to parse days-after-sowing
        const daysMatch = s.match(/(\d+)\s*(?:days?|d)/);
        if (daysMatch) {
            const days = parseInt(daysMatch[1], 10);
            if (days < 15) return 'sowing';
            if (days < 55) return 'vegetative';
            if (days < 75) return 'flowering';
            if (days < 100) return 'yield_formation';
            return 'ripening';
        }
        // V-stage notation (V4, V8, etc.)
        if (/^v\d+/i.test(s)) return 'vegetative';
        if (/^r\d+/i.test(s)) return s.startsWith('r1') || s.startsWith('R1') ? 'flowering' : 'yield_formation';
        return 'vegetative';
    }

    evaluate(frame: IntentFrame, features: any): Advisory {
        // Check for required farmer context before reasoning
        // The intent determines which features are needed
        const needsLocation = ['irrigation_advice', 'pest_management', 'fertilizer_dose', 'sowing_window'].includes(frame.intent);
        const needsStage = ['irrigation_advice', 'fertilizer_dose'].includes(frame.intent);

        if (needsLocation && !features.location) {
            throw new Error('MISSING_FEATURE:location');
        }
        if (needsStage && !features.stage) {
            throw new Error('MISSING_FEATURE:stage');
        }

        // Build agronomic context from features
        const taw = 100; // mm, placeholder for medium-depth black soil
        const mad_p = 0.55; // FAO-56 default for maize

        const stage: CropStage = this.mapStageString(features.stage);
        const forecastRain72h = features.forecastRain72h || 0;

        // Compute realistic depletion from stage-specific crop water demand
        // Dharwad kharif averages: Tmax ~29°C, Tmin ~21°C, lat ~15.4°N
        const avgET0 = calculateHargreavesET0(29, 21, 15.4); // ~3.5 mm/day
        const kcByStage: Record<CropStage, number> = {
            sowing: 0.30,
            vegetative: 0.70,
            flowering: 1.20,
            yield_formation: 1.10,
            ripening: 0.35
        };
        const kc = kcByStage[stage];
        const dailyETc = avgET0 * kc; // crop evapotranspiration mm/day

        // Estimate days since last significant rain (assume 3-5 days in monsoon)
        const daysSinceRain = forecastRain72h > 10 ? 1 : 4;
        const currentDepletion = features.dToday !== undefined ? features.dToday : Math.min(dailyETc * daysSinceRain, taw);

        const context: RuleContext = {
            intent: frame.intent,
            stage: stage,
            depletion: currentDepletion,
            taw: features.taw || taw,
            mad_p: mad_p,
            forecastRain72h: forecastRain72h,
            pestObserved: frame.slots?.['pest']?.value as string | undefined,
            infestationLevel: 15 // Mock ETL — real value needs field scouting input
        };

        let finalAction: RuleAction | null = null;
        for (const rulepack of this.rulepacks) {
            const action = this.evaluateRules(context, rulepack);
            if (action && action.advise !== 'OUT_OF_SCOPE') {
                finalAction = action;
                break;
            }
        }

        if (!finalAction) {
            return {
                intent: frame.intent as any,
                headline: 'INFORM' as any,
                facts: [],
                confidence: 'DATA_INSUFFICIENT',
                evidence: { ruleIds: [] },
                cautions: ['No agronomic rule matched the current context.'],
                nextCheck: null,
                templateId: 'fallback',
                suggestedFollowUps: [],
                traceability: {
                    rule_id: 'fallback',
                    rule_version: '1.2.0',
                    source: 'packages/core/src/reasoning/rules.ts'
                }
            };
        }

        // Build facts that match what templates.ts expects
        const location = features.location || 'your region';
        const facts: Array<{label: string; value: string | number; unit?: string; source: string}> = [
            { label: 'Location', value: location, source: finalAction.source }
        ];

        // Intent-specific facts using the exact labels the templates look up
        if (frame.intent === 'irrigation_advice') {
            facts.push({ label: 'Depletion', value: Math.round(context.depletion), unit: 'mm', source: finalAction.source });
            facts.push({ label: 'Forecast Rain', value: context.forecastRain72h, unit: 'mm', source: 'Open-Meteo' });
        }
        if (frame.intent === 'pest_management') {
            facts.push({ label: 'Pest Name', value: context.pestObserved || 'Fall Armyworm', source: finalAction.source });
            facts.push({ label: 'Treatment Threshold', value: '10% leaf damage', source: finalAction.source });
            facts.push({ label: 'Recommended Agent', value: 'Scout first — consult RSK before spraying', source: finalAction.source });
            facts.push({ label: 'Location Risk', value: 'MODERATE', source: finalAction.source });
        }
        if (frame.intent === 'fertilizer_dose') {
            facts.push({ label: 'Recommended Dose', value: '65 kg/acre', source: finalAction.source });
        }

        return {
            intent: frame.intent as any,
            headline: finalAction.advise as any,
            facts,
            confidence: 'MEDIUM',
            evidence: { ruleIds: [finalAction.ruleId], featureSnapshot: { depletion: context.depletion, stage: context.stage, forecastRain72h: context.forecastRain72h } },
            cautions: [finalAction.reason],
            nextCheck: null,
            templateId: finalAction.ruleId,
            suggestedFollowUps: ['Why?', 'What if it rains?'],
            traceability: {
                rule_id: finalAction.ruleId,
                rule_version: '1.2.0',
                source: finalAction.source || 'packages/core/src/reasoning/rules.ts'
            }
        };
    }

    private evaluateRules(context: RuleContext, rulepack: Rulepack): RuleAction | null {
        for (const rule of rulepack.rules) {
            if (rule.intent !== context.intent) continue;

            switch (rule.type) {
                case 'forecast':
                    if (rule.threshold !== undefined && context.forecastRain72h >= rule.threshold) {
                        return rule.action || null;
                    }
                    break;
                case 'critical_stage_depletion':
                    if (rule.stage?.includes(context.stage)) {
                        const criticalMad = rule.threshold !== undefined ? rule.threshold : context.mad_p;
                        if (context.depletion >= criticalMad * context.taw) {
                            return rule.action || null;
                        }
                    }
                    break;
                case 'standard_depletion':
                    if (context.depletion >= context.mad_p * context.taw || context.depletion >= 50) {
                        return rule.action || null;
                    }
                    break;
                case 'etl_threshold':
                    if (rule.threshold !== undefined) {
                        const level = context.infestationLevel || 0;
                        if (level >= rule.threshold) {
                            return rule.action || null;
                        }
                    }
                    break;
                case 'stage_fertilizer':
                    if (rule.stage?.includes(context.stage)) {
                        return rule.action || null;
                    }
                    break;
                case 'rainfall_onset':
                    if (rule.threshold !== undefined && context.forecastRain72h >= rule.threshold) {
                         return rule.action || null;
                    }
                    break;
                case 'fallback':
                    return rule.action || null;
            }
        }
        return null;
    }
}
