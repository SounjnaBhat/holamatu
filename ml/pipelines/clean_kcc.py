import pandas as pd
import re
import json
from pathlib import Path
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

# Config
DATA_PATH = Path("data/raw/kcc/questionsv4.csv")
OUT_JSONL = Path("ml/golden/kcc_seed.jsonl")
OUT_VALIDATION = Path("docs/intent_validation.md")

# Intent Taxonomy mapping rules
INTENT_RULES = {
    "sowing_window": r"\b(sow|sowing|when to sow|planting time)\b",
    "variety_recommendation": r"\b(variety|hybrid|seed selection|which seed)\b",
    "seed_rate_spacing": r"\b(seed rate|spacing|how much seed)\b",
    "fertilizer_dose": r"\b(fertilizer|urea|dap|potash|mop|ssp|nutrient|manure)\b",
    "irrigation_advice": r"\b(irrigation|water|watering)\b",
    "weed_management": r"\b(weed|weeds|weedicide|herbicide)\b",
    "pest_identification": r"\b(identify pest|what insect|what pest)\b", # fallback to management if ambiguous
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
    
    # collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text

def map_intent(text):
    for intent, pattern in INTENT_RULES.items():
        if re.search(pattern, text):
            return intent
    return "out_of_scope"

def main():
    print(f"Loading {DATA_PATH}...")
    df = pd.read_csv(DATA_PATH, names=['questions', 'answers'], header=0)
    print(f"Total rows: {len(df)}")
    
    # Filter for maize/corn
    print("Filtering for maize...")
    df = df[df['questions'].str.contains(r'\b(maize|corn|makka)\b', case=False, na=False)].copy()
    print(f"Rows after filtering: {len(df)}")
    
    # Clean texts
    print("Cleaning operator boilerplate...")
    df['cleaned_question'] = df['questions'].apply(clean_text)
    
    # Deduplicate using TF-IDF + Cosine > 0.95
    print("Deduplicating...")
    texts = df['cleaned_question'].tolist()
    vectorizer = TfidfVectorizer(min_df=1)
    tfidf_matrix = vectorizer.fit_transform(texts)
    
    kept_indices = []
    dropped = 0
    sim_matrix = cosine_similarity(tfidf_matrix)
    visited = set()
    
    for i in range(len(texts)):
        if i in visited:
            continue
        kept_indices.append(i)
        visited.add(i)
        similar = np.where(sim_matrix[i] > 0.95)[0]
        for sim_idx in similar:
            if sim_idx != i and sim_idx not in visited:
                visited.add(sim_idx)
                dropped += 1
                
    df = df.iloc[kept_indices].copy()
    print(f"Rows after dedup (dropped {dropped}): {len(df)}")
    
    # Map intents
    print("Mapping intents...")
    df['mapped_intent'] = df['cleaned_question'].apply(map_intent)
    
    intent_counts = df['mapped_intent'].value_counts()
    print("\nIntent Distribution:")
    print(intent_counts)
    
    # Generate Validation Doc
    OUT_VALIDATION.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_VALIDATION, "w", encoding="utf-8") as f:
        f.write("# KCC Intent Validation (T1.6)\n\n")
        f.write("Based on the Kaggle KCC dataset (filtered for maize), we mapped queries to our 15-intent taxonomy using keyword heuristics.\n\n")
        f.write("## Frequency Distribution\n\n")
        f.write("| Intent | Count |\n")
        f.write("|---|---|\n")
        for intent, count in intent_counts.items():
            f.write(f"| `{intent}` | {count} |\n")
            
        f.write("\n## Review and Next Steps\n")
        f.write("Review the distribution above. If it aligns with expectations, we can finalize the mapping. The output JSONL is ready for use.\n")
        
    print(f"Validation report written to {OUT_VALIDATION}")
    
    # Generate JSONL
    OUT_JSONL.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_JSONL, "w", encoding="utf-8") as f:
        for _, row in df.iterrows():
            record = {
                "utterance": row["cleaned_question"],
                "gold_intent": row["mapped_intent"],
                "kcc_ans_context": row["answers"]
            }
            f.write(json.dumps(record) + "\n")
            
    print(f"Dataset written to {OUT_JSONL}")

if __name__ == "__main__":
    main()
