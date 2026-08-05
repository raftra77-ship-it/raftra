import React, { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, MessageCircle, DollarSign, Settings, Send, CheckCircle2, ShieldAlert, Sparkles } from 'lucide-react';
import { GlowButton } from './GlowButton';

interface CreatorPortalProps {
  onLogout: () => void;
}

export const CreatorPortal: React.FC<CreatorPortalProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inbox' | 'settings'>('dashboard');
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [myInfluencerId, setMyInfluencerId] = useState<number | null>(null);
  const [me, setMe] = useState<any>(null);
  const [chatWorkspaceId, setChatWorkspaceId] = useState<number>(1);
  const [profileForm, setProfileForm] = useState({ 
    avatar: '',
    recent_posts: [] as {url: string, type: string}[], 
    recent_collabs: [] as string[], 
    recent_reviews: [] as {author: string, text: string}[] 
  });
  
  const [cardCustomizer, setCardCustomizer] = useState({
    name: 'Ankit Kumar',
    handle: '@ankrena',
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=400&q=80',
    niche: 'Lifestyle',
    location: 'Delhi, India',
    followers: '4,983',
    avgViews: '11.3M total views (3k avg)',
    expectedPrice: '₹10,000',
    profileLink: 'https://www.instagram.com/ankrena',
    deliverables: ['Reel', 'Story', 'Static Post', 'YouTube Integration']
  });

  const [offerUGC, setOfferUGC] = useState(true);

  const handleToggleUGC = (checked: boolean) => {
    setOfferUGC(checked);
    const existing = JSON.parse(localStorage.getItem('raftra_creator_card_custom') || '{}');
    const deliverables = checked
      ? (existing.deliverables || ['UGC Video', 'Reel', 'Story', 'Static Post']).includes('UGC Video')
        ? (existing.deliverables || ['UGC Video', 'Reel', 'Story', 'Static Post'])
        : ['UGC Video', ...(existing.deliverables || ['Reel', 'Story', 'Static Post'])]
      : (existing.deliverables || ['UGC Video', 'Reel', 'Story', 'Static Post']).filter((d: string) => d !== 'UGC Video');

    const updatedCard = {
      ...cardCustomizer,
      ...existing,
      isUGC: checked,
      deliverables
    };
    localStorage.setItem('raftra_creator_card_custom', JSON.stringify(updatedCard));
    window.dispatchEvent(new Event('storage'));
  };

  const [verifyForm, setVerifyForm] = useState({ username: '', niche: '', base_rate: 0 });
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'unverified' | 'verified' | 'rejected'>('verified');

  const [allBrands, setAllBrands] = useState<{id: number, name: string}[]>([]);
  const [showDiscover, setShowDiscover] = useState(false);

  // Proof Submission & Human Verification State
  const [proofTokenInput, setProofTokenInput] = useState('');
  const [proofFileScreenshot, setProofFileScreenshot] = useState<string | null>(null);
  const [proofVerificationStatus, setProofVerificationStatus] = useState<'idle' | 'under_review' | 'verified_payout'>('idle');
  const [proofSubmissionToast, setProofSubmissionToast] = useState<string | null>(null);

  // Payout Bank Details & Tax Invoice State
  const [bankDetails, setBankDetails] = useState({
    accountHolder: 'Ankit Kumar',
    bankName: 'HDFC Bank',
    accountNumber: '50100293849182',
    ifscCode: 'HDFC0001234',
    upiId: 'ankit@okaxis'
  });
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  const proofFileInputRef = useRef<HTMLInputElement>(null);

  const handleProofFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setProofFileScreenshot(url);
    }
  };

  const handleSubmitProofToTeamRaftra = (e: React.FormEvent) => {
    e.preventDefault();
    if (!proofTokenInput && !proofFileScreenshot) {
      alert("Please paste the verification token or upload a screenshot of your WhatsApp/IG DM chat approval.");
      return;
    }

    setProofVerificationStatus('under_review');
    setProofSubmissionToast('Proof submitted! Team Raftra Human Auditor is reviewing your screenshot & verification code (Est: 15-30 mins).');
    setTimeout(() => setProofSubmissionToast(null), 5000);
  };

  const handleSimulateHumanApproval = () => {
    setProofVerificationStatus('verified_payout');
    setProofSubmissionToast('✅ Human Verification Approved by Team Raftra! ₹9,000 (90% net payout) disbursed to your bank account via Razorpay/UPI.');
    setTimeout(() => setProofSubmissionToast(null), 6000);
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(r => r.json()).then(data => {
      setMe(data);
    });
    fetch('/api/workspaces/influencer/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(r => r.json()).then(data => {
      if(data && data.id) {
        setMyInfluencerId(data.id);
        if (data.handle) {
          setVerificationStatus('verified');
        }
        setProfileForm({
          avatar: data.avatar || '',
          recent_posts: data.recent_posts || [],
          recent_collabs: data.recent_collabs || [],
          recent_reviews: data.recent_reviews || []
        });
      }
    });
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const creatorStorageKey = 'raftra_chat_creator_11';

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if ((e.key === creatorStorageKey || e.key === 'raftra_creator_inbox_chat') && e.newValue) {
        try {
          setChatMessages(JSON.parse(e.newValue));
        } catch (err) {}
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    if (activeTab === 'inbox') {
      const defaultBrands = [
        { id: 1, name: 'Asitis Nutrition' },
        { id: 2, name: 'Zara India' },
        { id: 3, name: 'Nike Performance' },
        { id: 4, name: 'Zomato D2C' }
      ];
      setAllBrands(defaultBrands);

      const savedChat = localStorage.getItem(creatorStorageKey) || localStorage.getItem('raftra_creator_inbox_chat');
      if (savedChat) {
        try {
          setChatMessages(JSON.parse(savedChat));
        } catch (e) {
          initDefaultCreatorChats();
        }
      } else {
        initDefaultCreatorChats();
      }
    }
  }, [activeTab]);

  const initDefaultCreatorChats = () => {
    const initialMsgs = [
      { sender: 'system', text: 'SECURE END-TO-END CHAT ESTABLISHED' },
      { sender: 'brand', text: "Hi Ankit! We loved your recent viral food & couple reels (11.3M views). We would like to sponsor a 30s integration reel for Asitis Whey Protein." },
      { sender: 'brand', text: JSON.stringify({ type: 'proposal', amount: 10000 }) }
    ];
    setChatMessages(initialMsgs);
    localStorage.setItem(creatorStorageKey, JSON.stringify(initialMsgs));
    localStorage.setItem('raftra_creator_inbox_chat', JSON.stringify(initialMsgs));
  };

  const isAntiBypassViolation = (text: string): boolean => {
    const lower = text.toLowerCase();
    
    // Obfuscated / spaced out phone numbers check (e.g. 9 8 7 6 5 4 3 2 1 0 or 9876543210)
    const normalizedDigits = text.replace(/[^0-9]/g, '');
    if (normalizedDigits.length >= 10 && /[6-9]\d{9}/.test(normalizedDigits)) {
      return true;
    }

    // Hinglish, English, WhatsApp, Instagram DM, and personal chat keywords
    const bypassKeywords = [
      'whatsapp', 'watsapp', 'whatapp', 'whatsaap', 'wa.me', 'wa ', 'wp ', 'wpp',
      'instagram', 'insta', 'ig dm', 'insta dm', 'dm me', 'dm pe', 'inbox me', 'inbox pe', 'direct msg', 'direct message',
      'personal chat', 'personal msg', 'personal message', 'personal number', 'personal pe',
      'baat kare', 'baat karte', 'baat karle', 'baat karo', 'call me', 'call kar', 'call pe',
      'text me', 'my number', 'phone number', 'phn no', 'contact no', 'mobile no', 'number de',
      'number send', 'number pe', 'outside chat', 'off platform', 'off-platform',
      'gpay', 'google pay', 'paytm', 'phonepe', 'upi id', 'direct payment', 'bank transfer'
    ];

    return bypassKeywords.some(kw => lower.includes(kw));
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const input = chatInput;
    setChatInput('');

    const currentMsgs = JSON.parse(localStorage.getItem(creatorStorageKey) || JSON.stringify(chatMessages));

    // Anti-Bypass Guard
    if (isAntiBypassViolation(input)) {
      const violationMsg = {
        sender: 'system' as const,
        sender_type: 'system',
        text: '🚨 CHAT BLOCKED: Anti-Bypass Policy Violation Detected! Exchanging phone numbers, social handles, or attempting off-platform contact is strictly prohibited. Your account has been reported.',
        content: '🚨 CHAT BLOCKED: Anti-Bypass Policy Violation Detected! Exchanging phone numbers, social handles, or attempting off-platform contact is strictly prohibited. Your account has been reported.'
      };
      const blockedMsgs = [...currentMsgs, { sender: 'creator' as const, sender_type: 'influencer', text: input, content: input }, violationMsg];
      setChatMessages(blockedMsgs as any);
      localStorage.setItem(creatorStorageKey, JSON.stringify(blockedMsgs));
      localStorage.setItem('raftra_creator_inbox_chat', JSON.stringify(blockedMsgs));
      window.dispatchEvent(new Event('storage'));
      return;
    }

    const newMsg = {
      sender: 'creator' as const,
      sender_type: 'influencer',
      text: input,
      content: input
    };

    const updated = [...currentMsgs, newMsg];
    setChatMessages(updated);
    localStorage.setItem(creatorStorageKey, JSON.stringify(updated));
    localStorage.setItem('raftra_creator_inbox_chat', JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
  };

  const handleAcceptProposal = (amount: number) => {
    const acceptMsg = {
      sender: 'creator' as const,
      sender_type: 'influencer',
      text: JSON.stringify({ type: 'proposal_accepted', amount }),
      content: JSON.stringify({ type: 'proposal_accepted', amount })
    };
    const paymentMsg = {
      sender: 'brand' as const,
      sender_type: 'brand',
      text: JSON.stringify({ type: 'payment_complete', amount }),
      content: JSON.stringify({ type: 'payment_complete', amount })
    };
    const currentMsgs = JSON.parse(localStorage.getItem(creatorStorageKey) || JSON.stringify(chatMessages));
    const updated = [...currentMsgs, acceptMsg, paymentMsg];
    setChatMessages(updated);
    localStorage.setItem(creatorStorageKey, JSON.stringify(updated));
    localStorage.setItem('raftra_creator_inbox_chat', JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
  };

  const handleVerifyProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyForm.username || !verifyForm.niche || !verifyForm.base_rate) return;
    
    setIsVerifying(true);
    setVerificationStatus('unverified');
    const token = localStorage.getItem('token');
    
    try {
      const res = await fetch('/api/workspaces/influencer/me/verify', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(verifyForm)
      });
      const data = await res.json();
      if (data.status === 'success' && data.data.verification_status === 'verified') {
        setVerificationStatus('verified');
        setProfileForm({
          recent_posts: data.influencer.recent_posts || [],
          recent_collabs: data.influencer.recent_collabs || [],
          recent_reviews: data.influencer.recent_reviews || []
        });
      } else {
        setVerificationStatus('rejected');
        alert("Verification failed: Fake followers detected or account private.");
      }
    } catch (e) {
      console.error(e);
      setVerificationStatus('rejected');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    try {
      await fetch('/api/workspaces/influencer/me/profile', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm)
      });
      alert('Profile updated successfully!');
    } catch (e) {
      console.error(e);
      alert('Failed to update profile');
    }
  };

  const groupedChats = chatMessages.reduce((acc, msg) => {
    const wid = msg.workspace_id || 1;
    const wname = msg.workspace_name || 'Brand Partner';
    if (!acc[wid]) {
      acc[wid] = { name: wname, messages: [] };
    }
    acc[wid].messages.push(msg);
    return acc;
  }, {} as Record<number, { name: string, messages: any[] }>);

  if (!groupedChats[1]) {
    groupedChats[1] = { name: 'Brand Partner', messages: chatMessages };
  }
  
  const activeChats = Object.keys(groupedChats).map(k => ({ id: Number(k) || 1, ...groupedChats[Number(k) || 1] }));
  const currentChatMessages = groupedChats[chatWorkspaceId]?.messages || chatMessages;

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', color: '#fff', display: 'flex', fontFamily: 'var(--font-sans)' }}>
      {/* Sidebar */}
      <div style={{ width: '250px', background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)', padding: '24px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '48px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #5A52FF 0%, #B252FF 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
            C
          </div>
          <span style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-heading)' }}>Creator Dashboard</span>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'inbox', label: 'Inbox', icon: MessageCircle },
            { id: 'settings', label: 'Settings', icon: Settings },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '8px',
                background: activeTab === item.id ? 'rgba(90,82,255,0.1)' : 'transparent',
                color: activeTab === item.id ? 'var(--primary)' : 'var(--text-secondary)',
                border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: activeTab === item.id ? 600 : 400,
                textAlign: 'left'
              }}
            >
              <item.icon size={18} /> {item.label}
            </button>
          ))}
        </nav>

        <button onClick={onLogout} style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer' }}>
          Log Out
        </button>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
        {activeTab === 'dashboard' && (
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '28px', fontFamily: 'var(--font-heading)', marginBottom: '24px' }}>Welcome back{me?.first_name ? `, ${me.first_name}` : ''}!</h1>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', marginBottom: '40px' }}>
              <div className="glow-card" style={{ padding: '24px' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px' }}>Total Escrowed Funds</div>
                <div style={{ fontSize: '32px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'var(--success)', fontSize: '28px', fontWeight: 800 }}>₹</span> 98,500
                </div>
              </div>
              <div className="glow-card" style={{ padding: '24px' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px' }}>Active Deals</div>
                <div style={{ fontSize: '32px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 color="var(--primary)" size={28}/> 3
                </div>
              </div>
              <div className="glow-card" style={{ padding: '24px' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px' }}>Profile Views (30d)</div>
                <div style={{ fontSize: '32px', fontWeight: 700 }}>842</div>
              </div>
            </div>

            <div className="glow-card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Recent Deal Requests</h3>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>Raftra AI Demo Brand</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>UGC Video • Requested 2 hours ago</div>
                </div>
                <GlowButton variant="glow" onClick={() => setActiveTab('inbox')}>View Message</GlowButton>
              </div>
            </div>

            {/* STEP-BY-STEP PAYOUT EXPLANATION GUIDE */}
            <div className="glow-card" style={{ padding: '24px', marginTop: '24px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '16px', margin: '0 0 14px 0', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📖 How Creator Payout Verification Works (Step-by-Step)
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                {[
                  { step: '1', title: 'Deliver Content', desc: 'Send final video reel to brand on WhatsApp/Insta as per contract.' },
                  { step: '2', title: 'Get Approval Msg', desc: 'Brand reviews work and sends official timestamped verification message.' },
                  { step: '3', title: 'Upload Proof & Bank', desc: 'Upload chat screenshot proof & enter your Bank/UPI details below.' },
                  { step: '4', title: 'Human Audit', desc: 'Team Raftra Auditor conducts manual verification of SS (15-30 mins).' },
                  { step: '5', title: 'Bank Payout & Invoice', desc: 'Funds disbursed to Bank/UPI + Download official Tax Invoice PDF!' }
                ].map(item => (
                  <div key={item.step} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--primary)', marginBottom: '4px' }}>STEP {item.step}</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>{item.title}</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* HUMAN VERIFICATION & PAYOUT PROOF SUBMISSION BOX */}
            <div className="glow-card" style={{ padding: '24px', marginTop: '24px', background: 'linear-gradient(135deg, rgba(12,12,20,0.9), rgba(20,20,35,0.95))', border: '1px solid rgba(0, 230, 118, 0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', margin: '0 0 4px 0', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldAlert size={20} color="#00E676" /> Escrow Payout & Human Verification Portal
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                    Work complete? Upload your brand approval screenshot (WhatsApp/IG DM) & verification code for Team Raftra Human Verification.
                  </p>
                </div>
                <div style={{ padding: '6px 14px', borderRadius: '100px', fontSize: '11px', fontWeight: 700, background: proofVerificationStatus === 'verified_payout' ? 'rgba(0,230,118,0.2)' : proofVerificationStatus === 'under_review' ? 'rgba(0,196,204,0.2)' : 'rgba(255,179,0,0.2)', color: proofVerificationStatus === 'verified_payout' ? '#00E676' : proofVerificationStatus === 'under_review' ? '#00C4CC' : '#FFB300', border: '1px solid currentColor' }}>
                  {proofVerificationStatus === 'verified_payout' ? '🟢 ESCROW PAYOUT DISBURSED' : proofVerificationStatus === 'under_review' ? '🔵 UNDER HUMAN VERIFICATION (TEAM RAFTRA)' : '🟡 PENDING PROOF SUBMISSION'}
                </div>
              </div>

              {proofSubmissionToast && (
                <div style={{ background: 'rgba(0,230,118,0.15)', border: '1px solid #00E676', color: '#00E676', padding: '12px 16px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, marginBottom: '16px' }}>
                  {proofSubmissionToast}
                </div>
              )}

              {proofVerificationStatus === 'verified_payout' ? (
                <div style={{ background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.3)', padding: '24px', borderRadius: '14px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <CheckCircle2 size={36} color="#00E676" />
                  <h4 style={{ fontSize: '18px', color: '#fff', margin: 0 }}>₹9,000 Payout Disbursed & Verified!</h4>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', margin: 0, maxWidth: '500px' }}>
                    Team Raftra Human Verification completed. 90% net payout transferred to your <b>{bankDetails.bankName}</b> (A/C: {bankDetails.accountNumber}) & UPI (<b>{bankDetails.upiId}</b>).
                  </p>
                  <button
                    onClick={() => setShowInvoiceModal(true)}
                    style={{ marginTop: '8px', background: '#00E676', color: '#000', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    📄 Download Official Raftra Tax Invoice & Receipt
                  </button>
                </div>
              ) : proofVerificationStatus === 'under_review' ? (
                <div style={{ background: 'rgba(0,196,204,0.1)', border: '1px solid rgba(0,196,204,0.3)', padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Sparkles size={20} color="#00C4CC" />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>Proof Under Human Verification by Team Raftra 🔍</div>
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>Est. Verification Time: 15-30 minutes. Raftra Auditor is checking your chat screenshot & timestamp.</div>
                    </div>
                  </div>
                  {proofFileScreenshot && (
                    <div style={{ position: 'relative', width: '120px', height: '80px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)' }}>
                      <img src={proofFileScreenshot} alt="Uploaded Proof" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                  <button
                    onClick={handleSimulateHumanApproval}
                    style={{ alignSelf: 'flex-start', background: '#00E676', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '11.5px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    ⚡ Simulate Team Raftra Human Verification Approval (Demo Test)
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmitProofToTeamRaftra} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  
                  {/* Bank Details Inputs */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', padding: '16px', borderRadius: '10px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <DollarSign size={16} /> PAYOUT BANK & UPI DETAILS
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Bank Name:</label>
                        <input
                          type="text"
                          value={bankDetails.bankName}
                          onChange={e => setBankDetails({ ...bankDetails, bankName: e.target.value })}
                          style={{ width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', color: '#fff', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Account Number:</label>
                        <input
                          type="text"
                          value={bankDetails.accountNumber}
                          onChange={e => setBankDetails({ ...bankDetails, accountNumber: e.target.value })}
                          style={{ width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', color: '#fff', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>UPI ID:</label>
                        <input
                          type="text"
                          value={bankDetails.upiId}
                          onChange={e => setBankDetails({ ...bankDetails, upiId: e.target.value })}
                          style={{ width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', color: '#fff', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                        1. Verification Code / Message (from Brand):
                      </label>
                      <input
                        type="text"
                        placeholder="Paste RAFTRA-VERIFIED-XXXXX or approval text"
                        value={proofTokenInput}
                        onChange={e => setProofTokenInput(e.target.value)}
                        style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '8px', color: '#fff', fontSize: '12.5px', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                        2. Chat Screenshot Proof (WhatsApp / IG DM / Email):
                      </label>
                      <input
                        ref={proofFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleProofFileUpload}
                        style={{ display: 'none' }}
                      />
                      <div
                        onClick={() => proofFileInputRef.current?.click()}
                        style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: '8px', color: proofFileScreenshot ? '#00E676' : 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        {proofFileScreenshot ? '📸 Screenshot Attached! Click to Change' : '📁 Click to Upload Screenshot Proof (.png / .jpg)'}
                      </div>
                    </div>
                  </div>

                  <GlowButton variant="glow" type="submit" style={{ padding: '12px 24px', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Send size={15} /> Submit Proof for Team Raftra Human Verification & Payout
                  </GlowButton>
                </form>
              )}
            </div>
          </div>
        )}

        {activeTab === 'inbox' && (
          <div style={{ maxWidth: '1000px', margin: '0 auto', height: 'calc(100vh - 80px)', display: 'flex', gap: '20px', padding: '20px' }}>
            {/* Left Pane - Chat List */}
            <div style={{ width: '300px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 600 }}>Active Messages</div>
                <button 
                  onClick={() => setShowDiscover(true)} 
                  style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}>
                  + New
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {activeChats.length === 0 ? (
                  <div style={{ padding: '20px', color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center' }}>No messages yet. Click "+ New" to find brands!</div>
                ) : (
                  activeChats.map(chat => (
                    <div 
                      key={chat.id} 
                      onClick={() => { setChatWorkspaceId(chat.id); setShowDiscover(false); }}
                      style={{ 
                        padding: '16px 20px', 
                        cursor: 'pointer', 
                        borderBottom: '1px solid var(--border)',
                        background: chatWorkspaceId === chat.id && !showDiscover ? 'rgba(255,255,255,0.05)' : 'transparent'
                      }}
                    >
                      <div style={{ fontWeight: 500 }}>{chat.name}</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {chat.messages.length > 0 ? (chat.messages[chat.messages.length - 1]?.text || chat.messages[chat.messages.length - 1]?.content || 'Active discussion') : 'No messages'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right Pane - Chat Window or Discover */}
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {showDiscover ? (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
                    <h2 style={{ fontSize: '18px', margin: 0 }}>Discover Brands</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>Select a brand to initiate a conversation.</p>
                  </div>
                  <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {allBrands.length === 0 && <div style={{ color: 'var(--text-secondary)' }}>No brands found.</div>}
                    {allBrands.map(brand => (
                      <div key={brand.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                        <div style={{ fontWeight: 600 }}>{brand.name}</div>
                        <GlowButton variant="glow" onClick={() => { setChatWorkspaceId(brand.id); setShowDiscover(false); }}>Message</GlowButton>
                      </div>
                    ))}
                  </div>
                </div>
              ) : activeChats.length === 0 && chatWorkspaceId === 1 && groupedChats[1] === undefined ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                  Select a conversation to start chatting
                </div>
              ) : (
                <>
                  <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
                    <h2 style={{ fontSize: '18px', margin: 0 }}>Conversation with {groupedChats[chatWorkspaceId]?.name || 'Brand'}</h2>
                  </div>
                  
                  <div className="chat-messages" style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {currentChatMessages.map((msg: any, i: number) => {
                      const contentStr = msg.text || msg.content || '';
                      const isSystem = msg.sender === 'system' || msg.sender_type === 'system';
                      if (isSystem) {
                        return (
                          <div key={i} style={{ textAlign: 'center', margin: '8px 0' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '4px 12px', borderRadius: '12px' }}>
                              {contentStr}
                            </span>
                          </div>
                        );
                      }
                      let parsedContent = null;
                      try {
                        if (typeof contentStr === 'string' && contentStr.trim().startsWith('{')) {
                          parsedContent = JSON.parse(contentStr);
                        }
                      } catch (e) {}

                      if (parsedContent && parsedContent.type === 'proposal') {
                        return (
                          <div key={i} style={{ alignSelf: 'center', margin: '16px 0', width: '100%' }}>
                            <div style={{ background: 'rgba(90,82,255,0.1)', border: '1px solid rgba(90,82,255,0.3)', padding: '24px', borderRadius: '12px', textAlign: 'center' }}>
                              <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#fff' }}>Brand Proposed a Deal</h3>
                              <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--success)', marginBottom: '16px' }}>
                                ₹{parsedContent.amount.toLocaleString()}
                              </div>
                              <GlowButton variant="glow" onClick={() => handleAcceptProposal(parsedContent.amount)}>
                                Accept Deal
                              </GlowButton>
                            </div>
                          </div>
                        );
                      }

                      if (parsedContent && parsedContent.type === 'proposal_accepted') {
                        return (
                          <div key={i} style={{ alignSelf: 'center', margin: '16px 0', width: '100%' }}>
                            <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', padding: '16px', borderRadius: '12px', textAlign: 'center', color: 'var(--success)' }}>
                              <CheckCircle2 size={24} style={{ marginBottom: '8px' }} />
                              <div style={{ fontWeight: 'bold' }}>Deal Accepted for ₹{parsedContent.amount.toLocaleString()}</div>
                              <div style={{ fontSize: '13px', marginTop: '4px' }}>Waiting for brand to complete payment...</div>
                            </div>
                          </div>
                        );
                      }

                      if (parsedContent && parsedContent.type === 'payment_complete') {
                        return (
                          <div key={i} style={{ alignSelf: 'center', margin: '16px 0', width: '100%' }}>
                            <div style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.3)', padding: '16px', borderRadius: '12px', textAlign: 'center', color: '#ffd700' }}>
                              <DollarSign size={24} style={{ marginBottom: '8px' }} />
                              <div style={{ fontWeight: 'bold' }}>Payment Received!</div>
                              <div style={{ fontSize: '13px', marginTop: '4px' }}>₹{(parsedContent.amount * 0.9).toLocaleString()} added to your Escrowed Funds (90% cut).</div>
                            </div>
                          </div>
                        );
                      }

                      const isMe = msg.sender === 'creator' || msg.sender_type === 'influencer';
                      return (
                        <div key={i} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', textAlign: isMe ? 'right' : 'left' }}>
                            {isMe ? 'You' : (groupedChats[chatWorkspaceId]?.name || 'Brand Partner')}
                          </div>
                          <div style={{ 
                            background: isMe ? 'rgba(90, 82, 255, 0.15)' : 'rgba(255,255,255,0.05)', 
                            border: '1px solid', borderColor: isMe ? 'rgba(90, 82, 255, 0.3)' : 'var(--border)',
                            padding: '12px 16px', 
                            borderRadius: isMe ? '12px 12px 0 12px' : '12px 12px 12px 0',
                            fontSize: '14px', lineHeight: 1.5
                          }}>
                            {contentStr}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={chatEndRef} />
                  </div>

                  <div style={{ padding: '20px', borderTop: '1px solid var(--border)' }}>
                    <form onSubmit={handleSendChat} style={{ display: 'flex', gap: '12px' }}>
                      <input
                        type="text"
                        placeholder="Reply to the brand..."
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        style={{ flex: 1, padding: '14px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '8px', color: '#fff', outline: 'none' }}
                      />
                      <GlowButton variant="glow" type="submit" style={{ padding: '0 24px' }}>
                        <Send size={18} />
                      </GlowButton>
                    </form>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '28px', fontFamily: 'var(--font-heading)', marginBottom: '32px' }}>Profile & Payout Settings</h1>
            
            <div className="glow-card" style={{ padding: '32px', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '18px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles color="#00E676" size={18} /> Marketplace Badge Settings
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '12px' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '15px', color: '#fff' }}>Offer UGC Video Creation</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Toggle the <span style={{ color: '#00E676', fontWeight: 600 }}>✨ UGC Available</span> badge on your Marketplace card.
                  </div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px' }}>
                  <input 
                    type="checkbox" 
                    checked={offerUGC}
                    onChange={(e) => handleToggleUGC(e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }} 
                  />
                  <span style={{ 
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, 
                    backgroundColor: offerUGC ? '#00E676' : 'rgba(255,255,255,0.2)', 
                    borderRadius: '34px', transition: '.3s' 
                  }} />
                </label>
              </div>
            </div>

            <div className="glow-card" style={{ padding: '32px', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '18px', marginBottom: '24px' }}>Payout Methods</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '12px' }}>
                <div style={{ width: '48px', height: '48px', background: '#635BFF', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <DollarSign color="#fff" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '16px', marginBottom: '4px' }}>Stripe Connect</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Receive 90% payouts securely to your bank account.</div>
                </div>
                <button style={{ padding: '10px 20px', background: '#fff', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
                  Connect Stripe
                </button>
              </div>
            </div>

            <div className="glow-card" style={{ padding: '32px', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '18px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 color="var(--primary)" size={18} /> Social Account Verification
              </h3>
              
              {verificationStatus === 'verified' ? (
                <div style={{ padding: '16px', background: 'rgba(0, 255, 128, 0.1)', border: '1px solid var(--success)', borderRadius: '8px', color: 'var(--success)' }}>
                  ✅ Your account is verified and active! Your portfolio has been auto-generated via AI scraping.
                </div>
              ) : (
                <form onSubmit={handleVerifyProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                    Connect your Instagram to generate your portfolio. Our AI will scan your profile, calculate real engagement, and extract recent collaborations.
                  </p>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '13px', color: '#888', marginBottom: '8px' }}>Instagram Username</label>
                      <input 
                        type="text" 
                        style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', color: '#fff' }} 
                        placeholder="@username"
                        value={verifyForm.username}
                        onChange={e => setVerifyForm({...verifyForm, username: e.target.value})}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '13px', color: '#888', marginBottom: '8px' }}>Primary Category / Niche</label>
                      <input 
                        type="text" 
                        style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', color: '#fff' }} 
                        placeholder="e.g. Tech, Beauty, Gaming"
                        value={verifyForm.niche}
                        onChange={e => setVerifyForm({...verifyForm, niche: e.target.value})}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '13px', color: '#888', marginBottom: '8px' }}>Base Rate per Post (INR)</label>
                      <input 
                        type="number" 
                        style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', color: '#fff' }} 
                        placeholder="e.g. 5000"
                        value={verifyForm.base_rate || ''}
                        onChange={e => setVerifyForm({...verifyForm, base_rate: parseInt(e.target.value) || 0})}
                      />
                    </div>
                  </div>
                  {verificationStatus === 'rejected' && (
                    <div style={{ color: 'var(--warning)', fontSize: '13px' }}>Verification failed. Please ensure your profile is public and authentic.</div>
                  )}
                  <GlowButton variant="glow" type="submit" disabled={isVerifying} style={{ alignSelf: 'flex-start', marginTop: '8px' }}>
                    {isVerifying ? 'Scanning Profile...' : 'Verify Profile'}
                  </GlowButton>
                </form>
              )}
            </div>

            {verificationStatus === 'verified' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '24px' }}>
                
                {/* MARKETPLACE CARD CUSTOMIZER & LIVE PREVIEW */}
                <div className="glow-card" style={{ padding: '28px', border: '1px solid rgba(0,230,118,0.3)', borderRadius: '16px', background: '#0d0d14' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
                    <div>
                      <h3 style={{ fontSize: '18px', margin: 0, color: '#fff', fontWeight: 700 }}>🎴 Marketplace Card Customizer</h3>
                      <p style={{ color: '#8e8e9e', fontSize: '13px', margin: '4px 0 0 0' }}>Customize exactly what brands see on your Influencer Marketplace card.</p>
                    </div>
                    <span style={{ fontSize: '11px', background: 'rgba(0,230,118,0.15)', color: '#00E676', padding: '3px 10px', borderRadius: '100px', fontWeight: 700 }}>Live Marketplace Card Editor</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px', alignItems: 'start' }}>
                    
                    {/* EDITABLE FIELDS FORM */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: '#8e8e9e', fontWeight: 700, marginBottom: '4px' }}>FULL NAME</label>
                          <input
                            type="text"
                            value={cardCustomizer.name}
                            onChange={e => setCardCustomizer({ ...cardCustomizer, name: e.target.value })}
                            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: '#12121c', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff', fontSize: '13px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: '#8e8e9e', fontWeight: 700, marginBottom: '4px' }}>INSTAGRAM HANDLE</label>
                          <input
                            type="text"
                            value={cardCustomizer.handle}
                            onChange={e => setCardCustomizer({ ...cardCustomizer, handle: e.target.value })}
                            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: '#12121c', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#00E676', fontSize: '13px', fontWeight: 600 }}
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#8e8e9e', fontWeight: 700, marginBottom: '4px' }}>PROFILE AVATAR PHOTO URL</label>
                        <input
                          type="text"
                          value={cardCustomizer.avatar}
                          onChange={e => setCardCustomizer({ ...cardCustomizer, avatar: e.target.value })}
                          placeholder="Paste image URL..."
                          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: '#12121c', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff', fontSize: '12.5px' }}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: '#8e8e9e', fontWeight: 700, marginBottom: '4px' }}>PRIMARY NICHE</label>
                          <select
                            value={cardCustomizer.niche}
                            onChange={e => setCardCustomizer({ ...cardCustomizer, niche: e.target.value })}
                            style={{ width: '100%', padding: '10px 12px', background: '#12121c', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff', fontSize: '13px' }}
                          >
                            <option value="Lifestyle">Lifestyle</option>
                            <option value="Fashion">Fashion</option>
                            <option value="Fitness">Fitness</option>
                            <option value="Tech">Tech</option>
                            <option value="Art">Art</option>
                            <option value="Education">Education</option>
                            <option value="Local / City-based">Local / City-based</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: '#8e8e9e', fontWeight: 700, marginBottom: '4px' }}>LOCATION (CITY / STATE)</label>
                          <input
                            type="text"
                            value={cardCustomizer.location}
                            onChange={e => setCardCustomizer({ ...cardCustomizer, location: e.target.value })}
                            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: '#12121c', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff', fontSize: '13px' }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: '#8e8e9e', fontWeight: 700, marginBottom: '4px' }}>EXACT FOLLOWER COUNT</label>
                          <input
                            type="text"
                            value={cardCustomizer.followers}
                            onChange={e => setCardCustomizer({ ...cardCustomizer, followers: e.target.value })}
                            placeholder="e.g. 4,983 or 95,000"
                            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: '#12121c', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff', fontSize: '13px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: '#8e8e9e', fontWeight: 700, marginBottom: '4px' }}>AVG VIEWS / TOTAL REACH</label>
                          <input
                            type="text"
                            value={cardCustomizer.avgViews}
                            onChange={e => setCardCustomizer({ ...cardCustomizer, avgViews: e.target.value })}
                            placeholder="e.g. 11.3M total views (3k avg)"
                            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: '#12121c', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#00E676', fontSize: '13px', fontWeight: 600 }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: '#8e8e9e', fontWeight: 700, marginBottom: '4px' }}>EXPECTED REEL PRICE (₹)</label>
                          <input
                            type="text"
                            value={cardCustomizer.expectedPrice}
                            onChange={e => setCardCustomizer({ ...cardCustomizer, expectedPrice: e.target.value })}
                            placeholder="e.g. ₹10,000"
                            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: '#12121c', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#00E676', fontSize: '13px', fontWeight: 700 }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: '#8e8e9e', fontWeight: 700, marginBottom: '4px' }}>DIRECT INSTAGRAM LINK</label>
                          <input
                            type="text"
                            value={cardCustomizer.profileLink}
                            onChange={e => setCardCustomizer({ ...cardCustomizer, profileLink: e.target.value })}
                            placeholder="https://www.instagram.com/..."
                            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: '#12121c', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff', fontSize: '12.5px' }}
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          localStorage.setItem('raftra_creator_card_custom', JSON.stringify(cardCustomizer));
                          alert('Saved Marketplace Card Details! Your card will now show these exact custom details on the Brand Marketplace.');
                        }}
                        style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #00E676 0%, #00B0FF 100%)', color: '#000', border: 'none', borderRadius: '8px', fontSize: '13.5px', fontWeight: 800, cursor: 'pointer', marginTop: '6px', alignSelf: 'flex-start' }}
                      >
                        💾 Save Profile & Update Marketplace Card
                      </button>
                    </div>

                    {/* LIVE MARKETPLACE CARD PREVIEW */}
                    <div style={{ background: '#07070e', border: '1px solid rgba(0,230,118,0.4)', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ fontSize: '10.5px', color: '#00E676', fontWeight: 800, textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>
                        👁️ Live Marketplace Preview
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <img
                            src={cardCustomizer.avatar || "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=400&q=80"}
                            alt={cardCustomizer.name}
                            style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(0,230,118,0.5)' }}
                          />
                          <div>
                            <h4 style={{ fontSize: '15px', margin: '0 0 2px 0', color: '#fff', fontWeight: 700 }}>
                              {cardCustomizer.name || 'Creator Name'}
                            </h4>
                            <div style={{ fontSize: '11.5px', color: '#00E676', fontWeight: 600 }}>{cardCustomizer.handle || '@handle'}</div>
                            {cardCustomizer.location && (
                              <div style={{ fontSize: '10px', color: '#8e8e9e', marginTop: '2px' }}>📍 {cardCustomizer.location}</div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', fontSize: '12.5px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#8e8e9e' }}>Followers</span>
                          <span style={{ color: '#fff', fontWeight: 700 }}>{cardCustomizer.followers}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#8e8e9e' }}>Avg Views</span>
                          <span style={{ color: '#00E676', fontWeight: 700 }}>{cardCustomizer.avgViews}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#8e8e9e' }}>Expected Price</span>
                          <span style={{ color: '#00E676', fontWeight: 800 }}>{cardCustomizer.expectedPrice}</span>
                        </div>
                      </div>

                      <div style={{ background: 'rgba(255,255,255,0.04)', padding: '8px 10px', borderRadius: '6px', fontSize: '10.5px', color: '#bbb' }}>
                        Visible to all brands on Raftra Marketplace
                      </div>
                    </div>

                  </div>
                </div>

                {/* EDIT PORTFOLIO DETAILS */}
                <div className="glow-card" style={{ padding: '32px' }}>
                  <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Edit Portfolio Details</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
                  Your profile was generated by AI. You can manually adjust your recent posts, collaborations, and reviews below.
                </p>
                <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Profile Avatar Photo URL</label>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <img
                        src={profileForm.avatar || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80"}
                        alt="Avatar Preview"
                        style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(0,230,118,0.5)' }}
                      />
                      <input
                        type="text"
                        placeholder="Paste image URL (e.g. https://images.unsplash.com/...)"
                        value={profileForm.avatar || ''}
                        onChange={e => setProfileForm({ ...profileForm, avatar: e.target.value })}
                        style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', color: '#fff' }}
                      />
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Recent Posts</label>
                      <button type="button" onClick={() => setProfileForm({...profileForm, recent_posts: [...profileForm.recent_posts, {url: '', type: 'link'}]})} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '12px' }}>+ Add Post</button>
                    </div>
                    {profileForm.recent_posts.map((post, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <input type="text" placeholder="Image/Reel URL" value={post.url} onChange={e => {
                          const newPosts = [...profileForm.recent_posts];
                          newPosts[idx].url = e.target.value;
                          setProfileForm({...profileForm, recent_posts: newPosts});
                        }} style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', color: '#fff' }} />
                        <button type="button" onClick={() => {
                          const newPosts = [...profileForm.recent_posts];
                          newPosts.splice(idx, 1);
                          setProfileForm({...profileForm, recent_posts: newPosts});
                        }} style={{ padding: '0 12px', background: 'rgba(255,0,0,0.1)', color: '#ff4444', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>✕</button>
                      </div>
                    ))}
                  </div>

                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Recent Brand Collaborations (Comma separated)</label>
                    <input type="text" placeholder="e.g. Nike, Zara, Gymshark" value={profileForm.recent_collabs.join(', ')} onChange={e => {
                      const val = e.target.value;
                      setProfileForm({...profileForm, recent_collabs: val.split(',').map(s => s.trim()).filter(Boolean)});
                    }} style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', color: '#fff' }} />
                  </div>

                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Top Reviews</label>
                      <button type="button" onClick={() => setProfileForm({...profileForm, recent_reviews: [...profileForm.recent_reviews, {author: '', text: ''}]})} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '12px' }}>+ Add Review</button>
                    </div>
                    {profileForm.recent_reviews.map((rev, idx) => (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px', padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '8px', position: 'relative' }}>
                        <button type="button" onClick={() => {
                          const newRevs = [...profileForm.recent_reviews];
                          newRevs.splice(idx, 1);
                          setProfileForm({...profileForm, recent_reviews: newRevs});
                        }} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer' }}>✕</button>
                        <input type="text" placeholder="Author (e.g. Marketing Director, Nike)" value={rev.author} onChange={e => {
                          const newRevs = [...profileForm.recent_reviews];
                          newRevs[idx].author = e.target.value;
                          setProfileForm({...profileForm, recent_reviews: newRevs});
                        }} style={{ padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', color: '#fff', width: '90%' }} />
                        <textarea placeholder="Review text" value={rev.text} onChange={e => {
                          const newRevs = [...profileForm.recent_reviews];
                          newRevs[idx].text = e.target.value;
                          setProfileForm({...profileForm, recent_reviews: newRevs});
                        }} style={{ padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', color: '#fff', width: '100%', minHeight: '60px', fontFamily: 'inherit' }} />
                      </div>
                    ))}
                  </div>
                  <GlowButton variant="glow" type="submit" style={{ alignSelf: 'flex-start', marginTop: '8px' }}>Save Changes</GlowButton>
                </form>
              </div>
            </div>
            )}

            <div className="glow-card" style={{ padding: '32px' }}>
              <h3 style={{ fontSize: '18px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={18} color="var(--warning)" /> Platform Policy
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
                Raftra AI operates a strict 90/10 revenue split. The brand's payment is held in escrow upon deal finalization. Once you submit the deliverables, 90% of the funds are automatically routed to your Stripe account. Attempts to circumvent the platform for direct payment may result in account termination.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* TAX INVOICE DOWNLOAD MODAL FOR CREATOR */}
      {showInvoiceModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', padding: '20px' }}>
          <div className="glow-card" style={{ width: '600px', background: '#0a0a0d', border: '1px solid #00E676', borderRadius: '20px', padding: '32px', position: 'relative' }}>
            <button onClick={() => setShowInvoiceModal(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: '#fff', fontSize: '24px', cursor: 'pointer' }}>&times;</button>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '20px', margin: 0, color: '#fff', fontFamily: 'var(--font-heading)' }}>OFFICIAL TAX INVOICE & PAYOUT RECEIPT</h3>
                <div style={{ fontSize: '12px', color: '#00E676', fontWeight: 700, marginTop: '2px' }}>INV-RAFTRA-2026-84920</div>
              </div>
              <div style={{ padding: '6px 12px', background: 'rgba(0,230,118,0.15)', color: '#00E676', borderRadius: '8px', fontSize: '11px', fontWeight: 800, border: '1px solid #00E676' }}>
                PAID & DISBURSED
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13px', marginBottom: '24px', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px' }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Billed To:</span> <br/><b style={{ color: '#fff' }}>Ambrane India (Brand Partner)</b></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Creator Beneficiary:</span> <br/><b style={{ color: '#fff' }}>Ankit Kumar (@ankrena)</b></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Bank Name:</span> <b style={{ color: '#fff' }}>{bankDetails.bankName}</b></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Account No:</span> <b style={{ color: '#fff' }}>{bankDetails.accountNumber}</b></div>
              <div><span style={{ color: 'var(--text-muted)' }}>UPI ID:</span> <b style={{ color: '#fff' }}>{bankDetails.upiId}</b></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Human Audit Stamp:</span> <b style={{ color: '#00C4CC' }}>Team Raftra Verified 🔍</b></div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '14px 0', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Gross Campaign Deal Value:</span>
                <span style={{ color: '#fff', fontWeight: 700 }}>₹10,000</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Raftra AI Platform Fee (10%):</span>
                <span style={{ color: '#f87171' }}>- ₹1,000</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 800, color: '#00E676', paddingTop: '8px', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                <span>Net Disbursed Payout:</span>
                <span>₹9,000</span>
              </div>
            </div>

            <button
              onClick={() => window.print()}
              style={{ width: '100%', padding: '14px', background: '#00E676', color: '#000', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 800, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
            >
              🖨️ Print / Save PDF Invoice
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
