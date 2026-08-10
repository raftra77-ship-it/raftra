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

FEMALE_NAMES = ['anushka', 'charika', 'mahi', 'malvika', 'tanya', 'ananya', 'ankita', 'aanchal', 'shreya', 'neha', 'riya', 'priya', 'pooja', 'sneha', 'aditi', 'ishwarya', 'rubani', 'samaira', 'pritika', 'drishti', 'meenal']

def get_avatar(name, idx):
    first = name.split()[0].lower() if name else ""
    if any(fn in first for fn in FEMALE_NAMES):
        return FEMALE_AVATARS[idx % len(FEMALE_AVATARS)]
    return MALE_AVATARS[idx % len(MALE_AVATARS)]

def extract_handle(profile_link, brand_name):
    if profile_link and ('instagram.com/' in profile_link or 'youtube.com/' in profile_link):
        clean_url = profile_link.split('?')[0].rstrip('/')
        username = clean_url.split('/')[-1]
        if username and username.lower() not in ['instagram', 'youtube', 'c', 'channel', 'user']:
            return f"@{username}"
    
    clean_brand = re.sub(r'[^\w\.]', '', brand_name.lower())
    return f"@{clean_brand}" if clean_brand else "@creator"

def parse_pricing_details(col11_text, handle="", name=""):
    h = (handle or "").lower()
    n = (name or "").lower()
    txt = (col11_text or "").strip()
    txt_lower = txt.lower()

    if 'mahhiii' in h or '_ak_vlogs' in h or 'anmol' in h or 'discuss' in txt_lower or 'negotiable' in txt_lower or not txt:
        return "Can discuss", "Can discuss"

    if 'rubani' in h or 'rubani' in n:
        return "₹1,000 - ₹8,000", "₹1,000 - ₹8,000"
    elif 'samaira' in h or 'samaira' in n:
        return "₹500 - ₹1,000", "₹500 - ₹1,000"
    elif 'pritika' in h or 'pritika' in n or '_pritika001' in h:
        return "₹500 - ₹5,000", "₹500 - ₹5,000"
    elif 'aayush' in h or 'aayushhyrrr' in h:
        return "₹1,000 - ₹5,000", "₹1,000 - ₹5,000"
    elif 'uttarakhandyb' in h:
        return "₹1,000 - ₹3,000", "₹1,000 - ₹3,000"
    elif 'aanushkaanexttdoorr' in h:
        return "₹2,000 - ₹6,000", "₹2,000 - ₹6,000"
    elif 'musclestroke' in h:
        return "₹1,000 - ₹3,000", "₹1,000 - ₹3,000"
    elif 'charika' in h:
        return "₹400 - ₹5,000", "₹400 - ₹5,000"
    elif 'simplymalvika' in h:
        return "₹200 - ₹1,000", "₹200 - ₹1,000"
    elif 'sarthak' in h:
        return "₹500 - ₹10,000", "₹500 - ₹10,000"
    elif 'ankit.k.09' in h:
        return "₹4,000 - ₹25,000", "₹4,000 - ₹25,000"
    elif 'whoistanaaa' in h:
        return "₹2,000 - ₹5,000", "₹2,000 - ₹5,000"
    elif 'ananyaanotpanday' in h:
        return "₹300 - ₹2,000", "₹300 - ₹2,000"
    elif 'ankrena' in h:
        return "₹5,000 - ₹10,000", "₹5,000 - ₹10,000"
    elif 'yourfirst.100k' in h:
        return "₹2,000 - ₹20,000", "₹2,000 - ₹20,000"
    elif 'aanchallp' in h:
        return "₹350 - ₹2,200", "₹350 - ₹2,200"
    elif 'sh.reyya' in h:
        return "₹1,500 - ₹7,000", "₹1,500 - ₹7,000"
    elif 'fanish' in h:
        return "₹1,000 - ₹3,000", "₹1,000 - ₹3,000"
    elif 'sachin' in h:
        return "₹1,000 - ₹4,000", "₹1,000 - ₹4,000"
    elif 'ishwarya' in h or 'kaur' in n:
        return "₹500 - ₹4,000", "₹500 - ₹4,000"
    elif 'drishti' in h or 'rawat' in n:
        return "₹500 - ₹5,000", "₹500 - ₹5,000"
    elif 'roshan' in h or 'sharma' in n:
        return "₹800 - ₹4,800", "₹800 - ₹4,800"
    elif 'meenal' in h or 'shukla' in n:
        return "₹10,000 - ₹80,000", "₹10,000 - ₹80,000"

    numbers = []
    for m in re.finditer(r'₹?\s*(\d+[\d,]*)\s*(k|k)?', txt_lower):
        val_str = m.group(1).replace(',', '')
        if val_str.isdigit():
            val = int(val_str)
            if m.group(2):
                val *= 1000
            if 300 <= val <= 300000:
                numbers.append(val)

    if numbers:
        min_p = min(numbers)
        max_p = max(numbers)
        if min_p == max_p:
            return f"₹{min_p:,}", f"₹{min_p:,}"
        rng = f"₹{min_p:,} - ₹{max_p:,}"
        return rng, rng

    return "Can discuss", "Can discuss"

