import { KNOWLEDGE } from '../knowledge_compiled';

export type ResolutionLevel = 'farm' | 'attribute' | 'zone' | 'national';

export interface SourceRef {
    doc: string;
    page?: number;
    year?: number;
}

export interface Resolved<T> {
    value: T;
    level: ResolutionLevel;
    source: SourceRef;
    confidence: string;
}

export class ParameterResolver {
    public resolve<T>(paramId: string, features: Record<string, any>): Resolved<T> {
        const paramsMap = (KNOWLEDGE.params as Record<string, any>);
        const paramDef = paramsMap[paramId];
        if (!paramDef) {
            throw new Error(`Parameter ${paramId} not found in knowledge base.`);
        }

        const regionId = features.location ? `KA_${features.location.toUpperCase()}` : null;
        const regionsMap = (KNOWLEDGE.regions as Record<string, any>);
        const regionDef = regionId ? regionsMap[regionId] : null;

        const expandedFeatures: Record<string, any> = {
            ...features,
            agro_climatic_zone: regionDef?.agro_climatic_zone,
            pest_pressure: regionDef?.pest_pressure,
        };

        // Find all blocks that match the PROVIED features.
        // A block matches if every key in 'when' that is present in 'expandedFeatures' matches.
        // If a key in 'when' is missing in 'expandedFeatures', we consider it a "potential" match.
        const potentialBlocks = paramDef.values.filter((block: any) => this.matchesProvided(block.when, expandedFeatures));

        if (potentialBlocks.length === 0) {
            throw new Error(`No matching value for parameter ${paramId}`);
        }

        // If the first matched block has NO missing keys, it's an exact match.
        const firstBlock = potentialBlocks[0];
        const missingKeysInFirst = Object.keys(firstBlock.when).filter(k => expandedFeatures[k] === undefined);

        if (missingKeysInFirst.length === 0) {
            return this.formatResolution(firstBlock, paramDef.source);
        }

        // We have missing keys (e.g. soil). Check unknown_key_policy if multiple potential blocks have different values.
        if (paramDef.unknown_key_policy) {
            const values = potentialBlocks.map((b: any) => b.value).filter((v: any) => typeof v === 'number') as number[];
            if (values.length > 1) {
                const min = Math.min(...values);
                const max = Math.max(...values);
                const spread = (max - min) / max;
                
                if (spread <= paramDef.unknown_key_policy.ask_if_spread_exceeds) {
                    const chosenValue = paramDef.unknown_key_policy.strategy === 'conservative_low' ? min : max;
                    // Find the block that gave this value to keep confidence/level
                    const chosenBlock = potentialBlocks.find((b: any) => b.value === chosenValue) || firstBlock;
                    const res = this.formatResolution(chosenBlock, paramDef.source);
                    res.value = chosenValue as any;
                    return res;
                } else {
                    // Spread is too high, we need to ask. For now, returning a special value or throwing.
                    // We will throw so the caller can catch and ask, or return null if we change types.
                    // We'll throw an error to signal to the reasoning engine.
                    throw new Error(`MISSING_FEATURE:${missingKeysInFirst.join(',')}`);
                }
            }
        }

        // Fallback: just return the first potential block if no policy or policy doesn't apply
        return this.formatResolution(firstBlock, paramDef.source);
    }

    private formatResolution(block: any, source: any): Resolved<any> {
        const isNationalFallback = Object.keys(block.when).length === 0;
        return {
            value: block.value,
            level: isNationalFallback ? 'national' : 'attribute',
            source: source,
            confidence: block.confidence || 'HIGH'
        };
    }

    private matchesProvided(when: Record<string, any>, features: Record<string, any>): boolean {
        for (const [key, expectedValue] of Object.entries(when)) {
            const actualValue = features[key];
            if (actualValue === undefined) continue; // It's missing, so it's a potential match

            if (Array.isArray(expectedValue)) {
                if (!expectedValue.includes(actualValue)) return false;
            } else {
                if (actualValue !== expectedValue) return false;
            }
        }
        return true;
    }
}
