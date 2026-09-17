import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Sparkles,
  Zap,
  X,
  Layers,
  BarChart3,
  MessageSquare,
  HardDrive,
  ShieldCheck,
  Share2,
  ShoppingBag,
  Globe,
  GitBranch,
  Layout,
  Store,
  Code,
} from 'lucide-react';
import { GlowButton } from '../GlowButton';

/* Integrations & Connectors hub.
   ------------------------------------------------------------------
   The layout is the reference design from the finaldashboard build: search, category tabs,
   grouped cards and a connect modal. That build's cards were local state - "Connect" waited
   700ms and printed "<Name> Official (<name>_prod)" whatever you typed - so here every card
   reads GET /api/connectors/{ws}/status and every button calls the real connector. Platforms
   with no backend connector yet (ChatGPT Ads, Amazon Ads, Webflow, Slack, HubSpot) are shown
   as Coming Soon rather than offering a form that stores nothing. */

type Category = 'ecommerce_cms' | 'ad_accounts' | 'analytics' | 'productivity_crm';

/** What one connector's status payload means for its card. */
type View = {
  configured: boolean;       // server-side app credentials present
  connected: boolean;        // this workspace holds a live grant
  detail: string | null;     // which account / site is linked
  incomplete: string | null; // connected, but a required selection is missing
  error: string | null;      // the provider rejected the stored grant
};

interface Integration {
  id: string;
  name: string;
  category: Category;
  description: string;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
  comingSoon?: boolean;
  /** Key of the batched status payload; two cards can share one (GA4 rides on Search Console). */
  batchKey?: string;
  read?: (s: any) => View;
  /** One-click OAuth: the connector returns the provider's consent URL. */
  authorizePath?: (ws: number) => string;
  /** Needs details before OAuth / verification, collected in the modal. */
  form?: 'shopify' | 'wordpress';
  disconnectPath?: (ws: number) => string;
  disconnectMethod?: 'POST' | 'DELETE';
  disconnectWarning?: string;
  /** Where remaining setup (picking an ad account, a blog, a GA4 property) happens. */
  manageTab: string;
  manageLabel: string;
  unconfiguredHint?: string;
  /** Query param the connector's OAuth callback appends on return (?meta=connected). */
  returnParam?: string;
}

const base = (s: any, extra: Partial<View> = {}): View => ({
  configured: !!s.configured,
  connected: !!s.connected,
  detail: null,
  incomplete: null,
  error: s.auth_error || s.error || null,
  ...extra,
});

