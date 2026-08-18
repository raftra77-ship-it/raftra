import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Plus,
  Layers,
  BarChart3,
  Calendar,
  Clock,
  Zap,
  TrendingUp,
  Image as ImageIcon,
  Video,
  Eye,
  ArrowUpRight,
  Palette,
  Type,
  FileText,
  Target,
  Share2,
  AlertCircle,
  RefreshCw,
  Sliders,
  Check,
  X,
  Play,
  Copy,
  Cpu,
  Link2
} from 'lucide-react';
import { GlowButton } from './GlowButton';

interface ModernHomeOverviewProps {
  userName?: string;
  brandName?: string;
  onNavigateTab: (tab: string) => void;
  onOpenReview?: (itemTitle: string) => void;
}

export const ModernHomeOverview: React.FC<ModernHomeOverviewProps> = ({
  userName = 'aryan070606',
  brandName = 'Demo Brand',
  onNavigateTab,
  onOpenReview
}) => {
  // Brand Kit Review Modal State
  const [showBrandKitModal, setShowBrandKitModal] = useState(false);
  const [activeBrandKitTab, setActiveBrandKitTab] = useState<'logo' | 'colors' | 'typography' | 'knowledge' | 'assets' | 'market'>('logo');

  // Ad Account Connection Modal State
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [isAdAccountConnected, setIsAdAccountConnected] = useState(false);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);

  // Recommendations Modal State
  const [showRecommendationsModal, setShowRecommendationsModal] = useState(false);

  // Scheduler Modal State
  const [showSchedulerModal, setShowSchedulerModal] = useState(false);

  // Schedule items state
  const [schedules, setSchedules] = useState([
    {
      id: 'sch_1',
      title: `${brandName} Fresh Creative Batch`,
      frequency: 'Mon, Thu at 9:00 AM • Next run in 2d',
      type: 'Creative AI Generation',
      status: 'Active',
      color: '#7C75FF'
    },
    {
      id: 'sch_2',
      title: 'Weekly competitor report',
      frequency: 'Weekly on Mon at 9:00 AM • Next run in 6d',
      type: 'Market Intelligence Crawl',
      status: 'Active',
      color: '#00D2FF'
    },
    {
      id: 'sch_3',
      title: 'Daily ROAS Guardrail & Bid Scaling',
      frequency: 'Daily at 12:00 AM • Next run in 11h',
      type: 'Ad Optimization Auto-Pilot',
      status: 'Active',
      color: '#00E676'
    }
  ]);

  // Brand Kit Checklist Items
  const brandKitItems = [
    { id: 'logo', label: 'Logo', status: 'Ready', icon: <ImageIcon size={16} color="#7C75FF" /> },
    { id: 'colors', label: 'Colors', status: 'Ready', icon: <Palette size={16} color="#00E676" /> },
    { id: 'typography', label: 'Typography', status: 'Ready', icon: <Type size={16} color="#00D2FF" /> },
    { id: 'knowledge', label: 'Brand knowledge', status: 'Ready', icon: <FileText size={16} color="#FFB300" /> },
    { id: 'assets', label: 'Assets', status: 'Ready', icon: <Layers size={16} color="#FF5296" /> },
    { id: 'market', label: 'Target Market', status: 'Ready', icon: <Target size={16} color="#A855F7" /> }
  ];

  // Mock Top Performing Creatives (shown when connected or preview toggled)
  const mockCreatives = [
    {
      id: 'cr_1',
      title: '15s High-Hook UGC Video Reel',
      type: 'Video Reel',
      roas: '4.8x',
      spend: '₹14,500',
      ctr: '3.6%',
      revenue: '₹69,600',
      thumbnail: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=400&q=80',
      tag: 'Scale Winner'
    },
    {
      id: 'cr_2',
      title: '3-Slide Value Carousel - Social Proof',
      type: 'Carousel',
      roas: '4.1x',
      spend: '₹9,800',
      ctr: '2.9%',
      revenue: '₹40,180',
      thumbnail: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=400&q=80',
      tag: 'High CTR'
    },
    {
      id: 'cr_3',
      title: 'Feature Comparison Static Ad',
      type: 'Static Post',
      roas: '3.7x',
      spend: '₹6,400',
      ctr: '2.4%',
      revenue: '₹23,680',
      thumbnail: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80',
      tag: 'Consistent'
    }
  ];

  // Mock Recommendations
  const mockRecommendations = [
    {
      id: 'rec_1',
      title: 'Auto-Refresh Fatigued Creative in Ad Set #2',
      desc: 'Creative CTR dropped by 22% over last 48h. Swap with new AI UGC Variation #3 to restore 4.2x ROAS.',
      impact: '+₹18,000 weekly savings',
      urgency: 'High Impact'
    },
    {
      id: 'rec_2',
      title: 'Scale Lookalike Top Converting Ad Set (+15%)',
      desc: 'Campaign maintaining 4.8x ROAS with 68% headroom before CPA inflection.',
      impact: '+34 new orders/day',
      urgency: 'Growth Opportunity'
    },
    {
      id: 'rec_3',
      title: 'Enable Advantage+ Placements on Meta',
      desc: 'AI detected 18% cheaper CPMs across Instagram Reels & Stories inventory.',
      impact: '-14% Blended CPA',
      urgency: 'Optimization'
    }
  ];

  const handleSimulateConnect = (platform: string) => {
    setConnectingPlatform(platform);
    setTimeout(() => {
      setConnectingPlatform(null);
      setIsAdAccountConnected(true);
      setShowConnectModal(false);
    }, 900);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* ── GREETING HERO BAR ─────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: 'rgba(90, 82, 255, 0.12)', borderRadius: '100px', border: '1px solid rgba(90, 82, 255, 0.25)', marginBottom: '10px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#00E676', boxShadow: '0 0 8px #00E676' }} />
            <span style={{ fontSize: '12px', color: '#00E676', fontWeight: 700, letterSpacing: '0.04em' }}>
              RAFTRA AI GROWTH OS ACTIVE
            </span>
          </div>
          <h1 style={{ fontSize: '32px', fontFamily: 'var(--font-heading)', margin: '0 0 6px 0', color: '#fff', fontWeight: 800 }}>
            How are you doing, <span style={{ color: '#00E676' }}>{userName || brandName}</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14.5px', margin: 0 }}>
            Here is your live brand health, automated scheduled pipelines, and creative performance overview.
          </p>
        </div>

        {/* Action controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setIsAdAccountConnected(!isAdAccountConnected)}
            style={{
              background: isAdAccountConnected ? 'rgba(0, 230, 118, 0.12)' : 'rgba(255, 255, 255, 0.04)',
              border: isAdAccountConnected ? '1px solid rgba(0, 230, 118, 0.4)' : '1px solid rgba(255, 255, 255, 0.15)',
              color: isAdAccountConnected ? '#00E676' : '#ffffff',
              padding: '8px 16px',
              borderRadius: '100px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            {isAdAccountConnected ? <CheckCircle2 size={14} color="#00E676" /> : <Link2 size={14} />}
            {isAdAccountConnected ? 'Ad Account: Connected' : 'Demo Mode (Click to Toggle)'}
          </button>

          <GlowButton variant="glow" onClick={() => onNavigateTab('studio')} style={{ fontSize: '13.5px', padding: '10px 20px' }}>
            <Sparkles size={15} /> Create Fresh Creatives
          </GlowButton>
        </div>
      </div>

      {/* ── 0. OVERALL GROWTH SCORE & TRAJECTORY TRACKER CARD ──────── */}
      <div
        className="glow-card"
        style={{
          background: 'linear-gradient(135deg, rgba(20, 32, 28, 0.85) 0%, rgba(10, 16, 22, 0.95) 100%)',
          border: '1.5px solid rgba(0, 230, 118, 0.35)',
          borderRadius: '24px',
          padding: '26px 30px',
          boxShadow: '0 12px 40px rgba(0, 230, 118, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          gap: '22px'
        }}
      >
        {/* Top Header Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Score Ring / Pill */}
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '18px',
                background: 'linear-gradient(135deg, rgba(0, 230, 118, 0.2) 0%, rgba(0, 200, 83, 0.08) 100%)',
                border: '2px solid #00E676',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 20px rgba(0, 230, 118, 0.25)',
                flexShrink: 0
              }}
            >
              <span style={{ fontSize: '22px', fontWeight: 900, color: '#00E676', lineHeight: 1 }}>84</span>
              <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>/ 100</span>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <h2 style={{ fontSize: '22px', color: '#fff', margin: 0, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
                  Overall Growth Score & Trajectory
                </h2>
                <span style={{ fontSize: '11px', background: 'rgba(0, 230, 118, 0.2)', color: '#00E676', border: '1px solid rgba(0, 230, 118, 0.4)', padding: '2px 9px', borderRadius: '100px', fontWeight: 800 }}>
                  🔥 High Velocity Growth (+18.4 pts)
                </span>
              </div>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: 0 }}>
                Real-time composite score based on creative velocity, ROAS efficiency, competitor defense, and AEO schema.
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('studio')}
            style={{
              background: 'linear-gradient(135deg, #00E676 0%, #00C853 100%)',
              color: '#000000',
              border: 'none',
              borderRadius: '100px',
              padding: '9px 20px',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 16px rgba(0, 230, 118, 0.35)',
              transition: 'all 0.2s ease'
            }}
          >
            <TrendingUp size={14} /> Boost Score 🚀
          </button>
        </div>

        {/* 4 Key Growth Metrics Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.07)', borderRadius: '14px', padding: '14px 18px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>Attributed Revenue</span>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#fff', marginTop: '2px' }}>
              ₹7,74,900 <span style={{ fontSize: '12px', color: '#00E676', fontWeight: 700 }}>+38.4%</span>
            </div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.07)', borderRadius: '14px', padding: '14px 18px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>Blended ROAS</span>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#00E676', marginTop: '2px' }}>
              4.2x <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Target: &gt;3.5x</span>
            </div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.07)', borderRadius: '14px', padding: '14px 18px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>Conversion Rate</span>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#fff', marginTop: '2px' }}>
              3.8% <span style={{ fontSize: '12px', color: '#00E676', fontWeight: 700 }}>+0.9%</span>
            </div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.07)', borderRadius: '14px', padding: '14px 18px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>AEO / Search Citations</span>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#7C75FF', marginTop: '2px' }}>
              76% <span style={{ fontSize: '12px', color: '#00E676', fontWeight: 700 }}>+14% AI</span>
            </div>
          </div>
        </div>

        {/* 4 Growth Pillars Progress Bars */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '6px' }}>
              <span style={{ color: '#fff', fontWeight: 600 }}>🎨 Creative Hook Power & Freshness</span>
              <span style={{ color: '#00E676', fontWeight: 800 }}>92%</span>
            </div>
            <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '100px', overflow: 'hidden' }}>
              <div style={{ width: '92%', height: '100%', background: '#00E676', borderRadius: '100px' }} />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '6px' }}>
              <span style={{ color: '#fff', fontWeight: 600 }}>⚡ Ad Spend Auto-Scale & Guardrails</span>
              <span style={{ color: '#00D2FF', fontWeight: 800 }}>86%</span>
            </div>
            <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '100px', overflow: 'hidden' }}>
              <div style={{ width: '86%', height: '100%', background: '#00D2FF', borderRadius: '100px' }} />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '6px' }}>
              <span style={{ color: '#fff', fontWeight: 600 }}>🔍 Competitor Defense & Recon</span>
              <span style={{ color: '#FFB300', fontWeight: 800 }}>78%</span>
            </div>
            <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '100px', overflow: 'hidden' }}>
              <div style={{ width: '78%', height: '100%', background: '#FFB300', borderRadius: '100px' }} />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '6px' }}>
              <span style={{ color: '#fff', fontWeight: 600 }}>🤝 Creator & UGC Pipeline</span>
              <span style={{ color: '#7C75FF', fontWeight: 800 }}>80%</span>
            </div>
            <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '100px', overflow: 'hidden' }}>
              <div style={{ width: '80%', height: '100%', background: '#7C75FF', borderRadius: '100px' }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── 1. BRAND KIT EXTRACTION CARD ──────────────────────────── */}
      <div
        className="glow-card"
        style={{
          background: 'linear-gradient(135deg, rgba(20, 20, 36, 0.75) 0%, rgba(10, 10, 18, 0.95) 100%)',
          border: '1px solid rgba(124, 117, 255, 0.25)',
          borderRadius: '20px',
          padding: '24px 28px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(124, 117, 255, 0.15)', border: '1px solid rgba(124, 117, 255, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Layers size={18} color="#7C75FF" />
              </div>
              <h2 style={{ fontSize: '20px', color: '#fff', margin: 0, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
                Brand kit extraction
              </h2>
              <span style={{ fontSize: '11px', background: 'rgba(0, 230, 118, 0.15)', color: '#00E676', border: '1px solid rgba(0, 230, 118, 0.3)', padding: '2px 8px', borderRadius: '100px', fontWeight: 700 }}>
                100% Extracted
              </span>
            </div>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: 0 }}>
              Review each item once it's ready to make sure we got it right
            </p>
          </div>

          <button
            onClick={() => setShowBrandKitModal(true)}
            style={{
              background: 'linear-gradient(135deg, #7C75FF 0%, #5A52FF 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '100px',
              padding: '9px 24px',
              fontSize: '13.5px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(124, 117, 255, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            Review <ChevronRight size={15} />
          </button>
        </div>

        {/* Checklist of 6 Items */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
          {brandKitItems.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                setActiveBrandKitTab(item.id as any);
                setShowBrandKitModal(true);
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '14px',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(124, 117, 255, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(124, 117, 255, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {item.icon}
                <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#fff' }}>{item.label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#00E676', fontSize: '11px', fontWeight: 700 }}>
                <CheckCircle2 size={13} color="#00E676" />
                <span>Ready</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 2 & 3. DUAL GRID: ACTION NEEDED & TOP PERFORMING CREATIVES ──────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px' }}>
        
        {/* ── ACTION NEEDED ────────────────────────────────────────── */}
        <div
          className="glow-card"
          style={{
            background: 'linear-gradient(180deg, rgba(20, 20, 32, 0.7) 0%, rgba(10, 10, 16, 0.9) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '20px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '300px'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={18} color="#FFB300" />
                <h3 style={{ fontSize: '18px', color: '#fff', margin: 0, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
                  Action Needed
                </h3>
              </div>
              
              <button
                onClick={() => setShowRecommendationsModal(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#7C75FF',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: 0
                }}
              >
                View All Recommendations <ArrowUpRight size={14} />
              </button>
            </div>

            {!isAdAccountConnected ? (
              /* EMPTY CONNECT STATE (User requested text) */
              <div
                style={{
                  padding: '32px 24px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px dashed rgba(255, 255, 255, 0.12)',
                  borderRadius: '16px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '14px'
                }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255, 179, 0, 0.1)', border: '1px solid rgba(255, 179, 0, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertCircle size={24} color="#FFB300" />
                </div>
                <div>
                  <h4 style={{ fontSize: '16px', color: '#fff', margin: '0 0 6px 0', fontWeight: 700 }}>
                    No recommendations yet
                  </h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 auto', maxWidth: '380px', lineHeight: 1.5 }}>
                    Connect an ad account to surface opportunities and decisions from live performance data.
                  </p>
                </div>
                <button
                  onClick={() => setShowConnectModal(true)}
                  style={{
                    background: 'linear-gradient(135deg, #00E676 0%, #00C853 100%)',
                    color: '#000000',
                    border: 'none',
                    borderRadius: '100px',
                    padding: '9px 22px',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(0, 230, 118, 0.3)',
                    marginTop: '4px'
                  }}
                >
                  Connect ad account
                </button>
              </div>
            ) : (
              /* CONNECTED ACTIVE RECOMMENDATIONS PREVIEW */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {mockRecommendations.slice(0, 2).map((rec) => (
                  <div
                    key={rec.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', background: 'rgba(255, 179, 0, 0.15)', color: '#FFB300', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                        {rec.urgency}
                      </span>
                      <span style={{ fontSize: '11.5px', color: '#00E676', fontWeight: 700 }}>{rec.impact}</span>
                    </div>
                    <h5 style={{ fontSize: '13.5px', color: '#fff', margin: 0, fontWeight: 700 }}>{rec.title}</h5>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>{rec.desc}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: 'var(--text-muted)' }}>
            <span>Auto-refresh every 15 min</span>
            <span style={{ color: '#00E676' }}>● AI Performance Engine Active</span>
          </div>
        </div>

        {/* ── TOP PERFORMING CREATIVES ──────────────────────────────── */}
        <div
          className="glow-card"
          style={{
            background: 'linear-gradient(180deg, rgba(20, 20, 32, 0.7) 0%, rgba(10, 10, 16, 0.9) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '20px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '300px'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={18} color="#00E676" />
                <h3 style={{ fontSize: '18px', color: '#fff', margin: 0, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
                  Top Performing Creatives
                </h3>
              </div>

              <button
                onClick={() => onNavigateTab('studio')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#7C75FF',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: 0
                }}
              >
                View Creative Performance <ArrowUpRight size={14} />
              </button>
            </div>

            {!isAdAccountConnected ? (
              /* EMPTY CONNECT STATE (User requested text) */
              <div
                style={{
                  padding: '32px 24px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px dashed rgba(255, 255, 255, 0.12)',
                  borderRadius: '16px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '14px'
                }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(0, 230, 118, 0.1)', border: '1px solid rgba(0, 230, 118, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BarChart3 size={24} color="#00E676" />
                </div>
                <div>
                  <h4 style={{ fontSize: '16px', color: '#fff', margin: '0 0 6px 0', fontWeight: 700 }}>
                    No creative performance yet
                  </h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 auto', maxWidth: '380px', lineHeight: 1.5 }}>
                    Once an ad account is connected, your top-performing creatives will show up here.
                  </p>
                </div>
                <button
                  onClick={() => setShowConnectModal(true)}
                  style={{
                    background: 'linear-gradient(135deg, #00E676 0%, #00C853 100%)',
                    color: '#000000',
                    border: 'none',
                    borderRadius: '100px',
                    padding: '9px 22px',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(0, 230, 118, 0.3)',
                    marginTop: '4px'
                  }}
                >
                  Connect ad account
                </button>
              </div>
            ) : (
              /* CONNECTED ACTIVE CREATIVES PREVIEW */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {mockCreatives.map((cr) => (
                  <div
                    key={cr.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px'
                    }}
                  >
                    <img
                      src={cr.thumbnail}
                      alt={cr.title}
                      style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '10px', background: 'rgba(0,230,118,0.15)', color: '#00E676', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                          {cr.tag}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{cr.type}</span>
                      </div>
                      <h5 style={{ fontSize: '13px', color: '#fff', margin: '2px 0 0 0', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cr.title}
                      </h5>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '14px', color: '#00E676', fontWeight: 800 }}>{cr.roas} ROAS</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Spend: {cr.spend}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: 'var(--text-muted)' }}>
            <span>Attribution: 7-day click, 1-day view</span>
            <span style={{ color: '#7C75FF' }}>● Realtime Meta & Google Sync</span>
          </div>
        </div>
      </div>

      {/* ── 4. SCHEDULED AUTOMATIONS & WORKFLOWS CARD ──────────────── */}
      <div
        className="glow-card"
        style={{
          background: 'linear-gradient(135deg, rgba(20, 20, 36, 0.7) 0%, rgba(10, 10, 16, 0.9) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '20px',
          padding: '24px 28px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(0, 210, 255, 0.15)', border: '1px solid rgba(0, 210, 255, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={18} color="#00D2FF" />
            </div>
            <div>
              <h3 style={{ fontSize: '19px', color: '#fff', margin: 0, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
                Scheduled
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                Automated recurring creative generation, competitor intel, and ad scale routines.
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('scheduler')}
            style={{
              background: 'none',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              borderRadius: '100px',
              padding: '8px 20px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            View Scheduler <ArrowUpRight size={14} />
          </button>
        </div>

        {/* Schedule List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {schedules.map((sch) => (
            <div
              key={sch.id}
              style={{
                background: 'rgba(255, 255, 255, 0.025)',
                border: '1px solid rgba(255, 255, 255, 0.07)',
                borderRadius: '14px',
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${sch.color}15`, border: `1px solid ${sch.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Clock size={18} color={sch.color} />
                </div>
                <div>
                  <h4 style={{ fontSize: '14.5px', color: '#fff', margin: '0 0 3px 0', fontWeight: 700 }}>
                    {sch.title}
                  </h4>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{sch.frequency}</span>
                    <span>•</span>
                    <span style={{ color: sch.color }}>{sch.type}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '11px', background: 'rgba(0, 230, 118, 0.12)', color: '#00E676', border: '1px solid rgba(0, 230, 118, 0.3)', padding: '3px 10px', borderRadius: '100px', fontWeight: 700 }}>
                  ● {sch.status}
                </span>
                <button
                  onClick={() => setShowSchedulerModal(true)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  Configure
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── BRAND KIT REVIEW MODAL ────────────────────────────────── */}
      <AnimatePresence>
        {showBrandKitModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.82)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(10px)',
              padding: '20px'
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                width: '100%',
                maxWidth: '850px',
                maxHeight: '88vh',
                background: '#0a0a10',
                border: '1px solid rgba(124, 117, 255, 0.35)',
                borderRadius: '24px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
              }}
            >
              {/* Modal Header */}
              <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '20px', color: '#fff', margin: '0 0 4px 0', fontWeight: 800 }}>
                    Brand Kit Review & Extraction
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                    Extracted from {brandName} guidelines. Edit or verify each asset below.
                  </p>
                </div>
                <button
                  onClick={() => setShowBrandKitModal(false)}
                  style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '0 20px', overflowX: 'auto' }}>
                {brandKitItems.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveBrandKitTab(tab.id as any)}
                    style={{
                      background: 'none',
                      border: 'none',
                      borderBottom: activeBrandKitTab === tab.id ? '2px solid #00E676' : '2px solid transparent',
                      color: activeBrandKitTab === tab.id ? '#00E676' : 'var(--text-secondary)',
                      padding: '14px 18px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              {/* Modal Tab Content */}
              <div style={{ padding: '28px', overflowY: 'auto', flex: 1 }}>
                {activeBrandKitTab === 'logo' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <h4 style={{ fontSize: '16px', color: '#fff', margin: 0 }}>Extracted Brand Logos</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div style={{ background: '#000', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '24px', textAlign: 'center' }}>
                        <div style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-0.04em', color: '#fff', marginBottom: '8px' }}>
                          {brandName.toUpperCase()}
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Dark Theme SVG Vector (Primary)</span>
                      </div>
                      <div style={{ background: '#ffffff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '24px', textAlign: 'center' }}>
                        <div style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-0.04em', color: '#000000', marginBottom: '8px' }}>
                          {brandName.toUpperCase()}
                        </div>
                        <span style={{ fontSize: '11px', color: '#666' }}>Light Background Monogram</span>
                      </div>
                    </div>
                  </div>
                )}

                {activeBrandKitTab === 'colors' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <h4 style={{ fontSize: '16px', color: '#fff', margin: 0 }}>Color Palette Tokens</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' }}>
                      {[
                        { name: 'Electric Violet (Primary)', hex: '#5A52FF' },
                        { name: 'Neon Emerald (Accent)', hex: '#00E676' },
                        { name: 'Cyan Glow (Highlight)', hex: '#00D2FF' },
                        { name: 'Obsidian Night (Surface)', hex: '#08080C' }
                      ].map((col) => (
                        <div key={col.hex} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '12px' }}>
                          <div style={{ height: '56px', borderRadius: '8px', background: col.hex, marginBottom: '10px', border: '1px solid rgba(255,255,255,0.1)' }} />
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>{col.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{col.hex}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeBrandKitTab === 'typography' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    <h4 style={{ fontSize: '16px', color: '#fff', margin: 0 }}>Typography Hierarchy</h4>
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '20px' }}>
                      <div style={{ fontSize: '24px', fontWeight: 800, color: '#fff', fontFamily: 'var(--font-heading)', marginBottom: '4px' }}>
                        Heading Font: Outfit Display
                      </div>
                      <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                        Body Font: Inter (Weights: 400, 500, 600, 700)
                      </div>
                      <div style={{ fontSize: '12px', color: '#00E676', fontFamily: 'var(--font-mono)' }}>
                        Monospace: JetBrains Mono for Metrics & Financials
                      </div>
                    </div>
                  </div>
                )}

                {activeBrandKitTab === 'knowledge' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h4 style={{ fontSize: '16px', color: '#fff', margin: 0 }}>Extracted Brand Knowledge</h4>
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div>
                        <strong style={{ color: '#00E676', fontSize: '12px', textTransform: 'uppercase' }}>Brand Voice & Tone:</strong>
                        <p style={{ color: '#fff', fontSize: '13.5px', margin: '4px 0 0 0' }}>
                          Premium, visionary, performance-focused, and highly conversion-optimized with clean D2C aesthetics.
                        </p>
                      </div>
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                        <strong style={{ color: '#7C75FF', fontSize: '12px', textTransform: 'uppercase' }}>Primary Value Propositions:</strong>
                        <p style={{ color: '#fff', fontSize: '13.5px', margin: '4px 0 0 0' }}>
                          10x faster creative turnaround, automated multi-channel ad scaling, and verified audience authenticity.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeBrandKitTab === 'assets' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h4 style={{ fontSize: '16px', color: '#fff', margin: 0 }}>Media & Product Assets (28 Synced)</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                      {mockCreatives.map((c) => (
                        <div key={c.id} style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                          <img src={c.thumbnail} alt={c.title} style={{ width: '100%', height: '100px', objectFit: 'cover' }} />
                          <div style={{ padding: '6px', background: '#0d0d14', fontSize: '11px', color: '#fff', textAlign: 'center' }}>
                            {c.type}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeBrandKitTab === 'market' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h4 style={{ fontSize: '16px', color: '#fff', margin: 0 }}>Target Market Demographics</h4>
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '20px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Audience Age</span>
                          <div style={{ fontSize: '16px', color: '#fff', fontWeight: 700, marginTop: '2px' }}>18 – 35 Years (Gen Z / Millennials)</div>
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Geography</span>
                          <div style={{ fontSize: '16px', color: '#fff', fontWeight: 700, marginTop: '2px' }}>India (Delhi, Mumbai, Bengaluru, Pune)</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div style={{ padding: '16px 28px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: 'rgba(255,255,255,0.02)' }}>
                <button
                  onClick={() => setShowBrandKitModal(false)}
                  style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '9px 20px', borderRadius: '100px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Close
                </button>
                <GlowButton variant="glow" onClick={() => { setShowBrandKitModal(false); alert('Brand Kit confirmed and synced across AI Agents!'); }} style={{ padding: '9px 24px', fontSize: '13px' }}>
                  Confirm & Save Kit ✓
                </GlowButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── AD ACCOUNT CONNECTOR MODAL ────────────────────────────── */}
      <AnimatePresence>
        {showConnectModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.82)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(10px)',
              padding: '20px'
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                width: '100%',
                maxWidth: '560px',
                background: '#0a0a12',
                border: '1px solid rgba(0, 230, 118, 0.35)',
                borderRadius: '24px',
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '20px', color: '#fff', margin: '0 0 4px 0', fontWeight: 800 }}>
                    Connect Ad Account
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                    Surface live ROAS opportunities, recommendations & top creative analytics.
                  </p>
                </div>
                <button
                  onClick={() => setShowConnectModal(false)}
                  style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '60vh', overflowY: 'auto', paddingRight: '4px' }}>
                {[
                  { id: 'meta', name: 'Meta Ads', desc: 'Run and optimize ads across Facebook, Instagram, Threads, and more.', tag: 'Ad Account', isLocked: false },
                  { id: 'google', name: 'Google Ads', desc: 'Run and optimize ads across Search, YouTube, Maps, Gmail, and more.', tag: 'Ad Account', isLocked: false },
                  { id: 'chatgpt', name: 'ChatGPT Ads', desc: 'Run and optimize ads in ChatGPT conversations.', tag: 'Coming Soon', isLocked: true },
                  { id: 'amazon', name: 'Amazon Ads', desc: 'Run and optimize product ads on Amazon.', tag: 'Coming Soon', isLocked: true },
                  { id: 'ga4', name: 'Google Analytics 4', desc: 'Pull traffic, event, and conversion data across your site and campaigns.', tag: 'Analytics', isLocked: false },
                  { id: 'gsc', name: 'Google Search Console', desc: 'Monitor organic search rankings, keyword impressions, CTR, and indexing health.', tag: 'Analytics', isLocked: false },
                  { id: 'drive', name: 'Google Drive', desc: 'Sync brand assets, video footage, product catalogs, and creative guidelines.', tag: 'Productivity', isLocked: false },
                  { id: 'slack', name: 'Slack', desc: 'Receive real-time campaign alerts and creative approval requests.', tag: 'Team Alert', isLocked: false },
                  { id: 'hubspot', name: 'HubSpot', desc: 'Sync leads, CRM contacts, deals, and attribution pipelines.', tag: 'CRM', isLocked: false }
                ].map((plat) => (
                  <div
                    key={plat.id}
                    style={{
                      background: plat.isLocked ? 'rgba(255, 255, 255, 0.015)' : 'rgba(255, 255, 255, 0.03)',
                      border: plat.isLocked ? '1px dashed rgba(255, 255, 255, 0.1)' : '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '14px',
                      padding: '14px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      opacity: plat.isLocked ? 0.75 : 1
                    }}
                  >
                    <div style={{ flex: 1, paddingRight: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <span style={{ fontSize: '14.5px', color: '#fff', fontWeight: 700 }}>{plat.name}</span>
                        <span style={{
                          fontSize: '10px',
                          background: plat.isLocked ? 'rgba(255, 179, 0, 0.15)' : 'rgba(90,82,255,0.15)',
                          color: plat.isLocked ? '#FFB300' : '#7C75FF',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: 700
                        }}>
                          {plat.isLocked ? '🔒 Coming Soon' : plat.tag}
                        </span>
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.35 }}>{plat.desc}</span>
                    </div>

                    {plat.isLocked ? (
                      <span style={{ fontSize: '11px', color: '#FFB300', background: 'rgba(255,179,0,0.1)', border: '1px solid rgba(255,179,0,0.3)', padding: '5px 12px', borderRadius: '100px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        🔒 Locked
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSimulateConnect(plat.id)}
                        disabled={Boolean(connectingPlatform)}
                        style={{
                          background: 'linear-gradient(135deg, #00E676 0%, #00C853 100%)',
                          color: '#000000',
                          border: 'none',
                          borderRadius: '100px',
                          padding: '8px 18px',
                          fontSize: '12px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {connectingPlatform === plat.id ? 'Connecting...' : 'Connect'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── RECOMMENDATIONS MODAL ─────────────────────────────────── */}
      <AnimatePresence>
        {showRecommendationsModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.82)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(10px)',
              padding: '20px'
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                width: '100%',
                maxWidth: '650px',
                background: '#0a0a12',
                border: '1px solid rgba(255, 179, 0, 0.35)',
                borderRadius: '24px',
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '20px', color: '#fff', margin: '0 0 4px 0', fontWeight: 800 }}>
                    AI Recommendations & Opportunities
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                    Live algorithmic decisions calculated from your creative & campaign telemetry.
                  </p>
                </div>
                <button
                  onClick={() => setShowRecommendationsModal(false)}
                  style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {mockRecommendations.map((rec) => (
                  <div
                    key={rec.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '14px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', background: 'rgba(255, 179, 0, 0.15)', color: '#FFB300', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                        {rec.urgency}
                      </span>
                      <span style={{ fontSize: '12px', color: '#00E676', fontWeight: 700 }}>{rec.impact}</span>
                    </div>
                    <h4 style={{ fontSize: '14px', color: '#fff', margin: 0, fontWeight: 700 }}>{rec.title}</h4>
                    <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{rec.desc}</p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                      <GlowButton variant="glow" onClick={() => { alert(`Applied recommendation: ${rec.title}`); setShowRecommendationsModal(false); }} style={{ padding: '6px 16px', fontSize: '12px' }}>
                        Apply 1-Click Optimization ⚡
                      </GlowButton>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── SCHEDULER CONFIG MODAL ────────────────────────────────── */}
      <AnimatePresence>
        {showSchedulerModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.82)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(10px)',
              padding: '20px'
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                width: '100%',
                maxWidth: '650px',
                background: '#0a0a12',
                border: '1px solid rgba(0, 210, 255, 0.35)',
                borderRadius: '24px',
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '20px', color: '#fff', margin: '0 0 4px 0', fontWeight: 800 }}>
                    Automated Workflows Scheduler
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                    Recurring background jobs executed by Raftra AI Agent nodes for {brandName}.
                  </p>
                </div>
                <button
                  onClick={() => setShowSchedulerModal(false)}
                  style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {schedules.map((sch) => (
                  <div
                    key={sch.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '14px',
                      padding: '16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <h4 style={{ fontSize: '14.5px', color: '#fff', margin: '0 0 3px 0', fontWeight: 700 }}>
                        {sch.title}
                      </h4>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{sch.frequency}</div>
                    </div>

                    <button
                      onClick={() => alert(`Triggered manual execution of "${sch.title}"!`)}
                      style={{
                        background: 'rgba(0, 210, 255, 0.12)',
                        border: '1px solid rgba(0, 210, 255, 0.3)',
                        color: '#00D2FF',
                        borderRadius: '100px',
                        padding: '6px 16px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Run Now 🚀
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  onClick={() => setShowSchedulerModal(false)}
                  style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '9px 20px', borderRadius: '100px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
