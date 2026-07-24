import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles, Check, CheckCircle2, Clock, AlertTriangle, Rocket, Activity,
  Image as ImageIcon, ShieldCheck, Edit3, RefreshCw, XCircle, DollarSign,
  BarChart3, OctagonX, ArrowRight, FileUp, Download, Copy, Database,
  TrendingUp, ShoppingCart,
} from 'lucide-react';

export interface CampaignItem {
  id: string; platform: string; name: string; objective: string;
  budget: number; roas: number; status: 'active' | 'paused' | 'pending_review';
}

interface WorkspaceCampaignProps {
  workspaceId?: number | null;
  campaigns?: CampaignItem[];
  creativeAssets?: any[];
  onOpenReview?: (itemId: string) => void;
  onToggleStatus?: (id: string) => void;
}

const authHeaders = (): Record<string, string> => {
  const t = localStorage.getItem('token');
  return t ? { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` } : { 'Content-Type': 'application/json' };
};
const money = (v: any) => `₹${Number(v || 0).toLocaleString('en-IN')}`;
const ago = (ts: number) => {
  const m = Math.floor((Date.now() - ts) / 60000);
  return m < 1 ? 'just now' : m === 1 ? '1 min ago' : `${m} mins ago`;
};

// ── shared styles ────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: 'var(--surface, rgba(255,255,255,0.03))',
  border: '1px solid var(--border, var(--border-color))',
  borderRadius: '14px', padding: '22px',
};
const sectionTitle: React.CSSProperties = { fontSize: '17px', fontWeight: 600, color: '#fff', marginBottom: '4px' };
const sectionHint: React.CSSProperties = { fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.55 };
const label: React.CSSProperties = { fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 500 };
const input: React.CSSProperties = {
  width: '100%', padding: '11px 13px', background: 'rgba(0,0,0,0.25)',
  border: '1px solid var(--border, var(--border-color))', borderRadius: '9px',
  color: '#fff', fontSize: '13.5px', outline: 'none',
};
const btnPrimary: React.CSSProperties = {
  background: 'linear-gradient(135deg, var(--primary) 0%, #3B33FF 100%)', border: 'none', color: '#fff',
  padding: '12px', borderRadius: '9px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
};
const btnGhost: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border, var(--border-color))', color: '#fff',
  padding: '10px 14px', borderRadius: '9px', fontSize: '12.5px', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
};

const Pill: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { c: string; b: string }> = {
    Completed: { c: '#00e676', b: 'rgba(0,230,118,0.12)' },
    Approved: { c: '#00e676', b: 'rgba(0,230,118,0.12)' },
    Published: { c: '#00e676', b: 'rgba(0,230,118,0.12)' },
    Generated: { c: '#5a8dff', b: 'rgba(90,141,255,0.14)' },
    'In Progress': { c: '#5a8dff', b: 'rgba(90,141,255,0.14)' },
    'Needs approval': { c: '#ffae00', b: 'rgba(255,174,0,0.14)' },
    Locked: { c: 'var(--text-secondary)', b: 'rgba(255,255,255,0.06)' },
    Pending: { c: 'var(--text-secondary)', b: 'rgba(255,255,255,0.06)' },
    MOCK: { c: '#ffae00', b: 'rgba(255,174,0,0.14)' },
    SAMPLE: { c: '#ffae00', b: 'rgba(255,174,0,0.14)' },
  };
  const s = map[status] || map.Pending;
  return <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.4px', color: s.c, background: s.b, border: `1px solid ${s.c}33`, borderRadius: '20px', padding: '3px 10px', whiteSpace: 'nowrap' }}>{status}</span>;
};

// Short values sit on one line (label left, value right). Long values — audience, placements —
// stack instead: right-aligned sentences that wrap are the thing that reads as "all over the place".
const Row: React.FC<{ k: string; v: React.ReactNode; stack?: boolean }> = ({ k, v, stack }) => (
  stack ? (
    <div style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '5px' }}>{k}</div>
      <div style={{ fontSize: '13px', color: '#fff', lineHeight: 1.55, wordBreak: 'break-word' }}>{v}</div>
    </div>
  ) : (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '16px', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '13px' }}>
      <span style={{ color: 'var(--text-secondary)', flexShrink: 0, whiteSpace: 'nowrap' }}>{k}</span>
      <span style={{ color: '#fff', textAlign: 'right', lineHeight: 1.45, minWidth: 0, wordBreak: 'break-word' }}>{v}</span>
    </div>
  )
);

// Wraps a step that must stay inert until the strategy is approved.
const Gated: React.FC<{ children: React.ReactNode; locked: boolean; why: string }> = ({ children, locked, why }) => (
  <div style={{ position: 'relative' }}>
    <div style={{ opacity: locked ? 0.35 : 1, pointerEvents: locked ? 'none' : 'auto', filter: locked ? 'grayscale(0.5)' : 'none', transition: 'opacity .25s' }}>{children}</div>
    {locked && (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <div style={{ background: 'rgba(16,18,26,0.95)', border: '1px solid rgba(255,174,0,0.35)', borderRadius: '10px', padding: '14px 18px', textAlign: 'center', maxWidth: '90%' }}>
          <AlertTriangle size={16} color="#ffae00" style={{ marginBottom: '6px' }} />
          <div style={{ fontSize: '12.5px', color: '#fff', fontWeight: 600, marginBottom: '2px' }}>Locked</div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>{why}</div>
        </div>
      </div>
    )}
  </div>
);

export const WorkspaceCampaign: React.FC<WorkspaceCampaignProps> = ({ workspaceId, creativeAssets = [] }) => {
  // ── the full ideation brief (all original fields restored) ──
  const [form, setForm] = useState({
    campaignFocus: 'Diwali Festive Sale',
    objective: 'Conversions',
    budget: 40000,
    audience: 'Women 18-35, Tier 1 & Tier 2 Cities, Interested in Festive Shopping',
    funnel: 'Bottom of Funnel',
    geoTargetingLevel: 'State-Level',
    placement: 'Maharashtra, Delhi, Karnataka',
    schedule: '14 Days',
    tracking: 'utm_source=ai_agent',
  });

  const [campaign, setCampaign] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [activity, setActivity] = useState<{ label: string; at: number }[]>([]);
  const [isCopied, setIsCopied] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  // Smart ad management (restored)
  const [smart, setSmart] = useState({ killAds: true, autoRotate: true, skipRateThreshold: 70, frequencyCap: 3.5, cpaThreshold: 3500, refreshIntervalDays: 4 });

  const flash = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 6000); };
  const log = (l: string) => setActivity(a => [{ label: l, at: Date.now() }, ...a].slice(0, 6));

  const spec = campaign?.metrics || {};
  const status = String(campaign?.status || '').toUpperCase();
  const approved = status === 'APPROVED' || status === 'PUBLISHED_DEMO';
  const published = status === 'PUBLISHED_DEMO';
  const metaSetup = spec.meta_setup || {};
  const googleSetup = spec.google_setup || {};
  const split = spec.budget_split || {};
  const heroImage: string | null = spec.image_url || null;
  const headlines: string[] = spec.google_headlines || [];
  const descriptions: string[] = spec.google_descriptions || [];
  const keywords: string[] = spec.top_keywords || [];
  const libraryImages: string[] = (creativeAssets || []).map((a: any) => a.image_url || a.imageUrl).filter(Boolean);

  // ── data ──
  const loadLatest = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const list = await fetch(`/api/workspaces/${workspaceId}/campaigns`, { headers: authHeaders() }).then(r => r.json());
      if (Array.isArray(list) && list.length) setCampaign(list.slice().sort((a: any, b: any) => b.id - a.id)[0]);
    } catch { /* ignore */ }
  }, [workspaceId]);
  const refresh = useCallback(async (id: number) => {
    try {
      const r = await fetch(`/api/workspaces/${workspaceId}/campaigns/${id}`, { headers: authHeaders() });
      if (r.ok) setCampaign(await r.json());
    } catch { /* ignore */ }
  }, [workspaceId]);
  useEffect(() => { loadLatest(); }, [loadLatest]);

  // ── generate strategy (+ its ad image, together) ──
  const generate = async () => {
    if (!workspaceId) { flash('No workspace selected.', false); return; }
    setIsGenerating(true);
    let beforeMax = 0;
    try {
      const b = await fetch(`/api/workspaces/${workspaceId}/campaigns`, { headers: authHeaders() }).then(r => r.json());
      if (Array.isArray(b)) beforeMax = b.reduce((m: number, c: any) => Math.max(m, c.id), 0);
    } catch { /* ignore */ }
    const prompt = `Create an ad campaign. Theme/focus: ${form.campaignFocus}. Objective: ${form.objective}. Total budget: ₹${form.budget}. Audience: ${form.audience}. Funnel: ${form.funnel}. Geo: ${form.placement} (${form.geoTargetingLevel}). Schedule: ${form.schedule}. Tracking: ${form.tracking}.`;
    try {
      await fetch(`/api/agents/${workspaceId}/campaign`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ prompt, model: 'gemini-2.5-flash' }) });
    } catch { setIsGenerating(false); flash('Could not start generation.', false); return; }
    let tries = 0;
    const poll = setInterval(async () => {
      tries += 1;
      try {
        const now = await fetch(`/api/workspaces/${workspaceId}/campaigns`, { headers: authHeaders() }).then(r => r.json());
        const fresh = Array.isArray(now) ? now.filter((c: any) => c.id > beforeMax).sort((a: any, b: any) => b.id - a.id)[0] : null;
        if (fresh) {
          clearInterval(poll); setIsGenerating(false); setCampaign(fresh);
          log('AI Strategy + ad image generated');
          flash('Strategy and its ad image are ready. Review them, then approve to unlock the rest.');
        } else if (tries >= 20) { clearInterval(poll); setIsGenerating(false); flash('Taking longer than expected — check the agent logs.', false); }
      } catch { /* keep polling */ }
    }, 3000);
  };

  const approve = async () => {
    if (!campaign) return;
    setBusy('approve');
    try {
      const r = await fetch(`/api/workspaces/${workspaceId}/campaigns/${campaign.id}/approve`, { method: 'POST', headers: authHeaders() });
      const d = await r.json();
      if (r.ok) { await refresh(campaign.id); log('Strategy approved'); flash('Approved. The strategy has been passed to Meta, Google and Review below.'); }
      else flash(d.detail || 'Approve failed.', false);
    } catch { flash('Approve failed.', false); }
    setBusy(null);
  };

  const adSetup = async (platform: 'meta' | 'google', action: 'connect' | 'launch') => {
    if (!campaign) return;
    setBusy(`${platform}-${action}`);
    try {
      const r = await fetch(`/api/workspaces/${workspaceId}/campaigns/${campaign.id}/ad-setup`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ platform, action }),
      });
      const d = await r.json();
      if (r.ok) {
        await refresh(campaign.id);
        const P = platform === 'meta' ? 'Meta' : 'Google';
        log(`${P} Ads ${action === 'connect' ? 'connected' : 'launched'} (mock)`);
        flash(`${P} ${action} done in MOCK mode — no real ad account was touched.`);
      } else flash(d.detail || 'Action failed.', false);
    } catch { flash('Action failed.', false); }
    setBusy(null);
  };

  const publish = async () => {
    if (!campaign) return;
    setBusy('publish');
    try {
      const r = await fetch(`/api/workspaces/${workspaceId}/campaigns/${campaign.id}/publish`, { method: 'POST', headers: authHeaders() });
      const d = await r.json();
      if (r.ok) { await refresh(campaign.id); log('Campaign published (demo)'); flash(d.message || 'Published in DEMO mode.'); }
      else flash(d.detail || 'Publish failed.', false);
    } catch { flash('Publish failed.', false); }
    setBusy(null);
  };

  const regenerateImage = async () => {
    if (!workspaceId) return;
    setBusy('image');
    try {
      await fetch(`/api/agents/${workspaceId}/creative`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ prompt: `Ad creative for ${form.campaignFocus}. Audience: ${form.audience}. ${form.objective} campaign.`, model: 'gemini-2.5-flash' }),
      });
      log('New ad image requested');
      flash('Generating a new image — it appears in Creative Studio and your library.');
    } catch { flash('Could not start image generation.', false); }
    setBusy(null);
  };

  // ── presets (restored) ──
  const presets = [
    { id: 'festive', title: 'Festive Conversion Blast', icon: Rocket, badge: 'High ROAS focus', desc: 'Scale a festive sale with bottom-of-funnel retargeting and short video hooks.',
      p: { campaignFocus: 'Diwali Festive Sale', objective: 'Conversions', budget: 65000, audience: 'Festive Shoppers & Tech Enthusiasts', funnel: 'Bottom of Funnel', geoTargetingLevel: 'State-Level', placement: 'Maharashtra, Delhi, Karnataka, Gujarat', schedule: '14 Days', tracking: 'utm_source=ai_agent_festive' } },
    { id: 'cart', title: 'Retargeting & Cart Recovery', icon: ShoppingCart, badge: 'High conversion %', desc: 'Re-engage high-intent abandoned carts with dynamic ads and an exit offer.',
      p: { campaignFocus: '7-Day Abandoned Cart Recovery', objective: 'Conversions', budget: 30000, audience: 'Added to Cart (Last 7 Days) - No Purchase', funnel: 'Bottom of Funnel', geoTargetingLevel: 'City-Level', placement: 'Mumbai, Bangalore, Delhi NCR', schedule: 'Ongoing / Evergreen', tracking: 'utm_source=ai_agent_retargeting' } },
    { id: 'lal', title: '1% Lookalike Expansion', icon: TrendingUp, badge: 'Scale audience', desc: 'Acquire new customers via lookalikes of your top-LTV buyers.',
      p: { campaignFocus: 'Lookalike Customer Acquisition', objective: 'Lead Generation', budget: 50000, audience: 'Top 1% LAL of Past Buyers + Interest in Premium Tech', funnel: 'Top of Funnel', geoTargetingLevel: 'Country-Level', placement: 'India (Tier 1 & Tier 2)', schedule: '30 Days', tracking: 'utm_source=ai_agent_lal' } },
  ];

  // ── import / export (restored) ──
  const exportCampaign = () => {
    const blob = new Blob([JSON.stringify({ version: '1.0', exportedAt: new Date().toISOString(), form, smart, strategy: spec }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `campaign-${form.campaignFocus.replace(/\s+/g, '_').toLowerCase()}-${Date.now()}.json`;
    a.click(); URL.revokeObjectURL(a.href);
  };
  const importCampaign = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      try {
        const d = JSON.parse(String(ev.target?.result));
        if (d.form) setForm(p => ({ ...p, ...d.form }));
        if (d.smart) setSmart(p => ({ ...p, ...d.smart }));
        flash('Campaign brief imported.');
      } catch { flash('Invalid campaign file.', false); }
    };
    r.readAsText(f); e.target.value = '';
  };

  const copyStrategy = () => {
    navigator.clipboard.writeText(JSON.stringify(spec, null, 2));
    setIsCopied(true); setTimeout(() => setIsCopied(false), 2000);
  };

  // ── stepper ──
  const steps = [
    { n: 1, name: 'Strategy', s: !campaign ? 'Pending' : approved ? 'Completed' : 'Needs approval' },
    { n: 2, name: 'Creatives', s: !campaign ? 'Pending' : heroImage ? (approved ? 'Completed' : 'Generated') : 'Pending' },
    { n: 3, name: 'Meta Ads', s: !approved ? 'Locked' : metaSetup.launched ? 'Completed' : metaSetup.connected ? 'In Progress' : 'Pending' },
    { n: 4, name: 'Google Ads', s: !approved ? 'Locked' : googleSetup.launched ? 'Completed' : googleSetup.connected ? 'In Progress' : 'Pending' },
    { n: 5, name: 'Review & Publish', s: published ? 'Completed' : !approved ? 'Locked' : 'Pending' },
  ];
  const stepColor = (s: string) => (s === 'Completed' ? '#00e676' : s === 'In Progress' || s === 'Generated' ? '#5a8dff' : s === 'Needs approval' ? '#ffae00' : 'var(--text-secondary)');
  const canPublish = approved && metaSetup.launched && googleSetup.launched && !published;

  // ── sample performance feed (mock data, kept at top) ──
  const sampleFeed = [
    { id: 'f1', tag: 'Scale (high performance)', icon: CheckCircle2, color: '#00e676', bg: 'rgba(0,230,118,0.08)', bd: 'rgba(0,230,118,0.3)', name: 'Diwali Festive Sale (Meta)', metrics: 'ROAS 4.2×  |  CPA ₹900  |  Spend ₹35,000', rec: 'Running 38% above ROAS target. Scale daily budget +25%.', act: 'Scale Budget +25%' },
    { id: 'f2', tag: 'Rotate creative (fatigue)', icon: AlertTriangle, color: '#ffb74d', bg: 'rgba(255,183,77,0.08)', bd: 'rgba(255,183,77,0.3)', name: 'Summer Apparel Retargeting', metrics: 'Frequency 4.1×  |  CTR 0.8%  |  Skip 74%', rec: 'Frequency hit 4.1× with a high skip rate. Rotate the creative.', act: 'Rotate Creative' },
    { id: 'f3', tag: 'Kill (CPA limit exceeded)', icon: OctagonX, color: '#ff5252', bg: 'rgba(255,82,82,0.08)', bd: 'rgba(255,82,82,0.3)', name: 'Broad TOF Awareness (Google)', metrics: `CPA ₹3,900 (cap ₹${smart.cpaThreshold})  |  0 conv (24h)`, rec: 'CPA breached your safety threshold. Auto-kill rule triggered.', act: 'Kill Ad Set' },
    { id: 'f4', tag: 'Pivot (audience saturation)', icon: RefreshCw, color: '#9c7bff', bg: 'rgba(156,123,255,0.08)', bd: 'rgba(156,123,255,0.3)', name: 'State-Level Scale Campaign', metrics: 'MH ROI 1.5×  |  KA ROI 3.8×', rec: 'Regional saturation detected. Reallocate 40% budget to high-ROI zones.', act: 'Reallocate Budget' },
  ];
  const [executed, setExecuted] = useState<string[]>([]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', color: '#fff' }}>
      {/* ── header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: '25px', fontFamily: 'var(--font-heading)', marginBottom: '6px' }}>Campaign Manager</h2>
          <p style={sectionHint}>Describe your campaign once — AI writes the strategy and the ad image. You approve it, and that approved plan drives Meta, Google and publishing.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <input type="file" ref={importRef} accept=".json" style={{ display: 'none' }} onChange={importCampaign} />
          <button onClick={() => importRef.current?.click()} style={btnGhost}><FileUp size={14} /> Import</button>
          <button onClick={exportCampaign} style={btnGhost}><Download size={14} /> Export</button>
        </div>
      </div>

      {/* ── 1. performance & action feed (sample data) ── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
          <h3 style={{ ...sectionTitle, display: 'flex', alignItems: 'center', gap: '9px', marginBottom: 0 }}>
            <Activity size={17} color="var(--primary)" /> Daily Performance &amp; AI Action Feed
          </h3>
          <Pill status="SAMPLE" />
        </div>
        <p style={{ ...sectionHint, marginBottom: '14px' }}>
          Once campaigns are live this shows what to scale, rotate or kill from real numbers. These are example rows so you can see the format.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
          {sampleFeed.map(f => {
            const done = executed.includes(f.id);
            const Icon = f.icon;
            return (
              <div key={f.id} style={{ padding: '15px', background: f.bg, border: `1px solid ${f.bd}`, borderRadius: '11px', display: 'flex', flexDirection: 'column', gap: '10px', opacity: done ? 0.55 : 1 }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: f.color, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '7px' }}>
                    <Icon size={14} color={f.color} /> {f.tag}
                  </div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, marginBottom: '4px' }}>{f.name}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginBottom: '8px' }}>{f.metrics}</div>
                  <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>{f.rec}</div>
                </div>
                <button onClick={() => { setExecuted(e => [...e, f.id]); flash('Example action — connect a live ad account to apply this for real.', false); }}
                  disabled={done}
                  style={{ padding: '9px 12px', background: done ? 'rgba(255,255,255,0.06)' : f.color, color: done ? 'var(--text-muted)' : '#03121a', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: done ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  {done ? 'Applied (example)' : <>{f.act} <ArrowRight size={13} /></>}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 2. the progress bar ── */}
      <div style={{ ...card, padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
          {steps.map((st, i) => (
            <React.Fragment key={st.n}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '6px 10px', borderRadius: '9px', background: st.s !== 'Pending' && st.s !== 'Locked' ? 'rgba(255,255,255,0.045)' : 'transparent', flex: '1 1 150px', minWidth: '140px' }}>
                <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: st.s === 'Completed' ? '#00e676' : st.s === 'Pending' || st.s === 'Locked' ? 'rgba(255,255,255,0.1)' : stepColor(st.s), color: st.s === 'Pending' || st.s === 'Locked' ? 'var(--text-secondary)' : '#03121a', fontSize: '11.5px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {st.s === 'Completed' ? <Check size={13} /> : st.n}
                </span>
                <div style={{ lineHeight: 1.3, minWidth: 0 }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 600 }}>{st.name}</div>
                  <div style={{ fontSize: '10.5px', color: stepColor(st.s) }}>{st.s}</div>
                </div>
              </div>
              {i < steps.length - 1 && <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>›</span>}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── 3. brief + generated strategy (with its image) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.25fr)', gap: '18px' }}>
        {/* brief */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <h3 style={{ ...sectionTitle, marginBottom: 0 }}>AI Ideation &amp; Strategist</h3>
            <Pill status={campaign ? 'Completed' : 'Pending'} />
          </div>
          <p style={{ ...sectionHint, marginBottom: '16px' }}>Start from a playbook or fill in your own brief. This is the only form you need.</p>

          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={13} color="var(--primary)" /> Quick-start playbooks
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
            {presets.map(p => {
              const Icon = p.icon;
              return (
                <button key={p.id} onClick={() => { setForm(f => ({ ...f, ...p.p })); flash(`"${p.title}" loaded — tweak anything, then generate.`); }}
                  style={{ textAlign: 'left', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border, var(--border-color))', borderRadius: '10px', padding: '12px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '7px' }}><Icon size={14} color="var(--primary)" /> {p.title}</span>
                    <span style={{ fontSize: '9.5px', color: 'var(--primary)', background: 'rgba(99,102,241,0.12)', padding: '2px 8px', borderRadius: '20px', whiteSpace: 'nowrap' }}>{p.badge}</span>
                  </div>
                  <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{p.desc}</p>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
            <div><span style={label}>Campaign idea / theme</span><input style={input} value={form.campaignFocus} onChange={e => setForm(f => ({ ...f, campaignFocus: e.target.value }))} placeholder="e.g. Diwali Festive Sale" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><span style={label}>Objective</span>
                <select style={input} value={form.objective} onChange={e => setForm(f => ({ ...f, objective: e.target.value }))}>
                  <option>Conversions</option><option>Traffic</option><option>Lead Generation</option><option>Brand Awareness</option><option>Engagement</option>
                </select>
              </div>
              <div><span style={label}>Total budget (₹)</span><input type="number" style={input} value={form.budget} onChange={e => setForm(f => ({ ...f, budget: Number(e.target.value) }))} /></div>
            </div>
            <div><span style={label}>Who are we targeting?</span><textarea style={{ ...input, minHeight: '62px', resize: 'vertical' }} value={form.audience} onChange={e => setForm(f => ({ ...f, audience: e.target.value }))} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><span style={label}>Funnel stage</span>
                <select style={input} value={form.funnel} onChange={e => setForm(f => ({ ...f, funnel: e.target.value }))}>
                  <option>Top of Funnel</option><option>Middle of Funnel</option><option>Bottom of Funnel</option>
                </select>
              </div>
              <div><span style={label}>Geo granularity</span>
                <select style={input} value={form.geoTargetingLevel} onChange={e => setForm(f => ({ ...f, geoTargetingLevel: e.target.value }))}>
                  <option>Pincode-Level</option><option>City-Level</option><option>State-Level</option><option>Country-Level</option>
                </select>
              </div>
            </div>
            <div><span style={label}>Places to run it</span><input style={input} value={form.placement} onChange={e => setForm(f => ({ ...f, placement: e.target.value }))} placeholder="e.g. Maharashtra, Delhi" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><span style={label}>Schedule</span><input style={input} value={form.schedule} onChange={e => setForm(f => ({ ...f, schedule: e.target.value }))} /></div>
              <div><span style={label}>Tracking (UTM)</span><input style={input} value={form.tracking} onChange={e => setForm(f => ({ ...f, tracking: e.target.value }))} /></div>
            </div>
            <button onClick={generate} disabled={isGenerating} style={{ ...btnPrimary, opacity: isGenerating ? 0.7 : 1, cursor: isGenerating ? 'wait' : 'pointer' }}>
              <Sparkles size={15} /> {isGenerating ? 'Writing your strategy & ad…' : campaign ? 'Regenerate Strategy' : 'Generate Strategy + Ad'}
            </button>
          </div>
        </div>

        {/* generated strategy + image together */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', gap: '10px' }}>
            <h3 style={{ ...sectionTitle, marginBottom: 0 }}>Your AI Strategy &amp; Ad</h3>
            <Pill status={!campaign ? 'Pending' : approved ? 'Approved' : 'Needs approval'} />
          </div>
          <p style={{ ...sectionHint, marginBottom: '16px' }}>
            {!campaign ? 'Nothing generated yet.' : approved
              ? 'Approved — this exact plan is what Meta, Google and publishing below are using.'
              : 'Check the plan and the ad image. Keep the image or generate a new one, then approve.'}
          </p>

          {!campaign ? (
            <div style={{ padding: '34px 20px', textAlign: 'center', border: '1px dashed var(--border, var(--border-color))', borderRadius: '11px' }}>
              <Sparkles size={26} color="var(--primary)" style={{ opacity: 0.6, marginBottom: '10px' }} />
              <p style={{ ...sectionHint }}>Fill the brief on the left and press <b style={{ color: '#fff' }}>Generate Strategy + Ad</b>.<br />You'll get the plan, budget split, keywords and a ready ad image here.</p>
            </div>
          ) : (
            <>
              {/* the ad image, inline with the strategy */}
              <div style={{ display: 'flex', gap: '14px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <div style={{ width: '150px', height: '150px', borderRadius: '11px', overflow: 'hidden', background: '#000', border: '1px solid var(--border, var(--border-color))', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {heroImage ? <img src={heroImage} alt="Generated ad" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <ImageIcon size={26} color="var(--text-muted)" />}
                </div>
                <div style={{ flex: 1, minWidth: '160px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '9px' }}>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                    {heroImage ? 'This ad image was generated with the strategy. Keep it, or make a new one.' : 'No image was produced for this run.'}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button onClick={regenerateImage} disabled={busy === 'image'} style={{ ...btnGhost, padding: '8px 12px', fontSize: '12px' }}>
                      <RefreshCw size={13} /> {busy === 'image' ? 'Generating…' : 'New image'}
                    </button>
                    <button style={{ ...btnGhost, padding: '8px 12px', fontSize: '12px' }}><Edit3 size={13} /> Creative Studio</button>
                  </div>
                  {libraryImages.length > 0 && (
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      {libraryImages.slice(0, 5).map((src, i) => (
                        <img key={i} src={src} alt="" style={{ width: '34px', height: '34px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border, var(--border-color))' }} />
                      ))}
                      <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)', alignSelf: 'center' }}>in your library</span>
                    </div>
                  )}
                </div>
              </div>

              {/* the plan */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '18px' }}>
                <div>
                  <Row k="Objective" v={campaign.objective || spec.objective || '—'} />
                  {split.meta && <Row k="Meta share" v={`${split.meta.pct}% · ${money(split.meta.amount)}`} />}
                  {split.google && <Row k="Google share" v={`${split.google.pct}% · ${money(split.google.amount)}`} />}
                  <Row k="Runs for" v={spec.duration_label || form.schedule} />
                </div>
                <div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '7px' }}>Success targets</div>
                  {(spec.kpis || []).map((k: string) => (
                    <div key={k} style={{ fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '5px' }}><CheckCircle2 size={13} color="#00e676" /> {k}</div>
                  ))}
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: '12px 0 7px' }}>Keywords it will target</div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {keywords.slice(0, 8).map((k: string) => <span key={k} style={{ fontSize: '10.5px', color: '#8B85FF', background: 'rgba(90,82,255,0.12)', border: '1px solid rgba(90,82,255,0.25)', borderRadius: '6px', padding: '3px 9px' }}>{k}</span>)}
                    {keywords.length === 0 && <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>—</span>}
                  </div>
                  {(headlines.length > 0 || descriptions.length > 0) && (
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '12px' }}>
                      Ad copy ready: <b style={{ color: '#fff' }}>{headlines.length}</b> headlines · <b style={{ color: '#fff' }}>{descriptions.length}</b> descriptions
                    </div>
                  )}
                </div>
              </div>

              {/* Audience is the longest field — give it the full width so it reads as a sentence. */}
              <div style={{ marginTop: '14px', padding: '13px 15px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid var(--border, var(--border-color))' }}>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Who this campaign targets</div>
                <div style={{ fontSize: '13.5px', color: '#fff', lineHeight: 1.6 }}>{spec.audience || form.audience}</div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
                <button onClick={copyStrategy} style={{ ...btnGhost, padding: '8px 12px', fontSize: '12px' }}>
                  {isCopied ? <Check size={13} color="#00e676" /> : <Copy size={13} />} {isCopied ? 'Copied' : 'Copy plan'}
                </button>
              </div>

              {!approved ? (
                <button onClick={approve} disabled={busy === 'approve'} style={{ width: '100%', marginTop: '12px', background: '#00e676', border: 'none', color: '#03121a', padding: '13px', borderRadius: '9px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <ShieldCheck size={16} /> {busy === 'approve' ? 'Approving…' : 'Approve & send to all steps'}
                </button>
              ) : (
                <div style={{ marginTop: '12px', padding: '11px 14px', background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: '9px', fontSize: '12.5px', color: '#00e676', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={15} /> Approved — passed to Meta, Google and Review below.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── 4. downstream steps ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '18px' }}>
        {/* Meta */}
        <Gated locked={!approved} why="Approve the strategy to set up Meta Ads">
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', gap: '8px' }}>
              <h3 style={{ ...sectionTitle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>Meta Ads <Pill status="MOCK" /></h3>
              <Pill status={metaSetup.launched ? 'Completed' : metaSetup.connected ? 'In Progress' : 'Pending'} />
            </div>
            <p style={{ ...sectionHint, marginBottom: '12px' }}>Auto-filled from your approved strategy.</p>
            <Row k="Account" v={metaSetup.connected ? <span style={{ color: '#00e676' }}>{metaSetup.account}</span>
              : <button onClick={() => adSetup('meta', 'connect')} style={{ ...btnGhost, padding: '5px 13px', fontSize: '11.5px' }}>Connect</button>} />
            <Row k="Campaign" v={campaign?.name || '—'} />
            <Row k="Objective" v={campaign?.objective || '—'} />
            <Row k="Audience" v="From approved strategy" />
            <Row k="Budget" v={split.meta ? money(split.meta.amount) : '—'} />
            <Row k="Placements" v={spec.placements || form.placement} stack />
            <button onClick={() => adSetup('meta', 'launch')} disabled={!metaSetup.connected || metaSetup.launched || busy === 'meta-launch'}
              style={{ ...btnPrimary, marginTop: '14px', background: metaSetup.launched ? 'rgba(0,230,118,0.15)' : !metaSetup.connected ? 'rgba(255,255,255,0.06)' : btnPrimary.background, color: metaSetup.launched ? '#00e676' : '#fff', cursor: metaSetup.connected && !metaSetup.launched ? 'pointer' : 'not-allowed' }}>
              <Rocket size={14} /> {metaSetup.launched ? 'Launched (mock)' : busy === 'meta-launch' ? 'Launching…' : 'Review & Launch'}
            </button>
          </div>
        </Gated>

        {/* Google */}
        <Gated locked={!approved} why="Approve the strategy to set up Google Ads">
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', gap: '8px' }}>
              <h3 style={{ ...sectionTitle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>Google Ads <Pill status="MOCK" /></h3>
              <Pill status={googleSetup.launched ? 'Completed' : googleSetup.connected ? 'In Progress' : 'Pending'} />
            </div>
            <p style={{ ...sectionHint, marginBottom: '12px' }}>Keywords and copy come straight from the strategy.</p>
            <Row k="Account" v={googleSetup.connected ? <span style={{ color: '#00e676' }}>{googleSetup.account}</span>
              : <button onClick={() => adSetup('google', 'connect')} style={{ ...btnGhost, padding: '5px 13px', fontSize: '11.5px' }}>Connect</button>} />
            <Row k="Type" v="Search Campaign" />
            <Row k="Keywords" v={`${keywords.length} from strategy`} />
            <Row k="Headlines" v={`${headlines.length} AI-written`} />
            <Row k="Descriptions" v={`${descriptions.length} AI-written`} />
            <Row k="Budget" v={split.google ? money(split.google.amount) : '—'} />
            <button onClick={() => adSetup('google', 'launch')} disabled={!googleSetup.connected || googleSetup.launched || busy === 'google-launch'}
              style={{ ...btnPrimary, marginTop: '14px', background: googleSetup.launched ? 'rgba(0,230,118,0.15)' : !googleSetup.connected ? 'rgba(255,255,255,0.06)' : btnPrimary.background, color: googleSetup.launched ? '#00e676' : '#fff', cursor: googleSetup.connected && !googleSetup.launched ? 'pointer' : 'not-allowed' }}>
              <Rocket size={14} /> {googleSetup.launched ? 'Launched (mock)' : busy === 'google-launch' ? 'Launching…' : 'Review & Launch'}
            </button>
          </div>
        </Gated>

        {/* Human review & publish */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <h3 style={{ ...sectionTitle, marginBottom: 0 }}>Human Review &amp; Publish</h3>
            <Pill status={published ? 'Published' : 'Pending'} />
          </div>
          <p style={{ ...sectionHint, marginBottom: '12px' }}>Nothing goes out until you check these off yourself.</p>
          {[
            { n: 'Strategy approved', d: campaign ? (approved ? 'Approved by you' : 'Waiting for your approval') : 'Not generated yet', ok: approved },
            { n: 'Ad creative ready', d: heroImage ? 'Image generated' : 'No image yet', ok: approved && !!heroImage },
            { n: 'Meta Ads', d: metaSetup.launched ? 'Launched (mock)' : metaSetup.connected ? 'Connected (mock)' : 'Not connected', ok: !!metaSetup.launched },
            { n: 'Google Ads', d: googleSetup.launched ? 'Launched (mock)' : googleSetup.connected ? 'Connected (mock)' : 'Not connected', ok: !!googleSetup.launched },
          ].map(r => (
            <div key={r.n} style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              {r.ok ? <CheckCircle2 size={16} color="#00e676" /> : <Clock size={16} color="var(--text-secondary)" />}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px' }}>{r.n}</div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>{r.d}</div>
              </div>
            </div>
          ))}
          <Row k="Total budget" v={money(spec.total_budget || form.budget)} />

          <div style={{ marginTop: '14px', padding: '12px 14px', background: 'rgba(255,174,0,0.05)', border: '1px solid rgba(255,174,0,0.22)', borderRadius: '9px' }}>
            <div style={{ fontSize: '12.5px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '4px' }}>
              <AlertTriangle size={14} color="#ffae00" /> Human review required
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Confirm the objective ({campaign?.objective || form.objective}), total budget ({money(spec.total_budget || form.budget)}) and the ad creative before publishing.
            </p>
          </div>

          <button onClick={publish} disabled={!canPublish || busy === 'publish'}
            style={{ width: '100%', marginTop: '12px', background: published ? 'rgba(0,230,118,0.15)' : canPublish ? '#00e676' : 'rgba(255,255,255,0.06)', border: 'none', color: published ? '#00e676' : canPublish ? '#03121a' : 'var(--text-muted)', padding: '13px', borderRadius: '9px', fontSize: '14px', fontWeight: 700, cursor: canPublish ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Rocket size={15} /> {published ? 'Published (demo)' : busy === 'publish' ? 'Publishing…' : 'Publish Campaign'}
          </button>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '8px' }}>
            {published ? 'Demo publish — nothing was sent to Meta or Google.'
              : canPublish ? 'Runs in demo mode — no real ad account is touched.'
              : 'Finish the steps above to enable publishing.'}
          </p>
        </div>
      </div>

      {/* ── 5. smart ad management (auto-kill / rotate) ── */}
      <div style={card}>
        <h3 style={{ ...sectionTitle }}>Smart Auto-Rotation &amp; Ad Management</h3>
        <p style={{ ...sectionHint, marginBottom: '16px' }}>Safety rules the optimizer applies once campaigns are live — so a bad ad gets killed before it burns budget.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
          {/* kill */}
          <div style={{ padding: '16px', background: 'rgba(255,174,0,0.04)', border: '1px solid rgba(255,174,0,0.18)', borderRadius: '11px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}><XCircle size={16} color="#ffae00" /> Auto-kill bad ads</span>
              <label className="toggle-switch"><input type="checkbox" checked={smart.killAds} onChange={e => setSmart(s => ({ ...s, killAds: e.target.checked }))} /><span className="slider" /></label>
            </div>
            {smart.killAds && (
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '130px' }}>
                  <span style={{ ...label, display: 'flex', alignItems: 'center', gap: '6px' }}><DollarSign size={12} color="#ffae00" /> Kill if CPA over (₹)</span>
                  <input type="number" style={input} value={smart.cpaThreshold} onChange={e => setSmart(s => ({ ...s, cpaThreshold: Number(e.target.value) }))} />
                </div>
                <div style={{ flex: 1, minWidth: '130px' }}>
                  <span style={{ ...label, display: 'flex', alignItems: 'center', gap: '6px' }}><BarChart3 size={12} color="#ffae00" /> Kill if frequency over</span>
                  <input type="number" step="0.1" style={input} value={smart.frequencyCap} onChange={e => setSmart(s => ({ ...s, frequencyCap: Number(e.target.value) }))} />
                </div>
              </div>
            )}
          </div>
          {/* rotate */}
          <div style={{ padding: '16px', background: 'rgba(90,82,255,0.04)', border: '1px solid rgba(90,82,255,0.18)', borderRadius: '11px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}><RefreshCw size={16} color="var(--primary)" /> Smart creative rotation</span>
              <label className="toggle-switch"><input type="checkbox" checked={smart.autoRotate} onChange={e => setSmart(s => ({ ...s, autoRotate: e.target.checked }))} /><span className="slider" /></label>
            </div>
            {smart.autoRotate && (
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '130px' }}>
                  <span style={label}>Rotate if skip rate over (%)</span>
                  <input type="number" style={input} value={smart.skipRateThreshold} onChange={e => setSmart(s => ({ ...s, skipRateThreshold: Number(e.target.value) }))} />
                </div>
                <div style={{ flex: 1, minWidth: '130px' }}>
                  <span style={label}>Refresh every (days)</span>
                  <input type="number" style={input} value={smart.refreshIntervalDays} onChange={e => setSmart(s => ({ ...s, refreshIntervalDays: Number(e.target.value) }))} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── mock notice ── */}
      <div style={{ ...card, padding: '13px 17px', display: 'flex', alignItems: 'center', gap: '11px', background: 'rgba(255,174,0,0.05)', border: '1px solid rgba(255,174,0,0.22)' }}>
        <AlertTriangle size={16} color="#ffae00" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          <b style={{ color: '#fff' }}>Meta &amp; Google are in mock mode.</b> Their API keys aren't set up yet, so connect, launch and publish are simulated end-to-end so you can test the whole flow — no ad account is touched and no money is spent.
        </span>
      </div>

      {/* ── recent activity ── */}
      <div style={card}>
        <h3 style={{ ...sectionTitle, display: 'flex', alignItems: 'center', gap: '9px' }}><Database size={16} color="var(--primary)" /> Recent Activity</h3>
        <p style={{ ...sectionHint, marginBottom: '12px' }}>What's happened in this session.</p>
        {activity.length === 0 ? (
          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>Nothing yet — generate a strategy to get started.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '10px' }}>
            {activity.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '9px', background: 'rgba(255,255,255,0.03)', borderRadius: '9px', padding: '11px 13px' }}>
                <CheckCircle2 size={14} color="#00e676" />
                <span style={{ fontSize: '12.5px', flex: 1 }}>{a.label}</span>
                <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{ago(a.at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 4000, maxWidth: '580px', background: 'rgba(20,22,30,0.97)', border: `1px solid ${toast.ok ? 'rgba(0,230,118,0.4)' : 'rgba(255,174,0,0.4)'}`, borderRadius: '12px', padding: '14px 18px', color: '#fff', fontSize: '13px', boxShadow: '0 12px 30px rgba(0,0,0,0.5)', display: 'flex', gap: '11px', alignItems: 'center' }}>
          {toast.ok ? <CheckCircle2 size={16} color="#00e676" /> : <AlertTriangle size={16} color="#ffae00" />} {toast.msg}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .toggle-switch { position: relative; display: inline-block; width: 38px; height: 21px; }
        .toggle-switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--border, #333); transition: .2s; border-radius: 34px; }
        .slider:before { position: absolute; content: ""; height: 15px; width: 15px; left: 3px; bottom: 3px; background-color: white; transition: .2s; border-radius: 50%; }
        input:checked + .slider { background-color: var(--primary); }
        input:checked + .slider:before { transform: translateX(17px); }
      `}} />
    </div>
  );
};
