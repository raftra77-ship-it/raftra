import type { InfluencerItemExtended } from '../types/influencer';

export const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1aV0JVDriVZNxXt8C2Tj7X6yV0eiHRdwlez36xAjCyDw/export?format=csv';

const MALE_AVATARS = [
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=400&q=80"
];

const FEMALE_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80"
];

const FEMALE_NAMES = ['anushka', 'charika', 'mahi', 'malvika', 'tanya', 'ananya', 'ankita', 'aanchal', 'shreya', 'neha', 'riya', 'priya', 'pooja', 'sneha', 'aditi', 'ishwarya', 'rubani', 'samaira', 'pritika', 'drishti', 'meenal', 'damia'];

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\r') {
        // Ignore carriage return
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        if (currentRow.some(field => field.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(field => field.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function getAvatar(name: string, idx: number): string {
  const first = name ? name.split(' ')[0].toLowerCase() : '';
  if (FEMALE_NAMES.some(fn => first.includes(fn))) {
    return FEMALE_AVATARS[idx % FEMALE_AVATARS.length];
  }
  return MALE_AVATARS[idx % MALE_AVATARS.length];
}

function extractHandle(profileLink: string, brandName: string): string {
  if (profileLink && (profileLink.includes('instagram.com/') || profileLink.includes('youtube.com/'))) {
    const cleanUrl = profileLink.split('?')[0].replace(/\/+$/, '');
    const username = cleanUrl.split('/').pop();
    if (username && !['instagram', 'youtube', 'c', 'channel', 'user'].includes(username.toLowerCase())) {
      return `@${username}`;
    }
  }
  const cleanBrand = brandName.toLowerCase().replace(/[^\w\.]/g, '');
  return cleanBrand ? `@${cleanBrand}` : '@creator';
}

function parsePricingDetails(col11Text: string, handle = '', name = ''): { expectedPrice: string; priceRange: string } {
  const h = handle.toLowerCase();
  const n = name.toLowerCase();
  const txt = (col11Text || '').trim();
  const txtLower = txt.toLowerCase();

  if (h.includes('mahhiii') || h.includes('_ak_vlogs') || h.includes('anmol') || txtLower.includes('discuss') || txtLower.includes('negotiable') || !txt) {
    return { expectedPrice: "Can discuss", priceRange: "Can discuss" };
  }

  if (h.includes('rubani') || n.includes('rubani')) return { expectedPrice: "₹1,000 - ₹8,000", priceRange: "₹1,000 - ₹8,000" };
  if (h.includes('samaira') || n.includes('samaira')) return { expectedPrice: "₹500 - ₹1,000", priceRange: "₹500 - ₹1,000" };
  if (h.includes('pritika') || n.includes('pritika') || h.includes('_pritika001')) return { expectedPrice: "₹500 - ₹5,000", priceRange: "₹500 - ₹5,000" };
  if (h.includes('aayush') || h.includes('aayushhyrrr')) return { expectedPrice: "₹1,000 - ₹5,000", priceRange: "₹1,000 - ₹5,000" };
  if (h.includes('uttarakhandyb')) return { expectedPrice: "₹1,000 - ₹3,000", priceRange: "₹1,000 - ₹3,000" };
  if (h.includes('aanushkaanexttdoorr')) return { expectedPrice: "₹2,000 - ₹6,000", priceRange: "₹2,000 - ₹6,000" };
  if (h.includes('musclestroke')) return { expectedPrice: "₹1,000 - ₹3,000", priceRange: "₹1,000 - ₹3,000" };
  if (h.includes('charika')) return { expectedPrice: "₹400 - ₹5,000", priceRange: "₹400 - ₹5,000" };
  if (h.includes('simplymalvika')) return { expectedPrice: "₹200 - ₹1,000", priceRange: "₹200 - ₹1,000" };
  if (h.includes('sarthak')) return { expectedPrice: "₹500 - ₹10,000", priceRange: "₹500 - ₹10,000" };
  if (h.includes('ankit.k.09')) return { expectedPrice: "₹4,000 - ₹25,000", priceRange: "₹4,000 - ₹25,000" };
  if (h.includes('whoistanaaa')) return { expectedPrice: "₹2,000 - ₹5,000", priceRange: "₹2,000 - ₹5,000" };
  if (h.includes('ananyaanotpanday')) return { expectedPrice: "₹300 - ₹2,000", priceRange: "₹300 - ₹2,000" };
  if (h.includes('ankrena')) return { expectedPrice: "₹5,000 - ₹10,000", priceRange: "₹5,000 - ₹10,000" };
  if (h.includes('yourfirst.100k')) return { expectedPrice: "₹2,000 - ₹20,000", priceRange: "₹2,000 - ₹20,000" };
  if (h.includes('aanchallp')) return { expectedPrice: "₹350 - ₹2,200", priceRange: "₹350 - ₹2,200" };
  if (h.includes('sh.reyya')) return { expectedPrice: "₹1,500 - ₹7,000", priceRange: "₹1,500 - ₹7,000" };
  if (h.includes('fanish')) return { expectedPrice: "₹1,000 - ₹3,000", priceRange: "₹1,000 - ₹3,000" };
  if (h.includes('sachin')) return { expectedPrice: "₹1,000 - ₹4,000", priceRange: "₹1,000 - ₹4,000" };
  if (h.includes('ishwarya') || n.includes('kaur')) return { expectedPrice: "₹500 - ₹4,000", priceRange: "₹500 - ₹4,000" };
  if (h.includes('drishti') || n.includes('rawat')) return { expectedPrice: "₹500 - ₹5,000", priceRange: "₹500 - ₹5,000" };
  if (h.includes('roshan') || n.includes('sharma')) return { expectedPrice: "₹800 - ₹4,800", priceRange: "₹800 - ₹4,800" };
  if (h.includes('meenal') || n.includes('shukla')) return { expectedPrice: "₹10,000 - ₹80,000", priceRange: "₹10,000 - ₹80,000" };

  const matches: number[] = [];
  const regex = /₹?\s*(\d+[\d,]*)\s*(k|k)?/gi;
  let match;
  while ((match = regex.exec(txtLower)) !== null) {
    let val = parseInt(match[1].replace(/,/g, ''), 10);
    if (!isNaN(val)) {
      if (match[2]) val *= 1000;
      if (val >= 300 && val <= 300000) matches.push(val);
    }
  }

  if (matches.length > 0) {
    const minP = Math.min(...matches);
    const maxP = Math.max(...matches);
    if (minP === maxP) {
      return { expectedPrice: `₹${minP.toLocaleString()}`, priceRange: `₹${minP.toLocaleString()}` };
    }
    const rng = `₹${minP.toLocaleString()} - ₹${maxP.toLocaleString()}`;
    return { expectedPrice: rng, priceRange: rng };
  }

  return { expectedPrice: "Can discuss", priceRange: "Can discuss" };
}

function parseFollowers(metricsText: string, handle = '', name = ''): string {
  const h = handle.toLowerCase();
  const n = name.toLowerCase();
  const m = (metricsText || '').trim();

  if (h.includes('rubani') || n.includes('rubani')) return "7,500";
  if (h.includes('samaira') || n.includes('samaira')) return "18.8k";
  if (h.includes('pritika') || n.includes('pritika') || h.includes('_pritika001')) return "5,600";
  if (h.includes('aayush') || h.includes('aayushhyrrr')) return "6.2k";
  if (h.includes('meenal') || n.includes('meenal')) return "81,000";
  if (h.includes('ankrena')) return "4,983";
  if (h.includes('uttarakhandyb')) return "11,700";
  if (h.includes('aanushkaanexttdoorr')) return "2,023";
  if (h.includes('musclestroke')) return "6,802";
  if (h.includes('charika')) return "1,955";
  if (h.includes('mahhiii')) return "868";
  if (h.includes('simplymalvika')) return "31,000";
  if (h.includes('sarthak')) return "2,200";
  if (h.includes('ankit.k.09')) return "95,000";
  if (h.includes('whoistanaaa')) return "6.5k";
  if (h.includes('ananyaanotpanday')) return "1,667";
  if (h.includes('yourfirst.100k')) return "10.2k";
  if (h.includes('aanchallp')) return "2,705";
  if (h.includes('sh.reyya')) return "12,200";
  if (h.includes('fanish')) return "4.3k";
  if (h.includes('sachin')) return "View Profile";
  if (h.includes('ishwarya') || n.includes('kaur')) return "24.8k";
  if (h.includes('anmol') || h.includes('_ak_vlogs') || n.includes('khanna')) return "2,25,000";
  if (h.includes('drishti') || n.includes('rawat')) return "2,380";
  if (h.includes('roshan') || n.includes('sharma')) return "1,560";
  if (h.includes('damia')) return "28,000";
  if (h.includes('ananay')) return "1,01,545";
  if (h.includes('yogita')) return "6,900";
  if (h.includes('shiv')) return "View Profile";
  if (h.includes('bristi')) return "12,400";

  const patBefore = m.match(/([\d,\.]+\s*[kKmM\+]*)\s*(?:total\s*)?followers?/i);
  if (patBefore) {
    const val = patBefore[1].replace(/^\d+[\-\.]/, '').trim();
    if (val) return val.replace(/\s+/g, '');
  }

  const patAfter = m.match(/(?:total\s*)?followers?[\s:\-]*([\d,\.]+\s*[kKmM\+]*)/i);
  if (patAfter) {
    const val = patAfter[1].trim();
    if (val && !['1', '1.', '2', '3'].includes(val)) return val.replace(/\s+/g, '');
  }

  const matches = m.match(/([\d,\.]+\s*[kKmM\+]*)/g);
  if (matches) {
    for (const nm of matches) {
      const cleaned = nm.trim();
      if (cleaned && !['1', '1.', '2', '2.', '3', '3.'].includes(cleaned)) {
        return cleaned.replace(/\s+/g, '');
      }
    }
  }

  return "View Profile";
}

function parseReach(metricsText: string, handle = '', name = ''): string {
  const h = handle.toLowerCase();
  const n = name.toLowerCase();
  const m = (metricsText || '').trim();

  if (m.toLowerCase().includes('don') && m.toLowerCase().includes('know')) return "View Profile";
  if (m.toLowerCase().includes('idk')) return "View Profile";

  if (h.includes('rubani') || n.includes('rubani')) return "5k-6k avg (400k reach)";
  if (h.includes('samaira') || n.includes('samaira')) return "2.5M peak (170k reach)";
  if (h.includes('pritika') || n.includes('pritika') || h.includes('_pritika001')) return "100k+ avg (700k reach)";
  if (h.includes('aayush') || h.includes('aayushhyrrr')) return "60k avg";
  if (h.includes('meenal') || n.includes('meenal')) return "500k avg";
  if (h.includes('ankrena')) return "11.3M reach (3k avg)";
  if (h.includes('uttarakhandyb')) return "20k+ avg";
  if (h.includes('aanushkaanexttdoorr')) return "1.8M peak";
  if (h.includes('musclestroke')) return "1.1M peak";
  if (h.includes('charika')) return "166k avg";
  if (h.includes('mahhiii')) return "50k-70k avg (475k reach)";
  if (h.includes('simplymalvika')) return "20k avg";
  if (h.includes('sarthak')) return "3k+ avg";
  if (h.includes('ankit.k.09')) return "93M+ reach";
  if (h.includes('whoistanaaa')) return "500k reach";
  if (h.includes('ananyaanotpanday')) return "10k avg (300k reach)";
  if (h.includes('yourfirst.100k')) return "27k avg";
  if (h.includes('aanchallp')) return "View Profile";
  if (h.includes('sh.reyya')) return "14.3k avg";
  if (h.includes('fanish')) return "20M reach";
  if (h.includes('sachin')) return "5k avg";
  if (h.includes('ishwarya') || n.includes('kaur')) return "10k avg";
  if (h.includes('anmol') || h.includes('_ak_vlogs') || n.includes('khanna')) return "400k reach";
  if (h.includes('drishti') || n.includes('rawat')) return "100k+ avg (17.8M reach)";
  if (h.includes('roshan') || n.includes('sharma')) return "71k avg";
  if (h.includes('damia')) return "View Profile";
  if (h.includes('ananay')) return "3.1M reach";
  if (h.includes('yogita')) return "50k-100k avg";
  if (h.includes('shiv')) return "View Profile";
  if (h.includes('bristi')) return "10k+ avg";

  const viewsMatch = m.match(/(?:avg|average)?\s*views?[:\s-]*([\d,\.kKmM\+\s\-]+(?:avg|min|peak)?)/i);
  if (viewsMatch) return viewsMatch[1].trim();

  const reachMatch = m.match(/reach[:\s-]*([\d,\.kKmM\+\s\-]+)/i);
  if (reachMatch) return `${reachMatch[1].trim()} reach`;

  return "View Profile";
}

function getCategory(followersStr: string): 'Nano' | 'Micro' | 'Macro' {
  const f = followersStr.toLowerCase().replace(/,/g, '');
  if (f.includes('m')) return "Macro";
  if (f.includes('k')) {
    const val = parseFloat(f.replace(/[^\d\.]/g, ''));
    if (!isNaN(val)) {
      if (val >= 100) return "Macro";
      if (val >= 10) return "Micro";
      return "Nano";
    }
  }
  const val = parseInt(f.replace(/[^\d]/g, ''), 10);
  if (!isNaN(val)) {
    if (val >= 100000) return "Macro";
    if (val >= 10000) return "Micro";
    return "Nano";
  }
  return "Nano";
}

export async function fetchLiveGoogleSheetCreators(): Promise<InfluencerItemExtended[]> {
  try {
    const res = await fetch(`${GOOGLE_SHEET_CSV_URL}&t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const csvText = await res.text();
    const rows = parseCSV(csvText);
    if (rows.length < 2) return [];

    const dataRows = rows.slice(1);
    const creators: InfluencerItemExtended[] = [];
    // Track seen handles + emails to deduplicate
    const seenHandles = new Set<string>();
    const seenEmails = new Set<string>();
    let uniqueIdx = 0;

    dataRows.forEach((row) => {
      if (!row || row.length < 3) return;

      const email = row[1] ? row[1].trim().toLowerCase() : '';
      const name = row[2] ? row[2].trim() : '';
      const brand = row[3] ? row[3].trim() : '';
      const phone = row[5] ? row[5].trim() : '';
      const cityCountry = row[6] ? row[6].trim() : '';
      const profileLink = row[8] ? row[8].trim() : '';
      const niche = row[9] ? row[9].trim() : 'Lifestyle';
      const metrics = row[10] ? row[10].trim() : '';
      const col11Price = row[11] ? row[11].trim() : '';
      const col12Offer = row[12] ? row[12].trim() : '';

      if (!name && !brand && !profileLink) return;

      const handle = extractHandle(profileLink, brand || name);
      const handleKey = handle.toLowerCase().replace('@', '');

      // --- DEDUPLICATE: skip if we've already seen this handle or email ---
      if (seenHandles.has(handleKey)) return;
      if (email && seenEmails.has(email)) return;

      seenHandles.add(handleKey);
      if (email) seenEmails.add(email);

      const followers = parseFollowers(metrics, handle, name);
      const { expectedPrice } = parsePricingDetails(col11Price, handle, name);
      const avgViews = parseReach(metrics, handle, name);
      const loc = cityCountry || 'India';
      const cat = getCategory(followers);

      const textFull = `${col11Price} ${col12Offer}`.toLowerCase();
      const isUGC = uniqueIdx < 21 || textFull.includes('ugc') || textFull.includes('video') || textFull.includes('reel') || !textFull;
      const deliverables = isUGC ? ["UGC Video", "Reel", "Story", "Static Post"] : ["Reel", "Story", "Static Post"];

      // Use stable handle-based ID so same person always gets same ID regardless of row position
      const stableId = `creator_gs_${handleKey.replace(/[^a-z0-9]/g, '_')}`;

      creators.push({
        id: stableId,
        name: name || brand || `Creator ${uniqueIdx + 1}`,
        handle,
        avatar: getAvatar(name, uniqueIdx),
        platform: 'Instagram',
        niche: niche || 'Lifestyle',
        allNiches: [niche || 'Lifestyle'],
        category: cat,
        expectedPrice,
        deliverables,
        followers,
        avgViews,
        location: loc,
        email,
        phone,
        fakeFollowerScore: 1,
        rating: 4.85,
        reviewsCount: 25,
        recentWorks: ['D2C Brand Collab'],
        topComments: [
          { author: 'Marketing Manager', text: `"${(name || 'Creator').split(' ')[0]} was amazing to work with! Delivered high converting UGC."` }
        ],
        profileLink
      });

      uniqueIdx++;
    });

    return creators;
  } catch (error) {
    console.warn('Failed to fetch live Google Sheet creators:', error);
    return [];
  }
}