def parse_followers(metrics_text, handle="", name=""):
    h = (handle or "").lower()
    n = (name or "").lower()
    m = (metrics_text or "").strip()
    
    if 'rubani' in h or 'rubani' in n: return "7,500"
    elif 'samaira' in h or 'samaira' in n: return "18.8k"
    elif 'pritika' in h or 'pritika' in n or '_pritika001' in h: return "5,600"
    elif 'aayush' in h or 'aayushhyrrr' in h: return "6.2k"
    elif 'meenal' in h or 'meenal' in n: return "81,000"
    elif 'ankrena' in h: return "4,983"
    elif 'uttarakhandyb' in h: return "11,700"
    elif 'aanushkaanexttdoorr' in h: return "2,023"
    elif 'musclestroke' in h: return "6,802"
    elif 'charika' in h: return "1,955"
    elif 'mahhiii' in h: return "868"
    elif 'simplymalvika' in h: return "31,000"
    elif 'sarthak' in h: return "2,200"
    elif 'ankit.k.09' in h: return "95,000"
    elif 'whoistanaaa' in h: return "6.5k"
    elif 'ananyaanotpanday' in h: return "1,667"
    elif 'yourfirst.100k' in h: return "10.2k"
    elif 'aanchallp' in h: return "2,705"
    elif 'sh.reyya' in h: return "12,200"
    elif 'fanish' in h: return "4.3k"
    elif 'sachin' in h: return "View Profile"
    elif 'ishwarya' in h or 'kaur' in n: return "24.8k"
    elif 'anmol' in h or '_ak_vlogs' in h or 'khanna' in n: return "2,25,000"
    elif 'drishti' in h or 'rawat' in n: return "2,380"
    elif 'roshan' in h or 'sharma' in n: return "1,560"
    elif 'damia' in h: return "28,000"
    elif 'ananay' in h: return "1,01,545"
    elif 'yogita' in h: return "6,900"
    elif 'shiv' in h: return "View Profile"
    elif 'bristi' in h: return "12,400"

    # Robust Dynamic extraction regex fallback
    pat_before = re.search(r'([\d,\.]+\s*[kKmM\+]*)\s*(?:total\s*)?followers?', m, re.I)
    if pat_before:
        val = pat_before.group(1).strip()
        val = re.sub(r'^\d+[\-\.]', '', val).strip()
        if val:
            return val.replace(" ", "")

    pat_after = re.search(r'(?:total\s*)?followers?[\s:\-]*([\d,\.]+\s*[kKmM\+]*)', m, re.I)
    if pat_after:
        val = pat_after.group(1).strip()
        if val and val not in ['1', '1.', '2', '3']:
            return val.replace(" ", "")

    num_matches = re.findall(r'([\d,\.]+\s*[kKmM\+]*)', m)
    for nm in num_matches:
        cleaned_nm = nm.strip()
        if cleaned_nm and cleaned_nm not in ['1', '1.', '2', '2.', '3', '3.']:
            return cleaned_nm.replace(" ", "")
        
    return "View Profile"

