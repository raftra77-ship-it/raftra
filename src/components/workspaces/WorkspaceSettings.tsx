import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Sliders,
  Building,
  Sparkles,
  ToyBrick,
  Users2,
  CreditCard,
  Coins,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Mail,
  KeyRound,
  Trash2,
  ExternalLink,
  Plus,
  X,
  Check,
  Globe,
  ArrowRightLeft,
  CheckCircle,
  Download,
  Receipt,
  Zap,
  ShieldCheck,
  TrendingUp,
  Vault,
  DollarSign,
  Layers,
  FileCheck,
  Flame,
  PieChart
} from 'lucide-react';
import { GlowButton } from '../GlowButton';

export interface BrandItem {
  id: string;
  name: string;
  url: string;
  industry: string;
  color: string;
}

interface WorkspaceSettingsProps {
  onNavigateTab?: (tab: string) => void;
  brands?: BrandItem[];
  activeBrandId?: string;
  onSwitchBrand?: (brandId: string) => void;
  onAddBrand?: (brand: { name: string; url: string; industry: string; color: string }) => void;
  onDeleteBrand?: (brandId: string) => void;
  creditsBalance?: number;
  /** Opens the real Razorpay top-up in the dashboard. */
  onTopUpCredits?: (amount: number) => void;
  /** Sends the user to the real plan checkout. */
  onChoosePlan?: () => void;
  /** Scopes the creator-deal vault below. */
  workspaceId?: number | null;
}

