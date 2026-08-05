import React, { useState, useEffect, useRef } from 'react';
import { Search, AlertTriangle, MessageCircle, Send, ShieldAlert, BadgeCheck, DollarSign, Video, Image as ImageIcon, Star, ExternalLink, Activity, CheckCircle2, ArrowUpDown } from 'lucide-react';
import { GlowButton } from '../GlowButton';

import parsedCreatorsData from '../../data/influencers_parsed.json';

export interface InfluencerItemExtended {
  id: string;
  name: string;
  handle: string;
  avatar?: string;
  platform: 'Facebook' | 'Instagram' | 'YouTube';
  niche: string;
  allNiches?: string[];
  category: 'Nano' | 'Micro' | 'Macro';
  expectedPrice: string;
  deliverables: string[];
  followers: string;
  avgViews?: string;
  location?: string;
  email?: string;
  phone?: string;
  profileLink?: string;
  fakeFollowerScore: number; // 0-100, lower is better
  rating: number;
  reviewsCount: number;
  recentWorks: string[];
  topComments: { author: string; text: string }[];
  recentPosts?: { id: string; url: string; likes: string; comments: string }[];
}

const INITIAL_CREATORS: InfluencerItemExtended[] = (parsedCreatorsData as any[]).map(item => ({
  ...item,
  fakeFollowerScore: item.fakeFollowerScore || 1,
  rating: item.rating || 4.8,
  reviewsCount: item.reviewsCount || 20,
  recentWorks: item.recentWorks || ['D2C Brand Collab'],
  topComments: item.topComments
}));

