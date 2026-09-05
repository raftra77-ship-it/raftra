import React, { useState, useRef, useEffect } from 'react';
import { Send, Search, BarChart3, Globe, Users, Award, Zap, MessageSquare, UploadCloud, Database, CheckCircle } from 'lucide-react';
import { GlowButton } from '../GlowButton';
import { PreviewNote, NotConnected } from './PreviewMark';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { GrowthAnalysisSection } from './GrowthAnalysisSection';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'claude';
  text: string;
  isVisual?: boolean;
  visualType?: 'bar' | 'table' | 'pie' | 'line' | 'heatmap' | null;
}

interface WorkspaceAnalyticsProps {
  chatHistory: ChatMessage[];
  onSendMessage: (msg: string) => void;
  workspaceId?: number | null;
}

export const WorkspaceAnalytics: React.FC<WorkspaceAnalyticsProps> = ({
  chatHistory,
  onSendMessage,
  workspaceId,
}) => {
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // Everything below used to be hardcoded arrays: nine months of invented Meta/Google spend
  // and revenue, a five-week organic-traffic curve, a ROAS bar chart, a budget pie and a CPA
  // line - none of it from this workspace. The dashboard's own tiles report $0 revenue and 0x
  // ROAS for the same workspace, so the two screens contradicted each other. These now read
  // what actually exists, and say plainly where a data source is missing.
  const [sources, setSources] = useState<Record<string, { connected: boolean; detail?: string | null }> | null>(null);
  const [audits, setAudits] = useState<any[] | null>(null);
  const [metrics, setMetrics] = useState<any | null>(null);
  const [creators, setCreators] = useState<any[] | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    const token = localStorage.getItem('token');
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    const get = (u: string) => fetch(u, { headers }).then(r => (r.ok ? r.json() : null)).catch(() => null);

    Promise.all([
      get(`/api/connectors/meta/${workspaceId}/status`),
      get(`/api/connectors/google-ads/${workspaceId}/status`),
      // GA4 rides on the Search Console OAuth grant, so both read the same status row.
      get(`/api/connectors/search-console/${workspaceId}/status`),
    ]).then(([meta, gads, gsc]) => {
      setSources({
        'Meta Insights API': { connected: !!(meta && meta.connected), detail: meta && meta.name },
        'Google Ads API': { connected: !!(gads && gads.connected), detail: gads && gads.email },
        'GA4 Analytics': { connected: !!(gsc && gsc.connected && gsc.ga4_property_id), detail: gsc && gsc.ga4_property_id },
        'Search Console': { connected: !!(gsc && gsc.connected && gsc.site_url), detail: gsc && gsc.site_url },
      });
    });

    get(`/api/workspaces/${workspaceId}/seo`).then(d => setAudits(Array.isArray(d) ? d : []));
    get(`/api/workspaces/${workspaceId}/metrics`).then(setMetrics);
    get(`/api/workspaces/${workspaceId}/influencers`).then(d => setCreators(Array.isArray(d) ? d : []));
  }, [workspaceId]);

  // Real audit history. Each SEO/GEO run stores its score and creation time, which is an
  // actual trend for this workspace rather than a drawn curve.
  const auditSeries = (audits || [])
    .filter(a => a && a.created_at && typeof a.score === 'number')
    .slice()
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map(a => ({
      name: new Date(a.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      Score: a.score,
      pipeline: (a.keywords_data && a.keywords_data.pipeline) || 'SEO',
      // Early runs were recorded in demo mode. Plotted unmarked they read as measurements of
      // the real site, so they get their own dot and a note under the chart.
      demo: !!(a.keywords_data && a.keywords_data.demo),
    }));
  const demoRuns = auditSeries.filter(a => a.demo).length;
  const latestAudit = auditSeries.length ? auditSeries[auditSeries.length - 1] : null;
  const searchConsoleConnected = !!(sources && sources['Search Console'] && sources['Search Console'].connected);

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

  // The answer text above this is real - it comes from the analytics agent. The *charts* were
  // not: four fixed datasets (a ROAS bar, a budget pie, a CPA line, a demographic heatmap)
  // rendered from constants whenever the question happened to contain "roas", "cpa" or "pie".
  // Only the charts are held back here.
  const renderVisualResponse = () => (
    <PreviewNote>
      Chart rendering for chat answers is not built yet — the written answer above is real, but a visual for it would
      have to come from connected platform data.
    </PreviewNote>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', paddingBottom: '40px' }}>
      
      {/* 1. TOP SECTION: Claude MCP Query Engine */}
      <div>
        <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-heading)', marginBottom: '8px', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <MessageSquare size={24} color="var(--primary)" /> Claude MCP Intelligence Engine
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
          Ask about performance in plain language. Answers come from the analytics agent, which is told exactly which of
          your platforms are connected and is instructed never to invent figures for the ones that are not.
        </p>

        <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', background: 'rgba(90, 82, 255, 0.03)', borderColor: 'rgba(90, 82, 255, 0.2)', overflow: 'hidden' }}>
          
          {/* Connection Indicators */}
          <div style={{ padding: '12px 20px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(90, 82, 255, 0.1)', display: 'flex', gap: '16px', alignItems: 'center', overflowX: 'auto' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Database size={12} /> Connected Sources:
            </span>
            {/* These four chips were hardcoded green ticks: every workspace was told all four
                sources were connected, whatever its actual connectors said. */}
            {!sources && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Checking…</span>
            )}
            {sources && Object.keys(sources).map(name => {
              const s = sources[name];
              return (
                <span key={name} title={s.detail || undefined} style={{ fontSize: '11px', color: s.connected ? '#fff' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '12px', whiteSpace: 'nowrap' }}>
                  {s.connected
                    ? <CheckCircle size={10} color="var(--success)" />
                    : <span style={{ width: '8px', height: '8px', borderRadius: '50%', border: '1px solid var(--text-muted)', display: 'inline-block' }} />}
                  {name}{s.connected ? '' : ' — not connected'}
                </span>
              );
            })}
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
                      padding: '16px',
                      borderRadius: '12px',
                      fontSize: '14px',
                      lineHeight: '1.6',
                      color: '#fff'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '11px', color: msg.sender === 'user' ? 'var(--text-secondary)' : 'var(--primary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {msg.sender === 'user' ? 'YOU' : <><Zap size={12} /> CLAUDE DATA ANALYST</>}
                    </div>
                    <div>{msg.text}</div>
                    {msg.isVisual && renderVisualResponse()}
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
              <button onClick={() => handlePresetQuestion('Show CPA trend line over time')} style={{ whiteSpace: 'nowrap', fontSize: '11px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '6px 12px', borderRadius: '20px', cursor: 'pointer' }}>
                CPA Trend (Line)
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
            {/* Organic traffic can only come from Search Console. The old tile asserted
                "42,890 +12%" to every workspace, connected or not. */}
            <div className="glow-card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Organic Traffic (30d)</div>
              {searchConsoleConnected ? (
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Search Console is connected — open SEO + GEO for the query and traffic report.
                </div>
              ) : (
                <NotConnected source="Search Console">
                  Connect Search Console in SEO + GEO to report real organic traffic here.
                </NotConnected>
              )}
            </div>

            <div className="glow-card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>AI Visibility</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff' }}>
                {metrics ? `${metrics.aiVisibility}%` : '—'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Derived from your audit scores — not a count of live LLM mentions.
              </div>
            </div>

            <div className="glow-card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Latest Audit Score</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff' }}>
                {latestAudit ? `${latestAudit.Score}/100` : audits ? '—' : '…'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {latestAudit
                  ? `${latestAudit.pipeline} run on ${latestAudit.name} · ${auditSeries.length} audit${auditSeries.length === 1 ? '' : 's'} recorded`
                  : 'No audits recorded yet.'}
              </div>
            </div>
          </div>

          <div className="glow-card" style={{ padding: '24px' }}>
            <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', fontFamily: 'var(--font-mono)' }}>AUDIT SCORE HISTORY</h4>
            {auditSeries.length > 0 ? (
              <>
                <div style={{ width: '100%', height: '240px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={auditSeries} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis domain={[0, 100]} stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: '#0a0a0c', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', fontSize: '12px' }} />
                      <Line
                        type="monotone"
                        dataKey="Score"
                        stroke="var(--success)"
                        strokeWidth={2}
                        dot={(props: any) => {
                          const { cx, cy, payload, index } = props;
                          return payload && payload.demo
                            ? <circle key={index} cx={cx} cy={cy} r={4} fill="var(--paper, #0E1017)" stroke="var(--warning)" strokeWidth={2} />
                            : <circle key={index} cx={cx} cy={cy} r={4} fill="var(--success)" />;
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '14px', textAlign: 'center', lineHeight: 1.6 }}>
                  Every SEO and GEO run this workspace has recorded, oldest first.
                  {demoRuns > 0 && (
                    <>
                      <br />
                      <span style={{ color: 'var(--warning)' }}>
                        {demoRuns} of {auditSeries.length} {demoRuns === 1 ? 'run was' : 'runs were'} recorded in demo
                        mode (hollow points) — those scores did not come from crawling your site.
                      </span>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {audits ? 'No audits recorded yet — run an SEO or GEO pipeline in SEO + GEO and its score will chart here.' : 'Loading audit history…'}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ height: '1px', background: 'var(--border)', margin: '10px 0' }} />

      {/* 3. BOTTOM SECTION: Growth & Influencer */}
      <div>
        <h3 style={{ fontSize: '18px', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', marginBottom: '16px' }}>
          <BarChart3 size={20} color="var(--accent)" /> Financial Growth & Influencer Tracking
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Revenue Area Chart */}
          <div className="glow-card" style={{ padding: '24px' }}>
            <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', fontFamily: 'var(--font-mono)', display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
              REVENUE &amp; RETURN
              <span style={{ color: metrics && metrics.revenue > 0 ? 'var(--success)' : 'var(--text-muted)', fontWeight: 700 }}>
                {metrics ? `₹${Number(metrics.revenue || 0).toLocaleString('en-IN')}` : '—'}
              </span>
            </h4>

            {/* This card used to plot nine months of invented Meta/Google spend against an
                invented revenue line, headed "$42,000 MRR" - for a workspace the dashboard
                reports as ₹0. There is no spend history to plot until an ad platform is
                connected and reporting, so the real figures are stated instead. */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>ROAS</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff' }}>{metrics ? `${metrics.roas}x` : '—'}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Campaigns live</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff' }}>
                  {metrics && typeof metrics.campaignsLaunched === 'number' ? `${metrics.campaignsLive}/${metrics.campaignsLaunched}` : '—'}
                </div>
              </div>
            </div>

            {sources && !sources['Meta Insights API'].connected && !sources['Google Ads API'].connected ? (
              <NotConnected source="Ad platforms">
                Connect Meta Ads or Google Ads in Campaign Manager to chart spend and return over time.
              </NotConnected>
            ) : (
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Spend-over-time reporting is not built yet. The figures above come from your campaign records; per-period
                platform reporting will chart here once it is wired to the connector insights.
              </div>
            )}
          </div>

          {/* Influencer Leaderboard */}
          <div className="glow-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
            <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', fontFamily: 'var(--font-mono)' }}>TOP PERFORMING CREATORS</h4>
            
            {/* Three invented creators with invented ROAS and rupee figures. The workspace has
                a real creator list; it carries fit and success scores, not attributed sales,
                so those are what this shows. */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {!creators && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Loading creators…</div>}
              {creators && creators.length === 0 && (
                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  No creators shortlisted yet — discover and shortlist them in Influencer Marketplace.
                </div>
              )}
              {(creators || []).slice(0, 4).map((c: any) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Users size={16} color="var(--text-secondary)" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{c.handle || c.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.platform}{c.niche ? ` · ${c.niche}` : ''}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--success)' }}>{c.fit_score != null ? `${c.fit_score}% fit` : '—'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {c.success_rate != null ? `${c.success_rate}% success` : ''}{c.base_rate ? ` · ₹${Number(c.base_rate).toLocaleString('en-IN')}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <GlowButton variant="glow" style={{ marginTop: '20px', padding: '12px', width: '100%', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Award size={14} /> Open Influencer CRM
            </GlowButton>
          </div>
        </div>
      </div>

      <div style={{ height: '1px', background: 'var(--border)', margin: '10px 0' }} />

      {/* Growth Analysis & Intelligence Engine.
          Added to THIS component rather than swapping in the redesigned WorkspaceAnalytics:
          that version dropped the workspaceId prop and reintroduced nine months of
          hardcoded Meta/Google spend and revenue, which is the data this file's own header
          comment records as having been removed for contradicting the dashboard's $0 tiles.
          Mounted here, the new section renders against the same live workspace the rest of
          the screen already reads. */}
      <GrowthAnalysisSection
        workspaceId={workspaceId}
        onSendMessage={onSendMessage}
        connectedSources={{
          meta: !!sources?.['Meta Insights API']?.connected,
          google: !!sources?.['Google Ads API']?.connected,
          ga4: !!sources?.['GA4 Analytics']?.connected,
          gsc: !!sources?.['Search Console']?.connected,
        }}
      />

    </div>
  );
};