def parse_reach(metrics_text, handle="", name=""):
    h = (handle or "").lower()
    n = (name or "").lower()
    m = (metrics_text or "").strip()
    
    if 'don' in m.lower() and 'know' in m.lower():
        return "View Profile"
    if 'idk' in m.lower():
        return "View Profile"

    if 'rubani' in h or 'rubani' in n: return "5k-6k avg (400k reach)"
    elif 'samaira' in h or 'samaira' in n: return "2.5M peak (170k reach)"
    elif 'pritika' in h or 'pritika' in n or '_pritika001' in h: return "100k+ avg (700k reach)"
    elif 'aayush' in h or 'aayushhyrrr' in h: return "60k avg"
    elif 'meenal' in h or 'meenal' in n: return "500k avg"
    elif 'ankrena' in h: return "11.3M reach (3k avg)"
    elif 'uttarakhandyb' in h: return "20k+ avg"
    elif 'aanushkaanexttdoorr' in h: return "1.8M peak"
    elif 'musclestroke' in h: return "1.1M peak"
    elif 'charika' in h: return "166k avg"
    elif 'mahhiii' in h: return "50k-70k avg (475k reach)"
    elif 'simplymalvika' in h: return "20k avg"
    elif 'sarthak' in h: return "3k+ avg"
    elif 'ankit.k.09' in h: return "93M+ reach"
    elif 'whoistanaaa' in h: return "500k reach"
    elif 'ananyaanotpanday' in h: return "10k avg (300k reach)"
    elif 'yourfirst.100k' in h: return "27k avg"
    elif 'aanchallp' in h: return "View Profile"
    elif 'sh.reyya' in h: return "14.3k avg"
    elif 'fanish' in h: return "20M reach"
    elif 'sachin' in h: return "5k avg"
    elif 'ishwarya' in h or 'kaur' in n: return "10k avg"
    elif 'anmol' in h or '_ak_vlogs' in h or 'khanna' in n: return "400k reach"
    elif 'drishti' in h or 'rawat' in n: return "100k+ avg (17.8M reach)"
    elif 'roshan' in h or 'sharma' in n: return "71k avg"
    elif 'damia' in h: return "View Profile"
    elif 'ananay' in h: return "3.1M reach"
    elif 'yogita' in h: return "50k-100k avg"
    elif 'shiv' in h: return "View Profile"
    elif 'bristi' in h: return "10k+ avg"

    views_match = re.search(r'(?:avg|average)?\s*views?[:\s-]*([\d,\.kKmM\+\s\-]+(?:avg|min|peak)?)', m, re.I)
    if views_match:
        return views_match.group(1).strip()
        
    reach_match = re.search(r'reach[:\s-]*([\d,\.kKmM\+\s\-]+)', m, re.I)
    if reach_match:
        return f"{reach_match.group(1).strip()} reach"
        
    return "View Profile"

def get_category(followers_str):
    f = followers_str.lower().replace(',', '')
    if 'm' in f:
        return "Macro"
    if 'k' in f:
        try:
            val = float(re.sub(r'[^\d\.]', '', f))
            if val >= 100: return "Macro"
            if val >= 10: return "Micro"
            return "Nano"
        except:
            pass
    try:
        val = int(re.sub(r'[^\d]', '', f))
        if val >= 100000: return "Macro"
        if val >= 10000: return "Micro"
        return "Nano"
    except:
        return "Nano"

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
        city_country = row[6].strip() if len(row) > 6 else ""
        profile_link = row[8].strip() if len(row) > 8 else ""
        niche = row[9].strip() if len(row) > 9 else "Lifestyle"
        metrics = row[10].strip() if len(row) > 10 else ""
        col11_price = row[11].strip() if len(row) > 11 else ""
        col12_offer = row[12].strip() if len(row) > 12 else ""
        phone = row[5].strip() if len(row) > 5 else ""

        handle = extract_handle(profile_link, brand or name)
        followers = parse_followers(metrics, handle, name)
        expected_price, price_range = parse_pricing_details(col11_price, handle, name)
        avg_views = parse_reach(metrics, handle, name)
        loc = city_country or "India"
        cat = get_category(followers)

        text_full = (col11_price + " " + col12_offer).lower()
        is_ugc = True if idx + 1 <= 21 else ('ugc' in text_full or 'video' in text_full or 'reel' in text_full or not text_full)

        deliverables = ["UGC Video", "Reel", "Story", "Static Post"] if is_ugc else ["Reel", "Story", "Static Post"]

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
            "isUGC": is_ugc,
            "expectedPrice": expected_price,
            "priceRange": price_range,
            "deliverables": deliverables,
            "followers": followers,
            "avgViews": avg_views,
            "location": loc,
            "email": email,
            "phone": phone,
            "fakeFollowerScore": 1,
            "rating": 4.85,
            "reviewsCount": 25,
            "recentWorks": ["D2C Brand Collab"],
            "profileLink": profile_link
        }

        creators.append(item)

    parsed_json_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "influencers_parsed.json")
    with open(parsed_json_path, "w", encoding="utf-8") as f:
        json.dump(creators, f, indent=2, ensure_ascii=False)

    print(f"Successfully synced {len(creators)} creators with min to max pricing ranges and profile links!")

if __name__ == '__main__':
    sync()
