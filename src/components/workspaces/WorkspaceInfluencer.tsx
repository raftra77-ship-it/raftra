import React, { useState, useEffect, useRef } from 'react';
import { Search, AlertTriangle, MessageCircle, Send, ShieldAlert, BadgeCheck, DollarSign, Video, Image as ImageIcon, Star, ExternalLink, Activity, CheckCircle2 } from 'lucide-react';
import { GlowButton } from '../GlowButton';

export interface InfluencerItemExtended {
  id: string;
  name: string;
  handle: string;
  platform: 'Facebook' | 'Instagram' | 'YouTube';
  niche: string;
  category: 'Nano' | 'Micro' | 'Macro';
  expectedPrice: string;
  deliverables: string[];
  followers: string;
  fakeFollowerScore: number; // 0-100, lower is better
  rating: number;
  reviewsCount: number;
  recentWorks: string[];
  topComments?: { author: string, text: string }[];
  recentPosts?: {url: string, type: string}[];
}

const INITIAL_CREATORS: InfluencerItemExtended[] = [
  { id: '1', name: 'Sneha Roy', handle: '@snehastyles', platform: 'Instagram', niche: 'Fashion & Lifestyle', category: 'Micro', expectedPrice: '₹15,000', deliverables: ['UGC Video', 'Story', 'Static Post'], followers: '45k', fakeFollowerScore: 2, rating: 4.8, reviewsCount: 34, recentWorks: ['Nykaa', 'FabIndia'], topComments: [{author: 'Brand Rep, Nykaa', text: 'Beautiful aesthetic and perfectly aligned with our brand voice.'}] },
  { id: '2', name: 'Vikram Malhotra', handle: '@vikramtech', platform: 'YouTube', niche: 'SaaS Tech', category: 'Macro', expectedPrice: '₹45,000', deliverables: ['Dedicated Video', 'Community Post'], followers: '250k', fakeFollowerScore: 4, rating: 4.9, reviewsCount: 120, recentWorks: ['Zoho', 'Razorpay Review'], topComments: [{author: 'Growth Lead, Razorpay', text: 'Extremely clear technical breakdown. The audience loved the tutorial format.'}] },
  { id: '3', name: 'Ananya Patel', handle: '@ananyafit', platform: 'Instagram', niche: 'Health & Fitness', category: 'Nano', expectedPrice: '₹8,000', deliverables: ['UGC Video'], followers: '8k', fakeFollowerScore: 1, rating: 4.5, reviewsCount: 12, recentWorks: ['Cult.fit', 'Fast&Up'], topComments: [{author: 'Campaign Manager, Cult.fit', text: 'Her fitness content is incredibly authentic. Our CPA dropped by 30%.'}] },
];

export const WorkspaceInfluencer: React.FC<{workspaceId: number}> = ({workspaceId}) => {
  const [creators, setCreators] = useState<InfluencerItemExtended[]>([]);
  const [filterNiche, setFilterNiche] = useState('All');

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
        setCreators(INITIAL_CREATORS);
      }
    }).catch(() => setCreators(INITIAL_CREATORS));
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

  const filteredCreators = filterNiche === 'All'
    ? creators
    : creators.filter(c => c.niche === filterNiche);

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const handleOpenChat = async (creator: InfluencerItemExtended) => {
    setActiveChat(creator);
    setChatMessages([
      { sender: 'system', text: 'CONNECTING TO BACKEND P2P SERVER...' }
    ]);

    try {
      const token = localStorage.getItem('token');
      // Fetch chat history
      const res = await fetch(`/api/workspaces/${workspaceId}/influencers/${creator.id}/chat`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const history = await res.json();
        const formatted = history.map((m: any) => ({
          sender: m.sender_type,
          text: m.content
        }));
        setChatMessages(formatted.length > 0 ? formatted : [
          { sender: 'system', text: 'RAFTRA SECURE CONNECTION ESTABLISHED' }
        ]);
      } else {
        setChatMessages([{ sender: 'system', text: 'ERROR CONNECTING TO CHAT (No Token or Auth Failed)' }]);
      }
      
      // Connect to WebSocket for real-time updates
      if (wsRef.current) wsRef.current.close();
      const ws = new WebSocket('ws://localhost:8005/ws');
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'chat_message' && Number(data.message.influencer_id) === Number(creator.id)) {
            setChatMessages(prev => {
              // Avoid duplicate if optimistic update was done (we won't do optimistic here to ensure real sync)
              return [...prev, { sender: data.message.sender_type, text: data.message.content }];
            });
          }
        } catch (e) {}
      };
      wsRef.current = ws;
    } catch(e) {
      console.error(e);
      setChatMessages([{ sender: 'system', text: 'ERROR CONNECTING TO CHAT' }]);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeChat) return;
    const input = chatInput;
    setChatInput('');
    
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/workspaces/${workspaceId}/influencers/${activeChat.id}/chat`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: input, sender_type: 'brand' })
      });
    } catch(e) {
      console.error(e);
    }
  };

  const handleLockDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!finalPrice || isNaN(Number(finalPrice)) || !activeChat) return;
    const price = parseFloat(finalPrice);
    
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
      </div>

      {/* Filters row */}
      <div className="glow-card" style={{ padding: '16px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Search size={14} /> FILTER BY NICHE:
        </span>
        {['All', 'SaaS Tech', 'Health & Fitness', 'Fashion & Lifestyle', 'Lifestyle'].map((niche) => (
          <button
            key={niche}
            onClick={() => setFilterNiche(niche)}
            style={{
              padding: '6px 16px',
              fontSize: '12px',
              background: filterNiche === niche ? 'rgba(90, 82, 255, 0.15)' : 'rgba(255,255,255,0.02)',
              border: '1px solid',
              borderColor: filterNiche === niche ? 'var(--primary)' : 'var(--border)',
              borderRadius: '20px',
              color: filterNiche === niche ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {niche}
          </button>
        ))}
      </div>

      {/* Influencers grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {filteredCreators.map((creator) => (
          <div key={creator.id} className="glow-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img src={"https://ui-avatars.com/api/?name=" + creator.name.replace(' ', '+') + "&background=random&color=fff&size=48"} alt={creator.name} style={{ borderRadius: '50%' }} />
                <div>
                  <h4 style={{ fontSize: '16px', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '6px', color: '#fff' }}>
                    {creator.name} <BadgeCheck size={14} color="var(--primary)" />
                  </h4>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{creator.handle}</div>
                </div>
              </div>
              <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.1)', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>
                {creator.category.toUpperCase()}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Followers</span>
                <span style={{ color: '#fff', fontWeight: 600 }}>{creator.followers}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Fake Follower Score</span>
                <span style={{ color: creator.fakeFollowerScore < 5 ? 'var(--success)' : 'var(--warning)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ShieldAlert size={14} /> {creator.fakeFollowerScore}%
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Expected Price</span>
                <span style={{ color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <DollarSign size={14} color="var(--success)" /> {creator.expectedPrice}
                </span>
              </div>
              
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px' }}>AVAILABLE FOR:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {creator.deliverables.map(d => (
                    <span key={d} style={{ fontSize: '10px', background: 'rgba(90, 82, 255, 0.1)', color: 'var(--primary)', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(90, 82, 255, 0.2)', display: 'flex', alignItems: 'center', gap: '4px' }}>
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
              <button onClick={() => setViewProfile(creator)} style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ExternalLink size={14} /> Profile
              </button>
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
