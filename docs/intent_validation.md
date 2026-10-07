# KCC Intent Validation (Adapted for Kaggle Dataset)

*Note: We are grouping by heuristic intent because the Kaggle dataset lacks KCC QueryType.*

## 1. True Query Volume (What farmers demand)
Sum of `duplicate_count` for exact-matched normalized questions.

| Heuristic Intent | Query Volume |
|---|---|
| `out_of_scope` | 244 |
| `fertilizer_dose` | 185 |
| `pest_management` | 91 |
| `variety_recommendation` | 76 |
| `sowing_window` | 65 |
| `disease_management` | 29 |
| `seed_rate_spacing` | 29 |
| `irrigation_advice` | 6 |
| `market_price` | 5 |
| `yield_estimate` | 5 |
| `weed_management` | 4 |
| `post_harvest_storage` | 3 |
| `harvest_timing` | 2 |
| `soil_health` | 1 |

## 2. Phrasing Diversity (What the model trains on)
Count of unique normalized phrasings.

| Heuristic Intent | Unique Phrasings |
|---|---|
| `out_of_scope` | 164 |
| `fertilizer_dose` | 70 |
| `pest_management` | 62 |
| `variety_recommendation` | 48 |
| `sowing_window` | 38 |
| `disease_management` | 23 |
| `seed_rate_spacing` | 20 |
| `irrigation_advice` | 6 |
| `market_price` | 4 |
| `weed_management` | 4 |
| `yield_estimate` | 4 |
| `post_harvest_storage` | 3 |
| `harvest_timing` | 2 |
| `soil_health` | 1 |
