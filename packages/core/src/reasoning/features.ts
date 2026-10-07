// features.ts

export interface WeatherRecord {
    date: string;
    tmax: number;
    tmin: number;
    precip: number;
    rad_sw?: number;
    wind?: number;
    rh?: number;
}

/**
 * Calculates Growing Degree Days using the capped method.
 * Hand calculation:
 * For Tmax = 32, Tmin = 12, Tbase = 10, Tcap = 30.
 * Tmax capped = 30.
 * Mean = (30 + 12)/2 = 21.
 * GDD = max(0, 21 - 10) = 11.
 */
export function calculateGDD(tmax: number, tmin: number, tbase: number, tcap: number): number {
    const cappedTmax = Math.min(tmax, tcap);
    const meanT = (cappedTmax + tmin) / 2.0;
    return Math.max(0, meanT - tbase);
}

/**
 * Calculates ET0 using Hargreaves-Samani method.
 * Equation: ET0 = 0.0023 * R_a * (T_mean + 17.8) * sqrt(T_max - T_min)
 * Here R_a (extraterrestrial radiation) is approximated/provided.
 * If rad_sw is available, it can be approximated from R_s, but typically Hargreaves just uses an estimate of Ra.
 * For this simplified version without latitudinal Ra lookup, we will assume a generic Ra or require it.
 * Wait, the prompt says "Hargreaves-Samani ET0". Let's assume a simplified constant Ra of 15.0 MJ/m2/d for Dharwad for demo if not provided.
 * 
 * Hand calc: Tmax=32, Tmin=20. Tmean=26. Ra=15.
 * ET0 = 0.0023 * 15 * (26 + 17.8) * sqrt(12) = 0.0023 * 15 * 43.8 * 3.464 = 5.23 mm/day.
 */
export function calculateHargreavesET0(tmax: number, tmin: number, Ra: number = 15.0): number {
    const tmean = (tmax + tmin) / 2.0;
    const tdelt = Math.max(0, tmax - tmin);
    // 0.408 converts MJ/m2/day to mm/day, but the 0.0023 coefficient already outputs in mm/day if Ra is in mm/day equivalent.
    // Standard HS equation with Ra in mm/day: ET0 = 0.0023 * Ra * (Tmean + 17.8) * sqrt(Tmax - Tmin)
    return 0.0023 * Ra * (tmean + 17.8) * Math.sqrt(tdelt);
}

/**
 * FAO-56 Single-Bucket Water Balance
 * 
 * State variables:
 * - depletion (Dr): current water depletion in mm (0 = field capacity)
 * 
 * Hand calc:
 * Initial Dr = 20mm.
 * TAW = 100mm.
 * Kc = 1.2. ET0 = 5mm. ETc = 6mm.
 * Precip = 10mm.
 * New Dr = max(0, 20 + 6 - 10) = 16mm.
 */
export function updateWaterBalance(
    currentDepletion: number,
    et0: number,
    kc: number,
    precip: number,
    taw: number
): number {
    const etc = et0 * kc;
    // Simple bucket: Dr_new = Dr_prev + ETc - P - Irrigation(0) + Runoff(0) + DP(0)
    // Capped between 0 (field capacity) and TAW (permanent wilting point)
    let newDepletion = currentDepletion + etc - precip;
    if (newDepletion < 0) newDepletion = 0; // Drainage
    if (newDepletion > taw) newDepletion = taw; // Stress bounds (simplified)
    return newDepletion;
}

/**
 * Calculates current dry spell run length (consecutive days with precip < 2.5mm).
 * 
 * Hand calc:
 * records = [precip: 0], [precip: 1], [precip: 3], [precip: 0]
 * run = 1
 */
export function calculateDrySpell(weather: WeatherRecord[], threshold: number = 2.5): number {
    let run = 0;
    for (let i = weather.length - 1; i >= 0; i--) {
        if (weather[i].precip < threshold) {
            run++;
        } else {
            break;
        }
    }
    return run;
}

/**
 * Heat stress day counts (days > 35C).
 * 
 * Hand calc:
 * records: tmax=36, tmax=34, tmax=38
 * count = 2
 */
export function calculateHeatStress(weather: WeatherRecord[], threshold: number = 35.0): number {
    return weather.filter(w => w.tmax > threshold).length;
}
