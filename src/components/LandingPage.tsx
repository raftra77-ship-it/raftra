import React, { useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ExternalLink,
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
  TrendingDown,
  BookOpen
} from 'lucide-react';
import { GlowButton } from './GlowButton';
import { motion } from 'framer-motion';
// Lazy: PricingScreen is 1500+ lines and only renders under the 'pricing' sub-view below.
// Importing it statically pulled it into the landing-page chunk and defeated the lazy
// route in App.tsx — the build warned about exactly this (INEFFECTIVE_DYNAMIC_IMPORT).
const PricingScreen = lazy(() => import('./PricingScreen').then(m => ({ default: m.PricingScreen })));
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
          <Suspense fallback={<div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>Loading pricing…</div>}>
            <PricingScreen onComplete={onStartFree} />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <div className="app-wrapper">
      <Navbar onOpenCreatorPortal={() => setShowCreatorPortal(true)} />

      {/* Fixed Top-Right Marketplace Button — aligned with navbar */}
      <div
        style={{
          position: 'fixed',
          top: '16px',
          right: '24px',
          zIndex: 1100,
          display: 'flex',
          alignItems: 'center',
          height: '52px',
        }}
      >
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.3, type: 'spring', stiffness: 260, damping: 22 }}
          onClick={() => window.open('/influencer-marketplace', '_blank')}
          style={{
            background: 'linear-gradient(135deg, #8e0b00ff 0%, #290605ff 45%, #410c06ff 100%)',
            border: '1px solid rgba(124, 0, 0, 0.6)',
            color: '#ffffffff',
            borderRadius: '100px',
            padding: '9px 20px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 20px rgba(220, 53, 69, 0.55), 0 0 0 1px rgba(255,107,107,0.25), inset 0 1px 0 rgba(255,255,255,0.3)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            letterSpacing: '0.02em',
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.25s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = '0 6px 30px rgba(220, 53, 69, 0.75), 0 0 0 1px rgba(255,107,107,0.5), inset 0 1px 0 rgba(255,255,255,0.4)';
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.background = 'linear-gradient(135deg, #740000ff 0%, #410c06ff 45%, #290605ff 100%)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(220, 53, 69, 0.55), 0 0 0 1px rgba(255,107,107,0.25), inset 0 1px 0 rgba(255,255,255,0.3)';
            e.currentTarget.style.transform = 'translateY(0px)';
            e.currentTarget.style.background = 'linear-gradient(135deg, #740000ff 0%, #5f100dff 45%, #290605ff 100%)';
          }}
        >
          {/* Shimmer overlay */}
          <span style={{
            position: 'absolute',
            top: 0, left: '-60%',
            width: '40%',
            height: '100%',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)',
            transform: 'skewX(-20deg)',
            animation: 'shimmer-slide 2.4s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
          <span style={{ fontSize: '14px' }}>✦</span>
          Creator Marketplace
          <span style={{ opacity: 0.8, fontSize: '12px' }}>↗</span>
        </motion.button>
        <style>{`
          @keyframes shimmer-slide {
            0% { left: -60%; }
            60%, 100% { left: 130%; }
          }
        `}</style>
      </div>

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
          <GlowButton variant="secondary" onClick={() => window.open('/influencer-marketplace', '_blank')} icon={<ExternalLink size={16} />}>
            Influencer Marketplace ↗
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
          <div className="sim-shell" style={{ display: 'grid', gridTemplateColumns: '200px 1fr', background: '#09090b', height: '420px', fontSize: '13px' }}>
            {/* Sidebar Mockup */}
            <div className="sim-sidebar" style={{ borderRight: '1px solid rgba(255, 255, 255, 0.05)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', background: '#070709', textAlign: 'left' }}>
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
            <div className="sim-main" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'hidden', textAlign: 'left' }}>
              <div className="sim-rowsplit" style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center' }}>
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
              <div className="sim-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
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
              <div className="glow-card sim-rowsplit" style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center' }}>
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
        <span className="section-tag" style={{ color: '#FF4757', fontSize: '18px', fontWeight: 800, letterSpacing: '0.12em', display: 'block', marginBottom: '10px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
          THE FRICTION
        </span>
        <h2 className="section-title" style={{ fontSize: 'clamp(30px, 6vw, 52px)', fontWeight: 800, color: '#ffffff', lineHeight: 1.2, margin: '0 0 16px 0', letterSpacing: '-0.02em' }}>
          Fragmented Tools Are Killing Your Growth
        </h2>
        <p className="section-desc" style={{ fontSize: '19px', color: 'rgba(255,255,255,0.7)', maxWidth: '680px' }}>Managing separate tools for ads, SEO, social media, and analytics wastes thousands of dollars and breaks your brand consistency.</p>

        <div className="bento-grid" style={{ marginTop: '40px' }}>
          {/* Bento Hero Problem Card (Span 7) */}
          <div className="bento-card-hero bento-col-7" style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--danger)', background: 'rgba(255,71,87,0.12)', padding: '6px 14px', borderRadius: '100px', border: '1px solid rgba(255,71,87,0.3)' }}>
                  CRITICAL BOTTLENECK
                </span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#ff6b6b' }}>-₹20 Lakhs / yr Wasted</span>
              </div>
              <h3 style={{ fontSize: '24px', color: '#fff', marginBottom: '14px', lineHeight: 1.3 }}>
                The ₹1,75,000/mo Fragmented Marketing Tool Trap
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
                Brands spend over ₹1,75,000 every month juggling 6 separate single-purpose platforms: one for static graphic design, another for ad campaign deployment, a third for SEO monitoring, plus separate tools for influencer outreach and social scheduling. Data never syncs, and context gets lost in transition.
              </p>
            </div>

            <div style={{ marginTop: '24px', padding: '16px 20px', background: 'rgba(0,0,0,4)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertTriangle size={18} color="var(--danger)" />
                <span style={{ fontSize: '13px', color: '#fff', fontWeight: 600 }}>Fragmented Stack Cost: 6 Apps (₹1,85,000/mo)</span>
              </div>
              <span style={{ fontSize: '12px', color: '#00E676', fontWeight: 700 }}>Raftra Growth OS: 1 Workspace (₹0/mo sandbox)</span>
            </div>
          </div>

          {/* Side Bento Column (Span 5 - 3 Prominent Bento Pills) */}
          <div className="bento-col-5" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div className="bento-pill" style={{ textAlign: 'left', padding: '24px 28px', borderRadius: '18px', gap: '18px', display: 'flex', alignItems: 'flex-start' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'rgba(255,71,87,0.12)', border: '1px solid rgba(255,71,87,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <TrendingDown size={26} color="var(--danger)" />
              </div>
              <div>
                <h4 style={{ fontSize: '17.5px', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>Rising Ad CPA & Wasted Spend</h4>
                <p style={{ fontSize: '14.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>Ad fatigue kills ROAS when static creatives aren't dynamically generated or auto-paused.</p>
              </div>
            </div>

            <div className="bento-pill" style={{ textAlign: 'left', padding: '24px 28px', borderRadius: '18px', gap: '18px', display: 'flex', alignItems: 'flex-start' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'rgba(0,255,157,0.12)', border: '1px solid rgba(0,255,157,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Globe size={26} color="var(--success)" />
              </div>
              <div>
                <h4 style={{ fontSize: '17.5px', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>Ignored AI Search Visibility</h4>
                <p style={{ fontSize: '14.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>If ChatGPT, Claude & Perplexity lack JSON-LD entity schema, your brand is invisible to AI search.</p>
              </div>
            </div>

            <div className="bento-pill" style={{ textAlign: 'left', padding: '24px 28px', borderRadius: '18px', gap: '18px', display: 'flex', alignItems: 'flex-start' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'rgba(255,174,0,0.12)', border: '1px solid rgba(255,174,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <BarChart3 size={26} color="var(--warning)" />
              </div>
              <div>
                <h4 style={{ fontSize: '17.5px', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>Overwhelming Static Dashboards</h4>
                <p style={{ fontSize: '14.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>Raw graphs without actionable AI insights leave marketing managers guessing next steps.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section (Unified Growth OS Redesign) */}
      <section id="solution" className="section-container" style={{ scrollMarginTop: '100px' }}>
        <span className="section-tag" style={{ color: '#00E676', fontSize: '18px', fontWeight: 800, letterSpacing: '0.12em', display: 'block', marginBottom: '10px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
          THE SOLUTION
        </span>
        <h2 className="section-title" style={{ fontSize: 'clamp(30px, 6vw, 52px)', fontWeight: 800, color: '#ffffff', lineHeight: 1.2, margin: '0 0 16px 0', letterSpacing: '-0.02em' }}>
          Everything Your Brand Needs to Grow — In One Platform
        </h2>
        <p className="section-desc" style={{ fontSize: '19.5px', color: 'rgba(255,255,255,0.7)', maxWidth: '950px' }}>
          Six specialized AI workspaces operating as a coordinated growth network to replace your entire marketing stack.
        </p>

        <div className="bento-grid" style={{ marginTop: '44px', gap: '24px' }}>
          {/* Card 1: AI Creative Studio (Span 6) */}
          <div className="bento-card-hero bento-col-6" onClick={() => navigate('/features/creative')} style={{ cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className="solution-icon-wrapper" style={{ margin: 0, background: 'rgba(90, 82, 255, 0.15)', color: 'var(--accent)' }}>
                    <Sparkles size={22} />
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.08em' }}>CREATIVE STUDIO</span>
                </div>
                <span style={{ fontSize: '12px', color: '#00E676', background: 'rgba(0,230,118,0.12)', padding: '4px 12px', borderRadius: '100px', fontWeight: 700 }}>
                  Explore Studio →
                </span>
              </div>
              <h3 style={{ fontSize: '26px', color: '#fff', marginBottom: '12px', fontWeight: 800 }}>
                AI Creative Studio
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.65, marginBottom: '24px' }}>
                Create high-converting ad creatives in minutes. Generate image ads, product photography, carousels, and videos from your brand guidelines or product images. Edit creatives with built-in AI tools, analyze competitor ads, and publish winning assets faster—all powered by Raftra Credits.
              </p>
            </div>

            <div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#00E676', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Includes</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {["AI Image Generation", "Product Photography", "Carousel Ads", "AI Video Generation", "AI Editing Suite", "Competitor Ad Library", "Creative Performance Insights", "AI UGC (Coming Soon)"].map((tag, idx) => (
                  <span key={idx} style={{ fontSize: '12px', color: '#e0e0ff', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', padding: '4px 10px', borderRadius: '8px', fontWeight: 500 }}>
                    ✓ {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Card 2: Campaign Manager (Span 6) */}
          <div className="bento-card-hero bento-col-6" onClick={() => navigate('/features/campaign')} style={{ cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className="solution-icon-wrapper" style={{ margin: 0, background: 'rgba(255, 189, 46, 0.15)', color: '#FFBD2E' }}>
                    <Megaphone size={22} />
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#FFBD2E', letterSpacing: '0.08em' }}>CAMPAIGN MANAGER</span>
                </div>
                <span style={{ fontSize: '12px', color: '#00E676', background: 'rgba(0,230,118,0.12)', padding: '4px 12px', borderRadius: '100px', fontWeight: 700 }}>
                  Explore Campaigns →
                </span>
              </div>
              <h3 style={{ fontSize: '26px', color: '#fff', marginBottom: '12px', fontWeight: 800 }}>
                Campaign Manager
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.65, marginBottom: '24px' }}>
                Launch and optimize campaigns across Meta and Google from a single dashboard. Build campaigns, manage budgets, monitor performance, receive AI-powered recommendations, and improve results with intelligent optimization—without switching platforms.
              </p>
            </div>

            <div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#00E676', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Includes</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {["Meta & Google Publishing", "Campaign Builder", "Budget Management", "Performance Dashboard", "AI Campaign Optimization", "A/B Test Recommendations", "Audience Insights", "Multi-Platform Management"].map((tag, idx) => (
                  <span key={idx} style={{ fontSize: '12px', color: '#e0e0ff', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', padding: '4px 10px', borderRadius: '8px', fontWeight: 500 }}>
                    ✓ {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Card 3: SEO & GEO (Span 6) */}
          <div className="glow-card bento-col-6" onClick={() => navigate('/features/seo')} style={{ cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '32px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className="solution-icon-wrapper" style={{ margin: 0, background: 'rgba(0, 255, 157, 0.12)', color: 'var(--success)' }}>
                    <Globe size={22} />
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--success)', letterSpacing: '0.08em' }}>SEO & GEO WORKSPACE</span>
                </div>
                <span style={{ fontSize: '12px', color: '#00E676', background: 'rgba(0,230,118,0.12)', padding: '4px 12px', borderRadius: '100px', fontWeight: 700 }}>
                  Explore SEO & GEO →
                </span>
              </div>
              <h3 style={{ fontSize: '24px', color: '#fff', marginBottom: '12px', fontWeight: 800 }}>
                SEO & GEO
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14.5px', lineHeight: 1.6, marginBottom: '24px' }}>
                Improve visibility across Google Search and AI search engines with continuous audits, content optimization, technical improvements, and publishing. Connect your CMS, Google Search Console, and GA4 to monitor performance and apply AI-generated improvements from one workspace.
              </p>
            </div>

            <div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#00E676', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Includes</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {["Website Audits", "AI Search (GEO) Audits", "Technical SEO", "AI Content Generation", "CMS Publishing", "GSC & GA4 Integration", "AI Visibility Tracking", "Keyword Intelligence"].map((tag, idx) => (
                  <span key={idx} style={{ fontSize: '12px', color: '#e0e0ff', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', padding: '4px 10px', borderRadius: '8px', fontWeight: 500 }}>
                    ✓ {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Card 4: Growth Analytics (Span 6) */}
          <div className="glow-card bento-col-6" onClick={() => navigate('/features/review')} style={{ cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '32px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className="solution-icon-wrapper" style={{ margin: 0, background: 'rgba(255, 174, 0, 0.12)', color: 'var(--warning)' }}>
                    <BarChart3 size={22} />
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--warning)', letterSpacing: '0.08em' }}>GROWTH ANALYTICS</span>
                </div>
                <span style={{ fontSize: '12px', color: '#00E676', background: 'rgba(0,230,118,0.12)', padding: '4px 12px', borderRadius: '100px', fontWeight: 700 }}>
                  Explore Analytics →
                </span>
              </div>
              <h3 style={{ fontSize: '24px', color: '#fff', marginBottom: '12px', fontWeight: 800 }}>
                Growth Analytics
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14.5px', lineHeight: 1.6, marginBottom: '24px' }}>
                Track every important business metric in one place. Combine campaign performance, website traffic, SEO progress, and AI-powered insights to understand what's working and what to improve next.
              </p>
            </div>

            <div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#00E676', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Includes</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {["Marketing Dashboard", "Campaign Analytics", "SEO Analytics", "ROI Tracking", "AI Growth Insights", "Executive Reports", "Performance Trends", "Custom Reports"].map((tag, idx) => (
                  <span key={idx} style={{ fontSize: '12px', color: '#e0e0ff', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', padding: '4px 10px', borderRadius: '8px', fontWeight: 500 }}>
                    ✓ {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Card 5: Influencer Marketplace (Span 6) */}
          <div className="glow-card bento-col-6" onClick={() => navigate('/features/influencer')} style={{ cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '32px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className="solution-icon-wrapper" style={{ margin: 0, background: 'rgba(255, 71, 87, 0.12)', color: 'var(--danger)' }}>
                    <Users2 size={22} />
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--danger)', letterSpacing: '0.08em' }}>INFLUENCER MARKETPLACE</span>
                </div>
                <span style={{ fontSize: '12px', color: '#00E676', background: 'rgba(0,230,118,0.12)', padding: '4px 12px', borderRadius: '100px', fontWeight: 700 }}>
                  Explore Influencers →
                </span>
              </div>
              <h3 style={{ fontSize: '24px', color: '#fff', marginBottom: '12px', fontWeight: 800 }}>
                Influencer Marketplace
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14.5px', lineHeight: 1.6, marginBottom: '24px' }}>
                Discover verified creators, review profiles, negotiate collaborations, and manage campaigns from one workspace. Brands can hire influencers or UGC creators, while creators receive verified opportunities and performance tracking.
              </p>
            </div>

            <div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#00E676', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Includes</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {["Verified Creators", "Smart Search & Filters", "Brand Collaboration", "Secure Chat", "Campaign Tracking", "Deliverable Management", "Contract Workflow", "Secure Payout Requests"].map((tag, idx) => (
                  <span key={idx} style={{ fontSize: '12px', color: '#e0e0ff', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', padding: '4px 10px', borderRadius: '8px', fontWeight: 500 }}>
                    ✓ {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Card 6: Social Hub (Span 6) */}
          <div className="glow-card bento-col-6" onClick={() => navigate('/features/social-manager')} style={{ cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '32px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className="solution-icon-wrapper" style={{ margin: 0, background: 'rgba(238, 130, 238, 0.12)', color: 'violet' }}>
                    <Share2 size={22} />
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: 'violet', letterSpacing: '0.08em' }}>SOCIAL HUB & SPECIALISTS</span>
                </div>
                <span style={{ fontSize: '12px', color: '#00E676', background: 'rgba(0,230,118,0.12)', padding: '4px 12px', borderRadius: '100px', fontWeight: 700 }}>
                  Explore Social Hub →
                </span>
              </div>
              <h3 style={{ fontSize: '24px', color: '#fff', marginBottom: '12px', fontWeight: 800 }}>
                Social Hub
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14.5px', lineHeight: 1.6, marginBottom: '24px' }}>
                Need additional expertise? Hire certified marketing professionals who work directly inside Raftra. Whether it's SEO, paid ads, social media, CRO, or digital PR, specialists use your Raftra workspace to execute, optimize, and report—without disrupting your workflow.
              </p>
            </div>

            <div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#00E676', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Includes</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {["SEO & GEO Specialists", "Paid Ads Specialists", "Social Media Managers", "Digital PR & CRO Experts"].map((tag, idx) => (
                  <span key={idx} style={{ fontSize: '12px', color: '#e0e0ff', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', padding: '4px 10px', borderRadius: '8px', fontWeight: 500 }}>
                    ✓ {tag}
                  </span>
                ))}
              </div>
            </div>
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
            <h2 style={{ fontSize: 'clamp(25px, 4.8vw, 36px)', fontFamily: 'var(--font-heading)', marginTop: '16px', marginBottom: '12px', color: '#fff' }}>
              Why Modern Brands Are Shifting to Agentic AI
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '16px', lineHeight: 1.6 }}>
              Backed by global advertiser research, enterprise-grade brand safety standards, and Gen-Z growth engineers building the next big marketing operating system.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: '24px' }}>
            {/* Statement Card 1: Taboola Study */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.08)',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
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
              justifyContent: 'space-between'
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
              justifyContent: 'space-between'
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(250px, 100%), 1fr))', gap: '20px', textAlign: 'left', marginTop: '40px' }}>
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

      {/* ── KNOWLEDGE, STORIES & CAREER HUB (BLOGS, CAREERS, USER MANUALS) ── */}
      <section className="section-container" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '80px', paddingBottom: '40px' }}>
        <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 48px auto' }}>
          <span style={{ fontSize: '12px', color: '#00E676', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>
            RESOURCES & COMMUNITY
          </span>
          <h2 style={{ fontSize: '42px', fontWeight: 900, color: '#fff', margin: '12px 0 16px 0', fontFamily: 'var(--font-heading)' }}>
            Knowledge, Playbooks & Open Roles
          </h2>
          <p style={{ fontSize: '17px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            Discover how top brands scale with autonomous AI marketing, master the platform with interactive manuals, or join our team.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          
          {/* Card 1: Growth Blogs */}
          <div
            onClick={() => navigate('/blog')}
            className="glow-card"
            style={{
              background: '#0a0a12',
              border: '1.5px solid rgba(124, 117, 255, 0.3)',
              borderRadius: '24px',
              padding: '32px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '20px',
              cursor: 'pointer',
              transition: 'all 0.25s ease'
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(124, 117, 255, 0.15)', border: '1px solid rgba(124, 117, 255, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BookOpen size={24} color="#7C75FF" />
                </div>
                <span style={{ fontSize: '11px', background: 'rgba(124, 117, 255, 0.15)', color: '#7C75FF', padding: '3px 10px', borderRadius: '100px', fontWeight: 800 }}>
                  WEEKLY ARTICLES
                </span>
              </div>

              <h3 style={{ fontSize: '22px', color: '#fff', margin: '0 0 10px 0', fontWeight: 800 }}>
                Raftra Growth Blog
              </h3>

              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 16px 0', lineHeight: 1.6 }}>
                Deep dives into creative psychology, Meta ad tear-downs of rivals like Portronics & StuffCool, and Answer Engine Optimization (AEO).
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px', color: 'rgba(255,255,255,0.85)' }}>
                <div>• Autonomous Meta Ad scaling in 2026</div>
                <div>• Dominating ChatGPT & Perplexity Citations</div>
                <div>• Diwali festive run-up e-com playbook</div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#7C75FF', fontSize: '13.5px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                Explore Articles <ArrowRight size={15} />
              </span>
            </div>
          </div>

          {/* Card 2: Careers */}
          <div
            onClick={() => navigate('/careers')}
            className="glow-card"
            style={{
              background: '#0a0a12',
              border: '1.5px solid rgba(0, 230, 118, 0.35)',
              borderRadius: '24px',
              padding: '32px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '20px',
              cursor: 'pointer',
              boxShadow: '0 8px 30px rgba(0, 230, 118, 0.12)',
              transition: 'all 0.25s ease'
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(0, 230, 118, 0.15)', border: '1px solid rgba(0, 230, 118, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Rocket size={24} color="#00E676" />
                </div>
                <span style={{ fontSize: '11px', background: 'rgba(0, 230, 118, 0.15)', color: '#00E676', border: '1px solid rgba(0, 230, 118, 0.35)', padding: '3px 10px', borderRadius: '100px', fontWeight: 800 }}>
                  INTERNSHIP PROGRAM
                </span>
              </div>

              <h3 style={{ fontSize: '22px', color: '#fff', margin: '0 0 10px 0', fontWeight: 800 }}>
                Join Team Raftra
              </h3>

              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 16px 0', lineHeight: 1.6 }}>
                Hands-on remote internships working directly on AI agent graphs, growth marketing pipelines, and modern design systems.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px', color: 'rgba(255,255,255,0.85)' }}>
                <div>• AI & LLM Engineering Intern (Unpaid • Certificate + LOR)</div>
                <div>• Growth Marketing Intern (Unpaid • PPO Opportunity)</div>
                <div>• UI/UX Product Design Intern (Unpaid • Live Portfolio)</div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#00E676', fontSize: '13.5px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                View Internships & Apply <ArrowRight size={15} />
              </span>
            </div>
          </div>

          {/* Card 3: User Manuals */}
          <div
            onClick={() => navigate('/docs')}
            className="glow-card"
            style={{
              background: '#0a0a12',
              border: '1.5px solid rgba(0, 210, 255, 0.3)',
              borderRadius: '24px',
              padding: '32px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '20px',
              cursor: 'pointer',
              transition: 'all 0.25s ease'
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(0, 210, 255, 0.15)', border: '1px solid rgba(0, 210, 255, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Cpu size={24} color="#00D2FF" />
                </div>
                <span style={{ fontSize: '11px', background: 'rgba(0, 210, 255, 0.15)', color: '#00D2FF', padding: '3px 10px', borderRadius: '100px', fontWeight: 800 }}>
                  OFFICIAL GUIDES
                </span>
              </div>

              <h3 style={{ fontSize: '22px', color: '#fff', margin: '0 0 10px 0', fontWeight: 800 }}>
                User Manuals & Docs
              </h3>

              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 16px 0', lineHeight: 1.6 }}>
                Interactive step-by-step documentation, code rules, API triggers, Brand Kit ingestion checks, and creator escrow setup guides.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px', color: 'rgba(255,255,255,0.85)' }}>
                <div>• Brand Kit extraction & font guardrails</div>
                <div>• 1-Click Meta & Google ad deployment</div>
                <div>• Creator Escrow Vault milestone release</div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#00D2FF', fontSize: '13.5px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                Read Documentation <ArrowRight size={15} />
              </span>
            </div>
          </div>

        </div>
      </section>

      {/* Footer / Outro CTA */}
      <section className="section-container" style={{ textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '80px' }}>
        <h2 className="section-title text-gradient-glow" style={{ fontSize: 'clamp(25px, 4.8vw, 36px)' }}>
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}>
          <div className="glow-card" style={{ width: '460px', background: '#0a0a0c', padding: '32px', position: 'relative', border: '1px solid rgba(0, 230, 118, 0.4)', borderRadius: '20px' }}>
            <button onClick={() => setShowCreatorPortal(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '20px' }}>&times;</button>

            <h3 style={{ fontSize: '22px', color: '#fff', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700 }}>
              <UserPlus size={22} color="#00E676" /> Creator Onboarding
            </h3>

            <p style={{ color: '#aaa', fontSize: '14px', lineHeight: 1.6, marginBottom: '24px' }}>
              Fill out the official <strong>Raftra Creator Onboarding Form</strong> to list your profile, verify your metrics, and start receiving brand sponsorship deals.
            </p>

            <button
              onClick={() => {
                window.open('https://docs.google.com/forms/d/e/1FAIpQLSe8SaOeW1zHgpDQprgkMoKQGOqqEHv3pSrqskUPTDYpBsB_Nw/viewform?usp=sharing&ouid=100579727126475993109', '_blank');
                setShowCreatorPortal(false);
              }}
              style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #00E676 0%, #00B0FF 100%)', color: '#000', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 24px rgba(0, 230, 118, 0.3)' }}
            >
              📋 Open Creator Onboarding Form
            </button>
          </div>
        </div>
      )}

      {/* Global Styles for Animations */}
      <style dangerouslySetInnerHTML={{
        __html: `
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
            justifyContent: 'space-between',
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '12px', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '12px' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '10px' }}>
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
