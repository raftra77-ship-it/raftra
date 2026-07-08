import React, { useState } from 'react';
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
  Megaphone
} from 'lucide-react';
import { GlowButton } from './GlowButton';
import { motion } from 'framer-motion';

interface LandingPageProps {
  onStartFree: () => void;
  onBookDemo: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStartFree, onBookDemo }) => {
  const [currentSubView, setCurrentSubView] = useState<'main' | 'pricing'>('main');

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
        <nav className="landing-nav">
          <div className="logo-container" onClick={() => setCurrentSubView('main')} style={{ cursor: 'pointer' }}>
            <Cpu className="logo-icon" size={24} />
            <span>RAFTRA AI</span>
          </div>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            <button className="btn btn-secondary" onClick={() => setCurrentSubView('main')} style={{ padding: '8px 16px', fontSize: '13px' }}>
              <ArrowLeft size={14} /> Back to Home
            </button>
            <GlowButton variant="glow" onClick={onStartFree}>
              Start Free
            </GlowButton>
          </div>
        </nav>

        <section className="section-container" style={{ textAlign: 'center', marginTop: '40px' }}>
          <span className="section-tag">FLEXIBLE LICENSING</span>
          <h2 className="section-title text-gradient-glow">Modular Pricing for Every Node</h2>
          <p className="section-desc" style={{ margin: '0 auto 48px' }}>
            Pay only for the specific growth workspaces your marketing demands, or unlock the entire Growth Suite.
          </p>

          {/* Pricing Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', maxWidth: '1200px', margin: '0 auto 60px' }}>
            {/* Feature 1 */}
            <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', justifyItems: 'space-between', padding: '24px', textAlign: 'left', minHeight: '340px' }}>
              <div>
                <h4 style={{ fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', marginBottom: '8px' }}>
                  <Sparkles size={16} style={{ color: 'var(--accent)' }} /> AI Creative Studio
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                  Unlimited concept generation, copy angles copywriting, headlines, and layout suggestions.
                </p>
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff', marginBottom: '20px' }}>
                  $79<span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>/mo</span>
                </div>
              </div>
              <div style={{ marginTop: 'auto' }}>
                <GlowButton variant="secondary" onClick={onStartFree} style={{ width: '100%', padding: '10px' }}>
                  Enable Studio Node
                </GlowButton>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', justifyItems: 'space-between', padding: '24px', textAlign: 'left', minHeight: '340px' }}>
              <div>
                <h4 style={{ fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', marginBottom: '8px' }}>
                  <Megaphone size={16} style={{ color: 'var(--accent)' }} /> Campaign Manager
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                  OAuth platform connections, automated targeting parameters structure, budget auto-optimizations.
                </p>
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff', marginBottom: '20px' }}>
                  $149<span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>/mo</span>
                </div>
              </div>
              <div style={{ marginTop: 'auto' }}>
                <GlowButton variant="secondary" onClick={onStartFree} style={{ width: '100%', padding: '10px' }}>
                  Enable Campaign Node
                </GlowButton>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', justifyItems: 'space-between', padding: '24px', textAlign: 'left', minHeight: '340px' }}>
              <div>
                <h4 style={{ fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', marginBottom: '8px' }}>
                  <Globe size={16} style={{ color: 'var(--accent)' }} /> SEO + GEO/AEO
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                  Traditional index crawl and LLM prompts citations tracking on ChatGPT, Claude, and Gemini.
                </p>
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff', marginBottom: '20px' }}>
                  $99<span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>/mo</span>
                </div>
              </div>
              <div style={{ marginTop: 'auto' }}>
                <GlowButton variant="secondary" onClick={onStartFree} style={{ width: '100%', padding: '10px' }}>
                  Enable SEO Node
                </GlowButton>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', justifyItems: 'space-between', padding: '24px', textAlign: 'left', minHeight: '340px' }}>
              <div>
                <h4 style={{ fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', marginBottom: '8px' }}>
                  <BarChart3 size={16} style={{ color: 'var(--accent)' }} /> Analytics + Claude
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                  Narrated performance explanation dashboard logs, Recharts data grids, natural language query.
                </p>
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff', marginBottom: '20px' }}>
                  $129<span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>/mo</span>
                </div>
              </div>
              <div style={{ marginTop: 'auto' }}>
                <GlowButton variant="secondary" onClick={onStartFree} style={{ width: '100%', padding: '10px' }}>
                  Enable Analytics Node
                </GlowButton>
              </div>
            </div>

            {/* Feature 5 */}
            <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', justifyItems: 'space-between', padding: '24px', textAlign: 'left', minHeight: '340px' }}>
              <div>
                <h4 style={{ fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', marginBottom: '8px' }}>
                  <Share2 size={16} style={{ color: 'var(--accent)' }} /> Social Hub AI
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                  Cross-platform calendar publisher, caption generators, comment and DM automation.
                </p>
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff', marginBottom: '20px' }}>
                  $69<span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>/mo</span>
                </div>
              </div>
              <div style={{ marginTop: 'auto' }}>
                <GlowButton variant="secondary" onClick={onStartFree} style={{ width: '100%', padding: '10px' }}>
                  Enable Social Node
                </GlowButton>
              </div>
            </div>

            {/* Feature 6 */}
            <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', justifyItems: 'space-between', padding: '24px', textAlign: 'left', minHeight: '340px' }}>
              <div>
                <h4 style={{ fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', marginBottom: '8px' }}>
                  <Users2 size={16} style={{ color: 'var(--accent)' }} /> Influencer Market
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                  Creator search matrix filter, Audience fit scoring verification, pricing bots.
                </p>
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff', marginBottom: '20px' }}>
                  $89<span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>/mo</span>
                </div>
              </div>
              <div style={{ marginTop: 'auto' }}>
                <GlowButton variant="secondary" onClick={onStartFree} style={{ width: '100%', padding: '10px' }}>
                  Enable Creator Node
                </GlowButton>
              </div>
            </div>
          </div>

          {/* Bundle plan */}
          <div className="glow-card" style={{ maxWidth: '800px', margin: '0 auto 80px', background: 'linear-gradient(135deg, rgba(90, 82, 255, 0.1) 0%, rgba(10, 10, 12, 0.8) 100%)', borderColor: 'var(--accent)', padding: '40px', display: 'flex', flexWrap: 'wrap', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center', gap: '24px' }}>
            <div style={{ textAlign: 'left' }}>
              <span className="hero-pill-badge" style={{ background: 'var(--success-glow)', color: 'var(--success)', marginBottom: '8px', display: 'inline-block' }}>RECOMMENDED VALUE</span>
              <h3 style={{ fontSize: '22px', color: '#fff', marginBottom: '6px' }}>Complete Raftra Growth OS Bundle</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Get full access to all 6 specialist workspaces + core multi-agent state network.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ fontSize: '36px', fontWeight: 800, color: '#fff' }}>
                $449<span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>/mo</span>
              </div>
              <GlowButton variant="glow" onClick={onStartFree}>
                Activate Full OS
              </GlowButton>
            </div>
          </div>
        </section>

        <footer style={{ borderTop: '1px solid var(--border-color)', padding: '40px 24px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
          <p>© {new Date().getFullYear()} Raftra AI. Built for high-growth enterprises.</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="app-wrapper">
      {/* Navigation */}
      <nav className="landing-nav">
        <div className="logo-container" onClick={() => setCurrentSubView('main')} style={{ cursor: 'pointer' }}>
          <Cpu className="logo-icon" size={24} />
          <span>RAFTRA AI</span>
        </div>
        <div className="nav-links">
          <button className="nav-link" onClick={() => scrollToSection('problem')} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>The Friction</button>
          <button className="nav-link" onClick={() => scrollToSection('solution')} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>The Solution</button>
          <button className="nav-link" onClick={() => scrollToSection('about')} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>About Us</button>
          <button className="nav-link" onClick={() => setCurrentSubView('pricing')} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>Pricing</button>
        </div>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          <button className="nav-link" onClick={() => window.location.href = '/admin'} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
            Admin Panel
          </button>
          <button className="nav-link" onClick={onStartFree} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
            Log In
          </button>
          <GlowButton variant="glow" onClick={onStartFree}>
            Start Free
          </GlowButton>
        </div>
      </nav>

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
          <GlowButton variant="secondary" onClick={onBookDemo}>
            Book Demo
          </GlowButton>
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

      {/* Problem Section */}
      <section id="problem" className="section-container" style={{ scrollMarginTop: '100px' }}>
        <span className="section-tag">THE FRICTION</span>
        <h2 className="section-title">Businesses waste time switching between dozens of marketing tools.</h2>
        <p className="section-desc">Disconnected creatives, ignored SEO indexing, and fatiguing ads burn budgets daily. Raftra replaces this chaos.</p>

        <div className="problems-grid">
          <div className="problem-card">
            <div className="problem-icon-wrapper">
              <AlertTriangle size={24} />
            </div>
            <h3>Fragmented Copy & Creative Decline</h3>
            <p>Switching between design tools means campaigns become inconsistent, creative quality drops, and winning angles are rarely replicated.</p>
          </div>

          <div className="problem-card">
            <div className="problem-icon-wrapper">
              <AlertTriangle size={24} />
            </div>
            <h3>Ignored AI Engine Visibility</h3>
            <p>Traditional SEO overlooks how customers search today. If ChatGPT, Claude, and Gemini aren't recommending your product, you are invisible.</p>
          </div>

          <div className="problem-card">
            <div className="problem-icon-wrapper">
              <AlertTriangle size={24} />
            </div>
            <h3>Overwhelming, Static Analytics</h3>
            <p>Dashboards give you charts, not solutions. No one knows which campaigns are wasting money or which creatives have fatiguing CTRs.</p>
          </div>
        </div>
      </section>

      {/* Solution Section (6 Workspaces/Features clearly explained) */}
      <section id="solution" className="section-container" style={{ scrollMarginTop: '100px' }}>
        <span className="section-tag">THE SOLUTIONS</span>
        <h2 className="section-title">Meet Raftra AI. The Unified Growth Suite.</h2>
        <p className="section-desc">Six specialized AI workspaces operating as a coordinated growth network to replace your entire marketing stack.</p>

        <div className="solutions-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          {/* Card 1 */}
          <div className="solution-card">
            <div className="solution-icon-wrapper">
              <Sparkles size={24} />
            </div>
            <h3>AI Creative Studio</h3>
            <p style={{ fontSize: '13.5px', marginTop: '8px' }}>
              Turn your business website URL, logo, and brand directives into high-converting static creatives, hooks, headlines, and video prompts. Retransmit brand voice continuously.
            </p>
          </div>

          {/* Card 2 */}
          <div className="solution-card">
            <div className="solution-icon-wrapper" style={{ background: 'rgba(90, 82, 255, 0.08)', color: 'var(--accent)' }}>
              <Megaphone size={24} />
            </div>
            <h3>AI Campaign Manager</h3>
            <p style={{ fontSize: '13.5px', marginTop: '8px' }}>
              Launch advertising structures on sandbox Meta and Google Ads pipelines. Auto-targets demographics, sets bidding scopes, and dynamically handles budget redistribution.
            </p>
          </div>

          {/* Card 3 */}
          <div className="solution-card">
            <div className="solution-icon-wrapper" style={{ background: 'rgba(0, 255, 157, 0.08)', color: 'var(--success)' }}>
              <Globe size={24} />
            </div>
            <h3>SEO + GEO/AEO Dominance</h3>
            <p style={{ fontSize: '13.5px', marginTop: '8px' }}>
              Dominate indexing on traditional Google Search, and maximize visibility indices on ChatGPT, Claude, and Gemini citations. Optimizes structured schema databases.
            </p>
          </div>

          {/* Card 4 */}
          <div className="solution-card">
            <div className="solution-icon-wrapper" style={{ background: 'rgba(255, 174, 0, 0.08)', color: 'var(--warning)' }}>
              <BarChart3 size={24} />
            </div>
            <h3>Analytics + Claude Intel</h3>
            <p style={{ fontSize: '13.5px', marginTop: '8px' }}>
              Transform numbers into narrative decisions. Connect Meta, Google Search, and source systems. Let Claude analyze data points and answer why conversions move.
            </p>
          </div>

          {/* Card 5 */}
          <div className="solution-card">
            <div className="solution-icon-wrapper" style={{ background: 'rgba(238, 130, 238, 0.08)', color: 'violet' }}>
              <Share2 size={24} />
            </div>
            <h3>Social Hub AI</h3>
            <p style={{ fontSize: '13.5px', marginTop: '8px' }}>
              Maintain active channels (LinkedIn, Twitter) dynamically. Autogenerates platform drafts, coordinates calendar schedules, writes comment replies, and automates DMs.
            </p>
          </div>

          {/* Card 6 */}
          <div className="solution-card">
            <div className="solution-icon-wrapper" style={{ background: 'rgba(255, 71, 87, 0.08)', color: 'var(--danger)' }}>
              <Users2 size={24} />
            </div>
            <h3>Influencer Marketplace</h3>
            <p style={{ fontSize: '13.5px', marginTop: '8px' }}>
              Find creators using matching matrix tools. Evaluates fake followers, computes fit matching scores, predicts campaign ROAS, and organizes outreach proposals automatically.
            </p>
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
    </div>
  );
};
