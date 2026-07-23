import React from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, Database, Lock, CheckCircle2, Key, Globe, Cpu, XCircle, Building2 } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

export const Security = () => {
  return (
    <div style={{ minHeight: '100vh', background: 'transparent', color: '#fff', paddingTop: '100px', paddingBottom: '100px', fontFamily: 'var(--font-sans)' }}>
      <Navbar />
      
      {/* Background decorations */}
      <div style={{ position: 'absolute', top: '5%', left: '10%', width: '600px', height: '600px', background: 'var(--primary)', filter: 'blur(300px)', opacity: 0.1, borderRadius: '50%' }}></div>
      <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: '500px', height: '500px', background: 'var(--accent)', filter: 'blur(250px)', opacity: 0.05, borderRadius: '50%' }}></div>
      
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '80px' }}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'rgba(90,82,255,0.1)', borderRadius: '100px', border: '1px solid rgba(90,82,255,0.2)', marginBottom: '24px' }}
          >
            <ShieldAlert size={16} color="var(--primary)" />
            <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--primary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Enterprise-Grade</span>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            style={{ fontSize: '56px', fontFamily: 'var(--font-heading)', margin: '0 0 24px 0', background: 'linear-gradient(to right, #fff, rgba(255,255,255,0.7))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.1 }}
          >
            Why Raftra AI Is Secure
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            style={{ color: 'var(--text-secondary)', fontSize: '20px', maxWidth: '800px', margin: '0 auto', lineHeight: 1.6 }}
          >
            Raftra AI is built with a security-first architecture designed for businesses that connect advertising accounts, analytics platforms, websites, and AI workflows. Your data remains isolated, encrypted, and accessible only to authorized users and services.
          </motion.p>
        </div>

        {/* Core Pillars Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '32px', marginBottom: '80px' }}>
          
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="glow-card" style={{ padding: '40px' }}>
            <div style={{ width: '48px', height: '48px', background: 'rgba(90,82,255,0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', border: '1px solid rgba(90,82,255,0.2)' }}>
              <Key size={24} color="var(--primary)" />
            </div>
            <h3 style={{ fontSize: '24px', marginBottom: '16px', fontFamily: 'var(--font-heading)' }}>Secure Authentication</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px', color: '#ccc', fontSize: '15px' }}>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}><CheckCircle2 size={18} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} /> JWT-based access tokens with refresh token rotation</li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}><CheckCircle2 size={18} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} /> Google & GitHub OAuth support</li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}><CheckCircle2 size={18} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} /> Role-based access control (RBAC)</li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}><CheckCircle2 size={18} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} /> Workspace and organization-level permissions</li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}><CheckCircle2 size={18} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} /> Session expiration and device revocation</li>
            </ul>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="glow-card" style={{ padding: '40px' }}>
            <div style={{ width: '48px', height: '48px', background: 'rgba(255,82,150,0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', border: '1px solid rgba(255,82,150,0.2)' }}>
              <Lock size={24} color="var(--accent)" />
            </div>
            <h3 style={{ fontSize: '24px', marginBottom: '16px', fontFamily: 'var(--font-heading)' }}>Data Encryption</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px', color: '#ccc', fontSize: '15px' }}>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}><CheckCircle2 size={18} color="var(--accent)" style={{ flexShrink: 0, marginTop: '2px' }} /> All data encrypted in transit using HTTPS/TLS</li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}><CheckCircle2 size={18} color="var(--accent)" style={{ flexShrink: 0, marginTop: '2px' }} /> Sensitive credentials encrypted at rest</li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}><CheckCircle2 size={18} color="var(--accent)" style={{ flexShrink: 0, marginTop: '2px' }} /> OAuth tokens stored securely</li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}><CheckCircle2 size={18} color="var(--accent)" style={{ flexShrink: 0, marginTop: '2px' }} /> API keys never exposed to the frontend</li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}><CheckCircle2 size={18} color="var(--accent)" style={{ flexShrink: 0, marginTop: '2px' }} /> Secrets managed through environment-based configuration</li>
            </ul>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="glow-card" style={{ padding: '40px', background: 'rgba(0,230,118,0.04)', border: '1px solid rgba(0,230,118,0.25)' }}>
            <div style={{ width: '48px', height: '48px', background: 'rgba(0,230,118,0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', border: '1px solid rgba(0,230,118,0.3)' }}>
              <ShieldAlert size={24} color="#00E676" />
            </div>
            <h3 style={{ fontSize: '24px', marginBottom: '16px', fontFamily: 'var(--font-heading)' }}>Brand Safety & Creator Escrow</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px', color: '#ccc', fontSize: '15px' }}>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}><CheckCircle2 size={18} color="#00E676" style={{ flexShrink: 0, marginTop: '2px' }} /> <strong>100% Brand Safety:</strong> Automated content & tone moderation gate</li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}><CheckCircle2 size={18} color="#00E676" style={{ flexShrink: 0, marginTop: '2px' }} /> <strong>Fake Follower Audit:</strong> Scans creator profiles to filter &lt; 3% bot ratio</li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}><CheckCircle2 size={18} color="#00E676" style={{ flexShrink: 0, marginTop: '2px' }} /> <strong>Escrow Deal Locks:</strong> Payment funds locked safely in escrow until content review</li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}><CheckCircle2 size={18} color="#00E676" style={{ flexShrink: 0, marginTop: '2px' }} /> <strong>Human-in-the-loop Approval:</strong> One-click campaign publish confirmation</li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}><CheckCircle2 size={18} color="#00E676" style={{ flexShrink: 0, marginTop: '2px' }} /> <strong>Enterprise Social Manager Standards:</strong> Compliance protocols designed with senior growth leads</li>
            </ul>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="glow-card" style={{ padding: '40px' }}>
            <div style={{ width: '48px', height: '48px', background: 'rgba(234,179,8,0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', border: '1px solid rgba(234,179,8,0.2)' }}>
              <Database size={24} color="#eab308" />
            </div>
            <h3 style={{ fontSize: '24px', marginBottom: '16px', fontFamily: 'var(--font-heading)' }}>Database Protection</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px', color: '#ccc', fontSize: '15px' }}>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}><CheckCircle2 size={18} color="#eab308" style={{ flexShrink: 0, marginTop: '2px' }} /> <strong>PostgreSQL:</strong> transactional business data</li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}><CheckCircle2 size={18} color="#eab308" style={{ flexShrink: 0, marginTop: '2px' }} /> <strong>Redis:</strong> temporary queues and caching only</li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}><CheckCircle2 size={18} color="#eab308" style={{ flexShrink: 0, marginTop: '2px' }} /> <strong>Qdrant:</strong> vector embeddings and AI memory</li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}><CheckCircle2 size={18} color="#eab308" style={{ flexShrink: 0, marginTop: '2px' }} /> Strict workspace-level data isolation</li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}><CheckCircle2 size={18} color="#eab308" style={{ flexShrink: 0, marginTop: '2px' }} /> No customer data shared across organizations</li>
            </ul>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="glow-card" style={{ padding: '40px' }}>
            <div style={{ width: '48px', height: '48px', background: 'rgba(16,185,129,0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', border: '1px solid rgba(16,185,129,0.2)' }}>
              <Globe size={24} color="#10b981" />
            </div>
            <h3 style={{ fontSize: '24px', marginBottom: '16px', fontFamily: 'var(--font-heading)' }}>Protected Integrations</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '15px' }}>Connected platforms include: Meta Ads, Google Ads, GA4, Search Console, Instagram, WhatsApp.</p>
            <div style={{ padding: '16px', background: 'rgba(16,185,129,0.05)', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.1)' }}>
              <p style={{ color: '#ccc', margin: 0, fontSize: '14px', lineHeight: 1.6 }}>
                Permissions are requested only when needed, tokens are stored server-side, and integrations can be disconnected at any time.
              </p>
            </div>
          </motion.div>

        </div>

        {/* AI Security Section */}
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ marginBottom: '80px', background: 'rgba(0,0,0,0.3)', borderRadius: '24px', padding: '48px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
            <Cpu size={32} color="var(--primary)" />
            <h2 style={{ fontSize: '32px', fontFamily: 'var(--font-heading)', margin: 0 }}>AI Agent Security</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '18px', marginBottom: '32px', maxWidth: '800px' }}>
            Raftra AI uses isolated AI workflows for creative generation, SEO analysis, campaign optimization, and analytics.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            {[
              "Agent executions are isolated per workspace",
              "Prompts and outputs are logged for auditing",
              "Background jobs run through secure worker queues",
              "Human approval can be required before publishing ads or content",
              "External AI providers never receive more data than necessary for the requested task"
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '12px' }}>
                <ShieldAlert size={20} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span style={{ color: '#e2e8f0', fontSize: '15px', lineHeight: 1.5 }}>{item}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Infrastructure Table */}
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ marginBottom: '80px' }}>
          <h2 style={{ fontSize: '32px', fontFamily: 'var(--font-heading)', marginBottom: '32px', textAlign: 'center' }}>Infrastructure Security</h2>
          <div style={{ overflowX: 'auto', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}>
                  <th style={{ padding: '20px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Layer</th>
                  <th style={{ padding: '20px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Protection</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { layer: "API Layer", protection: "Rate limiting, request validation, JWT verification" },
                  { layer: "Backend Services", protection: "FastAPI with typed schemas and input validation" },
                  { layer: "Workers", protection: "Isolated Celery task execution" },
                  { layer: "Databases", protection: "Private network access and encrypted connections" },
                  { layer: "Storage", protection: "Signed URLs and access-controlled uploads" },
                  { layer: "Monitoring", protection: "Audit logs, error tracking, and health checks" }
                ].map((row, i) => (
                  <tr key={i} style={{ borderBottom: i !== 5 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                    <td style={{ padding: '20px', color: '#fff', fontWeight: 500 }}>{row.layer}</td>
                    <td style={{ padding: '20px', color: '#ccc' }}>{row.protection}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* What We Don't Do */}
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ marginBottom: '80px', display: 'flex', flexWrap: 'wrap', gap: '48px', alignItems: 'center' }}>
          <div style={{ flex: '1', minWidth: '300px' }}>
            <h2 style={{ fontSize: '32px', fontFamily: 'var(--font-heading)', marginBottom: '16px' }}>What We Don't Do</h2>
            <p style={{ color: 'var(--accent)', fontSize: '18px', fontWeight: 500, marginBottom: '32px' }}>Your data stays under your control</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '16px', color: '#ccc', fontSize: '16px' }}>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}><XCircle size={20} color="var(--accent)" style={{ flexShrink: 0, marginTop: '2px' }} /> We do not sell customer data.</li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}><XCircle size={20} color="var(--accent)" style={{ flexShrink: 0, marginTop: '2px' }} /> We do not share advertising account data with other customers.</li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}><XCircle size={20} color="var(--accent)" style={{ flexShrink: 0, marginTop: '2px' }} /> We do not expose API keys or OAuth tokens to the browser.</li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}><XCircle size={20} color="var(--accent)" style={{ flexShrink: 0, marginTop: '2px' }} /> We do not use customer campaign data to train public AI models.</li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}><XCircle size={20} color="var(--accent)" style={{ flexShrink: 0, marginTop: '2px' }} /> We do not allow cross-workspace data access.</li>
            </ul>
          </div>
          <div style={{ flex: '1', minWidth: '300px', background: 'rgba(255,82,150,0.05)', padding: '40px', borderRadius: '24px', border: '1px solid rgba(255,82,150,0.2)', textAlign: 'center' }}>
            <Building2 size={48} color="var(--accent)" style={{ marginBottom: '24px' }} />
            <h3 style={{ fontSize: '24px', marginBottom: '16px', fontFamily: 'var(--font-heading)' }}>Designed for Real Business</h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
              Raftra AI is built for agencies, e-commerce brands, SaaS companies, and marketing teams that need secure access to:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
              {["Advertising platforms", "Website analytics", "SEO data", "AI-generated creatives", "Approved publishing", "Multi-user collab"].map((tag, i) => (
                <span key={i} style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.1)', borderRadius: '100px', fontSize: '13px', color: '#fff' }}>{tag}</span>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Conclusion */}
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '28px', fontFamily: 'var(--font-heading)', marginBottom: '24px' }}>The Bottom Line</h2>
          <p style={{ fontSize: '20px', color: '#e2e8f0', lineHeight: 1.6 }}>
            Raftra AI combines enterprise-grade authentication, encrypted storage, isolated AI workflows, secure OAuth integrations, and audited publishing controls so businesses can confidently connect their marketing stack and automate growth without compromising security.
          </p>
        </motion.div>

      </div>
      <Footer />
    </div>
  );
};
