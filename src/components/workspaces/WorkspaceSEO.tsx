import React, { useState, useEffect } from 'react';
import { Globe, Check, ExternalLink, TrendingUp, ChevronDown, GitBranch, ShoppingBag, PenSquare } from 'lucide-react';
import { GlowButton } from '../GlowButton';
import { GitHubPanel } from './GitHubPanel';
import { ShopifyPanel } from './ShopifyPanel';
import { WordPressPanel } from './WordPressPanel';
import { SearchConsolePanel } from './SearchConsolePanel';
import { GA4Panel } from './GA4Panel';
import { SEOAgencyReportModal, type RunStatus } from '../SEOAgencyReportModal';

function authHeaders(): Record<string, string> {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

const IDLE_RUN: RunStatus = { status: 'idle', running: false, stages: [], stages_done: [], current_stage: null, started_at: null, target_url: null };

// Polls run-status continuously (fast while running, slow otherwise) so the report reflects
// the real backend state ΓÇö including a run started from another tab.
function useRunStatus(workspaceId: number | null | undefined, pipeline: 'SEO' | 'GEO'): [RunStatus, () => void] {
  const [status, setStatus] = useState<RunStatus>(IDLE_RUN);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!workspaceId) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = () => {
      fetch(`/api/workspaces/${workspaceId}/seo/run-status?pipeline=${pipeline}`, { headers: authHeaders() })
        .then(r => (r.ok ? r.json() : null))
        .then(d => {
          if (!alive) return;
          if (d) setStatus(d);
          const delay = d && (d.status === 'running' || d.status === 'queued') ? 2500 : 8000;
          timer = setTimeout(poll, delay);
        })
        .catch(() => { if (alive) timer = setTimeout(poll, 6000); });
    };
    poll();
    return () => { alive = false; clearTimeout(timer); };
  }, [workspaceId, pipeline, nonce]);

  return [status, () => setNonce(n => n + 1)];
}

