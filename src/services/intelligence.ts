/**
 * Brand-intelligence API client.
 *
 * Mirrors backend/intelligence_routes.py. Components never call fetch() for this data
 * directly, so the shapes below are the single place the contract is written down — and
 * the one place to change when the backend's changes.
 */

// ───────────────────────────────────────────────────────────────────── types

export interface ColorToken {
  name: string;
  hex: string;
  role: string;
  /** "css-variable" when the site named it itself, "frequency" when we inferred it. */
  source: string;
}

export interface LogoAsset {
  type: string;
  url: string;
  format: string;
  variant: string;
  svg?: string;
}

export interface Persona {
  persona: string;
  hook: string;
}

export interface BrandKit {
  brand_name: string;
  website_url: string | null;
  brand_color: string | null;
  brand_logo: string | null;
  is_onboarded: boolean;
  overview: string;
  mission: string;
  positioning: string;
  business_model: string;
  product_categories: string[];
  usps: string;
  benefits: string;
  personality: string;
  tone_of_voice: string[];
  key_messages: string[];
  target_audience: string;
  target_audiences: Persona[];
  typography: Record<string, string>;
  color_palette: string[];
  color_tokens: ColorToken[];
  logos: LogoAsset[];
  founded: string;
  rating: { value: number; count: number | null; scale: number } | null;
}

export interface CompetitorAd {
  id: number;
  title: string;
  copy: string;
  snapshot_url: string;
  platforms: string[];
  offers: { code?: string; percent_off?: number | null; flat_off?: number | null; perks?: string[] };
  days_active: number | null;
  started_at: string | null;
  country: string;
  source: string;
}

export interface OceanMove {
  title?: string;
  rationale?: string;
  actions?: string[];
}

export interface AdStrategy {
  summary: string;
  offer_strategy: string;
  evergreen_winners: string[];
  fatiguing: string[];
  blue_ocean: OceanMove;
  red_ocean: OceanMove;
  recommended_formats: string[];
  ads_analysed: number;
  synced_at: string | null;
}

export interface CompetitorGroup {
  competitor: string;
  ads: CompetitorAd[];
  ad_count: number;
  evergreen_count: number;
  strategy: AdStrategy | null;
}

export interface SyncState {
  status: 'never' | 'success' | 'failed' | 'skipped';
  last_run_at: string | null;
  next_due_at: string | null;
  message: string;
  items: number;
}

export interface CompetitorAdsResponse {
  competitors: CompetitorGroup[];
  total_ads: number;
  sync: SyncState;
  cadence_days: number;
  source_configured: boolean;
}

export interface TrendKeyword {
  keyword: string;
  score: number;
  bucket: string;
  hook: string;
  source?: string;
}

export interface VideoRef {
  title: string;
  channel: string;
  published_at: string;
  url: string;
  thumbnail: string;
}

export interface TrendReport {
  id: number;
  report_title: string;
  summary: string;
  region: string;
  period_start: string | null;
  period_end: string | null;
  strategic_keywords: TrendKeyword[];
  winning_patterns: string[];
  creative_formats: string[];
  creator_video_refs: VideoRef[];
  sources: string[];
  created_at: string | null;
}

export interface MarketTrendsResponse {
  latest: TrendReport | null;
  history: { id: number; report_title: string; region: string; period_end: string | null; keyword_count: number }[];
  sync: SyncState;
  cadence_days: number;
  source_configured: boolean;
}

export interface IntelligenceAnswer {
  answer: string;
  routed: Record<string, boolean>;
  sources: { type: string; url: string; competitor: string; excerpt: string }[];
  note?: string;
}

// ────────────────────────────────────────────────────────────────────── http

const authHeaders = (): Record<string, string> => {
  const t = localStorage.getItem('token');
  return t
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }
    : { 'Content-Type': 'application/json' };
};

async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: authHeaders(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d && (d.detail || d.message)) || `Request failed (${r.status})`);
  return d as T;
}

const ws = (id: number) => `/api/workspaces/${id}`;

// ─────────────────────────────────────────────────────────────────────── api

export const IntelligenceService = {
  brandKit: (workspaceId: number) => req<BrandKit>('GET', `${ws(workspaceId)}/brand-kit`),

  competitorAds: (workspaceId: number) =>
    req<CompetitorAdsResponse>('GET', `${ws(workspaceId)}/competitor-ads`),

  syncCompetitorAds: (workspaceId: number, country?: string, competitors?: string[]) =>
    req<{ status: string; ads: number; indexed: number; errors: string[] }>(
      'POST', `${ws(workspaceId)}/competitor-ads/sync`, { country, competitors }),

  marketTrends: (workspaceId: number) =>
    req<MarketTrendsResponse>('GET', `${ws(workspaceId)}/market-trends`),

  syncMarketTrends: (workspaceId: number, region?: string, extra_keywords?: string[]) =>
    req<{ status: string; report_id: number; indexed: number }>(
      'POST', `${ws(workspaceId)}/market-trends/sync`, { region, extra_keywords }),

  ask: (workspaceId: number, query: string) =>
    req<IntelligenceAnswer>('POST', `${ws(workspaceId)}/intelligence/query`, { query }),

  status: (workspaceId: number) =>
    req<{
      scheduled_syncs_enabled: boolean;
      competitor_ads: SyncState & { cadence_days: number; source_configured: boolean; stored: number };
      market_trends: SyncState & { cadence_days: number; source_configured: boolean; stored: number };
    }>('GET', `${ws(workspaceId)}/intelligence/status`),
};

// ───────────────────────────────────────────────────────────────────── helpers

/** "2 weeks ago" style relative time — a sync's age is the thing that matters about it,
 *  and an ISO timestamp makes the reader do that arithmetic themselves. */
export function relativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'never';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d ago`;
  return `${Math.round(days / 7)}w ago`;
}

/** Colour for a keyword's search-intent bucket, shared by every chip that shows one. */
export const BUCKET_COLORS: Record<string, string> = {
  high_intent: '#00E676',
  core: '#7C75FF',
  utility: '#00D2FF',
  lifestyle: '#FFB020',
};

export const BUCKET_LABELS: Record<string, string> = {
  high_intent: 'High intent',
  core: 'Core demand',
  utility: 'Utility',
  lifestyle: 'Lifestyle',
};
