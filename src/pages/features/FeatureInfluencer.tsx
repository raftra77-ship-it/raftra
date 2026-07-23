import React from 'react';
import { motion } from 'framer-motion';
import { Users2, Bot, CheckCircle2, ShieldCheck, UserCheck, Star, Activity, MapPin } from 'lucide-react';
import { GlowButton } from '../../components/GlowButton';
import { FeatureExplainerVideo } from '../../components/FeatureExplainerVideo';

export const FeatureInfluencer = () => {
  const influencerExplainerSteps = [
    {
      title: "1. AI Creator Discovery & Fake Follower Audit",
      agent: "Creator Discovery Agent",
      description: "Crawls Instagram, YouTube & Facebook to index creators by niche, engagement authenticity, and fake follower ratios.",
      badge: "VERIFIED CREATORS",
      visualType: "influencer_escrow" as const,
      metrics: [
        { label: "Authenticity", value: "98%", color: "#00E676" },
        { label: "Fake Follower Check", value: "Passed", color: "#5A52FF" }
      ]
    },
    {
      title: "2. Brand Fit Scoring & Easy Hiring",
      agent: "Pricing Intelligence Agent",
      description: "Calculates an instant Brand Fit Score and calculates fair market rate recommendations for easy creator hiring.",
      badge: "SCORED MATCH",
      visualType: "influencer_escrow" as const,
      metrics: [
        { label: "Brand Fit Score", value: "96 / 100", color: "#00E676" },
        { label: "Base Rate", value: "₹15,000 / Reel", color: "#FFBD2E" }
      ]
    },
    {
      title: "3. Easy Direct Escrow Deal Lock & Content Delivery",
      agent: "Campaign Collaboration Agent",
      description: "Locks deal contracts securely in escrow with automated platform commission processing and direct video deliverable review.",
      badge: "DEAL LOCKED",
      visualType: "influencer_escrow" as const,
      metrics: [
        { label: "Escrow Status", value: "Secured", color: "#00E676" },
        { label: "Platform Fee", value: "10%", color: "#5A52FF" }
      ]
    }
  ];
  return (
    <div style={{ animation: 'fadeIn 0.5s ease' }}>
      
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '64px' }}>
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'rgba(0,210,255,0.1)', borderRadius: '100px', border: '1px solid rgba(0,210,255,0.2)', marginBottom: '24px' }}>
          <Users2 size={16} color="#00d2ff" />
          <span style={{ fontSize: '14px', fontWeight: '600', color: '#00d2ff', letterSpacing: '0.05em', textTransform: 'uppercase' }}>AI Matching</span>
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{ fontSize: '48px', fontFamily: 'var(--font-heading)', margin: '0 0 24px 0', background: 'linear-gradient(to right, #fff, rgba(255,255,255,0.7))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.1 }}>
          Influencer Marketplace
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ color: 'var(--text-secondary)', fontSize: '20px', maxWidth: '800px', margin: '0 auto', lineHeight: 1.6 }}>
          Helps brands discover and collaborate with influencers based on audience quality, niche, budget, and conversion potential.
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
            {["Creator Discovery Agent", "Audience Verification Agent", "Fake Follower Detection Agent", "Brand Match Agent", "Pricing Intelligence Agent", "Campaign Collaboration Agent"].map((agent, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px' }}><CheckCircle2 size={16} color="var(--primary)" /> {agent}</li>
            ))}
          </ul>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glow-card" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: '#00d2ff' }}>How it works</h3>
            <span style={{ background: 'rgba(0,210,255,0.2)', color: '#00d2ff', padding: '4px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: 'bold' }}>SCORED MATCHING</span>
          </div>
          <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', color: '#ccc' }}>
            {["Search creators by niche and platform", "Analyze audience authenticity", "Calculate engagement quality", "Generate Brand Fit Score", "Predict campaign success potential", "Manage collaboration from one workspace"].map((step, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', fontSize: '14px' }}>
                <span style={{ background: 'rgba(255,255,255,0.1)', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontSize: '10px', flexShrink: 0, marginTop: '2px' }}>{i + 1}</span> 
                {step}
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glow-card" style={{ padding: '32px', background: 'rgba(0,210,255,0.05)' }}>
          <h3 style={{ fontSize: '20px', marginBottom: '16px', color: '#fff' }}>How it improves results</h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px', fontSize: '15px' }}>
            Reduces time spent searching for creators and increases the chances of choosing influencers whose audience actually matches your ideal customers.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {["Better creator fit", "Less manual research", "Higher campaign potential"].map((tag, i) => (
              <span key={i} style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '100px', fontSize: '13px', color: '#fff' }}>{tag}</span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Motion Design Explainer Video */}
      <FeatureExplainerVideo
        title="Influencer Marketplace & AI Matching"
        subtitle="How Raftra AI discovers creators, verifies real audiences, and locks escrow deals."
        badgeText="CREATOR MOTION DEMO"
        steps={influencerExplainerSteps}
        ctaText="Unlock Influencer Marketplace"
      />

      {/* Interactive Visual Demo */}
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} style={{ background: '#0a0a0a', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>Match Preview <span style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 'normal' }}>| AI finds the best creators</span></h3>
          </div>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#888' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00d2ff', boxShadow: '0 0 10px #00d2ff' }}></span> Verified audience
          </span>
        </div>
        
        <div style={{ padding: '40px', background: 'radial-gradient(circle at top right, rgba(0,210,255,0.1) 0%, transparent 50%)' }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '32px', position: 'relative', overflow: 'hidden' }}>
            
            <div style={{ position: 'absolute', top: '0', right: '0', background: 'rgba(0,210,255,0.1)', color: '#00d2ff', padding: '8px 16px', borderBottomLeftRadius: '16px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Star size={14} /> BEST MATCH
            </div>

            <div style={{ display: 'flex', gap: '24px', alignItems: 'center', marginBottom: '32px' }}>
              <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: '#222', backgroundImage: 'url(https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80)', backgroundSize: 'cover', backgroundPosition: 'center', border: '2px solid rgba(255,255,255,0.1)' }}></div>
              <div>
                <h2 style={{ margin: '0 0 8px 0', fontSize: '28px', color: '#fff' }}>Sarah Jain</h2>
                <div style={{ display: 'flex', gap: '12px', color: '#888', fontSize: '14px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Star size={14} /> Lifestyle</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Activity size={14} /> Instagram</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={14} /> Delhi</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
              <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#10b981' }}>92%</div>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#fff' }}>Brand Fit</div>
                  <div style={{ fontSize: '12px', color: '#888' }}>Style & tone match</div>
                </div>
              </div>
              <div style={{ background: 'rgba(90,82,255,0.1)', border: '1px solid rgba(90,82,255,0.2)', padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--primary)' }}>88%</div>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#fff' }}>Audience Match</div>
                  <div style={{ fontSize: '12px', color: '#888' }}>Target demographic</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff' }}>128K</div>
                <div style={{ fontSize: '12px', color: '#888' }}>Followers</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff' }}>6.8%</div>
                <div style={{ fontSize: '12px', color: '#888' }}>Engagement</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff' }}>₹18K</div>
                <div style={{ fontSize: '12px', color: '#888' }}>Est. Cost</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff' }}>High</div>
                <div style={{ fontSize: '12px', color: '#888' }}>Sales Potential</div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '24px', marginBottom: '32px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: '#ccc', display: 'flex', alignItems: 'center', gap: '8px' }}><ShieldCheck size={16} color="var(--success)" /> Audience authenticity verified</span>
                  <span style={{ fontWeight: 'bold' }}>97%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: '#ccc', display: 'flex', alignItems: 'center', gap: '8px' }}><UserCheck size={16} color="var(--primary)" /> Female audience (18–34)</span>
                  <span style={{ fontWeight: 'bold' }}>72%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: '#ccc', display: 'flex', alignItems: 'center', gap: '8px' }}><Activity size={16} color="#00d2ff" /> Previous beauty & fashion campaigns</span>
                  <span style={{ fontWeight: 'bold' }}>14</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
              <button className="btn btn-secondary" style={{ padding: '12px 24px', fontSize: '14px' }}>View Profile</button>
              <GlowButton variant="glow" onClick={() => {}}>
                Start Collaboration
              </GlowButton>
            </div>

          </div>
        </div>
      </motion.div>

    </div>
  );
};
