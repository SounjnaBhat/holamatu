import type { Rule } from './rules';
import { ParameterResolver } from './resolver';

const resolver = new ParameterResolver();

/**
 * T2.5 Irrigation Logic
 * D_today >= RAW and forecast_rain_72h < 20 mm -> IRRIGATE
 * D_today >= RAW and forecast_rain_72h >= 20 mm -> WAIT
 * D_today >= 0.8*RAW and stage in [VT, R1] -> IRRIGATE
 */
export const irrigationRule: Rule = {
    id: 'irrigation_rule_v1',
    intent: 'irrigation_advice',
    priority: 100,
    evaluate: (frame, features) => {
        if (!features.location) {
            throw new Error('MISSING_FEATURE:location');
        }
        if (!features.stage) {
            throw new Error('MISSING_FEATURE:stage');
        }
        if (features.raw === undefined && !features.soil) {
            throw new Error('MISSING_FEATURE:soil');
        }
        
        let raw = features.raw;
        if (raw === undefined) {
            raw = features.soil === 'red' ? 45 : 90;
        }

        const { dToday, stage } = features;
        if (dToday >= raw) return true;
        const constantsResolved = resolver.resolve<any>('crop_maize_constants', {});
        if (dToday >= constantsResolved.value.MAD * raw && (stage === 'VT' || stage === 'R1')) return true;
        return true; // Match everything to give a NO irrigation needed advice
    },
    generateAdvisory: (frame, features) => {
        let raw = features.raw;
        if (raw === undefined) {
            raw = features.soil === 'red' ? 45 : 90;
        }
        const { dToday, forecastRain72h, stage } = features;
        
        let action: import('../contracts/types').AdviceAction = 'INFORM';
        let confidence: import('../contracts/types').Confidence = 'HIGH';
        
        const rainThresholdResolved = resolver.resolve<number>('irrigation_rain_threshold', features);
        const rainThreshold = rainThresholdResolved.value;
        const constantsResolved = resolver.resolve<any>('crop_maize_constants', {});
        const MAD = constantsResolved.value.MAD;

        if (dToday >= raw) {
            if (forecastRain72h < rainThreshold) {
                action = 'IRRIGATE';
            } else {
                action = 'WAIT';
            }
        } else if (dToday >= MAD * raw && (stage === 'VT' || stage === 'R1')) {
            action = 'IRRIGATE';
        }

        return {
            intent: 'irrigation_advice',
            headline: action,
            facts: [
                { label: 'Depletion', value: dToday, unit: 'mm', source: 'FAO-56 Water Balance' },
                { label: 'Forecast Rain', value: forecastRain72h, unit: 'mm', source: 'Open-Meteo' },
                { label: 'Location', value: features.location || 'Unknown', unit: '', source: 'User Profile' }
            ],
            confidence: confidence,
            evidence: { ruleIds: ['irrigation_rule_v1'], featureSnapshot: features },
            cautions: action === 'WAIT' ? ['Recheck in 2 days if rain fails.'] : [],
            nextCheck: null,
            templateId: 'irrigation_template_01',
            suggestedFollowUps: action === 'IRRIGATE' 
                ? ["Why?", "What if it rains tomorrow?"] 
                : ["Why wait?", "What if it doesn't rain?"]
        };
    }
};
