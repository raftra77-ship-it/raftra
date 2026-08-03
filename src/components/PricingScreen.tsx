import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Sparkles, Check, 
  Image as ImageIcon, Video, 
  Users2, ShieldCheck
} from 'lucide-react';
import { GlowButton } from './GlowButton';

interface PricingScreenProps {
  onComplete: () => void;
}

export const PricingScreen: React.FC<PricingScreenProps> = ({ onComplete }) => {
  const [activeCategory, setActiveCategory] = useState<'all' | 'bundles' | 'creative' | 'campaign' | 'seo' | 'credits'>('bundles');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [currency, setCurrency] = useState<'INR' | 'USD'>(() => (localStorage.getItem('currency') as 'INR' | 'USD') || 'INR');
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const handleCurrencyChange = (curr: 'INR' | 'USD') => {
    setCurrency(curr);
    localStorage.setItem('currency', curr);
  };

  const formatPrice = (inrMonthly: number, usdMonthly: number, inrAnnual?: number) => {
    if (billingCycle === 'annual') {
      const price = inrAnnual || inrMonthly * 10;
      if (currency === 'USD') return `$${Math.round(usdMonthly * 10).toLocaleString()}/yr`;
      return `₹${price.toLocaleString('en-IN')}/yr`;
    }
    if (currency === 'USD') return `$${usdMonthly.toLocaleString()}/mo`;
    return `₹${inrMonthly.toLocaleString('en-IN')}/mo`;
  };

  const getCardStyle = (cardId: string, isPopular = false) => {
    const isHovered = hoveredCard === cardId;
    const isAnyHovered = hoveredCard !== null;

    let opacity = 1;
    if (isAnyHovered && !isHovered) {
      opacity = 0.65;
    }

    return {
      padding: '32px 28px',
      background: isHovered
        ? 'linear-gradient(180deg, rgba(20,20,32,0.98) 0%, rgba(10,10,18,0.98) 100%)'
        : isPopular 
          ? 'linear-gradient(180deg, rgba(124,117,255,0.12) 0%, rgba(12,12,18,0.95) 100%)'
          : 'rgba(255, 255, 255, 0.03)',
      backdropFilter: 'blur(16px)',
      border: isHovered 
        ? '2px solid #7C75FF' 
        : isPopular 
          ? '1px solid rgba(124,117,255,0.5)' 
          : '1px solid rgba(255,255,255,0.08)',
      borderRadius: '24px',
      display: 'flex',
      flexDirection: 'column' as const,
      justifyContent: 'space-between' as const,
      position: 'relative' as const,
      boxShadow: isHovered
        ? '0 20px 50px rgba(124,117,255,0.35)'
        : isPopular 
          ? '0 10px 30px rgba(124,117,255,0.15)' 
          : '0 8px 32px rgba(0,0,0,0.3)',
      transform: isHovered ? 'translateY(-8px) scale(1.02)' : 'translateY(0)',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      opacity,
      zIndex: isHovered ? 20 : isPopular ? 10 : 1,
      overflow: 'visible' as const
    };
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#fff', padding: '60px 20px 100px 20px', fontFamily: 'var(--font-sans)', overflowY: 'auto' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* HEADER HERO */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ textAlign: 'center', marginBottom: '40px' }}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 16px', background: 'rgba(124,117,255,0.12)', borderRadius: '100px', border: '1px solid rgba(124,117,255,0.3)', marginBottom: '16px', color: '#7C75FF', fontWeight: 600, fontSize: '13px' }}>
            <Sparkles size={14} /> RAFTRA MARKETING OPERATING SYSTEM
          </div>
          
          <h1 style={{ fontSize: '48px', fontFamily: 'var(--font-heading)', color: '#fff', marginBottom: '16px', fontWeight: 800, lineHeight: 1.2 }}>
            Complete AI Marketing Suites.<br/>No Hidden Token Fees.
          </h1>

          <p style={{ fontSize: '17px', color: 'var(--text-secondary)', maxWidth: '720px', margin: '0 auto', lineHeight: 1.5 }}>
            Unlock all growth features with discounted All-in-One Suites or choose modular tools tailored for your brand.
          </p>
        </motion.div>

        {/* CURRENCY & BILLING TOGGLES */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: '20px', marginBottom: '40px' }}>
          
          {/* Currency Toggle */}
          <div style={{ background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center' }}>
            <button 
              onClick={() => handleCurrencyChange('INR')}
              style={{ background: currency === 'INR' ? '#7C75FF' : 'transparent', color: '#fff', border: 'none', padding: '6px 18px', borderRadius: '100px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              INR (₹)
            </button>
            <button 
              onClick={() => handleCurrencyChange('USD')}
              style={{ background: currency === 'USD' ? '#7C75FF' : 'transparent', color: '#fff', border: 'none', padding: '6px 18px', borderRadius: '100px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              USD ($)
            </button>
          </div>

          {/* Billing Cycle Toggle */}
          <div style={{ background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center' }}>
            <button 
              onClick={() => setBillingCycle('monthly')}
              style={{ background: billingCycle === 'monthly' ? '#7C75FF' : 'transparent', color: '#fff', border: 'none', padding: '8px 22px', borderRadius: '100px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              Monthly Billing
            </button>
            <button 
              onClick={() => setBillingCycle('annual')}
              style={{ background: billingCycle === 'annual' ? '#7C75FF' : 'transparent', color: '#fff', border: 'none', padding: '8px 22px', borderRadius: '100px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              Annual Billing <span style={{ background: 'rgba(0,230,118,0.2)', color: 'var(--success)', fontSize: '10px', padding: '2px 8px', borderRadius: '100px', fontWeight: 700 }}>2 MONTHS FREE</span>
            </button>
          </div>

        </div>

        {/* CATEGORY NAV TABS */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '50px' }}>
          {[
            { id: 'bundles', label: '🚀 All-in-One Combined Suites ⭐' },
            { id: 'all', label: 'All Individual Modules' },
            { id: 'creative', label: '🎨 Creative Studio' },
            { id: 'campaign', label: '📢 Campaign Manager' },
            { id: 'seo', label: '🔍 SEO & GEO' },
            { id: 'credits', label: '💳 AI Credits Breakdown' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id as any)}
              style={{
                background: activeCategory === tab.id ? 'linear-gradient(90deg, #7C75FF 0%, #5A52FF 100%)' : 'rgba(255,255,255,0.03)',
                border: activeCategory === tab.id ? '1px solid #7C75FF' : '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
                padding: '10px 22px',
                borderRadius: '100px',
                fontSize: '14px',
                fontWeight: activeCategory === tab.id ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ==================== SECTION 0: COMBINED ALL-IN-ONE SUITES (STARTUP, GROWTH, ENTERPRISE) ==================== */}
        {(activeCategory === 'bundles' || activeCategory === 'all') && (
          <div style={{ marginBottom: '80px' }}>
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <div style={{ fontSize: '12px', color: '#00E676', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
                BEST VALUE COMBINED SUITES
              </div>
              <h2 style={{ fontSize: '36px', color: '#fff', margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 800 }}>
                Raftra All-in-One Growth Packages
              </h2>
              <p style={{ fontSize: '15px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                Get Creative Studio, Campaign Manager, SEO & GEO, Social Hub, and Analytics in one single discounted plan.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '28px', alignItems: 'stretch' }}>
              
              {/* Startup All-in-One */}
              <div
                onMouseEnter={() => setHoveredCard('combo_startup')}
                onMouseLeave={() => setHoveredCard(null)}
                style={getCardStyle('combo_startup', false)}
              >
                <div>
                  <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '4px 12px', borderRadius: '100px', fontSize: '11px', fontWeight: 700, marginBottom: '16px' }}>
                    SOLO FOUNDERS & EARLY STARTUPS
                  </div>

                  <h3 style={{ fontSize: '24px', color: '#fff', margin: '0 0 6px 0', fontFamily: 'var(--font-heading)' }}>Startup Suite</h3>
                  <div style={{ fontSize: '36px', color: '#fff', fontWeight: 800, fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>
                    {formatPrice(9999, 119, 99999)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#7C75FF', fontWeight: 700, marginBottom: '24px', background: 'rgba(124,117,255,0.12)', padding: '6px 14px', borderRadius: '8px', display: 'inline-block' }}>
                    15,000 AI Credits / month
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px', color: '#ddd' }}>
                    <li style={{ display: 'flex', gap: '10px' }}><Check size={18} color="var(--success)" /> <strong>Creative Studio Pro</strong> (Image, Video & UGC)</li>
                    <li style={{ display: 'flex', gap: '10px' }}><Check size={18} color="var(--success)" /> <strong>Campaign Manager</strong> (Meta & Google Publishing)</li>
                    <li style={{ display: 'flex', gap: '10px' }}><Check size={18} color="var(--success)" /> <strong>SEO & GEO Starter</strong> (Weekly Audits & Visibility)</li>
                    <li style={{ display: 'flex', gap: '10px' }}><Check size={18} color="var(--success)" /> <strong>Social Hub Workspace</strong> & Influencer Access</li>
                    <li style={{ display: 'flex', gap: '10px' }}><Check size={18} color="var(--success)" /> <strong>Marketing & SEO Analytics</strong> Included</li>
                  </ul>
                </div>

                <button onClick={onComplete} style={{ marginTop: '32px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '14px', borderRadius: '100px', fontWeight: 700, cursor: 'pointer', width: '100%', fontSize: '14px' }}>
                  Get Startup Suite
                </button>
              </div>

              {/* Growth All-in-One ⭐ (Most Popular & Recommended) */}
              <div
                onMouseEnter={() => setHoveredCard('combo_growth')}
                onMouseLeave={() => setHoveredCard(null)}
                style={getCardStyle('combo_growth', true)}
              >
                {/* Clean Non-Cutting Badge */}
                <div style={{ background: 'linear-gradient(90deg, #7C75FF 0%, #00E676 100%)', color: '#000', padding: '6px 16px', borderRadius: '100px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', alignSelf: 'flex-start', marginBottom: '16px' }}>
                  ⭐ MOST POPULAR & RECOMMENDED BUNDLE
                </div>

                <div>
                  <h3 style={{ fontSize: '24px', color: '#fff', margin: '0 0 6px 0', fontFamily: 'var(--font-heading)' }}>Growth Suite</h3>
                  <div style={{ fontSize: '38px', color: '#00E676', fontWeight: 800, fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>
                    {formatPrice(19999, 239, 199999)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#00E676', fontWeight: 700, marginBottom: '24px', background: 'rgba(0,230,118,0.12)', padding: '6px 14px', borderRadius: '8px', display: 'inline-block' }}>
                    40,000 AI Credits / month
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px', color: '#ddd' }}>
                    <li style={{ display: 'flex', gap: '10px' }}><Check size={18} color="var(--success)" /> <strong>Creative Studio Business</strong> (Team & Batch Renders)</li>
                    <li style={{ display: 'flex', gap: '10px' }}><Check size={18} color="var(--success)" /> <strong>Campaign Manager</strong> (Meta + Google + Claude Recs)</li>
                    <li style={{ display: 'flex', gap: '10px' }}><Check size={18} color="var(--success)" /> <strong>SEO & GEO Growth</strong> (1-Click CMS & AI Blogs)</li>
                    <li style={{ display: 'flex', gap: '10px' }}><Check size={18} color="var(--success)" /> <strong>Social Hub & Auto DMs</strong> + Creator Marketplace</li>
                    <li style={{ display: 'flex', gap: '10px' }}><Check size={18} color="var(--success)" /> <strong>Priority Fast GPU Queue</strong> & Team Collaboration</li>
                  </ul>
                </div>

                <GlowButton variant="glow" onClick={onComplete} style={{ marginTop: '32px', padding: '16px', fontSize: '15px' }}>
                  Get Growth Suite
                </GlowButton>
              </div>

              {/* Enterprise All-in-One */}
              <div
                onMouseEnter={() => setHoveredCard('combo_enterprise')}
                onMouseLeave={() => setHoveredCard(null)}
                style={getCardStyle('combo_enterprise', false)}
              >
                <div>
                  <div style={{ display: 'inline-block', background: 'rgba(255,189,46,0.12)', border: '1px solid rgba(255,189,46,0.3)', color: '#FFBD2E', padding: '4px 12px', borderRadius: '100px', fontSize: '11px', fontWeight: 700, marginBottom: '16px' }}>
                    LARGE AGENCIES & ENTERPRISE
                  </div>

                  <h3 style={{ fontSize: '24px', color: '#fff', margin: '0 0 6px 0', fontFamily: 'var(--font-heading)' }}>Enterprise Suite</h3>
                  <div style={{ fontSize: '36px', color: '#fff', fontWeight: 800, fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>
                    {formatPrice(49999, 599, 499999)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#FFBD2E', fontWeight: 700, marginBottom: '24px', background: 'rgba(255,189,46,0.12)', padding: '6px 14px', borderRadius: '8px', display: 'inline-block' }}>
                    100,000 AI Credits / month
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px', color: '#ddd' }}>
                    <li style={{ display: 'flex', gap: '10px' }}><Check size={18} color="var(--success)" /> <strong>Everything in Growth Suite</strong></li>
                    <li style={{ display: 'flex', gap: '10px' }}><Check size={18} color="var(--success)" /> <strong>Managed SEO & Dedicated Specialist</strong> (Backlinks & PR)</li>
                    <li style={{ display: 'flex', gap: '10px' }}><Check size={18} color="var(--success)" /> <strong>Dedicated GPU Cluster</strong> & Custom AI Models</li>
                    <li style={{ display: 'flex', gap: '10px' }}><Check size={18} color="var(--success)" /> <strong>Custom API Access</strong> & Private Infrastructure</li>
                    <li style={{ display: 'flex', gap: '10px' }}><Check size={18} color="var(--success)" /> <strong>Dedicated Account Manager</strong> & 24/7 SLA</li>
                  </ul>
                </div>

                <button onClick={onComplete} style={{ marginTop: '32px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '14px', borderRadius: '100px', fontWeight: 700, cursor: 'pointer', width: '100%', fontSize: '14px' }}>
                  Contact Enterprise Sales
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ==================== SECTION 1: CREATIVE STUDIO PLANS ==================== */}
        {(activeCategory === 'all' || activeCategory === 'creative') && (
          <div style={{ marginBottom: '80px' }}>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '12px', color: '#7C75FF', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>MODULE 1</div>
              <h2 style={{ fontSize: '32px', color: '#fff', margin: '4px 0 0 0', fontFamily: 'var(--font-heading)' }}>🎨 Creative Studio (Credit Based)</h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
              
              {/* Starter */}
              <div
                onMouseEnter={() => setHoveredCard('cs_starter')}
                onMouseLeave={() => setHoveredCard(null)}
                style={getCardStyle('cs_starter')}
              >
                <div>
                  <div style={{ fontSize: '18px', color: '#fff', fontWeight: 700, marginBottom: '6px' }}>Starter</div>
                  <div style={{ fontSize: '32px', color: '#fff', fontWeight: 800, fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>
                    {formatPrice(999, 12, 9999)}
                  </div>
                  <div style={{ fontSize: '13px', color: '#7C75FF', fontWeight: 700, marginBottom: '20px', background: 'rgba(124,117,255,0.1)', padding: '4px 12px', borderRadius: '6px', display: 'inline-block' }}>
                    5,000 AI Credits / month
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: '#ccc' }}>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Image Ads Generation</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Product Photography Renders</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Basic Ad Copy & Photo Editing</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Carousel Ads Framework</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Brand Knowledge Base Sync</li>
                  </ul>
                </div>

                <button onClick={onComplete} style={{ marginTop: '28px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '12px', borderRadius: '100px', fontWeight: 600, cursor: 'pointer' }}>
                  Select Starter
                </button>
              </div>

              {/* Pro */}
              <div
                onMouseEnter={() => setHoveredCard('cs_pro')}
                onMouseLeave={() => setHoveredCard(null)}
                style={getCardStyle('cs_pro', true)}
              >
                <div>
                  <div style={{ background: '#7C75FF', color: '#fff', padding: '4px 12px', borderRadius: '100px', fontSize: '10px', fontWeight: 800, display: 'inline-block', marginBottom: '10px' }}>
                    ⭐ POPULAR CREATIVE TIER
                  </div>

                  <div style={{ fontSize: '18px', color: '#fff', fontWeight: 700, marginBottom: '6px' }}>Pro</div>
                  <div style={{ fontSize: '32px', color: '#00E676', fontWeight: 800, fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>
                    {formatPrice(2499, 29, 24999)}
                  </div>
                  <div style={{ fontSize: '13px', color: '#00E676', fontWeight: 700, marginBottom: '20px', background: 'rgba(0,230,118,0.1)', padding: '4px 12px', borderRadius: '6px', display: 'inline-block' }}>
                    15,000 AI Credits / month
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: '#ccc' }}>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> <strong>Everything in Starter</strong></li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> 15s / 30s / 60s AI Video Ads</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> AI UGC Video Reels & Avatars</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Advanced In-Place Ad Editing</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Premium Imagen 3 & Claude Models</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Faster GPU Generation Queue</li>
                  </ul>
                </div>

                <GlowButton variant="glow" onClick={onComplete} style={{ marginTop: '28px', padding: '14px' }}>
                  Get Creative Pro
                </GlowButton>
              </div>

              {/* Business */}
              <div
                onMouseEnter={() => setHoveredCard('cs_business')}
                onMouseLeave={() => setHoveredCard(null)}
                style={getCardStyle('cs_business')}
              >
                <div>
                  <div style={{ fontSize: '18px', color: '#fff', fontWeight: 700, marginBottom: '6px' }}>Business</div>
                  <div style={{ fontSize: '32px', color: '#fff', fontWeight: 800, fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>
                    {formatPrice(4999, 59, 49999)}
                  </div>
                  <div style={{ fontSize: '13px', color: '#7C75FF', fontWeight: 700, marginBottom: '20px', background: 'rgba(124,117,255,0.1)', padding: '4px 12px', borderRadius: '6px', display: 'inline-block' }}>
                    40,000 AI Credits / month
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: '#ccc' }}>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> <strong>Everything in Pro</strong></li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Multi-Member Team Access</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Priority Dedicated Generation</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Higher Usage & Batch Renders</li>
                  </ul>
                </div>

                <button onClick={onComplete} style={{ marginTop: '28px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '12px', borderRadius: '100px', fontWeight: 600, cursor: 'pointer' }}>
                  Select Business
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ==================== SECTION 2: CAMPAIGN MANAGER ==================== */}
        {(activeCategory === 'all' || activeCategory === 'campaign') && (
          <div style={{ marginBottom: '80px' }}>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '12px', color: '#7C75FF', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>MODULE 2</div>
              <h2 style={{ fontSize: '32px', color: '#fff', margin: '4px 0 0 0', fontFamily: 'var(--font-heading)' }}>📢 Campaign Manager</h2>
            </div>

            <div
              onMouseEnter={() => setHoveredCard('cm_standalone')}
              onMouseLeave={() => setHoveredCard(null)}
              style={getCardStyle('cm_standalone')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '28px', width: '100%' }}>
                <div style={{ maxWidth: '750px' }}>
                  <div style={{ fontSize: '32px', color: '#fff', fontWeight: 800, fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>
                    {formatPrice(4999, 59, 49999)}
                  </div>
                  <p style={{ fontSize: '15px', color: 'var(--text-secondary)', margin: '0 0 20px 0', lineHeight: 1.5 }}>
                    Automate ad creation, audience targeting, Meta & Google publishing, and real-time performance optimization with Claude AI.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', fontSize: '13px', color: '#ccc' }}>
                    <div style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> AI Campaign Builder</div>
                    <div style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Campaign Suggestions</div>
                    <div style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Audience Research Engine</div>
                    <div style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Budget Planner & Allocation</div>
                    <div style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Meta Ads Automated Publishing</div>
                    <div style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Google Ads Automated Publishing</div>
                    <div style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> OAuth 2.0 Account Integrations</div>
                    <div style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Claude AI Optimization Recs</div>
                  </div>
                </div>

                <div style={{ minWidth: '220px' }}>
                  <GlowButton variant="glow" onClick={onComplete} style={{ width: '100%', padding: '16px 32px', fontSize: '15px' }}>
                    Get Campaign Manager
                  </GlowButton>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== SECTION 3: SEO & GEO PLANS ==================== */}
        {(activeCategory === 'all' || activeCategory === 'seo') && (
          <div style={{ marginBottom: '80px' }}>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '12px', color: '#7C75FF', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>MODULE 3</div>
              <h2 style={{ fontSize: '32px', color: '#fff', margin: '4px 0 0 0', fontFamily: 'var(--font-heading)' }}>🔍 SEO & GEO Search Engine Optimization</h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
              
              {/* Starter */}
              <div
                onMouseEnter={() => setHoveredCard('seo_starter')}
                onMouseLeave={() => setHoveredCard(null)}
                style={getCardStyle('seo_starter')}
              >
                <div>
                  <div style={{ fontSize: '18px', color: '#fff', fontWeight: 700, marginBottom: '6px' }}>Starter</div>
                  <div style={{ fontSize: '32px', color: '#fff', fontWeight: 800, fontFamily: 'var(--font-heading)', marginBottom: '16px' }}>
                    {formatPrice(4999, 59, 49999)}
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: '#ccc' }}>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Weekly SEO Audit</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Weekly GEO Audit</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> AI Optimization Recommendations</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Prompt Tracking Engine</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> AI Search Visibility Tracking</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Competitor SEO Overview</li>
                  </ul>
                </div>

                <button onClick={onComplete} style={{ marginTop: '28px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '12px', borderRadius: '100px', fontWeight: 600, cursor: 'pointer' }}>
                  Select SEO Starter
                </button>
              </div>

              {/* Growth */}
              <div
                onMouseEnter={() => setHoveredCard('seo_growth')}
                onMouseLeave={() => setHoveredCard(null)}
                style={getCardStyle('seo_growth', true)}
              >
                <div>
                  <div style={{ background: '#7C75FF', color: '#fff', padding: '4px 12px', borderRadius: '100px', fontSize: '10px', fontWeight: 800, display: 'inline-block', marginBottom: '10px' }}>
                    ⭐ POPULAR SEO TIER
                  </div>

                  <div style={{ fontSize: '18px', color: '#fff', fontWeight: 700, marginBottom: '6px' }}>Growth</div>
                  <div style={{ fontSize: '32px', color: '#00E676', fontWeight: 800, fontFamily: 'var(--font-heading)', marginBottom: '16px' }}>
                    {formatPrice(14999, 179, 149999)}
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: '#ccc' }}>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> <strong>Everything in Starter +</strong></li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> GSC & GA4 Real-time Integration</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> WordPress / Shopify / GitHub Connect</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> One-Click CMS Publishing</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> AI Blog & Landing Page Writer</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> FAQ Schema & Entity Optimization</li>
                  </ul>
                </div>

                <GlowButton variant="glow" onClick={onComplete} style={{ marginTop: '28px', padding: '14px' }}>
                  Get SEO Growth
                </GlowButton>
              </div>

              {/* Managed SEO */}
              <div
                onMouseEnter={() => setHoveredCard('seo_managed')}
                onMouseLeave={() => setHoveredCard(null)}
                style={getCardStyle('seo_managed')}
              >
                <div>
                  <div style={{ fontSize: '18px', color: '#fff', fontWeight: 700, marginBottom: '6px' }}>Managed SEO</div>
                  <div style={{ fontSize: '32px', color: '#fff', fontWeight: 800, fontFamily: 'var(--font-heading)', marginBottom: '16px' }}>
                    {formatPrice(29999, 359, 299999)}
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: '#ccc' }}>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> <strong>Everything in Growth +</strong></li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Dedicated SEO & GEO Specialist</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Backlink Outreach & Guest Posting</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Digital PR & Authority Building</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Weekly Strategy Calls & Planning</li>
                  </ul>
                </div>

                <button onClick={onComplete} style={{ marginTop: '28px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '12px', borderRadius: '100px', fontWeight: 600, cursor: 'pointer' }}>
                  Get Managed SEO
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ==================== SECTION 4: INCLUDED MODULES & MARKETPLACE ==================== */}
        <div style={{ marginBottom: '80px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          
          <div
            onMouseEnter={() => setHoveredCard('inc_social')}
            onMouseLeave={() => setHoveredCard(null)}
            style={getCardStyle('inc_social')}
          >
            <div>
              <div style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>INCLUDED FREE</div>
              <h3 style={{ fontSize: '20px', color: '#fff', margin: '0 0 10px 0', fontFamily: 'var(--font-heading)' }}>📱 Social Hub</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.4 }}>
                Includes Social Workspace, Editorial Calendar, Content Planning, Team Collaboration, and Notifications.
              </p>
            </div>
            <div style={{ fontSize: '12px', color: '#7C75FF', fontWeight: 600 }}>Option to Hire Specialist (20% Raftra Commission)</div>
          </div>

          <div
            onMouseEnter={() => setHoveredCard('inc_influencer')}
            onMouseLeave={() => setHoveredCard(null)}
            style={getCardStyle('inc_influencer')}
          >
            <div>
              <div style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>FREE TO USE</div>
              <h3 style={{ fontSize: '20px', color: '#fff', margin: '0 0 10px 0', fontFamily: 'var(--font-heading)' }}>🤝 Influencer Marketplace</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.4 }}>
                Creator Discovery, Live Chat, Campaign Briefs, Proposals, and Deliverable Tracking.
              </p>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 600 }}>10% Platform Fee on completed deals</div>
          </div>

          <div
            onMouseEnter={() => setHoveredCard('inc_analytics')}
            onMouseLeave={() => setHoveredCard(null)}
            style={getCardStyle('inc_analytics')}
          >
            <div>
              <div style={{ fontSize: '11px', color: '#7C75FF', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>MODULE INCLUDED</div>
              <h3 style={{ fontSize: '20px', color: '#fff', margin: '0 0 10px 0', fontFamily: 'var(--font-heading)' }}>📈 Analytics & Insights</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.4 }}>
                Included free with purchased modules (Marketing ROAS/CPA + SEO Prompt Tracking & Rankings).
              </p>
            </div>
            <div style={{ fontSize: '12px', color: '#fff', fontWeight: 600 }}>0 AI Credits Consumed</div>
          </div>

        </div>

        {/* ==================== SECTION 5: AI CREDIT CONSUMPTION TABLE & TOP-UPS ==================== */}
        <div className="glow-card" style={{ padding: '36px', background: '#0b0b10', border: '1px solid rgba(124,117,255,0.3)', borderRadius: '24px', marginBottom: '60px' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: 'rgba(0,230,118,0.12)', borderRadius: '100px', border: '1px solid rgba(0,230,118,0.3)', marginBottom: '8px' }}>
              <ShieldCheck size={13} color="var(--success)" />
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--success)' }}>HOW AI CREDITS WORK</span>
            </div>
            <h3 style={{ fontSize: '28px', color: '#fff', margin: '0 0 8px 0', fontFamily: 'var(--font-heading)' }}>
              Transparent AI Credit Consumption Table
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '650px', margin: '0 auto', lineHeight: 1.5 }}>
              AI Credits are ONLY consumed when generating or editing media. Dashboards, analytics, publishing, campaign management, and reports DO NOT consume credits.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '40px' }}>
            
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <h4 style={{ fontSize: '15px', color: '#7C75FF', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ImageIcon size={16} /> 🖼 Image Generation
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Generate Image Ad</span><strong>20 Credits</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Generate Premium Image</span><strong>35 Credits</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Product Photography</span><strong>25 Credits</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Carousel Card</span><strong>15 / card</strong></div>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <h4 style={{ fontSize: '15px', color: '#00E676', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Video size={16} /> 🎥 Video Generation
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>15 sec Video Ad</span><strong>120 Credits</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>30 sec Video Ad</span><strong>220 Credits</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>60 sec Video Ad</span><strong>380 Credits</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>AI Product Video</span><strong>180 Credits</strong></div>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <h4 style={{ fontSize: '15px', color: 'violet', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users2 size={16} /> 🎭 AI UGC & Voice
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>AI UGC Image</span><strong>40 Credits</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>AI UGC Video (15s)</span><strong>250 Credits</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>AI UGC Video (30s)</span><strong>420 Credits</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>AI Voiceover</span><strong>20 Credits</strong></div>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <h4 style={{ fontSize: '15px', color: '#FFBD2E', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} /> ✨ AI Photo Editing
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Background Remove</span><strong>2 Credits</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Background Replace</span><strong>5 Credits</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Object Add / Remove</span><strong>5-8 Credits</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Upscale & Face Enhance</span><strong>4-5 Credits</strong></div>
              </div>
            </div>

          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '28px', textAlign: 'center' }}>
            <h4 style={{ fontSize: '18px', color: '#fff', margin: '0 0 16px 0', fontFamily: 'var(--font-heading)' }}>
              Buy Additional Credit Top-Ups (Refill Anytime)
            </h4>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
              {[
                { credits: '5,000 Credits', inr: '₹999', usd: '$12' },
                { credits: '10,000 Credits', inr: '₹1,799', usd: '$22' },
                { credits: '25,000 Credits', inr: '₹3,999', usd: '$48' },
                { credits: '50,000 Credits', inr: '₹6,999', usd: '$84', badge: 'Best Value' }
              ].map((pack, idx) => (
                <div key={idx} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '14px 20px', minWidth: '180px', position: 'relative' }}>
                  {pack.badge && (
                    <span style={{ position: 'absolute', top: '-10px', right: '12px', background: '#00E676', color: '#000', fontSize: '9px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>
                      {pack.badge}
                    </span>
                  )}
                  <div style={{ fontSize: '14px', color: '#fff', fontWeight: 700 }}>{pack.credits}</div>
                  <div style={{ fontSize: '16px', color: '#7C75FF', fontWeight: 800, marginTop: '4px' }}>
                    {currency === 'USD' ? pack.usd : pack.inr}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
