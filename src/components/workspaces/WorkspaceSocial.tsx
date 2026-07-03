import React, { useState } from 'react';
import { Calendar, PenTool, Check } from 'lucide-react';
import { GlowButton } from '../GlowButton';

export interface SocialPostItem {
  id: string;
  platform: 'Twitter' | 'LinkedIn' | 'Instagram';
  caption: string;
  scheduledFor: string;
  status: 'draft' | 'scheduled' | 'published';
}

interface WorkspaceSocialProps {
  posts: SocialPostItem[];
  onOpenReview: (itemId: string) => void;
  onComposePost: (caption: string, platform: 'Twitter' | 'LinkedIn' | 'Instagram') => void;
}

export const WorkspaceSocial: React.FC<WorkspaceSocialProps> = ({
  posts,
  onOpenReview,
  onComposePost,
}) => {
  const [composerInput, setComposerInput] = useState('');
  const [platform, setPlatform] = useState<'Twitter' | 'LinkedIn' | 'Instagram'>('LinkedIn');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!composerInput.trim()) return;
    onComposePost(composerInput, platform);
    setComposerInput('');
  };

  const getPlatformBadgeColor = (plat: string) => {
    switch (plat) {
      case 'Twitter':
        return '#1da1f2';
      case 'LinkedIn':
        return '#0077b5';
      case 'Instagram':
        return '#e1306c';
      default:
        return 'var(--accent)';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      <div>
        <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>Social Media AI Team</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Schedule captions, generate images, discover trends, and manage posting cross-platform without human labor overheads.
        </p>
      </div>

      {/* Social Media Pipeline */}
      <div className="glow-card" style={{ padding: '24px', background: 'rgba(90, 82, 255, 0.02)', border: '1px solid rgba(90, 82, 255, 0.1)' }}>
        <h3 style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          SOCIAL HUB CAPTIONS & ENGAGEMENT AGENT GRAPH PATHWAY
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
          {[
            'Content Planner',
            'Image Agent',
            'Video Agent',
            'Caption Agent',
            'Scheduler',
            'Comment Agent',
            'DM Agent',
            'Analytics'
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

      <div className="workspace-grid-split">
        {/* Left Side: Compose section */}
        <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PenTool size={16} style={{ color: 'var(--accent)' }} />
            Write Draft Update
          </h3>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label>Destination Channel</label>
              <select value={platform} onChange={(e) => setPlatform(e.target.value as any)}>
                <option value="LinkedIn">LinkedIn Company Profile</option>
                <option value="Twitter">X / Twitter Handle</option>
                <option value="Instagram">Instagram Brand Node</option>
              </select>
            </div>

            <div className="form-group">
              <label>Draft Seed / Core Topic</label>
              <textarea
                rows={5}
                placeholder="e.g. Discussing the launching of our new brand assets and why tools consolidation is saving companies millions of marketing dollars..."
                value={composerInput}
                onChange={(e) => setComposerInput(e.target.value)}
              />
            </div>

            <GlowButton variant="glow" type="submit">
              Draft Post with AI Copilot
            </GlowButton>
          </form>
        </div>

        {/* Right Side: Visual calendar queue scheduler */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={16} style={{ color: '#00ff9d' }} />
            Campaign Queue
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {posts.map((post) => (
              <div
                key={post.id}
                className="glow-card"
                style={{
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  borderColor: post.status === 'scheduled' ? 'var(--warning)' : 'var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: '10px',
                      background: getPlatformBadgeColor(post.platform),
                      color: '#fff',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      fontWeight: 600,
                    }}
                  >
                    {post.platform.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{post.scheduledFor}</span>
                </div>

                <p style={{ fontSize: '13px', color: '#fff', lineHeight: '1.5' }}>{post.caption}</p>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTop: '1px solid var(--border-color)',
                    paddingTop: '10px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '11px',
                      color: post.status === 'published' ? 'var(--success)' : 'var(--warning)',
                    }}
                  >
                    {post.status.toUpperCase()}
                  </span>

                  {post.status === 'scheduled' ? (
                    <GlowButton variant="glow" onClick={() => onOpenReview(post.id)} style={{ padding: '4px 10px', fontSize: '11px' }}>
                      Review & Approve
                    </GlowButton>
                  ) : (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Check size={12} /> Post Published Live
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
