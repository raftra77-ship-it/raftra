import urllib.request
import csv
import io
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

GOOGLE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1aV0JVDriVZNxXt8C2Tj7X6yV0eiHRdwlez36xAjCyDw/export?format=csv"

req = urllib.request.Request(GOOGLE_SHEET_CSV_URL, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as resp:
    content = resp.read().decode('utf-8', errors='ignore')

reader = csv.reader(io.StringIO(content))
rows = list(reader)

print("=== CREATOR UGC AVAILABILITY CHECK ===")
for idx, r in enumerate(rows[1:], 1):
    name = r[2] if len(r) > 2 else ""
    brand = r[3] if len(r) > 3 else ""
    col11 = r[11] if len(r) > 11 else ""
    col12 = r[12] if len(r) > 12 else ""
    text_combined = (col11 + " " + col12).lower()
    is_ugc = 'ugc' in text_combined or 'video' in text_combined or 'reel' in text_combined
    print(f"Row {idx}: {name} ({brand}) -> UGC Mentioned: {is_ugc} | Raw text snippet: {col11[:60]}... | Col12: {col12}")
