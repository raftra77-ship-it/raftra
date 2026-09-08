import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Play,
  Plus,
  Sparkles,
  Trash2,
  X,
  Flame,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  CalendarDays
} from 'lucide-react';
import { GlowButton } from '../GlowButton';

/**
 * Marketing Calendar.
 *
 * Every schedule here used to live in React state: "Add Task" pushed an object into an
 * array, "Run Now" ran a 1.2s setTimeout and said "Task triggered and executed
 * successfully!", and a refresh wiped the lot. Nothing was ever scheduled and nothing ever
 * ran.
 *
 * It now drives the real scheduler: /api/workspaces/{id}/schedules for the recurring runs
 * (the backend computes next_run_at and records the outcome of each run) and
 * /api/workspaces/{id}/events for the dates a brand is planning around.
 *
 * Recurring execution is handled in-process by the API's scheduler; the banner below
 * reports its real state from /api/schedules/runner-status rather than asserting one.
 * That copy previously said unattended runs required SCHEDULER_TICK_SECRET and an
 * external cron, which stopped being true when the in-process runner landed - so the
 * screen was understating its own automation.
 */

/** Agents with a real runner behind them. Kept in step with RUNNABLE_AGENTS in
 *  backend/schedule_routes.py — offering anything else creates a schedule that fails on
 *  every run. */
const AGENTS = [
  { id: 'creative', label: 'Creative Studio', hint: 'Generates ad creative' },
  { id: 'campaign', label: 'Campaign Manager', hint: 'Plans campaign structure' },
  { id: 'seo', label: 'SEO pipeline', hint: 'Full SEO audit run' },
  { id: 'geo', label: 'GEO pipeline', hint: 'AI-search visibility run' },
] as const;

