import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Users2, Bot, CheckCircle2, ShieldCheck, UserCheck, ArrowRight, DollarSign, MessageSquare, Zap, FileText, Check, Award
} from 'lucide-react';
import { GlowButton } from '../../components/GlowButton';
import { useNavigate } from 'react-router-dom';

export const FeatureInfluencer = () => {
  const navigate = useNavigate();
  const [inviteSent, setInviteSent] = useState(false);

  const whatYouCanDo = [
    {
      title: "Discover Verified Creators",
      desc: "Search creators across multiple niches and platforms using advanced filters like location, reach, and budget.",
      icon: <Users2 size={28} color="#00D2FF" />
    },
    {
      title: "Verify Audience Quality",
      desc: "Analyze audience authenticity, engagement quality, demographics, and fake follower percentage before hiring.",
      icon: <ShieldCheck size={28} color="#00E676" />
    },
    {
      title: "Find Your Best Match",
      desc: "AI compares creators with your brand, target audience, campaign goals, and previous collaborations to generate a Brand Fit Score.",
      icon: <Bot size={28} color="#FFB300" />
    },
    {
      title: "Collaborate Easily",
      desc: "Negotiate pricing, discuss deliverables, and finalize campaigns through Raftra's secure collaboration workspace.",
      icon: <MessageSquare size={28} color="#7C75FF" />
    },
    {
      title: "Track Deliverables",
      desc: "Manage campaign progress, review submitted content, and approve completed deliverables before releasing funds.",
      icon: <FileText size={28} color="#FF5296" />
    },
    {
      title: "Secure Payments",
      desc: "Creators submit payout requests after campaign completion, while brands verify delivery before manual team approval.",
      icon: <DollarSign size={28} color="#A855F7" />
    }
  ];

  const featuresIncluded = [
    "Verified Creator Profiles", "AI Creator Discovery", "Smart Search & Filters", "Audience Authenticity Analysis",
    "Fake Follower Detection", "Engagement Quality Analysis", "Brand Match Score", "Campaign Fit Prediction",
    "Collaboration Workspace", "Secure Chat", "Deliverable Tracking", "Brand Approval Workflow",
    "Campaign Timeline", "Contract Management", "Payout Requests", "Portfolio & Previous Campaigns",
    "Creator Performance History", "Saved Creator Lists", "Team Collaboration"
  ];

  const howItWorksFlow = [
    { step: "01", title: "Search Creators", desc: "Filter by Platform, Niche, Location, Followers & Budget." },
    { step: "02", title: "AI Audit & Verification", desc: "Checks Audience Authenticity, Engagement Quality & Fake Followers." },
    { step: "03", title: "Brand Fit Score", desc: "AI calculates match score based on campaign goals & demographics." },
    { step: "04", title: "Start Collaboration", desc: "Negotiate requirements, timelines, pricing & deliverables in chat." },
    { step: "05", title: "Submit Deliverables", desc: "Creator uploads UGC Videos, Reels, Stories & Photos." },
    { step: "06", title: "Review & Payout", desc: "Brand approves work and creator requests secure payout." }
  ];

  return (
    <div style={{ animation: 'fadeIn 0.5s ease', color: '#fff' }}>
      
      {/* HERO SECTION */}
      <div style={{ textAlign: 'center', marginBottom: '64px' }}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }} 
          animate={{ opacity: 1, scale: 1 }} 
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 24px', background: 'rgba(0,210,255,0.12)', borderRadius: '100px', border: '1px solid rgba(0,210,255,0.3)', marginBottom: '24px' }}
        >
          <Users2 size={18} color="#00D2FF" />
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#00D2FF', letterSpacing: '0.06em', textTransform: 'uppercase' }}>INFLUENCER MARKETPLACE</span>
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} 
          style={{ fontSize: '60px', fontFamily: 'var(--font-heading)', margin: '0 0 24px 0', background: 'linear-gradient(to right, #fff, rgba(255,255,255,0.8))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.15, fontWeight: 800 }}
        >
          Discover, Hire & Manage Verified Creators — All in One Workspace
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} 
          style={{ color: 'var(--text-secondary)', fontSize: '22px', maxWidth: '1050px', margin: '0 auto 40px auto', lineHeight: 1.6 }}
        >
          Find the right influencers, verify audience authenticity, negotiate deals, track deliverables, and manage collaborations from discovery to payout without leaving Raftra.
        </motion.p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <GlowButton variant="glow" onClick={() => navigate('/dashboard')} style={{ fontSize: '17px', padding: '16px 36px' }}>
            Find Your Next Creator <ArrowRight size={18} />
          </GlowButton>
        </div>
      </div>

      {/* STREAMLINED WORKSPACE OVERVIEW */}
      <section style={{ marginBottom: '80px' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(0, 210, 255, 0.08) 0%, rgba(10, 10, 16, 0.98) 100%)',
          border: '1px solid rgba(0, 210, 255, 0.3)',
          borderRadius: '24px',
          padding: '44px 56px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
        }}>
          <h2 style={{ fontSize: '32px', fontFamily: 'var(--font-heading)', margin: '0 0 20px 0', color: '#fff', fontWeight: 800 }}>
            Intelligent Creator Matching & Escrow Collaboration
          </h2>
          <p style={{ fontSize: '18.5px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, margin: '0 0 24px 0' }}>
            Influencer Marketplace connects brands with verified creators through intelligent matching, audience verification, and collaboration management. Instead of manually searching Instagram, YouTube, spreadsheets, and DMs, Raftra helps brands discover creators based on niche, audience quality, engagement, location, pricing, and campaign goals.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '17px', color: '#00E676', fontWeight: 600 }}>
            <CheckCircle2 size={22} color="#00E676" style={{ flexShrink: 0 }} /> 
            <span>From the first search to final payout, every collaboration is managed inside a single workspace.</span>
          </div>
        </div>
      </section>

      {/* WHAT YOU CAN DO (6 CARDS GRID) */}
      <section style={{ marginBottom: '80px' }}>
        <div style={{ textAlign: 'center', marginBottom: '44px' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#00D2FF', letterSpacing: '0.12em', textTransform: 'uppercase' }}>CORE FEATURES</span>
          <h2 style={{ fontSize: '42px', fontFamily: 'var(--font-heading)', marginTop: '8px', fontWeight: 800 }}>What You Can Do</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: '28px' }}>
          {whatYouCanDo.map((item, idx) => (
            <div 
              key={idx}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '20px',
                padding: '36px',
                display: 'flex',
                gap: '20px',
                alignItems: 'flex-start'
              }}
            >
              <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {item.icon}
              </div>
              <div>
                <h3 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '10px', color: '#fff' }}>{item.title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '16.5px', lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS: CONNECTED ARROW STEPPER */}
      <section style={{ marginBottom: '80px' }}>
        <div style={{ textAlign: 'center', marginBottom: '44px' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#00D2FF', letterSpacing: '0.12em', textTransform: 'uppercase' }}>WORKFLOW FLOW</span>
          <h2 style={{ fontSize: '42px', fontFamily: 'var(--font-heading)', marginTop: '8px', fontWeight: 800 }}>How It Works</h2>
        </div>

        <div style={{
          background: 'rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '24px',
          padding: '48px 40px'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: '28px', position: 'relative' }}>
            {howItWorksFlow.map((s, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '14px', fontWeight: 900, color: '#00D2FF', background: 'rgba(0,210,255,0.15)', padding: '6px 14px', borderRadius: '100px', letterSpacing: '0.08em' }}>
                    STEP {s.step}
                  </span>
                  {idx !== howItWorksFlow.length - 1 && (
                    <ArrowRight size={20} color="rgba(255,255,255,0.3)" style={{ display: 'block' }} />
                  )}
                </div>
                <h3 style={{ fontSize: '21px', fontWeight: 700, color: '#fff', margin: 0 }}>{s.title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '15.5px', lineHeight: 1.55, margin: 0 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY BRANDS CHOOSE vs WHY CREATORS JOIN */}
      <section style={{ marginBottom: '80px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(360px, 100%), 1fr))', gap: '32px' }}>
        {/* For Brands */}
        <div style={{ padding: '40px', background: 'rgba(0,210,255,0.04)', border: '1px solid rgba(0,210,255,0.25)', borderRadius: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
            <Award size={28} color="#00D2FF" />
            <h3 style={{ fontSize: '26px', fontWeight: 800, margin: 0 }}>Why Brands Choose Raftra</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '17px', lineHeight: 1.6, marginBottom: '24px' }}>
            Hire creator talent based on authentic audience data rather than vanity follower metrics.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
            {[
              "Find the right creators 5x faster with AI search",
              "Detect and avoid fake followers and bot metrics",
              "Hire based on audience quality & engagement",
              "Manage DMs, briefs & deliverables in 1 workspace",
              "Maintain full campaign history & contract records",
              "Simplify creator payouts with manual verification"
            ].map((brandOpt, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '16px', color: '#fff' }}>
                <Check size={18} color="#00D2FF" style={{ flexShrink: 0 }} /> {brandOpt}
              </div>
            ))}
          </div>
        </div>

        {/* For Creators */}
        <div style={{ padding: '40px', background: 'rgba(0,230,118,0.04)', border: '1px solid rgba(0,230,118,0.25)', borderRadius: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
            <UserCheck size={28} color="#00E676" />
            <h3 style={{ fontSize: '26px', fontWeight: 800, margin: 0 }}>Why Creators Join Raftra</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '17px', lineHeight: 1.6, marginBottom: '24px' }}>
            Get discovered by top brands looking for verified creators with active campaigns.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
            {[
              "Get discovered by brands actively hiring creators",
              "Receive verified high-paying campaign requests",
              "Showcase authenticated portfolio & metrics",
              "Manage brand campaigns from one creator portal",
              "Submit payouts securely after work approval",
              "Free for the first 100 verified creators"
            ].map((creatorOpt, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '16px', color: '#fff' }}>
                <Check size={18} color="#00E676" style={{ flexShrink: 0 }} /> {creatorOpt}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES INCLUDED LIST (STREAMLINED 2-COLUMN LIST) */}
      <section style={{ marginBottom: '80px', background: 'rgba(255,255,255,0.02)', borderRadius: '24px', padding: '48px 56px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ marginBottom: '32px' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#00D2FF', letterSpacing: '0.12em', textTransform: 'uppercase' }}>FULL INVENTORY</span>
          <h2 style={{ fontSize: '38px', fontFamily: 'var(--font-heading)', marginTop: '8px', fontWeight: 800 }}>Features Included</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '18px' }}>
          {featuresIncluded.map((feat, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <CheckCircle2 size={20} color="#00E676" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '17px', fontWeight: 600, color: '#f0f0ff' }}>{feat}</span>
            </div>
          ))}
        </div>
      </section>

      {/* REAL DASHBOARD INFLUENCER MARKETPLACE INTERACTIVE PREVIEW */}
      <section style={{ marginBottom: '80px', marginTop: '40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#00D2FF', letterSpacing: '0.12em', textTransform: 'uppercase' }}>INTERACTIVE DASHBOARD PREVIEW</span>
          <h2 style={{ fontSize: '38px', fontFamily: 'var(--font-heading)', marginTop: '8px', fontWeight: 800 }}>Explore Creator Matching Engine</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '17px' }}>Live creator search, brand fit score & collaboration workspace UI.</p>
        </div>

        <div style={{ background: '#0a0a0d', borderRadius: '24px', border: '1px solid rgba(0,210,255,0.3)', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>
          
          {/* Top Dashboard Header Bar */}
          <div style={{ padding: '20px 32px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Users2 size={20} color="#00D2FF" />
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#fff' }}>Creator Discovery Portal</span>
              </div>
              <span style={{ fontSize: '12px', background: 'rgba(0,230,118,0.12)', color: '#00E676', border: '1px solid rgba(0,230,118,0.3)', padding: '4px 12px', borderRadius: '100px', fontWeight: 700 }}>
                ● 2,384 Verified Creators Indexed
              </span>
            </div>

            <div style={{ fontSize: '14px', color: '#00D2FF', fontWeight: 700 }}>
              10% Platform Commission on Completed Deals
            </div>
          </div>

          {/* Live Creator Card Preview */}
          <div style={{ padding: '32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: '24px' }}>
            
            {/* Featured Creator Card */}
            <div style={{ background: 'linear-gradient(135deg, rgba(20,20,32,0.9), rgba(10,10,16,0.98))', border: '1px solid rgba(0,210,255,0.3)', borderRadius: '20px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                  <div style={{ width: '54px', height: '54px', borderRadius: '50%', background: 'linear-gradient(135deg, #00D2FF, #00E676)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 900, color: '#000' }}>
                    SJ
                  </div>
                  <div>
                    <h4 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#fff' }}>Sarah Jain</h4>
                    <span style={{ fontSize: '13px', color: '#00D2FF', fontWeight: 600 }}>Lifestyle & Tech Creator • Delhi</span>
                  </div>
                </div>

                <span style={{ background: 'rgba(0,230,118,0.15)', color: '#00E676', border: '1px solid rgba(0,230,118,0.4)', padding: '4px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: 800 }}>
                  94% BRAND FIT
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '12px', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#888', fontWeight: 700 }}>FOLLOWERS</div>
                  <div style={{ fontSize: '17px', fontWeight: 800, color: '#fff' }}>128K</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#888', fontWeight: 700 }}>ENGAGEMENT</div>
                  <div style={{ fontSize: '17px', fontWeight: 800, color: '#00E676' }}>6.8%</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#888', fontWeight: 700 }}>AUTHENTICITY</div>
                  <div style={{ fontSize: '17px', fontWeight: 800, color: '#00D2FF' }}>98%</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                <span style={{ color: '#aaa' }}>Est. Rate: <strong style={{ color: '#fff' }}>₹18,000 / Reel</strong></span>
                <span style={{ color: '#00E676', fontWeight: 700 }}>Sales Potential: High</span>
              </div>

              <button 
                onClick={() => setInviteSent(!inviteSent)}
                style={{
                  padding: '12px',
                  background: inviteSent ? '#00E676' : 'linear-gradient(135deg, #00D2FF 0%, #0099FF 100%)',
                  color: inviteSent ? '#000' : '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {inviteSent ? <CheckCircle2 size={16} /> : <Zap size={16} />}
                {inviteSent ? 'Collaboration Invite Sent!' : 'Send Collaboration Invite (1-Click)'}
              </button>
            </div>

            {/* Realtime Negotiation WebChat & Escrow Funds Locked Widget */}
            <div style={{ background: 'linear-gradient(135deg, rgba(20,20,32,0.9), rgba(10,10,16,0.98))', border: '1px solid rgba(0,230,118,0.3)', borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              
              {/* WebChat Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MessageSquare size={18} color="#00D2FF" />
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#fff' }}>Live Deal Chat with Sarah</span>
                </div>
                <span style={{ fontSize: '11px', background: 'rgba(0,230,118,0.15)', color: '#00E676', padding: '2px 8px', borderRadius: '100px', fontWeight: 700 }}>● ONLINE</span>
              </div>

              {/* Chat Messages Feed */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                <div style={{ background: 'rgba(0,210,255,0.1)', border: '1px solid rgba(0,210,255,0.2)', padding: '10px 14px', borderRadius: '12px 12px 12px 2px', alignSelf: 'flex-start', maxWidth: '85%' }}>
                  <strong style={{ color: '#00D2FF', display: 'block', fontSize: '11px', marginBottom: '2px' }}>Brand Manager</strong>
                  "Hey Sarah! We love your 6.8% engagement. Can you deliver 1 Reel + 2 Stories for ₹18,000?"
                </div>

                <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 14px', borderRadius: '12px 12px 2px 12px', alignSelf: 'flex-end', maxWidth: '85%' }}>
                  <strong style={{ color: '#00E676', display: 'block', fontSize: '11px', marginBottom: '2px' }}>Sarah Jain (Creator)</strong>
                  "Hi! Absolutely! I can deliver the Reel by Friday with custom UTM links."
                </div>
              </div>

              {/* Funds Locked Escrow Banner */}
              <div style={{ background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: '14px', padding: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <ShieldCheck size={26} color="#00E676" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#00E676' }}>🔒 ₹18,000 Locked in Raftra Escrow</div>
                  <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.7)', marginTop: '2px' }}>Funds are safely held & only released after brand approves deliverable video.</div>
                </div>
              </div>

              <button 
                onClick={() => navigate('/dashboard')}
                style={{ padding: '12px 24px', background: '#00D2FF', color: '#000', borderRadius: '10px', fontWeight: 800, fontSize: '14px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                Open Creator Hub in Dashboard <ArrowRight size={16} />
              </button>
            </div>

          </div>

        </div>
      </section>

      {/* FINAL CTA SECTION */}
      <section style={{ textAlign: 'center', padding: '72px 40px', background: 'linear-gradient(180deg, rgba(0,210,255,0.12), rgba(10,10,16,0.98))', borderRadius: '28px', border: '1px solid rgba(0,210,255,0.35)' }}>
        <h2 style={{ fontSize: '44px', fontFamily: 'var(--font-heading)', marginBottom: '18px', fontWeight: 800 }}>
          Build Better Creator Partnerships
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '20px', maxWidth: '850px', margin: '0 auto 36px auto', lineHeight: 1.6 }}>
          Discover verified creators, hire with confidence, manage collaborations, track deliverables, and grow your brand through authentic influencer marketing—all from one intelligent marketplace.
        </p>
        <GlowButton variant="glow" onClick={() => navigate('/dashboard')} style={{ margin: '0 auto', fontSize: '17px', padding: '16px 40px' }}>
          Find Your Next Creator <ArrowRight size={20} />
        </GlowButton>
      </section>

    </div>
  );
};
