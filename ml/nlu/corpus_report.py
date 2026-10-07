import json
from pathlib import Path
from collections import Counter

BASE_DIR = Path(__file__).resolve().parent.parent.parent
CORPUS_PATH = BASE_DIR / 'ml' / 'golden' / 'corpus.jsonl'
GOLDEN_SET_PATH = BASE_DIR / 'ml' / 'golden' / 'golden_set.jsonl'

def report():
    if not CORPUS_PATH.exists():
        print("corpus.jsonl not found.")
        return

    total = 0
    sources = Counter()
    scripts = Counter()
    intents = Counter()
    
    with open(CORPUS_PATH, 'r', encoding='utf-8') as f:
        for line in f:
            if not line.strip(): continue
            total += 1
            data = json.loads(line)
            sources[data.get('source', 'unknown')] += 1
            scripts[data.get('script', 'unknown')] += 1
            intents[data.get('intent', 'unknown')] += 1

    print("--- Corpus Report ---")
    print(f"Total Rows: {total}")
    
    print("\n--- Rows by Source ---")
    for s, count in sources.items():
        print(f"  {s}: {count}")
        
    print("\n--- Rows by Script ---")
    for s, count in scripts.items():
        print(f"  {s}: {count}")
        
    print("\n--- Rows by Intent ---")
    for i, count in intents.items():
        print(f"  {i}: {count}")

    print("\n--- Golden Set Status ---")
    if GOLDEN_SET_PATH.exists():
        print(f"golden_set.jsonl exists. Frozen: Yes.")
    else:
        # Check if corpus.jsonl has test split instead
        test_count = sum(1 for line in open(CORPUS_PATH, 'r', encoding='utf-8') if json.loads(line).get('split') == 'test')
        print(f"golden_set.jsonl DOES NOT exist. Found {test_count} rows with split='test' in corpus.jsonl.")
        
    print("\nOOV Rate: Not calculable yet (requires vocabulary pruning first).")

if __name__ == "__main__":
    report()
