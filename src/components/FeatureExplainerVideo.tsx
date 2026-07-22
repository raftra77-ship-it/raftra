import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Cpu,
  Zap,
  ArrowRight,
  CheckCircle,
  ShieldCheck,
  Globe,
  Sliders,
  BarChart3,
  Video,
  Image as ImageIcon,
  Users2,
  Share2,
  Lock,
  Search,
  Bot,
  Key,
  ShieldAlert,
  MessageSquare
} from 'lucide-react';
import { GlowButton } from './GlowButton';

export interface ExplainerStep {
  title: string;
  agent: string;
  description: string;
  badge?: string;
  metrics?: { label: string; value: string; color?: string }[];
  codeSnippet?: string;
  visualType?: 'carousel' | 'ugc_video' | 'oauth_campaign' | 'seo_pipeline' | 'analytics_chart' | 'social_calendar' | 'influencer_escrow' | 'general';
}

interface FeatureExplainerVideoProps {
  title: string;
  subtitle: string;
  badgeText?: string;
  steps: ExplainerStep[];
  onCTA?: () => void;
  ctaText?: string;
}

export const FeatureExplainerVideo: React.FC<FeatureExplainerVideoProps> = ({
  title,
  subtitle,
  badgeText = "AI MOTION DEMO",
  steps,
  onCTA,
  ctaText = "Start Free Trial"
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [carouselSlide, setCarouselSlide] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            setActiveStep((stepPrev) => (stepPrev + 1) % steps.length);
            return 0;
          }
          return prev + 2.5; // ~4 seconds per step
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, steps.length]);

  // Carousel auto-slide timer
  useEffect(() => {
    const slideTimer = setInterval(() => {
      setCarouselSlide((prev) => (prev + 1) % 3);
    }, 2000);
    return () => clearInterval(slideTimer);
  }, []);

  const currentStep = steps[activeStep] || steps[0];

  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(15, 15, 22, 0.95), rgba(8, 8, 12, 0.98))',
      borderRadius: '24px',
      border: '1px solid rgba(255, 255, 255, 0.12)',
      boxShadow: '0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)',
      overflow: 'hidden',
      marginBottom: '56px',
      position: 'relative'
    }}>
      {/* Top Window Bar */}
      <div style={{
        padding: '16px 28px',
        background: 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#FF5F56' }} />
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#FFBD2E' }} />
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#27C93F' }} />
          </div>
          <span style={{
            fontSize: '12px',
            fontWeight: 700,
            color: 'var(--primary)',
            background: 'rgba(90,82,255,0.15)',
            padding: '4px 10px',
            borderRadius: '100px',
            border: '1px solid rgba(90,82,255,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Sparkles size={12} /> {badgeText}
          </span>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
            {title} — Visual AI Motion Walkthrough
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            {isPlaying ? 'Pause Motion' : 'Play Motion'}
          </button>
          <button
            onClick={() => { setActiveStep(0); setProgress(0); }}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--text-secondary)',
              padding: '6px 10px',
              borderRadius: '8px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
            title="Restart Demo"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Main Motion Screen Area */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', minHeight: '460px' }}>
        
        {/* Left Side: Rich Visual Interactive Graphic Canvas */}
        <div style={{
          padding: '32px',
          background: '#060609',
          borderRight: '1px solid rgba(255,255,255,0.08)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflow: 'hidden'
        }}>
          {/* Ambient Motion Background Glow */}
          <div style={{
            position: 'absolute',
            top: '-20%',
            left: '-20%',
            width: '300px',
            height: '300px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(90,82,255,0.2) 0%, rgba(0,0,0,0) 70%)',
            pointerEvents: 'none',
            filter: 'blur(40px)'
          }} />

          {/* Header Agent Badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 2, marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(90,82,255,0.2)',
                border: '1px solid var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff'
              }}>
                <Cpu size={18} />
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: 700, letterSpacing: '0.08em' }}>ACTIVE AGENT WORKER</div>
                <div style={{ fontSize: '15px', color: '#fff', fontWeight: 700 }}>{currentStep.agent}</div>
              </div>
            </div>
            {currentStep.badge && (
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#00E676',
                background: 'rgba(0,230,118,0.1)',
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid rgba(0,230,118,0.3)'
              }}>
                {currentStep.badge}
              </span>
            )}
          </div>

          {/* Dynamic Visual Mockup Component Canvas */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.04, y: -10 }}
              transition={{ duration: 0.35 }}
              style={{ zIndex: 2, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
            >
              {/* VISUAL MOCKUP TYPE 1: SEO & GEO PIPELINE */}
              {(currentStep.visualType === 'seo_pipeline' || activeStep === 0 && title.includes("SEO")) && (
                <div style={{
                  background: 'rgba(18, 18, 28, 0.9)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '16px',
                  padding: '20px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Zap size={14} color="var(--primary)" /> LIVE SEO & GEO PIPELINE FLOW
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <div style={{ padding: '12px', background: 'rgba(90,82,255,0.15)', borderRadius: '10px', border: '1px solid rgba(90,82,255,0.3)', flex: 1, textAlign: 'center' }}>
                      <Search size={18} color="var(--primary)" style={{ margin: '0 auto 4px' }} />
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>Crawler Agent</div>
                      <div style={{ fontSize: '10px', color: '#00E676' }}>14 URLs Scanned</div>
                    </div>
                    <ArrowRight size={14} color="var(--text-muted)" />
                    <div style={{ padding: '12px', background: 'rgba(0,230,118,0.15)', borderRadius: '10px', border: '1px solid rgba(0,230,118,0.3)', flex: 1, textAlign: 'center' }}>
                      <Bot size={18} color="#00E676" style={{ margin: '0 auto 4px' }} />
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>Entity JSON-LD</div>
                      <div style={{ fontSize: '10px', color: '#00E676' }}>8 Schemas Fixed</div>
                    </div>
                    <ArrowRight size={14} color="var(--text-muted)" />
                    <div style={{ padding: '12px', background: 'rgba(255,189,46,0.15)', borderRadius: '10px', border: '1px solid rgba(255,189,46,0.3)', flex: 1, textAlign: 'center' }}>
                      <Globe size={18} color="#FFBD2E" style={{ margin: '0 auto 4px' }} />
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>AI Citations</div>
                      <div style={{ fontSize: '10px', color: '#FFBD2E' }}>Perplexity #1 Rank</div>
                    </div>
                  </div>
                </div>
              )}

              {/* VISUAL MOCKUP TYPE 2: AD CREATIVE STUDIO (Carousel / UGC Video) */}
              {(currentStep.visualType === 'ugc_video' || currentStep.visualType === 'carousel' || title.includes("Creative") || title.includes("Studio")) && (
                <div style={{
                  background: 'rgba(18, 18, 28, 0.9)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '16px',
                  padding: '20px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                  display: 'flex',
                  gap: '16px',
                  alignItems: 'center'
                }}>
                  {/* UGC AI Presenter Preview */}
                  <div style={{
                    width: '130px',
                    height: '180px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #2a0845, #6441A5)',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    justify: 'space-between',
                    padding: '10px',
                    border: '1px solid rgba(255,255,255,0.2)'
                  }}>
                    <span style={{ fontSize: '9px', background: 'rgba(0,0,0,0.6)', color: '#00E676', padding: '2px 6px', borderRadius: '4px', alignSelf: 'flex-start' }}>
                      AI UGC Presenter
                    </span>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', margin: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Play size={18} color="#fff" />
                    </div>
                    <div style={{ fontSize: '9px', color: '#fff', fontWeight: 700, textAlign: 'center' }}>
                      "Stop Wasting Ad Spend!"
                    </div>
                  </div>

                  {/* Carousel Slide Cards */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 700 }}>5-SLIDE CAROUSEL AD PREVIEW</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Slide {carouselSlide + 1} of 3</span>
                    </div>
                    <div style={{
                      padding: '14px',
                      background: 'rgba(255,255,255,0.04)',
                      borderRadius: '10px',
                      border: '1px solid rgba(255,255,255,0.08)'
                    }}>
                      {carouselSlide === 0 && (
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>Slide 1: Problem Agitation</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>"Managing 10 ad tools manually? Here's the fix."</div>
                        </div>
                      )}
                      {carouselSlide === 1 && (
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>Slide 2: AI Solution</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>"Raftra AI deploys videos, SEO & ads from 1 hub."</div>
                        </div>
                      )}
                      {carouselSlide === 2 && (
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>Slide 3: Verified Proof</div>
                          <div style={{ fontSize: '11px', color: '#00E676' }}>"4.8x ROAS achieved across 1,400+ brand stores."</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* VISUAL MOCKUP TYPE 3: CAMPAIGN MANAGER (OAuth Connections & Auto-Kill) */}
              {(currentStep.visualType === 'oauth_campaign' || title.includes("Campaign")) && (
                <div style={{
                  background: 'rgba(18, 18, 28, 0.9)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '16px',
                  padding: '20px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Key size={14} color="var(--primary)" /> EASY 1-CLICK OAUTH PLATFORM CONNECTORS
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
                    <div style={{ padding: '10px', background: 'rgba(24,119,242,0.15)', borderRadius: '8px', border: '1px solid rgba(24,119,242,0.3)', textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>Meta Ads</div>
                      <div style={{ fontSize: '9px', color: '#00E676' }}>✓ Act_208392</div>
                    </div>
                    <div style={{ padding: '10px', background: 'rgba(234,67,53,0.15)', borderRadius: '8px', border: '1px solid rgba(234,67,53,0.3)', textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>Google Ads</div>
                      <div style={{ fontSize: '9px', color: '#00E676' }}>✓ 902-8392</div>
                    </div>
                    <div style={{ padding: '10px', background: 'rgba(0,242,254,0.15)', borderRadius: '8px', border: '1px solid rgba(0,242,254,0.3)', textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>TikTok Ads</div>
                      <div style={{ fontSize: '9px', color: '#00E676' }}>✓ Connected</div>
                    </div>
                  </div>
                  <div style={{ padding: '10px', background: 'rgba(255,95,86,0.1)', borderRadius: '8px', border: '1px solid rgba(255,95,86,0.25)', fontSize: '11px', color: '#FF5F56', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><ShieldAlert size={14} color="#FF5F56" /> Auto-Kill Bad Ads (Frequency &gt; 5x)</span>
                    <span style={{ background: '#FF5F56', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 800 }}>ACTIVE</span>
                  </div>
                </div>
              )}

              {/* VISUAL MOCKUP TYPE 4: ANALYTICS (Charts & Claude Insights) */}
              {(currentStep.visualType === 'analytics_chart' || title.includes("Analytics")) && (
                <div style={{
                  background: 'rgba(18, 18, 28, 0.9)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '16px',
                  padding: '20px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <BarChart3 size={14} color="var(--primary)" /> REVENUE & ROAS DASHBOARD
                    </div>
                    <span style={{ fontSize: '11px', color: '#00E676', fontWeight: 800 }}>Blended ROAS: 4.8x</span>
                  </div>
                  {/* Mini Revenue Curve SVG */}
                  <div style={{ height: '60px', width: '100%', marginBottom: '12px' }}>
                    <svg width="100%" height="100%" viewBox="0 0 300 60" preserveAspectRatio="none">
                      <path d="M0 50 Q 75 40, 150 20 T 300 5" fill="none" stroke="#00E676" strokeWidth="3" />
                    </svg>
                  </div>
                  <div style={{ padding: '10px', background: 'rgba(90,82,255,0.12)', borderRadius: '8px', border: '1px solid rgba(90,82,255,0.3)', fontSize: '11px', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Bot size={14} color="var(--primary)" /> <span style={{ fontWeight: 700, color: 'var(--primary)' }}>Claude 3.5:</span> "Rebalance $150/day from Facebook Adset 1 to UGC Video 3 for +22% ROAS."
                  </div>
                </div>
              )}

              {/* VISUAL MOCKUP TYPE 5: SOCIAL MEDIA (30-Day Grid & DM Auto-Responder) */}
              {(currentStep.visualType === 'social_calendar' || title.includes("Social")) && (
                <div style={{
                  background: 'rgba(18, 18, 28, 0.9)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '16px',
                  padding: '20px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Share2 size={14} color="var(--primary)" /> 30-DAY SOCIAL CALENDAR & DM AUTO-RESPONDER
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '12px' }}>
                    {['IG Reel #1', 'X Post #2', 'LinkedIn #3', 'IG Carousel'].map((p, i) => (
                      <div key={i} style={{ padding: '8px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', fontSize: '10px', color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {p}
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: '8px 12px', background: 'rgba(0,230,118,0.1)', borderRadius: '8px', border: '1px solid rgba(0,230,118,0.25)', fontSize: '11px', color: '#00E676', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MessageSquare size={14} color="#00E676" /> DM Auto-Responder: Sent discount checkout link to customer (&lt; 2 sec).
                  </div>
                </div>
              )}

              {/* VISUAL MOCKUP TYPE 6: INFLUENCER MARKETPLACE (Creator Cards & Escrow) */}
              {(currentStep.visualType === 'influencer_escrow' || title.includes("Influencer") || title.includes("Creator")) && (
                <div style={{
                  background: 'rgba(18, 18, 28, 0.9)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '16px',
                  padding: '20px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                  display: 'flex',
                  justify: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>@tech_sarah (45k Followers)</div>
                    <div style={{ fontSize: '11px', color: '#00E676' }}>✓ 98% Authenticity Score (Passed Fake Check)</div>
                  </div>
                  <div style={{ padding: '8px 14px', background: 'rgba(0,230,118,0.15)', borderRadius: '8px', border: '1px solid rgba(0,230,118,0.3)', color: '#00E676', fontSize: '12px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Lock size={14} /> $350 Deal Escrowed
                  </div>
                </div>
              )}

              {/* Step Description & Key Metrics */}
              <div style={{ marginTop: '16px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 12px 0', lineHeight: 1.5 }}>
                  {currentStep.description}
                </p>
                {currentStep.metrics && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px' }}>
                    {currentStep.metrics.map((m, idx) => (
                      <div key={idx} style={{
                        background: 'rgba(255,255,255,0.03)',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.06)'
                      }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{m.label}</div>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: m.color || '#fff', marginTop: '2px' }}>{m.value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Bottom Live Execution Signal */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 2, marginTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#00E676' }}>
              <span className="badge-pulse success" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00E676' }} />
              <span>Agents Working Live</span>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Step {activeStep + 1} of {steps.length}
            </span>
          </div>
        </div>

        {/* Right Side: Step Navigation Timeline & CTA */}
        <div style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h4 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '14px', fontWeight: 700 }}>
              FEATURE DEMO TIMELINE
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {steps.map((step, idx) => {
                const isActive = idx === activeStep;
                return (
                  <div
                    key={idx}
                    onClick={() => { setActiveStep(idx); setProgress(0); }}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: isActive ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.06)',
                      background: isActive ? 'rgba(90,82,255,0.12)' : 'rgba(255,255,255,0.02)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    {/* Active Step Progress Bar */}
                    {isActive && (
                      <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        height: '2px',
                        width: `${progress}%`,
                        background: 'var(--primary)',
                        transition: 'width 0.1s linear'
                      }} />
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: isActive ? '#fff' : 'var(--text-secondary)' }}>
                        {idx + 1}. {step.title}
                      </span>
                      {isActive && <Zap size={14} color="var(--primary)" />}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Agent: {step.agent}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Action CTA */}
          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <GlowButton variant="glow" onClick={onCTA} icon={<ArrowRight size={16} />} style={{ width: '100%', justifyContent: 'center' }}>
              {ctaText}
            </GlowButton>
          </div>
        </div>
      </div>
    </div>
  );
};
