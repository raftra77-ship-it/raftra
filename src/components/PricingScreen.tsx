import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Check, Zap, Star, Shield, Building2, Coins, Image as ImageIcon, Video, Database, Target, FileText, BarChart3, Calendar, Users2 } from 'lucide-react';
import { GlowButton } from './GlowButton';

interface PricingScreenProps {
  onComplete: () => void;
}

const PRICING_PLANS = [
  {
    name: 'FREE',
    basePrice: 0,
    description: 'Perfect for trying the platform. Learn the ropes.',
    target: 'Students & Freelancers',
    features: [
      '1 Brand Workspace',
      '50 AI Credits / month',
      '2 Knowledge Base Files',
      'Demo Analytics & Campaigns'
    ],
    buttonText: 'Start Free',
    isPopular: false,
    color: 'var(--text-secondary)'
  },
  {
    name: 'STARTER',
    basePrice: 1499,
    description: 'For solo founders & small creators.',
    target: 'Solo Founders',
    features: [
      '2 Brand Workspaces',
      '5,000 AI Credits / month',
      'Analytics & Campaign AI',
      'Basic Creative Studio'
    ],
    buttonText: 'Get Starter',
    isPopular: false,
    color: '#4facfe'
  },
  {
    name: 'GROWTH',
    basePrice: 4999,
    description: 'Most customers should buy this.',
    target: 'Startups & SMBs',
    features: [
      '10 Brand Workspaces',
      '25,000 AI Credits / month',
      'Social Hub & Auto DMs',
      'Influencer Discovery'
    ],
    buttonText: 'Get Growth',
    isPopular: true,
    color: 'var(--primary)'
  },
  {
    name: 'PRO',
    basePrice: 9999,
    description: 'For marketing agencies.',
    target: 'Agencies',
    features: [
      'Unlimited Brands',
      '75,000 AI Credits / month',
      'Auto Kill Ads Optimization',
      'AI Influencer Negotiation'
    ],
    buttonText: 'Get Pro',
    isPopular: false,
    color: '#ff0844'
  },
  {
    name: 'BUSINESS',
    basePrice: 24999,
    description: 'For scaling agencies and large brands.',
    target: 'Scaling Agencies',
    features: [
      '250,000 AI Credits / month',
      'Dedicated Fast GPU Queue',
      'Multi-Agent Workflows',
      'Priority Priority Support'
    ],
    buttonText: 'Get Business',
    isPopular: false,
    color: 'var(--warning)'
  },
  {
    name: 'ENTERPRISE',
    basePrice: -1,
    description: 'Custom infrastructure & private agents.',
    target: 'Enterprise',
    features: [
      'Unlimited Everything',
      'Dedicated Infrastructure',
      'Custom AI Models',
      'SLA & On-premise'
    ],
    buttonText: 'Contact Sales',
    isPopular: false,
    color: 'var(--success)'
  }
];

const CREDIT_COSTS = [
  { action: 'AI Chat', cost: 1, icon: <Sparkles size={16} /> },
  { action: 'Knowledge Query', cost: 2, icon: <Database size={16} /> },
  { action: 'Ad Copy', cost: 5, icon: <Sparkles size={16} /> },
  { action: 'SEO/GEO Opt.', cost: 8, icon: <Target size={16} /> },
  { action: 'Long Strategy', cost: 10, icon: <FileText size={16} /> },
  { action: 'Analytics Report', cost: 12, icon: <BarChart3 size={16} /> },
  { action: 'Campaign Plan', cost: 15, icon: <Zap size={16} /> },
  { action: 'Social Calendar', cost: 20, icon: <Calendar size={16} /> },
  { action: 'Image Generation', cost: 30, icon: <ImageIcon size={16} /> },
  { action: 'Influencer Audit', cost: 60, icon: <Users2 size={16} /> },
  { action: 'Short Video', cost: 150, icon: <Video size={16} /> },
  { action: 'Long Video', cost: 300, icon: <Video size={16} /> },
];

