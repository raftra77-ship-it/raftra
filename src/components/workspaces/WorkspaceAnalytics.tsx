import React, { useState, useRef, useEffect } from 'react';
import { Send, Search, BarChart3, Globe, Users, Award, Zap, Activity, MessageSquare, UploadCloud, Database, CheckCircle } from 'lucide-react';
import { GlowButton } from '../GlowButton';
// PieChart/Pie/Cell are gone with the donut — the budget split is a ranked horizontal bar
// now, built from plain divs, because it is a magnitude comparison (see the 'pie' branch).
// AreaChart/Area were never used on this screen.
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

import { GrowthAnalysisSection } from './GrowthAnalysisSection';
import { Markdown } from '../Markdown';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'claude';
  text: string;
  isVisual?: boolean;
  visualType?: 'bar' | 'table' | 'pie' | 'line' | 'heatmap' | null;
  /** Placeholder shown while the agent is still answering. */
  pending?: boolean;
}

interface WorkspaceAnalyticsProps {
  chatHistory: ChatMessage[];
  onSendMessage: (msg: string) => void;
  onNavigateTab?: (tab: string) => void;
  workspaceId?: number | null;
}

interface CampaignRow {
  id: number;
  platform: string;
  name: string;
  budget: number;
  status: string;
  roas: number;
}

/** One row of Meta's per-campaign insights, which is where real spend and CPA come from. */
interface MetaInsightRow {
  campaign_id?: string;
  campaign_name?: string;
  spend?: number;
  purchases?: number;
  roas?: number;
  clicks?: number;
}

/** Search Console overview for the connected property (see backend core/search_console.py). */
interface GscOverview {
  site_url?: string;
  range_days?: number;
  totals?: { clicks?: number; impressions?: number; ctr?: number; position?: number };
  /** One row per day, oldest first — `key` is the ISO date. */
  timeseries?: { key: string; clicks: number; impressions: number }[];
}

/** Combined SEO + GEO audit read model from /seo/audit-report.
 *  The scores are NOT top-level fields. The endpoint returns each pipeline's latest audit
 *  row, and the score sits inside it at `geo.audit.geo.score_100` (and the SEO equivalent).
 *  An earlier version of this interface declared `geo_score`/`seo_score` — keys the
 *  endpoint never sends — so the GEO tile read undefined and told every workspace that no
 *  GEO audit had been run, including ones that had one. */
interface AuditRow {
  created_at?: string | null;
  audit?: { geo?: { score_100?: number }; seo?: { score_100?: number } } | null;
}
interface AuditReport {
  has_audit?: boolean;
  generated_at?: string | null;
  overall_health?: number | null;
  seo?: AuditRow | null;
  geo?: AuditRow | null;
}

