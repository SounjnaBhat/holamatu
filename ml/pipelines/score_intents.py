import pandas as pd
from sklearn.metrics import cohen_kappa_score
from pathlib import Path
import sys

BLIND_PATH = Path("ml/golden/sample_300_blind.csv")
SCORING_PATH = Path("ml/golden/sample_300_scoring.csv")
OUT_REPORT = Path("docs/annotation_quality.md")

def main():
    if not BLIND_PATH.exists() or not SCORING_PATH.exists():
        print("Error: Missing sample CSV files.")
        sys.exit(1)
        
    blind_df = pd.read_csv(BLIND_PATH)
    scoring_df = pd.read_csv(SCORING_PATH)
    
    # Check if user has labeled the data
    labeled_count = blind_df['assigned_intent'].notna().sum()
    if labeled_count == 0:
        print("\n[ERROR] No labels found in sample_300_blind.csv!")
        print("Please open the file and fill out the 'assigned_intent' column for each row before scoring.")
        sys.exit(1)
        
    print(f"Loaded {labeled_count} human-labeled rows.")
    
    # Merge on original_question to align safely
    merged_df = pd.merge(blind_df, scoring_df[['original_question', 'heuristic_intent']], on='original_question', how='inner')
    
    # Filter to only the rows that were actually labeled
    labeled_df = merged_df[merged_df['assigned_intent'].notna()].copy()
    
    # Format labels to lowercase to ensure matching
    human_labels = labeled_df['assigned_intent'].str.strip().str.lower()
    heuristic_labels = labeled_df['heuristic_intent'].str.strip().str.lower()
    
    kappa = cohen_kappa_score(human_labels, heuristic_labels)
    
    print(f"\nHeuristic vs Human Agreement (Cohen's Kappa): {kappa:.3f}")
    
    # Output to markdown
    OUT_REPORT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_REPORT, "w", encoding="utf-8") as f:
        f.write("# Annotation Quality Report (T4.5 / T1.6)\n\n")
        f.write(f"**Rows evaluated**: {labeled_count}\n")
        f.write(f"**Cohen's Kappa (Heuristic vs Human)**: {kappa:.3f}\n\n")
        
        if kappa < 0.7:
            f.write("## ⚠️ Warning: Low Agreement\n")
            f.write("The agreement score is below 0.7. This means the heuristic keyword matcher is not reliable enough to generate training labels. It should only be used for pre-annotation (which must be hand-corrected).\n")
        else:
            f.write("## ✅ Good Agreement\n")
            f.write("The agreement score is >= 0.7. The heuristics are reasonably aligned with human judgment.\n")
            
        # List any suggested new intents
        new_intents = blind_df[blind_df['suggested_new_intent'].notna()]['suggested_new_intent'].unique()
        if len(new_intents) > 0:
            f.write("\n## Suggested New Intents Discovered\n")
            for ni in new_intents:
                f.write(f"- {ni}\n")
                
    print(f"\nReport written to {OUT_REPORT}")
    
if __name__ == "__main__":
    main()