// Month-over-month comparison card ΓÇö reads the /seo/comparison endpoint and shows the deltas
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
    dir === 'improved' ? { s: 'Γû▓', c: '#00ff9d' } :
    dir === 'worsened' ? { s: 'Γû╝', c: '#ff5c5c' } : { s: 'ΓÇô', c: 'var(--text-muted)' };
  const disp = (v: any) => (typeof v === 'boolean' ? (v ? 'Yes' : 'No') : (v ?? 'ΓÇö'));

  return (
    <div className="glow-card">
      <h3 style={{ fontSize: '16px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <TrendingUp size={16} style={{ color: '#00ff9d' }} /> Month-over-Month Change (SEO)
      </h3>
      {loading && <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>LoadingΓÇª</p>}
      {!loading && (!data || data.runs_available === 0) && (
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          No runs yet ΓÇö run the SEO pipeline to start building history.
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
            {new Date(data.previous_run.date).toLocaleDateString()} ΓåÆ {new Date(data.current_run.date).toLocaleDateString()}
            {'  ┬╖  Score '}{data.previous_run.score} ΓåÆ <b style={{ color: '#fff' }}>{data.current_run.score}</b>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.changes.map((c: any) => {
              const a = arrow(c.direction);
              return (
                <div key={c.metric} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{c.metric}</span>
                  <span style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{disp(c.previous)} ΓåÆ {disp(c.current)}</span>
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

// Explainer beside the Integration panel, so the audit column doesn't feel empty.
const ExplainerCard: React.FC = () => {
  const steps = [
    { n: 1, t: 'Run the pipeline', d: 'We crawl your live site and audit it for Google SEO + AI search (GEO).' },
    { n: 2, t: 'Real, measured fixes', d: 'Every suggestion comes from your actual page ΓÇö nothing is invented.' },
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

// Compact status-only summary of every platform connection. Full connect/manage controls
// live on the Integrations page (sidebar) ΓÇö this card exists so the user always sees, at a
// glance, why GitHub/WordPress/Shopify/Search Console/Analytics matter here, without the
// full connector UI crowding the main SEO page.
const ConnectedPlatformsCard: React.FC<{ workspaceId?: number | null; onManageIntegrations?: () => void }> = ({ workspaceId, onManageIntegrations }) => {
  const [st, setSt] = useState<{ gh?: any; wp?: any; sh?: any; gsc?: any }>({});

  useEffect(() => {
    if (!workspaceId) return;
    const token = localStorage.getItem('token');
    const h: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const get = (url: string) => fetch(url, { headers: h }).then(r => (r.ok ? r.json() : null)).catch(() => null);
    Promise.all([
      get(`/api/connectors/github/${workspaceId}/status`),
      get(`/api/connectors/wordpress/${workspaceId}/status`),
      get(`/api/connectors/shopify/${workspaceId}/status`),
      get(`/api/connectors/search-console/${workspaceId}/status`),
    ]).then(([gh, wp, sh, gsc]) => setSt({ gh, wp, sh, gsc }));
  }, [workspaceId]);

  const rows = [
    { key: 'gh', name: 'GitHub', Icon: GitBranch, connected: !!st.gh?.connected },
    { key: 'wp', name: 'WordPress', Icon: PenSquare, connected: !!st.wp?.connected },
    { key: 'sh', name: 'Shopify', Icon: ShoppingBag, connected: !!st.sh?.connected },
    { key: 'gsc', name: 'Google Search Console', Icon: Globe, connected: !!st.gsc?.connected },
    { key: 'ga4', name: 'Google Analytics', Icon: TrendingUp, connected: !!(st.gsc?.connected && st.gsc?.ga4_property_id) },
  ];

  const badge = (connected: boolean) => (
    <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', whiteSpace: 'nowrap',
      color: connected ? '#00ff9d' : 'var(--text-secondary)', background: connected ? 'rgba(0,255,157,0.1)' : 'rgba(255,255,255,0.05)',
      border: `1px solid ${connected ? 'rgba(0,255,157,0.35)' : 'var(--border-color)'}` }}>
      {connected ? 'Connected' : 'Not Connected'}
    </span>
  );

  return (
    <div className="glow-card">
      <h3 style={{ fontSize: '16px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ExternalLink size={16} style={{ color: '#00ff9d' }} /> Connected Platforms
      </h3>
      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 14px' }}>
        These are the platforms used to pull real data and apply approved fixes.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {rows.map(({ key, name, Icon, connected }) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '9px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
              <Icon size={14} style={{ color: connected ? '#00ff9d' : 'var(--text-muted)', flexShrink: 0 }} />
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
            </span>
            {badge(connected)}
          </div>
        ))}
      </div>

      <button onClick={onManageIntegrations}
        style={{ width: '100%', marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#fff', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', cursor: 'pointer' }}>
        <ExternalLink size={14} /> Manage Integrations
      </button>
    </div>
  );
};

// The "connect your website & data" hub ΓÇö reuses the already-built connector panels, each of
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
        Publish approved changes to your site, and pull in real Google rankings + traffic. Connect what you have ΓÇö the rest stay as placeholders until keys are added.
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
  blogs?: BlogDraft[];
  onOpenReview?: (itemId: string) => void;
  seoAgent?: any;
  geoAgent?: any;
  onTriggerSEO?: (url: string) => void;
  onTriggerGEO?: (url: string) => void;
  workspaceId?: number | null;
  siteUrl?: string; // the website already connected to this workspace (from onboarding) ΓÇö audits target this by default, not a placeholder
  onManageIntegrations?: () => void; // navigates to the sidebar's Integrations tab
}

export const WorkspaceSEO: React.FC<WorkspaceSEOProps> = ({ workspaceId, siteUrl, onManageIntegrations }) => {
  const [targetUrl, setTargetUrl] = useState('');
  const [urlEditedByUser, setUrlEditedByUser] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  // Default the audit target to the site already connected to this workspace ΓÇö siteUrl
  // arrives asynchronously (brand profile fetch), so pick it up once it loads. Never
  // overwrite a URL the user has deliberately typed themselves.
  useEffect(() => {
    if (!siteUrl || urlEditedByUser) return;
    const normalized = /^https?:\/\//i.test(siteUrl) ? siteUrl : `https://${siteUrl}`;
    setTargetUrl(normalized);
  }, [siteUrl, urlEditedByUser]);
  const [toast, setToast] = useState<{ msg: string; pipeline?: 'SEO' | 'GEO' } | null>(null);

  // Real connector status (already-existing endpoint) ΓÇö used only to show a status badge
  // on the audit report. Future audits will combine this data with Firecrawl + SEO
  // analysis; for now this is a badge only, nothing extra is fetched.
  const [gscConnected, setGscConnected] = useState(false);
  useEffect(() => {
    if (!workspaceId) return;
    fetch(`/api/connectors/search-console/${workspaceId}/status`, { headers: authHeaders() })
      .then(r => (r.ok ? r.json() : null)).then(d => setGscConnected(!!d?.connected)).catch(() => {});
  }, [workspaceId]);

  // One live run-status per pipeline ΓÇö the single source of truth for both the pipeline
  // graph highlighting below and the combined report modal. SEO and GEO stay two fully
  // independent pipelines (separate trigger, separate single-flight state, separate
  // scoring) but always render into the ONE report modal ΓÇö never a second report.
  const [seoRun, refreshSeoRun] = useRunStatus(workspaceId, 'SEO');
  const [geoRun, refreshGeoRun] = useRunStatus(workspaceId, 'GEO');
  const seoRunning = seoRun.status === 'running' || seoRun.status === 'queued';
  const geoRunning = geoRun.status === 'running' || geoRun.status === 'queued';

  const flash = (msg: string, ok = true) => { if (!ok) setToast({ msg }); };

  const triggerPipeline = async (pipeline: 'SEO' | 'GEO', url: string) => {
    if (!url.trim()) return;
    try {
      const r = await fetch(`/api/agents/${workspaceId}/${pipeline.toLowerCase()}`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ target_url: url }),
      });
      if (r.ok) {
        (pipeline === 'SEO' ? refreshSeoRun : refreshGeoRun)();
        setReportOpen(true); // the report updates live instead of the user having to go find it
      } else if (r.status === 409) {
        setToast({ msg: 'An audit is already running for this website.', pipeline });
        (pipeline === 'SEO' ? refreshSeoRun : refreshGeoRun)();
      } else {
        const d = await r.json().catch(() => ({}));
        setToast({ msg: d.detail || 'Could not start the audit.' });
      }
    } catch { setToast({ msg: 'Could not start the audit.' }); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      {toast && (
        <div style={{ position: 'fixed', top: '18px', right: '18px', zIndex: 7000, display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(24,26,34,0.98)', border: '1px solid rgba(255,174,0,0.35)', borderRadius: '10px', padding: '13px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', maxWidth: '360px' }}>
          <span style={{ fontSize: '13px', color: '#fff', flex: 1 }}>{toast.msg}</span>
          {toast.pipeline && (
            <button onClick={() => { setToast(null); setReportOpen(true); }} style={{ fontSize: '12px', fontWeight: 700, color: '#ffae00', background: 'rgba(255,174,0,0.1)', border: '1px solid rgba(255,174,0,0.4)', borderRadius: '7px', padding: '6px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>View Running Audit</button>
          )}
          <button onClick={() => setToast(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0, fontSize: '14px' }}>Γ£ò</button>
        </div>
      )}

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
            onChange={(e) => { setTargetUrl(e.target.value); setUrlEditedByUser(true); }}
            placeholder="Target URL..."
            style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', fontSize: '13px', width: '200px' }}
          />
          <button onClick={() => setReportOpen(true)}
            style={{ fontSize: '12.5px', fontWeight: 600, color: '#fff', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '9px 15px', cursor: 'pointer' }}>
            View Report
          </button>
          <GlowButton variant="glow" disabled={seoRunning}
            onClick={() => seoRunning ? setToast({ msg: 'An audit is already running for this website.', pipeline: 'SEO' }) : triggerPipeline('SEO', targetUrl)}
            style={seoRunning ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
            {seoRunning ? 'SEO RunningΓÇª' : 'Run SEO Pipeline'}
          </GlowButton>
        </div>
      </div>

      {/* SEO & GEO Pipelines ΓÇö clicking any node opens/focuses the one combined report below */}
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
              const isActive = seoRunning && seoRun.current_stage === node;
              const isCompleted = seoRun.stages_done.includes(node);

              return (
              <div key={node} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div onClick={() => setReportOpen(true)} style={{
                  cursor: 'pointer',
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
                {idx < arr.length - 1 && <span style={{ color: isActive ? 'var(--success)' : 'var(--text-muted)', fontSize: '11px' }}>ΓåÆ</span>}
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
            <GlowButton variant="glow" disabled={geoRunning}
              onClick={() => geoRunning ? setToast({ msg: 'An audit is already running for this website.', pipeline: 'GEO' }) : triggerPipeline('GEO', targetUrl)}
              style={{ fontSize: '11px', padding: '4px 12px', ...(geoRunning ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}>
              {geoRunning ? 'GEO RunningΓÇª' : 'Run GEO Pipeline'}
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
              'Reporting',
            ].map((node, idx, arr) => {
              const isActive = geoRunning && geoRun.current_stage === node;
              const isCompleted = geoRun.stages_done.includes(node);

              return (
              <div key={node} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div onClick={() => setReportOpen(true)} style={{
                  cursor: 'pointer',
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
                {idx < arr.length - 1 && <span style={{ color: isActive || isCompleted ? '#fff' : 'var(--text-muted)', fontSize: '11px' }}>ΓåÆ</span>}
              </div>
            )})}
          </div>
        </div>
      </div>

      {/* Explainer card beside the Integration Connections panel */}
      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '2 1 460px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <ExplainerCard />
          {/* Search Console + GA4 are analytics/tracking sources ΓÇö they feed the month-over-month tracking below. */}
          <div className="glow-card">
            <h3 style={{ fontSize: '16px', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={16} style={{ color: '#00ff9d' }} /> Search Console &amp; Analytics
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 14px' }}>
              Connect Google Search Console &amp; GA4 to pull real rankings, clicks and traffic ΓÇö this powers the performance tracking below.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <SearchConsolePanel workspaceId={workspaceId ?? null} onRunAudit={() => triggerPipeline('SEO', targetUrl)} />
              <GA4Panel workspaceId={workspaceId ?? null} />
            </div>
          </div>
          <SeoComparisonCard workspaceId={workspaceId} />
        </div>
        <div style={{ flex: '1 1 300px', minWidth: 0 }}>
          <ConnectedPlatformsCard workspaceId={workspaceId} onManageIntegrations={onManageIntegrations} />
        </div>
      </div>

      <SEOAgencyReportModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        workspaceId={workspaceId ?? null}
        seoRun={seoRun}
        geoRun={geoRun}
        onRunRequested={triggerPipeline}
        flash={flash}
        gscConnected={gscConnected}
      />
    </div>
  );
};
