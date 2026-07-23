import React from 'react';
import { motion } from 'framer-motion';
import { Share2, Bot, CheckCircle2, Calendar, MessageCircle, TrendingUp, Image as ImageIcon, Briefcase, Video, Loader2, Check } from 'lucide-react';
import { FeatureExplainerVideo } from '../../components/FeatureExplainerVideo';

export const FeatureSocial = () => {
  const socialExplainerSteps = [
    {
      title: "1. Visual 30-Day Content Calendar & Planner",
      agent: "Content Planning Agent",
      description: "Structures a 30-day visual content calendar with carousel posts, video reels, and product highlights aligned with brand voice.",
      badge: "CALENDAR GENERATED",
      visualType: "social_calendar" as const,
      metrics: [
        { label: "Posts Built", value: "30 Posts", color: "#00E676" },
        { label: "Platforms", value: "IG, FB, YouTube", color: "#5A52FF" }
      ]
    },
    {
      title: "2. Cross-Channel Auto-Publishing",
      agent: "Scheduling Agent",
      description: "Automatically publishes high-resolution visuals and copy to Instagram, Facebook, and YouTube at peak audience activity hours.",
      badge: "LIVE PUBLISHED",
      visualType: "social_calendar" as const,
      metrics: [
        { label: "Auto-Publish", value: "100%", color: "#00E676" },
        { label: "Optimal Time", value: "6:30 PM", color: "#FFBD2E" }
      ]
    },
    {
      title: "3. AI Comment & DM Auto-Responder",
      agent: "DM Automation Agent",
      description: "Handles customer inquiries, pricing questions, and product link requests instantly in comments and direct messages.",
      badge: "RESPONSE ACTIVE",
      visualType: "social_calendar" as const,
      metrics: [
        { label: "Response Speed", value: "< 5 sec", color: "#00E676" },
        { label: "Conversion Rate", value: "+34%", color: "#5A52FF" }
      ]
    }
  ];
  return (
    <div style={{ animation: 'fadeIn 0.5s ease' }}>
      
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '64px' }}>
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'rgba(238,130,238,0.1)', borderRadius: '100px', border: '1px solid rgba(238,130,238,0.2)', marginBottom: '24px' }}>
          <Share2 size={16} color="violet" />
          <span style={{ fontSize: '14px', fontWeight: '600', color: 'violet', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Always-On</span>
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{ fontSize: '48px', fontFamily: 'var(--font-heading)', margin: '0 0 24px 0', background: 'linear-gradient(to right, #fff, rgba(255,255,255,0.7))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.1 }}>
          Social Media AI
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ color: 'var(--text-secondary)', fontSize: '20px', maxWidth: '800px', margin: '0 auto', lineHeight: 1.6 }}>
          Plans, creates, schedules, publishes, and manages social media activity across multiple platforms.
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
            {["Content Planning Agent", "Caption Writing Agent", "Image Generation Agent", "Video Generation Agent", "Scheduling Agent", "Comment Reply Agent", "DM Automation Agent"].map((agent, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px' }}><CheckCircle2 size={16} color="var(--primary)" /> {agent}</li>
            ))}
          </ul>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glow-card" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: 'violet' }}>How it works</h3>
            <span style={{ background: 'rgba(238,130,238,0.2)', color: 'violet', padding: '4px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: 'bold' }}>CROSS-PLATFORM</span>
          </div>
          <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', color: '#ccc' }}>
            {["Generate content ideas", "Create captions and visuals", "Schedule posts across platforms", "Publish automatically", "Reply to comments", "Handle DMs", "Track engagement and performance"].map((step, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', fontSize: '14px' }}>
                <span style={{ background: 'rgba(255,255,255,0.1)', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontSize: '10px', flexShrink: 0, marginTop: '2px' }}>{i + 1}</span> 
                {step}
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glow-card" style={{ padding: '32px', background: 'rgba(238,130,238,0.05)' }}>
          <h3 style={{ fontSize: '20px', marginBottom: '16px', color: '#fff' }}>How it improves results</h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px', fontSize: '15px' }}>
            Keeps your brand active consistently, improves response time, and helps maintain engagement without needing a full social media team.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {["Consistent posting", "Faster replies", "Higher engagement"].map((tag, i) => (
              <span key={i} style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '100px', fontSize: '13px', color: '#fff' }}>{tag}</span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Motion Design Explainer Video */}
      <FeatureExplainerVideo
        title="Social Media AI Automation"
        subtitle="How Raftra AI manages your content calendar, auto-posts, and answers DMs 24/7."
        badgeText="SOCIAL MOTION DEMO"
        steps={socialExplainerSteps}
        ctaText="Unlock Social Media AI"
      />

      {/* Interactive Visual Demo */}
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} style={{ background: '#0a0a0a', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
        <div style={{ padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>Your AI social team <span style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 'normal' }}>| Action Overview</span></h3>
          </div>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#888' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'violet', boxShadow: '0 0 10px violet' }}></span> 24/7 active
          </span>
        </div>
        
        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
          {/* Left Panel: Summary Metrics */}
          <div style={{ flex: '1', minWidth: '300px', padding: '32px', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              {/* Metric 1 */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <div style={{ width: '40px', height: '40px', background: 'rgba(90,82,255,0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Calendar size={20} color="var(--primary)" />
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', color: '#888', textTransform: 'uppercase' }}>Scheduled This Week</div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
                      12 Posts
                    </div>
                  </div>
                </div>
              </div>

              {/* Metric 2 */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <div style={{ width: '40px', height: '40px', background: 'rgba(255,82,150,0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MessageCircle size={20} color="var(--accent)" />
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', color: '#888', textTransform: 'uppercase' }}>Auto-Generated</div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
                      47 Replies
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
                    <div style={{ fontSize: '14px', color: '#888', textTransform: 'uppercase' }}>Engagement Growth</div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--success)' }}>
                      +31%
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Right Panel: Schedule Timeline */}
          <div style={{ flex: '1.5', minWidth: '400px', padding: '32px', background: '#000' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
              <h4 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>Today's schedule</h4>
              <span style={{ background: 'rgba(255,255,255,0.1)', padding: '4px 12px', borderRadius: '100px', fontSize: '12px' }}>Auto-publish</span>
            </div>
            
            <div style={{ position: 'relative', paddingLeft: '24px' }}>
              {/* Vertical line */}
              <div style={{ position: 'absolute', left: '7px', top: '10px', bottom: '10px', width: '2px', background: 'rgba(255,255,255,0.1)' }}></div>
              
              {/* Event 1 */}
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 }} style={{ position: 'relative', marginBottom: '32px' }}>
                <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--success)', border: '2px solid #000' }}></div>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: '14px', color: '#888', marginTop: '2px', width: '40px' }}>10:00</div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', padding: '16px', borderRadius: '12px', flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                        <ImageIcon size={16} color="#E1306C" /> Instagram Reel
                      </div>
                    </div>
                    <div style={{ fontSize: '13px', color: '#888', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Check size={14} color="var(--success)" /> Published • 3.2k views
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Event 2 */}
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.0 }} style={{ position: 'relative', marginBottom: '32px' }}>
                <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--success)', border: '2px solid #000' }}></div>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: '14px', color: '#888', marginTop: '2px', width: '40px' }}>13:00</div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', padding: '16px', borderRadius: '12px', flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                        <Briefcase size={16} color="#1877F2" /> Facebook Post
                      </div>
                    </div>
                    <div style={{ fontSize: '13px', color: '#888', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Check size={14} color="var(--success)" /> Published • 142 reactions
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Event 3 */}
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.2 }} style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'violet', border: '2px solid #000' }}></div>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: '14px', color: '#888', marginTop: '2px', width: '40px' }}>18:00</div>
                  <div style={{ background: 'rgba(238,130,238,0.1)', border: '1px solid rgba(238,130,238,0.2)', padding: '16px', borderRadius: '12px', flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                        <Video size={16} color="#FF0000" /> YouTube Short
                      </div>
                      <span style={{ background: 'violet', color: '#000', padding: '2px 8px', borderRadius: '100px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>In Progress</span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'violet', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Loader2 size={14} className="spin" /> Rendering captions...
                    </div>
                  </div>
                </div>
              </motion.div>

            </div>

          </div>
        </div>
      </motion.div>

    </div>
  );
};
