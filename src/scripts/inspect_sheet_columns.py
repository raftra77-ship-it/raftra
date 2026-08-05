import urllib.request
import csv
import io
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

GOOGLE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1aV0JVDriVZNxXt8C2Tj7X6yV0eiHRdwlez36xAjCyDw/export?format=csv"

req = urllib.request.Request(GOOGLE_SHEET_CSV_URL, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as resp:
    content = resp.read().decode('utf-8', errors='ignore')

reader = csv.reader(io.StringIO(content))
rows = list(reader)

print("=== HEADER COLUMNS ===")
if rows:
    for idx, col in enumerate(rows[0]):
        print(f"Col {idx}: {col}")

print("\n=== CREATOR ROWS AND PRICING COLUMNS ===")
for idx, r in enumerate(rows[1:], 1):
    name = r[2] if len(r) > 2 else ""
    brand = r[3] if len(r) > 3 else ""
    all_cols = {f"Col_{i}_{rows[0][i] if i < len(rows[0]) else ''}": r[i] for i in range(len(r))}
    print(f"\n--- Row {idx}: {name} ({brand}) ---")
    for i, val in enumerate(r):
        if val.strip():
            header_name = rows[0][i] if i < len(rows[0]) else f"Col {i}"
            print(f"  [{i}] {header_name}: {val}")
