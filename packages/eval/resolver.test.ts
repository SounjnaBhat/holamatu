import { describe, it, expect } from 'vitest';
import { ParameterResolver } from '../core/src/reasoning/resolver';

describe('ParameterResolver Snapshot', () => {
    it('should maintain consistent resolution across fixed inputs', () => {
        const resolver = new ParameterResolver();
        
        // Define fixed demographic inputs
        const inputs = [
            { location: 'DHARWAD', stage: 'V4', soil: 'red_soil' },
            { location: 'DHARWAD', stage: 'VT', soil: 'black_cotton' },
            { location: 'BELAGAVI', stage: 'V6' }, // fallback zone or national
            { location: 'DHARWAD', stage: 'V4' }, // missing soil
        ];

        const parametersToTest = [
            'n_schedule',
            'faw_etl',
            'pesticide_doses',
            'irrigation_rain_threshold'
        ];

        const snapshot: any[] = [];

        for (const features of inputs) {
            const result: any = { features, resolutions: {} };
            for (const param of parametersToTest) {
                try {
                    const resolved = resolver.resolve(param, features);
                    result.resolutions[param] = resolved.value;
                } catch (e: any) {
                    result.resolutions[param] = `ERROR: ${e.message}`;
                }
            }
            snapshot.push(result);
        }

        expect(snapshot).toMatchInlineSnapshot(`
          [
            {
              "features": {
                "location": "DHARWAD",
                "soil": "red_soil",
                "stage": "V4",
              },
              "resolutions": {
                "faw_etl": 20,
                "irrigation_rain_threshold": 20,
                "n_schedule": 25,
                "pesticide_doses": "Chlorantraniliprole 18.5 SC (0.4 ml/litre)",
              },
            },
            {
              "features": {
                "location": "DHARWAD",
                "soil": "black_cotton",
                "stage": "VT",
              },
              "resolutions": {
                "faw_etl": 20,
                "irrigation_rain_threshold": 20,
                "n_schedule": 10,
                "pesticide_doses": "Chlorantraniliprole 18.5 SC (0.4 ml/litre)",
              },
            },
            {
              "features": {
                "location": "BELAGAVI",
                "stage": "V6",
              },
              "resolutions": {
                "faw_etl": 10,
                "irrigation_rain_threshold": 20,
                "n_schedule": "ERROR: MISSING_FEATURE:agro_climatic_zone",
                "pesticide_doses": "Emamectin benzoate 5% SG (0.4 g/litre)",
              },
            },
            {
              "features": {
                "location": "DHARWAD",
                "stage": "V4",
              },
              "resolutions": {
                "faw_etl": 20,
                "irrigation_rain_threshold": 20,
                "n_schedule": 25,
                "pesticide_doses": "Chlorantraniliprole 18.5 SC (0.4 ml/litre)",
              },
            },
          ]
        `);
    });
});
