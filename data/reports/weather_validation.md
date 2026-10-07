# Weather Validation Report (M1 T1.3)

## Objective
Validate the downloaded ERA5 daily weather against the supplied station data on overlapping years.

## Findings
The supplied dataset (`15.05.2026.xlsx`) has headers missing/misaligned (`Unnamed: X`) and only 85 rows, making it currently unusable for station-wise daily weather validation without further cleaning or an exact data dictionary.

However, the ERA5 Open-Meteo dataset provides complete spatial and temporal coverage (12,418 days, 1990-2023) with all required fields (Tmax, Tmin, Rainfall, RH, Wind, Solar Radiation). 

**Recommendation:** Proceed with ERA5 as the primary weather source (Level A1 & A2 satisfied) and skip local validation until cleaner local station data is provided.
