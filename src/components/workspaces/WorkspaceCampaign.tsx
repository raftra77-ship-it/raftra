import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Copy, CheckCircle, Database, UploadCloud, Check, Download, FileUp, Image as ImageIcon, Zap, AlertTriangle, ShieldCheck, RefreshCw, XCircle, DollarSign, BarChart3, Clock, Sparkles, TrendingUp, AlertCircle, ArrowRight, Activity, Rocket, Bot, ShoppingCart, CheckCircle2, OctagonX, Video, Camera } from 'lucide-react';
import { GlowButton } from '../GlowButton';

export interface CampaignItem {
  id: string;
  platform: string;
  name: string;
  objective: string;
  budget: number;
  roas: number;
  status: 'active' | 'paused' | 'pending_review';
}

interface WorkspaceCampaignProps {
  workspaceId?: number | null;
  campaigns: CampaignItem[];
  creativeAssets?: any[];
  onOpenReview: (itemId: string) => void;
  onToggleStatus: (id: string) => void;
  onOpenCreativeStudio?: (seedPrompt: string) => void;
}

export const WorkspaceCampaign: React.FC<WorkspaceCampaignProps> = ({
  workspaceId,
  campaigns,
  creativeAssets = [],
  onOpenReview,
  onToggleStatus,
  onOpenCreativeStudio,
}) => {
  // ─── Real Meta connection + optimization state ───
  const API = '/api/connectors/meta';
  const authHeaders = (): Record<string, string> => { const t = localStorage.getItem('token'); return t ? { Authorization: `Bearer ${t}` } : {}; };
  const money = (v: any) => `₹${Number(v || 0).toLocaleString('en-IN')}`;

  const [metaStatus, setMetaStatus] = useState<any>(null);   // {configured, connected, name, ad_account_id}
  const [metaAccounts, setMetaAccounts] = useState<any[]>([]);
  const [pages, setPages] = useState<any[]>([]);
  const [pageId, setPageId] = useState('');
  const [creativeMeta, setCreativeMeta] = useState<Record<string, any>>({});  // id -> {asset_id?, image_url?, image_hash?, headline?}
  const [confirmDialog, setConfirmDialog] = useState<any>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  const flash = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 6000); };
  const metaConnected = !!metaStatus?.connected;
  const metaHasAccount = !!metaStatus?.ad_account_id;

  const integrations = [
    { platform: 'Meta Ads', connected: metaConnected, isMeta: true,
      accountName: metaConnected ? (metaHasAccount ? `act_${metaStatus.ad_account_id}` : (metaStatus?.name || 'Connected — pick account')) : (metaStatus?.configured ? 'Not connected' : 'Setup required (founder)') },
    { platform: 'Google Ads', connected: false, isMeta: false, accountName: 'Coming soon' },
  ];

  // Left Side State
  const [strategyParams, setStrategyParams] = useState({
    objective: 'Conversions',
    campaignFocus: 'Diwali Festive Sale',
    budget: 40000,
    audience: 'Gen-Z Tech Enthusiasts',
    funnel: 'Bottom of Funnel',
    geoTargetingLevel: 'State-Level',
    placement: 'Maharashtra, Delhi, Karnataka',
    schedule: '14 Days',
    tracking: 'utm_source=ai_agent'
  });

  // ─── Brand AI Auto-Suggest Presets ───
  const brandAutoPresets = [
    {
      id: 'festive-blast',
      title: 'Festive Conversion Blast',
      iconType: 'rocket',
      badge: 'High ROAS Focus',
      description: 'Scale festive sale with state-level BOF retargeting and 15s video hook rotation.',
      params: {
        campaignFocus: 'Diwali Festive Sale',
        objective: 'Conversions',
        budget: 65000,
        audience: 'Festive Shoppers & Tech Enthusiasts',
        funnel: 'Bottom of Funnel',
        geoTargetingLevel: 'State-Level',
        placement: 'Maharashtra, Delhi, Karnataka, Gujarat',
        schedule: '14 Days',
        tracking: 'utm_source=ai_agent_festive'
      }
    },
    {
      id: 'cart-recovery',
      title: 'Retargeting & Cart Recovery',
      iconType: 'cart',
      badge: 'High Conversion %',
      description: 'Capture high-intent abandoned carts with dynamic carousel ads & exit offers.',
      params: {
        campaignFocus: '7-Day Abandoned Cart Recovery',
        objective: 'Conversions',
        budget: 30000,
        audience: 'Added to Cart (Last 7 Days) - No Purchase',
        funnel: 'Bottom of Funnel',
        geoTargetingLevel: 'City-Level',
        placement: 'Metro Cities (Mumbai, Bangalore, Delhi NCR)',
        schedule: 'Ongoing / Evergreen',
        tracking: 'utm_source=ai_agent_retargeting'
      }
    },
    {
      id: 'lookalike-expansion',
      title: '1% Lookalike Brand Expansion',
      iconType: 'trend',
      badge: 'Scale Audience',
      description: 'Acquire new customers by targeting top 1% lookalikes of top 20% LTV buyers.',
      params: {
        campaignFocus: 'Lookalike Customer Acquisition',
        objective: 'Lead Generation',
        budget: 50000,
        audience: 'Top 1% LAL of Past Buyers + Interest in Premium Tech',
        funnel: 'Top of Funnel',
        geoTargetingLevel: 'Country-Level',
        placement: 'India (Tier 1 & Tier 2)',
        schedule: '30 Days',
        tracking: 'utm_source=ai_agent_lal'
      }
    }
  ];

  // ─── Daily AI Performance & Action Feed — populated from REAL Meta insights ───
  const [dailyActions, setDailyActions] = useState<any[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(false);
  
  const [generatedStrategy, setGeneratedStrategy] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Right Side State
  const [selectedAds, setSelectedAds] = useState<string[]>([]);
  const [uploadedCreatives, setUploadedCreatives] = useState<{ id: string; name: string; type: string }[]>([]);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [smartSettings, setSmartSettings] = useState({
    killAds: true,
    autoRotate: true,
    skipRateThreshold: 70,
    frequencyCap: 3.5,
    cpaThreshold: 3500,
    refreshIntervalDays: 4,
  });

  // Import campaign ref
  const importFileRef = useRef<HTMLInputElement>(null);
  // Upload creative ref
  const creativeFileRef = useRef<HTMLInputElement>(null);

  // ─────────────────────────────── real Meta data loaders ───────────────────────────────
  const SEV_STYLE: Record<string, any> = {
    good: { color: '#00e676', bgColor: 'rgba(0, 230, 118, 0.08)', borderColor: 'rgba(0, 230, 118, 0.3)', icon: CheckCircle2 },
    warn: { color: '#ffb74d', bgColor: 'rgba(255, 183, 77, 0.08)', borderColor: 'rgba(255, 183, 77, 0.3)', icon: AlertTriangle },
    critical: { color: '#ff5252', bgColor: 'rgba(255, 82, 82, 0.08)', borderColor: 'rgba(255, 82, 82, 0.3)', icon: OctagonX },
    neutral: { color: '#9c27b0', bgColor: 'rgba(156, 39, 176, 0.08)', borderColor: 'rgba(156, 39, 176, 0.3)', icon: Clock },
  };

  const loadMetaStatus = useCallback(async () => {
    if (!workspaceId) return;
    try { const r = await fetch(`${API}/${workspaceId}/status`, { headers: authHeaders() }); setMetaStatus(await r.json()); }
    catch { setMetaStatus({ configured: false, connected: false }); }
  }, [workspaceId]);

  const loadMetaAux = useCallback(async () => {
    if (!workspaceId || !metaConnected) return;
    try { const r = await fetch(`${API}/${workspaceId}/ad-accounts`, { headers: authHeaders() }); if (r.ok) setMetaAccounts((await r.json()).ad_accounts || []); } catch { /* ignore */ }
    try { const r = await fetch(`${API}/${workspaceId}/pages`, { headers: authHeaders() }); if (r.ok) { const p = (await r.json()).pages || []; setPages(p); if (p[0]) setPageId(prev => prev || p[0].id); } } catch { /* ignore */ }
  }, [workspaceId, metaConnected]);

  const loadRecommendations = useCallback(async () => {
    if (!workspaceId || !metaHasAccount) { setDailyActions([]); return; }
    setLoadingFeed(true);
    try {
      const r = await fetch(`${API}/${workspaceId}/recommendations?date_preset=last_7d&target_roas=2`, { headers: authHeaders() });
      if (r.ok) {
        const d = await r.json();
        setDailyActions((d.recommendations || []).map((rec: any, i: number) => {
          const s = SEV_STYLE[rec.severity] || SEV_STYLE.neutral;
          const ev = rec.evidence || {};
          const bits: string[] = [];
          if (ev.roas != null) bits.push(`ROAS: ${ev.roas}×`);
          if (ev.spend != null) bits.push(`Spend: ${money(ev.spend)}`);
          if (ev.ctr != null) bits.push(`CTR: ${ev.ctr}%`);
          if (ev.frequency != null) bits.push(`Freq: ${ev.frequency}×`);
          if (ev.purchases != null) bits.push(`Purchases: ${ev.purchases}`);
          return { id: `rec-${i}`, ...s, statusTag: rec.title, campaignName: rec.campaign_name,
                   metrics: bits.join('  |  '), recommendation: rec.detail,
                   actionText: rec.action?.label || 'No action needed', executed: false, _action: rec.action };
        }));
      } else setDailyActions([]);
    } catch { setDailyActions([]); }
    setLoadingFeed(false);
  }, [workspaceId, metaHasAccount]);

  useEffect(() => { loadMetaStatus(); }, [loadMetaStatus]);
  useEffect(() => { if (metaConnected) loadMetaAux(); }, [metaConnected, loadMetaAux]);
  useEffect(() => { if (metaHasAccount) loadRecommendations(); }, [metaHasAccount, loadRecommendations]);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('meta');
    if (p === 'connected') { flash('Meta connected.'); loadMetaStatus(); window.history.replaceState({}, '', window.location.pathname); }
    else if (p === 'error') { flash('Meta connection failed. Try again.', false); window.history.replaceState({}, '', window.location.pathname); }
  }, [loadMetaStatus]);

  const connectMeta = async () => {
    if (!workspaceId) return;
    try {
      const r = await fetch(`${API}/${workspaceId}/authorize`, { headers: authHeaders() });
      const d = await r.json();
      if (!r.ok) {
        // Almost always: the Meta app (META_APP_ID/SECRET) isn't set up on the server yet.
        setShowSetup(true);
        flash('Meta isn’t set up yet — a one-time Meta app setup is needed before you can connect.', false);
        return;
      }
      window.location.href = d.url;   // real OAuth redirect once configured
    } catch { flash('Could not start Meta connect.', false); }
  };

  const selectMetaAccount = async (id: string) => {
    if (!workspaceId) return;
    try {
      const r = await fetch(`${API}/${workspaceId}/account`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ ad_account_id: id }) });
      if (r.ok) { flash('Ad account selected.'); loadMetaStatus(); }
    } catch { flash('Could not select account.', false); }
  };

  const runMetaAction = async (a: any) => {
    if (!workspaceId || !a) return;
    setConfirmBusy(true);
    try {
      const r = a.kind === 'pause'
        ? await fetch(`${API}/${workspaceId}/campaign/${a.campaign_id}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ status: 'PAUSED' }) })
        : await fetch(`${API}/${workspaceId}/campaign/${a.campaign_id}/budget`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ daily_budget: a.new_daily_budget }) });
      if (r.ok) { flash(a.kind === 'pause' ? 'Campaign paused in Meta.' : 'Budget updated in Meta.'); loadRecommendations(); }
      else flash((await r.json()).detail || 'Action failed.', false);
    } catch { flash('Action failed.', false); }
    setConfirmBusy(false); setConfirmDialog(null);
  };

  // Clearly-labeled EXAMPLE feed so the optimization logic can be seen before Meta is live.
  const showSampleRecs = () => {
    setDailyActions([
      { id: 's1', ...SEV_STYLE.good, sample: true, statusTag: 'Working well — scale this up', campaignName: 'Diwali Festive Sale', metrics: 'ROAS: 4.2×  |  Spend: ₹35,000  |  CTR: 2.1%', recommendation: 'ROAS 4.2× is well above your 2.0× target. Raising daily budget +25% presses the advantage.', actionText: 'Scale budget +25%', executed: false, _action: { kind: 'scale_budget' } },
      { id: 's2', ...SEV_STYLE.good, sample: true, statusTag: 'Keep this strategy going', campaignName: 'Retargeting — Cart', metrics: 'ROAS: 2.3×  |  Spend: ₹18,000  |  CTR: 1.6%', recommendation: 'ROAS 2.3× is at/above target. No change needed — leave it running.', actionText: 'No action needed', executed: false, _action: { kind: 'none' } },
      { id: 's3', ...SEV_STYLE.warn, sample: true, statusTag: 'Switch this strategy', campaignName: 'Prospecting Broad', metrics: 'ROAS: 1.3×  |  Spend: ₹22,000  |  Freq: 4.5×', recommendation: 'ROAS 1.3× is below target and frequency is 4.5× (fatigue). Refresh the creative or broaden the audience to recover ROAS.', actionText: 'Trim budget -30%', executed: false, _action: { kind: 'scale_budget' } },
      { id: 's4', ...SEV_STYLE.critical, sample: true, statusTag: 'Kill this — wasting spend', campaignName: 'Dead Weight TOF', metrics: 'ROAS: 0.4×  |  Spend: ₹15,000  |  Purchases: 2', recommendation: 'ROAS 0.4× after ₹15,000 with just 2 purchases. Pausing stops the bleed and frees budget for the winners.', actionText: 'Kill ad (pause)', executed: false, _action: { kind: 'pause' } },
    ]);
    flash('Showing EXAMPLE recommendations. Connect Meta to see your real campaigns.');
  };

  const handleApplyPreset = (preset: typeof brandAutoPresets[0]) => {
    setStrategyParams(preset.params);
    setIsGenerating(true);
    setTimeout(() => {
      setGeneratedStrategy(`### AI Auto-Suggested Strategy: ${preset.title}\n\n**Campaign Focus**: ${preset.params.campaignFocus}\n**Objective**: ${preset.params.objective}\n**Total Budget**: ₹${preset.params.budget.toLocaleString()}\n**Target CPA**: ₹1,000\n\n**Audience Blueprint**:\n${preset.params.audience} targeting high-intent segments across ${preset.params.placement} (Granularity: ${preset.params.geoTargetingLevel}) at ${preset.params.funnel}.\n\n**Creative Rotation Logic**:\n- Rotate creatives every ${smartSettings.refreshIntervalDays} days.\n- **Auto-Kill**: CPA > ₹${smartSettings.cpaThreshold} or Frequency > ${smartSettings.frequencyCap}\n- **Skip Rate Threshold**: ${smartSettings.skipRateThreshold}%\n\n**Tracking Confirmed**:\n${preset.params.tracking}`);
      setIsGenerating(false);
    }, 1000);
  };

  const handleExecuteDailyAction = (actionId: string) => {
    const act = dailyActions.find(a => a.id === actionId);
    if (act?.sample) { flash('This is example data — connect Meta to act on your real campaigns.', false); return; }
    const a = act?._action;
    if (!a || a.kind === 'none') return;   // advisory item, nothing to execute
    if (a.kind === 'pause') {
      setConfirmDialog({ title: 'Kill this campaign?', danger: true, confirmLabel: 'Pause in Meta',
        body: `This pauses "${act.campaignName}" in your Meta account so it stops spending. You can re-activate it in Meta any time.`,
        run: () => runMetaAction(a) });
    } else if (a.kind === 'scale_budget') {
      setConfirmDialog({ title: 'Update daily budget?', confirmLabel: 'Apply in Meta',
        body: `This sets "${act.campaignName}" daily budget to ${money(a.new_daily_budget)} in your Meta account.`,
        run: () => runMetaAction(a) });
    }
  };

  // Real generation: call the AI campaign planner, then poll for the saved campaign
  // (which now includes an auto-generated image ad).
  const handleGenerate = async () => {
    if (!workspaceId) { flash('No workspace selected.', false); return; }
    setIsGenerating(true);
    setGeneratedStrategy('');
    setGeneratedImage(null);
    const listUrl = `/api/workspaces/${workspaceId}/campaigns`;
    let beforeMax = 0;
    try { const b = await fetch(listUrl, { headers: authHeaders() }).then(r => r.json()); if (Array.isArray(b)) beforeMax = b.reduce((m: number, c: any) => Math.max(m, c.id), 0); } catch { /* ignore */ }
    const prompt = `Create an ad campaign. Theme/focus: ${strategyParams.campaignFocus}. Objective: ${strategyParams.objective}. Budget: ₹${strategyParams.budget}. Audience: ${strategyParams.audience}. Funnel: ${strategyParams.funnel}. Geo: ${strategyParams.placement} (${strategyParams.geoTargetingLevel}). Schedule: ${strategyParams.schedule}.`;
    try {
      await fetch(`/api/agents/${workspaceId}/campaign`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ prompt, model: 'gemini-2.5-flash' }) });
    } catch { setIsGenerating(false); flash('Failed to start generation.', false); return; }
    let tries = 0;
    const poll = setInterval(async () => {
      tries += 1;
      try {
        const now = await fetch(listUrl, { headers: authHeaders() }).then(r => r.json());
        const fresh = Array.isArray(now) ? now.filter((c: any) => c.id > beforeMax).sort((a: any, b: any) => b.id - a.id)[0] : null;
        if (fresh) {
          const m = fresh.metrics || {};
          setGeneratedStrategy(`### ${fresh.name || 'AI Campaign'}\n\n**Objective:** ${fresh.objective || '-'}\n**Daily budget:** ₹${fresh.budget ?? '-'}\n**Audience:** ${m.audience || strategyParams.audience}\n**Placements:** ${m.placements || strategyParams.placement}\n**Status:** ${fresh.status}`);
          setGeneratedImage(m.image_url || null);
          // Propagate to the whole Publisher Gateway: auto-attach the AI-generated
          // image as the creative, and sync objective/budget so Human Review and
          // Publish-to-Meta act on THIS generated strategy.
          if (m.image_url) {
            const gid = `ai-${fresh.id}`;
            setSelectedAds([gid]);
            setCreativeMeta(prev => ({ ...prev, [gid]: { image_url: m.image_url, headline: fresh.name || strategyParams.campaignFocus, aiGenerated: true } }));
          }
          if (fresh.objective) setStrategyParams(p => ({ ...p, objective: fresh.objective }));
          clearInterval(poll); setIsGenerating(false);
          flash('Strategy + image ad generated and attached to the Publisher Gateway.');
        } else if (tries >= 15) { clearInterval(poll); setIsGenerating(false); flash('Generation is taking longer than expected — check the agent logs.', false); }
      } catch { /* keep polling */ }
    }, 3000);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedStrategy);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handlePublish = async () => {
    if (!workspaceId) return;
    if (!metaHasAccount) { flash('Connect Meta and pick an ad account first.', false); return; }
    if (!pageId) { flash('Select a Facebook Page for the ad (in Publisher Gateway).', false); return; }
    if (selectedAds.length === 0) { flash('Attach a creative — Ad Library or upload.', false); return; }
    let cm = creativeMeta[selectedAds[0]] || {};
    if (!cm.image_hash && !cm.asset_id && !cm.file && !(cm.image_url && !cm.local)) { flash('Attach a creative first.', false); return; }
    setPublishing(true);
    // A locally-attached file needs to be pushed to Meta now (Meta is connected at this point).
    if (!cm.image_hash && !cm.asset_id && cm.file) {
      try {
        const fd = new FormData(); fd.append('file', cm.file);
        const r = await fetch(`${API}/${workspaceId}/upload-image`, { method: 'POST', headers: authHeaders(), body: fd });
        const d = await r.json();
        if (r.ok) cm = { ...cm, image_hash: d.image_hash };
        else { flash(d.detail || 'Could not upload creative to Meta.', false); setPublishing(false); return; }
      } catch { flash('Could not upload creative to Meta.', false); setPublishing(false); return; }
    }
    const objMap: Record<string, string> = { 'Conversions': 'conversions', 'Lead Generation': 'leads', 'Brand Awareness': 'awareness', 'Traffic': 'traffic', 'Engagement': 'engagement' };
    const body: any = {
      name: strategyParams.campaignFocus || 'Raftra Campaign',
      objective: objMap[strategyParams.objective] || 'traffic',
      daily_budget: Math.max(1, Math.round((strategyParams.budget || 15000) / 30)),
      page_id: pageId,
      link_url: (strategyParams.tracking || '').startsWith('http') ? strategyParams.tracking : '',
      country: 'IN', cta: 'LEARN_MORE',
    };
    if (cm.asset_id) body.asset_id = cm.asset_id;
    if (cm.image_hash) { body.image_hash = cm.image_hash; body.headline = cm.headline || strategyParams.campaignFocus; }
    // Only pass a hosted image_url (e.g. a library asset) — never a local blob: preview URL.
    if (cm.image_url && !cm.asset_id && !cm.image_hash && !cm.local) { body.image_url = cm.image_url; body.headline = cm.headline || strategyParams.campaignFocus; }
    try {
      const r = await fetch(`${API}/${workspaceId}/launch`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(body) });
      const d = await r.json();
      if (r.ok) { flash('Campaign + ad created in Meta (PAUSED). Review & activate it in Meta to start spending.'); loadRecommendations(); }
      else flash(d.detail || 'Publish failed.', false);
    } catch { flash('Publish failed.', false); }
    setPublishing(false);
  };

  // ─── Export Campaign as JSON ───
  const handleExportCampaign = () => {
    const campaignData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      strategyParams,
      generatedStrategy,
      smartSettings,
      selectedAds,
      uploadedCreatives,
    };
    const blob = new Blob([JSON.stringify(campaignData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campaign-${strategyParams.campaignFocus.replace(/\s+/g, '_').toLowerCase()}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Import Campaign from JSON ───
  const handleImportCampaign = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.strategyParams) setStrategyParams(data.strategyParams);
        if (data.generatedStrategy) setGeneratedStrategy(data.generatedStrategy);
        if (data.smartSettings) setSmartSettings(prev => ({ ...prev, ...data.smartSettings }));
        if (data.selectedAds) setSelectedAds(data.selectedAds);
        if (data.uploadedCreatives) setUploadedCreatives(data.uploadedCreatives);
      } catch {
        alert('Invalid campaign JSON file. Please upload a valid exported campaign.');
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  // ─── Upload Creative from Device ───
  const handleCreativeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      const id = `upload-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      let type = 'image';
      if (['mp4', 'mov', 'webm', 'avi'].includes(ext)) type = 'video';
      else if (['gif'].includes(ext)) type = 'gif';
      setUploadedCreatives(prev => [...prev, { id, name: file.name, type }]);
      setSelectedAds(prev => [...prev, id]);
      // Attach locally right away — this works without Meta. We keep the File so it can be
      // pushed to Meta at publish time; if Meta is already connected, upload now for the hash.
      const preview = URL.createObjectURL(file);
      setCreativeMeta(prev => ({ ...prev, [id]: { file, image_url: preview, headline: file.name, local: true } }));
      if (metaHasAccount) {
        try {
          const fd = new FormData(); fd.append('file', file);
          const r = await fetch(`${API}/${workspaceId}/upload-image`, { method: 'POST', headers: authHeaders(), body: fd });
          const d = await r.json();
          if (r.ok) setCreativeMeta(prev => ({ ...prev, [id]: { ...(prev[id] || {}), image_hash: d.image_hash, local: false } }));
        } catch { /* stays local; uploaded at publish */ }
      }
    }
    flash('Creative attached.');
    e.target.value = '';
  };

  // Shared input style
  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
      {/* Header with Import / Export actions */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-heading)', marginBottom: '8px', color: '#fff' }}>Campaign Manager</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Ideate seasonal campaigns with AI, configure geo-targets, and deploy with auto-fatigue tracking.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          {/* Hidden file inputs */}
          <input type="file" ref={importFileRef} accept=".json" style={{ display: 'none' }} onChange={handleImportCampaign} />
          
          <button
            onClick={() => importFileRef.current?.click()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border)', borderRadius: '8px', color: '#fff', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s ease' }}
            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(90,82,255,0.2)'; e.currentTarget.style.borderColor = 'var(--primary)'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            <FileUp size={15} /> Import Campaign
          </button>
          <button
            onClick={handleExportCampaign}
            disabled={!generatedStrategy && !strategyParams.campaignFocus}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: generatedStrategy ? 'rgba(0,230,118,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${generatedStrategy ? 'rgba(0,230,118,0.4)' : 'var(--border)'}`, borderRadius: '8px', color: generatedStrategy ? '#00e676' : 'var(--text-muted)', fontSize: '13px', cursor: generatedStrategy ? 'pointer' : 'not-allowed', transition: 'all 0.2s ease' }}
          >
            <Download size={15} /> Export Campaign
          </button>
        </div>
      </div>

      {/* ─── DAILY PERFORMANCE & AI ACTION FEED ─── */}
      <div style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(90, 82, 255, 0.15)', border: '1px solid rgba(90, 82, 255, 0.3)' }}>
              <Activity size={18} color="var(--primary)" />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Daily Performance & AI Action Feed
                <span style={{ fontSize: '11px', padding: '2px 8px', background: 'rgba(0, 230, 118, 0.15)', color: '#00e676', borderRadius: '12px', border: '1px solid rgba(0,230,118,0.3)', fontFamily: 'var(--font-mono)' }}>Autonomous Monitoring Active</span>
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Autonomous performance optimization and real-time campaign recommendations.</p>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
          {dailyActions.some((a: any) => a.sample) && (
            <div style={{ gridColumn: '1 / -1', padding: '8px 12px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', color: '#ffb74d', background: 'rgba(255,183,77,0.10)', border: '1px solid rgba(255,183,77,0.3)', borderRadius: '8px' }}>
              EXAMPLE DATA — this is how recommendations will look. Connect Meta to see your real campaigns.
            </div>
          )}
          {!metaHasAccount && !dailyActions.some((a: any) => a.sample) && (
            <div style={{ gridColumn: '1 / -1', padding: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border)', borderRadius: '10px' }}>
              <div style={{ marginBottom: '12px' }}>Connect Meta and select an ad account (Publisher Gateway →) to see live recommendations — what to scale, switch, or kill — from your real ad performance.</div>
              <button onClick={showSampleRecs} style={{ fontSize: '12px', fontWeight: 600, background: 'rgba(90,82,255,0.15)', border: '1px solid var(--primary)', color: '#fff', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>Preview example recommendations</button>
            </div>
          )}
          {metaHasAccount && loadingFeed && (
            <div style={{ gridColumn: '1 / -1', padding: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>Analyzing your Meta performance…</div>
          )}
          {metaHasAccount && !loadingFeed && dailyActions.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>No campaigns with delivery in the last 7 days yet — launch one, or check back once ads are running.</div>
          )}
          {dailyActions.map((action) => (
            <div 
              key={action.id} 
              style={{ 
                padding: '14px', 
                background: action.bgColor, 
                border: `1px solid ${action.borderColor}`, 
                borderRadius: '10px', 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'space-between', 
                gap: '10px',
                opacity: action.executed ? 0.6 : 1,
                transition: 'all 0.2s ease'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: action.color, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <action.icon size={14} color={action.color} />
                    {action.statusTag}
                  </span>
                  {action.executed && (
                    <span style={{ fontSize: '10px', padding: '2px 6px', background: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px' }}>Executed</span>
                  )}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginBottom: '4px' }}>{action.campaignName}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginBottom: '8px' }}>{action.metrics}</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)', lineHeight: '1.4' }}>{action.recommendation}</div>
              </div>

              <button
                onClick={() => handleExecuteDailyAction(action.id)}
                disabled={action.executed}
                style={{
                  padding: '8px 12px',
                  background: action.executed ? 'rgba(255,255,255,0.05)' : action.color,
                  color: action.executed ? 'var(--text-muted)' : '#000',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: action.executed ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
              >
                {action.executed ? 'Applied to Campaign' : <>{action.actionText} <ArrowRight size={14} /></>}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px', flex: 1, overflow: 'hidden' }}>
        
        {/* LEFT PANE: Campaign Strategist */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflowY: 'auto' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', background: 'rgba(90, 82, 255, 0.03)' }}>
            <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
              <Zap size={18} color="var(--primary)" /> AI Ideation & Strategist
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Choose a brand auto-preset or describe a custom campaign brief — the AI will generate a full strategy and creative rotation plan.</p>
          </div>
          
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Brand AI Auto-Suggest Section */}
            <div style={{ background: 'rgba(90, 82, 255, 0.05)', border: '1px solid rgba(90, 82, 255, 0.2)', borderRadius: '10px', padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={14} color="var(--primary)" /> Brand AI Auto-Suggested Campaigns
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Based on profile.json</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {brandAutoPresets.map((preset) => {
                  const PresetIcon = preset.iconType === 'rocket' ? Rocket : preset.iconType === 'cart' ? ShoppingCart : TrendingUp;
                  return (
                    <div 
                      key={preset.id}
                      onClick={() => handleApplyPreset(preset)}
                      style={{ 
                        padding: '10px 12px', 
                        background: 'rgba(255,255,255,0.03)', 
                        border: '1px solid var(--border)', 
                        borderRadius: '8px', 
                        cursor: 'pointer', 
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'rgba(90,82,255,0.1)'; }}
                      onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <PresetIcon size={14} color="var(--primary)" />
                          {preset.title}
                          <span style={{ fontSize: '10px', padding: '2px 6px', background: 'rgba(90, 82, 255, 0.2)', color: '#fff', borderRadius: '4px' }}>{preset.badge}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{preset.description}</div>
                      </div>
                      <button style={{ padding: '4px 10px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                        Use AI Preset
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="form-group">
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Campaign Idea / Theme (Season or Product)</label>
              <input 
                type="text" 
                value={strategyParams.campaignFocus} 
                onChange={(e) => setStrategyParams(p => ({ ...p, campaignFocus: e.target.value }))} 
                placeholder="e.g. Summer Collection, Black Friday"
                style={inputStyle} 
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Objective</label>
                <select 
                  value={strategyParams.objective} 
                  onChange={(e) => setStrategyParams(p => ({ ...p, objective: e.target.value }))} 
                  style={inputStyle}
                >
                  <option value="Conversions" style={{ color: '#000' }}>Conversions</option>
                  <option value="Lead Generation" style={{ color: '#000' }}>Lead Generation</option>
                  <option value="Brand Awareness" style={{ color: '#000' }}>Brand Awareness</option>
                </select>
              </div>
              <div className="form-group">
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Budget (₹)</label>
                <input 
                  type="number" 
                  value={strategyParams.budget} 
                  onChange={(e) => setStrategyParams(p => ({ ...p, budget: Number(e.target.value) }))} 
                  style={inputStyle} 
                />
              </div>
            </div>

            <div className="form-group">
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Audience Targeting Base</label>
              <textarea 
                value={strategyParams.audience} 
                onChange={(e) => setStrategyParams(p => ({ ...p, audience: e.target.value }))} 
                rows={2} 
                style={{ ...inputStyle, resize: 'vertical' }} 
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
              <div className="form-group">
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Geo Granularity</label>
                <select 
                  value={strategyParams.geoTargetingLevel} 
                  onChange={(e) => setStrategyParams(p => ({ ...p, geoTargetingLevel: e.target.value }))} 
                  style={inputStyle}
                >
                  <option value="Pincode-Level" style={{ color: '#000' }}>Pincode-Level</option>
                  <option value="City-Level" style={{ color: '#000' }}>City-Level</option>
                  <option value="State-Level" style={{ color: '#000' }}>State-Level</option>
                  <option value="Country-Level" style={{ color: '#000' }}>Country-Level</option>
                </select>
              </div>
              <div className="form-group">
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Placements / Geo Focus</label>
                <input 
                  type="text" 
                  value={strategyParams.placement} 
                  onChange={(e) => setStrategyParams(p => ({ ...p, placement: e.target.value }))} 
                  style={inputStyle} 
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Funnel Stage</label>
                <select 
                  value={strategyParams.funnel} 
                  onChange={(e) => setStrategyParams(p => ({ ...p, funnel: e.target.value }))} 
                  style={inputStyle}
                >
                  <option value="Top of Funnel" style={{ color: '#000' }}>TOF</option>
                  <option value="Middle of Funnel" style={{ color: '#000' }}>MOF</option>
                  <option value="Bottom of Funnel" style={{ color: '#000' }}>BOF</option>
                </select>
              </div>
              <div className="form-group">
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Schedule</label>
                <input 
                  type="text" 
                  value={strategyParams.schedule} 
                  onChange={(e) => setStrategyParams(p => ({ ...p, schedule: e.target.value }))} 
                  style={inputStyle} 
                />
              </div>
              <div className="form-group">
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Tracking (UTM)</label>
                <input 
                  type="text" 
                  value={strategyParams.tracking} 
                  onChange={(e) => setStrategyParams(p => ({ ...p, tracking: e.target.value }))} 
                  style={inputStyle} 
                />
              </div>
            </div>

            <GlowButton 
              variant="glow" 
              onClick={handleGenerate}
              disabled={isGenerating}
              style={{ marginTop: '8px', padding: '12px', width: '100%', fontWeight: 'bold' }}
            >
              {isGenerating ? 'Generating Strategy...' : 'Generate Campaign Strategy'}
            </GlowButton>

            {generatedStrategy && (
              <div style={{ marginTop: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '6px' }}>
                  <button 
                    onClick={handleCopy}
                    style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
                  >
                    {isCopied ? <Check size={14} color="var(--success)" /> : <Copy size={14} />} 
                    {isCopied ? 'Copied!' : 'Copy'}
                  </button>
                  <button 
                    onClick={handleExportCampaign}
                    style={{ background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.3)', color: '#00e676', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
                  >
                    <Download size={14} /> Export
                  </button>
                </div>
                <h4 style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px', fontFamily: 'var(--font-mono)' }}>OUTPUT STRATEGY</h4>
                <div style={{ fontSize: '13px', color: '#fff', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                  {generatedStrategy}
                </div>

                {/* Auto-generated image ad from the strategy */}
                {generatedImage && (
                  <div style={{ marginTop: '16px' }}>
                    <h4 style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', fontFamily: 'var(--font-mono)' }}>GENERATED IMAGE AD</h4>
                    <img src={generatedImage} alt="AI-generated ad creative" style={{ width: '100%', maxHeight: '280px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border)' }} />
                    <button
                      onClick={() => onOpenCreativeStudio && onOpenCreativeStudio(`${strategyParams.campaignFocus}. ${strategyParams.objective} ad creative for ${strategyParams.audience}.`)}
                      style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'rgba(90,82,255,0.2)', border: '1px solid var(--primary)', borderRadius: '8px', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      <ImageIcon size={14} /> Want more? Generate in Creative Studio
                    </button>
                  </div>
                )}

                {/* Next-step cue so the strategy isn't a dead end */}
                <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px dashed var(--border)', fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ArrowRight size={14} color="var(--primary)" />
                  <span>Your AI creative is already attached in the <b style={{ color: '#fff' }}>Publisher Gateway</b> → just <b style={{ color: '#fff' }}>Publish to Meta</b> (or swap it via Ad Library / Upload / "Generate more").</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANE: Publisher Gateway */}
        <div style={{ flex: 1, background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', background: 'rgba(0, 230, 118, 0.03)' }}>
            <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
              <ShieldCheck size={18} color="var(--success)" /> Publisher Gateway
            </h3>
          </div>
          
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* OAuth Statuses */}
            <div>
              <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px', fontFamily: 'var(--font-mono)' }}>OAUTH CONNECTED PLATFORMS</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {integrations.map((integration, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span className={integration.connected ? "badge-pulse success" : ""} style={{ width: '8px', height: '8px', backgroundColor: integration.connected ? 'var(--success)' : 'var(--text-muted)' }} />
                      <span style={{ fontSize: '14px', fontWeight: 500, color: '#fff' }}>{integration.platform}</span>
                    </div>
                    {integration.isMeta && !integration.connected ? (
                      <button onClick={connectMeta} style={{ fontSize: '12px', fontWeight: 600, background: 'var(--primary)', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer' }}>Connect Meta</button>
                    ) : (
                      <span style={{ fontSize: '12px', color: integration.connected ? 'var(--text-secondary)' : 'var(--warning)' }}>
                        {integration.accountName}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* One-time Meta app setup note (shown when connect can't proceed) */}
              {showSetup && !metaConnected && (
                <div style={{ marginTop: '10px', padding: '14px', background: 'rgba(255,174,0,0.06)', border: '1px solid rgba(255,174,0,0.25)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#fff', fontWeight: 600, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={14} color="var(--warning)" /> One-time Meta app setup needed
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    Meta’s OAuth requires a registered Meta app — it can’t be faked. The founder adds
                    <code style={{ color: '#fff' }}> META_APP_ID</code> and <code style={{ color: '#fff' }}> META_APP_SECRET</code> once
                    (Marketing API app at developers.facebook.com), then restarts the server. Full steps are in
                    <b> docs/META_ADS_SETUP.md</b>. After that, <b>Connect Meta</b> opens the real Business-Manager login and
                    everything below goes live.
                  </p>
                </div>
              )}

              {/* Meta account picker (after connect, before an account is chosen) */}
              {metaConnected && !metaHasAccount && (
                <div style={{ marginTop: '10px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>SELECT AD ACCOUNT</div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {metaAccounts.length === 0 && <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>No ad accounts found on this Meta user.</span>}
                    {metaAccounts.map(a => (
                      <button key={a.account_id} onClick={() => selectMetaAccount(a.account_id)} style={{ fontSize: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: '#fff', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>
                        {a.name} <span style={{ color: 'var(--text-secondary)' }}>({a.currency})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Facebook Page picker (required to run an ad) */}
              {metaHasAccount && (
                <div style={{ marginTop: '10px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>FACEBOOK PAGE (REQUIRED FOR ADS)</div>
                  <select value={pageId} onChange={(e) => setPageId(e.target.value)} style={{ ...inputStyle, padding: '8px 10px' }}>
                    <option value="">— select page —</option>
                    {pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* Creative Publisher Section */}
            <div>
              <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px', fontFamily: 'var(--font-mono)' }}>CREATIVE ASSETS</h4>
              <div style={{ padding: '16px', background: 'rgba(90,82,255,0.05)', border: '1px dashed var(--primary)', borderRadius: '8px' }}>
                {/* Hidden file input for creative uploads */}
                <input 
                  type="file" 
                  ref={creativeFileRef} 
                  accept="image/*,video/*,.gif" 
                  multiple 
                  style={{ display: 'none' }} 
                  onChange={handleCreativeUpload} 
                />
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <button onClick={() => setIsLibraryOpen(true)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', background: 'rgba(90,82,255,0.2)', border: '1px solid var(--primary)', color: '#fff', padding: '10px', borderRadius: '6px', cursor: 'pointer' }}>
                    <Database size={16} /> Ad Library
                  </button>
                  <button onClick={() => creativeFileRef.current?.click()} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', background: 'rgba(255,255,255,0.1)', border: '1px solid var(--border)', color: '#fff', padding: '10px', borderRadius: '6px', cursor: 'pointer' }}>
                    <UploadCloud size={16} /> Upload Creative
                  </button>
                </div>
                
                {selectedAds.length === 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', padding: '10px 0' }}>
                    <ImageIcon size={24} style={{ opacity: 0.2, margin: '0 auto 8px' }} />
                    No creatives attached for publishing.
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {selectedAds.map((ad, i) => {
                      const uploaded = uploadedCreatives.find(c => c.id === ad);
                      const cm = creativeMeta[ad] || {};
                      return (
                        <div key={i} style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
                          {cm.image_url ? (
                            <><img src={cm.image_url} alt="creative" style={{ width: 30, height: 30, borderRadius: 4, objectFit: 'cover' }} /> {cm.aiGenerated ? 'AI Generated' : (cm.headline || 'Creative')}</>
                          ) : uploaded ? (
                            <>{uploaded.type === 'video' ? <Video size={14} color="var(--primary)" /> : <Camera size={14} color="var(--primary)" />} {uploaded.name}</>
                          ) : (
                            <><Camera size={14} color="var(--primary)" /> Asset #{ad}</>
                          )}
                          <span onClick={() => { setSelectedAds(prev => prev.filter(x => x !== ad)); setUploadedCreatives(prev => prev.filter(c => c.id !== ad)); }} style={{ cursor: 'pointer', color: 'var(--warning)' }}>✕</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Human Review Gate */}
            <div>
              <div style={{ padding: '20px', background: 'rgba(255, 174, 0, 0.05)', border: '1px solid rgba(255, 174, 0, 0.2)', borderRadius: '8px', marginBottom: '16px' }}>
                <h4 style={{ fontSize: '14px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
                  <AlertTriangle size={16} color="var(--warning)" /> Human Review Required
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Please confirm the objective ({strategyParams.objective}), total budget (₹{strategyParams.budget.toLocaleString()}), and attached creatives before executing the deployment.
                </p>
                <button
                  onClick={handlePublish}
                  disabled={selectedAds.length === 0 || publishing}
                  style={{
                    background: selectedAds.length > 0 && !publishing ? 'var(--success)' : 'rgba(255,255,255,0.1)',
                    color: selectedAds.length > 0 && !publishing ? '#fff' : 'var(--text-muted)',
                    border: 'none',
                    padding: '14px',
                    borderRadius: '8px',
                    fontSize: '15px',
                    fontWeight: 'bold',
                    cursor: selectedAds.length > 0 && !publishing ? 'pointer' : 'not-allowed',
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <CheckCircle size={18} /> {publishing ? 'Publishing to Meta…' : 'Publish to Meta (Paused)'}
                </button>
              </div>
            </div>

            {/* Smart Ad Management Logic — Enhanced */}
            <div>
              <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px', fontFamily: 'var(--font-mono)' }}>SMART AUTO-ROTATION & AD MANAGEMENT</h4>
              <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* Toggle: Auto-Kill Bad Ads */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <XCircle size={16} color="var(--warning)" />
                    <span style={{ fontSize: '13px', color: '#fff' }}>Auto-Kill Bad Ads</span>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={smartSettings.killAds} onChange={(e) => setSmartSettings(s => ({...s, killAds: e.target.checked}))} />
                    <span className="slider"></span>
                  </label>
                </div>

                {/* Kill Ads Params - shown when killAds is ON */}
                {smartSettings.killAds && (
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', padding: '12px', background: 'rgba(255,174,0,0.05)', borderRadius: '6px', border: '1px solid rgba(255,174,0,0.15)' }}>
                    {/* CPA Threshold */}
                    <div style={{ flex: 1, minWidth: '140px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <DollarSign size={13} color="var(--warning)" />
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Kill if CPA exceeds</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                        <span style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.1)', fontSize: '12px', color: 'var(--text-secondary)' }}>₹</span>
                        <input 
                          type="number" 
                          value={smartSettings.cpaThreshold} 
                          onChange={(e) => setSmartSettings(s => ({...s, cpaThreshold: Number(e.target.value)}))}
                          style={{ width: '60px', padding: '4px 8px', background: 'transparent', border: 'none', color: '#fff', outline: 'none', textAlign: 'center' }} 
                        />
                      </div>
                    </div>
                    {/* Frequency Cap */}
                    <div style={{ flex: 1, minWidth: '140px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <BarChart3 size={13} color="var(--warning)" />
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Kill if Frequency exceeds</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                        <input 
                          type="number" 
                          step="0.1"
                          value={smartSettings.frequencyCap} 
                          onChange={(e) => setSmartSettings(s => ({...s, frequencyCap: Number(e.target.value)}))}
                          style={{ width: '60px', padding: '4px 8px', background: 'transparent', border: 'none', color: '#fff', outline: 'none', textAlign: 'center' }} 
                        />
                        <span style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.1)', fontSize: '12px', color: 'var(--text-secondary)' }}>×</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Toggle: Smart Rotate */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <RefreshCw size={16} color="var(--primary)" />
                    <span style={{ fontSize: '13px', color: '#fff' }}>Smart Auto-Rotate Creatives</span>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={smartSettings.autoRotate} onChange={(e) => setSmartSettings(s => ({...s, autoRotate: e.target.checked}))} />
                    <span className="slider"></span>
                  </label>
                </div>

                {/* Rotate Params - shown when autoRotate is ON */}
                {smartSettings.autoRotate && (
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', padding: '12px', background: 'rgba(90,82,255,0.05)', borderRadius: '6px', border: '1px solid rgba(90,82,255,0.15)' }}>
                    {/* Skip Rate */}
                    <div style={{ flex: 1, minWidth: '140px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <BarChart3 size={13} color="var(--primary)" />
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Rotate if Skip Rate over</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                        <input 
                          type="number" 
                          value={smartSettings.skipRateThreshold} 
                          onChange={(e) => setSmartSettings(s => ({...s, skipRateThreshold: Number(e.target.value)}))}
                          style={{ width: '50px', padding: '4px 8px', background: 'transparent', border: 'none', color: '#fff', outline: 'none', textAlign: 'center' }} 
                        />
                        <span style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.1)', fontSize: '12px', color: 'var(--text-secondary)' }}>%</span>
                      </div>
                    </div>
                    {/* Refresh Interval */}
                    <div style={{ flex: 1, minWidth: '140px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <Clock size={13} color="var(--primary)" />
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Refresh every</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                        <input 
                          type="number" 
                          value={smartSettings.refreshIntervalDays} 
                          onChange={(e) => setSmartSettings(s => ({...s, refreshIntervalDays: Number(e.target.value)}))}
                          style={{ width: '50px', padding: '4px 8px', background: 'transparent', border: 'none', color: '#fff', outline: 'none', textAlign: 'center' }} 
                        />
                        <span style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.1)', fontSize: '12px', color: 'var(--text-secondary)' }}>days</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Ad Library Modal */}
      {isLibraryOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--surface)', padding: '24px', borderRadius: '12px', width: '500px', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', color: '#fff' }}>
              Select Ad from Library
              <button onClick={() => setIsLibraryOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>✕</button>
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', maxHeight: '400px', overflowY: 'auto' }}>
              {creativeAssets.length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px', gridColumn: '1 / -1', textAlign: 'center', padding: '20px' }}>No ads found in your library. Save some from the Creative Studio first!</div>
              ) : (
                creativeAssets.map(asset => (
                  <div key={asset.id} onClick={() => { const sid = String(asset.id); setSelectedAds(prev => [...new Set([...prev, sid])]); setCreativeMeta(prev => ({ ...prev, [sid]: { asset_id: asset.id, image_url: asset.image_url || asset.imageUrl, headline: asset.headline } })); setIsLibraryOpen(false); }} style={{ padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', cursor: 'pointer', border: '1px solid var(--border)', textAlign: 'center', transition: 'all 0.2s ease' }} onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary)'} onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border)'}>
                    <ImageIcon size={32} color="var(--primary)" style={{ margin: '0 auto 8px', display: 'block' }} />
                    <div style={{ fontSize: '13px', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{asset.headline || `Ad #${asset.id}`}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{asset.type}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toggle CSS injected directly for simplicity */}
      <style dangerouslySetInnerHTML={{__html: `
        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 36px;
          height: 20px;
        }
        .toggle-switch input { 
          opacity: 0;
          width: 0;
          height: 0;
        }
        .slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: var(--border);
          transition: .2s;
          border-radius: 34px;
        }
        .slider:before {
          position: absolute;
          content: "";
          height: 14px;
          width: 14px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: .2s;
          border-radius: 50%;
        }
        input:checked + .slider {
          background-color: var(--primary);
        }
        input:checked + .slider:before {
          transform: translateX(16px);
        }
      `}} />

      {/* Confirm dialog for kill / budget actions (confirmed-execute) */}
      {confirmDialog && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', maxWidth: '440px', width: '90%' }}>
            <h4 style={{ color: '#fff', fontSize: '16px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {confirmDialog.danger ? <OctagonX size={18} color="#ff5252" /> : <CheckCircle size={18} color="#00e676" />} {confirmDialog.title}
            </h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6, marginBottom: '20px' }}>{confirmDialog.body}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setConfirmDialog(null)} disabled={confirmBusy} style={{ background: 'transparent', border: '1px solid var(--border)', color: '#fff', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
              <button onClick={() => confirmDialog.run()} disabled={confirmBusy} style={{ background: confirmDialog.danger ? '#ff5252' : '#00e676', border: 'none', color: '#000', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 700, opacity: confirmBusy ? 0.6 : 1 }}>
                {confirmBusy ? 'Working…' : confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 4500, maxWidth: '540px', background: 'rgba(20,22,30,0.97)', border: `1px solid ${toast.ok ? 'rgba(0,230,118,0.4)' : 'rgba(255,82,82,0.4)'}`, borderRadius: '12px', padding: '13px 18px', color: '#fff', fontSize: '13px', boxShadow: '0 12px 30px rgba(0,0,0,0.5)', display: 'flex', gap: '10px', alignItems: 'center' }}>
          {toast.ok ? <CheckCircle size={16} color="#00e676" /> : <AlertTriangle size={16} color="#ff5252" />} {toast.msg}
        </div>
      )}
    </div>
  );
};
