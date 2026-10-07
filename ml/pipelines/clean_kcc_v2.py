import pandas as pd
import re
import json
from pathlib import Path
import numpy as np

# Config
DATA_PATH = Path("data/raw/kcc/questionsv4.csv")
OUT_JSONL = Path("ml/golden/kcc_seed.jsonl")
OUT_VALIDATION = Path("docs/intent_validation.md")
OUT_BLIND = Path("ml/golden/sample_300_blind.csv")
OUT_SCORING = Path("ml/golden/sample_300_scoring.csv")

# Spelling variants for Maize
CROP_VARIANTS = [
    "maize", "makka", "makkajola", "mecca jola", "mekke jola", "corn", "ಮೆಕ್ಕೆಜೋಳ"
]

# Intent Taxonomy mapping rules
INTENT_RULES = {
    "sowing_window": r"\b(sow|sowing|when to sow|planting time)\b",
    "variety_recommendation": r"\b(variety|hybrid|seed selection|which seed)\b",
    "seed_rate_spacing": r"\b(seed rate|spacing|how much seed)\b",
    "fertilizer_dose": r"\b(fertilizer|urea|dap|potash|mop|ssp|nutrient|manure)\b",
    "irrigation_advice": r"\b(irrigation|water|watering)\b",
    "weed_management": r"\b(weed|weeds|weedicide|herbicide)\b",
    "pest_identification": r"\b(identify pest|what insect|what pest)\b", 
    "pest_management": r"\b(pest|FAW|fall armyworm|insect|borer|worm|aphid|caterpillar)\b",
    "disease_management": r"\b(disease|blight|spot|rust|fungus|fungicide|rot)\b",
    "nutrient_deficiency": r"\b(deficiency|yellowing|yellow leaves|reddening)\b",
    "weather_query": r"\b(weather|rain|rainfall|forecast)\b",
    "yield_estimate": r"\b(yield|production|how much crop)\b",
    "harvest_timing": r"\b(harvest|harvesting|when to harvest)\b",
    "post_harvest_storage": r"\b(storage|store|godown)\b",
    "market_price": r"\b(market|price|rate|mandi|apmc)\b",
    "scheme_subsidy": r"\b(scheme|subsidy|insurance|loan|credit card)\b",
    "soil_health": r"\b(soil test|soil health|soil testing)\b"
}

def clean_text(text):
    if not isinstance(text, str):
        return ""
    text = text.lower()
    
    # Strip operator boilerplate
    prefixes_to_strip = [
        r"^asking about the (control measure for|details regarding|information about)?\s*",
        r"^asking about (how to|the)?\s*",
        r"^asked about (the)?\s*",
        r"^farmer asked about (the)?\s*",
        r"^details regarding (the)?\s*",
        r"^information regarding (the)?\s*",
        r"^query regarding (the)?\s*",
    ]
    for prefix in prefixes_to_strip:
        text = re.sub(prefix, "", text).strip()
        
    # Strip trailing punctuation
    text = re.sub(r"[^\w\s]+$", "", text)
    
    # Collapse repeated characters (e.g. "uuuurea" -> "urea", simple heuristic)
    text = re.sub(r"(.)\1{2,}", r"\1", text)
    
    # Standardize digits (if any numbers are present, replace with a generic token to dedup similar questions like "urea for 30 days" and "urea for 40 days")
    # Actually, let's just leave digits as is to be safe, but collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text

def get_crop_variant(text):
    text = str(text).lower()
    for variant in CROP_VARIANTS:
        if variant in text:
            return variant
    return None

def map_intent(text):
    text = str(text).lower()
    for intent, pattern in INTENT_RULES.items():
        if re.search(pattern, text):
            return intent
    return "out_of_scope"

