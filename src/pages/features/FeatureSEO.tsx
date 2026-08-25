import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, Bot, CheckCircle2, TrendingUp, Globe, Activity, Eye, Zap, 
  ArrowRight, ShieldCheck, FileText, Check, Cpu, Sparkles, Layers, Sliders,
  Database, BarChart3, Globe2
} from 'lucide-react';
import { GlowButton } from '../../components/GlowButton';
import { useNavigate } from 'react-router-dom';

export const FeatureSEO = () => {
  const navigate = useNavigate();
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);

  const whatYouCanDo = [
    {
      title: "Website Audits",
      desc: "Automatically crawl your website and identify technical SEO and AI search optimization issues.",
      icon: <Search size={28} color="#00E676" />
    },
    {
      title: "Technical SEO",
      desc: "Fix metadata, schema, headings, internal linking, indexing, crawlability, page structure, and content organization.",
      icon: <Zap size={28} color="#7C75FF" />
    },
    {
      title: "GEO Optimization",
      desc: "Improve how AI search engines (ChatGPT, Gemini, Perplexity) understand, reference, and recommend your website.",
      icon: <Globe size={28} color="#00D2FF" />
    },
    {
      title: "AI Content Generation",
      desc: "Generate SEO-friendly blogs, landing pages, FAQs, product descriptions, comparison pages, and supporting content.",
      icon: <FileText size={28} color="#FFB300" />
    },
    {
      title: "Smart CMS Publishing",
      desc: "Review AI-generated recommendations and publish approved changes directly to your connected WordPress, Shopify, or GitHub CMS.",
      icon: <CheckCircle2 size={28} color="#FF5296" />
    },
    {
      title: "Performance Monitoring",
      desc: "Track rankings, organic traffic, indexing, impressions, clicks, AI visibility, and content performance from one dashboard.",
      icon: <TrendingUp size={28} color="#A855F7" />
    }
  ];

  const featuresIncluded = [
    "Website Crawling", "Technical SEO Audit", "GEO Audit", "AI Visibility Tracking",
    "Keyword Research", "Keyword Clustering", "Internal Linking Suggestions", "Meta Title Optimization",
    "Meta Description Optimization", "Schema Recommendations", "FAQ Generation", "AI Blog Generation",
    "Landing Page Generator", "Product Page Optimization", "Content Gap Analysis", "Competitor SEO Analysis",
    "Google Search Console Sync", "Google Analytics 4 Sync", "WordPress Publishing", "Shopify Publishing",
    "GitHub Publishing", "Weekly SEO Reports", "AI SEO Assistant (Fair Usage)"
  ];

  const supportedIntegrations = {
    platforms: ["WordPress", "Shopify", "GitHub Pages"],
    analytics: ["Google Search Console", "Google Analytics 4"],
    comingSoon: ["Webflow", "Framer", "Wix", "Headless CMS"]
  };

  const howItWorksFlow = [
    { step: "01", title: "Connect Website & CMS", desc: "Connect WordPress, Shopify, or GitHub Pages via OAuth." },
    { step: "02", title: "Sync GSC & GA4", desc: "Sync Google Search Console & GA4 for automated data collection." },
    { step: "03", title: "Run Complete SEO & GEO Audit", desc: "AI scans Technical SEO, Schema, Content & AI Search Readiness." },
    { step: "04", title: "Prioritized Action Plan", desc: "Receive recommendations with Impact Score & expected lift." },
    { step: "05", title: "Approve & Publish to CMS", desc: "Convert recommendations into 1-click platform updates." },
    { step: "06", title: "Track Live AI Visibility", desc: "Monitor rankings & AI recommendation frequency across Perplexity & ChatGPT." }
  ];

  return (
    <div style={{ animation: 'fadeIn 0.5s ease', color: '#fff' }}>
      
      {/* HERO SECTION */}
      <div style={{ textAlign: 'center', marginBottom: '64px' }}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }} 
          animate={{ opacity: 1, scale: 1 }} 
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 24px', background: 'rgba(0,230,118,0.12)', borderRadius: '100px', border: '1px solid rgba(0,230,118,0.3)', marginBottom: '24px' }}
        >
          <Search size={18} color="#00E676" />
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#00E676', letterSpacing: '0.06em', textTransform: 'uppercase' }}>SEO & GEO WORKSPACE</span>
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} 
          style={{ fontSize: '60px', fontFamily: 'var(--font-heading)', margin: '0 0 24px 0', background: 'linear-gradient(to right, #fff, rgba(255,255,255,0.8))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.15, fontWeight: 800 }}
        >
          Get Found on Google & Recommended by AI Search Engines
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} 
          style={{ color: 'var(--text-secondary)', fontSize: '22px', maxWidth: '1050px', margin: '0 auto 40px auto', lineHeight: 1.6 }}
        >
          Improve your visibility across Google Search, ChatGPT, Gemini, AI Overviews, Perplexity, and future AI search platforms with continuous auditing, optimization, publishing, and performance tracking—all from one intelligent workspace.
        </motion.p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <GlowButton variant="glow" onClick={() => navigate('/dashboard')} style={{ fontSize: '17px', padding: '16px 36px' }}>
            Start Optimizing Your Website <ArrowRight size={18} />
          </GlowButton>
        </div>
      </div>

      {/* STREAMLINED WORKSPACE OVERVIEW */}
      <section style={{ marginBottom: '80px' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(0, 230, 118, 0.06) 0%, rgba(10, 10, 16, 0.98) 100%)',
          border: '1px solid rgba(0, 230, 118, 0.3)',
          borderRadius: '24px',
          padding: '44px 56px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
        }}>
          <h2 style={{ fontSize: '32px', fontFamily: 'var(--font-heading)', margin: '0 0 20px 0', color: '#fff', fontWeight: 800 }}>
            Complete Search & AI Answer Engine Optimization
          </h2>
          <p style={{ fontSize: '18.5px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, margin: '0 0 24px 0' }}>
            SEO & GEO is Raftra's AI-powered search optimization platform that helps brands improve their visibility on both traditional search engines and modern AI-powered search experiences. Instead of manually auditing your website, finding issues, writing content, publishing updates, and checking analytics across different tools, Raftra continuously monitors your website, identifies opportunities, generates improvements, and publishes approved changes directly to your connected CMS.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '17px', color: '#00E676', fontWeight: 600 }}>
            <CheckCircle2 size={22} color="#00E676" style={{ flexShrink: 0 }} /> 
            <span>Whether your goal is to rank higher on Google or appear more frequently in AI-generated answers, Raftra gives you one complete workspace to manage your entire search strategy.</span>
          </div>
        </div>
      </section>

      {/* SUPPORTED INTEGRATIONS SECTION */}
      <section style={{ marginBottom: '80px' }}>
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#00E676', letterSpacing: '0.12em', textTransform: 'uppercase' }}>INTEGRATIONS</span>
          <h2 style={{ fontSize: '38px', fontFamily: 'var(--font-heading)', marginTop: '8px', fontWeight: 800 }}>Supported Platforms & Analytics</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          {/* CMS & Analytics */}
          <div style={{ background: 'rgba(0,230,118,0.04)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: '20px', padding: '36px' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#00E676', letterSpacing: '0.08em', marginBottom: '16px' }}>✓ CONNECTED PLATFORMS & ANALYTICS</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[...supportedIntegrations.platforms, ...supportedIntegrations.analytics].map((plat, i) => (
                <li key={i} style={{ fontSize: '17px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CheckCircle2 size={20} color="#00E676" /> {plat}
                </li>
              ))}
            </ul>
          </div>

          {/* Coming Soon CMS */}
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

      {/* WHAT YOU CAN DO (6 CARDS GRID) */}
      <section style={{ marginBottom: '80px' }}>
        <div style={{ textAlign: 'center', marginBottom: '44px' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#7C75FF', letterSpacing: '0.12em', textTransform: 'uppercase' }}>CAPABILITIES</span>
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
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#00E676', letterSpacing: '0.12em', textTransform: 'uppercase' }}>WORKFLOW FLOW</span>
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
                  <span style={{ fontSize: '14px', fontWeight: 900, color: '#00E676', background: 'rgba(0,230,118,0.15)', padding: '6px 14px', borderRadius: '100px', letterSpacing: '0.08em' }}>
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

      {/* AI SEARCH VISIBILITY & CONTENT INTELLIGENCE */}
      <section style={{ marginBottom: '80px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '32px' }}>
        {/* AI Search Visibility */}
        <div style={{ padding: '40px', background: 'rgba(0,230,118,0.04)', border: '1px solid rgba(0,230,118,0.25)', borderRadius: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
            <Globe2 size={28} color="#00E676" />
            <h3 style={{ fontSize: '26px', fontWeight: 800, margin: 0 }}>AI Search Visibility (GEO)</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '17px', lineHeight: 1.6, marginBottom: '24px' }}>
            Monitor how your brand performs across AI-powered search experiences like ChatGPT, Gemini, and Perplexity.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {["ChatGPT Visibility", "Gemini Citations", "Google AI Overviews", "Brand Mentions", "Citation Opportunities", "AI Rec Frequency", "Prompt Performance", "Competitor AI Rank"].map((check, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15.5px', color: '#fff', fontWeight: 500 }}>
                <Check size={16} color="#00E676" /> {check}
              </div>
            ))}
          </div>
        </div>

        {/* Content Intelligence & Publishing */}
        <div style={{ padding: '40px', background: 'rgba(124,117,255,0.05)', border: '1px solid rgba(124,117,255,0.25)', borderRadius: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
            <FileText size={28} color="#7C75FF" />
            <h3 style={{ fontSize: '26px', fontWeight: 800, margin: 0 }}>Smart CMS Publishing</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '17px', lineHeight: 1.6, marginBottom: '24px' }}>
            Generate and publish high-quality content directly to your website in 1 click.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {["Blog Articles", "Landing Pages", "Product Pages", "FAQ Generation", "Comparison Pages", "Insert Schema", "Update Meta Titles", "Internal Link Mesh"].map((tool, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15.5px', color: '#fff', fontWeight: 500 }}>
                <Zap size={16} color="#7C75FF" /> {tool}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES INCLUDED LIST (STREAMLINED 2-COLUMN LIST) */}
      <section style={{ marginBottom: '80px', background: 'rgba(255,255,255,0.02)', borderRadius: '24px', padding: '48px 56px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ marginBottom: '32px' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#00E676', letterSpacing: '0.12em', textTransform: 'uppercase' }}>FULL INVENTORY</span>
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

      {/* REAL DASHBOARD SEO & GEO INTERACTIVE PREVIEW */}
      <section style={{ marginBottom: '80px', marginTop: '40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#00E676', letterSpacing: '0.12em', textTransform: 'uppercase' }}>INTERACTIVE DASHBOARD PREVIEW</span>
          <h2 style={{ fontSize: '38px', fontFamily: 'var(--font-heading)', marginTop: '8px', fontWeight: 800 }}>Explore SEO & GEO Workspace</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '17px' }}>Live website audit and AI search visibility UI inside Raftra AI.</p>
        </div>

        <div style={{ background: '#0a0a0d', borderRadius: '24px', border: '1px solid rgba(0,230,118,0.3)', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>
          
          {/* Top Dashboard Header Bar */}
          <div style={{ padding: '20px 32px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Search size={20} color="#00E676" />
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#fff' }}>SEO & GEO Workspace</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{ fontSize: '12px', background: 'rgba(0,230,118,0.12)', color: '#00E676', border: '1px solid rgba(0,230,118,0.3)', padding: '4px 12px', borderRadius: '100px', fontWeight: 700 }}>
                  ● WordPress Connected
                </span>
                <span style={{ fontSize: '12px', background: 'rgba(0,230,118,0.12)', color: '#00E676', border: '1px solid rgba(0,230,118,0.3)', padding: '4px 12px', borderRadius: '100px', fontWeight: 700 }}>
                  ● GSC & GA4 Synced
                </span>
              </div>
            </div>

            <div style={{ fontSize: '14px', color: '#00E676', fontWeight: 700 }}>
              Website Health: 91/100 | AI Visibility: 82%
            </div>
          </div>

          {/* AI Audit Action Bar */}
          <div style={{ padding: '18px 32px', background: 'rgba(0,230,118,0.06)', borderBottom: '1px solid rgba(0,230,118,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Bot size={22} color="#00E676" />
              <div>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#fff' }}>AI Audit Complete: 48 Optimization Opportunities & 3 Technical Fixes Found</span>
                <div style={{ fontSize: '12px', color: '#00E676' }}>Expected Organic Search Lift: +31% | 842 Pages Crawled</div>
              </div>
            </div>

            <button 
              onClick={() => setPublishing(!publishing)}
              style={{
                padding: '8px 18px',
                background: publishing ? '#00E676' : 'transparent',
                color: publishing ? '#000' : '#00E676',
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
              {publishing ? <CheckCircle2 size={16} /> : <Zap size={16} />}
              {publishing ? 'Fixes Published to CMS!' : 'Publish Approved Fixes to CMS'}
            </button>
          </div>

          {/* Interactive Audit Pipeline & Automated CMS Git PR Panel */}
          <div style={{ padding: '32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            
            {/* Live Audit Pipeline Stage Card */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={18} color="#00E676" />
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#fff' }}>Website Audit & GEO Pipeline</span>
                </div>
                <span style={{ fontSize: '11px', background: 'rgba(0,230,118,0.15)', color: '#00E676', padding: '2px 8px', borderRadius: '100px', fontWeight: 700 }}>STAGE 3 / 3</span>
              </div>

              {/* Pipeline Steps */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#00E676', fontWeight: 600 }}>
                  <CheckCircle2 size={16} /> 1. Crawl Domain (842 Pages Audited)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#00E676', fontWeight: 600 }}>
                  <CheckCircle2 size={16} /> 2. GEO & LLM Entity Schema Verification
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#7C75FF', fontWeight: 700 }}>
                  <Sparkles size={16} /> 3. CMS Site Changes & Auto-PR Ready
                </div>
              </div>

              <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '100px', overflow: 'hidden' }}>
                <div style={{ width: '100%', height: '100%', background: '#00E676' }}></div>
              </div>
            </div>

            {/* Git Pull Request & CMS Integration Pipeline */}
            <div style={{ background: 'linear-gradient(135deg, rgba(0,230,118,0.06) 0%, rgba(10,10,16,0.98) 100%)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Database size={18} color="#00E676" />
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#fff' }}>Automated CMS Pull Request #142</span>
                </div>
                <span style={{ fontSize: '11px', background: 'rgba(0,230,118,0.2)', color: '#00E676', padding: '2px 8px', borderRadius: '100px', fontWeight: 800 }}>CONNECTED</span>
              </div>

              <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace', background: 'rgba(0,0,0,0.5)', padding: '12px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ color: '#00E676' }}>+ Added 14 JSON-LD Schema Entities (Product & FAQ)</span>
                <span style={{ color: '#00E676' }}>+ Repaired Meta Titles & Canonicals on 8 URLs</span>
                <span style={{ color: '#7C75FF' }}>+ Injected GEO Entity Hooks for ChatGPT & Perplexity</span>
              </div>

              <button 
                onClick={() => setPublished(!published)}
                style={{
                  padding: '10px 16px',
                  background: published ? '#00E676' : 'linear-gradient(135deg, #00E676 0%, #00BFA5 100%)',
                  color: '#000',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {published ? <CheckCircle2 size={16} /> : <Zap size={16} />}
                {published ? 'Merged & Live on Domain!' : 'Merge Pull Request & Deploy to Site (1-Click)'}
              </button>
            </div>

          </div>

          <div style={{ padding: '32px', display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              onClick={() => navigate('/dashboard')}
              style={{ padding: '12px 24px', background: '#00E676', color: '#000', borderRadius: '10px', fontWeight: 800, fontSize: '14px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              Open SEO & GEO in Dashboard <ArrowRight size={16} />
            </button>
          </div>

        </div>
      </section>

      {/* FINAL CTA SECTION */}
      <section style={{ textAlign: 'center', padding: '72px 40px', background: 'linear-gradient(180deg, rgba(0,230,118,0.12), rgba(10,10,16,0.98))', borderRadius: '28px', border: '1px solid rgba(0,230,118,0.35)' }}>
        <h2 style={{ fontSize: '44px', fontFamily: 'var(--font-heading)', marginBottom: '18px', fontWeight: 800 }}>
          Turn Your Website Into Your Best Growth Channel
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '20px', maxWidth: '850px', margin: '0 auto 36px auto', lineHeight: 1.6 }}>
          Audit your website, generate optimized content, publish improvements, monitor rankings, and grow your visibility across Google and AI search—all from one intelligent platform.
        </p>
        <GlowButton variant="glow" onClick={() => navigate('/dashboard')} style={{ margin: '0 auto', fontSize: '17px', padding: '16px 40px' }}>
          Start Optimizing Your Website <ArrowRight size={20} />
        </GlowButton>
      </section>

    </div>
  );
};
