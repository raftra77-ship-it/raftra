import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, CheckCheck, PenSquare, ChevronDown, AlertTriangle, Play, Trash2, Download, TrendingUp, XCircle, History, Globe, RotateCcw } from 'lucide-react';
import { GlowButton } from './GlowButton';
import { Markdown } from './Markdown';
import { GitHubPanel } from './workspaces/GitHubPanel';
import { WordPressPanel } from './workspaces/WordPressPanel';
import { ShopifyPanel } from './workspaces/ShopifyPanel';

// ─────────────────────────────────────────────────────────────────────────────
// The ONE audit report container in the app. SEO and GEO are two independent
// pipelines (separate trigger buttons, separate single-flight state, separate
// evidence-based scoring) but they render into this single combined report —
// there is never a second report card/modal/page anywhere else.
// ─────────────────────────────────────────────────────────────────────────────

export type RunStatus = {
  status: 'idle' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  running: boolean;
  stages: string[];
  stages_done: string[];
  current_stage: string | null;
  started_at: string | null;
  target_url: string | null;
  summary?: string;
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: number | null;
  seoRun: RunStatus;
  geoRun: RunStatus;
  onRunRequested: (pipeline: 'SEO' | 'GEO', url: string) => Promise<void>;
  flash: (msg: string, ok?: boolean) => void;
  gscConnected?: boolean; // status badge only — no Search Console data is fetched into the audit yet
}

function authHeaders(): Record<string, string> {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

// The backend sends naive UTC timestamps with no timezone suffix. JS's Date constructor
// parses a timezone-less date-time string as LOCAL time, so without this every timestamp
// is off by the browser's UTC offset.
function toUtcDate(iso?: string | null): Date | null {
  if (!iso) return null;
  const hasTz = /Z$|[+-]\d{2}:?\d{2}$/.test(iso);
  return new Date(hasTz ? iso : iso + 'Z');
}
function timeAgo(iso?: string | null): string {
  const d = toUtcDate(iso);
  if (!d) return '—';
  const s = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return d.toLocaleDateString();
}

function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds < 1) return '—';
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), rem = s % 60;
  return rem ? `${m}m ${rem}s` : `${m}m`;
}

const scoreColor = (v: number) => (v >= 80 ? '#00ff9d' : v >= 55 ? '#ffae00' : '#ff5c5c');
const SEV_COLOR: Record<string, string> = { Critical: '#ff5c5c', High: '#ff8a5c', Medium: '#ffae00', Low: '#00ff9d' };
const SEV_ORDER = ['Critical', 'High', 'Medium', 'Low'];

const ScoreTile: React.FC<{ label: string; value: number | null }> = ({ label, value }) => (
  <div style={{ flex: 1, minWidth: '110px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px 12px', textAlign: 'center' }}>
    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>{label}</div>
    <div style={{ fontSize: '26px', fontWeight: 800, color: value == null ? 'var(--text-muted)' : scoreColor(value), lineHeight: 1 }}>
      {value == null ? '—' : value}<span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{value == null ? '' : '/100'}</span>
    </div>
  </div>
);

const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { c: string; bg: string }> = {
    running: { c: '#00ff9d', bg: 'rgba(0,255,157,0.12)' }, queued: { c: '#00ff9d', bg: 'rgba(0,255,157,0.12)' },
    completed: { c: '#00e676', bg: 'rgba(0,230,118,0.1)' }, failed: { c: '#ff5c5c', bg: 'rgba(255,92,92,0.1)' },
    cancelled: { c: '#ffae00', bg: 'rgba(255,174,0,0.1)' }, idle: { c: 'var(--text-muted)', bg: 'rgba(255,255,255,0.05)' },
  };
  const s = map[status] || map.idle;
  return (
    <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase', padding: '3px 9px', borderRadius: '20px', color: s.c, background: s.bg }}>
      {status}
    </span>
  );
};

