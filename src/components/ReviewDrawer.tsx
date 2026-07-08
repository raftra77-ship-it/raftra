import React, { useState } from 'react';
import { X, Check, AlertCircle } from 'lucide-react';
import { GlowButton } from './GlowButton';
import { AnimatePresence, motion } from 'framer-motion';

export interface ReviewItem {
  id: string;
  type: 'creative' | 'campaign' | 'seo' | 'geo' | 'social';
  title: string;
  description: string;
  data: {
    headline?: string;
    bodyText?: string;
    cta?: string;
    budget?: number;
    platform?: string;
    scheduledFor?: string;
    keywords?: string;
  };
}

interface ReviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  item: ReviewItem | null;
  onApprove: (id: string, updatedData: any) => void;
  onReject: (id: string) => void;
}

export const ReviewDrawer: React.FC<ReviewDrawerProps> = ({
  isOpen,
  onClose,
  item,
  onApprove,
  onReject,
}) => {
  const [headline, setHeadline] = useState(item?.data.headline || '');
  const [bodyText, setBodyText] = useState(item?.data.bodyText || '');
  const [cta, setCta] = useState(item?.data.cta || '');
  const [budget, setBudget] = useState(item?.data.budget || 0);

  // Update internal inputs when item changes
  React.useEffect(() => {
    if (item) {
      setHeadline(item.data.headline || '');
      setBodyText(item.data.bodyText || '');
      setCta(item.data.cta || '');
      setBudget(item.data.budget || 0);
    }
  }, [item]);

  if (!item) return null;

  const handleApproveSubmit = () => {
    onApprove(item.id, {
      ...item.data,
      headline,
      bodyText,
      cta,
      budget,
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="review-drawer-overlay" onClick={onClose}>
          <motion.div
            className="review-drawer"
            onClick={(e) => e.stopPropagation()}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            <div className="review-drawer-header">
              <div>
                <span className="hero-pill-badge" style={{ background: 'var(--warning-glow)', color: 'var(--warning)', marginBottom: '8px', display: 'inline-block' }}>
                  AWAITING REVIEW
                </span>
                <h3 style={{ fontSize: '18px' }}>{item.title}</h3>
              </div>
              <button
                onClick={onClose}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="review-drawer-body">
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                {item.description}
              </p>

              {item.type === 'creative' && (
                <>
                  <div className="form-group">
                    <label>Ad Headline Angle</label>
                    <input
                      type="text"
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Ad Body Copy</label>
                    <textarea
                      rows={5}
                      value={bodyText}
                      onChange={(e) => setBodyText(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Call to Action (CTA)</label>
                    <input
                      type="text"
                      value={cta}
                      onChange={(e) => setCta(e.target.value)}
                    />
                  </div>
                </>
              )}

              {item.type === 'campaign' && (
                <>
                  <div className="form-group">
                    <label>Target Platform</label>
                    <input type="text" value={item.data.platform} disabled style={{ opacity: 0.6 }} />
                  </div>

                  <div className="form-group">
                    <label>Monthly Advertising Budget ($)</label>
                    <input
                      type="number"
                      value={budget}
                      onChange={(e) => setBudget(Number(e.target.value))}
                    />
                  </div>
                </>
              )}

              {item.type === 'social' && (
                <>
                  <div className="form-group">
                    <label>Post Caption Draft</label>
                    <textarea
                      rows={6}
                      value={bodyText}
                      onChange={(e) => setBodyText(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Scheduled For</label>
                    <input type="text" value={item.data.scheduledFor} disabled style={{ opacity: 0.6 }} />
                  </div>
                </>
              )}

              {item.type === 'seo' && (
                <>
                  <div className="form-group">
                    <label>Generated Keyword Clusters</label>
                    <input type="text" value={item.data.keywords} disabled style={{ opacity: 0.6 }} />
                  </div>
                  <div className="form-group">
                    <label>Optimized Content Article Draft</label>
                    <textarea rows={20} value={bodyText} onChange={(e) => setBodyText(e.target.value)} style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', lineHeight: '1.5' }} />
                  </div>
                </>
              )}

              <div
                style={{
                  background: 'rgba(255, 174, 0, 0.05)',
                  border: '1px solid rgba(255, 174, 0, 0.1)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  display: 'flex',
                  gap: '12px',
                  marginTop: 'auto',
                }}
              >
                <AlertCircle size={20} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  This action is held in sandboxed staging. Confirming will deploy these parameters directly to the channels through Raftra's integration sync pipelines.
                </p>
              </div>
            </div>

            <div className="review-drawer-footer">
              <GlowButton
                variant="primary"
                icon={<Check size={16} />}
                onClick={handleApproveSubmit}
                style={{ flex: 1 }}
              >
                Approve & Deploy
              </GlowButton>
              <button
                onClick={() => onReject(item.id)}
                className="btn btn-secondary"
                style={{ flex: 1, borderColor: 'var(--danger-glow)', color: 'var(--danger)' }}
              >
                Reject / Regenerate
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
