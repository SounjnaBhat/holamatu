import { describe, it, expect } from 'vitest';
import { calculateGDD, calculateHargreavesET0, updateWaterBalance, calculateDrySpell, calculateHeatStress, WeatherRecord } from '../src/reasoning/features';

describe('Agro-Features', () => {
    it('calculateGDD: Hand calc Tmax=32, Tmin=12, Tbase=10, Tcap=30', () => {
        // CappedTmax = 30. Mean = 21. GDD = 11.
        expect(calculateGDD(32, 12, 10, 30)).toBe(11);
    });

    it('calculateHargreavesET0: Hand calc Tmax=32, Tmin=20, Ra=15', () => {
        // Tmean=26. Tdelt=12. 
        // ET0 = 0.0023 * 15 * 43.8 * 3.4641 = 5.234
        expect(calculateHargreavesET0(32, 20, 15)).toBeCloseTo(5.234, 2);
    });

    it('updateWaterBalance: Hand calc Dr=20, ET0=5, Kc=1.2, Precip=10, TAW=100', () => {
        // ETc = 6. Dr = 20 + 6 - 10 = 16.
        expect(updateWaterBalance(20, 5, 1.2, 10, 100)).toBe(16);
    });

    it('calculateDrySpell: threshold=2.5', () => {
        const weather: WeatherRecord[] = [
            { date: 'd1', tmax: 30, tmin: 20, precip: 0 },
            { date: 'd2', tmax: 30, tmin: 20, precip: 1 },
            { date: 'd3', tmax: 30, tmin: 20, precip: 3 },
            { date: 'd4', tmax: 30, tmin: 20, precip: 0 },
        ];
        // The last record is precip: 0, run length is 1 since d3 broke the spell.
        expect(calculateDrySpell(weather, 2.5)).toBe(1);
    });

    it('calculateHeatStress: threshold=35', () => {
        const weather: WeatherRecord[] = [
            { date: 'd1', tmax: 36, tmin: 20, precip: 0 },
            { date: 'd2', tmax: 34, tmin: 20, precip: 0 },
            { date: 'd3', tmax: 38, tmin: 20, precip: 0 },
        ];
        expect(calculateHeatStress(weather, 35)).toBe(2);
    });
});
