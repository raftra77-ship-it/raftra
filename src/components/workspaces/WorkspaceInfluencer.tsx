import React, { useState, useEffect, useRef } from 'react';
import { Search, AlertTriangle, MessageCircle, Send, ShieldAlert, BadgeCheck, DollarSign, Video, Image as ImageIcon, Star, ExternalLink, Activity, CheckCircle2, ArrowUpDown } from 'lucide-react';
import { GlowButton } from '../GlowButton';

import parsedCreatorsData from '../../data/influencers_parsed.json';
import { fetchLiveGoogleSheetCreators } from '../../utils/liveSheetSync';
import type { InfluencerItemExtended } from '../../types/influencer';

export type { InfluencerItemExtended };

const INITIAL_CREATORS: InfluencerItemExtended[] = (parsedCreatorsData as any[]).map(item => ({
  ...item,
  fakeFollowerScore: item.fakeFollowerScore || 1,
  rating: item.rating || 4.8,
  reviewsCount: item.reviewsCount || 20,
  recentWorks: item.recentWorks || ['D2C Brand Collab'],
  topComments: item.topComments
}));

import { BrandPostedDealsView } from './PostedDealsWorkflow';

export const WorkspaceInfluencer: React.FC<{ workspaceId: number }> = ({ workspaceId }) => {
  // Every deal route is behind get_current_user. The proposal and release calls below were
  // written without a token, so the server rejected them and the UI showed success anyway.
  const authHeaders = (): HeadersInit => {
    const t = localStorage.getItem('token');
    return t ? { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }
             : { 'Content-Type': 'application/json' };
  };
  // Deal actions take a round trip and can fail; this is where the outcome is reported
  // instead of assuming it worked.
  const [dealMsg, setDealMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [mainSubTab, setMainSubTab] = useState<'discover' | 'posted_deals' | 'my_collaborations'>('discover');
  const [creators, setCreators] = useState<InfluencerItemExtended[]>([]);
  const [filterNiche, setFilterNiche] = useState('All');
  const [filterFollowers, setFilterFollowers] = useState('All');
  const [sortBy, setSortBy] = useState('featured');

  // Visitor Guest Identification Modal state
  const [guestModalCreator, setGuestModalCreator] = useState<InfluencerItemExtended | null>(null);
  const [guestBrandName, setGuestBrandName] = useState('');
  const [guestContactName, setGuestContactName] = useState('');
  const [guestContactInfo, setGuestContactInfo] = useState('');

  const isLoggedIn = Boolean(localStorage.getItem('token'));

  // State for Expert Advice Inquiry Form
  const [showExpertForm, setShowExpertForm] = useState<boolean>(false);
  const [expertInquiryForm, setExpertInquiryForm] = useState({
    userRole: 'Brand / Business Owner',
    name: '',
    email: '',
    phone: '',
    websiteUrl: '',
    instaPage: '',
    campaignGoal: 'Product Sales & Conversions',
    budget: 'No Idea / Need Advice',
    notes: ''
  });
  const [expertInquirySubmitted, setExpertInquirySubmitted] = useState<boolean>(false);
  const [isSubmittingExpert, setIsSubmittingExpert] = useState<boolean>(false);

  // Posts to /api/deals/expert-inquiry, which emails the team. The thank-you screen now
  // waits for the server to confirm rather than appearing regardless, and there is no
  // mailto: hand-off - that asked the visitor to send the mail themselves, and pointed at
  // "raftra.77mail.com", which has no @ and could never be delivered.
  const [expertInquiryError, setExpertInquiryError] = useState<string>('');

  const handleExpertInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingExpert(true);
    setExpertInquiryError('');

    try {
      const r = await fetch('/api/deals/expert-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expertInquiryForm),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setExpertInquirySubmitted(true);
      } else {
        setExpertInquiryError(d.detail || 'We could not send that. Please check your name and email and try again.');
      }
    } catch {
      setExpertInquiryError('Could not reach the server. Please try again in a moment.');
    }

    setIsSubmittingExpert(false);
  };

  const handleNegotiateClick = (creator: InfluencerItemExtended) => {
    const token = localStorage.getItem('token');
    const guestBrand = localStorage.getItem('raftra_guest_brand');

    if (!token && !guestBrand) {
      setGuestModalCreator(creator);
    } else {
      handleOpenChat(creator);
    }
  };

  const handleSaveGuestIdentity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestBrandName.trim() || !guestContactName.trim()) return;

    const identity = {
      brandName: guestBrandName,
      contactName: guestContactName,
      contactInfo: guestContactInfo
    };
    localStorage.setItem('raftra_guest_brand', JSON.stringify(identity));

    if (guestModalCreator) {
      const creator = guestModalCreator;
      setGuestModalCreator(null);
      handleOpenChat(creator);
    }
  };

  const mergeCustomProfile = (list: InfluencerItemExtended[]): InfluencerItemExtended[] => {
    const customCardStr = localStorage.getItem('raftra_creator_card_custom');
    if (!customCardStr) return list;
    try {
      const custom = JSON.parse(customCardStr);
      let matched = false;
      const updatedList = list.map(c => {
        if (c.handle === custom.handle || c.name === custom.name || c.id === custom.id) {
          matched = true;
          const deliverables = Array.from(new Set(['UGC Video', ...(custom.deliverables || c.deliverables || ['Reel', 'Story'])]));
          return { ...c, ...custom, deliverables };
        }
        return c;
      });

      if (!matched && custom.name) {
        return [{ id: 'creator_custom', deliverables: ['UGC Video'], rating: 4.9, reviewsCount: 12, ...custom }, ...list];
      }
      return updatedList;
    } catch (err) {
      return list;
    }
  };

  const loadCreatorsData = () => {
    const token = localStorage.getItem('token');
    fetch(`/api/workspaces/${workspaceId}/influencers`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(r => r.json()).then(data => {
      if (Array.isArray(data) && data.length > 0) {
        const enriched = INITIAL_CREATORS.map(c => {
          const matched = data.find((inf: any) => inf.handle === c.handle || inf.id?.toString() === c.id || inf.name?.toLowerCase() === c.name?.toLowerCase());
          if (matched) {
            return {
              ...c,
              expectedPrice: matched.base_rate ? `₹${matched.base_rate.toLocaleString('en-IN')}` : c.expectedPrice,
              fakeFollowerScore: matched.success_rate ? Math.max(1, 100 - matched.success_rate) : c.fakeFollowerScore
            };
          }
          return c;
        });
        setCreators(mergeCustomProfile(enriched));
      } else {
        setCreators(mergeCustomProfile(INITIAL_CREATORS));
      }
    }).catch(() => {
      setCreators(mergeCustomProfile(INITIAL_CREATORS));
    });
  };

  useEffect(() => {
    let isMounted = true;

    const syncLiveSheet = async () => {
      try {
        const liveSheetCreators = await fetchLiveGoogleSheetCreators();
        if (isMounted && liveSheetCreators && liveSheetCreators.length > 0) {
          setCreators(mergeCustomProfile(liveSheetCreators));
        }
      } catch (err) {
        console.warn('Live sheet sync error:', err);
      }
    };

    loadCreatorsData();
    syncLiveSheet();

    const interval = setInterval(syncLiveSheet, 15000);

    const handleSync = () => {
      setCreators(prev => mergeCustomProfile(prev));
    };

    window.addEventListener('storage', handleSync);
    window.addEventListener('creatorProfileUpdated', handleSync);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('creatorProfileUpdated', handleSync);
    };
  }, [workspaceId]);

  // Modals state
  const [activeChat, setActiveChat] = useState<InfluencerItemExtended | null>(null);
  const [viewProfile, setViewProfile] = useState<InfluencerItemExtended | null>(null);

  // Chat State
  const [chatMessages, setChatMessages] = useState<{ sender: 'brand' | 'creator' | 'system', text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showFinalize, setShowFinalize] = useState(false);
  const [finalPrice, setFinalPrice] = useState('');
  const [finalDeliverables, setFinalDeliverables] = useState('1 UGC Reel + 2 Stories');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const brandWsRef = useRef<WebSocket | null>(null);
  // Room key = ws{workspaceId}_{creatorHandle}  →  each brand × creator pair is fully isolated
  const getChatKey = (creator: InfluencerItemExtended) =>
    `ws${workspaceId}_${(creator.handle || creator.id).replace('@', '').toLowerCase()}`;


  const handleLockDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!finalPrice || isNaN(Number(finalPrice)) || !activeChat) return;
    const price = parseFloat(finalPrice);
    const delivs = finalDeliverables.trim() || 'UGC Video + Reel';
    const roomKey = getChatKey(activeChat);
    const storageKey = `raftra_chat_${roomKey}`;

    const proposalMsg = { sender: 'brand' as const, workspaceId, text: JSON.stringify({ type: 'proposal', amount: price, deliverables: delivs }) };
    const currentMsgs = JSON.parse(localStorage.getItem(storageKey) || JSON.stringify(chatMessages));
    const updated = [...currentMsgs, proposalMsg];
    setChatMessages(updated as any);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    // Send via real WebSocket so creator receives in real-time
    if (brandWsRef.current?.readyState === WebSocket.OPEN) {
      brandWsRef.current.send(JSON.stringify(proposalMsg));
    }

    try {
      const r = await fetch('/api/deals/propose', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          workspace_id: workspaceId,
          // brand_name and brand_whatsapp were hardcoded to 'Demo Brand' and a made-up
          // number, which is what the creator would have seen on the proposal. The server
          // resolves the real workspace from workspace_id, so they are left blank rather
          // than sent wrong.
          brand_name: '',
          brand_whatsapp: '',
          influencer_handle: activeChat.handle,
          influencer_name: activeChat.name,
          influencer_email: activeChat.email,
          influencer_phone: activeChat.phone,
          amount: price,
          deliverables: delivs
        })
      });
      const d = await r.json().catch(() => ({}));
      setDealMsg(r.ok
        ? { ok: true, text: `Proposal sent to ${activeChat.name}.` }
        : { ok: false, text: d.detail || `Proposal could not be sent (${r.status}).` });
    } catch {
      setDealMsg({ ok: false, text: 'Could not reach the server. The proposal was not sent.' });
    }

    setShowFinalize(false);
    setFinalPrice('');
    setFinalDeliverables('1 UGC Reel + 2 Stories');
  };

  // ── Real-time WebSocket for 1-on-1 chat ────────────────────────────────────
  useEffect(() => {
    if (!activeChat) return;
    const roomKey = getChatKey(activeChat);
    const storageKey = `raftra_chat_${roomKey}`;

    // Load existing messages from localStorage (history)
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try { setChatMessages(JSON.parse(saved)); } catch (err) { }
    }

    // Connect to backend WebSocket room
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsHost = window.location.hostname === 'localhost' ? 'localhost:8000' : window.location.host;
    const ws = new WebSocket(`${protocol}://${wsHost}/ws/chat/${roomKey}`);
    brandWsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'connected') return; // ignore ack
        if (data.sender && data.text !== undefined) {
          setChatMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.sender === data.sender && lastMsg.text === data.text) {
              return prev;
            }
            const updated = [...prev, data];
            localStorage.setItem(storageKey, JSON.stringify(updated));
            return updated;
          });
        }
      } catch (err) { }
    };

    ws.onerror = (e) => console.warn('[Brand Chat WS] error:', e);
    ws.onclose = () => console.log('[Brand Chat WS] disconnected from room:', roomKey);

    return () => {
      ws.close();
      brandWsRef.current = null;
    };
  }, [activeChat]);

  const handleOpenChat = (creator: InfluencerItemExtended) => {
    setActiveChat(creator);
    const roomKey = getChatKey(creator);
    const storageKey = `raftra_chat_${roomKey}`;
    const savedChat = localStorage.getItem(storageKey);
    if (savedChat) {
      try { setChatMessages(JSON.parse(savedChat)); return; } catch (err) { }
    }
    // First time opening — seed with intro messages that include workspaceId so creator knows which brand
    const initialMsgs = [
      { sender: 'system', workspaceId, text: `🔒 SECURE ESCROW END-TO-END WORKSPACE #${workspaceId} ACTIVATED` },
      { sender: 'creator', workspaceId, text: `Hi! Thanks for reaching out. I'm open to collaborations for your brand campaign. My rate per reel is ${creator.expectedPrice}. What deliverables are you looking for?` }
    ];
    setChatMessages(initialMsgs as any);
    localStorage.setItem(storageKey, JSON.stringify(initialMsgs));
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
    if (!chatInput.trim() || !activeChat) return;
    const input = chatInput;
    setChatInput('');

    const roomKey = getChatKey(activeChat);
    const storageKey = `raftra_chat_${roomKey}`;
    const currentMsgs = JSON.parse(localStorage.getItem(storageKey) || JSON.stringify(chatMessages));

    // Anti-Bypass Policy Check
    if (isAntiBypassViolation(input)) {
      const violationMsg = { sender: 'system' as const, text: '🚨 CHAT BLOCKED: Anti-Bypass Policy Violation Detected! Exchanging phone numbers, Instagram handles, or off-platform contact is strictly prohibited. Your account has been reported.' };
      const blockedMsgs = [...currentMsgs, { sender: 'brand' as const, text: input }, violationMsg];
      setChatMessages(blockedMsgs as any);
      localStorage.setItem(storageKey, JSON.stringify(blockedMsgs));
      // Send via WS so creator also sees the block
      if (brandWsRef.current?.readyState === WebSocket.OPEN) {
        brandWsRef.current.send(JSON.stringify(violationMsg));
      }
      return;
    }

    const newMsg = { sender: 'brand' as const, workspaceId, text: input };
    const newMsgs = [...currentMsgs, newMsg];
    setChatMessages(newMsgs);
    localStorage.setItem(storageKey, JSON.stringify(newMsgs));

    // Send via real WebSocket to creator in real-time
    if (brandWsRef.current?.readyState === WebSocket.OPEN) {
      brandWsRef.current.send(JSON.stringify(newMsg));
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const filteredCreators = creators.filter(c => {
    let nicheMatch = true;
    if (filterNiche !== 'All') {
      const selected = filterNiche.toLowerCase();
      const primary = (c.niche || '').toLowerCase();
      const all = (c.allNiches || []).map(n => n.toLowerCase());
      nicheMatch = primary.includes(selected) || all.some(n => n.includes(selected));
    }

    let followerMatch = true;
    if (filterFollowers !== 'All') {
      const cat = (c.category || '').toLowerCase();
      const fStr = (c.followers || '').replace(/,/g, '').toLowerCase();

      if (filterFollowers === 'Nano') {
        followerMatch = cat === 'nano' || (!fStr.includes('k') && !fStr.includes('m') && parseFloat(fStr) < 10000) || (fStr.includes('k') && parseFloat(fStr) < 10);
      } else if (filterFollowers === 'Micro') {
        followerMatch = cat === 'micro' || (fStr.includes('k') && parseFloat(fStr) >= 10 && parseFloat(fStr) < 100) || (!fStr.includes('k') && !fStr.includes('m') && parseFloat(fStr) >= 10000 && parseFloat(fStr) < 100000);
      } else if (filterFollowers === 'Macro') {
        followerMatch = cat === 'macro' || fStr.includes('m') || (fStr.includes('k') && parseFloat(fStr) >= 100) || (!fStr.includes('k') && !fStr.includes('m') && parseFloat(fStr) >= 100000);
      }
    }

    return nicheMatch && followerMatch;
  });

  const parseFollowerNum = (str: string): number => {
    if (!str) return 0;
    const clean = str.toLowerCase().replace(/,/g, '').trim();
    if (clean.includes('m')) {
      return parseFloat(clean.replace('m', '')) * 1000000;
    }
    if (clean.includes('k')) {
      return parseFloat(clean.replace('k', '')) * 1000;
    }
    const val = parseFloat(clean);
    return isNaN(val) ? 0 : val;
  };

  const parsePriceNum = (str: string): number => {
    if (!str || str.toLowerCase().includes('discuss')) return 0;
    const digits = str.replace(/[^\d]/g, '');
    const val = parseInt(digits, 10);
    return isNaN(val) ? 0 : val;
  };

  const parseReachNum = (str: string): number => {
    if (!str) return 0;
    const clean = str.toLowerCase().replace(/,/g, '').trim();
    const mMatch = clean.match(/([\d\.]+)\s*m/);
    if (mMatch) return parseFloat(mMatch[1]) * 1000000;
    const kMatch = clean.match(/([\d\.]+)\s*k/);
    if (kMatch) return parseFloat(kMatch[1]) * 1000;
    const digits = clean.replace(/[^\d]/g, '');
    const val = parseFloat(digits);
    return isNaN(val) ? 0 : val;
  };

  const sortedCreators = [...filteredCreators].sort((a, b) => {
    if (sortBy === 'followers_desc') {
      return parseFollowerNum(b.followers) - parseFollowerNum(a.followers);
    }
    if (sortBy === 'followers_asc') {
      return parseFollowerNum(a.followers) - parseFollowerNum(b.followers);
    }
    if (sortBy === 'price_desc') {
      return parsePriceNum(b.expectedPrice) - parsePriceNum(a.expectedPrice);
    }
    if (sortBy === 'price_asc') {
      const pA = parsePriceNum(a.expectedPrice);
      const pB = parsePriceNum(b.expectedPrice);
      if (pA === 0) return 1;
      if (pB === 0) return -1;
      return pA - pB;
    }
    // Recommended default: Sort by total Reach / Avg Views (High to Low)
    return parseReachNum(b.avgViews || '') - parseReachNum(a.avgViews || '');
  });

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!activeChat) return;
    const storageKey = `raftra_chat_${activeChat.id}`;
    const handleStorage = (e: StorageEvent) => {
      if ((e.key === storageKey || e.key === 'raftra_creator_inbox_chat' || e.key === 'raftra_chat_creator_11') && e.newValue) {
        try {
          setChatMessages(JSON.parse(e.newValue));
        } catch (err) { }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [activeChat]);

  const [showEmailReceiptModal, setShowEmailReceiptModal] = useState<boolean>(false);
  const [paidDealInfo, setPaidDealInfo] = useState<{ amount: number, creator: InfluencerItemExtended } | null>(null);

  const handlePayRazorpay = async (amount: number) => {
    try {
      const payload = JSON.stringify({ type: 'payment_complete', amount });

      if (activeChat) {
        const storageKey = getChatKey(activeChat);
        const currentMsgs = JSON.parse(localStorage.getItem(storageKey) || JSON.stringify(chatMessages));
        const updated = [...currentMsgs, { sender: 'brand' as const, text: payload }];
        setChatMessages(updated as any);
        localStorage.setItem(storageKey, JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('raftra_live_chat_event', { detail: { key: storageKey, msgs: updated } }));

        setPaidDealInfo({ amount, creator: activeChat });
        setShowEmailReceiptModal(true);

        // Release the deal for this creator.
        //
        // This used to GET /api/deals/creator/{handle} with no token, then POST /release
        // with no token either. The first route was deleted on purpose - it handed any
        // creator's deal history to anyone who asked - so it 404s, and the release POST
        // would 401 regardless. Both failures were swallowed by empty .catch handlers, so
        // approving a creator's work silently did nothing at all.
        //
        // /api/deals/brand/{workspaceId} is the authorised equivalent: it returns only the
        // deals this workspace raised, so the deal is found without exposing anyone else's.
        const cleanHandle = activeChat.handle.replace('@', '').toLowerCase();
        (async () => {
          if (!workspaceId) return;
          try {
            const r = await fetch(`/api/deals/brand/${workspaceId}`, { headers: authHeaders() });
            if (!r.ok) throw new Error(`could not load deals (${r.status})`);
            const deals = await r.json();
            const match = (Array.isArray(deals) ? deals : []).find((d: any) =>
              String(d.influencer_handle || '').replace('@', '').toLowerCase() === cleanHandle);
            if (!match) {
              setDealMsg({ ok: false, text: 'No deal found for this creator yet - send a proposal first.' });
              return;
            }
            const rel = await fetch(`/api/deals/${match.id}/release`, {
              method: 'POST',
              headers: authHeaders(),
              body: JSON.stringify({ brand_whatsapp: '' }),
            });
            const d = await rel.json().catch(() => ({}));
            setDealMsg(rel.ok
              ? { ok: true, text: 'Approved. The creator has been sent their verification token.' }
              : { ok: false, text: d.detail || 'Could not release this deal.' });
          } catch (e: any) {
            setDealMsg({ ok: false, text: e?.message || 'Could not reach the server.' });
          }
        })();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', paddingBottom: '40px', position: 'relative' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-heading)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BadgeCheck size={24} color="var(--primary)" /> Influencer Marketplace
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Discover verified creators, negotiate deals securely, and track campaign ROI.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', background: 'rgba(0, 230, 118, 0.08)', border: '1px solid rgba(0, 230, 118, 0.3)', borderRadius: '100px', fontSize: '12px', color: '#00E676', fontWeight: 600 }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00E676', display: 'inline-block', boxShadow: '0 0 8px #00E676' }}></span>
          Google Sheet Live Auto-Synced
        </div>
      </div>

      {/* Outcome of the last deal action. Proposals and approvals are round trips that can
          fail; both used to report success regardless of what the server said. */}
      {dealMsg && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
          padding: '11px 15px', borderRadius: '10px', fontSize: '13px', margin: '4px 0 2px',
          background: dealMsg.ok ? 'rgba(0,230,118,0.08)' : 'rgba(255,71,87,0.08)',
          border: `1px solid ${dealMsg.ok ? 'rgba(0,230,118,0.3)' : 'rgba(255,71,87,0.3)'}`,
          color: dealMsg.ok ? '#00E676' : '#ff6b7a',
        }}>
          <span>{dealMsg.text}</span>
          <button onClick={() => setDealMsg(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}>
            &times;
          </button>
        </div>
      )}

      {/* LARGE PROMINENT HERO TAB BUTTONS — DARK THEME NO EMOJI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: '16px', margin: '10px 0 10px 0' }}>
        <button
          onClick={() => setMainSubTab('discover')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '8px',
            padding: '20px 24px',
            borderRadius: '16px',
            border: mainSubTab === 'discover' ? '2px solid var(--primary, #5A52FF)' : '1px solid rgba(255,255,255,0.12)',
            background: mainSubTab === 'discover' ? '#12121E' : '#0D0D14',
            boxShadow: mainSubTab === 'discover' ? '0 8px 24px rgba(90,82,255,0.25)' : 'none',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <span style={{ fontSize: '18px', fontWeight: 800, color: mainSubTab === 'discover' ? '#fff' : 'rgba(255,255,255,0.85)', letterSpacing: '-0.02em' }}>
              Discover Creators
            </span>
            <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px', background: 'rgba(0,230,118,0.15)', color: '#00e676' }}>29 Live</span>
          </div>
          <span style={{ fontSize: '13px', color: mainSubTab === 'discover' ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)', lineHeight: 1.4 }}>
            Browse verified profiles, pricing & engagement metrics.
          </span>
        </button>

        <button
          onClick={() => setMainSubTab('posted_deals')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '8px',
            padding: '20px 24px',
            borderRadius: '16px',
            border: mainSubTab === 'posted_deals' ? '2px solid var(--primary, #5A52FF)' : '1px solid rgba(255,255,255,0.12)',
            background: mainSubTab === 'posted_deals' ? '#12121E' : '#0D0D14',
            boxShadow: mainSubTab === 'posted_deals' ? '0 8px 24px rgba(90,82,255,0.25)' : 'none',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <span style={{ fontSize: '18px', fontWeight: 800, color: mainSubTab === 'posted_deals' ? '#fff' : 'rgba(255,255,255,0.85)', letterSpacing: '-0.02em' }}>
              Posted Deals
            </span>
            {isLoggedIn ? (
              <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px', background: 'rgba(90,82,255,0.2)', color: '#8B85FF' }}>Broadcast</span>
            ) : (
              <span style={{ fontSize: '11px', fontWeight: 800, padding: '3px 10px', borderRadius: '12px', background: 'rgba(255, 75, 75, 0.2)', color: '#FF4B4B', border: '1px solid rgba(255,75,75,0.3)' }}>🔒 Locked</span>
            )}
          </div>
          <span style={{ fontSize: '13px', color: mainSubTab === 'posted_deals' ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)', lineHeight: 1.4 }}>
            Post requirements & review creator applications.
          </span>
        </button>

        <button
          onClick={() => setMainSubTab('my_collaborations')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '8px',
            padding: '20px 24px',
            borderRadius: '16px',
            border: mainSubTab === 'my_collaborations' ? '2px solid var(--primary, #5A52FF)' : '1px solid rgba(255,255,255,0.12)',
            background: mainSubTab === 'my_collaborations' ? '#12121E' : '#0D0D14',
            boxShadow: mainSubTab === 'my_collaborations' ? '0 8px 24px rgba(90,82,255,0.25)' : 'none',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <span style={{ fontSize: '18px', fontWeight: 800, color: mainSubTab === 'my_collaborations' ? '#fff' : 'rgba(255,255,255,0.85)', letterSpacing: '-0.02em' }}>
              My Collaborations
            </span>
            {isLoggedIn ? (
              <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px', background: 'rgba(0,230,118,0.15)', color: '#00e676' }}>3 Active</span>
            ) : (
              <span style={{ fontSize: '11px', fontWeight: 800, padding: '3px 10px', borderRadius: '12px', background: 'rgba(255, 75, 75, 0.2)', color: '#FF4B4B', border: '1px solid rgba(255,75,75,0.3)' }}>🔒 Locked</span>
            )}
          </div>
          <span style={{ fontSize: '13px', color: mainSubTab === 'my_collaborations' ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)', lineHeight: 1.4 }}>
            Track active deals, content deliverables & payouts.
          </span>
        </button>
      </div>

      {mainSubTab === 'posted_deals' && (
        isLoggedIn ? (
          <BrandPostedDealsView
            workspaceId={workspaceId}
            onOpenChatWithCreator={(handle) => {
              const found = creators.find(c => c.handle.toLowerCase().includes(handle.toLowerCase()));
              if (found) setActiveChat(found);
            }}
            onViewCreatorProfile={(handle) => {
              const found = creators.find(c => c.handle.toLowerCase().includes(handle.toLowerCase()));
              if (found) setViewProfile(found);
            }}
          />
        ) : (
          <div className="glow-card" style={{ padding: '36px', textAlign: 'center', background: '#0D0D14', border: '1px solid rgba(90,82,255,0.4)', borderRadius: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div style={{ fontSize: '36px' }}>🔒</div>
            <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#fff', margin: 0 }}>Posted Deals — Subscriber Dashboard Feature</h3>
            <p style={{ fontSize: '15px', color: 'var(--text-secondary)', maxWidth: '580px', margin: 0, lineHeight: 1.6 }}>
              Posting campaign briefs and receiving applications from creators is exclusive to <strong>Registered Brand & Creator Members</strong>.
              Sign in to your account or register as a Brand to broadcast requirements or manage your campaigns.
            </p>
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <GlowButton variant="glow" onClick={() => window.location.href = '/login'} style={{ fontSize: '14px', padding: '10px 24px' }}>
                Sign In / Register as Brand 🚀
              </GlowButton>
              <GlowButton variant="secondary" onClick={() => setMainSubTab('discover')} style={{ fontSize: '14px', padding: '10px 20px' }}>
                Discover Creators
              </GlowButton>
            </div>
          </div>
        )
      )}

      {mainSubTab === 'my_collaborations' && (
        isLoggedIn ? (
          <BrandPostedDealsView
            workspaceId={workspaceId}
            mode="my_collaborations"
            onOpenChatWithCreator={(handle) => {
              const found = creators.find(c => c.handle.toLowerCase().includes(handle.toLowerCase()));
              if (found) setActiveChat(found);
            }}
            onViewCreatorProfile={(handle) => {
              const found = creators.find(c => c.handle.toLowerCase().includes(handle.toLowerCase()));
              if (found) setViewProfile(found);
            }}
          />
        ) : (
          <div className="glow-card" style={{ padding: '36px', textAlign: 'center', background: '#0D0D14', border: '1px solid rgba(90,82,255,0.4)', borderRadius: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div style={{ fontSize: '36px' }}>🔒</div>
            <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#fff', margin: 0 }}>My Collaborations — Locked Member Feature</h3>
            <p style={{ fontSize: '15px', color: 'var(--text-secondary)', maxWidth: '580px', margin: 0, lineHeight: 1.6 }}>
              Tracking active brand collaborations, content deliverables & escrow payouts is exclusive to <strong>Registered Brand & Creator Members</strong>.
              Sign in to your account or register to manage your active deals.
            </p>
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <GlowButton variant="glow" onClick={() => window.location.href = '/login'} style={{ fontSize: '14px', padding: '10px 24px' }}>
                Sign In / Register as Brand 🚀
              </GlowButton>
              <GlowButton variant="secondary" onClick={() => setMainSubTab('discover')} style={{ fontSize: '14px', padding: '10px 20px' }}>
                Discover Creators
              </GlowButton>
            </div>
          </div>
        )
      )}

      {mainSubTab === 'discover' && (
        <>
          {/* EXPERT CONSULTATION & INFLUENCER ADVICE BANNER & FORM */}
          <div style={{
            background: 'linear-gradient(180deg, rgba(16, 22, 34, 0.95) 0%, rgba(9, 13, 22, 0.98) 100%)',
            border: '1.5px solid rgba(0, 230, 118, 0.35)',
            borderRadius: '24px',
            padding: '28px 32px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 0 25px rgba(0, 230, 118, 0.08)',
            margin: '0 0 20px 0'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
              <div style={{ flex: 1, minWidth: '300px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '5px 16px', background: 'rgba(0, 230, 118, 0.12)', border: '1px solid rgba(0, 230, 118, 0.3)', borderRadius: '100px', color: '#00E676', fontWeight: 800, fontSize: '12px', marginBottom: '10px' }}>
                  🤝 NEED EXPERT ADVICE TO HIRE & NEGOTIATE INFLUENCERS?
                </div>
                <h3 style={{ fontSize: '26px', color: '#ffffff', margin: '0 0 8px 0', fontFamily: 'var(--font-heading)', fontWeight: 800, lineHeight: 1.3 }}>
                  Get Free Expert Advice & Curated Influencer Matching
                </h3>
                <p style={{ fontSize: '14.5px', color: 'rgba(255,255,255,0.85)', margin: 0, maxWidth: '850px', lineHeight: 1.6 }}>
                  Whether you are a Brand, Customer, or Creator — share your website, Instagram page & campaign goals. Our Creator Strategists will curate influencers, negotiate rates & revert back within 24 hours.
                </p>
              </div>

              {/* ACTION BUTTONS — PROMINENT BRAND BUTTONS */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                {/* REQUEST EXPERT ADVICE — LOGIN BUTTON GRADIENT CSS */}
                <button
                  onClick={() => setShowExpertForm(!showExpertForm)}
                  style={{
                    backgroundImage: showExpertForm
                      ? 'linear-gradient(to right, #1a1a2e 0%, #2d2d44 100%)'
                      : 'linear-gradient(to right, #12121c 0%, #3c3c4f 51%, #12121c 100%)',
                    backgroundSize: '200% auto',
                    color: '#ffffff',
                    border: '1.5px solid rgba(255, 255, 255, 0.4)',
                    padding: '16px 36px',
                    borderRadius: '100px',
                    fontFamily: 'var(--font-heading, "Plus Jakarta Sans", "Inter", sans-serif)',
                    fontWeight: 800,
                    fontSize: '15px',
                    letterSpacing: '0.02em',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
                    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundPosition = 'right center';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.75)';
                    e.currentTarget.style.boxShadow = '0 12px 36px rgba(0, 0, 0, 0.95), 0 0 25px rgba(255, 255, 255, 0.25)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundPosition = 'left center';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.25)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  {showExpertForm ? 'Hide Form ✕' : 'Request Expert Advice 📋'}
                </button>

                {/* EXPLORE & HIRE DIRECTLY — RED CREATOR MARKETPLACE ACCENT */}
                <button
                  onClick={() => {
                    const el = document.getElementById('creators-discovery-grid');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  style={{
                    background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.25) 0%, rgba(185, 28, 28, 0.4) 100%)',
                    color: '#ffffff',
                    border: '1.5px solid rgba(239, 68, 68, 0.65)',
                    padding: '16px 32px',
                    borderRadius: '100px',
                    fontFamily: 'var(--font-heading, "Plus Jakarta Sans", "Inter", sans-serif)',
                    fontWeight: 800,
                    fontSize: '15px',
                    letterSpacing: '0.02em',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 6px 24px rgba(220, 38, 38, 0.35)',
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(220, 38, 38, 0.4) 0%, rgba(225, 29, 72, 0.55) 100%)';
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.9)';
                    e.currentTarget.style.boxShadow = '0 10px 30px rgba(220, 38, 38, 0.55)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(220, 38, 38, 0.25) 0%, rgba(185, 28, 28, 0.4) 100%)';
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.65)';
                    e.currentTarget.style.boxShadow = '0 6px 24px rgba(220, 38, 38, 0.35)';
                  }}
                >
                  Explore & Hire Directly ⬇️
                </button>
              </div>
            </div>

            {showExpertForm && (
              <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                {expertInquirySubmitted ? (
                  <div style={{ background: 'rgba(0, 230, 118, 0.15)', border: '1.5px solid #00E676', borderRadius: '16px', padding: '24px', textAlign: 'center', color: '#fff' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎉</div>
                    <h4 style={{ fontSize: '20px', color: '#00E676', margin: '0 0 6px 0', fontWeight: 800 }}>Inquiry Received!</h4>
                    <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.9)', margin: '0 0 14px 0', lineHeight: 1.5 }}>
                      Thank you! Your details have been sent to our Creator Strategy Team.<br />
                      Our strategist will analyze your brand / handle and revert back with curated creator recommendations within 24 hours.
                    </p>
                    <button onClick={() => setExpertInquirySubmitted(false)} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '8px 20px', borderRadius: '100px', fontSize: '12.5px', cursor: 'pointer' }}>
                      Submit Another Request
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleExpertInquirySubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '13px', color: '#ccc', fontWeight: 600 }}>I am a *</label>
                      <select
                        value={expertInquiryForm.userRole}
                        onChange={e => setExpertInquiryForm({ ...expertInquiryForm, userRole: e.target.value })}
                        style={{ background: '#0b0b14', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '12px 14px', color: '#fff', fontSize: '14px', outline: 'none' }}
                      >
                        <option value="Brand / Business Owner">Brand / Business Owner</option>
                        <option value="Individual Customer / Client">Individual Customer / Client</option>
                        <option value="Agency / Marketer">Agency / Marketer</option>
                        <option value="Creator / Influencer">Creator / Influencer</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '13px', color: '#ccc', fontWeight: 600 }}>Your Full Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Ananya Roy"
                        value={expertInquiryForm.name}
                        onChange={e => setExpertInquiryForm({ ...expertInquiryForm, name: e.target.value })}
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '12px 14px', color: '#fff', fontSize: '14px', outline: 'none' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '13px', color: '#ccc', fontWeight: 600 }}>Email Address *</label>
                      <input
                        type="email"
                        required
                        placeholder="ananya@brand.com"
                        value={expertInquiryForm.email}
                        onChange={e => setExpertInquiryForm({ ...expertInquiryForm, email: e.target.value })}
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '12px 14px', color: '#fff', fontSize: '14px', outline: 'none' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '13px', color: '#ccc', fontWeight: 600 }}>Phone / WhatsApp Number *</label>
                      <input
                        type="tel"
                        required
                        placeholder="+91 98765 43210"
                        value={expertInquiryForm.phone}
                        onChange={e => setExpertInquiryForm({ ...expertInquiryForm, phone: e.target.value })}
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '12px 14px', color: '#fff', fontSize: '14px', outline: 'none' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '13px', color: '#ccc', fontWeight: 600 }}>Website URL / Store Link</label>
                      <input
                        type="text"
                        placeholder="https://yourbrand.com (optional)"
                        value={expertInquiryForm.websiteUrl}
                        onChange={e => setExpertInquiryForm({ ...expertInquiryForm, websiteUrl: e.target.value })}
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '12px 14px', color: '#fff', fontSize: '14px', outline: 'none' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '13px', color: '#ccc', fontWeight: 600 }}>Instagram Page / Social Handle</label>
                      <input
                        type="text"
                        placeholder="@yourbrand_official"
                        value={expertInquiryForm.instaPage}
                        onChange={e => setExpertInquiryForm({ ...expertInquiryForm, instaPage: e.target.value })}
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '12px 14px', color: '#fff', fontSize: '14px', outline: 'none' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '13px', color: '#ccc', fontWeight: 600 }}>Campaign Goal</label>
                      <select
                        value={expertInquiryForm.campaignGoal}
                        onChange={e => setExpertInquiryForm({ ...expertInquiryForm, campaignGoal: e.target.value })}
                        style={{ background: '#0b0b14', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '12px 14px', color: '#fff', fontSize: '14px', outline: 'none' }}
                      >
                        <option value="Product Sales & Conversions">Product Sales & Conversions</option>
                        <option value="Brand Awareness & Reach">Brand Awareness & Reach</option>
                        <option value="UGC Video Content & Reels">UGC Video Content & Reels</option>
                        <option value="Product Gifting & Unboxing">Product Gifting & Unboxing</option>
                        <option value="App Installs & Leads">App Installs & Leads</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '13px', color: '#ccc', fontWeight: 600 }}>Influencer Budget (in INR)</label>
                      <select
                        value={expertInquiryForm.budget}
                        onChange={e => setExpertInquiryForm({ ...expertInquiryForm, budget: e.target.value })}
                        style={{ background: '#0b0b14', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '12px 14px', color: '#fff', fontSize: '14px', outline: 'none' }}
                      >
                        <option value="No Idea / Need Advice">No Idea / Need Advice</option>
                        <option value="₹10,000 – ₹25,000">₹10,000 – ₹25,000</option>
                        <option value="₹25,000 – ₹50,000">₹25,000 – ₹50,000</option>
                        <option value="₹50,000 – ₹2,00,000">₹50,000 – ₹2,00,000</option>
                        <option value="₹2,00,000+">₹2,00,000+</option>
                      </select>
                    </div>

                    <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '13px', color: '#ccc', fontWeight: 600 }}>Campaign Requirements & Target Audience Notes</label>
                      <textarea
                        rows={3}
                        placeholder="e.g. We want 5 fashion micro-creators in Delhi for our new launch."
                        value={expertInquiryForm.notes}
                        onChange={e => setExpertInquiryForm({ ...expertInquiryForm, notes: e.target.value })}
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '12px 14px', color: '#fff', fontSize: '14px', outline: 'none', resize: 'vertical' }}
                      />
                    </div>

                    <div style={{ gridColumn: 'span 2', textAlign: 'center', marginTop: '8px' }}>
                      <GlowButton variant="glow" type="submit" disabled={isSubmittingExpert} style={{ padding: '14px 36px', fontSize: '15px', fontWeight: 800, width: '100%' }}>
                        {isSubmittingExpert ? 'Sending Details...' : 'Submit Request & Get Advice 🚀'}
                      </GlowButton>

                      {/* The submission can fail; it used to show the thank-you screen either way. */}
                      {expertInquiryError && (
                        <div style={{
                          marginTop: '10px', padding: '10px 13px', borderRadius: '8px', fontSize: '12.5px',
                          background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.3)', color: '#ff6b7a',
                        }}>
                          {expertInquiryError}
                        </div>
                      )}
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* PLATFORM PROTECTION & DISINTERMEDIATION SAFETY BANNER */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(255, 179, 0, 0.12) 0%, rgba(220, 38, 38, 0.12) 100%)',
              border: '1.5px solid #FFB300',
              borderRadius: '16px',
              padding: '16px 22px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              boxShadow: '0 4px 20px rgba(255,179,0,0.15)'
            }}
          >
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(255, 179, 0, 0.2)', border: '1px solid #FFB300', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ShieldAlert size={24} color="#FFB300" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 900, color: '#FFB300', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🛡️ RAFTRA 100% ESCROW PROTECTION POLICY</span>
                <span style={{ fontSize: '10px', background: '#dc2626', color: '#fff', padding: '2px 8px', borderRadius: '100px', fontWeight: 800 }}>STRICT RULE</span>
              </div>
              <p style={{ fontSize: '13px', color: '#fff', margin: 0, fontWeight: 600, lineHeight: 1.5 }}>
                Pay ONLY via Raftra Web Chat & Escrow Vault. Raftra is <b>NOT responsible</b> for deals taken off-platform (direct wire transfers or IG DMs). Sharing contact info in chat = <b>instant account suspension</b>.
              </p>
            </div>
          </div>

          {/* BRAND WORKFLOW STEPPER (HOW TO USE) */}
          <div
            className="glow-card"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '22px 24px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '17px', margin: '0 0 2px 0', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-heading)', fontWeight: 800 }}>
                  ⚡ HOW BRAND CAMPAIGNS WORK (5 SIMPLE STEPS)
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, fontWeight: 500 }}>
                  Follow this exact step-by-step process from negotiation to payout release.
                </p>
              </div>
              <span style={{ fontSize: '11px', padding: '6px 12px', background: 'rgba(0,230,118,0.15)', color: '#00E676', border: '1px solid #00E676', borderRadius: '20px', fontWeight: 800 }}>
                BRAND CAMPAIGN FLOW
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: '12px' }}>
              {[
                { step: '1', title: 'Negotiate Directly with Influencer', tag: 'Web Chat Discussion', desc: 'Open Web Chat & discuss project requirements directly with creator.' },
                { step: '2', title: 'Send Finalize Deal Proposal', tag: 'Price (₹) & Deliverables', desc: 'Click "Finalize Deal", enter final price & deliverables, and send proposal.' },
                { step: '3', title: 'Accept Proposal & Go to Payment', tag: 'Pay via Escrow Vault', desc: 'Once creator accepts proposal ➔ Click "Proceed to Secure Payment Page".' },
                { step: '4', title: 'Get Email & WhatsApp Contact', tag: 'Exchange Deliverables', desc: 'Receive email receipt ➔ Open WhatsApp link with creator & exchange deliverables.' },
                { step: '5', title: 'Send Satisfactory Message', tag: 'Release Payout to Creator', desc: 'Work done & satisfactory? Send timestamped satisfaction code to influencer for payout release.' }
              ].map(item => (
                <div key={item.step} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '16px', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11.5px', fontWeight: 900, color: '#00E676', letterSpacing: '0.05em' }}>STEP {item.step}</span>
                      <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#00E676', color: '#000', fontWeight: 900, fontSize: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{item.step}</span>
                    </div>
                    <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#fff', marginBottom: '6px', lineHeight: 1.3 }}>{item.title}</div>
                    <div style={{ fontSize: '10.5px', color: '#00C4CC', fontWeight: 700, marginBottom: '8px', background: 'rgba(0,196,204,0.1)', padding: '3px 8px', borderRadius: '6px', display: 'inline-block' }}>{item.tag}</div>
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.4, fontWeight: 500 }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Filters row */}
          <div id="creators-discovery-grid" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="glow-card" style={{ padding: '16px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11.5px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', minWidth: '130px', fontWeight: 700 }}>
                <Search size={14} color="#00E676" /> FILTER BY NICHE:
              </span>
              {['All', 'Local / City-based', 'Fashion', 'Fitness', 'Lifestyle', 'Art', 'Education', 'Tech', 'Food', 'Couple Reels'].map((niche) => (
                <button
                  key={niche}
                  onClick={() => setFilterNiche(niche)}
                  style={{
                    padding: '6px 14px',
                    fontSize: '12px',
                    background: filterNiche === niche ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255,255,255,0.02)',
                    border: '1px solid',
                    borderColor: filterNiche === niche ? '#00E676' : 'var(--border)',
                    borderRadius: '20px',
                    color: filterNiche === niche ? '#00E676' : 'var(--text-secondary)',
                    fontWeight: filterNiche === niche ? 700 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {niche}
                </button>
              ))}
            </div>

            <div className="glow-card" style={{ padding: '12px 16px', display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
                <span style={{ fontSize: '11.5px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', minWidth: '110px', fontWeight: 700 }}>
                  ⚡ FOLLOWERS:
                </span>
                {[
                  { id: 'All', label: 'All Creators' },
                  { id: 'Nano', label: 'Nano (< 10k)' },
                  { id: 'Micro', label: 'Micro (10k - 100k)' },
                  { id: 'Macro', label: 'Macro (100k+)' }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setFilterFollowers(item.id)}
                    style={{
                      padding: '5px 14px',
                      fontSize: '11.5px',
                      background: filterFollowers === item.id ? 'rgba(90, 82, 255, 0.2)' : 'rgba(255,255,255,0.02)',
                      border: '1px solid',
                      borderColor: filterFollowers === item.id ? '#5A52FF' : 'var(--border)',
                      borderRadius: '20px',
                      color: filterFollowers === item.id ? '#fff' : 'var(--text-secondary)',
                      fontWeight: filterFollowers === item.id ? 700 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ArrowUpDown size={12} color="#00E676" /> Sort:
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{
                    background: 'rgba(0, 230, 118, 0.1)',
                    border: '1px solid rgba(0, 230, 118, 0.3)',
                    borderRadius: '6px',
                    color: '#00E676',
                    padding: '4px 10px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="featured" style={{ background: '#121216', color: '#fff' }}>🔥 Top Reach (Recommended)</option>
                  <option value="followers_desc" style={{ background: '#121216', color: '#fff' }}>👥 Followers: High ➔ Low ⬇️</option>
                  <option value="followers_asc" style={{ background: '#121216', color: '#fff' }}>👥 Followers: Low ➔ High ⬆️</option>
                  <option value="price_desc" style={{ background: '#121216', color: '#fff' }}>💰 Price: High ➔ Low ⬇️</option>
                  <option value="price_asc" style={{ background: '#121216', color: '#fff' }}>💰 Price: Low ➔ High ⬆️</option>
                </select>
              </div>
            </div>
          </div>

          {/* Influencers grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))', gap: '22px' }}>
            {sortedCreators.map((creator) => (
              <div key={creator.id} className="glow-card" style={{ padding: '22px', display: 'flex', flexDirection: 'column' }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <img
                      src={creator.avatar || ("https://ui-avatars.com/api/?name=" + creator.name.replace(' ', '+') + "&background=random&color=fff&size=56")}
                      alt={creator.name}
                      style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.2)' }}
                    />
                    <div>
                      <h4 style={{ fontSize: '17px', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '6px', color: '#fff', fontWeight: 700 }}>
                        {creator.name} <BadgeCheck size={15} color="#00E676" />
                      </h4>
                      <div style={{ fontSize: '13px', color: '#00E676', fontWeight: 600 }}>{creator.handle}</div>
                      {creator.location && (
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px' }}>📍 {creator.location}</div>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.1)', color: '#fff', padding: '5px 10px', borderRadius: '6px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {creator.category.toUpperCase()}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, marginBottom: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Followers</span>
                    {(!creator.followers || creator.followers.toLowerCase().includes('view profile')) ? (
                      <a
                        href={creator.profileLink || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#60A5FA', textDecoration: 'underline', fontWeight: 600 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        View Profile ↗
                      </a>
                    ) : (
                      <span style={{ color: '#fff', fontWeight: 700 }}>{creator.followers}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Avg Views / Reach</span>
                    {(!creator.avgViews || creator.avgViews.toLowerCase().includes('view profile')) ? (
                      <a
                        href={creator.profileLink || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#60A5FA', textDecoration: 'underline', fontWeight: 600 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        View Profile ↗
                      </a>
                    ) : (
                      <span style={{ color: '#00E676', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Activity size={14} /> {creator.avgViews}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Fake Follower Score</span>
                    <span style={{ color: creator.fakeFollowerScore < 5 ? '#00E676' : 'var(--warning)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <ShieldAlert size={14} /> {creator.fakeFollowerScore}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Collab Price Range</span>
                    <span style={{ color: '#00E676', fontWeight: 700 }}>
                      {creator.expectedPrice}
                    </span>
                  </div>

                  <div style={{ marginTop: '8px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600, letterSpacing: '0.05em' }}>AVAILABLE FOR:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {creator.deliverables.map(d => {
                        const isUGC = d.toLowerCase().includes('ugc');
                        return (
                          <span
                            key={d}
                            style={{
                              fontSize: '12px',
                              background: isUGC ? 'rgba(255, 77, 77, 0.15)' : 'rgba(0, 230, 118, 0.1)',
                              color: isUGC ? '#FF4D4D' : '#00E676',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              border: isUGC ? '1px solid rgba(255, 77, 77, 0.4)' : '1px solid rgba(0, 230, 118, 0.2)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontWeight: isUGC ? 700 : 500
                            }}
                          >
                            {isUGC ? <Video size={12} color="#FF4D4D" /> : d.includes('Video') ? <Video size={12} /> : <ImageIcon size={12} />} {d}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <GlowButton variant="glow" onClick={() => handleNegotiateClick(creator)} style={{ flex: 1, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px' }}>
                    <MessageCircle size={14} /> Negotiate
                  </GlowButton>
                  {creator.profileLink && (
                    <button
                      onClick={() => window.open(creator.profileLink, '_blank')}
                      style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <ExternalLink size={14} /> Profile
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Visitor Guest Identification / Quick Details Modal */}
      {guestModalCreator && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glow-card" style={{ width: '100%', maxWidth: '460px', background: '#0D0D14', border: '1.5px solid rgba(90,82,255,0.5)', borderRadius: '20px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.9), 0 0 30px rgba(90,82,255,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
              <div>
                <div style={{ display: 'inline-block', padding: '3px 10px', background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: '100px', color: '#00E676', fontSize: '11px', fontWeight: 800, marginBottom: '6px' }}>
                  💬 QUICK CHAT ACCESS
                </div>
                <h3 style={{ fontSize: '19px', fontWeight: 800, color: '#fff', margin: 0 }}>Start Negotiation with {guestModalCreator.name}</h3>
                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>Fill basic details below to open live web chat & negotiate rates.</div>
              </div>
              <button onClick={() => setGuestModalCreator(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '22px', padding: '0 4px' }}>&times;</button>
            </div>

            <form onSubmit={handleSaveGuestIdentity} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12.5px', color: '#ccc', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Your Full Name *</label>
                <input
                  type="text"
                  required
                  value={guestContactName}
                  onChange={e => setGuestContactName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  style={{ width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', color: '#fff', fontSize: '14px', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12.5px', color: '#ccc', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Brand / Business Name or Project *</label>
                <input
                  type="text"
                  required
                  value={guestBrandName}
                  onChange={e => setGuestBrandName(e.target.value)}
                  placeholder="e.g. Zenith Apparel or Personal Project"
                  style={{ width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', color: '#fff', fontSize: '14px', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12.5px', color: '#ccc', display: 'block', marginBottom: '6px', fontWeight: 600 }}>WhatsApp / Work Email (for confirmation & receipt) *</label>
                <input
                  type="text"
                  required
                  value={guestContactInfo}
                  onChange={e => setGuestContactInfo(e.target.value)}
                  placeholder="e.g. +91 98765 43210 or rahul@brand.com"
                  style={{ width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', color: '#fff', fontSize: '14px', outline: 'none' }}
                />
              </div>

              <GlowButton variant="glow" type="submit" style={{ marginTop: '6px', padding: '14px', fontSize: '15px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                Open Web Chat & Start Negotiation 💬
              </GlowButton>

              <div style={{ textAlign: 'center', marginTop: '6px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                Have an existing Raftra account?{' '}
                <a href="/login" style={{ color: '#00E676', fontWeight: 700, textDecoration: 'underline' }}>
                  Sign In to Brand Account 🔑
                </a>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Negotiation Chat Modal */}
      {activeChat && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', padding: '20px' }}>
          <div className="glow-card" style={{ width: '850px', height: '82vh', background: '#08080a', border: '1px solid rgba(90,82,255,0.4)', borderRadius: '20px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.6)' }}>

            {/* Chat Header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <img src={activeChat.avatar || ("https://ui-avatars.com/api/?name=" + activeChat.name.replace(' ', '+') + "&background=random&color=fff&size=48")} alt={activeChat.name} style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(0,230,118,0.5)' }} />
                <div>
                  <h4 style={{ fontSize: '18px', margin: '0 0 2px 0', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-heading)' }}>
                    Direct Negotiation with {activeChat.name} <BadgeCheck size={16} color="#00E676" />
                  </h4>
                  <div style={{ fontSize: '12.5px', color: '#00E676', fontWeight: 600 }}>{activeChat.handle} • {activeChat.followers} followers</div>
                </div>
              </div>
              <button onClick={() => setActiveChat(null)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '18px' }}>&times;</button>
            </div>

            {/* Raftra Anti-Bypass & Escrow Notice Banner */}
            <div style={{ background: 'linear-gradient(90deg, rgba(220, 38, 38, 0.12) 0%, rgba(255, 179, 0, 0.12) 100%)', borderBottom: '1px solid rgba(220, 38, 38, 0.3)', padding: '12px 24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <ShieldAlert size={18} color="#FFB300" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.9)', lineHeight: '1.4' }}>
                <strong style={{ color: '#FFB300' }}>ESCROW SECURITY ACTIVE:</strong> Finalize deal below. Funds stay 100% locked in <b>Raftra Vault</b> until work is delivered & approved. Exchanging phone numbers/social DMs triggers <b>chat block</b>.
              </div>
            </div>

            {/* Chat Feed */}
            <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px', background: 'rgba(0,0,0,0.3)' }}>
              {chatMessages.map((msg, i) => {
                if (msg.sender === 'system') {
                  return (
                    <div key={i} style={{ textAlign: 'center', margin: '8px 0' }}>
                      <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '6px 16px', borderRadius: '20px', border: '1px solid var(--border)' }}>
                        {msg.text}
                      </span>
                    </div>
                  );
                }
                const isBrand = msg.sender === 'brand';

                let parsedContent: any = null;
                try {
                  if (msg.text.trim().startsWith('{')) {
                    parsedContent = JSON.parse(msg.text);
                  }
                } catch (e) { }

                if (parsedContent && parsedContent.type === 'proposal') {
                  return (
                    <div key={i} style={{ alignSelf: 'center', margin: '16px 0', width: '100%', maxWidth: '500px' }}>
                      <div style={{ background: 'linear-gradient(135deg, rgba(90,82,255,0.15), rgba(120,50,255,0.1))', border: '1px solid rgba(90,82,255,0.4)', padding: '24px', borderRadius: '16px', textAlign: 'center', boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }}>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                          🤝 OFFICIAL DEAL PROPOSAL
                        </div>
                        <div style={{ fontSize: '32px', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
                          ₹{parsedContent.amount.toLocaleString()}
                        </div>
                        <div style={{ fontSize: '13px', color: '#00E676', fontWeight: 600, marginBottom: '18px', background: 'rgba(0,230,118,0.1)', padding: '6px 12px', borderRadius: '8px', display: 'inline-block' }}>
                          Deliverables: {parsedContent.deliverables || 'UGC Video Reel'}
                        </div>
                        <div>
                          <GlowButton
                            variant="glow"
                            onClick={() => {
                              const acceptMsg = { sender: 'creator' as const, text: JSON.stringify({ type: 'proposal_accepted', amount: parsedContent.amount, deliverables: parsedContent.deliverables }) };
                              const storageKey = `raftra_chat_${activeChat.id}`;
                              const currentMsgs = JSON.parse(localStorage.getItem(storageKey) || JSON.stringify(chatMessages));
                              const updated = [...currentMsgs, acceptMsg];
                              setChatMessages(updated as any);
                              localStorage.setItem(storageKey, JSON.stringify(updated));
                              window.dispatchEvent(new Event('storage'));
                            }}
                            style={{ width: '100%', padding: '12px', fontSize: '13px', fontWeight: 700 }}
                          >
                            Accept Deal (as Influencer)
                          </GlowButton>
                        </div>
                      </div>
                    </div>
                  );
                }

                if (parsedContent && parsedContent.type === 'proposal_accepted') {
                  return (
                    <div key={i} style={{ alignSelf: 'center', margin: '16px 0', width: '100%', maxWidth: '520px' }}>
                      <div style={{ background: 'linear-gradient(135deg, rgba(0,230,118,0.15), rgba(16,185,129,0.1))', border: '1px solid rgba(0,230,118,0.4)', padding: '24px', borderRadius: '16px', textAlign: 'center', color: 'var(--success)' }}>
                        <CheckCircle2 size={32} style={{ marginBottom: '8px' }} />
                        <div style={{ fontWeight: 800, fontSize: '18px', color: '#fff' }}>Deal Accepted by Influencer! 🎉</div>
                        <div style={{ fontSize: '14px', color: '#00E676', marginTop: '6px', fontWeight: 700 }}>
                          Amount: ₹{parsedContent.amount.toLocaleString()}
                        </div>
                        <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.8)', marginTop: '4px', marginBottom: '18px' }}>
                          Deliverables: {parsedContent.deliverables || 'UGC Video Reel'}
                        </div>
                        <GlowButton variant="glow" onClick={() => handlePayRazorpay(parsedContent.amount)} style={{ width: '100%', padding: '14px', fontSize: '14px', fontWeight: 800 }}>
                          💳 Proceed to Secure Payment Page (Razorpay Escrow)
                        </GlowButton>
                      </div>
                    </div>
                  );
                }

                if (parsedContent && parsedContent.type === 'payment_complete') {
                  return (
                    <div key={i} style={{ alignSelf: 'center', margin: '16px 0', width: '100%', maxWidth: '500px' }}>
                      <div style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.3)', padding: '20px', borderRadius: '16px', textAlign: 'center', color: '#ffd700' }}>
                        <DollarSign size={28} style={{ marginBottom: '6px' }} />
                        <div style={{ fontWeight: 800, fontSize: '18px' }}>Payment Complete & Vault Funded!</div>
                        <div style={{ fontSize: '13px', marginTop: '4px', color: '#fff' }}>₹{parsedContent.amount.toLocaleString()} locked safely in Escrow. Confirmation email sent!</div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={i} style={{ alignSelf: isBrand ? 'flex-end' : 'flex-start', maxWidth: '65%' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', textAlign: isBrand ? 'right' : 'left' }}>
                      {isBrand ? 'You (Brand)' : activeChat.name}
                    </div>
                    <div style={{
                      background: isBrand ? 'rgba(90, 82, 255, 0.2)' : 'rgba(255,255,255,0.06)',
                      border: '1px solid',
                      borderColor: isBrand ? 'rgba(90, 82, 255, 0.4)' : 'var(--border)',
                      padding: '12px 18px',
                      borderRadius: isBrand ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                      color: '#fff',
                      fontSize: '13.5px',
                      lineHeight: '1.5'
                    }}>
                      {msg.text}
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input Bar */}
            <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border)', background: '#0a0a0d' }}>
              {showFinalize ? (
                <form onSubmit={handleLockDeal} style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(90,82,255,0.08)', border: '1px solid rgba(90,82,255,0.3)', padding: '16px', borderRadius: '12px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)' }}>⚡ Finalize Official Deal Contract</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Final Price (₹):</label>
                      <input
                        type="number"
                        placeholder="e.g. 10000"
                        value={finalPrice}
                        onChange={e => setFinalPrice(e.target.value)}
                        required
                        style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--primary)', borderRadius: '8px', color: '#fff', outline: 'none', fontSize: '13px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Deliverables Breakdown:</label>
                      <input
                        type="text"
                        placeholder="e.g. 1 UGC Reel + 2 IG Stories"
                        value={finalDeliverables}
                        onChange={e => setFinalDeliverables(e.target.value)}
                        required
                        style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--primary)', borderRadius: '8px', color: '#fff', outline: 'none', fontSize: '13px', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => setShowFinalize(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px 14px', fontSize: '12px' }}>
                      Cancel
                    </button>
                    <GlowButton variant="glow" type="submit" style={{ padding: '8px 20px', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                      Send Proposal to Influencer 🤝
                    </GlowButton>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleSendChat} style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                  <button type="button" onClick={() => setShowFinalize(true)} style={{ background: 'rgba(90,82,255,0.15)', border: '1px solid rgba(90,82,255,0.4)', borderRadius: '10px', padding: '12px 18px', color: 'var(--primary)', cursor: 'pointer', fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    ⚡ Finalize Deal
                  </button>
                  <input
                    type="text"
                    placeholder="Type message to creator or propose terms..."
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    style={{ flex: 1, padding: '12px 18px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '10px', color: '#fff', outline: 'none', fontSize: '13.5px' }}
                  />
                  <GlowButton variant="glow" type="submit" style={{ padding: '12px 22px' }}>
                    <Send size={18} />
                  </GlowButton>
                </form>
              )}
            </div>

          </div>
        </div>
      )}

      {/* View Profile Modal */}
      {viewProfile && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="glow-card" style={{ width: '600px', maxHeight: '85vh', background: '#0a0a0c', padding: '30px', position: 'relative', overflowY: 'auto' }}>
            <button onClick={() => setViewProfile(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '24px' }}>&times;</button>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '30px' }}>
              <img src={"https://ui-avatars.com/api/?name=" + viewProfile.name.replace(' ', '+') + "&background=random&color=fff&size=80"} alt={viewProfile.name} style={{ borderRadius: '50%', border: '2px solid var(--primary)' }} />
              <div>
                <h3 style={{ fontSize: '24px', margin: '0 0 8px 0', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {viewProfile.name} <BadgeCheck size={18} color="var(--primary)" />
                </h3>
                <div style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '16px', fontSize: '14px' }}>
                  <span>{viewProfile.handle}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--warning)' }}>
                    <Star size={14} fill="currentColor" /> {viewProfile.rating} ({viewProfile.reviewsCount} reviews)
                  </span>
                </div>
              </div>
            </div>

            {/* ESCROW SAFETY BANNER */}
            <div style={{ background: 'rgba(0, 230, 118, 0.08)', border: '1px solid rgba(0, 230, 118, 0.3)', borderRadius: '12px', padding: '12px 16px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <CheckCircle2 size={20} color="#00E676" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: '12px', color: '#00E676', lineHeight: 1.4 }}>
                <b>Raftra Escrow Guarantee</b>: Always negotiate & hire through Raftra Web Chat. Funds remain safe in Escrow until you review & approve final video deliverables. Off-platform deals waive all transparency & refund guarantees.
              </div>
            </div>

            {/* Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '30px' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Followers</div>
                {(!viewProfile.followers || viewProfile.followers.toLowerCase().includes('view profile')) ? (
                  <a href={viewProfile.profileLink || '#'} target="_blank" rel="noopener noreferrer" style={{ fontSize: '15px', color: '#60A5FA', textDecoration: 'underline', fontWeight: 600 }}>
                    View Profile ↗
                  </a>
                ) : (
                  <div style={{ fontSize: '20px', color: '#fff', fontWeight: 600 }}>{viewProfile.followers}</div>
                )}
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Engagement</div>
                <div style={{ fontSize: '20px', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <Activity size={16} color="var(--success)" /> 4.2%
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Fake Score</div>
                <div style={{ fontSize: '20px', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <ShieldAlert size={16} color={viewProfile.fakeFollowerScore < 5 ? "var(--success)" : "var(--warning)"} /> {viewProfile.fakeFollowerScore}%
                </div>
              </div>
            </div>

            {/* Recent Works */}
            <div style={{ marginBottom: '30px' }}>
              <h4 style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>RECENT BRAND COLLABORATIONS</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {viewProfile.recentWorks.map(work => (
                  <span key={work} style={{ padding: '6px 12px', background: 'rgba(90,82,255,0.1)', color: 'var(--primary)', border: '1px solid rgba(90,82,255,0.2)', borderRadius: '20px', fontSize: '12px' }}>
                    {work}
                  </span>
                ))}
              </div>
            </div>

            {/* Recent Posts */}
            <div style={{ marginBottom: '30px' }}>
              <h4 style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>RECENT POSTS</h4>
              {viewProfile.recentPosts && viewProfile.recentPosts.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  {viewProfile.recentPosts.map((post, i) => (
                    <div key={i} style={{ aspectRatio: '1', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', overflow: 'hidden' }}>
                      {post.url ? (
                        <div style={{ width: '100%', height: '100%', padding: '8px', wordBreak: 'break-all', fontSize: '10px', color: 'var(--primary)', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <a href={post.url} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>View Link</a>
                        </div>
                      ) : (
                        <ImageIcon size={24} color="var(--text-muted)" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', color: 'var(--text-muted)', textAlign: 'center', fontSize: '12px' }}>No recent posts uploaded.</div>
              )}
            </div>

            {/* Top Reviews */}
            <div>
              <h4 style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>LATEST REVIEWS</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(viewProfile.topComments || [
                  { author: `Marketing Director, ${viewProfile.recentWorks[0] || 'Tech Corp'}`, text: `"${viewProfile.name.split(' ')[0]} was amazing to work with! Delivered the UGC video 2 days early and it converted at 3.5x ROAS immediately. Highly recommended."` }
                ]).map((comment, idx) => (
                  <div key={idx} style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', gap: '4px', color: 'var(--warning)', marginBottom: '8px' }}>
                      <Star size={12} fill="currentColor" /><Star size={12} fill="currentColor" /><Star size={12} fill="currentColor" /><Star size={12} fill="currentColor" /><Star size={12} fill="currentColor" />
                    </div>
                    <p style={{ fontSize: '13px', color: '#fff', lineHeight: 1.5, margin: 0 }}>
                      {comment.text}
                    </p>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>- {comment.author}</div>
                  </div>
                ))}
              </div>
            </div>

            <GlowButton variant="glow" onClick={() => {
              const profile = viewProfile;
              setViewProfile(null);
              handleOpenChat(profile);
            }} style={{ width: '100%', marginTop: '30px', padding: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
              <MessageCircle size={16} /> Negotiate with {viewProfile.name.split(' ')[0]}
            </GlowButton>
          </div>
        </div>
      )}

      {/* BRAND EMAIL CONFIRMATION & WORKFLOW RECEIPT MODAL */}
      {showEmailReceiptModal && paidDealInfo && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', padding: '20px' }}>
          <div className="glow-card" style={{ width: '640px', maxHeight: '90vh', background: '#0a0a0d', border: '1px solid #00E676', borderRadius: '24px', padding: '32px', position: 'relative', overflowY: 'auto' }}>
            <button onClick={() => setShowEmailReceiptModal(false)} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              &times;
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={28} color="#00E676" />
              </div>
              <div>
                <h3 style={{ fontSize: '20px', margin: '0 0 4px 0', color: '#fff', fontFamily: 'var(--font-heading)' }}>
                  Deal Funded & Confirmation Email Sent! ✉️
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                  Escrow payment of <b>₹{paidDealInfo.amount.toLocaleString()}</b> is securely locked in Raftra Vault.
                </p>
              </div>
            </div>

            {/* Email Banner Notification */}
            <div style={{ background: 'rgba(0, 196, 204, 0.1)', border: '1px solid rgba(0, 196, 204, 0.3)', borderRadius: '12px', padding: '14px 18px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '12px', color: '#00C4CC', lineHeight: 1.4 }}>
                📬 <b>Official Receipt Sent</b>: Full contract deliverables & influencer contact details have been emailed to your registered brand address.
              </div>
            </div>

            {/* Deal Breakdown Table */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '14px', padding: '18px', marginBottom: '24px' }}>
              <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                📋 CONTRACT & DELIVERABLES BREAKDOWN
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                <div><span style={{ color: 'var(--text-muted)' }}>Creator:</span> <b style={{ color: '#fff' }}>{paidDealInfo.creator.name} ({paidDealInfo.creator.handle})</b></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Deliverables:</span> <b style={{ color: '#00E676' }}>UGC Video Reel + Story</b></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Vault Transaction ID:</span> <b style={{ color: '#5A52FF', fontFamily: 'var(--font-mono)' }}>RAFTRA-ESCROW-{Date.now().toString().slice(-6)}</b></div>
                <div><span style={{ color: 'var(--text-muted)' }}>WhatsApp Contact:</span> <b style={{ color: '#25D366' }}>{paidDealInfo.creator.phone || '+91 9892936665'}</b></div>
              </div>
            </div>

            {/* Critical Warning Box for Brand */}
            <div style={{ background: 'linear-gradient(135deg, rgba(255,179,0,0.12), rgba(220,38,38,0.12))', border: '1px solid rgba(255,179,0,0.4)', borderRadius: '14px', padding: '18px', marginBottom: '24px' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#FFB300', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={18} color="#FFB300" /> ⚠️ CRITICAL BRAND INSTRUCTIONS (PLEASE READ)
              </div>
              <p style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.9)', margin: '0 0 12px 0', lineHeight: 1.5 }}>
                Connect with creator on WhatsApp/Instagram for content production. <b>SEND THE SATISFACTORY MESSAGE BELOW TO THE INFLUENCER ONLY AFTER WORK IS DELIVERED AND YOU ARE 100% SATISFIED.</b> The influencer will upload a screenshot proof of this timestamped message to Team Raftra for Escrow Payout release.
              </p>

              <div style={{ background: '#070709', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '12px', fontSize: '11.5px', fontFamily: 'var(--font-mono)', color: '#00E676', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {`--------------------------------------------------\n🛡️ RAFTRA OFFICIAL BRAND COMPLETION VERIFICATION\n--------------------------------------------------\nCampaign: Video Reel Campaign\nBrand: Demo Brand\nCreator: ${paidDealInfo.creator.name} (${paidDealInfo.creator.handle})\nTimestamp: ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN')}\nVerification Code: RAFTRA-VERIFIED-${Math.floor(10000 + Math.random() * 90000)}\n\n"We hereby confirm that deliverables are received, reviewed, published, and we are 100% satisfied with the work! You may upload screenshot proof to Team Raftra for Escrow payout release."\n--------------------------------------------------`}
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                <button
                  onClick={() => {
                    const text = `--------------------------------------------------\n🛡️ RAFTRA OFFICIAL BRAND COMPLETION VERIFICATION\n--------------------------------------------------\nCampaign: Video Reel Campaign\nBrand: Demo Brand\nCreator: ${paidDealInfo.creator.name} (${paidDealInfo.creator.handle})\nTimestamp: ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN')}\nVerification Code: RAFTRA-VERIFIED-${Math.floor(10000 + Math.random() * 90000)}\n\n"We hereby confirm that deliverables are received, reviewed, published, and we are 100% satisfied with the work! You may upload screenshot proof to Team Raftra for Escrow payout release."\n--------------------------------------------------`;
                    navigator.clipboard.writeText(text);
                    alert("Copied Satisfactory Approval Message! Send this to influencer on WhatsApp once work is delivered.");
                  }}
                  style={{ background: '#00E676', color: '#000', border: 'none', padding: '10px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  📋 Copy Custom Satisfaction Message
                </button>
                {paidDealInfo.creator.phone && (
                  <a
                    href={`https://wa.me/${paidDealInfo.creator.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hi ${paidDealInfo.creator.name}! Deal funded in Raftra Vault. Once deliverables are complete & approved, we will send your official verification token here for Team Raftra payout release!`)}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ background: 'rgba(37, 211, 102, 0.2)', border: '1px solid #25D366', color: '#25D366', padding: '10px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    📲 Open Creator WhatsApp
                  </a>
                )}
              </div>
            </div>

            <GlowButton variant="glow" onClick={() => setShowEmailReceiptModal(false)} style={{ width: '100%', padding: '14px', textAlign: 'center' }}>
              Done & Return to Workspace
            </GlowButton>
          </div>
        </div>
      )}

      {/* Global Styles for Animations */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
    </div>
  );
};
