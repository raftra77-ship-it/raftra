import React, { useState, useEffect } from 'react';
import {
  Globe, ExternalLink, TrendingUp, GitBranch, ShoppingBag, PenSquare,
  Search, ShieldCheck, Lightbulb, FileText, Link2, Wrench, Sparkles, ClipboardList,
  Radar, MessageSquare, Eye, Star, Network, Wand2, Check, Play, Loader2,
  ArrowUp, ArrowDown, Minus,
} from 'lucide-react';
import { SearchConsolePanel } from './SearchConsolePanel';
import { GA4Panel } from './GA4Panel';
import { SEOAgencyReportModal, type RunStatus } from '../SEOAgencyReportModal';

function authHeaders(): Record<string, string> {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

// This tab mounts ~9 independent GETs at once (two run-status pollers, two comparison
// cards, five connector-status rows) and several ask for the same URL — Search Console
// status was being fetched twice, once here and once inside ConnectedPlatformsCard.
// Concurrent callers for the same URL now share one request instead of racing.
const inflight = new Map<string, Promise<any>>();
function getJSON(url: string): Promise<any> {
  const hit = inflight.get(url);
  if (hit) return hit;
  const req = fetch(url, { headers: authHeaders() })
    .then(r => (r.ok ? r.json() : null))
    .catch(() => null)
    .finally(() => { inflight.delete(url); });
  inflight.set(url, req);
  return req;
}

// Reserves the space a card's content will occupy so the section arrives as one block
// instead of each card popping in and shoving the rest down as its fetch lands.
const Skeleton: React.FC<{ h?: number; w?: string; mb?: number }> = ({ h = 14, w = '100%', mb = 0 }) => (
  <div className="shimmer-loading" style={{
    height: `${h}px`, width: w, marginBottom: `${mb}px`,
    borderRadius: 'var(--radius-sm, 6px)', opacity: 0.55,
  }} />
);

const IDLE_RUN: RunStatus = { status: 'idle', running: false, stages: [], stages_done: [], current_stage: null, started_at: null, target_url: null };

// The two pipelines are themed off the design tokens rather than one-off hexes. The
// screen previously mixed #00E676 / #7C75FF, which sit next to but not on the palette
// (--success is #00ff9d, --accent is #5a52ff), so SEO green and GEO purple never quite
// matched the same accents used everywhere else in the dashboard.
const THEME = {
  SEO: { accent: 'var(--success)', rgb: '0, 255, 157', Icon: Search, kicker: 'TRADITIONAL SEO PIPELINE' },
  GEO: { accent: 'var(--accent)', rgb: '90, 82, 255', Icon: Radar, kicker: 'AI / GEO CITATIONS PIPELINE' },
} as const;

const tint = (rgb: string, a: number) => `rgba(${rgb}, ${a})`;

// Plain-language display labels for the pipeline graph nodes. `key` MUST stay the exact
// backend stage name (SEO_STAGES/GEO_STAGES in agents/seo_geo.py) since that's what
// current_stage/stages_done match against for live status — only `label`/`description`/
// `Icon` are user-facing.
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

// Shared card header (tinted icon tile + title + supporting line). It was repeated
// verbatim in four places with slightly different paddings and hardcoded colors.
const CardHead: React.FC<{
  Icon: React.ElementType; title: string; sub: string;
  accent?: string; rgb?: string; badge?: React.ReactNode;
}> = ({ Icon, title, sub, accent = 'var(--success)', rgb = '0, 255, 157', badge }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
    <div style={{
      width: '36px', height: '36px', borderRadius: 'var(--radius-md)', flexShrink: 0,
      background: tint(rgb, 0.12), border: `1px solid ${tint(rgb, 0.35)}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon size={18} style={{ color: accent }} />
    </div>
    <div style={{ minWidth: 0 }}>
      <h3 style={{
        fontSize: '17px', margin: 0, color: 'var(--text-primary)', fontWeight: 700,
        lineHeight: 1.25, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
      }}>
        {title}{badge}
      </h3>
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '3px 0 0', lineHeight: 1.45 }}>{sub}</p>
    </div>
  </div>
);

// One pipeline: kicker + live progress rail + a responsive grid of stage cells.
// Replaces the old flex-wrap row of pills joined by "→" glyphs, which left an arrow
// dangling at the end of each wrapped line and conveyed no progress.
const PipelineCard: React.FC<{
  pipeline: 'SEO' | 'GEO';
  stages: { key: string; label: string; description: string; Icon: React.ElementType }[];
  run: RunStatus;
  running: boolean;
  onOpenReport: () => void;
  onRun: () => void;
}> = ({ pipeline, stages, run, running, onOpenReport, onRun }) => {
  const theme = THEME[pipeline];
  const Kicker = theme.Icon;

  return (
    <div
      className="glow-card"
      style={{
        // Scopes the accent for every .seo-* rule inside this card, so one variable
        // drives the rail, stage states, focus ring and the run button.
        ['--pipe-accent' as string]: theme.accent,
        padding: '20px',
        background: tint(theme.rgb, 0.015),
        border: `1px solid ${tint(theme.rgb, 0.14)}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: 700,
          letterSpacing: '0.07em', color: theme.accent, background: tint(theme.rgb, 0.12),
          border: `1px solid ${tint(theme.rgb, 0.3)}`, borderRadius: 'var(--radius-full)', padding: '5px 13px',
        }}>
          <Kicker size={12} /> {theme.kicker}
        </span>

        <button className="seo-action" onClick={onRun} disabled={running}
          title={running ? `${pipeline} audit already running` : `Start the ${pipeline} pipeline`}>
          {running
            ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> {pipeline} Running…</>
            : <><Play size={14} /> Run {pipeline}</>}
        </button>
      </div>

      {/* Horizontal stage chain: pills joined by arrows, wrapping and centred. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
        {stages.map(({ key, label, description, Icon }, idx, arr) => {
          const isActive = running && run.current_stage === key;
          const isCompleted = run.stages_done.includes(key);
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div onClick={onOpenReport} title={description} style={{
                cursor: 'pointer',
                background: isActive ? tint(theme.rgb, 0.2) : isCompleted ? tint(theme.rgb, 0.06) : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isActive ? theme.accent : isCompleted ? tint(theme.rgb, 0.5) : 'var(--border-color)'}`,
                borderRadius: 'var(--radius-full)',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: isActive || isCompleted ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: isActive ? `0 0 10px ${tint(theme.rgb, 0.3)}` : 'none',
                transition: 'var(--transition-smooth)',
              }}>
                <Icon size={10} style={{ flexShrink: 0, color: isActive || isCompleted ? 'var(--text-primary)' : 'var(--text-secondary)' }} />
                {isActive && <span className="badge-pulse success" style={{ width: '4px', height: '4px', backgroundColor: theme.accent }} />}
                {isCompleted && !isActive && <Check size={10} style={{ color: theme.accent }} />}
                <span>{label}</span>
              </div>
              {idx < arr.length - 1 && (
                <span style={{ color: isActive ? theme.accent : 'var(--text-muted)', fontSize: '12px' }}>→</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Comparison card — reads the /seo/comparison endpoint and shows the deltas between the
// two most recent runs. Shared by SEO and GEO: the backend endpoint already accepts a
// `pipeline` param and returns GEO's extra ai_visibility block (brand recall) when
// pipeline=GEO, so this one component covers both.
const ComparisonCard: React.FC<{ workspaceId?: number | null; pipeline: 'SEO' | 'GEO' }> = ({ workspaceId, pipeline }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;
    setLoading(true);
    getJSON(`/api/workspaces/${workspaceId}/seo/comparison?pipeline=${pipeline}`)
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [workspaceId, pipeline]);

  if (!workspaceId) return null;

  const theme = THEME[pipeline];
  const disp = (v: any) => (typeof v === 'boolean' ? (v ? 'Yes' : 'No') : (v ?? '—'));

  // Direction comes from the backend and already encodes "is this good", which is why a
  // drop in missing alt-text counts as improved. The old row rendered a green ▲ beside
  // "-29", so the glyph appeared to contradict the number. The arrow now follows the raw
  // movement and only the colour carries the judgement.
  const verdict = (dir?: string) =>
    dir === 'improved' ? 'var(--success)' :
    dir === 'worsened' ? 'var(--danger)' : 'var(--text-muted)';

  const movement = (delta: any) => {
    if (typeof delta !== 'number' || delta === 0) return Minus;
    return delta > 0 ? ArrowUp : ArrowDown;
  };

  const vis = data?.ai_visibility;
  const recallImproved = vis && vis.previous_recognised === false && vis.current_recognised === true;
  const recallWorsened = vis && vis.previous_recognised === true && vis.current_recognised === false;

  const scoreDelta = data?.runs_available > 1
    ? Number(data.current_run.score) - Number(data.previous_run.score)
    : 0;

  return (
    <div className="glow-card" style={{ ['--pipe-accent' as string]: theme.accent }}>
      <CardHead
        Icon={TrendingUp}
        title="Change Since Last Run"
        sub={`What moved between your two most recent ${pipeline} runs.`}
        accent={theme.accent}
        rgb={theme.rgb}
        badge={
          <span style={{
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.07em', color: theme.accent,
            background: tint(theme.rgb, 0.12), border: `1px solid ${tint(theme.rgb, 0.3)}`,
            borderRadius: 'var(--radius-full)', padding: '3px 9px', whiteSpace: 'nowrap',
          }}>{pipeline}</span>
        }
      />

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '96px' }}>
          <Skeleton h={30} w="42%" />
          <Skeleton h={13} />
          <Skeleton h={13} w="86%" />
        </div>
      )}

      {!loading && (!data || data.runs_available === 0) && (
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
          No runs yet — run the {pipeline} pipeline to start building history.
        </p>
      )}

      {!loading && data && data.runs_available === 1 && (
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
          First run recorded. The comparison appears automatically after the next run.
        </p>
      )}

      {!loading && data && data.runs_available > 1 && (
        <>
          {/* The score was previously buried mid-sentence in a muted line. It is the
              headline number of this card, so it now reads as one. */}
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap',
            padding: '14px 16px', marginBottom: '14px', borderRadius: 'var(--radius-md)',
            background: tint(theme.rgb, 0.05), border: `1px solid ${tint(theme.rgb, 0.18)}`,
          }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {data.previous_run.score}
            </span>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>→</span>
            <span style={{
              fontSize: '30px', fontWeight: 800, lineHeight: 1, color: 'var(--text-primary)',
              fontFamily: 'var(--font-heading)',
            }}>
              {data.current_run.score}
            </span>
            {scoreDelta !== 0 && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700,
                color: scoreDelta > 0 ? 'var(--success)' : 'var(--danger)',
              }}>
                {scoreDelta > 0 ? '+' : ''}{scoreDelta}
              </span>
            )}
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
              {new Date(data.previous_run.date).toLocaleDateString()} → {new Date(data.current_run.date).toLocaleDateString()}
              {(() => {
                // State the actual gap. Two runs an hour apart and two a quarter apart were
                // rendering identically, which is what made "month-over-month" misleading.
                const days = Math.round(
                  (new Date(data.current_run.date).getTime() - new Date(data.previous_run.date).getTime())
                  / 86400000);
                return days >= 1 ? ` · ${days} day${days === 1 ? '' : 's'} apart` : ' · same day';
              })()}
            </span>
          </div>

          {(data.current_run.demo || data.previous_run.demo) && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '12px',
              fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--warning)',
              background: 'var(--warning-glow)', border: '1px solid rgba(255,174,0,0.35)',
              borderRadius: 'var(--radius-sm)', padding: '4px 9px',
            }}>
              {data.current_run.demo && data.previous_run.demo ? 'BOTH RUNS DEMO'
                : data.current_run.demo ? 'LATEST RUN IS DEMO' : 'EARLIER RUN WAS DEMO'}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {data.changes.map((c: any, i: number) => {
              const Mv = movement(c.delta);
              const col = verdict(c.direction);
              return (
                <div key={c.metric} className="seo-delta-row"
                  style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)', minWidth: 0 }}>{c.metric}</span>
                  <span style={{ display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0 }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
                      {disp(c.previous)} → {disp(c.current)}
                    </span>
                    <span className="seo-delta-chip" style={{ color: col }}>
                      <Mv size={13} strokeWidth={2.5} />
                      {typeof c.delta === 'number' ? `${c.delta > 0 ? '+' : ''}${c.delta}` : '—'}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>

          {vis && (
            <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
              <div className="seo-delta-row" style={{ padding: '0 10px 8px' }}>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Recognised by AI answer engines</span>
                <span style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
                    {disp(vis.previous_recognised)} → {disp(vis.current_recognised)}
                  </span>
                  <span className="seo-delta-chip" style={{
                    color: recallImproved ? 'var(--success)' : recallWorsened ? 'var(--danger)' : 'var(--text-muted)',
                  }}>
                    {recallImproved ? <ArrowUp size={13} strokeWidth={2.5} />
                      : recallWorsened ? <ArrowDown size={13} strokeWidth={2.5} />
                      : <Minus size={13} strokeWidth={2.5} />}
                  </span>
                </span>
              </div>
              {vis.current_recall && (
                <p style={{
                  fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic',
                  lineHeight: 1.55, margin: '4px 10px 0', paddingLeft: '10px',
                  borderLeft: `2px solid ${tint(theme.rgb, 0.35)}`,
                }}>
                  “{vis.current_recall}”
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
    { t: 'Run the pipeline', d: 'We crawl your live site and audit it for Google SEO + AI search (GEO).' },
    { t: 'Real, measured fixes', d: 'Every suggestion comes from your actual page — nothing is invented.' },
    { t: 'Human review', d: 'Approve, edit, or reject each suggestion below. Nothing auto-applies.' },
    { t: 'Make the changes', d: 'Open GitHub / Shopify / WordPress on the right and apply the approved fixes.' },
    { t: 'Re-run & track', d: 'Deploy, then re-run to watch your scores improve over time.' },
  ];
  return (
    <div className="glow-card">
      <CardHead Icon={Globe} title="How SEO + GEO works here" sub="The workflow, from audit to live changes." />
      {/* Connecting spine makes the five steps read as one sequence rather than five
          unrelated rows. */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {steps.map((s, i) => (
          <div key={s.t} style={{ display: 'flex', gap: '14px', alignItems: 'stretch' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <span style={{
                width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
                background: 'var(--success-glow)', border: '1px solid rgba(0,255,157,0.35)',
                color: 'var(--success)', fontSize: '12px', fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-mono)',
              }}>{i + 1}</span>
              {i < steps.length - 1 && (
                <span style={{ flex: 1, width: '1px', background: 'var(--border-color)', margin: '4px 0' }} />
              )}
            </div>
            <div style={{ paddingBottom: i < steps.length - 1 ? '16px' : 0 }}>
              <span style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{s.t}</span>
              <span style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55, marginTop: '2px' }}>{s.d}</span>
            </div>
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
  // Without this the rows render "Disconnected" first and flip to connected a beat later,
  // which reads as the card loading twice.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;
    Promise.all([
      getJSON(`/api/connectors/github/${workspaceId}/status`),
      getJSON(`/api/connectors/wordpress/${workspaceId}/status`),
      getJSON(`/api/connectors/shopify/${workspaceId}/status`),
      getJSON(`/api/connectors/search-console/${workspaceId}/status`),
    ]).then(([gh, wp, sh, gsc]) => { setSt({ gh, wp, sh, gsc }); setReady(true); });
  }, [workspaceId]);

  const rows = [
    { key: 'gh', name: 'GitHub', Icon: GitBranch, connected: !!st.gh?.connected },
    { key: 'wp', name: 'WordPress', Icon: PenSquare, connected: !!st.wp?.connected },
    { key: 'sh', name: 'Shopify', Icon: ShoppingBag, connected: !!st.sh?.connected },
    { key: 'gsc', name: 'Google Search Console', Icon: Globe, connected: !!st.gsc?.connected },
    { key: 'ga4', name: 'Google Analytics', Icon: TrendingUp, connected: !!(st.gsc?.connected && st.gsc?.ga4_property_id) },
  ];

  const liveCount = rows.filter(r => r.connected).length;

  return (
    <div className="glow-card">
      <CardHead
        Icon={ExternalLink}
        title="Connected Platforms"
        sub="Used to pull real data and apply approved fixes."
        badge={
          <span style={{
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em',
            color: liveCount ? 'var(--success)' : 'var(--text-muted)',
            background: liveCount ? 'var(--success-glow)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${liveCount ? 'rgba(0,255,157,0.3)' : 'var(--border-color)'}`,
            borderRadius: 'var(--radius-full)', padding: '3px 9px', fontFamily: 'var(--font-mono)',
          }}>{ready ? `${liveCount}/${rows.length}` : `—/${rows.length}`}</span>
        }
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Connected rows get a faint green wash and border so the state is readable at
            a glance, not only from the pill on the right. */}
        {rows.map(({ key, name, Icon, connected }) => (
          <div key={key} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
            padding: '11px 13px',
            background: connected ? 'rgba(0,255,157,0.045)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${connected ? 'rgba(0,255,157,0.2)' : 'var(--border-color)'}`,
            borderRadius: 'var(--radius-md)', transition: 'var(--transition-fast)',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <span style={{
                width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: connected ? 'rgba(0,255,157,0.1)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${connected ? 'rgba(0,255,157,0.28)' : 'var(--border-color)'}`,
              }}>
                <Icon size={14} style={{ color: connected ? 'var(--success)' : 'var(--text-muted)' }} />
              </span>
              <span style={{
                fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{name}</span>
            </span>
            {/* A dot carries the state as well as the word, so it survives at a glance.
                Until the statuses land, a placeholder holds the slot — otherwise every
                row states NOT CONNECTED and then flips, which reads as a second load. */}
            {!ready ? (
              <Skeleton h={10} w="88px" />
            ) : (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px', flexShrink: 0,
                fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', whiteSpace: 'nowrap',
                color: connected ? 'var(--success)' : 'var(--text-muted)',
              }}>
                <span style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: connected ? 'var(--success)' : 'var(--text-muted)',
                }} />
                {connected ? 'CONNECTED' : 'NOT CONNECTED'}
              </span>
            )}
          </div>
        ))}
      </div>

      <button className="seo-action seo-action--ghost" onClick={onManageIntegrations}
        style={{ width: '100%', marginTop: '16px' }}>
        <ExternalLink size={15} /> View Integrations
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
    // Strip whitespace anywhere, not just the ends: a company_url saved as
    // " ambraneindia.com" would otherwise become "https:// ambraneindia.com", which
    // the crawler rejects with HTTP 400.
    const cleaned = siteUrl.replace(/\s+/g, '');
    if (!cleaned) return;
    const normalized = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
    setTargetUrl(normalized);
  }, [siteUrl, urlEditedByUser]);
  const [toast, setToast] = useState<{ msg: string; pipeline?: 'SEO' | 'GEO' } | null>(null);

  // Real connector status (already-existing endpoint) — used only to show a status badge
  // on the audit report. Future audits will combine this data with Firecrawl + SEO
  // analysis; for now this is a badge only, nothing extra is fetched.
  const [gscConnected, setGscConnected] = useState(false);
  useEffect(() => {
    if (!workspaceId) return;
    getJSON(`/api/connectors/search-console/${workspaceId}/status`)
      .then(d => setGscConnected(!!d?.connected)).catch(() => {});
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

  const runOrWarn = (pipeline: 'SEO' | 'GEO', busy: boolean) =>
    busy
      ? setToast({ msg: 'An audit is already running for this website.', pipeline })
      : triggerPipeline(pipeline, targetUrl);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {toast && (
        <div style={{ position: 'fixed', top: '18px', right: '18px', zIndex: 7000, display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(24,26,34,0.98)', border: '1px solid rgba(255,174,0,0.35)', borderRadius: 'var(--radius-md)', padding: '13px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', maxWidth: '360px' }}>
          <span style={{ fontSize: '14px', color: 'var(--text-primary)', flex: 1 }}>{toast.msg}</span>
          {toast.pipeline && (
            <button onClick={() => { setToast(null); setReportOpen(true); }} style={{ fontSize: '13px', fontWeight: 700, color: 'var(--warning)', background: 'var(--warning-glow)', border: '1px solid rgba(255,174,0,0.4)', borderRadius: '7px', padding: '6px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>View Running Audit</button>
          )}
          <button onClick={() => setToast(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0, fontSize: '14px' }}>✕</button>
        </div>
      )}

      {/* Header follows the Creative Studio pattern: tinted icon tile + uppercase title +
          muted subtitle, so the workspaces read as one family. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: 'var(--radius-md)', background: 'var(--success-glow)', border: '1px solid rgba(0,255,157,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Search size={22} style={{ color: 'var(--success)' }} />
        </div>
        <div>
          <div style={{ fontSize: '22px', color: 'var(--text-primary)', fontWeight: 800, letterSpacing: '0.02em', fontFamily: 'var(--font-heading)', lineHeight: 1.2 }}>
            SEO + GEO WORKSPACE
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Rank on Google and get cited by AI search — audit, review, then apply the fixes.
          </div>
        </div>
      </div>

      {/* Audit target bar. The URL input, "View Report" and the two run buttons used to be
          spread across the header and the GEO card, so the two pipelines had visibly
          unequal prominence. Every audit control now lives in one row. */}
      <div className="glow-card" style={{ padding: '16px 18px' }}>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '9px' }}>
          AUDIT TARGET
        </label>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="seo-url-field">
            <Globe size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              type="text"
              value={targetUrl}
              onChange={(e) => { setTargetUrl(e.target.value); setUrlEditedByUser(true); }}
              placeholder="https://yoursite.com"
              spellCheck={false}
            />
          </span>
          <button className="seo-action seo-action--ghost" onClick={() => setReportOpen(true)}>
            <FileText size={14} /> View Report
          </button>
          <button className="seo-action" style={{ ['--pipe-accent' as string]: THEME.SEO.accent }}
            onClick={() => runOrWarn('SEO', seoRunning)} disabled={seoRunning}>
            {seoRunning
              ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> SEO Running…</>
              : <><Play size={14} /> Run SEO</>}
          </button>
          <button className="seo-action" style={{ ['--pipe-accent' as string]: THEME.GEO.accent }}
            onClick={() => runOrWarn('GEO', geoRunning)} disabled={geoRunning}>
            {geoRunning
              ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> GEO Running…</>
              : <><Play size={14} /> Run GEO</>}
          </button>
        </div>
      </div>

      {/* Full width and stacked: the stage chain is a horizontal row of pills, so it needs
          the whole content width before it starts wrapping. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <PipelineCard
          pipeline="SEO" stages={SEO_STAGE_LABELS} run={seoRun} running={seoRunning}
          onOpenReport={() => setReportOpen(true)} onRun={() => runOrWarn('SEO', seoRunning)}
        />
        <PipelineCard
          pipeline="GEO" stages={GEO_STAGE_LABELS} run={geoRun} running={geoRunning}
          onOpenReport={() => setReportOpen(true)} onRun={() => runOrWarn('GEO', geoRunning)}
        />
      </div>

      {/* The two comparison cards were stacked full-height in a 2fr column, leaving a tall
          empty gutter on the right of every one. Side by side, they fill the row. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(430px, 100%), 1fr))', gap: '20px', alignItems: 'start' }}>
        <ComparisonCard workspaceId={workspaceId} pipeline="SEO" />
        <ComparisonCard workspaceId={workspaceId} pipeline="GEO" />
      </div>

      {/* Search Console + GA4 are analytics/tracking sources — they feed the tracking above. */}
      <div className="glow-card">
        <CardHead
          Icon={TrendingUp}
          title="Search Console & Analytics"
          sub="Connect Google Search Console & GA4 to pull real rankings, clicks and traffic."
          accent={THEME.GEO.accent}
          rgb={THEME.GEO.rgb}
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: '16px' }}>
          <SearchConsolePanel workspaceId={workspaceId ?? null} onRunAudit={() => triggerPipeline('SEO', targetUrl)} />
          <GA4Panel workspaceId={workspaceId ?? null} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: '20px', alignItems: 'start' }}>
        <ExplainerCard />
        <ConnectedPlatformsCard workspaceId={workspaceId} onManageIntegrations={onManageIntegrations} />
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
