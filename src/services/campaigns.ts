/**
 * Campaign Manager service layer.
 *
 * Single source of truth for every Campaign-Manager API call and its TypeScript types.
 * Components never talk to fetch() directly — they call these typed functions, so when the
 * real Meta Ads API / Google Ads API replace today's DEMO endpoints, only this file changes.
 *
 * DEMO MODE: publishing, account connections, campaign IDs and analytics are all simulated
 * server-side. The shapes below already match what the real integrations will return.
 */

// ─────────────────────────────────────────────────────────────── types
export type CampaignStatus =
  | 'PENDING_REVIEW'   // strategy generated, awaiting approval
  | 'APPROVED'         // approved — downstream sections unlocked
  | 'PUBLISHED'        // published for real on every selected platform; read-only
  | 'PUBLISHED_DEMO'   // published (demo, or mixed real+demo); read-only
  | 'PAUSED';

export type PlatformKey = 'meta' | 'google';
export type GoogleCampaignType = 'Search' | 'Display' | 'Performance Max';

export interface Platforms { meta: boolean; google: boolean; }

export interface BudgetSplit {
  meta?: { pct: number; amount: number };
  google?: { pct: number; amount: number };
}

/** The AI-generated strategy + everything persisted with the campaign, stored in metrics. */
export interface CampaignData {
  // strategy (from the AI generator)
  objective?: string;
  audience?: string;
  placements?: string;
  total_budget?: number;
  budget_split?: BudgetSplit;
  channels?: string[];
  ad_types?: string[];
  kpis?: string[];
  top_keywords?: string[];
  google_headlines?: string[];
  google_descriptions?: string[];
  duration_label?: string;
  image_url?: string | null;
  // workflow state
  status?: string;
  platforms?: Platforms;
  meta_review?: MetaReview;
  google_review?: GoogleReview;
  optimization?: OptimizationRules;
  meta_setup?: AdSetupState;
  google_setup?: AdSetupState;
  // publish
  published_at?: string;
  published_mode?: string;
  published_platforms?: PlatformKey[];
  campaign_ids?: Partial<Record<PlatformKey, string>>;
  activity?: ActivityEntry[];
  [k: string]: any;
}

export interface Campaign {
  id: number;
  platform: string;
  name: string;
  objective: string;
  budget: number;
  status: CampaignStatus | string;
  roas: number;
  version: number;
  version_group: string | null;
  metrics: CampaignData | null;
}

export interface MetaReview {
  campaign_name?: string;
  objective?: string;
  audience?: string;
  budget?: number;
  placements?: string;
  cta?: string;
  landing_page?: string;
  tracking_url?: string;
  creative_image?: string | null;
}

export interface GoogleReview {
  campaign_type?: GoogleCampaignType;
  campaign_name?: string;
  keywords?: string[];
  headlines?: string[];
  descriptions?: string[];
  extensions?: string[];
  landing_page?: string;
  tracking_url?: string;
  budget?: number;
  creative_image?: string | null;   // only used for Display / Performance Max
}

export interface OptimizationRules {
  auto_kill: boolean;
  cpa_limit: number;
  frequency_limit: number;
  creative_rotation: boolean;
  refresh_interval_days: number;
}

export interface AdSetupState {
  connected?: boolean;
  launched?: boolean;
  account?: string;
  mock?: boolean;
}

export interface ActivityEntry { label: string; at: string; }

export interface Analytics {
  campaign_id: number;
  name: string;
  version: number;
  status: string;
  published: boolean;
  demo: boolean;
  budget: number;
  platforms: PlatformKey[];
  totals: {
    impressions: number; reach: number; clicks: number; ctr: number;
    conversions: number; cpa: number; spend: number; roas: number; revenue: number;
  };
  meta_performance: { spend: number; conversions: number; roas: number } | null;
  google_performance: { spend: number; conversions: number; roas: number } | null;
  top_keywords: { keyword: string; clicks: number; ctr: number; conversions: number }[];
  best_creative: { image_url: string | null; ctr: number; label: string };
  recommendations: { action: string; why: string; severity: 'good' | 'warn' | 'critical' }[];
}

