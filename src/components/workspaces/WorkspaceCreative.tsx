import React, { useState } from 'react';
import { Sparkles, Eye, Check } from 'lucide-react';
import { GlowButton } from '../GlowButton';

interface CreativeAsset {
  id: string;
  headline: string;
  bodyText: string;
  cta: string;
  type: string;
  status: 'pending_review' | 'approved' | 'rejected';
}

interface WorkspaceCreativeProps {
  brandUrl: string;
  assets: CreativeAsset[];
  onOpenReview: (itemId: string) => void;
}

export const WorkspaceCreative: React.FC<WorkspaceCreativeProps> = ({
  brandUrl,
  assets,
  onOpenReview,
}) => {
  const [targetProduct, setTargetProduct] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetProduct) return;
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setTargetProduct('');
    }, 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      <div>
        <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>AI Creative Studio</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Turn your brand assets into high-converting copy and design templates automatically.
        </p>
      </div>

      <div className="workspace-grid-split">
        {/* Left pane: Generate options */}
        <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} style={{ color: 'var(--accent)' }} />
            Draft New Angle
          </h3>

          <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label>Target URL / Landing Page</label>
              <input type="text" value={brandUrl} disabled style={{ opacity: 0.6 }} />
            </div>

            <div className="form-group">
              <label>Product Catalog Focus</label>
              <input
                type="text"
                placeholder="e.g. Summer organic energy drink line"
                value={targetProduct}
                onChange={(e) => setTargetProduct(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Ad Concept Strategy</label>
              <select>
                <option>Unique Selling Point (USP) Callout</option>
                <option>Competitor Counter-Attack</option>
                <option>Social Proof / Customer Quotes</option>
                <option>Urgent Promotional Discount</option>
              </select>
            </div>

            <GlowButton variant="glow" type="submit" loading={isGenerating}>
              Analyze Brand & Generate Ideas
            </GlowButton>
          </form>
        </div>

        {/* Right pane: Active Assets Review desk */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '16px' }}>Active Draft Creatives</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {assets.map((asset) => (
              <div key={asset.id} className="asset-review-card">
                <div className="asset-preview-pane">
                  <span className="asset-badge">{asset.type.toUpperCase()} CONCEPT</span>
                  <div
                    style={{
                      width: '80%',
                      height: '60%',
                      background: 'linear-gradient(135deg, rgba(90, 82, 255, 0.2) 0%, rgba(10, 10, 12, 0.8) 100%)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '20px',
                      textAlign: 'center',
                    }}
                  >
                    <p style={{ fontSize: '14px', fontWeight: 600, color: '#fff', fontStyle: 'italic' }}>
                      "{asset.headline}"
                    </p>
                  </div>
                </div>

                <div className="asset-details">
                  <h4 style={{ fontSize: '15px' }}>{asset.headline}</h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                    {asset.bodyText}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: asset.status === 'approved' ? 'var(--success)' : 'var(--warning)',
                        background: asset.status === 'approved' ? 'var(--success-glow)' : 'var(--warning-glow)',
                        padding: '3px 8px',
                        borderRadius: '4px',
                      }}
                    >
                      {asset.status.replace('_', ' ').toUpperCase()}
                    </span>

                    {asset.status === 'pending_review' ? (
                      <button
                        className="btn btn-secondary"
                        onClick={() => onOpenReview(asset.id)}
                        style={{ padding: '6px 12px', fontSize: '12px', marginLeft: 'auto' }}
                      >
                        <Eye size={12} /> Review
                      </button>
                    ) : (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Check size={12} /> Synced to Manager
                      </span>
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
