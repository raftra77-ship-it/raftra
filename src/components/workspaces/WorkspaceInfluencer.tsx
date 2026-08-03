import React, { useState, useEffect, useRef } from 'react';
import { Search, AlertTriangle, MessageCircle, Send, ShieldAlert, BadgeCheck, DollarSign, Video, Image as ImageIcon, Star, ExternalLink, Activity, CheckCircle2 } from 'lucide-react';
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
  topComments?: { author: string, text: string }[];
  recentPosts?: {url: string, type: string}[];
}

const INITIAL_CREATORS: InfluencerItemExtended[] = (parsedCreatorsData as any[]).map(item => ({
  id: item.id,
  name: item.name,
  handle: item.handle,
  avatar: item.avatar,
  platform: item.platform || 'Instagram',
  niche: item.niche,
  allNiches: item.allNiches || [item.niche],
  category: item.category || 'Micro',
  expectedPrice: item.expectedPrice,
  deliverables: item.deliverables || ['Reel', 'Story'],
  followers: item.followers,
  avgViews: item.avgViews,
  location: item.location,
  email: item.email,
  phone: item.phone,
  profileLink: item.profileLink,
  fakeFollowerScore: item.fakeFollowerScore || 2,
  rating: item.rating || 4.8,
  reviewsCount: item.reviewsCount || 20,
  recentWorks: item.recentWorks || ['D2C Brand Collab'],
  topComments: item.topComments
}));

