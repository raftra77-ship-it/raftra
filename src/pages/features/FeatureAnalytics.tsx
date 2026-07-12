import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Bot, CheckCircle2, MessageSquare, Loader2, AlertTriangle, ArrowRightLeft, Sparkles, Check } from 'lucide-react';
import { GlowButton } from '../../components/GlowButton';

export const FeatureAnalytics = () => {
  const [chatState, setChatState] = useState(0); // 0: loading, 1: response ready, 2: applied

  useEffect(() => {
    const timer = setTimeout(() => setChatState(1), 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{ animation: 'fadeIn 0.5s ease' }}>
      
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '64px' }}>
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'rgba(255,174,0,0.1)', borderRadius: '100px', border: '1px solid rgba(255,174,0,0.2)', marginBottom: '24px' }}>
          <BarChart3 size={16} color="var(--warning)" />
          <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--warning)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Decision Engine</span>
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{ fontSize: '48px', fontFamily: 'var(--font-heading)', margin: '0 0 24px 0', background: 'linear-gradient(to right, #fff, rgba(255,255,255,0.7))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.1 }}>
          Analytics & Claude Intelligence
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ color: 'var(--text-secondary)', fontSize: '20px', maxWidth: '800px', margin: '0 auto', lineHeight: 1.6 }}>
          Combines advertising, analytics, SEO, and revenue data into one intelligent decision-making workspace.
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
            {["Data Collection Agent", "Normalization Agent", "SQL Analysis Agent", "Python Analytics Agent", "Visualization Agent", "Claude Recommendation Agent"].map((agent, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px' }}><CheckCircle2 size={16} color="var(--primary)" /> {agent}</li>
            ))}
          </ul>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glow-card" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: 'var(--accent)' }}>How it works</h3>
            <span style={{ background: 'rgba(255,82,150,0.2)', color: 'var(--accent)', padding: '4px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: 'bold' }}>EXPLAINABLE AI</span>
          </div>
          <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', color: '#ccc' }}>
            {["Connect GA4, Search Console, Meta, and Google Ads", "Collect and normalize data", "Run SQL and Python analysis", "Detect anomalies and trends", "Generate interactive visualizations", "Claude explains what happened and why", "Recommend next actions"].map((step, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', fontSize: '14px' }}>
                <span style={{ background: 'rgba(255,255,255,0.1)', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontSize: '10px', flexShrink: 0, marginTop: '2px' }}>{i + 1}</span> 
                {step}
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glow-card" style={{ padding: '32px', background: 'rgba(255,174,0,0.05)' }}>
          <h3 style={{ fontSize: '20px', marginBottom: '16px', color: '#fff' }}>How it improves results</h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px', fontSize: '15px' }}>
            Instead of just showing charts, Raftra explains why performance changed and what actions will have the biggest impact on revenue and growth.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {["Clear decisions", "Faster diagnosis", "Better forecasting"].map((tag, i) => (
              <span key={i} style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '100px', fontSize: '13px', color: '#fff' }}>{tag}</span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Interactive Visual Demo */}
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} style={{ background: '#0a0a0a', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
        <div style={{ padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>AI Insights <span style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 'normal' }}>| Ask Claude anything</span></h3>
          </div>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#888' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--warning)', boxShadow: '0 0 10px var(--warning)' }}></span> Claude 3.5 Sonnet
          </span>
        </div>
        
        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
          {/* Left Panel: Chat Feed */}
          <div style={{ flex: '1', minWidth: '300px', padding: '32px', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* User Message */}
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', justifyContent: 'flex-end' }}>
                <div style={{ background: 'var(--primary)', color: '#fff', padding: '12px 16px', borderRadius: '16px', borderBottomRightRadius: '4px', fontSize: '14px' }}>
                  Why did ROAS drop this week?
                </div>
              </div>

              {/* Claude Response */}
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,174,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <MessageSquare size={16} color="var(--warning)" />
                </div>
                
                {chatState === 0 ? (
                  <div style={{ color: '#888', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                    <Loader2 size={14} className="spin" /> Analyzing campaign data...
                  </div>
                ) : (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', padding: '16px', borderRadius: '16px', borderBottomLeftRadius: '4px', fontSize: '14px', lineHeight: 1.6 }}>
                    I've analyzed your cross-platform data. The drop in ROAS is primarily driven by <strong>Campaign A</strong> on Meta, where creative frequency has exceeded optimal thresholds. I have prepared a detailed recommendation.
                  </motion.div>
                )}
              </div>
            </div>

          </div>

          {/* Right Panel: Recommendation Card */}
          <div style={{ flex: '1.5', minWidth: '400px', padding: '32px', background: '#000' }}>
            {chatState === 0 ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                Waiting for AI analysis...
              </div>
            ) : (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                  <div>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Sparkles size={20} color="var(--warning)" /> Claude Recommendation
                    </h4>
                    <div style={{ fontSize: '13px', color: '#888' }}>Generated from campaign, audience, and creative data</div>
                  </div>
                  <div style={{ display: 'inline-block', background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                    92% CONFIDENCE
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
                  
                  {/* Insight 1 */}
                  <div style={{ background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.2)', padding: '16px', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)', fontWeight: 'bold', fontSize: '15px' }}>
                        <AlertTriangle size={18} /> Creative fatigue detected
                      </div>
                      <span style={{ background: 'rgba(255,71,87,0.2)', color: '#ff4757', padding: '2px 8px', borderRadius: '100px', fontSize: '11px', textTransform: 'uppercase' }}>High Impact</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '14px', color: '#ccc' }}>Frequency exceeded 3.2 on Campaign A. CPA increased by <span style={{ color: 'var(--danger)' }}>+18%</span>.</p>
                  </div>

                  {/* Insight 2 */}
                  <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', padding: '16px', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)', fontWeight: 'bold', fontSize: '15px' }}>
                        <ArrowRightLeft size={18} /> Budget reallocation opportunity
                      </div>
                      <span style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', padding: '2px 8px', borderRadius: '100px', fontSize: '11px', textTransform: 'uppercase' }}>Recommended</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '14px', color: '#ccc' }}>Move ₹15,000 from Campaign A to Campaign C. Estimated impact: <span style={{ color: 'var(--success)' }}>+22% ROAS</span>.</p>
                  </div>

                  {/* Next Action */}
                  <div style={{ background: 'rgba(90,82,255,0.1)', border: '1px solid rgba(90,82,255,0.2)', padding: '16px', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 'bold', fontSize: '15px' }}>
                        <Bot size={18} /> Suggested Next Action
                      </div>
                      <span style={{ background: 'rgba(90,82,255,0.2)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '100px', fontSize: '11px', textTransform: 'uppercase' }}>Auto-ready • 5 min</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '14px', color: '#ccc' }}>Replace video hook and refresh CTA copy for Campaign A creatives.</p>
                  </div>

                </div>

                <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary" style={{ padding: '12px 24px', fontSize: '14px' }}>Review Details</button>
                  
                  {chatState === 1 ? (
                    <GlowButton variant="glow" onClick={() => setChatState(2)}>
                      Apply Changes
                    </GlowButton>
                  ) : (
                    <button className="btn" disabled style={{ padding: '12px 24px', fontSize: '14px', background: 'var(--success)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Check size={16} /> Applied Successfully
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>

    </div>
  );
};
