import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { GlowButton } from '../GlowButton';

export interface InfluencerItem {
  id: string;
  name: string;
  handle: string;
  platform: 'TikTok' | 'Instagram' | 'YouTube';
  niche: string;
  fitScore: number;
  successRate: number;
  status: 'available' | 'proposed' | 'collaborating';
}

interface WorkspaceInfluencerProps {
  influencers: InfluencerItem[];
  onCollaborate: (id: string) => void;
}

export const WorkspaceInfluencer: React.FC<WorkspaceInfluencerProps> = ({
  influencers,
  onCollaborate,
}) => {
  const [filterNiche, setFilterNiche] = useState('All');

  const filteredCreators = filterNiche === 'All'
    ? influencers
    : influencers.filter(creator => creator.niche === filterNiche);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      <div>
        <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>AI Influencer Matcher</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Avoid choosing blindly. Our agent parses creators' audience demography, engagement trends, and calculates dynamic Brand Fit match indices.
        </p>
      </div>

      {/* Influencer Pipeline */}
      <div className="glow-card" style={{ padding: '24px', background: 'rgba(90, 82, 255, 0.02)', border: '1px solid rgba(90, 82, 255, 0.1)' }}>
        <h3 style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          INFLUENCER MARKETPLACE VERIFICATION & MATCHING AGENT GRAPH PATHWAY
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
          {[
            'Creator Discovery',
            'Audience Verification',
            'Fake Follower Detection',
            'Brand Match',
            'Pricing Agent',
            'Negotiation Assistant',
            'Campaign Manager'
          ].map((node, idx, arr) => (
            <div key={node} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                background: 'rgba(90, 82, 255, 0.05)',
                border: '1px solid var(--accent)',
                borderRadius: '4px',
                padding: '6px 10px',
                fontSize: '11px',
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

      {/* Filters row */}
      <div className="glow-card" style={{ padding: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>FILTER BY NICHE:</span>
        {['All', 'SaaS Tech', 'Productivity', 'Lifestyle & Travel', 'B2B Growth'].map((niche) => (
          <button
            key={niche}
            onClick={() => setFilterNiche(niche)}
            className="btn btn-secondary"
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              background: filterNiche === niche ? 'var(--accent)' : 'transparent',
              borderColor: filterNiche === niche ? 'var(--accent)' : 'var(--border-color)',
            }}
          >
            {niche}
          </button>
        ))}
      </div>

      {/* Influencers grid */}
      <div className="influencer-grid">
        {filteredCreators.map((creator) => (
          <div key={creator.id} className="influencer-card glow-card">
            <div className="influencer-profile">
              <div className="influencer-avatar">{creator.name.charAt(0)}</div>
              <div>
                <h4 style={{ fontSize: '15px' }}>{creator.name}</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  {creator.handle} ({creator.platform})
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '20px 0', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>AI Brand Fit:</span>
                <span style={{ fontWeight: 700, color: creator.fitScore > 85 ? 'var(--success)' : '#fff' }}>
                  {creator.fitScore}%
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Predicted ROAS Match:</span>
                <span style={{ fontWeight: 700, color: 'var(--success)' }}>{creator.successRate}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Audience Niche:</span>
                <span>{creator.niche}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {creator.status === 'collaborating' ? (
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    width: '100%',
                    fontSize: '12px',
                    color: 'var(--success)',
                    background: 'var(--success-glow)',
                    padding: '8px',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <Check size={14} /> Collaboration Active
                </span>
              ) : (
                <GlowButton
                  variant="glow"
                  onClick={() => onCollaborate(creator.id)}
                  style={{ width: '100%', padding: '10px', fontSize: '12px' }}
                >
                  Propose Partnership
                </GlowButton>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
