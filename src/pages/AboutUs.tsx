import React from 'react';
import { motion } from 'framer-motion';
import { Users2, Target, Cpu, CheckCircle2, ArrowRight, Building2, Zap, LayoutDashboard, Search, BarChart3, Share2, Users } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

export const AboutUs = () => {
  return (
    <div style={{ minHeight: '100vh', background: 'transparent', color: '#fff', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)' }}>
      <Navbar />
      
      <div style={{ flex: 1, paddingTop: '100px', paddingBottom: '100px', position: 'relative', overflow: 'hidden' }}>
        {/* Background decorations */}
        <div style={{ position: 'absolute', top: '10%', right: '10%', width: '600px', height: '600px', background: 'var(--accent)', filter: 'blur(300px)', opacity: 0.1, borderRadius: '50%' }}></div>
        <div style={{ position: 'absolute', bottom: '10%', left: '10%', width: '500px', height: '500px', background: 'var(--primary)', filter: 'blur(250px)', opacity: 0.05, borderRadius: '50%' }}></div>
        
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px', position: 'relative', zIndex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: '80px' }}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'rgba(255,82,150,0.1)', borderRadius: '100px', border: '1px solid rgba(255,82,150,0.2)', marginBottom: '24px' }}
            >
              <Users2 size={16} color="var(--accent)" />
              <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>About Us</span>
            </motion.div>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              style={{ fontSize: '56px', fontFamily: 'var(--font-heading)', margin: '0 0 24px 0', background: 'linear-gradient(to right, #fff, rgba(255,255,255,0.7))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.1 }}
            >
              Raftra AI
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              style={{ color: 'var(--text-secondary)', fontSize: '20px', maxWidth: '800px', margin: '0 auto', lineHeight: 1.6 }}
            >
              An AI Growth Operating System built to help businesses create, launch, optimize, and scale their marketing from one unified platform.
            </motion.p>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="glow-card" style={{ padding: '48px', marginBottom: '80px', display: 'flex', gap: '48px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: '1', minWidth: '300px' }}>
              <h2 style={{ fontSize: '32px', fontFamily: 'var(--font-heading)', marginBottom: '24px' }}>The Problem & The Mission</h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '16px', marginBottom: '16px' }}>
                Modern companies use separate tools for advertising, SEO, analytics, social media, influencer management, and AI workflows. Raftra AI brings these capabilities together into a single platform powered by intelligent agents that work continuously to improve growth performance.
              </p>
              <div style={{ padding: '24px', background: 'rgba(90,82,255,0.1)', borderRadius: '16px', border: '1px solid rgba(90,82,255,0.2)' }}>
                <p style={{ color: '#fff', fontSize: '18px', fontWeight: 500, margin: 0, lineHeight: 1.6, fontStyle: 'italic' }}>
                  "Our mission is simple: replace fragmented marketing workflows with one intelligent operating system that helps businesses grow faster with less manual work."
                </p>
              </div>
            </div>
            <div style={{ width: '120px', height: '120px', background: 'linear-gradient(135deg, rgba(90,82,255,0.2) 0%, rgba(255,82,150,0.2) 100%)', borderRadius: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
              <Target size={56} color="var(--primary)" />
            </div>
          </motion.div>

          {/* OUR FOUNDING VISION & CREDIBILITY RESEARCH */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ marginBottom: '80px' }}>
            <h2 style={{ fontSize: '32px', fontFamily: 'var(--font-heading)', marginBottom: '16px', textAlign: 'center' }}>Backed by Global Industry Data & Visionary Leadership</h2>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '40px', fontSize: '17px', maxWidth: '800px', margin: '0 auto 40px auto' }}>
              Why the world's fastest-growing brands are switching to Agentic AI and Open-Web Search Engine Optimization.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
              {/* Taboola Study Card */}
              <div style={{ padding: '32px', background: 'rgba(90,82,255,0.06)', borderRadius: '24px', border: '1px solid rgba(90,82,255,0.25)' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.08em', marginBottom: '12px' }}>TABOOLA RESEARCH STUDY (2026)</div>
                <h3 style={{ fontSize: '24px', fontWeight: 800, color: '#fff', marginBottom: '12px', lineHeight: 1.2 }}>76% Benefit from Agentic AI</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.6, margin: 0 }}>
                  A groundbreaking Taboola study reveals that <strong>76% of digital advertisers benefit from Agentic AI</strong>, with <strong>86% willing to shift advertising budgets to the Open Web & Answer Engines</strong> to escape walled gardens.
                </p>
              </div>

              {/* Founder Story Card */}
              <div style={{ padding: '32px', background: 'rgba(0,230,118,0.06)', borderRadius: '24px', border: '1px solid rgba(0,230,118,0.25)' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#00E676', letterSpacing: '0.08em', marginBottom: '12px' }}>GEN-Z INNOVATION + ENTERPRISE TRUST</div>
                <h3 style={{ fontSize: '24px', fontWeight: 800, color: '#fff', marginBottom: '12px', lineHeight: 1.2 }}>Building Next-Gen Growth OS</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.6, margin: 0 }}>
                  Co-founded by ambitious <strong>Gen-Z engineers & product creators</strong> who understand AI search, viral social algorithms, and modern automation — built in collaboration with <strong>veteran enterprise social media managers and security directors</strong>.
                </p>
              </div>

              {/* Brand Safety & Escrow Card */}
              <div style={{ padding: '32px', background: 'rgba(255,189,46,0.06)', borderRadius: '24px', border: '1px solid rgba(255,189,46,0.25)' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#FFBD2E', letterSpacing: '0.08em', marginBottom: '12px' }}>100% BRAND SAFETY & CREATOR ESCROW</div>
                <h3 style={{ fontSize: '24px', fontWeight: 800, color: '#fff', marginBottom: '12px', lineHeight: 1.2 }}>Guaranteed Safety Standards</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.6, margin: 0 }}>
                  100% brand safety guaranteed with automated content moderation gates, verified follower authenticity checks, and direct <strong>escrow deal protection</strong> for both brands and creators.
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ marginBottom: '80px' }}>
            <h2 style={{ fontSize: '32px', fontFamily: 'var(--font-heading)', marginBottom: '40px', textAlign: 'center' }}>What Raftra AI Does</h2>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '48px', fontSize: '18px' }}>Raftra AI combines six core growth functions into one platform:</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
              {[
                { title: "AI Creative Studio", desc: "Generate high-converting ad creatives, videos, hooks, and copy.", icon: <Zap color="var(--primary)" /> },
                { title: "Campaign Management", desc: "Launch and optimize campaigns across multiple advertising platforms.", icon: <LayoutDashboard color="var(--accent)" /> },
                { title: "SEO & GEO/AEO", desc: "Improve visibility on Google and AI search engines.", icon: <Search color="#10b981" /> },
                { title: "Analytics & AI Recs", desc: "Turn complex marketing data into actionable insights.", icon: <BarChart3 color="#eab308" /> },
                { title: "Social Media Automation", desc: "Plan, publish, respond, and manage social channels from one workspace.", icon: <Share2 color="violet" /> },
                { title: "Influencer Marketplace", desc: "Discover and collaborate with creators that match your brand.", icon: <Users color="var(--danger)" /> }
              ].map((feature, i) => (
                <div key={i} style={{ padding: '32px', background: 'rgba(0,0,0,0.2)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ width: '48px', height: '48px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>{feature.icon}</div>
                  <h3 style={{ fontSize: '20px', marginBottom: '12px', fontFamily: 'var(--font-heading)' }}>{feature.title}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.6 }}>{feature.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ marginBottom: '80px' }}>
            <h2 style={{ fontSize: '32px', fontFamily: 'var(--font-heading)', marginBottom: '40px', textAlign: 'center' }}>Why Businesses Choose Us</h2>
            <div style={{ overflowX: 'auto', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}>
                    <th style={{ padding: '24px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '14px', textTransform: 'uppercase', width: '50%' }}>Traditional Approach</th>
                    <th style={{ padding: '24px', color: 'var(--primary)', fontWeight: 600, fontSize: '14px', textTransform: 'uppercase' }}>With Raftra AI</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { old: "Multiple disconnected tools", new: "One unified platform" },
                    { old: "Manual campaign setup", new: "AI-assisted campaign creation" },
                    { old: "Separate SEO software", new: "Integrated SEO & GEO workflows" },
                    { old: "Scattered analytics", new: "Centralized reporting" },
                    { old: "Manual optimization", new: "AI-powered recommendations" },
                    { old: "Time-consuming coordination", new: "Automated growth workflows" }
                  ].map((row, i) => (
                    <tr key={i} style={{ borderBottom: i !== 5 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                      <td style={{ padding: '20px 24px', color: '#888', fontSize: '15px' }}>{row.old}</td>
                      <td style={{ padding: '20px 24px', color: '#fff', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}><ArrowRight size={14} color="var(--primary)" /> {row.new}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
            <div className="glow-card" style={{ padding: '40px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                <Building2 size={24} color="var(--primary)" />
                <h3 style={{ fontSize: '24px', fontFamily: 'var(--font-heading)', margin: 0 }}>Built for Modern Teams</h3>
              </div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Raftra AI is designed for:</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px', color: '#ccc' }}>
                {["E-commerce Brands", "D2C Companies", "Marketing Agencies", "SaaS Businesses", "Startups", "Growth Teams"].map((team, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="var(--primary)" /> {team}</li>
                ))}
              </ul>
            </div>

            <div className="glow-card" style={{ padding: '40px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                <Cpu size={24} color="var(--accent)" />
                <h3 style={{ fontSize: '24px', fontFamily: 'var(--font-heading)', margin: 0 }}>Our Technology</h3>
              </div>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
                Raftra AI is built using production-grade infrastructure including FastAPI, PostgreSQL, Redis, Qdrant, LangGraph, and secure OAuth integrations to support scalable AI-driven marketing operations.
              </p>
              <div style={{ padding: '16px', background: 'rgba(255,82,150,0.05)', borderRadius: '12px', border: '1px solid rgba(255,82,150,0.1)' }}>
                <p style={{ color: '#ccc', margin: 0, fontSize: '13px', lineHeight: 1.6 }}>
                  <strong>What “Working” Means:</strong> The information shown is intended to reflect the actual capabilities of the platform. If a feature appears here, it is connected to a functional backend workflow rather than a placeholder.
                </p>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
      
      <Footer />
    </div>
  );
};