const INTEGRATIONS: Integration[] = [
  // ── E-Commerce & CMS ──
  {
    id: 'shopify', name: 'Shopify', category: 'ecommerce_cms',
    description: 'Sync store products and publish AI SEO blog posts and fixes straight to your Shopify store.',
    iconBg: 'rgba(149, 191, 71, 0.15)', iconColor: '#95BF47', icon: <ShoppingBag size={20} color="#95BF47" />,
    batchKey: 'shopify',
    read: (s) => base(s, {
      detail: s.shop_name || s.shop_domain || null,
      incomplete: s.connected && !s.blog_id ? 'Blog not selected yet' : null,
    }),
    form: 'shopify',
    disconnectPath: (ws) => `/api/connectors/shopify/${ws}`, disconnectMethod: 'DELETE',
    disconnectWarning: 'Raftra loses access to the store. Published content stays published.',
    manageTab: 'seo', manageLabel: 'SEO + GEO',
    unconfiguredHint: 'Server is missing SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET.',
    returnParam: 'shopify',
  },
  {
    id: 'wordpress', name: 'WordPress & WooCommerce', category: 'ecommerce_cms',
    description: 'Publish AI SEO blog posts, landing pages and on-page fixes to your WordPress site.',
    iconBg: 'rgba(33, 117, 155, 0.15)', iconColor: '#21759B', icon: <Globe size={20} color="#21759B" />,
    batchKey: 'wordpress',
    read: (s) => base(s, { configured: true, detail: s.site_name || s.site_url || null }),
    form: 'wordpress',
    disconnectPath: (ws) => `/api/connectors/wordpress/${ws}`, disconnectMethod: 'DELETE',
    disconnectWarning: 'Raftra loses access to the site. Published posts stay published.',
    manageTab: 'seo', manageLabel: 'SEO + GEO',
    returnParam: 'wordpress',
  },
  {
    id: 'webflow', name: 'Webflow', category: 'ecommerce_cms', comingSoon: true,
    description: 'CMS collection binding for landing page variants and localized marketing funnels.',
    iconBg: 'rgba(67, 83, 255, 0.15)', iconColor: '#4353FF', icon: <Layout size={20} color="#4353FF" />,
    manageTab: 'integrations', manageLabel: 'Integrations',
  },

  // ── Ad Accounts ──
  {
    id: 'meta', name: 'Meta Ads', category: 'ad_accounts',
    description: 'Run and optimize ads across Facebook, Instagram Feed & Reels, and Meta Audience Network.',
    iconBg: 'rgba(24, 119, 242, 0.15)', iconColor: '#1877F2',
    icon: <span style={{ fontWeight: 900, fontSize: '18px', color: '#1877F2' }}>∞</span>,
    batchKey: 'meta',
    read: (s) => base(s, {
      detail: s.name || s.ad_account_id || null,
      incomplete: s.connected && !s.ready_to_publish ? 'Ad account and Page not selected yet'
        : s.connected && s.token_expiring_soon ? `Connection expires in ${s.token_expires_in_days} day(s) — reconnect to keep publishing`
        : s.connected && s.can_spend === false ? 'No payment method on the ad account — ads won’t run'
        : null,
    }),
    authorizePath: (ws) => `/api/connectors/meta/${ws}/authorize`,
    disconnectPath: (ws) => `/api/connectors/meta/${ws}/disconnect`, disconnectMethod: 'POST',
    disconnectWarning: 'Raftra loses access to this ad account. Campaigns already created in Meta keep running.',
    manageTab: 'campaign', manageLabel: 'Campaign Manager',
    unconfiguredHint: 'Server is missing META_APP_ID / META_APP_SECRET.',
    returnParam: 'meta',
  },
  {
    id: 'google-ads', name: 'Google Ads', category: 'ad_accounts',
    description: 'Run and optimize high-intent ads across Search, YouTube, Maps, Gmail and Performance Max.',
    iconBg: 'rgba(66, 133, 244, 0.15)', iconColor: '#4285F4',
    icon: <span style={{ fontWeight: 900, fontSize: '16px', color: '#4285F4' }}>G</span>,
    batchKey: 'google_ads',
    read: (s) => base(s, {
      detail: s.email || s.customer_id || null,
      incomplete: s.connected && !s.customer_id ? 'Ads account not selected yet'
        : s.connected && s.is_manager_account ? 'Manager (MCC) account selected — pick a client ad account'
        : null,
    }),
    authorizePath: (ws) => `/api/connectors/google-ads/${ws}/authorize`,
    disconnectPath: (ws) => `/api/connectors/google-ads/${ws}`, disconnectMethod: 'DELETE',
    disconnectWarning: 'Revokes the grant with Google. Campaigns already created keep running.',
    manageTab: 'campaign', manageLabel: 'Campaign Manager',
    unconfiguredHint: 'Server is missing GOOGLE_ADS_CLIENT_ID / SECRET / DEVELOPER_TOKEN.',
    returnParam: 'gads',
  },
  {
    id: 'chatgpt_ads', name: 'ChatGPT Ads', category: 'ad_accounts', comingSoon: true,
    description: 'Run and optimize sponsored recommendations inside ChatGPT and OpenAI answer engines.',
    iconBg: 'rgba(16, 163, 127, 0.15)', iconColor: '#10A37F', icon: <Sparkles size={20} color="#10A37F" />,
    manageTab: 'integrations', manageLabel: 'Integrations',
  },
  {
    id: 'amazon_ads', name: 'Amazon Ads', category: 'ad_accounts', comingSoon: true,
    description: 'Run and optimize Sponsored Products and Sponsored Brands ads on Amazon India & Global.',
    iconBg: 'rgba(255, 153, 0, 0.15)', iconColor: '#FF9900',
    icon: <span style={{ fontWeight: 900, fontSize: '17px', color: '#FF9900' }}>a</span>,
    manageTab: 'integrations', manageLabel: 'Integrations',
  },

  // ── Analytics & Search ──
  {
    id: 'ga4', name: 'Google Analytics 4', category: 'analytics',
    description: 'Pull traffic, purchase events and conversion data into Growth Analytics and SEO reports.',
    iconBg: 'rgba(249, 171, 0, 0.15)', iconColor: '#F9AB00', icon: <BarChart3 size={20} color="#F9AB00" />,
    // No grant of its own: GA4 rides on the Search Console OAuth, and counts as connected only
    // once a property id is saved - the same gate the GA4 panel uses.
    batchKey: 'search_console',
    read: (s) => base(s, {
      detail: s.ga4_property_id ? `Property ${s.ga4_property_id}` : null,
      incomplete: s.connected && !s.ga4_property_id ? 'GA4 property id not set yet' : null,
    }),
    authorizePath: (ws) => `/api/connectors/search-console/${ws}/authorize`,
    manageTab: 'seo', manageLabel: 'SEO + GEO',
    unconfiguredHint: 'Server is missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.',
  },
  {
    id: 'search-console', name: 'Google Search Console', category: 'analytics',
    description: 'Monitor organic rankings, keyword impressions, CTR and indexing health inside Raftra.',
    iconBg: 'rgba(66, 133, 244, 0.15)', iconColor: '#4285F4', icon: <Search size={20} color="#4285F4" />,
    batchKey: 'search_console',
    read: (s) => base(s, {
      detail: s.site_url || s.email || null,
      incomplete: s.connected && !s.site_url ? 'Site not selected yet' : null,
    }),
    authorizePath: (ws) => `/api/connectors/search-console/${ws}/authorize`,
    disconnectPath: (ws) => `/api/connectors/search-console/${ws}/disconnect`, disconnectMethod: 'POST',
    disconnectWarning: 'Revokes the grant with Google. Google Analytics uses the same grant, so it disconnects too.',
    manageTab: 'seo', manageLabel: 'SEO + GEO',
    unconfiguredHint: 'Server is missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.',
    returnParam: 'gsc',
  },

  // ── Developer, Storage & CRM ──
  {
    id: 'github', name: 'GitHub', category: 'productivity_crm',
    description: 'Open pull requests with SEO and landing-page fixes on your site’s repository.',
    iconBg: 'rgba(255, 255, 255, 0.12)', iconColor: '#ffffff', icon: <GitBranch size={20} color="#ffffff" />,
    batchKey: 'github',
    read: (s) => base(s, {
      detail: s.repo_full_name || s.login || null,
      incomplete: s.connected && !s.repo_full_name ? 'Repository not selected yet' : null,
    }),
    authorizePath: (ws) => `/api/connectors/github/${ws}/authorize`,
    disconnectPath: (ws) => `/api/connectors/github/${ws}`, disconnectMethod: 'DELETE',
    disconnectWarning: 'Raftra can no longer read or open pull requests on your repository.',
    manageTab: 'seo', manageLabel: 'SEO + GEO',
    unconfiguredHint: 'Server is missing GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET.',
    returnParam: 'github',
  },
  {
    id: 'gdrive', name: 'Google Drive', category: 'productivity_crm',
    description: 'Import brand photos, product shots and creative guidelines from Drive into the Asset Vault.',
    iconBg: 'rgba(52, 168, 83, 0.15)', iconColor: '#34A853', icon: <HardDrive size={20} color="#34A853" />,
    batchKey: 'gdrive',
    read: (s) => base(s, { detail: s.email || s.folder_name || null }),
    authorizePath: (ws) => `/api/connectors/gdrive/${ws}/authorize`,
    disconnectPath: (ws) => `/api/connectors/gdrive/${ws}/disconnect`, disconnectMethod: 'POST',
    disconnectWarning: 'Assets you already imported stay in the vault — they are copies stored here, not links into Drive.',
    manageTab: 'kb_assets', manageLabel: 'Media Asset Vault',
    unconfiguredHint: 'Server is missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.',
  },
  {
    id: 'slack', name: 'Slack', category: 'productivity_crm', comingSoon: true,
    description: 'Campaign alerts, creative approval requests and weekly ROAS summaries in your Slack channels.',
    iconBg: 'rgba(224, 30, 90, 0.15)', iconColor: '#E01E5A', icon: <MessageSquare size={20} color="#E01E5A" />,
    manageTab: 'integrations', manageLabel: 'Integrations',
  },
  {
    id: 'hubspot', name: 'HubSpot', category: 'productivity_crm', comingSoon: true,
    description: 'Sync leads, contacts and deals for multi-touch attribution with your marketing automations.',
    iconBg: 'rgba(255, 122, 89, 0.15)', iconColor: '#FF7A59', icon: <Share2 size={20} color="#FF7A59" />,
    manageTab: 'integrations', manageLabel: 'Integrations',
  },
];

