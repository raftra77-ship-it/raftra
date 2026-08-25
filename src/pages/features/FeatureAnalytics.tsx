import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart3, Bot, CheckCircle2, TrendingUp, DollarSign, Activity, Eye, Zap, 
  ArrowRight, ShieldCheck, FileText, Check, Cpu, Sparkles, Layers, Sliders,
  Database, LineChart, PieChart, ArrowUpRight, Download, Filter
} from 'lucide-react';
import { GlowButton } from '../../components/GlowButton';
import { useNavigate } from 'react-router-dom';

export const FeatureAnalytics = () => {
  const navigate = useNavigate();
  const [reportGenerated, setReportGenerated] = useState(false);

  const whatYouCanMonitor = [
    {
      title: "Marketing Performance",
      desc: "Track campaign performance, website traffic, conversion rates, and revenue from one dashboard.",
      icon: <TrendingUp size={28} color="#FFB300" />
    },
    {
      title: "SEO & GEO Performance",
      desc: "Monitor keyword growth, rankings, impressions, clicks, indexing, and AI search visibility.",
      icon: <BarChart3 size={28} color="#00E676" />
    },
    {
      title: "Website Performance",
      desc: "Understand how visitors interact with your website and identify high-performing pages and drop-off points.",
      icon: <Activity size={28} color="#7C75FF" />
    },
    {
      title: "AI Growth Insights",
      desc: "Receive AI-generated summaries, opportunities, anomalies, and growth recommendations based on your live data.",
      icon: <Bot size={28} color="#FF5296" />
    },
    {
      title: "Executive Reports",
      desc: "Generate clean, executive-ready reports for founders, marketing teams, clients, or investors in seconds.",
      icon: <FileText size={28} color="#00D2FF" />
    }
  ];

  const featuresIncluded = [
    "Unified Growth Dashboard", "Campaign Analytics", "SEO Analytics", "GEO Visibility Analytics",
    "Website Analytics", "Traffic Sources", "Conversion Tracking", "Revenue Tracking",
    "Goal Tracking", "ROAS Monitoring", "Funnel Analytics", "Landing Page Performance",
    "Top Performing Campaigns", "Top Performing Pages", "AI Weekly Summaries (Fair Usage)", "AI Performance Recommendations (Fair Usage)",
    "Executive Reports", "Team Dashboards", "Custom Date Filters", "CSV & PDF Export"
  ];

  const supportedIntegrations = {
    connected: ["Meta Ads", "Google Ads", "Google Analytics 4", "Google Search Console", "Raftra SEO Engine", "GEO Visibility Tracking"],
    comingSoon: ["Shopify Analytics", "WooCommerce", "Stripe Revenue", "LinkedIn Analytics", "TikTok Analytics"]
  };

  const howItWorksFlow = [
    { step: "01", title: "Connect Channels", desc: "Connect Meta Ads, Google Ads, GA4, and Search Console." },
    { step: "02", title: "Automated Data Collection", desc: "Raftra continuously collects campaign, traffic, and revenue metrics." },
    { step: "03", title: "AI Organization", desc: "Data is normalized into unified growth dashboards." },
    { step: "04", title: "Trend & Anomaly Detection", desc: "AI highlights high-ROAS opportunities and performance drops." },
    { step: "05", title: "Actionable Recommendations", desc: "Receive clear recommendations on what to optimize next." },
    { step: "06", title: "Track Business Growth", desc: "Measure revenue lift and ROAS improvements over time." }
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
          <BarChart3 size={18} color="#FFB300" />
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#FFB300', letterSpacing: '0.06em', textTransform: 'uppercase' }}>GROWTH ANALYTICS</span>
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} 
          style={{ fontSize: '60px', fontFamily: 'var(--font-heading)', margin: '0 0 24px 0', background: 'linear-gradient(to right, #fff, rgba(255,255,255,0.8))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.15, fontWeight: 800 }}
        >
          Turn Your Marketing Data Into Business Decisions
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} 
          style={{ color: 'var(--text-secondary)', fontSize: '22px', maxWidth: '1050px', margin: '0 auto 40px auto', lineHeight: 1.6 }}
        >
          Bring together your advertising, website performance, SEO, AI visibility, and business growth metrics into one intelligent dashboard. Stop looking at disconnected reports and start making faster, data-driven decisions.
        </motion.p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <GlowButton variant="glow" onClick={() => navigate('/dashboard')} style={{ fontSize: '17px', padding: '16px 36px' }}>
            Explore Growth Analytics <ArrowRight size={18} />
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
            Centralized Business Intelligence Hub
          </h2>
          <p style={{ fontSize: '18.5px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, margin: '0 0 24px 0' }}>
            Growth Analytics is Raftra's centralized intelligence hub that transforms raw marketing data into actionable business insights. Instead of checking Meta Ads Manager, Google Ads, GA4, Google Search Console, SEO tools, spreadsheets, and campaign reports separately, Raftra automatically combines everything into one workspace and highlights what matters most.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '17px', color: '#00E676', fontWeight: 600 }}>
            <CheckCircle2 size={22} color="#00E676" style={{ flexShrink: 0 }} /> 
            <span>Understand what's driving growth, identify opportunities, detect problems early, and make confident marketing decisions backed by AI.</span>
          </div>
        </div>
      </section>

      {/* SUPPORTED INTEGRATIONS SECTION */}
      <section style={{ marginBottom: '80px' }}>
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#FFB300', letterSpacing: '0.12em', textTransform: 'uppercase' }}>DATA CONNECTIONS</span>
          <h2 style={{ fontSize: '38px', fontFamily: 'var(--font-heading)', marginTop: '8px', fontWeight: 800 }}>Supported Integrations</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          {/* Active Data Feeds */}
          <div style={{ background: 'rgba(0,230,118,0.04)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: '20px', padding: '36px' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#00E676', letterSpacing: '0.08em', marginBottom: '16px' }}>✓ ACTIVE DATA FEEDS</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {supportedIntegrations.connected.map((plat, i) => (
                <li key={i} style={{ fontSize: '17px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CheckCircle2 size={20} color="#00E676" /> {plat}
                </li>
              ))}
            </ul>
          </div>

          {/* Coming Soon Feeds */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '36px' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#aaa', letterSpacing: '0.08em', marginBottom: '16px' }}>• COMING SOON</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {supportedIntegrations.comingSoon.map((plat, i) => (
                <span key={i} style={{ fontSize: '14.5px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#ccc', padding: '6px 14px', borderRadius: '8px', fontWeight: 600 }}>
                  {plat}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* WHAT YOU CAN MONITOR (5 CARDS GRID) */}
      <section style={{ marginBottom: '80px' }}>
        <div style={{ textAlign: 'center', marginBottom: '44px' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#7C75FF', letterSpacing: '0.12em', textTransform: 'uppercase' }}>INTELLIGENCE AREAS</span>
          <h2 style={{ fontSize: '42px', fontFamily: 'var(--font-heading)', marginTop: '8px', fontWeight: 800 }}>What You Can Monitor</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '28px' }}>
          {whatYouCanMonitor.map((item, idx) => (
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

      {/* AI GROWTH INSIGHTS & EXECUTIVE REPORTING */}
      <section style={{ marginBottom: '80px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '32px' }}>
        {/* AI Growth Insights */}
        <div style={{ padding: '40px', background: 'rgba(0,230,118,0.04)', border: '1px solid rgba(0,230,118,0.25)', borderRadius: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
            <Bot size={28} color="#00E676" />
            <h3 style={{ fontSize: '26px', fontWeight: 800, margin: 0 }}>AI Growth Insights</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '17px', lineHeight: 1.6, marginBottom: '24px' }}>
            Raftra continuously analyzes live data and answers critical marketing questions automatically.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
            {[
              "Which campaigns generate the highest ROI?",
              "Which landing pages lose conversion momentum?",
              "Which SEO articles need content updates?",
              "Which high-intent keywords drive revenue?",
              "Which products are scaling fastest this month?",
              "What is your next best optimization move?"
            ].map((q, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '16px', color: '#fff' }}>
                <Check size={18} color="#00E676" style={{ flexShrink: 0 }} /> {q}
              </div>
            ))}
          </div>
        </div>

        {/* Executive Reporting & Forecasting */}
        <div style={{ padding: '40px', background: 'rgba(255,179,0,0.05)', border: '1px solid rgba(255,179,0,0.25)', borderRadius: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
            <FileText size={28} color="#FFB300" />
            <h3 style={{ fontSize: '26px', fontWeight: 800, margin: 0 }}>Executive Reporting & Forecasting</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '17px', lineHeight: 1.6, marginBottom: '24px' }}>
            Generate executive reports for founders, clients, investors, or teams in 1 click.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {["Traffic Growth", "Campaign Spend", "Revenue Lift", "Conversion Trends", "Seasonal Predictions", "ROAS Forecast", "Client PDF Exports", "Team KPI Digests"].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15.5px', color: '#fff', fontWeight: 500 }}>
                <Zap size={16} color="#FFB300" /> {item}
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

      {/* REAL DASHBOARD GROWTH ANALYTICS INTERACTIVE PREVIEW */}
      <section style={{ marginBottom: '80px', marginTop: '40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#FFB300', letterSpacing: '0.12em', textTransform: 'uppercase' }}>INTERACTIVE DASHBOARD PREVIEW</span>
          <h2 style={{ fontSize: '38px', fontFamily: 'var(--font-heading)', marginTop: '8px', fontWeight: 800 }}>Explore Growth Analytics Workspace</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '17px' }}>Live revenue, campaign ROAS & AI recommendation UI inside Raftra AI.</p>
        </div>

        <div style={{ background: '#0a0a0d', borderRadius: '24px', border: '1px solid rgba(255,179,0,0.3)', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>
          
          {/* Top Dashboard Header Bar */}
          <div style={{ padding: '20px 32px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <BarChart3 size={20} color="#FFB300" />
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#fff' }}>Growth Analytics Hub</span>
              </div>
              <span style={{ fontSize: '12px', background: 'rgba(0,230,118,0.12)', color: '#00E676', border: '1px solid rgba(0,230,118,0.3)', padding: '4px 12px', borderRadius: '100px', fontWeight: 700 }}>
                ● Meta + Google + GA4 + GSC Connected
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '13px', color: '#888', background: 'rgba(255,255,255,0.05)', padding: '6px 14px', borderRadius: '8px' }}>
                📅 Date Range: Last 30 Days
              </span>
            </div>
          </div>

          {/* Key Performance Indicators Grid */}
          <div style={{ padding: '32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px' }}>
              <div style={{ fontSize: '12px', color: '#888', fontWeight: 800, marginBottom: '6px' }}>TOTAL REVENUE</div>
              <div style={{ fontSize: '28px', fontWeight: 900, color: '#fff' }}>₹42.8 Lakhs</div>
              <div style={{ fontSize: '12px', color: '#00E676', fontWeight: 600, marginTop: '4px' }}>↑ +18.4% MoM Growth</div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px' }}>
              <div style={{ fontSize: '12px', color: '#888', fontWeight: 800, marginBottom: '6px' }}>TOTAL AD SPEND</div>
              <div style={{ fontSize: '28px', fontWeight: 900, color: '#fff' }}>₹8.4 Lakhs</div>
              <div style={{ fontSize: '12px', color: '#aaa', marginTop: '4px' }}>Meta + Google Combined</div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px' }}>
              <div style={{ fontSize: '12px', color: '#888', fontWeight: 800, marginBottom: '6px' }}>BLENDED ROAS</div>
              <div style={{ fontSize: '28px', fontWeight: 900, color: '#00E676' }}>5.1×</div>
              <div style={{ fontSize: '12px', color: '#00E676', fontWeight: 600, marginTop: '4px' }}>✓ Above 4.5x Goal</div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px' }}>
              <div style={{ fontSize: '12px', color: '#888', fontWeight: 800, marginBottom: '6px' }}>AI SEARCH VISIBILITY</div>
              <div style={{ fontSize: '28px', fontWeight: 900, color: '#7C75FF' }}>84%</div>
              <div style={{ fontSize: '12px', color: '#7C75FF', fontWeight: 600, marginTop: '4px' }}>Perplexity & ChatGPT</div>
            </div>

          </div>

          {/* Visual Growth Chart & Claude Recommendation Engine Grid */}
          <div style={{ padding: '32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            
            {/* Visual Analytics Chart Widget */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={18} color="#FFB300" />
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#fff' }}>Revenue & Ad Spend Growth Trend</span>
                </div>
                <span style={{ fontSize: '11px', background: 'rgba(255,179,0,0.12)', color: '#FFB300', padding: '2px 8px', borderRadius: '100px', fontWeight: 700 }}>+18.4% LIFT</span>
              </div>

              {/* Visual SVG Chart */}
              <div style={{ height: '140px', width: '100%', position: 'relative', marginTop: '10px' }}>
                <svg viewBox="0 0 400 120" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00E676" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#00E676" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path d="M 0,90 Q 60,70 120,75 T 240,40 T 360,15 L 400,10 L 400,120 L 0,120 Z" fill="url(#chartGrad)" />
                  <path d="M 0,90 Q 60,70 120,75 T 240,40 T 360,15 L 400,10" fill="none" stroke="#00E676" strokeWidth="3" />
                  <path d="M 0,105 Q 60,100 120,95 T 240,85 T 360,70 L 400,65" fill="none" stroke="#FFB300" strokeWidth="2" strokeDasharray="4 4" />
                </svg>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#aaa', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00E676' }}></span> Total Revenue</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FFB300' }}></span> Campaign Ad Spend</span>
              </div>
            </div>

            {/* Claude AI Recommendation Engine Widget */}
            <div style={{ background: 'linear-gradient(135deg, rgba(124,117,255,0.08) 0%, rgba(10,10,16,0.98) 100%)', border: '1px solid rgba(124,117,255,0.3)', borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={18} color="#7C75FF" />
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#fff' }}>Claude AI Recommendation Engine</span>
                </div>
                <span style={{ fontSize: '11px', background: 'rgba(124,117,255,0.2)', color: '#7C75FF', padding: '2px 8px', borderRadius: '100px', fontWeight: 800 }}>LIVE CLAUDE 3.5</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '12px', fontSize: '13px' }}>
                  <div style={{ color: '#00E676', fontWeight: 700, marginBottom: '2px' }}>● Scale Meta Retargeting Ad Set #4</div>
                  <div style={{ color: 'var(--text-secondary)' }}>Increase budget by +30% to capture high-intent 5.2x ROAS audience. (Confidence: 96%)</div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '12px', fontSize: '13px' }}>
                  <div style={{ color: '#7C75FF', fontWeight: 700, marginBottom: '2px' }}>● Publish 3 GEO-Optimized Articles</div>
                  <div style={{ color: 'var(--text-secondary)' }}>Target ChatGPT & Perplexity citations for +14% Organic Traffic lift.</div>
                </div>
              </div>
            </div>

          </div>

          {/* AI Recommendation Alert Bar */}
          <div style={{ padding: '20px 32px', background: 'rgba(0,230,118,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <Bot size={24} color="#00E676" />
              <div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#fff' }}>AI Insight: Top Opportunity Detected — Reallocate ₹50,000 from Search to Retargeting</div>
                <div style={{ fontSize: '13px', color: '#00E676' }}>Estimated Additional Monthly Revenue Impact: +₹1.2 Lakhs</div>
              </div>
            </div>

            <button 
              onClick={() => setReportGenerated(!reportGenerated)}
              style={{
                padding: '10px 20px',
                background: reportGenerated ? '#00E676' : 'transparent',
                color: reportGenerated ? '#000' : '#00E676',
                border: '1px solid #00E676',
                borderRadius: '8px',
                fontSize: '13.5px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {reportGenerated ? <CheckCircle2 size={16} /> : <Download size={16} />}
              {reportGenerated ? 'Report Downloaded!' : 'Export Executive PDF Report'}
            </button>
          </div>

        </div>
      </section>

      {/* FINAL CTA SECTION */}
      <section style={{ textAlign: 'center', padding: '72px 40px', background: 'linear-gradient(180deg, rgba(255,179,0,0.12), rgba(10,10,16,0.98))', borderRadius: '28px', border: '1px solid rgba(255,179,0,0.35)' }}>
        <h2 style={{ fontSize: '44px', fontFamily: 'var(--font-heading)', marginBottom: '18px', fontWeight: 800 }}>
          Make Every Marketing Decision With Confidence
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '20px', maxWidth: '850px', margin: '0 auto 36px auto', lineHeight: 1.6 }}>
          Stop guessing. Track your campaigns, SEO, website performance, and growth from one intelligent dashboard that turns data into clear, actionable insights.
        </p>
        <GlowButton variant="glow" onClick={() => navigate('/dashboard')} style={{ margin: '0 auto', fontSize: '17px', padding: '16px 40px' }}>
          Explore Growth Analytics <ArrowRight size={20} />
        </GlowButton>
      </section>

    </div>
  );
};
