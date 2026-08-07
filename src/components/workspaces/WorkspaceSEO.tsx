import React, { useState, useEffect } from 'react';
import {
  Globe, Check, ExternalLink, TrendingUp, GitBranch, ShoppingBag, PenSquare,
  Search, ShieldCheck, Lightbulb, FileText, Link2, Wrench, Sparkles, ClipboardList,
  Radar, MessageSquare, Eye, Star, Network, Wand2,
} from 'lucide-react';
import { GlowButton } from '../GlowButton';
import { SearchConsolePanel } from './SearchConsolePanel';
import { GA4Panel } from './GA4Panel';
import { SEOAgencyReportModal, type RunStatus } from '../SEOAgencyReportModal';

function authHeaders(): Record<string, string> {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

const IDLE_RUN: RunStatus = { status: 'idle', running: false, stages: [], stages_done: [], current_stage: null, started_at: null, target_url: null };

// Plain-language display labels for the pipeline graph nodes. `key` MUST stay the exact
// backend stage name (SEO_STAGES/GEO_STAGES in agents/seo_geo.py) since that's what
// current_stage/stages_done match against for live status — only `label`/`description`/
// `Icon` are user-facing. Terminology only: the pill layout, spacing, colors and click
// behavior are unchanged — `description` shows as a hover tooltip so it never affects the
// compact layout.
const SEO_STAGE_LABELS: { key: string; label: string; description: string; Icon: React.ElementType }[] = [
  { key: 'Crawler Agent', label: 'Website Scan', description: 'We scan every page of your website', Icon: Search },
  { key: 'Technical SEO Agent', label: 'SEO Check', description: 'Checking technical health and search readiness', Icon: ShieldCheck },
  { key: 'Keyword Agent', label: 'Keyword Opportunities', description: 'Finding what your customers search for', Icon: Lightbulb },
  { key: 'Content Strategy Agent', label: 'Content Review', description: 'Reviewing your content for clarity and value', Icon: FileText },
  { key: 'Internal Linking Agent', label: 'Link Review', description: 'Checking how your pages connect internally', Icon: Link2 },
  { key: 'Backlink Agent', label: 'Backlink Check', description: 'Checking who links to your website', Icon: ExternalLink },
  { key: 'Schema Agent', label: 'Website Improvements', description: 'Applying fixes to boost your rankings', Icon: Wrench },
  { key: 'Publishing Agent', label: 'Final Check', description: 'Double-checking everything before your report', Icon: Sparkles },
  { key: 'Reporting Agent', label: 'SEO Report', description: 'Your full report with clear next steps', Icon: ClipboardList },
];

const GEO_STAGE_LABELS: { key: string; label: string; description: string; Icon: React.ElementType }[] = [
  { key: 'Entity Agent', label: 'Brand Scan', description: 'Scanning how AI understands your brand', Icon: Radar },
  { key: 'Citation Agent', label: 'AI Mentions', description: 'Checking where AI tools mention you', Icon: MessageSquare },
  { key: 'Prompt Visibility Agent', label: 'AI Visibility', description: 'Measuring how visible you are in AI answers', Icon: Eye },
  { key: 'LLM Ranking Agent', label: 'Brand Trust', description: 'Checking how AI ranks your brand', Icon: Star },
  { key: 'Authority Agent', label: 'Online Presence', description: 'Checking your trust signals across the web', Icon: Globe },
  { key: 'Knowledge Graph Agent', label: 'Knowledge Presence', description: 'Making your brand easy for AI to understand', Icon: Network },
  { key: 'Optimization Agent', label: 'AI Recommendations', description: 'Suggesting ways to improve AI visibility', Icon: Wand2 },
  { key: 'Reporting', label: 'GEO Report', description: 'Your full report with clear next steps', Icon: ClipboardList },
];

// How long to keep showing the optimistic "queued" state after a trigger before giving up
// and trusting whatever the server reports (covers a run that died before writing its first
// RUNNING row, so the UI can never be stuck pretending an audit is queued).
const QUEUED_GRACE_MS = 45000;

// Polls run-status continuously (fast while running, slow otherwise) so the report reflects
// the real backend state — including a run started from another tab.
//
// Returns [status, refresh, markQueued]. markQueued() is called the instant a trigger POST
// succeeds: the pipeline writes its first RUNNING row asynchronously, so for a second or two
// the endpoint still returns the PREVIOUS run — which made a freshly clicked audit render the
// last run's finished report, as if it had already run. We hold an optimistic "queued" state
// and ignore polled results until `started_at` changes (record_agent_task stamps a fresh one
// with reset=True at the top of every run), so the UI only ever shows the run just started.
function useRunStatus(
  workspaceId: number | null | undefined,
  pipeline: 'SEO' | 'GEO',
): [RunStatus, () => void, () => void] {
  const [status, setStatus] = useState<RunStatus>(IDLE_RUN);
  const [nonce, setNonce] = useState(0);
  // started_at of the run that was showing when we triggered; anything still carrying it is stale.
  const staleStartedAt = React.useRef<string | null>(null);
  const queuedUntil = React.useRef<number>(0);

  useEffect(() => {
    if (!workspaceId) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = () => {
      fetch(`/api/workspaces/${workspaceId}/seo/run-status?pipeline=${pipeline}`, { headers: authHeaders() })
        .then(r => (r.ok ? r.json() : null))
        .then(d => {
          if (!alive) return;
          const waitingForNewRun =
            Date.now() < queuedUntil.current && d && d.started_at === staleStartedAt.current;
          if (d && !waitingForNewRun) {
            queuedUntil.current = 0;
            setStatus(d);
          }
          const busy = waitingForNewRun || (d && (d.status === 'running' || d.status === 'queued'));
          timer = setTimeout(poll, busy ? 2500 : 8000);
        })
        .catch(() => { if (alive) timer = setTimeout(poll, 6000); });
    };
    poll();
    return () => { alive = false; clearTimeout(timer); };
  }, [workspaceId, pipeline, nonce]);

  const markQueued = () => {
    staleStartedAt.current = status.started_at ?? null;
    queuedUntil.current = Date.now() + QUEUED_GRACE_MS;
    // Clear the finished run's stages immediately — the new run starts from an empty checklist.
    setStatus(s => ({ ...s, status: 'queued', running: true, stages_done: [], current_stage: null }));
    setNonce(n => n + 1);
  };

  return [status, () => setNonce(n => n + 1), markQueued];
}

// Month-over-month comparison card — reads the /seo/comparison endpoint and shows the deltas
// between the two most recent runs (the "monthly analysis" view). Shared by SEO and GEO: the
// backend endpoint already accepts a `pipeline` param and returns GEO's extra ai_visibility
// block (brand recall) when pipeline=GEO, so this one component covers both.
const ComparisonCard: React.FC<{ workspaceId?: number | null; pipeline: 'SEO' | 'GEO' }> = ({ workspaceId, pipeline }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;
    setLoading(true);
    const token = localStorage.getItem('token');
    fetch(`/api/workspaces/${workspaceId}/seo/comparison?pipeline=${pipeline}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(r => (r.ok ? r.json() : null))
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [workspaceId, pipeline]);

  if (!workspaceId) return null;

  const arrow = (dir?: string) =>
    dir === 'improved' ? { s: '▲', c: '#00ff9d' } :
    dir === 'worsened' ? { s: '▼', c: '#ff5c5c' } : { s: '–', c: 'var(--text-muted)' };
  const disp = (v: any) => (typeof v === 'boolean' ? (v ? 'Yes' : 'No') : (v ?? '—'));

  const vis = data?.ai_visibility;
  const recallImproved = vis && vis.previous_recognised === false && vis.current_recognised === true;
  const recallWorsened = vis && vis.previous_recognised === true && vis.current_recognised === false;

  return (
    <div className="glow-card">
      <h3 style={{ fontSize: '16px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <TrendingUp size={16} style={{ color: '#00ff9d' }} /> Month-over-Month Change ({pipeline})
      </h3>
      {loading && <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Loading…</p>}
      {!loading && (!data || data.runs_available === 0) && (
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          No runs yet — run the {pipeline} pipeline to start building history.
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
          {vis && (
            <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Recognised by AI answer engines</span>
                <span style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{disp(vis.previous_recognised)} → {disp(vis.current_recognised)}</span>
                  <span style={{ color: recallImproved ? '#00ff9d' : recallWorsened ? '#ff5c5c' : 'var(--text-muted)', fontWeight: 600, minWidth: '48px', textAlign: 'right' }}>
                    {recallImproved ? '▲' : recallWorsened ? '▼' : '–'}
                  </span>
                </span>
              </div>
              {vis.current_recall && (
                <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.5, margin: 0 }}>
                  "{vis.current_recall}"
                </p>
              )}
            </div>
          )}
        </>
      )}
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

// Compact status-only summary of every platform connection. Full connect/manage controls
// live on the Integrations page (sidebar) — this card exists so the user always sees, at a
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

// The connector panels that used to live here in a "connect your website & data" hub are now
// reached from the report modal's Connect & Publish tab (SEOAgencyReportModal), which is where
// approved fixes are actually published from.

// Exported because BrandDashboard holds the state that is passed into `blogs` below —
// both sides must agree on the shape.
export interface BlogDraft {
  id: string;
  title: string;
  excerpt: string;
  keywords: string;
  // 'approved' means the user accepted the strategy but nothing was pushed to their site —
  // it is deliberately distinct from 'published'. BrandDashboard sets it on approval.
  status: 'pending_review' | 'approved' | 'published';
}

interface WorkspaceSEOProps {
  blogs?: BlogDraft[];
  onOpenReview?: (itemId: string) => void;
  seoAgent?: any;
  geoAgent?: any;
  onTriggerSEO?: (url: string) => void;
  onTriggerGEO?: (url: string) => void;
  workspaceId?: number | null;
  siteUrl?: string; // the website already connected to this workspace (from onboarding) — audits target this by default, not a placeholder
  onManageIntegrations?: () => void; // navigates to the sidebar's Integrations tab
}

export const WorkspaceSEO: React.FC<WorkspaceSEOProps> = ({ workspaceId, siteUrl, onManageIntegrations }) => {
  const [targetUrl, setTargetUrl] = useState('');
  const [urlEditedByUser, setUrlEditedByUser] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  // Default the audit target to the site already connected to this workspace — siteUrl
  // arrives asynchronously (brand profile fetch), so pick it up once it loads. Never
  // overwrite a URL the user has deliberately typed themselves.
  useEffect(() => {
    if (!siteUrl || urlEditedByUser) return;
    const normalized = /^https?:\/\//i.test(siteUrl) ? siteUrl : `https://${siteUrl}`;
    setTargetUrl(normalized);
  }, [siteUrl, urlEditedByUser]);
  const [toast, setToast] = useState<{ msg: string; pipeline?: 'SEO' | 'GEO' } | null>(null);

  // Real connector status (already-existing endpoint) — used only to show a status badge
  // on the audit report. Future audits will combine this data with Firecrawl + SEO
  // analysis; for now this is a badge only, nothing extra is fetched.
  const [gscConnected, setGscConnected] = useState(false);
  useEffect(() => {
    if (!workspaceId) return;
    fetch(`/api/connectors/search-console/${workspaceId}/status`, { headers: authHeaders() })
      .then(r => (r.ok ? r.json() : null)).then(d => setGscConnected(!!d?.connected)).catch(() => {});
  }, [workspaceId]);

  // One live run-status per pipeline — the single source of truth for both the pipeline
  // graph highlighting below and the combined report modal. SEO and GEO stay two fully
  // independent pipelines (separate trigger, separate single-flight state, separate
  // scoring) but always render into the ONE report modal — never a second report.
  const [seoRun, refreshSeoRun, markSeoQueued] = useRunStatus(workspaceId, 'SEO');
  const [geoRun, refreshGeoRun, markGeoQueued] = useRunStatus(workspaceId, 'GEO');
  const seoRunning = seoRun.status === 'running' || seoRun.status === 'queued';
  const geoRunning = geoRun.status === 'running' || geoRun.status === 'queued';

  const flash = (msg: string, ok = true) => { if (!ok) setToast({ msg }); };

  const triggerPipeline = async (pipeline: 'SEO' | 'GEO', url: string) => {
    if (!workspaceId) { setToast({ msg: 'No workspace selected — open a workspace first.' }); return; }
    // A blank target used to make the button a silent no-op, which reads as "the button is
    // broken". Say what's missing instead.
    if (!url.trim()) { setToast({ msg: 'Enter the website address you want audited first.' }); return; }
    try {
      const r = await fetch(`/api/agents/${workspaceId}/${pipeline.toLowerCase()}`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ target_url: url }),
      });
      if (r.ok) {
        // Only after the server accepted the run: show it as queued and open the live report.
        (pipeline === 'SEO' ? markSeoQueued : markGeoQueued)();
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
          <button onClick={() => setToast(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0, fontSize: '14px' }}>✕</button>
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
            {seoRunning ? 'SEO Running…' : 'Run SEO Pipeline'}
          </GlowButton>
        </div>
      </div>

      {/* SEO & GEO Pipelines — clicking any node opens/focuses the one combined report below */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '10px' }}>
        {/* SEO Pipeline */}
        <div className="glow-card" style={{ padding: '20px', background: 'rgba(0, 255, 157, 0.01)', border: '1px solid rgba(0, 255, 157, 0.08)' }}>
          <h3 style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            TRADITIONAL SEO PIPELINE GRAPH
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
            {SEO_STAGE_LABELS.map(({ key, label, description, Icon }, idx, arr) => {
              const isActive = seoRunning && seoRun.current_stage === key;
              const isCompleted = seoRun.stages_done.includes(key);

              return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div onClick={() => setReportOpen(true)} title={description} style={{
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
                  <Icon size={10} style={{ flexShrink: 0, color: isActive || isCompleted ? '#fff' : 'var(--text-secondary)' }} />
                  {isActive && <span className="badge-pulse success" style={{ width: '4px', height: '4px', backgroundColor: 'var(--success)' }} />}
                  {isCompleted && !isActive && <Check size={10} color="var(--success)" />}
                  <span>{label}</span>
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
            <GlowButton variant="glow" disabled={geoRunning}
              onClick={() => geoRunning ? setToast({ msg: 'An audit is already running for this website.', pipeline: 'GEO' }) : triggerPipeline('GEO', targetUrl)}
              style={{ fontSize: '11px', padding: '4px 12px', ...(geoRunning ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}>
              {geoRunning ? 'GEO Running…' : 'Run GEO Pipeline'}
            </GlowButton>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
            {GEO_STAGE_LABELS.map(({ key, label, description, Icon }, idx, arr) => {
              const isActive = geoRunning && geoRun.current_stage === key;
              const isCompleted = geoRun.stages_done.includes(key);

              return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div onClick={() => setReportOpen(true)} title={description} style={{
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
                  <Icon size={10} style={{ flexShrink: 0, color: isActive ? '#fff' : isCompleted ? '#00ff9d' : '#fff' }} />
                  <span className={isActive ? "badge-pulse warning" : isCompleted ? "badge-pulse success" : ""} style={{ width: '4px', height: '4px', backgroundColor: isActive ? '#ffae00' : isCompleted ? '#00ff9d' : 'var(--accent)', display: isActive || isCompleted ? 'block' : 'none' }} />
                  <span>{label}</span>
                </div>
                {idx < arr.length - 1 && <span style={{ color: isActive || isCompleted ? '#fff' : 'var(--text-muted)', fontSize: '11px' }}>→</span>}
              </div>
            )})}
          </div>
        </div>
      </div>

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
              <SearchConsolePanel workspaceId={workspaceId ?? null} onRunAudit={() => triggerPipeline('SEO', targetUrl)} />
              <GA4Panel workspaceId={workspaceId ?? null} />
            </div>
          </div>
          <ComparisonCard workspaceId={workspaceId} pipeline="SEO" />
          <ComparisonCard workspaceId={workspaceId} pipeline="GEO" />
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
