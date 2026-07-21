import React, { useState, useEffect } from 'react';
import { Globe, Check, ExternalLink, TrendingUp } from 'lucide-react';
import { GlowButton } from '../GlowButton';
import { Markdown } from '../Markdown';

// Month-over-month comparison card — reads the /seo/comparison endpoint and shows the deltas
// between the two most recent runs (the "monthly analysis" view).
const SeoComparisonCard: React.FC<{ workspaceId?: number | null }> = ({ workspaceId }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;
    setLoading(true);
    const token = localStorage.getItem('token');
    fetch(`/api/workspaces/${workspaceId}/seo/comparison?pipeline=SEO`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(r => (r.ok ? r.json() : null))
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [workspaceId]);

  if (!workspaceId) return null;

  const arrow = (dir?: string) =>
    dir === 'improved' ? { s: '▲', c: '#00ff9d' } :
    dir === 'worsened' ? { s: '▼', c: '#ff5c5c' } : { s: '–', c: 'var(--text-muted)' };
  const disp = (v: any) => (typeof v === 'boolean' ? (v ? 'Yes' : 'No') : (v ?? '—'));

  return (
    <div className="glow-card">
      <h3 style={{ fontSize: '16px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <TrendingUp size={16} style={{ color: '#00ff9d' }} /> Month-over-Month Change (SEO)
      </h3>
      {loading && <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Loading…</p>}
      {!loading && (!data || data.runs_available === 0) && (
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          No runs yet — run the SEO pipeline to start building history.
        </p>
      )}
      {!loading && data && data.runs_available === 1 && (
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          First run recorded. The comparison appears automatically after the next run.
        </p>
      )}
      {!loading && data && data.runs_available > 1 && (
        <>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            {new Date(data.previous_run.date).toLocaleDateString()} → {new Date(data.current_run.date).toLocaleDateString()}
            {'  ·  Score '}{data.previous_run.score} → <b style={{ color: '#fff' }}>{data.current_run.score}</b>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.changes.map((c: any) => {
              const a = arrow(c.direction);
              return (
                <div key={c.metric} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{c.metric}</span>
                  <span style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{disp(c.previous)} → {disp(c.current)}</span>
                    <span style={{ color: a.c, fontWeight: 600, minWidth: '48px', textAlign: 'right' }}>
                      {a.s}{typeof c.delta === 'number' ? ` ${c.delta > 0 ? '+' : ''}${c.delta}` : ''}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

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
  seoAgent?: any;
  geoAgent?: any;
  onTriggerSEO: (url: string) => void;
  onTriggerGEO: (url: string) => void;
  workspaceId?: number | null;
}

export const WorkspaceSEO: React.FC<WorkspaceSEOProps> = ({ blogs, onOpenReview, seoAgent, geoAgent, onTriggerSEO, onTriggerGEO, workspaceId }) => {
  const [targetUrl, setTargetUrl] = useState('https://example.com');
  const [rankings] = useState([
    { engine: 'Google Search index', score: 82, trend: '+4%' },
    { engine: 'ChatGPT / OpenAI index', score: 68, trend: '+12%' },
    { engine: 'Claude AI Citation Graph', score: 71, trend: '+2%' },
    { engine: 'Gemini Search Citation', score: 59, trend: '+8%' },
    { engine: 'Perplexity Engine Citation', score: 64, trend: '+15%' },
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>SEO + GEO/AEO Dominance</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Dominate search lists on Google AND answer outputs on LLMs (ChatGPT, Claude, Gemini, Perplexity) using automated entity optimizations.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input 
            type="text" 
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="Target URL..."
            style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', fontSize: '13px', width: '200px' }}
          />
          <GlowButton variant="glow" onClick={() => onTriggerSEO(targetUrl)}>
            Run SEO Pipeline
          </GlowButton>
        </div>
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
            ].map((node, idx, arr) => {
              const isActive = seoAgent?.task?.includes(node);
              const isCompleted = seoAgent?.result === 'COMPLETED' || (seoAgent?.task && !isActive && arr.indexOf(seoAgent.task.replace('Running Node: ', '')) > idx);

              return (
              <div key={node} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  background: isActive ? 'rgba(0, 255, 157, 0.2)' : isCompleted ? 'rgba(0, 255, 157, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                  border: isActive ? '1px solid var(--success)' : isCompleted ? '1px solid rgba(0, 255, 157, 0.5)' : '1px solid var(--border-color)',
                  borderRadius: '4px',
                  padding: '6px 10px',
                  fontSize: '10px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: isActive || isCompleted ? '#fff' : 'var(--text-secondary)',
                  boxShadow: isActive ? '0 0 10px rgba(0, 255, 157, 0.3)' : 'none',
                  transition: 'all 0.3s ease'
                }}>
                  {isActive && <span className="badge-pulse success" style={{ width: '4px', height: '4px', backgroundColor: 'var(--success)' }} />}
                  {isCompleted && !isActive && <Check size={10} color="var(--success)" />}
                  <span>{node}</span>
                </div>
                {idx < arr.length - 1 && <span style={{ color: isActive ? 'var(--success)' : 'var(--text-muted)', fontSize: '11px' }}>→</span>}
              </div>
            )})}
          </div>
        </div>

        {/* GEO/AEO Pipeline */}
        <div className="glow-card" style={{ padding: '20px', background: 'rgba(90, 82, 255, 0.01)', border: '1px solid rgba(90, 82, 255, 0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
              AEO / GEO CITATIONS PIPELINE GRAPH
            </h3>
            <GlowButton variant="glow" onClick={() => onTriggerGEO(targetUrl)} style={{ fontSize: '11px', padding: '4px 12px' }}>
              Run GEO Pipeline
            </GlowButton>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
            {[
              'Entity Agent',
              'Citation Agent',
              'Prompt Visibility Agent',
              'LLM Ranking Agent',
              'Authority Agent',
              'Knowledge Graph Agent',
              'Optimization Agent',
            ].map((node, idx, arr) => {
              const isActive = geoAgent?.task?.includes(node);
              const isCompleted = geoAgent?.result === 'COMPLETED' || (geoAgent?.task && !isActive && arr.indexOf(geoAgent.task.replace('Running Node: ', '')) > idx);
              
              return (
              <div key={node} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  background: isActive ? 'rgba(90, 82, 255, 0.2)' : isCompleted ? 'rgba(0, 255, 157, 0.1)' : 'rgba(90, 82, 255, 0.05)',
                  border: `1px solid ${isActive ? '#5a52ff' : isCompleted ? '#00ff9d' : 'var(--accent)'}`,
                  borderRadius: '4px',
                  padding: '6px 10px',
                  fontSize: '10px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: isActive ? '#fff' : isCompleted ? '#00ff9d' : '#fff'
                }}>
                  <span className={isActive ? "badge-pulse warning" : isCompleted ? "badge-pulse success" : ""} style={{ width: '4px', height: '4px', backgroundColor: isActive ? '#ffae00' : isCompleted ? '#00ff9d' : 'var(--accent)', display: isActive || isCompleted ? 'block' : 'none' }} />
                  <span>{node}</span>
                </div>
                {idx < arr.length - 1 && <span style={{ color: isActive || isCompleted ? '#fff' : 'var(--text-muted)', fontSize: '11px' }}>→</span>}
              </div>
            )})}
          </div>
        </div>
      </div>

      <div className="workspace-grid-split">
        {/* Left Side: SEO Crawl & AEO Citation Indexes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <SeoComparisonCard workspaceId={workspaceId} />

          <div className="glow-card">
            <h3 style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Globe size={16} style={{ color: '#00ff9d' }} />
              Answer Engine Citation (AEO) Index
              <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px', color: '#ffae00', background: 'rgba(255,174,0,0.12)', border: '1px solid rgba(255,174,0,0.3)', borderRadius: '6px', padding: '2px 6px' }}>SAMPLE</span>
            </h3>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '-8px', marginBottom: '14px' }}>
              Illustrative figures. Run a GEO audit for a real, measured answer-engine recall probe.
            </p>

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
            <h3 style={{ fontSize: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              AEO Recommendation Engine
              <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px', color: '#ffae00', background: 'rgba(255,174,0,0.12)', border: '1px solid rgba(255,174,0,0.3)', borderRadius: '6px', padding: '2px 6px' }}>SAMPLE</span>
            </h3>
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '8px' }}>
              <h4 style={{ fontSize: '13px', color: '#ffae00', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                Example recommendation
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                This is an illustrative example of the entity/schema gaps a GEO audit surfaces. Run a GEO audit above to get real, brand-specific recommendations for your site.
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

                <div style={{ fontSize: '13px', maxHeight: '420px', overflowY: 'auto', paddingRight: '8px' }}>
                  <Markdown text={blog.excerpt} />
                </div>

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