// Compact per-pipeline running strip — the checklist example from spec, adapted to two
// independent pipelines instead of one artificial combined step list.
const PipelineProgress: React.FC<{ label: string; run: RunStatus; accent: string; onCancel: () => void; busy: boolean; avgDurationSeconds?: number }> = ({ label, run, accent, onCancel, busy, avgDurationSeconds }) => {
  const isRunning = run.status === 'running' || run.status === 'queued';
  if (!isRunning) return null;
  const startedDate = toUtcDate(run.started_at);
  const elapsed = startedDate ? (Date.now() - startedDate.getTime()) / 1000 : null;
  const remaining = avgDurationSeconds && elapsed != null ? Math.max(0, avgDurationSeconds - elapsed) : null;
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${accent}55`, borderRadius: '10px', padding: '14px 16px', marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#fff' }}>{label} Pipeline</span>
        <StatusPill status={run.status} />
      </div>
      <div style={{ height: '5px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: '10px' }}>
        <div style={{ height: '100%', borderRadius: '4px', background: accent, width: `${Math.round((run.stages_done.length / Math.max(run.stages.length, 1)) * 100)}%`, transition: 'width .4s ease' }} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
        {run.stages.map(s => {
          const done = run.stages_done.includes(s);
          const current = run.current_stage === s && !done;
          return (
            <span key={s} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: done ? '#fff' : current ? accent : 'var(--text-muted)' }}>
              {done ? <Check size={11} color="#00e676" /> : current ? <span className="badge-pulse warning" style={{ width: '6px', height: '6px', backgroundColor: accent, borderRadius: '50%', display: 'inline-block' }} /> : <span style={{ width: '6px', height: '6px', borderRadius: '50%', border: '1px solid var(--text-muted)', display: 'inline-block' }} />}
              {s}
            </span>
          );
        })}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
        {run.target_url} {run.started_at && `· started ${timeAgo(run.started_at)}`}
        {remaining != null && remaining > 1 && ` · est. ${formatDuration(remaining)} remaining`}
      </div>
      <button onClick={onCancel} disabled={busy}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 600, color: '#ff5c5c', background: 'rgba(255,92,92,0.08)', border: '1px solid rgba(255,92,92,0.35)', borderRadius: '7px', padding: '7px 12px', cursor: busy ? 'wait' : 'pointer' }}>
        <XCircle size={12} /> {busy ? 'Cancelling…' : 'Cancel Audit'}
      </button>
    </div>
  );
};

// Plain-language "why this matters" for each fixed category — a business owner shouldn't
// have to know what "Structured Data" means to understand what to fix and why.
const CATEGORY_EXPLAIN: Record<string, string> = {
  Content: "Search engines and AI models rank pages by how much useful, substantial text they contain. Thin pages read as low-value and get buried.",
  Metadata: "Your title and meta description are what Google actually shows in search results — they decide whether someone clicks your link at all.",
  "Technical SEO": "If crawlers can't reliably fetch, index, and navigate your site (HTTPS, robots.txt, sitemap), none of your other SEO work matters — you're invisible before you even start.",
  Performance: "Slow-loading pages get ranked lower and lose visitors before the page even finishes loading — this is a direct ranking factor for Google.",
  Accessibility: "Semantic, well-labelled HTML helps both screen-reader users and search/AI crawlers understand what's on the page — it's a trust and usability signal, not just compliance.",
  "Internal Linking": "Links between your own pages tell search engines which pages matter most and help visitors (and crawlers) discover the rest of your site.",
  "Structured Data": "JSON-LD schema is how you directly tell Google and AI models facts about your business (what you are, what you offer) instead of hoping they infer it correctly.",
  "AI Readability": "AI answer engines (ChatGPT, Perplexity, Gemini) summarize pages rather than rank links — if they can't tell what you are and who it's for in the first few lines, they'll skip you.",
  "Content Structure": "AI models extract information far more reliably from clearly headed sections, lists and FAQs than from dense paragraphs — structure is what makes you quotable.",
  "AI Citation Readiness": "AI engines prefer to cite sources with concrete facts, stats and definitions — vague marketing copy rarely gets quoted.",
  "Authority Signals": "About/contact/social links are how AI models corroborate that you're a real, trustworthy entity worth citing — not an anonymous or low-quality page.",
  "Structured Knowledge": "Organization/Product schema is the clearest signal you can give an AI model about who you are — without it, the model has to guess from prose alone.",
};

const CategoryRow: React.FC<{ c: any }> = ({ c }) => {
  const verified = c.status === 'verified';
  const pct = verified && c.max ? Math.round((c.score / c.max) * 100) : 0;
  return (
    <div style={{ marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '5px' }}>
        <span style={{ color: '#fff', fontWeight: 600 }}>{c.name}</span>
        <span style={{ color: verified ? scoreColor(pct) : 'var(--text-muted)', fontWeight: 700 }}>
          {verified ? `${c.score}/${c.max}` : 'Not Verified'}
        </span>
      </div>
      <div style={{ height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: verified ? scoreColor(pct) : 'var(--text-muted)', borderRadius: '4px' }} />
      </div>
      {CATEGORY_EXPLAIN[c.name] && (
        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '8px', fontStyle: 'italic' }}>
          {CATEGORY_EXPLAIN[c.name]}
        </div>
      )}
      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}><b style={{ color: '#fff' }}>What we checked:</b> {c.reason}</div>
      {c.evidence?.length > 0 && (
        <ul style={{ margin: '0 0 6px', paddingLeft: '16px' }}>
          {c.evidence.map((e: string, i: number) => <li key={i} style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{e}</li>)}
        </ul>
      )}
      {c.recommendations?.length > 0 && (
        <div style={{ fontSize: '11.5px', color: '#8B85FF' }}>
          <b>What to do:</b> {c.recommendations[0]}{c.recommendations.length > 1 ? ` (+${c.recommendations.length - 1} more)` : ''}
        </div>
      )}
    </div>
  );
};

// The full LLM-written strategy report for one pipeline — the theoretical, plain-English
// write-up (why it matters, what to prioritize, how to think about it) that sits alongside
// the structured scores above. Collapsed by default so the report stays scannable.
const NarrativeReport: React.FC<{ label: string; text?: string | null }> = ({ label, text }) => {
  const [open, setOpen] = React.useState(false);
  if (!text) return null;
  return (
    <div style={{ marginTop: '10px' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#8B85FF', background: 'rgba(90,82,255,0.08)', border: '1px solid rgba(90,82,255,0.3)', borderRadius: '8px', padding: '8px 13px', cursor: 'pointer', width: '100%', justifyContent: 'space-between' }}>
        <span>{open ? 'Hide' : 'Read'} the full {label} strategy explanation</span>
        <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </button>
      {open && (
        <div style={{ marginTop: '10px', padding: '16px 18px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '12.5px', lineHeight: 1.7 }}>
          <Markdown text={text} />
        </div>
      )}
    </div>
  );
};

const ConfirmDialog: React.FC<{ title: string; message: string; confirmLabel: string; danger?: boolean; onCancel: () => void; onConfirm: () => void }> =
  ({ title, message, confirmLabel, danger, onCancel, onConfirm }) => (
  <div onClick={onCancel} style={{ position: 'fixed', inset: 0, zIndex: 6100, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
    <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '420px', background: 'rgba(18,20,28,0.99)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '22px' }}>
      <h3 style={{ fontSize: '16px', margin: '0 0 10px' }}>{title}</h3>
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 20px' }}>{message}</p>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ fontSize: '13px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '9px 16px', cursor: 'pointer' }}>Cancel</button>
        <button onClick={onConfirm} style={{ fontSize: '13px', fontWeight: 700, color: danger ? '#fff' : '#03121a', background: danger ? '#ff5c5c' : '#00ff9d', border: 'none', borderRadius: '8px', padding: '9px 16px', cursor: 'pointer' }}>{confirmLabel}</button>
      </div>
    </div>
  </div>
);

function findCategoryEvidence(sec: any, area: string): string[] {
  const name = area.includes('·') ? area.split('·')[1].trim() : area;
  const cat = (sec?.categories || []).find((c: any) => c.name === name);
  return cat?.evidence || [];
}

export const SEOAgencyReportModal: React.FC<Props> = ({ isOpen, onClose, workspaceId, seoRun, geoRun, onRunRequested, flash, gscConnected }) => {
  const [report, setReport] = React.useState<any>(null);
  const [history, setHistory] = React.useState<any[]>([]);
  const [avgDuration, setAvgDuration] = React.useState<{ SEO?: number; GEO?: number }>({});
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState<Record<string, boolean>>({});
  const [editingKey, setEditingKey] = React.useState<string | null>(null);
  const [editText, setEditText] = React.useState('');
  const [confirmRunAgain, setConfirmRunAgain] = React.useState<'SEO' | 'GEO' | null>(null);
  const [confirmRunBoth, setConfirmRunBoth] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState<{ seoId?: number; geoId?: number; label: string } | null>(null);
  const [compareOpen, setCompareOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [viewingDate, setViewingDate] = React.useState<string | null>(null); // null = latest (live)
  const prevSeoStatus = React.useRef(seoRun.status);
  const prevGeoStatus = React.useRef(geoRun.status);

  const fetchLatest = React.useCallback(() => {
    if (!workspaceId) return;
    setLoading(true);
    fetch(`/api/workspaces/${workspaceId}/seo/audit-report`, { headers: authHeaders() })
      .then(r => (r.ok ? r.json() : null)).then(d => { setReport(d); setViewingDate(null); }).catch(() => {}).finally(() => setLoading(false));
  }, [workspaceId]);

  const fetchHistory = React.useCallback(() => {
    if (!workspaceId) return;
    fetch(`/api/workspaces/${workspaceId}/seo/audit-history`, { headers: authHeaders() })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { setHistory(d ? d.runs : []); setAvgDuration(d?.avg_duration_seconds || {}); })
      .catch(() => {});
  }, [workspaceId]);

  React.useEffect(() => { if (isOpen) { fetchLatest(); fetchHistory(); } }, [isOpen, fetchLatest, fetchHistory]);

  // Auto-refresh the report the moment either pipeline transitions into "completed" while
  // the modal is open, so it updates live instead of showing stale data.
  React.useEffect(() => {
    if (prevSeoStatus.current !== 'completed' && seoRun.status === 'completed' && !viewingDate) { fetchLatest(); fetchHistory(); }
    prevSeoStatus.current = seoRun.status;
  }, [seoRun.status, fetchLatest, fetchHistory, viewingDate]);
  React.useEffect(() => {
    if (prevGeoStatus.current !== 'completed' && geoRun.status === 'completed' && !viewingDate) { fetchLatest(); fetchHistory(); }
    prevGeoStatus.current = geoRun.status;
  }, [geoRun.status, fetchLatest, fetchHistory, viewingDate]);

  if (!isOpen) return null;

  const seoRunning = seoRun.status === 'running' || seoRun.status === 'queued';
  const geoRunning = geoRun.status === 'running' || geoRun.status === 'queued';
  const anyRunning = seoRunning || geoRunning;
  const overallStatus = anyRunning ? 'running'
    : (report?.seo || report?.geo) ? 'completed'
    : (seoRun.status === 'failed' || geoRun.status === 'failed') ? 'failed'
    : (seoRun.status === 'cancelled' || geoRun.status === 'cancelled') ? 'cancelled' : 'idle';

  const cancelPipeline = async (pipeline: 'SEO' | 'GEO') => {
    setBusy(pipeline);
    try {
      const r = await fetch(`/api/workspaces/${workspaceId}/seo/cancel?pipeline=${pipeline}`, { method: 'POST', headers: authHeaders() });
      if (r.ok) flash('Cancelling the audit…');
      else { const d = await r.json().catch(() => ({})); flash(d.detail || 'Could not cancel.', false); }
    } catch { flash('Could not cancel.', false); }
    setBusy(null);
  };

  // Run Again is per-pipeline — running SEO again never also starts GEO, and vice versa.
  const runAgain = async (pipeline: 'SEO' | 'GEO') => {
    setConfirmRunAgain(null);
    const url = report?.target_url || (pipeline === 'SEO' ? seoRun.target_url : geoRun.target_url) || '';
    if (!url) return;
    setBusy(pipeline);
    await onRunRequested(pipeline, url);
    setBusy(null);
  };

  // Explicit, confirmed dual-trigger for the "verify improvements" flow — distinct from the
  // old bug where a single Run Again button silently ran both pipelines with no warning.
  const runBoth = async () => {
    setConfirmRunBoth(false);
    const url = report?.target_url || seoRun.target_url || geoRun.target_url || '';
    if (!url) return;
    setBusy('SEO+GEO');
    await Promise.all([onRunRequested('SEO', url), onRunRequested('GEO', url)]);
    setBusy(null);
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    const ids = [confirmDelete.seoId, confirmDelete.geoId].filter(Boolean) as number[];
    const failures: string[] = [];
    for (const id of ids) {
      try {
        const r = await fetch(`/api/workspaces/${workspaceId}/seo/audits/${id}`, { method: 'DELETE', headers: authHeaders() });
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          failures.push(d.detail || `HTTP ${r.status}`);
        }
      } catch {
        failures.push('Could not reach the server.');
      }
    }
    setConfirmDelete(null);
    if (failures.length > 0) {
      flash(`Could not delete: ${failures.join(', ')}`, false);
    } else {
      flash('Audit deleted.', true);
    }
    fetchLatest(); fetchHistory();
  };

  const exportReport = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `audit-report-${report.generated_at || Date.now()}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
    flash('Report exported.');
  };

  const openHistoryDay = async (row: any) => {
    const [seoData, geoData] = await Promise.all([
      row.seo_id ? fetch(`/api/workspaces/${workspaceId}/seo/audits/${row.seo_id}`, { headers: authHeaders() }).then(r => r.ok ? r.json() : null) : null,
      row.geo_id ? fetch(`/api/workspaces/${workspaceId}/seo/audits/${row.geo_id}`, { headers: authHeaders() }).then(r => r.ok ? r.json() : null) : null,
    ]);
    const seoScore = seoData?.audit?.seo?.score_100 ?? null;
    const geoScore = geoData?.audit?.geo?.score_100 ?? null;
    const overall = seoScore != null && geoScore != null ? Math.round(((seoScore + geoScore) / 2) * 10) / 10 : (seoScore ?? geoScore);
    const priority_issues: any[] = [];
    if (seoData) {
      const decisions = seoData.decisions || {};
      for (const it of (seoData.audit?.priority_issues || [])) {
        const key = `${it.area}::${it.issue}`;
        const dec = decisions[key] || {};
        priority_issues.push({ ...it, pipeline: 'SEO', audit_id: seoData.id, key, decision: dec.decision, edited_text: dec.edited_text });
      }
    }
    if (geoData) {
      const decisions = geoData.decisions || {};
      for (const it of (geoData.audit?.priority_issues || [])) {
        const key = `${it.area}::${it.issue}`;
        const dec = decisions[key] || {};
        priority_issues.push({ ...it, pipeline: 'GEO', audit_id: geoData.id, key, decision: dec.decision, edited_text: dec.edited_text });
      }
    }
    priority_issues.sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity));
    setReport({
      has_audit: !!(seoData || geoData), target_url: row.target_url, generated_at: row.date,
      overall_health: overall, seo: seoData, geo: geoData, priority_issues,
    });
    setViewingDate(row.date);
  };

  const decide = async (key: string, audit_id: number, decision: 'approved' | 'edited' | 'rejected', editedText?: string) => {
    setReport((r: any) => r ? { ...r, priority_issues: r.priority_issues.map((it: any) => it.key === key ? { ...it, decision, edited_text: editedText ?? null } : it) } : r);
    setEditingKey(null);
    try {
      await fetch(`/api/workspaces/${workspaceId}/seo/audits/${audit_id}/decision`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ issue_key: key, decision, edited_text: editedText ?? null }),
      });
      flash('', true);
    } catch { /* local state already reflects the click */ }
  };

  // Categories the Apply SEO Fixes pipeline actually reads today (backend/connector_routes.py
  // _get_approved_fixes calls) — kept in sync manually since this is UI-only convenience, not
  // a source of truth. GEO recommendations aren't wired into any adapter yet, so they're
  // excluded here even though some (Structured Knowledge, AI Readability) look similar to
  // their SEO counterparts.
  const AUTO_APPLICABLE_CATEGORIES = new Set(['Content', 'Metadata', 'Structured Data', 'Technical SEO', 'Accessibility']);

  // Sequential (awaited), NOT fired concurrently: the backend's decision endpoint does a
  // read-modify-write on one JSON blob (read keywords_data -> add key -> commit) with no
  // locking. Firing 20-30 decide() calls at once means they all read the same starting
  // state and race to write back — last write wins, silently dropping every other decision
  // (found live: "Reject All" on 30 items left only 4 persisted, and one stale "approved"
  // from an earlier test survived the race and triggered a REAL GitHub PR). Awaiting each
  // call before starting the next makes every write see the previous one's result.
  const approveAllAutoApplicable = async () => {
    for (const it of (report?.priority_issues || [])) {
      if (it.decision) continue; // don't overwrite an existing decision
      const category = it.area.includes('·') ? it.area.split('·')[1].trim() : it.area;
      if (it.pipeline === 'SEO' && AUTO_APPLICABLE_CATEGORIES.has(category)) {
        await decide(it.key, it.audit_id, 'approved');
      }
    }
  };

  const rejectAll = async () => {
    for (const it of (report?.priority_issues || [])) {
      await decide(it.key, it.audit_id, 'rejected');
    }
  };

  // Local-only reset: the backend's decision model only accepts approved/edited/rejected
  // (no "pending" or delete), so this can't remove the saved server-side record without
  // changing the backend — out of scope here. This resets what you SEE; reopening the
  // report will show the previously saved decisions again unless you re-decide each one.
  const clearAllDecisions = () => {
    setReport((r: any) => r ? { ...r, priority_issues: r.priority_issues.map((it: any) => ({ ...it, decision: undefined, edited_text: undefined })) } : r);
    flash('Cleared in this view. Reopening the report will show previously saved decisions — clearing does not delete them from the server.', false);
  };

  const issues: any[] = report?.priority_issues || [];
  const bySeverity = SEV_ORDER.map(sev => ({ sev, items: issues.filter(i => i.severity === sev) })).filter(g => g.items.length);

  return (
    <AnimatePresence>
      <div className="review-drawer-overlay" onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 6000, backdropFilter: 'blur(12px)', background: 'rgba(0, 0, 0, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.97, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 16 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          style={{ width: '100%', maxWidth: '980px', height: '90vh', background: '#09090b', border: '1px solid var(--border-color)', borderRadius: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)' }}>

          {/* Header */}
          <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Globe size={19} style={{ color: '#00ff9d' }} /> Website Audit Report
                </h1>
                <StatusPill status={overallStatus} />
                {viewingDate && <span style={{ fontSize: '11px', color: '#ffae00', border: '1px solid rgba(255,174,0,0.35)', borderRadius: '20px', padding: '2px 9px' }}>Viewing {viewingDate}</span>}
                {gscConnected && (
                  <span title="During future audits, Search Console data will be used together with Firecrawl and SEO analysis."
                    style={{ fontSize: '10px', fontWeight: 700, color: '#22C55E', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '20px', padding: '3px 9px' }}>
                    Google Search Console Connected
                  </span>
                )}
              </div>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0 }}>
                {report?.target_url || seoRun.target_url || geoRun.target_url || 'No audit yet'}
                {report?.generated_at && <> · Generated {toUtcDate(report.generated_at)?.toLocaleString()}</>}
              </p>
            </div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px', borderRadius: '50%' }}>
              <X size={18} />
            </button>
          </div>

          {/* Scrollable body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
            {viewingDate && (
              <button onClick={fetchLatest} style={{ marginBottom: '18px', fontSize: '12px', color: '#00ff9d', background: 'rgba(0,255,157,0.08)', border: '1px solid rgba(0,255,157,0.3)', borderRadius: '7px', padding: '7px 12px', cursor: 'pointer' }}>
                ← Back to latest report
              </button>
            )}

            {!viewingDate && (
              <>
                <PipelineProgress label="SEO" run={seoRun} accent="#00ff9d" onCancel={() => cancelPipeline('SEO')} busy={busy === 'SEO'} avgDurationSeconds={avgDuration.SEO} />
                <PipelineProgress label="GEO" run={geoRun} accent="#8B85FF" onCancel={() => cancelPipeline('GEO')} busy={busy === 'GEO'} avgDurationSeconds={avgDuration.GEO} />
              </>
            )}

            {/* Connect & Publish — pulled up to the top so it isn't lost below the audit
                findings. Self-contained (fetches its own status/items), so it works even
                before an audit has run — connecting early is encouraged. */}
            {!viewingDate && <ImplementChangesSection workspaceId={workspaceId} refreshKey={`${seoRun.status}-${geoRun.status}`} highlight />}

            {loading && <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Loading report…</p>}

            {!loading && !report?.has_audit && !anyRunning && (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                No audit yet. Run the SEO and/or GEO pipeline above — this report fills in as each one completes,
                with real, measured scores for content, metadata, technical SEO, accessibility, structured data,
                AI readability and citation-readiness. Nothing is invented.
              </p>
            )}

            {report?.has_audit && (
              <>
                {/* The report shows the newest STORED audit, which is not necessarily the URL
                    the user just typed - if their run hasn't finished (or never started) they
                    would otherwise read a previous site's scores as if they were this site's.
                    These two banners make that visible instead of silent. */}
                {report.url_mismatch && (
                  <div style={{
                    marginBottom: '16px', padding: '12px 14px', borderRadius: '10px',
                    background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.45)',
                    color: 'var(--text-primary)', fontSize: '12.5px', lineHeight: 1.55,
                  }}>
                    <strong style={{ color: '#f87171' }}>This report is for a different website.</strong>
                    <div style={{ marginTop: '5px' }}>
                      {report.seo_target_url && <>SEO audit ran on <code>{report.seo_target_url}</code>. </>}
                      {report.geo_target_url && report.geo_target_url !== report.seo_target_url
                        && <>GEO audit ran on <code>{report.geo_target_url}</code>. </>}
                      Run the pipeline again on the address you want audited — the scores below
                      describe the site named above, not the one you entered.
                    </div>
                  </div>
                )}
                {!report.url_mismatch && report.stale_half && (
                  <div style={{
                    marginBottom: '16px', padding: '10px 14px', borderRadius: '10px',
                    background: 'rgba(234,179,8,0.10)', border: '1px solid rgba(234,179,8,0.40)',
                    color: 'var(--text-primary)', fontSize: '12.5px', lineHeight: 1.55,
                  }}>
                    <strong style={{ color: '#facc15' }}>Half of this report is older.</strong>{' '}
                    The {report.stale_half} audit is {report.age_gap_days} day
                    {report.age_gap_days === 1 ? '' : 's'} behind the other, so the combined score
                    mixes two points in time.
                  </div>
                )}

                {/* Overall / SEO / GEO scores */}
                <div style={{ marginBottom: '22px' }}>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    <ScoreTile label="Overall Health" value={report.url_mismatch ? null : report.overall_health} />
                    <ScoreTile label="SEO Score" value={report.seo?.audit?.seo?.score_100 ?? null} />
                    <ScoreTile label="GEO Score" value={report.geo?.audit?.geo?.score_100 ?? null} />
                  </div>
                  {!anyRunning && (report.seo?.duration_seconds || report.geo?.duration_seconds) && (
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Audit duration:
                      {report.seo?.duration_seconds ? ` SEO ${formatDuration(report.seo.duration_seconds)}` : ''}
                      {report.seo?.duration_seconds && report.geo?.duration_seconds ? ' · ' : ''}
                      {report.geo?.duration_seconds ? `GEO ${formatDuration(report.geo.duration_seconds)}` : ''}
                    </div>
                  )}
                </div>

                {/* 1. Executive Summary */}
                <div style={{ marginBottom: '26px' }}>
                  <h3 style={{ fontSize: '14px', margin: '0 0 8px', color: '#fff' }}>1. Executive Summary</h3>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
                    {report.seo && report.geo
                      ? `This site scores ${report.overall_health}/100 overall — ${report.seo.audit.seo.score_100}/100 on traditional Google SEO and ${report.geo.audit.geo.score_100}/100 on AI answer-engine visibility (GEO). `
                      : report.seo ? `SEO scores ${report.seo.audit.seo.score_100}/100 from the latest measured crawl. Run the GEO pipeline to add AI-visibility scoring to this report. `
                      : `GEO scores ${report.geo.audit.geo.score_100}/100 from the latest measured crawl. Run the SEO pipeline to add traditional search scoring to this report. `}
                    {issues.length > 0 && `${issues.filter(i => i.severity === 'Critical').length} critical and ${issues.length} total fixes were identified below, all traced to real measured evidence.`}
                  </p>
                </div>

                {/* Next Step */}
                <div style={{ marginBottom: '26px', padding: '14px 16px', background: 'rgba(0,255,157,0.05)', border: '1px solid rgba(0,255,157,0.2)', borderRadius: '10px' }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#00ff9d', marginBottom: '4px' }}>Next Step</div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                    Review the recommendations below. Approve the fixes you want to implement. After reviewing them,
                    connect or open your website platform to manually apply the changes. Automatic AI publishing will
                    be available in a future update.
                  </p>
                </div>

                {/* 2. SEO Audit */}
                {report.seo && (
                  <div style={{ marginBottom: '26px' }}>
                    <h3 style={{ fontSize: '14px', margin: '0 0 12px', color: '#fff', display: 'flex', justifyContent: 'space-between' }}>
                      <span>2. SEO Audit</span>
                      <span style={{ color: scoreColor(report.seo.audit.seo.score_100) }}>{report.seo.audit.seo.score_100}/100</span>
                    </h3>
                    {report.seo.audit.seo.categories.map((c: any) => <CategoryRow key={c.name} c={c} />)}
                    {report.seo.audit.real_keywords && (
                      <div style={{ marginTop: '4px', marginBottom: '4px', padding: '12px 14px', background: 'rgba(0,255,157,0.05)', border: '1px solid rgba(0,255,157,0.2)', borderRadius: '10px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff', marginBottom: '6px' }}>Real Search Queries</div>
                        {report.seo.audit.real_keywords.source === 'search_console' ? (
                          report.seo.audit.real_keywords.queries.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                              {report.seo.audit.real_keywords.queries.slice(0, 10).map((q: any) => (
                                <div key={q.query} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '11.5px' }}>
                                  <span style={{ color: '#fff' }}>{q.query}</span>
                                  <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{q.clicks} clicks · {q.impressions} impr · pos {q.position}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>Connected, but no query data yet for the last 28 days.</p>
                          )
                        ) : (
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>{report.seo.audit.real_keywords.message}</p>
                        )}
                      </div>
                    )}
                    <NarrativeReport label="SEO" text={report.seo.narrative_report} />
                  </div>
                )}

                {/* 3. GEO / AEO Audit */}
                {report.geo && (
                  <div style={{ marginBottom: '26px' }}>
                    <h3 style={{ fontSize: '14px', margin: '0 0 12px', color: '#fff', display: 'flex', justifyContent: 'space-between' }}>
                      <span>3. GEO / AEO Audit</span>
                      <span style={{ color: scoreColor(report.geo.audit.geo.score_100) }}>{report.geo.audit.geo.score_100}/100</span>
                    </h3>
                    {report.geo.audit.geo.categories.map((c: any) => <CategoryRow key={c.name} c={c} />)}
                    {report.geo.audit.geo.llm_recall && (
                      <div style={{ marginTop: '4px', padding: '12px 14px', background: 'rgba(90,82,255,0.06)', border: '1px solid rgba(90,82,255,0.2)', borderRadius: '10px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff', marginBottom: '4px' }}>Brand Recall</div>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                          {report.geo.audit.geo.llm_recall.brand_recognised ? 'Your brand is recognised' : 'Your brand is NOT recognised'} by AI answer engines when asked directly.
                          {report.geo.audit.geo.llm_recall.model_response ? ` "${String(report.geo.audit.geo.llm_recall.model_response).slice(0, 180)}…"` : ''}
                        </p>
                      </div>
                    )}
                    <NarrativeReport label="GEO" text={report.geo.narrative_report} />
                  </div>
                )}

                {/* 4. Priority Fixes */}
                {issues.length > 0 && (
                  <div style={{ marginBottom: '26px' }}>
                    <h3 style={{ fontSize: '14px', margin: '0 0 12px', color: '#fff' }}>4. Priority Fixes</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {bySeverity.map(g => (
                        <div key={g.sev}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: SEV_COLOR[g.sev], background: `${SEV_COLOR[g.sev]}1f`, border: `1px solid ${SEV_COLOR[g.sev]}55`, borderRadius: '5px', padding: '2px 8px' }}>{g.sev}</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{g.items.length}</span>
                          </div>
                          <ul style={{ margin: 0, paddingLeft: '18px' }}>
                            {g.items.map((it, i) => <li key={i} style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{it.area} — {it.issue}</li>)}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. AI Suggested Improvements */}
                {issues.length > 0 && (
                  <div style={{ marginBottom: '26px' }}>
                    <h3 style={{ fontSize: '14px', margin: '0 0 4px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertTriangle size={14} style={{ color: '#ffae00' }} /> 5. AI Suggested Improvements
                    </h3>
                    <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                      Approve, edit or reject each suggestion directly below — no need to open a row first.
                      Approved/edited items appear in "Connect & Publish" above, ready to implement.
                    </p>

                    {!viewingDate && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
                        <button onClick={approveAllAutoApplicable}
                          title="Approves every recommendation in a category the Apply SEO Fixes pipeline currently reads (Content, Metadata, Structured Data, Technical SEO, Accessibility on SEO). GEO recommendations aren't wired into auto-apply yet, so they're left as-is."
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 600, color: '#00ff9d', background: 'rgba(0,255,157,0.08)', border: '1px solid rgba(0,255,157,0.35)', borderRadius: '7px', padding: '7px 12px', cursor: 'pointer' }}>
                          <CheckCheck size={13} /> Approve All Auto-Applicable
                        </button>
                        <button onClick={rejectAll}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 600, color: '#ff5c5c', background: 'rgba(255,92,92,0.08)', border: '1px solid rgba(255,92,92,0.35)', borderRadius: '7px', padding: '7px 12px', cursor: 'pointer' }}>
                          <X size={13} /> Reject All
                        </button>
                        <button onClick={clearAllDecisions}
                          title="Resets this view back to Pending. Note: this only clears what you see here — it doesn't delete the decisions already saved on the server, so reopening this report will show your previous approvals again unless you re-decide each one."
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '7px', padding: '7px 12px', cursor: 'pointer' }}>
                          <RotateCcw size={13} /> Clear Decisions
                        </button>
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                      {issues.map((it, i) => {
                        const isOpen = !!open[it.key];
                        const accent = it.decision === 'approved' ? '#00ff9d' : it.decision === 'edited' ? '#8B85FF' : it.decision === 'rejected' ? '#ff5c5c' : 'var(--border-color)';
                        const statusLabel = it.decision ? it.decision.toUpperCase() : 'PENDING';
                        const evidence = report.seo && it.pipeline === 'SEO' ? findCategoryEvidence(report.seo.audit.seo, it.area)
                                        : report.geo && it.pipeline === 'GEO' ? findCategoryEvidence(report.geo.audit.geo, it.area) : [];
                        const isEditing = editingKey === it.key;
                        return (
                          <div key={i} style={{
                            background: it.decision === 'approved' ? 'rgba(0,255,157,0.06)' : it.decision === 'edited' ? 'rgba(139,133,255,0.06)' : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${accent}`, borderLeft: `3px solid ${accent}`, borderRadius: '10px', overflow: 'hidden',
                          }}>
                            <div style={{ padding: '11px 13px 9px', display: 'flex', alignItems: 'center', gap: '9px' }}>
                              <span style={{ fontSize: '9.5px', fontWeight: 700, flexShrink: 0, color: '#fff', background: it.pipeline === 'SEO' ? 'rgba(0,255,157,0.15)' : 'rgba(139,133,255,0.2)', borderRadius: '4px', padding: '2px 6px' }}>{it.pipeline}</span>
                              <span style={{ fontSize: '10px', fontWeight: 700, flexShrink: 0, color: SEV_COLOR[it.severity] || '#fff', background: `${SEV_COLOR[it.severity] || '#fff'}1f`, border: `1px solid ${SEV_COLOR[it.severity] || '#fff'}55`, borderRadius: '5px', padding: '2px 7px' }}>{it.severity}</span>
                              <span style={{ flex: 1, minWidth: 0, fontSize: '12.5px', textDecoration: it.decision === 'rejected' ? 'line-through' : 'none' }}>{it.edited_text || it.issue}</span>
                              <span style={{ fontSize: '9.5px', fontWeight: 700, color: accent, textTransform: 'uppercase', flexShrink: 0, background: `${accent}1a`, border: `1px solid ${accent}55`, borderRadius: '5px', padding: '2px 7px' }}>{statusLabel}</span>
                              <button onClick={() => setOpen(o => ({ ...o, [it.key]: !o[it.key] }))} title="Details"
                                style={{ flexShrink: 0, background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', color: 'var(--text-secondary)' }}>
                                <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                              </button>
                            </div>

                            {/* Actions are always visible — no need to expand the row first. */}
                            {!viewingDate && (isEditing ? (
                              <div style={{ padding: '0 13px 12px' }}>
                                <textarea value={editText} onChange={e => setEditText(e.target.value)}
                                  style={{ width: '100%', minHeight: '60px', resize: 'vertical', fontSize: '12.5px', color: '#fff', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '9px 11px', fontFamily: 'inherit' }} />
                                <div style={{ display: 'flex', gap: '8px', marginTop: '9px' }}>
                                  <button onClick={() => decide(it.key, it.audit_id, 'edited', editText)} style={{ fontSize: '12px', fontWeight: 600, color: '#03121a', background: '#8B85FF', border: 'none', borderRadius: '7px', padding: '6px 13px', cursor: 'pointer' }}>Save</button>
                                  <button onClick={() => setEditingKey(null)} style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '7px', padding: '6px 13px', cursor: 'pointer' }}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ padding: '0 13px 12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <button onClick={() => decide(it.key, it.audit_id, 'approved')}
                                  style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, color: it.decision === 'approved' ? '#03121a' : '#00ff9d', background: it.decision === 'approved' ? '#00ff9d' : 'rgba(0,255,157,0.08)', border: '1px solid rgba(0,255,157,0.35)', borderRadius: '7px', padding: '6px 12px', cursor: 'pointer' }}>
                                  <Check size={13} /> Approve
                                </button>
                                <button onClick={() => { setEditingKey(it.key); setEditText(it.edited_text || it.issue); }}
                                  style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, color: '#8B85FF', background: 'rgba(90,82,255,0.1)', border: '1px solid rgba(90,82,255,0.35)', borderRadius: '7px', padding: '6px 12px', cursor: 'pointer' }}>
                                  <PenSquare size={13} /> Edit
                                </button>
                                <button onClick={() => decide(it.key, it.audit_id, 'rejected')}
                                  style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, color: it.decision === 'rejected' ? '#03121a' : '#ff5c5c', background: it.decision === 'rejected' ? '#ff5c5c' : 'rgba(255,92,92,0.08)', border: '1px solid rgba(255,92,92,0.35)', borderRadius: '7px', padding: '6px 12px', cursor: 'pointer' }}>
                                  <X size={13} /> Reject
                                </button>
                              </div>
                            ))}

                            {/* Expandable — details/evidence only, no actions hidden in here. */}
                            {isOpen && (
                              <div style={{ padding: '0 13px 13px', borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '2px', paddingTop: '10px' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px' }}>{it.area} · Expected impact: {it.impact}</div>
                                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '9px' }}>
                                  <b style={{ color: '#fff' }}>Current Issue:</b> {it.area.includes('·') ? it.area.split('·')[1].trim() : it.area} needs attention.
                                </div>
                                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '9px' }}>
                                  <b style={{ color: '#fff' }}>Suggested Fix:</b> {it.issue}
                                </div>
                                {evidence.length > 0 && (
                                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                                    <b style={{ color: '#fff' }}>Evidence:</b>
                                    <ul style={{ margin: '4px 0 0', paddingLeft: '16px' }}>
                                      {evidence.map((e: string, ei: number) => <li key={ei} style={{ lineHeight: 1.5 }}>{e}</li>)}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}


            {/* Finished? Run another audit to verify the improvements */}
            {!viewingDate && report?.has_audit && !anyRunning && (
              <div style={{ marginTop: '10px', paddingTop: '18px', borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                  Finished updating your website? Run another SEO + GEO audit to verify the improvements.
                </p>
                <GlowButton variant="primary" icon={<Play size={15} />} onClick={() => setConfirmRunBoth(true)}>Run Audit Again</GlowButton>
              </div>
            )}

            {/* Audit History */}
            {history.filter(h => h.date !== report?.generated_at?.slice(0, 10)).length > 0 && (
              <div style={{ marginTop: '10px', paddingTop: '18px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', fontWeight: 700, color: '#fff', marginBottom: '10px' }}>
                  <History size={14} /> Audit History
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {history.map(row => (
                    <div key={row.date} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '9px 12px', background: viewingDate === row.date ? 'rgba(0,255,157,0.06)' : 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                      <button onClick={() => openHistoryDay(row)} style={{ flex: 1, textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', color: '#fff', font: 'inherit', minWidth: 0 }}>
                        <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{toUtcDate(row.date)?.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}</span>
                        <span style={{ fontSize: '11.5px', color: row.seo_score != null ? scoreColor(row.seo_score) : 'var(--text-muted)' }}>SEO {row.seo_score ?? '—'}</span>
                        <span style={{ fontSize: '11.5px', color: row.geo_score != null ? scoreColor(row.geo_score) : 'var(--text-muted)' }}>GEO {row.geo_score ?? '—'}</span>
                        <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#00e676' }}>{row.status}</span>
                      </button>
                      <button onClick={() => setConfirmDelete({ seoId: row.seo_id, geoId: row.geo_id, label: row.date })} title="Delete" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer actions */}
          {!viewingDate && report?.has_audit && !anyRunning && (
            <div style={{ padding: '18px 32px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '10px', flexWrap: 'wrap', background: 'rgba(0,0,0,0.2)', flexShrink: 0 }}>
              <GlowButton variant="primary" icon={<Play size={15} />} onClick={() => setConfirmRunAgain('SEO')}>Run SEO Again</GlowButton>
              <GlowButton variant="primary" icon={<Play size={15} />} onClick={() => setConfirmRunAgain('GEO')} style={{ background: '#8B85FF' }}>Run GEO Again</GlowButton>
              <button onClick={exportReport} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, color: '#fff', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '9px 15px', cursor: 'pointer' }}>
                <Download size={13} /> Export Report
              </button>
              <button onClick={() => setCompareOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, color: '#fff', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '9px 15px', cursor: 'pointer' }}>
                <TrendingUp size={13} /> Compare Previous
              </button>
              <button onClick={() => setConfirmDelete({ seoId: report.seo?.id, geoId: report.geo?.id, label: 'this audit' })}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, color: '#ff5c5c', background: 'rgba(255,92,92,0.06)', border: '1px solid rgba(255,92,92,0.25)', borderRadius: '8px', padding: '9px 15px', cursor: 'pointer', marginLeft: 'auto' }}>
                <Trash2 size={13} /> Delete
              </button>
            </div>
          )}
        </motion.div>
      </div>

      {confirmRunAgain && (
        <ConfirmDialog title="Run New Audit?" confirmLabel="Run New Audit"
          message={`This will archive the current ${confirmRunAgain} audit and start a fresh ${confirmRunAgain} audit using the latest version of your website. The ${confirmRunAgain === 'SEO' ? 'GEO' : 'SEO'} audit is not affected.`}
          onCancel={() => setConfirmRunAgain(null)} onConfirm={() => runAgain(confirmRunAgain)} />
      )}
      {confirmRunBoth && (
        <ConfirmDialog title="Run Audit Again?" confirmLabel="Run Audit Again"
          message="This will start a fresh SEO and GEO audit using the latest version of your website, so you can verify the improvements."
          onCancel={() => setConfirmRunBoth(false)} onConfirm={runBoth} />
      )}
      {confirmDelete && (
        <ConfirmDialog title="Delete Audit?" confirmLabel="Delete" danger
          message="This action cannot be undone."
          onCancel={() => setConfirmDelete(null)} onConfirm={doDelete} />
      )}
      {compareOpen && <CompareModal workspaceId={workspaceId} onClose={() => setCompareOpen(false)} />}
    </AnimatePresence>
  );
};

// Combined SEO+GEO month-over-month comparison — reuses the existing /seo/comparison endpoint.
const CompareModal: React.FC<{ workspaceId: number | null; onClose: () => void }> = ({ workspaceId, onClose }) => {
  const [seoData, setSeoData] = React.useState<any>(null);
  const [geoData, setGeoData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    Promise.all([
      fetch(`/api/workspaces/${workspaceId}/seo/comparison?pipeline=SEO`, { headers: authHeaders() }).then(r => r.ok ? r.json() : null),
      fetch(`/api/workspaces/${workspaceId}/seo/comparison?pipeline=GEO`, { headers: authHeaders() }).then(r => r.ok ? r.json() : null),
    ]).then(([s, g]) => { setSeoData(s); setGeoData(g); }).finally(() => setLoading(false));
  }, [workspaceId]);
  const arrow = (dir?: string) => dir === 'improved' ? { s: '▲', c: '#00ff9d' } : dir === 'worsened' ? { s: '▼', c: '#ff5c5c' } : { s: '–', c: 'var(--text-muted)' };
  const disp = (v: any) => (typeof v === 'boolean' ? (v ? 'Yes' : 'No') : (v ?? '—'));
  const block = (label: string, data: any) => (
    <div style={{ marginBottom: '18px' }}>
      <h4 style={{ fontSize: '13px', margin: '0 0 8px', color: '#fff' }}>{label}</h4>
      {!data || data.runs_available < 2 ? (
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Need at least two completed runs to compare.</p>
      ) : (
        <>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
            Score {data.previous_run.score} → <b style={{ color: '#fff' }}>{data.current_run.score}</b>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {data.changes.map((c: any) => {
              const a = arrow(c.direction);
              return (
                <div key={c.metric} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '5px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{c.metric}</span>
                  <span style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{disp(c.previous)} → {disp(c.current)}</span>
                    <span style={{ color: a.c, fontWeight: 600 }}>{a.s}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 6100, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '520px', maxHeight: '80vh', overflowY: 'auto', background: 'rgba(18,20,28,0.99)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '16px', margin: 0 }}>Compare with previous run</h3>
          <button onClick={onClose} style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '7px', padding: '6px 12px', cursor: 'pointer' }}>Close</button>
        </div>
        {loading ? <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Loading…</p> : (<>{block('SEO', seoData)}{block('GEO', geoData)}</>)}
      </div>
    </div>
  );
};

// "Implement Approved Changes" — shows the approved/edited items ready to apply, then lets
// the user open (if connected) or connect (inline, reusing the real connector panels — no
// duplicate OAuth flow) each platform where the site actually lives. Rendered at the top of
// the report (highlight=true) so it isn't lost below the audit findings — it's fully
// self-contained (own fetches), so it renders safely even before an audit has run.
// Shared result box for the three apply-fixes actions below — distinguishes "needs
// approval" (amber, actionable) from a real error (red) instead of showing the raw
// backend message the same way for both.
const ApplyResultBox: React.FC<{ result: { ok: boolean; msg: string; url?: string; needsApproval?: boolean }; urlLabel: string }> = ({ result, urlLabel }) => {
  const color = result.ok ? '#00ff9d' : result.needsApproval ? '#ffae00' : '#ff5c5c';
  const bg = result.ok ? 'rgba(0,255,157,0.08)' : result.needsApproval ? 'rgba(255,174,0,0.08)' : 'rgba(255,92,92,0.08)';
  return (
    <div style={{ marginTop: '7px', fontSize: '11px', lineHeight: 1.5, color, background: bg, border: `1px solid ${color}55`, borderRadius: '7px', padding: '8px 10px' }}>
      {result.msg}
      {result.url && <> <a href={result.url} target="_blank" rel="noreferrer" style={{ color: '#8B85FF', fontWeight: 700 }}>{urlLabel} →</a></>}
    </div>
  );
};

// Read-only "Developer Preview" of the exact UniversalSeoFix object the backend generated —
// the same JSON every platform adapter (GitHub/WordPress/Shopify) consumes, shown as-is
// before/alongside whatever that adapter did with it. Collapsed by default; renders nothing
// when there's no fix to show (e.g. no Structured Data/Metadata recommendation was
// approved, so the backend never generated one).
const UniversalFixPreview: React.FC<{ fix: any }> = ({ fix }) => {
  const [open, setOpen] = React.useState(false);
  if (!fix) return null;
  return (
    <div style={{ marginTop: '8px', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: '100%', textAlign: 'left', background: 'rgba(255,255,255,0.03)', border: 'none', cursor: 'pointer', padding: '8px 11px', display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--text-secondary)', font: 'inherit', fontSize: '11px', fontWeight: 600 }}>
        <ChevronDown size={12} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }} />
        Developer Preview — Universal SEO JSON
      </button>
      {open && (
        <pre style={{
          margin: 0, padding: '11px', fontSize: '11px', lineHeight: 1.5, color: '#c9d1d9',
          background: '#0d1117', maxHeight: '320px', overflow: 'auto', fontFamily: 'var(--font-mono, monospace)',
          whiteSpace: 'pre', userSelect: 'text',
        }}>
          {JSON.stringify(fix, null, 2)}
        </pre>
      )}
    </div>
  );
};

// Per-change before/after for WordPress content edits. Shows only the changed region —
// the backend returns the targeted node's old and new HTML, never the whole page, so a
// small fix stays reviewable instead of becoming a wall of markup.
const ContentChangeDiff: React.FC<{ changes: any[]; manualReview: any[] }> = ({ changes, manualReview }) => {
  const [open, setOpen] = React.useState<number | null>(changes.length === 1 ? 0 : null);
  if (!changes.length && !manualReview.length) return null;

  const ACTION_LABEL: Record<string, string> = { replace: 'Replaces', insert: 'Inserts', delete: 'Deletes' };
  return (
    <div style={{ marginTop: '9px' }}>
      {changes.length > 0 && (
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
          {changes.length} content change{changes.length === 1 ? '' : 's'} ready
        </div>
      )}
      {changes.map((c, i) => (
        <div key={i} style={{ border: '1px solid var(--border-color)', borderRadius: '7px', marginBottom: '6px', overflow: 'hidden' }}>
          <button onClick={() => setOpen(o => (o === i ? null : i))}
            style={{ width: '100%', textAlign: 'left', background: 'rgba(255,255,255,0.03)', border: 'none', cursor: 'pointer', padding: '7px 9px', display: 'flex', alignItems: 'center', gap: '7px', color: '#fff', font: 'inherit', fontSize: '11px' }}>
            <span style={{ fontWeight: 700, color: '#00ff9d', flexShrink: 0 }}>{i + 1}.</span>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {c.fix || c.reason}
            </span>
            <span style={{ fontSize: '9.5px', color: 'var(--text-secondary)', flexShrink: 0 }}>
              {ACTION_LABEL[c.action] || c.action} &lt;{c.target_tag}&gt;
            </span>
            <ChevronDown size={12} style={{ flexShrink: 0, transform: open === i ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
          </button>
          {open === i && (
            <div style={{ padding: '9px', fontSize: '10.5px', fontFamily: 'var(--font-mono, monospace)' }}>
              {c.reason && (
                <div style={{ fontFamily: 'inherit', fontSize: '10.5px', color: 'var(--text-secondary)', marginBottom: '7px' }}>{c.reason}</div>
              )}
              <div style={{ color: '#ff5c5c', fontWeight: 700, marginBottom: '3px' }}>BEFORE</div>
              <pre style={{ margin: '0 0 8px', padding: '7px', background: 'rgba(255,92,92,0.07)', border: '1px solid rgba(255,92,92,0.2)', borderRadius: '5px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#e6a4a4', maxHeight: '160px', overflow: 'auto' }}>
                {c.before || '(nothing — this is new content)'}
              </pre>
              <div style={{ color: '#00ff9d', fontWeight: 700, marginBottom: '3px' }}>AFTER</div>
              <pre style={{ margin: 0, padding: '7px', background: 'rgba(0,255,157,0.07)', border: '1px solid rgba(0,255,157,0.2)', borderRadius: '5px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#9fe6c4', maxHeight: '200px', overflow: 'auto' }}>
                {c.after || '(removed)'}
              </pre>
            </div>
          )}
        </div>
      ))}

      {manualReview.length > 0 && (
        <div style={{ marginTop: '8px', padding: '8px 10px', background: 'rgba(255,174,0,0.08)', border: '1px solid rgba(255,174,0,0.3)', borderRadius: '7px' }}>
          <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#ffae00', marginBottom: '5px' }}>
            {manualReview.length} need{manualReview.length === 1 ? 's' : ''} manual review — not applied
          </div>
          {manualReview.map((m, i) => (
            <div key={i} style={{ fontSize: '10.5px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '3px' }}>
              <span style={{ color: '#fff' }}>{m.fix || m.target || 'Change'}</span> — {m.error}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ImplementChangesSection: React.FC<{ workspaceId: number | null; refreshKey: string; highlight?: boolean }> = ({ workspaceId, refreshKey, highlight }) => {
  const [items, setItems] = React.useState<any[]>([]);
  const [st, setSt] = React.useState<{ gh?: any; wp?: any; sh?: any }>({});
  const [ghMap, setGhMap] = React.useState<any>(null);   // GitHub repo scan summary
  const [expanded, setExpanded] = React.useState<'gh' | 'wp' | 'sh' | null>(null);
  // The expanded connector panel renders BELOW the three cards, which on a short viewport
  // puts it off-screen — clicking "Connect WordPress" then looks like nothing happened.
  // Scroll it into view so the form the user just asked for is actually visible.
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (expanded && panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [expanded]);
  const [applying, setApplying] = React.useState(false);
  const [prResult, setPrResult] = React.useState<{ ok: boolean; msg: string; url?: string; needsApproval?: boolean; universal_fix?: any } | null>(null);

  const applySeoFixes = async () => {
    if (!workspaceId) return;
    setApplying(true); setPrResult(null);
    try {
      const r = await fetch(`/api/connectors/github/${workspaceId}/apply-seo-fixes`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({}),
      });
      const d = await r.json();
      if (r.ok && d.pr_url) setPrResult({ ok: true, msg: d.message || 'Pull request opened.', url: d.pr_url, universal_fix: d.universal_fix });
      else if (r.status === 409)
        setPrResult({ ok: false, needsApproval: true,
          msg: 'No recommendations approved yet. Go to "5. AI Suggested Improvements" below and approve at least one before applying.' });
      else setPrResult({ ok: false, msg: d.detail || 'Could not open the pull request.' });
    } catch { setPrResult({ ok: false, msg: 'Could not reach the server.' }); }
    setApplying(false);
  };

  // Shopify: preview the proposed SEO title/description, then apply (no PR — reviewed here).
  const [shopPreview, setShopPreview] = React.useState<any>(null);
  const [shopBusy, setShopBusy] = React.useState<'preview' | 'apply' | null>(null);
  const [shopResult, setShopResult] = React.useState<{ ok: boolean; msg: string; url?: string; needsApproval?: boolean } | null>(null);

  const previewShopify = async () => {
    if (!workspaceId) return;
    setShopBusy('preview'); setShopResult(null); setShopPreview(null);
    try {
      const r = await fetch(`/api/connectors/shopify/${workspaceId}/apply-seo-fixes`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ dry_run: true }),
      });
      const d = await r.json();
      if (r.ok && d.proposed) setShopPreview(d);
      else if (r.status === 409)
        setShopResult({ ok: false, needsApproval: true,
          msg: 'No Metadata recommendations approved yet. Go to "5. AI Suggested Improvements" below and approve at least one before applying.' });
      else setShopResult({ ok: false, msg: d.detail || 'Could not build a preview.' });
    } catch { setShopResult({ ok: false, msg: 'Could not reach the server.' }); }
    setShopBusy(null);
  };

  const applyShopify = async () => {
    if (!workspaceId || !shopPreview) return;
    setShopBusy('apply');
    try {
      const r = await fetch(`/api/connectors/shopify/${workspaceId}/apply-seo-fixes`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ page_id: shopPreview.page?.id }),
      });
      const d = await r.json();
      if (r.ok) { setShopResult({ ok: true, msg: d.message || 'Updated in Shopify.', url: d.admin_url }); setShopPreview(null); }
      else setShopResult({ ok: false, msg: d.detail || 'Could not update Shopify.' });
    } catch { setShopResult({ ok: false, msg: 'Could not reach the server.' }); }
    setShopBusy(null);
  };

  // Theme-level SEO (canonical/OG/Twitter/JSON-LD live in Liquid, not Page metafields) —
  // always applied to a duplicated DRAFT theme, never the live one. Human publishes the
  // draft themselves in Shopify Admin; we never call Shopify's publish-theme API.
  const [themeStatus, setThemeStatus] = React.useState<any>(null);

  const loadThemeStatus = React.useCallback(async () => {
    if (!workspaceId) return;
    try {
      const r = await fetch(`/api/connectors/shopify/${workspaceId}/theme-status`, { headers: authHeaders() });
      setThemeStatus(await r.json());
    } catch { /* leave previous state */ }
  }, [workspaceId]);

  React.useEffect(() => { loadThemeStatus(); }, [loadThemeStatus, refreshKey]);

  // Poll while a duplication is in progress (copying every theme file can take a few minutes).
  React.useEffect(() => {
    if (themeStatus?.draft?.status !== 'duplicating') return;
    const t = setTimeout(loadThemeStatus, 4000);
    return () => clearTimeout(t);
  }, [themeStatus, loadThemeStatus]);

  const reconnectShopifyForTheme = async () => {
    if (!workspaceId || !st.sh?.shop_domain) return;
    const r = await fetch(`/api/connectors/shopify/${workspaceId}/authorize`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ shop: st.sh.shop_domain }),
    });
    const d = await r.json();
    if (d.url) window.location.href = d.url;
  };

  const createDraftTheme = async () => {
    if (!workspaceId) return;
    await fetch(`/api/connectors/shopify/${workspaceId}/create-draft-theme`, { method: 'POST', headers: authHeaders() });
    loadThemeStatus();
  };

  // WordPress: same preview-then-apply pattern as Shopify (no PR concept) — restricted to
  // page title/content (fields WP core genuinely supports), never a guessed SEO-plugin field.
  const [wpPreview, setWpPreview] = React.useState<any>(null);
  const [wpBusy, setWpBusy] = React.useState<'preview' | 'apply' | null>(null);
  const [wpResult, setWpResult] = React.useState<{ ok: boolean; msg: string; url?: string; needsApproval?: boolean; revisionId?: number } | null>(null);

  const previewWordPress = async () => {
    if (!workspaceId) return;
    setWpBusy('preview'); setWpResult(null); setWpPreview(null);
    try {
      const r = await fetch(`/api/connectors/wordpress/${workspaceId}/apply-seo-fixes`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ dry_run: true }),
      });
      const d = await r.json();
      if (r.ok && d.proposed) setWpPreview(d);
      else if (r.status === 409)
        setWpResult({ ok: false, needsApproval: true,
          msg: 'No recommendations approved yet. Go to "5. AI Suggested Improvements" below and approve at least one before applying.' });
      else setWpResult({ ok: false, msg: d.detail || 'Could not build a preview.' });
    } catch { setWpResult({ ok: false, msg: 'Could not reach the server.' }); }
    setWpBusy(null);
  };

  const applyWordPress = async () => {
    if (!workspaceId || !wpPreview) return;
    setWpBusy('apply');
    try {
      const r = await fetch(`/api/connectors/wordpress/${workspaceId}/apply-seo-fixes`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ page_id: wpPreview.page?.id }),
      });
      const d = await r.json();
      if (r.ok) {
        // Keep the revision id so Undo is available right here, at the moment the user is
        // looking at the result — not only buried in the connector panel's history list.
        setWpResult({ ok: true, msg: d.message || 'Updated in WordPress.', url: d.edit_url,
                      revisionId: d.revision_id });
        setWpPreview(null);
      } else setWpResult({ ok: false, msg: d.detail || 'Could not update WordPress.' });
    } catch { setWpResult({ ok: false, msg: 'Could not reach the server.' }); }
    setWpBusy(null);
  };

  const undoWordPress = async (revisionId?: number) => {
    if (!workspaceId) return;
    setWpBusy('apply');
    try {
      const r = await fetch(`/api/connectors/wordpress/${workspaceId}/undo`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ revision_id: revisionId ?? null }),
      });
      const d = await r.json();
      setWpResult(r.ok
        ? { ok: true, msg: d.message || 'Change successfully undone.', url: d.edit_url }
        : { ok: false, msg: d.detail || 'Could not undo that change.' });
    } catch { setWpResult({ ok: false, msg: 'Could not reach the server to undo.' }); }
    setWpBusy(null);
  };

  React.useEffect(() => {
    if (!workspaceId) return;
    fetch(`/api/workspaces/${workspaceId}/publishing-queue`, { headers: authHeaders() })
      .then(r => (r.ok ? r.json() : null)).then(d => setItems(d ? d.items : [])).catch(() => {});
  }, [workspaceId, refreshKey]);

  const loadStatus = React.useCallback(() => {
    if (!workspaceId) return;
    const get = (p: string) => fetch(`/api/connectors/${p}/${workspaceId}/status`, { headers: authHeaders() }).then(r => (r.ok ? r.json() : null)).catch(() => null);
    Promise.all([get('github'), get('wordpress'), get('shopify')]).then(([gh, wp, sh]) => {
      setSt({ gh, wp, sh });
      // If GitHub is connected to a repo, pull the saved scan so the status shows on the card.
      if (gh?.connected && gh?.repo_full_name) {
        fetch(`/api/connectors/github/${workspaceId}/repository-mapping`, { headers: authHeaders() })
          .then(r => (r.ok ? r.json() : null)).then(d => setGhMap(d && d.scanned ? d : null)).catch(() => setGhMap(null));
      } else setGhMap(null);
    });
  }, [workspaceId]);

  React.useEffect(() => { loadStatus(); }, [loadStatus, refreshKey, expanded]);

  const cards: { key: 'gh' | 'wp' | 'sh'; name: string; connected: boolean; url: string | null; openLabel: string; connectLabel: string; Panel: React.FC<{ workspaceId: number | null }> }[] = [
    { key: 'gh', name: 'GitHub', connected: !!st.gh?.connected,
      url: st.gh?.repo_full_name ? `https://github.com/${st.gh.repo_full_name}` : null,
      openLabel: 'Open Repository', connectLabel: 'Connect GitHub', Panel: GitHubPanel },
    { key: 'wp', name: 'WordPress', connected: !!st.wp?.connected,
      url: st.wp?.site_url ? `${String(st.wp.site_url).replace(/\/$/, '')}/wp-admin` : null,
      openLabel: 'Open Dashboard', connectLabel: 'Connect WordPress', Panel: WordPressPanel },
    { key: 'sh', name: 'Shopify', connected: !!st.sh?.connected,
      url: st.sh?.shop_domain ? `https://${st.sh.shop_domain}/admin` : null,
      openLabel: 'Open Store', connectLabel: 'Connect Shopify', Panel: ShopifyPanel },
  ];

  const connectedCount = cards.filter(c => c.connected).length;

  return (
    <div style={highlight ? {
      marginBottom: '22px', padding: '18px 20px', borderRadius: '14px',
      background: connectedCount > 0 ? 'rgba(0,255,157,0.05)' : 'rgba(255,174,0,0.06)',
      border: `1px solid ${connectedCount > 0 ? 'rgba(0,255,157,0.25)' : 'rgba(255,174,0,0.3)'}`,
    } : { marginTop: '10px', paddingTop: '18px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' }}>
        <h3 style={{ fontSize: highlight ? '15px' : '14px', margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {highlight && <Globe size={16} style={{ color: connectedCount > 0 ? '#00ff9d' : '#ffae00', flexShrink: 0 }} />}
          {highlight ? 'Connect &amp; Publish Your Site' : 'Implement Approved Changes'}
        </h3>
        {highlight && (
          <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
            color: connectedCount > 0 ? '#00ff9d' : '#ffae00',
            background: connectedCount > 0 ? 'rgba(0,255,157,0.1)' : 'rgba(255,174,0,0.12)',
            border: `1px solid ${connectedCount > 0 ? 'rgba(0,255,157,0.35)' : 'rgba(255,174,0,0.4)'}` }}>
            {connectedCount}/3 connected
          </span>
        )}
      </div>
      <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: '0 0 14px' }}>
        {highlight
          ? 'Connect GitHub, WordPress or Shopify here first — this is where you apply approved SEO fixes and publish content to your live site.'
          : 'Apply your approved SEO fixes using your connected website platform.'}
      </p>

      {items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          {items.map((it, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
              <span style={{ fontSize: '9.5px', fontWeight: 700, color: it.decision === 'edited' ? '#8B85FF' : '#00e676', background: it.decision === 'edited' ? 'rgba(90,82,255,0.1)' : 'rgba(0,230,118,0.1)', border: `1px solid ${it.decision === 'edited' ? 'rgba(90,82,255,0.35)' : 'rgba(0,230,118,0.35)'}`, borderRadius: '5px', padding: '2px 7px', textTransform: 'uppercase', flexShrink: 0 }}>{it.pipeline}</span>
              <span style={{ fontSize: '12px', flex: 1, minWidth: 0 }}>{it.issue}</span>
              <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{it.area}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginBottom: '14px' }}>
        {cards.map(c => (
          <div key={c.key} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{c.name}</span>
              <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
                color: c.connected ? '#00ff9d' : '#ffae00', background: c.connected ? 'rgba(0,255,157,0.1)' : 'rgba(255,174,0,0.1)',
                border: `1px solid ${c.connected ? 'rgba(0,255,157,0.35)' : 'rgba(255,174,0,0.35)'}` }}>
                {c.connected ? 'Connected' : 'Not Connected'}
              </span>
            </div>
            {c.connected ? (
              // Connected: keep the quick "open" link, but also let the panel (with its
              // scan-status box: framework, pages detected, ready-to-publish) be reopened.
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {c.url && (
                  <a href={c.url} target="_blank" rel="noreferrer" style={{ display: 'block', textAlign: 'center', fontSize: '12.5px', fontWeight: 600, color: '#03121a', background: '#00ff9d', borderRadius: '8px', padding: '8px', textDecoration: 'none' }}>{c.openLabel}</a>
                )}
                <button onClick={() => setExpanded(e => (e === c.key ? null : c.key))}
                  style={{ width: '100%', fontSize: '11.5px', fontWeight: 600, color: '#fff', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '7px', cursor: 'pointer' }}>
                  {expanded === c.key ? 'Hide details' : 'View status & details'}
                </button>
              </div>
            ) : (
              <button onClick={() => setExpanded(e => (e === c.key ? null : c.key))}
                style={{ width: '100%', fontSize: '12.5px', fontWeight: 600, color: '#fff', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px', cursor: 'pointer' }}>
                {expanded === c.key ? 'Close' : c.connectLabel}
              </button>
            )}

            {/* Always-visible scan summary for a connected GitHub repo (no click needed). */}
            {c.key === 'gh' && c.connected && ghMap && (
              <div style={{ marginTop: '9px', paddingTop: '9px', borderTop: '1px solid var(--border-color)', display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                <span><b style={{ color: '#fff' }}>Framework:</b> {ghMap.framework || 'Unknown'}</span>
                <span><b style={{ color: '#fff' }}>Pages:</b> {ghMap.pages_count ?? 0}</span>
                <span style={{ color: ghMap.status === 'ready' ? '#00ff9d' : '#ffae00' }}>
                  {ghMap.status === 'ready' ? 'Scanned — ready to apply changes' : `Scan ${ghMap.status || 'pending'}`}
                </span>
              </div>
            )}

            {/* Real auto-publish: apply the audit's on-page fixes as a GitHub pull request. */}
            {c.key === 'gh' && c.connected && ghMap && ghMap.status === 'ready' && (
              <div style={{ marginTop: '9px' }}>
                <button onClick={applySeoFixes} disabled={applying}
                  style={{ width: '100%', fontSize: '12px', fontWeight: 700, color: '#03121a', background: '#8B85FF', border: 'none', borderRadius: '8px', padding: '9px', cursor: applying ? 'wait' : 'pointer', opacity: applying ? 0.7 : 1 }}>
                  {applying ? 'Applying fixes & opening PR…' : 'Apply SEO fixes → open a PR'}
                </button>
                {prResult && <ApplyResultBox result={prResult} urlLabel="Review the pull request" />}
                {prResult?.ok && <UniversalFixPreview fix={prResult.universal_fix} />}
                <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '5px' }}>
                  Opens a pull request you review &amp; merge — nothing goes live automatically.
                </p>
              </div>
            )}

            {/* Shopify: preview the proposed SEO title/description, then apply via the Admin API. */}
            {c.key === 'sh' && c.connected && (
              <div style={{ marginTop: '9px' }}>
                {!shopPreview ? (
                  <button onClick={previewShopify} disabled={shopBusy === 'preview'}
                    style={{ width: '100%', fontSize: '12px', fontWeight: 700, color: '#03121a', background: '#8B85FF', border: 'none', borderRadius: '8px', padding: '9px', cursor: shopBusy ? 'wait' : 'pointer', opacity: shopBusy === 'preview' ? 0.7 : 1 }}>
                    {shopBusy === 'preview' ? 'Preparing preview…' : 'Apply SEO fixes → preview'}
                  </button>
                ) : (
                  <div style={{ fontSize: '11px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '9px 11px' }}>
                    <div style={{ color: 'var(--text-secondary)', marginBottom: '6px' }}>Proposed for <b style={{ color: '#fff' }}>{shopPreview.page?.title}</b>:</div>
                    <div style={{ marginBottom: '4px' }}><b style={{ color: '#fff' }}>Title:</b> {shopPreview.proposed?.seo_title}</div>
                    <div style={{ marginBottom: '8px' }}><b style={{ color: '#fff' }}>Description:</b> {shopPreview.proposed?.meta_description}</div>
                    <UniversalFixPreview fix={shopPreview.universal_fix} />
                    <div style={{ display: 'flex', gap: '7px', marginTop: '9px' }}>
                      <button onClick={applyShopify} disabled={shopBusy === 'apply'}
                        style={{ flex: 1, fontSize: '11px', fontWeight: 700, color: '#03121a', background: '#00ff9d', border: 'none', borderRadius: '7px', padding: '8px', cursor: 'pointer' }}>
                        {shopBusy === 'apply' ? 'Applying…' : 'Apply to Shopify'}
                      </button>
                      <button onClick={() => setShopPreview(null)} disabled={shopBusy === 'apply'}
                        style={{ fontSize: '11px', color: '#fff', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', borderRadius: '7px', padding: '8px 12px', cursor: 'pointer' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {shopResult && <ApplyResultBox result={shopResult} urlLabel="Open in Shopify" />}
                <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '5px' }}>
                  You review the proposed SEO here, then it writes to your store's page (reversible in Shopify).
                </p>
              </div>
            )}

            {/* Theme-level SEO: JSON-LD (and eventually canonical/OG) live in Liquid theme
                files, not Page metafields — always applied to a duplicated DRAFT theme, never
                the live one. We never publish it; the human does that in Shopify Admin. */}
            {c.key === 'sh' && c.connected && (
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed var(--border-color)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#fff', marginBottom: '7px' }}>
                  Theme-Level SEO (JSON-LD Organization schema)
                </div>
                {!themeStatus ? (
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Loading…</span>
                ) : !themeStatus.scope_ok ? (
                  <>
                    <p style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginBottom: '7px' }}>
                      Reconnect to grant theme access — needed to edit site-wide SEO tags safely in a draft theme.
                    </p>
                    <button onClick={reconnectShopifyForTheme}
                      style={{ width: '100%', fontSize: '11.5px', fontWeight: 700, color: '#03121a', background: '#ffae00', border: 'none', borderRadius: '8px', padding: '8px', cursor: 'pointer' }}>
                      Reconnect Shopify for Theme Access
                    </button>
                  </>
                ) : !themeStatus.draft || themeStatus.draft.status === 'failed' ? (
                  <>
                    {themeStatus.draft?.status === 'failed' && (
                      <div style={{ fontSize: '10.5px', color: '#ff5c5c', marginBottom: '7px' }}>
                        Last attempt failed: {themeStatus.draft.error}
                      </div>
                    )}
                    <button onClick={createDraftTheme}
                      style={{ width: '100%', fontSize: '11.5px', fontWeight: 700, color: '#03121a', background: '#8B85FF', border: 'none', borderRadius: '8px', padding: '8px', cursor: 'pointer' }}>
                      Create Draft Theme
                    </button>
                  </>
                ) : themeStatus.draft.status === 'duplicating' ? (
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Duplicating your live theme…{' '}
                    {themeStatus.draft.assets_total
                      ? `${themeStatus.draft.assets_copied}/${themeStatus.draft.assets_total} files`
                      : 'starting…'}
                  </div>
                ) : (
                  <div style={{ fontSize: '11px' }}>
                    <div style={{ color: 'var(--text-secondary)', marginBottom: '7px' }}>
                      Draft ready: <b style={{ color: '#fff' }}>{themeStatus.draft.draft_theme_name}</b>
                    </div>
                    <div style={{ display: 'flex', gap: '7px' }}>
                      <a href={`https://${st.sh?.shop_domain}/?preview_theme_id=${themeStatus.draft.draft_theme_id}`}
                        target="_blank" rel="noreferrer"
                        style={{ flex: 1, textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#03121a', background: '#00ff9d', borderRadius: '7px', padding: '8px', textDecoration: 'none' }}>
                        Review in Shopify →
                      </a>
                      <button onClick={createDraftTheme}
                        style={{ fontSize: '11px', color: '#fff', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', borderRadius: '7px', padding: '8px 12px', cursor: 'pointer' }}>
                        Re-create
                      </button>
                    </div>
                    <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                      Includes real Organization JSON-LD (name + url from your workspace) injected into &lt;head&gt;.
                      Publish this draft yourself in Shopify Admin → Online Store → Themes when you're happy with it.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* WordPress: same preview-then-apply pattern — restricted to page title/content
                (fields WP core genuinely supports), never a guessed SEO-plugin field. */}
            {c.key === 'wp' && c.connected && (
              <div style={{ marginTop: '9px' }}>
                {!wpPreview ? (
                  <button onClick={previewWordPress} disabled={wpBusy === 'preview'}
                    style={{ width: '100%', fontSize: '12px', fontWeight: 700, color: '#03121a', background: '#8B85FF', border: 'none', borderRadius: '8px', padding: '9px', cursor: wpBusy ? 'wait' : 'pointer', opacity: wpBusy === 'preview' ? 0.7 : 1 }}>
                    {wpBusy === 'preview' ? 'Preparing preview…' : 'Apply SEO fixes → preview'}
                  </button>
                ) : (
                  <div style={{ fontSize: '11px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '9px 11px' }}>
                    <div style={{ color: 'var(--text-secondary)', marginBottom: '6px' }}>Proposed for <b style={{ color: '#fff' }}>{wpPreview.page?.title}</b>:</div>
                    {wpPreview.proposed?.title !== wpPreview.current?.title && (
                      <div style={{ marginBottom: '6px' }}>
                        <b style={{ color: '#fff' }}>Page title:</b>{' '}
                        <span style={{ color: '#e6a4a4', textDecoration: 'line-through' }}>{wpPreview.current?.title}</span>{' → '}
                        <span style={{ color: '#9fe6c4' }}>{wpPreview.proposed?.title}</span>
                      </div>
                    )}
                    <ContentChangeDiff changes={wpPreview.content_changes || []}
                                       manualReview={wpPreview.manual_review || []} />
                    <UniversalFixPreview fix={wpPreview.universal_fix} />
                    <div style={{ display: 'flex', gap: '7px', marginTop: '9px' }}>
                      <button onClick={applyWordPress} disabled={wpBusy === 'apply'}
                        style={{ flex: 1, fontSize: '11px', fontWeight: 700, color: '#03121a', background: '#00ff9d', border: 'none', borderRadius: '7px', padding: '8px', cursor: 'pointer' }}>
                        {wpBusy === 'apply'
                          ? 'Applying…'
                          : `Apply ${(wpPreview.content_changes || []).length || ''} change${(wpPreview.content_changes || []).length === 1 ? '' : 's'} to WordPress`.replace('  ', ' ')}
                      </button>
                      <button onClick={() => setWpPreview(null)} disabled={wpBusy === 'apply'}
                        style={{ fontSize: '11px', color: '#fff', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', borderRadius: '7px', padding: '8px 12px', cursor: 'pointer' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {wpResult && <ApplyResultBox result={wpResult} urlLabel="Open in WordPress" />}
                {wpResult?.ok && wpResult.revisionId && (
                  // Undo restores the snapshot taken before the write — it does not ask the
                  // model to reverse its own edit, which would produce a third version.
                  <button onClick={() => undoWordPress(wpResult.revisionId)} disabled={wpBusy === 'apply'}
                    style={{ marginTop: '6px', width: '100%', fontSize: '11px', fontWeight: 600, color: '#ffae00', background: 'rgba(255,174,0,0.1)', border: '1px solid rgba(255,174,0,0.35)', borderRadius: '7px', padding: '7px', cursor: 'pointer' }}>
                    {wpBusy === 'apply' ? 'Undoing…' : 'Undo this change'}
                  </button>
                )}
                <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '5px' }}>
                  Page title/content are auto-edited, and real Organization JSON-LD is embedded in the page —
                  SEO meta title/description tags need a plugin, so those stay manual.
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {expanded && (() => {
        const c = cards.find(x => x.key === expanded);
        if (!c) return null;
        const Panel = c.Panel;
        return (
          <div ref={panelRef} style={{ marginBottom: '14px' }}>
            <Panel workspaceId={workspaceId} />
          </div>
        );
      })()}

      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.6, background: 'rgba(0,255,157,0.05)', border: '1px solid rgba(0,255,157,0.2)', borderRadius: '8px', padding: '10px 12px' }}>
        <b style={{ color: '#00ff9d' }}>GitHub:</b> use <b>Apply SEO fixes → open a PR</b> above — the on-page fixes are committed
        to a branch and opened as a pull request you review and merge (nothing goes live until you merge).
        <b style={{ color: '#00ff9d' }}> Shopify:</b> use <b>Apply SEO fixes → preview</b> above — you review the proposed SEO title/description, then it updates the page via Shopify's API (reversible in the admin).
        <b style={{ color: '#00ff9d' }}> WordPress:</b> use <b>Apply SEO fixes → preview</b> above — you review the proposed title/content, then it updates the page via the REST API (reversible in wp-admin). SEO meta tags need a plugin, so those stay manual.
      </div>
    </div>
  );
};
