import React, { useState, useRef, useEffect } from 'react';
import { Send, Search, BarChart3, TrendingUp, Globe, Users, Award, Zap, Activity, MessageSquare, UploadCloud, Database, CheckCircle } from 'lucide-react';
import { GlowButton } from '../GlowButton';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

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
    }).finally(() => { if (!cancelled) setDataLoading(false); });

    return () => { cancelled = true; };
  }, [workspaceId]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const growthData = [
    { name: 'Oct', MetaSpend: 3100, GoogleSpend: 2100, Revenue: 18000 },
    { name: 'Nov', MetaSpend: 3800, GoogleSpend: 2900, Revenue: 24000 },
    { name: 'Dec', MetaSpend: 4200, GoogleSpend: 3500, Revenue: 29000 },
    { name: 'Jan', MetaSpend: 4000, GoogleSpend: 2400, Revenue: 21000 },
    { name: 'Feb', MetaSpend: 3000, GoogleSpend: 1398, Revenue: 18000 },
    { name: 'Mar', MetaSpend: 2000, GoogleSpend: 9800, Revenue: 35000 },
    { name: 'Apr', MetaSpend: 2780, GoogleSpend: 3908, Revenue: 29000 },
    { name: 'May', MetaSpend: 1890, GoogleSpend: 4800, Revenue: 28000 },
    { name: 'Jun', MetaSpend: 2390, GoogleSpend: 3800, Revenue: 34000 },
  ];

  const seoGeoData = [
    { name: 'W1', Organic: 1200, AEMentions: 40 },
    { name: 'W2', Organic: 1300, AEMentions: 80 },
    { name: 'W3', Organic: 1100, AEMentions: 150 },
    { name: 'W4', Organic: 1700, AEMentions: 300 },
    { name: 'W5', Organic: 1900, AEMentions: 450 },
  ];

  const pieColors = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#7C75FF', '#00E676'];

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
              <XAxis dataKey="platform" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: '#0a0a0c', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', fontSize: '12px' }} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
              <Bar dataKey="ROAS" fill="var(--primary)" radius={[4, 4, 0, 0]} />
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
      return (
        <div style={{ height: '180px', width: '100%', marginTop: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} fill="#8884d8" paddingAngle={5} dataKey="value">
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#0a0a0c', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      );
    }
    if (type === 'line') {
      return (
        <div style={{ height: '180px', width: '100%', marginTop: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cpaData}>
              <XAxis dataKey="day" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} interval={0} angle={-12} textAnchor="end" height={40} />
              <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v) => [`$${v}`, 'CPA'] as [string, string]} contentStyle={{ background: '#0a0a0c', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', fontSize: '12px' }} />
              <Line type="monotone" dataKey="CPA" stroke="#ff7300" strokeWidth={2} />
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

      {/* 1. TOP SECTION: Claude MCP Query Engine */}
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

      {/* 2. MIDDLE SECTION: SEO & GEO Dashboard */}
      <div>
        <h3 style={{ fontSize: '18px', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', marginBottom: '16px' }}>
          <Globe size={20} color="var(--success)" /> SEO & GEO Performance
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="glow-card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Organic Traffic (30d)</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '12px' }}>
                42,890 <span style={{ fontSize: '12px', color: 'var(--success)', display: 'flex', alignItems: 'center' }}><TrendingUp size={12} style={{ marginRight: '4px' }} /> +12%</span>
              </div>
            </div>
            <div className="glow-card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>LLM Answer Engine Mentions</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '12px' }}>
                1,402 <span style={{ fontSize: '12px', color: 'var(--success)', display: 'flex', alignItems: 'center' }}><TrendingUp size={12} style={{ marginRight: '4px' }} /> +340%</span>
              </div>
            </div>
            <div className="glow-card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Citation Health Score</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff' }}>94/100</div>
            </div>
          </div>

          <div className="glow-card" style={{ padding: '24px' }}>
            <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', fontFamily: 'var(--font-mono)' }}>TRADITIONAL VS GENERATIVE SEARCH GROWTH</h4>
            <div style={{ width: '100%', height: '240px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={seoGeoData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: '#0a0a0c', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', fontSize: '12px' }} />
                  <Line type="monotone" dataKey="Organic" stroke="#8884d8" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="AEMentions" stroke="var(--success)" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '11px', marginTop: '16px', justifyContent: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8884d8' }} /> Organic Search Traffic
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }} /> Answer Engine Mentions (GEO)
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: '1px', background: 'var(--border)', margin: '10px 0' }} />

      {/* 3. BOTTOM SECTION: Upgraded Growth Analysis & Intelligence Engine */}
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
