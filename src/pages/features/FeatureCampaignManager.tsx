import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Megaphone, Bot, CheckCircle2, Globe, MousePointerClick, RefreshCcw, Check, Users2 } from 'lucide-react';
import { GlowButton } from '../../components/GlowButton';
import { FeatureExplainerVideo } from '../../components/FeatureExplainerVideo';

export const FeatureCampaignManager = () => {
  const [publishState, setPublishState] = useState(0); // 0: review, 1: publishing, 2: published

  const handlePublish = () => {
    setPublishState(1);
    setTimeout(() => setPublishState(2), 2000);
  };

  const campaignExplainerSteps = [
    {
      title: "1. AI Campaign Brief & Audience Blueprint",
      agent: "Campaign Planning Agent",
      description: "Analyzes seasonal trends and target demographics to structure optimal ROAS objectives, budget allocation, and placement rules.",
      badge: "STRATEGY BUILT",
      visualType: "oauth_campaign" as const,
      metrics: [
        { label: "Target ROAS", value: "4.5x", color: "#00E676" },
        { label: "Budget Split", value: "₹40,000 / day", color: "#fff" },
        { label: "Placements", value: "Meta & Google", color: "#5A52FF" }
      ]
    },
    {
      title: "2. Easy 1-Click OAuth Publisher Gateway Deploy",
      agent: "Placement Strategy Agent",
      description: "Pushes verified ad packages directly to Meta Ads Sandbox, Google Ads, and YouTube Ads with human review control and 1-click connect.",
      badge: "DEPLOYED LIVE",
      visualType: "oauth_campaign" as const,
      metrics: [
        { label: "Channels Synced", value: "3 Active", color: "#00E676" },
        { label: "Deploy Time", value: "1.2s", color: "#5A52FF" },
        { label: "UTM Tracking", value: "Verified", color: "#FFBD2E" }
      ]
    },
    {
      title: "3. Auto-Kill & Smart Rotation Triggers",
      agent: "Creative Fatigue Agent",
      description: "Monitors real-time performance. Automatically kills ads exceeding Frequency Cap (5x) or CPA Threshold (₹2,000) and rotates fresh creatives.",
      badge: "AUTO-OPTIMIZING",
      visualType: "oauth_campaign" as const,
      metrics: [
        { label: "Fatigued Ads Killed", value: "2 Ads", color: "#FF5F56" },
        { label: "CPA Saved", value: "₹1,500", color: "#00E676" },
        { label: "Auto-Rotation", value: "Enabled", color: "#5A52FF" }
      ]
    }
  ];

  return (
    <div style={{ animation: 'fadeIn 0.5s ease' }}>
      
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '64px' }}>
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'rgba(90,82,255,0.1)', borderRadius: '100px', border: '1px solid rgba(90,82,255,0.2)', marginBottom: '24px' }}>
          <Megaphone size={16} color="var(--accent)" />
          <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--accent)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Multi-Platform</span>
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{ fontSize: '48px', fontFamily: 'var(--font-heading)', margin: '0 0 24px 0', background: 'linear-gradient(to right, #fff, rgba(255,255,255,0.7))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.1 }}>
          AI Campaign Manager
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ color: 'var(--text-secondary)', fontSize: '20px', maxWidth: '800px', margin: '0 auto', lineHeight: 1.6 }}>
          Builds, publishes, and optimizes campaigns across Meta Ads, Google Ads, and YouTube.
        </motion.p>
      </div>

      {/* Info Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px', marginBottom: '64px' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glow-card" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: 'var(--primary)' }}><Bot size={20} /> AI Agents Used</h3>
            <span style={{ background: 'rgba(90,82,255,0.2)', color: 'var(--primary)', padding: '4px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: 'bold' }}>6 AGENTS</span>
          </div>
          <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', color: '#ccc' }}>
            {["Campaign Planning Agent", "Audience Research Agent", "Budget Optimization Agent", "Placement Strategy Agent", "Performance Monitoring Agent", "Creative Fatigue Agent"].map((agent, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px' }}><CheckCircle2 size={16} color="var(--primary)" /> {agent}</li>
            ))}
          </ul>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glow-card" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: 'var(--accent)' }}>How it works</h3>
            <span style={{ background: 'rgba(255,82,150,0.2)', color: 'var(--accent)', padding: '4px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: 'bold' }}>AI + HUMAN</span>
          </div>
          <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', color: '#ccc' }}>
            {["Connect ad accounts through OAuth", "Select a product or objective", "AI creates campaign structure", "Choose budget and audience", "Review AI recommendations", "Publish with one click", "AI continuously monitors performance"].map((step, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', fontSize: '14px' }}>
                <span style={{ background: 'rgba(255,255,255,0.1)', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontSize: '10px', flexShrink: 0, marginTop: '2px' }}>{i + 1}</span> 
                {step}
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glow-card" style={{ padding: '32px', background: 'rgba(255,82,150,0.05)' }}>
          <h3 style={{ fontSize: '20px', marginBottom: '16px', color: '#fff' }}>How it improves results</h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px', fontSize: '15px' }}>
            Detects high frequency, falling CTR, and creative fatigue, then recommends budget shifts, audience expansion, or creative replacement before performance drops.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {["Lower wasted spend", "Better ROAS", "Faster optimization"].map((tag, i) => (
              <span key={i} style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '100px', fontSize: '13px', color: '#fff' }}>{tag}</span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Motion Design Explainer Video */}
      <FeatureExplainerVideo
        title="Multi-Platform Campaign Manager"
        subtitle="How Raftra AI builds, deploys, and auto-rotates campaigns across Meta Ads, Google Ads & YouTube Ads."
        badgeText="CAMPAIGN MOTION DEMO"
        steps={campaignExplainerSteps}
        ctaText="Unlock Campaign Manager"
      />

      {/* Interactive Visual Demo */}
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} style={{ background: '#0a0a0a', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
        <div style={{ padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>Interactive Flow <span style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 'normal' }}>| AI builds your campaign</span></h3>
          </div>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#888' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 10px var(--accent)' }}></span> One-click publish
          </span>
        </div>
        
        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
          {/* Left Panel: Status */}
          <div style={{ flex: '1', minWidth: '250px', padding: '32px', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
            <h4 style={{ margin: '0 0 24px 0', fontSize: '14px', textTransform: 'uppercase', color: '#666', letterSpacing: '1px' }}>System Status</h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '40px', height: '40px', background: 'rgba(24,119,242,0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Globe size={20} color="#1877f2" />
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold' }}>Meta Connected</div>
                  <div style={{ fontSize: '12px', color: 'var(--success)' }}>Ad account verified</div>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '40px', height: '40px', background: 'rgba(16,185,129,0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MousePointerClick size={20} color="#10b981" />
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold' }}>Pixel Found</div>
                  <div style={{ fontSize: '12px', color: 'var(--success)' }}>Tracking active</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '40px', height: '40px', background: 'rgba(255,174,0,0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users2 size={20} color="#ffae00" />
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold' }}>Audience Ready</div>
                  <div style={{ fontSize: '12px', color: '#ccc' }}>2.3M people</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel: AI Recommendation */}
          <div style={{ flex: '2', minWidth: '400px', padding: '32px', background: '#000', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '20px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bot size={24} color="var(--accent)" /> AI Recommendation
                </h4>
                <div style={{ display: 'inline-block', background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                  92% CONFIDENCE
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '100px', fontSize: '12px' }}>
                <RefreshCcw size={14} className="spin" style={{ animationDuration: '3s' }} /> AI Optimization Active
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px', textTransform: 'uppercase' }}>Objective</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>Purchase</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px', textTransform: 'uppercase' }}>Daily Budget</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>₹5,000</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px', textTransform: 'uppercase' }}>Expected ROAS</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--success)' }}>3.8x</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px', textTransform: 'uppercase' }}>Best Placement</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>Reels</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px', textTransform: 'uppercase' }}>Geo Target</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>Delhi NCR</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px', textTransform: 'uppercase' }}>Schedule</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>6 PM – 11 PM</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" style={{ padding: '12px 24px', fontSize: '14px' }}>Review Changes</button>
              
              {publishState === 0 && (
                <GlowButton variant="glow" onClick={handlePublish}>
                  Publish Campaign
                </GlowButton>
              )}
              {publishState === 1 && (
                <button className="btn btn-primary" disabled style={{ padding: '12px 24px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <RefreshCcw size={16} className="spin" /> Publishing...
                </button>
              )}
              {publishState === 2 && (
                <button className="btn" disabled style={{ padding: '12px 24px', fontSize: '14px', background: 'var(--success)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={16} /> Live
                </button>
              )}
            </div>

            {publishState === 2 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ position: 'absolute', bottom: '32px', left: '32px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', padding: '12px 16px', borderRadius: '8px', color: '#10b981', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} /> Auto-detects fatigue and reallocates budget automatically
              </motion.div>
            )}

          </div>
        </div>
      </motion.div>

    </div>
  );
};
