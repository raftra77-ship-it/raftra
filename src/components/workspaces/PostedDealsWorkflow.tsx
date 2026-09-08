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
  const [revisionReasonText, setRevisionReasonText] = useState('');
  const [selectedSubForRevision, setSelectedSubForRevision] = useState<DeliverableSubmissionItem | null>(null);

  const fetchBrandDeals = () => {
    fetch(`/api/posted-deals/brand/${workspaceId}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setDeals(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBrandDeals();
  }, [workspaceId]);

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
    // No fixture fallback. `sampleApplicants` used to fill this list whenever the API
    // returned nothing OR failed, so a brand with zero applicants saw four invented
    // creators - complete with names, rates and follower counts - and had no way to tell
    // them from real ones. An empty deal must look empty.
    fetch(`/api/posted-deals/${deal.id}/applications`)
      .then(r => (r.ok ? r.json() : []))
      .then(data => setApplications(Array.isArray(data) ? data : []))
      .catch(() => setApplications([]));
  };

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

  const handleFinalizeTerms = (app: DealApplicationItem) => {
    const finalPrice = app.proposed_price || 15000;
    fetch(`/api/posted-deals/applications/${app.id}/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        final_price: finalPrice,
        final_deliverables: 'Instagram Reel, Instagram Story #1, Instagram Story #2',
        final_delivery_days: app.estimated_delivery_days || 7,
        usage_rights: '30 Days Digital Rights',
        revisions_allowed: 1
      })
    })
      .then(r => r.json())
      .then(() => {
        handleOpenCollabWorkspace({ ...app, status: 'CONFIRMED', final_price: finalPrice });
      })
      .catch(() => {
        handleOpenCollabWorkspace({ ...app, status: 'CONFIRMED', final_price: finalPrice });
      });
  };

  const handleOpenCollabWorkspace = (app: DealApplicationItem) => {
    setActiveCollabApp(app);
    // Three invented deliverables used to appear here whenever a collab had none - an
    // "Instagram Reel" whose thumbnail was a stock Unsplash photo, plus two stories. A
    // brand could sit reviewing submissions no creator had ever uploaded.
    fetch(`/api/posted-deals/applications/${app.id}/submissions`)
      .then(r => (r.ok ? r.json() : []))
      .then(data => setCollabSubmissions(Array.isArray(data) ? data : []))
      .catch(() => setCollabSubmissions([]));
  };

  const handleReviewSubmission = (subId: number, status: 'APPROVED' | 'REVISION_REQUESTED', reason?: string) => {
    fetch(`/api/posted-deals/submissions/${subId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, revision_reason: reason })
    })
      .then(async r => {
        if (!r.ok) throw new Error(`Request failed (${r.status})`);
        setCollabSubmissions(prev => prev.map(s => s.id === subId ? { ...s, status, revision_reason: reason } : s));
        setSelectedSubForRevision(null);
      })
      .catch(e => alert(`Could not record this review: ${e instanceof Error ? e.message : e}\n\nThe creator has not been notified.`));
  };

  const handleCompleteCampaign = (appId: number) => {
    // Completing a campaign is what unlocks the creator's payout, so faking it in the catch
    // told a brand the campaign was closed and the creator could cash out while the server
    // still had it open - a disagreement about money between two screens.
    fetch(`/api/posted-deals/applications/${appId}/complete`, { method: 'POST' })
      .then(async r => {
        if (!r.ok) throw new Error(`Request failed (${r.status})`);
        setActiveCollabApp(prev => prev ? { ...prev, status: 'COMPLETED' } : null);
        alert('Campaign marked COMPLETED! Creator can now request payout cashout.');
      })
      .catch(e => alert(`Could not complete this campaign: ${e instanceof Error ? e.message : e}\n\nNothing has changed — please try again.`));
  };

  const filteredApps = applications.filter(a => {
    if (appFilter === 'SHORTLISTED') return a.status === 'SHORTLISTED';
    if (appFilter === 'ACCEPTED') return a.status === 'ACCEPTED' || a.status === 'CONFIRMED';
    return true;
  });

  // Real finalized collaborations for this workspace, from the endpoint added alongside
  // this change. Previously a hardcoded array: one invented creator ("Samaira Rao", an
  // Unsplash headshot) on an invented campaign, identical for every brand, and clickable
  // through into a collab workspace for a deal that did not exist.
  const [activeCollaborations, setActiveCollaborations] = useState<DealApplicationItem[]>([]);
  const [collabsLoading, setCollabsLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) { setCollabsLoading(false); return; }
    const token = localStorage.getItem('token');
    setCollabsLoading(true);
    fetch(`/api/posted-deals/brand/${workspaceId}/collaborations`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => (r.ok ? r.json() : []))
      .then(d => setActiveCollaborations(Array.isArray(d) ? d : []))
      .catch(() => setActiveCollaborations([]))
      .finally(() => setCollabsLoading(false));
  }, [workspaceId]);

  if (mode === 'my_collaborations') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
            My Collaborations <span style={{ fontSize: '11px', background: 'rgba(0,230,118,0.15)', color: '#00e676', border: '1px solid rgba(0,230,118,0.3)', padding: '2px 8px', borderRadius: '12px' }}>Active Finalized Deals</span>
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Manage active finalized creator deals with Raftra Escrow protection and deliverable reviews.
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
                Once you accept a creator's application on one of your posted deals, the
                collaboration appears here with its deliverables and escrow status.
              </div>
            </div>
          )}
          {activeCollaborations.map(collab => (
            <div key={collab.id} className="glow-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15,15,22,0.7)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '20px', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <img src={collab.creator_avatar} alt="" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} />
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {collab.creator_name} <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>@{collab.creator_handle}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: 600, marginTop: '2px' }}>{collab.campaign_name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Deliverables: <b style={{ color: '#fff' }}>{collab.final_deliverables}</b> · Delivery: {collab.final_delivery_days} Days
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#00e676' }}>₹{(collab.final_price || collab.proposed_price).toLocaleString()}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Raftra Vault Funded</div>
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

        {/* Deliverables Workspace Modal */}
        {activeCollabApp && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div className="glow-card" style={{ width: '100%', maxWidth: '820px', background: '#0D0D14', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '16px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>Collaboration Workspace</h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Brand ↔ {activeCollabApp.creator_name} (@{activeCollabApp.creator_handle})</span>
                </div>
                <X size={20} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setActiveCollabApp(null)} />
              </div>

              {/* Terms Overview */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '10px', fontSize: '12.5px' }}>
                <div><span style={{ color: 'var(--text-secondary)' }}>Final Price:</span> <b style={{ color: '#fff' }}>₹{(activeCollabApp.final_price || activeCollabApp.proposed_price).toLocaleString()}</b></div>
                <div><span style={{ color: 'var(--text-secondary)' }}>Delivery Days:</span> <b style={{ color: '#fff' }}>{activeCollabApp.final_delivery_days || 7} Days</b></div>
                <div><span style={{ color: 'var(--text-secondary)' }}>Usage Rights:</span> <b style={{ color: '#fff' }}>30 Days Digital Rights</b></div>
              </div>

              {/* Deliverables Checklist */}
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>Deliverables Progress:</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {collabSubmissions.map(sub => (
                    <div key={sub.id} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{sub.title}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Due: {sub.due_date || '20 Aug'}</div>
                        {sub.content_url && (
                          <a href={sub.content_url} target="_blank" rel="noreferrer" style={{ fontSize: '11.5px', color: '#5A8DFF', display: 'inline-block', marginTop: '4px' }}>View Submitted Content 🔗</a>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px', background: sub.status === 'APPROVED' ? 'rgba(0,230,118,0.15)' : 'rgba(255,174,0,0.15)', color: sub.status === 'APPROVED' ? '#00e676' : '#ffae00' }}>
                          {sub.status}
                        </span>
                        {sub.status === 'SUBMITTED' && (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <GlowButton variant="glow" onClick={() => handleReviewSubmission(sub.id, 'APPROVED')} style={{ fontSize: '11px', padding: '4px 8px' }}>Approve ✓</GlowButton>
                            <GlowButton variant="secondary" onClick={() => setSelectedSubForRevision(sub)} style={{ fontSize: '11px', padding: '4px 8px' }}>Revision 📝</GlowButton>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Complete Campaign CTA */}
              {collabSubmissions.every(s => s.status === 'APPROVED') && (
                <div style={{ background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: '10px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#00e676' }}>All Deliverables Approved ✓</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>You can now mark the campaign completed to release creator cashout.</div>
                  </div>
                  <GlowButton variant="glow" onClick={() => handleCompleteCampaign(activeCollabApp.id)}>
                    Complete Campaign 🏆
                  </GlowButton>
                </div>
              )}
            </div>
          </div>
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
                  <div style={{ color: '#fff', marginTop: '2px' }}>{deal.application_deadline || '30 Aug'}</div>
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
                      {app.status !== 'ACCEPTED' && app.status !== 'CONFIRMED' && (
                        <GlowButton variant="glow" onClick={() => { handleUpdateAppStatus(app.id, 'ACCEPTED'); handleFinalizeTerms(app); }} style={{ fontSize: '11.5px', padding: '5px 10px' }}>
                          Accept & Finalize
                        </GlowButton>
                      )}
                      {(app.status === 'ACCEPTED' || app.status === 'CONFIRMED') && (
                        <GlowButton variant="glow" onClick={() => handleOpenCollabWorkspace(app)} style={{ fontSize: '11.5px', padding: '5px 10px' }}>
                          Open Workspace ➔
                        </GlowButton>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── COLLABORATION & DELIVERABLES WORKSPACE MODAL ──────────────────────── */}
      {activeCollabApp && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glow-card" style={{ width: '100%', maxWidth: '820px', background: '#0D0D14', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '16px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>Collaboration Workspace</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Brand ↔ {activeCollabApp.creator_name} (@{activeCollabApp.creator_handle})</span>
              </div>
              <X size={20} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setActiveCollabApp(null)} />
            </div>

            {/* Terms Overview */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '10px', fontSize: '12.5px' }}>
              <div><span style={{ color: 'var(--text-secondary)' }}>Final Price:</span> <b style={{ color: '#fff' }}>₹{(activeCollabApp.final_price || activeCollabApp.proposed_price).toLocaleString()}</b></div>
              <div><span style={{ color: 'var(--text-secondary)' }}>Delivery Days:</span> <b style={{ color: '#fff' }}>{activeCollabApp.final_delivery_days || 7} Days</b></div>
              <div><span style={{ color: 'var(--text-secondary)' }}>Usage Rights:</span> <b style={{ color: '#fff' }}>30 Days Digital Rights</b></div>
            </div>

            {/* Deliverables Checklist */}
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>Deliverables Progress:</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {collabSubmissions.map(sub => (
                  <div key={sub.id} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{sub.title}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Due: {sub.due_date || '20 Aug'}</div>
                      {sub.content_url && (
                        <a href={sub.content_url} target="_blank" rel="noreferrer" style={{ fontSize: '11.5px', color: '#5A8DFF', display: 'inline-block', marginTop: '4px' }}>View Submitted Content 🔗</a>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px', background: sub.status === 'APPROVED' ? 'rgba(0,230,118,0.15)' : 'rgba(255,174,0,0.15)', color: sub.status === 'APPROVED' ? '#00e676' : '#ffae00' }}>
                        {sub.status}
                      </span>
                      {sub.status === 'SUBMITTED' && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <GlowButton variant="glow" onClick={() => handleReviewSubmission(sub.id, 'APPROVED')} style={{ fontSize: '11px', padding: '4px 8px' }}>Approve ✓</GlowButton>
                          <GlowButton variant="secondary" onClick={() => setSelectedSubForRevision(sub)} style={{ fontSize: '11px', padding: '4px 8px' }}>Revision 📝</GlowButton>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Revision Request Popup */}
            {selectedSubForRevision && (
              <div style={{ background: 'rgba(255,174,0,0.1)', border: '1px solid rgba(255,174,0,0.3)', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffae00' }}>Request Revision for {selectedSubForRevision.title}:</div>
                <input type="text" value={revisionReasonText} onChange={e => setRevisionReasonText(e.target.value)} placeholder="e.g. Please update CTA in final frame to include discount code..." style={{ width: '100%', padding: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', fontSize: '12.5px' }} />
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <GlowButton variant="secondary" onClick={() => setSelectedSubForRevision(null)} style={{ fontSize: '11px', padding: '4px 8px' }}>Cancel</GlowButton>
                  <GlowButton variant="glow" onClick={() => handleReviewSubmission(selectedSubForRevision.id, 'REVISION_REQUESTED', revisionReasonText)} style={{ fontSize: '11px', padding: '4px 8px' }}>Send Revision Request</GlowButton>
                </div>
              </div>
            )}

            {/* Complete Campaign CTA */}
            {collabSubmissions.every(s => s.status === 'APPROVED') && (
              <div style={{ background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: '10px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#00e676' }}>All Deliverables Approved ✓</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>You can now mark the campaign completed to release creator cashout.</div>
                </div>
                <GlowButton variant="glow" onClick={() => handleCompleteCampaign(activeCollabApp.id)}>
                  Complete Campaign 🏆
                </GlowButton>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── CREATOR BRAND OPPORTUNITIES VIEW ─────────────────────────────────────────
export const CreatorBrandOpportunitiesView: React.FC<{
  creatorHandle: string;
  creatorName: string;
  creatorAvatar?: string;
  creatorFollowers?: string;
  onOpenChatWithBrand?: (brandId: string, campaignName?: string) => void;
}> = ({ creatorHandle, creatorName, creatorAvatar, creatorFollowers, onOpenChatWithBrand }) => {
  const [deals, setDeals] = useState<PostedDealItem[]>([]);
  const [selectedDeal, setSelectedDeal] = useState<PostedDealItem | null>(null);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [proposalText, setProposalText] = useState('');
  const [proposedPrice, setProposedPrice] = useState<number>(15000);
  const [appliedDealIds, setAppliedDealIds] = useState<number[]>([]);

  useEffect(() => {
    // Fixture brands ("Aura Premium", "Nykaa Fashion", with Unsplash logos and invented
    // budgets) used to fill this list whenever the API returned nothing or failed, so a
    // creator browsing opportunities could apply to campaigns that never existed.
    fetch(`/api/posted-deals/discover?handle=${encodeURIComponent(creatorHandle)}`)
      .then(r => (r.ok ? r.json() : []))
      .then(data => setDeals(Array.isArray(data) ? data : []))
      .catch(() => setDeals([]));
  }, [creatorHandle]);

  const handleApplySubmit = () => {
    if (!selectedDeal) return;
    fetch(`/api/posted-deals/${selectedDeal.id}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creator_handle: creatorHandle,
        creator_name: creatorName,
        creator_avatar: creatorAvatar,
        creator_followers: creatorFollowers,
        proposal_text: proposalText || `I am excited to collaborate on ${selectedDeal.campaign_name}! I will deliver high converting content.`,
        proposed_price: proposedPrice || selectedDeal.budget_per_creator,
        availability_date: 'Immediate',
        estimated_delivery_days: 5
      })
    })
      .then(async r => {
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d.detail || `Request failed (${r.status})`);
        }
        setAppliedDealIds(prev => [...prev, selectedDeal.id]);
        setIsApplyModalOpen(false);
        alert(`Application Submitted ✓ Your proposal has been sent to ${selectedDeal.brand_name}!`);
      })
      // Marking the deal applied in the catch told a creator their proposal had been sent
      // when it had not - and the button then read "Applied", so they could not retry.
      .catch(e => {
        alert(`Could not submit your application: ${e instanceof Error ? e.message : e}

Please try again.`);
      });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '26px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
          Brand Opportunities <span style={{ fontSize: '13px', background: 'rgba(90,82,255,0.2)', color: '#8B85FF', border: '1px solid rgba(90,82,255,0.3)', padding: '3px 10px', borderRadius: '12px' }}>New Deals ③</span>
        </h2>
        <p style={{ fontSize: '15px', color: 'var(--text-secondary)', marginTop: '6px' }}>
          Find campaigns posted by brands looking for creators like you.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(360px, 100%), 1fr))', gap: '22px' }}>
        {deals.map(deal => {
          const isApplied = appliedDealIds.includes(deal.id) || deal.has_applied;
          return (
            <div key={deal.id} className="glow-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(15,15,22,0.7)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>{deal.campaign_name} <span style={{ fontSize: '12px', color: '#8B85FF', background: 'rgba(90,82,255,0.15)', padding: '2px 6px', borderRadius: '6px', fontWeight: 600 }}>(Demo)</span></h3>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>{deal.brand_name} · {deal.platform} · {deal.location}</div>
                </div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#00e676', background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.25)', borderRadius: '20px', padding: '4px 12px', whiteSpace: 'nowrap' }}>
                  ⚡ {deal.match_score || 94}% Brand Fit
                </span>
              </div>

              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {deal.description}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'rgba(0,0,0,0.25)', padding: '14px', borderRadius: '12px' }}>
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Est. Payout</div>
                  <div style={{ fontWeight: 800, color: '#00e676', fontSize: '20px', marginTop: '4px' }}>₹{deal.budget_per_creator.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Deadline</div>
                  <div style={{ color: '#fff', marginTop: '4px', fontSize: '15px', fontWeight: 600 }}>{deal.application_deadline || '20 Aug 2026'}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <GlowButton variant="secondary" onClick={() => setSelectedDeal(deal)} style={{ flex: 1, fontSize: '14px', padding: '10px' }}>
                  View Deal
                </GlowButton>

                {isApplied ? (
                  <button disabled style={{ flex: 1, background: 'rgba(0,230,118,0.2)', border: '1px solid rgba(0,230,118,0.4)', color: '#00e676', borderRadius: '10px', fontSize: '14px', fontWeight: 600 }}>
                    Applied ✓
                  </button>
                ) : (
                  <GlowButton variant="glow" onClick={() => { setSelectedDeal(deal); setProposedPrice(deal.budget_per_creator); setIsApplyModalOpen(true); }} style={{ flex: 1, fontSize: '14px', padding: '10px' }}>
                    Apply
                  </GlowButton>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* VIEW DEAL DETAILS MODAL */}
      {selectedDeal && !isApplyModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glow-card" style={{ width: '100%', maxWidth: '640px', background: '#0D0D14', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '16px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>{selectedDeal.campaign_name}</h3>
                <span style={{ fontSize: '12px', color: '#00e676' }}>⚡ {selectedDeal.match_score || 94}% Brand Fit Match</span>
              </div>
              <X size={20} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setSelectedDeal(null)} />
            </div>

            {/* Match explanation */}
            <div style={{ background: 'rgba(90,82,255,0.1)', border: '1px solid rgba(90,82,255,0.25)', borderRadius: '10px', padding: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px' }}>
              <div>✓ Niche Match: <b style={{ color: '#fff' }}>100%</b></div>
              <div>✓ Platform Match: <b style={{ color: '#fff' }}>100%</b></div>
              <div>✓ Audience Match: <b style={{ color: '#fff' }}>92%</b></div>
              <div>✓ Content Match: <b style={{ color: '#fff' }}>95%</b></div>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {selectedDeal.description}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '10px', fontSize: '12.5px' }}>
              <div><span style={{ color: 'var(--text-secondary)' }}>Brand:</span> <b style={{ color: '#fff' }}>{selectedDeal.brand_name}</b></div>
              <div><span style={{ color: 'var(--text-secondary)' }}>Est. Payout:</span> <b style={{ color: '#00e676' }}>₹{selectedDeal.budget_per_creator.toLocaleString()}</b></div>
              <div><span style={{ color: 'var(--text-secondary)' }}>Location:</span> <b style={{ color: '#fff' }}>{selectedDeal.location}</b></div>
              <div><span style={{ color: 'var(--text-secondary)' }}>Deadline:</span> <b style={{ color: '#fff' }}>{selectedDeal.application_deadline || '20 Aug'}</b></div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
              <GlowButton variant="secondary" onClick={() => setSelectedDeal(null)}>Close</GlowButton>
              <GlowButton variant="glow" onClick={() => { setProposedPrice(selectedDeal.budget_per_creator); setIsApplyModalOpen(true); }}>
                Apply to Deal ➔
              </GlowButton>
            </div>
          </div>
        </div>
      )}

      {/* APPLY TO DEAL MODAL */}
      {selectedDeal && isApplyModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glow-card" style={{ width: '100%', maxWidth: '580px', background: '#0D0D14', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '16px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>Apply to {selectedDeal.campaign_name}</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{selectedDeal.brand_name}</span>
              </div>
              <X size={20} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setIsApplyModalOpen(false)} />
            </div>

            <div className="form-group">
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Your Proposal / Cover Message *</label>
              <textarea value={proposalText} onChange={e => setProposalText(e.target.value)} placeholder="Introduce yourself, mention past brand collabs, and explain why you're a great fit for this campaign..." rows={4} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Requested Price (₹)</label>
                <input type="number" value={proposedPrice} onChange={e => setProposedPrice(Number(e.target.value))} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Estimated Delivery</label>
                <input type="text" value="5 Days" disabled style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
              <GlowButton variant="secondary" onClick={() => setIsApplyModalOpen(false)}>Cancel</GlowButton>
              <GlowButton variant="glow" onClick={handleApplySubmit}>
                Submit Application 🚀
              </GlowButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── CREATOR APPLICATIONS & CASH OUT VIEW ──────────────────────────────────────
export const CreatorApplicationsView: React.FC<{ 
  creatorHandle: string;
  onOpenChatWithBrand?: (brandName: string) => void;
}> = ({ creatorHandle, onOpenChatWithBrand }) => {
  const [apps, setApps] = useState<DealApplicationItem[]>([]);

  useEffect(() => {
    // Same fixture problem as the opportunities list above: a creator with no applications
    // saw invented ones, complete with statuses and payout amounts.
    fetch(`/api/posted-deals/creator/applications/${encodeURIComponent(creatorHandle)}`)
      .then(r => (r.ok ? r.json() : []))
      .then(data => setApps(Array.isArray(data) ? data : []))
      .catch(() => setApps([]));
  }, [creatorHandle]);

  const handleRequestCashout = (appId: number) => {
    // The catch here used to mark the payout REQUESTED and tell the creator
    // "Payout Request Submitted ✓" even when the request never reached the server. That is
    // the worst possible failure on this screen: someone is told they are owed money and
    // waits for a payout no one has any record of. A failed request must fail visibly.
    fetch(`/api/posted-deals/applications/${appId}/payout`, { method: 'POST' })
      .then(async r => {
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d.detail || `Request failed (${r.status})`);
        }
        setApps(prev => prev.map(a => a.id === appId ? { ...a, cashout_requested: true, cashout_status: 'REQUESTED' } : a));
        alert('Payout Request Submitted ✓ Admin verification in progress.');
      })
      .catch(e => {
        alert(`Could not submit the payout request: ${e instanceof Error ? e.message : e}\n\nNothing has been recorded — please try again.`);
      });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '26px', fontWeight: 700, color: '#fff' }}>My Applications &amp; Cashout</h2>
        <p style={{ fontSize: '15px', color: 'var(--text-secondary)', marginTop: '6px' }}>
          Track campaign approval status from brands and claim payout cashout.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {apps.map(app => {
          const isApproved = app.status === 'CONFIRMED' || app.status === 'ACCEPTED' || app.status === 'APPROVED';
          const isCompleted = app.status === 'COMPLETED';
          const isRejected = app.status === 'REJECTED';

          return (
            <div key={app.id} className="glow-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(15,15,22,0.7)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>{app.campaign_name} <span style={{ fontSize: '12px', color: '#8B85FF', background: 'rgba(90,82,255,0.15)', padding: '2px 6px', borderRadius: '6px', fontWeight: 600 }}>(Demo)</span></h3>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '6px' }}>Brand: <span style={{ color: '#fff', fontWeight: 600 }}>{app.brand_name}</span> &nbsp;·&nbsp; Price: <span style={{ color: '#00e676', fontWeight: 700 }}>₹{app.proposed_price.toLocaleString()}</span></div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={{ 
                    fontSize: '13px', 
                    fontWeight: 700, 
                    padding: '6px 16px', 
                    borderRadius: '20px', 
                    background: isCompleted ? 'rgba(0,230,118,0.15)' : isApproved ? 'rgba(90,82,255,0.15)' : isRejected ? 'rgba(255,77,77,0.15)' : 'rgba(255,174,0,0.15)', 
                    color: isCompleted ? '#00e676' : isApproved ? '#8B85FF' : isRejected ? '#FF4D4D' : '#ffae00' 
                  }}>
                    {isCompleted ? '✓ Campaign Completed' : isApproved ? '🔵 Brand Approved (Deal Confirmed)' : isRejected ? '❌ Application Rejected' : '🟡 Application Under Review'}
                  </span>

                  {onOpenChatWithBrand && (
                    <button 
                      onClick={() => onOpenChatWithBrand(app.brand_name || 'Brand Partner')}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        padding: '8px 16px', 
                        background: 'rgba(90,82,255,0.15)', 
                        border: '1px solid rgba(90,82,255,0.3)', 
                        color: '#8B85FF', 
                        borderRadius: '10px', 
                        cursor: 'pointer', 
                        fontSize: '13px', 
                        fontWeight: 600 
                      }}
                    >
                      💬 Message Brand (Inbox)
                    </button>
                  )}

                  {isCompleted && !app.cashout_requested && (
                    <GlowButton variant="glow" onClick={() => handleRequestCashout(app.id)} style={{ fontSize: '14px' }}>
                      Apply for Cashout (₹{app.proposed_price.toLocaleString()})
                    </GlowButton>
                  )}

                  {app.cashout_requested && (
                    <span style={{ fontSize: '13px', color: '#5A8DFF', background: 'rgba(90,141,255,0.15)', padding: '6px 14px', borderRadius: '10px', fontWeight: 600 }}>
                      Cashout Status: {app.cashout_status || 'REQUESTED'}
                    </span>
                  )}
                </div>
              </div>

              {/* Approval contact notification banner */}
              {isApproved && (
                <div style={{ background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: '12px', padding: '12px 16px', fontSize: '13.5px', color: '#00E676', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <span>🎉 <strong>Brand Approved Your Application!</strong> Brand team has received your profile details and will contact you via WhatsApp / Raftra Inbox to send creative brief.</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

