import React, { useState, useEffect } from 'react';
import { Globe, Check, ExternalLink, TrendingUp, ChevronDown, AlertTriangle, Zap, Target } from 'lucide-react';
import { GlowButton } from '../GlowButton';
import { Markdown } from '../Markdown';
import { GitHubPanel } from './GitHubPanel';
import { ShopifyPanel } from './ShopifyPanel';
import { WordPressPanel } from './WordPressPanel';
import { SearchConsolePanel } from './SearchConsolePanel';
import { GA4Panel } from './GA4Panel';

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

// ─────────────────────────────────────────────── audit results (real, from the pipeline)
const scoreColor = (v: number) => (v >= 80 ? '#00ff9d' : v >= 55 ? '#ffae00' : '#ff5c5c');
const SEV_COLOR: Record<string, string> = { Critical: '#ff5c5c', High: '#ff8a5c', Medium: '#ffae00', Low: '#00ff9d' };

const ScoreBadge: React.FC<{ label: string; value: number; sub?: string }> = ({ label, value, sub }) => (
  <div style={{ flex: 1, minWidth: '104px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px 12px', textAlign: 'center' }}>
    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>{label}</div>
    <div style={{ fontSize: '28px', fontWeight: 800, color: scoreColor(value), lineHeight: 1 }}>
      {value}<span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>/100</span>
    </div>
    {sub && <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '6px' }}>{sub}</div>}
  </div>
);

const CategoryBar: React.FC<{ c: any }> = ({ c }) => {
  const verified = c.status === 'verified';
  const pct = verified && c.max ? Math.round((c.score / c.max) * 100) : 0;
  return (
    <div style={{ marginBottom: '10px' }} title={c.reason || ''}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
        <span style={{ color: 'var(--text-secondary)' }}>{c.name}</span>
        <span style={{ color: verified ? '#fff' : 'var(--text-muted)', fontWeight: 600 }}>
          {verified ? `${c.score}/${c.max}` : 'Not Verified'}
        </span>
      </div>
      <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: verified ? scoreColor(pct) : 'var(--text-muted)', borderRadius: '4px', transition: 'width .5s ease' }} />
      </div>
    </div>
  );
};

// Reads the pipeline's structured audit and shows it in plain language. Falls back to a clear
// "run an audit" state — never invented numbers.
const AuditResults: React.FC<{ workspaceId?: number | null }> = ({ workspaceId }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) { setLoading(false); return; }
    const token = localStorage.getItem('token');
    fetch(`/api/workspaces/${workspaceId}/seo/latest-audit`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => (r.ok ? r.json() : null)).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [workspaceId]);

  if (loading) return <div className="glow-card"><p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Loading your audit…</p></div>;

  if (!data || !data.has_audit) {
    return (
      <div className="glow-card">
        <h3 style={{ fontSize: '16px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Target size={16} style={{ color: '#00ff9d' }} /> Your SEO / GEO Health
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          No audit yet. Enter your site URL above and click <b style={{ color: '#fff' }}>Run SEO Pipeline</b>.
          You'll get real, measured scores for content, metadata, technical SEO, performance, accessibility and
          structured data — plus how visible you are on AI answer engines (ChatGPT, Claude, Gemini, Perplexity).
        </p>
      </div>
    );
  }

  const a = data.audit;
  const recall = a.geo?.llm_recall;
  const when = data.created_at ? new Date(data.created_at).toLocaleDateString() : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="glow-card">
        <h3 style={{ fontSize: '16px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Target size={16} style={{ color: '#00ff9d' }} /> Your Website Health
          {when && <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-secondary)' }}>as of {when}</span>}
        </h3>
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 14px' }}>
          {a.target_url} · every point below is measured from your live site — nothing estimated.
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <ScoreBadge label="Overall" value={a.overall_health} />
          <ScoreBadge label="SEO · Google" value={a.seo.score_100} />
          <ScoreBadge label="GEO · AI search" value={a.geo.score_100} />
        </div>
        {recall && (
          <div style={{ marginTop: '14px', padding: '12px 14px', background: 'rgba(90,82,255,0.06)', border: '1px solid rgba(90,82,255,0.2)', borderRadius: '10px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <Zap size={13} style={{ color: '#8B85FF' }} /> How you show up on AI search
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              {recall.brand_recognised ? 'Your brand is recognised' : 'Your brand is not yet recognised'} by AI answer engines when asked about your space.
              {recall.model_response ? ` "${String(recall.model_response).slice(0, 160)}…"` : ''}
            </p>
          </div>
        )}
      </div>

      {[{ sec: a.seo, title: 'SEO breakdown · Google', hint: 'How well Google can find, read and rank your pages.' },
        { sec: a.geo, title: 'GEO breakdown · AI answer engines', hint: 'How likely LLMs are to cite you in their answers.' }].map(({ sec, title, hint }) => (
        <div key={title} className="glow-card">
          <h3 style={{ fontSize: '15px', marginBottom: '2px' }}>{title}
            <span style={{ float: 'right', fontSize: '15px', fontWeight: 800, color: scoreColor(sec.score_100) }}>{sec.score_100}/100</span>
          </h3>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 14px' }}>{hint}</p>
          {sec.categories.map((c: any) => <CategoryBar key={c.name} c={c} />)}
        </div>
      ))}

      {a.top_5_issues?.length > 0 && (
        <div className="glow-card">
          <h3 style={{ fontSize: '15px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={15} style={{ color: '#ffae00' }} /> Top fixes to make (biggest impact first)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {a.top_5_issues.map((it: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '13px' }}>
                <span style={{ flexShrink: 0, fontSize: '10px', fontWeight: 700, color: SEV_COLOR[it.severity] || '#fff', background: `${SEV_COLOR[it.severity] || '#fff'}1f`, border: `1px solid ${SEV_COLOR[it.severity] || '#fff'}55`, borderRadius: '5px', padding: '2px 7px', marginTop: '1px' }}>{it.severity}</span>
                <div>
                  <div style={{ color: '#fff' }}>{it.issue}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{it.area}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// The "connect your website & data" hub — reuses the already-built connector panels, each of
// which shows its own connect / "keys missing" placeholder state.
const ConnectSection: React.FC<{ workspaceId?: number | null }> = ({ workspaceId }) => {
  const [open, setOpen] = useState(true);
  const wid = workspaceId ?? null;
  return (
    <div className="glow-card">
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 0, color: '#fff' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: 600 }}>
          <Globe size={16} style={{ color: '#00ff9d' }} /> Connect your website &amp; data sources
        </span>
        <ChevronDown size={18} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s', color: 'var(--text-secondary)' }} />
      </button>
      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '6px 0 0' }}>
        Publish approved changes to your site, and pull in real Google rankings + traffic. Connect what you have — the rest stay as placeholders until keys are added.
      </p>
      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginTop: '16px' }}>
          <GitHubPanel workspaceId={wid} />
          <ShopifyPanel workspaceId={wid} />
          <WordPressPanel workspaceId={wid} />
          <SearchConsolePanel workspaceId={wid} />
          <GA4Panel workspaceId={wid} />
        </div>
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

      {/* Connect your website & data sources (inside the SEO workspace) */}
      <ConnectSection workspaceId={workspaceId} />

      <div className="workspace-grid-split">
        {/* Left Side: real audit results + month-over-month growth */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <AuditResults workspaceId={workspaceId} />
          <SeoComparisonCard workspaceId={workspaceId} />
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