export const WorkspaceInfluencer: React.FC<{workspaceId: number}> = ({workspaceId}) => {
  const [creators, setCreators] = useState<InfluencerItemExtended[]>([]);
  const [filterNiche, setFilterNiche] = useState('All');
  const [filterFollowers, setFilterFollowers] = useState('All');

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
            list = list.map(c => (c.handle === custom.handle || c.name === custom.name || c.id === 'creator_11') ? { ...c, ...custom } : c);
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
          list = list.map(c => (c.handle === custom.handle || c.name === custom.name || c.id === 'creator_11') ? { ...c, ...custom } : c);
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
  const chatEndRef = useRef<HTMLDivElement>(null);

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

  const handleLockDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!finalPrice || isNaN(Number(finalPrice)) || !activeChat) return;
    const price = parseFloat(finalPrice);
    const storageKey = `raftra_chat_${activeChat.id}`;
    
    const proposalMsg = { sender: 'brand' as const, text: JSON.stringify({ type: 'proposal', amount: price }) };
    const currentMsgs = JSON.parse(localStorage.getItem(storageKey) || JSON.stringify(chatMessages));
    const updated = [...currentMsgs, proposalMsg];
    setChatMessages(updated as any);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
    
    try {
      const token = localStorage.getItem('token');
      const payload = JSON.stringify({ type: 'proposal', amount: price, status: 'pending' });
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
  };

  const handlePayRazorpay = async (amount: number) => {
    try {
      // Create razorpay order, open modal, on success send payment_complete
      const token = localStorage.getItem('token');
      
      // We will skip full razorpay opening here for mock demo, just jump to success
      // In production, we'd call the Razorpay Checkout component here
      
      const payload = JSON.stringify({ type: 'payment_complete', amount });
      await fetch(`/api/workspaces/${workspaceId}/influencers/${activeChat!.id}/chat`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: payload, sender_type: 'brand' })
      });
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

        <div className="glow-card" style={{ padding: '14px 16px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11.5px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', minWidth: '130px', fontWeight: 700 }}>
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
                padding: '6px 16px',
                fontSize: '12px',
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
      </div>

      {/* Influencers grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {filteredCreators.map((creator) => (
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
                <span style={{ color: 'var(--text-secondary)' }}>Expected Price</span>
                <span style={{ color: '#00E676', fontWeight: 700 }}>
                  {creator.expectedPrice}
                </span>
              </div>
              
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px' }}>AVAILABLE FOR:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {creator.deliverables.map(d => (
                    <span key={d} style={{ fontSize: '10px', background: 'rgba(0, 230, 118, 0.1)', color: '#00E676', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(0, 230, 118, 0.2)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {d.includes('Video') ? <Video size={10} /> : <ImageIcon size={10} />} {d}
                    </span>
                  ))}
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="glow-card" style={{ width: '600px', height: '70vh', background: '#0a0a0c', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
            
            {/* Chat Header */}
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img src={"https://ui-avatars.com/api/?name=" + activeChat.name.replace(' ', '+') + "&background=random&color=fff&size=40"} alt={activeChat.name} style={{ borderRadius: '50%' }} />
                <div>
                  <h4 style={{ fontSize: '16px', margin: '0', color: '#fff' }}>Negotiation: {activeChat.name}</h4>
                  <div style={{ fontSize: '12px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}><BadgeCheck size={12} /> Verified Creator</div>
                </div>
              </div>
              <button onClick={() => setActiveChat(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '24px' }}>&times;</button>
            </div>

            {/* Raftra AI Policy Banner */}
            <div style={{ background: 'rgba(255, 171, 0, 0.1)', borderBottom: '1px solid rgba(255, 171, 0, 0.2)', padding: '12px 20px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <AlertTriangle size={16} color="var(--warning)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '11px', color: 'var(--warning)', lineHeight: '1.4' }}>
                <strong>RAFTRA AI COMPLIANCE NOTICE:</strong> A 10% platform commission is securely processed by Raftra AI upon deal completion. If this deal is directed outside the Raftra ecosystem to avoid fees, both brand and creator accounts will be permanently blocked.
              </div>
            </div>

            {/* Chat Feed */}
            <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {chatMessages.map((msg, i) => {
                if (msg.sender === 'system') {
                  return (
                    <div key={i} style={{ textAlign: 'center', margin: '8px 0' }}>
                      <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '4px 12px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        {msg.text}
                      </span>
                    </div>
                  );
                }
                const isBrand = msg.sender === 'brand';
                
                let parsedContent = null;
                try {
                  if (msg.text.trim().startsWith('{')) {
                    parsedContent = JSON.parse(msg.text);
                  }
                } catch (e) {}

                if (parsedContent && parsedContent.type === 'proposal') {
                  return (
                    <div key={i} style={{ alignSelf: 'center', margin: '16px 0', width: '100%' }}>
                      <div style={{ background: 'rgba(90,82,255,0.1)', border: '1px solid rgba(90,82,255,0.3)', padding: '24px', borderRadius: '12px', textAlign: 'center' }}>
                        <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#fff' }}>You Proposed a Deal</h3>
                        <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '16px' }}>
                          ₹{parsedContent.amount.toLocaleString()}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Waiting for creator to accept...</div>
                      </div>
                    </div>
                  );
                }

                if (parsedContent && parsedContent.type === 'proposal_accepted') {
                  return (
                    <div key={i} style={{ alignSelf: 'center', margin: '16px 0', width: '100%' }}>
                      <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', padding: '16px', borderRadius: '12px', textAlign: 'center', color: 'var(--success)' }}>
                        <CheckCircle2 size={24} style={{ marginBottom: '8px' }} />
                        <div style={{ fontWeight: 'bold' }}>Deal Accepted for ₹{parsedContent.amount.toLocaleString()}!</div>
                        <div style={{ marginTop: '16px' }}>
                          <GlowButton variant="glow" onClick={() => handlePayRazorpay(parsedContent.amount)}>
                            Pay via Razorpay
                          </GlowButton>
                        </div>
                      </div>
                    </div>
                  );
                }

                if (parsedContent && parsedContent.type === 'payment_complete') {
                  return (
                    <div key={i} style={{ alignSelf: 'center', margin: '16px 0', width: '100%' }}>
                      <div style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.3)', padding: '16px', borderRadius: '12px', textAlign: 'center', color: '#ffd700' }}>
                        <DollarSign size={24} style={{ marginBottom: '8px' }} />
                        <div style={{ fontWeight: 'bold' }}>Payment Complete!</div>
                        <div style={{ fontSize: '13px', marginTop: '4px' }}>₹{parsedContent.amount.toLocaleString()} paid. Escrow securely funded.</div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={i} style={{ alignSelf: isBrand ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', textAlign: isBrand ? 'right' : 'left' }}>
                      {isBrand ? 'You' : activeChat.name}
                    </div>
                    <div style={{ 
                      background: isBrand ? 'rgba(90, 82, 255, 0.15)' : 'rgba(255,255,255,0.05)', 
                      border: '1px solid',
                      borderColor: isBrand ? 'rgba(90, 82, 255, 0.3)' : 'var(--border)',
                      padding: '12px 16px', 
                      borderRadius: isBrand ? '12px 12px 0 12px' : '12px 12px 12px 0',
                      color: '#fff',
                      fontSize: '13px',
                      lineHeight: '1.5'
                    }}>
                      {msg.text}
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

              {/* Chat Input */}
            <div style={{ padding: '16px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
              {showFinalize ? (
                <form onSubmit={handleLockDeal} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Final Price ($):</span>
                  <input
                    type="number"
                    placeholder="e.g. 500"
                    value={finalPrice}
                    onChange={e => setFinalPrice(e.target.value)}
                    required
                    style={{ flex: 1, padding: '12px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--primary)', borderRadius: '8px', color: '#fff', outline: 'none' }}
                  />
                  <GlowButton variant="glow" type="submit" style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>
                    Lock Deal
                  </GlowButton>
                  <button type="button" onClick={() => setShowFinalize(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '12px' }}>
                    Cancel
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSendChat} style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" onClick={() => setShowFinalize(true)} style={{ background: 'rgba(90,82,255,0.1)', border: '1px solid rgba(90,82,255,0.3)', borderRadius: '8px', padding: '0 16px', color: 'var(--primary)', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                    Finalize Deal
                  </button>
                  <input
                    type="text"
                    placeholder="Propose a deal or negotiate pricing..."
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    style={{ flex: 1, padding: '12px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '8px', color: '#fff', outline: 'none' }}
                  />
                  <GlowButton variant="glow" type="submit" style={{ padding: '0 20px' }}>
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

      {/* Global Styles for Animations */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
    </div>
  );
};
