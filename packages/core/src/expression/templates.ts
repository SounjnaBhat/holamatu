import type { Advisory } from '../contracts/types';

// Simple deterministic hash based on session ID and turn index
export function getVariantIndex(sessionId: string, turnIndex: number, variantCount: number): number {
    let hash = 0;
    const str = `${sessionId}_${turnIndex}`;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash) % variantCount;
}

const irrigationTemplatesEn = [
    (stage: string, depletion: string, action: string, location: string) => {
        if (action === 'WAIT') {
            return `### Irrigation Check — ${location}\n\n✅ **No irrigation needed right now.**\n\n**Your Field:**\n- **Crop Stage:** ${stage}\n- **Current Soil Deficit:** ${depletion}\n- **MAD Threshold:** 55 mm\n\nYour soil still has enough moisture. Check again in 2–3 days or after a dry spell.`;
        }
        return `### Irrigation Needed — ${location}\n\n⚠️ **Irrigate your field today.**\n\n**Your Field:**\n- **Crop Stage:** ${stage}\n- **Current Soil Deficit:** ${depletion}\n- **MAD Threshold:** 55 mm\n\nYour soil moisture has dropped below the safe limit. Apply **${depletion}** of water to bring it back up.`;
    },
    (stage: string, depletion: string, action: string, location: string) => {
        if (action === 'WAIT') {
            return `### Water Status: ${location}\n\n✅ **Moisture status is optimal.**\n\n- **Stage:** ${stage}\n- **Soil Deficit:** ${depletion}\n\nNo irrigation required at present.`;
        }
        return `### Water Action: ${location}\n\n⚠️ **Irrigation Required (IRRIGATE).**\n\n- **Stage:** ${stage}\n- **Soil Deficit:** ${depletion}\n\nWater deficit requires irrigation of **${depletion}**.`;
    }
];

const irrigationTemplatesKn = [
    (stage: string, depletion: string, action: string, location: string) => {
        if (action === 'WAIT') {
            return `### ನೀರಾವರಿ ಪರಿಶೀಲನೆ — ${location}\n\n✅ **ಈಗ ನೀರು ಹಾಕುವ ಅಗತ್ಯವಿಲ್ಲ.**\n\n**ನಿಮ್ಮ ಹೊಲ:**\n- **ಬೆಳೆಯ ಹಂತ:** ${stage}\n- **ಮಣ್ಣಿನ ಕೊರತೆ:** ${depletion}\n\nಮಣ್ಣಿನಲ್ಲಿ ಸಾಕಷ್ಟು ತೇವಾಂಶವಿದೆ. 2–3 ದಿನಗಳ ನಂತರ ಮತ್ತೆ ಪರಿಶೀಲಿಸಿ.`;
        }
        return `### ನೀರಾವರಿ ಅಗತ್ಯ — ${location}\n\n⚠️ **ಇಂದು ನೀರು ಹಾಕಿ.**\n\n**ನಿಮ್ಮ ಹೊಲ:**\n- **ಬೆಳೆಯ ಹಂತ:** ${stage}\n- **ಮಣ್ಣಿನ ಕೊರತೆ:** ${depletion}\n\nಮಣ್ಣಿನ ತೇವಾಂಶ ಕಡಿಮೆಯಾಗಿದೆ. **${depletion}** ನೀರನ್ನು ಒದಗಿಸಿ.`;
    },
    (stage: string, depletion: string, action: string, location: string) => {
        if (action === 'WAIT') {
            return `### ನೀರಿನ ಸ್ಥಿತಿ: ${location}\n\n✅ **ಸಾಕಷ್ಟು ತೇವಾಂಶವಿದೆ.**\n\n- **ಹಂತ:** ${stage}\n- **ಕೊರತೆ:** ${depletion}\n\nಈಗ ನೀರು ಹಾಕುವ ಅಗತ್ಯವಿಲ್ಲ.`;
        }
        return `### ನೀರಾವರಿ ಕ್ರಮ: ${location}\n\n⚠️ **ನೀರು ಒದಗಿಸಿ.**\n\n- **ಹಂತ:** ${stage}\n- **ಕೊರತೆ:** ${depletion}\n\nದಯವಿಟ್ಟು **${depletion}** ನೀರನ್ನು ಹಾಕಿ.`;
    }
];

const pestTemplatesEn = [
    (pest: string, threshold: string, chemical: string, location: string, risk: string) => `### Pest Advisory: ${pest.toUpperCase()} in ${location}\n\n**Risk Level:** ${risk}\n\n**Analysis:**\nBased on regional models for ${location}, ${pest} requires action when damage reaches **${threshold}**.\n\n**Recommendation:**\nApply **${chemical}** to effectively control the outbreak.`,
    (pest: string, threshold: string, chemical: string, location: string, risk: string) => `### Alert: ${pest.toUpperCase()}\n\n**Region:** ${location} (${risk} risk)\n\n**Action Threshold:** ${threshold}\n\n**Treatment Plan:**\nPlease use **${chemical}** to manage the pest population.`
];

