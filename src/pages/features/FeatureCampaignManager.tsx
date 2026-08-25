import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Megaphone, Bot, CheckCircle2, Globe, MousePointerClick, RefreshCcw, Check, 
  Users2, ArrowRight, ShieldCheck, Zap, TrendingUp, BarChart3, Layers, Sliders, 
  DollarSign, Activity, Play, Plus, ChevronRight, Lock
} from 'lucide-react';
import { GlowButton } from '../../components/GlowButton';
import { useNavigate } from 'react-router-dom';

export const FeatureCampaignManager = () => {
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState<'all' | 'meta' | 'google'>('all');
  const [aiApplied, setAiApplied] = useState(false);

  const whatYouCanDo = [
    {
      title: "Create Campaigns",
      desc: "Build complete campaigns from scratch with AI-assisted setup and automated target audience matching.",
      icon: <Megaphone size={28} color="#FFB300" />
    },
    {
      title: "Publish Instantly",
      desc: "Push campaigns directly to Meta and Google using connected ad accounts with 1-click authorization.",
      icon: <Zap size={28} color="#00E676" />
    },
    {
      title: "Budget Management",
      desc: "Manage campaign budgets, daily spending limits, and optimization recommendations from one dashboard.",
      icon: <DollarSign size={28} color="#7C75FF" />
    },
    {
      title: "AI Optimization",
      desc: "Receive real-time recommendations on creatives, budgets, audiences, bidding strategies, and campaign health.",
      icon: <Bot size={28} color="#FF5296" />
    },
    {
      title: "Performance Analytics",
      desc: "Monitor clicks, impressions, CTR, CPC, CPA, conversions, ROAS, and overall campaign performance in real time.",
      icon: <TrendingUp size={28} color="#00D2FF" />
    },
    {
      title: "Campaign Reporting",
      desc: "Generate easy-to-understand executive reports for brands, marketing teams, or agency clients.",
      icon: <BarChart3 size={28} color="#A855F7" />
    }
  ];

  const featuresIncluded = [
    "Meta Ads Integration", "Google Ads Integration", "Campaign Builder", "Unlimited Campaigns",
    "Unlimited Ad Sets", "Unlimited Ads", "Budget Planner", "Campaign Dashboard",
    "Performance Dashboard", "AI Recommendations (Fair Usage)", "AI Budget Optimization (Fair Usage)", "Audience Suggestions (Fair Usage)",
    "A/B Testing Suggestions (Fair Usage)", "Campaign Reports", "Multi-Account Management", "Team Collaboration"
  ];

  const supportedPlatforms = {
    available: ["Meta Ads (Facebook & Instagram)", "Google Ads (Search, Shopping, Display, YouTube)"],
    comingSoon: ["OpenAI Ads", "TikTok Ads", "LinkedIn Ads", "Pinterest Ads", "Amazon Ads"]
  };

  const howItWorksFlow = [
    { step: "01", title: "Connect Ad Accounts", desc: "Connect Meta & Google Ads securely via 1-click OAuth." },
    { step: "02", title: "Select Campaign Objective", desc: "Sales, Leads, Website Traffic, Awareness, or App Installs." },
    { step: "03", title: "Attach AI Creatives", desc: "Select or generate assets directly from AI Creative Studio." },
    { step: "04", title: "Configure Strategy", desc: "Set Budget, Audience, Placements, Locations & Schedule." },
    { step: "05", title: "Instant Publishing", desc: "Deploy campaigns directly to Meta & Google Ads." },
    { step: "06", title: "Live AI Optimization", desc: "AI continuously tracks ROAS & applies budget recommendations." }
  ];

  return (
    <div style={{ animation: 'fadeIn 0.5s ease', color: '#fff' }}>
      
      {/* HERO SECTION */}
      <div style={{ textAlign: 'center', marginBottom: '64px' }}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }} 
          animate={{ opacity: 1, scale: 1 }} 
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 24px', background: 'rgba(255,179,0,0.12)', borderRadius: '100px', border: '1px solid rgba(255,179,0,0.3)', marginBottom: '24px' }}
        >
          <Megaphone size={18} color="#FFB300" />
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#FFB300', letterSpacing: '0.06em', textTransform: 'uppercase' }}>CAMPAIGN MANAGER</span>
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} 
          style={{ fontSize: '60px', fontFamily: 'var(--font-heading)', margin: '0 0 24px 0', background: 'linear-gradient(to right, #fff, rgba(255,255,255,0.8))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.15, fontWeight: 800 }}
        >
          Launch, Manage & Optimize Every Campaign From One Workspace
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} 
          style={{ color: 'var(--text-secondary)', fontSize: '22px', maxWidth: '1050px', margin: '0 auto 40px auto', lineHeight: 1.6 }}
        >
          Plan campaigns, publish to Meta & Google, monitor performance, receive AI recommendations, and continuously improve results—all without switching between multiple advertising platforms.
        </motion.p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <GlowButton variant="glow" onClick={() => navigate('/dashboard')} style={{ fontSize: '17px', padding: '16px 36px' }}>
            Launch Your Next Campaign <ArrowRight size={18} />
          </GlowButton>
        </div>
      </div>

      {/* STREAMLINED WORKSPACE OVERVIEW */}
      <section style={{ marginBottom: '80px' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(255, 179, 0, 0.08) 0%, rgba(10, 10, 16, 0.98) 100%)',
          border: '1px solid rgba(255, 179, 0, 0.3)',
          borderRadius: '24px',
          padding: '44px 56px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
        }}>
          <h2 style={{ fontSize: '32px', fontFamily: 'var(--font-heading)', margin: '0 0 20px 0', color: '#fff', fontWeight: 800 }}>
            Centralized Multi-Platform Advertising
          </h2>
          <p style={{ fontSize: '18.5px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, margin: '0 0 24px 0' }}>
            Campaign Manager is Raftra's centralized advertising workspace built for businesses, agencies, and performance marketers. Instead of jumping between Meta Ads Manager, Google Ads, spreadsheets, and reporting tools, Raftra brings your campaigns, analytics, optimization, and AI recommendations into one unified platform.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '17px', color: '#00E676', fontWeight: 600 }}>
            <CheckCircle2 size={22} color="#00E676" style={{ flexShrink: 0 }} /> 
            <span>Whether you're spending ₹5,000 or ₹50 lakh every month, Campaign Manager helps you launch campaigns faster, monitor performance in real time, and make better optimization decisions.</span>
          </div>
        </div>
      </section>

      {/* SUPPORTED PLATFORMS SECTION */}
      <section style={{ marginBottom: '80px' }}>
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#FFB300', letterSpacing: '0.12em', textTransform: 'uppercase' }}>AD NETWORKS</span>
          <h2 style={{ fontSize: '38px', fontFamily: 'var(--font-heading)', marginTop: '8px', fontWeight: 800 }}>Supported Platforms</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          {/* Available Channels */}
          <div style={{ background: 'rgba(0,230,118,0.04)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: '20px', padding: '36px' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#00E676', letterSpacing: '0.08em', marginBottom: '16px' }}>✓ AVAILABLE NOW</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {supportedPlatforms.available.map((plat, i) => (
                <li key={i} style={{ fontSize: '17px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CheckCircle2 size={20} color="#00E676" /> {plat}
                </li>
              ))}
            </ul>
          </div>

          {/* Coming Soon Channels */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '36px' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#aaa', letterSpacing: '0.08em', marginBottom: '16px' }}>• COMING SOON</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {supportedPlatforms.comingSoon.map((plat, i) => (
                <span key={i} style={{ fontSize: '14.5px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#ccc', padding: '6px 14px', borderRadius: '8px', fontWeight: 600 }}>
                  {plat}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* WHAT YOU CAN DO (6 CARDS GRID) */}
      <section style={{ marginBottom: '80px' }}>
        <div style={{ textAlign: 'center', marginBottom: '44px' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#00E676', letterSpacing: '0.12em', textTransform: 'uppercase' }}>CORE CAPABILITIES</span>
          <h2 style={{ fontSize: '42px', fontFamily: 'var(--font-heading)', marginTop: '8px', fontWeight: 800 }}>What You Can Do</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '28px' }}>
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
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#FFB300', letterSpacing: '0.12em', textTransform: 'uppercase' }}>WORKFLOW FLOW</span>
          <h2 style={{ fontSize: '42px', fontFamily: 'var(--font-heading)', marginTop: '8px', fontWeight: 800 }}>How It Works</h2>
        </div>

        <div style={{
          background: 'rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '24px',
          padding: '48px 40px'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '28px', position: 'relative' }}>
            {howItWorksFlow.map((s, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '14px', fontWeight: 900, color: '#FFB300', background: 'rgba(255,179,0,0.15)', padding: '6px 14px', borderRadius: '100px', letterSpacing: '0.08em' }}>
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

      {/* AI OPTIMIZATION & HEALTH SCORE HIGHLIGHTS */}
      <section style={{ marginBottom: '80px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '32px' }}>
        {/* AI Optimization Triggers */}
        <div style={{ padding: '40px', background: 'rgba(0,230,118,0.04)', border: '1px solid rgba(0,230,118,0.25)', borderRadius: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
            <Bot size={28} color="#00E676" />
            <h3 style={{ fontSize: '26px', fontWeight: 800, margin: 0 }}>AI Campaign Optimization</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '17px', lineHeight: 1.6, marginBottom: '24px' }}>
            Instead of manually checking dashboards every day, Raftra continuously analyzes performance and highlights action items.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
            {[
              "Increase budget on winning campaigns",
              "Pause underperforming fatigued ad sets",
              "Replace weak creatives automatically",
              "Improve audience demographic targeting",
              "Recommend automated A/B tests",
              "Detect ROAS drop before CPC spikes"
            ].map((opt, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '16px', color: '#fff' }}>
                <Check size={18} color="#00E676" style={{ flexShrink: 0 }} /> {opt}
              </div>
            ))}
          </div>
        </div>

        {/* Campaign Health Score */}
        <div style={{ padding: '40px', background: 'rgba(255,179,0,0.05)', border: '1px solid rgba(255,179,0,0.25)', borderRadius: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
            <Activity size={28} color="#FFB300" />
            <h3 style={{ fontSize: '26px', fontWeight: 800, margin: 0 }}>Campaign Health Factors</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '17px', lineHeight: 1.6, marginBottom: '24px' }}>
            Every campaign receives an AI-generated health score calculated from real performance metrics.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {["CTR & CPC Ratio", "CPM Efficiency", "CPA vs Target", "Real ROAS", "Conversion Rate", "Creative Fatigue", "Audience Saturation", "Budget Utilization"].map((factor, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15.5px', color: '#fff', fontWeight: 500 }}>
                <Zap size={16} color="#FFB300" /> {factor}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES INCLUDED LIST (STREAMLINED 2-COLUMN LIST) */}
      <section style={{ marginBottom: '80px', background: 'rgba(255,255,255,0.02)', borderRadius: '24px', padding: '48px 56px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ marginBottom: '32px' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#FFB300', letterSpacing: '0.12em', textTransform: 'uppercase' }}>FULL INVENTORY</span>
          <h2 style={{ fontSize: '38px', fontFamily: 'var(--font-heading)', marginTop: '8px', fontWeight: 800 }}>Features Included</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
          {featuresIncluded.map((feat, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <CheckCircle2 size={20} color="#00E676" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '17px', fontWeight: 600, color: '#f0f0ff' }}>{feat}</span>
            </div>
          ))}
        </div>
      </section>

      {/* REAL DASHBOARD CAMPAIGN MANAGER INTERACTIVE PREVIEW */}
      <section style={{ marginBottom: '80px', marginTop: '40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#FFB300', letterSpacing: '0.12em', textTransform: 'uppercase' }}>INTERACTIVE DASHBOARD PREVIEW</span>
          <h2 style={{ fontSize: '38px', fontFamily: 'var(--font-heading)', marginTop: '8px', fontWeight: 800 }}>Explore Campaign Manager Workspace</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '17px' }}>Live multi-channel ad management UI inside Raftra AI.</p>
        </div>

        <div style={{ background: '#0a0a0d', borderRadius: '24px', border: '1px solid rgba(255,179,0,0.3)', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>
          
          {/* Top Dashboard Header Bar */}
          <div style={{ padding: '20px 32px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Megaphone size={20} color="#FFB300" />
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#fff' }}>Campaign Manager</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{ fontSize: '12px', background: 'rgba(0,230,118,0.12)', color: '#00E676', border: '1px solid rgba(0,230,118,0.3)', padding: '4px 12px', borderRadius: '100px', fontWeight: 700 }}>
                  ● Meta Ads (Connected)
                </span>
                <span style={{ fontSize: '12px', background: 'rgba(0,230,118,0.12)', color: '#00E676', border: '1px solid rgba(0,230,118,0.3)', padding: '4px 12px', borderRadius: '100px', fontWeight: 700 }}>
                  ● Google Ads (Connected)
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setSelectedTab('all')}
                style={{ padding: '6px 14px', borderRadius: '8px', background: selectedTab === 'all' ? 'rgba(255,179,0,0.2)' : 'transparent', color: selectedTab === 'all' ? '#FFB300' : '#888', border: selectedTab === 'all' ? '1px solid #FFB300' : '1px solid transparent', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                All Campaigns (4)
              </button>
              <button 
                onClick={() => setSelectedTab('meta')}
                style={{ padding: '6px 14px', borderRadius: '8px', background: selectedTab === 'meta' ? 'rgba(255,179,0,0.2)' : 'transparent', color: selectedTab === 'meta' ? '#FFB300' : '#888', border: selectedTab === 'meta' ? '1px solid #FFB300' : '1px solid transparent', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                Meta Ads
              </button>
              <button 
                onClick={() => setSelectedTab('google')}
                style={{ padding: '6px 14px', borderRadius: '8px', background: selectedTab === 'google' ? 'rgba(255,179,0,0.2)' : 'transparent', color: selectedTab === 'google' ? '#FFB300' : '#888', border: selectedTab === 'google' ? '1px solid #FFB300' : '1px solid transparent', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                Google Ads
              </button>
            </div>
          </div>

          {/* AI Recommendation Alert Bar */}
          <div style={{ padding: '18px 32px', background: 'rgba(0,230,118,0.06)', borderBottom: '1px solid rgba(0,230,118,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Bot size={22} color="#00E676" />
              <div>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#fff' }}>AI Optimization Alert: Increase Budget on High-ROAS Meta Retargeting (+20%)</span>
                <div style={{ fontSize: '12px', color: '#00E676' }}>Estimated Additional Monthly Revenue: +₹18,500 | Current ROAS: 5.2x</div>
              </div>
            </div>

            <button 
              onClick={() => setAiApplied(!aiApplied)}
              style={{
                padding: '8px 18px',
                background: aiApplied ? '#00E676' : 'transparent',
                color: aiApplied ? '#000' : '#00E676',
                border: '1px solid #00E676',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {aiApplied ? <CheckCircle2 size={16} /> : <Zap size={16} />}
              {aiApplied ? 'Recommendation Applied!' : 'Apply Recommendation'}
            </button>
          </div>

          {/* Live Campaign Table Preview */}
          <div style={{ padding: '32px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#888', fontSize: '13px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>Campaign Name</th>
                  <th style={{ padding: '12px 16px' }}>Channel</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>Daily Spend</th>
                  <th style={{ padding: '12px 16px' }}>ROAS</th>
                  <th style={{ padding: '12px 16px' }}>Conversions</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Health Score</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '15px' }}>
                  <td style={{ padding: '16px', fontWeight: 700, color: '#fff' }}>Retargeting — Flat 30% Off Carousel</td>
                  <td style={{ padding: '16px', color: '#7C75FF', fontWeight: 600 }}>Meta Ads</td>
                  <td style={{ padding: '16px' }}><span style={{ color: '#00E676', background: 'rgba(0,230,118,0.1)', padding: '2px 8px', borderRadius: '100px', fontSize: '12px', fontWeight: 700 }}>🟢 Active</span></td>
                  <td style={{ padding: '16px', color: '#fff' }}>₹4,200 / day</td>
                  <td style={{ padding: '16px', color: '#00E676', fontWeight: 800 }}>5.2×</td>
                  <td style={{ padding: '16px', color: '#fff' }}>48 Sales</td>
                  <td style={{ padding: '16px', textAlign: 'right', color: '#00E676', fontWeight: 800 }}>96/100</td>
                </tr>

                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '15px' }}>
                  <td style={{ padding: '16px', fontWeight: 700, color: '#fff' }}>Google Search — High Intent Keywords</td>
                  <td style={{ padding: '16px', color: '#FFB300', fontWeight: 600 }}>Google Ads</td>
                  <td style={{ padding: '16px' }}><span style={{ color: '#00E676', background: 'rgba(0,230,118,0.1)', padding: '2px 8px', borderRadius: '100px', fontSize: '12px', fontWeight: 700 }}>🟢 Active</span></td>
                  <td style={{ padding: '16px', color: '#fff' }}>₹4,220 / day</td>
                  <td style={{ padding: '16px', color: '#00E676', fontWeight: 800 }}>4.4×</td>
                  <td style={{ padding: '16px', color: '#fff' }}>36 Sales</td>
                  <td style={{ padding: '16px', textAlign: 'right', color: '#00E676', fontWeight: 800 }}>91/100</td>
                </tr>
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button 
                onClick={() => navigate('/dashboard')}
                style={{ padding: '12px 24px', background: '#FFB300', color: '#000', borderRadius: '10px', fontWeight: 800, fontSize: '14px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                Launch Campaign in Dashboard <ArrowRight size={16} />
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* FINAL CTA SECTION */}
      <section style={{ textAlign: 'center', padding: '72px 40px', background: 'linear-gradient(180deg, rgba(255,179,0,0.12), rgba(10,10,16,0.98))', borderRadius: '28px', border: '1px solid rgba(255,179,0,0.35)' }}>
        <h2 style={{ fontSize: '44px', fontFamily: 'var(--font-heading)', marginBottom: '18px', fontWeight: 800 }}>
          Stop Switching Between Ad Platforms
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '20px', maxWidth: '850px', margin: '0 auto 36px auto', lineHeight: 1.6 }}>
          Create campaigns, publish instantly, monitor performance, and optimize everything from one intelligent workspace.
        </p>
        <GlowButton variant="glow" onClick={() => navigate('/dashboard')} style={{ margin: '0 auto', fontSize: '17px', padding: '16px 40px' }}>
          Launch Your Next Campaign <ArrowRight size={20} />
        </GlowButton>
      </section>

    </div>
  );
};
