/**
 * Agro-features engineering (T2.2)
 * Pure, side-effect-free TS implementations of GDD, ET0, Water Balance, etc.
 */

/**
 * Growing Degree Days (GDD) with capped method
 * Tbase = 10 °C
 * Tmax_c' = min(Tmax, 30), Tmin_c' = max(Tmin, 10)
 */
import { ParameterResolver } from '../resolver';

const resolver = new ParameterResolver();

const HARGREAVES_C = 0.0023;       // FAO-56 eq. 52
const HARGREAVES_OFFSET = 17.8;    // FAO-56 eq. 52
const DEFAULT_RA_MJ_M2_DAY = 15.0; // Approximation for Dharwad
const DRY_SPELL_RAIN_MM = 2.5;     // Threshold for dry day
export function calculateGDD(tmax: number, tmin: number): number {
    const constantsResolved = resolver.resolve<any>('crop_maize_constants', {});
    const TBASE = constantsResolved.value.Tbase;
    const TMAX_CAP = constantsResolved.value.Tmax_cap;
    const TMIN_CAP = TBASE;

    const tmaxPrime = Math.min(tmax, TMAX_CAP);
    const tminPrime = Math.max(tmin, TMIN_CAP);
    const gdd = ((tmaxPrime + tminPrime) / 2) - TBASE;
    return Math.max(gdd, 0); // clamp to >= 0
}

/**
 * Hargreaves-Samani ET0
 * ET0 = 0.0023 * Ra * (Tmean + 17.8) * (Tmax - Tmin)^0.5
 * For Dharwad (latitude 15.46), we can approximate Ra or use a simplified constant for testing,
 * but a full implementation would compute extraterrestrial radiation Ra from day of year.
 * Here we use a fixed Ra proxy for demonstration of the TS engine.
 */
export function calculateHargreavesET0(tmax: number, tmin: number, ra: number = DEFAULT_RA_MJ_M2_DAY): number {
    const tmean = (tmax + tmin) / 2;
    const tempDiff = Math.max(tmax - tmin, 0);
    return HARGREAVES_C * ra * (tmean + HARGREAVES_OFFSET) * Math.sqrt(tempDiff);
}

/**
 * Single-bucket FAO-56 Water Balance step
 * @param dPrev Previous day's depletion (mm)
 * @param pEff Effective rainfall (mm)
 * @param etc Crop evapotranspiration (mm)
 * @param taw Total Available Water (mm)
 * @returns New depletion D_t (mm)
 */
export function calculateWaterBalanceStep(dPrev: number, pEff: number, etc: number, taw: number): number {
    let dNext = dPrev - pEff + etc;
    if (dNext < 0) dNext = 0;
    if (dNext > taw) dNext = taw;
    return dNext;
}

/**
 * Count heat stress days (Tmax > 35 °C)
 */
export function countHeatStressDays(tmaxSeries: number[]): number {
    const constantsResolved = resolver.resolve<any>('crop_maize_constants', {});
    const HEAT_STRESS = constantsResolved.value.heat_stress_threshold_c;
    return tmaxSeries.filter(t => t > HEAT_STRESS).length;
}

/**
 * Max dry spell (days with < 2.5 mm rain)
 */
export function maxDrySpell(rainSeries: number[]): number {
    let maxSpell = 0;
    let currentSpell = 0;
    for (const rain of rainSeries) {
        if (rain < DRY_SPELL_RAIN_MM) {
            currentSpell++;
            maxSpell = Math.max(maxSpell, currentSpell);
        } else {
            currentSpell = 0;
        }
    }
    return maxSpell;
}
