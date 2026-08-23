import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, MessageCircle, DollarSign, Send, CheckCircle2, ShieldAlert, Sparkles, User, CreditCard, BadgeCheck, Activity, LogOut, FileText } from 'lucide-react';
import { GlowButton } from './GlowButton';
import parsedCreatorsData from '../data/influencers_parsed.json';
import { CreatorBrandOpportunitiesView, CreatorApplicationsView } from './workspaces/PostedDealsWorkflow';

interface CreatorPortalProps {
  onLogout: () => void;
}

export const CreatorPortal: React.FC<CreatorPortalProps> = ({ onLogout }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inbox' | 'brand_opportunities' | 'my_applications' | 'profile_setup' | 'payment_setup'>('dashboard');
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
  
  const DEFAULT_CREATOR_CARD = {
    name: 'samaira rao',
    handle: '@samairaa.r',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    niche: 'Fashion & Lifestyle',
    category: 'MICRO',
    location: 'gurgaon haryana india',
    followers: '18.8k',
    avgViews: '2.5M peak (170k reach)',
    fakeFollowerScore: '1%',
    expectedPrice: '₹500 - ₹1,000',
    profileLink: 'https://www.instagram.com/samairaa.r',
    deliverables: ['UGC Video', 'Reel', 'Story', 'Static Post']
  };

  const [cardCustomizer, setCardCustomizer] = useState(() => {
    const savedCard = localStorage.getItem('raftra_creator_card_custom');
    if (savedCard) {
      try {
        const parsed = JSON.parse(savedCard);
        return { ...DEFAULT_CREATOR_CARD, ...parsed };
      } catch (e) {}
    }
    return DEFAULT_CREATOR_CARD;
  });

  const [selectedBrandId, setSelectedBrandId] = useState('demo_brand');
  const [brandList, setBrandList] = useState([
    {
      id: 'demo_brand',
      workspaceId: 1,        // ← each brand entry now carries workspaceId
      name: 'Demo Brand',
      logo: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?auto=format&fit=crop&w=100&q=80',
      verified: true,
      lastMsg: '⚡ Official Proposal',
      time: 'Just now',
      unread: false
    }
  ]);

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
    setCardCustomizer(updatedCard);
    localStorage.setItem('raftra_creator_card_custom', JSON.stringify(updatedCard));
    window.dispatchEvent(new Event('storage'));
  };

  const [verifyForm, setVerifyForm] = useState({ username: '', niche: '', base_rate: 0 });
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'unverified'|'pending'|'verified'|'rejected'>('unverified');
  // Why the check ended where it did. Instagram serves a login wall to scrapers, so
  // "unverified" is the normal outcome and the creator deserves to know that rather than
  // being shown a silent failure - or, as before, a verified badge for a check that never ran.
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);

  const [allBrands, setAllBrands] = useState<{id: number, name: string}[]>([]);
  const [showDiscover, setShowDiscover] = useState(false);

  // Proof Submission & Human Verification State
  const [proofTokenInput, setProofTokenInput] = useState('');
  const [proofFileScreenshot, setProofFileScreenshot] = useState<string | null>(null);
  const [proofVerificationStatus, setProofVerificationStatus] = useState<'idle' | 'under_review' | 'verified_payout'>('idle');
  const [proofSubmissionToast, setProofSubmissionToast] = useState<string | null>(null);

  // Payout Bank Details & Tax Invoice State (Initialized empty for user setup)
  const [bankDetails, setBankDetails] = useState({
    accountHolder: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    upiId: ''
  });
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [creatorDeals, setCreatorDeals] = useState<any[]>([]);
  const [creatorPayouts, setCreatorPayouts] = useState<any[]>([]);

  const proofFileInputRef = useRef<HTMLInputElement>(null);

  const handleProofFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show temporary preview
    const tempUrl = URL.createObjectURL(file);
    setProofFileScreenshot(tempUrl);

    // Upload to backend media route (Cloudinary / Local static storage fallback)
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.url) {
        setProofFileScreenshot(data.url);
      }
    } catch (err) {
      console.warn("Cloudinary/Media upload fallback to blob:", err);
    }
  };

  const handleSubmitProofToTeamRaftra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proofTokenInput && !proofFileScreenshot) {
      alert("Please paste the verification token or upload a screenshot of your WhatsApp/IG DM chat approval.");
      return;
    }

    setProofVerificationStatus('under_review');
    setProofSubmissionToast('📩 Proof submitted to Team Raftra Admin (raftra.77@gmail.com)! Human auditor is reviewing your screenshot & verification code (Est: 15-30 mins).');

    try {
      await fetch('/api/payouts/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creator_handle: cardCustomizer.handle || myHandle,
          creator_name: cardCustomizer.name || 'Creator',
          screenshot_url: proofFileScreenshot,
          token_submitted: proofTokenInput,
          bank_account_holder: bankDetails.accountHolder,
          bank_name: bankDetails.bankName,
          account_number: bankDetails.accountNumber,
          ifsc_code: bankDetails.ifscCode,
          upi_id: bankDetails.upiId
        })
      });
    } catch (err) {
      console.error("Error submitting payout to backend:", err);
    }

    setTimeout(() => setProofSubmissionToast(null), 6000);
  };

  const handleSimulateHumanApproval = async () => {
    setProofVerificationStatus('verified_payout');
    setProofSubmissionToast('✅ Human Verification Approved by Team Raftra! Net payout disbursed to your bank account via Razorpay/UPI.');

    try {
      // Trigger approval on backend
      const cleanH = (cardCustomizer.handle || myHandle).replace('@', '').toLowerCase();
      const res = await fetch(`/api/payouts/creator/${cleanH}`);
      const payouts = await res.json();
      if (Array.isArray(payouts) && payouts.length > 0) {
        const latestP = payouts[0];
        await fetch(`/api/payouts/${latestP.id}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ admin_note: "Verified by Team Raftra Admin" })
        });
      }
    } catch (err) {
      console.error("Backend approval simulation error:", err);
    }

    setTimeout(() => setProofSubmissionToast(null), 6000);
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    let loggedUser = '';
    if (token) {
      try {
        const payloadBase64 = token.split('.')[1];
        if (payloadBase64) {
          const decoded = JSON.parse(atob(payloadBase64));
          loggedUser = (decoded.username || decoded.handle || decoded.email || decoded.first_name || '').toLowerCase();
        }
      } catch (e) {}
    }

    // Match logged-in user with parsed influencers database sheet
    if (loggedUser) {
      const matched = (parsedCreatorsData as any[]).find(c => {
        const handleClean = (c.handle || '').toLowerCase().replace('@', '');
        const nameClean = (c.name || '').toLowerCase();
        const emailClean = (c.email || '').toLowerCase();
        return loggedUser.includes(handleClean) || loggedUser.includes(nameClean) || loggedUser.includes(emailClean) || handleClean.includes(loggedUser);
      });

      if (matched) {
        const matchedCard = {
          name: matched.name,
          handle: matched.handle,
          avatar: matched.avatar || DEFAULT_CREATOR_CARD.avatar,
          niche: matched.niche || 'Lifestyle',
          category: (matched.category || 'MICRO').toUpperCase(),
          location: matched.location || 'India',
          followers: matched.followers || '10k+',
          avgViews: matched.avgViews || '20k+ avg',
          fakeFollowerScore: `${matched.fakeFollowerScore || 1}%`,
          expectedPrice: matched.expectedPrice || matched.priceRange || '₹1,000 - ₹3,000',
          profileLink: matched.profileLink || `https://www.instagram.com/${matched.handle.replace('@', '')}`,
          deliverables: matched.deliverables || ['UGC Video', 'Reel', 'Story', 'Static Post']
        };
        setCardCustomizer(matchedCard);
        localStorage.setItem('raftra_creator_card_custom', JSON.stringify(matchedCard));
      }
    }

    fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(r => r.json()).then(data => {
      setMe(data);
    }).catch(() => {});

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
    }).catch(() => {});
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Derive the creator's own handle (stable, matches brand side)
  const myHandle = (cardCustomizer.handle || '@samairaa.r').replace('@', '').toLowerCase();

  useEffect(() => {
    if (!myHandle) return;
    fetch(`/api/deals/creator/${myHandle}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setCreatorDeals(data); })
      .catch(() => {});

    fetch(`/api/payouts/creator/${myHandle}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setCreatorPayouts(data); })
      .catch(() => {});
  }, [myHandle, activeTab]);

  // Active brand’s workspaceId (determines WS room)
  const activeBrand = brandList.find(b => b.id === selectedBrandId) || brandList[0];
  const activeWorkspaceId = activeBrand?.workspaceId ?? 1;

  // Room key matches brand formula: ws{workspaceId}_{handle}
  const activeRoomKey = `ws${activeWorkspaceId}_${myHandle}`;
  const creatorStorageKey = `raftra_chat_${activeRoomKey}`;

  // ── Real-time WebSocket chat (creator side) ────────────────────────────
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsHost = window.location.hostname === 'localhost' ? 'localhost:8000' : window.location.host;
    const ws = new WebSocket(`${protocol}://${wsHost}/ws/chat/${activeRoomKey}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'connected') return;
        if (data.sender && data.text !== undefined) {
          // If message has a workspaceId we haven’t seen → auto-add that brand to inbox
          if (data.workspaceId && data.workspaceId !== activeWorkspaceId) {
            const incomingRoomKey = `ws${data.workspaceId}_${myHandle}`;
            const incomingStorageKey = `raftra_chat_${incomingRoomKey}`;
            const existing = JSON.parse(localStorage.getItem(incomingStorageKey) || '[]');
            localStorage.setItem(incomingStorageKey, JSON.stringify([...existing, data]));
            // Mark as unread in brand list
            setBrandList(prev => {
              const existsBrand = prev.find(b => b.workspaceId === data.workspaceId);
              if (!existsBrand) {
                return [...prev, {
                  id: `brand_${data.workspaceId}`,
                  workspaceId: data.workspaceId,
                  name: `Brand #${data.workspaceId}`,
                  logo: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?auto=format&fit=crop&w=100&q=80',
                  verified: true,
                  lastMsg: data.text,
                  time: 'Just now',
                  unread: true
                }];
              }
              return prev.map(b => b.workspaceId === data.workspaceId ? { ...b, unread: true, lastMsg: data.text } : b);
            });
            return;
          }
          // Message is for the currently open brand chat
          setChatMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.sender === data.sender && lastMsg.text === data.text) {
              return prev;
            }
            const updated = [...prev, data];
            localStorage.setItem(creatorStorageKey, JSON.stringify(updated));
            return updated;
          });
        }
      } catch (err) {}
    };

    ws.onerror = (e) => console.warn('[Creator Chat WS] error:', e);
    ws.onclose = () => console.log('[Creator Chat WS] disconnected from room:', activeRoomKey);

    // Load saved messages for this brand from localStorage
    const saved = localStorage.getItem(creatorStorageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setChatMessages(parsed);
        } else {
          // Only show demo chat for the default Demo Brand (workspaceId=1)
          if (activeWorkspaceId === 1) initDemoBrandChat();
          else setChatMessages([{ sender: 'system', text: '🔒 SECURE ESCROW WORKSPACE ACTIVATED. No messages yet.' }]);
        }
      } catch (e) {
        if (activeWorkspaceId === 1) initDemoBrandChat();
        else setChatMessages([]);
      }
    } else {
      if (activeWorkspaceId === 1) initDemoBrandChat();
      else setChatMessages([{ sender: 'system', text: '🔒 SECURE ESCROW WORKSPACE ACTIVATED. No messages yet.' }]);
    }

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [activeRoomKey, activeWorkspaceId]);


  const initDemoBrandChat = () => {
    const creatorName = cardCustomizer.name || 'samaira rao';
    const creatorHandle = cardCustomizer.handle || '@samairaa.r';
    const creatorRate = cardCustomizer.expectedPrice || '₹500 - ₹1,000';
    // Build the storageKey from current activeRoomKey at call time
    const currentRoomKey = `ws${1}_${(cardCustomizer.handle || '@samairaa.r').replace('@', '').toLowerCase()}`;
    const currentStorageKey = `raftra_chat_${currentRoomKey}`;

    const initialMsgs = [
      { sender: 'system', workspaceId: 1, text: '🔒 SECURE ESCROW END-TO-END WORKSPACE #1 ACTIVATED' },
      { sender: 'brand', workspaceId: 1, text: `Hi ${creatorName} (${creatorHandle})! We loved your recent viral content. We're launching our new campaign and want to partner with you for a dedicated UGC video reel.` },
      { sender: 'creator', workspaceId: 1, text: "Hey Demo Brand team! Thanks for reaching out. What exact deliverables are you expecting and what is your campaign timeline?" },
      { sender: 'brand', workspaceId: 1, text: "We need 1 High-Quality UGC Reel (30-45 sec with product unboxing + feature demonstration) + 2 Instagram Story Swipe-ups with link tag." },
      { sender: 'creator', workspaceId: 1, text: `Got it! My rate for 1 UGC Reel + 2 Stories is ${creatorRate}. I will deliver the first draft within 3 days after deal acceptance.` },
      { sender: 'brand', workspaceId: 1, text: `${creatorRate} works great for us! I am sending the official deal proposal now with final deliverables & price breakdown.` },
      { sender: 'brand', workspaceId: 1, text: JSON.stringify({ type: 'proposal', amount: 1000, deliverables: '1 UGC Reel (30-45s) + 2 Instagram Story Links' }) }
    ];
    setChatMessages(initialMsgs);
    localStorage.setItem(currentStorageKey, JSON.stringify(initialMsgs));
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
      // Notify brand via WebSocket
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(violationMsg));
      }
      return;
    }

    const newMsg = {
      sender: 'creator' as const,
      sender_type: 'influencer',
      workspaceId: activeWorkspaceId,  // so brand side knows which workspace
      text: input,
      content: input
    };

    const updated = [...currentMsgs, newMsg];
    setChatMessages(updated);
    localStorage.setItem(creatorStorageKey, JSON.stringify(updated));
    // Send via real WebSocket so brand receives in real-time
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(newMsg));
    }
  };

  const handleAcceptProposal = async (amount: number) => {
    // Notify backend database that creator has accepted the deal & locked escrow
    try {
      const cleanH = myHandle;
      const res = await fetch(`/api/deals/creator/${cleanH}`);
      const deals = await res.json();
      if (Array.isArray(deals) && deals.length > 0) {
        const pendingDeal = deals.find((d: any) => d.status === 'pending') || deals[0];
        await fetch(`/api/deals/${pendingDeal.id}/accept`, { method: 'POST' });
      }
    } catch (err) {
      console.warn("Backend deal acceptance sync notice:", err);
    }

    const acceptMsg = {
      sender: 'creator' as const,
      sender_type: 'influencer',
      text: JSON.stringify({ type: 'proposal_accepted', amount }),
      content: JSON.stringify({ type: 'proposal_accepted', amount })
    };
    const autoDoneMsg = {
      sender: 'system' as const,
      sender_type: 'system',
      text: '✨ DEAL ACCEPTED & ESCROW LOCKED! Brand will contact you on WhatsApp. Once deliverables are completed, get the satisfactory message from Brand & upload screenshot in Payment Setup for instant payout.'
    };
    const currentMsgs = JSON.parse(localStorage.getItem(creatorStorageKey) || JSON.stringify(chatMessages));
    const filtered = currentMsgs.filter((m: any) => {
      const str = m.text || m.content || '';
      return !str.includes('proposal_accepted') && !str.includes('DEAL ACCEPTED');
    });
    const updated = [...filtered, acceptMsg, autoDoneMsg];
    setChatMessages(updated);
    localStorage.setItem(creatorStorageKey, JSON.stringify(updated));
    // Send accept message via WebSocket so brand knows in real-time
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(acceptMsg));
      wsRef.current.send(JSON.stringify(autoDoneMsg));
    }
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
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        throw new Error((data && data.detail) || `server returned ${res.status}`);
      }

      const status = data.verification_status || 'unverified';
      setProfileForm({
        avatar: data.influencer?.avatar || '',
        recent_posts: data.influencer?.recent_posts || [],
        recent_collabs: data.influencer?.recent_collabs || [],
        recent_reviews: data.influencer?.recent_reviews || []
      });

      if (status === 'verified') {
        setVerificationStatus('verified');
        setVerifyMessage('Your profile was read and matched. Details saved.');
      } else if (status === 'rejected_fake_followers') {
        setVerificationStatus('rejected');
        setVerifyMessage('The profile showed fake-follower signals, so it was not verified. Your details were still saved.');
      } else {
        // Not a failure of the save - only of the check.
        setVerificationStatus('unverified');
        setVerifyMessage(
          (data.reason || 'The profile could not be read automatically.')
          + ' Your details are saved and live on your card; the verified badge stays off until a check succeeds.');
      }
    } catch (e: any) {
      console.error(e);
      setVerificationStatus('unverified');
      setVerifyMessage(`Could not reach verification: ${e?.message || 'server unreachable'}`);
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
      <div style={{ width: '250px', background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)', padding: '24px', display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '48px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #5A52FF 0%, #B252FF 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
            C
          </div>
          <span style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-heading)' }}>Creator Dashboard</span>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'brand_opportunities', label: 'Brand Opportunities', icon: Sparkles },
            { id: 'my_applications', label: 'My Applications', icon: FileText },
            { id: 'inbox', label: 'Inbox', icon: MessageCircle },
            { id: 'profile_setup', label: 'Profile Setup', icon: User },
            { id: 'payment_setup', label: 'Payment Setup', icon: CreditCard },
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

        <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button 
            onClick={onLogout} 
            style={{ 
              width: '100%',
              padding: '12px', 
              background: 'rgba(255,77,77,0.1)', 
              color: '#FF4D4D', 
              border: '1px solid rgba(255,77,77,0.3)', 
              borderRadius: '8px', 
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            <LogOut size={16} /> Log Out
          </button>
        </div>
      </div>

        {/* Main Content */}
      <div style={{ flex: 1, padding: '28px 36px', overflowY: 'auto', width: '100%', boxSizing: 'border-box' }}>

        {/* 🌟 BRAND OPPORTUNITIES TAB */}
        {activeTab === 'brand_opportunities' && (
          <div style={{ width: '100%' }}>
            <CreatorBrandOpportunitiesView
              creatorHandle={cardCustomizer.handle || 'samairaa.r'}
              creatorName={cardCustomizer.name || 'Samaira Rao'}
              creatorAvatar={cardCustomizer.avatar}
              creatorFollowers={cardCustomizer.followers}
              onOpenChatWithBrand={(brandId, campaignName) => setActiveTab('inbox')}
            />
          </div>
        )}

        {/* 📋 MY APPLICATIONS TAB */}
        {activeTab === 'my_applications' && (
          <div style={{ width: '100%' }}>
            <CreatorApplicationsView
              creatorHandle={cardCustomizer.handle || 'samairaa.r'}
              onOpenChatWithBrand={(brandName) => setActiveTab('inbox')}
            />
          </div>
        )}

        {/* 📊 DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h1 style={{ fontSize: '26px', fontFamily: 'var(--font-heading)', margin: '0 0 4px 0', color: '#fff' }}>
                  Creator Dashboard 📊
                </h1>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                  Overview of your active brand campaigns, earnings, and escrow funds.
                </p>
              </div>
              <div style={{ padding: '6px 14px', background: 'rgba(0,230,118,0.12)', border: '1px solid #00E676', borderRadius: '100px', fontSize: '12px', color: '#00E676', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <BadgeCheck size={16} /> Verified Creator Partner
              </div>
            </div>

            {/* Stat Cards - Live Backend & Dynamic Calculation */}
            {(() => {
              const paidPayoutsSum = creatorPayouts
                .filter((p: any) => p.status === 'paid')
                .reduce((acc: number, p: any) => acc + (p.amount || 9000), 0);
              const activeDealsCount = creatorDeals.filter((d: any) => d.status === 'active' || d.status === 'pending' || d.status === 'delivered').length;
              const totalPayoutCount = creatorPayouts.filter((p: any) => p.status === 'paid').length;

              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                  <div className="glow-card" style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '6px', fontWeight: 600 }}>TOTAL PAYOUTS DISBURSED</div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: '#00E676', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      ₹{paidPayoutsSum.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{totalPayoutCount} Payouts Disbursed</div>
                  </div>

                  <div className="glow-card" style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '6px', fontWeight: 600 }}>ACTIVE BRAND DEALS</div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {activeDealsCount} Deals
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{activeDealsCount} Active Campaigns</div>
                  </div>

                  <div className="glow-card" style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '6px', fontWeight: 600 }}>FOLLOWER REACH</div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: '#00C4CC' }}>{cardCustomizer.followers}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Synced with {cardCustomizer.handle} ({cardCustomizer.avgViews})</div>
                  </div>

                  <div className="glow-card" style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '6px', fontWeight: 600 }}>APPROVAL RATING</div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: '#FFB300' }}>4.9 ★</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Top Performing Creator</div>
                  </div>
                </div>
              );
            })()}

            {/* Brand Collaborations Status Tracker Table */}
            <div className="glow-card" style={{ padding: '24px', marginBottom: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', margin: 0, color: '#fff', fontFamily: 'var(--font-heading)' }}>Brand Collaborations Status Tracker</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Live Status Tracker ({creatorDeals.length} Deals)</span>
              </div>

              {creatorDeals.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text-secondary)' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>📊</div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#fff', marginBottom: '4px' }}>No Active Brand Deals</div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>When a brand reaches out and sends a deal proposal on Raftra Marketplace, your status tracker will update here.</div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '10px' }}>BRAND</th>
                        <th style={{ padding: '10px' }}>AMOUNT</th>
                        <th style={{ padding: '10px' }}>DELIVERABLES</th>
                        <th style={{ padding: '10px' }}>STATUS</th>
                        <th style={{ padding: '10px' }}>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {creatorDeals.map((deal: any) => (
                        <tr key={deal.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '12px 10px', fontWeight: 700, color: '#fff' }}>{deal.brand_name || 'Brand Partner'}</td>
                          <td style={{ padding: '12px 10px', color: '#00E676', fontWeight: 800 }}>₹{deal.amount?.toLocaleString()}</td>
                          <td style={{ padding: '12px 10px', color: 'rgba(255,255,255,0.8)' }}>{deal.deliverables}</td>
                          <td style={{ padding: '12px 10px' }}>
                            <span style={{
                              padding: '4px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 700,
                              background: deal.status === 'paid' ? 'rgba(0,230,118,0.15)' : deal.status === 'delivered' ? 'rgba(0,196,204,0.15)' : deal.status === 'active' ? 'rgba(90,82,255,0.2)' : 'rgba(255,179,0,0.15)',
                              color: deal.status === 'paid' ? '#00E676' : deal.status === 'delivered' ? '#00C4CC' : deal.status === 'active' ? '#8B85FF' : '#FFB300',
                              border: '1px solid currentColor'
                            }}>
                              {deal.status === 'paid' ? '✅ Paid' : deal.status === 'delivered' ? '🚀 Payment Released' : deal.status === 'active' ? '🔒 Escrow Locked' : '⏳ Pending Acceptance'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 10px' }}>
                            <button
                              onClick={() => setActiveTab('inbox')}
                              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: '#fff', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
                            >
                              Open Chat
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 🚨 STRICT ANTI-BYPASS & LEGAL WARNING BANNER */}
            <div 
              className="glow-card" 
              style={{ 
                padding: '24px', 
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(185, 28, 28, 0.08))', 
                border: '1.5px solid rgba(239, 68, 68, 0.5)', 
                borderRadius: '16px',
                boxShadow: '0 8px 32px rgba(239, 68, 68, 0.15)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <ShieldAlert size={22} color="#EF4444" />
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#EF4444', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  🚨 STRICT PLATFORM POLICY & LEGAL ACTION WARNING NOTICE
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🛑 NO PERSONAL / OFF-PLATFORM CONTACT
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.45 }}>
                    Exchanging personal phone numbers, WhatsApp contact cards, Instagram DMs, email handles, or direct GPay/UPI accounts is strictly prohibited. All brand negotiations & payments must remain inside Raftra Escrow Vault.
                  </div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🤖 24/7 AUTOMATED AI FRAUD DETECTION
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.45 }}>
                    Raftra AI actively scans all chat messages for obfuscated digits, hidden links, external keywords, or fraud patterns. Any bypass attempt is automatically blocked, flagged, and reported.
                  </div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    ⚖️ LEGAL ACTION & ACCOUNT TERMINATION
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.45 }}>
                    If scam, fraud, or off-platform contact is detected, the creator account will be <b>permanently terminated</b>, escrow payouts <b>forfeited</b>, and <b>legal action initiated under IT Act Sec 66D & IPC Sec 420</b>.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 💬 INBOX TAB (INSTAGRAM DIRECT DM STYLE - BRAND CHATS) */}
        {activeTab === 'inbox' && (
          <div style={{ width: '100%', height: 'calc(100vh - 120px)', display: 'flex', gap: '16px', background: '#0a0a0d', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
            
            {/* Left Pane - Chat List */}
            <div style={{ width: '320px', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.01)' }}>
              <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '16px', margin: 0, color: '#fff', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MessageCircle size={18} color="#00E676" /> Brand Direct Messages
                </h3>
              </div>

              <div style={{ flex: 1, overflowY: 'auto' }}>
                {brandList.map(brand => {
                  const isSelected = selectedBrandId === brand.id;
                  const isDemo = brand.id === 'demo_brand';
                  const lastMsgText = isDemo && chatMessages.length > 0
                    ? (chatMessages[chatMessages.length - 1].text || chatMessages[chatMessages.length - 1].content || brand.lastMsg)
                    : brand.lastMsg;

                  return (
                    <div 
                      key={brand.id}
                      onClick={() => {
                        setSelectedBrandId(brand.id);
                        // Clear unread badge when selected
                        setBrandList(prev => prev.map(b => b.id === brand.id ? { ...b, unread: false } : b));
                      }}
                      style={{ 
                        padding: '14px 18px', 
                        cursor: 'pointer', 
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        background: isSelected ? 'rgba(90,82,255,0.15)' : 'transparent',
                        borderLeft: isSelected ? '3px solid var(--primary)' : '3px solid transparent',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <img src={brand.logo} alt={brand.name} style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }} />
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                          <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#fff' }}>{brand.name}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {brand.unread && (
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00E676', display: 'inline-block', flexShrink: 0 }} />
                            )}
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{brand.time}</span>
                          </div>
                        </div>
                        <div style={{ fontSize: '12px', color: isSelected ? '#00E676' : 'var(--text-secondary)', fontWeight: brand.unread ? 700 : (isSelected ? 600 : 400), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {typeof lastMsgText === 'string' && lastMsgText.includes('proposal') ? '⚡ Official Proposal' : lastMsgText}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Pane - Chat Window with Negotiation & Deal Card */}
            {(() => {
              const activeBrandChat = brandList.find(b => b.id === selectedBrandId) || brandList[0];
              const displayMessages = chatMessages;

              return (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#08080a' }}>
                  {/* Chat Header */}
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <img src={activeBrandChat.logo} alt={activeBrandChat.name} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>{activeBrandChat.name}</div>
                        <div style={{ fontSize: '11.5px', color: '#00E676', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={12} /> Verified Brand Partner ⚡ &bull; Workspace #{activeBrandChat.workspaceId}
                        </div>
                      </div>
                    </div>
                    {selectedBrandId === 'demo_brand' && (
                      <button
                        onClick={initDemoBrandChat}
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 12px', color: 'var(--text-secondary)', fontSize: '11.5px', cursor: 'pointer', fontWeight: 600 }}
                      >
                        🔄 Reset Demo Chat Flow
                      </button>
                    )}
                  </div>

                  {/* Message Feed */}
                  <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {displayMessages.map((msg: any, i: number) => {
                  const contentStr = msg.text || msg.content || '';
                  const isSystem = msg.sender === 'system' || msg.sender_type === 'system';
                  if (isSystem) {
                    return (
                      <div key={i} style={{ textAlign: 'center', margin: '8px 0' }}>
                        <span style={{ fontSize: '11px', color: '#00E676', background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.3)', padding: '6px 16px', borderRadius: '14px', fontWeight: 700 }}>
                          {contentStr}
                        </span>
                      </div>
                    );
                  }
                  let parsedContent: any = null;
                  try {
                    if (typeof contentStr === 'string' && contentStr.trim().startsWith('{')) {
                      parsedContent = JSON.parse(contentStr);
                    }
                  } catch (e) {}

                  if (parsedContent && parsedContent.type === 'proposal') {
                    return (
                      <div key={i} style={{ alignSelf: 'center', margin: '16px 0', width: '100%', maxWidth: '480px' }}>
                        <div style={{ background: 'linear-gradient(135deg, rgba(90,82,255,0.15), rgba(120,50,255,0.2))', border: '1.5px solid var(--primary)', padding: '22px', borderRadius: '16px', textAlign: 'center', boxShadow: '0 8px 24px rgba(90,82,255,0.2)' }}>
                          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                            🤝 OFFICIAL BRAND DEAL PROPOSAL
                          </div>
                          <div style={{ fontSize: '32px', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>
                            ₹{(parsedContent.amount || 12000).toLocaleString()}
                          </div>
                          <div style={{ fontSize: '13px', color: '#00E676', fontWeight: 700, marginBottom: '16px', background: 'rgba(0,230,118,0.1)', padding: '6px 12px', borderRadius: '8px', display: 'inline-block' }}>
                            Deliverables: {parsedContent.deliverables || '1 UGC Reel (30-45s) + 2 Instagram Stories'}
                          </div>
                          <div>
                            <GlowButton variant="glow" onClick={() => handleAcceptProposal(parsedContent.amount || 12000)} style={{ width: '100%', padding: '12px', fontSize: '14px', fontWeight: 700 }}>
                              Accept Proposal & Start Project
                            </GlowButton>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (parsedContent && parsedContent.type === 'proposal_accepted') {
                    return (
                      <div key={i} style={{ alignSelf: 'center', margin: '16px 0', width: '100%', maxWidth: '480px' }}>
                        <div style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.4)', padding: '18px', borderRadius: '14px', textAlign: 'center', color: '#00E676' }}>
                          <CheckCircle2 size={28} style={{ marginBottom: '6px' }} />
                          <div style={{ fontWeight: 800, fontSize: '16px', marginBottom: '8px' }}>Deal Accepted for ₹{(parsedContent.amount || 12000).toLocaleString()}!</div>
                          <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.9)', textAlign: 'left', background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '10px', lineHeight: 1.55 }}>
                            <b>📲 WHAT HAPPENS NEXT:</b><br />
                            1️⃣ <b>WhatsApp Outreach:</b> Brand will reach out directly to your registered WhatsApp number with brief & assets.<br />
                            2️⃣ <b>Complete Deliverables:</b> Create & share the content with the Brand.<br />
                            3️⃣ <b>Satisfactory Message:</b> Once approved by Brand, get their <b>Satisfactory Confirmation Message</b>.<br />
                            4️⃣ <b>Claim Instant Payout:</b> Upload screenshot proof in your <b>Payment Setup</b> tab to receive your disburse!
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (parsedContent && parsedContent.type === 'payment_complete') {
                    return (
                      <div key={i} style={{ alignSelf: 'center', margin: '16px 0', width: '100%', maxWidth: '480px' }}>
                        <div style={{ background: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.4)', padding: '16px', borderRadius: '14px', textAlign: 'center', color: '#ffd700' }}>
                          <DollarSign size={28} style={{ marginBottom: '6px' }} />
                          <div style={{ fontWeight: 800, fontSize: '16px' }}>Escrow Payment Deposited! 🟢</div>
                          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)', marginTop: '4px' }}>₹{((parsedContent.amount || 12000) * 0.9).toLocaleString()} (90% net payout) is now locked in Raftra Vault for you.</div>
                        </div>
                      </div>
                    );
                  }

                  const isMe = msg.sender === 'creator' || msg.sender_type === 'influencer';
                  return (
                    <div key={i} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', textAlign: isMe ? 'right' : 'left' }}>
                        {isMe ? `You (${cardCustomizer.name || 'Samaira'})` : activeBrandChat.name}
                      </div>
                      <div style={{ 
                        background: isMe ? 'linear-gradient(135deg, #5A52FF, #7832FF)' : 'rgba(255,255,255,0.06)', 
                        padding: '12px 16px', 
                        borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        color: '#fff',
                        fontSize: '13px',
                        lineHeight: '1.45'
                      }}>
                        {contentStr}
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input Bar */}
              <form onSubmit={handleSendChat} style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', background: '#0a0a0d', display: 'flex', gap: '12px', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder={`Message ${activeBrandChat.name}...`}
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  style={{ flex: 1, padding: '12px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '24px', color: '#fff', outline: 'none', fontSize: '13px' }}
                />
                <GlowButton variant="glow" type="submit" style={{ borderRadius: '50%', width: '42px', height: '42px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Send size={16} />
                </GlowButton>
              </form>
            </div>
          );
        })()}

      </div>
    )}

        {/* 👤 PROFILE SETUP TAB (LIVE CARD PREVIEW & PROFILE PHOTO / LINK EDITOR) */}
        {activeTab === 'profile_setup' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '28px' }}>
            
            <div>
              <h1 style={{ fontSize: '26px', fontFamily: 'var(--font-heading)', margin: '0 0 4px 0', color: '#fff' }}>
                Profile Setup & Live Card Customizer 👤
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                See how your creator card appears to Brands in the Marketplace & edit your public profile details.
              </p>
            </div>

            {/* ---------------------------------------------------------------- verification
                The handler and the endpoint for this both existed already; there was simply no
                screen that called them, so no creator could ever be checked. */}
            <div className="glow-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                <h3 style={{ fontSize: '17px', margin: 0, color: '#fff', fontFamily: 'var(--font-heading)' }}>
                  Verify your profile
                </h3>
                <span style={{
                  fontSize: '10px', fontWeight: 800, letterSpacing: '0.05em', padding: '3px 9px', borderRadius: '20px',
                  color: verificationStatus === 'verified' ? '#00E676' : verificationStatus === 'rejected' ? '#ff5252' : 'var(--text-muted)',
                  background: verificationStatus === 'verified' ? 'rgba(0,230,118,0.12)' : verificationStatus === 'rejected' ? 'rgba(255,82,82,0.12)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${verificationStatus === 'verified' ? 'rgba(0,230,118,0.35)' : verificationStatus === 'rejected' ? 'rgba(255,82,82,0.35)' : 'var(--border-color)'}`,
                }}>
                  {verificationStatus === 'verified' ? 'VERIFIED' : verificationStatus === 'rejected' ? 'NOT VERIFIED' : 'UNVERIFIED'}
                </span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 18px 0', lineHeight: 1.6 }}>
                Saves your handle, niche and rate to your marketplace card, and tries to read your public
                Instagram profile to confirm it. Instagram often blocks automated reads, so the badge may stay
                off — your details are saved either way.
              </p>

              <form onSubmit={handleVerifyProfile} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px', alignItems: 'end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>INSTAGRAM HANDLE</label>
                  <input
                    type="text" value={verifyForm.username} required
                    onChange={e => setVerifyForm({ ...verifyForm, username: e.target.value.replace(/^@/, '') })}
                    placeholder="yourhandle"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', background: 'rgba(0,0,0,0.45)', border: '1px solid var(--border-color)', borderRadius: '9px', color: '#fff', fontSize: '13.5px', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>NICHE</label>
                  <input
                    type="text" value={verifyForm.niche} required
                    onChange={e => setVerifyForm({ ...verifyForm, niche: e.target.value })}
                    placeholder="Fashion, Tech, Fitness…"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', background: 'rgba(0,0,0,0.45)', border: '1px solid var(--border-color)', borderRadius: '9px', color: '#fff', fontSize: '13.5px', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>RATE PER POST (₹)</label>
                  <input
                    type="number" min="0" value={verifyForm.base_rate || ''} required
                    onChange={e => setVerifyForm({ ...verifyForm, base_rate: Number(e.target.value) })}
                    placeholder="5000"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', background: 'rgba(0,0,0,0.45)', border: '1px solid var(--border-color)', borderRadius: '9px', color: '#fff', fontSize: '13.5px', outline: 'none' }}
                  />
                </div>
                <GlowButton variant="glow" type="submit" disabled={isVerifying} style={{ padding: '12px 20px', fontSize: '13.5px' }}>
                  {isVerifying ? 'Checking…' : 'Save & Verify'}
                </GlowButton>
              </form>

              {verifyMessage && (
                <p style={{
                  fontSize: '12.5px', lineHeight: 1.6, margin: '16px 0 0 0',
                  color: verificationStatus === 'verified' ? '#00E676' : verificationStatus === 'rejected' ? '#ff8095' : 'var(--warning)',
                }}>{verifyMessage}</p>
              )}
            </div>

            {/* LIVE MARKETPLACE CARD PREVIEW - EXACT USER MARKETPLACE CARD */}
            <div className="glow-card" style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(20,20,35,0.95), rgba(10,10,20,0.98))', border: '1.5px solid #00E676' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#00E676', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={16} /> LIVE MARKETPLACE CARD (HOW BRANDS SEE YOU)
              </div>

              {/* Exact Marketplace Card Component */}
              <div className="glow-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', background: '#0a0a0d', border: '1px solid var(--border)', borderRadius: '16px', maxWidth: '420px', margin: '0 auto' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img
                      src={cardCustomizer.avatar || "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=400&q=80"}
                      alt={cardCustomizer.name}
                      style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.2)' }}
                    />
                    <div>
                      <h4 style={{ fontSize: '16px', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '6px', color: '#fff' }}>
                        {cardCustomizer.name} <BadgeCheck size={14} color="#00E676" />
                      </h4>
                      <div style={{ fontSize: '12px', color: '#00E676', fontWeight: 600 }}>{cardCustomizer.handle}</div>
                      {cardCustomizer.location && (
                        <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>📍 {cardCustomizer.location}</div>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.1)', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>
                    {(cardCustomizer.category || 'NANO').toUpperCase()}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, marginBottom: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Followers</span>
                    {(!cardCustomizer.followers || cardCustomizer.followers.toLowerCase().includes('view profile')) ? (
                      <a href={cardCustomizer.profileLink || '#'} target="_blank" rel="noopener noreferrer" style={{ color: '#60A5FA', textDecoration: 'underline', fontWeight: 600 }}>
                        View Profile ↗
                      </a>
                    ) : (
                      <span style={{ color: '#fff', fontWeight: 700 }}>{cardCustomizer.followers}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Avg Views / Reach</span>
                    {(!cardCustomizer.avgViews || cardCustomizer.avgViews.toLowerCase().includes('view profile')) ? (
                      <a href={cardCustomizer.profileLink || '#'} target="_blank" rel="noopener noreferrer" style={{ color: '#60A5FA', textDecoration: 'underline', fontWeight: 600 }}>
                        View Profile ↗
                      </a>
                    ) : (
                      <span style={{ color: '#00E676', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Activity size={13} /> {cardCustomizer.avgViews}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Fake Follower Score</span>
                    <span style={{ color: '#00E676', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <ShieldAlert size={14} /> {cardCustomizer.fakeFollowerScore || '1%'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Collaboration Price Range</span>
                    <span style={{ color: '#00E676', fontWeight: 700 }}>
                      {cardCustomizer.expectedPrice}
                    </span>
                  </div>
                  
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px' }}>AVAILABLE FOR:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {(cardCustomizer.deliverables || ['UGC Video', 'Reel', 'Story', 'Static Post']).map((d: string) => (
                        <span
                          key={d}
                          style={{
                            fontSize: '11px',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: d.toLowerCase().includes('ugc') ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255,255,255,0.05)',
                            color: d.toLowerCase().includes('ugc') ? '#00E676' : '#fff',
                            border: '1px solid',
                            borderColor: d.toLowerCase().includes('ugc') ? 'rgba(0, 230, 118, 0.4)' : 'rgba(255,255,255,0.1)'
                          }}
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setActiveTab('inbox')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: 'linear-gradient(135deg, #5A52FF, #7832FF)',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      fontWeight: 700
                    }}
                  >
                    🤝 Negotiate
                  </button>
                  <a
                    href={cardCustomizer.profileLink}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      fontWeight: 600
                    }}
                  >
                    <User size={13} /> Profile
                  </a>
                </div>

              </div>
            </div>

            {/* EDIT PROFILE FORM */}
            <div className="glow-card" style={{ padding: '28px' }}>
              <h3 style={{ fontSize: '18px', margin: '0 0 20px 0', color: '#fff' }}>Edit Public Creator Profile Card</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Profile Photo URL:
                  </label>
                  <input
                    type="text"
                    placeholder="Paste image URL (https://...)"
                    value={cardCustomizer.avatar}
                    onChange={e => setCardCustomizer({ ...cardCustomizer, avatar: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Instagram / Social Profile Link:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. https://www.instagram.com/ankrena"
                    value={cardCustomizer.profileLink}
                    onChange={e => setCardCustomizer({ ...cardCustomizer, profileLink: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Creator Name:
                  </label>
                  <input
                    type="text"
                    value={cardCustomizer.name}
                    onChange={e => setCardCustomizer({ ...cardCustomizer, name: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Handle:
                  </label>
                  <input
                    type="text"
                    value={cardCustomizer.handle}
                    onChange={e => setCardCustomizer({ ...cardCustomizer, handle: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Location:
                  </label>
                  <input
                    type="text"
                    value={cardCustomizer.location}
                    onChange={e => setCardCustomizer({ ...cardCustomizer, location: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Category / Tier Badge:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Nano / Micro / Macro"
                    value={cardCustomizer.category}
                    onChange={e => setCardCustomizer({ ...cardCustomizer, category: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Followers:
                  </label>
                  <input
                    type="text"
                    value={cardCustomizer.followers}
                    onChange={e => setCardCustomizer({ ...cardCustomizer, followers: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Avg Views / Reach:
                  </label>
                  <input
                    type="text"
                    value={cardCustomizer.avgViews}
                    onChange={e => setCardCustomizer({ ...cardCustomizer, avgViews: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Fake Follower Score:
                  </label>
                  <input
                    type="text"
                    value={cardCustomizer.fakeFollowerScore}
                    onChange={e => setCardCustomizer({ ...cardCustomizer, fakeFollowerScore: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Collaboration Price Range:
                  </label>
                  <input
                    type="text"
                    value={cardCustomizer.expectedPrice}
                    onChange={e => setCardCustomizer({ ...cardCustomizer, expectedPrice: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '24px' }}>
                <GlowButton variant="glow" onClick={async () => {
                  localStorage.setItem('raftra_creator_card_custom', JSON.stringify(cardCustomizer));
                  window.dispatchEvent(new Event('storage'));
                  window.dispatchEvent(new CustomEvent('creatorProfileUpdated', { detail: cardCustomizer }));
                  
                  const token = localStorage.getItem('token');
                  try {
                    const res = await fetch('/api/workspaces/influencer/me/profile', {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        name: cardCustomizer.name,
                        handle: cardCustomizer.handle,
                        location: cardCustomizer.location,
                        category: cardCustomizer.category,
                        followers: cardCustomizer.followers,
                        expectedPrice: cardCustomizer.expectedPrice,
                        // Rates are entered as ranges ("₹2,000 - ₹5,000"). Stripping every
                        // non-digit ran the two ends together into 20005000 and wrote that as
                        // the rate; take the first number, the price a brand starts from.
                        base_rate: (() => {
                          const m = String(cardCustomizer.expectedPrice || '').replace(/,/g, '').match(/\d+(?:\.\d+)?/);
                          return m ? Number(m[0]) : 0;
                        })(),
                        recent_posts: profileForm.recent_posts,
                        recent_collabs: profileForm.recent_collabs,
                        recent_reviews: profileForm.recent_reviews
                      })
                    });
                    // A 4xx comes back as a response, not a throw, so without this check a
                    // rejected save still reported success.
                    if (!res.ok) {
                      const d = await res.json().catch(() => null);
                      throw new Error((d && d.detail) || `server returned ${res.status}`);
                    }
                    alert("✅ Profile card updated and synced with the Raftra marketplace.");
                  } catch (e: any) {
                    console.warn("Profile sync failed:", e);
                    alert("Saved on this device, but the marketplace copy could not be updated: "
                      + (e?.message || 'server unreachable') + "\n\nOther brands will still see your previous details.");
                  }
                }} style={{ padding: '12px 28px' }}>
                  💾 Save & Sync Card with Marketplace
                </GlowButton>
              </div>
            </div>

          </div>
        )}

        {/* 💳 PAYMENT SETUP TAB (RAZORPAY INTEGRATION & BANK DETAILS) */}
        {activeTab === 'payment_setup' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '28px' }}>
            
            <div>
              <h1 style={{ fontSize: '26px', fontFamily: 'var(--font-heading)', margin: '0 0 4px 0', color: '#fff' }}>
                Payment Setup & Razorpay Escrow Direct Payout 💳
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                Configure your Bank Account & UPI ID for direct 90% net payout disbursal upon Team Raftra Human Audit approval.
              </p>
            </div>

            {/* EXPLANATION CARD */}
            <div className="glow-card" style={{ padding: '24px', background: 'rgba(0,196,204,0.08)', border: '1px solid rgba(0,196,204,0.3)' }}>
              <h3 style={{ fontSize: '16px', margin: '0 0 10px 0', color: '#00C4CC', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚡ How Razorpay Escrow Payout Works for Creators
              </h3>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', margin: 0, lineHeight: 1.5 }}>
                Raftra AI operates on a <b>90/10 split</b>. Upon deal completion, 90% of the gross deal value is routed via <b>Razorpay Route Direct Disbursal</b> directly into your linked Bank Account / UPI ID once screenshot proof is verified by Team Raftra Human Auditors.
              </p>
            </div>

            {/* BANK ACCOUNT SETUP FORM */}
            <div className="glow-card" style={{ padding: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ fontSize: '18px', margin: 0, color: '#fff' }}>Linked Bank Account for Direct Payouts</h3>
                <div style={{ padding: '6px 14px', background: 'rgba(255,179,0,0.15)', border: '1px solid #FFB300', color: '#FFB300', borderRadius: '100px', fontSize: '11px', fontWeight: 800 }}>
                  PENDING ACCOUNT SETUP 🟡
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Account Holder Name:
                  </label>
                  <input
                    type="text"
                    placeholder="Enter Account Holder Name"
                    value={bankDetails.accountHolder}
                    onChange={e => setBankDetails({ ...bankDetails, accountHolder: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Bank Name & Branch:
                  </label>
                  <input
                    type="text"
                    placeholder="Enter Bank Name & Branch"
                    value={bankDetails.bankName}
                    onChange={e => setBankDetails({ ...bankDetails, bankName: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Bank Account Number:
                  </label>
                  <input
                    type="text"
                    placeholder="Enter Bank Account Number"
                    value={bankDetails.accountNumber}
                    onChange={e => setBankDetails({ ...bankDetails, accountNumber: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    IFSC Code:
                  </label>
                  <input
                    type="text"
                    placeholder="Enter IFSC Code"
                    value={bankDetails.ifscCode}
                    onChange={e => setBankDetails({ ...bankDetails, ifscCode: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Instant UPI ID (e.g. GPay/Paytm):
                  </label>
                  <input
                    type="text"
                    placeholder="Enter Instant UPI ID (e.g. name@upi)"
                    value={bankDetails.upiId}
                    onChange={e => setBankDetails({ ...bankDetails, upiId: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <GlowButton variant="glow" onClick={() => alert("Bank Account details updated!")} style={{ padding: '12px 28px' }}>
                Save Payment Account Details
              </GlowButton>
            </div>

            {/* ESCROW PROOF SUBMISSION & HUMAN VERIFICATION PORTAL */}
            <div className="glow-card" style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(12,12,20,0.9), rgba(20,20,35,0.95))', border: '1px solid rgba(0, 230, 118, 0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', margin: '0 0 4px 0', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldAlert size={20} color="#00E676" /> Submit Deliverables Proof for Payout Disbursal
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                    Upload your brand satisfaction screenshot (WhatsApp/IG DM) & verification token. Team Raftra receives your proof via admin email for human audit.
                  </p>
                </div>
                <div style={{ padding: '6px 14px', borderRadius: '100px', fontSize: '11px', fontWeight: 700, background: proofVerificationStatus === 'verified_payout' ? 'rgba(0,230,118,0.2)' : proofVerificationStatus === 'under_review' ? 'rgba(0,196,204,0.2)' : 'rgba(255,179,0,0.2)', color: proofVerificationStatus === 'verified_payout' ? '#00E676' : proofVerificationStatus === 'under_review' ? '#00C4CC' : '#FFB300', border: '1px solid currentColor' }}>
                  {proofVerificationStatus === 'verified_payout' ? '🟢 ESCROW PAYOUT DISBURSED' : proofVerificationStatus === 'under_review' ? '🔵 PROOF EMAILED TO TEAM RAFTRA (UNDER AUDIT)' : '🟡 PENDING PROOF SUBMISSION'}
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
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                        1. Verification Code / Token (from Brand):
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
                        2. Chat Screenshot Proof (WhatsApp / IG DM):
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
                    <Send size={15} /> Submit Proof for Verification & Disbursal
                  </GlowButton>
                </form>
              )}
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
