import os
import shutil
import urllib.request
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / 'data' / 'raw'
SUPPLIED_EXCEL = BASE_DIR / '15.05.2026.xlsx'

def ensure_dirs():
    for sub in ['kcc', 'icrisat', 'apy_season', 'openmeteo', 'nasapower', 'supplied', 'agromet']:
        (DATA_DIR / sub).mkdir(parents=True, exist_ok=True)

def fetch_open_meteo():
    print("Fetching Open-Meteo data for Dharwad...")
    url = (
        "https://archive-api.open-meteo.com/v1/archive?"
        "latitude=15.4589&longitude=75.0078&"
        "start_date=1990-01-01&end_date=2023-12-31&"
        "daily=temperature_2m_max,temperature_2m_min,precipitation_sum,"
        "relative_humidity_2m_mean,wind_speed_10m_max,shortwave_radiation_sum&"
        "timezone=Asia%2FKolkata"
    )
    dest = DATA_DIR / 'openmeteo' / 'dharwad_weather.json'
    try:
        urllib.request.urlretrieve(url, dest)
        print("Open-Meteo fetch complete.")
    except Exception as e:
        print(f"Error fetching Open-Meteo: {e}")

def copy_supplied_data():
    if SUPPLIED_EXCEL.exists():
        print(f"Copying supplied dataset {SUPPLIED_EXCEL.name}")
        shutil.copy(SUPPLIED_EXCEL, DATA_DIR / 'supplied' / SUPPLIED_EXCEL.name)
    else:
        print("Supplied dataset not found.")

if __name__ == "__main__":
    ensure_dirs()
    fetch_open_meteo()
    copy_supplied_data()
    print("Ingest pipeline (Step 1-6 stubs) complete. (Note: KCC, ICRISAT, APY need manual download via browser)")
