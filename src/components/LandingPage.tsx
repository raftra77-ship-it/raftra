import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  AlertTriangle,
  Cpu,
  BarChart3,
  Globe,
  Sparkles,
  ArrowLeft,
  Users2,
  Share2,
  Megaphone,
  UserPlus,
  ShieldAlert,
  CheckCircle2,
  UserMinus,
  Rocket,
  Lightbulb,
  Zap,
  AlertCircle,
  TrendingDown
} from 'lucide-react';
import { GlowButton } from './GlowButton';
import { motion } from 'framer-motion';
import { PricingScreen } from './PricingScreen';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

interface LandingPageProps {
  onStartFree: () => void;
  onBookDemo: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStartFree, onBookDemo }) => {
  const [currentSubView, setCurrentSubView] = useState<'main' | 'pricing'>('main');
  const navigate = useNavigate();
  
  // Creator Portal State
  const [showCreatorPortal, setShowCreatorPortal] = useState(false);
  const [creatorPortalState, setCreatorPortalState] = useState<'form' | 'scanning' | 'success' | 'removing' | 'removed' | 'error'>('form');
  const [creatorForm, setCreatorForm] = useState({ handle: '', niche: '', price: '', email: '', password: '' });

  const handleCreatorSubmit = async (e: React.FormEvent, action: 'add' | 'remove') => {
    e.preventDefault();
    if (!creatorForm.handle || (action === 'add' && (!creatorForm.email || !creatorForm.password))) return;
    
    if (action === 'add') {
      setCreatorPortalState('scanning');
      try {
        let authData;
        const regRes = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: creatorForm.email,
            username: creatorForm.handle,
            password: creatorForm.password,
            first_name: creatorForm.handle,
            last_name: '',
            role: 'creator'
          })
        });
        
        if (!regRes.ok) {
           // Fallback to login if already registered
           const loginRes = await fetch('/api/auth/login', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ identifier: creatorForm.email, password: creatorForm.password })
           });
           if (!loginRes.ok) {
             setCreatorPortalState('error');
             return;
           }
           authData = await loginRes.json();
        } else {
           authData = await regRes.json();
        }
        
        const verifyRes = await fetch('/api/workspaces/influencer/me/verify', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authData.access_token}`
          },
          body: JSON.stringify({
            username: creatorForm.handle,
            niche: creatorForm.niche,
            base_rate: parseFloat(creatorForm.price) || 0
          })
        });

        const data = await verifyRes.json();
        if (data.status === 'success' && data.data.verification_status === 'verified') {
           localStorage.setItem('token', authData.access_token);
           setCreatorPortalState('success');
           setTimeout(() => {
             setShowCreatorPortal(false);
             setCreatorPortalState('form');
             navigate('/creator-dashboard');
           }, 2000);
        } else {
           setCreatorPortalState('error');
        }
      } catch (err) {
        setCreatorPortalState('error');
      }
    } else {
      setCreatorPortalState('removing');
      setTimeout(() => {
        setCreatorPortalState('removed');
      }, 1500);
    }
  };

  // Dynamic simulation engine states
  const [activeSimTab, setActiveSimTab] = useState<'creative' | 'campaigns' | 'seo'>('creative');
  const [simulationState, setSimulationState] = useState<'pending' | 'deployed' | 'loading'>('pending');
  const [roasVal, setRoasVal] = useState('3.8x');
  const [citationsVal, setCitationsVal] = useState('54%');
  const [logText, setLogText] = useState('[Copywriting Agent] Ad Concept A generated matching brand tone coordinates.');
  const [adCopyHeadline, setAdCopyHeadline] = useState('"Consolidate 20 marketing tools into one."');

  const triggerDeployAction = () => {
    if (simulationState === 'deployed') return;
    setSimulationState('loading');
    setLogText('[System] Injecting credentials & compiling ad parameters to sandbox adsets...');
    
    setTimeout(() => {
      setSimulationState('deployed');
      setRoasVal('4.9x');
      setCitationsVal('78%');
      setLogText('[Optimization Agent] Copy approved. Budget limit rebalanced to Facebook Adset 2.');
    }, 1500);
  };

  const resetSimulationState = (tab: 'creative' | 'campaigns' | 'seo') => {
    setActiveSimTab(tab);
    setSimulationState('pending');
    
    if (tab === 'creative') {
      setRoasVal('3.8x');
      setCitationsVal('54%');
      setAdCopyHeadline('"Consolidate 20 marketing tools into one."');
      setLogText('[Copywriting Agent] Ad Concept A generated matching brand tone coordinates.');
    } else if (tab === 'campaigns') {
      setRoasVal('4.1x');
      setCitationsVal('62%');
      setAdCopyHeadline('"Target CPA rebalanced: meta-ads-1 sandbox active."');
      setLogText('[Budget Planner] Analyzed performance limits. Ready for sandbox optimization deploy.');
    } else if (tab === 'seo') {
      setRoasVal('4.3x');
      setCitationsVal('68%');
      setAdCopyHeadline('"Why Traditional SEO is Dead in the Age of Answer Engines."');
      setLogText('[GEO Specialist] Ingested blog draft guidelines. Awaiting schema verification.');
    }
  };

  // Scroll handler for landing navigation
  const scrollToSection = (id: string) => {
    setCurrentSubView('main');
    setTimeout(() => {
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  if (currentSubView === 'pricing') {
    return (
      <div className="app-wrapper">
        <Navbar />

        <div style={{ marginTop: '100px' }}>
          <PricingScreen onComplete={onStartFree} />
        </div>
      </div>
    );
  }

  return (
    <div className="app-wrapper">
      <Navbar onOpenCreatorPortal={() => setShowCreatorPortal(true)} />

      {/* Hero Section */}
      <section className="hero-section">
        <motion.div
          className="hero-pill"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="hero-pill-badge">NEW</span>
          <span>Growth Operating System for Premium Brands</span>
        </motion.div>

        <motion.h1
          className="hero-title text-gradient-glow"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          Your Entire Growth Team. <br />Powered by AI.
        </motion.h1>

        <motion.p
          className="hero-subtitle"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Create better ads. Launch campaigns everywhere. Rank on Google and AI search. Understand every metric. Manage social media. Find the perfect influencers. All from one AI Growth Operating System.
        </motion.p>

        <motion.div
          className="hero-actions"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <GlowButton variant="glow" onClick={onStartFree} icon={<ArrowRight size={16} />}>
            Start Free
          </GlowButton>
          <GlowButton variant="secondary" onClick={() => scrollToSection('problem')}>
            Explore Platform
          </GlowButton>
        </motion.div>



        {/* FREE AI AUDIT SEARCH ENGINE SANDBOX (No Signup / No Login Demo) */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          style={{
            maxWidth: '900px',
            width: '100%',
            margin: '32px auto 48px auto',
            background: 'linear-gradient(180deg, rgba(25, 25, 38, 0.9), rgba(12, 12, 18, 0.95))',
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
            padding: '24px',
            textAlign: 'left'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} color="var(--primary)" />
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>Free AI Growth & SEO Audit Sandbox</span>
              <span style={{ fontSize: '11px', color: 'var(--success)', background: 'rgba(0,230,118,0.1)', padding: '2px 8px', borderRadius: '100px', border: '1px solid rgba(0,230,118,0.3)', fontWeight: 600 }}>NO SIGNUP NEEDED</span>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Try instant audit for any domain</span>
          </div>

          <FreeAuditSandboxEngine onStartFree={onStartFree} />
        </motion.div>

        {/* Animated Dashboard Live Demo Mockup */}
        <motion.div
          className="terminal-preview-container"
          style={{ maxWidth: '1100px', display: 'flex', flexDirection: 'column', width: '100%' }}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 100, delay: 0.4 }}
        >
          {/* Top Window Bar */}
          <div className="terminal-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <div className="terminal-dots">
              <div className="terminal-dot red" />
              <div className="terminal-dot yellow" />
              <div className="terminal-dot green" />
            </div>
            <div className="terminal-title" style={{ color: 'var(--text-secondary)' }}>
              <span>Raftra Engine - Unified Growth Control Panel (Simulation)</span>
            </div>
            <div style={{ width: '40px' }} />
          </div>

          {/* Inner Dashboard View Layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', background: '#09090b', height: '420px', fontSize: '13px' }}>
            {/* Sidebar Mockup */}
            <div style={{ borderRight: '1px solid rgba(255, 255, 255, 0.05)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', background: '#070709', textAlign: 'left' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.05em' }}>RAFTRA CORE</div>
              <div
                onClick={() => resetSimulationState('creative')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: activeSimTab === 'creative' ? '#fff' : 'var(--text-secondary)',
                  background: activeSimTab === 'creative' ? 'rgba(90, 82, 255, 0.08)' : 'transparent',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontWeight: activeSimTab === 'creative' ? 500 : 400,
                  cursor: 'pointer'
                }}
              >
                <Sparkles size={14} style={{ color: activeSimTab === 'creative' ? 'var(--accent)' : 'inherit' }} />
                <span>Creative Studio</span>
              </div>
              <div
                onClick={() => resetSimulationState('campaigns')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: activeSimTab === 'campaigns' ? '#fff' : 'var(--text-secondary)',
                  background: activeSimTab === 'campaigns' ? 'rgba(90, 82, 255, 0.08)' : 'transparent',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontWeight: activeSimTab === 'campaigns' ? 500 : 400,
                  cursor: 'pointer'
                }}
              >
                <Megaphone size={14} style={{ color: activeSimTab === 'campaigns' ? 'var(--accent)' : 'inherit' }} />
                <span>Campaigns</span>
              </div>
              <div
                onClick={() => resetSimulationState('seo')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: activeSimTab === 'seo' ? '#fff' : 'var(--text-secondary)',
                  background: activeSimTab === 'seo' ? 'rgba(90, 82, 255, 0.08)' : 'transparent',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontWeight: activeSimTab === 'seo' ? 500 : 400,
                  cursor: 'pointer'
                }}
              >
                <Globe size={14} style={{ color: activeSimTab === 'seo' ? 'var(--accent)' : 'inherit' }} />
                <span>SEO + GEO</span>
              </div>

              {/* Live Status indicator */}
              <div style={{ marginTop: 'auto', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--success)' }}>
                  <span className="badge-pulse success" style={{ width: '6px', height: '6px' }} />
                  <span>Interactive Simulator</span>
                </div>
              </div>
            </div>

            {/* Main Area Mockup */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'hidden', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: 600, color: '#fff' }}>
                    {activeSimTab === 'creative' && 'Creative Generation Sandbox'}
                    {activeSimTab === 'campaigns' && 'Campaign Bidding & Autopilot Logs'}
                    {activeSimTab === 'seo' && 'Search citation indices audit'}
                  </h4>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {activeSimTab === 'creative' && 'Generates high CTR copies matching target coordinates'}
                    {activeSimTab === 'campaigns' && 'Auto-redistributes budget to high-performing ad sets'}
                    {activeSimTab === 'seo' && 'Analyzes brand citation density index across LLM datasets'}
                  </p>
                </div>
                <div style={{ fontSize: '11px', background: 'rgba(0, 255, 157, 0.08)', border: '1px solid rgba(0,255,157,0.2)', color: 'var(--success)', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>
                  Active Simulator Node
                </div>
              </div>

              {/* Metric Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <div style={{ background: '#121217', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>BUDGET NODE</span>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginTop: '4px' }}>Active Sandbox</div>
                </div>
                <div style={{ background: '#121217', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>SIMULATED ROAS</span>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--success)', marginTop: '4px' }}>{roasVal}</div>
                </div>
                <div style={{ background: '#121217', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>AEO INDEX CITATIONS</span>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent)', marginTop: '4px' }}>{citationsVal}</div>
                </div>
              </div>

              {/* Dynamic Generation card simulation */}
              <div className="glow-card" style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ background: 'var(--accent-glow)', border: '1px solid var(--accent)', color: '#fff', borderRadius: '6px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <h5 style={{ color: '#fff', fontSize: '13px', fontWeight: 600 }}>
                      {simulationState === 'loading' ? 'Pushing variables schema...' : 'Auto-Generated Output Recommendation:'}
                    </h5>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '2px' }}>
                      {adCopyHeadline}
                    </p>
                  </div>
                </div>
                <button
                  onClick={triggerDeployAction}
                  disabled={simulationState !== 'pending'}
                  className="btn btn-primary"
                  style={{
                    padding: '8px 16px',
                    fontSize: '11px',
                    background: simulationState === 'deployed' ? 'var(--success-glow)' : 'var(--accent)',
                    borderColor: simulationState === 'deployed' ? 'var(--success)' : 'var(--accent)',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: simulationState === 'pending' ? 'pointer' : 'default',
                    opacity: simulationState === 'loading' ? 0.6 : 1
                  }}
                >
                  {simulationState === 'pending' && 'Approve & Deploy'}
                  {simulationState === 'loading' && 'Deploying...'}
                  {simulationState === 'deployed' && '✓ Deployed to Sandbox'}
                </button>
              </div>

              {/* Live console status line at bottom */}
              <div style={{ background: '#000', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '8px 12px', display: 'flex', gap: '8px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: 'var(--text-muted)' }}>&gt;</span>
                <span style={{ color: simulationState === 'deployed' ? 'var(--success)' : '#ffffff' }}>
                  {logText}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Problem Section (Bento Grid Redesign) */}
      <section id="problem" className="section-container" style={{ scrollMarginTop: '100px' }}>
        <span className="section-tag">THE PROBLEM</span>
        <h2 className="section-title">Fragmented Tools Are Killing Your Growth</h2>
        <p className="section-desc">Managing separate tools for ads, SEO, social media, and analytics wastes thousands of dollars and breaks your brand consistency.</p>

        <div className="bento-grid" style={{ marginTop: '40px' }}>
          {/* Bento Hero Problem Card (Span 7) */}
          <div className="bento-card-hero bento-col-7" style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--danger)', background: 'rgba(255,71,87,0.12)', padding: '6px 14px', borderRadius: '100px', border: '1px solid rgba(255,71,87,0.3)' }}>
                  CRITICAL BOTTLENECK
                </span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#ff6b6b' }}>-$24,000 / yr Wasted</span>
              </div>
              <h3 style={{ fontSize: '24px', color: '#fff', marginBottom: '14px', lineHeight: 1.3 }}>
                The $2,000/mo Fragmented Marketing Tool Trap
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
                Brands spend over $2,000 every month juggling 6 separate single-purpose platforms: one for static graphic design, another for ad campaign deployment, a third for SEO monitoring, plus separate tools for influencer outreach and social scheduling. Data never syncs, and context gets lost in transition.
              </p>
            </div>

            <div style={{ marginTop: '24px', padding: '16px 20px', background: 'rgba(0,0,0,4)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertTriangle size={18} color="var(--danger)" />
                <span style={{ fontSize: '13px', color: '#fff', fontWeight: 600 }}>Fragmented Stack Cost: 6 Apps ($2,150/mo)</span>
              </div>
              <span style={{ fontSize: '12px', color: '#00E676', fontWeight: 700 }}>Raftra Growth OS: 1 Workspace ($0/mo sandbox)</span>
            </div>
          </div>

          {/* Side Bento Column (Span 5 - 3 Compact Bento Pills) */}
          <div className="bento-col-5" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="bento-pill" style={{ textAlign: 'left' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,71,87,0.12)', border: '1px solid rgba(255,71,87,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <TrendingDown size={20} color="var(--danger)" />
              </div>
              <div>
                <h4 style={{ fontSize: '14px', color: '#fff', marginBottom: '3px' }}>Rising Ad CPA & Wasted Spend</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>Ad fatigue kills ROAS when static creatives aren't dynamically generated or auto-paused.</p>
              </div>
            </div>

            <div className="bento-pill" style={{ textAlign: 'left' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(0,255,157,0.12)', border: '1px solid rgba(0,255,157,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Globe size={20} color="var(--success)" />
              </div>
              <div>
                <h4 style={{ fontSize: '14px', color: '#fff', marginBottom: '3px' }}>Ignored AI Search Visibility</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>If ChatGPT, Claude & Perplexity lack JSON-LD entity schema, your brand is invisible to AI search.</p>
              </div>
            </div>

            <div className="bento-pill" style={{ textAlign: 'left' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,174,0,0.12)', border: '1px solid rgba(255,174,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <BarChart3 size={20} color="var(--warning)" />
              </div>
              <div>
                <h4 style={{ fontSize: '14px', color: '#fff', marginBottom: '3px' }}>Overwhelming Static Dashboards</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>Raw graphs without actionable AI insights leave marketing managers guessing next steps.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section (Asymmetric Bento Grid Redesign) */}
      <section id="solution" className="section-container" style={{ scrollMarginTop: '100px' }}>
        <span className="section-tag">THE SOLUTIONS</span>
        <h2 className="section-title">Meet Raftra AI. The Unified Growth Suite.</h2>
        <p className="section-desc">Six specialized AI workspaces operating as a coordinated growth network to replace your entire marketing stack.</p>

        <div className="bento-grid" style={{ marginTop: '40px' }}>
          {/* Bento Hero Showcase Card (Span 8) */}
          <div className="bento-card-hero bento-col-8" onClick={() => navigate('/features/creative')} style={{ cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="solution-icon-wrapper" style={{ margin: 0 }}>
                  <Sparkles size={20} />
                </div>
                <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.08em' }}>FLAGSHIP WORKSPACE</span>
              </div>
              <span style={{ fontSize: '12px', color: '#00E676', background: 'rgba(0,230,118,0.12)', padding: '4px 12px', borderRadius: '100px', fontWeight: 700 }}>
                Explore Studio & Campaigns →
              </span>
            </div>
            <h3 style={{ fontSize: '26px', color: '#fff', marginBottom: '10px' }}>
              AI Creative Studio & Campaign Manager
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14.5px', marginBottom: '24px', maxWidth: '650px' }}>
              Instantly generate high-converting Carousel Ads, AI UGC video clips, and ad copy. Automatically launch campaigns across Meta & Google Ads with budget redistribution safety.
            </p>

            {/* Interactive Showcase Pill Bar inside Bento Hero */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', background: 'rgba(0,0,0,0.4)', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#fff', fontWeight: 600 }}>
                <Zap size={14} color="#00E676" /> Carousel Ads Generator
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#fff', fontWeight: 600 }}>
                <Sparkles size={14} color="var(--primary)" /> AI UGC Creator Clips
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#fff', fontWeight: 600 }}>
                <Megaphone size={14} color="#FFBD2E" /> Meta/Google Auto-Deployer
              </div>
            </div>
          </div>

          {/* Bento Secondary Card (Span 4) — Influencer Marketplace */}
          <div className="glow-card bento-col-4" onClick={() => navigate('/features/influencer')} style={{ cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div className="solution-icon-wrapper" style={{ background: 'rgba(255, 71, 87, 0.08)', color: 'var(--danger)', marginBottom: '16px' }}>
                <Users2 size={22} />
              </div>
              <h3 style={{ fontSize: '20px', color: '#fff', marginBottom: '8px' }}>Influencer Marketplace</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Filter out fake followers, evaluate creator authenticity, and lock campaign deals with escrow safety.
              </p>
            </div>
            <div style={{ marginTop: '20px', padding: '10px 14px', background: 'rgba(0,230,118,0.1)', borderRadius: '10px', border: '1px solid rgba(0,230,118,0.25)', fontSize: '11px', color: '#00E676', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>✓ 98% Authenticity Passed</span>
              <span>Escrow Protected</span>
            </div>
          </div>

          {/* Bottom Bento Row: 3 Equal Bento Cards (Span 4 each) */}
          <div className="glow-card bento-col-4" onClick={() => navigate('/features/seo')} style={{ cursor: 'pointer', textAlign: 'left' }}>
            <div className="solution-icon-wrapper" style={{ background: 'rgba(0, 255, 157, 0.08)', color: 'var(--success)', marginBottom: '16px' }}>
              <Globe size={22} />
            </div>
            <h3 style={{ fontSize: '18px', color: '#fff', marginBottom: '8px' }}>SEO + GEO/AEO Dominance</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Maximize citations on ChatGPT & Perplexity while ranking on Google Search with auto-repaired JSON-LD schemas.
            </p>
          </div>

          <div className="glow-card bento-col-4" onClick={() => navigate('/features/review')} style={{ cursor: 'pointer', textAlign: 'left' }}>
            <div className="solution-icon-wrapper" style={{ background: 'rgba(255, 174, 0, 0.08)', color: 'var(--warning)', marginBottom: '16px' }}>
              <BarChart3 size={22} />
            </div>
            <h3 style={{ fontSize: '18px', color: '#fff', marginBottom: '8px' }}>Analytics & Brand Review</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Transform raw metrics into actionable natural-language decisions. Auto-detect ad fatigue before CPC spikes.
            </p>
          </div>

          <div className="glow-card bento-col-4" onClick={() => navigate('/features/social-manager')} style={{ cursor: 'pointer', textAlign: 'left' }}>
            <div className="solution-icon-wrapper" style={{ background: 'rgba(238, 130, 238, 0.08)', color: 'violet', marginBottom: '16px' }}>
              <Share2 size={22} />
            </div>
            <h3 style={{ fontSize: '18px', color: '#fff', marginBottom: '8px' }}>Social Hub AI</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              30-day visual social media calendar planner with &lt;2s automated customer DM checkout responses.
            </p>
          </div>
        </div>
      </section>

      {/* DEDICATED INDUSTRY RESEARCH & FOUNDER TRUST STATEMENTS (Right Below Solutions) */}
      <section className="section-container" style={{ paddingTop: '20px', paddingBottom: '60px' }}>
        <div style={{
          background: 'linear-gradient(180deg, rgba(20, 20, 32, 0.95), rgba(10, 10, 16, 0.98))',
          border: '1px solid rgba(90, 82, 255, 0.25)',
          borderRadius: '24px',
          padding: '48px 40px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          textAlign: 'left'
        }}>
          <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto 40px auto' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.1em', background: 'rgba(90,82,255,0.12)', padding: '6px 14px', borderRadius: '100px', border: '1px solid rgba(90,82,255,0.3)', textTransform: 'uppercase' }}>
              INDUSTRY PROOF & FOUNDER TRUST
            </span>
            <h2 style={{ fontSize: '36px', fontFamily: 'var(--font-heading)', marginTop: '16px', marginBottom: '12px', color: '#fff' }}>
              Why Modern Brands Are Shifting to Agentic AI
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '16px', lineHeight: 1.6 }}>
              Backed by global advertiser research, enterprise-grade brand safety standards, and Gen-Z growth engineers building the next big marketing operating system.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            {/* Statement Card 1: Taboola Study */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.08)',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              justify: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.08em', marginBottom: '12px' }}>
                  📊 TABOOLA ADVERTISER RESEARCH (2026)
                </div>
                <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#fff', marginBottom: '12px', lineHeight: 1.3 }}>
                  76% Benefit from Agentic AI & 86% Shifting Budgets
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
                  Recent Taboola global advertiser data confirms that <strong>76% of brands experience direct ROI gains from Agentic AI</strong>, with <strong>86% willing to reallocate marketing budgets to the Open Web & Answer Engines</strong>.
                </p>
              </div>
            </div>

            {/* Statement Card 2: Founder Vision */}
            <div style={{
              background: 'rgba(0,230,118,0.04)',
              borderRadius: '16px',
              border: '1px solid rgba(0,230,118,0.2)',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              justify: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#00E676', letterSpacing: '0.08em', marginBottom: '12px' }}>
                  🚀 GEN-Z INNOVATION + ENTERPRISE EXPERIENCE
                </div>
                <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#fff', marginBottom: '12px', lineHeight: 1.3 }}>
                  Building the Next Big Growth OS
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
                  Co-founded by ambitious <strong>Gen-Z product visionaries & AI engineers</strong> who live and breathe viral algorithms — engineered hand-in-hand with <strong>veteran enterprise social media managers and growth leads</strong>.
                </p>
              </div>
            </div>

            {/* Statement Card 3: Brand Safety & Escrow */}
            <div style={{
              background: 'rgba(255,189,46,0.04)',
              borderRadius: '16px',
              border: '1px solid rgba(255,189,46,0.2)',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              justify: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#FFBD2E', letterSpacing: '0.08em', marginBottom: '12px' }}>
                  🛡️ 100% BRAND SAFETY & ESCROW PROTECTION
                </div>
                <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#fff', marginBottom: '12px', lineHeight: 1.3 }}>
                  Guaranteed Safety & Trust
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
                  Guaranteed 100% brand safety with automated content compliance checks, fake-follower bot detection (&lt;3%), and <strong>secured escrow deal locks</strong> to protect both brands and creators.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Us Section */}
      <section id="about" className="section-container" style={{ scrollMarginTop: '100px', borderTop: '1px solid var(--border-color)', paddingTop: '80px' }}>
        <span className="section-tag">ABOUT US</span>
        <h2 className="section-title">How Raftra Growth OS Works</h2>
        <p className="section-desc">We replace standard static interfaces with a live agent coordination network that keeps your business growing.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', textAlign: 'left', marginTop: '40px' }}>
          <div className="glow-card" style={{ padding: '24px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-glow)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--accent)', marginBottom: '16px' }}>1</div>
            <h4 style={{ fontSize: '15px', color: '#fff', marginBottom: '8px' }}>Asset Scraping</h4>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Ingests brand guidelines and target URLs, converting raw logs into vector datastores.</p>
          </div>
          <div className="glow-card" style={{ padding: '24px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-glow)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--accent)', marginBottom: '16px' }}>2</div>
            <h4 style={{ fontSize: '15px', color: '#fff', marginBottom: '8px' }}>Graph Pipeline</h4>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Specialized agents coordinate task loops sequentially in state-machine pathways.</p>
          </div>
          <div className="glow-card" style={{ padding: '24px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-glow)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--accent)', marginBottom: '16px' }}>3</div>
            <h4 style={{ fontSize: '15px', color: '#fff', marginBottom: '8px' }}>Human Review Desk</h4>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Keeps you in absolute control. All drafts require one-click approvals before publish.</p>
          </div>
          <div className="glow-card" style={{ padding: '24px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-glow)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--accent)', marginBottom: '16px' }}>4</div>
            <h4 style={{ fontSize: '15px', color: '#fff', marginBottom: '8px' }}>Real-time Optimization</h4>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Continuously audits adset performance curves to maximize budget conversion efficiency.</p>
          </div>
        </div>
      </section>

      {/* Footer / Outro CTA */}
      <section className="section-container" style={{ textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '80px' }}>
        <h2 className="section-title text-gradient-glow" style={{ fontSize: '36px' }}>
          Stop wasting budget on 15 disconnected marketing tools.
        </h2>
        <p style={{ maxWidth: '600px', margin: '16px auto 32px', color: 'var(--text-secondary)' }}>
          Let your AI growth team plan, design, write, target, and optimize for you. Take control of your customer acquisition.
        </p>
        <GlowButton variant="glow" onClick={onStartFree} icon={<ArrowRight size={16} />}>
          Start Scaling Now
        </GlowButton>
      </section>

      <footer style={{ borderTop: '1px solid var(--border-color)', padding: '40px 24px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
        <p>© {new Date().getFullYear()} Raftra AI. Built for high-growth enterprises.</p>
      </footer>
      {/* Creator Portal Modal */}
      {showCreatorPortal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="glow-card" style={{ width: '450px', background: '#0a0a0c', padding: '30px', position: 'relative' }}>
            <button onClick={() => {setShowCreatorPortal(false); setCreatorPortalState('form');}} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '20px' }}>&times;</button>
            
            <h3 style={{ fontSize: '20px', color: '#fff', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserPlus size={20} color="var(--primary)" /> Creator Portal
            </h3>

            {creatorPortalState === 'form' && (
              <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px' }}>
                  Register to connect with brands, or remove your profile from the Raftra Influencer Marketplace.
                </p>
                <div className="form-group">
                  <label>Social Handle</label>
                  <input type="text" placeholder="@username" value={creatorForm.handle} onChange={e => setCreatorForm({...creatorForm, handle: e.target.value})} required style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', color: '#fff' }} />
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Email</label>
                    <input type="email" placeholder="Email" value={creatorForm.email} onChange={e => setCreatorForm({...creatorForm, email: e.target.value})} required style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', color: '#fff', boxSizing: 'border-box' }} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Password</label>
                    <input type="password" placeholder="Password" value={creatorForm.password} onChange={e => setCreatorForm({...creatorForm, password: e.target.value})} required style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', color: '#fff', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Niche / Category</label>
                  <input type="text" placeholder="e.g. Finance, Tech, Fashion" value={creatorForm.niche} onChange={e => setCreatorForm({...creatorForm, niche: e.target.value})} required style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', color: '#fff' }} />
                </div>
                <div className="form-group">
                  <label>Expected Price (per post)</label>
                  <input type="text" placeholder="e.g. 5000" value={creatorForm.price} onChange={e => setCreatorForm({...creatorForm, price: e.target.value})} required style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', color: '#fff' }} />
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  <GlowButton onClick={(e) => handleCreatorSubmit(e, 'add')} variant="glow" style={{ flex: 1, padding: '14px' }}>
                    Register & Scan
                  </GlowButton>
                  <button onClick={(e) => handleCreatorSubmit(e, 'remove')} style={{ padding: '14px', background: 'rgba(255, 50, 50, 0.1)', border: '1px solid rgba(255, 50, 50, 0.3)', color: '#ff6b6b', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                    Remove Profile
                  </button>
                </div>
              </form>
            )}

            {creatorPortalState === 'scanning' && (
              <div style={{ textAlign: 'center', padding: '40px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <ShieldAlert size={48} color="var(--primary)" className="spin-animation" style={{ animation: 'spin 2s linear infinite' }} />
                <h4 style={{ color: '#fff', fontSize: '16px' }}>Audience Verification in progress...</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Scanning for bot networks and fake follower ratios.</p>
              </div>
            )}

            {creatorPortalState === 'success' && (
              <div style={{ textAlign: 'center', padding: '40px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <CheckCircle2 size={48} color="var(--success)" />
                <h4 style={{ color: '#fff', fontSize: '16px' }}>Verification Passed!</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Your profile has been listed on the Influencer Marketplace. Brands can now send you direct match requests.</p>
                <GlowButton variant="glow" onClick={() => {
                  setShowCreatorPortal(false); 
                  setCreatorPortalState('form');
                  navigate('/login');
                }} style={{ marginTop: '16px' }}>Go to Login</GlowButton>
              </div>
            )}

            {creatorPortalState === 'error' && (
              <div style={{ textAlign: 'center', padding: '40px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <ShieldAlert size={48} color="var(--warning)" />
                <h4 style={{ color: '#fff', fontSize: '16px' }}>Verification Failed</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Profile not found on Instagram. Please check your handle and try again.</p>
                <GlowButton variant="glow" onClick={() => setCreatorPortalState('form')} style={{ marginTop: '16px' }}>Try Again</GlowButton>
              </div>
            )}

            {creatorPortalState === 'removing' && (
              <div style={{ textAlign: 'center', padding: '40px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <UserMinus size={48} color="#ff6b6b" />
                <h4 style={{ color: '#fff', fontSize: '16px' }}>Processing Removal...</h4>
              </div>
            )}

            {creatorPortalState === 'removed' && (
              <div style={{ textAlign: 'center', padding: '40px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <CheckCircle2 size={48} color="var(--success)" />
                <h4 style={{ color: '#fff', fontSize: '16px' }}>Profile Removed</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Your profile and all data has been permanently removed from the Raftra Influencer Marketplace.</p>
                <GlowButton variant="glow" onClick={() => {setShowCreatorPortal(false); setCreatorPortalState('form');}} style={{ marginTop: '16px' }}>Close Portal</GlowButton>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Global Styles for Animations */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
      <Footer />
    </div>
  );
};

/* Free AI Audit Engine Sandbox Component (No Signup / No Login Demo) */
const FreeAuditSandboxEngine: React.FC<{ onStartFree: () => void }> = ({ onStartFree }) => {
  const [domainInput, setDomainInput] = useState('');
  const [activeTab, setActiveTab] = useState<'mistakes' | 'campaigns' | 'hooks'>('mistakes');
  const [status, setStatus] = useState<'idle' | 'scanning' | 'complete'>('idle');
  const [progress, setProgress] = useState(0);
  const [scanMessage, setScanMessage] = useState('');
  const [analyzedDomain, setAnalyzedDomain] = useState('');

  const handleRunAudit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const target = domainInput.trim() || 'store.nike.com';
    setAnalyzedDomain(target);
    setStatus('scanning');
    setProgress(15);
    setScanMessage('Crawling website & extracting brand entity...');

    setTimeout(() => {
      setProgress(50);
      setScanMessage('Auditing 8 SEO & Answer-Engine (ChatGPT, Perplexity) mistakes...');
    }, 1000);

    setTimeout(() => {
      setProgress(85);
      setScanMessage('Analyzing competitor ad gaps & generating 3 campaign hooks...');
    }, 2000);

    setTimeout(() => {
      setProgress(100);
      setStatus('complete');
    }, 2800);
  };

  const seoMistakesList = [
    { title: "Missing JSON-LD Entity Schema", severity: "CRITICAL", desc: "ChatGPT and Perplexity cannot recognize or cite your brand entity." },
    { title: "Unindexed Product URLs in Answer Engines", severity: "HIGH", desc: "14 core product pages are missing structured data for AI search discovery." },
    { title: "Unoptimized Canonical & OpenGraph Metadata", severity: "MEDIUM", desc: "Social shares and AI web crawlers read generic fallback titles." },
    { title: "Low Perplexity Citation Index (< 12%)", severity: "CRITICAL", desc: "Your brand is absent when users search for your niche on Perplexity AI." },
    { title: "Missing Voice Search Long-Tail Schema", severity: "HIGH", desc: "Zero structured Q&A markup for conversational Siri/Gemini queries." },
    { title: "Duplicate Meta Tags across Landing Pages", severity: "MEDIUM", desc: "Search crawlers flag 8 pages for keyword cannibalization." },
    { title: "Slow Mobile LCP (3.8s)", severity: "HIGH", desc: "Mobile page load lag triggers a 24% bounce rate before ad conversion." },
    { title: "Missing Review & Trust Markups", severity: "MEDIUM", desc: "Star ratings and verified customer reviews are invisible to Google rich snippets." }
  ];

  const campaignSuggestionsList = [
    { name: "Diwali Retargeting Hook", budget: "$500", roas: "4.8x", desc: "Retarget high-intent visitors with 15s UGC video ads to combat cart abandonment." },
    { name: "Competitor Conquest Blitz", budget: "$750", roas: "5.2x", desc: "Target rival brand search terms on Google Ads & Meta with comparison landing pages." },
    { name: "High-ROAS Carousel Showcase", budget: "$400", roas: "4.5x", desc: "Deploy 5-slide interactive carousel banners featuring top customer review hooks." }
  ];

  const adHooksList = [
    { angle: "Problem-Agitation", text: '"Stop wasting $2,000/mo on disconnected marketing tools."' },
    { angle: "Social Proof", text: '"Join 1,400+ premium brands automating their entire growth stack."' },
    { angle: "Curiosity Hook", text: '"Why 80% of brands are invisible on ChatGPT & AI search in 2026."' },
    { angle: "Direct Offer", text: '"Launch your complete AI campaign team in 60 seconds with 0 code."' }
  ];

  return (
    <div>
      {/* Search Bar Input */}
      <form onSubmit={handleRunAudit} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: status === 'complete' ? '20px' : '0' }}>
        <div style={{ flex: 1, minWidth: '260px', position: 'relative' }}>
          <input
            type="text"
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            placeholder="Enter your website or competitor URL (e.g. nike.com)..."
            style={{
              width: '100%',
              padding: '14px 18px',
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff',
              fontSize: '14px',
              outline: 'none'
            }}
          />
        </div>
        <GlowButton
          variant="glow"
          onClick={() => handleRunAudit()}
          disabled={status === 'scanning'}
          style={{ padding: '14px 24px', fontWeight: 700 }}
        >
          {status === 'scanning' ? 'Auditing Domain...' : 'Audit Brand Free'}
        </GlowButton>
      </form>

      {/* Scanning Animation Progress */}
      {status === 'scanning' && (
        <div style={{ marginTop: '20px', padding: '20px', background: 'rgba(0,0,0,0.4)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
            <span style={{ color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={14} color="var(--primary)" /> {scanMessage}
            </span>
            <span style={{ color: '#00E676', fontWeight: 700 }}>{progress}%</span>
          </div>
          <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary), #00E676)', transition: 'width 0.4s ease' }} />
          </div>
        </div>
      )}

      {/* Complete Audit Report View */}
      {status === 'complete' && (
        <div style={{ animation: 'fadeIn 0.4s ease' }}>
          {/* Header Summary */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justify: 'space-between',
            padding: '16px 20px',
            background: 'rgba(255, 95, 86, 0.08)',
            border: '1px solid rgba(255, 95, 86, 0.25)',
            borderRadius: '12px',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <AlertTriangle size={22} color="#FF5F56" />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>
                  AI Audit Report: <span style={{ color: 'var(--primary)' }}>{analyzedDomain}</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Detected 8 SEO/GEO Mistakes & Generated 3 High-ROI Campaigns
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span style={{ fontSize: '12px', background: 'rgba(255,95,86,0.2)', color: '#FF5F56', padding: '4px 10px', borderRadius: '6px', fontWeight: 700 }}>
                8 SEO Errors
              </span>
              <span style={{ fontSize: '12px', background: 'rgba(0,230,118,0.2)', color: '#00E676', padding: '4px 10px', borderRadius: '6px', fontWeight: 700 }}>
                3 Campaign Ideas
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
            <button
              onClick={() => setActiveTab('mistakes')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'mistakes' ? 'rgba(90,82,255,0.2)' : 'transparent',
                color: activeTab === 'mistakes' ? '#fff' : 'var(--text-secondary)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <AlertCircle size={14} color="#FF5F56" /> 8 SEO & GEO Mistakes ({seoMistakesList.length})
            </button>
            <button
              onClick={() => setActiveTab('campaigns')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'campaigns' ? 'rgba(90,82,255,0.2)' : 'transparent',
                color: activeTab === 'campaigns' ? '#fff' : 'var(--text-secondary)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Rocket size={14} color="var(--primary)" /> 3 Campaign Ideas ({campaignSuggestionsList.length})
            </button>
            <button
              onClick={() => setActiveTab('hooks')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'hooks' ? 'rgba(90,82,255,0.2)' : 'transparent',
                color: activeTab === 'hooks' ? '#fff' : 'var(--text-secondary)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Lightbulb size={14} color="#FFBD2E" /> 4 Ad Creative Hooks
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'mistakes' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
              {seoMistakesList.map((m, idx) => (
                <div key={idx} style={{ padding: '12px 14px', background: 'rgba(0,0,0,0.4)', borderRadius: '8px', border: '1px solid rgba(255,95,86,0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', background: '#FF5F56', color: '#000', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>MISTAKE #{idx + 1}</span>
                    <span>{m.title}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{m.desc}</div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'campaigns' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
              {campaignSuggestionsList.map((c, idx) => (
                <div key={idx} style={{ padding: '14px', background: 'rgba(90,82,255,0.06)', borderRadius: '10px', border: '1px solid rgba(90,82,255,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, color: 'var(--primary)', marginBottom: '6px' }}>
                    <span>{c.name}</span>
                    <span style={{ color: '#00E676' }}>ROAS {c.roas}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>{c.desc}</div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'hooks' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
              {adHooksList.map((h, idx) => (
                <div key={idx} style={{ padding: '12px', background: 'rgba(255,189,46,0.05)', borderRadius: '8px', border: '1px solid rgba(255,189,46,0.2)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#FFBD2E', marginBottom: '4px' }}>{h.angle}</div>
                  <div style={{ fontSize: '12px', color: '#fff', fontStyle: 'italic' }}>{h.text}</div>
                </div>
              ))}
            </div>
          )}

          {/* Bottom Action Bar */}
          <div style={{ marginTop: '20px', padding: '16px 20px', background: 'linear-gradient(90deg, rgba(90,82,255,0.2), rgba(0,230,118,0.15))', borderRadius: '12px', border: '1px solid rgba(0,230,118,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Zap size={16} color="#00E676" /> Auto-Fix All 8 Mistakes & Launch These 3 Campaigns
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Initialize your free AI workspace to let agents repair schema and deploy ads automatically.</div>
            </div>
            <GlowButton variant="glow" onClick={onStartFree} style={{ padding: '12px 20px' }}>Unlock Free Workspace & Auto-Fix</GlowButton>
          </div>
        </div>
      )}
    </div>
  );
};
