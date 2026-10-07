import pandas as pd
from pathlib import Path
import json

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / 'data' / 'raw'
SUPPLIED_EXCEL = DATA_DIR / 'supplied' / '15.05.2026.xlsx'
AUDIT_FILE = BASE_DIR / 'data' / 'schema_audit.md'

def audit_excel():
    if not SUPPLIED_EXCEL.exists():
        return "Supplied excel file not found.\n"
    
    try:
        xls = pd.ExcelFile(SUPPLIED_EXCEL)
        out = []
        out.append(f"### Supplied Data ({SUPPLIED_EXCEL.name})\n")
        out.append(f"Sheets: {', '.join(xls.sheet_names)}\n\n")
        
        for sheet in xls.sheet_names:
            df = pd.read_excel(xls, sheet_name=sheet)
            out.append(f"#### Sheet: {sheet}\n")
            out.append(f"- **Row count**: {len(df)}\n")
            out.append(f"- **Columns**: {', '.join(df.columns)}\n\n")
            
            # Missingness
            missing = df.isnull().sum()
            out.append("- **Missingness**:\n")
            for col in df.columns:
                pct = (missing[col] / len(df)) * 100
                if pct > 0:
                    out.append(f"  - `{col}`: {pct:.1f}%\n")
            out.append("\n")
            
            # Types
            out.append("- **Types**:\n")
            for col in df.columns:
                out.append(f"  - `{col}`: {df[col].dtype}\n")
            out.append("\n")
            
        return "".join(out)
    except Exception as e:
        return f"Error reading Excel: {e}\n"

def audit_open_meteo():
    path = DATA_DIR / 'openmeteo' / 'dharwad_weather.json'
    if not path.exists():
        return "Open-Meteo data not found.\n"
    
    with open(path, 'r') as f:
        data = json.load(f)
        
    daily = data.get('daily', {})
    time = daily.get('time', [])
    
    out = []
    out.append("### Open-Meteo ERA5 Data\n")
    out.append(f"- **Row count (days)**: {len(time)}\n")
    if time:
        out.append(f"- **Temporal span**: {time[0]} to {time[-1]}\n")
    out.append(f"- **Columns/Variables**: {', '.join(daily.keys())}\n\n")
    
    return "".join(out)

def generate_audit():
    out = []
    out.append("# Data Schema Audit (M1)\n\n")
    out.append(audit_excel())
    out.append(audit_open_meteo())
    
    out.append("## M1 Triage Verdict (T1.4)\n")
    out.append("> **Pending human review**. Based on the row counts and available fields in the supplied dataset, we must select the yield modelling tier from doc 02 §4.5.\n")
    
    AUDIT_FILE.parent.mkdir(exist_ok=True)
    with open(AUDIT_FILE, 'w', encoding='utf-8') as f:
        f.write("".join(out))
    
    print(f"Audit written to {AUDIT_FILE.relative_to(BASE_DIR)}")

if __name__ == "__main__":
    generate_audit()
