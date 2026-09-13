import React, { useState, useEffect } from 'react';
import {
  Check, Plus,
  MessageCircle, Eye,
  X, ChevronRight
} from 'lucide-react';
import { GlowButton } from '../GlowButton';

export interface PostedDealItem {
  id: number;
  workspace_id?: number;
  brand_name: string;
  brand_logo?: string;
  brand_url?: string;
  campaign_name: string;
  product_name?: string;
  description?: string;
  objective?: string;
  platform: string;
  creator_category: string;
  niche: string;
  location: string;
  creators_required: number;
  total_budget: number;
  budget_per_creator: number;
  deliverables_json?: string;
  application_deadline?: string;
  status: string; // ACTIVE | REVIEWING | IN_PROGRESS | COMPLETED | CLOSED
  applications_count?: number;
  shortlisted_count?: number;
  accepted_count?: number;
  match_score?: number;
  has_applied?: boolean;
  application_status?: string;
}

export interface DealApplicationItem {
  id: number;
  deal_id: number;
  creator_handle: string;
  creator_name: string;
  creator_avatar?: string;
  creator_followers?: string;
  creator_engagement?: string;
  creator_location?: string;
  match_score: number;
  proposal_text?: string;
  proposed_price: number;
  availability_date?: string;
  estimated_delivery_days?: number;
  status: string; // SUBMITTED | SHORTLISTED | ACCEPTED | CONFIRMED | DECLINED | COMPLETED
  final_price?: number;
  final_deliverables?: string;
  final_delivery_days?: number;
  usage_rights?: string;
  revisions_allowed?: number;
  cashout_requested?: boolean;
  cashout_status?: string;
  campaign_name?: string;
  brand_name?: string;
}

export interface DeliverableSubmissionItem {
  id: number;
  application_id: number;
  deal_id: number;
  title: string;
  submission_type: string;
  content_url?: string;
  caption?: string;
  notes?: string;
  status: string; // PENDING | SUBMITTED | UNDER_REVIEW | REVISION_REQUESTED | APPROVED
  revision_reason?: string;
  due_date?: string;
}

