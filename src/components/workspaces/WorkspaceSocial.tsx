import React, { useState } from 'react';
import { Activity, Users, MessageCircle, Heart, Zap, Sparkles, UserCheck, ShieldCheck, CheckCircle2, Briefcase, TrendingUp, Search, Award, FileText } from 'lucide-react';
import { GlowButton } from '../GlowButton';

export interface SocialPostItem {
  id: string;
  platform: 'Instagram' | 'Facebook' | 'YouTube';
  caption: string;
  scheduledFor: string;
  status: 'draft' | 'scheduled' | 'published';
}

interface WorkspaceSocialProps {
  posts: SocialPostItem[];
  onOpenReview: (itemId: string) => void;
  onComposePost: (caption: string, platform: 'Instagram' | 'Facebook' | 'YouTube') => void;
}

export const WorkspaceSocial: React.FC<WorkspaceSocialProps> = () => {
  
  const [activeAgents, setActiveAgents] = useState<string[]>([]);
  
  // Hiring state
  const [hiringManager, setHiringManager] = useState<{id: string, name: string, basePrice: number} | null>(null);
  const [hirePrice, setHirePrice] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };
  
  // States for toggles inside profiles
  const [alexToggles, setAlexToggles] = useState({ planner: true, dm: false, funny: true });
  const [sarahToggles, setSarahToggles] = useState({ planner: true, leadDm: true, thoughtLeadership: false });
  const [maxToggles, setMaxToggles] = useState({ supportDm: true, faq: true, spam: true });

  const handleDeploy = (agentId: string) => {
    setActiveAgents(prev => prev.includes(agentId) ? prev.filter(a => a !== agentId) : [...prev, agentId]);
  };

  const isDeployed = (agentId: string) => activeAgents.includes(agentId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', paddingBottom: '40px' }}>
      
      <div>
        <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-heading)', marginBottom: '8px', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Briefcase size={24} color="var(--primary)" /> Social Media Manager Hub
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Hire experienced Indian Social Media Managers. Raftra AI supports both you and your manager with powerful workflow automations.
        </p>
      </div>

      {/* 1. TOP SECTION: Social Presence & Analytics */}
      <div>
        <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', marginBottom: '16px' }}>
          <Activity size={18} color="var(--success)" /> Brand Social Presence
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
          
          <div className="glow-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
              <Users size={16} /> <span style={{ fontSize: '12px' }}>Total Active Reach</span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff' }}>1.2M</div>
            <div style={{ fontSize: '11px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <TrendingUp size={12} /> +24% this week
            </div>
          </div>

          <div className="glow-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
              <MessageCircle size={16} /> <span style={{ fontSize: '12px' }}>Brand Mentions</span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff' }}>14,302</div>
            <div style={{ fontSize: '11px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <TrendingUp size={12} /> +102 organically
            </div>
          </div>

          <div className="glow-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
              <Heart size={16} /> <span style={{ fontSize: '12px' }}>Engagement Rate</span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff' }}>4.8%</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              vs 3.2% industry avg
            </div>
          </div>

          <div className="glow-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
              <Zap size={16} /> <span style={{ fontSize: '12px' }}>Audience Growth</span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff' }}>+12.4k</div>
            <div style={{ fontSize: '11px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <TrendingUp size={12} /> Driven by AI Automations
            </div>
          </div>

        </div>
      </div>

      <div style={{ height: '1px', background: 'var(--border)', margin: '10px 0' }} />

      {/* 2. BOTTOM SECTION: Hire Human Managers & Assign AI */}
      <div>
        <h3 style={{ fontSize: '18px', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', marginBottom: '20px' }}>
          <Users size={20} color="var(--primary)" /> Hire a Manager & Configure AI Support
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
          
          {/* PROFILE 1: Aarav Sharma */}
          <div className="glow-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', border: isDeployed('alex') ? '1px solid var(--primary)' : '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <img src="https://ui-avatars.com/api/?name=Aarav+Sharma&background=FF6B6B&color=fff&size=56" alt="Aarav" style={{ borderRadius: '50%' }} />
              <div>
                <h4 style={{ fontSize: '16px', color: '#fff', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>Aarav Sharma <CheckCircle2 size={12} color="var(--success)" /></h4>
                <div style={{ fontSize: '12px', color: 'var(--primary)' }}>Gen-Z & D2C Growth Expert</div>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <Award size={14} color="var(--accent)" /> <b>Experience:</b> 4 Years
              </div>
              <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <FileText size={14} color="var(--accent)" /> <b>Recent Works:</b> Nykaa, Boat, Flipkart
              </div>
            </div>
            
            <h5 style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={12} /> ENABLE RAFTRA AI SUPPORT:
            </h5>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '13px' }}>
                  <Search size={14} color="var(--primary)" /> Trend & Scraper Agent
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={alexToggles.planner} onChange={e => setAlexToggles(p => ({...p, planner: e.target.checked}))} disabled={isDeployed('alex')} />
                  <span className="slider"></span>
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '13px' }}>
                  <MessageCircle size={14} color="var(--primary)" /> Auto DM Responses
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={alexToggles.dm} onChange={e => setAlexToggles(p => ({...p, dm: e.target.checked}))} disabled={isDeployed('alex')} />
                  <span className="slider"></span>
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '13px' }}>
                  <Zap size={14} color="var(--primary)" /> Smart Commenting (Witty)
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={alexToggles.funny} onChange={e => setAlexToggles(p => ({...p, funny: e.target.checked}))} disabled={isDeployed('alex')} />
                  <span className="slider"></span>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', marginBottom: '8px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Monthly Retainer:</span>
              <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>₹28,000<span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/mo</span></span>
            </div>

            <GlowButton 
              variant="glow" 
              onClick={() => { if (!isDeployed('alex')) setHiringManager({id: 'alex', name: 'Aarav Sharma', basePrice: 28000}); }}
              style={{ marginTop: '16px', padding: '12px', width: '100%', background: isDeployed('alex') ? 'rgba(0,230,118,0.1)' : '', borderColor: isDeployed('alex') ? 'var(--success)' : '', color: isDeployed('alex') ? 'var(--success)' : '' }}
            >
              {isDeployed('alex') ? <><CheckCircle2 size={16} style={{marginRight: '8px'}} /> Hire Request Sent</> : 'Send Hire Request & Enable AI'}
            </GlowButton>
          </div>

          {/* PROFILE 2: Priya Verma */}
          <div className="glow-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', border: isDeployed('sarah') ? '1px solid var(--primary)' : '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <img src="https://ui-avatars.com/api/?name=Priya+Verma&background=4facfe&color=fff&size=56" alt="Priya" style={{ borderRadius: '50%' }} />
              <div>
                <h4 style={{ fontSize: '16px', color: '#fff', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>Priya Verma <CheckCircle2 size={12} color="var(--success)" /></h4>
                <div style={{ fontSize: '12px', color: 'var(--primary)' }}>Brand & Growth Strategist</div>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <Award size={14} color="var(--accent)" /> <b>Experience:</b> 7 Years
              </div>
              <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <FileText size={14} color="var(--accent)" /> <b>Recent Works:</b> Zomato, Swiggy, Razorpay
              </div>
            </div>
            
            <h5 style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={12} /> ENABLE RAFTRA AI SUPPORT:
            </h5>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '13px' }}>
                  <Search size={14} color="var(--primary)" /> Brand Knowledge Scraper
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={sarahToggles.planner} onChange={e => setSarahToggles(p => ({...p, planner: e.target.checked}))} disabled={isDeployed('sarah')} />
                  <span className="slider"></span>
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '13px' }}>
                  <UserCheck size={14} color="var(--primary)" /> Lead Gen Auto DMs
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={sarahToggles.leadDm} onChange={e => setSarahToggles(p => ({...p, leadDm: e.target.checked}))} disabled={isDeployed('sarah')} />
                  <span className="slider"></span>
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '13px' }}>
                  <Briefcase size={14} color="var(--primary)" /> Professional Commenting
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={sarahToggles.thoughtLeadership} onChange={e => setSarahToggles(p => ({...p, thoughtLeadership: e.target.checked}))} disabled={isDeployed('sarah')} />
                  <span className="slider"></span>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', marginBottom: '8px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Monthly Retainer:</span>
              <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>₹75,000<span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/mo</span></span>
            </div>

            <GlowButton 
              variant="glow" 
              onClick={() => { if (!isDeployed('sarah')) setHiringManager({id: 'sarah', name: 'Priya Verma', basePrice: 75000}); }}
              style={{ marginTop: '16px', padding: '12px', width: '100%', background: isDeployed('sarah') ? 'rgba(0,230,118,0.1)' : '', borderColor: isDeployed('sarah') ? 'var(--success)' : '', color: isDeployed('sarah') ? 'var(--success)' : '' }}
            >
              {isDeployed('sarah') ? <><CheckCircle2 size={16} style={{marginRight: '8px'}} /> Hire Request Sent</> : 'Send Hire Request & Enable AI'}
            </GlowButton>
          </div>

          {/* PROFILE 3: Rohan Malhotra */}
          <div className="glow-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', border: isDeployed('max') ? '1px solid var(--primary)' : '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <img src="https://ui-avatars.com/api/?name=Rohan+Malhotra&background=43e97b&color=111&size=56" alt="Rohan" style={{ borderRadius: '50%' }} />
              <div>
                <h4 style={{ fontSize: '16px', color: '#fff', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>Rohan Malhotra <CheckCircle2 size={12} color="var(--success)" /></h4>
                <div style={{ fontSize: '12px', color: 'var(--primary)' }}>Community & Social Manager</div>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <Award size={14} color="var(--accent)" /> <b>Experience:</b> 3 Years
              </div>
              <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <FileText size={14} color="var(--accent)" /> <b>Recent Works:</b> Cred, Meesho, PhonePe
              </div>
            </div>
            
            <h5 style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={12} /> ENABLE RAFTRA AI SUPPORT:
            </h5>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '13px' }}>
                  <MessageCircle size={14} color="var(--primary)" /> Support Auto DMs
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={maxToggles.supportDm} onChange={e => setMaxToggles(p => ({...p, supportDm: e.target.checked}))} disabled={isDeployed('max')} />
                  <span className="slider"></span>
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '13px' }}>
                  <Zap size={14} color="var(--primary)" /> FAQ Commenting
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={maxToggles.faq} onChange={e => setMaxToggles(p => ({...p, faq: e.target.checked}))} disabled={isDeployed('max')} />
                  <span className="slider"></span>
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '13px' }}>
                  <ShieldCheck size={14} color="var(--primary)" /> Auto-Spam Deletion
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={maxToggles.spam} onChange={e => setMaxToggles(p => ({...p, spam: e.target.checked}))} disabled={isDeployed('max')} />
                  <span className="slider"></span>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', marginBottom: '8px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Monthly Retainer:</span>
              <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>₹45,000<span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/mo</span></span>
            </div>

            <GlowButton 
              variant="glow" 
              onClick={() => { if (!isDeployed('max')) setHiringManager({id: 'max', name: 'Rohan Malhotra', basePrice: 45000}); }}
              style={{ marginTop: '16px', padding: '12px', width: '100%', background: isDeployed('max') ? 'rgba(0,230,118,0.1)' : '', borderColor: isDeployed('max') ? 'var(--success)' : '', color: isDeployed('max') ? 'var(--success)' : '' }}
            >
              {isDeployed('max') ? <><CheckCircle2 size={16} style={{marginRight: '8px'}} /> Hire Request Sent</> : 'Send Hire Request & Enable AI'}
            </GlowButton>
          </div>

        </div>
      </div>

      {/* Hiring Deal Finalization Modal */}
      {hiringManager && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="glow-card" style={{ width: '450px', background: '#0a0a0c', padding: '30px', position: 'relative' }}>
            <button onClick={() => {setHiringManager(null); setHirePrice('');}} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '24px' }}>&times;</button>
            
            <h3 style={{ fontSize: '20px', margin: '0 0 16px 0', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Hire {hiringManager.name}
            </h3>
            
            <div style={{ background: 'rgba(255, 171, 0, 0.1)', border: '1px solid rgba(255, 171, 0, 0.2)', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '12px', color: 'var(--warning)', lineHeight: '1.4' }}>
              <strong>RAFTRA AI COMPLIANCE:</strong> All manager hires are securely processed through Raftra AI. A standard 10% platform commission applies to the final negotiated retainer.
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Final Negotiated Monthly Retainer (₹)</label>
              <input
                type="number"
                placeholder={`e.g. ${hiringManager.basePrice}`}
                value={hirePrice}
                onChange={e => setHirePrice(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', padding: '12px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--primary)', borderRadius: '8px', color: '#fff', outline: 'none', fontSize: '16px' }}
              />
            </div>

            {hirePrice && !isNaN(Number(hirePrice)) && (
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Retainer</span>
                  <span style={{ color: '#fff' }}>₹{parseFloat(hirePrice).toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Raftra AI Fee (10%)</span>
                  <span style={{ color: 'var(--primary)' }}>₹{(parseFloat(hirePrice) * 0.1).toLocaleString('en-IN')}</span>
                </div>
              </div>
            )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border)', fontSize: '14px', fontWeight: 600 }}>
                  <span style={{ color: '#fff' }}>Manager Payout (90%)</span>
                  <span style={{ color: 'var(--success)' }}>${(parseFloat(hirePrice) * 0.9).toFixed(2)}</span>
                </div>
              </div>
            )}

            <GlowButton 
              variant="glow" 
              onClick={() => {
                if (!hirePrice || isNaN(Number(hirePrice))) return;
                showToast(`SUCCESS! Deal Locked.\n$${(parseFloat(hirePrice) * 0.1).toFixed(2)} credited to Raftra AI.\n$${(parseFloat(hirePrice) * 0.9).toFixed(2)} escrowed for ${hiringManager.name}.\nNotification sent.`);
                handleDeploy(hiringManager.id);
                setHiringManager(null);
                setHirePrice('');
              }} 
              style={{ width: '100%', padding: '14px' }}
            >
              Lock Deal & Send Notification
            </GlowButton>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div style={{ position: 'fixed', bottom: '40px', right: '40px', background: 'var(--success)', color: '#000', padding: '16px 24px', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,230,118,0.3)', zIndex: 200, display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 600, maxWidth: '400px', lineHeight: '1.5', whiteSpace: 'pre-line' }}>
          <CheckCircle2 size={24} />
          {toastMessage}
        </div>
      )}

      {/* Toggle Switch CSS */}
      <style dangerouslySetInnerHTML={{__html: `
        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 36px;
          height: 20px;
        }
        .toggle-switch input { 
          opacity: 0;
          width: 0;
          height: 0;
        }
        .slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: var(--border);
          transition: .2s;
          border-radius: 34px;
        }
        .slider:before {
          position: absolute;
          content: "";
          height: 14px;
          width: 14px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: .2s;
          border-radius: 50%;
        }
        input:checked + .slider {
          background-color: var(--primary);
        }
        input:checked + .slider:before {
          transform: translateX(16px);
        }
        input:disabled + .slider {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}} />
    </div>
  );
};
