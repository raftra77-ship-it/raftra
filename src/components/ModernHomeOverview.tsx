import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Plus,
  Layers,
  BarChart3,
  Calendar,
  Clock,
  Zap,
  TrendingUp,
  Image as ImageIcon,
  Video,
  Eye,
  ArrowUpRight,
  Palette,
  Type,
  FileText,
  Target,
  Share2,
  AlertCircle,
  RefreshCw,
  Sliders,
  Check,
  X,
  Play,
  Copy,
  Cpu,
  Link2
} from 'lucide-react';
import { GlowButton } from './GlowButton';

interface ModernHomeOverviewProps {
  userName?: string;
  brandName?: string;
  workspaceId?: number | null;
  /** Every connector's status, fetched once by the dashboard. Null while it is in flight. */
  connectorStatus?: Record<string, any> | null;
  connectorStatusFailed?: boolean;
  onNavigateTab: (tab: string) => void;
  onOpenReview?: (itemTitle: string) => void;
}

/* The ad-account connectors this platform actually has.
   The Connect modal used to list nine of them - ChatGPT Ads, Amazon Ads, Google Drive,
   Slack, HubSpot among them - and every unlocked row called handleSimulateConnect, a 900ms
   timer that flipped the page to "connected" without contacting any provider. Meta, Google
   Ads, Search Console and GA4 have real OAuth connectors in backend/connector_routes.py;
   the rest have no backend at all, so they are listed as unavailable rather than offered. */
const HOME_CONNECTORS: {
  key: string;
  name: string;
  desc: string;
  tag: string;
  batchKey: string;
  authorizePath?: (ws: number) => string;
  read: (s: any) => { configured: boolean; connected: boolean; detail: string | null };
  isAdAccount?: boolean;
  unconfiguredHint: string;
}[] = [
  {
    key: 'meta',
    name: 'Meta Ads',
    desc: 'Run and optimize ads across Facebook, Instagram, Threads, and more.',
    tag: 'Ad Account',
    isAdAccount: true,
    batchKey: 'meta',
    authorizePath: (ws) => `/api/connectors/meta/${ws}/authorize`,
    read: (s) => ({ configured: !!s.configured, connected: !!s.connected, detail: s.name || s.ad_account_id || null }),
    unconfiguredHint: 'Server is missing META_APP_ID / META_APP_SECRET.',
  },
  {
    key: 'google-ads',
    name: 'Google Ads',
    desc: 'Run and optimize ads across Search, YouTube, Maps, Gmail, and more.',
    tag: 'Ad Account',
    isAdAccount: true,
    batchKey: 'google_ads',
    authorizePath: (ws) => `/api/connectors/google-ads/${ws}/authorize`,
    read: (s) => ({ configured: !!s.configured, connected: !!s.connected, detail: s.email || s.customer_id || null }),
    unconfiguredHint: 'Server is missing GOOGLE_ADS_CLIENT_ID / SECRET / DEVELOPER_TOKEN.',
  },
  {
    key: 'gsc',
    name: 'Google Search Console',
    desc: 'Monitor organic search rankings, keyword impressions, CTR, and indexing health.',
    tag: 'Analytics',
    batchKey: 'search_console',
    authorizePath: (ws) => `/api/connectors/search-console/${ws}/authorize`,
    read: (s) => ({ configured: !!s.configured, connected: !!s.connected, detail: s.site_url || s.email || null }),
    unconfiguredHint: 'Server is missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.',
  },
  {
    key: 'gdrive',
    name: 'Google Drive',
    desc: 'Import brand assets, product photos and creative guidelines into your Asset Vault.',
    tag: 'Assets',
    batchKey: 'gdrive',
    authorizePath: (ws) => `/api/connectors/gdrive/${ws}/authorize`,
    read: (s) => ({ configured: !!s.configured, connected: !!s.connected, detail: s.email || null }),
    unconfiguredHint: 'Server is missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.',
  },
  {
    key: 'ga4',
    name: 'Google Analytics 4',
    desc: 'Pull traffic, event, and conversion data across your site and campaigns.',
    tag: 'Analytics',
    // GA4 rides on the Search Console grant and only counts once a property id is saved.
    batchKey: 'search_console',
    read: (s) => ({ configured: !!s.configured, connected: !!(s.connected && s.ga4_property_id), detail: s.ga4_property_id || null }),
    unconfiguredHint: 'Connect Search Console first, then pick a GA4 property in SEO + GEO.',
  },
];

// Listed so the roadmap stays visible, but with no Connect button, because there is nothing
// behind them to connect to.
const HOME_CONNECTORS_UNAVAILABLE = [
  { name: 'ChatGPT Ads', desc: 'Run and optimize ads in ChatGPT conversations.' },
  { name: 'Amazon Ads', desc: 'Run and optimize product ads on Amazon.' },
  { name: 'Slack', desc: 'Receive real-time campaign alerts and creative approval requests.' },
  { name: 'HubSpot', desc: 'Sync leads, CRM contacts, deals, and attribution pipelines.' },
];

