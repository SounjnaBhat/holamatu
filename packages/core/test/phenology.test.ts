import { describe, it, expect } from 'vitest';
import { getStageFromGDD, calculatePhenology } from '../src/reasoning/phenology';
import { WeatherRecord } from '../src/reasoning/features';

describe('Phenology', () => {
    it('getStageFromGDD: maps GDD to correct stages', () => {
        expect(getStageFromGDD(100)).toBe('sowing');
        expect(getStageFromGDD(200)).toBe('vegetative');
        expect(getStageFromGDD(800)).toBe('flowering');
        expect(getStageFromGDD(1200)).toBe('yield_formation');
        expect(getStageFromGDD(1600)).toBe('ripening');
    });

    it('calculatePhenology: Hand calc 3 days of weather', () => {
        const weather: WeatherRecord[] = [
            { date: '2023-06-01', tmax: 32, tmin: 12, precip: 0 }, // GDD: cappedTmax=30, mean=21, gdd=11
            { date: '2023-06-02', tmax: 30, tmin: 10, precip: 0 }, // GDD: mean=20, gdd=10
            { date: '2023-06-03', tmax: 28, tmin: 10, precip: 0 }, // GDD: mean=19, gdd=9
        ];
        
        // Total GDD = 30. Stage = 'sowing' (30 < 150)
        const state = calculatePhenology('2023-06-01', weather, 10, 30);
        expect(state.accumulatedGDD).toBe(30);
        expect(state.daysSinceSowing).toBe(3);
        expect(state.currentStage).toBe('sowing');
    });
});
