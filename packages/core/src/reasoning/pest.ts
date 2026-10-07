import type { Rule } from './rules';
import { ParameterResolver } from './resolver';

const resolver = new ParameterResolver();

export const pestRule: any = {
    id: 'pest_rule_v1',
    intent: 'pest_advice',
    priority: 100,
    evaluate: (frame: any, features: any) => {
        // Trigger if intent is pest_advice
        return frame.intent === 'pest_advice';
    },
    generateAdvisory: (frame: any, features: any) => {
        const { stage, location } = features;
        
        // Find pest name from slots if available
        const pestSlot = frame.slots['pest_name'];
        const pestName = pestSlot ? String(pestSlot.value).toLowerCase() : 'unknown pests';
        
        // Expand features with pest name for resolution
        const pestKey = (pestName.includes('faw') || pestName.includes('fall armyworm')) ? 'faw' : pestName;
        const resolutionFeatures = { ...features, pest_name: pestKey };
        
        let action: import('../contracts/types').AdviceAction = 'APPLY';
        
        const etlResolved = resolver.resolve<number>('faw_etl', resolutionFeatures);
        const doseResolved = resolver.resolve<string>('pesticide_doses', resolutionFeatures);

        const threshold = `${etlResolved.value}% whorl damage`;
        const recommendedChemical = doseResolved.value;
        const riskLevel = etlResolved.level === 'national' ? 'MODERATE' : 'HIGH';

        return {
            intent: 'pest_advice',
            headline: action,
            facts: [
                { label: 'Pest Name', value: pestName, unit: '', source: 'User Query' },
                { label: 'Location Risk', value: riskLevel, unit: '', source: 'Regional Model' },
                { label: 'Treatment Threshold', value: threshold, unit: '', source: 'Agronomic Policy' },
                { label: 'Recommended Agent', value: recommendedChemical, unit: '', source: 'Chemical Whitelist' },
                { label: 'Location', value: location, unit: '', source: 'User Profile' }
            ],
            confidence: 'HIGH',
            evidence: { ruleIds: ['pest_rule_v1'], featureSnapshot: features },
            cautions: ['Wear protective gear while spraying.', 'Spray during early morning or late evening.'],
            nextCheck: null,
            templateId: 'pest_template_01',
            suggestedFollowUps: ['Is there an organic alternative?', 'Where can I buy it?']
        };
    }
};