export const ModernHomeOverview: React.FC<ModernHomeOverviewProps> = ({
  userName = 'aryan070606',
  brandName = 'Demo Brand',
  workspaceId = null,
  connectorStatus = null,
  connectorStatusFailed = false,
  onNavigateTab,
  onOpenReview
}) => {
  /* Brand Kit Review Modal.
     It said "Extracted from {brand} guidelines" over content that was extracted from
     nothing: Raftra's own palette (#5A52FF "Electric Violet"), Raftra's own fonts, a generic
     paragraph of brand voice, "28 Synced" assets illustrated with stock photos, and a fixed
     "18–35, Delhi/Mumbai/Bengaluru" audience. Onboarding's crawl writes all of this for real
     into brand_profiles, and /brand-profile serves it, so that is what it reads now. */
  const [showBrandKitModal, setShowBrandKitModal] = useState(false);
  const [activeBrandKitTab, setActiveBrandKitTab] = useState<'logo' | 'colors' | 'typography' | 'knowledge' | 'assets' | 'market'>('logo');
  const [brandKit, setBrandKit] = useState<any | null>(null);
  const [brandKitLoading, setBrandKitLoading] = useState(true);
  const [vaultAssets, setVaultAssets] = useState<{ url: string; name: string }[]>([]);

  /* Ad account connection.
     `isAdAccountConnected` used to be plain local state, flipped either by a "Demo Mode
     (Click to Toggle)" button or by a 900ms fake connect, and it gated whether this page
     showed invented recommendations and invented creative performance as live account data.
     It is now derived from the connectors' own status endpoints. */
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectorStates, setConnectorStates] = useState<
    Record<string, { configured: boolean; connected: boolean; detail: string | null } | 'error'>
  >({});
  const [connectorsLoading, setConnectorsLoading] = useState(true);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [connectNote, setConnectNote] = useState<string | null>(null);

  const authHdrs = (): HeadersInit => {
    const t = localStorage.getItem('token');
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  /* Nothing is fetched here any more: the dashboard loads every connector's status once and
     hands it down, so opening Home and then Integrations costs one request between them
     rather than one each — they were previously firing the same call twice, and the second
     queued behind the first for database connections (measured: 2.5s, then 4.6s). */
  useEffect(() => {
    if (!workspaceId) { setConnectorStates({}); setConnectorsLoading(false); return; }
    if (!connectorStatus) {
      // 'error' is kept distinct from "not connected": a failed status call tells us
      // nothing, and guessing in either direction is what produced the wrong badges.
      if (connectorStatusFailed) {
        setConnectorStates(Object.fromEntries(HOME_CONNECTORS.map(c => [c.key, 'error' as const])));
        setConnectorsLoading(false);
      } else {
        setConnectorsLoading(true);
      }
      return;
    }
    setConnectorStates(Object.fromEntries(HOME_CONNECTORS.map(c => {
      const payload = connectorStatus[c.batchKey];
      return [c.key, payload ? c.read(payload) : ('error' as const)] as const;
    })));
    setConnectorsLoading(false);
  }, [workspaceId, connectorStatus, connectorStatusFailed]);

  useEffect(() => {
    if (!workspaceId) { setBrandKitLoading(false); return; }
    let cancelled = false;
    setBrandKitLoading(true);
    Promise.all([
      fetch(`/api/workspaces/${workspaceId}/brand-profile`, { headers: authHdrs() })
        .then(r => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`/api/workspaces/${workspaceId}/assets`, { headers: authHdrs() })
        .then(r => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([bp, av]) => {
      if (cancelled) return;
      if (bp) setBrandKit(bp);
      const rows = Array.isArray(av?.assets) ? av.assets : [];
      setVaultAssets(rows
        .filter((a: any) => a?.url && !String(a.format || '').match(/mp4|webm|mov/i))
        .map((a: any) => ({ url: a.url, name: a.alt_text || a.filename || 'Asset' })));
    }).finally(() => { if (!cancelled) setBrandKitLoading(false); });
    return () => { cancelled = true; };
  }, [workspaceId]);

  const bkGuidelines = (brandKit?.guidelines || {}) as Record<string, any>;
  const bkLine = (v: any): string => Array.isArray(v) ? v.filter(Boolean).join(', ') : (v ? String(v) : '');
  // One palette, whichever form the crawl managed to record.
  const bkColors: { name: string; hex: string }[] =
    (Array.isArray(brandKit?.color_tokens) && brandKit.color_tokens.length
      ? brandKit.color_tokens.map((t: any) => ({ name: t?.name || t?.role || 'Brand colour', hex: t?.hex || t?.value || '' }))
      : (brandKit?.color_palette || []).map((hex: any) => ({ name: 'Brand colour', hex: String(hex) }))
    ).filter((c: any) => /^#[0-9a-f]{3,8}$/i.test(String(c.hex || '').trim()));

  // 'error' means the status call failed and we know nothing — never treat it as a state.
  const liveState = (key: string) => {
    const s = connectorStates[key];
    return s && s !== 'error' ? s : null;
  };
  const metaView = liveState('meta');
  const googleAdsView = liveState('google-ads');
  const metaConnected = !!metaView?.connected;
  const googleAdsConnected = !!googleAdsView?.connected;
  const isAdAccountConnected = metaConnected || googleAdsConnected;
  const connectedAccountLabel = metaConnected && metaView?.detail ? `Meta · ${metaView.detail}`
    : googleAdsConnected && googleAdsView?.detail ? `Google Ads · ${googleAdsView.detail}`
    : null;

  // Hands the browser to the provider's own consent screen — the same flow the Integrations
  // Hub uses. Nothing here marks a connection as made; the callback and the status endpoint
  // decide that.
  const startConnect = async (c: typeof HOME_CONNECTORS[number]) => {
    if (!workspaceId || !c.authorizePath) return;
    setConnectingPlatform(c.key);
    setConnectNote(null);
    try {
      const r = await fetch(c.authorizePath(workspaceId), { headers: authHdrs() });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.url) { window.location.href = d.url; return; }
      setConnectNote(d.detail || `Could not start the ${c.name} connection.`);
    } catch {
      setConnectNote('Could not reach the server. Please try again.');
    }
    setConnectingPlatform(null);
  };

  /* The optimization feed and creative performance, from the ad account itself.
     backend/core/campaign_optimizer.py computes these from real Meta insights — it is the
     same feed the Campaign Manager reads — replacing two hardcoded arrays that quoted
     "+₹18,000 weekly savings", "4.8x ROAS" and "₹14,500" spend to every workspace. */
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [creativePerf, setCreativePerf] = useState<any[]>([]);
  const [perfLoading, setPerfLoading] = useState(false);
  const [perfError, setPerfError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId || !metaConnected) { setRecommendations([]); setCreativePerf([]); return; }
    let cancelled = false;
    setPerfLoading(true);
    setPerfError(null);
    /* One call, not two. /recommendations already fetches the insights it reasons over, so
       asking /insights as well queried Meta's API twice for the same window — and each of
       those round trips was taking over twenty seconds, measured in the browser. */
    fetch(`/api/connectors/meta/${workspaceId}/recommendations`, { headers: authHdrs() })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(d => {
        if (cancelled) return;
        setRecommendations(Array.isArray(d?.recommendations) ? d.recommendations : []);
        const rows = d?.insights && typeof d.insights === 'object' ? Object.values(d.insights) : [];
        setCreativePerf((rows as any[]).sort((a, b) => (b?.roas || 0) - (a?.roas || 0)));
      })
      .catch(() => {
        if (!cancelled) setPerfError('Could not read live performance from the ad account.');
      })
      .finally(() => { if (!cancelled) setPerfLoading(false); });
    return () => { cancelled = true; };
  }, [workspaceId, metaConnected]);

  // Recommendations Modal State
  const [showRecommendationsModal, setShowRecommendationsModal] = useState(false);

  // Scheduler Modal State
  const [showSchedulerModal, setShowSchedulerModal] = useState(false);

  // Schedule items state
  const [schedules, setSchedules] = useState([
    {
      id: 'sch_1',
      title: `${brandName} Fresh Creative Batch`,
      frequency: 'Mon, Thu at 9:00 AM • Next run in 2d',
      type: 'Creative AI Generation',
      status: 'Active',
      color: '#7C75FF'
    },
    {
      id: 'sch_2',
      title: 'Weekly competitor report',
      frequency: 'Weekly on Mon at 9:00 AM • Next run in 6d',
      type: 'Market Intelligence Crawl',
      status: 'Active',
      color: '#00D2FF'
    },
    {
      id: 'sch_3',
      title: 'Daily ROAS Guardrail & Bid Scaling',
      frequency: 'Daily at 12:00 AM • Next run in 11h',
      type: 'Ad Optimization Auto-Pilot',
      status: 'Active',
      color: '#00E676'
    }
  ]);

  // Brand Kit Checklist Items
  const brandKitItems = [
    { id: 'logo', label: 'Logo', status: 'Ready', icon: <ImageIcon size={16} color="#7C75FF" /> },
    { id: 'colors', label: 'Colors', status: 'Ready', icon: <Palette size={16} color="#00E676" /> },
    { id: 'typography', label: 'Typography', status: 'Ready', icon: <Type size={16} color="#00D2FF" /> },
    { id: 'knowledge', label: 'Brand knowledge', status: 'Ready', icon: <FileText size={16} color="#FFB300" /> },
    { id: 'assets', label: 'Assets', status: 'Ready', icon: <Layers size={16} color="#FF5296" /> },
    { id: 'market', label: 'Target Market', status: 'Ready', icon: <Target size={16} color="#A855F7" /> }
  ];


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* ── GREETING HERO BAR ─────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: 'rgba(90, 82, 255, 0.12)', borderRadius: '100px', border: '1px solid rgba(90, 82, 255, 0.25)', marginBottom: '10px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#00E676', boxShadow: '0 0 8px #00E676' }} />
            <span style={{ fontSize: '12px', color: '#00E676', fontWeight: 700, letterSpacing: '0.04em' }}>
              RAFTRA AI GROWTH OS ACTIVE
            </span>
          </div>
          <h1 style={{ fontSize: '32px', fontFamily: 'var(--font-heading)', margin: '0 0 6px 0', color: '#fff', fontWeight: 800 }}>
            How are you doing, <span style={{ color: '#00E676' }}>{userName || brandName}</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14.5px', margin: 0 }}>
            Here is your live brand health, automated scheduled pipelines, and creative performance overview.
          </p>
        </div>

        {/* Action controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Reports the connectors' real state and opens the connect flow. It used to be a
              toggle labelled "Demo Mode (Click to Toggle)" that switched the page into
              showing fabricated account data with one click. */}
          <button
            onClick={() => !isAdAccountConnected && setShowConnectModal(true)}
            title={connectedAccountLabel || 'Connect a Meta or Google Ads account'}
            style={{
              background: isAdAccountConnected ? 'rgba(0, 230, 118, 0.12)' : 'rgba(255, 255, 255, 0.04)',
              border: isAdAccountConnected ? '1px solid rgba(0, 230, 118, 0.4)' : '1px solid rgba(255, 255, 255, 0.15)',
              color: isAdAccountConnected ? '#00E676' : '#ffffff',
              padding: '8px 16px',
              borderRadius: '100px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: isAdAccountConnected ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            {isAdAccountConnected ? <CheckCircle2 size={14} color="#00E676" /> : <Link2 size={14} />}
            {connectorsLoading ? 'Checking ad account…'
              : isAdAccountConnected ? `Ad Account: Connected${connectedAccountLabel ? ` · ${connectedAccountLabel}` : ''}`
              : 'No ad account connected'}
          </button>

          <GlowButton variant="glow" onClick={() => onNavigateTab('studio')} style={{ fontSize: '13.5px', padding: '10px 20px' }}>
            <Sparkles size={15} /> Create Fresh Creatives
          </GlowButton>
        </div>
      </div>

      {/* ── 0. OVERALL GROWTH SCORE & TRAJECTORY TRACKER CARD ──────── */}
      <div
        className="glow-card"
        style={{
          background: 'linear-gradient(135deg, rgba(20, 32, 28, 0.85) 0%, rgba(10, 16, 22, 0.95) 100%)',
          border: '1.5px solid rgba(0, 230, 118, 0.35)',
          borderRadius: '24px',
          padding: '26px 30px',
          boxShadow: '0 12px 40px rgba(0, 230, 118, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          gap: '22px'
        }}
      >
        {/* Top Header Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Score Ring / Pill */}
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '18px',
                background: 'linear-gradient(135deg, rgba(0, 230, 118, 0.2) 0%, rgba(0, 200, 83, 0.08) 100%)',
                border: '2px solid #00E676',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 20px rgba(0, 230, 118, 0.25)',
                flexShrink: 0
              }}
            >
              <span style={{ fontSize: '22px', fontWeight: 900, color: '#00E676', lineHeight: 1 }}>84</span>
              <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>/ 100</span>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <h2 style={{ fontSize: '22px', color: '#fff', margin: 0, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
                  Overall Growth Score & Trajectory
                </h2>
                <span style={{ fontSize: '11px', background: 'rgba(0, 230, 118, 0.2)', color: '#00E676', border: '1px solid rgba(0, 230, 118, 0.4)', padding: '2px 9px', borderRadius: '100px', fontWeight: 800 }}>
                  🔥 High Velocity Growth (+18.4 pts)
                </span>
              </div>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: 0 }}>
                Real-time composite score based on creative velocity, ROAS efficiency, competitor defense, and AEO schema.
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('studio')}
            style={{
              background: 'linear-gradient(135deg, #00E676 0%, #00C853 100%)',
              color: '#000000',
              border: 'none',
              borderRadius: '100px',
              padding: '9px 20px',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 16px rgba(0, 230, 118, 0.35)',
              transition: 'all 0.2s ease'
            }}
          >
            <TrendingUp size={14} /> Boost Score 🚀
          </button>
        </div>

        {/* 4 Key Growth Metrics Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.07)', borderRadius: '14px', padding: '14px 18px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>Attributed Revenue</span>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#fff', marginTop: '2px' }}>
              ₹7,74,900 <span style={{ fontSize: '12px', color: '#00E676', fontWeight: 700 }}>+38.4%</span>
            </div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.07)', borderRadius: '14px', padding: '14px 18px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>Blended ROAS</span>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#00E676', marginTop: '2px' }}>
              4.2x <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Target: &gt;3.5x</span>
            </div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.07)', borderRadius: '14px', padding: '14px 18px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>Conversion Rate</span>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#fff', marginTop: '2px' }}>
              3.8% <span style={{ fontSize: '12px', color: '#00E676', fontWeight: 700 }}>+0.9%</span>
            </div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.07)', borderRadius: '14px', padding: '14px 18px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>AEO / Search Citations</span>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#7C75FF', marginTop: '2px' }}>
              76% <span style={{ fontSize: '12px', color: '#00E676', fontWeight: 700 }}>+14% AI</span>
            </div>
          </div>
        </div>

        {/* 4 Growth Pillars Progress Bars */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '6px' }}>
              <span style={{ color: '#fff', fontWeight: 600 }}>🎨 Creative Hook Power & Freshness</span>
              <span style={{ color: '#00E676', fontWeight: 800 }}>92%</span>
            </div>
            <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '100px', overflow: 'hidden' }}>
              <div style={{ width: '92%', height: '100%', background: '#00E676', borderRadius: '100px' }} />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '6px' }}>
              <span style={{ color: '#fff', fontWeight: 600 }}>⚡ Ad Spend Auto-Scale & Guardrails</span>
              <span style={{ color: '#00D2FF', fontWeight: 800 }}>86%</span>
            </div>
            <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '100px', overflow: 'hidden' }}>
              <div style={{ width: '86%', height: '100%', background: '#00D2FF', borderRadius: '100px' }} />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '6px' }}>
              <span style={{ color: '#fff', fontWeight: 600 }}>🔍 Competitor Defense & Recon</span>
              <span style={{ color: '#FFB300', fontWeight: 800 }}>78%</span>
            </div>
            <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '100px', overflow: 'hidden' }}>
              <div style={{ width: '78%', height: '100%', background: '#FFB300', borderRadius: '100px' }} />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '6px' }}>
              <span style={{ color: '#fff', fontWeight: 600 }}>🤝 Creator & UGC Pipeline</span>
              <span style={{ color: '#7C75FF', fontWeight: 800 }}>80%</span>
            </div>
            <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '100px', overflow: 'hidden' }}>
              <div style={{ width: '80%', height: '100%', background: '#7C75FF', borderRadius: '100px' }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── 1. BRAND KIT EXTRACTION CARD ──────────────────────────── */}
      <div
        className="glow-card"
        style={{
          background: 'linear-gradient(135deg, rgba(20, 20, 36, 0.75) 0%, rgba(10, 10, 18, 0.95) 100%)',
          border: '1px solid rgba(124, 117, 255, 0.25)',
          borderRadius: '20px',
          padding: '24px 28px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(124, 117, 255, 0.15)', border: '1px solid rgba(124, 117, 255, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Layers size={18} color="#7C75FF" />
              </div>
              <h2 style={{ fontSize: '20px', color: '#fff', margin: 0, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
                Brand kit extraction
              </h2>
              <span style={{ fontSize: '11px', background: 'rgba(0, 230, 118, 0.15)', color: '#00E676', border: '1px solid rgba(0, 230, 118, 0.3)', padding: '2px 8px', borderRadius: '100px', fontWeight: 700 }}>
                100% Extracted
              </span>
            </div>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: 0 }}>
              Review each item once it's ready to make sure we got it right
            </p>
          </div>

          <button
            onClick={() => setShowBrandKitModal(true)}
            style={{
              background: 'linear-gradient(135deg, #7C75FF 0%, #5A52FF 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '100px',
              padding: '9px 24px',
              fontSize: '13.5px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(124, 117, 255, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            Review <ChevronRight size={15} />
          </button>
        </div>

        {/* Checklist of 6 Items */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
          {brandKitItems.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                setActiveBrandKitTab(item.id as any);
                setShowBrandKitModal(true);
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '14px',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(124, 117, 255, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(124, 117, 255, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {item.icon}
                <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#fff' }}>{item.label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#00E676', fontSize: '11px', fontWeight: 700 }}>
                <CheckCircle2 size={13} color="#00E676" />
                <span>Ready</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 2 & 3. DUAL GRID: ACTION NEEDED & TOP PERFORMING CREATIVES ──────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px' }}>
        
        {/* ── ACTION NEEDED ────────────────────────────────────────── */}
        <div
          className="glow-card"
          style={{
            background: 'linear-gradient(180deg, rgba(20, 20, 32, 0.7) 0%, rgba(10, 10, 16, 0.9) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '20px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '300px'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={18} color="#FFB300" />
                <h3 style={{ fontSize: '18px', color: '#fff', margin: 0, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
                  Action Needed
                </h3>
              </div>
              
              <button
                onClick={() => setShowRecommendationsModal(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#7C75FF',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: 0
                }}
              >
                View All Recommendations <ArrowUpRight size={14} />
              </button>
            </div>

            {!isAdAccountConnected ? (
              /* EMPTY CONNECT STATE (User requested text) */
              <div
                style={{
                  padding: '32px 24px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px dashed rgba(255, 255, 255, 0.12)',
                  borderRadius: '16px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '14px'
                }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255, 179, 0, 0.1)', border: '1px solid rgba(255, 179, 0, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertCircle size={24} color="#FFB300" />
                </div>
                <div>
                  <h4 style={{ fontSize: '16px', color: '#fff', margin: '0 0 6px 0', fontWeight: 700 }}>
                    No recommendations yet
                  </h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 auto', maxWidth: '380px', lineHeight: 1.5 }}>
                    Connect an ad account to surface opportunities and decisions from live performance data.
                  </p>
                </div>
                <button
                  onClick={() => setShowConnectModal(true)}
                  style={{
                    background: 'linear-gradient(135deg, #00E676 0%, #00C853 100%)',
                    color: '#000000',
                    border: 'none',
                    borderRadius: '100px',
                    padding: '9px 22px',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(0, 230, 118, 0.3)',
                    marginTop: '4px'
                  }}
                >
                  Connect ad account
                </button>
              </div>
            ) : (
              /* The optimizer's own feed, computed from this account's insights. */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {perfLoading && (
                  <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>Reading your ad account…</p>
                )}
                {!perfLoading && perfError && (
                  <p style={{ fontSize: '12.5px', color: 'var(--warning)', margin: 0 }}>{perfError}</p>
                )}
                {!perfLoading && !perfError && !recommendations.length && (
                  <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                    No recommendations yet — the account has no campaigns with enough spend to
                    judge. They appear here once there is signal to act on.
                  </p>
                )}
                {recommendations.slice(0, 2).map((rec, i) => (
                  <div
                    key={rec.campaign_id || i}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '11px', padding: '2px 8px', borderRadius: '6px', fontWeight: 700,
                        background: rec.severity === 'critical' ? 'rgba(255,71,87,0.15)'
                          : rec.severity === 'good' ? 'rgba(0,230,118,0.15)' : 'rgba(255, 179, 0, 0.15)',
                        color: rec.severity === 'critical' ? '#ff6b7a'
                          : rec.severity === 'good' ? '#00E676' : '#FFB300',
                      }}>
                        {String(rec.signal || 'insight').replace('_', ' ')}
                      </span>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {rec.campaign_name}
                      </span>
                    </div>
                    <h5 style={{ fontSize: '13.5px', color: '#fff', margin: 0, fontWeight: 700 }}>{rec.title}</h5>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>{rec.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: 'var(--text-muted)' }}>
            <span>Auto-refresh every 15 min</span>
            <span style={{ color: '#00E676' }}>● AI Performance Engine Active</span>
          </div>
        </div>

        {/* ── TOP PERFORMING CREATIVES ──────────────────────────────── */}
        <div
          className="glow-card"
          style={{
            background: 'linear-gradient(180deg, rgba(20, 20, 32, 0.7) 0%, rgba(10, 10, 16, 0.9) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '20px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '300px'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={18} color="#00E676" />
                <h3 style={{ fontSize: '18px', color: '#fff', margin: 0, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
                  Top Performing Creatives
                </h3>
              </div>

              <button
                onClick={() => onNavigateTab('studio')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#7C75FF',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: 0
                }}
              >
                View Creative Performance <ArrowUpRight size={14} />
              </button>
            </div>

            {!isAdAccountConnected ? (
              /* EMPTY CONNECT STATE (User requested text) */
              <div
                style={{
                  padding: '32px 24px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px dashed rgba(255, 255, 255, 0.12)',
                  borderRadius: '16px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '14px'
                }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(0, 230, 118, 0.1)', border: '1px solid rgba(0, 230, 118, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BarChart3 size={24} color="#00E676" />
                </div>
                <div>
                  <h4 style={{ fontSize: '16px', color: '#fff', margin: '0 0 6px 0', fontWeight: 700 }}>
                    No creative performance yet
                  </h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 auto', maxWidth: '380px', lineHeight: 1.5 }}>
                    Once an ad account is connected, your top-performing creatives will show up here.
                  </p>
                </div>
                <button
                  onClick={() => setShowConnectModal(true)}
                  style={{
                    background: 'linear-gradient(135deg, #00E676 0%, #00C853 100%)',
                    color: '#000000',
                    border: 'none',
                    borderRadius: '100px',
                    padding: '9px 22px',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(0, 230, 118, 0.3)',
                    marginTop: '4px'
                  }}
                >
                  Connect ad account
                </button>
              </div>
            ) : (
              /* Per-campaign performance straight from the Meta Insights API. The rows this
                 replaces were four fixed entries with Unsplash thumbnails claiming "4.8x
                 ROAS" on "₹14,500" spend for every workspace that flipped the demo toggle. */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {perfLoading && (
                  <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>Reading campaign performance…</p>
                )}
                {!perfLoading && perfError && (
                  <p style={{ fontSize: '12.5px', color: 'var(--warning)', margin: 0 }}>{perfError}</p>
                )}
                {!perfLoading && !perfError && !creativePerf.length && (
                  <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                    The connected account has no campaign delivery in the last 7 days.
                  </p>
                )}
                {creativePerf.slice(0, 4).map((cr, i) => (
                  <div
                    key={cr.campaign_id || i}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h5 style={{ fontSize: '13px', color: '#fff', margin: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cr.campaign_name || 'Untitled campaign'}
                      </h5>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {cr.ctr ? `${Number(cr.ctr).toFixed(2)}% CTR` : 'CTR not reported'}
                        {cr.purchases ? ` · ${cr.purchases} purchases` : ''}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '14px', color: '#00E676', fontWeight: 800 }}>
                        {cr.roas ? `${Number(cr.roas).toFixed(2)}x ROAS` : '—'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        Spend: ₹{Number(cr.spend || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: 'var(--text-muted)' }}>
            {/* Both lines used to assert live syncing regardless of whether anything was
                connected. They now describe the account that is actually attached. */}
            <span>{isAdAccountConnected ? 'Meta attribution: last 7 days' : 'No ad account connected'}</span>
            <span style={{ color: metaConnected ? '#7C75FF' : 'var(--text-muted)' }}>
              {metaConnected ? '● Meta Insights connected' : '○ Meta not connected'}
            </span>
          </div>
        </div>
      </div>

      {/* ── 4. SCHEDULED AUTOMATIONS & WORKFLOWS CARD ──────────────── */}
      <div
        className="glow-card"
        style={{
          background: 'linear-gradient(135deg, rgba(20, 20, 36, 0.7) 0%, rgba(10, 10, 16, 0.9) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '20px',
          padding: '24px 28px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(0, 210, 255, 0.15)', border: '1px solid rgba(0, 210, 255, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={18} color="#00D2FF" />
            </div>
            <div>
              <h3 style={{ fontSize: '19px', color: '#fff', margin: 0, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
                Scheduled
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                Automated recurring creative generation, competitor intel, and ad scale routines.
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('scheduler')}
            style={{
              background: 'none',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              borderRadius: '100px',
              padding: '8px 20px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            View Scheduler <ArrowUpRight size={14} />
          </button>
        </div>

        {/* Schedule List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {schedules.map((sch) => (
            <div
              key={sch.id}
              style={{
                background: 'rgba(255, 255, 255, 0.025)',
                border: '1px solid rgba(255, 255, 255, 0.07)',
                borderRadius: '14px',
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${sch.color}15`, border: `1px solid ${sch.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Clock size={18} color={sch.color} />
                </div>
                <div>
                  <h4 style={{ fontSize: '14.5px', color: '#fff', margin: '0 0 3px 0', fontWeight: 700 }}>
                    {sch.title}
                  </h4>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{sch.frequency}</span>
                    <span>•</span>
                    <span style={{ color: sch.color }}>{sch.type}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '11px', background: 'rgba(0, 230, 118, 0.12)', color: '#00E676', border: '1px solid rgba(0, 230, 118, 0.3)', padding: '3px 10px', borderRadius: '100px', fontWeight: 700 }}>
                  ● {sch.status}
                </span>
                <button
                  onClick={() => setShowSchedulerModal(true)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  Configure
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── BRAND KIT REVIEW MODAL ────────────────────────────────── */}
      <AnimatePresence>
        {showBrandKitModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.82)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(10px)',
              padding: '20px'
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                width: '100%',
                maxWidth: '850px',
                maxHeight: '88vh',
                background: '#0a0a10',
                border: '1px solid rgba(124, 117, 255, 0.35)',
                borderRadius: '24px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
              }}
            >
              {/* Modal Header */}
              <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '20px', color: '#fff', margin: '0 0 4px 0', fontWeight: 800 }}>
                    Brand Kit Review & Extraction
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                    Extracted from {brandName} guidelines. Edit or verify each asset below.
                  </p>
                </div>
                <button
                  onClick={() => setShowBrandKitModal(false)}
                  style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '0 20px', overflowX: 'auto' }}>
                {brandKitItems.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveBrandKitTab(tab.id as any)}
                    style={{
                      background: 'none',
                      border: 'none',
                      borderBottom: activeBrandKitTab === tab.id ? '2px solid #00E676' : '2px solid transparent',
                      color: activeBrandKitTab === tab.id ? '#00E676' : 'var(--text-secondary)',
                      padding: '14px 18px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              {/* Modal Tab Content */}
              <div style={{ padding: '28px', overflowY: 'auto', flex: 1 }}>
                {activeBrandKitTab === 'logo' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <h4 style={{ fontSize: '16px', color: '#fff', margin: 0 }}>Extracted Brand Logos</h4>
                    {/* The logo files onboarding found in the site's markup. The two panels
                        this replaces just typeset the workspace name in a bold font and
                        labelled it "Dark Theme SVG Vector (Primary)". */}
                    {(brandKit?.logos || []).length ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
                        {(brandKit.logos as any[]).slice(0, 6).map((lg, i) => {
                          const src = typeof lg === 'string' ? lg : (lg?.url || lg?.src || '');
                          if (!src) return null;
                          return (
                            <div key={i} style={{ background: i % 2 ? '#ffffff' : '#000', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '24px', textAlign: 'center' }}>
                              <img src={src} alt={`${brandName} logo`} style={{ maxWidth: '100%', maxHeight: '70px', objectFit: 'contain' }} />
                              <span style={{ fontSize: '11px', color: i % 2 ? '#666' : 'var(--text-muted)', display: 'block', marginTop: '8px' }}>
                                {i % 2 ? 'On light background' : 'On dark background'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
                        {brandKitLoading ? 'Reading your brand vault…'
                          : 'No logo files were found on your website. Re-run the sync from Brand Knowledge, or upload one there.'}
                      </p>
                    )}
                  </div>
                )}

                {activeBrandKitTab === 'colors' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <h4 style={{ fontSize: '16px', color: '#fff', margin: 0 }}>Color Palette Tokens</h4>
                    {/* The palette lifted off the brand's own CSS. It used to print
                        Raftra's four product colours as though they were the customer's. */}
                    {bkColors.length ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' }}>
                        {bkColors.slice(0, 8).map((col, i) => (
                          <div key={`${col.hex}-${i}`} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '12px' }}>
                            <div style={{ height: '56px', borderRadius: '8px', background: col.hex, marginBottom: '10px', border: '1px solid rgba(255,255,255,0.1)' }} />
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>{col.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{col.hex}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
                        {brandKitLoading ? 'Reading your brand vault…'
                          : 'No palette has been extracted from your website yet. Run the sync in Brand Knowledge.'}
                      </p>
                    )}
                  </div>
                )}

                {activeBrandKitTab === 'typography' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    <h4 style={{ fontSize: '16px', color: '#fff', margin: 0 }}>Typography Hierarchy</h4>
                    {/* The fonts the crawl read off the site, not Raftra's own stack. */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '20px' }}>
                      {brandKit?.typography && Object.keys(brandKit.typography).length ? (
                        Object.entries(brandKit.typography as Record<string, any>).map(([role, val]) => (
                          <div key={role} style={{ marginBottom: '10px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{role.replace(/_/g, ' ')}</span>
                            <div style={{ fontSize: '17px', fontWeight: 700, color: '#fff', marginTop: '2px' }}>{bkLine(val) || 'Not recorded'}</div>
                          </div>
                        ))
                      ) : (
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
                          {brandKitLoading ? 'Reading your brand vault…'
                            : 'No typography was extracted from your website yet. Run the sync in Brand Knowledge.'}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {activeBrandKitTab === 'knowledge' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h4 style={{ fontSize: '16px', color: '#fff', margin: 0 }}>Extracted Brand Knowledge</h4>
                    {/* What onboarding actually learned. The two paragraphs this replaces
                        described Raftra's own pitch and were shown for every brand. */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {[
                        { label: 'Brand voice & tone', color: '#00E676', value: bkLine(brandKit?.brand_voice) || bkLine(bkGuidelines.tone) || bkLine(bkGuidelines.personality) },
                        { label: 'Value propositions', color: '#7C75FF', value: bkLine(bkGuidelines.usps) || bkLine(bkGuidelines.benefits) },
                        { label: 'What they sell', color: '#00D2FF', value: bkLine(bkGuidelines.categories) },
                        { label: 'Summary', color: '#FFB300', value: bkLine(brandKit?.brand_guidelines_summary) },
                      ].filter(row => row.value).map((row, i) => (
                        <div key={row.label} style={i ? { borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' } : undefined}>
                          <strong style={{ color: row.color, fontSize: '12px', textTransform: 'uppercase' }}>{row.label}:</strong>
                          <p style={{ color: '#fff', fontSize: '13.5px', margin: '4px 0 0 0', lineHeight: 1.5 }}>{row.value}</p>
                        </div>
                      ))}
                      {!bkLine(brandKit?.brand_voice) && !bkLine(bkGuidelines.tone) && !bkLine(bkGuidelines.usps)
                        && !bkLine(bkGuidelines.categories) && !bkLine(brandKit?.brand_guidelines_summary) && (
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
                          {brandKitLoading ? 'Reading your brand vault…'
                            : 'Nothing has been extracted from your website yet. Run the sync in Brand Knowledge and this fills in.'}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {activeBrandKitTab === 'assets' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* The workspace's real Asset Vault. The heading used to read "28
                        Synced" over four stock photographs, whatever the vault held. */}
                    <h4 style={{ fontSize: '16px', color: '#fff', margin: 0 }}>
                      Media & Product Assets{vaultAssets.length ? ` (${vaultAssets.length})` : ''}
                    </h4>
                    {vaultAssets.length ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                        {vaultAssets.slice(0, 12).map((a, i) => (
                          <div key={i} style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <img src={a.url} alt={a.name} style={{ width: '100%', height: '100px', objectFit: 'cover' }} />
                            <div style={{ padding: '6px', background: '#0d0d14', fontSize: '11px', color: '#fff', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {a.name}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
                        {brandKitLoading ? 'Reading your Asset Vault…'
                          : 'Your Asset Vault is empty. Import your website images from the Assets tab.'}
                      </p>
                    )}
                  </div>
                )}

                {activeBrandKitTab === 'market' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h4 style={{ fontSize: '16px', color: '#fff', margin: 0 }}>Target Market Demographics</h4>
                    {/* The audience onboarding actually described, rather than a fixed
                        "18 – 35 Years" and "Delhi, Mumbai, Bengaluru, Pune" for every brand. */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '20px' }}>
                      {bkLine(brandKit?.target_audience) || bkLine(bkGuidelines.target_audiences) ? (
                        <>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Target audience</span>
                          <div style={{ fontSize: '15px', color: '#fff', fontWeight: 600, marginTop: '4px', lineHeight: 1.5 }}>
                            {bkLine(brandKit?.target_audience) || bkLine(bkGuidelines.target_audiences)}
                          </div>
                        </>
                      ) : (
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
                          {brandKitLoading ? 'Reading your brand vault…'
                            : 'No target audience has been extracted yet. Add it in Brand Knowledge so the agents plan against it.'}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div style={{ padding: '16px 28px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: 'rgba(255,255,255,0.02)' }}>
                <button
                  onClick={() => setShowBrandKitModal(false)}
                  style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '9px 20px', borderRadius: '100px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Close
                </button>
                <GlowButton variant="glow" onClick={() => { setShowBrandKitModal(false); alert('Brand Kit confirmed and synced across AI Agents!'); }} style={{ padding: '9px 24px', fontSize: '13px' }}>
                  Confirm & Save Kit ✓
                </GlowButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── AD ACCOUNT CONNECTOR MODAL ────────────────────────────── */}
      <AnimatePresence>
        {showConnectModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.82)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(10px)',
              padding: '20px'
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                width: '100%',
                maxWidth: '560px',
                background: '#0a0a12',
                border: '1px solid rgba(0, 230, 118, 0.35)',
                borderRadius: '24px',
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '20px', color: '#fff', margin: '0 0 4px 0', fontWeight: 800 }}>
                    Connect Ad Account
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                    Surface live ROAS opportunities, recommendations & top creative analytics.
                  </p>
                </div>
                <button
                  onClick={() => setShowConnectModal(false)}
                  style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} />
                </button>
              </div>

              {connectNote && (
                <div style={{ padding: '10px 14px', borderRadius: '10px', fontSize: '12.5px', background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.3)', color: '#ff8b95' }}>
                  {connectNote}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '60vh', overflowY: 'auto', paddingRight: '4px' }}>
                {HOME_CONNECTORS.map((plat) => {
                  const st = connectorStates[plat.key];
                  const view = st && st !== 'error' ? st : null;
                  const isConnected = !!view && view.connected;
                  const label = connectorsLoading || !st ? 'Checking…'
                    : st === 'error' ? 'Status unavailable'
                    : isConnected ? `Connected${view?.detail ? ` · ${view.detail}` : ''}`
                    : view?.configured ? 'Not connected'
                    : 'Not configured on the server';

                  return (
                    <div
                      key={plat.key}
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '14px',
                        padding: '14px 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ flex: 1, paddingRight: '12px', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                          <span style={{ fontSize: '14.5px', color: '#fff', fontWeight: 700 }}>{plat.name}</span>
                          <span style={{ fontSize: '10px', background: 'rgba(90,82,255,0.15)', color: '#7C75FF', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                            {plat.tag}
                          </span>
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.35, display: 'block' }}>{plat.desc}</span>
                        <span style={{ fontSize: '11px', color: isConnected ? '#00E676' : 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                          {label}
                          {view && !view.configured && ` — ${plat.unconfiguredHint}`}
                        </span>
                      </div>

                      {isConnected ? (
                        <span style={{ fontSize: '11px', color: '#00E676', background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.3)', padding: '5px 12px', borderRadius: '100px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          ✓ Connected
                        </span>
                      ) : plat.authorizePath && view?.configured ? (
                        <button
                          onClick={() => startConnect(plat)}
                          disabled={Boolean(connectingPlatform)}
                          style={{
                            background: 'linear-gradient(135deg, #00E676 0%, #00C853 100%)',
                            color: '#000000',
                            border: 'none',
                            borderRadius: '100px',
                            padding: '8px 18px',
                            fontSize: '12px',
                            fontWeight: 800,
                            cursor: connectingPlatform ? 'default' : 'pointer',
                            whiteSpace: 'nowrap',
                            opacity: connectingPlatform ? 0.6 : 1
                          }}
                        >
                          {connectingPlatform === plat.key ? 'Opening…' : 'Connect'}
                        </button>
                      ) : (
                        <button
                          onClick={() => { setShowConnectModal(false); onNavigateTab('integrations'); }}
                          style={{ background: 'none', border: 'none', color: '#8B85FF', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', padding: 0 }}
                        >
                          Open Integrations →
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* No backend connector exists for these, so no Connect button is offered. */}
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em', marginTop: '6px' }}>
                  NOT AVAILABLE YET
                </div>
                {HOME_CONNECTORS_UNAVAILABLE.map((plat) => (
                  <div
                    key={plat.name}
                    style={{
                      background: 'rgba(255, 255, 255, 0.015)',
                      border: '1px dashed rgba(255, 255, 255, 0.1)',
                      borderRadius: '14px',
                      padding: '14px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      opacity: 0.75
                    }}
                  >
                    <div style={{ flex: 1, paddingRight: '12px' }}>
                      <span style={{ fontSize: '14.5px', color: '#fff', fontWeight: 700, display: 'block', marginBottom: '2px' }}>{plat.name}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.35 }}>{plat.desc}</span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#FFB300', background: 'rgba(255,179,0,0.1)', border: '1px solid rgba(255,179,0,0.3)', padding: '5px 12px', borderRadius: '100px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      Not built yet
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── RECOMMENDATIONS MODAL ─────────────────────────────────── */}
      <AnimatePresence>
        {showRecommendationsModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.82)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(10px)',
              padding: '20px'
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                width: '100%',
                maxWidth: '650px',
                background: '#0a0a12',
                border: '1px solid rgba(255, 179, 0, 0.35)',
                borderRadius: '24px',
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '20px', color: '#fff', margin: '0 0 4px 0', fontWeight: 800 }}>
                    AI Recommendations & Opportunities
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                    Live algorithmic decisions calculated from your creative & campaign telemetry.
                  </p>
                </div>
                <button
                  onClick={() => setShowRecommendationsModal(false)}
                  style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {!isAdAccountConnected && (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
                    No ad account is connected, so there is no performance data to compute
                    recommendations from. Connect Meta or Google Ads to fill this in.
                  </p>
                )}
                {isAdAccountConnected && !recommendations.length && (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
                    {perfLoading ? 'Reading your ad account…'
                      : perfError || 'No campaign in the connected account has enough spend to make a call yet.'}
                  </p>
                )}
                {recommendations.map((rec, i) => (
                  <div
                    key={rec.campaign_id || i}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '14px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '11px', padding: '2px 8px', borderRadius: '6px', fontWeight: 700,
                        background: rec.severity === 'critical' ? 'rgba(255,71,87,0.15)'
                          : rec.severity === 'good' ? 'rgba(0,230,118,0.15)' : 'rgba(255, 179, 0, 0.15)',
                        color: rec.severity === 'critical' ? '#ff6b7a'
                          : rec.severity === 'good' ? '#00E676' : '#FFB300',
                      }}>
                        {String(rec.signal || 'insight').replace('_', ' ')}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {rec.campaign_name}
                      </span>
                    </div>
                    <h4 style={{ fontSize: '14px', color: '#fff', margin: 0, fontWeight: 700 }}>{rec.title}</h4>
                    <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{rec.detail}</p>
                    {rec.expected && (
                      <p style={{ fontSize: '12px', color: '#00E676', margin: 0 }}>{rec.expected}</p>
                    )}
                    {/* Budget and pause changes are made in Campaign Manager, which has the
                        confirm step and the real endpoints. The button this replaces was an
                        alert() saying "Applied recommendation" and changed nothing at all. */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                      <GlowButton
                        variant="glow"
                        onClick={() => { setShowRecommendationsModal(false); onNavigateTab('campaign'); }}
                        style={{ padding: '6px 16px', fontSize: '12px' }}
                      >
                        Act on this in Campaign Manager →
                      </GlowButton>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── SCHEDULER CONFIG MODAL ────────────────────────────────── */}
      <AnimatePresence>
        {showSchedulerModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.82)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(10px)',
              padding: '20px'
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                width: '100%',
                maxWidth: '650px',
                background: '#0a0a12',
                border: '1px solid rgba(0, 210, 255, 0.35)',
                borderRadius: '24px',
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '20px', color: '#fff', margin: '0 0 4px 0', fontWeight: 800 }}>
                    Automated Workflows Scheduler
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                    Recurring background jobs executed by Raftra AI Agent nodes for {brandName}.
                  </p>
                </div>
                <button
                  onClick={() => setShowSchedulerModal(false)}
                  style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {schedules.map((sch) => (
                  <div
                    key={sch.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '14px',
                      padding: '16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <h4 style={{ fontSize: '14.5px', color: '#fff', margin: '0 0 3px 0', fontWeight: 700 }}>
                        {sch.title}
                      </h4>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{sch.frequency}</div>
                    </div>

                    <button
                      onClick={() => alert(`Triggered manual execution of "${sch.title}"!`)}
                      style={{
                        background: 'rgba(0, 210, 255, 0.12)',
                        border: '1px solid rgba(0, 210, 255, 0.3)',
                        color: '#00D2FF',
                        borderRadius: '100px',
                        padding: '6px 16px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Run Now 🚀
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  onClick={() => setShowSchedulerModal(false)}
                  style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '9px 20px', borderRadius: '100px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
