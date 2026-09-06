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

interface AdSpendTierData {
  range: string;
  label: string;
  inr: number;
  usd: number;
  inrAnnual: number;
  isEnterprise?: boolean;
  d2c: { inr: number; usd: number; annual: number; indInr: number; saveInr: number };
  business: { inr: number; usd: number; annual: number; indInr: number; saveInr: number };
  creatorLaunch: { inr: number; usd: number; annual: number; indInr: number; saveInr: number };
  growthPack: { inr: number; usd: number; annual: number; indInr: number; saveInr: number };
}

const AD_SPEND_TIERS: AdSpendTierData[] = [
  {
    range: '₹0 – ₹10,000',
    label: '₹0 – ₹10,000 / mo',
    inr: 999, usd: 12, inrAnnual: 9999,
    d2c: { inr: 6899, usd: 82, annual: 68999, indInr: 8497, saveInr: 1598 },
    business: { inr: 17899, usd: 214, annual: 178999, indInr: 20997, saveInr: 3098 },
    creatorLaunch: { inr: 2999, usd: 36, annual: 29999, indInr: 3498, saveInr: 499 },
    growthPack: { inr: 4899, usd: 58, annual: 48999, indInr: 5998, saveInr: 1099 }
  },
  {
    range: '₹10,001 – ₹25,000',
    label: '₹10,001 – ₹25,000 / mo',
    inr: 1899, usd: 23, inrAnnual: 18999,
    d2c: { inr: 7599, usd: 90, annual: 75999, indInr: 9397, saveInr: 1798 },
    business: { inr: 18599, usd: 223, annual: 185999, indInr: 21897, saveInr: 3298 },
    creatorLaunch: { inr: 3699, usd: 44, annual: 36999, indInr: 4398, saveInr: 699 },
    growthPack: { inr: 5599, usd: 67, annual: 55999, indInr: 6898, saveInr: 1299 }
  },
  {
    range: '₹25,001 – ₹50,000',
    label: '₹25,001 – ₹50,000 / mo',
    inr: 2799, usd: 34, inrAnnual: 27999,
    d2c: { inr: 8299, usd: 99, annual: 82999, indInr: 10297, saveInr: 1998 },
    business: { inr: 19299, usd: 231, annual: 192999, indInr: 22797, saveInr: 3498 },
    creatorLaunch: { inr: 4399, usd: 52, annual: 43999, indInr: 5298, saveInr: 899 },
    growthPack: { inr: 6299, usd: 75, annual: 62999, indInr: 7798, saveInr: 1499 }
  },
  {
    range: '₹50,001 – ₹2,00,000',
    label: '₹50,001 – ₹2,00,000 / mo',
    inr: 3499, usd: 42, inrAnnual: 34999,
    d2c: { inr: 8999, usd: 108, annual: 89999, indInr: 10997, saveInr: 1998 },
    business: { inr: 19999, usd: 240, annual: 199999, indInr: 23497, saveInr: 3498 },
    creatorLaunch: { inr: 4999, usd: 59, annual: 49999, indInr: 5998, saveInr: 999 },
    growthPack: { inr: 6999, usd: 84, annual: 69999, indInr: 8498, saveInr: 1499 }
  },
  {
    range: '₹2,00,000+',
    label: '₹2,00,000+ / mo',
    inr: 4599, usd: 55, inrAnnual: 45999,
    d2c: { inr: 9899, usd: 118, annual: 98999, indInr: 12097, saveInr: 2198 },
    business: { inr: 20999, usd: 252, annual: 209999, indInr: 24597, saveInr: 3598 },
    creatorLaunch: { inr: 5899, usd: 70, annual: 58999, indInr: 7098, saveInr: 1199 },
    growthPack: { inr: 7899, usd: 94, annual: 78999, indInr: 9598, saveInr: 1699 }
  },
  {
    range: '₹10,00,000+ (Enterprise)',
    label: '₹10,00,000+ (Enterprise)',
    inr: 0, usd: 0, inrAnnual: 0, isEnterprise: true,
    d2c: { inr: 0, usd: 0, annual: 0, indInr: 0, saveInr: 0 },
    business: { inr: 0, usd: 0, annual: 0, indInr: 0, saveInr: 0 },
    creatorLaunch: { inr: 0, usd: 0, annual: 0, indInr: 0, saveInr: 0 },
    growthPack: { inr: 0, usd: 0, annual: 0, indInr: 0, saveInr: 0 }
  }
];

