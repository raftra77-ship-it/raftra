import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Sparkles, Bot, CheckCircle2, Loader2, ArrowRight, Upload, Play, Image as ImageIcon, 
  Layers, Camera, Film, Sliders, Search, ShieldCheck, Wand2, ArrowUpRight, Cpu, 
  BarChart2, Zap, Check, Eye, Lock, ChevronRight
} from 'lucide-react';
import { GlowButton } from '../../components/GlowButton';
import { FeatureExplainerVideo } from '../../components/FeatureExplainerVideo';
import { useNavigate } from 'react-router-dom';

export const FeatureCreativeStudio = () => {
  const navigate = useNavigate();
  const [demoState, setDemoState] = useState(0);

  useEffect(() => {
    if (demoState === 1) {
      const timer = setTimeout(() => setDemoState(2), 3000);
      return () => clearTimeout(timer);
    }
  }, [demoState]);

  const creativeExplainerSteps = [
    {
      title: "1. Product-to-Ad Carousel & Banner Rendering",
      agent: "Brand Identity Agent",
      description: "Automatically turns product images and brand guidelines into 5-slide interactive carousel ads and high-converting static banners.",
      badge: "CAROUSEL BUILT",
      visualType: "carousel" as const,
      metrics: [
        { label: "Carousel Slides", value: "5 Slides", color: "#5A52FF" },
        { label: "Product Synced", value: "Verified", color: "#00E676" },
        { label: "Tone Match", value: "98%", color: "#FFBD2E" }
      ]
    },
    {
      title: "2. AI UGC Video Presenter Generation",
      agent: "Copywriting & Video Agent",
      description: "Synthesizes realistic AI UGC presenter videos, audio waveforms, captions, and 15s video scripts tailored to product features.",
      badge: "UGC RENDERED",
      visualType: "ugc_video" as const,
      metrics: [
        { label: "Video Length", value: "15s UGC", color: "#00E676" },
        { label: "Audio Waveform", value: "Synced", color: "#5A52FF" },
        { label: "UGC Presenter", value: "Active", color: "#fff" }
      ]
    },
    {
      title: "3. Multi-Format Aspect Ratio Fitting",
      agent: "Publishing Preparation Agent",
      description: "Automatically formats creatives into 9:16 Vertical (Reels/Shorts), 1:1 Square (Feed), and 16:9 Landscape for launch.",
      badge: "APPROVED FOR LAUNCH",
      visualType: "carousel" as const,
      metrics: [
        { label: "Aspect Ratios", value: "9:16, 1:1, 16:9", color: "#00E676" },
        { label: "Ad Library Sync", value: "Instant", color: "#5A52FF" }
      ]
    }
  ];

  const whatYouCanCreate = [
    {
      title: "Image Advertisements",
      desc: "Generate static advertisements optimized for Meta, Google Display, LinkedIn, Pinterest and more.",
      icon: <ImageIcon size={28} color="#7C75FF" />
    },
    {
      title: "Product Photography",
      desc: "Transform raw product images into premium studio-quality product shots with custom backgrounds, lighting and branding.",
      icon: <Camera size={28} color="#00E676" />
    },
    {
      title: "Carousel Ads",
      desc: "Create complete multi-card carousel advertisements with AI-generated headlines, descriptions and layouts.",
      icon: <Layers size={28} color="#FFB300" />
    },
    {
      title: "Video Advertisements",
      desc: "Generate short-form promotional videos optimized for paid advertising and social media campaigns.",
      icon: <Film size={28} color="#FF5296" />
    },
    {
      title: "AI Image Editing",
      desc: "Edit any creative using built-in AI editing tools instead of opening Photoshop or Canva.",
      icon: <Wand2 size={28} color="#00D2FF" />
    },
    {
      title: "Competitor Ad Library",
      desc: "Discover recently running advertisements from competitors, understand creative trends and get inspiration before launching campaigns.",
      icon: <Search size={28} color="#A855F7" />
    }
  ];

  const featuresIncluded = [
    "AI Image Generation", "Product Photography", "Carousel Ad Generator", "AI Video Generation",
    "AI Image Editor", "Background Removal", "Object Removal", "Image Upscaling",
    "Resize & Expand", "Brand Kit Integration", "Competitor Ad Library", "Creative Performance Insights",
    "AI UGC (Coming Soon)"
  ];

  const howItWorksFlow = [
    { step: "01", title: "Connect Brand & Product", desc: "Raftra extracts brand colors, logos & tone." },
    { step: "02", title: "Select Creative Format", desc: "Image Ad, Product Photo, Carousel, or Video." },
    { step: "03", title: "Customize & Edit", desc: "Edit copy, replace backgrounds, expand canvas." },
    { step: "04", title: "Analyze Competitors", desc: "Inspect recent ads & winning formats." },
    { step: "05", title: "AI Review & Compliance", desc: "Verify brand alignment, CTA & readability." },
    { step: "06", title: "Publish to Campaigns", desc: "Instant deployment via Campaign Manager." }
  ];

  return (
    <div style={{ animation: 'fadeIn 0.5s ease', color: '#fff' }}>
      
      {/* HERO SECTION */}
      <div style={{ textAlign: 'center', marginBottom: '64px' }}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }} 
          animate={{ opacity: 1, scale: 1 }} 
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 24px', background: 'rgba(124,117,255,0.12)', borderRadius: '100px', border: '1px solid rgba(124,117,255,0.3)', marginBottom: '24px' }}
        >
          <Sparkles size={18} color="#7C75FF" />
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#7C75FF', letterSpacing: '0.06em', textTransform: 'uppercase' }}>AI CREATIVE STUDIO</span>
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} 
          style={{ fontSize: '60px', fontFamily: 'var(--font-heading)', margin: '0 0 24px 0', background: 'linear-gradient(to right, #fff, rgba(255,255,255,0.8))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.15, fontWeight: 800 }}
        >
          Create High-Converting Ads in Minutes — Not Days
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} 
          style={{ color: 'var(--text-secondary)', fontSize: '22px', maxWidth: '1050px', margin: '0 auto 40px auto', lineHeight: 1.6 }}
        >
          From a single product image or a simple idea, Raftra generates production-ready creatives for every major advertising platform. Design, edit, analyze competitors, and launch better-performing ads without switching between multiple tools.
        </motion.p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <GlowButton variant="glow" onClick={() => navigate('/dashboard')} style={{ fontSize: '17px', padding: '16px 36px' }}>
            Start Creating <ArrowRight size={18} />
          </GlowButton>
        </div>
      </div>

      {/* STREAMLINED WORKSPACE OVERVIEW */}
      <section style={{ marginBottom: '80px' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(20, 20, 32, 0.9), rgba(10, 10, 16, 0.98))',
          border: '1px solid rgba(124, 117, 255, 0.3)',
          borderRadius: '24px',
          padding: '44px 56px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
        }}>
          <h2 style={{ fontSize: '32px', fontFamily: 'var(--font-heading)', margin: '0 0 20px 0', color: '#fff', fontWeight: 800 }}>
            Complete Advertising Workspace
          </h2>
          <p style={{ fontSize: '18.5px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, margin: '0 0 24px 0' }}>
            AI Creative Studio is your complete advertising workspace built for marketers, brands, founders, and agencies. Whether you're launching a new product or scaling an existing campaign, Raftra helps you create professional ad creatives using AI while keeping full creative control through its built-in editor.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '17px', color: '#00E676', fontWeight: 600 }}>
            <CheckCircle2 size={22} color="#00E676" style={{ flexShrink: 0 }} /> 
            <span>Instead of using multiple tools for designing, editing, product photography, competitor research, and creative inspiration, everything happens inside one workspace.</span>
          </div>
        </div>
      </section>

      {/* WHAT YOU CAN CREATE (CLEAN 6-CARD GRID WITH LARGER TEXT) */}
      <section style={{ marginBottom: '80px' }}>
        <div style={{ textAlign: 'center', marginBottom: '44px' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#00E676', letterSpacing: '0.12em', textTransform: 'uppercase' }}>CREATIVE FORMATS</span>
          <h2 style={{ fontSize: '42px', fontFamily: 'var(--font-heading)', marginTop: '8px', fontWeight: 800 }}>What You Can Create</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '28px' }}>
          {whatYouCanCreate.map((item, idx) => (
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

      {/* HOW IT WORKS: CONNECTED ARROW STEPPER (REPLACES CLUTTERED BOXES) */}
      <section style={{ marginBottom: '80px' }}>
        <div style={{ textAlign: 'center', marginBottom: '44px' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#7C75FF', letterSpacing: '0.12em', textTransform: 'uppercase' }}>STEP-BY-STEP FLOW</span>
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
                  <span style={{ fontSize: '14px', fontWeight: 900, color: '#7C75FF', background: 'rgba(124,117,255,0.15)', padding: '6px 14px', borderRadius: '100px', letterSpacing: '0.08em' }}>
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

      {/* STREAMLINED CREATIVE INTELLIGENCE & EDITOR SUITE (LARGE TEXT) */}
      <section style={{ marginBottom: '80px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '32px' }}>
        {/* Creative Intelligence */}
        <div style={{ padding: '40px', background: 'rgba(0,230,118,0.04)', border: '1px solid rgba(0,230,118,0.25)', borderRadius: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
            <ShieldCheck size={28} color="#00E676" />
            <h3 style={{ fontSize: '26px', fontWeight: 800, margin: 0 }}>Creative Intelligence</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '17px', lineHeight: 1.6, marginBottom: '24px' }}>
            Every generated creative is automatically reviewed by AI before publishing to ensure high performance.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {["Brand Consistency", "Text Readability", "Product Visibility", "CTA Strength", "Visual Balance", "Platform Compatibility", "Ad Policy Warnings", "Suggested Improvements"].map((check, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15.5px', color: '#fff', fontWeight: 500 }}>
                <Check size={16} color="#00E676" /> {check}
              </div>
            ))}
          </div>
        </div>

        {/* Built-in Editor */}
        <div style={{ padding: '40px', background: 'rgba(124,117,255,0.05)', border: '1px solid rgba(124,117,255,0.25)', borderRadius: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
            <Wand2 size={28} color="#7C75FF" />
            <h3 style={{ fontSize: '26px', fontWeight: 800, margin: 0 }}>Creative Editor Suite</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '17px', lineHeight: 1.6, marginBottom: '24px' }}>
            Edit everything without leaving Raftra. No external design software needed.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {["Move Elements", "Replace Background", "Remove Objects", "AI Expand Canvas", "Magic Resize", "Product Enhancement", "Color Adjustments", "Add Branding"].map((tool, i) => (
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
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#7C75FF', letterSpacing: '0.12em', textTransform: 'uppercase' }}>FEATURE CHECKLIST</span>
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

      {/* MOTION DESIGN EXPLAINER DEMO */}
      <FeatureExplainerVideo
        title="AI Creative Studio Engine"
        subtitle="How Raftra AI generates videos, UGC presenters, carousel banners, and ad hooks automatically."
        badgeText="INTERACTIVE MOTION DEMO"
        steps={creativeExplainerSteps}
        ctaText="Unlock Creative Engine"
      />

      {/* REAL DASHBOARD CREATIVE STUDIO INTERACTIVE PREVIEW */}
      <section style={{ marginBottom: '80px', marginTop: '40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#7C75FF', letterSpacing: '0.12em', textTransform: 'uppercase' }}>INTERACTIVE WORKSPACE DEMO</span>
          <h2 style={{ fontSize: '38px', fontFamily: 'var(--font-heading)', marginTop: '8px', fontWeight: 800 }}>Explore Creative Studio Dashboard</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '17px' }}>Simulated real-time workspace UI inside Raftra AI.</p>
        </div>

        <div style={{ background: '#0a0a0d', borderRadius: '24px', border: '1px solid rgba(124,117,255,0.3)', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>
          
          {/* Top Dashboard Header Bar */}
          <div style={{ padding: '16px 28px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="#7C75FF" />
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#fff' }}>Creative Studio</span>
              </div>
              <span style={{ fontSize: '12px', background: 'rgba(0,230,118,0.12)', color: '#00E676', border: '1px solid rgba(0,230,118,0.3)', padding: '3px 10px', borderRadius: '100px', fontWeight: 700 }}>
                ● Active Brand: Ambrane
              </span>
            </div>

            {/* Sub-tabs */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {["Image Ads", "Product Photography", "Carousel Builder", "AI Video", "Ad Library"].map((tab, i) => (
                <button 
                  key={i} 
                  style={{
                    background: i === 0 ? 'rgba(124,117,255,0.2)' : 'transparent',
                    border: i === 0 ? '1px solid rgba(124,117,255,0.5)' : '1px solid transparent',
                    color: i === 0 ? '#fff' : '#888',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div style={{ fontSize: '13px', color: '#FFB300', fontWeight: 700, background: 'rgba(255,179,0,0.1)', padding: '6px 14px', borderRadius: '100px', border: '1px solid rgba(255,179,0,0.25)' }}>
              ⚡ 15,000 AI Credits Available
            </div>
          </div>

          {/* Main Dashboard Control & Preview Panel */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '0' }}>
            
            {/* Left Control Panel */}
            <div style={{ padding: '32px', borderRight: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#aaa', fontWeight: 600, marginBottom: '8px' }}>Product URL or Brand Assets</label>
                <input 
                  type="text" 
                  readOnly 
                  value="https://ambrane.com/products/powerbank-20000mah" 
                  style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: '#fff', fontSize: '14px', fontFamily: 'monospace' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#aaa', fontWeight: 600, marginBottom: '8px' }}>Campaign Goal & Audience</label>
                <select style={{ width: '100%', padding: '12px 16px', background: 'rgba(20,20,30,0.9)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '100px', color: '#fff', fontSize: '14px' }}>
                  <option>Direct Sales — High Intent Buyers (Meta + Google)</option>
                  <option>Brand Awareness — Gen-Z Short Form Video</option>
                  <option>Retargeting — Flat 30% Off Carousel</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#aaa', fontWeight: 600, marginBottom: '8px' }}>Select Creative Style</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {["Studio Clean", "Bold Cyber", "Minimal Black", "UGC Video"].map((style, i) => (
                    <span key={i} style={{ fontSize: '12px', background: i === 0 ? 'rgba(0,230,118,0.15)' : 'rgba(255,255,255,0.05)', border: i === 0 ? '1px solid #00E676' : '1px solid rgba(255,255,255,0.1)', color: i === 0 ? '#00E676' : '#ccc', padding: '6px 12px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
                      {style}
                    </span>
                  ))}
                </div>
              </div>

              <button 
                onClick={() => setDemoState(demoState === 2 ? 0 : 1)}
                style={{
                  marginTop: '12px',
                  padding: '14px 24px',
                  background: 'linear-gradient(135deg, #7C75FF 0%, #5A52FF 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  boxShadow: '0 8px 24px rgba(124,117,255,0.4)'
                }}
              >
                {demoState === 1 ? <Loader2 size={18} className="spin" /> : <Sparkles size={18} />}
                {demoState === 1 ? 'Generating Production Assets...' : '✨ Generate Ad Creatives (3 Credits)'}
              </button>
            </div>

            {/* Right Output Grid (Real Ad Cards) */}
            <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px', background: 'rgba(0,0,0,0.5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>Generated Campaign Assets</span>
                <span style={{ fontSize: '12px', color: '#00E676', fontWeight: 600 }}>✓ 94% Predicted ROAS Score</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                
                {/* Generated Card 1 */}
                <div style={{ background: 'linear-gradient(135deg, #181824 0%, #0d0d14 100%)', border: '1px solid rgba(124,117,255,0.3)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ height: '140px', background: 'linear-gradient(to bottom right, #2a0845, #6441A5)', borderRadius: '10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '12px', color: '#fff' }}>
                    <span style={{ fontSize: '10px', background: '#00E676', color: '#000', padding: '2px 8px', borderRadius: '100px', fontWeight: 800, alignSelf: 'flex-start' }}>FLAT 30% OFF</span>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 900, lineHeight: 1.2 }}>Charge Anything Anywhere</div>
                      <div style={{ fontSize: '10px', opacity: 0.8 }}>20,000mAh Powerbank</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                    <span style={{ color: '#aaa' }}>Meta Feed (1:1)</span>
                    <span style={{ color: '#00E676', fontWeight: 700 }}>Ready</span>
                  </div>
                </div>

                {/* Generated Card 2 */}
                <div style={{ background: 'linear-gradient(135deg, #181824 0%, #0d0d14 100%)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ height: '140px', background: 'linear-gradient(to bottom right, #004d40, #00bfa5)', borderRadius: '10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '12px', color: '#fff' }}>
                    <span style={{ fontSize: '10px', background: '#FFB300', color: '#000', padding: '2px 8px', borderRadius: '100px', fontWeight: 800, alignSelf: 'flex-start' }}>CAROUSEL #1</span>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 900, lineHeight: 1.2 }}>Ultra Fast 65W PD</div>
                      <div style={{ fontSize: '10px', opacity: 0.9 }}>Slide 1 of 5</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                    <span style={{ color: '#aaa' }}>Carousel Ad</span>
                    <span style={{ color: '#00E676', fontWeight: 700 }}>Ready</span>
                  </div>
                </div>

              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button 
                  onClick={() => navigate('/dashboard')} 
                  style={{ padding: '10px 20px', background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.4)', color: '#00E676', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  Send Selected Assets to Campaign Manager <ArrowRight size={14} />
                </button>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* FINAL CTA SECTION */}
      <section style={{ textAlign: 'center', padding: '72px 40px', background: 'linear-gradient(180deg, rgba(90,82,255,0.12), rgba(10,10,16,0.98))', borderRadius: '28px', border: '1px solid rgba(90,82,255,0.35)' }}>
        <h2 style={{ fontSize: '44px', fontFamily: 'var(--font-heading)', marginBottom: '18px', fontWeight: 800 }}>
          Ready to Build Your Next Winning Campaign?
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '20px', maxWidth: '850px', margin: '0 auto 36px auto', lineHeight: 1.6 }}>
          Generate production-ready creatives, analyze competitors, edit with AI and publish directly to your advertising campaigns—all from one creative workspace.
        </p>
        <GlowButton variant="glow" onClick={() => navigate('/dashboard')} style={{ margin: '0 auto', fontSize: '17px', padding: '16px 40px' }}>
          Start Creating <ArrowRight size={20} />
        </GlowButton>
      </section>

    </div>
  );
};