def main():
    print(f"Loading {DATA_PATH}...")
    df = pd.read_csv(DATA_PATH, names=['questions', 'answers'], header=0)
    print(f"Funnel | Total rows: {len(df)}")
    
    # 1. Filter by crop variants in questions
    print("\nMatching crop variants...")
    df['crop_variant'] = df['questions'].apply(get_crop_variant)
    df_maize = df[df['crop_variant'].notnull()].copy()
    print(f"Funnel | Crop-matched rows: {len(df_maize)}")
    print("Matches by variant:")
    print(df_maize['crop_variant'].value_counts())
    
    # 2. Normalize then exact dedup
    print("\nNormalizing and deduplicating...")
    df_maize['normalized_question'] = df_maize['questions'].apply(clean_text)
    
    # Exact dedup with duplicate_count
    # Group by normalized_question, taking the first original question and answers, and count size
    canonical_df = df_maize.groupby('normalized_question').agg(
        original_question=('questions', 'first'),
        answers=('answers', 'first'),
        duplicate_count=('normalized_question', 'size')
    ).reset_index()
    
    print(f"Funnel | Raw exact distinct (before normalize): {df_maize['questions'].nunique()}")
    print(f"Funnel | Normalized distinct rows: {len(canonical_df)}")
    print(f"Total volume retained in duplicate_count: {canonical_df['duplicate_count'].sum()} (matches crop-matched rows: {canonical_df['duplicate_count'].sum() == len(df_maize)})")
    
    # 3. Map heuristic intents
    canonical_df['heuristic_intent'] = canonical_df['normalized_question'].apply(map_intent)
    
    # 4. Generate Dual Frequency Tables
    volume_by_intent = canonical_df.groupby('heuristic_intent')['duplicate_count'].sum().sort_values(ascending=False)
    phrasing_diversity_by_intent = canonical_df.groupby('heuristic_intent').size().sort_values(ascending=False)
    
    # Output to validation markdown
    OUT_VALIDATION.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_VALIDATION, "w", encoding="utf-8") as f:
        f.write("# KCC Intent Validation (Adapted for Kaggle Dataset)\n\n")
        f.write("*Note: We are grouping by heuristic intent because the Kaggle dataset lacks KCC QueryType.*\n\n")
        
        f.write("## 1. True Query Volume (What farmers demand)\n")
        f.write("Sum of `duplicate_count` for exact-matched normalized questions.\n\n")
        f.write("| Heuristic Intent | Query Volume |\n")
        f.write("|---|---|\n")
        for intent, vol in volume_by_intent.items():
            f.write(f"| `{intent}` | {vol} |\n")
            
        f.write("\n## 2. Phrasing Diversity (What the model trains on)\n")
        f.write("Count of unique normalized phrasings.\n\n")
        f.write("| Heuristic Intent | Unique Phrasings |\n")
        f.write("|---|---|\n")
        for intent, div in phrasing_diversity_by_intent.items():
            f.write(f"| `{intent}` | {div} |\n")
            
    print(f"\nValidation tables written to {OUT_VALIDATION}")
    
    # 5. Stratified Sampling (300 rows, forced 60 from unmatched)
    print("\nSampling 300 rows for blind labeling...")
    unmatched_pool = canonical_df[canonical_df['heuristic_intent'] == 'out_of_scope']
    matched_pool = canonical_df[canonical_df['heuristic_intent'] != 'out_of_scope']
    
    n_unmatched = min(60, len(unmatched_pool))
    n_matched = min(240, len(matched_pool)) # or 300 - n_unmatched
    
    sample_unmatched = unmatched_pool.sample(n=n_unmatched, random_state=42)
    # Proportional sampling for the matched intents
    sample_matched = matched_pool.groupby('heuristic_intent', group_keys=False).apply(
        lambda x: x.sample(n=int(np.ceil(len(x) / len(matched_pool) * (300 - n_unmatched))), random_state=42)
    ).head(300 - n_unmatched)
    
    final_sample = pd.concat([sample_unmatched, sample_matched]).sample(frac=1, random_state=42) # shuffle
    
    # 6. Output Blind and Scoring files
    OUT_BLIND.parent.mkdir(parents=True, exist_ok=True)
    
    # Blind file formatting
    blind_df = final_sample[['original_question', 'answers']].copy()
    blind_df['assigned_intent'] = ""
    blind_df['genuinely_out_of_scope'] = ""
    blind_df['ambiguous'] = ""
    blind_df['suggested_new_intent'] = ""
    
    blind_df.to_csv(OUT_BLIND, index=False)
    print(f"Blind labeling file written to {OUT_BLIND}")
    
    # Scoring file formatting
    scoring_df = final_sample[['original_question', 'answers', 'heuristic_intent', 'duplicate_count']].copy()
    scoring_df.to_csv(OUT_SCORING, index=False)
    print(f"Scoring file written to {OUT_SCORING}")
    
    # Generate JSONL of all data (for later usage after labeling confirms heuristics)
    with open(OUT_JSONL, "w", encoding="utf-8") as f:
        for _, row in canonical_df.iterrows():
            record = {
                "utterance": row["normalized_question"],
                "gold_intent": row["heuristic_intent"],
                "kcc_ans_context": row["answers"],
                "duplicate_count": row["duplicate_count"]
            }
            f.write(json.dumps(record) + "\n")
            
if __name__ == "__main__":
    main()