const CADENCES = [
  { id: 'hourly', label: 'Hourly' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
] as const;

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface Schedule {
  id: number;
  workspace_id: number;
  name: string;
  agent: string;
  cadence: string;
  hour: number;
  minute: number;
  weekday: number | null;
  day_of_month: number | null;
  prompt: string | null;
  enabled: boolean;
  last_run_at: string | null;
  last_status: string | null;
  last_message: string | null;
  next_run_at: string | null;
}

interface BrandEvent {
  id: number;
  name: string;
  event_date: string;      // YYYY-MM-DD
  category: string | null;
}

/** One festival or retail moment from GET /api/retail-calendar. `lead_days` is how far
 *  ahead campaigns should already be live - festive commerce is won in the run-up, so a
 *  date on its own is not enough to plan from. */
interface RetailDate {
  name: string;
  date: string;
  category: string;
  lead_days: number;
  days_away: number;
  /** The date creative should already be live by. */
  campaign_start: string;
  planning_urgency: 'overdue' | 'start_now' | 'upcoming';
}

const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const pad = (n: number) => String(n).padStart(2, '0');

/** Times are stored and computed in UTC by the backend, so they are labelled UTC rather
 *  than rendered in local time and quietly being an hour or five out. */
const describeCadence = (s: Schedule) => {
  const at = `${pad(s.hour)}:${pad(s.minute)} UTC`;
  if (s.cadence === 'hourly') return `Hourly at :${pad(s.minute)}`;
  if (s.cadence === 'weekly') return `Weekly on ${WEEKDAYS[s.weekday ?? 0]} at ${at}`;
  if (s.cadence === 'monthly') return `Monthly on day ${s.day_of_month ?? 1} at ${at}`;
  return `Daily at ${at}`;
};

const asDate = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const untilText = (iso: string | null) => {
  const d = asDate(iso);
  if (!d) return '';
  const mins = Math.round((d.getTime() - Date.now()) / 60000);
  if (mins <= 0) return 'due now';
  if (mins < 60) return `in ${mins}m`;
  if (mins < 1440) return `in ${Math.floor(mins / 60)}h`;
  return `in ${Math.floor(mins / 1440)}d`;
};

const daysUntil = (ymd: string) => {
  const d = new Date(`${ymd}T00:00:00`);
  const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
  if (days < 0) return `${Math.abs(days)} days ago`;
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
};

const prettyDate = (ymd: string) =>
  new Date(`${ymd}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export const WorkspaceScheduler: React.FC<{
  onNavigateTab?: (tab: string) => void;
  workspaceId?: number | null;
}> = ({ onNavigateTab, workspaceId = null }) => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [events, setEvents] = useState<BrandEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // New schedule
  const [name, setName] = useState('');
  const [agent, setAgent] = useState<string>('creative');
  const [cadence, setCadence] = useState<string>('daily');
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [weekday, setWeekday] = useState(0);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [prompt, setPrompt] = useState('');

  const [retailDates, setRetailDates] = useState<RetailDate[]>([]);
  const [coverage, setCoverage] = useState<{
    last_transcribed_date: string; days_of_full_coverage_left: number; needs_top_up: boolean;
  } | null>(null);
  const [runner, setRunner] = useState<{
    enabled: boolean; mode: string; interval_minutes: number | null;
    external_tick_available: boolean;
  } | null>(null);

  // New event
  const [evName, setEvName] = useState('');
  const [evDate, setEvDate] = useState('');
  const [evCategory, setEvCategory] = useState('');

  const load = useCallback(async () => {
    if (!workspaceId) { setLoading(false); return; }
    try {
      // The retail calendar is public reference data, so it loads alongside the tenant's
      // own schedules and events. The component used to carry three festivals inline;
      // this is the full year with the lead times the backend already computes.
      const [sr, er, cr, rr] = await Promise.all([
        fetch(`/api/workspaces/${workspaceId}/schedules`, { headers: authHeaders() }),
        fetch(`/api/workspaces/${workspaceId}/events`, { headers: authHeaders() }),
        fetch('/api/retail-calendar?within_days=365'),
        fetch('/api/schedules/runner-status'),
      ]);
      if (rr.ok) setRunner(await rr.json());
      if (sr.ok) setSchedules(await sr.json());
      if (er.ok) setEvents(await er.json());
      if (cr.ok) {
        const d = await cr.json();
        setRetailDates(Array.isArray(d?.upcoming) ? d.upcoming : []);
        setCoverage(d?.coverage ?? null);
      }
    } catch {
      setError('Could not reach the server.');
    }
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]);

  const createSchedule = async (body: Record<string, unknown>) => {
    if (!workspaceId) return null;
    setSaving(true);
    setError('');
    try {
      const r = await fetch(`/api/workspaces/${workspaceId}/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setSchedules((prev) => [d, ...prev]);
        setSaving(false);
        return d as Schedule;
      }
      setError(d.detail || `Could not save that schedule (${r.status}).`);
    } catch {
      setError('Could not reach the server.');
    }
    setSaving(false);
    return null;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const created = await createSchedule({
      name: name.trim(),
      agent,
      cadence,
      hour,
      minute,
      weekday: cadence === 'weekly' ? weekday : null,
      day_of_month: cadence === 'monthly' ? dayOfMonth : null,
      prompt: prompt.trim() || null,
      enabled: true,
    });
    if (created) {
      setShowTaskModal(false);
      setName('');
      setPrompt('');
    }
  };

  const patchSchedule = async (id: number, body: Record<string, unknown>) => {
    if (!workspaceId) return;
    const previous = schedules;
    setSchedules((prev) => prev.map((s) => (s.id === id ? { ...s, ...body } as Schedule : s)));
    try {
      const r = await fetch(`/api/workspaces/${workspaceId}/schedules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        const d = await r.json();
        setSchedules((prev) => prev.map((s) => (s.id === id ? d : s)));   // next_run_at moves
      } else {
        setSchedules(previous);
      }
    } catch {
      setSchedules(previous);
    }
  };

  const removeSchedule = async (id: number) => {
    if (!workspaceId) return;
    const previous = schedules;
    setSchedules((prev) => prev.filter((s) => s.id !== id));
    try {
      const r = await fetch(`/api/workspaces/${workspaceId}/schedules/${id}`, {
        method: 'DELETE', headers: authHeaders(),
      });
      if (!r.ok) setSchedules(previous);
    } catch {
      setSchedules(previous);
    }
  };

  const runNow = async (id: number) => {
    if (!workspaceId) return;
    setBusyId(id);
    setError('');
    try {
      const r = await fetch(`/api/workspaces/${workspaceId}/schedules/${id}/run`, {
        method: 'POST', headers: authHeaders(),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setError(d.detail || 'Could not start that run.');
    } catch {
      setError('Could not reach the server.');
    }
    // The agent runs in a background task, so the outcome lands on the row a little later.
    // Refetch rather than claim success: a failed run must show as failed.
    setTimeout(() => { load(); setBusyId(null); }, 6000);
  };

  const addEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !evName.trim() || !evDate) return;
    setSaving(true);
    setError('');
    try {
      const r = await fetch(`/api/workspaces/${workspaceId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ name: evName.trim(), event_date: evDate, category: evCategory.trim() || null }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setEvents((prev) => [...prev, d].sort((a, b) => a.event_date.localeCompare(b.event_date)));
        setShowEventModal(false);
        setEvName(''); setEvDate(''); setEvCategory('');
      } else {
        setError(d.detail || 'Could not save that event.');
      }
    } catch {
      setError('Could not reach the server.');
    }
    setSaving(false);
  };

  const removeEvent = async (id: number) => {
    if (!workspaceId) return;
    const previous = events;
    setEvents((prev) => prev.filter((e) => e.id !== id));
    try {
      const r = await fetch(`/api/workspaces/${workspaceId}/events/${id}`, {
        method: 'DELETE', headers: authHeaders(),
      });
      if (!r.ok) setEvents(previous);
    } catch {
      setEvents(previous);
    }
  };

  /** One click creates a real schedule, with the agent and cadence the card describes. */
  const templates = [
    { icon: '🎨', name: 'Weekly creative refresh', agent: 'creative', cadence: 'weekly',
      hour: 9, weekday: 2, desc: 'Fresh creative variants from your brand profile each week.',
      prompt: 'Generate a fresh batch of ad creative variants for this brand.' },
    { icon: '🧭', name: 'Weekly campaign plan', agent: 'campaign', cadence: 'weekly',
      hour: 8, weekday: 0, desc: 'A campaign structure and budget split, ready every Monday.',
      prompt: 'Plan next week\'s campaign structure, audiences and budget split.' },
    { icon: '🔍', name: 'Monthly SEO audit', agent: 'seo', cadence: 'monthly',
      hour: 7, dayOfMonth: 1, desc: 'Runs the full SEO pipeline against your site each month.', prompt: null },
    { icon: '🤖', name: 'Monthly AI-search check', agent: 'geo', cadence: 'monthly',
      hour: 7, dayOfMonth: 2, desc: 'Checks how AI assistants describe your brand.', prompt: null },
  ];

  const scheduleFromTemplate = async (t: typeof templates[number]) => {
    if (schedules.some((s) => s.name.toLowerCase() === t.name.toLowerCase())) {
      setError(`"${t.name}" is already in your schedule.`);
      return;
    }
    await createSchedule({
      name: t.name, agent: t.agent, cadence: t.cadence, hour: t.hour, minute: 0,
      weekday: t.cadence === 'weekly' ? t.weekday ?? 0 : null,
      day_of_month: t.cadence === 'monthly' ? t.dayOfMonth ?? 1 : null,
      prompt: t.prompt, enabled: true,
    });
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px',
    color: '#fff', fontSize: '13.5px', outline: 'none',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)',
    textTransform: 'uppercase', marginBottom: '6px', display: 'block',
  };

  const allDates = [
    // Reference dates carry no id: they are facts about the calendar, not stored records,
    // so they cannot be deleted. Their lead time rides along for the planning hint.
    ...retailDates.map((r) => ({
      id: null as number | null, name: r.name, event_date: r.date, category: r.category,
      campaignStart: r.campaign_start, daysAway: r.days_away, urgency: r.planning_urgency,
    })),
    ...events.map((e) => ({
      id: e.id, name: e.name, event_date: e.event_date, category: e.category,
      campaignStart: undefined as string | undefined, daysAway: undefined as number | undefined,
      urgency: undefined as RetailDate['planning_urgency'] | undefined,
    })),
  ].sort((a, b) => a.event_date.localeCompare(b.event_date));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '32px', color: '#fff', margin: '0 0 6px 0', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
            Marketing Calendar
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: 0, lineHeight: 1.5 }}>
            Recurring agent runs and the dates you are planning around. Schedules are saved
            server-side and each run records whether it worked.
          </p>
        </div>

        <GlowButton
          variant="glow"
          onClick={() => setShowTaskModal(true)}
          disabled={!workspaceId}
          style={{ fontSize: '13px', padding: '9px 22px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Plus size={15} /> Schedule a task
        </GlowButton>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: '9px', padding: '13px 16px', borderRadius: '12px',
              background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.3)',
              color: '#ff6b7a', fontSize: '13px', lineHeight: 1.5,
            }}
          >
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 1. YOUR SCHEDULE ───────────────────────────────────────── */}
      <div
        className="glow-card"
        style={{
          background: 'linear-gradient(180deg, rgba(20, 20, 32, 0.7) 0%, rgba(10, 10, 16, 0.95) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '20px',
          padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '18px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={18} color="#00E676" />
          <h2 style={{ fontSize: '20px', color: '#fff', margin: 0, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
            Your schedule
          </h2>
        </div>

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[0, 1].map((i) => (
              <div key={i} style={{ height: '68px', borderRadius: '14px', background: 'rgba(255,255,255,0.03)' }} />
            ))}
          </div>
        )}

        {!loading && !schedules.length && (
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
            Nothing scheduled yet. Add a task above, or start from one of the templates below —
            each one creates a real recurring run you can pause, edit or trigger by hand.
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {schedules.map((s) => {
            const running = busyId === s.id;
            const agentLabel = AGENTS.find((a) => a.id === s.agent)?.label || s.agent;
            return (
              <div
                key={s.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: s.enabled ? '1px solid rgba(255,255,255,0.08)' : '1px dashed rgba(255,255,255,0.06)',
                  borderRadius: '14px', padding: '16px 20px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  flexWrap: 'wrap', gap: '14px', opacity: s.enabled ? 1 : 0.65,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                    background: s.enabled ? 'rgba(0,230,118,0.12)' : 'rgba(255,255,255,0.04)',
                    border: s.enabled ? '1px solid rgba(0,230,118,0.3)' : '1px solid rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Clock size={17} color={s.enabled ? '#00E676' : 'var(--text-muted)'} />
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <h4 style={{ fontSize: '15px', color: '#fff', margin: '0 0 3px 0', fontWeight: 700 }}>
                      {s.name}
                    </h4>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span>{agentLabel}</span>
                      <span>•</span>
                      <span>{describeCadence(s)}</span>
                      <span>•</span>
                      <span style={{ color: s.enabled ? '#FFB300' : 'var(--text-muted)', fontWeight: 600 }}>
                        {s.enabled ? `Next ${untilText(s.next_run_at)}` : 'Paused'}
                      </span>
                    </div>

                    {/* Real outcome of the last run, success or failure. */}
                    {s.last_status && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '5px', marginTop: '5px',
                        fontSize: '11.5px',
                        color: s.last_status === 'success' ? '#00E676' : '#ff6b7a',
                      }}>
                        {s.last_status === 'success' ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '460px' }}>
                          Last run {s.last_status}
                          {s.last_message ? ` — ${s.last_message}` : ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => runNow(s.id)}
                    disabled={running}
                    style={{
                      background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.3)',
                      color: '#00E676', padding: '6px 14px', borderRadius: '100px',
                      fontSize: '11.5px', fontWeight: 700, cursor: running ? 'wait' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: '4px',
                    }}
                  >
                    {running ? <RefreshCw size={11} className="animate-spin" /> : <Play size={11} />}
                    {running ? 'Running…' : 'Run now'}
                  </button>

                  <button
                    onClick={() => patchSchedule(s.id, { enabled: !s.enabled })}
                    style={{
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                      color: 'var(--text-secondary)', padding: '6px 12px', borderRadius: '100px',
                      fontSize: '11.5px', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    {s.enabled ? 'Pause' : 'Resume'}
                  </button>

                  <button
                    onClick={() => removeSchedule(s.id)}
                    title="Delete schedule"
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', padding: '6px', cursor: 'pointer' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* The runner's actual state. A calendar that looks armed and is not is the worse
            failure, but so is one that is armed and says it is not - which is what this
            said before. */}
        {!!schedules.length && runner && (
          <p style={{ fontSize: '11.5px', margin: 0, lineHeight: 1.55,
                      color: runner.enabled ? 'var(--text-muted)' : 'var(--warning)' }}>
            {runner.enabled ? (
              <>
                <span style={{ color: 'var(--success)', fontWeight: 700 }}>Automatic runs are on.</span>
                {' '}Due schedules are checked every {runner.interval_minutes} minutes by the API,
                so the times above fire on their own. Run now triggers one immediately.
              </>
            ) : (
              <>
                Automatic runs are off (DISABLE_SCHEDULED_TASKS is set), so the times above will
                not fire on their own. Run now still works.
                {runner.external_tick_available && ' An external cron can call /api/schedules/tick.'}
              </>
            )}
          </p>
        )}
      </div>

      {/* ── 2. DATES YOU ARE PLANNING AROUND ───────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Flame size={18} color="#FF6B00" />
            <h2 style={{ fontSize: '20px', color: '#fff', margin: 0, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
              Key dates
            </h2>
          </div>

          <button
            onClick={() => setShowEventModal(true)}
            disabled={!workspaceId}
            style={{
              background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: '#fff',
              borderRadius: '100px', padding: '6px 16px', fontSize: '12.5px', fontWeight: 700,
              cursor: workspaceId ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            <Plus size={13} /> Add a date
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px,100%), 1fr))', gap: '18px' }}>
          {allDates.map((ev) => (
            <div
              key={ev.id ?? `ref-${ev.name}`}
              className="glow-card"
              style={{
                background: 'linear-gradient(135deg, rgba(24,24,36,0.75) 0%, rgba(12,12,18,0.95) 100%)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '18px', padding: '22px',
                display: 'flex', flexDirection: 'column', gap: '14px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                <div>
                  <h3 style={{ fontSize: '17px', color: '#fff', margin: '0 0 4px 0', fontWeight: 800 }}>
                    {ev.name}
                  </h3>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                    {prettyDate(ev.event_date)} · <span style={{ color: '#FFB300', fontWeight: 600 }}>{daysUntil(ev.event_date)}</span>
                  </div>
                  {/* The date alone is not a plan: festive demand is won in the run-up, so
                      the row says when creative has to be live and whether that has passed. */}
                  {ev.campaignStart && (
                    <div style={{
                      fontSize: '11.5px', marginTop: '6px', fontWeight: 600,
                      color: ev.urgency === 'overdue' ? '#FF4B4B'
                           : ev.urgency === 'start_now' ? '#FFB300' : 'var(--text-muted)',
                    }}>
                      {ev.urgency === 'overdue'
                        ? `Run-up started ${prettyDate(ev.campaignStart)} — campaigns should already be live`
                        : ev.urgency === 'start_now'
                          ? `Go live by ${prettyDate(ev.campaignStart)} — start now`
                          : `Go live by ${prettyDate(ev.campaignStart)}`}
                    </div>
                  )}
                </div>
                {ev.id !== null && (
                  <button
                    onClick={() => removeEvent(ev.id as number)}
                    title="Remove this date"
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>

              {ev.category && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{ev.category}</span>
              )}

              <button
                onClick={() => onNavigateTab?.('studio')}
                style={{
                  alignSelf: 'flex-start', background: 'rgba(124,117,255,0.14)',
                  border: '1px solid rgba(124,117,255,0.35)', color: '#7C75FF',
                  borderRadius: '100px', padding: '6px 14px', fontSize: '11.5px',
                  fontWeight: 700, cursor: 'pointer',
                }}
              >
                Build creative for this
              </button>
            </div>
          ))}
        </div>

        <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: 0 }}>
          {retailDates.length} festival and retail dates for the year ahead are reference data,
          each showing when campaigns need to be live. The campaign agents plan around the same
          calendar. Anything you add is saved to this workspace.
          {coverage?.needs_top_up && (
            <>
              {' '}
              <span style={{ color: 'var(--warning)', fontWeight: 600 }}>
                Festival dates are transcribed per year and currently run to{' '}
                {coverage.last_transcribed_date}. Beyond that only fixed dates (Christmas,
                Black Friday and similar) appear until next year's are added.
              </span>
            </>
          )}
        </p>
      </div>

      {/* ── 3. TEMPLATES ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={18} color="#7C75FF" />
          <h2 style={{ fontSize: '20px', color: '#fff', margin: 0, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
            Quick-schedule templates
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px,100%), 1fr))', gap: '18px' }}>
          {templates.map((t) => (
            <div
              key={t.name}
              className="glow-card"
              style={{
                background: 'linear-gradient(135deg, rgba(20,20,32,0.6) 0%, rgba(10,10,16,0.9) 100%)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', padding: '22px',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px',
              }}
            >
              <div>
                <div style={{ fontSize: '24px', marginBottom: '12px' }}>{t.icon}</div>
                <h3 style={{ fontSize: '16px', color: '#fff', margin: '0 0 6px 0', fontWeight: 800 }}>{t.name}</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>{t.desc}</p>
              </div>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                  {t.cadence === 'weekly'
                    ? `Weekly on ${WEEKDAYS[t.weekday ?? 0]} at ${pad(t.hour)}:00 UTC`
                    : `Monthly on day ${t.dayOfMonth ?? 1} at ${pad(t.hour)}:00 UTC`}
                </span>
                <button
                  onClick={() => scheduleFromTemplate(t)}
                  disabled={saving || !workspaceId}
                  style={{
                    background: 'linear-gradient(135deg, #00E676 0%, #00C853 100%)', color: '#000',
                    border: 'none', borderRadius: '100px', padding: '7px 18px', fontSize: '12px',
                    fontWeight: 800, cursor: saving || !workspaceId ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(0,230,118,0.25)',
                    display: 'flex', alignItems: 'center', gap: '4px', opacity: saving ? 0.6 : 1,
                  }}
                >
                  <Plus size={13} /> Schedule
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── SCHEDULE A TASK MODAL ──────────────────────────────────── */}
      <AnimatePresence>
        {showTaskModal && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(10px)', padding: '20px',
          }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              style={{
                width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto',
                background: '#0a0a12', border: '1px solid rgba(0,230,118,0.35)', borderRadius: '24px',
                padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Clock size={20} color="#00E676" />
                  <h3 style={{ fontSize: '19px', color: '#fff', margin: 0, fontWeight: 800 }}>Schedule a task</h3>
                </div>
                <button
                  onClick={() => setShowTaskModal(false)}
                  style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>Name</label>
                  <input required placeholder="e.g. Weekly creative batch" value={name}
                    onChange={(e) => setName(e.target.value)} style={inputStyle} />
                </div>

                <div>
                  <label style={labelStyle}>What should run</label>
                  <select value={agent} onChange={(e) => setAgent(e.target.value)} style={inputStyle}>
                    {AGENTS.map((a) => <option key={a.id} value={a.id}>{a.label} — {a.hint}</option>)}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>How often</label>
                    <select value={cadence} onChange={(e) => setCadence(e.target.value)} style={inputStyle}>
                      {CADENCES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Time (UTC)</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input type="number" min={0} max={23} value={hour} disabled={cadence === 'hourly'}
                        onChange={(e) => setHour(Math.min(23, Math.max(0, Number(e.target.value) || 0)))}
                        style={{ ...inputStyle, opacity: cadence === 'hourly' ? 0.5 : 1 }} aria-label="Hour" />
                      <input type="number" min={0} max={59} value={minute}
                        onChange={(e) => setMinute(Math.min(59, Math.max(0, Number(e.target.value) || 0)))}
                        style={inputStyle} aria-label="Minute" />
                    </div>
                  </div>
                </div>

                {cadence === 'weekly' && (
                  <div>
                    <label style={labelStyle}>Day of week</label>
                    <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} style={inputStyle}>
                      {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                    </select>
                  </div>
                )}

                {cadence === 'monthly' && (
                  <div>
                    <label style={labelStyle}>Day of month (1–28)</label>
                    <input type="number" min={1} max={28} value={dayOfMonth}
                      onChange={(e) => setDayOfMonth(Math.min(28, Math.max(1, Number(e.target.value) || 1)))}
                      style={inputStyle} />
                  </div>
                )}

                <div>
                  <label style={labelStyle}>Instruction (optional)</label>
                  <textarea rows={3} placeholder="What the agent should do on each run"
                    value={prompt} onChange={(e) => setPrompt(e.target.value)}
                    style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                  <button type="button" onClick={() => setShowTaskModal(false)}
                    style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '9px 18px', borderRadius: '100px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>
                    Cancel
                  </button>
                  <GlowButton variant="glow" type="submit" disabled={saving} style={{ padding: '9px 24px', fontSize: '13px', opacity: saving ? 0.6 : 1 }}>
                    {saving ? 'Saving…' : 'Add to schedule'}
                  </GlowButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── ADD A DATE MODAL ───────────────────────────────────────── */}
      <AnimatePresence>
        {showEventModal && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(10px)', padding: '20px',
          }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              style={{
                width: '100%', maxWidth: '480px', background: '#0a0a12',
                border: '1px solid rgba(255,179,0,0.35)', borderRadius: '24px', padding: '28px',
                display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CalendarDays size={20} color="#FFB300" />
                  <h3 style={{ fontSize: '19px', color: '#fff', margin: 0, fontWeight: 800 }}>Add a date</h3>
                </div>
                <button
                  onClick={() => setShowEventModal(false)}
                  style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={addEvent} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>Name</label>
                  <input required placeholder="e.g. Independence Day sale" value={evName}
                    onChange={(e) => setEvName(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  {/* A date input rather than free text: the old form asked for "in 21 days"
                      as a string, which could never be counted down from. */}
                  <label style={labelStyle}>Date</label>
                  <input required type="date" value={evDate} onChange={(e) => setEvDate(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Category (optional)</label>
                  <input placeholder="e.g. Seasonal sale" value={evCategory}
                    onChange={(e) => setEvCategory(e.target.value)} style={inputStyle} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                  <button type="button" onClick={() => setShowEventModal(false)}
                    style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '9px 18px', borderRadius: '100px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>
                    Cancel
                  </button>
                  <GlowButton variant="glow" type="submit" disabled={saving} style={{ padding: '9px 24px', fontSize: '13px', opacity: saving ? 0.6 : 1 }}>
                    {saving ? 'Saving…' : 'Save date'}
                  </GlowButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
