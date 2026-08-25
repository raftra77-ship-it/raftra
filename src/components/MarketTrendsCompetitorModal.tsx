import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  TrendingUp,
  Search,
  Zap,
  Target,
  Layers,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  Play,
  ArrowRight,
  BarChart2,
  PieChart,
  Globe,
  Flame,
  Bookmark,
  Share2,
  Download,
  Eye
} from 'lucide-react';
import { GlowButton } from './GlowButton';

interface MarketTrendsCompetitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const MarketTrendsCompetitorModal: React.FC<MarketTrendsCompetitorModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab
}) => {
  const [activeReportTab, setActiveReportTab] = useState<'competitor_ads' | 'keyword_trends'>('competitor_ads');
  const [copiedHook, setCopiedHook] = useState<string | null>(null);
  const [activeCompetitorTab, setActiveCompetitorTab] = useState<'portronics' | 'stuffcool'>('portronics');

  if (!isOpen) return null;

  const handleCopyHook = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHook(text);
    setTimeout(() => setCopiedHook(null), 2000);
  };

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

  const portronicsAds = [
    'Portronics - Muffs M6 – Made for Music, Movies & More',
    'Portronics - Play Longer with Twins One',
    'Portronics - Stylish, Silent & Smart – Meet Key11 Combo',
    'Portronics - Turn Up the Fun with Dual Karaoke Mics',
    'Portronics - Pure Air for Your Family',
    'Portronics - Beem 560 - Smart LED Netflix Projector',
    'Portronics - Aerolift Duo - Dual Monitor Desk Mount',
    'Portronics - Ruffpad 15M Re-writable LCD Pad',
    'Portronics - Dash 12 Wireless Bluetooth Speaker',
    'Portronics - Talk 2 Bluetooth Calling Smartwatch',
    'Portronics - Clamp M2 Car Mobile Holder',
    'Portronics - Power Plate 7 Power Strip with USB',
    'Portronics - Adapto 65W GaN Fast Charger',
    'Portronics - Konnect CL Type-C to Lightning Cable',
    'Portronics - Auto 10 Bluetooth Audio Receiver',
    'Portronics - SoundDrum 1 10W TWS Speaker',
    'Portronics - Mobike Motorcycle Mobile Holder',
    'Portronics - My Buddy K6 Portable Laptop Stand',
    'Portronics - Toad 23 Wireless Optical Mouse',
    'Portronics - Harmonics Z5 Neckband Earphones'
  ];

  const stuffCoolAds = [
    'StuffCool - Mega 20000mAh 65W Laptop Power Bank',
    'StuffCool - Neutron 33W Tiny GaN Fast Charger',
    'StuffCool - Magnetic MagSafe Wireless Powerbank with Stand',
    'StuffCool - Centurion 100W 4-Port Fast Desktop Charger',
    'StuffCool - Snap 5000mAh Ultra-Slim MagSafe Battery',
    'StuffCool - Type-C 100W Braided Cable with LED Display',
    'StuffCool - Flow 30W Super Fast Dual Port Charger',
    'StuffCool - PB9063W Heavy Duty Laptop Battery Pack',
    'StuffCool - Rover 100W 3-in-1 Fast Charging Station',
    'StuffCool - ChargePort 65W Multi-Device Travel Adapter',
    'StuffCool - Palm 10000mAh Pocket Size Powerbank',
    'StuffCool - Quantum 20W PD Type C Power Bank',
    'StuffCool - 65W GaN Ultra Compact MacBook Charger',
    'StuffCool - 3-in-1 Foldable MagSafe Travel Dock',
    'StuffCool - Ultima 100W Type-C E-Marker Silicone Cable',
    'StuffCool - Matrix 10000mAh Qi2 Magnetic Fast Bank',
    'StuffCool - Bullet 45W Metal Car Super Fast Charger',
    'StuffCool - PowerBolt 25000mAh 140W MacBook Pro Monster',
    'StuffCool - Wireless Car Mount with Auto-Clamping & MagSafe',
    'StuffCool - Quad 4-in-1 Multi-Device Charging Pad'
  ];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.88)',
        backdropFilter: 'blur(12px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        style={{
          width: '100%',
          maxWidth: '1080px',
          maxHeight: '90vh',
          background: 'linear-gradient(180deg, #10101c 0%, #08080e 100%)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '24px',
          boxShadow: '0 25px 80px rgba(0, 0, 0, 0.9)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* ── MODAL HEADER ─────────────────────────────────────────── */}
        <div
          style={{
            padding: '22px 28px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.02)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(124, 117, 255, 0.15)', border: '1px solid rgba(124, 117, 255, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={22} color="#7C75FF" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '20px', color: '#fff', margin: 0, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
                  Market Trends & Competitor Analysis Intelligence
                </h2>
                <span style={{ fontSize: '11px', background: 'rgba(0, 230, 118, 0.15)', color: '#00E676', border: '1px solid rgba(0, 230, 118, 0.3)', padding: '2px 8px', borderRadius: '100px', fontWeight: 800 }}>
                  IN · META · LIVE AUDIT
                </span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                Active Meta ads observed in India on August 18, 2026 • Realtime India search demand & creator hooks
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => {
                alert('Intelligence Report exported as PDF & CSV summary!');
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#fff',
                padding: '7px 14px',
                borderRadius: '100px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <Download size={13} /> Export Report
            </button>

            <button
              onClick={onClose}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── REPORT TABS NAVIGATION ────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '8px', padding: '14px 28px', background: 'rgba(0,0,0,0.4)', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <button
            onClick={() => setActiveReportTab('competitor_ads')}
            style={{
              background: activeReportTab === 'competitor_ads' ? 'rgba(124, 117, 255, 0.2)' : 'transparent',
              border: '1px solid',
              borderColor: activeReportTab === 'competitor_ads' ? '#7C75FF' : 'transparent',
              color: activeReportTab === 'competitor_ads' ? '#fff' : 'var(--text-secondary)',
              padding: '8px 20px',
              borderRadius: '100px',
              fontSize: '13px',
              fontWeight: activeReportTab === 'competitor_ads' ? 700 : 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <ShieldCheck size={14} color={activeReportTab === 'competitor_ads' ? '#7C75FF' : 'currentColor'} />
            <span>Demo Brand Competitor Ad Report (Portronics & StuffCool)</span>
          </button>

          <button
            onClick={() => setActiveReportTab('keyword_trends')}
            style={{
              background: activeReportTab === 'keyword_trends' ? 'rgba(0, 230, 118, 0.2)' : 'transparent',
              border: '1px solid',
              borderColor: activeReportTab === 'keyword_trends' ? '#00E676' : 'transparent',
              color: activeReportTab === 'keyword_trends' ? '#fff' : 'var(--text-secondary)',
              padding: '8px 20px',
              borderRadius: '100px',
              fontSize: '13px',
              fontWeight: activeReportTab === 'keyword_trends' ? 700 : 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Flame size={14} color={activeReportTab === 'keyword_trends' ? '#00E676' : 'currentColor'} />
            <span>India Charging Trends: Festive Run-Up & Search Hooks</span>
          </button>
        </div>

        {/* ── MODAL SCROLLABLE CONTENT BODY ─────────────────────────── */}
        <div style={{ padding: '24px 28px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          {/* ════════════════════════════════════════════════════════════ */}
          {/* TAB 1: DEMO BRAND COMPETITOR AD REPORT                      */}
          {/* ════════════════════════════════════════════════════════════ */}
          {activeReportTab === 'competitor_ads' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Executive Summary Card */}
              <div className="glow-card" style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '18px', padding: '20px 24px' }}>
                <span style={{ fontSize: '11px', color: '#7C75FF', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  EXECUTIVE SUMMARY
                </span>
                <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.9)', margin: '8px 0 0 0', lineHeight: 1.6 }}>
                  <strong>Portronics</strong> uses broad, feature-led electronics merchandising with a recurring 10% coupon, while <strong>StuffCool</strong> owns the sharper high-wattage, laptop-ready power narrative. The opening for <strong>Demo Brand</strong> is to turn its charging range into scenario-led proof: pocket backup, cable-free iPhone charging, and dependable laptop power—without relying on spec density alone. This report assumes India as Demo Brand’s sole target market and focuses on active Meta ads only.
                </p>
              </div>

              {/* Where We Win Card */}
              <div className="glow-card" style={{ background: 'linear-gradient(135deg, rgba(0, 230, 118, 0.1) 0%, rgba(10, 20, 15, 0.8) 100%)', border: '1.5px solid rgba(0, 230, 118, 0.35)', borderRadius: '18px', padding: '22px 26px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Sparkles size={18} color="#00E676" />
                  <h3 style={{ fontSize: '18px', color: '#fff', margin: 0, fontWeight: 800 }}>
                    Where We Win (Demo Brand Advantage)
                  </h3>
                </div>
                <p style={{ fontSize: '13.5px', color: 'rgba(255, 255, 255, 0.85)', margin: '0 0 12px 0', lineHeight: 1.5 }}>
                  Demo Brand can own <strong>practical, proudly Indian charging confidence</strong>: modern power for the exact device and moment people depend on, from pocket-ready phone backup to cable-light iPhone and laptop charging.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'rgba(255, 255, 255, 0.85)' }}>
                  <div>• Neither competitor consistently organizes the charging decision around everyday scenarios and device needs.</div>
                  <div>• Portronics lacks specialist charging authority, while StuffCool underplays approachable value and routine convenience.</div>
                  <div>• Both use <em>"Shop now"</em> universally, leaving room for decision-support creative that reduces product-choice friction.</div>
                </div>
              </div>

              {/* Brand Strategy: Blue Ocean vs Red Ocean */}
              <div>
                <h3 style={{ fontSize: '18px', color: '#fff', margin: '0 0 14px 0', fontWeight: 800 }}>
                  Brand Strategy (Blue Ocean / Red Ocean Moves)
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
                  
                  {/* Blue Ocean */}
                  <div className="glow-card" style={{ background: 'rgba(0, 210, 255, 0.05)', border: '1.5px solid rgba(0, 210, 255, 0.3)', borderRadius: '18px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', background: 'rgba(0, 210, 255, 0.2)', color: '#00D2FF', border: '1px solid rgba(0, 210, 255, 0.4)', padding: '2px 10px', borderRadius: '100px', fontWeight: 800 }}>
                        BLUE OCEAN
                      </span>
                      <h4 style={{ fontSize: '16px', color: '#fff', margin: 0, fontWeight: 700 }}>
                        Scenario-led charging confidence
                      </h4>
                    </div>
                    <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.8)', margin: 0, lineHeight: 1.5 }}>
                      Make Demo Brand’s range feel easier to choose by leading with the moment of need, then proving the right capacity, wattage or magnetic technology for it.
                    </p>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div>• Build a repeatable use-case creative system across commute, campus, work travel and iPhone desk setups.</div>
                      <div>• Pair concise visual proof—built-in cable, magnetic hold, wattage or display—with plain-language outcome copy.</div>
                      <div>• Use product-choice carousels that guide shoppers to the right power solution.</div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0, 210, 255, 0.2)', borderRadius: '10px', padding: '10px 14px', fontSize: '12px' }}>
                      <strong style={{ color: '#00D2FF' }}>Action Items:</strong>
                      <div style={{ color: 'rgba(255,255,255,0.85)', marginTop: '4px' }}>
                        1. Produce a four-part scenario-led Meta creative series for Demo Brand’s core charging products.<br />
                        2. Create a choose-your-power carousel that routes phone, iPhone and laptop users.
                      </div>
                    </div>
                  </div>

                  {/* Red Ocean */}
                  <div className="glow-card" style={{ background: 'rgba(255, 71, 87, 0.05)', border: '1.5px solid rgba(255, 71, 87, 0.3)', borderRadius: '18px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', background: 'rgba(255, 71, 87, 0.2)', color: '#ff4757', border: '1px solid rgba(255, 71, 87, 0.4)', padding: '2px 10px', borderRadius: '100px', fontWeight: 800 }}>
                        RED OCEAN
                      </span>
                      <h4 style={{ fontSize: '16px', color: '#fff', margin: 0, fontWeight: 700 }}>
                        Win high-power proof
                      </h4>
                    </div>
                    <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.8)', margin: 0, lineHeight: 1.5 }}>
                      Laptop charging, high capacity and Qi2/MagSafe are crowded claims. Demo Brand should defend with clear compatibility, transparent performance proof and a stronger value story.
                    </p>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div>• Put device compatibility, wattage and capacity in the first visual frame for high-power products.</div>
                      <div>• Demonstrate charging convenience rather than repeating generic fast-charging language.</div>
                      <div>• Test bundles that increase perceived value while preserving product credibility.</div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255, 71, 87, 0.2)', borderRadius: '10px', padding: '10px 14px', fontSize: '12px' }}>
                      <strong style={{ color: '#ff4757' }}>Action Items:</strong>
                      <div style={{ color: 'rgba(255,255,255,0.85)', marginTop: '4px' }}>
                        1. Develop a MacBook-ready power-bank ad with device-specific proof and a real workday story.<br />
                        2. Test a charging bundle offer against a no-discount proof-led creative.
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Competitor Snapshot & 20 Active Ads Breakdown */}
              <div className="glow-card" style={{ background: '#0a0a12', borderRadius: '20px', padding: '24px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '18px', color: '#fff', margin: 0, fontWeight: 800 }}>
                    Competitor Snapshot (Active Meta Ads In India)
                  </h3>

                  {/* Competitor Toggle */}
                  <div style={{ display: 'flex', gap: '6px', background: 'rgba(255,255,255,0.04)', padding: '3px', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <button
                      onClick={() => setActiveCompetitorTab('portronics')}
                      style={{
                        background: activeCompetitorTab === 'portronics' ? '#7C75FF' : 'transparent',
                        color: activeCompetitorTab === 'portronics' ? '#fff' : 'var(--text-secondary)',
                        border: 'none',
                        borderRadius: '100px',
                        padding: '5px 14px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Portronics (20 Ads)
                    </button>
                    <button
                      onClick={() => setActiveCompetitorTab('stuffcool')}
                      style={{
                        background: activeCompetitorTab === 'stuffcool' ? '#00D2FF' : 'transparent',
                        color: activeCompetitorTab === 'stuffcool' ? '#000' : 'var(--text-secondary)',
                        border: 'none',
                        borderRadius: '100px',
                        padding: '5px 14px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      StuffCool (20 Ads)
                    </button>
                  </div>
                </div>

                {/* Competitor Details Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '18px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '14px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Messaging Pattern</span>
                    <p style={{ fontSize: '12.5px', color: '#fff', margin: '4px 0 0 0' }}>
                      {activeCompetitorTab === 'portronics' ? 'Feature-to-benefit demos across audio, peripherals & electronics' : 'High wattage (65W/100W GaN), MacBook-ready power & MagSafe'}
                    </p>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '14px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Visual Style</span>
                    <p style={{ fontSize: '12.5px', color: '#fff', margin: '4px 0 0 0' }}>
                      {activeCompetitorTab === 'portronics' ? 'Product-focused static commerce creatives & icon callouts' : 'Sleek dark mode renders, wattage speedometers & desk setups'}
                    </p>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '14px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Offer & CTA</span>
                    <p style={{ fontSize: '12.5px', color: '#00E676', margin: '4px 0 0 0', fontWeight: 600 }}>
                      {activeCompetitorTab === 'portronics' ? '10% Extra Off with code TODAY • CTA: Shop now' : 'Premium bundle pricing & fast dispatch • CTA: Shop now'}
                    </p>
                  </div>
                </div>

                {/* 20 Active Ads List */}
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                    20 Active Ads Observed in Library:
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                    {(activeCompetitorTab === 'portronics' ? portronicsAds : stuffCoolAds).map((ad, idx) => (
                      <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: '#7C75FF', fontWeight: 800 }}>#{idx + 1}</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ad}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* 3 Core Action Items */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '18px' }}>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#7C75FF', marginBottom: '4px' }}>01</div>
                  <h4 style={{ fontSize: '15px', color: '#fff', margin: '0 0 6px 0', fontWeight: 700 }}>Build Scenario Series</h4>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                    Scenario-first creative gives Demo Brand a more ownable route than broad gadget merchandising and makes the product choice simpler at a glance.
                  </p>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '18px' }}>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#00D2FF', marginBottom: '4px' }}>02</div>
                  <h4 style={{ fontSize: '15px', color: '#fff', margin: '0 0 6px 0', fontWeight: 700 }}>Create Choice Carousel</h4>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                    A guided product-selection carousel can reduce choice friction that both competitors leave unresolved through universal Shop now merchandising.
                  </p>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '18px' }}>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#00E676', marginBottom: '4px' }}>03</div>
                  <h4 style={{ fontSize: '15px', color: '#fff', margin: '0 0 6px 0', fontWeight: 700 }}>Prove Laptop Power</h4>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                    StuffCool demonstrates strong high-wattage ownership; a real workday demonstration with compatibility proof lets Demo Brand compete effectively.
                  </p>
                </div>
              </div>

            </div>
          )}

          {/* ════════════════════════════════════════════════════════════ */}
          {/* TAB 2: INDIA CHARGING TRENDS & FESTIVE RUN-UP                */}
          {/* ════════════════════════════════════════════════════════════ */}
          {activeReportTab === 'keyword_trends' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Keyword Trends Summary Card */}
              <div className="glow-card" style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '18px', padding: '20px 24px' }}>
                <span style={{ fontSize: '11px', color: '#00E676', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  INDIA SEARCH DEMAND & CREATOR SIGNALS (AUG 17, 2025–AUG 22, 2026)
                </span>
                <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.9)', margin: '8px 0 0 0', lineHeight: 1.6 }}>
                  India’s charging category is still led by broad, high-volume utility searches: <strong>“power bank”</strong> averaged 84 and <strong>“charging cable”</strong> 78 over the last 12 months. The more valuable growth lanes are intent-rich: <strong>“MagSafe power bank”</strong> averaged 24, while <strong>“fast charger”</strong> reached its 12-month high in mid-August. For Demo Brand, the opportunity is to convert specification-led products into proof-led short video.
                </p>
              </div>

              {/* Strategic Keywords & Copyable Ad Hooks Table */}
              <div className="glow-card" style={{ background: '#0a0a12', borderRadius: '20px', padding: '24px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '18px', color: '#fff', margin: 0, fontWeight: 800 }}>
                    Strategic Keywords & Converting Ad Hooks
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Click copy icon to copy hook for Creative Studio</span>
                </div>

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
                        onClick={() => handleCopyHook(item.adHook)}
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

              {/* Winning Patterns & Opportunity Gaps */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
                
                {/* Winning Patterns */}
                <div className="glow-card" style={{ background: 'rgba(0, 230, 118, 0.04)', border: '1px solid rgba(0, 230, 118, 0.25)', borderRadius: '18px', padding: '22px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <Sparkles size={16} color="#00E676" />
                    <h4 style={{ fontSize: '16px', color: '#fff', margin: 0, fontWeight: 700 }}>
                      Winning Patterns in Creator & Ad Content
                    </h4>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
                    <div>• <strong>Proof-first “real test” short videos</strong> are outperforming polished spec dumps: battery-vs-phone tests, laptop charging speed tests.</div>
                    <div>• <strong>Curiosity hook in first second:</strong> contrast and surprise framing such as capacity challenges or bold performance claims.</div>
                    <div>• <strong>Built-in-cable convenience:</strong> understood instantly in commute, café, classroom, airport, or desk without reading a spec card.</div>
                    <div>• <strong>Diwali festive run-up (Nov 2026):</strong> move from pure utility into gifting, travel, and upgrade bundles starting September.</div>
                  </div>
                </div>

                {/* Opportunity Gaps */}
                <div className="glow-card" style={{ background: 'rgba(124, 117, 255, 0.04)', border: '1px solid rgba(124, 117, 255, 0.25)', borderRadius: '18px', padding: '22px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <Target size={16} color="#7C75FF" />
                    <h4 style={{ fontSize: '16px', color: '#fff', margin: 0, fontWeight: 700 }}>
                      Category Opportunity Gaps for Demo Brand
                    </h4>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
                    <div>• Most category ads treat mAh, watts, and ports as the message. Demo Brand can own <strong>“proof of preparedness”</strong>.</div>
                    <div>• Creator format often proves 1 device at a time. Demo Brand can differentiate through <strong>device-stack demos (phone + earbuds + laptop)</strong>.</div>
                    <div>• Demo Brand’s Indian-origin and accessible-tech story is underused in short-form charging content.</div>
                    <div>• Replace generic price discounts with <strong>“travel-ready power”</strong> and <strong>“work-ready charging”</strong> bundles.</div>
                  </div>
                </div>

              </div>

              {/* Creator Short Video Sources */}
              <div className="glow-card" style={{ background: '#0a0a12', borderRadius: '18px', padding: '20px 24px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <h4 style={{ fontSize: '15px', color: '#fff', margin: '0 0 12px 0', fontWeight: 700 }}>
                  High-Impact Creator Video References
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                  {[
                    { title: 'Thor Wala Powerbank ⚡ #shorts', channel: 'YouTube · 2026-07-13', url: 'https://www.youtube.com/watch?v=mpuqxOWKdZ8', desc: 'Dramatic test-led power-bank storytelling around travel and built-in cables.' },
                    { title: 'New Fast PowerBank From Xiaomi - Test !', channel: 'YouTube · 2026-08-09', url: 'https://www.youtube.com/watch?v=plp4hkEEQ0c', desc: 'Visible laptop and fast-charging real-time test.' },
                    { title: 'Throw Away Your Charging Cables 🚨', channel: 'YouTube · 2026-05-16', url: 'https://www.youtube.com/watch?v=pNJlpb79oSA', desc: 'Bold 1-second hook demonstrating functional convenience.' }
                  ].map((src, i) => (
                    <a
                      key={i}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '12px',
                        padding: '12px 14px',
                        textDecoration: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', color: '#fff', fontWeight: 700 }}>{src.title}</span>
                        <ExternalLink size={12} color="#7C75FF" />
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{src.channel}</span>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>{src.desc}</p>
                    </a>
                  ))}
                </div>
              </div>

            </div>
          )}

        </div>

        {/* ── MODAL FOOTER ─────────────────────────────────────────── */}
        <div
          style={{
            padding: '16px 28px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(0,0,0,0.5)'
          }}
        >
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Raftra Market & Ad Intelligence Engine • Realtime India Meta & Google Signals
          </span>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: '#fff',
                padding: '9px 18px',
                borderRadius: '100px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Close
            </button>

            <GlowButton
              variant="glow"
              onClick={() => {
                onClose();
                if (onNavigateTab) onNavigateTab('studio');
              }}
              style={{ fontSize: '13px', padding: '9px 22px' }}
            >
              Generate Ads from these Hooks 🚀
            </GlowButton>
          </div>
        </div>

      </motion.div>
    </div>
  );
};
