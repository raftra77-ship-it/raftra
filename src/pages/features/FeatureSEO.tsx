import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Bot, CheckCircle2, TrendingUp, Globe, Activity, Eye, Zap, ArrowUpRight } from 'lucide-react';

export const FeatureSEO = () => {
  const [score, setScore] = useState(74);
  const [visibility, setVisibility] = useState(52);
  const [traffic, setTraffic] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setScore(92);
      setVisibility(78);
      setTraffic(42);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{ animation: 'fadeIn 0.5s ease' }}>
      
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '64px' }}>
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'rgba(16,185,129,0.1)', borderRadius: '100px', border: '1px solid rgba(16,185,129,0.2)', marginBottom: '24px' }}>
          <Search size={16} color="var(--success)" />
          <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--success)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Search Visibility</span>
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{ fontSize: '48px', fontFamily: 'var(--font-heading)', margin: '0 0 24px 0', background: 'linear-gradient(to right, #fff, rgba(255,255,255,0.7))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.1 }}>
          SEO & GEO/AEO
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ color: 'var(--text-secondary)', fontSize: '20px', maxWidth: '800px', margin: '0 auto', lineHeight: 1.6 }}>
          Improves visibility on both traditional search engines and AI-powered search platforms like ChatGPT, Claude, Gemini, and Perplexity.
        </motion.p>
      </div>

      {/* Info Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px', marginBottom: '64px' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glow-card" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: 'var(--primary)' }}><Bot size={20} /> AI Agents Used</h3>
            <span style={{ background: 'rgba(90,82,255,0.2)', color: 'var(--primary)', padding: '4px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: 'bold' }}>8 AGENTS</span>
          </div>
          <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', color: '#ccc' }}>
            {["Website Crawler Agent", "Technical SEO Agent", "Keyword Intelligence Agent", "Content Strategy Agent", "Internal Linking Agent", "Entity Optimization Agent", "LLM Visibility Agent", "Reporting Agent"].map((agent, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px' }}><CheckCircle2 size={16} color="var(--primary)" /> {agent}</li>
            ))}
          </ul>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glow-card" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: 'var(--success)' }}>How it works</h3>
            <span style={{ background: 'rgba(16,185,129,0.2)', color: 'var(--success)', padding: '4px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: 'bold' }}>CONTINUOUS</span>
          </div>
          <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', color: '#ccc' }}>
            {["Crawl the entire website", "Audit technical SEO issues", "Research growth keywords", "Generate optimized content plans", "Improve internal linking and schema", "Optimize for AI search visibility", "Track rankings and citations", "Generate daily reports"].map((step, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', fontSize: '14px' }}>
                <span style={{ background: 'rgba(255,255,255,0.1)', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontSize: '10px', flexShrink: 0, marginTop: '2px' }}>{i + 1}</span> 
                {step}
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glow-card" style={{ padding: '32px', background: 'rgba(16,185,129,0.05)' }}>
          <h3 style={{ fontSize: '20px', marginBottom: '16px', color: '#fff' }}>How it improves results</h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px', fontSize: '15px' }}>
            Helps your brand appear in Google results, AI-generated answers, and recommendation engines by improving technical health, content relevance, and entity authority.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {["More organic traffic", "Better AI visibility", "Stronger authority"].map((tag, i) => (
              <span key={i} style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '100px', fontSize: '13px', color: '#fff' }}>{tag}</span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Interactive Visual Demo */}
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} style={{ background: '#0a0a0a', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
        <div style={{ padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>Live Improvement <span style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 'normal' }}>| Watch your visibility improve</span></h3>
          </div>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#888' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 10px var(--success)' }}></span> Daily monitoring
          </span>
        </div>
        
        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
          {/* Left Panel: Animated Metrics */}
          <div style={{ flex: '1', minWidth: '300px', padding: '32px', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              {/* Metric 1 */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <div style={{ width: '40px', height: '40px', background: 'rgba(90,82,255,0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Globe size={20} color="var(--primary)" />
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', color: '#888', textTransform: 'uppercase' }}>SEO Score</div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                      {score}
                      {score > 74 && (
                        <motion.span initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} style={{ fontSize: '14px', color: 'var(--success)', display: 'flex', alignItems: 'center' }}>
                          <ArrowUpRight size={16} /> +18 this month
                        </motion.span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Metric 2 */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <div style={{ width: '40px', height: '40px', background: 'rgba(255,82,150,0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Eye size={20} color="var(--accent)" />
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', color: '#888', textTransform: 'uppercase' }}>AI Visibility</div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                      {visibility}%
                      {visibility > 52 && (
                        <motion.span initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} style={{ fontSize: '14px', color: 'var(--success)', display: 'flex', alignItems: 'center' }}>
                          <ArrowUpRight size={16} /> +26%
                        </motion.span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Metric 3 */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <div style={{ width: '40px', height: '40px', background: 'rgba(16,185,129,0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TrendingUp size={20} color="#10b981" />
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', color: '#888', textTransform: 'uppercase' }}>Organic Traffic</div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                      +{traffic}%
                      {traffic > 0 && (
                        <motion.span initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} style={{ fontSize: '14px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                          30 days
                        </motion.span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Right Panel: AI completed improvements */}
          <div style={{ flex: '1.5', minWidth: '400px', padding: '32px', background: '#000' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h4 style={{ margin: 0, fontSize: '16px', color: '#888' }}>AI completed these improvements</h4>
              <span style={{ background: 'rgba(255,255,255,0.1)', padding: '4px 12px', borderRadius: '100px', fontSize: '12px' }}>Today</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                { label: "Fixed broken links", value: "14", icon: <Zap size={16} color="var(--primary)" /> },
                { label: "Added schema markup", value: "8 pages", icon: <Zap size={16} color="var(--accent)" /> },
                { label: "Generated new content ideas", value: "23", icon: <Zap size={16} color="var(--success)" /> },
                { label: "Improved AI citations", value: "11", icon: <Zap size={16} color="var(--warning)" /> }
              ].map((task, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 + (i * 0.2) }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', padding: '16px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {task.icon}
                    <span style={{ fontSize: '15px' }}>{task.label}</span>
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '6px' }}>{task.value}</span>
                </motion.div>
              ))}
            </div>

          </div>
        </div>
      </motion.div>

    </div>
  );
};
