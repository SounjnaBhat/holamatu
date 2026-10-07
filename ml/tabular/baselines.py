import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
MODELS_DIR = BASE_DIR / 'ml' / 'export' / 'tabular'

def export_baselines():
    # Mocking baselines since actual yield data is insufficient
    baselines = {
        "climatology_mean": 4500,
        "moving_average_5yr": 4650,
        "trend_adjustment_per_year": 50
    }
    
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    with open(MODELS_DIR / 'baselines.json', 'w') as f:
        json.dump(baselines, f, indent=2)
        
    print(f"Baselines exported to {MODELS_DIR}/baselines.json")

if __name__ == "__main__":
    export_baselines()