const pestTemplatesKn = [
    (pest: string, threshold: string, chemical: string, location: string, risk: string) => `### ಕೀಟ ಸಲಹೆ: ${location} ದಲ್ಲಿ ${pest.toUpperCase()}\n\n**ಅಪಾಯದ ಮಟ್ಟ:** ${risk}\n\n**ವಿಶ್ಲೇಷಣೆ:**\nಹಾನಿ **${threshold}** ತಲುಪಿದಾಗ ನಿಯಂತ್ರಣ ಕ್ರಮ ಅಗತ್ಯ.\n\n**ಶಿಫಾರಸು:**\nಹತೋಟಿಗಾಗಿ ದಯವಿಟ್ಟು **${chemical}** ಸಿಂಪಡಿಸಿ.`
];

const fertilizerTemplatesEn = [
    (stage: string, dose: string, location: string) => `### Fertilizer Advisory (${location})\n\n**Crop Stage:** ${stage}\n\n**Recommendation:**\nApply **${dose}** of Urea. This dosage is specifically calibrated for ${location} soils at this growth stage.`,
    (stage: string, dose: string, location: string) => `### Nutrient Management\n\n**Location:** ${location}\n**Stage:** ${stage}\n\n**Action:**\nWe recommend a top-dressing of **${dose}** of Urea.`
];

const fertilizerTemplatesKn = [
    (stage: string, dose: string, location: string) => `### ರಸಗೊಬ್ಬರ ಸಲಹೆ (${location})\n\n**ಬೆಳೆಯ ಹಂತ:** ${stage}\n\n**ಶಿಫಾರಸು:**\n**${dose}** ಯೂರಿಯಾ ಬಳಸಿ. ಈ ಪ್ರಮಾಣವನ್ನು ${location} ಮಣ್ಣಿಗೆ ಮತ್ತು ಬೆಳವಣಿಗೆಯ ಹಂತಕ್ಕೆ ನಿಖರವಾಗಿ ಲೆಕ್ಕಹಾಕಲಾಗಿದೆ.`
];

export function renderAdvisoryTemplate(advisory: Advisory, sessionId: string, turnIndex: number, stage: string, lang: string = 'en'): string {
    const locationFact = advisory.facts.find(f => f.label === 'Location');
    const location = locationFact ? String(locationFact.value) : 'your region';

    if (advisory.intent === 'irrigation_advice') {
        const depletionFact = advisory.facts.find(f => f.label === 'Depletion');
        const depletionStr = depletionFact ? `${depletionFact.value} ${depletionFact.unit}` : 'unknown';
        const templates = lang === 'kn' ? irrigationTemplatesKn : irrigationTemplatesEn;
        const index = getVariantIndex(sessionId, turnIndex, templates.length);
        
        let response = templates[index](stage, depletionStr, advisory.headline, location);
        
        if (advisory.cautions && advisory.cautions.length > 0) {
            response += `\n*Note: ${advisory.cautions[0]}*`;
        }
        return response;
    }
    
    if (advisory.intent === 'pest_management') {
        const pestFact = advisory.facts.find(f => f.label === 'Pest Name');
        const thresholdFact = advisory.facts.find(f => f.label === 'Treatment Threshold');
        const chemicalFact = advisory.facts.find(f => f.label === 'Recommended Agent');
        const riskFact = advisory.facts.find(f => f.label === 'Location Risk');
        
        const pest = pestFact ? String(pestFact.value) : 'Pests';
        const threshold = thresholdFact ? String(thresholdFact.value) : 'economic threshold';
        const chemical = chemicalFact ? String(chemicalFact.value) : 'recommended pesticide';
        const risk = riskFact ? String(riskFact.value) : 'UNKNOWN';

        const templates = lang === 'kn' ? pestTemplatesKn : pestTemplatesEn;
        const index = getVariantIndex(sessionId, turnIndex, templates.length);
        let response = templates[index](pest, threshold, chemical, location, risk);
        
        if (advisory.cautions && advisory.cautions.length > 0) {
            response += `\n*Note: ${advisory.cautions[0]}*`;
        }
        return response;
    }

    if (advisory.intent === 'fertilizer_dose') {
        const doseFact = advisory.facts.find(f => f.label === 'Recommended Dose');
        const dose = doseFact ? String(doseFact.value) : '0 kg/acre';
        
        if (advisory.headline === 'WAIT') {
            return lang === 'kn' ? `### ರಸಗೊಬ್ಬರ ಸಲಹೆ (${location})\n\n**ಶಿಫಾರಸು:** ಕಾಯಿರಿ. ${stage} ಹಂತದಲ್ಲಿ ಗೊಬ್ಬರ ಕೊಡುವುದು ಸೂಕ್ತವಲ್ಲ.\n\n*ಸೂಚನೆ: ${advisory.cautions[0]}*` : `### Fertilizer Advisory (${location})\n\n**Recommendation:** WAIT. Top-dressing is not recommended at the ${stage} stage.\n\n*Note: ${advisory.cautions[0]}*`;
        }

        const templates = lang === 'kn' ? fertilizerTemplatesKn : fertilizerTemplatesEn;
        const index = getVariantIndex(sessionId, turnIndex, templates.length);
        let response = templates[index](stage, dose, location);
        
        if (advisory.cautions && advisory.cautions.length > 0) {
            response += `\n*Note: ${advisory.cautions[0]}*`;
        }
        return response;
    }

    
    // Fallback simple rendering
    return `Recommendation: ${advisory.headline}.`;
}
