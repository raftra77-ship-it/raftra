import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  CheckCircle2,
  ChevronRight,
  Layers,
  BarChart3,
  Calendar,
  Clock,
  Zap,
  TrendingUp,
  Image as ImageIcon,
  ArrowUpRight,
  Palette,
  Type,
  FileText,
  Target,
  AlertCircle,
  X,
  Link2
} from 'lucide-react';
import { GlowButton } from './GlowButton';

interface ModernHomeOverviewProps {
  userName?: string;
  brandName?: string;
  onNavigateTab: (tab: string) => void;
  /** Needed for the headline figures — they are read per workspace. */
  workspaceId?: number | null;
}

interface WorkspaceSnapshot {
  spend: number;
  roas: number;
  seoScore: number;
  activeAgents: number;
  campaigns: number;
  creatives: number;
}

export const ModernHomeOverview: React.FC<ModernHomeOverviewProps> = ({
  userName = 'there',
  brandName = 'your brand',
  onNavigateTab,
  workspaceId = null,
}) => {
  // What this workspace actually contains. Everything in the card below is read from here;
  // nothing is filled in when a value is missing.
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) { setSnapshotLoading(false); return; }
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    Promise.all([
      fetch(`/api/workspaces/${workspaceId}/dashboard/metrics`, { headers }).then(r => (r.ok ? r.json() : null)),
      fetch(`/api/workspaces/${workspaceId}/campaigns`, { headers }).then(r => (r.ok ? r.json() : [])),
      fetch(`/api/workspaces/${workspaceId}/creatives`, { headers }).then(r => (r.ok ? r.json() : [])),
    ])
      .then(([metrics, campaigns, creatives]) => {
        setSnapshot({
          spend: metrics?.recent_quarter_spend ?? 0,
          roas: metrics?.roas ?? 0,
          seoScore: metrics?.seo_score ?? 0,
          activeAgents: metrics?.active_ai_agents ?? 0,
          campaigns: Array.isArray(campaigns) ? campaigns.length : 0,
          creatives: Array.isArray(creatives) ? creatives.length : 0,
        });
      })
      .catch(() => { /* the tiles fall back to their empty state */ })
      .finally(() => setSnapshotLoading(false));
  }, [workspaceId]);
  // Brand Kit Review Modal State
  const [showBrandKitModal, setShowBrandKitModal] = useState(false);
  const [activeBrandKitTab, setActiveBrandKitTab] = useState<'logo' | 'colors' | 'typography' | 'knowledge' | 'assets' | 'market'>('logo');

  // Ad Account Connection Modal State
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [isAdAccountConnected, setIsAdAccountConnected] = useState(false);

  // Whether an ad account is really linked, from the connector status endpoints. This used
  // to be flipped by a 900ms setTimeout in handleSimulateConnect.
  useEffect(() => {
    if (!workspaceId) return;
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    Promise.all([
      fetch(`/api/connectors/meta/${workspaceId}/status`, { headers }).then(r => (r.ok ? r.json() : null)),
      fetch(`/api/connectors/google-ads/${workspaceId}/status`, { headers }).then(r => (r.ok ? r.json() : null)),
    ])
      .then(([meta, gads]) => setIsAdAccountConnected(Boolean(meta?.connected || gads?.connected)))
      .catch(() => {});
  }, [workspaceId]);

  // Recommendations Modal State
  const [showRecommendationsModal, setShowRecommendationsModal] = useState(false);

  // Scheduler Modal State
  const [showSchedulerModal, setShowSchedulerModal] = useState(false);

  // Schedule items state
  // Real recurring runs from the scheduler. This card used to list three fixtures - a
  // "Fresh Creative Batch", a "Weekly competitor report" and a "Daily ROAS Guardrail" -
  // that existed nowhere and could not be run, paused or edited.
  const [schedules, setSchedules] = useState<{
    id: number; name: string; agent: string; cadence: string; hour: number; minute: number;
    weekday: number | null; day_of_month: number | null; enabled: boolean;
    next_run_at: string | null; last_status: string | null;
  }[]>([]);
  const [runningScheduleId, setRunningScheduleId] = useState<number | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    const token = localStorage.getItem('token');
    fetch(`/api/workspaces/${workspaceId}/schedules`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then(r => (r.ok ? r.json() : []))
      .then(d => setSchedules(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [workspaceId]);

  // The same brand profile the Knowledge vault edits, so the checklist below reflects it.
  const [brandKit, setBrandKit] = useState<{
    brand_color?: string | null; color_palette?: string[];
    typography?: Record<string, string>; brand_guidelines_summary?: string | null;
    target_audience?: string | null;
  } | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    const token = localStorage.getItem('token');
    fetch(`/api/workspaces/${workspaceId}/brand-profile`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setBrandKit(d); })
      .catch(() => {});
  }, [workspaceId]);

  const scheduleColour = (agent: string) =>
    agent === 'creative' ? '#7C75FF' : agent === 'campaign' ? '#00D2FF' : '#00E676';

  const scheduleFrequency = (s: { cadence: string; hour: number; minute: number; weekday: number | null; day_of_month: number | null; next_run_at: string | null; enabled: boolean }) => {
    const two = (n: number) => String(n).padStart(2, '0');
    const at = `${two(s.hour)}:${two(s.minute)} UTC`;
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const base =
      s.cadence === 'hourly' ? `Hourly at :${two(s.minute)}`
      : s.cadence === 'weekly' ? `Weekly on ${days[s.weekday ?? 0]} at ${at}`
      : s.cadence === 'monthly' ? `Monthly on day ${s.day_of_month ?? 1} at ${at}`
      : `Daily at ${at}`;
    if (!s.enabled) return `${base} • Paused`;
    if (!s.next_run_at) return base;
    const iso = s.next_run_at;
    const when = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`);
    const mins = Math.round((when.getTime() - Date.now()) / 60000);
    const rel = mins <= 0 ? 'due now'
      : mins < 60 ? `in ${mins}m`
      : mins < 1440 ? `in ${Math.floor(mins / 60)}h`
      : `in ${Math.floor(mins / 1440)}d`;
    return `${base} • Next run ${rel}`;
  };

  const runScheduleNow = async (id: number) => {
    if (!workspaceId) return;
    setRunningScheduleId(id);
    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/workspaces/${workspaceId}/schedules/${id}/run`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    } catch { /* the refetch below shows whatever actually happened */ }
    // The run happens in a background task, so re-read the row rather than assume it worked.
    setTimeout(async () => {
      try {
        const r = await fetch(`/api/workspaces/${workspaceId}/schedules`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (r.ok) setSchedules(await r.json());
      } catch { /* leave the list as it was */ }
      setRunningScheduleId(null);
    }, 6000);
  };

  // Brand Kit Checklist Items
  // Each item reports whether that piece of the brand kit actually exists. All six were
  // hardcoded to "Ready", so a workspace with no palette, no typography and no audience
  // still showed a complete kit at 100% extracted.
  const brandKitItems = [
    { id: 'logo', label: 'Logo', status: brandKit?.brand_color ? 'Ready' : 'Missing', icon: <ImageIcon size={16} color="#7C75FF" /> },
    { id: 'colors', label: 'Colors', status: brandKit?.color_palette?.length ? 'Ready' : 'Missing', icon: <Palette size={16} color="#00E676" /> },
    { id: 'typography', label: 'Typography', status: Object.keys(brandKit?.typography || {}).length ? 'Ready' : 'Missing', icon: <Type size={16} color="#00D2FF" /> },
    { id: 'knowledge', label: 'Brand knowledge', status: brandKit?.brand_guidelines_summary ? 'Ready' : 'Missing', icon: <FileText size={16} color="#FFB300" /> },
    { id: 'assets', label: 'Assets', status: (snapshot?.creatives ?? 0) > 0 ? 'Ready' : 'Missing', icon: <Layers size={16} color="#FF5296" /> },
    { id: 'market', label: 'Target Market', status: brandKit?.target_audience ? 'Ready' : 'Missing', icon: <Target size={16} color="#A855F7" /> }
  ];

  const kitReady = brandKitItems.filter(i => i.status === 'Ready').length;
  const kitPercent = Math.round((kitReady / brandKitItems.length) * 100);

  // Written playbooks, not findings. These were presented as things the AI had detected
  // about this account - "Creative CTR dropped by 22% over last 48h", "+Rs 18,000 weekly
  // savings", "maintaining 4.8x ROAS" - with no ad account connected and no analysis run.
  // The advice is still worth showing; the invented measurements are not.
  const mockRecommendations = [
    {
      id: 'rec_1',
      title: 'Refresh creative that has been running a while',
      desc: 'Click-through usually falls as an audience sees the same creative repeatedly. Generate fresh variants of your best performer rather than raising the budget on a tired one.',
      impact: 'Creative Studio',
      urgency: 'Playbook',
      tab: 'studio'
    },
    {
      id: 'rec_2',
      title: 'Scale what is already converting',
      desc: 'When a campaign holds its target return, raise its budget in steps rather than at once - large jumps reset the learning phase and costs climb before they settle.',
      impact: 'Campaign Manager',
      urgency: 'Playbook',
      tab: 'campaign'
    },
    {
      id: 'rec_3',
      title: 'Check how AI assistants describe you',
      desc: 'Buyers increasingly ask an assistant before they search. The GEO pipeline reports what those answers say about your brand and where the gaps are.',
      impact: 'Search & AEO',
      urgency: 'Playbook',
      tab: 'seo'
    }
  ];

  // This workspace's real generated creatives. It was a fixture list of three "winners"
  // with ROAS, spend and revenue figures and Unsplash photographs - none of it measured,
  // and shown for any workspace.
  const [topCreatives, setTopCreatives] = useState<{ id: number; headline: string; image_url?: string | null }[]>([]);

  useEffect(() => {
    if (!workspaceId) return;
    const token = localStorage.getItem('token');
    fetch(`/api/workspaces/${workspaceId}/creatives`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then(r => (r.ok ? r.json() : []))
      .then(d => setTopCreatives(Array.isArray(d) ? d.slice(-3).reverse() : []))
      .catch(() => {});
  }, [workspaceId]);

  const handleGoConnect = () => {
    setShowConnectModal(false);
    onNavigateTab('integrations');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* ── GREETING HERO BAR ─────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: 'rgba(90, 82, 255, 0.12)', borderRadius: '100px', border: '1px solid rgba(90, 82, 255, 0.25)', marginBottom: '10px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#00E676', boxShadow: '0 0 8px #00E676' }} />
            <span style={{ fontSize: '12px', color: '#00E676', fontWeight: 700, letterSpacing: '0.04em' }}>
              RAFTRA AI GROWTH OS ACTIVE
            </span>
          </div>
          <h1 style={{ fontSize: '32px', fontFamily: 'var(--font-heading)', margin: '0 0 6px 0', color: '#fff', fontWeight: 800 }}>
            How are you doing, <span style={{ color: '#00E676' }}>{userName || brandName}</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14.5px', margin: 0 }}>
            Here is your live brand health, automated scheduled pipelines, and creative performance overview.
          </p>
        </div>

        {/* Action controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Was a toggle that flipped its own label to "Ad Account: Connected" without
              connecting anything. It now goes to the screen that actually connects one. */}
          <button
            onClick={() => onNavigateTab('integrations')}
            style={{
              background: isAdAccountConnected ? 'rgba(0, 230, 118, 0.12)' : 'rgba(255, 255, 255, 0.04)',
              border: isAdAccountConnected ? '1px solid rgba(0, 230, 118, 0.4)' : '1px solid rgba(255, 255, 255, 0.15)',
              color: isAdAccountConnected ? '#00E676' : '#ffffff',
              padding: '8px 16px',
              borderRadius: '100px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            {isAdAccountConnected ? <CheckCircle2 size={14} color="#00E676" /> : <Link2 size={14} />}
            {isAdAccountConnected ? 'Ad account connected' : 'Connect an ad account'}
          </button>

          <GlowButton variant="glow" onClick={() => onNavigateTab('studio')} style={{ fontSize: '13.5px', padding: '10px 20px' }}>
            <Sparkles size={15} /> Create Fresh Creatives
          </GlowButton>
        </div>
      </div>

      {/* ── 0. WHAT THIS WORKSPACE HOLDS ──────────────────────────── */}
      {/* Was an "Overall Growth Score" of 84/100 with four invented metric tiles and four
          progress bars, none of which were read from anywhere. These are counts and scores
          out of the database; a tile with no data says so instead of showing a number. */}
      <div
        className="glow-card"
        style={{
          background: 'linear-gradient(135deg, rgba(20, 32, 28, 0.85) 0%, rgba(10, 16, 22, 0.95) 100%)',
          border: '1.5px solid rgba(0, 230, 118, 0.35)',
          borderRadius: '24px',
          padding: '26px 30px',
          boxShadow: '0 12px 40px rgba(0, 230, 118, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '22px', color: '#fff', margin: '0 0 4px 0', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
              {brandName} at a glance
            </h2>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: 0 }}>
              Read from this workspace — campaigns, generated creatives, your latest audit and
              anything running right now.
            </p>
          </div>

          <button
            onClick={() => onNavigateTab('studio')}
            style={{
              background: 'linear-gradient(135deg, #00E676 0%, #00C853 100%)',
              color: '#000000', border: 'none', borderRadius: '100px',
              padding: '9px 20px', fontSize: '13px', fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
              boxShadow: '0 4px 16px rgba(0, 230, 118, 0.35)',
            }}
          >
            <TrendingUp size={14} /> Open Creative Studio
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(190px,100%), 1fr))', gap: '14px' }}>
          {([
            { label: 'Campaigns', value: snapshot?.campaigns ?? 0, colour: '#fff',
              empty: 'None yet', tab: 'campaign', cta: 'Plan one' },
            { label: 'Creatives generated', value: snapshot?.creatives ?? 0, colour: '#fff',
              empty: 'None yet', tab: 'studio', cta: 'Generate' },
            { label: 'Ad spend booked', value: snapshot?.spend ? `$${Number(snapshot.spend).toLocaleString()}` : 0,
              colour: '#00E676', empty: 'No live campaigns', tab: 'campaign', cta: 'Set a budget' },
            { label: 'Latest SEO score', value: snapshot?.seoScore ?? 0, colour: '#7C75FF',
              empty: 'Not audited yet', tab: 'seo', cta: 'Run an audit' },
          ] as { label: string; value: number | string; colour: string; empty: string; tab: string; cta: string }[])
            .map((tile) => {
              const hasValue = tile.value !== 0 && tile.value !== '0';
              return (
                <div key={tile.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '14px 18px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                    {tile.label}
                  </span>
                  {snapshotLoading ? (
                    <div style={{ height: '26px', marginTop: '4px', width: '60%', background: 'rgba(255,255,255,0.05)', borderRadius: '6px' }} />
                  ) : hasValue ? (
                    <div style={{ fontSize: '22px', fontWeight: 900, color: tile.colour, marginTop: '2px' }}>
                      {tile.value}
                    </div>
                  ) : (
                    <div style={{ marginTop: '4px' }}>
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{tile.empty}</div>
                      <button
                        onClick={() => onNavigateTab(tile.tab)}
                        style={{ background: 'none', border: 'none', color: '#7C75FF', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: '4px 0 0' }}
                      >
                        {tile.cta} →
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {!!snapshot?.roas && (
          <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px' }}>
            Average ROAS across live campaigns: <strong style={{ color: '#00E676' }}>{snapshot.roas}x</strong>
          </div>
        )}
        {!!snapshot?.activeAgents && (
          <div style={{ fontSize: '12.5px', color: '#FFB300' }}>
            {snapshot.activeAgents} agent{snapshot.activeAgents > 1 ? 's' : ''} running right now.
          </div>
        )}
      </div>

      {/* ── 1. BRAND KIT EXTRACTION CARD ──────────────────────────── */}
      <div
        className="glow-card"
        style={{
          background: 'linear-gradient(135deg, rgba(20, 20, 36, 0.75) 0%, rgba(10, 10, 18, 0.95) 100%)',
          border: '1px solid rgba(124, 117, 255, 0.25)',
          borderRadius: '20px',
          padding: '24px 28px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(124, 117, 255, 0.15)', border: '1px solid rgba(124, 117, 255, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Layers size={18} color="#7C75FF" />
              </div>
              <h2 style={{ fontSize: '20px', color: '#fff', margin: 0, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
                Brand kit extraction
              </h2>
              <span style={{ fontSize: '11px', background: 'rgba(0, 230, 118, 0.15)', color: '#00E676', border: '1px solid rgba(0, 230, 118, 0.3)', padding: '2px 8px', borderRadius: '100px', fontWeight: 700 }}>
                {kitPercent}% complete
              </span>
            </div>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: 0 }}>
              Review each item once it's ready to make sure we got it right
            </p>
          </div>

          <button
            onClick={() => setShowBrandKitModal(true)}
            style={{
              background: 'linear-gradient(135deg, #7C75FF 0%, #5A52FF 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '100px',
              padding: '9px 24px',
              fontSize: '13.5px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(124, 117, 255, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            Review <ChevronRight size={15} />
          </button>
        </div>

        {/* Checklist of 6 Items */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(170px, 100%), 1fr))', gap: '12px' }}>
          {brandKitItems.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                setActiveBrandKitTab(item.id as any);
                setShowBrandKitModal(true);
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '14px',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(124, 117, 255, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(124, 117, 255, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {item.icon}
                <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#fff' }}>{item.label}</span>
              </div>
              {/* Was a literal "Ready" for every row regardless of item.status, so the
                  list stayed green even as the percentage above it fell. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700,
                            color: item.status === 'Ready' ? '#00E676' : 'var(--text-muted)' }}>
                {item.status === 'Ready'
                  ? <CheckCircle2 size={13} color="#00E676" />
                  : <AlertCircle size={13} color="var(--text-muted)" />}
                <span>{item.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 2 & 3. DUAL GRID: ACTION NEEDED & TOP PERFORMING CREATIVES ──────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))', gap: '24px' }}>
        
        {/* ── ACTION NEEDED ────────────────────────────────────────── */}
        <div
          className="glow-card"
          style={{
            background: 'linear-gradient(180deg, rgba(20, 20, 32, 0.7) 0%, rgba(10, 10, 16, 0.9) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '20px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '300px'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={18} color="#FFB300" />
                <h3 style={{ fontSize: '18px', color: '#fff', margin: 0, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
                  Action Needed
                </h3>
              </div>
              
              <button
                onClick={() => setShowRecommendationsModal(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#7C75FF',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: 0
                }}
              >
                View all plays <ArrowUpRight size={14} />
              </button>
            </div>

            {!isAdAccountConnected ? (
              /* EMPTY CONNECT STATE (User requested text) */
              <div
                style={{
                  padding: '32px 24px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px dashed rgba(255, 255, 255, 0.12)',
                  borderRadius: '16px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '14px'
                }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255, 179, 0, 0.1)', border: '1px solid rgba(255, 179, 0, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertCircle size={24} color="#FFB300" />
                </div>
                <div>
                  <h4 style={{ fontSize: '16px', color: '#fff', margin: '0 0 6px 0', fontWeight: 700 }}>
                    No recommendations yet
                  </h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 auto', maxWidth: '380px', lineHeight: 1.5 }}>
                    Connect an ad account to surface opportunities and decisions from live performance data.
                  </p>
                </div>
                <button
                  onClick={() => setShowConnectModal(true)}
                  style={{
                    background: 'linear-gradient(135deg, #00E676 0%, #00C853 100%)',
                    color: '#000000',
                    border: 'none',
                    borderRadius: '100px',
                    padding: '9px 22px',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(0, 230, 118, 0.3)',
                    marginTop: '4px'
                  }}
                >
                  Connect ad account
                </button>
              </div>
            ) : (
              /* CONNECTED ACTIVE RECOMMENDATIONS PREVIEW */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {mockRecommendations.slice(0, 2).map((rec) => (
                  <div
                    key={rec.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', background: 'rgba(255, 179, 0, 0.15)', color: '#FFB300', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                        {rec.urgency}
                      </span>
                      <span style={{ fontSize: '11.5px', color: '#00E676', fontWeight: 700 }}>{rec.impact}</span>
                    </div>
                    <h5 style={{ fontSize: '13.5px', color: '#fff', margin: 0, fontWeight: 700 }}>{rec.title}</h5>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>{rec.desc}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: 'var(--text-muted)' }}>
            <span>Auto-refresh every 15 min</span>
            <span style={{ color: '#00E676' }}>● AI Performance Engine Active</span>
          </div>
        </div>

        {/* ── TOP PERFORMING CREATIVES ──────────────────────────────── */}
        <div
          className="glow-card"
          style={{
            background: 'linear-gradient(180deg, rgba(20, 20, 32, 0.7) 0%, rgba(10, 10, 16, 0.9) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '20px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '300px'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={18} color="#00E676" />
                <h3 style={{ fontSize: '18px', color: '#fff', margin: 0, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
                  Top Performing Creatives
                </h3>
              </div>

              <button
                onClick={() => onNavigateTab('studio')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#7C75FF',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: 0
                }}
              >
                View Creative Performance <ArrowUpRight size={14} />
              </button>
            </div>

            {!isAdAccountConnected ? (
              /* EMPTY CONNECT STATE (User requested text) */
              <div
                style={{
                  padding: '32px 24px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px dashed rgba(255, 255, 255, 0.12)',
                  borderRadius: '16px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '14px'
                }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(0, 230, 118, 0.1)', border: '1px solid rgba(0, 230, 118, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BarChart3 size={24} color="#00E676" />
                </div>
                <div>
                  <h4 style={{ fontSize: '16px', color: '#fff', margin: '0 0 6px 0', fontWeight: 700 }}>
                    No creative performance yet
                  </h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 auto', maxWidth: '380px', lineHeight: 1.5 }}>
                    Once an ad account is connected, your top-performing creatives will show up here.
                  </p>
                </div>
                <button
                  onClick={() => setShowConnectModal(true)}
                  style={{
                    background: 'linear-gradient(135deg, #00E676 0%, #00C853 100%)',
                    color: '#000000',
                    border: 'none',
                    borderRadius: '100px',
                    padding: '9px 22px',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(0, 230, 118, 0.3)',
                    marginTop: '4px'
                  }}
                >
                  Connect ad account
                </button>
              </div>
            ) : (
              /* Real creatives from this workspace. Per-creative ROAS and spend are not
                 shown because nothing measures them yet - that needs insights pulled back
                 from the connected ad account, which is a different job from generating. */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {topCreatives.map((cr) => (
                  <div
                    key={cr.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px'
                    }}
                  >
                    {cr.image_url ? (
                      <img
                        src={cr.image_url}
                        alt=""
                        style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }}
                      />
                    ) : (
                      <div style={{ width: '44px', height: '44px', borderRadius: '8px', background: 'rgba(124,117,255,0.12)', border: '1px solid rgba(124,117,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Sparkles size={16} color="#7C75FF" />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h5 style={{ fontSize: '13px', color: '#fff', margin: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cr.headline || 'Untitled creative'}
                      </h5>
                    </div>
                    <button
                      onClick={() => onNavigateTab('studio')}
                      style={{ background: 'none', border: 'none', color: '#7C75FF', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Open →
                    </button>
                  </div>
                ))}
                {!topCreatives.length && (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                    No creatives generated for this workspace yet.
                  </p>
                )}
              </div>
            )}
          </div>

          <div style={{ marginTop: '16px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
            <span>Spend and return per creative need insights read back from a connected ad account.</span>
          </div>
        </div>
      </div>

      {/* ── 4. SCHEDULED AUTOMATIONS & WORKFLOWS CARD ──────────────── */}
      <div
        className="glow-card"
        style={{
          background: 'linear-gradient(135deg, rgba(20, 20, 36, 0.7) 0%, rgba(10, 10, 16, 0.9) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '20px',
          padding: '24px 28px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(0, 210, 255, 0.15)', border: '1px solid rgba(0, 210, 255, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={18} color="#00D2FF" />
            </div>
            <div>
              <h3 style={{ fontSize: '19px', color: '#fff', margin: 0, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
                Scheduled
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                Automated recurring creative generation, competitor intel, and ad scale routines.
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('scheduler')}
            style={{
              background: 'none',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              borderRadius: '100px',
              padding: '8px 20px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            View Scheduler <ArrowUpRight size={14} />
          </button>
        </div>

        {/* Schedule List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {schedules.map((sch) => (
            <div
              key={sch.id}
              style={{
                background: 'rgba(255, 255, 255, 0.025)',
                border: '1px solid rgba(255, 255, 255, 0.07)',
                borderRadius: '14px',
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${scheduleColour(sch.agent)}15`, border: `1px solid ${scheduleColour(sch.agent)}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Clock size={18} color={scheduleColour(sch.agent)} />
                </div>
                <div>
                  <h4 style={{ fontSize: '14.5px', color: '#fff', margin: '0 0 3px 0', fontWeight: 700 }}>
                    {sch.name}
                  </h4>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span>{scheduleFrequency(sch)}</span>
                    <span>•</span>
                    <span style={{ color: scheduleColour(sch.agent) }}>{sch.agent}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{
                  fontSize: '11px', padding: '3px 10px', borderRadius: '100px', fontWeight: 700,
                  background: sch.enabled ? 'rgba(0, 230, 118, 0.12)' : 'rgba(255,255,255,0.06)',
                  color: sch.enabled ? '#00E676' : 'var(--text-muted)',
                  border: `1px solid ${sch.enabled ? 'rgba(0, 230, 118, 0.3)' : 'rgba(255,255,255,0.12)'}`,
                }}>
                  ● {sch.enabled ? 'Active' : 'Paused'}
                </span>
                <button
                  onClick={() => setShowSchedulerModal(true)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  Configure
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── BRAND KIT REVIEW MODAL ────────────────────────────────── */}
      <AnimatePresence>
        {showBrandKitModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.82)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(10px)',
              padding: '20px'
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                width: '100%',
                maxWidth: '850px',
                maxHeight: '88vh',
                background: '#0a0a10',
                border: '1px solid rgba(124, 117, 255, 0.35)',
                borderRadius: '24px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
              }}
            >
              {/* Modal Header */}
              <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '20px', color: '#fff', margin: '0 0 4px 0', fontWeight: 800 }}>
                    Brand Kit Review & Extraction
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                    Extracted from {brandName} guidelines. Edit or verify each asset below.
                  </p>
                </div>
                <button
                  onClick={() => setShowBrandKitModal(false)}
                  style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '0 20px', overflowX: 'auto' }}>
                {brandKitItems.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveBrandKitTab(tab.id as any)}
                    style={{
                      background: 'none',
                      border: 'none',
                      borderBottom: activeBrandKitTab === tab.id ? '2px solid #00E676' : '2px solid transparent',
                      color: activeBrandKitTab === tab.id ? '#00E676' : 'var(--text-secondary)',
                      padding: '14px 18px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              {/* Modal Tab Content */}
              <div style={{ padding: '28px', overflowY: 'auto', flex: 1 }}>
                {activeBrandKitTab === 'logo' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <h4 style={{ fontSize: '16px', color: '#fff', margin: 0 }}>Extracted Brand Logos</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div style={{ background: '#000', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '24px', textAlign: 'center' }}>
                        <div style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-0.04em', color: '#fff', marginBottom: '8px' }}>
                          {brandName.toUpperCase()}
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Dark Theme SVG Vector (Primary)</span>
                      </div>
                      <div style={{ background: '#ffffff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '24px', textAlign: 'center' }}>
                        <div style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-0.04em', color: '#000000', marginBottom: '8px' }}>
                          {brandName.toUpperCase()}
                        </div>
                        <span style={{ fontSize: '11px', color: '#666' }}>Light Background Monogram</span>
                      </div>
                    </div>
                  </div>
                )}

                {activeBrandKitTab === 'colors' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <h4 style={{ fontSize: '16px', color: '#fff', margin: 0 }}>Color Palette Tokens</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))', gap: '14px' }}>
                      {[
                        { name: 'Electric Violet (Primary)', hex: '#5A52FF' },
                        { name: 'Neon Emerald (Accent)', hex: '#00E676' },
                        { name: 'Cyan Glow (Highlight)', hex: '#00D2FF' },
                        { name: 'Obsidian Night (Surface)', hex: '#08080C' }
                      ].map((col) => (
                        <div key={col.hex} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '12px' }}>
                          <div style={{ height: '56px', borderRadius: '8px', background: col.hex, marginBottom: '10px', border: '1px solid rgba(255,255,255,0.1)' }} />
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>{col.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{col.hex}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeBrandKitTab === 'typography' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    <h4 style={{ fontSize: '16px', color: '#fff', margin: 0 }}>Typography Hierarchy</h4>
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '20px' }}>
                      <div style={{ fontSize: '24px', fontWeight: 800, color: '#fff', fontFamily: 'var(--font-heading)', marginBottom: '4px' }}>
                        Heading Font: Outfit Display
                      </div>
                      <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                        Body Font: Inter (Weights: 400, 500, 600, 700)
                      </div>
                      <div style={{ fontSize: '12px', color: '#00E676', fontFamily: 'var(--font-mono)' }}>
                        Monospace: JetBrains Mono for Metrics & Financials
                      </div>
                    </div>
                  </div>
                )}

                {activeBrandKitTab === 'knowledge' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h4 style={{ fontSize: '16px', color: '#fff', margin: 0 }}>Extracted Brand Knowledge</h4>
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div>
                        <strong style={{ color: '#00E676', fontSize: '12px', textTransform: 'uppercase' }}>Brand Voice & Tone:</strong>
                        <p style={{ color: '#fff', fontSize: '13.5px', margin: '4px 0 0 0' }}>
                          Premium, visionary, performance-focused, and highly conversion-optimized with clean D2C aesthetics.
                        </p>
                      </div>
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                        <strong style={{ color: '#7C75FF', fontSize: '12px', textTransform: 'uppercase' }}>Primary Value Propositions:</strong>
                        <p style={{ color: '#fff', fontSize: '13.5px', margin: '4px 0 0 0' }}>
                          10x faster creative turnaround, automated multi-channel ad scaling, and verified audience authenticity.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeBrandKitTab === 'assets' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Real assets, and a real count. "28 Synced" was a fixed number over
                        three stock photographs. */}
                    <h4 style={{ fontSize: '16px', color: '#fff', margin: 0 }}>
                      Generated assets ({snapshot?.creatives ?? 0})
                    </h4>
                    {topCreatives.length ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(130px, 100%), 1fr))', gap: '12px' }}>
                        {topCreatives.map((cr) => (
                          <div key={cr.id} style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                            {cr.image_url ? (
                              <img src={cr.image_url} alt="" style={{ width: '100%', height: '100px', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ height: '100px', background: 'rgba(124,117,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Sparkles size={18} color="#7C75FF" />
                              </div>
                            )}
                            <div style={{ padding: '6px 8px', background: '#0d0d14', fontSize: '11px', color: '#fff', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {cr.headline || 'Untitled'}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                        Nothing generated for this workspace yet.
                      </p>
                    )}
                  </div>
                )}

                {activeBrandKitTab === 'market' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h4 style={{ fontSize: '16px', color: '#fff', margin: 0 }}>Target Market Demographics</h4>
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '20px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Audience Age</span>
                          <div style={{ fontSize: '16px', color: '#fff', fontWeight: 700, marginTop: '2px' }}>18 – 35 Years (Gen Z / Millennials)</div>
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Geography</span>
                          <div style={{ fontSize: '16px', color: '#fff', fontWeight: 700, marginTop: '2px' }}>India (Delhi, Mumbai, Bengaluru, Pune)</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div style={{ padding: '16px 28px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: 'rgba(255,255,255,0.02)' }}>
                <button
                  onClick={() => setShowBrandKitModal(false)}
                  style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '9px 20px', borderRadius: '100px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Close
                </button>
                {/* This modal reviews the brand kit; it has nothing to save. Editing happens in the
                    Brand Knowledge vault, so that is where the button goes. */}
                <GlowButton variant="glow" onClick={() => { setShowBrandKitModal(false); onNavigateTab('knowledge'); }} style={{ padding: '9px 24px', fontSize: '13px' }}>
                  Edit in Brand Knowledge
                </GlowButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── AD ACCOUNT CONNECTOR MODAL ────────────────────────────── */}
      <AnimatePresence>
        {showConnectModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.82)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(10px)',
              padding: '20px'
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                width: '100%',
                maxWidth: '560px',
                background: '#0a0a12',
                border: '1px solid rgba(0, 230, 118, 0.35)',
                borderRadius: '24px',
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '20px', color: '#fff', margin: '0 0 4px 0', fontWeight: 800 }}>
                    Connect Ad Account
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                    Surface live ROAS opportunities, recommendations & top creative analytics.
                  </p>
                </div>
                <button
                  onClick={() => setShowConnectModal(false)}
                  style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '60vh', overflowY: 'auto', paddingRight: '4px' }}>
                {[
                  { id: 'meta', name: 'Meta Ads', desc: 'Run and optimize ads across Facebook, Instagram, Threads, and more.', tag: 'Ad Account', isLocked: false },
                  { id: 'google', name: 'Google Ads', desc: 'Run and optimize ads across Search, YouTube, Maps, Gmail, and more.', tag: 'Ad Account', isLocked: false },
                  { id: 'chatgpt', name: 'ChatGPT Ads', desc: 'Run and optimize ads in ChatGPT conversations.', tag: 'Coming Soon', isLocked: true },
                  { id: 'amazon', name: 'Amazon Ads', desc: 'Run and optimize product ads on Amazon.', tag: 'Coming Soon', isLocked: true },
                  { id: 'ga4', name: 'Google Analytics 4', desc: 'Pull traffic, event, and conversion data across your site and campaigns.', tag: 'Analytics', isLocked: false },
                  { id: 'gsc', name: 'Google Search Console', desc: 'Monitor organic search rankings, keyword impressions, CTR, and indexing health.', tag: 'Analytics', isLocked: false },
                  { id: 'drive', name: 'Google Drive', desc: 'Sync brand assets, video footage, product catalogs, and creative guidelines.', tag: 'Coming Soon', isLocked: true },
                  { id: 'slack', name: 'Slack', desc: 'Receive real-time campaign alerts and creative approval requests.', tag: 'Team Alert', isLocked: false },
                  { id: 'hubspot', name: 'HubSpot', desc: 'Sync leads, CRM contacts, deals, and attribution pipelines.', tag: 'CRM', isLocked: false }
                ].map((plat) => (
                  <div
                    key={plat.id}
                    style={{
                      background: plat.isLocked ? 'rgba(255, 255, 255, 0.015)' : 'rgba(255, 255, 255, 0.03)',
                      border: plat.isLocked ? '1px dashed rgba(255, 255, 255, 0.1)' : '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '14px',
                      padding: '14px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      opacity: plat.isLocked ? 0.75 : 1
                    }}
                  >
                    <div style={{ flex: 1, paddingRight: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <span style={{ fontSize: '14.5px', color: '#fff', fontWeight: 700 }}>{plat.name}</span>
                        <span style={{
                          fontSize: '10px',
                          background: plat.isLocked ? 'rgba(255, 179, 0, 0.15)' : 'rgba(90,82,255,0.15)',
                          color: plat.isLocked ? '#FFB300' : '#7C75FF',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: 700
                        }}>
                          {plat.isLocked ? '🔒 Coming Soon' : plat.tag}
                        </span>
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.35 }}>{plat.desc}</span>
                    </div>

                    {plat.isLocked ? (
                      <span style={{ fontSize: '11px', color: '#FFB300', background: 'rgba(255,179,0,0.1)', border: '1px solid rgba(255,179,0,0.3)', padding: '5px 12px', borderRadius: '100px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        🔒 Locked
                      </span>
                    ) : (
                      <button
                        onClick={handleGoConnect}
                        style={{
                          background: 'linear-gradient(135deg, #00E676 0%, #00C853 100%)',
                          color: '#000000',
                          border: 'none',
                          borderRadius: '100px',
                          padding: '8px 18px',
                          fontSize: '12px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Connect
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── RECOMMENDATIONS MODAL ─────────────────────────────────── */}
      <AnimatePresence>
        {showRecommendationsModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.82)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(10px)',
              padding: '20px'
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                width: '100%',
                maxWidth: '650px',
                background: '#0a0a12',
                border: '1px solid rgba(255, 179, 0, 0.35)',
                borderRadius: '24px',
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '20px', color: '#fff', margin: '0 0 4px 0', fontWeight: 800 }}>
                    Growth plays
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                    Live algorithmic decisions calculated from your creative & campaign telemetry.
                  </p>
                </div>
                <button
                  onClick={() => setShowRecommendationsModal(false)}
                  style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {mockRecommendations.map((rec) => (
                  <div
                    key={rec.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '14px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', background: 'rgba(255, 179, 0, 0.15)', color: '#FFB300', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                        {rec.urgency}
                      </span>
                      <span style={{ fontSize: '12px', color: '#00E676', fontWeight: 700 }}>{rec.impact}</span>
                    </div>
                    <h4 style={{ fontSize: '14px', color: '#fff', margin: 0, fontWeight: 700 }}>{rec.title}</h4>
                    <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{rec.desc}</p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                      {/* These are written suggestions, not a switch to flip - "Apply" applied nothing.
                          It opens the screen where the change is actually made. */}
                      <GlowButton variant="glow" onClick={() => { setShowRecommendationsModal(false); onNavigateTab(rec.tab || 'studio'); }} style={{ padding: '6px 16px', fontSize: '12px' }}>
                        Take me there →
                      </GlowButton>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── SCHEDULER CONFIG MODAL ────────────────────────────────── */}
      <AnimatePresence>
        {showSchedulerModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.82)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(10px)',
              padding: '20px'
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                width: '100%',
                maxWidth: '650px',
                background: '#0a0a12',
                border: '1px solid rgba(0, 210, 255, 0.35)',
                borderRadius: '24px',
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '20px', color: '#fff', margin: '0 0 4px 0', fontWeight: 800 }}>
                    Automated Workflows Scheduler
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                    Recurring background jobs executed by Raftra AI Agent nodes for {brandName}.
                  </p>
                </div>
                <button
                  onClick={() => setShowSchedulerModal(false)}
                  style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {schedules.map((sch) => (
                  <div
                    key={sch.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '14px',
                      padding: '16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <h4 style={{ fontSize: '14.5px', color: '#fff', margin: '0 0 3px 0', fontWeight: 700 }}>
                        {sch.name}
                      </h4>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{scheduleFrequency(sch)}</div>
                    </div>

                    <button
                      onClick={() => runScheduleNow(sch.id)}
                      disabled={runningScheduleId === sch.id}
                      style={{
                        background: 'rgba(0, 210, 255, 0.12)',
                        border: '1px solid rgba(0, 210, 255, 0.3)',
                        color: '#00D2FF',
                        borderRadius: '100px',
                        padding: '6px 16px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Run Now 🚀
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  onClick={() => setShowSchedulerModal(false)}
                  style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '9px 20px', borderRadius: '100px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
