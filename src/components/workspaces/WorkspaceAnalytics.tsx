import React, { useState, useRef, useEffect } from 'react';
import { Send, Search, TrendingUp, Globe, Zap, MessageSquare, UploadCloud, Database, CheckCircle } from 'lucide-react';
import { GlowButton } from '../GlowButton';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

import { GrowthAnalysisSection } from './GrowthAnalysisSection';
import { Markdown } from '../Markdown';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'claude';
  text: string;
  isVisual?: boolean;
  visualType?: 'bar' | 'table' | 'pie' | 'line' | 'heatmap' | null;
  /** Placeholder shown while the agent is still answering. BrandDashboard pushes a message
   *  with this set (see its handleSendClaudeMessage) and clears it when the reply lands. */
  pending?: boolean;
}

interface WorkspaceAnalyticsProps {
  chatHistory: ChatMessage[];
  onSendMessage: (msg: string) => void;
  onNavigateTab?: (tab: string) => void;
  /** Accepted because BrandDashboard passes it. This screen renders the reference design's
   *  sample telemetry rather than per-workspace figures, so nothing here reads it. */
  workspaceId?: number | null;
}

export const WorkspaceAnalytics: React.FC<WorkspaceAnalyticsProps> = ({
  chatHistory,
  onSendMessage,
  onNavigateTab,
}) => {
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const seoGeoData = [
    { name: 'W1', Organic: 1200, AEMentions: 40 },
    { name: 'W2', Organic: 1300, AEMentions: 80 },
    { name: 'W3', Organic: 1100, AEMentions: 150 },
    { name: 'W4', Organic: 1700, AEMentions: 300 },
    { name: 'W5', Organic: 1900, AEMentions: 450 },
  ];

  const roasBarData = [
    { platform: 'Meta Ads', ROAS: 2.4 },
    { platform: 'Google Ads', ROAS: 3.1 },
    { platform: 'TikTok', ROAS: 1.8 },
    { platform: 'Influencers', ROAS: 4.2 },
  ];

  const pieData = [
    { name: 'Meta Ads', value: 400 },
    { name: 'Google Ads', value: 300 },
    { name: 'TikTok', value: 300 },
    { name: 'LinkedIn', value: 200 },
  ];
  const pieColors = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042'];

  const lineData = [
    { day: 'Mon', CPA: 12 },
    { day: 'Tue', CPA: 19 },
    { day: 'Wed', CPA: 15 },
    { day: 'Thu', CPA: 22 },
    { day: 'Fri', CPA: 25 },
    { day: 'Sat', CPA: 18 },
    { day: 'Sun', CPA: 14 },
  ];

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

  /* Every chart below sets isAnimationActive={false}. Under this project's recharts (3.9.1)
     the entry animation never runs for a chart mounted inside the chat log — that log is a
     `maxHeight: 350px; overflowY: auto` scroller that the auto-scroll effect moves the moment
     a message lands — and the shapes are left unrendered permanently. Measured: the <Bar>
     produced four `recharts-bar-rectangle` groups whose `recharts-inactive-bar` layer was
     empty, over a correctly sized 934x158 surface; the <Pie> likewise produced sector groups
     containing an empty `recharts-shape`. Scrolling the chart into view and dispatching a
     resize did not start it. Turning the animation off makes recharts draw immediately, and
     the paths appear with the right geometry. */
  const renderVisualResponse = (type: string) => {
    if (type === 'bar') {
      return (
        <div style={{ height: '180px', width: '100%', marginTop: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={roasBarData}>
              <XAxis dataKey="platform" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: '#0a0a0c', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', fontSize: '12px' }} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
              <Bar dataKey="ROAS" fill="var(--primary)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
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
            <span>CPA</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <span>Retargeting BOF</span>
            <span style={{ color: 'var(--warning)' }}>$4,200</span>
            <span style={{ color: 'var(--warning)' }}>$45.20</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '8px 0' }}>
            <span>Cold Audience Lookalike</span>
            <span>$1,100</span>
            <span>$22.10</span>
          </div>
        </div>
      );
    }
    if (type === 'pie') {
      return (
        <div style={{ height: '180px', width: '100%', marginTop: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} fill="#8884d8" paddingAngle={5} dataKey="value" isAnimationActive={false}>
                {pieData.map((_entry, index) => (
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
            <LineChart data={lineData}>
              <XAxis dataKey="day" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: '#0a0a0c', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', fontSize: '12px' }} />
              <Line type="monotone" dataKey="CPA" stroke="#ff7300" strokeWidth={2} isAnimationActive={false} />
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
            <span style={{ fontSize: '11px', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '12px' }}>
              <CheckCircle size={10} color="var(--success)" /> Meta Insights API
            </span>
            <span style={{ fontSize: '11px', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '12px' }}>
              <CheckCircle size={10} color="var(--success)" /> Google Ads API
            </span>
            <span style={{ fontSize: '11px', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '12px' }}>
              <CheckCircle size={10} color="var(--success)" /> GA4 Analytics
            </span>
            <span style={{ fontSize: '11px', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '12px' }}>
              <CheckCircle size={10} color="var(--success)" /> Search Console (SEO)
            </span>
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
                    {/* Pending placeholder and markdown rendering are kept from this branch:
                        BrandDashboard pushes a `pending` message while the agent works, and
                        the agent replies in markdown. Rendering `msg.text` raw collapsed
                        every reply's "* **Meta Ads:**" onto one line. */}
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
                      : <Markdown text={msg.text} />}
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

      {/* 2. MIDDLE SECTION: SEO & GEO Dashboard.
          Wrapped in .seo-shell — the same class the SEO + GEO workspace page uses for its
          section containers (defined in App.css) — so the product's two SEO surfaces read
          as one family, instead of one being a contained card and the other a bare heading
          over loose tiles. --pipe-accent is --success because that is already this
          section's accent: the Globe, the GEO series and the trend chips. */}
      <div className="glow-card seo-shell" style={{ padding: '24px', ['--pipe-accent' as string]: 'var(--success)' }}>
        <h3 style={{ fontSize: '18px', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', margin: '0 0 16px 0' }}>
          <Globe size={20} color="var(--success)" /> SEO & GEO Performance
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr)', gap: '20px' }}>
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
                  {/* isAnimationActive={false} for the same reason as the chat charts above.
                      Measured here after the section moved inside the .seo-shell container:
                      both curves had full path geometry (d of 161 and 176 chars) but were
                      left at stroke-dasharray "7.4px 656px" — recharts' line-draw animation
                      stalled at its first frame — so the chart rendered as dots floating
                      with no lines between them. */}
                  <Line type="monotone" dataKey="Organic" stroke="#8884d8" strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
                  <Line type="monotone" dataKey="AEMentions" stroke="var(--success)" strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
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
      {/* Deliberately passed no workspaceId and no connectedSources, matching the reference
          build: GrowthAnalysisSection then skips its growth fetch, defaults its demo toggle
          ON and treats all five connectors as linked, which is the view in the reference
          screens. Hand it a workspaceId and it switches to that workspace's real figures. */}
      <GrowthAnalysisSection
        onNavigateTab={onNavigateTab}
        onSendMessage={onSendMessage}
      />

    </div>
  );
};
