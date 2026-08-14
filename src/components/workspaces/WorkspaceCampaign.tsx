import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles, Check, CheckCircle2, Clock, AlertTriangle, Rocket, Activity,
  Image as ImageIcon, ShieldCheck, RefreshCw, XCircle,
  OctagonX, ArrowRight, FileUp, Download, Copy, Database, Upload,
  TrendingUp, ShoppingCart, GitBranch, BarChart3,
} from 'lucide-react';
import { CampaignService } from '../../services/campaigns';

export interface CampaignItem {
  id: string; platform: string; name: string; objective: string;
  budget: number; roas: number; status: 'active' | 'paused' | 'pending_review';
}

interface WorkspaceCampaignProps {
  workspaceId?: number | null;
  campaigns?: CampaignItem[];
  creativeAssets?: any[];
  onOpenReview?: (itemId: string) => void;
  onToggleStatus?: (id: string) => void;
  // Jump to Creative Studio seeded with a prompt. BrandDashboard already supplies this, but
  // no control in this component calls it yet — declared so the parent wiring type-checks
  // and stays intact for whoever adds the trigger.
  onOpenCreativeStudio?: (seed: string) => void;
}

const authHeaders = (): Record<string, string> => {
  const t = localStorage.getItem('token');
  return t ? { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` } : { 'Content-Type': 'application/json' };
};
const money = (v: any) => `₹${Number(v || 0).toLocaleString('en-IN')}`;
const ago = (ts: number) => {
  const m = Math.floor((Date.now() - ts) / 60000);
  return m < 1 ? 'just now' : m === 1 ? '1 min ago' : `${m} mins ago`;
};

// ── shared styles ────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: 'var(--surface, rgba(255,255,255,0.03))',
  border: '1px solid var(--border, var(--border-color))',
  borderRadius: '14px', padding: '22px',
};
const sectionTitle: React.CSSProperties = { fontSize: '17px', fontWeight: 600, color: '#fff', marginBottom: '4px' };
const sectionHint: React.CSSProperties = { fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.55 };
const label: React.CSSProperties = { fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 500 };
const input: React.CSSProperties = {
  width: '100%', padding: '11px 13px', background: 'rgba(0,0,0,0.25)',
  border: '1px solid var(--border, var(--border-color))', borderRadius: '9px',
  color: '#fff', fontSize: '13.5px', outline: 'none',
};
const btnPrimary: React.CSSProperties = {
  background: 'linear-gradient(135deg, var(--primary) 0%, #3B33FF 100%)', border: 'none', color: '#fff',
  padding: '12px', borderRadius: '9px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
};
const btnGhost: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border, var(--border-color))', color: '#fff',
  padding: '10px 14px', borderRadius: '9px', fontSize: '12.5px', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
};

// `label` is optional: it only changes the text, never the colour, so a caller can say
// "Google: REAL" while still being coloured by the underlying status.
const Pill: React.FC<{ status: string; label?: string }> = ({ status, label }) => {
  const map: Record<string, { c: string; b: string }> = {
    Completed: { c: '#00e676', b: 'rgba(0,230,118,0.12)' },
    Approved: { c: '#00e676', b: 'rgba(0,230,118,0.12)' },
    Published: { c: '#00e676', b: 'rgba(0,230,118,0.12)' },
    Generated: { c: '#5a8dff', b: 'rgba(90,141,255,0.14)' },
    'In Progress': { c: '#5a8dff', b: 'rgba(90,141,255,0.14)' },
    Ready: { c: '#00e676', b: 'rgba(0,230,118,0.12)' },
    Configured: { c: '#5a8dff', b: 'rgba(90,141,255,0.14)' },
    'Needs approval': { c: '#ffae00', b: 'rgba(255,174,0,0.14)' },
    Locked: { c: 'var(--text-secondary)', b: 'rgba(255,255,255,0.06)' },
    Pending: { c: 'var(--text-secondary)', b: 'rgba(255,255,255,0.06)' },
    MOCK: { c: '#ffae00', b: 'rgba(255,174,0,0.14)' },
    DEMO: { c: '#ffae00', b: 'rgba(255,174,0,0.14)' },
    REAL: { c: '#00e676', b: 'rgba(0,230,118,0.12)' },
    SAMPLE: { c: '#ffae00', b: 'rgba(255,174,0,0.14)' },
  };
  const s = map[status] || map.Pending;
  return <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.4px', color: s.c, background: s.b, border: `1px solid ${s.c}33`, borderRadius: '20px', padding: '3px 10px', whiteSpace: 'nowrap' }}>{label ?? status}</span>;
};

// Short values sit on one line (label left, value right). Long values — audience, placements —
// stack instead: right-aligned sentences that wrap are the thing that reads as "all over the place".
const Row: React.FC<{ k: string; v: React.ReactNode; stack?: boolean }> = ({ k, v, stack }) => (
  stack ? (
    <div style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '5px' }}>{k}</div>
      <div style={{ fontSize: '13px', color: '#fff', lineHeight: 1.55, wordBreak: 'break-word' }}>{v}</div>
    </div>
  ) : (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '16px', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '13px' }}>
      <span style={{ color: 'var(--text-secondary)', flexShrink: 0, whiteSpace: 'nowrap' }}>{k}</span>
      <span style={{ color: '#fff', textAlign: 'right', lineHeight: 1.45, minWidth: 0, wordBreak: 'break-word' }}>{v}</span>
    </div>
  )
);

// Wraps a step that must stay inert until the strategy is approved.
const Gated: React.FC<{ children: React.ReactNode; locked: boolean; why: string }> = ({ children, locked, why }) => (
  <div style={{ position: 'relative' }}>
    <div style={{ opacity: locked ? 0.35 : 1, pointerEvents: locked ? 'none' : 'auto', filter: locked ? 'grayscale(0.5)' : 'none', transition: 'opacity .25s' }}>{children}</div>
    {locked && (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <div style={{ background: 'rgba(16,18,26,0.95)', border: '1px solid rgba(255,174,0,0.35)', borderRadius: '10px', padding: '14px 18px', textAlign: 'center', maxWidth: '90%' }}>
          <AlertTriangle size={16} color="#ffae00" style={{ marginBottom: '6px' }} />
          <div style={{ fontSize: '12.5px', color: '#fff', fontWeight: 600, marginBottom: '2px' }}>Locked</div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>{why}</div>
        </div>
      </div>
    )}
  </div>
);

export const WorkspaceCampaign: React.FC<WorkspaceCampaignProps> = ({ workspaceId, creativeAssets = [] }) => {
  // ── the full ideation brief (all original fields restored) ──
  const [form, setForm] = useState({
    campaignFocus: 'Diwali Festive Sale',
    objective: 'Conversions',
    budget: 40000,
    audience: 'Women 18-35, Tier 1 & Tier 2 Cities, Interested in Festive Shopping',
    funnel: 'Bottom of Funnel',
    geoTargetingLevel: 'State-Level',
    placement: 'Maharashtra, Delhi, Karnataka',
    schedule: '14 Days',
    tracking: 'utm_source=ai_agent',
  });

  const [campaign, setCampaign] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [activity, setActivity] = useState<{ label: string; at: number }[]>([]);
  const [isCopied, setIsCopied] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const scrollToTop = () => {
    let node: HTMLElement | null = topRef.current;
    while (node) {
      if (node.scrollHeight > node.clientHeight + 5) { node.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      node = node.parentElement;
    }
  };
  const importRef = useRef<HTMLInputElement>(null);

  // Smart ad management (restored)
  const [smart, setSmart] = useState({ killAds: true, autoRotate: true, skipRateThreshold: 70, frequencyCap: 3.5, cpaThreshold: 3500, refreshIntervalDays: 4 });

  // Which platforms this campaign goes to, the final sign-off, and the full-review modal.
  const [platforms, setPlatforms] = useState({ meta: true, google: true });
  const [confirmed, setConfirmed] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);

  // Real Meta ad-account connection (from the Meta connector), the publish popup, and the
  // persistent list of campaigns already published.
  // Mirrors GET /api/connectors/meta/{ws}/status. `ready_to_publish` is the one
  // flag to gate real publishing on: an ad needs both an ad account (who pays)
  // and a Page (who it publishes as).
  const [metaAccount, setMetaAccount] = useState<{
    configured?: boolean; connected?: boolean; name?: string;
    ad_account_id?: string | null; page_id?: string | null; page_name?: string | null;
    default_link_url?: string | null; ready_to_publish?: boolean;
  }>({});
  const [publishPopup, setPublishPopup] = useState(false);
  const [recentPublished, setRecentPublished] = useState<any[]>([]);
  const [analyticsView, setAnalyticsView] = useState<any | null>(null);   // opened analytics modal payload

  // Meta ad account + Facebook Page picker (needed before a real campaign/ad can be launched).
  const [metaAdAccounts, setMetaAdAccounts] = useState<{ account_id: string; name: string; currency?: string; active?: boolean }[] | null>(null);
  const [metaPages, setMetaPages] = useState<{ id: string; name: string }[] | null>(null);
  const [selectedPage, setSelectedPage] = useState('');
  const [metaPickerOpen, setMetaPickerOpen] = useState(false);
  const [metaPickerBusy, setMetaPickerBusy] = useState(false);

  const loadMetaAdAccounts = useCallback(async () => {
    if (!workspaceId) return;
    setMetaPickerBusy(true);
    try {
      const [accRes, pageRes] = await Promise.all([
        fetch(`/api/connectors/meta/${workspaceId}/ad-accounts`, { headers: authHeaders() }),
        fetch(`/api/connectors/meta/${workspaceId}/pages`, { headers: authHeaders() }),
      ]);
      const accData = await accRes.json().catch(() => ({}));
      const pageData = await pageRes.json().catch(() => ({}));
      if (accRes.ok) setMetaAdAccounts(accData.ad_accounts || []);
      else flash(accData.detail || 'Could not load Meta ad accounts.', false);
      if (pageRes.ok) setMetaPages(pageData.pages || []);
      else flash(pageData.detail || 'Could not load Facebook Pages.', false);
    } catch { flash('Could not reach Meta to load ad accounts / Pages.', false); }
    setMetaPickerBusy(false);
  }, [workspaceId]);

  const selectAdAccount = async (accountId: string) => {
    if (!workspaceId || !accountId) return;
    setMetaPickerBusy(true);
    try {
      const r = await fetch(`/api/connectors/meta/${workspaceId}/account`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ ad_account_id: accountId }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setMetaAccount(a => ({ ...a, ad_account_id: d.ad_account_id })); flash('Ad account saved.'); }
      else flash(d.detail || 'Could not save ad account.', false);
    } catch { flash('Could not save ad account.', false); }
    setMetaPickerBusy(false);
  };

  // Persist the chosen Page to this workspace's Meta connection. The dropdown previously
  // only set local state, so page_id stayed NULL in the database and every "real" publish
  // failed inside _launch_meta_ad and silently degraded to a MOCK-META demo result.
  // default_link_url is where ad clicks land; the workspace site is the sane default.
  const selectPage = async (pageId: string) => {
    if (!pageId || !workspaceId) return;
    setMetaPickerBusy(true);
    try {
      const r = await fetch(`/api/connectors/meta/${workspaceId}/page`, {
        method: 'POST', headers: authHeaders(),
        // default_link_url omitted deliberately: _launch_meta_ad already falls back to
        // the workspace's company_url, so there is no need to duplicate that here.
        body: JSON.stringify({ page_id: pageId }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setSelectedPage(d.page_id || pageId);
        // Re-read status so ready_to_publish reflects the server, not an assumption.
        const s = await fetch(`/api/connectors/meta/${workspaceId}/status`, { headers: authHeaders() });
        if (s.ok) setMetaAccount(await s.json());
        flash(`Publishing as "${d.page_name || 'your Page'}".`);
      } else if (r.status === 401) {
        flash('Your Meta connection expired — reconnect Meta and try again.', false);
      } else {
        flash(d.detail || 'Could not save the Facebook Page.', false);
      }
    } catch {
      flash('Could not save the Facebook Page — server unreachable.', false);
    }
    setMetaPickerBusy(false);
  };

  // Disconnecting deletes the whole connection row server-side, which also clears the
  // ad account and Page selections — so reconnecting starts clean rather than inheriting
  // stale ids. Confirmed first because it is not undoable without re-running OAuth.
  const disconnectPlatform = async (platform: 'meta' | 'google') => {
    if (!workspaceId) return;
    const name = platform === 'meta' ? 'Meta Ads' : 'Google Ads';
    if (!window.confirm(
      `Disconnect ${name}?\n\nThis removes the connection and clears the selected ` +
      `account${platform === 'meta' ? ' and Facebook Page' : ''}. Campaigns already ` +
      `created in ${name} are not affected. You can reconnect at any time.`)) return;

    setMetaPickerBusy(true);
    try {
      const r = await fetch(
        platform === 'meta'
          ? `/api/connectors/meta/${workspaceId}/disconnect`
          : `/api/connectors/google-ads/${workspaceId}`,
        { method: platform === 'meta' ? 'POST' : 'DELETE', headers: authHeaders() });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        if (platform === 'meta') {
          setMetaAccount({ configured: true, connected: false });
          setMetaAdAccounts(null); setMetaPages(null); setSelectedPage(''); setMetaPickerOpen(false);
        } else {
          setGoogleAccount({ configured: true, connected: false });
          setGoogleAdAccounts(null); setGooglePickerOpen(false);
        }
        flash(`${name} disconnected.`);
      } else {
        flash(d.detail || `Could not disconnect ${name}.`, false);
      }
    } catch {
      flash(`Could not disconnect ${name} — server unreachable.`, false);
    }
    setMetaPickerBusy(false);
  };

  const openMetaPicker = () => {
    setMetaPickerOpen(o => !o);
    if (!metaAdAccounts && !metaPickerOpen) loadMetaAdAccounts();
  };

  // Real Google Ads connection (mirrors the Meta picker above exactly) + its account picker.
  const [googleAccount, setGoogleAccount] = useState<{ configured?: boolean; connected?: boolean; email?: string; customer_id?: string | null }>({});
  const [googleAdAccounts, setGoogleAdAccounts] = useState<{ customer_id: string; name: string }[] | null>(null);
  const [googlePickerOpen, setGooglePickerOpen] = useState(false);
  const [googlePickerBusy, setGooglePickerBusy] = useState(false);

  const loadGoogleAdAccounts = useCallback(async () => {
    if (!workspaceId) return;
    setGooglePickerBusy(true);
    try {
      const r = await fetch(`/api/connectors/google-ads/${workspaceId}/accounts`, { headers: authHeaders() });
      const d = await r.json().catch(() => ({}));
      if (r.ok) setGoogleAdAccounts(d.accounts || []);
      else flash(d.detail || 'Could not load Google Ads accounts.', false);
    } catch { flash('Could not reach Google Ads to load accounts.', false); }
    setGooglePickerBusy(false);
  }, [workspaceId]);

  const selectGoogleAccount = async (customerId: string) => {
    if (!workspaceId || !customerId) return;
    setGooglePickerBusy(true);
    try {
      const r = await fetch(`/api/connectors/google-ads/${workspaceId}/account`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ customer_id: customerId }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setGoogleAccount(a => ({ ...a, customer_id: d.customer_id })); flash('Google Ads account saved.'); }
      else flash(d.detail || 'Could not save Google Ads account.', false);
    } catch { flash('Could not save Google Ads account.', false); }
    setGooglePickerBusy(false);
  };

  const openGooglePicker = () => {
    setGooglePickerOpen(o => !o);
    if (!googleAdAccounts && !googlePickerOpen) loadGoogleAdAccounts();
  };

  const connectGoogleAds = async () => {
    try {
      const r = await fetch(`/api/connectors/google-ads/${workspaceId}/authorize`, { headers: authHeaders() });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.url) { window.location.href = d.url; return; }
      flash(d.detail || 'Google Ads login isn’t configured on the server yet.', false);
    } catch { flash('Could not start Google Ads connection.', false); }
  };

  // The single approved creative that flows into the platform reviews, plus any
  // images the user uploads, plus a manual override of the Google campaign type.
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [googleTypeOverride, setGoogleTypeOverride] = useState<string>('');
  const uploadImageRef = useRef<HTMLInputElement>(null);

  const flash = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 6000); };
  const log = (l: string) => setActivity(a => [{ label: l, at: Date.now() }, ...a].slice(0, 6));

  const spec = campaign?.metrics || {};
  const status = String(campaign?.status || '').toUpperCase();
  // PUBLISHED = at least one platform went out for real; PUBLISHED_DEMO = simulated.
  // Both mean "published", so match on the prefix rather than the exact demo value —
  // otherwise a real publish is treated as unpublished and the flow resets.
  const isPublishedStatus = (s?: string) => String(s || '').toUpperCase().startsWith('PUBLISHED');
  const approved = status === 'APPROVED' || isPublishedStatus(status);
  const published = isPublishedStatus(status);
  const publishedForReal = String(status || '').toUpperCase() === 'PUBLISHED';
  const metaSetup = spec.meta_setup || {};
  const googleSetup = spec.google_setup || {};
  const split = spec.budget_split || {};
  const heroImage: string | null = spec.image_url || null;
  // Meta ad copy from the approved strategy — this is what actually gets sent
  // to Meta as the creative when publishing for real.
  const metaCopy = spec.meta || {};
  const headlines: string[] = spec.google_headlines || [];
  const descriptions: string[] = spec.google_descriptions || [];
  const keywords: string[] = spec.top_keywords || [];
  const rec = spec.recommendations || {};
  const aiGoogleType: string = spec.google_campaign_type || (rec.google_campaign_type && rec.google_campaign_type.value) || 'Search';
  const GOOGLE_TYPES = ['Search', 'Display', 'Performance Max', 'Shopping', 'Demand Gen', 'Video'];
  const googleType: string = googleTypeOverride || aiGoogleType;
  const g = spec.google || {};
  // Plain-language reasons for the "Why AI Recommended This" section.
  const whyRows: { label: string; value: string; reason: string }[] = [
    rec.objective && { label: 'Objective', value: rec.objective.value, reason: rec.objective.reason },
    ...(Array.isArray(rec.platforms) ? rec.platforms.map((p: any) => ({ label: 'Platform', value: p.value, reason: p.reason })) : []),
    rec.budget_allocation && { label: 'Budget Split', value: `${rec.budget_allocation.meta_pct ?? '—'}% Meta / ${rec.budget_allocation.google_pct ?? '—'}% Google`, reason: rec.budget_allocation.reason },
    rec.google_campaign_type && { label: 'Google Campaign Type', value: rec.google_campaign_type.value, reason: rec.google_campaign_type.reason },
    rec.audience && { label: 'Audience', value: rec.audience.value, reason: rec.audience.reason },
    rec.creative && { label: 'Creative', value: rec.creative.value, reason: rec.creative.reason },
    rec.cta && { label: 'CTA', value: rec.cta.value, reason: rec.cta.reason },
    rec.optimization_goal && { label: 'Optimization Goal', value: rec.optimization_goal.value, reason: rec.optimization_goal.reason },
  ].filter((r: any) => r && r.reason);
  // Which Google fields to show depends on the AI-chosen campaign type.
  const gt = (googleType || '').toLowerCase();
  const gShow = {
    keywords: gt.includes('search') || gt.includes('shopping'),
    extensions: gt.includes('search'),
    images: gt.includes('display') || gt.includes('performance') || gt.includes('demand'),
    videos: gt.includes('performance') || gt.includes('video'),
    signals: gt.includes('performance') || gt.includes('demand'),
  };
  const chips = (arr: any[]) => (arr && arr.length) ? (
    <span style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      {arr.slice(0, 6).map((x: any, i: number) => <span key={i} style={{ fontSize: '11px', color: '#8B85FF', background: 'rgba(90,82,255,0.12)', border: '1px solid rgba(90,82,255,0.25)', borderRadius: '6px', padding: '3px 9px' }}>{String(x)}</span>)}
      {arr.length > 6 && <span style={{ fontSize: '11px', color: 'var(--text-secondary)', alignSelf: 'center' }}>+{arr.length - 6} more</span>}
    </span>
  ) : <span style={{ color: 'var(--text-muted)' }}>—</span>;
  const libraryImages: string[] = (creativeAssets || []).map((a: any) => a.image_url || a.imageUrl).filter(Boolean);
  // Every creative the user can pick from: the AI-generated ad, their library, and uploads.
  const allImages: string[] = Array.from(new Set([heroImage, ...uploadedImages, ...libraryImages].filter(Boolean) as string[]));
  // Once a campaign (with its image) loads, pre-select the AI-generated ad.
  useEffect(() => { if (heroImage && !selectedImage) setSelectedImage(heroImage); }, [heroImage]);  // eslint-disable-line react-hooks/exhaustive-deps
  const onUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { const url = String(reader.result); setUploadedImages(imgs => [url, ...imgs]); setSelectedImage(url); };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ── data ──
  const loadLatest = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const list = await fetch(`/api/workspaces/${workspaceId}/campaigns`, { headers: authHeaders() }).then(r => r.json());
      if (Array.isArray(list)) {
        const sorted = list.slice().sort((a: any, b: any) => b.id - a.id);
        const isPub = (c: any) => String(c.status || '').toUpperCase().startsWith('PUBLISHED');
        setRecentPublished(sorted.filter(isPub).slice(0, 10));
        // Active flow = the latest NOT-yet-published campaign. Once a campaign is published it
        // drops into "Recently Published" and the flow starts fresh from the top checklist.
        setCampaign(sorted.find((c: any) => !isPub(c)) || null);
      }
    } catch { /* ignore */ }
  }, [workspaceId]);
  const refresh = useCallback(async (id: number) => {
    try {
      const r = await fetch(`/api/workspaces/${workspaceId}/campaigns/${id}`, { headers: authHeaders() });
      if (r.ok) setCampaign(await r.json());
    } catch { /* ignore */ }
  }, [workspaceId]);
  // Refresh ONLY the Recently Published list (never changes the campaign in focus).
  const loadRecent = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const list = await CampaignService.list(workspaceId);
      setRecentPublished(list.filter(c => String(c.status).toUpperCase().startsWith('PUBLISHED'))
        .sort((a, b) => b.id - a.id).slice(0, 10));
    } catch { /* ignore */ }
  }, [workspaceId]);
  useEffect(() => { loadLatest(); }, [loadLatest]);
  useEffect(() => {
    if (!workspaceId) return;
    fetch(`/api/connectors/meta/${workspaceId}/status`, { headers: authHeaders() })
      .then(r => (r.ok ? r.json() : null)).then(d => d && setMetaAccount(d)).catch(() => {});
  }, [workspaceId]);
  useEffect(() => {
    if (!workspaceId) return;
    fetch(`/api/connectors/google-ads/${workspaceId}/status`, { headers: authHeaders() })
      .then(r => (r.ok ? r.json() : null)).then(d => d && setGoogleAccount(d)).catch(() => {});
  }, [workspaceId]);

  // ── generate strategy (+ its ad image, together) ──
  const generate = async () => {
    if (!workspaceId) { flash('No workspace selected.', false); return; }
    setIsGenerating(true);
    let beforeMax = 0;
    try {
      const b = await fetch(`/api/workspaces/${workspaceId}/campaigns`, { headers: authHeaders() }).then(r => r.json());
      if (Array.isArray(b)) beforeMax = b.reduce((m: number, c: any) => Math.max(m, c.id), 0);
    } catch { /* ignore */ }
    const prompt = `Create an ad campaign. Theme/focus: ${form.campaignFocus}. Objective: ${form.objective}. Total budget: ₹${form.budget}. Audience: ${form.audience}. Funnel: ${form.funnel}. Geo: ${form.placement} (${form.geoTargetingLevel}). Schedule: ${form.schedule}. Tracking: ${form.tracking}.`;
    // Geo is also sent as its own structured field (not just inside the prose prompt above) so
    // the exact locations the user picked are carried through the spec verbatim, rather than
    // relying on the LLM to re-extract them accurately from text.
    const geoLocations = form.placement.split(',').map(s => s.trim()).filter(Boolean);
    try {
      await fetch(`/api/agents/${workspaceId}/campaign`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ prompt, model: 'gemini-2.5-flash', geo_targeting_level: form.geoTargetingLevel, geo_locations: geoLocations }) });
    } catch { setIsGenerating(false); flash('Could not start generation.', false); return; }
    let tries = 0;
    const poll = setInterval(async () => {
      tries += 1;
      try {
        const now = await fetch(`/api/workspaces/${workspaceId}/campaigns`, { headers: authHeaders() }).then(r => r.json());
        const fresh = Array.isArray(now) ? now.filter((c: any) => c.id > beforeMax).sort((a: any, b: any) => b.id - a.id)[0] : null;
        if (fresh) {
          clearInterval(poll); setIsGenerating(false); setCampaign(fresh);
          log('AI Strategy + ad image generated');
          flash('Strategy and its ad image are ready. Review them, then approve to unlock the rest.');
        } else if (tries >= 20) { clearInterval(poll); setIsGenerating(false); flash('Taking longer than expected — check the agent logs.', false); }
      } catch { /* keep polling */ }
    }, 3000);
  };

  const approve = async () => {
    if (!campaign) return;
    setBusy('approve');
    try {
      const r = await fetch(`/api/workspaces/${workspaceId}/campaigns/${campaign.id}/approve`, { method: 'POST', headers: authHeaders() });
      const d = await r.json();
      if (r.ok) { await refresh(campaign.id); log('Strategy approved'); flash('Approved. The strategy has been passed to Meta, Google and Review below.'); }
      else flash(d.detail || 'Approve failed.', false);
    } catch { flash('Approve failed.', false); }
    setBusy(null);
  };

  const adSetup = async (platform: 'meta' | 'google', action: 'connect' | 'launch') => {
    if (!campaign) return;
    setBusy(`${platform}-${action}`);
    try {
      const r = await fetch(`/api/workspaces/${workspaceId}/campaigns/${campaign.id}/ad-setup`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ platform, action }),
      });
      const d = await r.json();
      if (r.ok) {
        await refresh(campaign.id);
        const P = platform === 'meta' ? 'Meta' : 'Google';
        log(`${P} Ads ${action === 'connect' ? 'connected' : 'launched'} (mock)`);
        flash(`${P} ${action} done in MOCK mode — no real ad account was touched.`);
      } else flash(d.detail || 'Action failed.', false);
    } catch { flash('Action failed.', false); }
    setBusy(null);
  };

  const publish = async (targets: ('meta' | 'google')[]) => {
    if (!campaign || targets.length === 0) return;
    setBusy(`publish-${targets.join('-')}`);
    try {
      // Send the approved creative so the backend can build a real ad. Without
      // it Meta only gets a campaign shell, which can never deliver.
      const metaCreative = targets.includes('meta') ? {
        image_url: selectedImage || undefined,
        headline: metaCopy.headline || undefined,
        primary_text: metaCopy.primary_text || undefined,
        cta: metaCopy.cta || undefined,
        meta_placements: ['facebook', 'instagram'],
      } : {};
      const r = await fetch(`/api/workspaces/${workspaceId}/campaigns/${campaign.id}/publish`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ platforms: targets, ...metaCreative }),
      });
      const d = await r.json();
      if (r.ok) {
        const label = targets.map(t => (t === 'meta' ? 'Meta' : 'Google')).join(' & ');
        const modeTag = d.mode === 'real' ? '' : d.mode === 'mixed' ? ' (partly demo)' : ' (demo)';
        log(`Published to ${label}${modeTag}`);
        flash(d.message || `Published to ${label}${modeTag}.`);
        setPublishPopup(false); setConfirmed(false);
        // Do NOT reset — stay on the now-published campaign (it becomes read-only), and
        // refresh the Recently Published list.
        await refresh(campaign.id);
        await loadRecent();
      } else flash(d.detail || 'Publish failed.', false);
    } catch { flash('Publish failed.', false); }
    setBusy(null);
  };

  // Start a brand-new empty campaign flow (explicit — no longer automatic after publish).
  const startNewCampaign = () => {
    setConfirmed(false); setReviewOpen(false); setPublishPopup(false);
    setSelectedImage(null); setUploadedImages([]); setGoogleTypeOverride('');
    setPlatforms({ meta: true, google: true });
    setCampaign(null);
  };

  // Create the next version of a published campaign (V2, V3…) — editable; the old version stays read-only.
  const createNewVersion = async () => {
    if (!campaign) return;
    setBusy('version');
    try {
      const d = await CampaignService.createVersion(workspaceId!, campaign.id);
      await refresh(d.campaign_id);
      await loadRecent();
      setConfirmed(false); setPublishPopup(false); setReviewOpen(false);
      log(`Version ${d.version} created`);
      flash(`Version ${d.version} created — edit it and publish when ready. The previous version stays read-only.`);
    } catch (e: any) { flash(e.message || 'Could not create a new version.', false); }
    setBusy(null);
  };

  const duplicateCampaign = async (id: number) => {
    if (!workspaceId) return;
    setBusy('duplicate');
    try {
      const d = await CampaignService.duplicate(workspaceId, id);
      await refresh(d.campaign_id);
      await loadRecent();
      setConfirmed(false); setPublishPopup(false);
      log('Campaign duplicated');
      flash('Duplicated into a new editable campaign.');
    } catch (e: any) { flash(e.message || 'Could not duplicate.', false); }
    setBusy(null);
  };

  const viewAnalytics = async (id: number) => {
    if (!workspaceId) return;
    setBusy('analytics');
    try { setAnalyticsView(await CampaignService.analytics(workspaceId, id)); }
    catch (e: any) { flash(e.message || 'Could not load analytics.', false); }
    setBusy(null);
  };

  // Fire-and-forget persistence (keeps the design unchanged; saves quietly as the user works).
  const persistPlatforms = (p: { meta: boolean; google: boolean }) => {
    if (campaign && approved && !published) CampaignService.selectPlatforms(workspaceId!, campaign.id, p).catch(() => {});
  };
  const persistOptimization = (rules: any) => {
    if (campaign && approved && !published) {
      CampaignService.saveOptimization(workspaceId!, campaign.id, {
        auto_kill: rules.killAds, cpa_limit: rules.cpaThreshold, frequency_limit: rules.frequencyCap,
        creative_rotation: rules.autoRotate, refresh_interval_days: rules.refreshIntervalDays,
      }).catch(() => {});
    }
  };
  // Debounced save of the optimization rules whenever the user tweaks them.
  useEffect(() => {
    if (!campaign || !approved || published) return;
    const t = setTimeout(() => persistOptimization(smart), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smart, campaign?.id, approved, published]);

  // Start a real Meta connection (OAuth). Falls back to a message when the server is in mock mode.
  const connectMeta = async () => {
    try {
      const r = await fetch(`/api/connectors/meta/${workspaceId}/authorize`, { headers: authHeaders() });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.url) { window.location.href = d.url; return; }
      flash(d.detail || 'Meta login isn’t configured on the server yet (mock mode). You can still publish in demo mode.', false);
    } catch { flash('Could not start Meta connection.', false); }
  };

  // Publish entry point: if a Meta account is connected (or Meta isn't a target) publish directly;
  // otherwise show the connect-or-publish popup.
  const attemptPublish = (targets: ('meta' | 'google')[]) => {
    if (!targets.includes('meta') || metaAccount.connected) { publish(targets); return; }
    setPublishPopup(true);
  };

  const regenerateImage = async () => {
    if (!workspaceId) return;
    setBusy('image');
    try {
      await fetch(`/api/agents/${workspaceId}/creative`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ prompt: `Ad creative for ${form.campaignFocus}. Audience: ${form.audience}. ${form.objective} campaign.`, model: 'gemini-2.5-flash' }),
      });
      log('New ad image requested');
      flash('Generating a new image — it appears in Creative Studio and your library.');
    } catch { flash('Could not start image generation.', false); }
    setBusy(null);
  };

  // ── presets (restored) ──
  const presets = [
    { id: 'festive', title: 'Festive Conversion Blast', icon: Rocket, badge: 'High ROAS focus', desc: 'Scale a festive sale with bottom-of-funnel retargeting and short video hooks.',
      p: { campaignFocus: 'Diwali Festive Sale', objective: 'Conversions', budget: 65000, audience: 'Festive Shoppers & Tech Enthusiasts', funnel: 'Bottom of Funnel', geoTargetingLevel: 'State-Level', placement: 'Maharashtra, Delhi, Karnataka, Gujarat', schedule: '14 Days', tracking: 'utm_source=ai_agent_festive' } },
    { id: 'cart', title: 'Retargeting & Cart Recovery', icon: ShoppingCart, badge: 'High conversion %', desc: 'Re-engage high-intent abandoned carts with dynamic ads and an exit offer.',
      p: { campaignFocus: '7-Day Abandoned Cart Recovery', objective: 'Conversions', budget: 30000, audience: 'Added to Cart (Last 7 Days) - No Purchase', funnel: 'Bottom of Funnel', geoTargetingLevel: 'City-Level', placement: 'Mumbai, Bangalore, Delhi NCR', schedule: 'Ongoing / Evergreen', tracking: 'utm_source=ai_agent_retargeting' } },
    { id: 'lal', title: '1% Lookalike Expansion', icon: TrendingUp, badge: 'Scale audience', desc: 'Acquire new customers via lookalikes of your top-LTV buyers.',
      p: { campaignFocus: 'Lookalike Customer Acquisition', objective: 'Lead Generation', budget: 50000, audience: 'Top 1% LAL of Past Buyers + Interest in Premium Tech', funnel: 'Top of Funnel', geoTargetingLevel: 'Country-Level', placement: 'India (Tier 1 & Tier 2)', schedule: '30 Days', tracking: 'utm_source=ai_agent_lal' } },
  ];

  // Download the approved creative itself, not just the campaign JSON.
  //
  // Fetched into a blob rather than pointing <a download> straight at the URL: the image
  // often lives on another origin (Pollinations) or is a data: URL, and in both cases the
  // browser ignores the `download` attribute and simply navigates away — losing the user's
  // place in the flow instead of saving the file.
  const downloadCreative = async (url: string) => {
    if (!url) return;
    setBusy('download');
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      // Trust the served content-type for the extension; the URL often has none.
      const ext = (blob.type.split('/')[1] || 'png').split(';')[0].replace('jpeg', 'jpg');
      const name = `creative-${(form.campaignFocus || 'ad').replace(/\s+/g, '_').toLowerCase()}-${Date.now()}.${ext}`;
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
      flash(`Saved "${name}" to your Downloads folder.`);
    } catch {
      flash('Could not download the image — try right-click and Save image as.', false);
    } finally {
      setBusy(null);
    }
  };

  // ── import / export (restored) ──
  const exportCampaign = () => {
    if (!campaign) { flash('Nothing to export yet — generate a strategy first.', false); return; }
    try {
      const blob = new Blob([JSON.stringify({ version: '1.0', exportedAt: new Date().toISOString(), form, smart, strategy: spec }, null, 2)], { type: 'application/json' });
      const filename = `campaign-${(form.campaignFocus || 'untitled').replace(/\s+/g, '_').toLowerCase()}-${Date.now()}.json`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      flash(`Exported "${filename}" to your Downloads folder.`);
    } catch (err) {
      flash('Export failed — could not build the file.', false);
    }
  };
  const importCampaign = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      try {
        const d = JSON.parse(String(ev.target?.result));
        if (!d.form && !d.smart) { flash("That file doesn't look like a campaign export.", false); return; }
        if (d.form) setForm(p => ({ ...p, ...d.form }));
        if (d.smart) setSmart(p => ({ ...p, ...d.smart }));
        flash(d.strategy
          ? 'Campaign brief imported into the form on the left. Note: only the brief restores automatically — click "Generate Strategy + Ad" to recreate its AI strategy and image.'
          : 'Campaign brief imported into the form on the left.');
      } catch { flash('Invalid campaign file — could not read it as JSON.', false); }
    };
    r.onerror = () => flash('Could not read that file.', false);
    r.readAsText(f); e.target.value = '';
  };

  const copyStrategy = () => {
    navigator.clipboard.writeText(JSON.stringify(spec, null, 2));
    setIsCopied(true); setTimeout(() => setIsCopied(false), 2000);
  };

  // ── stepper ──
  // Which platforms are actually in play, and whether each one's ads are reviewed & ready.
  const chosen: ('meta' | 'google')[] = (['meta', 'google'] as const).filter(p => platforms[p]);
  const setupOf = (p: 'meta' | 'google') => (p === 'meta' ? metaSetup : googleSetup);
  const platformsReady = chosen.length > 0 && chosen.every(p => setupOf(p).launched);
  const publishedList: string[] = spec.published_platforms || [];

  const steps = [
    { n: 1, name: 'Ideation', sub: 'Fill campaign brief', s: campaign ? 'Completed' : 'Pending' },
    { n: 2, name: 'AI Strategy', sub: 'Generate strategy', s: !campaign ? 'Pending' : 'Completed' },
    { n: 3, name: 'Approve Strategy', sub: 'Review & approve', s: !campaign ? 'Locked' : approved ? 'Completed' : 'Needs approval' },
    { n: 4, name: 'Select Platforms', sub: 'Choose where to publish', s: !approved ? 'Locked' : chosen.length ? 'Completed' : 'Pending' },
    { n: 5, name: 'Review Platforms', sub: 'Review & edit platform ads', s: !approved || !chosen.length ? 'Locked' : platformsReady ? 'Completed' : 'In Progress' },
    { n: 6, name: 'Human Review', sub: 'Final review & publish', s: published ? 'Completed' : !platformsReady ? 'Locked' : confirmed ? 'In Progress' : 'Pending' },
    { n: 7, name: 'Status', sub: 'Track campaign', s: published ? 'Completed' : 'Locked' },
  ];
  const stepColor = (s: string) => (s === 'Completed' ? '#00e676' : s === 'In Progress' || s === 'Generated' ? '#5a8dff' : s === 'Needs approval' ? '#ffae00' : 'var(--text-secondary)');
  const canPublish = approved && platformsReady && confirmed && !published;

  // ── sample performance feed (mock data, kept at top) ──
  const sampleFeed = [
    { id: 'f1', tag: 'Scale (high performance)', icon: CheckCircle2, color: '#00e676', bg: 'rgba(0,230,118,0.08)', bd: 'rgba(0,230,118,0.3)', name: 'Diwali Festive Sale (Meta)', metrics: 'ROAS 4.2×  |  CPA ₹900  |  Spend ₹35,000', rec: 'Running 38% above ROAS target. Scale daily budget +25%.', act: 'Scale Budget +25%' },
    { id: 'f2', tag: 'Rotate creative (fatigue)', icon: AlertTriangle, color: '#ffb74d', bg: 'rgba(255,183,77,0.08)', bd: 'rgba(255,183,77,0.3)', name: 'Summer Apparel Retargeting', metrics: 'Frequency 4.1×  |  CTR 0.8%  |  Skip 74%', rec: 'Frequency hit 4.1× with a high skip rate. Rotate the creative.', act: 'Rotate Creative' },
    { id: 'f3', tag: 'Kill (CPA limit exceeded)', icon: OctagonX, color: '#ff5252', bg: 'rgba(255,82,82,0.08)', bd: 'rgba(255,82,82,0.3)', name: 'Broad TOF Awareness (Google)', metrics: `CPA ₹3,900 (cap ₹${smart.cpaThreshold})  |  0 conv (24h)`, rec: 'CPA breached your safety threshold. Auto-kill rule triggered.', act: 'Kill Ad Set' },
    { id: 'f4', tag: 'Pivot (audience saturation)', icon: RefreshCw, color: '#9c7bff', bg: 'rgba(156,123,255,0.08)', bd: 'rgba(156,123,255,0.3)', name: 'State-Level Scale Campaign', metrics: 'MH ROI 1.5×  |  KA ROI 3.8×', rec: 'Regional saturation detected. Reallocate 40% budget to high-ROI zones.', act: 'Reallocate Budget' },
  ];
  const [executed, setExecuted] = useState<string[]>([]);

  return (
    <div ref={topRef} style={{ display: 'flex', flexDirection: 'column', gap: '20px', color: '#fff' }}>
      {/* ── header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: '25px', fontFamily: 'var(--font-heading)', marginBottom: '6px' }}>Campaign Manager</h2>
          <p style={sectionHint}>Describe your campaign once — AI writes the strategy and the ad image. You approve it, and that approved plan drives Meta, Google and publishing.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0, alignItems: 'center', position: 'relative' }}>
          {metaAccount.connected ? (
            <div style={{ position: 'relative' }}>
              <button onClick={openMetaPicker} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: 600, color: '#00e676', background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer' }}>
                <CheckCircle2 size={14} /> Meta connected{metaAccount.name ? ` · ${metaAccount.name}` : ''}
                {metaAccount.ad_account_id ? ` · Account ${metaAccount.ad_account_id}` : ' · No ad account selected'}
              </button>
              {metaPickerOpen && (
                <>
                <div onClick={() => setMetaPickerOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 50, width: '320px', background: '#14161e', border: '1px solid var(--border, var(--border-color))', borderRadius: '10px', padding: '14px', boxShadow: '0 12px 30px rgba(0,0,0,0.5)' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff', marginBottom: '10px' }}>Meta ad account &amp; Page</div>
                  {metaPickerBusy ? (
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Loading…</p>
                  ) : (
                    <>
                      <span style={label}>Ad account</span>
                      <select style={{ ...input, padding: '8px 10px', fontSize: '12.5px', marginBottom: '12px' }}
                        value={metaAccount.ad_account_id || ''} onChange={e => selectAdAccount(e.target.value)}>
                        <option value="" disabled>{metaAdAccounts && metaAdAccounts.length ? 'Choose an ad account' : 'No ad accounts found'}</option>
                        {(metaAdAccounts || []).map(a => (
                          <option key={a.account_id} value={a.account_id}>{a.name} ({a.currency}){a.active ? '' : ' — inactive'}</option>
                        ))}
                      </select>
                      <span style={label}>Facebook Page</span>
                      <select style={{ ...input, padding: '8px 10px', fontSize: '12.5px' }}
                        disabled={metaPickerBusy}
                        value={metaAccount.page_id || selectedPage || ''}
                        onChange={e => selectPage(e.target.value)}>
                        <option value="" disabled>{metaPages && metaPages.length ? 'Choose a Page' : 'No Pages found'}</option>
                        {(metaPages || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>

                      {/* Readiness checklist — each line reflects a real server value, so the
                          user can see exactly what is still missing before a real publish. */}
                      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {[
                          { ok: !!metaAccount.connected, label: 'Meta connected' },
                          { ok: !!metaAccount.ad_account_id, label: 'Ad account selected' },
                          { ok: !!metaAccount.page_id, label: 'Facebook Page selected' },
                          { ok: !!metaAccount.ready_to_publish, label: 'Ready to publish' },
                        ].map(row => (
                          <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11.5px', color: row.ok ? '#00e676' : 'var(--text-secondary)' }}>
                            {row.ok ? <CheckCircle2 size={12} /> : <span style={{ width: '12px', textAlign: 'center' }}>○</span>}
                            {row.label}
                          </div>
                        ))}
                      </div>
                      <p style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '10px', lineHeight: 1.5 }}>
                        {metaAccount.ready_to_publish
                          ? 'Real campaigns will be created in Meta, paused, for you to review and activate.'
                          : 'An ad account and a Facebook Page are both required before a real campaign can be created.'}
                      </p>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                        <button onClick={loadMetaAdAccounts} style={{ ...btnGhost, flex: 1, padding: '7px', fontSize: '11.5px' }}><RefreshCw size={12} /> Refresh list</button>
                        <button onClick={() => disconnectPlatform('meta')} disabled={metaPickerBusy}
                          style={{ ...btnGhost, flex: 1, padding: '7px', fontSize: '11.5px', color: '#ff5c5c', borderColor: 'rgba(255,92,92,0.3)' }}>
                          Disconnect
                        </button>
                      </div>
                    </>
                  )}
                </div>
                </>
              )}
            </div>
          ) : (
            <button onClick={connectMeta} style={{ ...btnGhost, color: '#8B85FF', borderColor: 'rgba(90,82,255,0.4)' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ffae00', display: 'inline-block' }} /> Connect Meta account
            </button>
          )}
          {googleAccount.connected ? (
            <div style={{ position: 'relative' }}>
              <button onClick={openGooglePicker} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: 600, color: '#00e676', background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer' }}>
                <CheckCircle2 size={14} /> Google Ads connected{googleAccount.email ? ` · ${googleAccount.email}` : ''}
                {googleAccount.customer_id ? ` · Account ${googleAccount.customer_id}` : ' · No account selected'}
              </button>
              {googlePickerOpen && (
                <>
                <div onClick={() => setGooglePickerOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 50, width: '320px', background: '#14161e', border: '1px solid var(--border, var(--border-color))', borderRadius: '10px', padding: '14px', boxShadow: '0 12px 30px rgba(0,0,0,0.5)' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff', marginBottom: '10px' }}>Google Ads account</div>
                  {googlePickerBusy ? (
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Loading…</p>
                  ) : (
                    <>
                      <span style={label}>Customer account</span>
                      <select style={{ ...input, padding: '8px 10px', fontSize: '12.5px', marginBottom: '12px' }}
                        value={googleAccount.customer_id || ''} onChange={e => selectGoogleAccount(e.target.value)}>
                        <option value="" disabled>{googleAdAccounts && googleAdAccounts.length ? 'Choose an account' : 'No accounts found'}</option>
                        {(googleAdAccounts || []).map(a => (
                          <option key={a.customer_id} value={a.customer_id}>{a.name} ({a.customer_id})</option>
                        ))}
                      </select>
                      <p style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '10px', lineHeight: 1.5 }}>
                        Required before a real (non-demo) campaign can be launched on Google Ads. Publishing below still runs in demo mode until that's wired up.
                      </p>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                        <button onClick={loadGoogleAdAccounts} style={{ ...btnGhost, flex: 1, padding: '7px', fontSize: '11.5px' }}><RefreshCw size={12} /> Refresh list</button>
                        <button onClick={() => disconnectPlatform('google')} disabled={metaPickerBusy}
                          style={{ ...btnGhost, flex: 1, padding: '7px', fontSize: '11.5px', color: '#ff5c5c', borderColor: 'rgba(255,92,92,0.3)' }}>
                          Disconnect
                        </button>
                      </div>
                    </>
                  )}
                </div>
                </>
              )}
            </div>
          ) : (
            <button onClick={connectGoogleAds} style={{ ...btnGhost, color: '#8B85FF', borderColor: 'rgba(90,82,255,0.4)' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ffae00', display: 'inline-block' }} /> Connect Google Ads account
            </button>
          )}
          {campaign && !published && <button onClick={startNewCampaign} style={btnGhost}><Sparkles size={14} /> New Campaign</button>}
          <input type="file" ref={importRef} accept=".json" style={{ display: 'none' }} onChange={importCampaign} />
          <button onClick={() => importRef.current?.click()} style={btnGhost}><FileUp size={14} /> Import</button>
          <button onClick={exportCampaign} style={btnGhost}><Download size={14} /> Export</button>
        </div>
      </div>

      {/* ── Published banner: shown after publish; the flow below becomes read-only ── */}
      {published && (
        <div style={{ ...card, borderColor: 'rgba(0,230,118,0.35)', background: 'rgba(0,230,118,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ ...sectionTitle, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '9px' }}>
                <CheckCircle2 size={18} color="#00e676" /> {campaign.name || 'Campaign'} <Pill status="Published" />
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>Version {campaign.version || 1}</span>
                {/* Per-platform publish mode. A real campaign must never read as DEMO, and a
                    mock one must never read as REAL — so this comes from published_modes
                    rather than being assumed. */}
                {(spec.published_platforms || []).map((p: string) => (
                  <Pill key={p} status={(spec.published_modes || {})[p] === 'real' ? 'REAL' : 'DEMO'}
                    label={`${p === 'meta' ? 'Meta' : 'Google'}: ${(spec.published_modes || {})[p] === 'real' ? 'REAL' : 'DEMO'}`} />
                ))}
              </h3>
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <span>Platforms: <b style={{ color: '#fff' }}>{(spec.published_platforms || []).map((p: string) => p === 'meta' ? 'Meta' : 'Google').join(' & ') || '—'}</b></span>
                <span>Budget: <b style={{ color: '#fff' }}>{money(spec.total_budget || campaign.budget)}</b></span>
                <span>Published: <b style={{ color: '#fff' }}>{spec.published_at ? new Date(spec.published_at).toLocaleString() : '—'}</b></span>
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '6px', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                {Object.entries(spec.campaign_ids || {}).map(([p, id]) => (
                  <span key={p}>{p === 'meta' ? 'Meta' : 'Google'} ID: <code style={{ color: '#8B85FF' }}>{String(id)}</code></span>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button onClick={createNewVersion} disabled={busy === 'version'} style={btnPrimary}>
                <GitBranch size={14} /> {busy === 'version' ? 'Creating…' : 'Create New Version'}
              </button>
              <button onClick={() => duplicateCampaign(campaign.id)} disabled={busy === 'duplicate'} style={btnGhost}><Copy size={14} /> Duplicate</button>
              <button onClick={() => viewAnalytics(campaign.id)} disabled={busy === 'analytics'} style={btnGhost}><BarChart3 size={14} /> {busy === 'analytics' ? 'Loading…' : 'View Analytics'}</button>
              <button onClick={startNewCampaign} style={btnGhost}><Sparkles size={14} /> New Campaign</button>
            </div>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '10px' }}>
            This version is <b>read-only</b>. To change anything, click <b>Create New Version</b> — the previous version stays intact.
          </p>
        </div>
      )}

      {/* ── 1. performance & action feed (sample data) ── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
          <h3 style={{ ...sectionTitle, display: 'flex', alignItems: 'center', gap: '9px', marginBottom: 0 }}>
            <Activity size={17} color="var(--primary)" /> Daily Performance &amp; AI Action Feed
          </h3>
          <Pill status="SAMPLE" />
        </div>
        <p style={{ ...sectionHint, marginBottom: '14px' }}>
          Once campaigns are live this shows what to scale, rotate or kill from real numbers. These are example rows so you can see the format.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
          {sampleFeed.map(f => {
            const done = executed.includes(f.id);
            const Icon = f.icon;
            return (
              <div key={f.id} style={{ padding: '15px', background: f.bg, border: `1px solid ${f.bd}`, borderRadius: '11px', display: 'flex', flexDirection: 'column', gap: '10px', opacity: done ? 0.55 : 1 }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: f.color, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '7px' }}>
                    <Icon size={14} color={f.color} /> {f.tag}
                  </div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, marginBottom: '4px' }}>{f.name}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginBottom: '8px' }}>{f.metrics}</div>
                  <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>{f.rec}</div>
                </div>
                <button onClick={() => { setExecuted(e => [...e, f.id]); flash('Example action — connect a live ad account to apply this for real.', false); }}
                  disabled={done}
                  style={{ padding: '9px 12px', background: done ? 'rgba(255,255,255,0.06)' : f.color, color: done ? 'var(--text-muted)' : '#03121a', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: done ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  {done ? 'Applied (example)' : <>{f.act} <ArrowRight size={13} /></>}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 2. the progress bar ── */}
      <div style={{ ...card, padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
          {steps.map((st, i) => (
            <React.Fragment key={st.n}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '6px 10px', borderRadius: '9px', background: st.s !== 'Pending' && st.s !== 'Locked' ? 'rgba(255,255,255,0.045)' : 'transparent', flex: '1 1 150px', minWidth: '140px' }}>
                <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: st.s === 'Completed' ? '#00e676' : st.s === 'Pending' || st.s === 'Locked' ? 'rgba(255,255,255,0.1)' : stepColor(st.s), color: st.s === 'Pending' || st.s === 'Locked' ? 'var(--text-secondary)' : '#03121a', fontSize: '11.5px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {st.s === 'Completed' ? <Check size={13} /> : st.n}
                </span>
                <div style={{ lineHeight: 1.3, minWidth: 0 }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 600 }}>{st.name}</div>
                  <div style={{ fontSize: '10.5px', color: stepColor(st.s) }}>{st.s}</div>
                </div>
              </div>
              {i < steps.length - 1 && <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>›</span>}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── 3. brief + generated strategy (with its image) ── */}
      {/* alignItems:start so the shorter brief card keeps its natural height instead of
          stretching to match the long strategy output (which left a big empty gap). */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.25fr)', gap: '18px', alignItems: 'start' }}>
        {/* brief */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <h3 style={{ ...sectionTitle, marginBottom: 0 }}>AI Ideation &amp; Strategist</h3>
            <Pill status={campaign ? 'Completed' : 'Pending'} />
          </div>
          <p style={{ ...sectionHint, marginBottom: '16px' }}>Start from a playbook or fill in your own brief. This is the only form you need.</p>

          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={13} color="var(--primary)" /> Quick-start playbooks
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
            {presets.map(p => {
              const Icon = p.icon;
              // color/fontFamily below are set explicitly: a <button> does not inherit them
              // from the page, so without them the title rendered in the UA's default
              // near-black on this dark card and was invisible.
              return (
                <button key={p.id} onClick={() => { setForm(f => ({ ...f, ...p.p })); flash(`"${p.title}" loaded — tweak anything, then generate.`); }}
                  style={{ textAlign: 'left', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border, var(--border-color))', borderRadius: '10px', padding: '12px', cursor: 'pointer', color: 'var(--text-primary)', fontFamily: 'inherit' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '7px' }}><Icon size={14} color="var(--primary)" /> {p.title}</span>
                    <span style={{ fontSize: '9.5px', color: 'var(--primary)', background: 'rgba(99,102,241,0.12)', padding: '2px 8px', borderRadius: '20px', whiteSpace: 'nowrap' }}>{p.badge}</span>
                  </div>
                  <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{p.desc}</p>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
            <div><span style={label}>Campaign idea / theme</span><input style={input} value={form.campaignFocus} onChange={e => setForm(f => ({ ...f, campaignFocus: e.target.value }))} placeholder="e.g. Diwali Festive Sale" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><span style={label}>Objective</span>
                <select style={input} value={form.objective} onChange={e => setForm(f => ({ ...f, objective: e.target.value }))}>
                  <option>Conversions</option><option>Traffic</option><option>Lead Generation</option><option>Brand Awareness</option><option>Engagement</option>
                </select>
              </div>
              <div><span style={label}>Total budget (₹)</span><input type="number" style={input} value={form.budget} onChange={e => setForm(f => ({ ...f, budget: Number(e.target.value) }))} /></div>
            </div>
            <div><span style={label}>Who are we targeting?</span><textarea style={{ ...input, minHeight: '62px', resize: 'vertical' }} value={form.audience} onChange={e => setForm(f => ({ ...f, audience: e.target.value }))} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><span style={label}>Funnel stage</span>
                <select style={input} value={form.funnel} onChange={e => setForm(f => ({ ...f, funnel: e.target.value }))}>
                  <option>Top of Funnel</option><option>Middle of Funnel</option><option>Bottom of Funnel</option>
                </select>
              </div>
              <div><span style={label}>Geo granularity</span>
                <select style={input} value={form.geoTargetingLevel} onChange={e => setForm(f => ({ ...f, geoTargetingLevel: e.target.value }))}>
                  <option>Pincode-Level</option><option>City-Level</option><option>State-Level</option><option>Country-Level</option>
                </select>
              </div>
            </div>
            <div><span style={label}>Places to run it</span><input style={input} value={form.placement} onChange={e => setForm(f => ({ ...f, placement: e.target.value }))} placeholder="e.g. Maharashtra, Delhi" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><span style={label}>Schedule</span><input style={input} value={form.schedule} onChange={e => setForm(f => ({ ...f, schedule: e.target.value }))} /></div>
              <div><span style={label}>Tracking (UTM)</span><input style={input} value={form.tracking} onChange={e => setForm(f => ({ ...f, tracking: e.target.value }))} /></div>
            </div>
            <button onClick={generate} disabled={isGenerating} style={{ ...btnPrimary, opacity: isGenerating ? 0.7 : 1, cursor: isGenerating ? 'wait' : 'pointer' }}>
              <Sparkles size={15} /> {isGenerating ? 'Writing your strategy & ad…' : campaign ? 'Regenerate Strategy' : 'Generate Strategy + Ad'}
            </button>
          </div>
        </div>

        {/* generated strategy + image together */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', gap: '10px', flexWrap: 'wrap' }}>
            <h3 style={{ ...sectionTitle, marginBottom: 0 }}>Your AI Strategy &amp; Ad</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {campaign && whyRows.length > 0 && (
                <button onClick={() => setWhyOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#b3aaff', background: 'rgba(90,82,255,0.1)', border: '1px solid rgba(90,82,255,0.35)', borderRadius: '8px', padding: '7px 12px', cursor: 'pointer' }}>
                  <Sparkles size={13} /> Why AI recommended this
                </button>
              )}
              <Pill status={!campaign ? 'Pending' : approved ? 'Approved' : 'Needs approval'} />
            </div>
          </div>
          <p style={{ ...sectionHint, marginBottom: '16px' }}>
            {!campaign ? 'Nothing generated yet.' : approved
              ? 'Approved — this exact plan is what Meta, Google and publishing below are using.'
              : 'Check the plan and the ad image. Keep the image or generate a new one, then approve.'}
          </p>

          {!campaign ? (
            <div style={{ padding: '34px 20px', textAlign: 'center', border: '1px dashed var(--border, var(--border-color))', borderRadius: '11px' }}>
              <Sparkles size={26} color="var(--primary)" style={{ opacity: 0.6, marginBottom: '10px' }} />
              <p style={{ ...sectionHint }}>Fill the brief on the left and press <b style={{ color: '#fff' }}>Generate Strategy + Ad</b>.<br />You'll get the plan, budget split, keywords and a ready ad image here.</p>
            </div>
          ) : (
            <>
              {/* the ad image — pick the one creative that flows into the platform reviews */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                  <div style={{ width: '150px', height: '150px', borderRadius: '11px', overflow: 'hidden', background: '#000', border: '1px solid var(--border, var(--border-color))', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {selectedImage ? <img src={selectedImage} alt="Selected ad" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <ImageIcon size={26} color="var(--text-muted)" />}
                  </div>
                  <div style={{ flex: 1, minWidth: '160px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '9px' }}>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                      {selectedImage ? 'This is the approved creative. Only this image is sent to the platform reviews below.' : 'Pick or upload the image you want to advertise.'}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {selectedImage && (
                        <button onClick={() => downloadCreative(selectedImage)}
                          disabled={busy === 'download'}
                          style={{ ...btnGhost, padding: '8px 12px', fontSize: '12px' }}>
                          <Download size={13} /> {busy === 'download' ? 'Downloading…' : 'Download'}
                        </button>
                      )}
                      <button onClick={regenerateImage} disabled={busy === 'image'} style={{ ...btnGhost, padding: '8px 12px', fontSize: '12px' }}>
                        <RefreshCw size={13} /> {busy === 'image' ? 'Generating…' : 'New image'}
                      </button>
                      <button onClick={() => uploadImageRef.current?.click()} style={{ ...btnGhost, padding: '8px 12px', fontSize: '12px' }}>
                        <Upload size={13} /> Upload
                      </button>
                      <input ref={uploadImageRef} type="file" accept="image/*" onChange={onUploadImage} style={{ display: 'none' }} />
                    </div>
                  </div>
                </div>

                {/* selectable thumbnails: generated + uploaded + library */}
                {allImages.length > 0 && (
                  <>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: '13px 0 7px' }}>Choose the creative to advertise (click to approve)</div>
                    <div style={{ display: 'flex', gap: '9px', flexWrap: 'wrap' }}>
                      {allImages.map((src, i) => {
                        const active = selectedImage === src;
                        const label = src === heroImage ? 'AI generated' : uploadedImages.includes(src) ? 'Uploaded' : 'Library';
                        return (
                          <button key={i} onClick={() => setSelectedImage(src)} title={label}
                            style={{ position: 'relative', width: '64px', height: '64px', padding: 0, borderRadius: '9px', overflow: 'hidden', cursor: 'pointer',
                              border: active ? '2px solid var(--primary)' : '1px solid var(--border, var(--border-color))',
                              boxShadow: active ? '0 0 0 3px rgba(90,82,255,0.22)' : 'none', background: '#000' }}>
                            <img src={src} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: active ? 1 : 0.72 }} />
                            {active && (
                              <span style={{ position: 'absolute', top: '3px', right: '3px', background: 'var(--primary)', borderRadius: '50%', width: '17px', height: '17px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Check size={11} color="#fff" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* the plan */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '18px' }}>
                <div>
                  <Row k="Objective" v={campaign.objective || spec.objective || '—'} />
                  {split.meta && <Row k="Meta share" v={`${split.meta.pct}% · ${money(split.meta.amount)}`} />}
                  {split.google && <Row k="Google share" v={`${split.google.pct}% · ${money(split.google.amount)}`} />}
                  <Row k="Runs for" v={spec.duration_label || form.schedule} />
                  {spec.geo_targeting && (
                    <Row k="Targeting" v={`${spec.geo_targeting.level || 'Country-Level'}${(spec.geo_targeting.locations || []).length ? ` · ${spec.geo_targeting.locations.join(', ')}` : ''}`} />
                  )}
                </div>
                <div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '7px' }}>Success targets</div>
                  {(spec.kpis || []).map((k: string) => (
                    <div key={k} style={{ fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '5px' }}><CheckCircle2 size={13} color="#00e676" /> {k}</div>
                  ))}
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: '12px 0 7px' }}>Keywords it will target</div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {keywords.slice(0, 8).map((k: string) => <span key={k} style={{ fontSize: '10.5px', color: '#8B85FF', background: 'rgba(90,82,255,0.12)', border: '1px solid rgba(90,82,255,0.25)', borderRadius: '6px', padding: '3px 9px' }}>{k}</span>)}
                    {keywords.length === 0 && <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>—</span>}
                  </div>
                  {(headlines.length > 0 || descriptions.length > 0) && (
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '12px' }}>
                      Ad copy ready: <b style={{ color: '#fff' }}>{headlines.length}</b> headlines · <b style={{ color: '#fff' }}>{descriptions.length}</b> descriptions
                    </div>
                  )}
                </div>
              </div>

              {/* Audience is the longest field — give it the full width so it reads as a sentence. */}
              <div style={{ marginTop: '14px', padding: '13px 15px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid var(--border, var(--border-color))' }}>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Who this campaign targets</div>
                <div style={{ fontSize: '13.5px', color: '#fff', lineHeight: 1.6 }}>{spec.audience || form.audience}</div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
                <button onClick={copyStrategy} style={{ ...btnGhost, padding: '8px 12px', fontSize: '12px' }}>
                  {isCopied ? <Check size={13} color="#00e676" /> : <Copy size={13} />} {isCopied ? 'Copied' : 'Copy plan'}
                </button>
              </div>

              {!approved ? (
                <button onClick={approve} disabled={busy === 'approve'} style={{ width: '100%', marginTop: '12px', background: '#00e676', border: 'none', color: '#03121a', padding: '13px', borderRadius: '9px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <ShieldCheck size={16} /> {busy === 'approve' ? 'Approving…' : 'Approve & send to all steps'}
                </button>
              ) : (
                <div style={{ marginTop: '12px', padding: '11px 14px', background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: '9px', fontSize: '12.5px', color: '#00e676', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={15} /> Approved — passed to Meta, Google and Review below.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── 4. select platforms ── */}
      <Gated locked={!approved || published} why={published ? 'Published — read-only. Create a new version to change platforms.' : 'Approve the strategy first to choose platforms'}>
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ minWidth: '190px', flex: '0 1 auto' }}>
            <h3 style={{ ...sectionTitle, marginBottom: '2px' }}>Selected Platforms</h3>
            <p style={sectionHint}>Tick where this strategy should run.</p>
          </div>
          {([{ k: 'meta' as const, name: 'Meta Ads', sub: 'Facebook & Instagram' },
             { k: 'google' as const, name: 'Google Ads', sub: 'Search & Display' }]).map(p => {
            const on = platforms[p.k];
            return (
              <label key={p.k} style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '13px 16px', borderRadius: '11px', border: `1px solid ${on ? 'rgba(0,230,118,0.45)' : 'var(--border, var(--border-color))'}`, background: on ? 'rgba(0,230,118,0.06)' : 'rgba(255,255,255,0.02)', cursor: 'pointer', minWidth: '205px' }}>
                <input type="checkbox" checked={on} onChange={e => { const np = { ...platforms, [p.k]: e.target.checked }; setPlatforms(np); persistPlatforms(np); setConfirmed(false); }}
                  style={{ width: '17px', height: '17px', accentColor: '#00e676', cursor: 'pointer', flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 600 }}>{p.name}</span>
                  <span style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-secondary)' }}>{p.sub}</span>
                </span>
                {on && <CheckCircle2 size={17} color="#00e676" />}
              </label>
            );
          })}
          <div style={{ flex: 1, minWidth: '215px', fontSize: '11.5px', color: 'var(--text-secondary)', background: 'rgba(90,82,255,0.06)', border: '1px solid rgba(90,82,255,0.2)', borderRadius: '10px', padding: '12px 14px', lineHeight: 1.55 }}>
            <b style={{ color: '#fff' }}>Edit each platform on its own.</b> Same approved strategy — different ads per platform.
          </div>
        </div>
      </Gated>

      {/* ── 5. per-platform review ── */}
      <Gated locked={!approved || published} why={published ? 'Published — read-only. Create a new version to edit the ads.' : 'Approve the strategy to review platform ads'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Meta + Google sit side-by-side when both are selected, full-width when only one. */}
          <div style={{ display: 'grid', gridTemplateColumns: (platforms.meta && platforms.google) ? 'repeat(auto-fit, minmax(330px, 1fr))' : '1fr', gap: '18px' }}>

          {/* META */}
          {platforms.meta && (
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <h3 style={{ ...sectionTitle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>Meta Ads Review <Pill status="MOCK" /></h3>
                <Pill status={metaSetup.launched ? 'Ready' : metaSetup.connected ? 'In Progress' : 'Pending'} />
              </div>
              <Row k="Campaign name" v={campaign?.name || '—'} />
              <Row k="Objective" v={campaign?.objective || '—'} />
              <Row k="Budget" v={split.meta ? money(split.meta.amount) : '—'} />
              <Row k="Ad format" v={`Image ads (${selectedImage ? 1 : 0})`} />
              <Row k="Audience" v={spec.audience || form.audience} stack />
              <Row k="Placements" v={
                <span style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {String(spec.placements || form.placement).split(',').map((pl, i) => (
                    <span key={i} style={{ fontSize: '11px', background: 'rgba(255,255,255,0.07)', borderRadius: '6px', padding: '3px 9px' }}>{pl.trim()}</span>
                  ))}
                </span>} stack />
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '7px' }}>Creatives</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {selectedImage ? (
                    <img src={selectedImage} alt="Approved creative" style={{ width: '68px', height: '68px', objectFit: 'cover', borderRadius: '9px', border: '1px solid var(--border, var(--border-color))' }} />
                  ) : (
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>No creative selected — approve one above.</span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '15px', flexWrap: 'wrap' }}>
                {!metaSetup.connected ? (
                  <button onClick={() => adSetup('meta', 'connect')} style={{ ...btnGhost, flex: 1 }}>Connect account</button>
                ) : !metaSetup.launched ? (
                  <button onClick={() => adSetup('meta', 'launch')} disabled={busy === 'meta-launch'} style={{ ...btnPrimary, flex: 1, padding: '10px' }}>
                    <Check size={14} /> {busy === 'meta-launch' ? 'Marking…' : 'Mark as Ready'}
                  </button>
                ) : (
                  <span style={{ flex: 1, fontSize: '12px', color: '#00e676', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: '9px', padding: '10px' }}>
                    <CheckCircle2 size={14} /> Ready to publish
                  </span>
                )}
              </div>
            </div>
          )}

          {/* GOOGLE */}
          {platforms.google && (
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <h3 style={{ ...sectionTitle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>Google Ads Review <Pill status="MOCK" /></h3>
                <Pill status={googleSetup.launched ? 'Ready' : googleSetup.connected ? 'In Progress' : 'Pending'} />
              </div>
              <div style={{ padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Campaign type</div>
                <select value={googleType} onChange={e => setGoogleTypeOverride(e.target.value)}
                  style={{ ...input, padding: '8px 10px', fontSize: '12.5px', width: '100%' }}>
                  {GOOGLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {(rec.google_campaign_type && rec.google_campaign_type.reason) && (
                  <div style={{ display: 'flex', gap: '7px', marginTop: '8px', fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                    <Sparkles size={13} color="var(--primary)" style={{ flexShrink: 0, marginTop: '1px' }} />
                    <span>
                      {googleType === aiGoogleType
                        ? <><b style={{ color: '#b3aaff' }}>Why {aiGoogleType}?</b> {rec.google_campaign_type.reason}</>
                        : <>AI recommended <b style={{ color: '#b3aaff' }}>{aiGoogleType}</b> — {rec.google_campaign_type.reason} You've switched to <b style={{ color: '#b3aaff' }}>{googleType}</b>.</>}
                    </span>
                  </div>
                )}
              </div>
              <Row k="Campaign name" v={campaign?.name || '—'} />
              <Row k="Budget" v={split.google ? money(split.google.amount) : '—'} />
              {gt.includes('search') && <Row k="Landing page" v={spec.landing_page || form.tracking || '—'} />}
              {gShow.keywords && <Row k={`Keywords (${keywords.length})`} v={chips(keywords)} stack />}
              {gShow.extensions && <Row k="Extensions" v={chips(g.extensions || [])} stack />}
              <Row k={`Headlines (${headlines.length})`} v={
                headlines.length ? (
                  <span style={{ display: 'block' }}>
                    {headlines.slice(0, 3).map((h, i) => (
                      <span key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '4px 0', fontSize: '12.5px' }}>
                        <span>{h}</span>
                        <span style={{ color: h.length > 30 ? '#ff5252' : 'var(--text-secondary)', fontSize: '11px', flexShrink: 0 }}>{h.length}/30</span>
                      </span>
                    ))}
                    {headlines.length > 3 && <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>+{headlines.length - 3} more headlines</span>}
                  </span>
                ) : <span style={{ color: 'var(--text-muted)' }}>—</span>} stack />
              <Row k={`Descriptions (${descriptions.length})`} v={
                descriptions.length ? (
                  <span style={{ display: 'block' }}>
                    {descriptions.slice(0, 2).map((d, i) => (
                      <span key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '4px 0', fontSize: '12.5px' }}>
                        <span>{d}</span>
                        <span style={{ color: d.length > 90 ? '#ff5252' : 'var(--text-secondary)', fontSize: '11px', flexShrink: 0 }}>{d.length}/90</span>
                      </span>
                    ))}
                    {descriptions.length > 2 && <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>+{descriptions.length - 2} more descriptions</span>}
                  </span>
                ) : <span style={{ color: 'var(--text-muted)' }}>—</span>} stack />
              {gShow.images && <Row k="Images" v={
                <span style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedImage
                    ? <img src={selectedImage} alt="Approved creative" style={{ width: '68px', height: '68px', objectFit: 'cover', borderRadius: '9px', border: '1px solid var(--border, var(--border-color))' }} />
                    : <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>No creative selected — approve one above.</span>}
                  {(g.image_ideas || []).length ? chips(g.image_ideas) : null}
                </span>} stack />}
              {gShow.videos && <Row k="Videos" v={chips((g.video_ideas || []).length ? g.video_ideas : ['Video placeholder (optional)'])} stack />}
              {gShow.signals && <Row k="Audience signals" v={chips(g.audience_signals || [])} stack />}
              {gShow.images && <Row k="CTA" v={g.cta || (rec.cta && rec.cta.value) || '—'} />}
              <div style={{ display: 'flex', gap: '8px', marginTop: '15px', flexWrap: 'wrap' }}>
                {!googleSetup.connected ? (
                  <button onClick={() => adSetup('google', 'connect')} style={{ ...btnGhost, flex: 1 }}>Connect account</button>
                ) : !googleSetup.launched ? (
                  <button onClick={() => adSetup('google', 'launch')} disabled={busy === 'google-launch'} style={{ ...btnPrimary, flex: 1, padding: '10px' }}>
                    <Check size={14} /> {busy === 'google-launch' ? 'Marking…' : 'Mark as Ready'}
                  </button>
                ) : (
                  <span style={{ flex: 1, fontSize: '12px', color: '#00e676', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: '9px', padding: '10px' }}>
                    <CheckCircle2 size={14} /> Ready to publish
                  </span>
                )}
              </div>
            </div>
          )}

          </div>

          {/* OPTIMIZATION RULES — full width, below the platform reviews */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <h3 style={{ ...sectionTitle, marginBottom: 0 }}>Campaign Optimization Rules</h3>
              <Pill status="Configured" />
            </div>
            <p style={{ ...sectionHint, marginBottom: '14px' }}>Safety limits applied once ads are live, so a bad ad gets stopped early.</p>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}><XCircle size={15} color="#ffae00" /> Auto-kill bad ads</span>
              <label className="toggle-switch"><input type="checkbox" checked={smart.killAds} onChange={e => setSmart(s => ({ ...s, killAds: e.target.checked }))} /><span className="slider" /></label>
            </div>
            {smart.killAds && (<>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>Kill if CPA over (₹)</span>
                <input type="number" value={smart.cpaThreshold} onChange={e => setSmart(s => ({ ...s, cpaThreshold: Number(e.target.value) }))} style={{ ...input, width: '104px', padding: '7px 10px', textAlign: 'right' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>Kill if frequency over</span>
                <input type="number" step="0.1" value={smart.frequencyCap} onChange={e => setSmart(s => ({ ...s, frequencyCap: Number(e.target.value) }))} style={{ ...input, width: '104px', padding: '7px 10px', textAlign: 'right' }} />
              </div>
            </>)}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', marginTop: '4px' }}>
              <span style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}><RefreshCw size={15} color="var(--primary)" /> Smart creative rotation</span>
              <label className="toggle-switch"><input type="checkbox" checked={smart.autoRotate} onChange={e => setSmart(s => ({ ...s, autoRotate: e.target.checked }))} /><span className="slider" /></label>
            </div>
            {smart.autoRotate && (<>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>Rotate if skip rate over (%)</span>
                <input type="number" value={smart.skipRateThreshold} onChange={e => setSmart(s => ({ ...s, skipRateThreshold: Number(e.target.value) }))} style={{ ...input, width: '104px', padding: '7px 10px', textAlign: 'right' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '9px 0' }}>
                <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>Refresh every (days)</span>
                <input type="number" value={smart.refreshIntervalDays} onChange={e => setSmart(s => ({ ...s, refreshIntervalDays: Number(e.target.value) }))} style={{ ...input, width: '104px', padding: '7px 10px', textAlign: 'right' }} />
              </div>
            </>)}
          </div>
        </div>
      </Gated>

      {/* ── 6. human review & publish ── */}
      <Gated locked={!platformsReady || published} why={published ? 'Published — read-only. Create a new version to publish again.' : !approved ? 'Approve the strategy first' : 'Mark your selected platforms as Ready first'}>
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '4px' }}>
            <h3 style={{ ...sectionTitle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: '9px' }}>
              <ShieldCheck size={17} color="var(--primary)" /> Human Review &amp; Publish
            </h3>
            <button onClick={() => setReviewOpen(true)} style={{ ...btnGhost, padding: '9px 15px' }}>
              <Database size={14} /> Open full review
            </button>
          </div>
          <p style={{ ...sectionHint, marginBottom: '16px' }}>Check everything below, then confirm. Open the full review to re-read the approved strategy in one place.</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))', gap: '12px', marginBottom: '18px' }}>
            {[
              { n: 'Strategy', d: approved ? 'Approved' : 'Not approved', ok: approved },
              { n: 'Creative assets', d: selectedImage ? '1 image approved' : 'None selected', ok: !!selectedImage },
              ...(platforms.meta ? [{ n: 'Meta Ads', d: metaSetup.launched ? money(split.meta?.amount) : 'Not ready', ok: !!metaSetup.launched }] : []),
              ...(platforms.google ? [{ n: 'Google Ads', d: googleSetup.launched ? money(split.google?.amount) : 'Not ready', ok: !!googleSetup.launched }] : []),
              { n: 'Optimization rules', d: smart.killAds || smart.autoRotate ? 'Configured' : 'Off', ok: true },
            ].map(s => (
              <div key={s.n} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border, var(--border-color))', borderRadius: '10px', padding: '13px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '5px' }}>
                  {s.ok ? <CheckCircle2 size={14} color="#00e676" /> : <Clock size={14} color="var(--text-secondary)" />}
                  <span style={{ fontSize: '12.5px', fontWeight: 600 }}>{s.n}</span>
                </div>
                <div style={{ fontSize: '11.5px', color: s.ok ? '#00e676' : 'var(--text-secondary)' }}>{s.d}</div>
              </div>
            ))}
            <div style={{ background: 'rgba(90,82,255,0.08)', border: '1px solid rgba(90,82,255,0.25)', borderRadius: '10px', padding: '13px' }}>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Total budget</div>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>{money(spec.total_budget || form.budget)}</div>
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '11px', cursor: 'pointer', marginBottom: '16px' }}>
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} style={{ width: '17px', height: '17px', accentColor: 'var(--primary)', cursor: 'pointer', flexShrink: 0 }} />
            <span style={{ fontSize: '13px' }}>I have reviewed all details and confirm this campaign is ready to publish.</span>
          </label>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => { setConfirmed(false); flash('Unlocked — edit anything above, then confirm again.'); }} style={btnGhost}>Back to edit</button>
            <div style={{ flex: 1 }} />
            {platforms.meta && (
              <button onClick={() => attemptPublish(['meta'])} disabled={!canPublish || !metaSetup.launched || busy?.startsWith('publish')}
                style={{ ...btnGhost, opacity: canPublish && metaSetup.launched ? 1 : 0.45, cursor: canPublish && metaSetup.launched ? 'pointer' : 'not-allowed' }}>
                Publish to Meta only
              </button>
            )}
            {platforms.google && (
              <button onClick={() => publish(['google'])} disabled={!canPublish || !googleSetup.launched || busy?.startsWith('publish')}
                style={{ ...btnGhost, opacity: canPublish && googleSetup.launched ? 1 : 0.45, cursor: canPublish && googleSetup.launched ? 'pointer' : 'not-allowed' }}>
                Publish to Google only
              </button>
            )}
            <button onClick={() => attemptPublish(chosen)} disabled={!canPublish || busy?.startsWith('publish')}
              style={{ ...btnPrimary, padding: '12px 22px', opacity: canPublish ? 1 : 0.45, cursor: canPublish ? 'pointer' : 'not-allowed' }}>
              <Rocket size={15} /> {published ? (publishedForReal ? 'Published' : 'Published (demo)') : busy?.startsWith('publish') ? 'Publishing…' : `Publish to ${chosen.length === 2 ? 'all selected' : chosen.length === 1 ? (chosen[0] === 'meta' ? 'Meta' : 'Google') : 'selected'}`}
            </button>
          </div>

          <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '14px', background: 'rgba(255,174,0,0.05)', border: '1px solid rgba(255,174,0,0.2)', borderRadius: '9px', padding: '10px' }}>
            {published
              ? (publishedForReal
                  ? `Live on ${publishedList.map(p => (p === 'meta' ? 'Meta' : 'Google')).join(' & ')} — created paused. Activate it there to start spending.`
                  : `Published to ${publishedList.map(p => (p === 'meta' ? 'Meta' : 'Google')).join(' & ')} in demo mode — nothing was sent to a real ad account.`)
              : 'Real publishing turns on for each platform once its ad account is connected.'}
          </p>
        </div>
      </Gated>

      {/* ── publish-mode notice: real once Meta is connected AND a Page is picked ── */}
      {metaAccount?.ready_to_publish ? (
        <div style={{ ...card, padding: '13px 17px', display: 'flex', alignItems: 'center', gap: '11px', background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.22)' }}>
          <Check size={16} color="#00e676" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            <b style={{ color: '#fff' }}>Meta is live.</b> Publishing creates a real ad on Facebook and Instagram
            as <b style={{ color: '#fff' }}>{metaAccount.page_name || 'your Page'}</b>, billed to ad account{' '}
            {metaAccount.ad_account_id}. It is created <b style={{ color: '#fff' }}>paused</b> — activate it in Meta
            Ads Manager to start spending. Google Ads is still simulated.
          </span>
        </div>
      ) : (
        <div style={{ ...card, padding: '13px 17px', display: 'flex', alignItems: 'center', gap: '11px', background: 'rgba(255,174,0,0.05)', border: '1px solid rgba(255,174,0,0.22)' }}>
          <AlertTriangle size={16} color="#ffae00" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            <b style={{ color: '#fff' }}>Publishing is simulated.</b>{' '}
            {!metaAccount?.connected
              ? 'Connect your Meta account above to publish real ads to Facebook and Instagram.'
              : !metaAccount?.ad_account_id
                ? 'Meta is connected — now select the ad account to bill.'
                : 'Meta is connected — now select the Facebook Page to publish as. Meta cannot create an ad without one.'}
            {' '}Until then no ad account is touched and no money is spent.
          </span>
        </div>
      )}

      {/* ── recent activity ── */}
      <div style={card}>
        <h3 style={{ ...sectionTitle, display: 'flex', alignItems: 'center', gap: '9px' }}><Database size={16} color="var(--primary)" /> Recent Activity</h3>
        <p style={{ ...sectionHint, marginBottom: '12px' }}>What's happened in this session.</p>
        {activity.length === 0 ? (
          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>Nothing yet — generate a strategy to get started.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '10px' }}>
            {activity.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '9px', background: 'rgba(255,255,255,0.03)', borderRadius: '9px', padding: '11px 13px' }}>
                <CheckCircle2 size={14} color="#00e676" />
                <span style={{ fontSize: '12.5px', flex: 1 }}>{a.label}</span>
                <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{ago(a.at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── recently published (persists across the session; from real campaign data) ── */}
      {recentPublished.length > 0 && (
        <div style={card}>
          <h3 style={{ ...sectionTitle, display: 'flex', alignItems: 'center', gap: '9px' }}><Rocket size={16} color="var(--primary)" /> Recently Published</h3>
          <p style={{ ...sectionHint, marginBottom: '12px' }}>Every published campaign and version. Open one to keep working on it, duplicate it, or see its analytics.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recentPublished.length === 0 && <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>Nothing published yet.</p>}
            {recentPublished.map((c: any) => {
              const cm = c.metrics || {};
              const plats = (cm.published_platforms || []).map((p: string) => (p === 'meta' ? 'Meta' : 'Google')).join(' & ');
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border, var(--border-color))', borderRadius: '10px', padding: '11px 14px' }}>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                      {c.name || 'Campaign'} <span style={{ fontSize: '10px', fontWeight: 600, color: '#8B85FF', background: 'rgba(90,82,255,0.12)', border: '1px solid rgba(90,82,255,0.25)', borderRadius: '20px', padding: '1px 8px' }}>v{c.version || 1}</span>
                    </span>
                    <span style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                      {c.objective || '—'} · {money(c.budget || 0)}{plats ? ` · ${plats}` : ''}{cm.published_at ? ` · ${new Date(cm.published_at).toLocaleDateString()}` : ''}
                    </span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#00e676', background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: '20px', padding: '3px 9px', whiteSpace: 'nowrap' }}>PUBLISHED · DEMO</span>
                    <button onClick={() => refresh(c.id).then(scrollToTop)} style={{ ...btnGhost, padding: '5px 11px', fontSize: '11.5px' }}>View</button>
                    <button onClick={() => viewAnalytics(c.id)} style={{ ...btnGhost, padding: '5px 11px', fontSize: '11.5px' }}><BarChart3 size={12} /> Analytics</button>
                    <button onClick={() => duplicateCampaign(c.id).then(scrollToTop)} style={{ ...btnGhost, padding: '5px 11px', fontSize: '11.5px' }}><Copy size={12} /> Duplicate</button>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── publish popup: connect Meta account or publish in demo mode ── */}
      {publishPopup && (
        <div onClick={() => setPublishPopup(false)} style={{ position: 'fixed', inset: 0, zIndex: 5000, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div onClick={e => e.stopPropagation()} style={{ ...card, width: '100%', maxWidth: '440px', background: 'rgba(18,20,28,0.99)' }}>
            <h3 style={{ ...sectionTitle, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '9px' }}><Rocket size={17} color="var(--primary)" /> Connect Meta to publish?</h3>
            <p style={{ ...sectionHint, marginBottom: '18px' }}>
              You haven't connected a Meta ad account. Connect it to publish to a real account, or publish now in demo mode.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button onClick={connectMeta} style={{ ...btnPrimary, padding: '12px', justifyContent: 'center' }}>
                <CheckCircle2 size={15} /> Connect Meta account
              </button>
              <button onClick={() => { setPublishPopup(false); publish(chosen); }} disabled={busy?.startsWith('publish')} style={{ ...btnGhost, padding: '12px', justifyContent: 'center' }}>
                <Rocket size={15} /> Publish anyway (demo)
              </button>
              <button onClick={() => setPublishPopup(false)} style={{ ...btnGhost, padding: '10px', justifyContent: 'center', border: 'none' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── full review modal: the approved strategy, all in one place ── */}
      {whyOpen && (
        <div onClick={() => setWhyOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 5000, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ ...card, width: '100%', maxWidth: '640px', maxHeight: '86vh', overflowY: 'auto', background: 'rgba(18,20,28,0.99)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '4px' }}>
              <h3 style={{ ...sectionTitle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: '9px' }}>
                <Sparkles size={18} color="var(--primary)" /> Why AI recommended this
              </h3>
              <button onClick={() => setWhyOpen(false)} style={{ ...btnGhost, padding: '6px 12px', fontSize: '12px' }}>Close</button>
            </div>
            <p style={{ ...sectionHint, marginBottom: '18px' }}>The reasoning behind each part of this strategy, in plain language.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {whyRows.map((r, i) => (
                <div key={i} style={{ borderLeft: '2px solid rgba(90,82,255,0.4)', paddingLeft: '13px', paddingTop: '2px', paddingBottom: '2px' }}>
                  <div style={{ fontSize: '13px', color: '#fff' }}><b style={{ color: '#b3aaff' }}>{r.label}:</b> {r.value}</div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.55, marginTop: '3px' }}>{r.reason}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {reviewOpen && (
        <div onClick={() => setReviewOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 5000, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ ...card, width: '100%', maxWidth: '820px', maxHeight: '86vh', overflowY: 'auto', background: 'rgba(18,20,28,0.99)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '4px' }}>
              <h3 style={{ ...sectionTitle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: '9px' }}>
                <ShieldCheck size={18} color="var(--primary)" /> Full campaign review
              </h3>
              <button onClick={() => setReviewOpen(false)} style={{ ...btnGhost, padding: '6px 12px', fontSize: '12px' }}>Close</button>
            </div>
            <p style={{ ...sectionHint, marginBottom: '18px' }}>Everything you approved, in one place — read it through before publishing.</p>

            {/* strategy */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '.4px', color: 'var(--primary)', marginBottom: '9px' }}>APPROVED STRATEGY</div>
              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '10px' }}>
                {selectedImage && <img src={selectedImage} alt="Ad creative" style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '10px', border: '1px solid var(--border, var(--border-color))' }} />}
                <div style={{ flex: 1, minWidth: '230px' }}>
                  <Row k="Campaign" v={campaign?.name || '—'} />
                  <Row k="Objective" v={campaign?.objective || '—'} />
                  <Row k="Runs for" v={spec.duration_label || form.schedule} />
                  <Row k="Total budget" v={money(spec.total_budget || form.budget)} />
                </div>
              </div>
              <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid var(--border, var(--border-color))' }}>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '5px' }}>Who this campaign targets</div>
                <div style={{ fontSize: '13px', lineHeight: 1.6 }}>{spec.audience || form.audience}</div>
              </div>
            </div>

            {/* budget split + KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '18px', marginBottom: '18px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '.4px', color: 'var(--primary)', marginBottom: '9px' }}>BUDGET SPLIT</div>
                {split.meta && <Row k="Meta Ads" v={`${split.meta.pct}% · ${money(split.meta.amount)}`} />}
                {split.google && <Row k="Google Ads" v={`${split.google.pct}% · ${money(split.google.amount)}`} />}
                {!split.meta && !split.google && <p style={sectionHint}>Not set.</p>}
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '.4px', color: 'var(--primary)', marginBottom: '9px' }}>SUCCESS TARGETS</div>
                {(spec.kpis || []).map((k: string) => (
                  <div key={k} style={{ fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '5px' }}><CheckCircle2 size={13} color="#00e676" /> {k}</div>
                ))}
                {!(spec.kpis || []).length && <p style={sectionHint}>None set.</p>}
              </div>
            </div>

            {/* ad copy */}
            {(keywords.length > 0 || headlines.length > 0 || descriptions.length > 0) && (
              <div style={{ marginBottom: '18px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '.4px', color: 'var(--primary)', marginBottom: '9px' }}>AD COPY &amp; KEYWORDS</div>
                {keywords.length > 0 && (
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Keywords ({keywords.length})</div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {keywords.map(k => <span key={k} style={{ fontSize: '11px', color: '#8B85FF', background: 'rgba(90,82,255,0.12)', border: '1px solid rgba(90,82,255,0.25)', borderRadius: '6px', padding: '3px 9px' }}>{k}</span>)}
                    </div>
                  </div>
                )}
                {headlines.length > 0 && (
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Headlines ({headlines.length})</div>
                    {headlines.map((h, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '12.5px', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <span>{h}</span><span style={{ color: h.length > 30 ? '#ff5252' : 'var(--text-secondary)', fontSize: '11px', flexShrink: 0 }}>{h.length}/30</span>
                      </div>
                    ))}
                  </div>
                )}
                {descriptions.length > 0 && (
                  <div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Descriptions ({descriptions.length})</div>
                    {descriptions.map((d, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '12.5px', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <span>{d}</span><span style={{ color: d.length > 90 ? '#ff5252' : 'var(--text-secondary)', fontSize: '11px', flexShrink: 0 }}>{d.length}/90</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* where it goes + rules */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '18px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '.4px', color: 'var(--primary)', marginBottom: '9px' }}>PUBLISHING TO</div>
                {chosen.length === 0 && <p style={sectionHint}>No platform selected.</p>}
                {chosen.map(p => (
                  <Row key={p} k={p === 'meta' ? 'Meta Ads' : 'Google Ads'}
                    v={setupOf(p).launched ? <span style={{ color: '#00e676' }}>Ready</span> : <span style={{ color: '#ffae00' }}>Not ready</span>} />
                ))}
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '.4px', color: 'var(--primary)', marginBottom: '9px' }}>SAFETY RULES</div>
                <Row k="Auto-kill bad ads" v={smart.killAds ? `On · CPA > ₹${smart.cpaThreshold}, freq > ${smart.frequencyCap}` : 'Off'} stack />
                <Row k="Creative rotation" v={smart.autoRotate ? `On · skip > ${smart.skipRateThreshold}%, every ${smart.refreshIntervalDays}d` : 'Off'} stack />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button onClick={() => setReviewOpen(false)} style={btnGhost}>Close</button>
              <button onClick={() => { setConfirmed(true); setReviewOpen(false); flash('Reviewed and confirmed — you can publish now.'); }}
                disabled={!platformsReady}
                style={{ ...btnPrimary, padding: '11px 20px', opacity: platformsReady ? 1 : 0.45, cursor: platformsReady ? 'pointer' : 'not-allowed' }}>
                <Check size={15} /> I've reviewed — confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── analytics modal (mock, demo) ── */}
      {analyticsView && (() => {
        const a = analyticsView; const t = a.totals || {};
        const tiles = [
          { k: 'Impressions', v: (t.impressions || 0).toLocaleString('en-IN') },
          { k: 'Reach', v: (t.reach || 0).toLocaleString('en-IN') },
          { k: 'Clicks', v: (t.clicks || 0).toLocaleString('en-IN') },
          { k: 'CTR', v: `${t.ctr}%` },
          { k: 'Conversions', v: t.conversions },
          { k: 'CPA', v: money(t.cpa) },
          { k: 'Spend', v: money(t.spend) },
          { k: 'ROAS', v: `${t.roas}×`, hot: (t.roas || 0) >= 2 },
        ];
        const sevColor: Record<string, string> = { good: '#00e676', warn: '#ffae00', critical: '#ff5c5c' };
        return (
          <div onClick={() => setAnalyticsView(null)} style={{ position: 'fixed', inset: 0, zIndex: 5000, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div onClick={e => e.stopPropagation()} style={{ ...card, width: '100%', maxWidth: '760px', maxHeight: '88vh', overflowY: 'auto', background: 'rgba(18,20,28,0.99)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '4px' }}>
                <h3 style={{ ...sectionTitle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: '9px' }}>
                  <BarChart3 size={18} color="var(--primary)" /> {a.name || 'Campaign'} — Analytics <Pill status="DEMO" />
                </h3>
                <button onClick={() => setAnalyticsView(null)} style={{ ...btnGhost, padding: '6px 12px', fontSize: '12px' }}>Close</button>
              </div>
              <p style={{ ...sectionHint, marginBottom: '16px' }}>v{a.version} · {(a.platforms || []).map((p: string) => p === 'meta' ? 'Meta' : 'Google').join(' & ')} · {a.status === 'PUBLISHED_DEMO' ? 'Published (demo)' : a.status}. Mock figures — real Meta/Google insights plug in later.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px', marginBottom: '18px' }}>
                {tiles.map(x => (
                  <div key={x.k} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border, var(--border-color))', borderRadius: '10px', padding: '12px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{x.k}</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: (x as any).hot ? '#00e676' : '#fff' }}>{x.v}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '18px' }}>
                {a.meta_performance && (
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border, var(--border-color))', borderRadius: '10px', padding: '13px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#8B85FF', marginBottom: '8px' }}>Meta Performance</div>
                    <Row k="Spend" v={money(a.meta_performance.spend)} /><Row k="Conversions" v={a.meta_performance.conversions} /><Row k="ROAS" v={`${a.meta_performance.roas}×`} />
                  </div>
                )}
                {a.google_performance && (
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border, var(--border-color))', borderRadius: '10px', padding: '13px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#8B85FF', marginBottom: '8px' }}>Google Performance</div>
                    <Row k="Spend" v={money(a.google_performance.spend)} /><Row k="Conversions" v={a.google_performance.conversions} /><Row k="ROAS" v={`${a.google_performance.roas}×`} />
                  </div>
                )}
              </div>
              {a.top_keywords?.length > 0 && (
                <div style={{ marginBottom: '18px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '.4px', color: 'var(--primary)', marginBottom: '9px' }}>TOP KEYWORDS</div>
                  {a.top_keywords.map((kw: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '12.5px', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span>{kw.keyword}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{kw.clicks} clicks · {kw.ctr}% CTR · {kw.conversions} conv</span>
                    </div>
                  ))}
                </div>
              )}
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '.4px', color: 'var(--primary)', marginBottom: '9px' }}>AI RECOMMENDATIONS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(a.recommendations || []).map((r: any, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', background: 'rgba(255,255,255,0.03)', border: `1px solid ${sevColor[r.severity] || '#888'}44`, borderRadius: '9px', padding: '10px 12px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: sevColor[r.severity] || '#fff', whiteSpace: 'nowrap' }}>{r.action}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{r.why}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 4000, maxWidth: '580px', background: 'rgba(20,22,30,0.97)', border: `1px solid ${toast.ok ? 'rgba(0,230,118,0.4)' : 'rgba(255,174,0,0.4)'}`, borderRadius: '12px', padding: '14px 18px', color: '#fff', fontSize: '13px', boxShadow: '0 12px 30px rgba(0,0,0,0.5)', display: 'flex', gap: '11px', alignItems: 'center' }}>
          {toast.ok ? <CheckCircle2 size={16} color="#00e676" /> : <AlertTriangle size={16} color="#ffae00" />} {toast.msg}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .toggle-switch { position: relative; display: inline-block; width: 38px; height: 21px; }
        .toggle-switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--border, #333); transition: .2s; border-radius: 34px; }
        .slider:before { position: absolute; content: ""; height: 15px; width: 15px; left: 3px; bottom: 3px; background-color: white; transition: .2s; border-radius: 50%; }
        input:checked + .slider { background-color: var(--primary); }
        input:checked + .slider:before { transform: translateX(17px); }
      `}} />
    </div>
  );
};
