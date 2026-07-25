import React, { useState, useEffect } from 'react';
import { Globe, Check, ExternalLink, TrendingUp, ChevronDown, AlertTriangle, Zap, Target, RefreshCw, GitBranch, ShoppingBag, PenSquare, X, ShieldCheck, Lock } from 'lucide-react';
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

// The audit section (restored to the original): Website Health scores + SEO & GEO category
// breakdowns + Top fixes. Real pipeline data only.
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

// Human Review: every audit suggestion gets Approve / Edit / Reject. Nothing is applied
// automatically — this is the review step before the user goes and makes the change.
const HumanReview: React.FC<{ workspaceId?: number | null }> = ({ workspaceId }) => {
  const [issues, setIssues] = useState<any[]>([]);
  const [hasAudit, setHasAudit] = useState(false);
  const [state, setState] = useState<Record<number, { status: 'pending' | 'approved' | 'rejected' | 'editing' | 'edited'; text: string }>>({});
  const [open, setOpen] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!workspaceId) return;
    const token = localStorage.getItem('token');
    fetch(`/api/workspaces/${workspaceId}/seo/latest-audit`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { const a = d?.audit; setHasAudit(!!a); setIssues(a ? (a.priority_issues || a.top_5_issues || []) : []); })
      .catch(() => {});
  }, [workspaceId]);

  // Locked until the first audit has run.
  if (!hasAudit) {
    return (
      <div className="glow-card" style={{ textAlign: 'center', padding: '30px 20px', borderStyle: 'dashed' }}>
        <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <Lock size={20} style={{ color: 'var(--text-muted)' }} />
        </div>
        <h3 style={{ fontSize: '16px', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
          <ShieldCheck size={16} style={{ color: 'var(--text-muted)' }} /> Human Review <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.4px' }}>LOCKED</span>
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: '460px', margin: '0 auto' }}>
          Run your first <b style={{ color: '#fff' }}>SEO + GEO pipeline</b> to unlock Human Review. Once the audit is ready,
          you'll approve, edit or reject each suggestion here before applying it to your site.
        </p>
      </div>
    );
  }

  if (!issues.length) {
    return (
      <div className="glow-card">
        <h3 style={{ fontSize: '16px', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={16} style={{ color: '#00ff9d' }} /> Human Review
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No fixes to review — your latest audit found no prioritized issues. 🎉</p>
      </div>
    );
  }

  const cur = (i: number) => state[i] || { status: 'pending' as const, text: issues[i].issue };
  const patch = (i: number, p: Partial<{ status: any; text: string }>) => setState(s => ({ ...s, [i]: { ...cur(i), ...p } }));
  const toggle = (i: number) => setOpen(o => ({ ...o, [i]: !o[i] }));

  const count = (st: string) => issues.filter((_, i) => cur(i).status === st).length;
  const approved = count('approved'), edited = count('edited'), rejected = count('rejected');
  const pending = issues.length - approved - edited - rejected;
  const chip = (label: string, n: number, color: string) => (
    <span style={{ fontSize: '11px', fontWeight: 600, color, background: `${color}1a`, border: `1px solid ${color}55`, borderRadius: '20px', padding: '3px 10px' }}>{n} {label}</span>
  );
  const accentOf = (s: string) => s === 'approved' ? '#00ff9d' : s === 'edited' ? '#8B85FF' : s === 'rejected' ? '#ff5c5c' : '#ffae00';

  return (
    <div className="glow-card">
      <h3 style={{ fontSize: '16px', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ShieldCheck size={16} style={{ color: '#00ff9d' }} /> Human Review
      </h3>
      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
        Click a suggestion to open it, then Approve, Edit, or Reject. Nothing is applied automatically.
      </p>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {chip('approved', approved, '#00ff9d')}
        {chip('edited', edited, '#8B85FF')}
        {chip('rejected', rejected, '#ff5c5c')}
        {chip('pending', pending, '#ffae00')}
      </div>

      {/* horizontal grid; each suggestion is a collapsible card that opens on click */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px', alignItems: 'start' }}>
        {issues.map((it: any, i: number) => {
          const c = cur(i);
          const isOpen = !!open[i];
          const accent = accentOf(c.status);
          return (
            <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${c.status === 'pending' ? 'var(--border-color)' : accent}`, borderLeft: `3px solid ${accent}`, borderRadius: '10px', overflow: 'hidden' }}>
              <button onClick={() => toggle(i)} style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', padding: '11px 13px', display: 'flex', alignItems: 'center', gap: '9px', color: '#fff', font: 'inherit' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, flexShrink: 0, color: SEV_COLOR[it.severity] || '#fff', background: `${SEV_COLOR[it.severity] || '#fff'}1f`, border: `1px solid ${SEV_COLOR[it.severity] || '#fff'}55`, borderRadius: '5px', padding: '2px 7px' }}>{it.severity}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: '12.5px', whiteSpace: isOpen ? 'normal' : 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: c.status === 'rejected' ? 'line-through' : 'none' }}>{c.text}</span>
                {c.status !== 'pending' && <span title={c.status} style={{ width: '8px', height: '8px', borderRadius: '50%', background: accent, flexShrink: 0 }} />}
                <ChevronDown size={15} style={{ flexShrink: 0, color: 'var(--text-secondary)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
              </button>

              {isOpen && (
                <div style={{ padding: '0 13px 13px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '9px' }}>{it.area}</div>
                  {c.status === 'editing' ? (
                    <>
                      <textarea value={c.text} onChange={e => patch(i, { text: e.target.value })}
                        style={{ width: '100%', minHeight: '64px', resize: 'vertical', fontSize: '13px', color: '#fff', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '9px 11px', fontFamily: 'inherit' }} />
                      <div style={{ display: 'flex', gap: '8px', marginTop: '9px' }}>
                        <button onClick={() => patch(i, { status: 'edited' })} style={{ fontSize: '12px', fontWeight: 600, color: '#03121a', background: '#8B85FF', border: 'none', borderRadius: '7px', padding: '6px 13px', cursor: 'pointer' }}>Save</button>
                        <button onClick={() => patch(i, { status: 'pending' })} style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '7px', padding: '6px 13px', cursor: 'pointer' }}>Cancel</button>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button onClick={() => patch(i, { status: 'approved' })}
                        style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, color: c.status === 'approved' ? '#03121a' : '#00ff9d', background: c.status === 'approved' ? '#00ff9d' : 'rgba(0,255,157,0.08)', border: '1px solid rgba(0,255,157,0.35)', borderRadius: '7px', padding: '6px 12px', cursor: 'pointer' }}>
                        <Check size={13} /> Approve
                      </button>
                      <button onClick={() => patch(i, { status: 'editing' })}
                        style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, color: '#8B85FF', background: 'rgba(90,82,255,0.1)', border: '1px solid rgba(90,82,255,0.35)', borderRadius: '7px', padding: '6px 12px', cursor: 'pointer' }}>
                        <PenSquare size={13} /> Edit
                      </button>
                      <button onClick={() => patch(i, { status: 'rejected' })}
                        style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, color: c.status === 'rejected' ? '#03121a' : '#ff5c5c', background: c.status === 'rejected' ? '#ff5c5c' : 'rgba(255,92,92,0.08)', border: '1px solid rgba(255,92,92,0.35)', borderRadius: '7px', padding: '6px 12px', cursor: 'pointer' }}>
                        <X size={13} /> Reject
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Explainer beside the Integration panel, so the audit column doesn't feel empty.
const ExplainerCard: React.FC = () => {
  const steps = [
    { n: 1, t: 'Run the pipeline', d: 'We crawl your live site and audit it for Google SEO + AI search (GEO).' },
    { n: 2, t: 'Real, measured fixes', d: 'Every suggestion comes from your actual page — nothing is invented.' },
    { n: 3, t: 'Human review', d: 'Approve, edit, or reject each suggestion below. Nothing auto-applies.' },
    { n: 4, t: 'Make the changes', d: 'Open GitHub / Shopify / WordPress on the right and apply the approved fixes.' },
    { n: 5, t: 'Re-run & track', d: 'Deploy, then re-run to watch your scores improve over time.' },
  ];
  return (
    <div className="glow-card">
      <h3 style={{ fontSize: '16px', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Globe size={16} style={{ color: '#00ff9d' }} /> How SEO + GEO works here
      </h3>
      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
        The workflow, from audit to live changes.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {steps.map(s => (
          <div key={s.n} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <span style={{ flexShrink: 0, width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(0,255,157,0.12)', border: '1px solid rgba(0,255,157,0.35)', color: '#00ff9d', fontSize: '12px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.n}</span>
            <span>
              <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 600, color: '#fff' }}>{s.t}</span>
              <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{s.d}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Sits in the audit section: once you've read the fixes above, jump straight to the platform
// where your site lives (GitHub repo / WordPress admin / Shopify admin), make the changes,
// deploy, then re-run the pipeline to see the new scores. Nothing here reads or edits code —
// it only links out to where you edit, and re-triggers the audit.
const ApplyChangesCard: React.FC<{ workspaceId?: number | null; onRerun: () => void; onConnect: () => void }> = ({ workspaceId, onRerun, onConnect }) => {
  const [st, setSt] = useState<{ gh?: any; wp?: any; sh?: any }>({});

  useEffect(() => {
    if (!workspaceId) return;
    const token = localStorage.getItem('token');
    const h: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const get = (p: string) => fetch(`/api/connectors/${p}/${workspaceId}/status`, { headers: h }).then(r => (r.ok ? r.json() : null)).catch(() => null);
    Promise.all([get('github'), get('wordpress'), get('shopify')]).then(([gh, wp, sh]) => setSt({ gh, wp, sh }));
  }, [workspaceId]);

  const rows = [
    { key: 'gh', name: 'GitHub', sub: st.gh?.repo_full_name || 'Select a repo', Icon: GitBranch, connected: !!st.gh?.connected,
      url: st.gh?.repo_full_name ? `https://github.com/${st.gh.repo_full_name}` : null },
    { key: 'sh', name: 'Shopify Store', sub: st.sh?.shop_name || st.sh?.shop_domain || 'Connect store', Icon: ShoppingBag, connected: !!st.sh?.connected,
      url: st.sh?.shop_domain ? `https://${st.sh.shop_domain}/admin` : null },
    { key: 'wp', name: 'WordPress Admin', sub: st.wp?.site_name || st.wp?.site_url || 'Connect site', Icon: PenSquare, connected: !!st.wp?.connected,
      url: st.wp?.site_url ? `${String(st.wp.site_url).replace(/\/$/, '')}/wp-admin` : null },
  ];

  const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '11px 13px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', cursor: 'pointer', textDecoration: 'none', width: '100%', textAlign: 'left', font: 'inherit' };
  const badge = (connected: boolean) => (
    <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', whiteSpace: 'nowrap',
      color: connected ? '#00ff9d' : '#ffae00', background: connected ? 'rgba(0,255,157,0.1)' : 'rgba(255,174,0,0.1)',
      border: `1px solid ${connected ? 'rgba(0,255,157,0.35)' : 'rgba(255,174,0,0.35)'}` }}>
      {connected ? 'Connected' : 'Pending Setup'}
    </span>
  );

  return (
    <div className="glow-card">
      <h3 style={{ fontSize: '16px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ExternalLink size={16} style={{ color: '#00ff9d' }} /> Integration Connections &amp; Access
      </h3>
      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 14px' }}>
        Open the platform where your site lives, apply the fixes, deploy, then re-run the audit.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {rows.map(({ key, name, sub, Icon, connected, url }) => {
          const inner = (
            <>
              <span style={{ display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0 }}>
                <span style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={16} style={{ color: connected ? '#00ff9d' : 'var(--text-muted)' }} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {name} <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>({sub})</span>
                  </span>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)' }}>Open to Edit</span>
                </span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '9px', flexShrink: 0 }}>
                {badge(connected)}
                <ExternalLink size={14} style={{ color: 'var(--text-secondary)' }} />
              </span>
            </>
          );
          return connected && url
            ? <a key={key} href={url} target="_blank" rel="noreferrer" style={rowStyle}>{inner}</a>
            : <button key={key} onClick={onConnect} style={rowStyle}>{inner}</button>;
        })}
      </div>

      <button onClick={onRerun}
        style={{ width: '100%', marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13.5px', fontWeight: 700, color: '#03121a', background: '#00ff9d', border: 'none', borderRadius: '10px', padding: '12px', cursor: 'pointer' }}>
        <RefreshCw size={15} /> Re-run SEO + GEO pipeline
      </button>
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

      {/* Strategy-report cards from the pipeline (each with a Review Post action) — below the AEO/GEO citations pipeline container */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {blogs.filter((blog) => blog.status === 'pending_review').map((blog) => (
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

      {/* Audit section (SEO + GEO) — appears after running the pipeline, above the guide/integration */}
      <AuditResults workspaceId={workspaceId} />

      {/* Explainer card beside the Integration Connections panel */}
      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '2 1 460px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <ExplainerCard />
          {/* Search Console + GA4 are analytics/tracking sources — they feed the month-over-month tracking below. */}
          <div className="glow-card">
            <h3 style={{ fontSize: '16px', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={16} style={{ color: '#00ff9d' }} /> Search Console &amp; Analytics
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 14px' }}>
              Connect Google Search Console &amp; GA4 to pull real rankings, clicks and traffic — this powers the performance tracking below.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <SearchConsolePanel workspaceId={workspaceId ?? null} />
              <GA4Panel workspaceId={workspaceId ?? null} />
            </div>
          </div>
          <SeoComparisonCard workspaceId={workspaceId} />
        </div>
        <div style={{ flex: '1 1 300px', minWidth: 0 }}>
          <ApplyChangesCard
            workspaceId={workspaceId}
            onRerun={() => { const u = targetUrl.trim(); if (u) { onTriggerSEO(u); onTriggerGEO(u); } }}
            onConnect={() => document.getElementById('seo-connect-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          />
        </div>
      </div>

    </div>
  );
};