const CATEGORIES: { id: 'all' | Category; label: string; heading: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'All Integrations', heading: '', icon: null },
  { id: 'ecommerce_cms', label: 'E-Commerce & CMS', heading: 'E-Commerce & CMS Platforms', icon: <Store size={16} color="#00E676" /> },
  { id: 'ad_accounts', label: 'Ad Accounts', heading: 'Ad Accounts & Campaigns', icon: <Layers size={16} color="#7C75FF" /> },
  { id: 'analytics', label: 'Analytics & Search', heading: 'Analytics & Organic Search', icon: <BarChart3 size={16} color="#F9AB00" /> },
  { id: 'productivity_crm', label: 'Developer & CRM', heading: 'Developer, Storage & CRM', icon: <Code size={16} color="#00D2FF" /> },
];

type CardState = 'coming_soon' | 'checking' | 'unavailable' | 'not_configured'
  | 'disconnected' | 'error' | 'incomplete' | 'connected';

interface Props {
  workspaceId: number | null;
  /** All connectors' status, fetched once by the dashboard. Null while in flight. */
  status: Record<string, any> | null;
  statusFailed: boolean;
  onRefresh: () => void;
  onNavigateTab: (tab: string) => void;
}

const authHdrs = (): Record<string, string> => {
  const t = localStorage.getItem('token');
  return t ? { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }
           : { 'Content-Type': 'application/json' };
};

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 14px',
  background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: '10px', color: '#fff', fontSize: '13px', outline: 'none',
};