export const WorkspaceSettings: React.FC<WorkspaceSettingsProps> = ({
  onNavigateTab,
  brands: externalBrands,
  activeBrandId: externalActiveBrandId,
  onSwitchBrand,
  onAddBrand,
  onDeleteBrand,
  creditsBalance: externalCreditsBalance,
  onTopUpCredits,
  onChoosePlan,
  workspaceId = null
}) => {
  const [activeSubTab, setActiveSubTab] = useState<string>('profile');
  
  // Profile settings state. The email was hardcoded to a real person's address, shown to
  // whoever was signed in.
  const [email, setEmail] = useState('');
  const [accountRole, setAccountRole] = useState('');
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const authHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    fetch('/api/auth/me', { headers: authHeaders() })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) { setEmail(d.email || ''); setAccountRole(d.role || ''); } })
      .catch(() => {});
  }, []);

  // Real payment history for the invoices table below.
  const [transactions, setTransactions] = useState<{
    id: number; amount: number; currency: string; purpose: string;
    status: string; payment_id: string | null; created_at: string | null;
  }[]>([]);

  useEffect(() => {
    fetch('/api/payments/transactions', { headers: authHeaders() })
      .then(r => (r.ok ? r.json() : []))
      .then(d => setTransactions(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);
  const [emailTipsEnabled, setEmailTipsEnabled] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Plans & Billing state (Indian Rupee Sync)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [currentPlanId, setCurrentPlanId] = useState<string>('d2c_suite');

  // Internal Brands fallback state if not provided
  const [internalBrands, setInternalBrands] = useState<BrandItem[]>([
    { id: 'b1', name: 'Demo Brand', url: 'https://demobrand.com/', industry: 'Consumer Electronics & D2C', color: '#FF6B00' },
    { id: 'b2', name: 'Aura Premium', url: 'https://aura.com/', industry: 'Lifestyle Tech', color: '#5A52FF' }
  ]);
  const [internalActiveId, setInternalActiveId] = useState('b1');

  const currentBrands = externalBrands || internalBrands;
  const currentActiveId = externalActiveBrandId || internalActiveId;

  // Add Brand Modal State
  const [showAddBrandModal, setShowAddBrandModal] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [newBrandUrl, setNewBrandUrl] = useState('');
  const [newBrandIndustry, setNewBrandIndustry] = useState('Consumer Electronics');
  const [newBrandColor, setNewBrandColor] = useState('#00D2FF');

  // Team settings state
  const [teamName, setTeamName] = useState("aryan070606's Team");
  
  // Credits State (Synced)
  const [internalCredits, setInternalCredits] = useState(12000);
  const creditsBalance = externalCreditsBalance !== undefined ? externalCreditsBalance : internalCredits;
  const totalAllocatedCredits = 30000;
  const creditsUsed = totalAllocatedCredits - creditsBalance;
  const creditsUsedPercentage = Math.round((creditsUsed / totalAllocatedCredits) * 100);

  const [members, setMembers] = useState([
    { name: 'Aryan (You)', email: 'aryan070606@gmail.com', role: 'Owner', status: 'Active' },
    { name: 'Marketing Lead', email: 'growth@demobrand.com', role: 'Admin', status: 'Invited' }
  ]);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Escrow Vault State
  // Real brand-creator deals. Was five invented creators with invented amounts, totalled
  // into an escrow figure the brand was told was being held for them.
  const [vaultEscrowList, setVaultEscrowList] = useState<{
    id: number; influencer_name: string; influencer_handle: string;
    deliverables: string; amount: number; status: string; created_at?: string | null;
  }[]>([]);

  useEffect(() => {
    if (!workspaceId) return;
    fetch(`/api/deals/brand/${workspaceId}`, { headers: authHeaders() })
      .then(r => (r.ok ? r.json() : []))
      .then(d => setVaultEscrowList(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [workspaceId]);

  // "paid" is money already with the creator; everything before that is still held.
  const isHeld = (s: string) => ['pending', 'active', 'delivered'].includes((s || '').toLowerCase());

  const totalVaultLocked = vaultEscrowList
    .filter(v => isHeld(v.status))
    .reduce((sum, v) => sum + (Number(v.amount) || 0), 0);
  const totalVaultReleased = vaultEscrowList
    .filter(v => (v.status || '').toLowerCase() === 'paid')
    .reduce((sum, v) => sum + (Number(v.amount) || 0), 0);

  // INR Pricing Plans Synced with PricingScreen
  const INR_PLANS = [
    {
      id: 'creator_launch',
      name: 'Creator & Ads Launch Pack',
      monthlyInr: 4999,
      annualInr: 49999,
      badge: 'Starter Growth',
      description: 'Ideal for scaling early D2C creators and launching initial high-converting ad variations.',
      features: [
        'AI Creative Studio (100 static ads/mo)',
        '10 UGC Video storyboards',
        '10 Influencer collaboration workflows',
        'Meta & Google Ads sandbox staging',
        'Basic ROAS telemetry'
      ]
    },
    {
      id: 'd2c_suite',
      name: 'D2C Growth Suite',
      monthlyInr: 8999,
      annualInr: 89999,
      badge: 'Most Popular 🔥',
      highlight: true,
      description: 'Full autonomous marketing system with dynamic ad generation, daily bid scaling, and competitor audits.',
      features: [
        'Everything in Creator Launch',
        'Unlimited AI Creative variants & hook iterations',
        'Autonomous Meta & Google Ads bid scaling rule engine',
        'Daily Competitor Intelligence audits & ad scrapes',
        '25 Verified Influencer outreach credits',
        'Multi-Agent Graph Orchestration'
      ]
    },
    {
      id: 'business_suite',
      name: 'Full Business & Agency Suite',
      monthlyInr: 19999,
      annualInr: 199999,
      badge: 'Scale Multi-Brand',
      description: 'Enterprise grade power for high-volume stores and performance marketing agencies.',
      features: [
        'Everything in D2C Growth Suite',
        'Unlimited Brand Profiles & Knowledge Bases',
        'SEO & AEO Answer-Engine citation indexer',
        'HubSpot, Slack & GA4 Webhook Integrations',
        'Dedicated Growth Account Strategist',
        'Custom Fine-Tuned Brand LLM LoRA'
      ]
    }
  ];

  // Opens Razorpay through the dashboard. It used to add the credits to a local number and
  // announce "Successfully added" before any payment had happened.
  const handleTopUp = (amount: number) => {
    if (!onTopUpCredits) {
      setNotice({ ok: false, text: 'Top-up is unavailable on this screen.' });
      return;
    }
    onTopUpCredits(amount);
  };

  // handleReleaseEscrow lived here. It flipped a row in a local array to "Released to
  // Creator" and announced the transfer; no money moved and no endpoint was called. Paying
  // a creator runs through payout_routes and an approval step, which this screen has no
  // part in, so the button is gone rather than reimplemented badly.

  const handleSelectBrand = (id: string) => {
    if (onSwitchBrand) {
      onSwitchBrand(id);
    } else {
      setInternalActiveId(id);
    }
  };

  const handleCreateBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandName.trim()) return;

    const newBrand: BrandItem = {
      id: `b-${Date.now()}`,
      name: newBrandName,
      url: newBrandUrl.startsWith('http') ? newBrandUrl : `https://${newBrandUrl || 'mybrand.com'}`,
      industry: newBrandIndustry,
      color: newBrandColor
    };

    // Creates the workspace server-side; the parent refreshes its list from the response.
    setBusy(true);
    setNotice(null);
    try {
      const r = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          name: newBrand.name,
          company_url: newBrand.url,
          brand_color: newBrand.color,
          brand_voice: '',
          brand_logo: null,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || 'Could not create that brand.');
      onAddBrand?.({ name: d.name, url: d.company_url || '', industry: newBrand.industry, color: d.brand_color || newBrand.color });
      setShowAddBrandModal(false);
      setNewBrandName('');
      setNewBrandUrl('');
      setNotice({ ok: true, text: `Created ${d.name}.` });
    } catch (e: any) {
      setNotice({ ok: false, text: e.message || 'Could not reach the server.' });
    }
    setBusy(false);
  };

  // Deletes the workspace and everything under it. This used to splice a local array, so
  // the brand reappeared on the next refresh.
  const handleDeleteBrandItem = async (id: string, name: string) => {
    if (currentBrands.length <= 1) {
      setNotice({ ok: false, text: 'You need at least one brand, so this one cannot be deleted.' });
      return;
    }
    if (!confirm(`Delete "${name}" and everything in it? This cannot be undone.`)) return;

    setBusy(true);
    setNotice(null);
    try {
      const r = await fetch(`/api/workspaces/${id}`, { method: 'DELETE', headers: authHeaders() });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || 'Could not delete that brand.');
      onDeleteBrand?.(id);
      setNotice({ ok: true, text: `Deleted ${name}.` });
    } catch (e: any) {
      setNotice({ ok: false, text: e.message || 'Could not reach the server.' });
    }
    setBusy(false);
  };

  // Real change-password. The current password is required by the endpoint: a token left
  // behind on a shared machine should not be enough to lock the owner out.
  const [currentPassword, setCurrentPassword] = useState('');

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) return;
    setBusy(true);
    setNotice(null);
    try {
      const r = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || 'Could not change the password.');
      setShowPasswordModal(false);
      setNewPassword('');
      setCurrentPassword('');
      setNotice({ ok: true, text: 'Password updated.' });
    } catch (e: any) {
      setNotice({ ok: false, text: e.message || 'Could not reach the server.' });
    }
    setBusy(false);
  };

  // Really deletes the account. "Account deletion request initiated." left everything
  // exactly where it was, which is a data-protection problem rather than a cosmetic one.
  const [deletePassword, setDeletePassword] = useState('');

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const r = await fetch('/api/auth/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ confirm: deleteConfirmText, password: deletePassword }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || 'Could not delete the account.');
      localStorage.removeItem('token');
      window.location.href = '/';
    } catch (e: any) {
      setNotice({ ok: false, text: e.message || 'Could not reach the server.' });
      setBusy(false);
    }
  };

  // There is no team model, no invite table and no mail for this - the old handler pushed
  // a row into local state and said "Invitation sent", so the invitee never heard anything
  // and the row vanished on refresh. Says so instead of pretending.
  const handleInviteMember = (e: React.FormEvent) => {
    e.preventDefault();
    setShowInviteModal(false);
    setNotice({ ok: false, text: 'Team invites are not available yet - there is no way to send one, so nothing was sent.' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {/* Outcomes are reported here rather than through alert(), so a failure is as visible
          as a success and neither can be claimed without the server saying so. */}
      {notice && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '9px', padding: '12px 16px',
          borderRadius: '10px', fontSize: '13px', lineHeight: 1.55,
          background: notice.ok ? 'rgba(0,230,118,0.08)' : 'rgba(255,71,87,0.08)',
          border: `1px solid ${notice.ok ? 'rgba(0,230,118,0.3)' : 'rgba(255,71,87,0.3)'}`,
          color: notice.ok ? '#00E676' : '#ff6b7a',
        }}>
          <span style={{ flex: 1 }}>{notice.text}</span>
          <button onClick={() => setNotice(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}>✕</button>
        </div>
      )}
      
      {/* ── HIGH-VISIBILITY CATEGORY SUB-NAVIGATION (NO NOTIFICATIONS / NO PERMISSIONS) ── */}
      <div
        className="glow-card"
        style={{
          background: 'linear-gradient(180deg, rgba(22, 22, 34, 0.95) 0%, rgba(12, 12, 18, 0.98) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '20px',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        {/* Row 1: Account Settings */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '110px' }}>
            <span style={{ fontSize: '11px', color: '#00E676', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', background: 'rgba(0, 230, 118, 0.12)', border: '1px solid rgba(0, 230, 118, 0.25)', padding: '4px 10px', borderRadius: '100px' }}>
              Account
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { id: 'profile', label: 'Account Profile', icon: <User size={14} /> },
              { id: 'preferences', label: 'Preferences', icon: <Sliders size={14} /> }
            ].map(tab => {
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id)}
                  style={{
                    background: isActive ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid',
                    borderColor: isActive ? '#00E676' : 'rgba(255, 255, 255, 0.1)',
                    color: isActive ? '#00E676' : 'var(--text-primary)',
                    padding: '8px 18px',
                    borderRadius: '100px',
                    fontSize: '13px',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                    boxShadow: isActive ? '0 0 15px rgba(0, 230, 118, 0.25)' : 'none'
                  }}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ width: '100%', height: '1px', background: 'rgba(255, 255, 255, 0.06)' }} />

        {/* Row 2: Team Settings (Notifications removed) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '110px' }}>
            <span style={{ fontSize: '11px', color: '#7C75FF', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', background: 'rgba(124, 117, 255, 0.15)', border: '1px solid rgba(124, 117, 255, 0.3)', padding: '4px 10px', borderRadius: '100px' }}>
              Team
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { id: 'general', label: 'General', icon: <Building size={14} /> },
              { id: 'brands', label: `Brands (${currentBrands.length})`, icon: <Sparkles size={14} /> },
              { id: 'integrations', label: 'Integrations', icon: <ToyBrick size={14} /> },
              { id: 'members', label: 'Team & Members', icon: <Users2 size={14} /> },
              { id: 'plans', label: 'Plans & Billing (₹ INR)', icon: <CreditCard size={14} />, highlight: true },
              { id: 'credits', label: `Credits (₹${creditsBalance.toLocaleString('en-IN')})`, icon: <Coins size={14} /> }
            ].map(tab => {
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (tab.id === 'integrations' && onNavigateTab) {
                      onNavigateTab('integrations');
                    } else {
                      setActiveSubTab(tab.id);
                    }
                  }}
                  style={{
                    background: isActive ? 'rgba(124, 117, 255, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid',
                    borderColor: isActive ? '#7C75FF' : 'rgba(255, 255, 255, 0.1)',
                    color: isActive ? '#fff' : 'var(--text-secondary)',
                    padding: '8px 18px',
                    borderRadius: '100px',
                    fontSize: '13px',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                    boxShadow: isActive ? '0 0 15px rgba(124, 117, 255, 0.3)' : 'none'
                  }}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* ── 1. ACCOUNT / PROFILE SUB-TAB ───────────────────────────── */}
      {activeSubTab === 'profile' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '740px' }}>
          <div>
            <h2 style={{ fontSize: '26px', color: '#fff', margin: '0 0 6px 0', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
              Profile
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14.5px', margin: 0 }}>
              Manage your personal credentials, sign-in providers, and communication preferences.
            </p>
          </div>

          {/* Email Card */}
          <div className="glow-card" style={{ background: '#0a0a12', borderRadius: '18px', padding: '24px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <label style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '8px' }}>
              Email
            </label>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Mail size={16} color="var(--text-secondary)" />
                <span style={{ fontSize: '15px', color: '#fff', fontWeight: 600 }}>{email}</span>
              </div>
              <span style={{ fontSize: '11.5px', background: 'rgba(0, 230, 118, 0.15)', color: '#00E676', border: '1px solid rgba(0, 230, 118, 0.3)', padding: '3px 12px', borderRadius: '100px', fontWeight: 700 }}>
                ✓ Primary Verified
              </span>
            </div>
          </div>

          {/* Password Card */}
          <div className="glow-card" style={{ background: '#0a0a12', borderRadius: '18px', padding: '24px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '4px' }}>
                Password
              </label>
              <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
                Protect your account with a secure password or OAuth provider.
              </div>
            </div>

            <button
              onClick={() => setShowPasswordModal(true)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#fff',
                padding: '9px 20px',
                borderRadius: '100px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <KeyRound size={14} /> Set Password
            </button>
          </div>

          {/* Google Connected Accounts Card */}
          <div className="glow-card" style={{ background: '#0a0a12', borderRadius: '18px', padding: '24px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(66, 133, 244, 0.12)', border: '1px solid rgba(66, 133, 244, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#4285F4', fontSize: '18px' }}>
                G
              </div>
              <div>
                <h4 style={{ fontSize: '15.5px', color: '#fff', margin: '0 0 2px 0', fontWeight: 700 }}>
                  Google
                </h4>
                <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>OAuth 2.0 Single Sign-On</span>
              </div>
            </div>

            <span style={{ fontSize: '11.5px', background: 'rgba(0, 230, 118, 0.15)', color: '#00E676', border: '1px solid rgba(0, 230, 118, 0.3)', padding: '5px 14px', borderRadius: '100px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Check size={13} /> Connected
            </span>
          </div>

          {/* Tips and updates Switch */}
          <div className="glow-card" style={{ background: '#0a0a12', borderRadius: '18px', padding: '24px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ fontSize: '15.5px', color: '#fff', margin: '0 0 4px 0', fontWeight: 700 }}>
                Tips and updates
              </h4>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: 0 }}>
                Email me about new features, workflow ideas, and occasional offers
              </p>
            </div>

            {/* Switch Toggle */}
            <div
              onClick={() => setEmailTipsEnabled(!emailTipsEnabled)}
              style={{
                width: '48px',
                height: '28px',
                borderRadius: '100px',
                background: emailTipsEnabled ? '#00E676' : 'rgba(255,255,255,0.15)',
                padding: '3px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: emailTipsEnabled ? 'flex-end' : 'flex-start'
              }}
            >
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#000000', boxShadow: '0 2px 4px rgba(0,0,0,0.4)' }} />
            </div>
          </div>

          {/* Delete Account (Danger Zone) */}
          <div className="glow-card" style={{ background: 'rgba(255, 71, 87, 0.04)', borderRadius: '18px', padding: '24px', border: '1px solid rgba(255, 71, 87, 0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trash2 size={16} color="#ff4757" />
                <h4 style={{ fontSize: '15.5px', color: '#ff4757', margin: 0, fontWeight: 800 }}>
                  Delete Account
                </h4>
              </div>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', margin: '4px 0 0 0' }}>
                Delete Account Permanently. All brand knowledge, creatives, and datasets will be erased.
              </p>
            </div>

            <button
              onClick={() => setShowDeleteModal(true)}
              style={{
                background: 'rgba(255, 71, 87, 0.15)',
                border: '1px solid rgba(255, 71, 87, 0.4)',
                color: '#ff4757',
                padding: '9px 20px',
                borderRadius: '100px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Delete Account Permanently
            </button>
          </div>

        </div>
      )}

      {/* ── 2. PLANS & BILLING SUB-TAB (ALL-IN-ONE FINANCIAL HUB) ───── */}
      {activeSubTab === 'plans' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Header & Billing Cycle Switch */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: 'rgba(0, 230, 118, 0.12)', borderRadius: '100px', border: '1px solid rgba(0, 230, 118, 0.3)', marginBottom: '8px' }}>
                <ShieldCheck size={14} color="#00E676" />
                <span style={{ fontSize: '11px', color: '#00E676', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  ACTIVE INDIAN RUPEE (₹ INR) BILLING & ESCROW
                </span>
              </div>
              <h2 style={{ fontSize: '28px', color: '#fff', margin: '0 0 6px 0', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
                Plans, Managed Spend & Vault
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14.5px', margin: 0 }}>
                Overview of your active Raftra package, managed ad spend, creator escrow vault, and credit balance.
              </p>
            </div>

            {/* Monthly / Annual Billing Toggle */}
            <div style={{ background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center' }}>
              <button
                onClick={() => setBillingCycle('monthly')}
                style={{
                  background: billingCycle === 'monthly' ? '#00E676' : 'transparent',
                  color: billingCycle === 'monthly' ? '#000000' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '100px',
                  padding: '7px 18px',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('annual')}
                style={{
                  background: billingCycle === 'annual' ? '#00E676' : 'transparent',
                  color: billingCycle === 'annual' ? '#000000' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '100px',
                  padding: '7px 18px',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>Annual</span>
                <span style={{ fontSize: '10px', background: billingCycle === 'annual' ? 'rgba(0,0,0,0.3)' : 'rgba(0,230,118,0.2)', color: billingCycle === 'annual' ? '#000' : '#00E676', padding: '1px 6px', borderRadius: '100px', fontWeight: 800 }}>
                  2 Mo FREE
                </span>
              </button>
            </div>
          </div>

          {/* ── 3 KEY METRICS: PACKAGE, AD SPEND, ESCROW VAULT ───────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '18px' }}>
            
            {/* Card 1: Purchased Package */}
            <div
              className="glow-card"
              style={{
                background: 'linear-gradient(135deg, rgba(20, 35, 25, 0.85) 0%, rgba(10, 15, 12, 0.98) 100%)',
                border: '1.5px solid #00E676',
                borderRadius: '20px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '16px',
                boxShadow: '0 8px 30px rgba(0, 230, 118, 0.12)'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', background: 'rgba(0, 230, 118, 0.2)', color: '#00E676', border: '1px solid rgba(0, 230, 118, 0.4)', padding: '3px 10px', borderRadius: '100px', fontWeight: 800 }}>
                    ● ACTIVE PACKAGE
                  </span>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>Renews Sep 1</span>
                </div>

                <h3 style={{ fontSize: '20px', color: '#fff', margin: '0 0 4px 0', fontWeight: 800 }}>
                  D2C Growth Suite
                </h3>

                <div style={{ fontSize: '26px', fontWeight: 900, color: '#00E676' }}>
                  {billingCycle === 'monthly' ? '₹8,999' : '₹89,999'}
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                    {billingCycle === 'monthly' ? '/mo + GST' : '/yr'}
                  </span>
                </div>
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                Includes autonomous AI creative generation, daily competitor audits & 25 influencer credits.
              </div>
            </div>

            {/* Card 2: Ad Spend Through Raftra */}
            <div
              className="glow-card"
              style={{
                background: 'linear-gradient(135deg, rgba(24, 24, 40, 0.85) 0%, rgba(12, 12, 20, 0.98) 100%)',
                border: '1.5px solid rgba(124, 117, 255, 0.4)',
                borderRadius: '20px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '16px',
                boxShadow: '0 8px 30px rgba(124, 117, 255, 0.12)'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', background: 'rgba(124, 117, 255, 0.2)', color: '#7C75FF', border: '1px solid rgba(124, 117, 255, 0.4)', padding: '3px 10px', borderRadius: '100px', fontWeight: 800 }}>
                    📈 MANAGED AD SPEND
                  </span>
                  <span style={{ fontSize: '11.5px', color: '#00E676', fontWeight: 700 }}>4.2x ROAS</span>
                </div>

                <h3 style={{ fontSize: '20px', color: '#fff', margin: '0 0 4px 0', fontWeight: 800 }}>
                  ₹1,84,500 <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>Spent</span>
                </h3>

                <div style={{ fontSize: '22px', fontWeight: 800, color: '#fff' }}>
                  ₹7,74,900 <span style={{ fontSize: '13px', color: '#00E676', fontWeight: 600 }}>Attributed Rev</span>
                </div>
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Meta: ₹1.12L</span>
                <span>Google: ₹72.5k</span>
                <span style={{ color: '#00E676' }}>● Auto-scaled</span>
              </div>
            </div>

            {/* Card 3: Influencer Marketplace Escrow Vault */}
            <div
              className="glow-card"
              style={{
                background: 'linear-gradient(135deg, rgba(35, 25, 15, 0.85) 0%, rgba(18, 12, 8, 0.98) 100%)',
                border: '1.5px solid rgba(255, 179, 0, 0.45)',
                borderRadius: '20px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '16px',
                boxShadow: '0 8px 30px rgba(255, 179, 0, 0.12)'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', background: 'rgba(255, 179, 0, 0.2)', color: '#FFB300', border: '1px solid rgba(255, 179, 0, 0.4)', padding: '3px 10px', borderRadius: '100px', fontWeight: 800 }}>
                    🔒 RAFTRA CREATOR VAULT
                  </span>
                  <span style={{ fontSize: '11.5px', color: '#FFB300', fontWeight: 700 }}>{vaultEscrowList.filter(v => isHeld(v.status)).length} in escrow</span>
                </div>

                <h3 style={{ fontSize: '20px', color: '#fff', margin: '0 0 4px 0', fontWeight: 800 }}>
                  ₹{totalVaultLocked.toLocaleString('en-IN')}
                </h3>

                <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
                  Locked safely in escrow until creator deliverables are verified.
                </div>
              </div>

              <div style={{ fontSize: '12px', color: '#00E676', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                ✓ ₹{totalVaultReleased.toLocaleString('en-IN')} Released to Creators
              </div>
            </div>

          </div>

          {/* ── INFLUENCER MARKETPLACE ESCROW VAULT BREAKDOWN ────────── */}
          <div className="glow-card" style={{ background: '#0a0a12', borderRadius: '20px', padding: '24px 28px', border: '1px solid rgba(255, 179, 0, 0.25)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Vault size={20} color="#FFB300" />
                <div>
                  <h3 style={{ fontSize: '18px', color: '#fff', margin: 0, fontWeight: 800 }}>
                    Influencer Marketplace Escrow Payments
                  </h3>
                  <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                    Funds held in Raftra Secure Vault for active creator collaborations
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Total Vault: <strong style={{ color: '#FFB300' }}>₹{(totalVaultLocked + totalVaultReleased).toLocaleString('en-IN')}</strong>
                </span>
              </div>
            </div>

            {/* Escrow Items List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {!vaultEscrowList.length && (
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
                  No creator deals on this workspace yet. Deals agreed in the Creator
                  Marketplace appear here with what is still held and what has been paid out.
                </p>
              )}

              {vaultEscrowList.map((item) => {
                const held = isHeld(item.status);
                return (
                <div
                  key={item.id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '14px',
                    padding: '14px 18px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: '14px' }}>
                      {(item.influencer_name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h4 style={{ fontSize: '14.5px', color: '#fff', margin: 0, fontWeight: 700 }}>
                          {item.influencer_name}
                        </h4>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          @{item.influencer_handle}
                        </span>
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {item.deliverables}
                        {item.created_at ? ` • ${new Date(item.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '15px', color: '#fff', fontWeight: 800 }}>
                        ₹{Number(item.amount || 0).toLocaleString('en-IN')}
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'capitalize',
                                     color: held ? '#FFB300' : '#00E676' }}>
                        ● {item.status}
                      </span>
                    </div>

                    {/* Releasing a deal's payment runs through the marketplace, which owns
                        the approval step and the payout - not this settings screen. */}
                    <button
                      onClick={() => onNavigateTab?.('influencer')}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        color: '#fff',
                        padding: '6px 14px',
                        borderRadius: '100px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Open deal
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          </div>

          {/* ── CREDITS ALLOCATION VS USAGE BREAKDOWN ────────────────── */}
          <div className="glow-card" style={{ background: '#0a0a12', borderRadius: '20px', padding: '24px 28px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Coins size={18} color="#00E676" />
                  <h3 style={{ fontSize: '18px', color: '#fff', margin: 0, fontWeight: 800 }}>
                    Monthly Credits Allocation vs. Usage
                  </h3>
                </div>
                <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                  Total Allocated: <strong>{totalAllocatedCredits.toLocaleString('en-IN')} Credits</strong> • Remaining: <strong style={{ color: '#00E676' }}>{creditsBalance.toLocaleString('en-IN')} Credits</strong>
                </span>
              </div>

              <button
                onClick={() => handleTopUp(5000)}
                style={{
                  background: 'rgba(0, 230, 118, 0.15)',
                  border: '1px solid rgba(0, 230, 118, 0.3)',
                  color: '#00E676',
                  padding: '7px 16px',
                  borderRadius: '100px',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Plus size={13} /> Top Up +5,000 Credits
              </button>
            </div>

            {/* Visual Progress Bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                <span>{creditsUsed.toLocaleString('en-IN')} Credits Used ({creditsUsedPercentage}%)</span>
                <span style={{ color: '#00E676' }}>{creditsBalance.toLocaleString('en-IN')} Available</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '100px', overflow: 'hidden' }}>
                <div style={{ width: `${creditsUsedPercentage}%`, height: '100%', background: 'linear-gradient(90deg, #7C75FF 0%, #00E676 100%)', borderRadius: '100px' }} />
              </div>
            </div>

            {/* Category breakdown chips */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '12px' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '12px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>AI Creative Generation</span>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff', marginTop: '2px' }}>8,500 Credits</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '12px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Competitor Intel Scrapes</span>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff', marginTop: '2px' }}>4,500 Credits</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '12px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>SEO & AEO Schema Audits</span>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff', marginTop: '2px' }}>3,000 Credits</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '12px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Video Storyboards</span>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff', marginTop: '2px' }}>2,000 Credits</div>
              </div>
            </div>
          </div>

          {/* ── REAL INR PLANS COMPARISON GRID ───────────────────────── */}
          <div>
            <h3 style={{ fontSize: '18px', color: '#fff', margin: '0 0 16px 0', fontWeight: 800 }}>
              Available Plan Tiers (₹ INR)
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '18px' }}>
              {INR_PLANS.map((plan) => {
                const isSelected = plan.id === currentPlanId;
                const priceDisplay = billingCycle === 'monthly'
                  ? `₹${plan.monthlyInr.toLocaleString('en-IN')}`
                  : `₹${plan.annualInr.toLocaleString('en-IN')}`;

                return (
                  <div
                    key={plan.id}
                    className="glow-card"
                    style={{
                      background: plan.highlight ? 'linear-gradient(180deg, rgba(24, 24, 40, 0.8) 0%, rgba(10, 10, 18, 0.98) 100%)' : '#0a0a12',
                      border: plan.highlight ? '1.5px solid #00E676' : '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '20px',
                      padding: '24px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '18px',
                      position: 'relative'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '11px', background: plan.highlight ? 'rgba(0,230,118,0.15)' : 'rgba(255,255,255,0.06)', color: plan.highlight ? '#00E676' : 'var(--text-secondary)', border: plan.highlight ? '1px solid rgba(0,230,118,0.3)' : '1px solid rgba(255,255,255,0.1)', padding: '3px 10px', borderRadius: '100px', fontWeight: 800 }}>
                          {plan.badge}
                        </span>
                      </div>

                      <h4 style={{ fontSize: '18px', color: '#fff', margin: '0 0 6px 0', fontWeight: 800 }}>
                        {plan.name}
                      </h4>

                      <div style={{ fontSize: '24px', fontWeight: 900, color: '#fff', margin: '8px 0 4px 0' }}>
                        {priceDisplay}
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                          {billingCycle === 'monthly' ? ' / mo' : ' / yr'}
                        </span>
                      </div>

                      <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '0 0 16px 0', lineHeight: 1.45 }}>
                        {plan.description}
                      </p>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px' }}>
                        {plan.features.map((feat, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.85)' }}>
                            <Check size={13} color="#00E676" style={{ marginTop: '2px', flexShrink: 0 }} />
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        // Changing plan means taking a payment. This used to set a local id
                        // and say "Switched plan to ..." - no charge, no subscription, and
                        // the old plan was still the one in force.
                        if (isSelected) return;
                        if (onChoosePlan) onChoosePlan();
                        else setNotice({ ok: false, text: 'Plan changes are handled on the pricing page.' });
                      }}
                      disabled={isSelected}
                      style={{
                        background: isSelected ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                        border: isSelected ? '1px solid rgba(0, 230, 118, 0.4)' : '1px solid rgba(255, 255, 255, 0.12)',
                        color: isSelected ? '#00E676' : '#fff',
                        padding: '9px',
                        borderRadius: '100px',
                        fontSize: '12.5px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        width: '100%',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {isSelected ? '✓ Current Active Plan' : `Upgrade to ${plan.name}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Real payment history. This was two fixed invoice rows - INV-2026-0811 and
              INV-2026-0711, both "Paid", both for the same amount - with a Download button
              that alerted rather than downloading anything. */}
          <div className="glow-card" style={{ background: '#0a0a12', borderRadius: '18px', padding: '24px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Receipt size={17} color="#7C75FF" />
              <h4 style={{ fontSize: '16px', color: '#fff', margin: 0, fontWeight: 700 }}>
                Payment history
              </h4>
            </div>

            {transactions.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {transactions.map((t) => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', color: '#fff', fontWeight: 600, textTransform: 'capitalize' }}>{t.purpose}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {t.created_at ? new Date(t.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                      </span>
                      <span style={{ fontSize: '12px', color: t.status === 'paid' ? '#00E676' : 'var(--text-muted)', textTransform: 'capitalize' }}>
                        {t.status}
                      </span>
                    </div>
                    <span style={{ fontSize: '13px', color: '#fff', fontWeight: 700 }}>
                      {t.currency === 'INR' ? '₹' : ''}{Number(t.amount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
                No payments on this account yet. Top-ups and plan purchases appear here once
                they clear.
              </p>
            )}
          </div>

        </div>
      )}

      {/* ── 3. BRANDS SUB-TAB ──────────────────────────────────────── */}
      {activeSubTab === 'brands' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '780px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h2 style={{ fontSize: '26px', color: '#fff', margin: '0 0 6px 0', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
                Connected Brands & Profiles
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14.5px', margin: 0 }}>
                Manage brand coordinate files, add new brand profiles, or switch your active workspace.
              </p>
            </div>

            <GlowButton
              variant="glow"
              onClick={() => setShowAddBrandModal(true)}
              style={{ fontSize: '13px', padding: '9px 22px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={15} /> Add Brand Profile
            </GlowButton>
          </div>

          {/* Brands List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {currentBrands.map((brand) => {
              const isSelected = brand.id === currentActiveId;

              return (
                <div
                  key={brand.id}
                  className="glow-card"
                  style={{
                    background: isSelected ? 'linear-gradient(135deg, rgba(24, 24, 40, 0.9) 0%, rgba(12, 12, 20, 0.98) 100%)' : '#0a0a12',
                    borderRadius: '20px',
                    padding: '24px',
                    border: isSelected ? `1.5px solid ${brand.color}` : '1px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '16px',
                    boxShadow: isSelected ? `0 8px 30px ${brand.color}22` : 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: '#000000',
                        border: `2px solid ${brand.color}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: brand.color,
                        fontWeight: 900,
                        fontSize: '20px'
                      }}
                    >
                      {brand.name.charAt(0).toUpperCase()}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                        <h3 style={{ fontSize: '18px', color: '#fff', margin: 0, fontWeight: 800 }}>
                          {brand.name}
                        </h3>
                        {isSelected && (
                          <span
                            style={{
                              fontSize: '11px',
                              background: 'rgba(0, 230, 118, 0.15)',
                              color: '#00E676',
                              border: '1px solid rgba(0, 230, 118, 0.3)',
                              padding: '2px 10px',
                              borderRadius: '100px',
                              fontWeight: 800,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <CheckCircle size={12} /> Active Brand
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                        <a href={brand.url} target="_blank" rel="noopener noreferrer" style={{ color: brand.color, textDecoration: 'none', fontWeight: 600 }}>
                          {brand.url} ↗
                        </a>
                        <span>•</span>
                        <span>{brand.industry}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {!isSelected ? (
                      <button
                        onClick={() => handleSelectBrand(brand.id)}
                        style={{
                          background: 'rgba(0, 230, 118, 0.12)',
                          border: '1px solid rgba(0, 230, 118, 0.35)',
                          color: '#00E676',
                          padding: '8px 18px',
                          borderRadius: '100px',
                          fontSize: '12.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <ArrowRightLeft size={13} /> Switch to this Brand
                      </button>
                    ) : (
                      <button
                        onClick={() => onNavigateTab && onNavigateTab('kb_brands')}
                        style={{
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.18)',
                          color: '#fff',
                          padding: '8px 18px',
                          borderRadius: '100px',
                          fontSize: '12.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Sparkles size={13} color={brand.color} /> Open Brand Kit
                      </button>
                    )}

                    <button
                      onClick={() => handleDeleteBrandItem(brand.id, brand.name)}
                      title="Delete Brand Profile"
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: 'none',
                        color: 'var(--text-muted)',
                        padding: '8px',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 4. PREFERENCES SUB-TAB ─────────────────────────────────── */}
      {activeSubTab === 'preferences' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '740px' }}>
          <div>
            <h2 style={{ fontSize: '26px', color: '#fff', margin: '0 0 6px 0', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
              Preferences
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14.5px', margin: 0 }}>
              Tailor regional timezones, visual density, and AI engine velocity.
            </p>
          </div>

          <div className="glow-card" style={{ background: '#0a0a12', borderRadius: '18px', padding: '24px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                Timezone
              </label>
              <select style={{ width: '100%', padding: '10px 14px', background: '#141420', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: '#fff', fontSize: '13.5px' }}>
                <option>(GMT+05:30) India Standard Time - Asia/Kolkata</option>
                <option>(GMT-08:00) Pacific Standard Time - America/Los_Angeles</option>
                <option>(GMT+00:00) UTC - London</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                Interface Theme
              </label>
              <select style={{ width: '100%', padding: '10px 14px', background: '#141420', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: '#fff', fontSize: '13.5px' }}>
                <option>Obsidian Dark with Neon Glow (Default)</option>
                <option>Deep Charcoal Minimal</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. CREDITS SUB-TAB ──────────────────────────────────────── */}
      {activeSubTab === 'credits' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '740px' }}>
          <div>
            <h2 style={{ fontSize: '26px', color: '#fff', margin: '0 0 6px 0', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
              Account Execution Credits (₹ INR)
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14.5px', margin: 0 }}>
              Live execution credits used for AI creative generation, daily competitor crawls, and video renders.
            </p>
          </div>

          <div className="glow-card" style={{ background: '#0a0a12', borderRadius: '18px', padding: '28px', border: '1px solid rgba(0, 230, 118, 0.3)', textAlign: 'center', boxShadow: '0 8px 30px rgba(0, 230, 118, 0.12)' }}>
            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
              AVAILABLE LIVE BALANCE (SYNCED WITH HEADER)
            </span>
            <div style={{ fontSize: '42px', fontWeight: 900, color: '#00E676', margin: '6px 0 16px 0' }}>
              ₹{creditsBalance.toLocaleString('en-IN')} Credits
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {[2500, 5000, 15000].map(amount => (
                <button
                  key={amount}
                  onClick={() => handleTopUp(amount)}
                  style={{
                    background: 'rgba(0, 230, 118, 0.15)',
                    border: '1px solid rgba(0, 230, 118, 0.35)',
                    color: '#00E676',
                    padding: '8px 22px',
                    borderRadius: '100px',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  + ₹{amount.toLocaleString('en-IN')}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Credit Consumption Reference */}
          <div className="glow-card" style={{ background: '#0a0a12', borderRadius: '18px', padding: '20px 24px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h4 style={{ fontSize: '15px', color: '#fff', margin: '0 0 12px 0', fontWeight: 700 }}>
              Credit Consumption Rates
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '10px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              <div>• 1 Static Ad Generation: <strong>50 Credits</strong></div>
              <div>• 1 Video UGC Storyboard: <strong>200 Credits</strong></div>
              <div>• 1 Competitor Audit Crawl: <strong>150 Credits</strong></div>
              <div>• 1 SEO Schema AEO Index: <strong>100 Credits</strong></div>
            </div>
          </div>
        </div>
      )}

      {/* ── 6. TEAM & MEMBERS SUB-TAB ───────────────────────────────── */}
      {activeSubTab === 'members' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '740px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '26px', color: '#fff', margin: '0 0 6px 0', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
                Team & Members
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14.5px', margin: 0 }}>
                Collaborators who have access to this brand workspace.
              </p>
            </div>

            <GlowButton variant="glow" onClick={() => setShowInviteModal(true)} style={{ fontSize: '12.5px', padding: '8px 20px' }}>
              <Plus size={13} /> Invite Member
            </GlowButton>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {members.map((m, idx) => (
              <div key={idx} className="glow-card" style={{ background: '#0a0a12', borderRadius: '14px', padding: '16px 20px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ fontSize: '15px', color: '#fff', margin: '0 0 2px 0', fontWeight: 700 }}>{m.name}</h4>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{m.email}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11.5px', background: 'rgba(124, 117, 255, 0.15)', color: '#7C75FF', padding: '3px 10px', borderRadius: '6px', fontWeight: 700 }}>
                    {m.role}
                  </span>
                  <span style={{ fontSize: '11.5px', color: m.status === 'Active' ? '#00E676' : '#FFB300' }}>
                    ● {m.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 7. GENERAL SUB-TAB ──────────────────────────────────────── */}
      {activeSubTab === 'general' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '740px' }}>
          <div>
            <h2 style={{ fontSize: '26px', color: '#fff', margin: '0 0 6px 0', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
              General Settings
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14.5px', margin: 0 }}>
              Team configuration and workspace name.
            </p>
          </div>

          <div className="glow-card" style={{ background: '#0a0a12', borderRadius: '18px', padding: '24px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                Team / Workspace Name
              </label>
              <input
                type="text"
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: '#fff', fontSize: '13.5px' }}
              />
            </div>

            {/* No team model exists behind this form, so there is nowhere to save it to. */}
            <GlowButton variant="glow" disabled onClick={() => setNotice({ ok: false, text: 'Team settings cannot be saved yet.' })} style={{ alignSelf: 'flex-start', fontSize: '13px', padding: '9px 22px', opacity: 0.55 }}>
              Save Changes
            </GlowButton>
          </div>
        </div>
      )}

      {/* ── ADD BRAND MODAL ────────────────────────────────────────── */}
      <AnimatePresence>
        {showAddBrandModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)', padding: '20px' }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} style={{ width: '100%', maxWidth: '480px', background: '#0a0a12', border: '1px solid rgba(0, 230, 118, 0.35)', borderRadius: '24px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '18px', boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Sparkles size={20} color="#00E676" />
                  <h3 style={{ fontSize: '19px', color: '#fff', margin: 0, fontWeight: 800 }}>Add Brand Profile</h3>
                </div>
                <button onClick={() => setShowAddBrandModal(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={16} /></button>
              </div>

              <form onSubmit={handleCreateBrand} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                    Brand Name
                  </label>
                  <input type="text" required placeholder="e.g. Aura Lifestyle" value={newBrandName} onChange={e => setNewBrandName(e.target.value)} style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: '#fff', fontSize: '13.5px', outline: 'none' }} />
                </div>

                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                    Store / Website URL
                  </label>
                  <input type="text" required placeholder="e.g. https://auralifestyle.com" value={newBrandUrl} onChange={e => setNewBrandUrl(e.target.value)} style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: '#fff', fontSize: '13.5px', outline: 'none' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                      Industry
                    </label>
                    <input type="text" required placeholder="e.g. Fashion & D2C" value={newBrandIndustry} onChange={e => setNewBrandIndustry(e.target.value)} style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: '#fff', fontSize: '13.5px', outline: 'none' }} />
                  </div>

                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                      Brand Accent Color
                    </label>
                    <input type="color" value={newBrandColor} onChange={e => setNewBrandColor(e.target.value)} style={{ width: '100%', height: '42px', padding: '2px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', cursor: 'pointer' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                  <button type="button" onClick={() => setShowAddBrandModal(false)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '9px 18px', borderRadius: '100px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                  <GlowButton variant="glow" type="submit" style={{ padding: '9px 24px', fontSize: '13px' }}>Create Brand ✓</GlowButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── PASSWORD MODAL ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showPasswordModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)', padding: '20px' }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} style={{ width: '100%', maxWidth: '440px', background: '#0a0a12', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '24px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '18px', color: '#fff', margin: 0, fontWeight: 800 }}>Set Password</h3>
                <button onClick={() => setShowPasswordModal(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={16} /></button>
              </div>
              <form onSubmit={handleSavePassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <input type="password" required placeholder="Enter new password..." value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: '#fff', fontSize: '13.5px' }} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button type="button" onClick={() => setShowPasswordModal(false)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: '100px', fontSize: '12.5px', cursor: 'pointer' }}>Cancel</button>
                  <GlowButton variant="glow" type="submit" style={{ padding: '8px 20px', fontSize: '12.5px' }}>Save Password</GlowButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── DELETE ACCOUNT MODAL ───────────────────────────────────── */}
      <AnimatePresence>
        {showDeleteModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)', padding: '20px' }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} style={{ width: '100%', maxWidth: '440px', background: '#0a0a12', border: '1px solid rgba(255, 71, 87, 0.4)', borderRadius: '24px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '18px', color: '#ff4757', margin: 0, fontWeight: 800 }}>Confirm Deletion</h3>
                <button onClick={() => setShowDeleteModal(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={16} /></button>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                This action is irreversible. Type <strong style={{ color: '#fff' }}>DELETE</strong> below to permanently delete your account.
              </p>
              <form onSubmit={handleDeleteAccount} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <input type="text" required placeholder="Type DELETE" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: '#fff', fontSize: '13.5px' }} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button type="button" onClick={() => setShowDeleteModal(false)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: '100px', fontSize: '12.5px', cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" style={{ background: '#ff4757', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '100px', fontSize: '12.5px', fontWeight: 800, cursor: 'pointer' }}>Delete Permanently</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── INVITE MEMBER MODAL ────────────────────────────────────── */}
      <AnimatePresence>
        {showInviteModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)', padding: '20px' }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} style={{ width: '100%', maxWidth: '440px', background: '#0a0a12', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '24px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '18px', color: '#fff', margin: 0, fontWeight: 800 }}>Invite Team Member</h3>
                <button onClick={() => setShowInviteModal(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={16} /></button>
              </div>
              <form onSubmit={handleInviteMember} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <input type="email" required placeholder="colleague@demobrand.com" value={newMemberEmail} onChange={e => setNewMemberEmail(e.target.value)} style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: '#fff', fontSize: '13.5px' }} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button type="button" onClick={() => setShowInviteModal(false)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: '100px', fontSize: '12.5px', cursor: 'pointer' }}>Cancel</button>
                  <GlowButton variant="glow" type="submit" style={{ padding: '8px 20px', fontSize: '12.5px' }}>Send Invitation</GlowButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
