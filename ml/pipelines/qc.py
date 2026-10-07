import json
import pandas as pd
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
OPENMETEO_FILE = BASE_DIR / 'data' / 'raw' / 'openmeteo' / 'dharwad_weather.json'
QC_REPORT_FILE = BASE_DIR / 'data' / 'reports' / 'qc_report.md'
PROCESSED_DIR = BASE_DIR / 'data' / 'processed'

def perform_qc():
    if not OPENMETEO_FILE.exists():
        print("Weather data not found.")
        return
    
    with open(OPENMETEO_FILE, 'r') as f:
        data = json.load(f)
    
    df = pd.DataFrame(data['daily'])
    df['time'] = pd.to_datetime(df['time'])
    
    report = ["# Weather Quality Control Report (T2.1)\n"]
    
    # 1. Range gates
    # tmax in [10, 48], tmin in [2, 32], tmin < tmax, rainfall in [0, 400], RH in [5, 100]
    out_of_range_tmax = df[~df['temperature_2m_max'].between(10, 48)]
    out_of_range_tmin = df[~df['temperature_2m_min'].between(2, 32)]
    inverted_temp = df[df['temperature_2m_min'] >= df['temperature_2m_max']]
    out_of_range_rain = df[~df['precipitation_sum'].between(0, 400)]
    out_of_range_rh = df[~df['relative_humidity_2m_mean'].between(5, 100)]
    
    report.append("## Range Gates\n")
    report.append(f"- Invalid Tmax (>48 or <10): {len(out_of_range_tmax)}\n")
    report.append(f"- Invalid Tmin (>32 or <2): {len(out_of_range_tmin)}\n")
    report.append(f"- Tmin >= Tmax: {len(inverted_temp)}\n")
    report.append(f"- Invalid Rainfall (>400 or <0): {len(out_of_range_rain)}\n")
    report.append(f"- Invalid RH (>100 or <5): {len(out_of_range_rh)}\n\n")
    
    # 2. Persistence check (stuck sensor)
    report.append("## Persistence Check\n")
    df['tmax_diff'] = df['temperature_2m_max'].diff()
    stuck_runs = df['tmax_diff'].eq(0).astype(int).groupby(df['tmax_diff'].ne(0).cumsum()).sum()
    stuck_max = stuck_runs.max() if not stuck_runs.empty else 0
    report.append(f"- Max consecutive days with identical Tmax: {stuck_max}\n\n")
    
    # Save cleaned / gap-filled series
    df.loc[~df['temperature_2m_max'].between(10, 48), 'temperature_2m_max'] = pd.NA
    df.loc[~df['temperature_2m_min'].between(2, 32), 'temperature_2m_min'] = pd.NA
    df['temperature_2m_max'] = df['temperature_2m_max'].interpolate(method='linear')
    df['temperature_2m_min'] = df['temperature_2m_min'].interpolate(method='linear')
    
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    df.drop(columns=['tmax_diff']).to_csv(PROCESSED_DIR / 'weather_qc.csv', index=False)
    
    with open(QC_REPORT_FILE, 'w') as f:
        f.write("".join(report))
        
    print(f"QC complete. Report saved to {QC_REPORT_FILE.relative_to(BASE_DIR)}")

if __name__ == "__main__":
    perform_qc()