// ─────────────────────────────────────────────────────────────── http
const authHeaders = (): Record<string, string> => {
  const t = localStorage.getItem('token');
  return t ? { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` } : { 'Content-Type': 'application/json' };
};

async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, { method, headers: authHeaders(), body: body === undefined ? undefined : JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d && (d.detail || d.message)) || `Request failed (${r.status})`);
  return d as T;
}

const ws = (id: number) => `/api/workspaces/${id}`;

// ─────────────────────────────────────────────────────────────── API
export const CampaignService = {
  // strategy
  generateStrategy: (workspaceId: number, prompt: string, model = 'gemini-2.5-flash') =>
    req<{ status: string }>('POST', `/api/agents/${workspaceId}/campaign`, { prompt, model }),

  list: (workspaceId: number) => req<Campaign[]>('GET', `${ws(workspaceId)}/campaigns`),
  get: (workspaceId: number, id: number) => req<Campaign>('GET', `${ws(workspaceId)}/campaigns/${id}`),

  approve: (workspaceId: number, id: number) =>
    req<{ status: string; new_status: string }>('POST', `${ws(workspaceId)}/campaigns/${id}/approve`),

  selectPlatforms: (workspaceId: number, id: number, platforms: Platforms) =>
    req<{ status: string; platforms: Platforms }>('POST', `${ws(workspaceId)}/campaigns/${id}/platforms`, platforms),

  saveMetaReview: (workspaceId: number, id: number, data: MetaReview) =>
    req<{ status: string }>('POST', `${ws(workspaceId)}/campaigns/${id}/meta-review`, { data }),

  saveGoogleReview: (workspaceId: number, id: number, data: GoogleReview) =>
    req<{ status: string }>('POST', `${ws(workspaceId)}/campaigns/${id}/google-review`, { data }),

  saveOptimization: (workspaceId: number, id: number, data: OptimizationRules) =>
    req<{ status: string }>('POST', `${ws(workspaceId)}/campaigns/${id}/optimization`, { data }),

  // mock account connect / mark-ready (real OAuth swaps in behind /connectors/meta later)
  adSetup: (workspaceId: number, id: number, platform: PlatformKey, action: 'connect' | 'launch' | 'disconnect') =>
    req<{ status: string; setup: AdSetupState; mock: boolean }>('POST', `${ws(workspaceId)}/campaigns/${id}/ad-setup`, { platform, action }),

  publish: (workspaceId: number, id: number, platforms: PlatformKey[]) =>
    req<{ status: string; new_status: string; platforms: PlatformKey[]; campaign_ids: Record<string, string>; message: string }>(
      'POST', `${ws(workspaceId)}/campaigns/${id}/publish`, { platforms }),

  createVersion: (workspaceId: number, id: number) =>
    req<{ status: string; campaign_id: number; version: number; version_group: string }>(
      'POST', `${ws(workspaceId)}/campaigns/${id}/create-version`),

  duplicate: (workspaceId: number, id: number) =>
    req<{ status: string; campaign_id: number; version: number }>('POST', `${ws(workspaceId)}/campaigns/${id}/duplicate`),

  analytics: (workspaceId: number, id: number) => req<Analytics>('GET', `${ws(workspaceId)}/campaigns/${id}/analytics`),

  // Start or pause a campaign that went out for real. Publishing creates everything paused;
  // this is the switch. The server refuses demo publishes (nothing exists to start) and a
  // Meta start with no payment method (it would never deliver), and reports each platform
  // separately so a partial success is visible.
  setDelivery: (workspaceId: number, id: number, action: 'start' | 'pause') =>
    req<{
      status: string; action: string;
      results: Record<string, { ok: boolean; status?: string; error?: string; effective_status?: string; note?: string }>;
      delivery: Record<string, { status: string; at: string }>;
    }>('POST', `${ws(workspaceId)}/campaigns/${id}/delivery`, { action }),
};

export default CampaignService;
