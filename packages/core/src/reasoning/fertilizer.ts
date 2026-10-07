import type { Rule } from './rules';
import { ParameterResolver } from './resolver';

const resolver = new ParameterResolver();

export const fertilizerRule: Rule = {
    id: 'fertilizer_rule_v1',
    intent: 'fertilizer_advice',
    priority: 100,
    evaluate: (frame, features) => {
        return frame.intent === 'fertilizer_advice';
    },
    generateAdvisory: (frame, features) => {
        const { stage, location } = features;
        
        let action: import('../contracts/types').AdviceAction = 'APPLY';
        
        const nResolved = resolver.resolve<number>('n_schedule', features);
        const ureaDose = `${nResolved.value} kg/acre`;
        
        if (nResolved.value === 0) {
            action = 'WAIT';
        }

        return {
            intent: 'fertilizer_advice',
            headline: action,
            facts: [
                { label: 'Crop Stage', value: stage, unit: '', source: 'Phenology Model' },
                { label: 'Location', value: location, unit: '', source: 'User Profile' },
                { label: 'Recommended Dose', value: ureaDose, unit: '', source: 'Agronomic Policy' }
            ],
            confidence: 'HIGH',
            evidence: { ruleIds: ['fertilizer_rule_v1'], featureSnapshot: features },
            cautions: action === 'APPLY' ? ['Apply only when soil has adequate moisture.'] : ['Top-dressing not recommended at this stage.'],
            nextCheck: null,
            templateId: 'fertilizer_template_01',
            suggestedFollowUps: action === 'APPLY' ? ['Should I mix with DAP?'] : ['Why wait?']
        };
    }
};
