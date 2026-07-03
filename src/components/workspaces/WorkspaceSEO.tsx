import React, { useState } from 'react';
import { Globe, Check, ExternalLink } from 'lucide-react';
import { GlowButton } from '../GlowButton';

interface BlogDraft {
  id: string;
  title: string;
  excerpt: string;
  keywords: string;
  status: 'pending_review' | 'published';
}

interface WorkspaceSEOProps {
  blogs: BlogDraft[];
  onOpenReview: (itemId: string) => void;
}

export const WorkspaceSEO: React.FC<WorkspaceSEOProps> = ({ blogs, onOpenReview }) => {
  const [rankings] = useState([
    { engine: 'Google Search index', score: 82, trend: '+4%' },
    { engine: 'ChatGPT / OpenAI index', score: 68, trend: '+12%' },
    { engine: 'Claude AI Citation Graph', score: 71, trend: '+2%' },
    { engine: 'Gemini Search Citation', score: 59, trend: '+8%' },
    { engine: 'Perplexity Engine Citation', score: 64, trend: '+15%' },
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      <div>
        <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>SEO + GEO/AEO Dominance</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Dominate search lists on Google AND answer outputs on LLMs (ChatGPT, Claude, Gemini, Perplexity) using automated entity optimizations.
        </p>
      </div>

      {/* SEO & GEO Pipelines */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '10px' }}>
        {/* SEO Pipeline */}
        <div className="glow-card" style={{ padding: '20px', background: 'rgba(0, 255, 157, 0.01)', border: '1px solid rgba(0, 255, 157, 0.08)' }}>
          <h3 style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            TRADITIONAL SEO PIPELINE GRAPH
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
            {[
              'Crawler Agent',
              'Technical SEO Agent',
              'Keyword Agent',
              'Content Strategy Agent',
              'Internal Linking Agent',
              'Backlink Agent',
              'Schema Agent',
              'Publishing Agent',
              'Reporting Agent'
            ].map((node, idx, arr) => (
              <div key={node} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  background: 'rgba(0, 255, 157, 0.05)',
                  border: '1px solid var(--success)',
                  borderRadius: '4px',
                  padding: '6px 10px',
                  fontSize: '10px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: '#fff'
                }}>
                  <span className="badge-pulse success" style={{ width: '4px', height: '4px', backgroundColor: 'var(--success)' }} />
                  <span>{node}</span>
                </div>
                {idx < arr.length - 1 && <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>→</span>}
              </div>
            ))}
          </div>
        </div>

        {/* GEO/AEO Pipeline */}
        <div className="glow-card" style={{ padding: '20px', background: 'rgba(90, 82, 255, 0.01)', border: '1px solid rgba(90, 82, 255, 0.08)' }}>
          <h3 style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            AEO / GEO CITATIONS PIPELINE GRAPH
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
            {[
              'Entity Agent',
              'Citation Agent',
              'Prompt Visibility Agent',
              'LLM Ranking Agent',
              'Authority Agent',
              'Knowledge Graph Agent',
              'Optimization Agent',
              'Reporting'
            ].map((node, idx, arr) => (
              <div key={node} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  background: 'rgba(90, 82, 255, 0.05)',
                  border: '1px solid var(--accent)',
                  borderRadius: '4px',
                  padding: '6px 10px',
                  fontSize: '10px',
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
      </div>

      <div className="workspace-grid-split">
        {/* Left Side: SEO Crawl & AEO Citation Indexes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="glow-card">
            <h3 style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Globe size={16} style={{ color: '#00ff9d' }} />
              Answer Engine Citation (AEO) Index
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {rankings.map((rank) => (
                <div key={rank.engine} style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{rank.engine}</span>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <span style={{ fontWeight: 600 }}>{rank.score}% visibility</span>
                    <span style={{ color: 'var(--success)', fontWeight: 600 }}>{rank.trend}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glow-card">
            <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>AEO Recommendation Engine</h3>
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '8px' }}>
              <h4 style={{ fontSize: '13px', color: '#ffae00', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                Schema & Entity Gap Detected
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                Claude AI mentions your product, but lacks structured links to your API documentation page. Add Schema Graph headers to boost entity-level citation confidence by 18%.
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: Blog / Blog generation list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '16px' }}>Blog & Content Generator Queue</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {blogs.map((blog) => (
              <div
                key={blog.id}
                className="glow-card"
                style={{
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  borderColor: blog.status === 'pending_review' ? 'var(--warning)' : 'var(--border-color)',
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: '10px',
                      fontFamily: 'var(--font-mono)',
                      background: 'rgba(90, 82, 255, 0.1)',
                      color: 'var(--accent)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      marginRight: '8px',
                    }}
                  >
                    KEYWORDS: {blog.keywords}
                  </span>
                  <h4 style={{ fontSize: '15px', marginTop: '8px', color: '#fff' }}>{blog.title}</h4>
                </div>

                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{blog.excerpt}</p>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTop: '1px solid var(--border-color)',
                    paddingTop: '12px',
                  }}
                >
                  <span style={{ fontSize: '11px', color: blog.status === 'published' ? 'var(--success)' : 'var(--warning)' }}>
                    {blog.status === 'published' ? 'PUBLISHED' : 'PENDING APPROVAL'}
                  </span>

                  {blog.status === 'pending_review' ? (
                    <GlowButton variant="glow" onClick={() => onOpenReview(blog.id)} style={{ padding: '6px 14px', fontSize: '11px' }}>
                      Review Post
                    </GlowButton>
                  ) : (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Check size={12} /> Published to Site <ExternalLink size={10} />
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
