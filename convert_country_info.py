import pandas as pd
import json

import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

def extract_flag_url(value):
    if not isinstance(value, str):
        return ""
    
    match = re.search(r'src=["\'](.*?)["\']', value)
    return match.group(1) if match else ""

def upgrade_flag_url(url):
    return url.replace("/w40/", "/w320/")

df_en = pd.read_excel(BASE_DIR / "country_info.xlsx", sheet_name="country_en", engine="openpyxl")
df_ru = pd.read_excel(BASE_DIR / "country_info.xlsx", sheet_name="country_ru", engine="openpyxl")

df_en.columns = [c.strip().lower() for c in df_en.columns]
df_ru.columns = [c.strip().lower() for c in df_ru.columns]

for df in (df_en, df_ru):
    for col in df.columns:
        df[col] = df[col].astype(str).str.strip()
    df.replace({"nan": "", "NaN": ""}, inplace=True)

rows = []

for i in range(len(df_en)):
    en = df_en.iloc[i].to_dict()
    ru = df_ru.iloc[i].to_dict()

    rows.append({
        # English
        "country_en": en.get("country", ""),
        "country_letter_en": en.get("country_letter", ""),
        "capital_en": en.get("capital", ""),
        "capital_letter_en": en.get("capital_letter", ""),
        "continent_en": en.get("continent", ""),

        # Russian (true independent indexing)
        "country_ru": ru.get("country", ""),
        "country_letter_ru": ru.get("country_letter", ""),
        "capital_ru": ru.get("capital", ""),
        "capital_letter_ru": ru.get("capital_letter", ""),
        "continent_ru": ru.get("continent", ""),

        # meta
        "country_code": en.get("country_code", ""),
        "un_recognised": en.get("un_recognised", ""),
        "flagImage": upgrade_flag_url(extract_flag_url(en.get("flag", "")))
    })

with open(BASE_DIR / "quiz_data.json", "w", encoding="utf-8") as f:
    json.dump({"countries": rows}, f, ensure_ascii=False, indent=2)

print("quiz_data.json written correctly for bilingual indexing")