export const WorkspaceIntegrations: React.FC<Props> = ({ workspaceId, status, statusFailed, onRefresh, onNavigateTab }) => {
  const [filterCategory, setFilterCategory] = useState<'all' | Category>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [active, setActive] = useState<Integration | null>(null);
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [form, setForm] = useState({ shop: '', siteUrl: '', username: '', appPassword: '' });

  // Connectors send the browser back to /dashboard?meta=connected (or =error). Nothing read
  // those, so a finished Meta or GitHub sign-in landed on Home with no sign it had worked -
  // which is most of why integrations looked broken. Report it and clear the param.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    for (const i of INTEGRATIONS) {
      const v = i.returnParam && params.get(i.returnParam);
      if (!v) continue;
      setBanner(v === 'connected'
        ? { tone: 'ok', text: `${i.name} connected.` }
        : { tone: 'err', text: `${i.name} did not finish connecting. Please try again.` });
      params.delete(i.returnParam!);
      const rest = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''));
      if (v === 'connected') onRefresh();
      break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const views = useMemo(() => {
    const out: Record<string, View | 'error'> = {};
    if (!status) return out;
    for (const i of INTEGRATIONS) {
      if (!i.batchKey || !i.read) continue;
      const payload = status[i.batchKey];
      out[i.id] = payload ? i.read(payload) : 'error';
    }
    return out;
  }, [status]);

  const stateOf = (i: Integration): CardState => {
    if (i.comingSoon) return 'coming_soon';
    if (!status) return statusFailed ? 'unavailable' : 'checking';
    const v = views[i.id];
    if (!v || v === 'error') return 'unavailable';
    if (v.connected && v.incomplete) return 'incomplete';
    if (v.connected) return 'connected';
    if (v.error) return 'error';
    return v.configured ? 'disconnected' : 'not_configured';
  };

  const viewOf = (i: Integration): View | null => {
    const v = views[i.id];
    return v && v !== 'error' ? v : null;
  };

  const counts = useMemo(() => {
    const live = INTEGRATIONS.filter(i => !i.comingSoon);
    return {
      connected: live.filter(i => stateOf(i) === 'connected').length,
      attention: live.filter(i => ['incomplete', 'error'].includes(stateOf(i))).length,
      total: live.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [views, status, statusFailed]);

  const open = (i: Integration) => {
    if (i.comingSoon) return;
    setModalError(null);
    setForm({ shop: '', siteUrl: '', username: '', appPassword: '' });
    setActive(i);
  };

  const startOAuth = async (i: Integration, path: string, init?: RequestInit) => {
    setBusy(true); setModalError(null);
    try {
      const r = await fetch(path, { headers: authHdrs(), ...init });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.url) { window.location.href = d.url; return; }
      setModalError(d.detail || `Could not start the ${i.name} connection.`);
    } catch {
      setModalError('Could not reach the server. Please try again.');
    }
    setBusy(false);
  };

  const connect = async () => {
    if (!active || !workspaceId) return;
    const i = active;
    if (i.form === 'shopify') {
      if (!form.shop.trim()) { setModalError('Enter your store domain, e.g. my-store.myshopify.com.'); return; }
      return startOAuth(i, `/api/connectors/shopify/${workspaceId}/authorize`, {
        method: 'POST', body: JSON.stringify({ shop: form.shop.trim() }),
      });
    }
    if (i.form === 'wordpress') {
      if (!form.siteUrl.trim() || !form.username.trim() || !form.appPassword.trim()) {
        setModalError('Enter the site URL, username and application password.'); return;
      }
      setBusy(true); setModalError(null);
      try {
        const r = await fetch(`/api/connectors/wordpress/${workspaceId}/connect`, {
          method: 'POST', headers: authHdrs(),
          body: JSON.stringify({ site_url: form.siteUrl.trim(), username: form.username.trim(), app_password: form.appPassword.trim() }),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) { setModalError(d.detail || 'Could not connect to WordPress.'); return; }
        setBanner({ tone: 'ok', text: `WordPress connected to ${d.site_name || d.site_url}.` });
        setActive(null);
        onRefresh();
      } catch {
        setModalError('Could not reach the server. Please try again.');
      } finally {
        setBusy(false);
      }
      return;
    }
    if (i.authorizePath) return startOAuth(i, i.authorizePath(workspaceId));
  };

  const disconnect = async () => {
    const path = active?.disconnectPath;
    if (!active || !workspaceId || !path) return;
    const i = active;
    if (!window.confirm(`Disconnect ${i.name}?\n\n${i.disconnectWarning || ''}\n\nYou can reconnect at any time.`)) return;
    setBusy(true); setModalError(null);
    try {
      const r = await fetch(path(workspaceId), { method: i.disconnectMethod || 'POST', headers: authHdrs() });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setModalError(d.detail || `Could not disconnect ${i.name}.`); return; }
      setBanner({ tone: 'ok', text: `${i.name} disconnected.` });
      setActive(null);
      onRefresh();
    } catch {
      setModalError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const q = searchQuery.trim().toLowerCase();
  const filtered = INTEGRATIONS.filter(i =>
    (filterCategory === 'all' || i.category === filterCategory) &&
    (!q || i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)));

  if (!workspaceId) {
    return <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No workspace loaded yet.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: 'rgba(124, 117, 255, 0.12)', borderRadius: '100px', border: '1px solid rgba(124, 117, 255, 0.3)', marginBottom: '10px' }}>
            <Zap size={14} color="#7C75FF" />
            <span style={{ fontSize: '12px', color: '#7C75FF', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Integration & Connectors Hub
            </span>
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#fff', margin: '0 0 6px 0', fontFamily: 'var(--font-heading)' }}>
            Connected Channels & Storefronts
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
            {status
              ? `${counts.connected} of ${counts.total} connected${counts.attention ? ` · ${counts.attention} need attention` : ''}.`
              : statusFailed ? 'Connection status could not be loaded.' : 'Checking connection status…'}
            {' '}Connect your store, CMS, ad accounts and analytics to power your marketing workflows.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: '260px', maxWidth: '100%' }}>
            <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search integrations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ ...inputStyle, padding: '9px 12px 9px 36px', borderRadius: '100px' }}
            />
          </div>
          <button
            onClick={onRefresh}
            title="Re-check connection status"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: '100px', padding: '9px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {banner && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 16px', borderRadius: '12px', fontSize: '13px',
          background: banner.tone === 'ok' ? 'rgba(0,230,118,0.08)' : 'rgba(255,71,87,0.08)',
          border: `1px solid ${banner.tone === 'ok' ? 'rgba(0,230,118,0.3)' : 'rgba(255,71,87,0.35)'}`,
          color: banner.tone === 'ok' ? '#00E676' : '#ff6b7a',
        }}>
          {banner.tone === 'ok' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
          <span style={{ flex: 1 }}>{banner.text}</span>
          <button onClick={() => setBanner(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}><X size={14} /></button>
        </div>
      )}

      {/* ── CATEGORY FILTER TABS ───────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setFilterCategory(cat.id)}
            style={{
              background: filterCategory === cat.id ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255, 255, 255, 0.03)',
              border: '1px solid',
              borderColor: filterCategory === cat.id ? '#00E676' : 'rgba(255, 255, 255, 0.1)',
              color: filterCategory === cat.id ? '#00E676' : 'var(--text-secondary)',
              padding: '8px 18px', borderRadius: '100px', fontSize: '13px',
              fontWeight: filterCategory === cat.id ? 700 : 500, cursor: 'pointer', transition: 'all 0.2s ease',
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* ── GROUPED GRID ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>
        {CATEGORIES.filter(c => c.id !== 'all' && (filterCategory === 'all' || filterCategory === c.id)).map(cat => {
          const items = filtered.filter(i => i.category === cat.id);
          if (!items.length) return null;
          return (
            <div key={cat.id} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {cat.icon}
                <h3 style={{ fontSize: '17px', color: '#fff', margin: 0, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>{cat.heading}</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))', gap: '18px' }}>
                {items.map(renderCard)}
              </div>
            </div>
          );
        })}
        {!filtered.length && (
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No integrations match “{searchQuery}”.</p>
        )}
      </div>

      {/* ── CONNECT / MANAGE MODAL ─────────────────────────────────── */}
      <AnimatePresence>
        {active && renderModal(active)}
      </AnimatePresence>
    </div>
  );

  function renderCard(item: Integration) {
    const st = stateOf(item);
    const view = viewOf(item);
    const connected = st === 'connected';
    const locked = st === 'coming_soon';
    const attention = st === 'incomplete' || st === 'error';

    const buttonLabel = st === 'connected' ? 'Manage'
      : st === 'incomplete' ? 'Finish setup'
      : st === 'error' ? 'Reconnect'
      : st === 'checking' ? 'Checking…'
      : 'Connect';
    const buttonDisabled = st === 'checking' || st === 'unavailable' || st === 'not_configured';

    return (
      <div
        key={item.id}
        className="glow-card"
        style={{
          background: '#0a0a12',
          border: connected ? '1.5px solid rgba(0, 230, 118, 0.4)'
            : attention ? '1.5px solid rgba(255, 179, 0, 0.4)'
            : locked ? '1px dashed rgba(255, 255, 255, 0.12)'
            : '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '18px', padding: '22px', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', position: 'relative', opacity: locked ? 0.78 : 1,
          boxShadow: connected ? '0 4px 20px rgba(0, 230, 118, 0.12)' : 'none', transition: 'all 0.2s ease',
        }}
      >
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', gap: '10px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: item.iconBg, border: `1px solid ${item.iconColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {item.icon}
            </div>

            {locked ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(255, 179, 0, 0.12)', border: '1px solid rgba(255, 179, 0, 0.3)', color: '#FFB300', padding: '4px 10px', borderRadius: '100px', fontSize: '11.5px', fontWeight: 700 }}>
                <Lock size={12} color="#FFB300" />
                <span>Coming Soon</span>
              </div>
            ) : (
              <button
                onClick={() => open(item)}
                disabled={buttonDisabled}
                style={{
                  background: connected ? 'rgba(0, 230, 118, 0.15)'
                    : attention ? 'rgba(255, 179, 0, 0.12)'
                    : 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.04) 100%)',
                  border: connected ? '1px solid rgba(0, 230, 118, 0.4)'
                    : attention ? '1px solid rgba(255, 179, 0, 0.4)'
                    : '1px solid rgba(255, 255, 255, 0.15)',
                  color: connected ? '#00E676' : attention ? '#FFB300' : '#ffffff',
                  padding: '6px 16px', borderRadius: '100px', fontSize: '12px', fontWeight: 700,
                  cursor: buttonDisabled ? 'default' : 'pointer', opacity: buttonDisabled ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s ease', whiteSpace: 'nowrap',
                }}
              >
                {connected && <CheckCircle2 size={13} color="#00E676" />}
                {attention && <AlertTriangle size={13} color="#FFB300" />}
                <span>{buttonLabel}</span>
              </button>
            )}
          </div>

          <h4 style={{ fontSize: '17px', color: '#fff', margin: '0 0 6px 0', fontWeight: 800 }}>{item.name}</h4>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 14px 0', lineHeight: 1.45 }}>{item.description}</p>
        </div>

        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '12px', marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', fontSize: '11px', color: 'var(--text-muted)', minWidth: 0 }}>
          {locked ? (
            <span style={{ color: '#FFB300' }}>🔒 In development · not available yet</span>
          ) : st === 'connected' ? (
            <>
              <span style={{ color: '#00E676', whiteSpace: 'nowrap' }}>● Connected</span>
              <span title={view?.detail || ''} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{view?.detail}</span>
            </>
          ) : st === 'incomplete' ? (
            <span style={{ color: '#FFB300' }} title={view?.incomplete || ''}>● {view?.incomplete}</span>
          ) : st === 'error' ? (
            <span style={{ color: '#FFB300' }} title={view?.error || ''}>● {view?.error}</span>
          ) : st === 'not_configured' ? (
            <span>{item.unconfiguredHint || 'Not configured on the server.'}</span>
          ) : st === 'unavailable' ? (
            <span>Status unavailable — try refreshing.</span>
          ) : st === 'checking' ? (
            <span>Checking…</span>
          ) : (
            <>
              <span>Status: Not Connected</span>
              <span style={{ color: '#7C75FF', cursor: 'pointer' }} onClick={() => open(item)}>Setup ↗</span>
            </>
          )}
        </div>
      </div>
    );
  }

  function renderModal(item: Integration) {
    const st = stateOf(item);
    const view = viewOf(item);
    const isConnected = st === 'connected' || st === 'incomplete';
    const oauthNote = item.form === 'wordpress'
      ? 'Uses a WordPress Application Password (Users → Profile → Application Passwords), not your login password. Revoke it there at any time.'
      : 'You sign in on the provider’s own page. Raftra never sees your password, and you can revoke access at any time.';

    return (
      <div
        onClick={() => !busy && setActive(null)}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', padding: '20px' }}
      >
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          style={{ width: '100%', maxWidth: '520px', background: '#0a0a12', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '24px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.8)', maxHeight: '90vh', overflowY: 'auto' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: item.iconBg, border: `1px solid ${item.iconColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {item.icon}
              </div>
              <div>
                <span style={{ fontSize: '11px', color: isConnected ? '#00E676' : '#7C75FF', fontWeight: 800, textTransform: 'uppercase' }}>
                  {isConnected ? 'Manage integration' : 'Connect integration'}
                </span>
                <h3 style={{ fontSize: '20px', color: '#fff', margin: '2px 0 0 0', fontWeight: 800 }}>{item.name}</h3>
              </div>
            </div>
            <button onClick={() => setActive(null)} disabled={busy} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          </div>

          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{item.description}</p>

          {isConnected && view && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'rgba(255,255,255,0.02)', padding: '14px 16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)', fontSize: '13px' }}>
              <span style={{ color: '#00E676', fontWeight: 700 }}>● Connected{view.detail ? ` — ${view.detail}` : ''}</span>
              {view.incomplete && <span style={{ color: '#FFB300' }}>{view.incomplete}</span>}
            </div>
          )}

          {st === 'error' && view?.error && (
            <div style={{ padding: '12px 14px', borderRadius: '12px', background: 'rgba(255,179,0,0.08)', border: '1px solid rgba(255,179,0,0.3)', color: '#FFB300', fontSize: '12.5px' }}>
              {view.error}
            </div>
          )}

          {!isConnected && item.form === 'shopify' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Shopify store domain</label>
              <input style={inputStyle} placeholder="your-brand.myshopify.com" value={form.shop}
                     onChange={(e) => setForm({ ...form, shop: e.target.value })} />
            </div>
          )}

          {!isConnected && item.form === 'wordpress' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
              {([
                ['siteUrl', 'WordPress site URL', 'https://yourdomain.com', 'text'],
                ['username', 'WordPress username', 'admin', 'text'],
                ['appPassword', 'Application password', 'xxxx xxxx xxxx xxxx xxxx xxxx', 'password'],
              ] as const).map(([key, label, ph, type]) => (
                <div key={key}>
                  <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>{label}</label>
                  <input style={inputStyle} type={type} placeholder={ph} value={form[key]}
                         onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                </div>
              ))}
            </div>
          )}

          {!isConnected && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 14px', background: 'rgba(0, 230, 118, 0.08)', borderRadius: '10px', border: '1px solid rgba(0, 230, 118, 0.2)' }}>
              <ShieldCheck size={16} color="#00E676" style={{ flexShrink: 0, marginTop: '1px' }} />
              <span style={{ fontSize: '12px', color: '#00E676', fontWeight: 600, lineHeight: 1.45 }}>{oauthNote}</span>
            </div>
          )}

          {modalError && (
            <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.35)', color: '#ff6b7a', fontSize: '12.5px' }}>
              {modalError}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
            {isConnected && item.disconnectPath && (
              <button onClick={disconnect} disabled={busy}
                      style={{ marginRight: 'auto', background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.35)', color: '#ff4757', padding: '9px 18px', borderRadius: '100px', fontSize: '13px', fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                Disconnect
              </button>
            )}
            {isConnected ? (
              <GlowButton variant="glow" onClick={() => { setActive(null); onNavigateTab(item.manageTab); }} style={{ padding: '9px 24px', fontSize: '13px' }}>
                {view?.incomplete ? `Finish setup in ${item.manageLabel}` : `Open ${item.manageLabel}`}
              </GlowButton>
            ) : (
              <>
                <button onClick={() => setActive(null)} disabled={busy}
                        style={{ background: 'rgba(255, 255, 255, 0.08)', border: 'none', color: '#fff', padding: '9px 18px', borderRadius: '100px', fontSize: '13px', cursor: 'pointer' }}>
                  Cancel
                </button>
                <GlowButton variant="glow" onClick={connect} style={{ padding: '9px 24px', fontSize: '13px', opacity: busy ? 0.7 : 1 }}>
                  {busy ? (item.form === 'wordpress' ? 'Verifying…' : 'Opening…')
                    : item.form === 'wordpress' ? 'Connect WordPress'
                    : st === 'error' ? `Reconnect ${item.name}`
                    : `Continue to ${item.name}`}
                </GlowButton>
              </>
            )}
          </div>
        </motion.div>
      </div>
    );
  }
};
