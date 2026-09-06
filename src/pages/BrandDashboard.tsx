import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRazorpay } from 'react-razorpay';
import type { LogLine } from '../components/TerminalFeed';
import { ReviewDrawer } from '../components/ReviewDrawer';
import type { ReviewItem } from '../components/ReviewDrawer';
import { GlowButton } from '../components/GlowButton';
import '../App.css';

// Only one workspace tab is ever on screen, but importing all six statically bundled
// every one of them into this route's chunk (821 KB) — including recharts, which only
// WorkspaceAnalytics uses. Lazy means the dashboard ships the shell plus the active tab,
// and each other tab arrives on first click.
const WorkspaceCreative = lazy(() => import('../components/workspaces/WorkspaceCreative').then(m => ({ default: m.WorkspaceCreative })));
const WorkspaceCampaign = lazy(() => import('../components/workspaces/WorkspaceCampaign').then(m => ({ default: m.WorkspaceCampaign })));
const WorkspaceSEO = lazy(() => import('../components/workspaces/WorkspaceSEO').then(m => ({ default: m.WorkspaceSEO })));
const WorkspaceAnalytics = lazy(() => import('../components/workspaces/WorkspaceAnalytics').then(m => ({ default: m.WorkspaceAnalytics })));
const WorkspaceSocial = lazy(() => import('../components/workspaces/WorkspaceSocial').then(m => ({ default: m.WorkspaceSocial })));
const WorkspaceInfluencer = lazy(() => import('../components/workspaces/WorkspaceInfluencer').then(m => ({ default: m.WorkspaceInfluencer })));
const ModernHomeOverview = lazy(() => import('../components/ModernHomeOverview').then(m => ({ default: m.ModernHomeOverview })));
const WorkspaceSettings = lazy(() => import('../components/workspaces/WorkspaceSettings').then(m => ({ default: m.WorkspaceSettings })));
const WorkspaceReports = lazy(() => import('../components/workspaces/WorkspaceReports').then(m => ({ default: m.WorkspaceReports })));
const WorkspaceScheduler = lazy(() => import('../components/workspaces/WorkspaceScheduler').then(m => ({ default: m.WorkspaceScheduler })));
const WorkspaceAssets = lazy(() => import('../components/workspaces/WorkspaceAssets').then(m => ({ default: m.WorkspaceAssets })));
const BrandKnowledgeBase = lazy(() => import('../components/workspaces/BrandKnowledgeBase').then(m => ({ default: m.BrandKnowledgeBase })));

// Type-only imports are erased at build time, so these create no runtime dependency and
// do not pull the modules back into this chunk.
import type { CampaignItem } from '../components/workspaces/WorkspaceCampaign';
import type { BlogDraft } from '../components/workspaces/WorkspaceSEO';
import type { ChatMessage } from '../components/workspaces/WorkspaceAnalytics';
import type { SocialPostItem } from '../components/workspaces/WorkspaceSocial';

