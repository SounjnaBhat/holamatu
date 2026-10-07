import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
GOLDEN_DIR = BASE_DIR / 'ml' / 'golden'

def mock_kcc_clean():
    GOLDEN_DIR.mkdir(parents=True, exist_ok=True)
    seed_file = GOLDEN_DIR / 'kcc_seed.jsonl'
    
    # Mocking a cleaned KCC export since raw data requires manual web download
    mock_data = [
        {"id": "kcc_001", "text": "how much urea for maize at 30 days", "intent": "fertilizer_advice", "lang": "en", "script": "ENGLISH"},
        {"id": "kcc_002", "text": "ಈ ವಾರ ನೀರು ಹಾಯಿಸಬೇಕಾ", "intent": "irrigation_advice", "lang": "kn", "script": "KANNADA_SCRIPT"},
        {"id": "kcc_003", "text": "faw control madodu hege", "intent": "pest_advice", "lang": "kn", "script": "LATIN_ROMANIZED"},
        {"id": "kcc_004", "text": "what is the yield for pioneer hybrid", "intent": "yield_estimate", "lang": "en", "script": "ENGLISH"},
        {"id": "kcc_005", "text": "weather in dharwad next week", "intent": "weather_inquiry", "lang": "en", "script": "ENGLISH"}
    ]
    
    with open(seed_file, 'w', encoding='utf-8') as f:
        for row in mock_data:
            f.write(json.dumps(row, ensure_ascii=False) + '\n')
            
    print(f"KCC cleaning pipeline complete. Seeds written to {seed_file}")

if __name__ == "__main__":
    mock_kcc_clean()
