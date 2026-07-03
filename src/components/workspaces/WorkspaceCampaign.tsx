import React, { useState } from 'react';
import { ToggleLeft, ToggleRight, Cpu } from 'lucide-react';
import { GlowButton } from '../GlowButton';

export interface CampaignItem {
  id: string;
  platform: string;
  name: string;
  objective: string;
  budget: number;
  roas: number;
  status: 'active' | 'paused' | 'pending_review';
}

interface WorkspaceCampaignProps {
  campaigns: CampaignItem[];
  onOpenReview: (itemId: string) => void;
  onToggleStatus: (id: string) => void;
}

export const WorkspaceCampaign: React.FC<WorkspaceCampaignProps> = ({
  campaigns,
  onOpenReview,
  onToggleStatus,
}) => {
  const [integrations, setIntegrations] = useState([
    { platform: 'Meta Ads', connected: true, accountName: 'Meta Sandbox (Act_208392)' },
    { platform: 'Google Ads', connected: true, accountName: 'Google Sandbox (902-8392)' },
    { platform: 'LinkedIn Campaign Manager', connected: false, accountName: 'Disconnected' },
    { platform: 'TikTok Ads', connected: false, accountName: 'Disconnected' },
  ]);

  const [showJsonInspector, setShowJsonInspector] = useState(false);
  const [activeJsonCampaign, setActiveJsonCampaign] = useState<CampaignItem | null>(null);

  const toggleConnection = (index: number) => {
    setIntegrations((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              connected: !item.connected,
              accountName: !item.connected ? `${item.platform} Account` : 'Disconnected',
            }
          : item
      )
    );
  };

  const handleInspectJson = (campaign: CampaignItem) => {
    setActiveJsonCampaign(campaign);
    setShowJsonInspector(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      <div>
        <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>AI Campaign Manager</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Connect platforms via Sandbox OAuth. Our Performance Marketer Agent configures parameters, structures keywords, and manages budgets.
        </p>
      </div>

      {/* Campaign Publishing Pipeline */}
      <div className="glow-card" style={{ padding: '24px', background: 'rgba(90, 82, 255, 0.02)', border: '1px solid rgba(90, 82, 255, 0.1)' }}>
        <h3 style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          CAMPAIGN PUBLISHING AGENT GRAPH PATHWAY
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
          {[
            'Marketing Planner Agent',
            'Audience Research Agent',
            'Budget Planner',
            'Campaign Builder',
            'Meta Specialist',
            'Google Ads Specialist',
            'Optimization Agent',
            'Human Approval',
            'Publish',
          ].map((nodeName, idx, arr) => (
            <div key={nodeName} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  background: idx < arr.length - 2 ? 'rgba(90, 82, 255, 0.08)' : idx === arr.length - 2 ? 'var(--warning-glow)' : 'var(--success-glow)',
                  border: '1px solid',
                  borderColor: idx < arr.length - 2 ? 'var(--accent)' : idx === arr.length - 2 ? 'var(--warning)' : 'var(--success)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '11px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#fff',
                }}
              >
                <span
                  className="badge-pulse success"
                  style={{
                    width: '5px',
                    height: '5px',
                    backgroundColor: idx < arr.length - 2 ? 'var(--accent)' : idx === arr.length - 2 ? 'var(--warning)' : 'var(--success)',
                  }}
                />
                <span>{nodeName}</span>
              </div>
              {idx < arr.length - 1 && (
                <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 'bold' }}>→</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="workspace-grid-split">
        {/* Left Panel: Integration Nodes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '16px' }}>OAuth Connection Center</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {integrations.map((item, index) => (
              <div key={item.platform} className="glow-card" style={{ padding: '16px', display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ fontSize: '14px', marginBottom: '2px' }}>{item.platform}</h4>
                  <p style={{ fontSize: '12px', color: item.connected ? 'var(--success)' : 'var(--text-muted)' }}>
                    {item.accountName}
                  </p>
                </div>
                <button
                  onClick={() => toggleConnection(index)}
                  style={{ background: 'transparent', border: 'none', color: item.connected ? 'var(--success)' : 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  {item.connected ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                </button>
              </div>
            ))}
          </div>

          {showJsonInspector && activeJsonCampaign && (
            <div className="glow-card" style={{ borderColor: 'var(--accent)', background: '#08080a', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h4 style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}>JSON SCHEMA CONFIG</h4>
                <button onClick={() => setShowJsonInspector(false)} style={{ background: 'transparent', border: 'none', color: '#ff4757', cursor: 'pointer', fontSize: '11px' }}>
                  Close
                </button>
              </div>
              <pre
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: '#00ff9d',
                  maxHeight: '180px',
                  overflowY: 'auto',
                  background: 'rgba(0,0,0,0.3)',
                  padding: '12px',
                  borderRadius: '6px',
                }}
              >
                {JSON.stringify(
                  {
                    campaign_id: activeJsonCampaign.id,
                    target_network: activeJsonCampaign.platform.toUpperCase(),
                    campaign_parameters: {
                      name: activeJsonCampaign.name,
                      objective: activeJsonCampaign.objective,
                      bidding_strategy: 'ROAS_OPTIMIZE',
                      limits: {
                        daily_budget_usd: (activeJsonCampaign.budget / 30).toFixed(2),
                        monthly_cap_usd: activeJsonCampaign.budget,
                      },
                      targeting_parameters: {
                        geo: ['US', 'CA', 'GB'],
                        interests: ['growth-marketing', 'saas-operators'],
                        demographic: '24-55',
                      },
                    },
                    agent_metadata: {
                      orchestrator_node: 'PerformanceMarketerAgent',
                      optimization_score: 98,
                    },
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          )}
        </div>

        {/* Right Panel: Campaign controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '16px' }}>Target Campaigns</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {campaigns.map((camp) => (
              <div
                key={camp.id}
                className="glow-card"
                style={{
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  borderColor: camp.status === 'pending_review' ? 'var(--warning)' : 'var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 600,
                        background: camp.platform === 'Meta' ? '#1877f2' : '#ea4335',
                        color: '#fff',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        marginRight: '8px',
                      }}
                    >
                      {camp.platform.toUpperCase()}
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: 600 }}>{camp.name}</span>
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      color:
                        camp.status === 'active'
                          ? 'var(--success)'
                          : camp.status === 'paused'
                          ? 'var(--text-secondary)'
                          : 'var(--warning)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {camp.status.toUpperCase()}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <p style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>BUDGET</p>
                    <p style={{ fontSize: '15px', fontWeight: 600 }}>${camp.budget}/mo</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>OBJECTIVE</p>
                    <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{camp.objective}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>ROAS</p>
                    <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--success)' }}>{camp.roas}x</p>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    borderTop: '1px solid var(--border-color)',
                    paddingTop: '12px',
                    justifyContent: 'space-between',
                  }}
                >
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleInspectJson(camp)}
                    style={{ padding: '6px 12px', fontSize: '11px', gap: '4px' }}
                  >
                    <Cpu size={12} /> Inspect JSON
                  </button>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    {camp.status === 'pending_review' ? (
                      <GlowButton
                        variant="glow"
                        onClick={() => onOpenReview(camp.id)}
                        style={{ padding: '6px 14px', fontSize: '11px' }}
                      >
                        Approve & Deploy
                      </GlowButton>
                    ) : (
                      <button
                        className="btn btn-secondary"
                        onClick={() => onToggleStatus(camp.id)}
                        style={{ padding: '6px 12px', fontSize: '11px' }}
                      >
                        {camp.status === 'active' ? 'Pause' : 'Activate'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
