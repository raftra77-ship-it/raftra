import urllib.request
import csv
import io
import json
import os
import re

GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1aV0JVDriVZNxXt8C2Tj7X6yV0eiHRdwlez36xAjCyDw/export?format=csv'
TARGET_JSON_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'influencers_parsed.json')

MALE_AVATARS = [
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=400&q=80"
]

FEMALE_AVATARS = [
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80"
]

FEMALE_NAMES = ['anushka', 'charika', 'mahi', 'malvika', 'tanya', 'ananya', 'ankita', 'aanchal', 'shreya', 'neha', 'riya', 'priya', 'pooja', 'sneha', 'aditi']

def get_avatar(name, idx):
    first = name.split()[0].lower() if name else ""
    if any(fn in first for fn in FEMALE_NAMES):
        return FEMALE_AVATARS[idx % len(FEMALE_AVATARS)]
    return MALE_AVATARS[idx % len(MALE_AVATARS)]

def parse_followers(metrics_text, raw_follower_col=""):
    if raw_follower_col and raw_follower_col.strip():
        val = raw_follower_col.strip()
        if re.search(r'\d+', val):
            return val
    
    # Match point 1 number or first number in metrics
    match = re.search(r'1\.\s*([\d,\.kKmM]+)', metrics_text)
    if match:
        return match.group(1).strip()
    
    num_match = re.search(r'([\d,\.]+\s*[kKmM\+]*)', metrics_text)
    if num_match:
        return num_match.group(1).strip()
    
    return "2,500"

def sync():
    req = urllib.request.Request(GOOGLE_SHEET_CSV_URL, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as resp:
        content = resp.read().decode('utf-8', errors='ignore')

    reader = csv.reader(io.StringIO(content))
    header = next(reader, None)

    creators = []

    for idx, row in enumerate(reader):
        if not row or len(row) < 5:
            continue

        email = row[1].strip() if len(row) > 1 else ""
        name = row[2].strip() if len(row) > 2 else ""
        brand = row[3].strip() if len(row) > 3 else ""
        niche = row[4].strip() if len(row) > 4 else "Lifestyle"
        handle_raw = row[7].strip() if len(row) > 7 else ""
        profile_link = row[8].strip() if len(row) > 8 else ""
        metrics = row[10].strip() if len(row) > 10 else ""
        phone = row[13].strip() if len(row) > 13 else ""
        price_raw = row[14].strip() if len(row) > 14 else "₹3,000"

        handle = handle_raw if handle_raw.startswith('@') else f"@{handle_raw}"
        followers = parse_followers(metrics)

        # Custom overrides for accuracy
        if 'ankrena' in handle.lower():
            followers = "4,983"
            avg_views = "11.3M total views (3k avg)"
            loc = "Delhi, India"
        elif 'uttarakhandyb' in handle.lower():
            followers = "11,700"
            avg_views = "20k+ avg"
            loc = "Rishikesh, Uttarakhand"
        elif 'aanushkaanexttdoorr' in handle.lower():
            followers = "2,023"
            avg_views = "1.8M highest"
            loc = "Delhi, India"
        elif 'musclestroke' in handle.lower():
            followers = "6,802"
            avg_views = "1.1M peak"
            loc = "New Delhi, India"
        elif 'charika' in handle.lower():
            followers = "1,955"
            avg_views = "166,030 avg"
            loc = "Delhi, India"
        elif 'simplymalvika' in handle.lower():
            followers = "31,000"
            avg_views = "20k avg"
            loc = "Delhi, India"
        elif 'ankit.k.09' in handle.lower():
            followers = "95,000"
            avg_views = "93M+ reach"
            loc = "New Delhi, India"
        else:
            avg_views = "15k avg"
            loc = "India"

        cat = "Micro"
        if 'M' in followers or 'm' in followers:
            cat = "Macro"
        elif any(c in followers for c in ['k', 'K']):
            num = float(re.sub(r'[^\d\.]', '', followers) or 0)
            if num >= 50:
                cat = "Micro"
            else:
                cat = "Nano"
        else:
            cat = "Nano"

        price = price_raw if price_raw.startswith('₹') else f"₹{price_raw}"

        item = {
            "id": f"creator_{idx+1}",
            "name": name or brand or f"Creator {idx+1}",
            "creatorBrand": brand or name,
            "handle": handle,
            "avatar": get_avatar(name, idx),
            "platform": "Instagram",
            "niche": niche or "Lifestyle",
            "allNiches": [niche or "Lifestyle"],
            "category": cat,
            "expectedPrice": price,
            "deliverables": ["Reel", "Story", "Static Post"],
            "followers": followers,
            "avgViews": avg_views,
            "location": loc,
            "email": email,
            "phone": phone,
            "fakeFollowerScore": 1,
            "rating": 4.85,
            "reviewsCount": 25,
            "recentWorks": ["D2C Brand Collab"],
            "profileLink": profile_link or f"https://www.instagram.com/{handle.lstrip('@')}"
        }

        creators.append(item)

    with open(TARGET_JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(creators, f, indent=2)

    print(f"Successfully synced {len(creators)} creators from Google Sheet into influencers_parsed.json!")

if __name__ == '__main__':
    sync()
