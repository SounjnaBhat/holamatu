import json
import os
import unicodedata
from pathlib import Path

def export_fixtures():
    try:
        from transformers import AutoTokenizer
    except ImportError:
        print("transformers not installed. Run this in an environment with transformers installed.")
        return

    print("Loading MuRIL Tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained("google/muril-base-cased")
    
    BASE_DIR = Path(__file__).resolve().parent.parent.parent
    CORPUS_PATH = BASE_DIR / 'ml' / 'golden' / 'corpus.jsonl'
    OUT_DIR = BASE_DIR / 'packages' / 'core' / 'test' / 'fixtures'
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    
    OUT_PATH = OUT_DIR / 'tokenizer_parity.json'
    VOCAB_PATH = OUT_DIR / 'vocab.json'
    
    print("Exporting vocabulary...")
    with open(VOCAB_PATH, 'w', encoding='utf-8') as f:
        json.dump(tokenizer.vocab, f, ensure_ascii=False)
    
    adversarial_texts = [
        "🚜🌾", # emoji
        "neeruಹಾಕಬೇಕಾ", # mixed script mid-word
        "ಬಿಸಿ\u200Cಇದೆ", # ZWNJ
        "೧೨೩೪೫", # Kannada numerals
        "...,,!!?", # repeated punctuation
        "a" * 500, # 500 character utterance
        "", # empty string
        "This is an english sentence with CAsE sEnSiTiViTy.",
        "ಇದು ಕನ್ನಡ ಸಾಲು."
    ]
    
    fixtures = []
    
    # Golden corpus
    if CORPUS_PATH.exists():
        with open(CORPUS_PATH, 'r', encoding='utf-8') as f:
            for line in f:
                if not line.strip(): continue
                text = json.loads(line).get('text', '')
                if text:
                    text = unicodedata.normalize('NFC', text)
                    encoded = tokenizer(text)
                    fixtures.append({
                        "text": text,
                        "tokens": tokenizer.convert_ids_to_tokens(encoded.input_ids),
                        "input_ids": encoded.input_ids
                    })
                    
    # Adversarial
    for text in adversarial_texts:
        encoded = tokenizer(text)
        fixtures.append({
            "text": text,
            "tokens": tokenizer.convert_ids_to_tokens(encoded.input_ids),
            "input_ids": encoded.input_ids
        })
        
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(fixtures, f, ensure_ascii=False, indent=2)
        
    print(f"Exported {len(fixtures)} fixtures to {OUT_PATH}")

if __name__ == "__main__":
    export_fixtures()