// ── BRAND POSTED DEALS VIEW ──────────────────────────────────────────────────
/** An ISO yyyy-mm-dd date `days` from now, for the campaign-brief date defaults. */
const _inDays = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export const BrandPostedDealsView: React.FC<{
  workspaceId: number;
  mode?: 'posted_deals' | 'my_collaborations';
  onOpenChatWithCreator?: (handle: string, dealTitle?: string) => void;
  onViewCreatorProfile?: (handle: string) => void;
}> = ({ workspaceId, mode = 'posted_deals', onOpenChatWithCreator, onViewCreatorProfile }) => {
  const [deals, setDeals] = useState<PostedDealItem[]>([]);
  const [loading, setLoading] = useState(true);

  /* Whose brand is publishing. Every deal was posted as the literal string "Aura Premium",
     so a creator browsing the marketplace saw that name against briefs from every brand on
     the platform, and the workspace that actually posted one could not be told apart. */
  const [brandName, setBrandName] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    fetch(`/api/workspaces/${workspaceId}/brand-profile`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled && d?.name) setBrandName(d.name); })
      .catch(() => { /* publish stays disabled until we know who is posting */ });
    return () => { cancelled = true; };
  }, [workspaceId]);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [newDeal, setNewDeal] = useState({
    campaign_name: '',
    product_name: '',
    description: '',
    objective: 'Brand Awareness & UGC',
    platform: 'Instagram',
    creator_category: 'All',
    niche: 'Lifestyle',
    location: 'India',
    creators_required: 3,
    follower_range: '10k - 100k',
    engagement_range: '2% - 10%',
    content_style: 'Authentic UGC',
    language: 'English / Hindi',
    audience_requirements: 'Women aged 18-34',
    selected_deliverables: ['Reel', 'Story'],
    total_budget: 45000,
    budget_per_creator: 15000,
    allow_negotiation: true,
    // Relative to today. These were fixed literals ('2026-08-30' and on), so once those
    // dates passed every new brief was created with an application deadline already in
    // the past — closed to applicants the moment it was published.
    application_deadline: _inDays(14),
    campaign_start: _inDays(21),
    deliverable_deadline: _inDays(35),
    campaign_end: _inDays(50)
  });

  // Applications view
  const [selectedDealForApps, setSelectedDealForApps] = useState<PostedDealItem | null>(null);
  const [applications, setApplications] = useState<DealApplicationItem[]>([]);
  const [appFilter, setAppFilter] = useState<'ALL' | 'SHORTLISTED' | 'ACCEPTED'>('ALL');

  // Collaboration / Deliverables workspace view
  const [activeCollabApp, setActiveCollabApp] = useState<DealApplicationItem | null>(null);
  const [collabSubmissions, setCollabSubmissions] = useState<DeliverableSubmissionItem[]>([]);

  /* Multi-tenant sync. The plain fetch-on-mount this replaced had two problems:
     - Switching workspace left the previous brand's deals on screen until the new request
       landed, and a slow response for the OLD workspace could land after the new one and
       overwrite it - one brand's briefs shown under another brand.
     - Nothing refreshed when the creator side acted, so a new application only appeared
       after a manual reload. The list now re-reads every 30s while the tab is visible. */
  const dealsRequestWs = React.useRef<number | null>(null);
  const fetchBrandDeals = React.useCallback(() => {
    if (!workspaceId) return;
    const ws = workspaceId;
    dealsRequestWs.current = ws;
    fetch(`/api/posted-deals/brand/${ws}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (dealsRequestWs.current !== ws) return; // a newer workspace has taken over
        if (Array.isArray(data)) setDeals(data);
      })
      .catch(() => { /* keep what is on screen; the next poll retries */ })
      .finally(() => { if (dealsRequestWs.current === ws) setLoading(false); });
  }, [workspaceId]);

  useEffect(() => {
    setDeals([]);
    setLoading(true);
    setSelectedDealForApps(null);
    setActiveCollabApp(null);
    fetchBrandDeals();
    const t = setInterval(() => { if (document.visibilityState === 'visible') fetchBrandDeals(); }, 30000);
    return () => clearInterval(t);
  }, [fetchBrandDeals]);

  // Was `deals.length > 0 ? deals : sampleDeals`: a brand that had posted nothing saw
  // two invented campaigns it could open, edit and review applicants for.
  const displayDeals = deals;

  const handlePublishDeal = () => {
    if (!brandName) {
      alert('Still loading your brand details — try again in a moment.');
      return;
    }
    fetch('/api/posted-deals/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: workspaceId,
        brand_name: brandName,
        campaign_name: newDeal.campaign_name || 'New Creator Campaign',
        product_name: newDeal.product_name,
        description: newDeal.description,
        objective: newDeal.objective,
        platform: newDeal.platform,
        creator_category: newDeal.creator_category,
        niche: newDeal.niche,
        location: newDeal.location,
        creators_required: newDeal.creators_required,
        total_budget: newDeal.total_budget,
        budget_per_creator: newDeal.budget_per_creator,
        deliverables_json: JSON.stringify(newDeal.selected_deliverables),
        application_deadline: newDeal.application_deadline
      })
    })
      // A failed publish used to close the modal and report "Deal created in sandbox
      // mode!", so a request that saved nothing looked like a success and the brief was
      // lost. A failure now says so and keeps the form open with the user's input intact.
      .then(async r => {
        if (!r.ok) throw new Error((await r.text().catch(() => '')) || `HTTP ${r.status}`);
        return r.json();
      })
      .then(() => {
        alert('Deal published successfully! Relevant creators are being notified.');
        setIsCreateModalOpen(false);
        fetchBrandDeals();
      })
      .catch(err => {
        alert(`Could not publish the deal — nothing was saved.\n\n${String(err.message || err).slice(0, 200)}`);
      });
  };

  const handleViewApplications = (deal: PostedDealItem) => {
    setSelectedDealForApps(deal);
    setApplications([]);
    // No fixture fallback. `sampleApplicants` used to fill this list whenever the API
    // returned nothing OR failed, so a brand with zero applicants saw four invented
    // creators - complete with names, rates and follower counts - and had no way to tell
    // them from real ones. An empty deal must look empty.
    fetch(`/api/posted-deals/${deal.id}/applications`)
      .then(r => (r.ok ? r.json() : []))
      .then(data => setApplications(Array.isArray(data) ? data : []))
      .catch(() => setApplications([]));
  };

  // The applicants list was read once when the modal opened, so a creator applying while the
  // brand had it open never appeared. Re-read while it stays open.
  const openDealId = selectedDealForApps?.id ?? null;
  useEffect(() => {
    if (openDealId === null) return;
    const t = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      fetch(`/api/posted-deals/${openDealId}/applications`)
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (Array.isArray(d)) setApplications(d); })
        .catch(() => { /* keep what is on screen */ });
    }, 30000);
    return () => clearInterval(t);
  }, [openDealId]);

  const handleUpdateAppStatus = (appId: number, status: string) => {
    // Applying the status change in the catch made a failed request look identical to a
    // successful one: the card moved to Shortlisted on screen while the server still had
    // it as Applied, and the change vanished on refresh.
    fetch(`/api/posted-deals/applications/${appId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    })
      .then(async r => {
        if (!r.ok) throw new Error(`Request failed (${r.status})`);
        setApplications(prev => prev.map(a => a.id === appId ? { ...a, status } : a));
      })
      .catch(e => alert(`Could not update this application: ${e instanceof Error ? e.message : e}`));
  };

  // Real finalized collaborations for this workspace (/brand/{id}/collaborations). Previously a
  // hardcoded array: one invented creator ("Samaira Rao", an Unsplash headshot) on an invented
  // campaign, identical for every brand. Same workspace guard and 30s refresh as the deals list,
  // so a switched workspace never shows the previous brand's collaborations and a creator's
  // submission shows up without a reload.
  const [activeCollaborations, setActiveCollaborations] = useState<DealApplicationItem[]>([]);
  const [collabsLoading, setCollabsLoading] = useState(true);
  const collabsRequestWs = React.useRef<number | null>(null);

  const loadCollaborations = React.useCallback(() => {
    if (!workspaceId) { setCollabsLoading(false); return; }
    const ws = workspaceId;
    collabsRequestWs.current = ws;
    fetch(`/api/posted-deals/brand/${ws}/collaborations`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (collabsRequestWs.current === ws && Array.isArray(d)) setActiveCollaborations(d); })
      .catch(() => { /* keep what is on screen; the next poll retries */ })
      .finally(() => { if (collabsRequestWs.current === ws) setCollabsLoading(false); });
  }, [workspaceId]);

  useEffect(() => {
    setActiveCollaborations([]);
    setCollabsLoading(true);
    loadCollaborations();
    const t = setInterval(() => { if (document.visibilityState === 'visible') loadCollaborations(); }, 30000);
    return () => clearInterval(t);
  }, [loadCollaborations]);

  // Three invented deliverables used to appear whenever a collab had none - an "Instagram
  // Reel" with a stock Unsplash thumbnail, plus two stories. Only real submissions are shown.
  const loadCollabSubmissions = (appId: number) => {
    fetch(`/api/posted-deals/applications/${appId}/submissions`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => { if (Array.isArray(data)) setCollabSubmissions(data); })
      .catch(() => { /* keep what is on screen */ });
  };

  const handleOpenCollabWorkspace = (app: DealApplicationItem) => {
    setActiveCollabApp(app);
    setCollabSubmissions([]);
    loadCollabSubmissions(app.id);
  };

  // While a workspace is open, pick up the creator's submissions as they arrive.
  const openCollabId = activeCollabApp?.id ?? null;
  useEffect(() => {
    if (openCollabId === null) return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') loadCollabSubmissions(openCollabId); }, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCollabId]);

  /* Accept & Finalize. This used to fire a separate "ACCEPTED" status call alongside
     finalize (two writes racing on one row), send a fixed "Instagram Reel, Instagram Story
     #1, Instagram Story #2" whatever the brief asked for, and open the workspace as
     CONFIRMED even when the request failed. It is one confirmed call now, carrying the
     brief's own deliverables. */
  const handleFinalizeTerms = async (app: DealApplicationItem) => {
    const brief = selectedDealForApps || deals.find(d => d.id === app.deal_id) || null;
    const items = brief ? deliverableNames(brief.deliverables_json) : [];
    const finalPrice = app.proposed_price;
    if (!finalPrice || finalPrice <= 0) {
      alert('This application has no fee to agree. Message the creator to settle one first.');
      return;
    }
    if (!window.confirm(
      `Confirm ${app.creator_name} (@${app.creator_handle}) for ${inr(finalPrice)}?\n\n` +
      `Deliverables: ${items.join(', ') || 'as listed on the brief'}\n\n` +
      'The creator is notified and can start submitting content.')) return;
    try {
      const r = await fetch(`/api/posted-deals/applications/${app.id}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          final_price: finalPrice,
          final_deliverables: items.join(', '),
          final_delivery_days: app.estimated_delivery_days || 7,
          usage_rights: '30 Days Digital Rights',
          revisions_allowed: 1,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || `Request failed (${r.status})`);
      const confirmed: DealApplicationItem = {
        ...app, status: 'CONFIRMED', final_price: finalPrice,
        final_deliverables: items.join(', ') || app.final_deliverables,
        final_delivery_days: app.estimated_delivery_days || 7,
        usage_rights: '30 Days Digital Rights',
      };
      setApplications(prev => prev.map(a => (a.id === app.id ? confirmed : a)));
      fetchBrandDeals();
      loadCollaborations();
      handleOpenCollabWorkspace(confirmed);
    } catch (e) {
      alert(`Could not confirm this creator: ${e instanceof Error ? e.message : e}\n\nNothing has changed.`);
    }
  };

  const handleReviewSubmission = (subId: number, status: 'APPROVED' | 'REVISION_REQUESTED', reason?: string) => {
    fetch(`/api/posted-deals/submissions/${subId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, revision_reason: reason })
    })
      .then(async r => {
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d.detail || `Request failed (${r.status})`);
        }
        setCollabSubmissions(prev => prev.map(s => s.id === subId ? { ...s, status, revision_reason: reason } : s));
      })
      .catch(e => alert(`Could not record this review: ${e instanceof Error ? e.message : e}\n\nThe creator has not been notified.`));
  };

  const handleCompleteCampaign = (appId: number) => {
    // Completing a campaign is what unlocks the creator's payout, so faking it in the catch
    // told a brand the campaign was closed and the creator could cash out while the server
    // still had it open - a disagreement about money between two screens.
    fetch(`/api/posted-deals/applications/${appId}/complete`, { method: 'POST' })
      .then(async r => {
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d.detail || `Request failed (${r.status})`);
        }
        setActiveCollabApp(prev => prev ? { ...prev, status: 'COMPLETED' } : null);
        loadCollaborations();
        fetchBrandDeals();
        alert('Campaign marked complete. The creator can now request payment.');
      })
      .catch(e => alert(`Could not complete this campaign: ${e instanceof Error ? e.message : e}\n\nNothing has changed.`));
  };

  const filteredApps = applications.filter(a => {
    if (appFilter === 'SHORTLISTED') return a.status === 'SHORTLISTED';
    if (appFilter === 'ACCEPTED') return a.status === 'ACCEPTED' || a.status === 'CONFIRMED';
    return true;
  });

  if (mode === 'my_collaborations') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
            My Collaborations <span style={{ fontSize: '11px', background: 'rgba(0,230,118,0.15)', color: '#00e676', border: '1px solid rgba(0,230,118,0.3)', padding: '2px 8px', borderRadius: '12px' }}>Active Finalized Deals</span>
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Creators you have confirmed on your posted deals: agreed terms, deliverables to review, and completion.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {collabsLoading && (
            <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
              Loading collaborations…
            </div>
          )}
          {!collabsLoading && activeCollaborations.length === 0 && (
            <div style={{
              padding: '32px', textAlign: 'center', background: 'rgba(255,255,255,0.02)',
              border: '1px dashed rgba(255,255,255,0.12)', borderRadius: '14px',
            }}>
              <div style={{ fontSize: '15px', color: '#fff', fontWeight: 700, marginBottom: '6px' }}>
                No active collaborations yet
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Once you confirm a creator's application on one of your posted deals, the
                collaboration appears here with its deliverables. This list refreshes on its own.
              </div>
            </div>
          )}
          {activeCollaborations.map(collab => (
            <div key={collab.id} className="glow-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15,15,22,0.7)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '20px', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
                {/* No avatar on file rendered a broken <img>; an initial is honest. */}
                {collab.creator_avatar ? (
                  <img src={collab.creator_avatar} alt="" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(124,117,255,0.15)', border: '1px solid rgba(124,117,255,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 800, color: '#7C75FF', flexShrink: 0 }}>
                    {(collab.creator_name || collab.creator_handle || '?').replace('@', '').charAt(0).toUpperCase()}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {collab.creator_name} <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>@{collab.creator_handle}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: 600, marginTop: '2px' }}>{collab.campaign_name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Deliverables: <b style={{ color: '#fff' }}>{collab.final_deliverables || '—'}</b>
                    {collab.final_delivery_days ? ` · Delivery: ${collab.final_delivery_days} days` : ''}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#00e676' }}>{inr(collab.final_price ?? collab.proposed_price)}</div>
                  {/* Was "Raftra Vault Funded". No payment is taken anywhere in this flow, so
                      nothing is funded - it is the fee both sides agreed. */}
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {collab.cashout_requested ? `Payment ${(collab.cashout_status || 'requested').toLowerCase()}` : 'Agreed fee'}
                  </div>
                </div>

                <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 12px', borderRadius: '20px', background: collab.status === 'COMPLETED' ? 'rgba(0,230,118,0.15)' : 'rgba(90,141,255,0.15)', color: collab.status === 'COMPLETED' ? '#00e676' : '#5a8dff' }}>
                  {collab.status === 'COMPLETED' ? '✓ Completed' : '🔵 In Progress'}
                </span>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <GlowButton variant="secondary" onClick={() => onOpenChatWithCreator && onOpenChatWithCreator(collab.creator_handle, collab.campaign_name)} style={{ fontSize: '11.5px', padding: '6px 12px' }}>
                    <MessageCircle size={14} /> Message
                  </GlowButton>
                  <GlowButton variant="glow" onClick={() => handleOpenCollabWorkspace(collab)} style={{ fontSize: '11.5px', padding: '6px 12px' }}>
                    Open Workspace ➔
                  </GlowButton>
                </div>
              </div>
            </div>
          ))}
        </div>

        {activeCollabApp && (
          <CollabWorkspaceModal
            app={activeCollabApp}
            submissions={collabSubmissions}
            onClose={() => setActiveCollabApp(null)}
            onReview={handleReviewSubmission}
            onComplete={handleCompleteCampaign}
          />
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header & Subtitle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
            Posted Deals <span style={{ fontSize: '11px', background: 'rgba(0,230,118,0.15)', color: '#00e676', border: '1px solid rgba(0,230,118,0.3)', padding: '2px 8px', borderRadius: '12px' }}>Broadcast Workflow</span>
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Create and manage creator opportunities for your campaigns.
          </p>
        </div>

        <GlowButton variant="glow" onClick={() => { setCreateStep(1); setIsCreateModalOpen(true); }}>
          <Plus size={16} /> + Make a New Deal
        </GlowButton>
      </div>

      {/* Main Deals List */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(340px, 100%), 1fr))', gap: '20px' }}>
        {displayDeals.map(deal => {
          const statusColors: Record<string, { c: string; b: string; label: string }> = {
            ACTIVE: { c: '#00e676', b: 'rgba(0,230,118,0.12)', label: '🟢 Active' },
            REVIEWING: { c: '#ffae00', b: 'rgba(255,174,0,0.14)', label: '🟡 Reviewing' },
            IN_PROGRESS: { c: '#5a8dff', b: 'rgba(90,141,255,0.14)', label: '🔵 In Progress' },
            COMPLETED: { c: '#00e676', b: 'rgba(0,230,118,0.12)', label: '✓ Completed' },
            CLOSED: { c: 'var(--text-secondary)', b: 'rgba(255,255,255,0.06)', label: '⚪ Closed' }
          };
          const st = statusColors[deal.status] || statusColors.ACTIVE;

          return (
            <div key={deal.id} className="glow-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(15,15,22,0.7)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>{deal.campaign_name}</h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{deal.platform} · {deal.niche}</div>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: st.c, background: st.b, border: `1px solid ${st.c}33`, borderRadius: '20px', padding: '3px 10px' }}>{st.label}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '10px', fontSize: '12.5px' }}>
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Campaign Budget</div>
                  <div style={{ fontWeight: 700, color: '#fff', fontSize: '14px', marginTop: '2px' }}>₹{deal.total_budget.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Deadline</div>
                  <div style={{ color: '#fff', marginTop: '2px' }}>{deal.application_deadline || 'Open'}</div>
                </div>
              </div>

              {/* Stats pill */}
              <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span><b style={{ color: '#fff' }}>{deal.applications_count || 0}</b> Applications</span>
                <span>•</span>
                <span><b style={{ color: '#ffae00' }}>{deal.shortlisted_count || 0}</b> Shortlisted</span>
                <span>•</span>
                <span><b style={{ color: '#00e676' }}>{deal.accepted_count || 0}</b> Accepted</span>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <GlowButton variant="glow" onClick={() => handleViewApplications(deal)} style={{ flex: 1, fontSize: '12.5px', padding: '8px 12px' }}>
                  <Eye size={14} /> View Applications ({deal.applications_count || 0})
                </GlowButton>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── MAKE A NEW DEAL 6-STEP MODAL ────────────────────────────────────── */}
      {isCreateModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glow-card" style={{ width: '100%', maxWidth: '640px', background: '#0D0D14', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '16px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>+ Make a New Deal</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Step {createStep} of 6 — {['Campaign Details', 'Creator Requirements', 'Deliverables', 'Budget', 'Timeline', 'Review & Publish'][createStep - 1]}</span>
              </div>
              <X size={20} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setIsCreateModalOpen(false)} />
            </div>

            {/* Stepper indicator */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {[1, 2, 3, 4, 5, 6].map(step => (
                <div key={step} style={{ flex: 1, height: '4px', borderRadius: '2px', background: step <= createStep ? 'var(--primary, #5A52FF)' : 'rgba(255,255,255,0.1)' }} />
              ))}
            </div>

            {/* Step 1: Campaign */}
            {createStep === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="form-group">
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Campaign Name *</label>
                  <input type="text" value={newDeal.campaign_name} onChange={e => setNewDeal({ ...newDeal, campaign_name: e.target.value })} placeholder="e.g. Summer Festive UGC Campaign" style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }} />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Product / Service</label>
                  <input type="text" value={newDeal.product_name} onChange={e => setNewDeal({ ...newDeal, product_name: e.target.value })} placeholder="e.g. Aura Glow Serum" style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }} />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Campaign Description</label>
                  <textarea value={newDeal.description} onChange={e => setNewDeal({ ...newDeal, description: e.target.value })} placeholder="Describe product value prop, target angles, and what creators will do..." rows={3} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Platform</label>
                    <select value={newDeal.platform} onChange={e => setNewDeal({ ...newDeal, platform: e.target.value })} style={{ width: '100%', padding: '10px', background: '#14141F', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }}>
                      <option value="Instagram">Instagram</option>
                      <option value="YouTube">YouTube</option>
                      <option value="Multi-Platform">Multi-Platform</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Creators Required</label>
                    <input type="number" value={newDeal.creators_required} onChange={e => setNewDeal({ ...newDeal, creators_required: Number(e.target.value) })} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }} />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Requirements */}
            {createStep === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Niche</label>
                    <input type="text" value={newDeal.niche} onChange={e => setNewDeal({ ...newDeal, niche: e.target.value })} placeholder="e.g. Lifestyle, Fashion, Tech" style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Location</label>
                    <input type="text" value={newDeal.location} onChange={e => setNewDeal({ ...newDeal, location: e.target.value })} placeholder="e.g. Delhi, Mumbai, India" style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }} />
                  </div>
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Follower Range</label>
                  <select value={newDeal.follower_range} onChange={e => setNewDeal({ ...newDeal, follower_range: e.target.value })} style={{ width: '100%', padding: '10px', background: '#14141F', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }}>
                    <option value="Nano (< 10k)">Nano (&lt; 10k followers)</option>
                    <option value="Micro (10k - 100k)">Micro (10k - 100k followers)</option>
                    <option value="Macro (100k+)">Macro (100k+ followers)</option>
                    <option value="All Categories">All Categories</option>
                  </select>
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Audience Requirements</label>
                  <input type="text" value={newDeal.audience_requirements} onChange={e => setNewDeal({ ...newDeal, audience_requirements: e.target.value })} placeholder="e.g. Women aged 18-34, Tier 1/2 Cities" style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }} />
                </div>
              </div>
            )}

            {/* Step 3: Deliverables */}
            {createStep === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Select Deliverables Required:</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {['Reel', 'Story', 'UGC Video', 'Static Post', 'YouTube Short', 'Product Photography'].map(del => {
                    const isSelected = newDeal.selected_deliverables.includes(del);
                    return (
                      <div key={del} onClick={() => {
                        const updated = isSelected ? newDeal.selected_deliverables.filter(d => d !== del) : [...newDeal.selected_deliverables, del];
                        setNewDeal({ ...newDeal, selected_deliverables: updated });
                      }} style={{ padding: '12px', background: isSelected ? 'rgba(90,82,255,0.15)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border-color)'}`, borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: isSelected ? '#fff' : 'var(--text-secondary)', fontSize: '13px' }}>
                        <span>{del}</span>
                        {isSelected && <Check size={14} style={{ color: 'var(--primary)' }} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 4: Budget */}
            {createStep === 4 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Campaign Budget (₹)</label>
                    <input type="number" value={newDeal.total_budget} onChange={e => setNewDeal({ ...newDeal, total_budget: Number(e.target.value), budget_per_creator: Math.round(Number(e.target.value) / (newDeal.creators_required || 1)) })} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Budget Per Creator (Est.)</label>
                    <input type="number" value={newDeal.budget_per_creator} onChange={e => setNewDeal({ ...newDeal, budget_per_creator: Number(e.target.value) })} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }} />
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Timeline */}
            {createStep === 5 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="form-group">
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Application Deadline</label>
                  <input type="date" value={newDeal.application_deadline} onChange={e => setNewDeal({ ...newDeal, application_deadline: e.target.value })} style={{ width: '100%', padding: '10px', background: '#14141F', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }} />
                </div>
              </div>
            )}

            {/* Step 6: Review & Publish */}
            {createStep === 6 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '13px' }}>
                <div><b style={{ color: '#fff' }}>Campaign:</b> {newDeal.campaign_name}</div>
                <div><b style={{ color: '#fff' }}>Platform & Niche:</b> {newDeal.platform} · {newDeal.niche}</div>
                <div><b style={{ color: '#fff' }}>Budget:</b> ₹{newDeal.total_budget.toLocaleString()} (₹{newDeal.budget_per_creator.toLocaleString()} / creator)</div>
                <div><b style={{ color: '#fff' }}>Deliverables:</b> {newDeal.selected_deliverables.join(', ')}</div>
              </div>
            )}

            {/* Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
              {createStep > 1 ? (
                <GlowButton variant="secondary" onClick={() => setCreateStep(s => s - 1)}>Back</GlowButton>
              ) : <div />}

              {createStep < 6 ? (
                <GlowButton variant="glow" onClick={() => setCreateStep(s => s + 1)}>Next <ChevronRight size={14} /></GlowButton>
              ) : (
                <GlowButton variant="glow" onClick={handlePublishDeal}>Publish Deal 🚀</GlowButton>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── APPLICATIONS REVIEW MODAL ────────────────────────────────────────── */}
      {selectedDealForApps && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glow-card" style={{ width: '100%', maxWidth: '780px', background: '#0D0D14', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '16px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>{selectedDealForApps.campaign_name}</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Review Creator Applications</span>
              </div>
              <X size={20} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setSelectedDealForApps(null)} />
            </div>

            {/* Application Filters */}
            <div style={{ display: 'flex', gap: '10px' }}>
              {(['ALL', 'SHORTLISTED', 'ACCEPTED'] as const).map(f => (
                <button key={f} onClick={() => setAppFilter(f)} style={{ padding: '6px 14px', borderRadius: '20px', border: '1px solid var(--border-color)', background: appFilter === f ? 'var(--primary)' : 'rgba(255,255,255,0.03)', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>
                  {f === 'ALL' ? 'All Applications' : f === 'SHORTLISTED' ? 'Shortlisted' : 'Accepted'}
                </button>
              ))}
            </div>

            {/* List of Applications */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredApps.map(app => (
                <div key={app.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {/* An applicant with no avatar on file used to be shown as a stock
                          Unsplash headshot, so a real creator was represented in the
                          brand's shortlist by a photograph of a stranger. */}
                      {app.creator_avatar ? (
                        <img src={app.creator_avatar} alt="" style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(124,117,255,0.15)', border: '1px solid rgba(124,117,255,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 800, color: '#7C75FF', flexShrink: 0 }}>
                          {(app.creator_name || app.creator_handle || '?').replace('@', '').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {app.creator_name} <span style={{ fontSize: '11px', color: '#00e676', background: 'rgba(0,230,118,0.1)', padding: '1px 6px', borderRadius: '4px' }}>{app.match_score}% Brand Fit</span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          @{app.creator_handle} · {(!app.creator_followers || app.creator_followers.toLowerCase().includes('view profile')) ? 'View Profile' : `${app.creator_followers} followers`} · {app.creator_location}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>₹{app.proposed_price.toLocaleString()}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Requested Price</div>
                    </div>
                  </div>

                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', lineHeight: 1.5 }}>
                    "{app.proposal_text}"
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Status: <b style={{ color: '#ffae00' }}>{app.status}</b></span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <GlowButton variant="secondary" onClick={() => onViewCreatorProfile && onViewCreatorProfile(app.creator_handle)} style={{ fontSize: '11.5px', padding: '5px 10px' }}>
                        View Profile
                      </GlowButton>
                      <GlowButton variant="secondary" onClick={() => onOpenChatWithCreator && onOpenChatWithCreator(app.creator_handle, selectedDealForApps.campaign_name)} style={{ fontSize: '11.5px', padding: '5px 10px' }}>
                        <MessageCircle size={12} /> Message
                      </GlowButton>
                      {app.status === 'SUBMITTED' && (
                        <GlowButton variant="secondary" onClick={() => handleUpdateAppStatus(app.id, 'SHORTLISTED')} style={{ fontSize: '11.5px', padding: '5px 10px' }}>
                          Shortlist
                        </GlowButton>
                      )}
                      {['SUBMITTED', 'SHORTLISTED', 'NEGOTIATION'].includes(app.status) && (
                        <GlowButton variant="secondary" onClick={() => { if (window.confirm(`Decline ${app.creator_name}'s application? They will be notified.`)) handleUpdateAppStatus(app.id, 'DECLINED'); }} style={{ fontSize: '11.5px', padding: '5px 10px' }}>
                          Decline
                        </GlowButton>
                      )}
                      {['SUBMITTED', 'SHORTLISTED', 'NEGOTIATION', 'ACCEPTED'].includes(app.status) && (
                        <GlowButton variant="glow" onClick={() => handleFinalizeTerms(app)} style={{ fontSize: '11.5px', padding: '5px 10px' }}>
                          Accept & Finalize
                        </GlowButton>
                      )}
                      {(app.status === 'CONFIRMED' || app.status === 'COMPLETED') && (
                        <GlowButton variant="glow" onClick={() => handleOpenCollabWorkspace(app)} style={{ fontSize: '11.5px', padding: '5px 10px' }}>
                          Open Workspace ➔
                        </GlowButton>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {filteredApps.length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: '12px' }}>
                  {applications.length === 0
                    ? 'No applications yet. Creators who apply to this brief appear here — the list refreshes on its own.'
                    : 'No applications match this filter.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeCollabApp && (
        <CollabWorkspaceModal
          app={activeCollabApp}
          submissions={collabSubmissions}
          onClose={() => setActiveCollabApp(null)}
          onReview={handleReviewSubmission}
          onComplete={handleCompleteCampaign}
        />
      )}
    </div>
  );
};

// ── SHARED ───────────────────────────────────────────────────────────────────
/* Both sides of the marketplace read and write the same rows: the brand through
   /brand/{workspace}, /{deal}/applications and the review routes; the creator through
   /discover, /{deal}/apply, /mine and the per-application submissions routes. Each side
   re-reads on an interval while the tab is visible, so an application, a confirmation, a
   submitted deliverable or a review shows up on the other side without a reload. */
const POLL_MS = 30000;

function usePolling(fn: () => void, deps: React.DependencyList) {
  useEffect(() => {
    fn();
    const t = setInterval(() => { if (document.visibilityState === 'visible') fn(); }, POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

const inr = (n?: number | null) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const deliverableNames = (raw?: string): string[] => {
  try {
    const d = JSON.parse(raw || '[]');
    return Array.isArray(d)
      ? d.map((x: any) => (typeof x === 'string' ? x : x?.type || x?.title || '')).filter(Boolean)
      : [];
  } catch {
    return [];
  }
};

const SUB_STATUS_STYLE: Record<string, { c: string; b: string; label: string }> = {
  PENDING: { c: 'var(--text-secondary)', b: 'rgba(255,255,255,0.06)', label: 'Not submitted' },
  SUBMITTED: { c: '#ffae00', b: 'rgba(255,174,0,0.15)', label: 'Awaiting review' },
  UNDER_REVIEW: { c: '#ffae00', b: 'rgba(255,174,0,0.15)', label: 'Awaiting review' },
  RESUBMITTED: { c: '#ffae00', b: 'rgba(255,174,0,0.15)', label: 'Resubmitted' },
  REVISION_REQUESTED: { c: '#ff8a5c', b: 'rgba(255,138,92,0.15)', label: 'Revision requested' },
  APPROVED: { c: '#00e676', b: 'rgba(0,230,118,0.15)', label: 'Approved' },
};

/* Statuses a brand can act on. The screen offered Approve / Revision only for "SUBMITTED",
   but the backend records a creator's submission as UNDER_REVIEW (or RESUBMITTED after a
   revision) - so a brand could never approve anything, and no campaign could complete. */
const REVIEWABLE = new Set(['SUBMITTED', 'UNDER_REVIEW', 'RESUBMITTED']);

const SubStatusPill: React.FC<{ status: string }> = ({ status }) => {
  const s = SUB_STATUS_STYLE[status] || SUB_STATUS_STYLE.PENDING;
  return (
    <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px', background: s.b, color: s.c, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
};

// ── BRAND: COLLABORATION WORKSPACE MODAL ─────────────────────────────────────
/* One component for both places a brand opens a collaboration (Posted Deals → applicants,
   and My Collaborations). They were two copies that had drifted: the My Collaborations copy
   had no revision form at all, and both showed "Complete Campaign" for a collaboration with
   no deliverables, because [].every(...) is true. */
export const CollabWorkspaceModal: React.FC<{
  app: DealApplicationItem;
  submissions: DeliverableSubmissionItem[];
  onClose: () => void;
  onReview: (subId: number, status: 'APPROVED' | 'REVISION_REQUESTED', reason?: string) => void;
  onComplete: (appId: number) => void;
}> = ({ app, submissions, onClose, onReview, onComplete }) => {
  const [revisionFor, setRevisionFor] = useState<DeliverableSubmissionItem | null>(null);
  const [reason, setReason] = useState('');
  const allApproved = submissions.length > 0 && submissions.every(s => s.status === 'APPROVED');
  const completed = app.status === 'COMPLETED';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="glow-card" style={{ width: '100%', maxWidth: '820px', background: '#0D0D14', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '16px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>Collaboration Workspace</h3>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {app.campaign_name ? `${app.campaign_name} · ` : ''}{app.creator_name} (@{app.creator_handle})
            </span>
          </div>
          <X size={20} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={onClose} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '10px', fontSize: '12.5px' }}>
          <div><span style={{ color: 'var(--text-secondary)' }}>Agreed fee:</span> <b style={{ color: '#fff' }}>{inr(app.final_price ?? app.proposed_price)}</b></div>
          <div><span style={{ color: 'var(--text-secondary)' }}>Delivery:</span> <b style={{ color: '#fff' }}>{app.final_delivery_days ? `${app.final_delivery_days} days` : '—'}</b></div>
          <div><span style={{ color: 'var(--text-secondary)' }}>Usage rights:</span> <b style={{ color: '#fff' }}>{app.usage_rights || '—'}</b></div>
          <div><span style={{ color: 'var(--text-secondary)' }}>Status:</span> <b style={{ color: completed ? '#00e676' : '#5a8dff' }}>{completed ? 'Completed' : 'In progress'}</b></div>
        </div>

        <div>
          <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>Deliverables</h4>
          {submissions.length === 0 ? (
            <div style={{ padding: '18px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: '10px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              No deliverables on this collaboration yet. They are created when terms are confirmed, and appear here as the creator submits them.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {submissions.map(sub => (
                <div key={sub.id} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{sub.title}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Due: {sub.due_date || 'not set'}</div>
                    {sub.content_url && (
                      <a href={sub.content_url} target="_blank" rel="noreferrer" style={{ fontSize: '11.5px', color: '#5A8DFF', display: 'inline-block', marginTop: '4px' }}>View submitted content 🔗</a>
                    )}
                    {sub.caption && <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>“{sub.caption}”</div>}
                    {sub.status === 'REVISION_REQUESTED' && sub.revision_reason && (
                      <div style={{ fontSize: '11.5px', color: '#ff8a5c', marginTop: '4px' }}>You asked: {sub.revision_reason}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <SubStatusPill status={sub.status} />
                    {REVIEWABLE.has(sub.status) && !completed && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <GlowButton variant="glow" onClick={() => onReview(sub.id, 'APPROVED')} style={{ fontSize: '11px', padding: '4px 8px' }}>Approve ✓</GlowButton>
                        <GlowButton variant="secondary" onClick={() => { setRevisionFor(sub); setReason(''); }} style={{ fontSize: '11px', padding: '4px 8px' }}>Revision 📝</GlowButton>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {revisionFor && (
          <div style={{ background: 'rgba(255,174,0,0.1)', border: '1px solid rgba(255,174,0,0.3)', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffae00' }}>Request a revision on {revisionFor.title}</div>
            <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="Say exactly what needs changing, e.g. add the discount code to the final frame" style={{ width: '100%', padding: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', fontSize: '12.5px' }} />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <GlowButton variant="secondary" onClick={() => setRevisionFor(null)} style={{ fontSize: '11px', padding: '4px 8px' }}>Cancel</GlowButton>
              <GlowButton variant="glow" onClick={() => {
                if (!reason.trim()) { alert('Say what needs changing so the creator can act on it.'); return; }
                onReview(revisionFor.id, 'REVISION_REQUESTED', reason.trim());
                setRevisionFor(null);
              }} style={{ fontSize: '11px', padding: '4px 8px' }}>Send revision request</GlowButton>
            </div>
          </div>
        )}

        {allApproved && !completed && (
          <div style={{ background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: '10px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#00e676' }}>All deliverables approved ✓</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Mark the campaign complete so the creator can request payment.</div>
            </div>
            <GlowButton variant="glow" onClick={() => onComplete(app.id)}>Complete campaign 🏆</GlowButton>
          </div>
        )}
      </div>
    </div>
  );
};

// ── CREATOR BRAND OPPORTUNITIES VIEW ─────────────────────────────────────────
const NoHandleNotice: React.FC<{ onSetup?: () => void }> = ({ onSetup }) => (
  <div style={{ padding: '18px 20px', borderRadius: '14px', background: 'rgba(255,174,0,0.08)', border: '1px solid rgba(255,174,0,0.35)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
    <div>
      <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffae00' }}>Add your Instagram handle first</div>
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>
        Brands see applications under your handle, and your collaborations and payouts are linked to it. Save it in Profile Setup, then apply.
      </div>
    </div>
    {onSetup && <GlowButton variant="glow" onClick={onSetup}>Go to Profile Setup</GlowButton>}
  </div>
);

export const CreatorBrandOpportunitiesView: React.FC<{
  creatorHandle: string;
  creatorName: string;
  creatorAvatar?: string;
  creatorFollowers?: string;
  onOpenChatWithBrand?: (brandId: string, campaignName?: string) => void;
  onOpenProfileSetup?: () => void;
}> = ({ creatorHandle, creatorName, creatorAvatar, creatorFollowers, onOpenProfileSetup }) => {
  /* The handle is only a label here - the server decides who is applying from the signed-in
     account and rejects any other handle. The portal used to pass a hardcoded fallback
     ("samairaa.r"), so every application from a new creator was refused. */
  const handle = (creatorHandle || '').replace('@', '').trim().toLowerCase();
  const [deals, setDeals] = useState<PostedDealItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<PostedDealItem | null>(null);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [proposalText, setProposalText] = useState('');
  const [proposedPrice, setProposedPrice] = useState<number>(0);
  const [deliveryDays, setDeliveryDays] = useState<number>(7);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    fetch('/api/posted-deals/discover')
      .then(async r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => { setDeals(Array.isArray(data) ? data : []); setError(null); })
      .catch(() => setError('Could not load brand opportunities. Retrying shortly.'))
      .finally(() => setLoading(false));
  };
  usePolling(load, []);

  const openApply = (deal: PostedDealItem) => {
    setSelectedDeal(deal);
    setProposedPrice(deal.budget_per_creator || 0);
    setProposalText('');
    setDeliveryDays(7);
    setIsApplyModalOpen(true);
  };

  const handleApplySubmit = async () => {
    if (!selectedDeal) return;
    if (!proposalText.trim()) { alert('Write a short proposal so the brand knows why you are a fit.'); return; }
    if (!proposedPrice || proposedPrice <= 0) { alert('Enter the fee you are asking for.'); return; }
    setSubmitting(true);
    try {
      const r = await fetch(`/api/posted-deals/${selectedDeal.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creator_handle: handle,
          creator_name: creatorName || handle,
          creator_avatar: creatorAvatar || null,
          creator_followers: creatorFollowers || null,
          proposal_text: proposalText.trim(),
          proposed_price: proposedPrice,
          availability_date: 'Immediate',
          estimated_delivery_days: deliveryDays,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || `Request failed (${r.status})`);
      setIsApplyModalOpen(false);
      setSelectedDeal(null);
      alert(`Application submitted ✓ ${selectedDeal.brand_name} will see it in their Posted Deals.`);
      load();
    } catch (e) {
      alert(`Could not submit your application: ${e instanceof Error ? e.message : e}`);
    }
    setSubmitting(false);
  };

  const openCount = deals.filter(d => !d.has_applied).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '26px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          Brand Opportunities
          {openCount > 0 && (
            <span style={{ fontSize: '13px', background: 'rgba(90,82,255,0.2)', color: '#8B85FF', border: '1px solid rgba(90,82,255,0.3)', padding: '3px 10px', borderRadius: '12px' }}>
              {openCount} open to you
            </span>
          )}
        </h2>
        <p style={{ fontSize: '15px', color: 'var(--text-secondary)', marginTop: '6px' }}>
          Campaign briefs posted by brands on Raftra. Apply with a proposal; the brand reviews it in their Posted Deals.
        </p>
      </div>

      {!handle && <NoHandleNotice onSetup={onOpenProfileSetup} />}
      {error && <div style={{ fontSize: '13px', color: '#ff8a8a' }}>{error}</div>}

      {loading ? (
        <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>Loading brand opportunities…</div>
      ) : deals.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: '14px' }}>
          <div style={{ fontSize: '15px', color: '#fff', fontWeight: 700, marginBottom: '6px' }}>No open briefs right now</div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>New campaigns appear here as soon as a brand publishes one. This list refreshes on its own.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(360px, 100%), 1fr))', gap: '22px' }}>
          {deals.map(deal => {
            const items = deliverableNames(deal.deliverables_json);
            return (
              <div key={deal.id} className="glow-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(15,15,22,0.7)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>{deal.campaign_name}</h3>
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>{[deal.brand_name, deal.platform, deal.location].filter(Boolean).join(' · ')}</div>
                  </div>
                  {!!deal.match_score && (
                    <span title="Based on your saved niche and the brief's platform" style={{ fontSize: '13px', fontWeight: 700, color: '#00e676', background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.25)', borderRadius: '20px', padding: '4px 12px', whiteSpace: 'nowrap' }}>
                      {deal.match_score}% fit
                    </span>
                  )}
                </div>

                {deal.description && <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{deal.description}</p>}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'rgba(0,0,0,0.25)', padding: '14px', borderRadius: '12px' }}>
                  <div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Budget per creator</div>
                    <div style={{ fontWeight: 800, color: '#00e676', fontSize: '20px', marginTop: '4px' }}>{inr(deal.budget_per_creator)}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Apply by</div>
                    <div style={{ color: '#fff', marginTop: '4px', fontSize: '15px', fontWeight: 600 }}>{deal.application_deadline || 'Open'}</div>
                  </div>
                </div>

                {items.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {items.map(i => (
                      <span key={i} style={{ fontSize: '12px', color: '#fff', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '100px', padding: '3px 10px' }}>{i}</span>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
                  <GlowButton variant="secondary" onClick={() => { setSelectedDeal(deal); setIsApplyModalOpen(false); }} style={{ flex: 1, fontSize: '14px', padding: '10px' }}>
                    View brief
                  </GlowButton>
                  {deal.has_applied ? (
                    <button disabled style={{ flex: 1, background: 'rgba(0,230,118,0.2)', border: '1px solid rgba(0,230,118,0.4)', color: '#00e676', borderRadius: '10px', fontSize: '14px', fontWeight: 600 }}>
                      Applied ✓{deal.application_status && deal.application_status !== 'SUBMITTED' ? ` · ${deal.application_status.toLowerCase()}` : ''}
                    </button>
                  ) : (
                    <GlowButton variant="glow" disabled={!handle} onClick={() => openApply(deal)} style={{ flex: 1, fontSize: '14px', padding: '10px' }}>
                      {handle ? 'Apply' : 'Add handle to apply'}
                    </GlowButton>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedDeal && !isApplyModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glow-card" style={{ width: '100%', maxWidth: '640px', background: '#0D0D14', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '16px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '18px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>{selectedDeal.campaign_name}</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{selectedDeal.brand_name}</span>
              </div>
              <X size={20} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setSelectedDeal(null)} />
            </div>

            {selectedDeal.description && <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{selectedDeal.description}</p>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '10px', fontSize: '12.5px' }}>
              {selectedDeal.product_name && <div><span style={{ color: 'var(--text-secondary)' }}>Product:</span> <b style={{ color: '#fff' }}>{selectedDeal.product_name}</b></div>}
              {selectedDeal.objective && <div><span style={{ color: 'var(--text-secondary)' }}>Objective:</span> <b style={{ color: '#fff' }}>{selectedDeal.objective}</b></div>}
              <div><span style={{ color: 'var(--text-secondary)' }}>Platform:</span> <b style={{ color: '#fff' }}>{selectedDeal.platform}</b></div>
              <div><span style={{ color: 'var(--text-secondary)' }}>Niche:</span> <b style={{ color: '#fff' }}>{selectedDeal.niche}</b></div>
              <div><span style={{ color: 'var(--text-secondary)' }}>Location:</span> <b style={{ color: '#fff' }}>{selectedDeal.location}</b></div>
              <div><span style={{ color: 'var(--text-secondary)' }}>Creators wanted:</span> <b style={{ color: '#fff' }}>{selectedDeal.creators_required || 1}</b></div>
              <div><span style={{ color: 'var(--text-secondary)' }}>Budget per creator:</span> <b style={{ color: '#00e676' }}>{inr(selectedDeal.budget_per_creator)}</b></div>
              <div><span style={{ color: 'var(--text-secondary)' }}>Apply by:</span> <b style={{ color: '#fff' }}>{selectedDeal.application_deadline || 'Open'}</b></div>
            </div>

            {deliverableNames(selectedDeal.deliverables_json).length > 0 && (
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                <b style={{ color: '#fff' }}>Deliverables:</b> {deliverableNames(selectedDeal.deliverables_json).join(', ')}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '6px' }}>
              <GlowButton variant="secondary" onClick={() => setSelectedDeal(null)}>Close</GlowButton>
              {!selectedDeal.has_applied && (
                <GlowButton variant="glow" disabled={!handle} onClick={() => openApply(selectedDeal)}>
                  {handle ? 'Apply to this brief ➔' : 'Add handle to apply'}
                </GlowButton>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedDeal && isApplyModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glow-card" style={{ width: '100%', maxWidth: '580px', background: '#0D0D14', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '16px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>Apply to {selectedDeal.campaign_name}</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{selectedDeal.brand_name} · applying as @{handle}</span>
              </div>
              <X size={20} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setIsApplyModalOpen(false)} />
            </div>

            <div className="form-group">
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Your proposal *</label>
              <textarea value={proposalText} onChange={e => setProposalText(e.target.value)} placeholder="Introduce yourself, mention relevant past work, and explain how you would approach this brief" rows={4} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Your fee (₹) *</label>
                <input type="number" min={1} value={proposedPrice || ''} onChange={e => setProposedPrice(Number(e.target.value))} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Delivery (days)</label>
                <input type="number" min={1} value={deliveryDays} onChange={e => setDeliveryDays(Math.max(1, Number(e.target.value) || 1))} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '6px' }}>
              <GlowButton variant="secondary" onClick={() => setIsApplyModalOpen(false)}>Cancel</GlowButton>
              <GlowButton variant="glow" disabled={submitting} onClick={handleApplySubmit}>
                {submitting ? 'Submitting…' : 'Submit application 🚀'}
              </GlowButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── CREATOR: MY COLLABS ──────────────────────────────────────────────────────
interface MyApplication extends DealApplicationItem {
  platform?: string | null;
  deal_status?: string | null;
  deliverable_deadline?: string | null;
  deliverables_total?: number;
  deliverables_approved?: number;
  deliverables_revision_requested?: number;
  created_at?: string | null;
}

const APP_STATUS: Record<string, { c: string; b: string; label: string }> = {
  SUBMITTED: { c: '#ffae00', b: 'rgba(255,174,0,0.15)', label: 'Application under review' },
  SHORTLISTED: { c: '#8B85FF', b: 'rgba(90,82,255,0.15)', label: 'Shortlisted' },
  NEGOTIATION: { c: '#8B85FF', b: 'rgba(90,82,255,0.15)', label: 'In negotiation' },
  ACCEPTED: { c: '#8B85FF', b: 'rgba(90,82,255,0.15)', label: 'Accepted — terms coming' },
  CONFIRMED: { c: '#5a8dff', b: 'rgba(90,141,255,0.15)', label: 'Terms confirmed — deliver content' },
  COMPLETED: { c: '#00e676', b: 'rgba(0,230,118,0.15)', label: 'Campaign completed' },
  DECLINED: { c: '#FF4D4D', b: 'rgba(255,77,77,0.15)', label: 'Not selected' },
};

export const CreatorApplicationsView: React.FC<{
  creatorHandle: string;
  onOpenChatWithBrand?: (brandName: string) => void;
  onOpenProfileSetup?: () => void;
}> = ({ creatorHandle, onOpenChatWithBrand, onOpenProfileSetup }) => {
  const handle = (creatorHandle || '').replace('@', '').trim().toLowerCase();
  const [apps, setApps] = useState<MyApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openAppId, setOpenAppId] = useState<number | null>(null);
  const [subs, setSubs] = useState<DeliverableSubmissionItem[]>([]);
  const [drafts, setDrafts] = useState<Record<number, { url: string; caption: string }>>({});
  const [busy, setBusy] = useState<number | null>(null);

  /* Was /api/posted-deals/creator/applications/{handle}, a route removed when the backend
     stopped handing any creator's history to anyone who knew their handle - so this screen
     was permanently empty. /mine answers for the signed-in account only. */
  const load = () => {
    fetch('/api/posted-deals/mine')
      .then(async r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => { setApps(Array.isArray(data) ? data : []); setError(null); })
      .catch(() => setError('Could not load your collaborations. Retrying shortly.'))
      .finally(() => setLoading(false));
  };
  usePolling(load, []);

  const loadSubs = (appId: number) => {
    fetch(`/api/posted-deals/applications/${appId}/submissions`)
      .then(r => (r.ok ? r.json() : []))
      .then(d => setSubs(Array.isArray(d) ? d : []))
      .catch(() => setSubs([]));
  };
  useEffect(() => {
    if (openAppId === null) { setSubs([]); return; }
    loadSubs(openAppId);
    const t = setInterval(() => { if (document.visibilityState === 'visible') loadSubs(openAppId); }, POLL_MS);
    return () => clearInterval(t);
  }, [openAppId]);

  const submitDeliverable = async (app: MyApplication, sub: DeliverableSubmissionItem) => {
    const draft = drafts[sub.id] || { url: '', caption: '' };
    if (!/^https?:\/\//i.test(draft.url.trim())) {
      alert('Paste a link to the content — the live post or a shareable draft (starting with https://).');
      return;
    }
    setBusy(sub.id);
    try {
      const r = await fetch(`/api/posted-deals/applications/${app.id}/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: sub.title, submission_type: 'url', content_url: draft.url.trim(), caption: draft.caption.trim() || null }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || `Request failed (${r.status})`);
      setDrafts(prev => { const next = { ...prev }; delete next[sub.id]; return next; });
      loadSubs(app.id);
      load();
    } catch (e) {
      alert(`Could not submit "${sub.title}": ${e instanceof Error ? e.message : e}`);
    }
    setBusy(null);
  };

  const handleRequestPayout = async (app: MyApplication) => {
    // A failed request must fail visibly: telling a creator they are owed money when nothing
    // was recorded is the worst outcome this screen can produce.
    setBusy(-app.id);
    try {
      const r = await fetch(`/api/posted-deals/applications/${app.id}/payout`, { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || `Request failed (${r.status})`);
      alert('Payment requested ✓ Team Raftra reviews it and arranges the transfer.');
      load();
    } catch (e) {
      alert(`Could not request payment: ${e instanceof Error ? e.message : e}\n\nNothing has been recorded — please try again.`);
    }
    setBusy(null);
  };

  const active = apps.filter(a => a.status === 'CONFIRMED');
  const others = apps.filter(a => a.status !== 'CONFIRMED');

  const renderCard = (app: MyApplication) => {
    const st = APP_STATUS[app.status] || APP_STATUS.SUBMITTED;
    const agreed = app.final_price != null;
    const isOpen = openAppId === app.id;
    const hasWork = app.status === 'CONFIRMED' || app.status === 'COMPLETED';
    return (
      <div key={app.id} className="glow-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: 'rgba(15,15,22,0.7)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>{app.campaign_name || 'Campaign'}</h3>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '6px' }}>
              {app.brand_name && <>Brand: <span style={{ color: '#fff', fontWeight: 600 }}>{app.brand_name}</span> · </>}
              {agreed ? 'Agreed fee' : 'Your ask'}: <span style={{ color: '#00e676', fontWeight: 700 }}>{inr(agreed ? app.final_price : app.proposed_price)}</span>
            </div>
            {hasWork && (
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                {app.final_deliverables && <>Deliverables: <b style={{ color: '#fff' }}>{app.final_deliverables}</b> · </>}
                {app.deliverables_approved || 0}/{app.deliverables_total || 0} approved
                {!!app.deliverables_revision_requested && <span style={{ color: '#ff8a5c' }}> · {app.deliverables_revision_requested} need changes</span>}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 700, padding: '6px 14px', borderRadius: '20px', background: st.b, color: st.c }}>{st.label}</span>
            {onOpenChatWithBrand && app.brand_name && (
              <button onClick={() => onOpenChatWithBrand(app.brand_name || '')} style={{ padding: '7px 14px', background: 'rgba(90,82,255,0.15)', border: '1px solid rgba(90,82,255,0.3)', color: '#8B85FF', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                💬 Message brand
              </button>
            )}
            {hasWork && (
              <GlowButton variant="secondary" onClick={() => setOpenAppId(isOpen ? null : app.id)} style={{ fontSize: '13px', padding: '7px 14px' }}>
                {isOpen ? 'Hide deliverables' : 'Deliverables'}
              </GlowButton>
            )}
            {app.status === 'COMPLETED' && !app.cashout_requested && (
              <GlowButton variant="glow" disabled={busy === -app.id} onClick={() => handleRequestPayout(app)} style={{ fontSize: '13px' }}>
                Request payment ({inr(app.final_price ?? app.proposed_price)})
              </GlowButton>
            )}
            {app.cashout_requested && (
              <span style={{ fontSize: '12.5px', color: '#5A8DFF', background: 'rgba(90,141,255,0.15)', padding: '6px 12px', borderRadius: '10px', fontWeight: 600 }}>
                Payment: {(app.cashout_status || 'REQUESTED').toLowerCase()}
              </span>
            )}
          </div>
        </div>

        {isOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
            {subs.length === 0 ? (
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>No deliverables are listed on this collaboration yet.</div>
            ) : subs.map(sub => {
              const canSubmit = app.status === 'CONFIRMED' && (sub.status === 'PENDING' || sub.status === 'REVISION_REQUESTED');
              const draft = drafts[sub.id] || { url: '', caption: '' };
              return (
                <div key={sub.id} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{sub.title}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>Due: {sub.due_date || app.deliverable_deadline || 'not set'}</div>
                    </div>
                    <SubStatusPill status={sub.status} />
                  </div>
                  {sub.status === 'REVISION_REQUESTED' && sub.revision_reason && (
                    <div style={{ fontSize: '12.5px', color: '#ff8a5c' }}>Brand asked: {sub.revision_reason}</div>
                  )}
                  {sub.content_url && !canSubmit && (
                    <a href={sub.content_url} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#5A8DFF' }}>Your submission 🔗</a>
                  )}
                  {canSubmit && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <input type="url" placeholder="https://… link to the content" value={draft.url} onChange={e => setDrafts(p => ({ ...p, [sub.id]: { ...draft, url: e.target.value } }))} style={{ flex: 2, minWidth: '200px', padding: '8px 10px', background: 'rgba(0,0,0,0.35)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '12.5px' }} />
                      <input type="text" placeholder="Caption or note (optional)" value={draft.caption} onChange={e => setDrafts(p => ({ ...p, [sub.id]: { ...draft, caption: e.target.value } }))} style={{ flex: 1, minWidth: '160px', padding: '8px 10px', background: 'rgba(0,0,0,0.35)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '12.5px' }} />
                      <GlowButton variant="glow" disabled={busy === sub.id} onClick={() => submitDeliverable(app, sub)} style={{ fontSize: '12px', padding: '7px 14px' }}>
                        {busy === sub.id ? 'Submitting…' : sub.status === 'REVISION_REQUESTED' ? 'Resubmit' : 'Submit for review'}
                      </GlowButton>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '26px', fontWeight: 700, color: '#fff' }}>My Collabs</h2>
        <p style={{ fontSize: '15px', color: 'var(--text-secondary)', marginTop: '6px' }}>
          Your applications to brand briefs, confirmed collaborations and their deliverables, and payment requests.
        </p>
      </div>

      {!handle && <NoHandleNotice onSetup={onOpenProfileSetup} />}
      {error && <div style={{ fontSize: '13px', color: '#ff8a8a' }}>{error}</div>}

      {loading ? (
        <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>Loading your collaborations…</div>
      ) : apps.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: '14px' }}>
          <div style={{ fontSize: '15px', color: '#fff', fontWeight: 700, marginBottom: '6px' }}>No collaborations yet</div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Apply to a brief in Brand Opportunities. Once a brand confirms terms, the collaboration and its deliverables appear here.</div>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)' }}>ACTIVE COLLABORATIONS ({active.length})</div>
              {active.map(renderCard)}
            </div>
          )}
          {others.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)' }}>APPLICATIONS &amp; PAST CAMPAIGNS ({others.length})</div>
              {others.map(renderCard)}
            </div>
          )}
        </>
      )}
    </div>
  );
};
