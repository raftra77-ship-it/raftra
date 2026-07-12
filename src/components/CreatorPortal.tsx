import React, { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, MessageCircle, DollarSign, Settings, Send, CheckCircle2, ShieldAlert } from 'lucide-react';
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
    recent_posts: [] as {url: string, type: string}[], 
    recent_collabs: [] as string[], 
    recent_reviews: [] as {author: string, text: string}[] 
  });
  
  const [verifyForm, setVerifyForm] = useState({ username: '', niche: '', base_rate: 0 });
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'unverified' | 'verified' | 'rejected'>('unverified');

  const [allBrands, setAllBrands] = useState<{id: number, name: string}[]>([]);
  const [showDiscover, setShowDiscover] = useState(false);

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

  useEffect(() => {
    if (activeTab === 'inbox' && myInfluencerId) {
      const token = localStorage.getItem('token');
      
      fetch(`/api/workspaces/influencer/me/chats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(res => res.json()).then(data => {
        if (Array.isArray(data)) {
          setChatMessages(data);
          if (data.length > 0 && chatWorkspaceId === 1) {
            setChatWorkspaceId(data[data.length - 1].workspace_id);
          }
        }
      }).catch(console.error);

      fetch(`/api/workspaces/discover`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(res => res.json()).then(data => {
        if (Array.isArray(data)) setAllBrands(data);
      }).catch(console.error);

      const ws = new WebSocket('ws://localhost:8005/ws');
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'chat_message' && Number(data.message.influencer_id) === myInfluencerId) {
            setChatMessages(prev => [...prev, data.message]);
            if (chatWorkspaceId === 1 && data.message.workspace_id) {
              setChatWorkspaceId(data.message.workspace_id);
            }
          }
        } catch (e) {}
      };
      wsRef.current = ws;

      return () => {
        if (wsRef.current) wsRef.current.close();
      };
    }
  }, [activeTab, myInfluencerId]);

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !myInfluencerId) return;
    const input = chatInput;
    setChatInput('');
    
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/workspaces/influencer/me/chats/${chatWorkspaceId}`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: input, sender_type: 'influencer' }) 
      });
    } catch(e) {
      console.error(e);
    }
  };

  const handleAcceptProposal = async (amount: number) => {
    try {
      const token = localStorage.getItem('token');
      const payload = JSON.stringify({ type: 'proposal_accepted', amount });
      await fetch(`/api/workspaces/influencer/me/chats/${chatWorkspaceId}`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: payload, sender_type: 'influencer' }) 
      });
    } catch(e) {
      console.error(e);
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
    const wid = msg.workspace_id;
    if (!acc[wid]) {
      acc[wid] = { name: msg.workspace_name || 'Brand', messages: [] };
    }
    acc[wid].messages.push(msg);
    return acc;
  }, {} as Record<number, { name: string, messages: any[] }>);
  
  const activeChats = Object.keys(groupedChats).map(k => ({ id: Number(k), ...groupedChats[Number(k)] }));
  const currentChatMessages = groupedChats[chatWorkspaceId]?.messages || [];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: '#fff', display: 'flex', fontFamily: 'var(--font-sans)' }}>
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
                  <DollarSign color="var(--success)" size={28}/> 1,250.00
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
                        {chat.messages[chat.messages.length - 1].content}
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
                      if (msg.sender_type === 'system') {
                        return (
                          <div key={i} style={{ textAlign: 'center', margin: '8px 0' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '4px 12px', borderRadius: '12px' }}>
                              {msg.content}
                            </span>
                          </div>
                        );
                      }
                      let parsedContent = null;
                      try {
                        if (msg.content.trim().startsWith('{')) {
                          parsedContent = JSON.parse(msg.content);
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

                      const isMe = msg.sender_type === 'influencer';
                      return (
                        <div key={i} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', textAlign: isMe ? 'right' : 'left' }}>
                            {isMe ? 'You' : (groupedChats[chatWorkspaceId]?.name || 'Brand')}
                          </div>
                          <div style={{ 
                            background: isMe ? 'rgba(90, 82, 255, 0.15)' : 'rgba(255,255,255,0.05)', 
                            border: '1px solid', borderColor: isMe ? 'rgba(90, 82, 255, 0.3)' : 'var(--border)',
                            padding: '12px 16px', 
                            borderRadius: isMe ? '12px 12px 0 12px' : '12px 12px 12px 0',
                            fontSize: '14px', lineHeight: 1.5
                          }}>
                            {msg.content}
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
              <div className="glow-card" style={{ padding: '32px', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Edit Portfolio Details</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
                  Your profile was generated by AI. You can manually adjust your recent posts, collaborations, and reviews below.
                </p>
                <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
    </div>
  );
};