export const PricingScreen: React.FC<PricingScreenProps> = ({ onComplete }) => {
  const [activeCategory, setActiveCategory] = useState<'allinone' | 'dual' | 'creative' | 'campaign' | 'seo' | 'included' | 'credits'>('allinone');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [currency, setCurrency] = useState<'INR' | 'USD'>(() => (localStorage.getItem('currency') as 'INR' | 'USD') || 'INR');
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [adSpendIndex, setAdSpendIndex] = useState<number>(3); // Default ₹50,001 – ₹2,00,000 tier
  
  // Inquiry Form State for Enterprise Sales Inquiry
  const [showInquiryModal, setShowInquiryModal] = useState<boolean>(false);
  const [inquiryForm, setInquiryForm] = useState({
    name: '',
    brandName: '',
    email: '',
    phone: '',
    budget: '₹54,999+/mo (Enterprise Growth Partner)',
    paidAdsBudget: 'No Idea / Need Advice',
    seoPrBudget: 'No Idea / Need Advice',
    notes: ''
  });
  const [inquirySubmitted, setInquirySubmitted] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await fetch('/api/v1/workspaces/enterprise/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inquiryForm)
      });
    } catch (err) {
      console.warn('Enterprise inquiry logged locally:', err);
    }

    const subject = encodeURIComponent(`Enterprise Growth Partner Inquiry - ${inquiryForm.brandName || inquiryForm.name || 'Brand Inquiry'}`);
    const body = encodeURIComponent(
      `FULL NAME: ${inquiryForm.name}\n` +
      `BRAND / COMPANY NAME: ${inquiryForm.brandName}\n` +
      `WORK EMAIL: ${inquiryForm.email}\n` +
      `PHONE NUMBER: ${inquiryForm.phone}\n` +
      `ENTERPRISE GROWTH BUDGET: ${inquiryForm.budget}\n` +
      `PAID ADS BUDGET (INR): ${inquiryForm.paidAdsBudget}\n` +
      `SEO & DIGITAL PR BUDGET (INR): ${inquiryForm.seoPrBudget}\n\n` +
      `MARKETING REQUIREMENTS & GOALS:\n${inquiryForm.notes}\n\n` +
      `Routed to raftra.77mail.com`
    );

    window.open(`mailto:raftra.77mail.com?subject=${subject}&body=${body}`, '_blank');
    setIsSubmitting(false);
    setInquirySubmitted(true);
  };

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

      <div style={{ maxWidth: '1720px', margin: '0 auto', padding: '0 40px', position: 'relative', zIndex: 1 }}>
        
        {/* HEADER HERO */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ textAlign: 'center', marginBottom: '40px' }}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 16px', background: 'rgba(124,117,255,0.12)', borderRadius: '100px', border: '1px solid rgba(124,117,255,0.3)', marginBottom: '16px', color: '#7C75FF', fontWeight: 600, fontSize: '13.5px' }}>
            <Sparkles size={14} /> RAFTRA TRANSPARENT PRICING & GROWTH PLANS
          </div>
          
          <h1 style={{ fontSize: 'clamp(30px, 6vw, 52px)', fontFamily: 'var(--font-heading)', color: '#fff', marginBottom: '16px', fontWeight: 800, lineHeight: 1.2 }}>
            Scale Your Brand with Flexible AI Suites.<br/>Simple, Transparent & Value-Packed.
          </h1>

          <p style={{ fontSize: '19px', color: 'var(--text-secondary)', maxWidth: '1150px', margin: '0 auto', lineHeight: 1.5 }}>
            Choose complete All-in-One Operating Suites, Dual-Module Starter Packs, or individual AI tools. Includes free core tools, creator escrow protection, and zero hidden costs.
          </p>

          {/* ALL PAID PLANS INCLUDE PILL BAR */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            gap: '10px', 
            margin: '24px auto 0 auto', 
            padding: '16px 28px', 
            background: 'rgba(0, 230, 118, 0.06)', 
            border: '1px solid rgba(0, 230, 118, 0.25)', 
            borderRadius: '16px', 
            maxWidth: '1350px' 
          }}>
            <div style={{ fontSize: '13.5px', color: '#00E676', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              ✓ ALL PAID PLANS INCLUDE:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '20px', fontSize: '14.5px', color: '#ffffff', fontWeight: 600 }}>
              <span>✓ AI Assistant</span>
              <span>✓ Smart AI Routing</span>
              <span>✓ Automatic Publishing</span>
              <span>✓ Analytics</span>
              <span>✓ Team Collaboration</span>
              <span>✓ Continuous Platform Updates</span>
            </div>
          </div>
        </motion.div>

        {/* IMPORTANT PRICING & BUDGET DISCLAIMER BANNER */}
        <div style={{ 
          maxWidth: '1450px', 
          margin: '0 auto 36px auto', 
          padding: '20px 28px', 
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

        {/* TOP CONTROLS BAR: CURRENCY (LEFT), AD SPEND (CENTER), BILLING (RIGHT) */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap', 
          gap: '20px', 
          maxWidth: '1280px', 
          margin: '0 auto 40px auto', 
          padding: '0 20px' 
        }}>
          
          {/* Left: Currency Toggle (Fully Rounded Edges) */}
          <div style={{ 
            background: 'rgba(255, 255, 255, 0.04)', 
            backdropFilter: 'blur(16px)', 
            WebkitBackdropFilter: 'blur(16px)', 
            padding: '6px', 
            borderRadius: '100px', 
            border: '1px solid rgba(255, 255, 255, 0.12)', 
            display: 'flex', 
            alignItems: 'center',
            gap: '6px'
          }}>
            <button 
              onClick={() => handleCurrencyChange('INR')}
              style={{ 
                background: currency === 'INR' ? 'linear-gradient(180deg, #1c1c2b 0%, #0a0a10 100%)' : 'transparent', 
                color: currency === 'INR' ? '#00E676' : '#ffffff', 
                border: currency === 'INR' ? '1px solid rgba(0, 230, 118, 0.4)' : '1px solid transparent', 
                padding: '10px 24px', 
                borderRadius: '100px', 
                fontSize: '15.5px', 
                fontWeight: currency === 'INR' ? 800 : 600, 
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
                padding: '10px 24px', 
                borderRadius: '100px', 
                fontSize: '15.5px', 
                fontWeight: currency === 'USD' ? 800 : 600, 
                cursor: 'pointer',
                boxShadow: currency === 'USD' ? '0 4px 14px rgba(0, 230, 118, 0.15)' : 'none',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              USD ($)
            </button>
          </div>

          {/* Center: Ad Spend Selector Bar */}
          <div className="pricing-adspend" style={{
            background: 'rgba(124, 117, 255, 0.08)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            padding: '8px 24px',
            borderRadius: '100px',
            border: '1px solid rgba(124, 117, 255, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#7C75FF', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={16} /> Ad Spend:
            </span>
            <select
              value={adSpendIndex}
              onChange={(e) => setAdSpendIndex(Number(e.target.value))}
              style={{
                background: '#0b0b14',
                border: '1.5px solid #7C75FF',
                borderRadius: '100px',
                color: '#ffffff',
                padding: '8px 18px',
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              {AD_SPEND_TIERS.map((tier, idx) => (
                <option key={idx} value={idx} style={{ background: '#0b0b14', color: '#fff' }}>
                  {tier.range}
                </option>
              ))}
            </select>
          </div>

          {/* Right: Billing Cycle Toggle */}
          <div 
            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
            style={{ 
              background: 'rgba(255, 255, 255, 0.04)', 
              backdropFilter: 'blur(16px)', 
              WebkitBackdropFilter: 'blur(16px)', 
              padding: '8px 24px', 
              borderRadius: '100px', 
              border: '1px solid rgba(255, 255, 255, 0.12)', 
              display: 'flex', 
              alignItems: 'center',
              gap: '16px',
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <span style={{ 
              fontSize: '16px', 
              fontWeight: billingCycle === 'monthly' ? 800 : 500, 
              color: billingCycle === 'monthly' ? '#00E676' : '#ffffff',
              transition: 'all 0.2s ease'
            }}>
              Monthly
            </span>

            {/* Switch Pill */}
            <div style={{
              width: '50px',
              height: '26px',
              background: billingCycle === 'annual' ? 'linear-gradient(180deg, #1c1c2b 0%, #0a0a10 100%)' : 'rgba(255, 255, 255, 0.08)',
              borderRadius: '100px',
              border: billingCycle === 'annual' ? '1px solid rgba(0, 230, 118, 0.4)' : '1px solid rgba(255, 255, 255, 0.18)',
              position: 'relative',
              padding: '2px',
              boxShadow: billingCycle === 'annual' ? '0 4px 12px rgba(0, 230, 118, 0.15)' : 'none',
              transition: 'all 0.25s ease'
            }}>
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: billingCycle === 'annual' ? '#00E676' : '#ffffff',
                boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                transform: billingCycle === 'annual' ? 'translateX(24px)' : 'translateX(0px)',
                transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
              }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ 
                fontSize: '16px', 
                fontWeight: billingCycle === 'annual' ? 800 : 500, 
                color: billingCycle === 'annual' ? '#00E676' : '#ffffff',
                transition: 'all 0.2s ease'
              }}>
                Yearly
              </span>
              <span style={{ fontSize: '11px', background: 'rgba(0,230,118,0.2)', border: '1px solid rgba(0,230,118,0.4)', color: '#00E676', padding: '3px 10px', borderRadius: '100px', fontWeight: 800 }}>
                Pay 10, Get 12 🔥
              </span>
            </div>
          </div>

        </div>

        {/* CATEGORY NAV TABS (SINGLE ROW HORIZONTAL SPAN — LARGE TEXT & PADDED BUTTONS) */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          gap: '10px', 
          flexWrap: 'nowrap', 
          width: '100%',
          maxWidth: '1600px',
          margin: '0 auto 48px auto',
          padding: '0 20px',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch'
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
                  flex: '1 1 auto',
                  background: isSelected 
                    ? '#000000' 
                    : 'rgba(255, 255, 255, 0.04)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: isSelected 
                    ? '1.5px solid rgba(0, 230, 118, 0.5)' 
                    : '1px solid rgba(255, 255, 255, 0.12)',
                  color: isSelected ? '#00E676' : '#ffffff',
                  padding: '12px 20px',
                  borderRadius: '100px',
                  fontSize: '15.5px',
                  fontWeight: isSelected ? 800 : 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  whiteSpace: 'nowrap',
                  boxShadow: isSelected 
                    ? '0 4px 20px rgba(0, 230, 118, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15)' 
                    : '0 2px 8px rgba(0,0,0,0.2)',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                <Icon size={18} color={isSelected ? '#00E676' : '#ffffff'} />
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
                COMPLETE ALL-IN-ONE EMPIRE SUITES & FULL-SERVICE GROWTH PARTNERSHIPS
              </div>
              <h2 style={{ fontSize: 'clamp(25px, 4.8vw, 36px)', color: '#fff', margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 800 }}>
                Raftra Complete Operating System & Growth Partner Packages
              </h2>
              <p style={{ fontSize: '16px', color: 'var(--text-secondary)', marginTop: '8px', maxWidth: '900px', margin: '8px auto 0 auto' }}>
                Choose from self-serve AI suites or our flagship <strong>Full-Service Growth Partner Package</strong> — where we handle your complete end-to-end marketing, social media, paid ads, and influencer hiring using Raftra's AI tools.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: '28px', alignItems: 'stretch' }}>
              
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

                  <div style={{ fontSize: 'clamp(25px, 4.8vw, 36px)', color: '#FFB300', fontWeight: 800, fontFamily: 'var(--font-heading)', marginBottom: '4px' }}>
                    {AD_SPEND_TIERS[adSpendIndex].isEnterprise ? (
                      <span style={{ fontSize: '28px', color: '#FFB300' }}>Custom Enterprise</span>
                    ) : (
                      formatPrice(AD_SPEND_TIERS[adSpendIndex].d2c.inr, AD_SPEND_TIERS[adSpendIndex].d2c.usd, AD_SPEND_TIERS[adSpendIndex].d2c.annual)
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '20px' }}>
                    <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.6)' }}>
                      Individual Price: <span style={{ textDecoration: 'line-through' }}>₹2,499 + ₹{AD_SPEND_TIERS[adSpendIndex].inr.toLocaleString('en-IN')} + ₹4,999 = ₹{AD_SPEND_TIERS[adSpendIndex].d2c.indInr.toLocaleString('en-IN')}/mo</span>
                    </div>
                    {!AD_SPEND_TIERS[adSpendIndex].isEnterprise && (
                      <div style={{ fontSize: '12.5px', color: '#FFB300', fontWeight: 700 }}>
                        🔥 Save ₹{AD_SPEND_TIERS[adSpendIndex].d2c.saveInr.toLocaleString('en-IN')}/month
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: '12px', color: '#FFB300', fontWeight: 700, marginBottom: '20px', background: 'rgba(255,179,0,0.12)', padding: '6px 14px', borderRadius: '8px', display: 'inline-block' }}>
                    15,000 AI Credits / month Included
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13.5px', color: '#ddd' }}>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> <strong>Creative Studio Pro</strong></li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> <strong>Campaign Manager ({AD_SPEND_TIERS[adSpendIndex].range})</strong></li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> <strong>SEO & GEO Starter</strong></li>
                  </ul>
                </div>

                <GlowButton variant="glow" onClick={onComplete} style={{ marginTop: '32px', padding: '14px', fontSize: '14px' }}>
                  {AD_SPEND_TIERS[adSpendIndex].isEnterprise ? 'Contact Enterprise Sales' : 'Get D2C Growth Pack'}
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

                  <div style={{ fontSize: 'clamp(25px, 4.8vw, 36px)', color: '#fff', fontWeight: 800, fontFamily: 'var(--font-heading)', marginBottom: '4px' }}>
                    {AD_SPEND_TIERS[adSpendIndex].isEnterprise ? (
                      <span style={{ fontSize: '28px', color: '#FFB300' }}>Custom Enterprise</span>
                    ) : (
                      formatPrice(AD_SPEND_TIERS[adSpendIndex].business.inr, AD_SPEND_TIERS[adSpendIndex].business.usd, AD_SPEND_TIERS[adSpendIndex].business.annual)
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '20px' }}>
                    <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.6)' }}>
                      Individual Price: <span style={{ textDecoration: 'line-through' }}>₹4,999 + ₹{AD_SPEND_TIERS[adSpendIndex].inr.toLocaleString('en-IN')} + ₹14,999 = ₹{AD_SPEND_TIERS[adSpendIndex].business.indInr.toLocaleString('en-IN')}/mo</span>
                    </div>
                    {!AD_SPEND_TIERS[adSpendIndex].isEnterprise && (
                      <div style={{ fontSize: '12.5px', color: '#00E676', fontWeight: 700 }}>
                        🔥 Save ₹{AD_SPEND_TIERS[adSpendIndex].business.saveInr.toLocaleString('en-IN')}/month
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: '12px', color: '#7C75FF', fontWeight: 700, marginBottom: '20px', background: 'rgba(124,117,255,0.12)', padding: '6px 14px', borderRadius: '8px', display: 'inline-block' }}>
                    40,000 AI Credits / month Included
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13.5px', color: '#ddd' }}>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> <strong>Creative Studio Business</strong></li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> <strong>Campaign Manager ({AD_SPEND_TIERS[adSpendIndex].range})</strong></li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> <strong>SEO & GEO Growth</strong></li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Full Claude Analytics Recommendations & Social Hub</li>
                  </ul>
                </div>

                <button onClick={onComplete} style={{ marginTop: '32px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '14px', borderRadius: '100px', fontWeight: 700, cursor: 'pointer', width: '100%', fontSize: '14px' }}>
                  {AD_SPEND_TIERS[adSpendIndex].isEnterprise ? 'Contact Enterprise Sales' : 'Get Business Suite'}
                </button>
              </div>

              {/* 3. Enterprise Growth Partner (Full-Service End-to-End Marketing) 🚀 */}
              <div
                onMouseEnter={() => setHoveredCard('pack_growth_partner')}
                onMouseLeave={() => setHoveredCard(null)}
                style={getCardStyle('pack_growth_partner', true)}
              >
                <div>
                  <div style={{ background: 'linear-gradient(135deg, #00E676 0%, #00B0FF 100%)', color: '#000', padding: '4px 12px', borderRadius: '100px', fontSize: '10.5px', fontWeight: 900, display: 'inline-block', marginBottom: '16px', letterSpacing: '0.05em' }}>
                    🚀 FULL-SERVICE BRAND GROWTH PARTNER ⭐
                  </div>

                  <h3 style={{ fontSize: '24px', color: '#fff', margin: '0 0 6px 0', fontFamily: 'var(--font-heading)', fontWeight: 800 }}>
                    Enterprise Growth Partner
                  </h3>

                  <div style={{ fontSize: '12.5px', color: '#00E676', fontWeight: 700, marginBottom: '12px' }}>
                    End-to-End Marketing Partner for Your Brand
                  </div>

                  <div style={{ fontSize: 'clamp(25px, 4.8vw, 36px)', color: '#00E676', fontWeight: 900, fontFamily: 'var(--font-heading)', marginBottom: '4px' }}>
                    {formatPrice(54999, 699, 549999)}
                    <span style={{ fontSize: '18px', color: '#00E676', fontWeight: 700, marginLeft: '2px' }}>+</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '20px' }}>
                    <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.7)' }}>
                      Complete Marketing Agency & Team Replacement
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#00E676', fontWeight: 700 }}>
                      🔥 Dedicated Human Team + Full AI Execution
                    </div>
                  </div>

                  <div style={{ fontSize: '12px', color: '#00E676', fontWeight: 800, marginBottom: '20px', background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.3)', padding: '6px 14px', borderRadius: '8px', display: 'inline-block' }}>
                    ⚡ Unlimited AI Credits + Full Specialist Execution
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '11px', fontSize: '13px', color: '#eee' }}>
                    <li style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <Check size={16} color="#00E676" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span><strong>📱 Complete Social Media Handling:</strong> Daily content creation, scheduling, reels, posts & community management.</span>
                    </li>
                    <li style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <Check size={16} color="#00E676" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span><strong>⚡ Powered by Raftra AI Suite:</strong> Creative Studio, Campaign Manager, SEO & GEO Engine, and Social Hub.</span>
                    </li>
                    <li style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <Check size={16} color="#00E676" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span><strong>🎯 Dedicated Brand Strategist:</strong> Assigned strategist curating brand positioning, monthly roadmaps & strategy.</span>
                    </li>
                    <li style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <Check size={16} color="#00E676" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span><strong>📈 Dedicated Paid Ads Specialist:</strong> Performance expert managing Meta & Google Ads optimization for max ROAS.</span>
                    </li>
                    <li style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <Check size={16} color="#00E676" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span><strong>🤝 Influencer Hiring & Negotiation:</strong> We discover, vet, negotiate rates & hire creators end-to-end for your brand.</span>
                    </li>
                    <li style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <Check size={16} color="#00E676" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span><strong>📊 End-to-End Growth Partner:</strong> Weekly strategy calls, real-time ROI analytics & continuous growth iteration.</span>
                    </li>
                  </ul>
                </div>

                <GlowButton 
                  variant="glow" 
                  onClick={() => {
                    const el = document.getElementById('enterprise-inquiry-form');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }} 
                  style={{ marginTop: '32px', padding: '14px', fontSize: '14px', fontWeight: 800 }}
                >
                  Contact Sales & Get Enterprise Growth 🚀
                </GlowButton>
              </div>

            </div>

            {/* EMBEDDED ENTERPRISE SALES QUERY FORM SECTION */}
            <div 
              id="enterprise-inquiry-form"
              style={{
                marginTop: '48px',
                background: 'linear-gradient(180deg, rgba(15, 23, 38, 0.95) 0%, rgba(6, 10, 18, 0.98) 100%)',
                border: '1.5px solid rgba(0, 230, 118, 0.4)',
                borderRadius: '24px',
                padding: '36px 40px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 30px rgba(0, 230, 118, 0.1)',
                maxWidth: '920px',
                margin: '48px auto 0 auto'
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '5px 16px', background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: '100px', color: '#00E676', fontWeight: 800, fontSize: '12.5px', marginBottom: '12px' }}>
                  <MessageSquare size={15} /> DIRECT ENTERPRISE SALES INQUIRY FORM
                </div>
                <h3 style={{ fontSize: 'clamp(22px, 4.2vw, 30px)', color: '#fff', margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 800 }}>
                  Contact Sales — Enterprise Growth Partner (₹54,999+/mo)
                </h3>
                <p style={{ fontSize: '15px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                  Fill in your brand details below to submit your inquiry directly to <strong style={{ color: '#00E676' }}>raftra.77mail.com</strong>. A Dedicated Brand Strategist will reach out within 2 hours.
                </p>
              </div>

              {inquirySubmitted ? (
                <div style={{ background: 'rgba(0, 230, 118, 0.15)', border: '1.5px solid #00E676', borderRadius: '16px', padding: '28px', textAlign: 'center', color: '#fff' }}>
                  <div style={{ fontSize: 'clamp(25px, 4.8vw, 36px)', marginBottom: '10px' }}>🚀</div>
                  <h4 style={{ fontSize: '22px', color: '#00E676', margin: '0 0 8px 0', fontWeight: 800 }}>Inquiry Submitted to raftra.77mail.com!</h4>
                  <p style={{ fontSize: '14.5px', color: 'rgba(255,255,255,0.9)', margin: '0 0 18px 0', lineHeight: 1.6 }}>
                    Thank you! Your Enterprise Growth inquiry has been sent to <strong>raftra.77mail.com</strong>.<br/>
                    Our Dedicated Brand Strategist & Ads team will review your requirements and contact you within 24 hours.
                  </p>
                  <button onClick={() => setInquirySubmitted(false)} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '10px 24px', borderRadius: '100px', fontSize: '13.5px', cursor: 'pointer', fontWeight: 700 }}>
                    Submit Another Inquiry
                  </button>
                </div>
              ) : (
                <form onSubmit={handleInquirySubmit} className="pricing-inquiry-form" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: '20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', color: '#ccc', fontWeight: 600 }}>Your Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rahul Sharma"
                      value={inquiryForm.name}
                      onChange={e => setInquiryForm({ ...inquiryForm, name: e.target.value })}
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '12px 14px', color: '#fff', fontSize: '14px', outline: 'none' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', color: '#ccc', fontWeight: 600 }}>Brand / Company Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Zenith Apparel D2C"
                      value={inquiryForm.brandName}
                      onChange={e => setInquiryForm({ ...inquiryForm, brandName: e.target.value })}
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '12px 14px', color: '#fff', fontSize: '14px', outline: 'none' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', color: '#ccc', fontWeight: 600 }}>Work Email *</label>
                    <input
                      type="email"
                      required
                      placeholder="rahul@brand.com"
                      value={inquiryForm.email}
                      onChange={e => setInquiryForm({ ...inquiryForm, email: e.target.value })}
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '12px 14px', color: '#fff', fontSize: '14px', outline: 'none' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', color: '#ccc', fontWeight: 600 }}>Phone / WhatsApp Number *</label>
                    <input
                      type="tel"
                      required
                      placeholder="+91 98765 43210"
                      value={inquiryForm.phone}
                      onChange={e => setInquiryForm({ ...inquiryForm, phone: e.target.value })}
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '12px 14px', color: '#fff', fontSize: '14px', outline: 'none' }}
                    />
                  </div>



                  {/* Paid Ads Budget (Meta & Google Ads) in INR */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', color: '#ccc', fontWeight: 600 }}>Paid Ads Budget (Meta & Google Ads in INR) *</label>
                    <select
                      value={inquiryForm.paidAdsBudget}
                      onChange={e => setInquiryForm({ ...inquiryForm, paidAdsBudget: e.target.value })}
                      style={{ background: '#0b0b14', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '12px 14px', color: '#fff', fontSize: '14px', outline: 'none' }}
                    >
                      <option value="No Idea / Need Advice">No Idea / Need Advice</option>
                      <option value="₹10,000 – ₹25,000 / month">₹10,000 – ₹25,000 / month</option>
                      <option value="₹25,000 – ₹50,000 / month">₹25,000 – ₹50,000 / month</option>
                      <option value="₹50,000 – ₹2,00,000 / month">₹50,000 – ₹2,00,000 / month</option>
                      <option value="₹2,00,000 – ₹5,00,000 / month">₹2,00,000 – ₹5,00,000 / month</option>
                      <option value="₹5,00,000+ / month">₹5,00,000+ / month</option>
                    </select>
                  </div>

                  {/* SEO & Digital PR Budget in INR */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', color: '#ccc', fontWeight: 600 }}>SEO & Digital PR Budget (in INR) *</label>
                    <select
                      value={inquiryForm.seoPrBudget}
                      onChange={e => setInquiryForm({ ...inquiryForm, seoPrBudget: e.target.value })}
                      style={{ background: '#0b0b14', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '12px 14px', color: '#fff', fontSize: '14px', outline: 'none' }}
                    >
                      <option value="No Idea / Need Advice">No Idea / Need Advice</option>
                      <option value="₹10,000 – ₹25,000 / month">₹10,000 – ₹25,000 / month</option>
                      <option value="₹25,000 – ₹50,000 / month">₹25,000 – ₹50,000 / month</option>
                      <option value="₹50,000 – ₹1,00,000 / month">₹50,000 – ₹1,00,000 / month</option>
                      <option value="₹1,00,000+ / month">₹1,00,000+ / month</option>
                    </select>
                  </div>

                  <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', color: '#ccc', fontWeight: 600 }}>Marketing Requirements & Goals *</label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Describe your goals e.g. We need complete social media management, paid ads handling, influencer hiring, and brand strategy."
                      value={inquiryForm.notes}
                      onChange={e => setInquiryForm({ ...inquiryForm, notes: e.target.value })}
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '12px 14px', color: '#fff', fontSize: '14px', outline: 'none', resize: 'vertical' }}
                    />
                  </div>

                  <div style={{ gridColumn: 'span 2', textAlign: 'center', marginTop: '8px' }}>
                    <GlowButton variant="glow" type="submit" disabled={isSubmitting} style={{ padding: '14px 36px', fontSize: '15.5px', fontWeight: 800, width: '100%' }}>
                      {isSubmitting ? 'Sending Inquiry...' : 'Send Inquiry'}
                    </GlowButton>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                      🔒 Your inquiry will be securely routed directly to our Enterprise Strategy team.
                    </div>
                  </div>
                </form>
              )}
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
              <h2 style={{ fontSize: 'clamp(25px, 4.8vw, 36px)', color: '#fff', margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 800 }}>
                Dual-Module Starter Bundles
              </h2>
              <p style={{ fontSize: '15px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                Combine 2 core marketing modules at a heavily discounted bundle rate with full Claude Analytics sync.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: '28px', alignItems: 'stretch' }}>
              
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
                  
                  <div style={{ fontSize: 'clamp(25px, 4.8vw, 36px)', color: '#00E676', fontWeight: 800, fontFamily: 'var(--font-heading)', marginBottom: '4px' }}>
                    {AD_SPEND_TIERS[adSpendIndex].isEnterprise ? (
                      <span style={{ fontSize: '28px', color: '#FFB300' }}>Custom Enterprise</span>
                    ) : (
                      formatPrice(AD_SPEND_TIERS[adSpendIndex].creatorLaunch.inr, AD_SPEND_TIERS[adSpendIndex].creatorLaunch.usd, AD_SPEND_TIERS[adSpendIndex].creatorLaunch.annual)
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '20px' }}>
                    <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.6)' }}>
                      Individual Price: <span style={{ textDecoration: 'line-through' }}>₹2,499 + ₹{AD_SPEND_TIERS[adSpendIndex].inr.toLocaleString('en-IN')} = ₹{AD_SPEND_TIERS[adSpendIndex].creatorLaunch.indInr.toLocaleString('en-IN')}/mo</span>
                    </div>
                    {!AD_SPEND_TIERS[adSpendIndex].isEnterprise && (
                      <div style={{ fontSize: '12.5px', color: '#00E676', fontWeight: 700 }}>
                        🔥 Save ₹{AD_SPEND_TIERS[adSpendIndex].creatorLaunch.saveInr.toLocaleString('en-IN')}/month
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: '12px', color: '#7C75FF', fontWeight: 700, marginBottom: '20px', background: 'rgba(124,117,255,0.1)', padding: '6px 14px', borderRadius: '8px', display: 'inline-block' }}>
                    10,000 AI Credits / month Included
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13.5px', color: '#ddd' }}>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> <strong>Creative Studio Pro</strong></li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> <strong>Campaign Manager ({AD_SPEND_TIERS[adSpendIndex].range})</strong></li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Claude Analytics Recommendations</li>
                  </ul>
                </div>

                <GlowButton variant="glow" onClick={onComplete} style={{ marginTop: '32px', padding: '14px', fontSize: '14px' }}>
                  {AD_SPEND_TIERS[adSpendIndex].isEnterprise ? 'Contact Enterprise Sales' : 'Get Creator Launch Pack'}
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

                  <div style={{ fontSize: 'clamp(25px, 4.8vw, 36px)', color: '#fff', fontWeight: 800, fontFamily: 'var(--font-heading)', marginBottom: '4px' }}>
                    {AD_SPEND_TIERS[adSpendIndex].isEnterprise ? (
                      <span style={{ fontSize: '28px', color: '#FFB300' }}>Custom Enterprise</span>
                    ) : (
                      formatPrice(AD_SPEND_TIERS[adSpendIndex].growthPack.inr, AD_SPEND_TIERS[adSpendIndex].growthPack.usd, AD_SPEND_TIERS[adSpendIndex].growthPack.annual)
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '20px' }}>
                    <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.6)' }}>
                      Individual Price: <span style={{ textDecoration: 'line-through' }}>₹{AD_SPEND_TIERS[adSpendIndex].inr.toLocaleString('en-IN')} + ₹4,999 = ₹{AD_SPEND_TIERS[adSpendIndex].growthPack.indInr.toLocaleString('en-IN')}/mo</span>
                    </div>
                    {!AD_SPEND_TIERS[adSpendIndex].isEnterprise && (
                      <div style={{ fontSize: '12.5px', color: '#00E676', fontWeight: 700 }}>
                        🔥 Save ₹{AD_SPEND_TIERS[adSpendIndex].growthPack.saveInr.toLocaleString('en-IN')}/month
                      </div>
                    )}
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13.5px', color: '#ddd' }}>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> <strong>Campaign Manager ({AD_SPEND_TIERS[adSpendIndex].range})</strong></li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> <strong>SEO & GEO Starter</strong></li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Full Analytics & Reports</li>
                  </ul>
                </div>

                <button onClick={onComplete} style={{ marginTop: '32px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '14px', borderRadius: '100px', fontWeight: 700, cursor: 'pointer', width: '100%', fontSize: '14px' }}>
                  {AD_SPEND_TIERS[adSpendIndex].isEnterprise ? 'Contact Enterprise Sales' : 'Get Growth Pack'}
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
              <h2 style={{ fontSize: 'clamp(23px, 4.4vw, 32px)', color: '#fff', margin: '4px 0 0 0', fontFamily: 'var(--font-heading)' }}>Creative Studio (Credit Based Media Generation)</h2>
            </div>

            {/* CREATIVE STUDIO CREDIT & FEATURE EXCLUSIVITY NOTE BOX */}
            <div style={{ background: 'rgba(124, 117, 255, 0.08)', border: '1px solid rgba(124, 117, 255, 0.3)', padding: '18px 24px', borderRadius: '16px', marginBottom: '28px', fontSize: '13.5px', color: '#e0e0e0', lineHeight: 1.6 }}>
              <strong style={{ color: '#7C75FF', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', fontSize: '14.5px' }}>
                <ShieldCheck size={18} /> How AI Credits & Software Features Work:
              </strong>
              AI Credits are exclusively used for compute-intensive media generation and editing (images, videos, audio renders). All software features, automation, publishing, analytics, reporting, SEO workflows, and campaign management are included with your subscription and do not consume credits.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: '24px' }}>
              
              {/* Starter */}
              <div
                onMouseEnter={() => setHoveredCard('cs_starter')}
                onMouseLeave={() => setHoveredCard(null)}
                style={getCardStyle('cs_starter')}
              >
                <div>
                  <div style={{ fontSize: '18px', color: '#fff', fontWeight: 700, marginBottom: '6px' }}>Starter</div>
                  <div style={{ fontSize: 'clamp(23px, 4.4vw, 32px)', color: '#fff', fontWeight: 800, fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>
                    {formatPrice(1499, 19, 14999)}
                  </div>
                  <div style={{ fontSize: '13px', color: '#7C75FF', fontWeight: 700, marginBottom: '20px', background: 'rgba(124,117,255,0.1)', padding: '4px 12px', borderRadius: '6px', display: 'inline-block' }}>
                    5,000 AI Credits Included
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: '#ccc' }}>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Image Ads Generation</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Product Photography Renders</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Basic Ad Copy & Photo Editing</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Carousel Ads Framework</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Advanced AI Recommendations</li>
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
                  <div style={{ fontSize: 'clamp(23px, 4.4vw, 32px)', color: '#00E676', fontWeight: 800, fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>
                    {formatPrice(2999, 35, 29999)}
                  </div>
                  <div style={{ fontSize: '13px', color: '#00E676', fontWeight: 700, marginBottom: '20px', background: 'rgba(0,230,118,0.1)', padding: '4px 12px', borderRadius: '6px', display: 'inline-block' }}>
                    15,000 AI Credits Included
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: '#ccc' }}>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> <strong>Everything in Starter</strong></li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> 15s / 30s / 60s AI Video Ads</li>
                    <li style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <Check size={16} color="var(--success)" /> 
                        <strong style={{ color: '#FFB300' }}>🚧 AI UGC Video Reels & Avatars (Coming Soon)</strong>
                      </div>
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', paddingLeft: '24px' }}>
                        Need content immediately? Hire a verified UGC Creator from Raftra Marketplace.
                      </span>
                    </li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Advanced In-Place Ad Editing</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Advanced AI Recommendations</li>
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
                  <div style={{ fontSize: 'clamp(23px, 4.4vw, 32px)', color: '#fff', fontWeight: 800, fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>
                    {formatPrice(5499, 65, 54999)}
                  </div>
                  <div style={{ fontSize: '13px', color: '#7C75FF', fontWeight: 700, marginBottom: '20px', background: 'rgba(124,117,255,0.1)', padding: '4px 12px', borderRadius: '6px', display: 'inline-block' }}>
                    40,000 AI Credits Included
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
              <h2 style={{ fontSize: 'clamp(23px, 4.4vw, 32px)', color: '#fff', margin: '4px 0 0 0', fontFamily: 'var(--font-heading)' }}>Campaign Manager Plan</h2>
            </div>

            <div
              onMouseEnter={() => setHoveredCard('cm_pro_single')}
              onMouseLeave={() => setHoveredCard(null)}
              style={{
                ...getCardStyle('cm_pro_single', true),
                padding: '36px'
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '36px', alignItems: 'center', width: '100%' }}>
                
                {/* Left Column: Title, Ad Spend Dropdown, Price & Action CTA */}
                <div style={{ borderRight: '1px solid rgba(255, 255, 255, 0.1)', paddingRight: '28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <div style={{ background: 'linear-gradient(90deg, #7C75FF 0%, #00E676 100%)', color: '#000', padding: '4px 12px', borderRadius: '100px', fontSize: '10px', fontWeight: 800, display: 'inline-block', marginBottom: '10px', letterSpacing: '0.05em' }}>
                      RECOMMENDED CAMPAIGN SUITE ⭐
                    </div>
                    <h3 style={{ fontSize: '24px', color: '#fff', margin: '0 0 10px 0', fontFamily: 'var(--font-heading)', lineHeight: 1.2 }}>
                      Campaign Manager Pro ⭐
                    </h3>

                    {/* DYNAMIC MONTHLY AD SPEND TIER SELECTOR */}
                    <div style={{ background: 'rgba(124, 117, 255, 0.08)', border: '1px solid rgba(124, 117, 255, 0.3)', padding: '12px 14px', borderRadius: '14px', marginBottom: '16px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, color: '#7C75FF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                        <Layers size={13} /> SELECT YOUR MONTHLY AD SPEND:
                      </label>
                      <select 
                        value={adSpendIndex} 
                        onChange={(e) => setAdSpendIndex(Number(e.target.value))}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: '#0b0b14',
                          border: '1.5px solid #7C75FF',
                          borderRadius: '8px',
                          color: '#ffffff',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          outline: 'none'
                        }}
                      >
                        {AD_SPEND_TIERS.map((tier, idx) => (
                          <option key={idx} value={idx} style={{ background: '#0b0b14', color: '#fff' }}>
                            {tier.range} {tier.isEnterprise ? '(Custom Enterprise)' : `(${currency === 'USD' ? `$${tier.usd}/mo` : `₹${tier.inr.toLocaleString('en-IN')}/mo`})`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ fontSize: 'clamp(23px, 4.4vw, 32px)', color: '#00E676', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
                      {AD_SPEND_TIERS[adSpendIndex].isEnterprise ? (
                        <span style={{ fontSize: '28px', color: '#FFB300' }}>Custom Pricing</span>
                      ) : (
                        formatPrice(AD_SPEND_TIERS[adSpendIndex].inr, AD_SPEND_TIERS[adSpendIndex].usd, AD_SPEND_TIERS[adSpendIndex].inrAnnual)
                      )}
                    </div>
                  </div>

                  <GlowButton variant="glow" onClick={onComplete} style={{ width: '100%', padding: '14px 24px', fontSize: '14.5px' }}>
                    {AD_SPEND_TIERS[adSpendIndex].isEnterprise ? 'Contact Enterprise Sales' : 'Get Campaign Pro'}
                  </GlowButton>
                </div>

                {/* Right Column: 19 Features arranged in Horizontal Clean Grid Pills */}
                <div>
                  <div style={{ fontSize: '12px', color: '#7C75FF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' }}>
                    Included Features & Capabilities (Campaign Analytics Included)
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(220px, 100%), 1fr))', gap: '8px 12px', fontSize: '12px', color: '#e0e0e0' }}>
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
                      'Performance & Campaign Analytics',
                      '100 AI Campaign Recommendations / mo',
                      '50 Advanced AI Analysis Requests / mo',
                      'Unlimited AI Recommendations (Fair Usage)',
                      'Unlimited Reports (Fair Usage)',
                      'Unlimited Advanced AI Strategy (Fair Usage)',
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
              <h2 style={{ fontSize: 'clamp(23px, 4.4vw, 32px)', color: '#fff', margin: '4px 0 0 0', fontFamily: 'var(--font-heading)' }}>SEO & GEO Search Engine Optimization</h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: '24px' }}>
              
              {/* Starter */}
              <div
                onMouseEnter={() => setHoveredCard('seo_starter')}
                onMouseLeave={() => setHoveredCard(null)}
                style={getCardStyle('seo_starter')}
              >
                <div>
                  <div style={{ fontSize: '18px', color: '#fff', fontWeight: 700, marginBottom: '6px' }}>SEO Starter</div>
                  <div style={{ fontSize: 'clamp(23px, 4.4vw, 32px)', color: '#fff', fontWeight: 800, fontFamily: 'var(--font-heading)', marginBottom: '16px' }}>
                    {formatPrice(3499, 42, 34999)}
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: '#ccc' }}>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Weekly SEO Audit & Weekly GEO Audit (5 Audits)</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> 200 AI SEO Insights / month</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> 100 Advanced AI SEO Queries / month</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> 20 AI Blog Generations / month</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Integrated SEO Analytics</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Fair Usage Applies</li>
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
                  <div style={{ fontSize: 'clamp(23px, 4.4vw, 32px)', color: '#00E676', fontWeight: 800, fontFamily: 'var(--font-heading)', marginBottom: '16px' }}>
                    {formatPrice(9999, 119, 99999)}
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: '#ccc' }}>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> <strong>Everything in Starter +</strong></li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Unlimited AI Articles (Fair Usage)</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Unlimited Keyword Research (Fair Usage)</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Unlimited AI Insights (Fair Usage)</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Unlimited Advanced AI Assistant (Fair Usage)</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> WordPress / Shopify / GitHub Connect & 1-Click Publishing</li>
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
                  <div style={{ fontSize: 'clamp(23px, 4.4vw, 32px)', color: '#fff', fontWeight: 800, fontFamily: 'var(--font-heading)', marginBottom: '16px' }}>
                    {formatPrice(30999, 369, 309999)}
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: '#ccc' }}>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> <strong>Everything in Growth +</strong></li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Dedicated SEO & GEO Specialist</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Monthly SEO Strategy</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Priority Publishing Queue</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Backlink Outreach & Guest Posting</li>
                    <li style={{ display: 'flex', gap: '8px' }}><Check size={16} color="var(--success)" /> Unlimited AI (Fair Usage)</li>
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
              <h2 style={{ fontSize: 'clamp(25px, 4.8vw, 36px)', color: '#fff', margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 800 }}>
                Included Core Tools, Specialist Growth & Escrow
              </h2>
              <p style={{ fontSize: '15px', color: 'var(--text-secondary)', marginTop: '8px', maxWidth: '750px', margin: '8px auto 0 auto' }}>
                Every Raftra account gets free lifetime access to Social Hub operations, direct creator discovery with escrow funds protection, and unified analytics.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(350px, 100%), 1fr))', gap: '28px' }}>
              
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
                    Social Hub Workspace & Social Analytics
                  </h3>

                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.6 }}>
                    Complete Social Media Operations Hub. Includes Editorial Calendar, Multi-Channel Post Planner, Drag-and-Drop Publishing Schedule, Team Collaboration, Social Analytics, AI Caption Generator (Fair Usage), AI Reply Suggestions (Fair Usage), and AI Hashtag Generator (Fair Usage)—with 0 AI credits consumed.
                  </p>

                  <div style={{ background: 'rgba(124,117,255,0.1)', border: '1px solid rgba(124,117,255,0.25)', padding: '16px', borderRadius: '16px', fontSize: '13px', color: '#ddd', lineHeight: 1.6 }}>
                    <strong style={{ color: '#7C75FF', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '14px' }}>
                      <Users2 size={16} /> Raftra Specialist Operations:
                    </strong>
                    Every Raftra Specialist is trained to work directly inside Raftra. No external tools or complex workflows required. Specialists execute, optimize, and report directly from your Raftra workspace.
                  </div>
                </div>
              </div>

              {/* Influencer Marketplace Card */}
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

                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.6 }}>
                    Browse 500+ verified Indian D2C & Tech UGC creators, review past performance metrics, check video samples, and collaborate directly with zero upfront subscription fees.
                  </p>

                  <div style={{ background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.25)', padding: '16px', borderRadius: '16px', fontSize: '13px', color: '#ddd', lineHeight: 1.6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#00E676', fontWeight: 700, marginBottom: '6px', fontSize: '14px' }}>
                      <MessageSquare size={16} /> Direct Live Chat & <Lock size={16} /> Escrow Protection:
                    </div>
                    No platform fee unless a collaboration is successfully finalized. 10% platform commission only after a confirmed deal. Campaign funds are securely <strong>LOCKED IN RAFTRA ESCROW</strong> and released only upon final asset approval.
                  </div>
                </div>
              </div>

              {/* Integrated Module Analytics Card */}
              <div
                onMouseEnter={() => setHoveredCard('inc_analytics')}
                onMouseLeave={() => setHoveredCard(null)}
                style={getCardStyle('inc_analytics')}
              >
                <div>
                  <div style={{ display: 'inline-block', background: 'rgba(124,117,255,0.15)', border: '1px solid rgba(124,117,255,0.3)', color: '#7C75FF', padding: '4px 12px', borderRadius: '100px', fontSize: '11px', fontWeight: 700, marginBottom: '16px' }}>
                    INCLUDED WITH ALL MODULES
                  </div>

                  <h3 style={{ fontSize: '24px', color: '#fff', margin: '0 0 10px 0', fontFamily: 'var(--font-heading)' }}>
                    Integrated Feature Analytics
                  </h3>

                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.6 }}>
                    Analytics are directly integrated into each core module (Campaign Analytics inside Campaign Manager, SEO Analytics inside SEO, Social Analytics inside Social Hub).
                  </p>

                  <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', padding: '16px', borderRadius: '16px', fontSize: '13px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600 }}>Operational Credit Cost:</span>
                    <strong style={{ color: '#00E676' }}>0 Extra AI Credits Consumed</strong>
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
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '750px', margin: '0 auto', lineHeight: 1.5 }}>
                AI Credits are ONLY consumed when generating or editing media. Campaign management, publishing, dashboards, reports, analytics, and platform automation do not consume credits.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: '20px', marginBottom: '40px' }}>
              
              {/* Image Credits */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <h4 style={{ fontSize: '15px', color: '#7C75FF', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ImageIcon size={16} /> Image Generation
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Standard Image</span><strong>80 Credits</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Premium Image</span><strong>150 Credits</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Product Photography</span><strong>100 Credits</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Carousel Card</span><strong>60 Credits / card</strong></div>
                </div>
              </div>

              {/* Video Credits */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <h4 style={{ fontSize: '15px', color: '#00E676', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Video size={16} /> Video Generation
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>15 sec Video Ad</span><strong>450 Credits</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>30 sec Video Ad</span><strong>800 Credits</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>60 sec Video Ad</span><strong>1500 Credits</strong></div>
                </div>
              </div>

              {/* Voice & Editing Credits */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <h4 style={{ fontSize: '15px', color: 'violet', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users2 size={16} /> Voiceover & Media Editing
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>AI Voiceover</span><strong>80 Credits</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Background Removal</span><strong>20 Credits</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Image Editing</span><strong>40 Credits</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Upscale Image</span><strong>25 Credits</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Resize / Expand</span><strong>20 Credits</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>AI Product Enhancement</span><strong>50 Credits</strong></div>
                </div>
              </div>

              {/* Advanced AI Analysis */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <h4 style={{ fontSize: '15px', color: '#FFBD2E', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Cpu size={16} /> Advanced AI Analysis Engine
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Advanced AI Analysis Query</span><strong style={{ color: '#00E676' }}>0 Credits (Included)</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Advanced AI Strategy Plan</span><strong style={{ color: '#00E676' }}>0 Credits (Included)</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Ad Kill Recommendation</span><strong style={{ color: '#00E676' }}>0 Credits (Included)</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Audience Research Query</span><strong style={{ color: '#00E676' }}>0 Credits (Included)</strong></div>
                </div>
              </div>

            </div>

            {/* TOP-UP PURCHASES & EXPIRATION NOTE */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '28px', textAlign: 'center' }}>
              <h4 style={{ fontSize: '18px', color: '#fff', margin: '0 0 6px 0', fontFamily: 'var(--font-heading)' }}>
                Buy Additional Credit Top-Ups (Refill Anytime)
              </h4>
              <p style={{ fontSize: '13px', color: '#00E676', fontWeight: 600, marginBottom: '20px' }}>
                Credits never expire while your subscription remains active.
              </p>

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

        {/* FAIR USAGE POLICY FOOTER */}
        <div style={{ marginTop: '60px', paddingTop: '28px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.55)', maxWidth: '800px', margin: '0 auto', lineHeight: 1.6 }}>
            <strong style={{ color: 'rgba(255, 255, 255, 0.85)' }}>Fair Usage Policy:</strong> Unlimited AI features are subject to reasonable usage limits to ensure platform stability. Extremely high-volume automated usage may be rate limited.
          </div>
        </div>

      </div>
    </div>
  );
};
