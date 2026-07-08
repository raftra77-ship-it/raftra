import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Users2, BarChart3, Target, Share2, Megaphone, Check } from 'lucide-react';
import { GlowButton } from './GlowButton';

interface PricingScreenProps {
  onComplete: () => void;
}

export const PricingScreen: React.FC<PricingScreenProps> = ({ onComplete }) => {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '60px 20px', overflowY: 'auto' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h2 style={{ fontSize: '36px', fontFamily: 'var(--font-heading)', color: '#fff', marginBottom: '16px' }}>
            Select Your Plan
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--text-secondary)', marginBottom: '48px', maxWidth: '600px', margin: '0 auto 48px' }}>
            Choose the perfect plan for your marketing needs. Start with our Free Tier or unlock specialist AI capabilities.
          </p>
        </motion.div>

        {/* Pricing Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '60px' }}>
          
          {/* Free Tier */}
          <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', padding: '24px', textAlign: 'left', minHeight: '340px', background: 'linear-gradient(135deg, rgba(90, 82, 255, 0.05) 0%, rgba(10, 10, 12, 0.8) 100%)', borderColor: 'var(--primary)' }}>
            <div>
              <span className="hero-pill-badge" style={{ background: 'var(--primary)', color: '#fff', marginBottom: '12px', display: 'inline-block', fontSize: '10px' }}>STARTER</span>
              <h4 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
                Free Tier
              </h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                Basic access to the dashboard and limited knowledge engine runs. Perfect to explore the platform.
              </p>
              <div style={{ fontSize: '32px', fontWeight: 700, color: '#fff', marginBottom: '24px' }}>
                $0<span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>/mo</span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <li style={{ display: 'flex', gap: '8px' }}><Check size={14} color="var(--primary)" /> 1 Brand Profile</li>
                <li style={{ display: 'flex', gap: '8px' }}><Check size={14} color="var(--primary)" /> Basic Analytics</li>
                <li style={{ display: 'flex', gap: '8px' }}><Check size={14} color="var(--primary)" /> 5 AI Generations/mo</li>
              </ul>
            </div>
            <div style={{ marginTop: 'auto' }}>
              <GlowButton variant="glow" onClick={onComplete} style={{ width: '100%', padding: '12px' }}>
                Activate Free Tier
              </GlowButton>
            </div>
          </div>

          {/* AI Creative Studio */}
          <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', padding: '24px', textAlign: 'left', minHeight: '340px' }}>
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
              <GlowButton variant="secondary" onClick={onComplete} style={{ width: '100%', padding: '10px' }}>
                Enable Studio Node
              </GlowButton>
            </div>
          </div>
        </div>

        {/* Bundle plan */}
        <div className="glow-card" style={{ maxWidth: '800px', margin: '0 auto 40px', background: 'linear-gradient(135deg, rgba(90, 82, 255, 0.1) 0%, rgba(10, 10, 12, 0.8) 100%)', borderColor: 'var(--accent)', padding: '40px', display: 'flex', flexWrap: 'wrap', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center', gap: '24px' }}>
          <div style={{ textAlign: 'left' }}>
            <span className="hero-pill-badge" style={{ background: 'var(--success-glow)', color: 'var(--success)', marginBottom: '8px', display: 'inline-block' }}>RECOMMENDED VALUE</span>
            <h3 style={{ fontSize: '22px', color: '#fff', marginBottom: '6px' }}>Complete Raftra Growth OS Bundle</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Get full access to all specialist workspaces + core multi-agent state network.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ fontSize: '36px', fontWeight: 800, color: '#fff' }}>
              $449<span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>/mo</span>
            </div>
            <GlowButton variant="glow" onClick={onComplete}>
              Activate Full OS
            </GlowButton>
          </div>
        </div>
        
        <button onClick={onComplete} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline' }}>
          Skip for now, proceed to setup
        </button>

      </div>
    </div>
  );
};