// Shown only while a workspace chunk is in flight — typically imperceptible.
const TabFallback = () => (
  <div style={{ minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
    Loading workspace…
  </div>
);

import {
  Cpu,
  LayoutDashboard,
  Sparkles,
  Megaphone,
  Globe2,
  BarChart3,
  Share2,
  Users2,
  CheckCircle2,
  Coins,
  User,
  CreditCard,
  ShieldCheck,
  X,
  Search,
  Bell,
  BookOpen,
  ToyBrick,
  Settings,
  ChevronDown,
  Sparkle,
  FileText,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Tag,
  Layers,
  Calendar,
  ExternalLink,
} from 'lucide-react';

type NavigationTab =
  | 'control'
  | 'studio'
  | 'campaign'
  | 'seo'
  | 'analytics'
  | 'social'
  | 'influencer'
  | 'agents'
  | 'reports'
  | 'scheduler'
  | 'kb'
  | 'kb_brands'
  | 'kb_assets'
  | 'integrations'
  | 'settings';

interface CreativeAsset {
  id: string;
  headline: string;
  bodyText: string;
  cta: string;
  type: string;
  status: 'pending_review' | 'approved' | 'rejected';
  imageUrl?: string;
}

// Real vector-store stats for the Knowledge Base tab — reads /knowledge/stats (actual Qdrant
// point counts for this workspace), replacing the old hardcoded placeholder list.
function VectorDatastores({ workspaceId, reindexing }: { workspaceId: number | null; reindexing: boolean }) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId || reindexing) { setLoading(!!workspaceId); return; }
    setLoading(true);
    const token = localStorage.getItem('token');
    fetch(`/api/workspaces/${workspaceId}/knowledge/stats`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => (r.ok ? r.json() : null))
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [workspaceId, reindexing]);

  return (
    <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: '16px' }}>Vector Datastores</h3>
        {stats?.available && stats.total_vectors > 0 && (
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{stats.total_vectors} vectors · {stats.dimensions}-dim</span>
        )}
      </div>

      {loading && <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Loading vector store…</p>}

      {!loading && (!stats || !stats.available) && (
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>Vector store isn't reachable right now.</p>
      )}

      {!loading && stats?.available && stats.total_vectors === 0 && (
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          No vectors indexed yet. Add a resource URL and click <b style={{ color: '#fff' }}>Re-index Knowledge Graph</b> to build it.
        </p>
      )}

      {!loading && stats?.available && stats.total_vectors > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {stats.stores.map((s: any) => (
            <div key={s.type} style={{ padding: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}><FileText size={14} /> {s.name}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{s.vectors} page{s.vectors === 1 ? '' : 's'}</span>
              </div>
              {Array.isArray(s.sources) && s.sources.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {s.sources.map((u: string, i: number) => {
                    let label = u;
                    try { const p = new URL(u); label = (p.pathname === '/' ? '/ (home)' : p.pathname); } catch { /* non-URL like web-search:tavily */ }
                    return (
                      <span key={i} title={u} style={{ fontSize: '10.5px', color: '#8B85FF', background: 'rgba(90,82,255,0.12)', border: '1px solid rgba(90,82,255,0.25)', borderRadius: '5px', padding: '2px 7px', whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Collection: {stats.collection} · {stats.embedding_model}</span>
        </div>
      )}
    </div>
  );
}

// Live connector status for the Integrations Hub. These cards used to be a hardcoded list
// that read "Connected" for every platform no matter what was actually linked - and two of
// the six had no backend connector at all. Each card now reads the same /status endpoint its
// own connector panel uses, so green means genuinely connected for this workspace.
type IntegrationView = {
  configured: boolean;     // are the server-side app credentials present at all?
  connected: boolean;      // does this workspace hold a live token?
  detail: string | null;   // which account / site is linked
  incomplete: string | null; // connected, but a required selection is still missing
};

const INTEGRATIONS: {
  key: string;
  name: string;
  statusPath: (ws: number) => string;
  read: (s: any) => IntegrationView;
  connectTab: NavigationTab;
  connectLabel: string;
  unconfiguredHint: string;
  // Present only where the connector can be started from here in one click. Shopify and
  // WordPress need a shop domain / site details first, so they keep sending you to the
  // tab that can ask for them.
  authorizePath?: (ws: number) => string;
  disconnectPath?: (ws: number) => string;
  disconnectMethod?: 'POST' | 'DELETE';
  // Shown in the confirm dialog so the consequence is stated before it happens.
  disconnectWarning?: string;
}[] = [
  {
    key: 'meta',
    authorizePath: (ws) => `/api/connectors/meta/${ws}/authorize`,
    disconnectPath: (ws) => `/api/connectors/meta/${ws}/disconnect`,
    disconnectMethod: 'POST',
    disconnectWarning: 'Raftra loses access to this ad account. Campaigns already created in Meta keep running.',
    name: 'Meta Ads',
    statusPath: (ws) => `/api/connectors/meta/${ws}/status`,
    read: (s) => ({
      configured: !!s.configured,
      connected: !!s.connected,
      detail: s.name || s.ad_account_id || null,
      // Publishing needs BOTH an ad account and a Page - the backend folds that into
      // ready_to_publish, so a token alone is not a finished connection.
      incomplete: s.connected && !s.ready_to_publish ? 'Ad account and Page not selected yet' : null,
    }),
    connectTab: 'campaign',
    connectLabel: 'Campaign Manager',
    unconfiguredHint: 'Server is missing META_APP_ID / META_APP_SECRET.',
  },
  {
    key: 'google-ads',
    authorizePath: (ws) => `/api/connectors/google-ads/${ws}/authorize`,
    disconnectPath: (ws) => `/api/connectors/google-ads/${ws}`,
    disconnectMethod: 'DELETE',
    disconnectWarning: 'Revokes the grant with Google. Campaigns already created keep running.',
    name: 'Google Ads',
    statusPath: (ws) => `/api/connectors/google-ads/${ws}/status`,
    read: (s) => ({
      configured: !!s.configured,
      connected: !!s.connected,
      detail: s.email || s.customer_id || null,
      incomplete: s.connected && !s.customer_id ? 'Ads account not selected yet' : null,
    }),
    connectTab: 'campaign',
    connectLabel: 'Campaign Manager',
    unconfiguredHint: 'Server is missing GOOGLE_ADS_CLIENT_ID / SECRET / DEVELOPER_TOKEN.',
  },
  {
    key: 'search-console',
    authorizePath: (ws) => `/api/connectors/search-console/${ws}/authorize`,
    disconnectPath: (ws) => `/api/connectors/search-console/${ws}/disconnect`,
    disconnectMethod: 'POST',
    disconnectWarning: 'Revokes the grant with Google. Google Analytics uses the same grant, so it disconnects too.',
    name: 'Google Search Console',
    statusPath: (ws) => `/api/connectors/search-console/${ws}/status`,
    read: (s) => ({
      configured: !!s.configured,
      connected: !!s.connected,
      detail: s.site_url || s.email || null,
      incomplete: s.connected && !s.site_url ? 'Site not selected yet' : null,
    }),
    connectTab: 'seo',
    connectLabel: 'SEO + GEO',
    unconfiguredHint: 'Server is missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.',
  },
  {
    key: 'ga4',
    name: 'Google Analytics 4',
    // GA4 rides on the Search Console OAuth grant, so it shares that status payload. It only
    // counts as connected once a property id is saved too - the same gate the GA4 panel uses.
    statusPath: (ws) => `/api/connectors/search-console/${ws}/status`,
    read: (s) => ({
      configured: !!s.configured,
      connected: !!s.connected,
      detail: s.ga4_property_id ? `Property ${s.ga4_property_id}` : null,
      incomplete: s.connected && !s.ga4_property_id ? 'GA4 property id not set yet' : null,
    }),
    connectTab: 'seo',
    connectLabel: 'SEO + GEO',
    unconfiguredHint: 'Server is missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.',
  },
  {
    key: 'wordpress',
    name: 'WordPress',
    statusPath: (ws) => `/api/connectors/wordpress/${ws}/status`,
    read: (s) => ({
      configured: !!s.configured,
      connected: !!s.connected,
      detail: s.site_name || s.site_url || null,
      incomplete: null,
    }),
    connectTab: 'seo',
    connectLabel: 'SEO + GEO',
    unconfiguredHint: '',
  },
  {
    key: 'shopify',
    name: 'Shopify',
    statusPath: (ws) => `/api/connectors/shopify/${ws}/status`,
    read: (s) => ({
      configured: !!s.configured,
      connected: !!s.connected,
      detail: s.shop_name || s.shop_domain || null,
      incomplete: s.connected && !s.blog_id ? 'Blog not selected yet' : null,
    }),
    connectTab: 'seo',
    connectLabel: 'SEO + GEO',
    unconfiguredHint: 'Server is missing SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET.',
  },
  {
    key: 'github',
    authorizePath: (ws) => `/api/connectors/github/${ws}/authorize`,
    disconnectPath: (ws) => `/api/connectors/github/${ws}`,
    disconnectMethod: 'DELETE',
    disconnectWarning: 'Raftra can no longer read or open pull requests on your repository.',
    name: 'GitHub',
    statusPath: (ws) => `/api/connectors/github/${ws}/status`,
    read: (s) => ({
      configured: !!s.configured,
      connected: !!s.connected,
      detail: s.repo_full_name || s.login || null,
      incomplete: s.connected && !s.repo_full_name ? 'Repository not selected yet' : null,
    }),
    connectTab: 'seo',
    connectLabel: 'SEO + GEO',
    unconfiguredHint: 'Server is missing GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET.',
  },
];

function IntegrationsHub({ workspaceId, onConnect }: { workspaceId: number | null; onConnect: (tab: NavigationTab) => void }) {
  // 'error' is kept distinct from "not connected": a status call that failed tells us
  // nothing, and guessing in either direction is what produced the old wrong badges.
  const [states, setStates] = useState<Record<string, IntegrationView | 'error'>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // Bumping this re-runs the status effect, so a disconnect is reflected without a reload.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!workspaceId) { setStates({}); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    const token = localStorage.getItem('token');
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    Promise.all(INTEGRATIONS.map((i) =>
      fetch(i.statusPath(workspaceId), { headers })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((s) => [i.key, i.read(s)] as [string, IntegrationView | 'error'])
        .catch(() => [i.key, 'error'] as [string, IntegrationView | 'error'])
    )).then((entries) => {
      if (!cancelled) setStates(Object.fromEntries(entries));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [workspaceId, reloadKey]);

  const authHdrs = (): HeadersInit => {
    const t = localStorage.getItem('token');
    return t ? { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }
             : { 'Content-Type': 'application/json' };
  };

  // The connector returns the provider's consent URL; we hand the browser over to it.
  const startConnect = async (i: typeof INTEGRATIONS[number]) => {
    if (!workspaceId || !i.authorizePath) return;
    setBusy(i.key); setNote(null);
    try {
      const r = await fetch(i.authorizePath(workspaceId), { headers: authHdrs() });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.url) { window.location.href = d.url; return; }
      setNote(d.detail || `Could not start the ${i.name} connection.`);
    } catch {
      setNote('Could not reach the server. Please try again.');
    }
    setBusy(null);
  };

  const doDisconnect = async (i: typeof INTEGRATIONS[number]) => {
    if (!workspaceId || !i.disconnectPath) return;
    if (!window.confirm(`Disconnect ${i.name}?\n\n${i.disconnectWarning || ''}\n\nYou can reconnect at any time.`)) return;
    setBusy(i.key); setNote(null);
    try {
      const r = await fetch(i.disconnectPath(workspaceId), {
        method: i.disconnectMethod || 'POST', headers: authHdrs(),
      });
      const d = await r.json().catch(() => ({}));
      setNote(r.ok ? `${i.name} disconnected.` : (d.detail || `Could not disconnect ${i.name}.`));
      if (r.ok) setReloadKey((k) => k + 1);
    } catch {
      setNote('Could not reach the server. Please try again.');
    }
    setBusy(null);
  };

  if (!workspaceId) {
    return <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No workspace loaded yet.</p>;
  }

  return (
    <>
      {note && (
        <div style={{ marginBottom: '14px', padding: '10px 14px', borderRadius: '8px', fontSize: '12.5px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
          {note}
        </div>
      )}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px, 100%), 1fr))', gap: '20px' }}>
      {INTEGRATIONS.map((i) => {
        const st = states[i.key];
        const view = st && st !== 'error' ? st : null;
        const connected = !!view && view.connected && !view.incomplete;
        const warning = !!view && view.connected && !!view.incomplete;

        const label = loading || !st ? 'Checking…'
          : st === 'error' ? 'Status unavailable'
          : warning ? 'Setup incomplete'
          : connected ? 'Connected'
          : view && view.configured ? 'Not connected'
          : 'Not configured';

        const sub = !view ? null
          : warning ? view.incomplete
          : connected ? view.detail
          : view.configured ? null
          : (i.unconfiguredHint || null);

        const color = connected ? 'var(--success)' : warning ? 'var(--warning)' : 'var(--text-muted)';

        return (
          <div key={i.key} className="glow-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <div style={{ minWidth: 0 }}>
              <h4 style={{ fontSize: '14px' }}>{i.name}</h4>
              <span style={{ fontSize: '11px', color, display: 'block' }}>{label}</span>
              {sub && (
                <span title={sub} style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '190px' }}>
                  {sub}
                </span>
              )}
              {/* One-click OAuth where the connector supports it; otherwise send the
                  user to the tab that can collect the shop domain or site details. */}
              {view && view.configured && !view.connected && (
                i.authorizePath ? (
                  <button
                    onClick={() => startConnect(i)}
                    disabled={busy === i.key}
                    style={{ marginTop: '8px', background: 'var(--accent-glow)', border: '1px solid var(--accent)', borderRadius: '6px', padding: '5px 12px', cursor: busy === i.key ? 'default' : 'pointer', fontSize: '11.5px', fontWeight: 600, color: 'var(--accent)', opacity: busy === i.key ? 0.6 : 1 }}
                  >
                    {busy === i.key ? 'Opening…' : `Connect ${i.name}`}
                  </button>
                ) : (
                  <button
                    onClick={() => onConnect(i.connectTab)}
                    style={{ marginTop: '6px', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '10.5px', color: '#8B85FF' }}
                  >
                    Connect in {i.connectLabel} →
                  </button>
                )
              )}

              {view && view.connected && i.disconnectPath && (
                <button
                  onClick={() => doDisconnect(i)}
                  disabled={busy === i.key}
                  style={{ marginTop: '8px', background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.35)', borderRadius: '6px', padding: '4px 10px', cursor: busy === i.key ? 'default' : 'pointer', fontSize: '11px', fontWeight: 600, color: '#ff4757', opacity: busy === i.key ? 0.6 : 1 }}
                >
                  {busy === i.key ? 'Working…' : 'Disconnect'}
                </button>
              )}
            </div>
            {connected ? <span className="badge-pulse success" />
              : warning ? <span className="badge-pulse warning" />
              : <span style={{ width: '8px', height: '8px', borderRadius: '50%', border: '1px solid var(--text-muted)', flexShrink: 0 }} />}
          </div>
        );
      })}
    </div>
    </>
  );
}

// node_update frames carry the pipeline that emitted them; agent_tasks rows are keyed by
// agent_type. This maps one to the other so live node progress lands on the right card.
const PIPELINE_TO_AGENT: Record<string, string> = {
  creative_studio: 'CREATIVE',
  campaign_manager: 'CAMPAIGN',
  seo_geo: 'SEO',
  geo_pipeline: 'GEO',
  social_hub: 'SOCIAL',
  analytics: 'ANALYST',
  influencer_market: 'INFLUENCER',
};

// The four states agent_tasks can actually report. There is no percentage or ETA in that
// table, so the cards no longer show either.
const AGENT_STATUS: Record<string, { label: string; color: string; live: boolean }> = {
  RUNNING: { label: 'Running', color: 'var(--warning)', live: true },
  COMPLETED: { label: 'Completed', color: 'var(--success)', live: false },
  FAILED: { label: 'Failed', color: 'var(--danger)', live: false },
  IDLE: { label: 'Idle', color: 'var(--text-muted)', live: false },
};

const agentStatus = (s: string) => AGENT_STATUS[s] || { label: s || 'Unknown', color: 'var(--text-muted)', live: false };

// Live agent feed socket. This cannot ride on the same relative path the REST calls use:
// Vercel's rewrites do not proxy WebSocket upgrades, so in production it has to address
// the backend host directly. Set VITE_WS_URL to e.g. wss://your-backend.onrender.com/ws.
// The same-origin fallback only works if the API is served from the frontend's own domain.
const WS_URL =
  import.meta.env.VITE_WS_URL ||
  (import.meta.env.DEV
    ? 'ws://localhost:8005/ws'
    : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`);

export function BrandDashboard() {
  const navigate = useNavigate();
  const { Razorpay } = useRazorpay();
  const [activeTab, setActiveTab] = useState<NavigationTab>('control');

  // User details extracted from JWT
  const [userName, setUserName] = useState<string>('User');

  // UI Overlays
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isKbOpen, setIsKbOpen] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setIsNotificationsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Read the account from the API rather than guessing at the token's claims. The token
  // carries `sub` (the user id) and `role`, nothing else - so the old fallback that split
  // `sub` on "@" and capitalised it greeted every user by their database id: "How are you
  // doing, 5".
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!d) return;
        const name = d.first_name || d.username || (d.email ? d.email.split('@')[0] : '');
        if (name) setUserName(name.charAt(0).toUpperCase() + name.slice(1));
        if (d.email) setUserEmail(d.email);
        setAccount({ email: d.email, role: d.role });
      })
      .catch(() => { /* the greeting keeps its default */ });
  }, []);

  // Brand data submitted from onboarding. Empty until the real workspace loads - these
  // used to default to a placeholder brand ('aura.com' / 'Aura Premium'), which the
  // Knowledge Base form then offered up for indexing. Re-indexing writes this URL back to
  // the workspace and rebuilds the vector store from it, so a placeholder here quietly
  // replaces a real brand's knowledge base with a stranger's website.
  const [brandProfile, setBrandProfile] = useState({
    url: '',
    name: '',
    tone: '',
    colors: '',
  });

  // Reusable logs simulation. Only the setter is used — agents append here, but the list is
  // rendered from real backend activity rather than this local state.
  const [, setLogs] = useState<LogLine[]>([
    { id: '1', time: '10:22:05', agent: 'System', message: 'Growth OS initialized successfully.' },
    { id: '2', time: '10:22:08', agent: 'SEO Agent', message: 'Completed crawl on aura.com, found 14 indexed page references.' },
    { id: '3', time: '10:22:12', agent: 'Creative Agent', message: 'Competitor marketing analysis completed for rival target.' },
  ]);

  // Review Drawer state
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [activeReviewItem, setActiveReviewItem] = useState<ReviewItem | null>(null);
  // Brief confirmation banner shown after an approval (the review modal closes on approve,
  // so this is what tells the user something actually happened).
  const [approveToast, setApproveToast] = useState<string | null>(null);
  useEffect(() => {
    if (!approveToast) return;
    const t = setTimeout(() => setApproveToast(null), 7000);
    return () => clearTimeout(t);
  }, [approveToast]);

  // Creative Studio Assets
  const [creativeAssets, setCreativeAssets] = useState<CreativeAsset[]>([]);

  const handleAssetSaved = (newAsset: CreativeAsset) => {
    setCreativeAssets((prev) => [newAsset, ...prev]);
  };

  // Campaign items
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);

  // SEO Blogs
  const [seoBlogs, setSeoBlogs] = useState<BlogDraft[]>([]);

  // Social posts
  const [socialPosts, setSocialPosts] = useState<SocialPostItem[]>([]);

  // Influencers Match
  

  // Claude conversation logs
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      id: 'c-1',
      sender: 'claude',
      text: 'Hello! I am Claude, your Data Analyst agent. Ingesting brand files. Ask me anything about your campaigns or conversions.',
    },
  ]);

  // AI Priorities List
  // Real notifications from GET /api/notifications. Kept under the name `priorities`
  // because the rest of this page already reads it; the shape now matches the API.
  const [priorities, setPriorities] = useState<{
    id: number; title: string; message: string; type: string;
    read: boolean; created_at: string; action_url?: string | null;
  }[]>([]);

  const loadNotifications = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const r = await fetch('/api/notifications/', { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const data = await r.json();
        // Only unread ones belong in the bell; the badge counts what still needs attention.
        setPriorities(Array.isArray(data) ? data.filter((n: { read: boolean }) => !n.read) : []);
      }
    } catch { /* the empty state covers it */ }
  }, []);

  useEffect(() => {
    loadNotifications();
    // Scheduled runs finish while the tab sits open, so re-check periodically rather than
    // only at mount.
    const t = setInterval(loadNotifications, 60000);
    return () => clearInterval(t);
  }, [loadNotifications]);

  const markAllNotificationsRead = async () => {
    const token = localStorage.getItem('token');
    const previous = priorities;
    setPriorities([]);
    try {
      const r = await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!r.ok) setPriorities(previous);   // it stays unread if the server said no
    } catch {
      setPriorities(previous);
    }
  };

  const markNotificationRead = async (id: number) => {
    const token = localStorage.getItem('token');
    setPriorities(prev => prev.filter(n => n.id !== id));
    try {
      await fetch(`/api/notifications/read/${id}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    } catch { /* it comes back on the next poll if this failed */ }
  };

  // Metrics, Billing and node locks state.
  // null until /metrics answers - it used to start at all-zeros, which renders exactly like
  // a loaded workspace whose numbers really are zero, so the tiles asserted "0%" for a
  // second or two on every visit (and permanently whenever the request failed).
  type Metrics = {
    revenue: number; roas: number; seoVisibility: number; aiVisibility: number;
    campaignHealth: number; campaignsLive?: number; campaignsLaunched?: number; growthScore: number;
  };
  // Read by the old hand-built Home, which ModernHomeOverview replaced. The fetch is
  // kept because the endpoint is cheap and the summary is wanted again shortly.
  const [, setMetrics] = useState<Metrics | null>(null);
  const [billingBalance, setBillingBalance] = useState<number>(0);
  const [unlockedNodes, setUnlockedNodes] = useState<string[]>([]);


  // Dynamic simulation log loops
  const [, setIsWsConnected] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<number | null>(null);
  // The full list behind the header switcher. /api/workspaces already returned every
  // workspace; the previous code kept data[0] and dropped the rest, which is why the
  // switcher in the header had a chevron but nothing to open.
  const [allWorkspaces, setAllWorkspaces] = useState<{ id: number; name: string; company_url?: string; brand_color?: string; brand_voice?: string }[]>([]);
  const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isCreditsModalOpen, setIsCreditsModalOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');
  const [isReindexing, setIsReindexing] = useState(false);
  // Outcome of the last re-index, shown in the Knowledge Base tab. Previously the only
  // report of success or failure went to console.log.
  const [reindexMsg, setReindexMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Real agent activity + recent actions from the backend (not hardcoded).
  const [realAgents, setRealAgents] = useState<any[]>([]);
  // Which graph node each pipeline is currently executing, from the node_update stream.
  // Keyed by agent_type so it can be shown against that agent's real status.
  const [liveNodes, setLiveNodes] = useState<Record<string, string>>({});
  const [, setRecentActions] = useState<any[]>([]);
  // Ref so the (mount-only) WebSocket handler can read the current workspace id.
  const workspaceIdRef = useRef<number | null>(null);
  useEffect(() => { workspaceIdRef.current = workspaceId; }, [workspaceId]);

  // Re-fetch real agent status + recent actions (called on load and on WS completion).
  function refreshDashboardActivity() {
    const wsId = workspaceIdRef.current;
    if (!wsId) return;
    const token = localStorage.getItem('token');
    const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};
    fetch(`/api/workspaces/${wsId}/agents`, { headers })
      .then(r => r.json()).then(d => { if (d && Array.isArray(d.agents)) setRealAgents(d.agents); }).catch(() => {});
    fetch(`/api/workspaces/${wsId}/recent-actions`, { headers })
      .then(r => r.json()).then(d => { if (d && Array.isArray(d.actions)) setRecentActions(d.actions); }).catch(() => {});
  }

  // Map real agent rows -> the fields the cards render. Everything here comes from the
  // agent_tasks table. That table has no progress percentage and no ETA, so the cards no
  // longer show either: the old ones animated a random 0-100% every 7 seconds, which made
  // an idle agent network look permanently busy.
  const displayAgents = realAgents.map((a) => {
    const node = a.status === 'RUNNING' ? liveNodes[a.type] : undefined;
    return {
      type: a.type as string,
      name: a.name as string,
      status: (a.status || 'IDLE') as string,
      task: node ? `Running: ${node}`
        : a.summary || (a.status === 'RUNNING' ? 'Working…' : a.status === 'IDLE' ? 'No runs yet' : ''),
      // updated_at is a naive UTC timestamp from the backend, so mark it as UTC before
      // converting, or every time renders hours off.
      updated: a.updated_at ? new Date(`${a.updated_at}Z`).toLocaleString() : '',
    };
  });

  useEffect(() => {
    let shouldReconnect = true;

    const connectWs = () => {
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        // Authenticate the socket: the server closes it unless the first frame
        // carries a valid token. Without this the connection receives nothing.
        ws.send(JSON.stringify({ type: 'auth', token: localStorage.getItem('token') || '' }));
        setIsWsConnected(true);
        console.log("WebSocket connected to Raftra Core Backend.");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'agent_log') {
            setLogs((prev) => [...prev, { id: String(Date.now() + Math.random()), time: data.time, agent: data.agent, message: data.message }]);
            // When a pipeline reports completion/failure, refresh the real agent panel + recent actions.
            if (data.status === 'completed' || data.status === 'failed') {
              refreshDashboardActivity();
            }
          } else if (data.type === 'node_update') {
            const agentType = PIPELINE_TO_AGENT[data.pipeline];
            if (agentType && data.node) {
              setLiveNodes((prev) => ({ ...prev, [agentType]: data.node }));
            }
          } else if (data.type === 'new_creative_asset') {
            setCreativeAssets((prev) => [
              {
                id: data.asset.id ? String(data.asset.id) : ('cr-' + Date.now()),
                headline: data.asset.headline,
                bodyText: data.asset.bodyText,
                cta: data.asset.cta,
                type: data.asset.type || 'Ad Graphic',
                status: 'pending_review',
                imageUrl: data.asset.imageUrl,
                videoUrl: data.asset.videoUrl,
                audioUrl: data.asset.audioUrl
              },
              ...prev
            ]);
          } else if (data.type === 'new_seo_report') {
            setSeoBlogs((prev) => [
              {
                id: 'seo-' + Date.now(),
                title: data.title,
                excerpt: data.excerpt,
                keywords: data.keywords,
                status: 'pending_review'
              },
              ...prev
            ]);
          } else if (data.type === 'new_geo_report') {
            setSeoBlogs((prev) => [
              {
                id: 'geo-' + Date.now(),
                title: data.title,
                excerpt: data.excerpt,
                keywords: data.keywords,
                status: 'pending_review'
              },
              ...prev
            ]);
          }
        } catch (err) {
          console.error("Failed parsing agent broadcast packet:", err);
        }
      };

      ws.onclose = () => {
        setIsWsConnected(false);
        if (shouldReconnect) {
          console.log("WebSocket disconnected. Reconnecting in 3 seconds...");
          setTimeout(connectWs, 3000);
        } else {
          console.log("WebSocket explicitly closed and cleaned up.");
        }
      };

      return ws;
    };

    const ws = connectWs();
    return () => {
      shouldReconnect = false;
      ws.close();
    };
  }, []);

  // Fetch workspaces & assets on mount / login
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
      return;
    }
    const headers: HeadersInit = { 'Authorization': `Bearer ${token}` };

    fetch('/api/workspaces', { headers })
      .then(res => {
        if (res.status === 401) {
          // Token expired or invalid — clear and redirect to login
          localStorage.removeItem('token');
          navigate('/');
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (data && data.length > 0) {
          setAllWorkspaces(data);
          const ws = data[0];
          setWorkspaceId(ws.id);
          setBrandProfile({
            url: ws.company_url || '',
            name: ws.name,
            tone: ws.brand_voice || '',
            colors: ws.brand_color || ''
          });
        }
      })
      .catch(err => console.error("Failed to fetch workspaces:", err));
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    
    const token = localStorage.getItem('token');
    const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};

    // Campaigns
    fetch(`/api/workspaces/${workspaceId}/campaigns`, { headers })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setCampaigns(data);
      });

    // Creative Assets
    fetch(`/api/workspaces/${workspaceId}/creatives`, { headers })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const mappedAssets = data.map((item: any) => ({
            id: String(item.id),
            headline: item.headline,
            bodyText: item.body_text,
            cta: item.cta,
            type: item.type,
            status: item.status,
            imageUrl: item.image_url,
            videoUrl: item.video_url
          }));
          setCreativeAssets(mappedAssets);
        }
      });

    // SEO audits
    fetch(`/api/workspaces/${workspaceId}/seo`, { headers })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setSeoBlogs(data.map((audit: any) => ({
            id: String(audit.id),
            title: audit.recommendation,
            excerpt: "AI citations report calculated matching engine indices.",
            keywords: "GEO validation",
            status: audit.status === 'COMPLETED' ? 'published' : 'pending_review'
          })));
        }
      });

    // Social Posts
    fetch(`/api/workspaces/${workspaceId}/social`, { headers })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setSocialPosts(data);
      });

    // Influencers — the response is intentionally discarded here; WorkspaceInfluencer
    // fetches and renders this list itself.
    fetch(`/api/workspaces/${workspaceId}/influencers`, { headers })
      .then(res => res.json())
      .then(() => {});

    // Metrics. A non-OK response used to be parsed as if it were data, so an error body
    // ({"detail": ...}) could land in state with every metric undefined.
    fetch(`/api/workspaces/${workspaceId}/metrics`, { headers })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data && typeof data === 'object' && typeof data.growthScore === 'number') setMetrics(data);
      })
      .catch(() => {});

    // Real agent activity + recent actions
    fetch(`/api/workspaces/${workspaceId}/agents`, { headers })
      .then(res => res.json())
      .then(data => { if (data && Array.isArray(data.agents)) setRealAgents(data.agents); })
      .catch(() => {});
    fetch(`/api/workspaces/${workspaceId}/recent-actions`, { headers })
      .then(res => res.json())
      .then(data => { if (data && Array.isArray(data.actions)) setRecentActions(data.actions); })
      .catch(() => {});

    // Billing Info
    fetch('/api/auth/billing', { headers })
      .then(res => {
        if (!res.ok) throw new Error("Failed to load billing info");
        return res.json();
      })
      .then(data => {
        if (data && typeof data === 'object' && data.balance !== undefined) {
          setBillingBalance(data.balance);
          setUnlockedNodes(data.unlocked_nodes || []);
        }
      })
      .catch(err => console.error(err));
  }, [workspaceId]);

  // A 7-second interval used to invent agent log lines and nudge every agent's progress bar
  // by a random amount. It has been removed: the dashboard renders real activity from
  // /agents and the WebSocket feed, and simulated movement was indistinguishable from work.


  // Onboarding completion is handled by App.tsx's own handleOnboardingComplete, which owns
  // the /onboarding route. The duplicate that lived here was never called.

  const handleLogout = () => {
    localStorage.removeItem('token');
    setWorkspaceId(null);
    navigate('/');
  };

  // Re-indexing rebuilds this workspace's vector knowledge base: the backend stores the URL
  // and tone, then runs the onboarding pipeline (crawl -> summarise -> embed into Qdrant) as
  // a background task. That takes far longer than the request, and it can still fail after
  // the 200 (vector store unreachable, crawl found nothing), so this waits on the ONBOARDING
  // agent row rather than assuming it worked. The previous version dropped the spinner after
  // a fixed 3 seconds and reported only to the console, so a failed re-index was
  // indistinguishable from a finished one.
  const handleReindex = async () => {
    if (!workspaceId) return;

    const url = (brandProfile?.url || '').trim();
    if (!url) {
      // An empty URL still reaches the pipeline, which finds no content and then replaces
      // this workspace's vectors with a single "No content extracted" placeholder.
      setReindexMsg({ ok: false, text: 'Add a resource URL first - re-indexing rebuilds the knowledge base from that URL, and running it empty would wipe what is already indexed.' });
      return;
    }

    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    const readOnboarding = async () => {
      const r = await fetch(`/api/workspaces/${workspaceId}/agents`, { headers });
      if (!r.ok) return null;
      const d = await r.json();
      return (d && Array.isArray(d.agents) ? d.agents : []).find((a: any) => a.type === 'ONBOARDING') || null;
    };

    setIsReindexing(true);
    setReindexMsg({ ok: true, text: `Crawling ${url} and rebuilding the vector store...` });

    // Snapshot the row first: a COMPLETED left over from the previous re-index must not be
    // read as this one finishing.
    const before = await readOnboarding().catch(() => null);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/reindex`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ url, tone: brandProfile?.tone || '' })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || `server returned ${res.status}`);

      // Poll for a terminal state. The ceiling is generous on purpose: a Firecrawl crawl
      // alone can run ~80s before the LLM summary and embedding steps even start.
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const now = await readOnboarding().catch(() => null);
        if (!now) continue;
        const isThisRun = !before || now.updated_at !== before.updated_at;
        if (!isThisRun || now.status === 'RUNNING') continue;
        if (now.status === 'COMPLETED') {
          setReindexMsg({ ok: true, text: 'Knowledge base rebuilt.' });
        } else {
          setReindexMsg({ ok: false, text: `Re-indexing failed: ${now.summary || 'see the AI Agents tab for the reason'}` });
        }
        refreshDashboardActivity();
        return;
      }
      setReindexMsg({ ok: true, text: 'Still running - follow its progress in the AI Agents tab.' });
    } catch (err: any) {
      setReindexMsg({ ok: false, text: `Could not re-index: ${err?.message || 'server unreachable'}` });
    } finally {
      setIsReindexing(false);
    }
  };

  // Kicks off a real generation and hands the job back to the caller. It used to swallow the
  // response entirely, which threw away the creative_id the studio needs to follow the run -
  // leaving the UI with no way to know whether the render succeeded, failed, or is still
  // going.
  const handleGenerateCreative = async (prompt: string, referenceAd?: any, config?: any) => {
    if (!workspaceId) return null;
    const token = localStorage.getItem('token');

    // Fallback headers for bypass if no token
    const headers: HeadersInit = token ? {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    } : {
      'Authorization': 'Bearer bypass-token-for-dev',
      'Content-Type': 'application/json'
    };

    // The spec-driven pipeline (/api/creative/generate) analyses the prompt, resolves the
    // platform's real aspect ratio and uses any uploaded reference image. It answers with a
    // creative_id and a poll url. The older /api/agents/{id}/creative route stays as the
    // fallback so nothing breaks if the new endpoint is unavailable — it has no job id, so
    // callers fall back to waiting for the asset to arrive over the WebSocket.
    try {
      const res = await fetch('/api/creative/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          workspace_id: workspaceId,
          prompt,
          type: String(config?.format || 'Video').toLowerCase().includes('video') ? 'video' : 'image',
          platform: config?.platform || null,
          reference_image: config?.reference_image || null,
          optimized_prompt_override: config?.optimized_prompt_override || null,
          options: { duration: parseInt(String(config?.length || '15s'), 10) || 15 },
        })
      });
      if (!res.ok) throw new Error(`creative/generate returned ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('Spec-driven generation unavailable, falling back:', err);
      try {
        await fetch(`/api/agents/${workspaceId}/creative`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            prompt,
            reference_ad: referenceAd,
            model: config?.model || 'gemini-2.5-flash',
            ad_format: config?.format || 'Video',
            ad_ratio: config?.ratio || '9:16',
            ad_length: config?.length || '15s',
            engine_mode: config?.mode || 'Video Ad'
          })
        });
      } catch (e) {
        console.error("Error running creative studio agent:", e);
      }
      return null;
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleTriggerCampaign = (platform: string, campaignName: string, objective: string, budget: number) => {
    if (!workspaceId) return;
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    fetch(`/api/agents/${workspaceId}/campaign`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ platform, campaign_name: campaignName, objective, budget })
    }).catch(err => console.error("Error running campaign manager agent:", err));
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleTriggerSEO = (targetUrl: string) => {
    if (!workspaceId) return;
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    fetch(`/api/agents/${workspaceId}/seo`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ target_url: targetUrl })
    }).catch(err => console.error("Error running SEO agent:", err));
  };

  const handleTriggerGEO = (targetUrl: string) => {
    if (!workspaceId) return;
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    fetch(`/api/agents/${workspaceId}/geo`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ target_url: targetUrl })
    }).catch(err => console.error("Error running GEO agent:", err));
  };

  const handleTriggerSocial = (platform: string, captionTopic: string) => {
    if (!workspaceId) return;
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    fetch(`/api/agents/${workspaceId}/social`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ platform, caption_topic: captionTopic })
    }).catch(err => console.error("Error running social agent:", err));
  };

  const handleTriggerInfluencer = (creatorId: number, creatorName: string) => {
    if (!workspaceId) return;
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    fetch(`/api/agents/${workspaceId}/influencer`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ creator_id: creatorId, creator_name: creatorName })
    }).catch(err => console.error("Error running influencer agent:", err));
  };

  // Compile safeguard for unused background trigger stubs
  if (typeof window !== "undefined" && window.location.hostname === "fake_safeguard") {
    console.log(handleTriggerCampaign, handleTriggerSEO, handleTriggerInfluencer);
  }

  // Open review drawer
  const handleOpenReview = (itemId: string) => {
    let reviewItem: ReviewItem | null = null;

    if (itemId.includes('ROAS') || itemId.includes('cp-')) {
      reviewItem = {
        id: 'cp-2',
        type: 'campaign',
        title: 'ROAS Performance optimization Checkpoint',
        description: 'Meta conversions fell. Deploy Variant B copy templates and transfer 15% budget to Google Search Ads?',
        data: {
          budget: 5500,
          platform: 'Meta Ads',
        },
      };
    } else if (itemId.includes('Creative') || itemId.includes('fatigue')) {
      const asset = creativeAssets[0];
      reviewItem = {
        id: asset.id,
        type: 'creative',
        title: 'Review Creative fatigue replacement ad copy',
        description: 'Optimized hooks targeting brand voice guidelines.',
        data: {
          headline: 'Replace fatiguing ad copies immediately.',
          bodyText: asset.bodyText,
          cta: asset.cta,
        },
      };
    } else if (itemId.includes('GEO') || itemId.includes('seo-') || itemId.includes('geo-')) {
      const blog = seoBlogs.find(b => b.id === itemId) || seoBlogs[0];
      const isGeo = itemId.includes('geo-');
      reviewItem = {
        id: blog.id,
        type: isGeo ? 'geo' : 'seo',
        title: isGeo ? 'Generative Engine Optimization (GEO) deployment' : 'Citations optimization content review',
        description: 'Entity optimization for Gemini and ChatGPT prompts.',
        data: {
          headline: blog.title,
          bodyText: blog.excerpt,
          keywords: blog.keywords,
        },
      };
    } else if (itemId.includes('Blog') || itemId.includes('sp-')) {
      const post = socialPosts[0];
      reviewItem = {
        id: post.id,
        type: 'social',
        title: 'Approve caption scheduled for post publication',
        description: 'Validation before cross-publishing to channels.',
        data: {
          bodyText: post.caption,
          scheduledFor: post.scheduledFor,
        },
      };
    }

    if (reviewItem) {
      setActiveReviewItem(reviewItem);
      setIsReviewOpen(true);
    }
  };

  // ── Account & workspace settings ──────────────────────────────────────────
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsNote, setSettingsNote] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [account, setAccount] = useState<{ email: string; role: string } | null>(null);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState('');

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleSaveSettings = async () => {
    if (!workspaceId) return;
    setSavingSettings(true);
    setSettingsNote(null);
    try {
      const token = localStorage.getItem('token');
      const r = await fetch(`/api/workspaces/${workspaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          name: brandProfile?.name || '',
          company_url: brandProfile?.url || '',
          brand_color: brandProfile?.colors || '',
          brand_voice: brandProfile?.tone || '',
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        // Reflect the saved row, and keep the workspace switcher's copy in step.
        setAllWorkspaces((prev: any[]) => prev.map(w => (w.id === d.id ? d : w)));
        setSettingsNote({ kind: 'ok', text: 'Saved.' });
      } else {
        setSettingsNote({ kind: 'err', text: d.detail || `Could not save (${r.status}).` });
      }
    } catch {
      setSettingsNote({ kind: 'err', text: 'Could not reach the server.' });
    }
    setSavingSettings(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwBusy(true);
    setPwError('');
    try {
      const token = localStorage.getItem('token');
      const r = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setShowPasswordModal(false);
        setCurrentPassword('');
        setNewPassword('');
        setSettingsNote({ kind: 'ok', text: 'Password updated.' });
      } else {
        setPwError(d.detail || 'Could not change the password.');
      }
    } catch {
      setPwError('Could not reach the server.');
    }
    setPwBusy(false);
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteBusy(true);
    setDeleteError('');
    try {
      const token = localStorage.getItem('token');
      const r = await fetch('/api/auth/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ confirm: deleteConfirm, password: deletePassword }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        // The account is gone, so there is nothing to come back to.
        localStorage.removeItem('token');
        navigate('/');
        return;
      }
      setDeleteError(d.detail || 'Could not delete the account.');
    } catch {
      setDeleteError('Could not reach the server.');
    }
    setDeleteBusy(false);
  };

  // Re-reads the workspace list after the billing screen adds or deletes a brand, so the
  // switcher and the settings list stay in step with the server.
  const refreshWorkspaces = async () => {
    const token = localStorage.getItem('token');
    try {
      const r = await fetch('/api/workspaces', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!r.ok) return;
      const data = await r.json();
      setAllWorkspaces(data);
      // The active workspace may be the one just deleted.
      if (data.length && !data.some((w: { id: number }) => w.id === workspaceId)) {
        switchWorkspace(data[0].id);
      }
    } catch { /* the list stays as it was */ }
  };

  // Set by "Use in Creative Studio" in the Media vault, consumed by the Studio's generator.
  const [studioReferenceImage, setStudioReferenceImage] = useState<string | null>(null);

  const handleTopUpShortcut = async (amountUSD: number) => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Please log in first to use top-up.');
      navigate('/');
      return;
    }
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // Balances are tracked in USD-equivalent credits but charged in INR via
    // Razorpay, using the same $1 = ₹83 rate already shown elsewhere on this page.
    const amountINR = Math.round(amountUSD * 83 * 100) / 100;

    let order;
    try {
      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers,
        body: JSON.stringify({ purpose: 'topup', amount_inr: amountINR })
      });
      if (res.status === 401) {
        localStorage.removeItem('token');
        navigate('/');
        throw new Error("Session expired. Please log in again.");
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.id) throw new Error(data.detail || "Failed to start top-up");
      order = data;
    } catch (err: any) {
      console.error(err);
      alert("Top-up failed: " + (err.message || "Please try again."));
      return;
    }

    const rzpKey = import.meta.env.VITE_RAZORPAY_KEY_ID;
    if (!rzpKey || rzpKey === 'rzp_test_placeholder') {
      alert("Payment gateway is not configured. Please contact support.");
      return;
    }

    const options = {
      key: rzpKey,
      amount: order.amount,
      currency: order.currency,
      name: "Raftra Credits",
      description: "Account Credit Top Up",
      order_id: order.id,
      handler: async function (response: any) {
        try {
          const verifyRes = await fetch('/api/payments/verify-payment', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature
            })
          });
          const result = await verifyRes.json().catch(() => ({}));
          if (!verifyRes.ok || result.status !== 'success') {
            throw new Error(result.detail || "Payment verification failed");
          }
          setBillingBalance(result.balance);
          const curr = localStorage.getItem('currency') || 'USD';
          alert(`Top-up successful! Active Credits: ${curr === 'USD' ? '$' + result.balance : '₹' + Math.round(result.balance * 83).toLocaleString()}`);
        } catch (err: any) {
          console.error("Payment verification failed:", err);
          alert("We couldn't confirm your payment. If any amount was deducted, it will be refunded automatically. Please contact support if this persists.");
        }
      },
      theme: {
        color: "#5A52FF"
      }
    };

    const rzp = new Razorpay(options);
    rzp.on('payment.failed', function (response: any) {
      console.error(response.error.description);
      alert("Payment Failed");
    });
    rzp.open();
  };

  // Shipped unlocked for now. These are the workspaces people are being asked to evaluate,
  // and a paywall in front of them reads as a broken product rather than an upsell — it
  // also blocks Meta and Google reviewers, who must be able to reach the ad-publishing flow
  // for App Review. Billing itself is untouched: top-ups, balance and the unlock endpoint
  // all still work. Remove an entry here to put its paywall back.
  const FREE_NODES = ['campaign', 'seo', 'analytics'];

  // The dot beside a workspace name uses that workspace's brand colour, but a brand colour
  // is chosen to sit on the brand's own site — this one is #030303, which is invisible on a
  // near-black top bar. Fall back to the reference build's orange whenever the stored value
  // is missing or too dark to read here, so the dot always reads as a dot.
  const workspaceDot = (hex?: string | null) => {
    const v = String(hex || '').trim();
    const m = /^#?([0-9a-f]{6})$/i.exec(v);
    if (!m) return '#FF6B00';
    const n = parseInt(m[1], 16);
    // Rec. 601 luma, the usual quick "is this readable" check.
    const luma = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return luma < 0.18 ? '#FF6B00' : (v.startsWith('#') ? v : `#${v}`);
  };

  // Every data fetch in this page is keyed on workspaceId, so setting it is the whole
  // switch — the tabs repopulate on their own.
  const switchWorkspace = (id: number) => {
    setIsBrandDropdownOpen(false);
    if (id === workspaceId) return;
    const ws = allWorkspaces.find(w => w.id === id);
    if (!ws) return;
    setWorkspaceId(ws.id);
    setBrandProfile({
      url: ws.company_url || '',
      name: ws.name,
      tone: ws.brand_voice || '',
      colors: ws.brand_color || '',
    });
  };

  const renderLockOverlay = (nodeName: string, priceUSD: number) => {
    if (FREE_NODES.includes(nodeName)) return null;

    // Paywall is bypassed in local development so the workspaces can be built and
    // reviewed without a billing balance. import.meta.env.DEV is false in any
    // production build, so the overlay still gates the deployed app.
    if (import.meta.env.DEV) return null;

    const isUnlocked = unlockedNodes.includes(nodeName);
    if (isUnlocked) return null;

    const currency = localStorage.getItem('currency') || 'USD';
    const priceDisplay = currency === 'USD' ? `$${priceUSD}` : `₹${(priceUSD * 83).toLocaleString()}`;
    const balanceDisplay = currency === 'USD' ? `$${billingBalance}` : `₹${(billingBalance * 83).toLocaleString()}`;

    const handleUnlock = () => {
      if (billingBalance < priceUSD) {
        alert("Insufficient balance. Please top up your billing account first.");
        return;
      }
      
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please log in first.');
        navigate('/');
        return;
      }
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
      
      fetch('/api/auth/billing/unlock-node', {
        method: 'POST',
        headers,
        body: JSON.stringify({ node_name: nodeName, price: priceUSD })
      })
        .then(res => {
          if (!res.ok) throw new Error("Unlock failed");
          return res.json();
        })
        .then(data => {
          setBillingBalance(data.balance);
          setUnlockedNodes(data.unlocked_nodes);
          alert(`Successfully unlocked ${nodeName.toUpperCase()} Node!`);
        })
        .catch(err => alert("Failed to unlock node: " + err.message));
    };

    return (
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(10, 10, 12, 0.88)',
        backdropFilter: 'blur(8px)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '24px',
        borderRadius: '12px'
      }}>
        <div className="glow-card" style={{ maxWidth: '400px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
          <div style={{ background: 'var(--accent-glow)', border: '1px solid var(--accent)', color: '#fff', borderRadius: '50%', width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkle size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>Upgrade to Unlock Node</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Enable the {nodeName.toUpperCase()} Specialist Agent Node to execute automation and optimize this workspace.
            </p>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#fff' }}>
            {priceDisplay}<span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>/mo</span>
          </div>
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <GlowButton variant="glow" onClick={handleUnlock} style={{ width: '100%' }}>
              Unlock with Balance (Active: {balanceDisplay})
            </GlowButton>
            {billingBalance < priceUSD && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Quick Top Up:</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <GlowButton variant="secondary" onClick={() => handleTopUpShortcut(currency === 'USD' ? 1 : 100/83)} style={{ width: '100%', fontSize: '12px', padding: '6px' }}>
                    {currency === 'USD' ? '$1' : '₹100'}
                  </GlowButton>
                  <GlowButton variant="secondary" onClick={() => handleTopUpShortcut(currency === 'USD' ? 5 : 500/83)} style={{ width: '100%', fontSize: '12px', padding: '6px' }}>
                    {currency === 'USD' ? '$5' : '₹500'}
                  </GlowButton>
                  <GlowButton variant="secondary" onClick={() => handleTopUpShortcut(currency === 'USD' ? 10 : 1000/83)} style={{ width: '100%', fontSize: '12px', padding: '6px' }}>
                    {currency === 'USD' ? '$10' : '₹1000'}
                  </GlowButton>
                  <GlowButton variant="secondary" onClick={() => handleTopUpShortcut(currency === 'USD' ? 50 : 5000/83)} style={{ width: '100%', fontSize: '12px', padding: '6px' }}>
                    {currency === 'USD' ? '$50' : '₹5000'}
                  </GlowButton>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const handleApprove = (id: string, updatedData: any) => {
    if (id.startsWith('cr-')) {
      setCreativeAssets((prev) =>
        prev.map((asset) =>
          asset.id === id
            ? {
                ...asset,
                headline: updatedData.headline,
                bodyText: updatedData.bodyText,
                cta: updatedData.cta,
                status: 'approved',
              }
            : asset
        )
      );
    } else if (id.startsWith('cp-')) {
      setCampaigns((prev) =>
        prev.map((camp) =>
          camp.id === id
            ? {
                ...camp,
                budget: updatedData.budget,
                status: 'active',
              }
            : camp
        )
      );
    } else if (id.startsWith('seo-')) {
      setSeoBlogs((prev) =>
        prev.map((blog) =>
          blog.id === id
            ? {
                ...blog,
                title: updatedData.headline,
                excerpt: updatedData.bodyText,
                // Approved accepts the strategy — it does NOT publish to the site, so
                // don't label it "published".
                status: 'approved',
              }
            : blog
        )
      );
      // Trigger the remaining backend pipeline (Publishing Agent -> Reporting Agent),
      // which reports honestly against the workspace's real site-connector state.
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
      fetch(`/api/agents/${workspaceId}/seo/publish`, { method: 'POST', headers })
        .catch(err => console.error("Error triggering SEO publish:", err));
      setApproveToast('SEO strategy approved. Connect a site (Content Studio) to apply the changes — nothing was published automatically.');
      // (No metric bump: visibility must come from measured data, not from approving.)
    } else if (id.startsWith('geo-')) {
      setSeoBlogs((prev) =>
        prev.map((blog) =>
          blog.id === id
            ? {
                ...blog,
                title: updatedData.headline || updatedData.title,
                excerpt: updatedData.bodyText,
                // Approved, not published — the GEO plan still has to be applied.
                status: 'approved',
              }
            : blog
        )
      );
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
      fetch(`/api/agents/${workspaceId}/geo/publish`, { method: 'POST', headers })
        .catch(err => console.error("Error triggering GEO publish:", err));
      setApproveToast('GEO strategy approved. Connect a site (Content Studio) to apply the changes — nothing was published automatically.');
      // (No aiVisibility bump: that must come from the measured LLM recall probe.)
    } else if (id.startsWith('sp-')) {
      setSocialPosts((prev) =>
        prev.map((post) =>
          post.id === id
            ? {
                ...post,
                caption: updatedData.bodyText,
                status: 'published',
              }
            : post
        )
      );
    }

    setIsReviewOpen(false);

    // Push log alert
    const timeStr = new Date().toLocaleTimeString();
    setLogs((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        time: timeStr,
        agent: 'Optimization Agent',
        message: `Approved item ${id}. Saved for applying via a connected site.`,
      },
    ]);
  };

  const handleReject = (id: string) => {
    setIsReviewOpen(false);
    const timeStr = new Date().toLocaleTimeString();
    setLogs((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        time: timeStr,
        agent: 'System',
        message: `Task rejection parsed for node target id: ${id}`,
      },
    ]);
  };

  const handleToggleCampaign = (id: string) => {
    setCampaigns((prev) =>
      prev.map((camp) =>
        camp.id === id
          ? {
              ...camp,
              status: camp.status === 'active' ? ('paused' as const) : ('active' as const),
            }
          : camp
      )
    );
  };

  const handleComposeSocial = (caption: string, platform: 'Instagram' | 'Facebook' | 'YouTube') => {
    handleTriggerSocial(platform, caption);

    const newPost: SocialPostItem = {
      id: `sp-${Date.now()}`,
      platform,
      caption,
      scheduledFor: 'Scheduled 5m ago',
      status: 'scheduled',
    };
    setSocialPosts((prev) => [newPost, ...prev]);

    // A local push here used to be the only thing that ever filled the bell. Notifications
    // are written server-side now, so a draft created in this tab is not one.

    setActiveTab('control');
  };

  // AI Marketing Analyst chat handler. The reply text itself is real (fetched from the
  // backend, which grounds it in this workspace's actual connected-data status and never
  // fabricates campaign numbers). The isVisual/visualType keyword detection below is kept
  // exactly as before - it only decides whether to render one of the existing sample charts
  // alongside the answer, which is a cosmetic/demo affordance unrelated to the answer's
  // honesty and out of scope for this change.
  const handleSendClaudeMessage = (message: string) => {
    const userMsg: ChatMessage = {
      id: String(Date.now()),
      sender: 'user',
      text: message,
    };
    setChatHistory((prev) => [...prev, userMsg]);

    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    if (workspaceId) {
      let isVisual = false;
      let visualType: 'bar' | 'table' | 'pie' | 'line' | 'heatmap' | null = null;
      const lower = message.toLowerCase();
      if (lower.includes('roas')) { isVisual = true; visualType = 'bar'; }
      else if (lower.includes('wasting') || lower.includes('cpa')) { isVisual = true; visualType = 'table'; }
      else if (lower.includes('csv') || lower.includes('upload') || lower.includes('heatmap')) { isVisual = true; visualType = 'heatmap'; }
      else if (lower.includes('pie')) { isVisual = true; visualType = 'pie'; }
      else if (lower.includes('line')) { isVisual = true; visualType = 'line'; }

      fetch(`/api/agents/${workspaceId}/analytics`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query_message: message })
      })
        .then(r => r.json())
        .then(d => {
          const text = d?.text || 'Sorry, I could not generate a response just now — please try again.';
          setChatHistory((prev) => [...prev, { id: String(Date.now() + 1), sender: 'claude', text, isVisual, visualType }]);
        })
        .catch(() => {
          setChatHistory((prev) => [...prev, { id: String(Date.now() + 1), sender: 'claude', text: 'I could not reach the analytics agent — please try again.', isVisual: false, visualType: null }]);
        });
    }
  };


  // Dismiss a priority without acting on it. The Ignore button referenced this but it was
  // never defined, so clicking it threw a ReferenceError instead of dismissing the card.


  return (
    <div className={`dashboard-container ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Sidebar navigation */}
      <aside className="sidebar">
        <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Cpu className="logo-icon" size={20} />
            <span className="sidebar-logo-text" style={{ fontWeight: 800, fontSize: '15px', fontFamily: 'var(--font-heading)' }}>
              RAFTRA ENGINE
            </span>
          </div>
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              color: 'var(--text-secondary)',
              padding: '5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
          >
            {isSidebarCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        <div className="sidebar-menu">
          <span className="sidebar-menu-category" style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', paddingLeft: '14px', marginBottom: '8px', display: 'block', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            GROWTH PLATFORM
          </span>

          <button
            onClick={() => setActiveTab('control')}
            className={`sidebar-item ${activeTab === 'control' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }}
          >
            <div className="sidebar-item-left">
              <LayoutDashboard size={15} />
              <span>Home</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`sidebar-item ${activeTab === 'reports' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }}
          >
            <div className="sidebar-item-left">
              <FileText size={15} />
              <span>Market Intelligence</span>
            </div>
          </button>

          <span className="sidebar-menu-category" style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', paddingLeft: '14px', margin: '14px 0 6px', display: 'block', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            EXECUTION SUITE
          </span>

          <button
            onClick={() => setActiveTab('studio')}
            className={`sidebar-item ${activeTab === 'studio' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }}
          >
            <div className="sidebar-item-left">
              <Sparkles size={15} />
              <span>AI Creative Studio</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('campaign')}
            className={`sidebar-item ${activeTab === 'campaign' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }}
          >
            <div className="sidebar-item-left">
              <Megaphone size={15} />
              <span>Campaign Manager</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('seo')}
            className={`sidebar-item ${activeTab === 'seo' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }}
          >
            <div className="sidebar-item-left">
              <Globe2 size={15} />
              <span>Search & AEO Engine</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`sidebar-item ${activeTab === 'analytics' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }}
          >
            <div className="sidebar-item-left">
              <BarChart3 size={15} />
              <span>Growth Analytics</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('social')}
            className={`sidebar-item ${activeTab === 'social' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }}
          >
            <div className="sidebar-item-left">
              <Share2 size={15} />
              <span>Social Hub</span>
            </div>
          </button>

          <button
            onClick={() => window.open('/influencer-marketplace', '_blank')}
            className={`sidebar-item ${activeTab === 'influencer' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }}
          >
            <div className="sidebar-item-left" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users2 size={15} />
                <span>Creator Marketplace</span>
              </div>
              <ExternalLink size={12} style={{ color: 'var(--primary, #5A52FF)', opacity: 0.8 }} />
            </div>
          </button>

          <span className="sidebar-menu-category" style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', paddingLeft: '14px', margin: '14px 0 6px', display: 'block', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            OPERATIONS & DATA
          </span>

          <button
            onClick={() => setActiveTab('scheduler')}
            className={`sidebar-item ${activeTab === 'scheduler' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }}
          >
            <div className="sidebar-item-left">
              <Calendar size={15} />
              <span>Marketing Calendar</span>
            </div>
          </button>

          <div>
            <button
              onClick={() => {
                setIsKbOpen(!isKbOpen);
                if (activeTab !== 'kb_brands' && activeTab !== 'kb_assets') {
                  setActiveTab('kb_brands');
                }
              }}
              className={`sidebar-item ${activeTab === 'kb' || activeTab === 'kb_brands' || activeTab === 'kb_assets' ? 'active' : ''}`}
              style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              title="Brand Knowledge Vault"
            >
              <div className="sidebar-item-left">
                <BookOpen size={15} />
                <span>Brand Knowledge Vault</span>
              </div>
              {!isSidebarCollapsed && (
                <ChevronDown size={13} style={{ transform: isKbOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s', opacity: 0.7 }} />
              )}
            </button>

            {isKbOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: isSidebarCollapsed ? '0px' : '22px', gap: '3px', marginTop: '3px' }}>
                <button
                  onClick={() => setActiveTab('kb_brands')}
                  className={`sidebar-item ${activeTab === 'kb_brands' || activeTab === 'kb' ? 'active' : ''}`}
                  style={{
                    background: activeTab === 'kb_brands' || activeTab === 'kb' ? 'rgba(0, 230, 118, 0.12)' : 'none',
                    border: 'none',
                    width: '100%',
                    textAlign: 'left',
                    fontSize: '12.5px',
                    padding: isSidebarCollapsed ? '6px 0' : '6px 12px',
                    justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                    color: activeTab === 'kb_brands' || activeTab === 'kb' ? '#00E676' : 'var(--text-secondary)',
                    fontWeight: activeTab === 'kb_brands' || activeTab === 'kb' ? 700 : 500
                  }}
                  title="Brand Guidelines (BG)"
                >
                  <div className="sidebar-item-left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Tag size={13} style={{ flexShrink: 0 }} />
                    <span>Brand Guidelines</span>
                  </div>
                  {isSidebarCollapsed && (
                    <span style={{ fontSize: '9px', fontWeight: 800, color: '#00E676', background: 'rgba(0,230,118,0.15)', padding: '1px 4px', borderRadius: '4px' }}>BG</span>
                  )}
                </button>
                
                <button
                  onClick={() => setActiveTab('kb_assets')}
                  className={`sidebar-item ${activeTab === 'kb_assets' ? 'active' : ''}`}
                  style={{
                    background: activeTab === 'kb_assets' ? 'rgba(0, 230, 118, 0.12)' : 'none',
                    border: 'none',
                    width: '100%',
                    textAlign: 'left',
                    fontSize: '12.5px',
                    padding: isSidebarCollapsed ? '6px 0' : '6px 12px',
                    justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                    color: activeTab === 'kb_assets' ? '#00E676' : 'var(--text-secondary)',
                    fontWeight: activeTab === 'kb_assets' ? 700 : 500
                  }}
                  title="Media Asset Vault (AV)"
                >
                  <div className="sidebar-item-left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Layers size={13} style={{ flexShrink: 0 }} />
                    <span>Media Asset Vault</span>
                  </div>
                  {isSidebarCollapsed && (
                    <span style={{ fontSize: '9px', fontWeight: 800, color: '#00E676', background: 'rgba(0,230,118,0.15)', padding: '1px 4px', borderRadius: '4px' }}>AV</span>
                  )}
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setActiveTab('integrations')}
            className={`sidebar-item ${activeTab === 'integrations' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }}
          >
            <div className="sidebar-item-left">
              <ToyBrick size={15} />
              <span>Integrations & Connectors</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`sidebar-item ${activeTab === 'settings' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }}
          >
            <div className="sidebar-item-left">
              <Settings size={15} />
              <span>Workspace & Billing</span>
            </div>
          </button>
        </div>

        {/* Sidebar Footer: Active Brand Profile & Sign Out */}
        <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '8px', padding: '12px 10px 10px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.06)', borderRadius: '0 0 16px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 6px' }}>
            <div className="user-avatar" style={{ flexShrink: 0, width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #7C75FF 0%, #5A52FF 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '13px' }}>
              {(brandProfile?.name || 'D').charAt(0)}
            </div>
            <div className="sidebar-footer-info" style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {brandProfile?.name || 'Demo Brand'}
                </h4>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00E676', flexShrink: 0 }} title="Online Workspace" />
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '1px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {brandProfile?.url || 'https://demobrand.com/'}
              </p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="sidebar-item"
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              width: '100%',
              textAlign: 'left',
              padding: '7px 10px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#ff4757';
              e.currentTarget.style.borderColor = 'rgba(255, 71, 87, 0.3)';
              e.currentTarget.style.background = 'rgba(255, 71, 87, 0.08)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
            }}
            title="Log Out"
          >
            <div className="sidebar-item-left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LogOut size={14} />
              <span style={{ fontSize: '12.5px', fontWeight: 600 }}>Sign Out</span>
            </div>
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="dashboard-main">
        {/* Header/Top Bar */}
        <header className="dashboard-header">
          {/* Workspace switcher. Was a chevron with no handler — it looked interactive
              and did nothing. Now it opens the real list from /api/workspaces. */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setIsBrandDropdownOpen(!isBrandDropdownOpen)}
              aria-expanded={isBrandDropdownOpen}
              aria-haspopup="menu"
              title="Switch workspace"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                padding: '6px 12px',
                color: '#fff',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: workspaceDot(brandProfile?.colors) }} />
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {brandProfile?.name || (userName ? `${userName}'s Workspace` : 'My Workspace')}
              </span>
              <ChevronDown size={13} style={{ color: 'var(--text-secondary)', transform: isBrandDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
            </button>

            {isBrandDropdownOpen && (
              <>
                {/* Click-away layer, so the menu closes like every other menu here. */}
                <div onClick={() => setIsBrandDropdownOpen(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 499 }} />
                <div
                  role="menu"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: 0,
                    width: '260px',
                    background: '#0a0a12',
                    border: '1px solid rgba(255, 255, 255, 0.14)',
                    borderRadius: '14px',
                    padding: '8px',
                    boxShadow: '0 12px 36px rgba(0,0,0,0.85)',
                    zIndex: 500,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 800, padding: '6px 8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Switch Brand Workspace
                  </div>

                  {allWorkspaces.length === 0 && (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '6px 10px' }}>
                      Loading your workspaces…
                    </div>
                  )}

                  {allWorkspaces.map(w => (
                    <button
                      key={w.id}
                      role="menuitem"
                      onClick={() => switchWorkspace(w.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: w.id === workspaceId ? 'rgba(0, 230, 118, 0.12)' : 'transparent',
                        border: 'none',
                        color: w.id === workspaceId ? '#00E676' : '#fff',
                        cursor: 'pointer',
                        textAlign: 'left',
                        width: '100%',
                        fontSize: '13px',
                        fontWeight: w.id === workspaceId ? 700 : 500
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: workspaceDot(w.brand_color) }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</span>
                      </span>
                      {w.id === workspaceId && <CheckCircle2 size={13} color="#00E676" />}
                    </button>
                  ))}

                  <div style={{ width: '100%', height: '1px', background: 'rgba(255, 255, 255, 0.08)', margin: '4px 0' }} />

                  <button
                    role="menuitem"
                    onClick={() => { setIsBrandDropdownOpen(false); setActiveTab('settings'); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 600
                    }}
                  >
                    <Sparkles size={12} color="#7C75FF" />
                    <span>Manage Brands in Settings</span>
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="header-actions-group" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Search / Command Palette */}
            <div className="topbar-search-trigger" onClick={() => setIsSearchOpen(true)} title="Press ⌘K or Ctrl+K to open palette">
              <Search size={13} />
              <span>Search / Command palette...</span>
              <span style={{ fontSize: '9px', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px', marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>
                ⌘K
              </span>
            </div>

            {/* Notifications icon */}
            <button
              className="topbar-icon-button"
              aria-label={priorities.length > 0 ? `Notifications, ${priorities.length} pending` : 'Notifications'}
              title="View alerts & notifications"
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            >
              <Bell size={16} />
              {priorities.length > 0 && <span className="notification-badge-dot" />}
            </button>

            {/* Live Credit Tracker Widget. The reference build renders a hardcoded
                12,000; this shows the real balance from GET /api/auth/billing, converted
                at the same $1 = Rs.83 rate used everywhere else on this page. */}
            <button
              onClick={() => setIsCreditsModalOpen(true)}
              title="Click to recharge & view execution credits"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                fontSize: '12px',
                fontWeight: 700,
                color: '#00E676',
                background: 'rgba(0, 230, 118, 0.12)',
                border: '1px solid rgba(0, 230, 118, 0.3)',
                padding: '5px 12px',
                borderRadius: '100px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 0 12px rgba(0, 230, 118, 0.12)'
              }}
            >
              <Coins size={13} color="#00E676" />
              <span>{'\u20B9'}{Math.round(billingBalance * 83).toLocaleString('en-IN')} Credits</span>
              <span style={{ fontSize: '10px', background: 'rgba(0, 230, 118, 0.25)', border: '1px solid rgba(0, 230, 118, 0.5)', color: '#00E676', padding: '1px 6px', borderRadius: '100px', fontWeight: 800 }}>
                + Add
              </span>
            </button>

            {/* Profile Avatar Trigger */}
            <div
              className="user-avatar"
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              title={userEmail ? `${userName} (${userEmail})` : userName}
              style={{
                width: '30px',
                height: '30px',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #7C75FF 0%, #5A52FF 100%)',
                color: '#fff',
                fontWeight: 800,
                borderRadius: '8px',
                border: isProfileMenuOpen ? '2px solid #00E676' : '1px solid rgba(255,255,255,0.2)',
                transition: 'all 0.15s ease'
              }}
            >
              {userName.charAt(0)}
            </div>
          </div>
        </header>

        {/* Dashboard core views. One Suspense boundary covers every tab — each workspace
            is a lazy chunk now, so this catches whichever one is loading. */}
        <div className="dashboard-content">
          <Suspense fallback={<TabFallback />}>
          {activeTab === 'control' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '35px' }}>
              {/* A brand-new account has no workspace yet, so the overview below would have
                  nothing to show and no way to fix that. Kept above it rather than inside,
                  because it is the one screen state ModernHomeOverview cannot resolve. */}
              {!workspaceId && (
                <div style={{ background: 'var(--accent-glow)', border: '1px solid var(--accent)', padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-start' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#fff' }}>No workspace yet</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
                    Add your website to create your first workspace — the agents need it before they can do anything.
                  </p>
                  <GlowButton variant="glow" onClick={() => setActiveTab('settings')}>
                    Set up workspace
                  </GlowButton>
                </div>
              )}

              {/* MODERN HOME OVERVIEW (Brand Kit Extraction, Action Needed, Top Creatives, Schedules) */}
              <ModernHomeOverview
                userName={userName}
                brandName={brandProfile?.name || 'Your brand'}
                workspaceId={workspaceId}
                onNavigateTab={(t: string) => setActiveTab(t as NavigationTab)}
              />
            </div>
          )}

          {activeTab === 'studio' && (
            <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '500px' }}>

              <WorkspaceCreative
                workspaceId={workspaceId ?? undefined}
                brandUrl={brandProfile?.url || ''}
                assets={creativeAssets}
                onOpenReview={handleOpenReview}
                onGenerate={handleGenerateCreative}
                onAssetSaved={handleAssetSaved}
                onNavigateTab={(tab: string) => setActiveTab(tab as NavigationTab)}
                incomingReferenceImage={studioReferenceImage}
              />
            </div>
          )}

          {activeTab === 'campaign' && (
            <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '500px' }}>
              {renderLockOverlay('campaign', 149)}
              <WorkspaceCampaign
                workspaceId={workspaceId}
                campaigns={campaigns}
                creativeAssets={creativeAssets}
                onOpenReview={handleOpenReview}
                onToggleStatus={handleToggleCampaign}
                onOpenCreativeStudio={() => setActiveTab('studio')}
              />
            </div>
          )}

          {activeTab === 'seo' && (
            <div style={{ width: '100%', height: '100%', minHeight: '500px' }}>
              <div style={{ position: 'relative', minHeight: '400px' }}>
                {renderLockOverlay('seo', 99)}
                <WorkspaceSEO
                  blogs={seoBlogs}
                  onOpenReview={handleOpenReview}
                  seoAgent={displayAgents.find(a => a.type === 'SEO')}
                  geoAgent={displayAgents.find(a => a.type === 'GEO')}
                  onTriggerSEO={handleTriggerSEO}
                  onTriggerGEO={handleTriggerGEO}
                  workspaceId={workspaceId}
                  siteUrl={brandProfile?.url}
                  onManageIntegrations={() => setActiveTab('integrations')}
                />
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '500px' }}>
              {renderLockOverlay('analytics', 129)}
              <WorkspaceAnalytics
                onNavigateTab={(t: string) => setActiveTab(t as NavigationTab)}
                chatHistory={chatHistory}
                onSendMessage={handleSendClaudeMessage}
              />
            </div>
          )}

          {activeTab === 'social' && (
            <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '500px' }}>

              <WorkspaceSocial
                posts={socialPosts}
                onOpenReview={handleOpenReview}
                onComposePost={handleComposeSocial}
              />
            </div>
          )}

          {activeTab === 'influencer' && workspaceId && (
            <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '500px' }}>

              <WorkspaceInfluencer workspaceId={workspaceId} />
            </div>
          )}

          {activeTab === 'agents' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              <div>
                <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>AI Network Specialist Agents</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                  Manage specialized sub-agent rules, active graph operations, and status indicators in your growth pipeline.
                </p>
              </div>

              {/* Agent Flow Diagram */}
              <div className="glow-card" style={{ padding: '28px', background: 'rgba(90, 82, 255, 0.02)', border: '1px solid rgba(90, 82, 255, 0.1)' }}>
                <h3 style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                  RAFTRA MARKETING AGENT GRAPH PATHWAY
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
                  {displayAgents.length === 0 && (
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No agents have run in this workspace yet.</span>
                  )}
                  {displayAgents.map((agent, idx) => {
                    // A node is lit only when that agent has actually run: highlighted while
                    // RUNNING, outlined once it has a finished run, dim when it never ran.
                    const st = agentStatus(agent.status);
                    const touched = agent.status !== 'IDLE';
                    return (
                      <div key={agent.type} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          title={`${st.label}${agent.task ? ' — ' + agent.task : ''}`}
                          style={{
                            background: st.live ? 'var(--accent-glow)' : 'rgba(255, 255, 255, 0.01)',
                            border: '1px solid',
                            borderColor: st.live ? 'var(--accent)' : touched ? 'var(--border-color)' : 'transparent',
                            borderRadius: '8px',
                            padding: '10px 16px',
                            fontSize: '12px',
                            fontWeight: 500,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            color: touched ? '#fff' : 'var(--text-muted)',
                          }}
                        >
                          <span className={`agent-icon-bulb ${st.live ? 'working' : 'idle'}`} style={{ width: '6px', height: '6px' }} />
                          <span>{agent.name}</span>
                        </div>
                        {idx < displayAgents.length - 1 && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 'bold' }}>→</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Grid of Agent Cards */}
              <div className="agent-cards-grid">
                {displayAgents.map((agent) => {
                  const st = agentStatus(agent.status);
                  return (
                    <div key={agent.type} className="glow-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {st.live
                          ? <span className="badge-pulse warning" style={{ width: '6px', height: '6px' }} />
                          : <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: st.color, flexShrink: 0 }} />}
                        <h4 style={{ fontSize: '14px' }}>{agent.name}</h4>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                        <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Status:</span>
                          <span style={{ fontWeight: 600, color: st.color }}>{st.label}</span>
                        </div>
                        {agent.updated && (
                          <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Last activity:</span>
                            <span style={{ color: 'var(--text-muted)' }}>{agent.updated}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '8px', marginTop: '4px' }}>
                          <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>Last run:</span>
                          <span style={{ color: agent.status === 'FAILED' ? 'var(--danger)' : '#fff', textAlign: 'right' }}>{agent.task || '—'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'kb' && (
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '30px' }}>

              <div>
                <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>Vector Knowledge Base</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                  Scraped URLs, document guidelines, and semantic logs index used by your AI agents team.
                </p>
              </div>
              <div className="workspace-grid-split">
                <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <h3 style={{ fontSize: '16px' }}>Ingest Brand Guidelines</h3>
                  <div className="form-group">
                    <label>Resource URL / API Docs</label>
                    <input type="text" value={brandProfile?.url || ''} onChange={(e) => setBrandProfile((prev: any) => ({ ...prev, url: e.target.value }))} style={{ color: 'white' }} />
                  </div>
                  <div className="form-group">
                    <label>Brand Voice Tone Context</label>
                    <textarea rows={4} value={brandProfile?.tone || ''} onChange={(e) => setBrandProfile((prev: any) => ({ ...prev, tone: e.target.value }))} style={{ color: 'white' }} />
                  </div>
                  <GlowButton variant="secondary" onClick={handleReindex} loading={isReindexing} style={{ width: '100%' }}>
                    Re-index Knowledge Graph
                  </GlowButton>
                  {reindexMsg && (
                    <span style={{ fontSize: '12px', lineHeight: 1.55, color: reindexMsg.ok ? 'var(--text-secondary)' : 'var(--warning)' }}>
                      {reindexMsg.text}
                    </span>
                  )}
                </div>
                <VectorDatastores workspaceId={workspaceId} reindexing={isReindexing} />
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <WorkspaceReports
              onNavigateTab={(t: string) => setActiveTab(t as NavigationTab)}
              brandName={brandProfile?.name || 'Demo Brand'}
              workspaceId={workspaceId}
            />
          )}

          {activeTab === 'scheduler' && (
            <WorkspaceScheduler onNavigateTab={(t: string) => setActiveTab(t as NavigationTab)}
                                workspaceId={workspaceId} />
          )}

          {activeTab === 'kb_brands' && (
            <BrandKnowledgeBase
              onSyncKnowledgeGraph={handleReindex}
              syncing={isReindexing}
              syncMessage={reindexMsg}
              brand={brandProfile}
              workspaceId={workspaceId}
            />
          )}

          {activeTab === 'kb_assets' && (
            <WorkspaceAssets
              workspaceId={workspaceId}
              creatives={creativeAssets}
              onUseAsset={(url: string) => { setStudioReferenceImage(url); setActiveTab('studio'); }}
            />
          )}

          {activeTab === 'integrations' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              <div>
                <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>Integrations Hub</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                  Live connection status for every platform this workspace can publish to or pull data from.
                </p>
              </div>
              <IntegrationsHub workspaceId={workspaceId} onConnect={setActiveTab} />
            </div>
          )}

          {activeTab === 'settings' && (
            /* The reference build's billing screen, wired to this branch's API: real
               account, real workspaces, real Razorpay top-up, real payment history and the
               real creator deals. */
            <WorkspaceSettings
              onNavigateTab={(t: string) => setActiveTab(t as NavigationTab)}
              workspaceId={workspaceId}
              brands={allWorkspaces.map(w => ({
                id: String(w.id),
                name: w.name,
                url: w.company_url || '',
                industry: '',
                color: w.brand_color || '#5A52FF',
              }))}
              activeBrandId={workspaceId ? String(workspaceId) : undefined}
              onSwitchBrand={(id: string) => switchWorkspace(Number(id))}
              onAddBrand={() => refreshWorkspaces()}
              onDeleteBrand={() => refreshWorkspaces()}
              creditsBalance={Math.round(billingBalance * 83)}
              onTopUpCredits={(amountINR: number) => handleTopUpShortcut(amountINR / 83)}
              onChoosePlan={() => navigate('/pricing')}
            />
          )}
          </Suspense>
        </div>
      </main>

      {/* Change password */}
      {showPasswordModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
             onClick={() => setShowPasswordModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '420px', background: '#0a0a12', border: '1.5px solid rgba(255,255,255,0.14)', borderRadius: '20px', padding: '26px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 16px' }}>Change password</h3>
            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
              <div className="form-group">
                <label>Current password</label>
                <input type="password" required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
              </div>
              <div className="form-group">
                <label>New password (at least 8 characters)</label>
                <input type="password" required minLength={8} value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              </div>
              {pwError && <div style={{ fontSize: '12.5px', color: '#ff6b7a' }}>{pwError}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
                <button type="button" onClick={() => setShowPasswordModal(false)}
                        style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '9px 18px', borderRadius: '100px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>
                  Cancel
                </button>
                <GlowButton variant="glow" type="submit" disabled={pwBusy} style={{ padding: '9px 22px', fontSize: '13px' }}>
                  {pwBusy ? 'Saving…' : 'Update password'}
                </GlowButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete account. Deliberately two gates and no pre-filled confirmation. */}
      {showDeleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
             onClick={() => setShowDeleteModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '440px', background: '#0a0a12', border: '1.5px solid rgba(255,71,87,0.4)', borderRadius: '20px', padding: '26px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 8px', color: '#ff6b7a' }}>Delete account</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 16px' }}>
              This permanently removes your account and every workspace on it — campaigns,
              creatives, competitor reports, schedules and connections. It cannot be undone.
            </p>
            <form onSubmit={handleDeleteAccount} style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
              <div className="form-group">
                <label>Type DELETE to confirm</label>
                <input type="text" required value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="DELETE" />
              </div>
              <div className="form-group">
                <label>Your password (leave blank if you sign in with Google)</label>
                <input type="password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} />
              </div>
              {deleteError && <div style={{ fontSize: '12.5px', color: '#ff6b7a' }}>{deleteError}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
                <button type="button" onClick={() => setShowDeleteModal(false)}
                        style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '9px 18px', borderRadius: '100px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>
                  Cancel
                </button>
                <button type="submit" disabled={deleteBusy}
                        style={{ background: '#ff4757', border: 'none', color: '#fff', padding: '9px 22px', borderRadius: '100px', fontSize: '13px', cursor: deleteBusy ? 'wait' : 'pointer', fontWeight: 700 }}>
                  {deleteBusy ? 'Deleting…' : 'Delete my account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Search Command Palette Overlay */}
      {isProfileMenuOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 900 }} onClick={() => setIsProfileMenuOpen(false)} />
          <div style={{
            position: 'fixed', top: '64px', right: '24px', width: '290px',
            background: '#0a0a12', border: '1.5px solid rgba(255, 255, 255, 0.14)',
            borderRadius: '18px', boxShadow: '0 20px 60px rgba(0,0,0,0.95), 0 0 25px rgba(90,82,255,0.25)',
            zIndex: 901, overflow: 'hidden', padding: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 8px 12px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #7C75FF 0%, #5A52FF 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '15px' }}>
                {userName.charAt(0)}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail || 'Signed in'}</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '8px' }}>
              <button onClick={() => { setIsProfileMenuOpen(false); setActiveTab('settings'); }} className="profile-menu-item">
                <User size={14} color="#7C75FF" />
                <span>Account &amp; profile settings</span>
              </button>
              <button onClick={() => { setIsProfileMenuOpen(false); setActiveTab('settings'); }} className="profile-menu-item">
                <CreditCard size={14} color="#FFB300" />
                <span>Plans &amp; invoices</span>
              </button>
              <button onClick={() => { setIsProfileMenuOpen(false); setIsCreditsModalOpen(true); }} className="profile-menu-item">
                <Coins size={14} color="#00E676" />
                <span>Execution credits (₹{Math.round(billingBalance * 83).toLocaleString('en-IN')})</span>
              </button>
              <button onClick={() => { setIsProfileMenuOpen(false); setActiveTab('integrations'); }} className="profile-menu-item">
                <ShieldCheck size={14} color="#5A52FF" />
                <span>Connected accounts</span>
              </button>
            </div>

            <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '8px 0' }} />

            <button onClick={handleLogout} className="profile-menu-item" style={{ color: '#ff4757' }}>
              <LogOut size={14} color="#ff4757" />
              <span>Sign out</span>
            </button>
          </div>
        </>
      )}

      {/* Execution credits top-up. The packs are the reference build's; the purchase runs
          through this branch's real Razorpay flow rather than incrementing a local number. */}
      {isCreditsModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
             onClick={() => setIsCreditsModalOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '480px', background: '#0a0a12', border: '1.5px solid rgba(0, 230, 118, 0.4)', borderRadius: '24px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '18px', boxShadow: '0 20px 60px rgba(0,0,0,0.9), 0 0 30px rgba(0,230,118,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#00E676', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Execution credits top-up</span>
                <h3 style={{ fontSize: '20px', color: '#fff', margin: '4px 0 0 0', fontWeight: 800 }}>
                  Current balance: ₹{Math.round(billingBalance * 83).toLocaleString('en-IN')}
                </h3>
              </div>
              <button onClick={() => setIsCreditsModalOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { inr: 2500, label: 'Starter booster', desc: 'Creative testing and around 50 AI image variants' },
                { inr: 5000, label: 'Growth booster', desc: 'A month of video generation and multi-channel sync', popular: true },
                { inr: 15000, label: 'Scale booster', desc: 'Heavy ad scaling and competitor scans' },
              ].map(pack => (
                <button
                  key={pack.inr}
                  onClick={() => { setIsCreditsModalOpen(false); handleTopUpShortcut(pack.inr / 83); }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                    textAlign: 'left', width: '100%', padding: '14px 16px', borderRadius: '14px',
                    background: pack.popular ? 'rgba(0,230,118,0.08)' : 'rgba(255,255,255,0.03)',
                    border: pack.popular ? '1px solid rgba(0,230,118,0.35)' : '1px solid rgba(255,255,255,0.1)',
                    color: '#fff', cursor: 'pointer'
                  }}
                >
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '14px', fontWeight: 700 }}>{pack.label}</span>
                    <span style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>{pack.desc}</span>
                  </span>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#00E676', whiteSpace: 'nowrap' }}>₹{pack.inr.toLocaleString('en-IN')}</span>
                </button>
              ))}
            </div>

            <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Payments are processed by Razorpay. Your balance updates as soon as the payment is confirmed.
            </p>
          </div>
        </div>
      )}

      {isSearchOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', justifyContent: 'center', paddingTop: '10vh' }} onClick={() => setIsSearchOpen(false)}>
          <div style={{ width: '500px', background: '#0a0a0c', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', height: 'fit-content', maxHeight: '60vh' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--border)' }}>
              <Search size={16} style={{ color: 'var(--text-secondary)', marginRight: '12px' }} />
              <input
                autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Type a command or search..."
                style={{ flex: 1, background: 'transparent', border: 'none', color: 'white', fontSize: '15px', outline: 'none' }}
              />
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', padding: '2px 6px', background: 'var(--bg-tertiary)', borderRadius: '4px' }}>ESC</span>
            </div>
            <div style={{ padding: '8px', overflowY: 'auto' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, padding: '8px', textTransform: 'uppercase' }}>Quick Actions</div>
              {['Go to Studio', 'View Analytics', 'Check Campaigns', 'System Settings'].filter(item => item.toLowerCase().includes(searchQuery.toLowerCase())).map((item, idx) => (
                <div key={idx} style={{ padding: '12px 16px', color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '12px', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'} onClick={() => { setIsSearchOpen(false); if (item === 'System Settings') setActiveTab('settings'); if (item === 'Go to Studio') setActiveTab('studio'); if (item === 'View Analytics') setActiveTab('analytics'); if (item === 'Check Campaigns') setActiveTab('campaign'); }}>
                  <Sparkles size={14} style={{ color: 'var(--accent)' }} />
                  {item}
                </div>
              ))}
              {searchQuery && (
                <div style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center' }}>
                  Press Enter to search all workspaces for "{searchQuery}"
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notifications Dropdown Overlay */}
      {isNotificationsOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 900 }} onClick={() => setIsNotificationsOpen(false)} />
          <div style={{ position: 'absolute', top: '64px', right: '16px', width: '320px', background: '#0a0a0c', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 901, overflow: 'hidden' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 600 }}>Notifications</span>
              {priorities.length > 0 && <span style={{ fontSize: '11px', background: 'var(--accent-glow)', color: 'var(--accent)', padding: '2px 8px', borderRadius: '12px' }}>{priorities.length} New</span>}
            </div>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {priorities.length > 0 ? (
                priorities.map(priority => (
                  <div
                    key={priority.id}
                    style={{ padding: '16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    onClick={() => {
                      markNotificationRead(priority.id);
                      setIsNotificationsOpen(false);
                      // action_url is stored as /dashboard?tab=<tab>; the dashboard is one
                      // page, so switch the tab rather than navigating away and remounting.
                      const tab = priority.action_url && priority.action_url.split('tab=')[1];
                      if (tab) setActiveTab(tab as NavigationTab);
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px', color: 'white' }}>{priority.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{priority.message}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                      {new Date(priority.created_at.endsWith('Z') || priority.created_at.includes('+') ? priority.created_at : `${priority.created_at}Z`).toLocaleString()}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  <Bell size={24} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                  You're all caught up! No new notifications.
                </div>
              )}
            </div>
            {priorities.length > 0 && (
              <div style={{ padding: '12px', background: 'var(--bg-tertiary)', textAlign: 'center', fontSize: '12px', color: 'var(--accent)', cursor: 'pointer', fontWeight: 500 }} onClick={markAllNotificationsRead}>
                Mark all as read
              </div>
            )}
          </div>
        </>
      )}

      {/* Approval confirmation banner */}
      {approveToast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 3000, maxWidth: '520px', background: 'rgba(20,22,30,0.97)', border: '1px solid rgba(34,197,94,0.4)', borderRadius: '12px', padding: '14px 18px', color: '#fff', fontSize: '13px', boxShadow: '0 12px 30px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: '#22C55E', fontSize: '18px' }}>✓</span>
          <span style={{ lineHeight: 1.5 }}>{approveToast}</span>
          <button onClick={() => setApproveToast(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '16px' }}>✕</button>
        </div>
      )}

      {/* Review Drawer slide panel overlay — the SEO/GEO audit report is a separate,
          state-aware modal owned by WorkspaceSEO itself, not this generic review flow. */}
      <ReviewDrawer
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        item={activeReviewItem}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    <style>{`
        .profile-menu-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border-radius: 8px;
          background: transparent;
          border: none;
          color: #ffffff;
          cursor: pointer;
          font-size: 12.5px;
          font-weight: 500;
          text-align: left;
          width: 100%;
          transition: all 0.15s ease;
        }
        .profile-menu-item:hover { background: rgba(255, 255, 255, 0.06); }
      `}</style>
    </div>
  );
}

