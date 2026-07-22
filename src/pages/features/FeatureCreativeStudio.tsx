import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Bot, CheckCircle2, Loader2, ArrowRight, Upload, Play, Image as ImageIcon } from 'lucide-react';
import { GlowButton } from '../../components/GlowButton';
import { FeatureExplainerVideo } from '../../components/FeatureExplainerVideo';

export const FeatureCreativeStudio = () => {
  const [demoState, setDemoState] = useState(0); // 0: init, 1: generating, 2: complete

  useEffect(() => {
    if (demoState === 1) {
      const timer = setTimeout(() => setDemoState(2), 3000);
      return () => clearTimeout(timer);
    }
  }, [demoState]);

  const creativeExplainerSteps = [
    {
      title: "1. Product-to-Ad Carousel & Banner Rendering",
      agent: "Brand Intelligence Agent",
      description: "Automatically turns product images and brand URL into 5-slide interactive carousel ads and high-converting static banners.",
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
      agent: "Video & Copywriting Agent",
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
      agent: "Quality Review Agent",
      description: "Automatically formats creatives into 9:16 Vertical (Instagram Reels/TikTok), 1:1 Square (Feed), and 16:9 Landscape for launch.",
      badge: "APPROVED FOR LAUNCH",
      visualType: "carousel" as const,
      metrics: [
        { label: "Aspect Ratios", value: "9:16, 1:1, 16:9", color: "#00E676" },
        { label: "Ad Library Sync", value: "Instant", color: "#5A52FF" }
      ]
    }
  ];

  return (
    <div style={{ animation: 'fadeIn 0.5s ease' }}>
      
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '64px' }}>
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'rgba(90,82,255,0.1)', borderRadius: '100px', border: '1px solid rgba(90,82,255,0.2)', marginBottom: '24px' }}>
          <Sparkles size={16} color="var(--primary)" />
          <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--primary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Creative Engine</span>
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{ fontSize: '48px', fontFamily: 'var(--font-heading)', margin: '0 0 24px 0', background: 'linear-gradient(to right, #fff, rgba(255,255,255,0.7))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.1 }}>
          AI Creative Studio
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ color: 'var(--text-secondary)', fontSize: '20px', maxWidth: '800px', margin: '0 auto', lineHeight: 1.6 }}>
          Creates high-converting ads, videos, hooks, headlines, voiceovers, and campaign creatives from your website, logo, product images, and brand assets.
        </motion.p>
      </div>

      {/* Info Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px', marginBottom: '64px' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glow-card" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: 'var(--primary)' }}><Bot size={20} /> AI Agents Used</h3>
            <span style={{ background: 'rgba(90,82,255,0.2)', color: 'var(--primary)', padding: '4px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: 'bold' }}>7 AGENTS</span>
          </div>
          <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', color: '#ccc' }}>
            {["Brand Intelligence Agent", "Competitor Analysis Agent", "Creative Strategy Agent", "Copywriting Agent", "Image Generation Agent", "Video Generation Agent", "Quality Review Agent"].map((agent, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px' }}><CheckCircle2 size={16} color="var(--primary)" /> {agent}</li>
            ))}
          </ul>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glow-card" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: 'var(--accent)' }}>How it works</h3>
            <span style={{ background: 'rgba(255,82,150,0.2)', color: 'var(--accent)', padding: '4px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: 'bold' }}>AUTOMATED</span>
          </div>
          <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', color: '#ccc' }}>
            {["Analyze your brand and products", "Study competitor ads and winning creatives", "Identify audience pain points and emotions", "Generate hooks, headlines, and CTAs", "Create static or motion creatives", "Add voiceover and background music", "Send for human approval"].map((step, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', fontSize: '14px' }}>
                <span style={{ background: 'rgba(255,255,255,0.1)', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontSize: '10px', flexShrink: 0, marginTop: '2px' }}>{i + 1}</span> 
                {step}
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glow-card" style={{ padding: '32px', background: 'rgba(90,82,255,0.05)' }}>
          <h3 style={{ fontSize: '20px', marginBottom: '16px', color: '#fff' }}>How it improves results</h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px', fontSize: '15px' }}>
            Reduces creative production time and helps generate ads based on real competitor data and audience psychology.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {["Better hooks", "Faster launches", "Higher conversion potential"].map((tag, i) => (
              <span key={i} style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '100px', fontSize: '13px', color: '#fff' }}>{tag}</span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Motion Design Explainer Video */}
      <FeatureExplainerVideo
        title="AI Creative Studio Engine"
        subtitle="How Raftra AI generates videos, UGC presenters, carousel banners, and ad hooks automatically."
        badgeText="CREATIVE MOTION DEMO"
        steps={creativeExplainerSteps}
        ctaText="Unlock Creative Engine"
      />

      {/* Interactive Visual Demo */}
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} style={{ background: '#0a0a0a', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
        <div style={{ padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>Visual Demo <span style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 'normal' }}>| See AI build an ad from your brand</span></h3>
          </div>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#888' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 10px var(--success)' }}></span> AI Live
          </span>
        </div>
        
        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
          {/* Left Panel: Input & Progress */}
          <div style={{ flex: '1', minWidth: '300px', padding: '32px', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
            
            {demoState === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <div style={{ width: '64px', height: '64px', background: 'rgba(90,82,255,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                  <Upload size={24} color="var(--primary)" />
                </div>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>Upload Assets</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '32px' }}>Website URL, logo & product images</p>
                <GlowButton variant="glow" onClick={() => setDemoState(1)}>
                  <Sparkles size={16} /> Generate Creatives
                </GlowButton>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <span style={{ fontSize: '14px', color: '#ccc' }}>AI agents working...</span>
                  <span style={{ fontSize: '12px', color: 'var(--primary)', fontFamily: 'monospace' }}>72 sec</span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Agent 1 */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
                      <span style={{ color: '#fff' }}>Brand Agent</span>
                      <span style={{ color: 'var(--success)' }}>Completed</span>
                    </div>
                    <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: '100%', height: '100%', background: 'var(--success)' }}></div>
                    </div>
                  </div>
                  
                  {/* Agent 2 */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
                      <span style={{ color: '#fff' }}>Competitor Agent</span>
                      <span style={{ color: 'var(--success)' }}>Completed</span>
                    </div>
                    <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: '100%', height: '100%', background: 'var(--success)' }}></div>
                    </div>
                  </div>

                  {/* Agent 3 */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
                      <span style={{ color: '#fff' }}>Creative Strategy Agent</span>
                      {demoState === 1 ? (
                        <span style={{ color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '4px' }}><Loader2 size={12} className="spin" /> Generating...</span>
                      ) : (
                        <span style={{ color: 'var(--success)' }}>Completed</span>
                      )}
                    </div>
                    <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                      <motion.div initial={{ width: '0%' }} animate={{ width: demoState === 1 ? '60%' : '100%' }} transition={{ duration: demoState === 1 ? 2 : 0.5 }} style={{ height: '100%', background: demoState === 1 ? 'var(--warning)' : 'var(--success)' }}></motion.div>
                    </div>
                  </div>

                  {/* Agent 4 */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
                      <span style={{ color: '#fff' }}>Video Agent</span>
                      {demoState === 1 ? (
                        <span style={{ color: 'var(--text-muted)' }}>Queued</span>
                      ) : (
                        <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}><Loader2 size={12} className="spin" /> Rendering...</span>
                      )}
                    </div>
                    <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                      <motion.div initial={{ width: '0%' }} animate={{ width: demoState === 2 ? '30%' : '0%' }} style={{ height: '100%', background: 'var(--primary)' }}></motion.div>
                    </div>
                  </div>
                </div>

                {demoState === 2 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: '32px', padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                    <p style={{ margin: 0, fontSize: '13px', color: '#ccc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={16} color="var(--success)" /> 3 ad concepts + video + copy generated
                    </p>
                  </motion.div>
                )}
              </div>
            )}
          </div>

          {/* Right Panel: Before / After */}
          <div style={{ flex: '1.5', minWidth: '400px', padding: '32px', background: '#000' }}>
            <h4 style={{ margin: '0 0 24px 0', fontSize: '16px', color: '#888' }}>Result Preview</h4>
            
            <div style={{ display: 'flex', gap: '24px' }}>
              <div style={{ flex: 1 }}>
                <span style={{ display: 'block', marginBottom: '12px', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '1px' }}>Before (Original)</span>
                <div style={{ aspectRatio: '4/5', background: '#111', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.2)' }}>
                  <ImageIcon size={32} color="#444" style={{ marginBottom: '16px' }} />
                  <span style={{ fontSize: '14px', color: '#666' }}>Plain product image with no marketing context.</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center' }}>
                <ArrowRight size={24} color="var(--text-muted)" />
              </div>

              <div style={{ flex: 1 }}>
                <span style={{ display: 'block', marginBottom: '12px', fontSize: '12px', textTransform: 'uppercase', color: 'var(--primary)', fontWeight: 'bold', letterSpacing: '1px' }}>After (AI Optimized)</span>
                <div style={{ position: 'relative', aspectRatio: '4/5', background: 'linear-gradient(to bottom right, #2a0845, #6441A5)', borderRadius: '12px', display: 'flex', flexDirection: 'column', padding: '24px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(90,82,255,0.2)' }}>
                  {demoState === 0 ? (
                    <div style={{ margin: 'auto', textAlign: 'center' }}>
                      <Loader2 size={24} color="rgba(255,255,255,0.2)" />
                      <p style={{ fontSize: '12px', color: '#888', marginTop: '12px' }}>Waiting for generation...</p>
                    </div>
                  ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 1 }} style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                      <h3 style={{ fontSize: '24px', margin: 0, fontWeight: 900, textTransform: 'uppercase', lineHeight: 1.1 }}>Stop Wasting<br/>Ad Spend</h3>
                      <div style={{ alignSelf: 'center', width: '100px', height: '100px', background: 'rgba(255,255,255,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
                         <Play size={32} color="#fff" style={{ marginLeft: '4px' }} />
                      </div>
                      <div>
                        <div style={{ background: '#fff', color: '#000', padding: '12px', borderRadius: '8px', textAlign: 'center', fontWeight: 'bold', fontSize: '14px', marginBottom: '8px' }}>
                          Unlock Growth Now
                        </div>
                        <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', margin: 0, textAlign: 'center' }}>AI adds headline, CTA, layout, and brand colors automatically.</p>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </motion.div>

    </div>
  );
};