export const PricingScreen: React.FC<PricingScreenProps> = ({ onComplete }) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [currency, setCurrency] = useState<'INR' | 'USD'>(() => (localStorage.getItem('currency') as 'INR' | 'USD') || 'USD');

  const handleCurrencyChange = (curr: 'INR' | 'USD') => {
    setCurrency(curr);
    localStorage.setItem('currency', curr);
  };

  const getPrice = (basePriceINR: number) => {
    if (basePriceINR === 0) return currency === 'INR' ? '₹0' : '$0';
    if (basePriceINR === -1) return currency === 'INR' ? '₹75,000+' : '$999+';

    let discountedPriceINR = basePriceINR;
    if (billingCycle === 'quarterly') {
      discountedPriceINR = Math.floor(basePriceINR * 0.9);
    } else if (billingCycle === 'yearly') {
      discountedPriceINR = Math.floor(basePriceINR * 0.8);
    }

    if (currency === 'USD') {
      const priceUSD = Math.round(discountedPriceINR / 83);
      return '$' + priceUSD.toLocaleString();
    }
    return '₹' + discountedPriceINR.toLocaleString('en-IN');
  };

  const getBillingText = () => {
    if (billingCycle === 'monthly') return '/mo';
    if (billingCycle === 'quarterly') return '/mo (Billed Quarterly)';
    if (billingCycle === 'yearly') return '/mo (Billed Annually)';
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '60px 20px', overflowY: 'auto', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{ textAlign: 'center', marginBottom: '40px' }}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'rgba(90,82,255,0.1)', borderRadius: '100px', border: '1px solid rgba(90,82,255,0.2)', marginBottom: '16px', color: 'var(--primary)', fontWeight: 600, fontSize: '12px' }}>
            <Sparkles size={14} /> RAFTRA AI MARKETING OS
          </div>
          <h2 style={{ fontSize: '48px', fontFamily: 'var(--font-heading)', color: '#fff', marginBottom: '16px', letterSpacing: '-0.02em' }}>
            Sell Marketing Capacity.<br/>Not "AI Messages".
          </h2>
          <p style={{ fontSize: '18px', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
            Stop counting tokens. Focus on how many ads, videos, and campaigns you can generate. Choose the tier that matches your ambition.
          </p>
        </motion.div>

        {/* Currency Toggle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '100px', display: 'flex', alignItems: 'center', border: '1px solid var(--border)' }}>
            <button 
              onClick={() => handleCurrencyChange('USD')}
              style={{ background: currency === 'USD' ? 'var(--primary)' : 'transparent', color: currency === 'USD' ? '#fff' : 'var(--text-secondary)', border: 'none', padding: '6px 16px', borderRadius: '100px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
            >
              USD ($)
            </button>
            <button 
              onClick={() => handleCurrencyChange('INR')}
              style={{ background: currency === 'INR' ? 'var(--primary)' : 'transparent', color: currency === 'INR' ? '#fff' : 'var(--text-secondary)', border: 'none', padding: '6px 16px', borderRadius: '100px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
            >
              INR (₹)
            </button>
          </div>
        </div>

        {/* Billing Toggle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '60px' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '100px', display: 'flex', alignItems: 'center', border: '1px solid var(--border)' }}>
            <button 
              onClick={() => setBillingCycle('monthly')}
              style={{ background: billingCycle === 'monthly' ? 'var(--primary)' : 'transparent', color: billingCycle === 'monthly' ? '#fff' : 'var(--text-secondary)', border: 'none', padding: '8px 24px', borderRadius: '100px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
            >
              Monthly
            </button>
            <button 
              onClick={() => setBillingCycle('quarterly')}
              style={{ background: billingCycle === 'quarterly' ? 'var(--primary)' : 'transparent', color: billingCycle === 'quarterly' ? '#fff' : 'var(--text-secondary)', border: 'none', padding: '8px 24px', borderRadius: '100px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              Quarterly <span style={{ background: billingCycle === 'quarterly' ? 'rgba(255,255,255,0.2)' : 'rgba(90,82,255,0.2)', color: billingCycle === 'quarterly' ? '#fff' : 'var(--primary)', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>SAVE 10%</span>
            </button>
            <button 
              onClick={() => setBillingCycle('yearly')}
              style={{ background: billingCycle === 'yearly' ? 'var(--primary)' : 'transparent', color: billingCycle === 'yearly' ? '#fff' : 'var(--text-secondary)', border: 'none', padding: '8px 24px', borderRadius: '100px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              Yearly <span style={{ background: billingCycle === 'yearly' ? 'rgba(255,255,255,0.2)' : 'rgba(90,82,255,0.2)', color: billingCycle === 'yearly' ? '#fff' : 'var(--primary)', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>SAVE 20%</span>
            </button>
          </div>
        </div>

        {/* Pricing Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px', marginBottom: '80px', alignItems: 'stretch' }}>
          {PRICING_PLANS.map((plan, i) => (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              key={plan.name} 
              className="glow-card" 
              style={{ 
                padding: '32px', 
                display: 'flex', 
                flexDirection: 'column', 
                minHeight: '420px', 
                position: 'relative',
                overflow: 'visible',
                background: plan.isPopular ? 'linear-gradient(180deg, rgba(90, 82, 255, 0.08) 0%, rgba(10, 10, 12, 0.9) 100%)' : 'rgba(20,20,20,0.4)',
                border: plan.isPopular ? '1px solid var(--primary)' : '1px solid var(--border)',
                transform: plan.isPopular ? 'scale(1.02)' : 'scale(1)',
                zIndex: plan.isPopular ? 10 : 1
              }}
            >
              {plan.isPopular && (
                <div style={{ position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)', background: 'var(--primary)', color: '#fff', padding: '6px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em', boxShadow: '0 0 20px rgba(90,82,255,0.4)' }}>
                  MOST POPULAR
                </div>
              )}
              
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: plan.color, letterSpacing: '0.1em', marginBottom: '12px' }}>{plan.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '42px', fontWeight: 800, color: '#fff', fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>
                    {getPrice(plan.basePrice)}
                  </span>
                  {plan.basePrice > 0 && <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{getBillingText()}</span>}
                </div>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>{plan.description}</p>
                <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users2 size={14} /> <i>Target: {plan.target}</i>
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {plan.features.map(f => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', fontSize: '14px', color: '#e0e0e0', lineHeight: 1.4 }}>
                      <Check size={18} style={{ color: plan.color, flexShrink: 0, marginTop: '2px' }} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div style={{ marginTop: '32px' }}>
                <GlowButton variant={plan.isPopular ? 'glow' : 'secondary'} onClick={onComplete} style={{ width: '100%', padding: '16px', fontSize: '15px', fontWeight: 600 }}>
                  {plan.buttonText}
                </GlowButton>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Credit System Section */}
        <div className="glow-card" style={{ padding: '40px', background: 'rgba(10,10,12,0.8)', marginBottom: '60px' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h3 style={{ fontSize: '32px', fontFamily: 'var(--font-heading)', color: '#fff', marginBottom: '12px' }}>
              The Universal AI Credit System
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '16px', maxWidth: '600px', margin: '0 auto' }}>
              Instead of limiting arbitrary "messages", everything consumes transparent credits. Only pay for what you actually use.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
            {CREDIT_COSTS.map(cost => (
              <div key={cost.action} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fff', fontSize: '14px' }}>
                  <div style={{ color: 'var(--primary)' }}>{cost.icon}</div>
                  {cost.action}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 700, color: 'var(--accent)' }}>
                  <Coins size={14} /> {cost.cost}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '40px', paddingTop: '40px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', gap: '40px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Need more capacity? Refill anytime:</div>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <span style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: '20px', fontSize: '13px', color: '#fff' }}>5k Credits = ₹499</span>
                <span style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: '20px', fontSize: '13px', color: '#fff' }}>20k Credits = ₹1,499</span>
                <span style={{ padding: '8px 16px', background: 'rgba(90,82,255,0.1)', border: '1px solid rgba(90,82,255,0.3)', borderRadius: '20px', fontSize: '13px', color: 'var(--primary)', fontWeight: 600 }}>100k Credits = ₹5,499 (Best Value)</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