export const WorkspaceAnalytics: React.FC<WorkspaceAnalyticsProps> = ({
  chatHistory,
  onSendMessage,
  onNavigateTab,
  workspaceId = null,
}) => {
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Everything the query engine renders is read from this workspace. The four charts used
     to be module-level constants — a 2.4/3.1/1.8/4.2 ROAS bar, a $4,200 "Retargeting BOF"
     waster, a 400/300/300/200 pie and a Mon-Sun CPA line — so every workspace saw the same
     invented numbers no matter what it actually ran. */
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [metaInsights, setMetaInsights] = useState<MetaInsightRow[]>([]);
  const [sources, setSources] = useState({ meta: false, googleAds: false, gsc: false, ga4: false });
  const [dataLoading, setDataLoading] = useState(true);
  /* The SEO & GEO block below used to report a flat 42,890 organic sessions, 1,402 answer
     engine mentions and a 94/100 citation score for every workspace, with a five-week
     curve to match — none of it measured. Organic numbers now come from this workspace's
     Search Console property and the GEO score from its own latest GEO audit; when neither
     has been set up the tiles say so instead of showing a number. */
  const [gscOverview, setGscOverview] = useState<GscOverview | null>(null);
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null);

  useEffect(() => {
    if (!workspaceId) { setDataLoading(false); return; }
    let cancelled = false;
    setDataLoading(true);
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    const get = (u: string) => fetch(u, { headers }).then(r => (r.ok ? r.json() : null)).catch(() => null);

    Promise.all([
      get(`/api/workspaces/${workspaceId}/campaigns`),
      get(`/api/connectors/meta/${workspaceId}/status`),
      get(`/api/connectors/google-ads/${workspaceId}/status`),
      get(`/api/connectors/search-console/${workspaceId}/status`),
    ]).then(async ([camps, meta, gads, gsc]) => {
      if (cancelled) return;
      setCampaigns(Array.isArray(camps) ? camps : []);
      setSources({
        meta: Boolean(meta?.connected),
        googleAds: Boolean(gads?.connected),
        gsc: Boolean(gsc?.connected),
        // GA4 rides on the same Google connection; it counts as live only once a property
        // has actually been picked.
        ga4: Boolean(gsc?.connected && gsc?.ga4_property_id),
      });
      // Real spend and CPA only exist once Meta is linked — skip the call otherwise.
      if (meta?.connected) {
        const ins = await get(`/api/connectors/meta/${workspaceId}/insights?date_preset=last_7d`);
        if (!cancelled && ins?.insights) setMetaInsights(Object.values(ins.insights) as MetaInsightRow[]);
      }
      // Organic figures need both a Google grant and a chosen property; the endpoint 400s
      // without them, so only ask once the status row says both are in place.
      if (gsc?.connected && gsc?.site_url) {
        const ov = await get(`/api/connectors/search-console/${workspaceId}/overview?days=28`);
        if (!cancelled && ov) setGscOverview(ov as GscOverview);
      }
      // The GEO score is independent of any connector — it comes from this workspace's
      // own audit history, so it is worth asking for even with nothing linked.
      const rep = await get(`/api/workspaces/${workspaceId}/seo/audit-report`);
      if (!cancelled && rep) setAuditReport(rep as AuditReport);
    }).finally(() => { if (!cancelled) setDataLoading(false); });

    return () => { cancelled = true; };
  }, [workspaceId]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  /* Daily organic clicks and impressions for this workspace's Search Console property.
     Empty until the property is connected — the chart renders an explanatory panel in
     that case rather than a drawn curve. There is deliberately no second "answer engine
     mentions" series: nothing in the product measures that per day, and the old one was
     invented. */
  const seoGeoData = React.useMemo(
    () => (gscOverview?.timeseries || []).map(d => ({
      name: new Date(d.key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      Organic: d.clicks,
      Impressions: d.impressions,
    })),
    [gscOverview]
  );

  const gscTotals = gscOverview?.totals;
  const organicConnected = Boolean(gscOverview);
  // See the AuditReport interface: the score is nested in the latest GEO audit row.
  const geoScoreRaw = auditReport?.geo?.audit?.geo?.score_100;
  const geoScore = typeof geoScoreRaw === 'number' ? Math.round(geoScoreRaw) : null;

/* Categorical series colours, assigned in this fixed order and never cycled.
   What this replaces was `['#8884d8','#82ca9d','#ffc658','#ff8042','#7C75FF','#00E676']` —
   recharts' stock demo colours with two brand tokens appended, indexed with `% length`, so
   a seventh platform silently reused slot 1 and the same platform changed colour whenever a
   filter changed the row count. Two of those entries were also the reserved status colours
   (--success #00ff9d, and #ffc658 next to --warning), which have to stay reserved for
   good/warning/critical or a green bar reads as "healthy" rather than "Google".

   These five are the dataviz reference theme's dark slots, re-validated against THIS app's
   card surface (#121217) rather than assumed:
     Lightness band  PASS   all 5 within OKLCH L 0.48-0.67
     Chroma floor    PASS   all 5 >= 0.1
     CVD separation  PASS   worst adjacent pair dE 8.4 (protan), 8.7 (tritan)
     Normal vision   PASS   worst adjacent pair dE 19.3
     Contrast        PASS   all 5 >= 3:1 against the surface
   Re-run before changing any of them:
     node scripts/validate_palette.js "<hexes>" --mode dark --surface "#121217" */
  const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'];
  // Recessive chart furniture — grid and axes must not compete with the marks.
  const AXIS = '#52525b';
  const GRID = 'rgba(255,255,255,0.06)';
  const TOOLTIP_STYLE = {
    background: '#0a0a0c', border: '1px solid var(--border-color)',
    borderRadius: '8px', color: '#fff', fontSize: '12px',
  } as const;

  // Drafts have never spent anything, so they are excluded from every money figure below.
  const liveCampaigns = React.useMemo(
    () => campaigns.filter(c => (c.status || '').toUpperCase() !== 'DRAFT'),
    [campaigns]
  );

  /** Mean ROAS per platform, across this workspace's non-draft campaigns. */
  const roasBarData = React.useMemo(() => {
    const byPlatform = new Map<string, number[]>();
    liveCampaigns.forEach(c => {
      const key = c.platform || 'Unspecified';
      byPlatform.set(key, [...(byPlatform.get(key) || []), Number(c.roas) || 0]);
    });
    return [...byPlatform.entries()]
      .map(([platform, vals]) => ({
        platform,
        ROAS: Number((vals.reduce((t, v) => t + v, 0) / vals.length).toFixed(2)),
      }))
      // A stored ROAS of 0 means nobody has measured it, not that the platform returned
      // nothing. Plotting it plants a flat bar on an invented 0-4 axis that reads like a
      // real finding, so a platform with no measurement is dropped and the empty state
      // explains why instead.
      .filter(p => p.ROAS > 0)
      .sort((a, b) => b.ROAS - a.ROAS);
  }, [liveCampaigns]);

  /** Budget split by platform. Meta's real spend replaces the entered budget where we have it. */
  const pieData = React.useMemo(() => {
    const spentByCampaign = new Map<string, number>();
    metaInsights.forEach(r => { if (r.campaign_name) spentByCampaign.set(r.campaign_name, Number(r.spend) || 0); });
    const byPlatform = new Map<string, number>();
    liveCampaigns.forEach(c => {
      const key = c.platform || 'Unspecified';
      const amount = spentByCampaign.get(c.name) ?? (Number(c.budget) || 0);
      byPlatform.set(key, (byPlatform.get(key) || 0) + amount);
    });
    return [...byPlatform.entries()]
      .filter(([, value]) => value > 0)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [liveCampaigns, metaInsights]);

  /** Worst return for the money: real spend where Meta reports it, budget otherwise. */
  const wasterRows = React.useMemo(() => {
    const spentByCampaign = new Map<string, number>();
    metaInsights.forEach(r => { if (r.campaign_name) spentByCampaign.set(r.campaign_name, Number(r.spend) || 0); });
    return liveCampaigns
      .map(c => ({
        name: c.name || `Campaign #${c.id}`,
        spend: spentByCampaign.get(c.name) ?? (Number(c.budget) || 0),
        roas: Number(c.roas) || 0,
        measured: spentByCampaign.has(c.name),
      }))
      .filter(r => r.spend > 0)
      .sort((a, b) => a.roas - b.roas)
      .slice(0, 5);
  }, [liveCampaigns, metaInsights]);

  /** Cost per purchase per campaign, straight from Meta's spend and purchase counts.
   *  Nothing stores a per-day history, so this is by campaign rather than over time —
   *  inventing a Mon-Sun curve is what the previous version did. */
  const cpaData = React.useMemo(
    () => metaInsights
      .filter(r => (Number(r.purchases) || 0) > 0 && (Number(r.spend) || 0) > 0)
      .map(r => ({
        day: (r.campaign_name || 'Campaign').slice(0, 18),
        CPA: Number(((Number(r.spend) || 0) / (Number(r.purchases) || 1)).toFixed(2)),
      }))
      .sort((a, b) => b.CPA - a.CPA)
      .slice(0, 8),
    [metaInsights]
  );

  /* The headline numbers, computed from the same rows the charts below use.
     These are stat tiles rather than a chart on purpose: "what is my ROAS" is a single
     magnitude, and the honest form for one number is the number. Previously the page opened
     with a chat box and a reader had to scroll past three sections to reach any figure at
     all — on an analytics page the summary belongs first.
     Spend prefers Meta's reported spend and falls back to the entered budget, matching how
     pieData and wasterRows already resolve it, so the tiles cannot disagree with the charts. */
  const kpis = React.useMemo(() => {
    const spentByCampaign = new Map<string, number>();
    metaInsights.forEach(r => { if (r.campaign_name) spentByCampaign.set(r.campaign_name, Number(r.spend) || 0); });

    let spend = 0, revenue = 0, purchases = 0, measured = 0;
    liveCampaigns.forEach(c => {
      const s = spentByCampaign.get(c.name) ?? (Number(c.budget) || 0);
      spend += s;
      const roas = Number(c.roas) || 0;
      if (roas > 0) { revenue += roas * s; measured += 1; }
    });
    metaInsights.forEach(r => { purchases += Number(r.purchases) || 0; });

    const inr = (v: number) =>
      `₹${Math.round(v).toLocaleString('en-IN')}`;
    return [
      { key: 'spend', label: 'Ad Spend', value: spend > 0 ? inr(spend) : '—',
        note: spend > 0 ? `${liveCampaigns.length} live campaign${liveCampaigns.length === 1 ? '' : 's'}` : 'no live campaigns' },
      { key: 'revenue', label: 'Attributed Revenue', value: revenue > 0 ? inr(revenue) : '—',
        note: measured ? `from ${measured} measured campaign${measured === 1 ? '' : 's'}` : 'no ROAS measured yet' },
      { key: 'roas', label: 'Blended ROAS', value: spend > 0 && revenue > 0 ? `${(revenue / spend).toFixed(2)}×` : '—',
        note: spend > 0 && revenue > 0 ? 'revenue ÷ spend' : 'needs spend and ROAS' },
      { key: 'purchases', label: 'Purchases', value: purchases > 0 ? purchases.toLocaleString('en-IN') : '—',
        note: purchases > 0 ? 'reported by Meta' : 'connect Meta to report' },
      { key: 'cac', label: 'Cost per Purchase', value: purchases > 0 && spend > 0 ? inr(spend / purchases) : '—',
        note: purchases > 0 && spend > 0 ? 'spend ÷ purchases' : 'needs purchases' },
    ];
  }, [liveCampaigns, metaInsights]);

  /** Shown in place of a chart when a workspace has nothing to plot yet. */
  const EmptyVisual: React.FC<{ title: string; hint: string; cta?: string; tab?: string }> = ({ title, hint, cta, tab }) => (
    <div style={{ marginTop: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '20px', textAlign: 'center' }}>
      <p style={{ fontSize: '13px', color: '#fff', margin: '0 0 4px 0', fontWeight: 600 }}>{title}</p>
      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{hint}</p>
      {cta && tab && (
        <button
          onClick={() => onNavigateTab?.(tab)}
          style={{ marginTop: '10px', background: 'none', border: 'none', color: 'var(--primary)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
        >
          {cta} →
        </button>
      )}
    </div>
  );

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendMessage(chatInput);
    setChatInput('');
  };

  const handlePresetQuestion = (question: string) => {
    onSendMessage(question);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      onSendMessage(`Process uploaded ${file.name} and generate a demographic heatmap.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const renderVisualResponse = (type: string) => {
    if (dataLoading) {
      return <EmptyVisual title="Reading this workspace…" hint="Pulling campaigns and connected ad accounts." />;
    }
    if (type === 'bar' && !roasBarData.length) {
      return <EmptyVisual
        title="No measured ROAS yet"
        hint={liveCampaigns.length
          ? `All ${liveCampaigns.length} campaigns here still report a ROAS of 0 — return is only known once the ad account reports delivery. ${sources.meta ? 'Meta is linked but has no delivery in the last 7 days.' : 'Connect an ad account to populate it.'}`
          : 'ROAS is averaged per platform across launched campaigns. This workspace has none that have left draft.'}
        cta={sources.meta ? 'Open Campaign Manager' : 'Connect an ad account'}
        tab={sources.meta ? 'campaign' : 'integrations'} />;
    }
    if (type === 'pie' && !pieData.length) {
      return <EmptyVisual title="No budget allocated yet" hint="This splits real spend by platform, falling back to the budget you entered. Nothing here has either." cta="Open Campaign Manager" tab="campaign" />;
    }
    if (type === 'table' && !wasterRows.length) {
      return <EmptyVisual title="Nothing spending yet" hint="Campaigns are ranked by the return they earn on what they spend. None here have a budget or recorded spend." cta="Open Campaign Manager" tab="campaign" />;
    }
    if (type === 'line' && !cpaData.length) {
      return <EmptyVisual title="Cost per acquisition needs Meta" hint={sources.meta ? 'Meta is linked, but no campaign has recorded a purchase in the last 7 days, so there is no cost per acquisition to divide out.' : 'CPA is spend divided by purchases, both read from your ad account. Connect Meta to see it.'} cta={sources.meta ? undefined : 'Connect an ad account'} tab={sources.meta ? undefined : 'integrations'} />;
    }
    if (type === 'bar') {
      return (
        <div style={{ height: '180px', width: '100%', marginTop: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={roasBarData}>
              <XAxis dataKey="platform" stroke={AXIS} fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke={AXIS} fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: '#0a0a0c', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', fontSize: '12px' }} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
              <Bar dataKey="ROAS" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={38} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }
    if (type === 'table') {
      return (
        <div style={{ marginTop: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px', fontSize: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', borderBottom: '1px solid var(--border)', paddingBottom: '8px', color: 'var(--text-secondary)' }}>
            <span>Campaign</span>
            <span>Spend</span>
            <span>ROAS</span>
          </div>
          {wasterRows.map((row, i) => {
            // Worst performer first, so the top row is the one worth acting on.
            const poor = row.roas < 1;
            return (
              <div key={row.name + i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '8px 0', borderBottom: i < wasterRows.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '8px' }} title={row.name}>{row.name}</span>
                <span style={{ color: poor ? 'var(--warning)' : '#fff' }}>
                  ${row.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
                <span style={{ color: poor ? 'var(--warning)' : 'var(--success)' }}>{row.roas.toFixed(2)}x</span>
              </div>
            );
          })}
          <p style={{ fontSize: '10.5px', color: 'var(--text-muted)', margin: '10px 0 0 0', lineHeight: 1.4 }}>
            {wasterRows.some(r => r.measured)
              ? 'Spend is what Meta reports for the last 7 days; the rest is the budget you entered.'
              : 'Spend shown is the budget entered on each campaign — connect an ad account for measured spend.'}
          </p>
        </div>
      );
    }
    if (type === 'pie') {
      /* A ranked horizontal bar, not the donut this used to be. The question is "which
         platform takes most of the budget, and by how much" — a magnitude comparison, which
         people read accurately from a common baseline and poorly from arc angles. Sorted
         descending, one bar per platform, value labelled directly so no legend or colour
         lookup is needed. Kept under the 'pie' key so the chat's visualType contract and
         every caller stay unchanged. */
      const total = pieData.reduce((t, d) => t + d.value, 0) || 1;
      return (
        <div style={{ width: '100%', marginTop: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '14px 16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pieData.map((d, i) => (
              <div key={d.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: '4px' }}>
                  <span style={{ color: '#fff', fontWeight: 600 }}>{d.name}</span>
                  <span style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                    ₹{d.value.toLocaleString('en-IN')} · {Math.round((d.value / total) * 100)}%
                  </span>
                </div>
                {/* 8px track, 4px rounded data-end, anchored to a common left baseline. */}
                <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.max(2, (d.value / total) * 100)}%`, height: '100%',
                    background: SERIES[i % SERIES.length], borderRadius: '4px',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    if (type === 'line') {
      return (
        <div style={{ height: '180px', width: '100%', marginTop: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cpaData}>
              <XAxis dataKey="day" stroke={AXIS} fontSize={10} tickLine={false} axisLine={false} interval={0} angle={-12} textAnchor="end" height={40} />
              <YAxis stroke={AXIS} fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v) => [`$${v}`, 'CPA'] as [string, string]} contentStyle={{ background: '#0a0a0c', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', fontSize: '12px' }} />
              <Line type="monotone" dataKey="CPA" stroke={SERIES[1]} strokeWidth={2} dot={{ r: 4, strokeWidth: 0, fill: SERIES[1] }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }
    if (type === 'heatmap') {
      return (
        <div style={{ marginTop: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '16px' }}>
          <h4 style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Demographic Engagement Heatmap (Age vs Time)</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
            {['18-24', '25-34', '35-44', '45-54', '55+'].map(age => <div key={age} style={{ fontSize: '10px', textAlign: 'center', color: 'var(--text-secondary)' }}>{age}</div>)}
            {[0.2, 0.4, 0.8, 0.9, 0.5, 0.1, 0.3, 0.7, 1.0, 0.4, 0.6, 0.9, 0.5, 0.2, 0.1].map((val, i) => (
              <div key={i} style={{ height: '24px', backgroundColor: `rgba(0, 230, 118, ${val})`, borderRadius: '4px' }} title={`Intensity: ${val}`} />
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', paddingBottom: '40px' }}>
      <style>{`@keyframes analyst-blink { 0%, 80%, 100% { opacity: 0.25; } 40% { opacity: 1; } }`}</style>

      {/* 1. HEADLINE NUMBERS.
          The page's summary, first — see the `kpis` memo for why these are tiles and not a
          chart. Every tile shows an em dash and says what is missing rather than a zero: a
          "₹0" and a "0.00x" are indistinguishable from a measured result of zero, and this
          screen used to report exactly that for workspaces with nothing connected. */}
      <div>
        <h2 style={{ fontSize: '20px', fontFamily: 'var(--font-heading)', color: '#fff', margin: '0 0 4px 0' }}>
          Performance Summary
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 16px 0' }}>
          Across this workspace's live campaigns. Drafts are excluded — they have never spent.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: '14px' }}>
          {kpis.map(k => (
            <div key={k.key} className="glow-card" style={{ padding: '18px 20px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {k.label}
              </div>
              <div style={{
                fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 700, color: '#fff',
                margin: '8px 0 4px', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1,
              }}>
                {k.value}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.4 }}>{k.note}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />

      {/* 2. Claude MCP Query Engine */}
      <div>
        <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-heading)', marginBottom: '8px', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <MessageSquare size={24} color="var(--primary)" /> Claude MCP Intelligence Engine
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
          Query your Meta and Google databases in natural language. Claude will generate visual insights dynamically.
        </p>

        <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', background: 'rgba(90, 82, 255, 0.03)', borderColor: 'rgba(90, 82, 255, 0.2)', overflow: 'hidden' }}>
          
          {/* Connection Indicators */}
          <div style={{ padding: '12px 20px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(90, 82, 255, 0.1)', display: 'flex', gap: '16px', alignItems: 'center', overflowX: 'auto' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Database size={12} /> Connected Sources:
            </span>
            {/* Each badge is the connector's real state. All four used to be printed as
                connected, so the engine claimed four live data sources on a workspace with
                none linked. A disconnected one is now a button through to Integrations. */}
            {([
              { key: 'meta', label: 'Meta Insights API', on: sources.meta },
              { key: 'googleAds', label: 'Google Ads API', on: sources.googleAds },
              { key: 'ga4', label: 'GA4 Analytics', on: sources.ga4 },
              { key: 'gsc', label: 'Search Console (SEO)', on: sources.gsc },
            ] as { key: string; label: string; on: boolean }[]).map(src => (
              <button
                key={src.key}
                onClick={() => !src.on && onNavigateTab?.('integrations')}
                title={src.on ? `${src.label} is connected` : `${src.label} is not connected — open Integrations`}
                style={{
                  fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px',
                  whiteSpace: 'nowrap', padding: '4px 8px', borderRadius: '12px',
                  fontFamily: 'inherit', border: '1px solid',
                  background: src.on ? 'rgba(255,255,255,0.05)' : 'transparent',
                  borderColor: src.on ? 'transparent' : 'rgba(255,255,255,0.12)',
                  color: src.on ? '#fff' : 'var(--text-muted)',
                  cursor: src.on ? 'default' : 'pointer',
                }}
              >
                {src.on
                  ? <CheckCircle size={10} color="var(--success)" />
                  : <span style={{ width: 8, height: 8, borderRadius: '50%', border: '1px solid var(--text-muted)', display: 'inline-block' }} />}
                {src.label}
              </button>
            ))}
          </div>

          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '350px', overflowY: 'auto' }}>
            {chatHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                <Search size={32} style={{ opacity: 0.2, margin: '0 auto 12px' }} />
                <p>Ask a question about your campaign performance...</p>
              </div>
            ) : (
              chatHistory.map((msg) => (
                <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%' }}>
                  <div
                    style={{
                      background: msg.sender === 'user' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(90, 82, 255, 0.1)',
                      border: '1px solid',
                      borderColor: msg.sender === 'user' ? 'var(--border)' : 'rgba(90, 82, 255, 0.3)',
                      padding: '16px 18px',
                      borderRadius: '12px',
                      fontSize: '14px',
                      lineHeight: '1.65',
                      color: '#fff'
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '10.5px', letterSpacing: '0.06em', color: msg.sender === 'user' ? 'var(--text-secondary)' : 'var(--primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {msg.sender === 'user' ? 'YOU' : <><Zap size={12} /> CLAUDE DATA ANALYST</>}
                    </div>
                    {/* The agent replies in markdown. This was rendered as one raw string, so
                        every reply showed its own "* **Meta Ads:**" syntax on a single
                        collapsed line — newlines mean nothing to HTML. */}
                    {msg.pending ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13.5px' }}>
                        <span style={{ display: 'inline-flex', gap: '3px' }}>
                          {[0, 1, 2].map(i => (
                            <span key={i} style={{
                              width: 5, height: 5, borderRadius: '50%', background: 'var(--primary)',
                              animation: `analyst-blink 1.1s ${i * 0.18}s infinite ease-in-out`,
                            }} />
                          ))}
                        </span>
                        Reading your connected accounts…
                      </div>
                    ) : msg.sender === 'user'
                      ? <div>{msg.text}</div>
                      : <Markdown text={msg.text} style={{ fontSize: '13.5px' }} />}
                    {msg.isVisual && renderVisualResponse(msg.visualType || 'bar')}
                  </div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          <div style={{ padding: '16px', borderTop: '1px solid rgba(90, 82, 255, 0.2)', background: 'rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
              <button onClick={() => handlePresetQuestion('Show me ROAS comparison by platform.')} style={{ whiteSpace: 'nowrap', fontSize: '11px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '6px 12px', borderRadius: '20px', cursor: 'pointer' }}>
                Show ROAS by Platform (Bar)
              </button>
              <button onClick={() => handlePresetQuestion('Which campaign is wasting budget with high CPA?')} style={{ whiteSpace: 'nowrap', fontSize: '11px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '6px 12px', borderRadius: '20px', cursor: 'pointer' }}>
                Identify Budget Wasters (Table)
              </button>
              <button onClick={() => handlePresetQuestion('Show budget allocation pie chart')} style={{ whiteSpace: 'nowrap', fontSize: '11px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '6px 12px', borderRadius: '20px', cursor: 'pointer' }}>
                Budget Allocation (Pie)
              </button>
              <button onClick={() => handlePresetQuestion('Show CPA by campaign as a line chart')} style={{ whiteSpace: 'nowrap', fontSize: '11px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '6px 12px', borderRadius: '20px', cursor: 'pointer' }}>
                CPA by Campaign (Line)
              </button>
            </div>
            <form onSubmit={handleSend} style={{ display: 'flex', gap: '12px' }}>
              <input
                type="text"
                placeholder="Ask Claude anything about your connected ad accounts..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                style={{ flex: 1, padding: '14px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '8px', color: '#fff', outline: 'none' }}
              />
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                accept=".csv,.json,.xlsx"
                onChange={handleFileUpload}
              />
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-secondary)', cursor: 'pointer' }}
                title="Upload JSON/CSV for visualized analysis"
              >
                <UploadCloud size={18} />
              </button>
              <GlowButton variant="glow" type="submit" style={{ padding: '0 24px' }}>
                <Send size={18} />
              </GlowButton>
            </form>
          </div>
        </div>
      </div>

      <div style={{ height: '1px', background: 'var(--border)', margin: '10px 0' }} />

      {/* 3. SEO & GEO PERFORMANCE */}
      <div>
        <h3 style={{ fontSize: '18px', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', marginBottom: '16px' }}>
          <Globe size={20} color="var(--success)" /> SEO & GEO Performance
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="glow-card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Organic Clicks ({gscOverview?.range_days ?? 28}d)
              </div>
              {organicConnected ? (
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff' }}>
                  {(gscTotals?.clicks ?? 0).toLocaleString()}
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, marginLeft: '10px' }}>
                    {(gscTotals?.impressions ?? 0).toLocaleString()} impressions
                  </span>
                </div>
              ) : (
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Connect Search Console and pick a property to report organic traffic.
                </div>
              )}
            </div>
            <div className="glow-card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Average Search Position</div>
              {organicConnected ? (
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff' }}>
                  {gscTotals?.position ? gscTotals.position.toFixed(1) : '—'}
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, marginLeft: '10px' }}>
                    {(gscTotals?.ctr ?? 0).toFixed(1)}% CTR
                  </span>
                </div>
              ) : (
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Available once Search Console is linked.
                </div>
              )}
            </div>
            <div className="glow-card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>GEO Score (latest audit)</div>
              {geoScore != null ? (
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff' }}>{geoScore}/100</div>
              ) : (
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  No GEO audit has been run for this workspace yet.
                </div>
              )}
            </div>
          </div>

          <div className="glow-card" style={{ padding: '24px' }}>
            <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', fontFamily: 'var(--font-mono)' }}>
              ORGANIC SEARCH PERFORMANCE{gscOverview?.site_url ? ` · ${gscOverview.site_url}` : ''}
            </h4>
            {seoGeoData.length > 0 ? (
              <>
                <div style={{ width: '100%', height: '240px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={seoGeoData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" stroke={AXIS} fontSize={10} tickLine={false} axisLine={false} minTickGap={24} />
                      <YAxis stroke={AXIS} fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: '#0a0a0c', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', fontSize: '12px' }} />
                      <Line type="monotone" dataKey="Organic" stroke={SERIES[0]} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="Impressions" stroke={SERIES[2]} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', gap: '16px', fontSize: '11px', marginTop: '16px', justifyContent: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: SERIES[0] }} /> Clicks
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: SERIES[2] }} /> Impressions
                  </span>
                </div>
              </>
            ) : (
              <div style={{ height: '240px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', textAlign: 'center' }}>
                <Globe size={26} style={{ opacity: 0.25 }} />
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '340px', lineHeight: 1.6 }}>
                  {organicConnected
                    ? 'Search Console is connected but has not reported any impressions for this property in the last 28 days.'
                    : 'Connect Google Search Console under Integrations and select a property to chart this site’s organic clicks and impressions.'}
                </div>
                {!organicConnected && onNavigateTab && (
                  <button onClick={() => onNavigateTab('settings')} className="btn btn-primary" style={{ fontSize: '12px', padding: '8px 16px' }}>
                    Open Integrations
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ height: '1px', background: 'var(--border)', margin: '10px 0' }} />

      {/* 4. GROWTH ANALYSIS & INTELLIGENCE ENGINE */}
      {/* workspaceId was never passed, so the section fell back to `workspaceId = null`:
          its growth fetch never ran, its demo toggle defaulted ON, and every connector
          indicator and KPI rendered from the built-in sample set. It also gets the same
          connector states this screen already resolved, so the two agree while the growth
          payload loads. */}
      <GrowthAnalysisSection
        onNavigateTab={onNavigateTab}
        onSendMessage={onSendMessage}
        workspaceId={workspaceId}
        connectedSources={{
          meta: sources.meta,
          google: sources.googleAds,
          ga4: sources.ga4,
          gsc: sources.gsc,
        }}
      />

    </div>
  );
};
