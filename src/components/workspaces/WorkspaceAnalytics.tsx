import React, { useState } from 'react';
import { Send, ArrowUpRight, TrendingUp } from 'lucide-react';
import { GlowButton } from '../GlowButton';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'claude';
  text: string;
}

interface WorkspaceAnalyticsProps {
  chatHistory: ChatMessage[];
  onSendMessage: (msg: string) => void;
}

export const WorkspaceAnalytics: React.FC<WorkspaceAnalyticsProps> = ({
  chatHistory,
  onSendMessage,
}) => {
  const [chatInput, setChatInput] = useState('');

  const chartData = [
    { name: 'Jan', MetaSpend: 4000, GoogleSpend: 2400, Revenue: 21000 },
    { name: 'Feb', MetaSpend: 3000, GoogleSpend: 1398, Revenue: 18000 },
    { name: 'Mar', MetaSpend: 2000, GoogleSpend: 9800, Revenue: 35000 },
    { name: 'Apr', MetaSpend: 2780, GoogleSpend: 3908, Revenue: 29000 },
    { name: 'May', MetaSpend: 1890, GoogleSpend: 4800, Revenue: 28000 },
    { name: 'Jun', MetaSpend: 2390, GoogleSpend: 3800, Revenue: 34000 },
    { name: 'Jul', MetaSpend: 3490, GoogleSpend: 4300, Revenue: 42000 },
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      <div>
        <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>Analytics + Claude Intelligence</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Connect source APIs and let Claude AI identify conversion drops, fatiguing creatives, and high-ROAS opportunities.
        </p>
      </div>

      {/* Analytics Pipeline */}
      <div className="glow-card" style={{ padding: '24px', background: 'rgba(90, 82, 255, 0.02)', border: '1px solid rgba(90, 82, 255, 0.1)' }}>
        <h3 style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          DATA ANALYTICS AGENT GRAPH PATHWAY
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
          {[
            'Data Collection Agent',
            'Cleaning Agent',
            'SQL Agent',
            'Python Agent',
            'Visualization Agent',
            'Claude Insights Agent',
            'Recommendation Agent'
          ].map((node, idx, arr) => (
            <div key={node} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                background: 'rgba(90, 82, 255, 0.05)',
                border: '1px solid var(--accent)',
                borderRadius: '4px',
                padding: '6px 10px',
                fontSize: '10.5px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: '#fff'
              }}>
                <span className="badge-pulse success" style={{ width: '4px', height: '4px', backgroundColor: 'var(--accent)' }} />
                <span>{node}</span>
              </div>
              {idx < arr.length - 1 && <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>→</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Analytics chart view */}
      <div className="glow-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={16} style={{ color: 'var(--accent)' }} />
              Unified Performance Curve
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Comparing advertising spend vs revenue growth</p>
          </div>
          <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8884d8' }} /> Revenue
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#82ca9d' }} /> Meta Spend
            </span>
          </div>
        </div>

        <div style={{ width: '100%', height: '240px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8884d8" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorMeta" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#82ca9d" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: '#0a0a0c', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', fontSize: '12px' }} />
              <Area type="monotone" dataKey="Revenue" stroke="#8884d8" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={2} />
              <Area type="monotone" dataKey="MetaSpend" stroke="#82ca9d" fillOpacity={1} fill="url(#colorMeta)" strokeWidth={1} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="workspace-grid-split">
        {/* Left Side: Claude Natural Language Q&A */}
        <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', background: 'rgba(90, 82, 255, 0.03)', borderColor: 'rgba(90, 82, 255, 0.1)' }}>
          <div className="claude-box-header">
            <div className="claude-logo-icon">C</div>
            <div>
              <h3 style={{ fontSize: '15px' }}>Claude Executive Intelligence</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Streaming financial audit & recommendations</p>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              maxHeight: '260px',
              minHeight: '180px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              padding: '10px 0',
            }}
          >
            {chatHistory.map((msg) => (
              <div
                key={msg.id}
                style={{
                  alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  background: msg.sender === 'user' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(90, 82, 255, 0.08)',
                  border: '1px solid',
                  borderColor: msg.sender === 'user' ? 'var(--border-color)' : 'rgba(90, 82, 255, 0.2)',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  lineHeight: '1.5',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '11px', color: msg.sender === 'user' ? 'var(--text-secondary)' : '#d97706', marginBottom: '4px' }}>
                  {msg.sender === 'user' ? 'YOU' : 'CLAUDE INTELLIGENCE'}
                </div>
                <div>{msg.text}</div>
              </div>
            ))}
          </div>

          <form onSubmit={handleSend} className="claude-chat-input-wrapper">
            <input
              type="text"
              placeholder="Ask Claude: 'Which campaign is wasting budget?' or 'Generate forecast'..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
            />
            <GlowButton variant="glow" type="submit" style={{ padding: '8px 16px' }}>
              <Send size={14} />
            </GlowButton>
          </form>
        </div>

        {/* Right Side: Preset analysis options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '16px' }}>Immediate Growth Questions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={() => handlePresetQuestion('Why did conversions drop?')}
              className="btn btn-secondary"
              style={{ justifyContent: 'space-between', padding: '16px', width: '100%' }}
            >
              <span>Why did conversions drop?</span>
              <ArrowUpRight size={16} />
            </button>

            <button
              onClick={() => handlePresetQuestion('Which campaigns are wasting money?')}
              className="btn btn-secondary"
              style={{ justifyContent: 'space-between', padding: '16px', width: '100%' }}
            >
              <span>Which campaigns are wasting money?</span>
              <ArrowUpRight size={16} />
            </button>

            <button
              onClick={() => handlePresetQuestion('Forecast next month revenue based on active channels')}
              className="btn btn-secondary"
              style={{ justifyContent: 'space-between', padding: '16px', width: '100%' }}
            >
              <span>Forecast next month revenue</span>
              <ArrowUpRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
