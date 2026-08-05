import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Sparkles, Check, 
  Image as ImageIcon, Video, 
  Users2, ShieldCheck, Layers, BarChart3, Search, Cpu, MessageSquare, Lock, Wand2
} from 'lucide-react';
import { GlowButton } from './GlowButton';
import { FlowyBackground } from './FlowyBackground';

interface PricingScreenProps {
  onComplete: () => void;
}

export const PricingScreen: React.FC<PricingScreenProps> = ({ onComplete }) => {
  const [activeCategory, setActiveCategory] = useState<'allinone' | 'dual' | 'creative' | 'campaign' | 'seo' | 'included' | 'credits'>('allinone');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [currency, setCurrency] = useState<'INR' | 'USD'>(() => (localStorage.getItem('currency') as 'INR' | 'USD') || 'INR');
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const handleCurrencyChange = (curr: 'INR' | 'USD') => {
    setCurrency(curr);
    localStorage.setItem('currency', curr);
  };

  const formatPrice = (inrMonthly: number, usdMonthly: number, inrAnnual?: number, customColor?: string) => {
    if (billingCycle === 'annual') {
      const discountedInr = inrAnnual || inrMonthly * 10;
      const originalInr = inrMonthly * 12;
      
      const discountedUsd = Math.round(usdMonthly * 10);
      const originalUsd = usdMonthly * 12;

      if (currency === 'USD') {
        return (
          <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '0.55em', color: 'rgba(255,100,100,0.85)', textDecoration: 'line-through', fontWeight: 600 }}>
              ${originalUsd.toLocaleString()}/yr
            </span>
            <span style={{ color: customColor || 'inherit' }}>
              ${discountedUsd.toLocaleString()}/yr
            </span>
            <span style={{ fontSize: '11px', background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.3)', color: '#00E676', padding: '2px 8px', borderRadius: '100px', fontWeight: 700, whiteSpace: 'nowrap' }}>
              🔥 2 Months FREE (Pay 10, Get 12)
            </span>
          </span>
        );
      }

      return (
        <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '8px' }}>
          <span style={{ fontSize: '0.55em', color: 'rgba(255,100,100,0.85)', textDecoration: 'line-through', fontWeight: 600 }}>
            ₹{originalInr.toLocaleString('en-IN')}/yr
          </span>
          <span style={{ color: customColor || 'inherit' }}>
            ₹{discountedInr.toLocaleString('en-IN')}/yr
          </span>
          <span style={{ fontSize: '11px', background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.3)', color: '#00E676', padding: '2px 8px', borderRadius: '100px', fontWeight: 700, whiteSpace: 'nowrap' }}>
            🔥 2 Months FREE (Pay 10, Get 12)
          </span>
        </span>
      );
    }

    if (currency === 'USD') return `$${usdMonthly.toLocaleString()}/mo`;
    return `₹${inrMonthly.toLocaleString('en-IN')}/mo`;
  };

  const getCardStyle = (cardId: string, isPopular = false) => {
    const isHovered = hoveredCard === cardId;
    const isAnyHovered = hoveredCard !== null;

    let opacity = 1;
    if (isAnyHovered && !isHovered) {
      opacity = 0.85;
    }

    return {
      padding: '36px 30px',
      background: isHovered
        ? 'linear-gradient(180deg, #202034 0%, #000000 100%)'
        : 'linear-gradient(180deg, #141422 0%, #05050a 100%)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      border: isHovered 
        ? '2px solid rgba(255, 255, 255, 0.65)' 
        : isPopular 
          ? '1.5px solid rgba(0, 230, 118, 0.5)' 
          : '1px solid rgba(255, 255, 255, 0.28)',
      borderRadius: '24px',
      display: 'flex',
      flexDirection: 'column' as const,
      justifyContent: 'space-between' as const,
      position: 'relative' as const,
      boxShadow: isHovered
        ? '0 28px 70px rgba(0, 0, 0, 0.98), 0 0 40px rgba(0, 0, 0, 0.9)'
        : '0 16px 48px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
      transform: isHovered ? 'translateY(-6px) scale(1.02)' : 'translateY(0)',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      opacity,
      zIndex: isHovered ? 20 : isPopular ? 10 : 1,
      overflow: 'visible' as const
    };
  };

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', color: '#fff', padding: '60px 20px 100px 20px', fontFamily: 'var(--font-sans)', overflowY: 'auto', position: 'relative' }}>
      
      {/* SHADER MESH MESH GRADIENT FLOWY BACKGROUND */}
      <FlowyBackground />

      <div style={{ maxWidth: '1400px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
        
        {/* HEADER HERO */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ textAlign: 'center', marginBottom: '40px' }}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 16px', background: 'rgba(124,117,255,0.12)', borderRadius: '100px', border: '1px solid rgba(124,117,255,0.3)', marginBottom: '16px', color: '#7C75FF', fontWeight: 600, fontSize: '13px' }}>
            <Sparkles size={14} /> RAFTRA TRANSPARENT PRICING & GROWTH PLANS
          </div>
          
          <h1 style={{ fontSize: '48px', fontFamily: 'var(--font-heading)', color: '#fff', marginBottom: '16px', fontWeight: 800, lineHeight: 1.2 }}>
            Scale Your Brand with Flexible AI Suites.<br/>Simple, Transparent & Value-Packed.
          </h1>

          <p style={{ fontSize: '17px', color: 'var(--text-secondary)', maxWidth: '750px', margin: '0 auto', lineHeight: 1.5 }}>
            Choose complete All-in-One Operating Suites, Dual-Module Starter Packs, or individual AI tools. Includes free core tools, creator escrow protection, and zero hidden costs.
          </p>
        </motion.div>

        {/* IMPORTANT PRICING & BUDGET DISCLAIMER BANNER */}
        <div style={{ 
          maxWidth: '1000px', 
          margin: '0 auto 36px auto', 
          padding: '18px 24px', 
          background: 'rgba(255, 179, 0, 0.08)', 
          border: '1px solid rgba(255, 179, 0, 0.3)', 
          borderRadius: '16px', 
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#FFB300', fontWeight: 700, fontSize: '14px' }}>
            <ShieldCheck size={18} />
            <span>IMPORTANT NOTICE REGARDING EXTERNAL COSTS & BUDGET ALLOCATION</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: '24px', color: 'rgba(255, 255, 255, 0.85)', fontSize: '13px', lineHeight: 1.6 }}>
            <li><strong>Paid Ads Budget Cost:</strong> Meta & Google Ad Spend budgets are paid directly to ad platforms and are separate from Raftra software & specialist retainer fees.</li>
            <li><strong>SEO & GEO Digital PRs:</strong> Paid PR placements, media publication fees, and external backlinks are separate from SEO specialist packages.</li>
            <li><strong>Influencer Collaboration Payouts:</strong> Direct creator deal payouts and escrow funds are separate from Raftra package pricing.</li>
          </ul>
        </div>

        {/* CURRENCY & BILLING TOGGLES (ULTRA-MODERN MINIMAL SEGMENTED CONTROL) */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap', 
          gap: '24px', 
          maxWidth: '960px', 
          margin: '0 auto 44px auto', 
          padding: '0 12px' 
        }}>
          
          {/* Currency Toggle */}
          <div style={{ 
            background: 'rgba(255, 255, 255, 0.03)', 
            backdropFilter: 'blur(16px)', 
            WebkitBackdropFilter: 'blur(16px)', 
            padding: '4px', 
            borderRadius: '12px', 
            border: '1px solid rgba(255, 255, 255, 0.08)', 
            display: 'flex', 
            alignItems: 'center',
            gap: '4px'
          }}>
            <button 
              onClick={() => handleCurrencyChange('INR')}
              style={{ 
                background: currency === 'INR' ? 'linear-gradient(180deg, #1c1c2b 0%, #0a0a10 100%)' : 'transparent', 
                color: currency === 'INR' ? '#00E676' : '#ffffff', 
                border: currency === 'INR' ? '1px solid rgba(0, 230, 118, 0.4)' : '1px solid transparent', 
                padding: '8px 20px', 
                borderRadius: '8px', 
                fontSize: '13.5px', 
                fontWeight: currency === 'INR' ? 700 : 500, 
                cursor: 'pointer',
                boxShadow: currency === 'INR' ? '0 4px 14px rgba(0, 230, 118, 0.15)' : 'none',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              INR (₹)
            </button>
            <button 
              onClick={() => handleCurrencyChange('USD')}
              style={{ 
                background: currency === 'USD' ? 'linear-gradient(180deg, #1c1c2b 0%, #0a0a10 100%)' : 'transparent', 
                color: currency === 'USD' ? '#00E676' : '#ffffff', 
                border: currency === 'USD' ? '1px solid rgba(0, 230, 118, 0.4)' : '1px solid transparent', 
                padding: '8px 20px', 
                borderRadius: '8px', 
                fontSize: '13.5px', 
                fontWeight: currency === 'USD' ? 700 : 500, 
                cursor: 'pointer',
                boxShadow: currency === 'USD' ? '0 4px 14px rgba(0, 230, 118, 0.15)' : 'none',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              USD ($)
            </button>
          </div>

          {/* Billing Cycle Toggle with Interactive Slider Switch */}
          <div 
            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
            style={{ 
              background: 'rgba(255, 255, 255, 0.03)', 
              backdropFilter: 'blur(16px)', 
              WebkitBackdropFilter: 'blur(16px)', 
              padding: '6px 18px', 
              borderRadius: '100px', 
              border: '1px solid rgba(255, 255, 255, 0.1)', 
              display: 'flex', 
              alignItems: 'center',
              gap: '14px',
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <span style={{ 
              fontSize: '13.5px', 
              fontWeight: billingCycle === 'monthly' ? 700 : 500, 
              color: billingCycle === 'monthly' ? '#00E676' : '#ffffff',
              transition: 'all 0.2s ease'
            }}>
              Monthly
            </span>

            {/* Toggle Switch Pill */}
            <div style={{
              width: '46px',
              height: '24px',
              background: billingCycle === 'annual' ? 'linear-gradient(180deg, #1c1c2b 0%, #0a0a10 100%)' : 'rgba(255, 255, 255, 0.08)',
              borderRadius: '100px',
              border: billingCycle === 'annual' ? '1px solid rgba(0, 230, 118, 0.4)' : '1px solid rgba(255, 255, 255, 0.18)',
              position: 'relative',
              padding: '2px',
              boxShadow: billingCycle === 'annual' ? '0 4px 12px rgba(0, 230, 118, 0.15)' : 'none',
              transition: 'all 0.25s ease'
            }}>
              <div style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: billingCycle === 'annual' ? '#00E676' : '#ffffff',
                boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                transform: billingCycle === 'annual' ? 'translateX(22px)' : 'translateX(0px)',
                transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
              }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ 
                fontSize: '13.5px', 
                fontWeight: billingCycle === 'annual' ? 700 : 500, 
                color: billingCycle === 'annual' ? '#00E676' : '#ffffff',
                transition: 'all 0.2s ease'
              }}>
                Yearly
              </span>
              <span style={{ fontSize: '10px', background: 'rgba(0,230,118,0.2)', border: '1px solid rgba(0,230,118,0.4)', color: '#00E676', padding: '2px 8px', borderRadius: '100px', fontWeight: 800 }}>
                Pay 10, Get 12 🔥
              </span>
            </div>
          </div>

        </div>

        {/* CATEGORY NAV TABS (SELECTION GREEN - NON SELECTION PURE WHITE) */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          gap: '8px', 
          flexWrap: 'wrap', 
          maxWidth: '1280px',
          margin: '0 auto 48px auto',
          padding: '0 10px'
        }}>
          {[
            { id: 'allinone', label: 'All-in-One Operating Suites', icon: Layers },
            { id: 'dual', label: 'Dual-Module Starter Packs', icon: Wand2 },
            { id: 'creative', label: 'Creative Studio', icon: ImageIcon },
            { id: 'campaign', label: 'Campaign Manager', icon: BarChart3 },
            { id: 'seo', label: 'SEO & GEO', icon: Search },
            { id: 'included', label: 'Free Core Tools & Escrow', icon: ShieldCheck },
            { id: 'credits', label: 'AI Credits Breakdown', icon: Sparkles }
          ].map(tab => {
            const Icon = tab.icon;
            const isSelected = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id as any)}
                style={{
                  background: isSelected 
                    ? '#000000' 
                    : 'rgba(255, 255, 255, 0.03)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: isSelected 
                    ? '1px solid rgba(0, 230, 118, 0.4)' 
                    : '1px solid rgba(255, 255, 255, 0.08)',
                  color: isSelected ? '#00E676' : '#ffffff',
                  padding: '8px 14px',
                  borderRadius: '100px',
                  fontSize: '12.5px',
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  boxShadow: isSelected 
                    ? '0 4px 16px rgba(0, 230, 118, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)' 
                    : '0 2px 8px rgba(0,0,0,0.2)',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                <Icon size={14} color={isSelected ? '#00E676' : '#ffffff'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ==================== SECTION 1: ALL-IN-ONE OPERATING SUITES ==================== */}
        {activeCategory === 'allinone' && (
          <div style={{ marginBottom: '80px' }}>
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <div style={{ fontSize: '12px', color: '#00E676', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
                COMPLETE ALL-IN-ONE EMPIRE SUITES
              </div>
              <h2 style={{ fontSize: '36px', color: '#fff', margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 800 }}>
                Raftra Complete Operating System Packages
              </h2>
              <p style={{ fontSize: '15px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                End-to-end AI Marketing suites combining Creative Studio, Campaign Manager, SEO & GEO, Social Hub, and Claude Max Analytics.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '28px', alignItems: 'stretch' }}>
              
              {/* 1. D2C Growth Pack ⭐ */}
              <div
                onMouseEnter={() => setHoveredCard('pack_d2c_growth')}
                onMouseLeave={() => setHoveredCard(null)}
                style={getCardStyle('pack_d2c_growth', true)}
              >
                <div>
                  <div style={{ background: '#FFB300', color: '#000', padding: '4px 12px', borderRadius: '100px', fontSize: '10.5px', fontWeight: 800, display: 'inline-block', marginBottom: '16px' }}>
                    🛍️ D2C GROWTH PACK ⭐
                  </div>

                  <h3 style={{ fontSize: '24px', color: '#fff', margin: '0 0 6px 0', fontFamily: 'var(--font-heading)' }}>D2C Growth Pack ⭐</h3>

                  <div style={{ fontSize: '36px', color: '#FFB300', fontWeight: 800, fontFamily: 'var(--font-heading)', marginBottom: '4px' }}>
                    {formatPrice(8999, 108, 89999)}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '20px' }}>
                    <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.6)' }}>
                      Individual Price: <span style={{ textDecoration: 'line-through' }}>₹2,499 + ₹3,499 + ₹4,999 = ₹10,997/mo</span>
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#FFB300', fontWeight: 700 }}>
                      🔥 Save ₹1,998/month (~18% OFF)
                    </div>
                  </div>

                  <div style={{ fontSize: '12px', color: '#FFB300', fontWeight: 700, marginBottom: '20px', background: 'rgba(255,179,0,0.12)', padding: '6px 14px', borderRadius: '8px', display: 'inline-block' }}>
                    15,000 AI Credits / month Included
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13.5px', color: '#ddd' }}>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> <strong>Creative Studio Pro</strong></li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> <strong>Campaign Manager Pro</strong></li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> <strong>SEO & GEO Starter</strong></li>
                  </ul>
                </div>

                <GlowButton variant="glow" onClick={onComplete} style={{ marginTop: '32px', padding: '14px', fontSize: '14px' }}>
                  Get D2C Growth Pack
                </GlowButton>
              </div>

              {/* 2. All-in-One Business Suite */}
              <div
                onMouseEnter={() => setHoveredCard('pack_business_suite')}
                onMouseLeave={() => setHoveredCard(null)}
                style={getCardStyle('pack_business_suite')}
              >
                <div>
                  <div style={{ display: 'inline-block', background: 'rgba(124,117,255,0.15)', border: '1px solid rgba(124,117,255,0.3)', color: '#7C75FF', padding: '4px 12px', borderRadius: '100px', fontSize: '10.5px', fontWeight: 700, marginBottom: '16px' }}>
                    💎 ALL-IN-ONE BUSINESS SUITE
                  </div>

                  <h3 style={{ fontSize: '24px', color: '#fff', margin: '0 0 6px 0', fontFamily: 'var(--font-heading)' }}>All-in-One Business Suite</h3>

                  <div style={{ fontSize: '36px', color: '#fff', fontWeight: 800, fontFamily: 'var(--font-heading)', marginBottom: '4px' }}>
                    {formatPrice(19999, 240, 199999)}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '20px' }}>
                    <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.6)' }}>
                      Individual Price: <span style={{ textDecoration: 'line-through' }}>₹4,999 + ₹3,499 + ₹14,999 = ₹23,497/mo</span>
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#00E676', fontWeight: 700 }}>
                      🔥 Save ₹3,498/month (~15% OFF)
                    </div>
                  </div>

                  <div style={{ fontSize: '12px', color: '#7C75FF', fontWeight: 700, marginBottom: '20px', background: 'rgba(124,117,255,0.12)', padding: '6px 14px', borderRadius: '8px', display: 'inline-block' }}>
                    40,000 AI Credits / month Included
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13.5px', color: '#ddd' }}>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> <strong>Creative Studio Business</strong></li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> <strong>Campaign Manager Pro</strong></li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> <strong>SEO & GEO Growth</strong></li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Full Claude Analytics & Social Hub</li>
                  </ul>
                </div>

                <button onClick={onComplete} style={{ marginTop: '32px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '14px', borderRadius: '100px', fontWeight: 700, cursor: 'pointer', width: '100%', fontSize: '14px' }}>
                  Get Business Suite
                </button>
              </div>

              {/* 3. Enterprise Growth Suite */}
              <div
                onMouseEnter={() => setHoveredCard('pack_enterprise')}
                onMouseLeave={() => setHoveredCard(null)}
                style={getCardStyle('pack_enterprise')}
              >
                <div>
                  <div style={{ display: 'inline-block', background: 'rgba(255,189,46,0.12)', border: '1px solid rgba(255,189,46,0.3)', color: '#FFBD2E', padding: '4px 12px', borderRadius: '100px', fontSize: '10.5px', fontWeight: 700, marginBottom: '16px' }}>
                    👑 ENTERPRISE GROWTH SUITE
                  </div>

                  <h3 style={{ fontSize: '24px', color: '#fff', margin: '0 0 6px 0', fontFamily: 'var(--font-heading)' }}>Enterprise Growth Suite</h3>

                  <div style={{ fontSize: '36px', color: '#FFBD2E', fontWeight: 800, fontFamily: 'var(--font-heading)', marginBottom: '4px' }}>
                    {formatPrice(44999, 540, 449999)}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '20px' }}>
                    <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.6)' }}>
                      Individual Price: <span style={{ textDecoration: 'line-through' }}>₹23,497 + ₹29,999 = ₹53,496/mo</span>
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#FFBD2E', fontWeight: 700 }}>
                      🔥 Save ₹8,497/month (~16% OFF)
                    </div>
                  </div>

                  <div style={{ fontSize: '12px', color: '#FFBD2E', fontWeight: 700, marginBottom: '20px', background: 'rgba(255,189,46,0.12)', padding: '6px 14px', borderRadius: '8px', display: 'inline-block' }}>
                    100,000 AI Credits / month Included
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13.5px', color: '#ddd' }}>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Everything in Business Suite</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Dedicated SEO/GEO Specialist</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Priority Support & Custom Integrations</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Team Members & Dedicated SLA Manager</li>
                  </ul>
                </div>

                <button onClick={onComplete} style={{ marginTop: '32px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '14px', borderRadius: '100px', fontWeight: 700, cursor: 'pointer', width: '100%', fontSize: '14px' }}>
                  Contact Enterprise
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ==================== SECTION 2: DUAL-MODULE STARTER PACKS ==================== */}
        {activeCategory === 'dual' && (
          <div style={{ marginBottom: '80px' }}>
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <div style={{ fontSize: '12px', color: '#00E676', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
                HEAVILY DISCOUNTED DUAL MODULE STARTER PACKS
              </div>
              <h2 style={{ fontSize: '36px', color: '#fff', margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 800 }}>
                Dual-Module Starter Bundles
              </h2>
              <p style={{ fontSize: '15px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                Combine 2 core marketing modules at a heavily discounted bundle rate with full Claude Analytics sync.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '28px', alignItems: 'stretch' }}>
              
              {/* 1. Creator Launch Pack */}
              <div
                onMouseEnter={() => setHoveredCard('pack_creator_launch')}
                onMouseLeave={() => setHoveredCard(null)}
                style={getCardStyle('pack_creator_launch', true)}
              >
                <div>
                  <div style={{ background: 'linear-gradient(90deg, #7C75FF 0%, #00E676 100%)', color: '#000', padding: '4px 12px', borderRadius: '100px', fontSize: '10.5px', fontWeight: 800, display: 'inline-block', marginBottom: '16px' }}>
                    🚀 MOST POPULAR STARTER PACK
                  </div>

                  <h3 style={{ fontSize: '24px', color: '#fff', margin: '0 0 6px 0', fontFamily: 'var(--font-heading)' }}>Creator Launch Pack</h3>
                  
                  <div style={{ fontSize: '36px', color: '#00E676', fontWeight: 800, fontFamily: 'var(--font-heading)', marginBottom: '4px' }}>
                    {formatPrice(4999, 59, 49999)}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '20px' }}>
                    <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.6)' }}>
                      Individual Price: <span style={{ textDecoration: 'line-through' }}>₹2,499 + ₹3,499 = ₹5,998/mo</span>
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#00E676', fontWeight: 700 }}>
                      🔥 Save ₹999/month (~17% OFF)
                    </div>
                  </div>

                  <div style={{ fontSize: '12px', color: '#7C75FF', fontWeight: 700, marginBottom: '20px', background: 'rgba(124,117,255,0.1)', padding: '6px 14px', borderRadius: '8px', display: 'inline-block' }}>
                    15,000 AI Credits / month Included
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13.5px', color: '#ddd' }}>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> <strong>Creative Studio Pro</strong></li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> <strong>Campaign Manager Pro</strong></li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Claude 3.5 Real-Time Ad Analytics Sync</li>
                  </ul>
                </div>

                <GlowButton variant="glow" onClick={onComplete} style={{ marginTop: '32px', padding: '14px', fontSize: '14px' }}>
                  Get Creator Launch Pack
                </GlowButton>
              </div>

              {/* 2. Growth Pack */}
              <div
                onMouseEnter={() => setHoveredCard('pack_growth')}
                onMouseLeave={() => setHoveredCard(null)}
                style={getCardStyle('pack_growth')}
              >
                <div>
                  <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '4px 12px', borderRadius: '100px', fontSize: '10.5px', fontWeight: 700, marginBottom: '16px' }}>
                    📈 PAID ADS + SEO STARTER
                  </div>

                  <h3 style={{ fontSize: '24px', color: '#fff', margin: '0 0 4px 0', fontFamily: 'var(--font-heading)' }}>Growth Pack</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 12px 0' }}>
                    Perfect for businesses creating creatives but wanting paid ads + SEO.
                  </p>

                  <div style={{ fontSize: '36px', color: '#fff', fontWeight: 800, fontFamily: 'var(--font-heading)', marginBottom: '4px' }}>
                    {formatPrice(6999, 84, 69999)}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '20px' }}>
                    <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.6)' }}>
                      Individual Price: <span style={{ textDecoration: 'line-through' }}>₹3,499 + ₹4,999 = ₹8,498/mo</span>
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#00E676', fontWeight: 700 }}>
                      🔥 Save ₹1,499/month (~18% OFF)
                    </div>
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13.5px', color: '#ddd' }}>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> <strong>Campaign Manager Pro</strong></li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> <strong>SEO & GEO Starter</strong></li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Full Analytics & Reports</li>
                  </ul>
                </div>

                <button onClick={onComplete} style={{ marginTop: '32px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '14px', borderRadius: '100px', fontWeight: 700, cursor: 'pointer', width: '100%', fontSize: '14px' }}>
                  Get Growth Pack
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ==================== MODULE 1: CREATIVE STUDIO PLANS ==================== */}
        {activeCategory === 'creative' && (
          <div style={{ marginBottom: '80px' }}>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '12px', color: '#7C75FF', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>MODULE 1</div>
              <h2 style={{ fontSize: '32px', color: '#fff', margin: '4px 0 0 0', fontFamily: 'var(--font-heading)' }}>Creative Studio (Credit Based + Claude Analytics Sync)</h2>
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
                    {formatPrice(1499, 19, 14999)}
                  </div>
                  <div style={{ fontSize: '13px', color: '#7C75FF', fontWeight: 700, marginBottom: '20px', background: 'rgba(124,117,255,0.1)', padding: '4px 12px', borderRadius: '6px', display: 'inline-block' }}>
                    5,000 AI Credits + Claude AI Sync
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: '#ccc' }}>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Image Ads Generation</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Product Photography Renders</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Basic Ad Copy & Photo Editing</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Carousel Ads Framework</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Claude 3.5 Analytics Reasoning Sync</li>
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
                    POPULAR CREATIVE TIER
                  </div>

                  <div style={{ fontSize: '18px', color: '#fff', fontWeight: 700, marginBottom: '6px' }}>Pro</div>
                  <div style={{ fontSize: '32px', color: '#00E676', fontWeight: 800, fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>
                    {formatPrice(2999, 35, 29999)}
                  </div>
                  <div style={{ fontSize: '13px', color: '#00E676', fontWeight: 700, marginBottom: '20px', background: 'rgba(0,230,118,0.1)', padding: '4px 12px', borderRadius: '6px', display: 'inline-block' }}>
                    15,000 AI Credits + Claude Max Sync
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: '#ccc' }}>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> <strong>Everything in Starter</strong></li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> 15s / 30s / 60s AI Video Ads</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> AI UGC Video Reels & Avatars</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Advanced In-Place Ad Editing</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Claude Max Real-time Performance Sync</li>
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
                    {formatPrice(5499, 65, 54999)}
                  </div>
                  <div style={{ fontSize: '13px', color: '#7C75FF', fontWeight: 700, marginBottom: '20px', background: 'rgba(124,117,255,0.1)', padding: '4px 12px', borderRadius: '6px', display: 'inline-block' }}>
                    40,000 AI Credits + Claude Max Sync
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

        {/* ==================== MODULE 2: CAMPAIGN MANAGER ==================== */}
        {activeCategory === 'campaign' && (
          <div style={{ marginBottom: '80px' }}>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '12px', color: '#7C75FF', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>MODULE 2</div>
              <h2 style={{ fontSize: '32px', color: '#fff', margin: '4px 0 0 0', fontFamily: 'var(--font-heading)' }}>Campaign Manager Plan</h2>
            </div>

            <div
              onMouseEnter={() => setHoveredCard('cm_pro_single')}
              onMouseLeave={() => setHoveredCard(null)}
              style={{
                ...getCardStyle('cm_pro_single', true),
                padding: '36px'
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '36px', alignItems: 'center', width: '100%' }}>
                
                {/* Left Column: Title, Price & Action CTA */}
                <div style={{ borderRight: '1px solid rgba(255, 255, 255, 0.1)', paddingRight: '28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <div style={{ background: 'linear-gradient(90deg, #7C75FF 0%, #00E676 100%)', color: '#000', padding: '4px 12px', borderRadius: '100px', fontSize: '10px', fontWeight: 800, display: 'inline-block', marginBottom: '10px', letterSpacing: '0.05em' }}>
                      RECOMMENDED CAMPAIGN SUITE ⭐
                    </div>
                    <h3 style={{ fontSize: '24px', color: '#fff', margin: '0 0 6px 0', fontFamily: 'var(--font-heading)', lineHeight: 1.2 }}>
                      Campaign Manager Pro ⭐
                    </h3>
                    <div style={{ fontSize: '36px', color: '#00E676', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
                      {formatPrice(3499, 42, 34999)}
                    </div>
                  </div>

                  <GlowButton variant="glow" onClick={onComplete} style={{ width: '100%', padding: '14px 24px', fontSize: '14.5px' }}>
                    Get Campaign Pro
                  </GlowButton>
                </div>

                {/* Right Column: 19 Features arranged in Horizontal Clean Grid Pills */}
                <div>
                  <div style={{ fontSize: '12px', color: '#7C75FF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' }}>
                    Included Features & Capabilities (19 Tools)
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '8px 12px', fontSize: '12px', color: '#e0e0e0' }}>
                    {[
                      'Unlimited Campaign Creation',
                      'Meta Ads Publishing',
                      'Google Ads Publishing',
                      'OAuth Integrations',
                      'AI Campaign Builder',
                      'Audience Suggestions',
                      'Budget Planner',
                      'Campaign Objectives',
                      'Creative Linking',
                      'Campaign Dashboard',
                      'Performance Analytics',
                      'Claude AI Recommendations',
                      'AI Optimization Suggestions',
                      'Creative Performance Analysis',
                      'A/B Test Recommendations',
                      'Multi-Platform Campaigns',
                      'Team Collaboration',
                      'Campaign History',
                      'Export Reports'
                    ].map((feature, idx) => (
                      <div key={idx} style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        padding: '6px 10px', 
                        background: 'rgba(255,255,255,0.03)', 
                        borderRadius: '8px', 
                        border: '1px solid rgba(255,255,255,0.06)' 
                      }}>
                        <Check size={13} color="var(--success)" style={{ flexShrink: 0 }} />
                        <span style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ==================== MODULE 3: SEO & GEO PLANS ==================== */}
        {activeCategory === 'seo' && (
          <div style={{ marginBottom: '80px' }}>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '12px', color: '#7C75FF', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>MODULE 3</div>
              <h2 style={{ fontSize: '32px', color: '#fff', margin: '4px 0 0 0', fontFamily: 'var(--font-heading)' }}>SEO & GEO Search Engine Optimization</h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
              
              {/* Starter */}
              <div
                onMouseEnter={() => setHoveredCard('seo_starter')}
                onMouseLeave={() => setHoveredCard(null)}
                style={getCardStyle('seo_starter')}
              >
                <div>
                  <div style={{ fontSize: '18px', color: '#fff', fontWeight: 700, marginBottom: '6px' }}>SEO Starter</div>
                  <div style={{ fontSize: '32px', color: '#fff', fontWeight: 800, fontFamily: 'var(--font-heading)', marginBottom: '16px' }}>
                    {formatPrice(3499, 42, 34999)}
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: '#ccc' }}>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Weekly SEO Audit</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Weekly GEO Audit</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> AI Optimization Recommendations</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Claude GEO Search Visibility Tracking</li>
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
                    POPULAR SEO TIER ⭐
                  </div>

                  <div style={{ fontSize: '18px', color: '#fff', fontWeight: 700, marginBottom: '6px' }}>SEO Growth</div>
                  <div style={{ fontSize: '32px', color: '#00E676', fontWeight: 800, fontFamily: 'var(--font-heading)', marginBottom: '16px' }}>
                    {formatPrice(9999, 119, 99999)}
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: '#ccc' }}>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> <strong>Everything in Starter +</strong></li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> GSC & GA4 Real-time Claude Integration</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> WordPress / Shopify / GitHub Connect</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> One-Click CMS Publishing</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> AI Blog & Landing Page Writer</li>
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
                    {formatPrice(30999, 369, 309999)}
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: '#ccc' }}>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> <strong>Everything in Growth +</strong></li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Dedicated SEO & GEO Specialist</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Backlink Outreach & Guest Posting</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Digital PR & Authority Building</li>
                  </ul>
                </div>

                <button onClick={onComplete} style={{ marginTop: '28px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '12px', borderRadius: '100px', fontWeight: 600, cursor: 'pointer' }}>
                  Get Managed SEO
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ==================== DEDICATED SECTION: FREE INCLUDED MODULES, SPECIALIST BENEFITS & ESCROW TRANSPARENCY ==================== */}
        {(activeCategory === 'included' || activeCategory === 'allinone' || activeCategory === 'dual') && (
          <div style={{ marginBottom: '80px' }}>
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <div style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
                ALWAYS INCLUDED FREE WITH RAFTRA ACCOUNTS
              </div>
              <h2 style={{ fontSize: '36px', color: '#fff', margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 800 }}>
                Included Core Tools, Specialist Growth & Escrow
              </h2>
              <p style={{ fontSize: '15px', color: 'var(--text-secondary)', marginTop: '8px', maxWidth: '750px', margin: '8px auto 0 auto' }}>
                Every Raftra account gets free lifetime access to Social Hub operations, direct creator discovery with escrow funds protection, and unified analytics.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '28px' }}>
              
              {/* Social Hub Card */}
              <div
                onMouseEnter={() => setHoveredCard('inc_social')}
                onMouseLeave={() => setHoveredCard(null)}
                style={getCardStyle('inc_social')}
              >
                <div>
                  <div style={{ display: 'inline-block', background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.3)', color: 'var(--success)', padding: '4px 12px', borderRadius: '100px', fontSize: '11px', fontWeight: 700, marginBottom: '16px' }}>
                    INCLUDED FREE WITH PLATFORM ACCESS
                  </div>
                  
                  <h3 style={{ fontSize: '24px', color: '#fff', margin: '0 0 10px 0', fontFamily: 'var(--font-heading)' }}>
                    Social Hub Workspace
                  </h3>

                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.6 }}>
                    Complete Social Media Operations Hub. Includes Editorial Calendar, Multi-Channel Post Planner, Drag-and-Drop Publishing Schedule, Team Collaboration, and Notification Center.
                  </p>

                  <div style={{ background: 'rgba(124,117,255,0.1)', border: '1px solid rgba(124,117,255,0.25)', padding: '16px', borderRadius: '16px', fontSize: '13px', color: '#ddd', lineHeight: 1.6 }}>
                    <strong style={{ color: '#7C75FF', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '14px' }}>
                      <Users2 size={16} /> Key Benefits of Raftra Specialist Operations:
                    </strong>
                    Raftra replaces 60–80% repetitive manual execution. Verified Raftra Specialists (Social Media Managers, Paid Ads Experts, SEO/GEO Strategists, CRO Specialists, Influencer Managers) handle strategy, creative direction, approvals, and high-stakes business growth so your core team stays focused on scaling.
                  </div>
                </div>
              </div>

              {/* Influencer Marketplace with Escrow & Direct Chat */}
              <div
                onMouseEnter={() => setHoveredCard('inc_influencer')}
                onMouseLeave={() => setHoveredCard(null)}
                style={getCardStyle('inc_influencer')}
              >
                <div>
                  <div style={{ display: 'inline-block', background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.3)', color: 'var(--success)', padding: '4px 12px', borderRadius: '100px', fontSize: '11px', fontWeight: 700, marginBottom: '16px' }}>
                    FREE CREATOR DISCOVERY & DIRECT CHAT
                  </div>

                  <h3 style={{ fontSize: '24px', color: '#fff', margin: '0 0 10px 0', fontFamily: 'var(--font-heading)' }}>
                    Influencer & Creator Marketplace
                  </h3>

                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.6 }}>
                    Browse 500+ verified Indian D2C & Tech UGC creators, review past performance metrics, check video samples, and collaborate directly with zero upfront subscription fees.
                  </p>

                  <div style={{ background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.25)', padding: '16px', borderRadius: '16px', fontSize: '13px', color: '#ddd', lineHeight: 1.6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#00E676', fontWeight: 700, marginBottom: '6px', fontSize: '14px' }}>
                      <MessageSquare size={16} /> Direct Live Chat & <Lock size={16} /> Raftra Escrow Funds Protection Benefits:
                    </div>
                    Direct Live Transparency Chat & Deal Briefing. Collaborate directly with 500+ verified D2C & Tech UGC creators with complete visibility. Your campaign funds are securely <strong>LOCKED IN RAFTRA ESCROW and NOT DISBURSED</strong> to the creator until final deliverables & video assets are fully approved by you.
                  </div>
                </div>
              </div>

              {/* Analytics Card */}
              <div
                onMouseEnter={() => setHoveredCard('inc_analytics')}
                onMouseLeave={() => setHoveredCard(null)}
                style={getCardStyle('inc_analytics')}
              >
                <div>
                  <div style={{ display: 'inline-block', background: 'rgba(124,117,255,0.15)', border: '1px solid rgba(124,117,255,0.3)', color: '#7C75FF', padding: '4px 12px', borderRadius: '100px', fontSize: '11px', fontWeight: 700, marginBottom: '16px' }}>
                    MODULE INCLUDED FREE
                  </div>

                  <h3 style={{ fontSize: '24px', color: '#fff', margin: '0 0 10px 0', fontFamily: 'var(--font-heading)' }}>
                    Analytics & Insights
                  </h3>

                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.6 }}>
                    Included free with purchased modules. Tracks Marketing ROAS/CPA, Creative Performance, SEO Prompt Tracking, and AI Visibility Rankings with Claude Max Reasoning Engine.
                  </p>

                  <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', padding: '16px', borderRadius: '16px', fontSize: '13px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600 }}>Operational Credit Cost:</span>
                    <strong style={{ color: '#00E676' }}>0 Extra AI Credits Consumed</strong>
                  </div>
                </div>
              </div>

              {/* Marketplace Revenue & Commission Structure */}
              <div
                onMouseEnter={() => setHoveredCard('inc_commission')}
                onMouseLeave={() => setHoveredCard(null)}
                style={getCardStyle('inc_commission')}
              >
                <div>
                  <div style={{ display: 'inline-block', background: 'rgba(255,189,46,0.15)', border: '1px solid rgba(255,189,46,0.3)', color: '#FFBD2E', padding: '4px 12px', borderRadius: '100px', fontSize: '11px', fontWeight: 700, marginBottom: '16px' }}>
                    TRANSPARENT REVENUE & COMMISSION MODEL
                  </div>

                  <h3 style={{ fontSize: '24px', color: '#fff', margin: '0 0 10px 0', fontFamily: 'var(--font-heading)' }}>
                    Marketplace & Hire Commissions
                  </h3>

                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.6 }}>
                    No hidden charges. Platform commissions apply only when completing deal payouts or hiring verified specialists through Raftra Escrow.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.25)', padding: '12px 16px', borderRadius: '12px', fontSize: '13px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span><strong>Influencer Marketplace:</strong></span>
                      <strong style={{ color: '#00E676', fontSize: '15px' }}>10% Commission</strong>
                    </div>

                    <div style={{ background: 'rgba(124,117,255,0.08)', border: '1px solid rgba(124,117,255,0.25)', padding: '12px 16px', borderRadius: '12px', fontSize: '13px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span><strong>Hire a Specialist:</strong></span>
                      <strong style={{ color: '#7C75FF', fontSize: '15px' }}>20% Commission</strong>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ==================== AI CREDIT CONSUMPTION TABLE & TOP-UPS ==================== */}
        {activeCategory === 'credits' && (
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
                AI Credits are ONLY consumed when generating or editing media. Basic dashboards, publishing, and static reports do not consume credits.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '40px' }}>
              
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <h4 style={{ fontSize: '15px', color: '#7C75FF', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ImageIcon size={16} /> Image Generation
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
                  <Video size={16} /> Video Generation
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
                  <Users2 size={16} /> AI UGC & Voice
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
                  <Cpu size={16} /> Claude Analytics Engine
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Claude 3.5 Analytics Query</span><strong>5 Credits</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Claude Max Strategy Plan</span><strong>10 Credits</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Ad Kill Recommendation</span><strong>5 Credits</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Audience Research Query</span><strong>8 Credits</strong></div>
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
        )}

      </div>
    </div>
  );
};