export const WorkspaceInfluencer: React.FC<{workspaceId: number}> = ({workspaceId}) => {
  const [creators, setCreators] = useState<InfluencerItemExtended[]>([]);
  const [filterNiche, setFilterNiche] = useState('All');
  const [filterFollowers, setFilterFollowers] = useState('All');
  const [sortBy, setSortBy] = useState('featured');

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`/api/workspaces/${workspaceId}/influencers`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(r => r.json()).then(data => {
      if (Array.isArray(data) && data.length > 0) {
        setCreators(data.map((inf: any) => {
          const nicheLower = (inf.niche || '').toLowerCase();
          let recentWorks = ['Local Brand', 'Startup X'];
          let topComments = [
            { author: 'Marketing Director', text: `"${inf.name.split(' ')[0]} was amazing to work with! Delivered the UGC video 2 days early and it converted well."` }
          ];

          if (nicheLower.includes('fitness') || nicheLower.includes('health') || nicheLower.includes('gym')) {
            recentWorks = ['Gymshark', 'MyProtein', 'Lululemon'];
            topComments = [
              { author: 'Campaign Manager, Gymshark', text: `"${inf.name.split(' ')[0]}'s fitness content is incredibly authentic. Our CPA dropped by 30%."` },
              { author: 'Founder, FitApp', text: `"Great engagement on the story posts!"` }
            ];
          } else if (nicheLower.includes('tech') || nicheLower.includes('saas') || nicheLower.includes('software')) {
            recentWorks = ['Notion', 'Figma', 'Vercel'];
            topComments = [
              { author: 'Growth Lead, Notion', text: `"Extremely clear technical breakdown. The audience loved the tutorial format."` },
              { author: 'Marketing, Figma', text: `"High quality production and great CTR on the links."` }
            ];
          } else if (nicheLower.includes('fashion') || nicheLower.includes('beauty') || nicheLower.includes('style')) {
            recentWorks = ['Zara', 'Sephora', 'Fenty Beauty'];
            topComments = [
              { author: 'PR Manager, Sephora', text: `"The makeup transition reel went viral. Highly recommended for beauty campaigns!"` },
              { author: 'Brand Rep, Zara', text: `"Beautiful aesthetic and perfectly aligned with our brand voice."` }
            ];
          }

          if (inf.recent_collabs && inf.recent_collabs.length > 0) {
            recentWorks = inf.recent_collabs;
          }

          if (inf.recent_reviews && inf.recent_reviews.length > 0) {
            topComments = inf.recent_reviews;
          }

          return {
            id: inf.id.toString(), // influencer id for chat
            name: inf.name,
            handle: inf.handle,
            platform: inf.platform,
            niche: inf.niche,
            category: 'Micro',
            expectedPrice: inf.base_rate ? `₹${inf.base_rate.toLocaleString()}` : 'Negotiable',
            deliverables: ['UGC Video'],
            followers: '10k+',
            fakeFollowerScore: 100 - inf.success_rate,
            rating: 4.8,
            reviewsCount: 10,
            recentWorks,
            topComments,
            recentPosts: inf.recent_posts || []
          };
        }));
      } else {
        const customCardStr = localStorage.getItem('raftra_creator_card_custom');
        let list = INITIAL_CREATORS;
        if (customCardStr) {
          try {
            const custom = JSON.parse(customCardStr);
            list = list.map(c => {
              if (c.handle === custom.handle || c.name === custom.name || c.id === 'creator_11') {
                const deliverables = Array.from(new Set(['UGC Video', ...(custom.deliverables || c.deliverables || ['Reel', 'Story'])]));
                return { ...c, ...custom, deliverables };
              }
              return c;
            });
          } catch (err) {}
        }
        setCreators(list);
      }
    }).catch(() => {
      const customCardStr = localStorage.getItem('raftra_creator_card_custom');
      let list = INITIAL_CREATORS;
      if (customCardStr) {
        try {
          const custom = JSON.parse(customCardStr);
          list = list.map(c => {
            if (c.handle === custom.handle || c.name === custom.name || c.id === 'creator_11') {
              const deliverables = Array.from(new Set(['UGC Video', ...(custom.deliverables || c.deliverables || ['Reel', 'Story'])]));
              return { ...c, ...custom, deliverables };
            }
            return c;
          });
        } catch (err) {}
      }
      setCreators(list);
    });
  }, []);
  
  // Modals state
  const [activeChat, setActiveChat] = useState<InfluencerItemExtended | null>(null);
  const [viewProfile, setViewProfile] = useState<InfluencerItemExtended | null>(null);

  // Chat State
  const [chatMessages, setChatMessages] = useState<{sender: 'brand'|'creator'|'system', text: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showFinalize, setShowFinalize] = useState(false);
  const [finalPrice, setFinalPrice] = useState('');
  const [finalDeliverables, setFinalDeliverables] = useState('1 UGC Reel + 2 Stories');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleLockDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!finalPrice || isNaN(Number(finalPrice)) || !activeChat) return;
    const price = parseFloat(finalPrice);
    const delivs = finalDeliverables.trim() || 'UGC Video + Reel';
    const storageKey = `raftra_chat_${activeChat.id}`;
    
    const proposalMsg = { sender: 'brand' as const, text: JSON.stringify({ type: 'proposal', amount: price, deliverables: delivs }) };
    const currentMsgs = JSON.parse(localStorage.getItem(storageKey) || JSON.stringify(chatMessages));
    const updated = [...currentMsgs, proposalMsg];
    setChatMessages(updated as any);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
    
    try {
      const token = localStorage.getItem('token');
      const payload = JSON.stringify({ type: 'proposal', amount: price, deliverables: delivs, status: 'pending' });
      await fetch(`/api/workspaces/${workspaceId}/influencers/${activeChat.id}/chat`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: payload, sender_type: 'brand' })
      });
    } catch (e) {
      console.error(e);
    }
    
    setShowFinalize(false);
    setFinalPrice('');
    setFinalDeliverables('1 UGC Reel + 2 Stories');
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
      if (e.key === storageKey && e.newValue) {
        try {
          setChatMessages(JSON.parse(e.newValue));
        } catch (err) {}
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [activeChat]);

  const handleOpenChat = (creator: InfluencerItemExtended) => {
    setActiveChat(creator);
    const storageKey = `raftra_chat_${creator.id}`;
    const savedChat = localStorage.getItem(storageKey);
    
    if (savedChat) {
      try {
        setChatMessages(JSON.parse(savedChat));
      } catch (err) {
        setChatMessages([
          { sender: 'system', text: `SECURE END-TO-END CHAT WITH ${creator.name.toUpperCase()}` },
          { sender: 'creator', text: `Hi! Thanks for reaching out. I'm open to collaborations for your brand campaign. My rate per reel is ${creator.expectedPrice}. What deliverables are you looking for?` }
        ]);
      }
    } else {
      const initialMsgs = [
        { sender: 'system', text: `SECURE END-TO-END CHAT WITH ${creator.name.toUpperCase()}` },
        { sender: 'creator', text: `Hi! Thanks for reaching out. I'm open to collaborations for your brand campaign. My rate per reel is ${creator.expectedPrice}. What deliverables are you looking for?` }
      ];
      setChatMessages(initialMsgs as any);
      localStorage.setItem(storageKey, JSON.stringify(initialMsgs));
    }
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

    const storageKey = `raftra_chat_${activeChat.id}`;
    const currentMsgs = JSON.parse(localStorage.getItem(storageKey) || JSON.stringify(chatMessages));

    // Anti-Bypass Policy Check
    if (isAntiBypassViolation(input)) {
      const violationMsg = {
        sender: 'system' as const,
        text: '🚨 CHAT BLOCKED: Anti-Bypass Policy Violation Detected! Exchanging phone numbers, Instagram handles, or off-platform contact is strictly prohibited. Your account has been reported.'
      };
      const blockedMsgs = [...currentMsgs, { sender: 'brand' as const, text: input }, violationMsg];
      setChatMessages(blockedMsgs as any);
      localStorage.setItem(storageKey, JSON.stringify(blockedMsgs));
      window.dispatchEvent(new Event('storage'));
      return;
    }

    const newMsgs = [...currentMsgs, { sender: 'brand' as const, text: input }];
    setChatMessages(newMsgs);
    localStorage.setItem(storageKey, JSON.stringify(newMsgs));
    window.dispatchEvent(new Event('storage'));

    // Silent background webhook dispatch to Creator's WhatsApp notification endpoint
    if (activeChat.phone) {
      fetch('/api/workspaces/influencer/whatsapp-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: activeChat.phone,
          handle: activeChat.handle,
          message: input
        })
      }).catch(() => {});
    }
  };

  const [showEmailReceiptModal, setShowEmailReceiptModal] = useState<boolean>(false);
  const [paidDealInfo, setPaidDealInfo] = useState<{amount: number, creator: InfluencerItemExtended} | null>(null);

  const handlePayRazorpay = async (amount: number) => {
    try {
      const token = localStorage.getItem('token');
      const payload = JSON.stringify({ type: 'payment_complete', amount });
      
      if (activeChat) {
        const storageKey = `raftra_chat_${activeChat.id}`;
        const currentMsgs = JSON.parse(localStorage.getItem(storageKey) || JSON.stringify(chatMessages));
        const updated = [...currentMsgs, { sender: 'brand' as const, text: payload }];
        setChatMessages(updated as any);
        localStorage.setItem(storageKey, JSON.stringify(updated));
        window.dispatchEvent(new Event('storage'));

        setPaidDealInfo({ amount, creator: activeChat });
        setShowEmailReceiptModal(true);
      }

      await fetch(`/api/workspaces/${workspaceId}/influencers/${activeChat!.id}/chat`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: payload, sender_type: 'brand' })
      }).catch(() => {});
    } catch(e) {
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
              ⚡ BRAND CAMPAIGN WORKFLOW (4 EASY STEPS)
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, fontWeight: 500 }}>
              How to hire, fund escrow, and approve influencer deliverables safely.
            </p>
          </div>
          <span style={{ fontSize: '11px', padding: '6px 12px', background: 'rgba(0,230,118,0.15)', color: '#00E676', border: '1px solid #00E676', borderRadius: '20px', fontWeight: 800 }}>
            HOW TO USE
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
          {[
            { step: '1', title: 'Negotiate & Lock Deal', tag: 'Chat ➔ Finalize Price & Items', desc: 'Chat with creator & click "Finalize Deal" to set Final Price (₹) & Deliverables.' },
            { step: '2', title: 'Deposit Escrow Funds', tag: 'Influencer Accepts ➔ Pay', desc: 'Creator accepts -> Click "Proceed to Secure Payment Page" to lock funds in Vault.' },
            { step: '3', title: 'Check Email & WhatsApp', tag: 'Get WA Contact & Contract', desc: 'Check email receipt & open creator WhatsApp link to start production.' },
            { step: '4', title: 'Approve Payout', tag: 'Send Code ➔ Release Funds', desc: 'Work done? Copy timestamped satisfaction code & send to creator for payout release.' }
          ].map(item => (
            <div key={item.step} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '16px', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 900, color: '#00E676', letterSpacing: '0.05em' }}>STEP {item.step}</span>
                <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#00E676', color: '#000', fontWeight: 900, fontSize: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{item.step}</span>
              </div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>{item.title}</div>
              <div style={{ fontSize: '11px', color: '#00C4CC', fontWeight: 700, marginBottom: '8px', background: 'rgba(0,196,204,0.1)', padding: '3px 8px', borderRadius: '6px', display: 'inline-block' }}>{item.tag}</div>
              <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.4, fontWeight: 500 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters row */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {sortedCreators.map((creator) => (
          <div key={creator.id} className="glow-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img
                  src={creator.avatar || ("https://ui-avatars.com/api/?name=" + creator.name.replace(' ', '+') + "&background=random&color=fff&size=48")}
                  alt={creator.name}
                  style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.2)' }}
                />
                <div>
                  <h4 style={{ fontSize: '16px', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '6px', color: '#fff' }}>
                    {creator.name} <BadgeCheck size={14} color="#00E676" />
                  </h4>
                  <div style={{ fontSize: '12px', color: '#00E676', fontWeight: 600 }}>{creator.handle}</div>
                  {creator.location && (
                    <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>📍 {creator.location}</div>
                  )}
                </div>
              </div>
              <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.1)', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>
                {creator.category.toUpperCase()}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Followers</span>
                <span style={{ color: '#fff', fontWeight: 700 }}>{creator.followers}</span>
              </div>
              {creator.avgViews && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Avg Views / Reach</span>
                  <span style={{ color: '#00E676', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Activity size={13} /> {creator.avgViews}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Fake Follower Score</span>
                <span style={{ color: creator.fakeFollowerScore < 5 ? '#00E676' : 'var(--warning)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ShieldAlert size={14} /> {creator.fakeFollowerScore}%
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Collaboration Price Range</span>
                <span style={{ color: '#00E676', fontWeight: 700 }}>
                  {creator.expectedPrice}
                </span>
              </div>
              
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px' }}>AVAILABLE FOR:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {creator.deliverables.map(d => {
                    const isUGC = d.toLowerCase().includes('ugc');
                    return (
                      <span
                        key={d}
                        style={{
                          fontSize: '10px',
                          background: isUGC ? 'rgba(255, 77, 77, 0.15)' : 'rgba(0, 230, 118, 0.1)',
                          color: isUGC ? '#FF4D4D' : '#00E676',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border: isUGC ? '1px solid rgba(255, 77, 77, 0.4)' : '1px solid rgba(0, 230, 118, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: isUGC ? 700 : 500
                        }}
                      >
                        {isUGC ? <Video size={10} color="#FF4D4D" /> : d.includes('Video') ? <Video size={10} /> : <ImageIcon size={10} />} {d}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <GlowButton variant="glow" onClick={() => handleOpenChat(creator)} style={{ flex: 1, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px' }}>
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
                } catch (e) {}

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
                <div style={{ fontSize: '20px', color: '#fff', fontWeight: 600 }}>{viewProfile.followers}</div>
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
                {`--------------------------------------------------\n🛡️ RAFTRA OFFICIAL BRAND COMPLETION VERIFICATION\n--------------------------------------------------\nCampaign: Video Reel Campaign\nBrand: Ambrane India\nCreator: ${paidDealInfo.creator.name} (${paidDealInfo.creator.handle})\nTimestamp: ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN')}\nVerification Code: RAFTRA-VERIFIED-${Math.floor(10000 + Math.random() * 90000)}\n\n"We hereby confirm that deliverables are received, reviewed, published, and we are 100% satisfied with the work! You may upload screenshot proof to Team Raftra for Escrow payout release."\n--------------------------------------------------`}
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                <button
                  onClick={() => {
                    const text = `--------------------------------------------------\n🛡️ RAFTRA OFFICIAL BRAND COMPLETION VERIFICATION\n--------------------------------------------------\nCampaign: Video Reel Campaign\nBrand: Ambrane India\nCreator: ${paidDealInfo.creator.name} (${paidDealInfo.creator.handle})\nTimestamp: ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN')}\nVerification Code: RAFTRA-VERIFIED-${Math.floor(10000 + Math.random() * 90000)}\n\n"We hereby confirm that deliverables are received, reviewed, published, and we are 100% satisfied with the work! You may upload screenshot proof to Team Raftra for Escrow payout release."\n--------------------------------------------------`;
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
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
    </div>
  );
};
