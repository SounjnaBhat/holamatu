import json
import random
from pathlib import Path
from sklearn.metrics import f1_score, roc_auc_score
import numpy as np

BASE_DIR = Path(__file__).resolve().parent.parent.parent
CORPUS_PATH = BASE_DIR / 'ml' / 'golden' / 'corpus.jsonl'

INTENTS = [
    'irrigation_advice', 'pest_advice', 'fertilizer_advice', 
    'explain_why', 'alternative', 'challenge', 'consequence', 
    'greeting_smalltalk', 'market_price', 'provide_info'
]

def load_test_data():
    if not CORPUS_PATH.exists():
        return []
    data = []
    with open(CORPUS_PATH, 'r', encoding='utf-8') as f:
        for line in f:
            if not line.strip(): continue
            row = json.loads(line)
            if row.get('split') == 'test' or 'test' in str(row.get('split', '')):
                data.append(row)
    return data

def random_baseline(data):
    y_true_intent = []
    y_pred_intent = []
    scripts = []
    
    y_true_ood = []
    y_scores_ood = []
    
    y_true_slots = []
    y_pred_slots = []
    
    for row in data:
        true_intent = row.get('intent', 'unknown')
        scripts.append(row.get('script', 'ENGLISH'))
        
        # Intent metrics
        y_true_intent.append(true_intent)
        y_pred_intent.append(random.choice(INTENTS))
        
        # OOD metrics
        is_ood = 1 if true_intent == 'out_of_scope' else 0
        y_true_ood.append(is_ood)
        y_scores_ood.append(random.uniform(0, 1)) # OOD anomaly score (higher means more likely OOD)
        
        # Slot metrics
        slots = row.get('slots', [])
        for s in slots:
            y_true_slots.append(s['slot'])
            y_pred_slots.append(random.choice(['pest_name', 'crop_stage', 'date_range', 'O']))
            
    return y_true_intent, y_pred_intent, scripts, y_true_ood, y_scores_ood, y_true_slots, y_pred_slots

def run_evaluation():
    print("Evaluating Model: RANDOM BASELINE (SMOKE TEST)")
    data = load_test_data()
    
    if len(data) == 0:
        print("No test data found in corpus.jsonl. Cannot evaluate.")
        return
        
    y_true_intent, y_pred_intent, scripts, y_true_ood, y_scores_ood, y_true_slots, y_pred_slots = random_baseline(data)
    
    # E1: Overall Intent Macro-F1
    overall_f1 = f1_score(y_true_intent, y_pred_intent, average='macro', zero_division=0)
    
    # E2: Romanized Intent Macro-F1
    roman_true = [y for y, s in zip(y_true_intent, scripts) if s == 'LATIN_ROMANIZED']
    roman_pred = [p for p, s in zip(y_pred_intent, scripts) if s == 'LATIN_ROMANIZED']
    roman_f1 = f1_score(roman_true, roman_pred, average='macro', zero_division=0) if roman_true else 0.0
    
    # E3: Kannada Script Intent Macro-F1
    kn_true = [y for y, s in zip(y_true_intent, scripts) if s == 'KANNADA_SCRIPT']
    kn_pred = [p for p, s in zip(y_pred_intent, scripts) if s == 'KANNADA_SCRIPT']
    kn_f1 = f1_score(kn_true, kn_pred, average='macro', zero_division=0) if kn_true else 0.0
    
    # E4: OOD AUROC
    try:
        if sum(y_true_ood) > 0 and sum(y_true_ood) < len(y_true_ood):
            ood_auroc = roc_auc_score(y_true_ood, y_scores_ood)
        else:
            ood_auroc = 0.0
    except ValueError:
        ood_auroc = 0.0
        
    # E5: Slot F1, micro
    slot_f1 = f1_score(y_true_slots, y_pred_slots, average='micro', zero_division=0) if y_true_slots else 0.0
    
    # Synthetic Ratio
    synthetic_count = sum(1 for row in data if row.get('source') == 'synthetic')
    synthetic_ratio = synthetic_count / len(data) if len(data) > 0 else 0
    
    print("\n--- Gate Results ---")
    print(f"E1 Intent macro-F1 (overall): {overall_f1:.4f} [Target: >= 0.90] -> {'PASS' if overall_f1 >= 0.90 else 'FAIL'}")
    print(f"E2 Intent macro-F1 (romanized): {roman_f1:.4f} [Target: >= 0.85] -> {'PASS' if roman_f1 >= 0.85 else 'FAIL'}")
    print(f"E3 Intent macro-F1 (kannada): {kn_f1:.4f} [Target: >= 0.88] -> {'PASS' if kn_f1 >= 0.88 else 'FAIL'}")
    print(f"E4 OOD AUROC: {ood_auroc:.4f} [Target: >= 0.85] -> {'PASS' if ood_auroc >= 0.85 else 'FAIL'}")
    print(f"E5 Slot micro-F1: {slot_f1:.4f} [Target: >= 0.85] -> {'PASS' if slot_f1 >= 0.85 else 'FAIL'}")
    
    print(f"\nSynthetic Ratio: {synthetic_ratio:.2%}")
    print("\n--- Confusion Matrix (Random Baseline) ---")
    try:
        from sklearn.metrics import confusion_matrix
        cm = confusion_matrix(y_true_intent, y_pred_intent, labels=INTENTS)
        for i, row in enumerate(cm):
            print(f"{INTENTS[i][:15]:<15} | " + " ".join([f"{x:>3}" for x in row]))
    except:
        pass
        
    print("\nNote: E10 (OOV rate) and E11 (INT8 drop) are measured during training/export.")

if __name__ == "__main__":
    run_evaluation()
