import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
CORPUS_FILE = BASE_DIR / 'ml' / 'golden' / 'corpus.jsonl'
PROCESSED_DIR = BASE_DIR / 'data' / 'processed'

def process_corpus():
    if not CORPUS_FILE.exists():
        print("Corpus not found.")
        return
        
    train_data = []
    test_data = []
    
    with open(CORPUS_FILE, 'r', encoding='utf-8') as f:
        for line in f:
            row = json.loads(line)
            if row['split'] == 'train':
                train_data.append(row)
            else:
                test_data.append(row)
                
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    
    with open(PROCESSED_DIR / 'train.jsonl', 'w', encoding='utf-8') as f:
        for row in train_data:
            f.write(json.dumps(row) + '\n')
            
    with open(PROCESSED_DIR / 'test.jsonl', 'w', encoding='utf-8') as f:
        for row in test_data:
            f.write(json.dumps(row) + '\n')
            
    print(f"Corpus processed. Train: {len(train_data)}, Test: {len(test_data)}")

if __name__ == "__main__":
    process_corpus()
