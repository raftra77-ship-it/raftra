import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  TrendingUp,
  ShieldCheck,
  Calendar,
  Clock,
  ExternalLink,
  Sparkles,
  Copy,
  Check,
  Download,
  Flame,
  Search,
  Filter,
  RefreshCw,
  Layers,
  Zap,
  Target,
  ArrowRight,
  Eye,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Bookmark,
  Share2,
  Tag,
  Lock,
  CheckCircle
} from 'lucide-react';
import { GlowButton } from '../GlowButton';

interface WorkspaceReportsProps {
  onNavigateTab?: (tab: string) => void;
  brandName?: string;
}

export const WorkspaceReports: React.FC<WorkspaceReportsProps> = ({
  onNavigateTab,
  brandName = 'Demo Brand'
}) => {
  const [activeTab, setActiveTab] = useState<'competitor_ads' | 'market_research'>('competitor_ads');
  const [selectedCompetitor, setSelectedCompetitor] = useState<'all' | 'portronics' | 'stuffcool'>('all');
  const [adFilterType, setAdFilterType] = useState<string>('all');
  const [copiedHook, setCopiedHook] = useState<string | null>(null);

  // Sync & Cooldown States
  const [isSyncingAds, setIsSyncingAds] = useState(false);
  const [isGeneratingMonthly, setIsGeneratingMonthly] = useState(false);
  const [adsLockedUntil, setAdsLockedUntil] = useState<string | null>(null); // 14 days
  const [monthlyLockedUntil, setMonthlyLockedUntil] = useState<string | null>(null); // 30 days

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHook(text);
    setTimeout(() => setCopiedHook(null), 2000);
  };

  // 1. Sync 2 Weeks Competitor Ads Handler
  const handleSyncCompetitorAds = () => {
    if (adsLockedUntil) {
      alert(`⚠️ Bi-weekly Competitor Ad scan already locked! Next scan unlocks on ${adsLockedUntil}.`);
      return;
    }
    setIsSyncingAds(true);
    setTimeout(() => {
      setIsSyncingAds(false);
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 14);
      const dateStr = nextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      setAdsLockedUntil(dateStr);
      alert(`✓ Synced 40 active Meta competitor ads! This action is now locked for 14 days (Unlocks on ${dateStr}).`);
    }, 1200);
  };

  // 2. Generate Monthly Report Handler
  const handleGenerateMonthlyReport = () => {
    if (monthlyLockedUntil) {
      alert(`⚠️ Monthly Market Research Report already generated! Next report unlocks on ${monthlyLockedUntil}.`);
      return;
    }
    setIsGeneratingMonthly(true);
    setTimeout(() => {
      setIsGeneratingMonthly(false);
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 30);
      const dateStr = nextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      setMonthlyLockedUntil(dateStr);
      alert(`✓ Generated 30-Day India Market Research Report! This action is now locked for 30 days (Unlocks on ${dateStr}).`);
    }, 1500);
  };

  // Strategic Keywords for Monthly Market Research
  const strategicKeywords = [
    {
      keyword: 'power bank',
      bucket: 'core',
      avgInterest: 84,
      adHook: '“One power bank. No dead-phone panic.” Open with a real low-battery moment, then prove the recovery.',
      badgeColor: '#00E676'
    },
    {
      keyword: 'charging cable',
      bucket: 'core',
      avgInterest: 78,
      adHook: '“Your cable does more than charge.” Lead with the built-in/utility benefit and a fast visual test.',
      badgeColor: '#00E676'
    },
    {
      keyword: 'MagSafe power bank',
      bucket: 'emerging',
      avgInterest: 24,
      adHook: '“Snap. Charge. Keep moving.” Use an iPhone-on-the-go scene rather than a feature list.',
      badgeColor: '#7C75FF'
    },
    {
      keyword: 'fast charger',
      bucket: 'core',
      avgInterest: 8,
      adHook: '“The charger that keeps up with your day.” Show a timed fast-charge proof and multi-device use.',
      badgeColor: '#00D2FF'
    },
    {
      keyword: '100W charger',
      bucket: 'lifestyle',
      avgInterest: 8,
      adHook: '“One desk charger for laptop, phone and travel.” Demonstrate ports, laptop compatibility and packability.',
      badgeColor: '#FFB300'
    }
  ];

  // 40 Meta Ads Data from Ad Library
  const competitorAds = [
    {
      id: 'ad-1',
      brand: 'Portronics',
      title: 'Muffs M6 – Made for Music, Movies & More',
      type: 'Static Banner',
      hook: 'Cinema sound in your backpack. 50h playback with ultra-soft cushions.',
      offer: '10% Extra Off with code TODAY',
      cta: 'Shop now',
      runningDays: '28 days active',
      tag: 'Broad Merchandising',
      category: 'Audio',
      color: '#7C75FF'
    },
    {
      id: 'ad-2',
      brand: 'Portronics',
      title: 'Play Longer with Twins One',
      type: 'Static Commerce',
      hook: 'Switch effortlessly between work and play with dual device pairing.',
      offer: '10% Extra Off with code TODAY',
      cta: 'Shop now',
      runningDays: '21 days active',
      tag: 'Value Promotion',
      category: 'Audio',
      color: '#7C75FF'
    },
    {
      id: 'ad-3',
      brand: 'Portronics',
      title: 'Stylish, Silent & Smart – Meet Key11 Combo',
      type: 'Static Banner',
      hook: 'Smart tech, cute setup – now that’s a vibe.',
      offer: '10% Extra Off with code TODAY',
      cta: 'Shop now',
      runningDays: '16 days active',
      tag: 'Desk Setup',
      category: 'Peripherals',
      color: '#7C75FF'
    },
    {
      id: 'ad-4',
      brand: 'Portronics',
      title: 'Beem 560 - Smart LED Netflix Projector',
      type: 'Video Ad',
      hook: 'Turn your bedroom ceiling into a 150-inch private cinema.',
      offer: '10% Extra Off with code TODAY',
      cta: 'Shop now',
      runningDays: '35 days active',
      tag: 'Long Running Winner',
      category: 'Entertainment',
      color: '#7C75FF'
    },
    {
      id: 'ad-5',
      brand: 'Portronics',
      title: 'Adapto 65W GaN Fast Charger',
      type: 'Static Ad',
      hook: 'One compact adapter for iPhone, Android, and your Type-C laptop.',
      offer: '10% Extra Off with code TODAY',
      cta: 'Shop now',
      runningDays: '14 days active',
      tag: 'Feature Led',
      category: 'Charging',
      color: '#7C75FF'
    },
    {
      id: 'ad-6',
      brand: 'Portronics',
      title: 'Konnect CL Type-C to Lightning Cable',
      type: 'Static Ad',
      hook: 'Unbreakable nylon braided fast charging cable with 12-month warranty.',
      offer: '10% Extra Off with code TODAY',
      cta: 'Shop now',
      runningDays: '42 days active',
      tag: 'Utility Volume',
      category: 'Cables',
      color: '#7C75FF'
    },
    {
      id: 'ad-7',
      brand: 'StuffCool',
      title: 'Mega 20000mAh 65W Laptop Power Bank',
      type: 'Video Reel',
      hook: 'Charge your MacBook anywhere. Full 65W PD output in your backpack.',
      offer: 'Free Fast Delivery + Cable Included',
      cta: 'Shop now',
      runningDays: '32 days active',
      tag: 'High Wattage Winner',
      category: 'Power Banks',
      color: '#00D2FF'
    },
    {
      id: 'ad-8',
      brand: 'StuffCool',
      title: 'Neutron 33W Tiny GaN Fast Charger',
      type: 'Static Ad',
      hook: 'Smaller than an iPhone camera bump. Powers iPhones & Samsungs to 50% in 25 mins.',
      offer: 'Standard Warranty Included',
      cta: 'Shop now',
      runningDays: '19 days active',
      tag: 'Form Factor Hook',
      category: 'Chargers',
      color: '#00D2FF'
    },
    {
      id: 'ad-9',
      brand: 'StuffCool',
      title: 'Magnetic MagSafe Wireless Powerbank with Stand',
      type: 'Video Reel',
      hook: 'Snap. Stand. Binge watch while wireless charging your iPhone 15 & 16.',
      offer: 'Special Bundle Pricing',
      cta: 'Shop now',
      runningDays: '27 days active',
      tag: 'Lifestyle MagSafe',
      category: 'Power Banks',
      color: '#00D2FF'
    },
    {
      id: 'ad-10',
      brand: 'StuffCool',
      title: 'Centurion 100W 4-Port Fast Desktop Charger',
      type: 'Static Ad',
      hook: 'Replace 4 bulky adapters with one sleek GaN charging hub.',
      offer: 'Free Worldwide Delivery',
      cta: 'Shop now',
      runningDays: '15 days active',
      tag: 'Desk Heavy Duty',
      category: 'Chargers',
      color: '#00D2FF'
    },
    {
      id: 'ad-11',
      brand: 'StuffCool',
      title: 'Type-C 100W Braided Cable with LED Wattage Display',
      type: 'Video Ad',
      hook: 'See your real-time charging speed right on the cable screen.',
      offer: 'Instant Dispatch',
      cta: 'Shop now',
      runningDays: '38 days active',
      tag: 'Visual Proof Ad',
      category: 'Cables',
      color: '#00D2FF'
    },
    {
      id: 'ad-12',
      brand: 'StuffCool',
      title: 'PowerBolt 25000mAh 140W MacBook Pro Monster',
      type: 'Video Reel',
      hook: 'Fast charge a 16-inch M3 Max MacBook Pro at full throttle anywhere on Earth.',
      offer: 'Premium Metal Finish',
      cta: 'Shop now',
      runningDays: '12 days active',
      tag: 'Extreme Power Spec',
      category: 'Power Banks',
      color: '#00D2FF'
    }
  ];

  const filteredAds = competitorAds.filter(ad => {
    if (selectedCompetitor !== 'all' && ad.brand.toLowerCase() !== selectedCompetitor) return false;
    if (adFilterType !== 'all' && ad.category.toLowerCase() !== adFilterType.toLowerCase()) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* ── HEADER BANNER & TIMELINE CARDS ───────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: 'rgba(124, 117, 255, 0.12)', borderRadius: '100px', border: '1px solid rgba(124, 117, 255, 0.3)', marginBottom: '8px' }}>
            <Sparkles size={13} color="#7C75FF" />
            <span style={{ fontSize: '11px', color: '#7C75FF', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              AUTONOMOUS AD INTELLIGENCE ENGINE
            </span>
          </div>
          <h1 style={{ fontSize: '32px', color: '#fff', margin: '0 0 6px 0', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
            Intelligence & Strategic Reports
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14.5px', margin: 0 }}>
            Bi-weekly Meta Ad Library competitor scans and monthly India search demand trend reports for {brandName}.
          </p>
        </div>

        {/* ── TWO DEDICATED ACTION BUTTONS WITH COOLDOWN UNLOCK LOCKS ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          
          {/* Button 1: Sync 2 Weeks Competitor Ads */}
          <button
            onClick={handleSyncCompetitorAds}
            disabled={isSyncingAds || !!adsLockedUntil}
            style={{
              background: adsLockedUntil ? 'rgba(255, 255, 255, 0.04)' : 'rgba(124, 117, 255, 0.15)',
              border: adsLockedUntil ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(124, 117, 255, 0.4)',
              color: adsLockedUntil ? 'var(--text-muted)' : '#7C75FF',
              padding: '9px 18px',
              borderRadius: '100px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: adsLockedUntil ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
              boxShadow: adsLockedUntil ? 'none' : '0 0 14px rgba(124, 117, 255, 0.15)'
            }}
          >
            {adsLockedUntil ? (
              <>
                <Lock size={13} color="var(--text-muted)" />
                <span>2-Wk Ads Synced (Next: {adsLockedUntil})</span>
              </>
            ) : isSyncingAds ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>Syncing Meta Ads...</span>
              </>
            ) : (
              <>
                <RefreshCw size={13} />
                <span>Sync 2 Weeks Competitor Ads</span>
              </>
            )}
          </button>

          {/* Button 2: Generate Monthly Report */}
          <button
            onClick={handleGenerateMonthlyReport}
            disabled={isGeneratingMonthly || !!monthlyLockedUntil}
            style={{
              background: monthlyLockedUntil ? 'rgba(255, 255, 255, 0.04)' : 'linear-gradient(135deg, #00E676 0%, #00C853 100%)',
              border: monthlyLockedUntil ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
              color: monthlyLockedUntil ? 'var(--text-muted)' : '#000000',
              padding: '9px 20px',
              borderRadius: '100px',
              fontSize: '13px',
              fontWeight: 800,
              cursor: monthlyLockedUntil ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
              boxShadow: monthlyLockedUntil ? 'none' : '0 4px 18px rgba(0, 230, 118, 0.35)'
            }}
          >
            {monthlyLockedUntil ? (
              <>
                <Lock size={13} color="var(--text-muted)" />
                <span>Monthly Report Generated (Next: {monthlyLockedUntil})</span>
              </>
            ) : isGeneratingMonthly ? (
              <>
                <Sparkles size={13} className="animate-spin" />
                <span>Generating Report...</span>
              </>
            ) : (
              <>
                <Sparkles size={13} />
                <span>Generate Monthly Report 🚀</span>
              </>
            )}
          </button>

        </div>
      </div>

      {/* ── 2 FREQUENCY STATUS CARDS ──────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        
        {/* Card 1: Bi-weekly Competitor Analysis */}
        <div
          onClick={() => setActiveTab('competitor_ads')}
          className="glow-card"
          style={{
            background: activeTab === 'competitor_ads' ? 'linear-gradient(135deg, rgba(28, 24, 45, 0.9) 0%, rgba(12, 10, 22, 0.98) 100%)' : '#0a0a12',
            border: activeTab === 'competitor_ads' ? '1.5px solid #7C75FF' : '1px solid rgba(255,255,255,0.08)',
            borderRadius: '20px',
            padding: '22px 26px',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: activeTab === 'competitor_ads' ? '0 8px 30px rgba(124, 117, 255, 0.2)' : 'none',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(124, 117, 255, 0.15)', border: '1px solid rgba(124, 117, 255, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={22} color="#7C75FF" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '17px', color: '#fff', margin: 0, fontWeight: 800 }}>
                  Competitor Ad Analysis
                </h3>
                <span style={{ fontSize: '10.5px', background: 'rgba(124, 117, 255, 0.2)', color: '#7C75FF', border: '1px solid rgba(124, 117, 255, 0.4)', padding: '2px 8px', borderRadius: '100px', fontWeight: 800 }}>
                  BI-WEEKLY (14 DAYS)
                </span>
              </div>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                40 Active Meta Ads scanned • Next scan {adsLockedUntil ? `unlocked on ${adsLockedUntil}` : 'ready to sync'}
              </p>
            </div>
          </div>
          <ArrowRight size={18} color={activeTab === 'competitor_ads' ? '#7C75FF' : 'var(--text-muted)'} />
        </div>

        {/* Card 2: Monthly Market Research */}
        <div
          onClick={() => setActiveTab('market_research')}
          className="glow-card"
          style={{
            background: activeTab === 'market_research' ? 'linear-gradient(135deg, rgba(20, 35, 25, 0.9) 0%, rgba(10, 18, 14, 0.98) 100%)' : '#0a0a12',
            border: activeTab === 'market_research' ? '1.5px solid #00E676' : '1px solid rgba(255,255,255,0.08)',
            borderRadius: '20px',
            padding: '22px 26px',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: activeTab === 'market_research' ? '0 8px 30px rgba(0, 230, 118, 0.2)' : 'none',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(0, 230, 118, 0.15)', border: '1px solid rgba(0, 230, 118, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={22} color="#00E676" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '17px', color: '#fff', margin: 0, fontWeight: 800 }}>
                  India Market Trend Radar
                </h3>
                <span style={{ fontSize: '10.5px', background: 'rgba(0, 230, 118, 0.2)', color: '#00E676', border: '1px solid rgba(0, 230, 118, 0.4)', padding: '2px 8px', borderRadius: '100px', fontWeight: 800 }}>
                  MONTHLY (30 DAYS)
                </span>
              </div>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Festive Run-Up & Search Intent • Next issue {monthlyLockedUntil ? `unlocked on ${monthlyLockedUntil}` : 'ready to generate'}
              </p>
            </div>
          </div>
          <ArrowRight size={18} color={activeTab === 'market_research' ? '#00E676' : 'var(--text-muted)'} />
        </div>

      </div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* TAB 1: COMPETITOR AD LIBRARY (BI-WEEKLY SCANS)               */}
      {/* ════════════════════════════════════════════════════════════ */}
      {activeTab === 'competitor_ads' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          {/* Executive Summary Card */}
          <div className="glow-card" style={{ background: '#0a0a12', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '20px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '10px' }}>
              <span style={{ fontSize: '11px', color: '#7C75FF', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {brandName.toUpperCase()} COMPETITOR AD REPORT · IN · META ADS
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Observed on August 18, 2026</span>
            </div>
            <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.9)', margin: 0, lineHeight: 1.6 }}>
              <strong>Portronics</strong> uses broad, feature-led electronics merchandising with a recurring 10% coupon, while <strong>StuffCool</strong> owns the sharper high-wattage, laptop-ready power narrative. The opening for <strong>{brandName}</strong> is to turn its charging range into scenario-led proof: pocket backup, cable-free iPhone charging, and dependable laptop power—without relying on spec density alone.
            </p>
          </div>

          {/* Where We Win + Blue / Red Ocean Moves */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
            
            {/* Where We Win */}
            <div className="glow-card" style={{ background: 'linear-gradient(135deg, rgba(0, 230, 118, 0.08) 0%, rgba(10, 20, 15, 0.9) 100%)', border: '1.5px solid rgba(0, 230, 118, 0.3)', borderRadius: '18px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="#00E676" />
                <h4 style={{ fontSize: '16px', color: '#fff', margin: 0, fontWeight: 800 }}>
                  Where We Win ({brandName} Advantage)
                </h4>
              </div>
              <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.85)', margin: 0, lineHeight: 1.5 }}>
                {brandName} can own <strong>practical, proudly Indian charging confidence</strong>: modern power for the exact device and moment people depend on.
              </p>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div>• Neither competitor consistently organizes the charging decision around everyday scenarios.</div>
                <div>• Portronics lacks charging authority; StuffCool underplays approachable convenience.</div>
                <div>• Both use universal <em>"Shop now"</em>, leaving room for decision-support creative.</div>
              </div>
            </div>

            {/* Blue Ocean / Red Ocean Strategy */}
            <div className="glow-card" style={{ background: 'linear-gradient(135deg, rgba(124, 117, 255, 0.08) 0%, rgba(15, 12, 25, 0.9) 100%)', border: '1.5px solid rgba(124, 117, 255, 0.3)', borderRadius: '18px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Target size={18} color="#7C75FF" />
                <h4 style={{ fontSize: '16px', color: '#fff', margin: 0, fontWeight: 800 }}>
                  Blue Ocean & Red Ocean Moves
                </h4>
              </div>
              <div style={{ fontSize: '12.5px', color: 'rgba(255, 255, 255, 0.85)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div>🌊 <strong style={{ color: '#00D2FF' }}>Blue Ocean:</strong> Scenario-led charging confidence (Commute, campus, MacBook workday, iPhone desk).</div>
                <div>🥊 <strong style={{ color: '#ff4757' }}>Red Ocean:</strong> Win high-power proof with transparent workday compatibility rather than generic superlatives.</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '8px 12px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                Action: Produce a 4-part scenario Meta creative series & guided choice carousel.
              </div>
            </div>

          </div>

          {/* Ad Library Telemetry Explorer */}
          <div className="glow-card" style={{ background: '#0a0a12', borderRadius: '20px', padding: '24px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <h3 style={{ fontSize: '18px', color: '#fff', margin: 0, fontWeight: 800 }}>
                  Active Meta Ads in India ({filteredAds.length} Displayed)
                </h3>
                <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                  Scraped and classified from Meta Ad Library • Updated bi-weekly
                </span>
              </div>

              {/* Filters */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <select
                  value={selectedCompetitor}
                  onChange={e => setSelectedCompetitor(e.target.value as any)}
                  style={{ background: '#141420', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', padding: '6px 12px', borderRadius: '8px', fontSize: '12.5px' }}
                >
                  <option value="all">All Brands (Portronics + StuffCool)</option>
                  <option value="portronics">Portronics Only (20 Ads)</option>
                  <option value="stuffcool">StuffCool Only (20 Ads)</option>
                </select>

                <select
                  value={adFilterType}
                  onChange={e => setAdFilterType(e.target.value)}
                  style={{ background: '#141420', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', padding: '6px 12px', borderRadius: '8px', fontSize: '12.5px' }}
                >
                  <option value="all">All Categories</option>
                  <option value="charging">Power & Charging</option>
                  <option value="audio">Audio & TWS</option>
                  <option value="cables">Cables</option>
                  <option value="peripherals">Desk & Accessories</option>
                </select>
              </div>
            </div>

            {/* Ad Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
              {filteredAds.map((ad) => (
                <div
                  key={ad.id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.07)',
                    borderRadius: '16px',
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', background: `${ad.color}22`, color: ad.color, border: `1px solid ${ad.color}44`, padding: '2px 8px', borderRadius: '100px', fontWeight: 800 }}>
                        {ad.brand}
                      </span>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{ad.runningDays}</span>
                    </div>

                    <h4 style={{ fontSize: '15px', color: '#fff', margin: '0 0 6px 0', fontWeight: 700 }}>
                      {ad.title}
                    </h4>

                    <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.8)', margin: '0 0 10px 0', lineHeight: 1.45 }}>
                      "{ad.hook}"
                    </p>
                  </div>

                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '11.5px', color: '#00E676' }}>
                      🏷️ {ad.offer}
                    </div>
                    <button
                      onClick={() => handleCopy(ad.hook)}
                      style={{
                        background: copiedHook === ad.hook ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid',
                        borderColor: copiedHook === ad.hook ? '#00E676' : 'rgba(255, 255, 255, 0.1)',
                        color: copiedHook === ad.hook ? '#00E676' : '#fff',
                        padding: '4px 10px',
                        borderRadius: '100px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {copiedHook === ad.hook ? <Check size={11} /> : <Copy size={11} />}
                      <span>{copiedHook === ad.hook ? 'Copied' : 'Copy Hook'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3 Core Action Items */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '18px' }}>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#7C75FF', marginBottom: '4px' }}>01</div>
              <h4 style={{ fontSize: '15px', color: '#fff', margin: '0 0 6px 0', fontWeight: 700 }}>Build Scenario Series</h4>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                Scenario-first creative gives {brandName} a more ownable route than broad gadget merchandising.
              </p>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '18px' }}>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#00D2FF', marginBottom: '4px' }}>02</div>
              <h4 style={{ fontSize: '15px', color: '#fff', margin: '0 0 6px 0', fontWeight: 700 }}>Create Choice Carousel</h4>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                A guided product-selection carousel reduces choice friction left unresolved by universal Shop now buttons.
              </p>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '18px' }}>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#00E676', marginBottom: '4px' }}>03</div>
              <h4 style={{ fontSize: '15px', color: '#fff', margin: '0 0 6px 0', fontWeight: 700 }}>Prove Laptop Power</h4>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                StuffCool dominates high-wattage claims; real workday demo with compatibility proof wins conversion.
              </p>
            </div>
          </div>

        </div>
      )}

      {/* ════════════════════════════════════════════════════════════ */}
      {/* TAB 2: MARKET RESEARCH & TRENDS (MONTHLY EDITION)             */}
      {/* ════════════════════════════════════════════════════════════ */}
      {activeTab === 'market_research' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          {/* Monthly Report Overview Banner */}
          <div className="glow-card" style={{ background: '#0a0a12', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '20px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '10px' }}>
              <span style={{ fontSize: '11px', color: '#00E676', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                INDIA CHARGING TRENDS: {brandName.toUpperCase()}’S FESTIVE RUN-UP (MONTHLY EDITION)
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>August 17, 2025 – August 22, 2026 Review</span>
            </div>
            <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.9)', margin: 0, lineHeight: 1.6 }}>
              India’s charging category is still led by broad utility searches: <strong>“power bank” (84)</strong> and <strong>“charging cable” (78)</strong>. Emerging lanes are high-intent: <strong>“MagSafe power bank” (24)</strong> and <strong>“fast charger”</strong> reaching annual highs in mid-August. Short video proof and Diwali festive bundles are the primary conversion levers for {brandName}.
            </p>
          </div>

          {/* Strategic Keywords & Copyable Hooks */}
          <div className="glow-card" style={{ background: '#0a0a12', borderRadius: '20px', padding: '24px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <h3 style={{ fontSize: '18px', color: '#fff', margin: '0 0 16px 0', fontWeight: 800 }}>
              Strategic Keywords & High-Converting Ad Hooks
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {strategicKeywords.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '14px',
                    padding: '14px 18px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${item.badgeColor}22`, border: `1px solid ${item.badgeColor}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.badgeColor, fontWeight: 900, fontSize: '14px' }}>
                      {item.avgInterest}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h4 style={{ fontSize: '15px', color: '#fff', margin: 0, fontWeight: 700 }}>
                          {item.keyword}
                        </h4>
                        <span style={{ fontSize: '10.5px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: '6px', textTransform: 'uppercase', fontWeight: 700 }}>
                          {item.bucket}
                        </span>
                      </div>
                      <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', margin: '4px 0 0 0' }}>
                        {item.adHook}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleCopy(item.adHook)}
                    style={{
                      background: copiedHook === item.adHook ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid',
                      borderColor: copiedHook === item.adHook ? '#00E676' : 'rgba(255, 255, 255, 0.12)',
                      color: copiedHook === item.adHook ? '#00E676' : '#fff',
                      padding: '6px 14px',
                      borderRadius: '100px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    {copiedHook === item.adHook ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedHook === item.adHook ? 'Copied!' : 'Copy Hook'}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Winning Patterns & Creator References */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
            <div className="glow-card" style={{ background: 'rgba(0, 230, 118, 0.04)', border: '1px solid rgba(0, 230, 118, 0.25)', borderRadius: '18px', padding: '22px' }}>
              <h4 style={{ fontSize: '16px', color: '#fff', margin: '0 0 12px 0', fontWeight: 700 }}>
                Winning Patterns in India Content
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
                <div>• <strong>Real Test Short Videos:</strong> Battery-vs-phone drain challenges outperforming static specs.</div>
                <div>• <strong>Built-in Cable Visuals:</strong> Instantly understood in metro, college, and desk setups.</div>
                <div>• <strong>Diwali Festive Bundles (Nov 2026):</strong> Transition from pure utility to gifting & travel upgrade sets starting September.</div>
              </div>
            </div>

            <div className="glow-card" style={{ background: '#0a0a12', borderRadius: '18px', padding: '22px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <h4 style={{ fontSize: '16px', color: '#fff', margin: '0 0 12px 0', fontWeight: 700 }}>
                Creator Video References
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { title: 'Thor Wala Powerbank ⚡ #shorts', url: 'https://www.youtube.com/watch?v=mpuqxOWKdZ8' },
                  { title: 'New Fast PowerBank From Xiaomi - Test !', url: 'https://www.youtube.com/watch?v=plp4hkEEQ0c' },
                  { title: 'Throw Away Your Charging Cables 🚨', url: 'https://www.youtube.com/watch?v=pNJlpb79oSA' }
                ].map((v, i) => (
                  <a
                    key={i}
                    href={v.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px 14px', textDecoration: 'none', color: '#fff', fontSize: '12.5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span>{v.title}</span>
                    <ExternalLink size={13} color="#7C75FF" />
                  </a>
                ))}
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
