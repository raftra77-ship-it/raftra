import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { GlowButton } from '../GlowButton';
import { Markdown } from '../Markdown';

export interface SeoReport {
  id: string;
  title: string;
  excerpt: string;
  keywords: string;
  status: 'pending_review' | 'published';
}

// Compact, self-contained SEO/GEO report review list. Each report is collapsed to
// a short preview with an expand toggle so the column stays tidy.
export const SeoReportQueue: React.FC<{ blogs: SeoReport[]; onOpenReview: (id: string) => void }> = ({ blogs, onOpenReview }) => {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="glow-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
      <h3 style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', margin: 0 }}>
        SEO / GEO REPORTS — REVIEW
      </h3>

      {blogs.length === 0 && (
        <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          No reports yet. Run an SEO or GEO audit above and it will appear here for review.
        </div>
      )}

      {blogs.map((blog) => {
        const isOpen = expanded === blog.id;
        const preview = (blog.excerpt || '').replace(/[#*`>_]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
        return (
          <div
            key={blog.id}
            style={{
              border: '1px solid',
              borderColor: blog.status === 'pending_review' ? 'var(--warning)' : 'var(--border-color)',
              borderRadius: '10px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              background: 'rgba(255,255,255,0.02)',
            }}
          >
            <div>
              <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', background: 'rgba(90, 82, 255, 0.1)', color: 'var(--accent)', padding: '2px 6px', borderRadius: '4px' }}>
                KEYWORDS: {blog.keywords}
              </span>
              <h4 style={{ fontSize: '15px', marginTop: '8px', color: '#fff' }}>{blog.title}</h4>
            </div>

            {isOpen ? (
              <div style={{ fontSize: '13px', maxHeight: '460px', overflowY: 'auto', paddingRight: '8px' }}>
                <Markdown text={blog.excerpt} />
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0 }}>
                {preview}{(blog.excerpt || '').length > 200 ? '…' : ''}
              </p>
            )}

            <button
              onClick={() => setExpanded(isOpen ? null : blog.id)}
              style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--accent)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', padding: 0 }}
            >
              {isOpen ? 'Hide full report ▲' : 'Read full report ▼'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <span style={{ fontSize: '11px', color: blog.status === 'published' ? 'var(--success)' : 'var(--warning)' }}>
                {blog.status === 'published' ? 'APPROVED' : 'READY TO REVIEW'}
              </span>

              {blog.status === 'pending_review' ? (
                <GlowButton variant="glow" onClick={() => onOpenReview(blog.id)} style={{ padding: '6px 14px', fontSize: '11px' }}>
                  Review Report
                </GlowButton>
              ) : (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Check size={12} /> Approved
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
