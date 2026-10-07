// phenology.ts
import { WeatherRecord, calculateGDD } from './features';

export type CropStage = 'sowing' | 'vegetative' | 'flowering' | 'yield_formation' | 'ripening';

export interface PhenologyState {
    currentStage: CropStage;
    accumulatedGDD: number;
    daysSinceSowing: number;
}

/**
 * Maps accumulated GDD to crop stage.
 * Using generic maize FAO-56 thermal time boundaries for demo (source: PLACEHOLDER).
 * Sowing -> Veg: 0 - 150 GDD
 * Veg -> Flowering: 150 - 750 GDD
 * Flowering -> Yield Formation: 750 - 1150 GDD
 * Yield Formation -> Ripening: 1150 - 1500 GDD
 * Ripening -> Harvest: > 1500 GDD
 */
export function getStageFromGDD(gdd: number): CropStage {
    if (gdd < 150) return 'sowing';
    if (gdd < 750) return 'vegetative';
    if (gdd < 1150) return 'flowering';
    if (gdd < 1500) return 'yield_formation';
    return 'ripening';
}

/**
 * Calculates current phenology state from sowing date and weather history.
 * 
 * Hand calc:
 * Sowing = '2023-06-01'. Weather has 3 days since then.
 * Day 1: GDD = 11. Day 2: GDD = 10. Day 3: GDD = 9. Total GDD = 30.
 * Stage = 'sowing' (30 < 150).
 */
export function calculatePhenology(
    sowingDate: string,
    weather: WeatherRecord[],
    tbase: number = 10.0,
    tcap: number = 30.0,
    farmerOverrideStage?: CropStage
): PhenologyState {
    let accGdd = 0;
    let days = 0;
    
    // Assumes weather records are sorted by date ascending
    const sowingIdx = weather.findIndex(w => w.date === sowingDate);
    if (sowingIdx !== -1) {
        for (let i = sowingIdx; i < weather.length; i++) {
            accGdd += calculateGDD(weather[i].tmax, weather[i].tmin, tbase, tcap);
            days++;
        }
    }
    
    const computedStage = getStageFromGDD(accGdd);
    
    return {
        currentStage: farmerOverrideStage || computedStage,
        accumulatedGDD: accGdd,
        daysSinceSowing: days
    };
}
