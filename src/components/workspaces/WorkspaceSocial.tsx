import React, { useState } from 'react';
import { 
  Activity, Users, MessageCircle, Heart, Zap, Sparkles, UserCheck, 
  ShieldCheck, CheckCircle2, Briefcase, TrendingUp, Search, Award, 
  FileText, Target, Bot, DollarSign, Clock, ChevronRight
} from 'lucide-react';
import { GlowButton } from '../GlowButton';

export interface SocialPostItem {
  id: string;
  platform: 'Instagram' | 'Facebook' | 'YouTube';
  caption: string;
  scheduledFor: string;
  status: 'draft' | 'scheduled' | 'published';
}

interface WorkspaceSocialProps {
  posts?: SocialPostItem[];
  onOpenReview?: (itemId: string) => void;
  onComposePost?: (caption: string, platform: 'Instagram' | 'Facebook' | 'YouTube') => void;
}

export const WorkspaceSocial: React.FC<WorkspaceSocialProps> = () => {
  const [activeAgents, setActiveAgents] = useState<string[]>([]);
  const [selectedSpecialistIndex, setSelectedSpecialistIndex] = useState<number>(0);
  
  // Hiring modal state
  const [hiringManager, setHiringManager] = useState<{id: string, name: string, basePrice: number} | null>(null);
  const [hirePrice, setHirePrice] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };
  
  // Toggles for individual profiles
  const [alexToggles, setAlexToggles] = useState({ planner: true, dm: false, funny: true });
  const [sarahToggles, setSarahToggles] = useState({ planner: true, leadDm: true, thoughtLeadership: false });
  const [maxToggles, setMaxToggles] = useState({ supportDm: true, faq: true, spam: true });

  const handleDeploy = (agentId: string) => {
    setActiveAgents(prev => prev.includes(agentId) ? prev.filter(a => a !== agentId) : [...prev, agentId]);
  };

  const isDeployed = (agentId: string) => activeAgents.includes(agentId);

  // Specialist Roles Data
  const specialistRoles = [
    {
      id: 'social',
      title: 'Social Media Manager',
      price: 'Starting from ₹25,000/month',
      basePrice: 25000,
      icon: Share2Icon,
      color: '#5A52FF',
      automates: [
        'AI Content Ideas',
        'Caption Generation',
        'Hashtags',
        'Content Calendar',
        'Scheduling',
        'Analytics',
        'Performance Reports'
      ],
      specialistDoes: [
        'Final Content Strategy',
        'Brand Communication',
        'Community Management',
        'Trend-based Decisions',
        'High-level Campaign Planning'
      ]
    },
    {
      id: 'seo',
      title: 'SEO & GEO Specialist',
      price: 'Starting from ₹20,000/month',
      basePrice: 20000,
      icon: Search,
      color: '#00E676',
      automates: [
        'Website Audit',
        'GEO Audit',
        'Keyword Research',
        'Competitor Analysis',
        'Blog Generation',
        'Meta Tags',
        'Schema',
        'Internal Linking',
        'AI Recommendations',
        'One-click Publishing'
      ],
      specialistDoes: [
        'Approve SEO Strategy',
        'Advanced Technical SEO',
        'Backlink Outreach',
        'Digital PR',
        'Content Planning'
      ]
    },
    {
      id: 'paid_ads',
      title: 'Paid Ads Specialist',
      price: 'Starting from ₹20,000/month',
      basePrice: 20000,
      icon: Target,
      color: '#FFBD2E',
      automates: [
        'Campaign Suggestions',
        'Audience Suggestions',
        'Budget Recommendations',
        'Creative Generation',
        'Ad Publishing',
        'Performance Analytics',
        'Optimization Recommendations'
      ],
      specialistDoes: [
        'Business Strategy',
        'Scaling Decisions',
        'Manual Optimization',
        'Budget Approval',
        'New Market Expansion'
      ]
    },
    {
      id: 'influencer',
      title: 'Influencer Campaign Manager',
      price: 'Starting from ₹20,000/month',
      basePrice: 20000,
      icon: Users,
      color: '#FF5296',
      automates: [
        'Creator Discovery',
        'Fake Follower Detection',
        'Brand Matching',
        'Campaign Tracking',
        'Performance Analytics'
      ],
      specialistDoes: [
        'Negotiation',
        'Pricing',
        'Relationship Management',
        'Campaign Coordination'
      ]
    },
    {
      id: 'cro',
      title: 'CRO Specialist',
      price: 'Starting from ₹20,000/project',
      basePrice: 20000,
      icon: TrendingUp,
      color: '#EE82EE',
      automates: [
        'Funnel Analytics',
        'Heatmap Insights (when integrated)',
        'AI Recommendations',
        'Landing Page Suggestions'
      ],
      specialistDoes: [
        'Conversion Strategy',
        'Experiment Design',
        'A/B Testing Decisions',
        'UX Improvements'
      ]
    }
  ];

  const currentSpecialist = specialistRoles[selectedSpecialistIndex];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '40px' }}>
      
      {/* 1. PAGE HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: 'rgba(90,82,255,0.1)', borderRadius: '100px', border: '1px solid rgba(90,82,255,0.2)', marginBottom: '12px' }}>
            <ShieldCheck size={14} color="var(--primary)" />
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Raftra Verified Network
            </span>
          </div>
          <h2 style={{ fontSize: '28px', fontFamily: 'var(--font-heading)', margin: '0 0 8px 0', color: '#fff', display: 'flex', alignItems: 'center', gap: '12px' }}>
            Social Hub & Verified Specialist Operations
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px', maxWidth: '800px', margin: 0, lineHeight: 1.5 }}>
            Raftra automates 60% – 80% of repetitive marketing tasks while verified specialists operate directly inside your Raftra workspace to drive strategy and decisions.
          </p>
        </div>
      </div>

      {/* 2. BRAND SOCIAL PRESENCE ANALYTICS */}
      <div>
        <h3 style={{ fontSize: '15px', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', marginBottom: '16px' }}>
          <Activity size={18} color="var(--success)" /> Live Brand Social Performance
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          
          <div className="glow-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
              <Users size={16} /> <span style={{ fontSize: '12px' }}>Total Active Reach</span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff' }}>1.2M</div>
            <div style={{ fontSize: '11px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <TrendingUp size={12} /> +24% this week
            </div>
          </div>

          <div className="glow-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
              <MessageCircle size={16} /> <span style={{ fontSize: '12px' }}>Brand Mentions</span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff' }}>14,302</div>
            <div style={{ fontSize: '11px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <TrendingUp size={12} /> +102 organically
            </div>
          </div>

          <div className="glow-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
              <Heart size={16} /> <span style={{ fontSize: '12px' }}>Engagement Rate</span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff' }}>4.8%</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              vs 3.2% industry avg
            </div>
          </div>

          <div className="glow-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
              <Zap size={16} /> <span style={{ fontSize: '12px' }}>Audience Growth</span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff' }}>+12.4k</div>
            <div style={{ fontSize: '11px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <TrendingUp size={12} /> Driven by AI Automations
            </div>
          </div>

        </div>
      </div>

      {/* 3. HERO POSITIONING CARD: HIRE A RAFTRA SPECIALIST */}
      <div className="glow-card" style={{ padding: '32px', background: 'linear-gradient(135deg, rgba(90,82,255,0.08) 0%, rgba(10,10,14,0.95) 100%)', border: '1px solid rgba(90,82,255,0.3)', borderRadius: '20px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(90,82,255,0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: 'rgba(255,255,255,0.06)', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <Briefcase size={14} color="var(--primary)" />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>Hire a Raftra Specialist</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ background: 'rgba(0,230,118,0.15)', color: 'var(--success)', padding: '4px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={13} /> Verified Specialists
              </span>
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: '24px', fontFamily: 'var(--font-heading)', color: '#fff', margin: '0 0 12px 0', lineHeight: 1.3 }}>
              Need expert assistance? Hire a Raftra Verified Specialist who works inside Raftra, not outside it.
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.6, margin: '0 0 16px 0', maxWidth: '900px' }}>
              Unlike traditional agencies, our specialists don't spend hours on repetitive tasks. Raftra automates audits, reporting, content generation, campaign monitoring, publishing, analytics, and recommendations—allowing specialists to focus on strategy and business growth.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>The result?</span>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ background: 'rgba(90,82,255,0.2)', color: 'var(--primary)', padding: '6px 14px', borderRadius: '100px', fontSize: '13px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Zap size={13} /> Faster execution
              </span>
              <span style={{ background: 'rgba(0,230,118,0.2)', color: 'var(--success)', padding: '6px 14px', borderRadius: '100px', fontSize: '13px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <DollarSign size={13} /> Lower costs
              </span>
              <span style={{ background: 'rgba(238,130,238,0.2)', color: 'violet', padding: '6px 14px', borderRadius: '100px', fontSize: '13px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <TrendingUp size={13} /> Better outcomes
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. SPECIALIST ROLES BREAKDOWN (WHAT RAFTRA AUTOMATES vs WHAT SPECIALIST DOES) */}
      <div>
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '20px', fontFamily: 'var(--font-heading)', color: '#fff', margin: '0 0 6px 0' }}>
            Choose Your Raftra Specialist
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
            Every specialist works seamlessly inside Raftra's AI infrastructure with clear division of labor.
          </p>
        </div>

        {/* Role Selector Tabs */}
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '20px' }}>
          {specialistRoles.map((role, idx) => {
            const Icon = role.icon;
            const isSelected = selectedSpecialistIndex === idx;
            return (
              <button
                key={role.id}
                onClick={() => setSelectedSpecialistIndex(idx)}
                style={{
                  background: isSelected ? 'rgba(90,82,255,0.2)' : 'rgba(255,255,255,0.03)',
                  border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '12px 18px',
                  color: isSelected ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease'
                }}
              >
                <Icon size={16} color={isSelected ? role.color : 'var(--text-muted)'} />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '14px', fontWeight: isSelected ? 600 : 500 }}>{role.title}</div>
                  <div style={{ fontSize: '11px', color: isSelected ? 'var(--primary)' : 'var(--text-muted)' }}>{role.price}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Specialist Active Card */}
        <div className="glow-card" style={{ padding: '32px', background: '#0d0d12', border: `1px solid ${currentSpecialist.color}40`, borderRadius: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '28px', borderBottom: '1px solid var(--border)', paddingBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '12px', color: currentSpecialist.color, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '4px' }}>
                SPECIALIST DIVISION OF LABOR
              </div>
              <h4 style={{ fontSize: '24px', color: '#fff', margin: '0 0 6px 0', fontFamily: 'var(--font-heading)' }}>
                {currentSpecialist.title}
              </h4>
              <div style={{ fontSize: '16px', color: 'var(--success)', fontWeight: 600 }}>
                {currentSpecialist.price}
              </div>
            </div>

            <GlowButton 
              variant="glow"
              onClick={() => setHiringManager({ id: currentSpecialist.id, name: currentSpecialist.title, basePrice: currentSpecialist.basePrice })}
              style={{ padding: '12px 24px' }}
            >
              Hire {currentSpecialist.title}
            </GlowButton>
          </div>

          {/* 2-Column Comparison Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            
            {/* Column 1: What Raftra Automates */}
            <div style={{ background: 'rgba(90,82,255,0.05)', border: '1px solid rgba(90,82,255,0.15)', borderRadius: '14px', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div style={{ width: '32px', height: '32px', background: 'rgba(90,82,255,0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bot size={18} color="var(--primary)" />
                </div>
                <div>
                  <h5 style={{ fontSize: '16px', color: '#fff', margin: 0, fontWeight: 600 }}>What Raftra Automates</h5>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>60% – 80% automated repetitive work</span>
                </div>
              </div>

              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {currentSpecialist.automates.map((item, idx) => (
                  <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#e0e0e0' }}>
                    <CheckCircle2 size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 2: What the Specialist Does */}
            <div style={{ background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.15)', borderRadius: '14px', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div style={{ width: '32px', height: '32px', background: 'rgba(0,230,118,0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserCheck size={18} color="var(--success)" />
                </div>
                <div>
                  <h5 style={{ fontSize: '16px', color: '#fff', margin: 0, fontWeight: 600 }}>What the Specialist Does</h5>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Strategy, creativity & business decisions</span>
                </div>
              </div>

              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {currentSpecialist.specialistDoes.map((item, idx) => (
                  <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#e0e0e0' }}>
                    <ChevronRight size={16} color="var(--success)" style={{ flexShrink: 0 }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </div>
      </div>

      {/* 5. WHY HIRE THROUGH RAFTRA? SECTION */}
      <div className="glow-card" style={{ padding: '32px', background: '#0a0a0e', borderRadius: '20px', border: '1px solid var(--border)' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '12px' }}>
            <Zap size={14} color="var(--primary)" />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Raftra Advantage
            </span>
          </div>
          <h3 style={{ fontSize: '26px', fontFamily: 'var(--font-heading)', color: '#fff', margin: '0 0 10px 0' }}>
            Why Hire Through Raftra?
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px', maxWidth: '700px', margin: '0 auto' }}>
            Compare how traditional agencies operate versus Raftra's AI-native specialist workflow.
          </p>
        </div>

        {/* Workflow Comparison Diagram */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '36px' }}>
          
          {/* Traditional Agency */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.05em' }}>
              Traditional Agency
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {['Audit', 'Manual Work', 'Reports', 'Meetings', 'Changes'].map((step, i, arr) => (
                <React.Fragment key={i}>
                  <div style={{ background: 'rgba(255,255,255,0.04)', padding: '12px 16px', borderRadius: '8px', color: '#aaa', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{step}</span>
                    <span style={{ fontSize: '11px', color: '#666' }}>Manual</span>
                  </div>
                  {i < arr.length - 1 && (
                    <div style={{ textAlign: 'center', color: '#444', fontSize: '12px' }}>↓</div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* With Raftra */}
          <div style={{ background: 'rgba(90,82,255,0.06)', border: '1px solid rgba(90,82,255,0.3)', borderRadius: '16px', padding: '24px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                With Raftra
              </div>
              <span style={{ background: 'var(--primary)', color: '#000', padding: '2px 8px', borderRadius: '100px', fontSize: '10px', fontWeight: 700 }}>HIGH EFFICIENCY</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { title: 'AI Audits', desc: 'Instant 24/7 scanning' },
                { title: 'AI Recommendations', desc: 'Data-driven insights' },
                { title: 'One-click Publishing', desc: 'Seamless deployment' },
                { title: 'Live Analytics', desc: 'Real-time monitoring' },
                { title: 'Specialist focuses only on strategy', desc: '100% high-leverage decisions' }
              ].map((step, i, arr) => (
                <React.Fragment key={i}>
                  <div style={{ 
                    background: i === arr.length - 1 ? 'rgba(0,230,118,0.15)' : 'rgba(90,82,255,0.15)', 
                    border: i === arr.length - 1 ? '1px solid rgba(0,230,118,0.3)' : '1px solid rgba(90,82,255,0.3)',
                    padding: '12px 16px', 
                    borderRadius: '8px', 
                    color: i === arr.length - 1 ? 'var(--success)' : '#fff', 
                    fontSize: '14px', 
                    fontWeight: i === arr.length - 1 ? 600 : 500,
                    display: 'flex', 
                    alignItems: 'center', 
                    justify: 'space-between' 
                  }}>
                    <span>{step.title}</span>
                    <span style={{ fontSize: '11px', opacity: 0.8 }}>{step.desc}</span>
                  </div>
                  {i < arr.length - 1 && (
                    <div style={{ textAlign: 'center', color: 'var(--primary)', fontSize: '12px' }}>↓</div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

        </div>

        {/* Why it matters Grid */}
        <div>
          <h4 style={{ fontSize: '18px', color: '#fff', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-mono)' }}>
            Why It Matters
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {[
              { icon: Zap, text: 'Up to 70% less repetitive work', color: 'var(--primary)' },
              { icon: Clock, text: 'AI handles monitoring 24/7', color: 'violet' },
              { icon: Target, text: 'Specialists focus on decisions, not data collection', color: 'var(--success)' },
              { icon: DollarSign, text: 'Lower cost than a traditional agency', color: '#FFBD2E' },
              { icon: Bot, text: 'Every specialist is trained on Raftra\'s AI workflows', color: '#5A52FF' },
              { icon: TrendingUp, text: 'Faster campaign execution and optimization', color: '#FF5296' }
            ].map((item, idx) => {
              const ItemIcon = item.icon;
              return (
                <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', padding: '16px 20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '36px', height: '36px', background: `${item.color}20`, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ItemIcon size={18} color={item.color} />
                  </div>
                  <span style={{ color: '#e0e0e0', fontSize: '14px', fontWeight: 500 }}>
                    {item.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* 6. INDIVIDUAL VERIFIED MANAGER ROSTER */}
      <div>
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '20px', fontFamily: 'var(--font-heading)', color: '#fff', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={20} color="var(--primary)" /> Individual Verified Manager Profiles
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
            Select individual verified specialists to operate your Raftra AI agents.
          </p>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          
          {/* PROFILE 1: Aarav Sharma */}
          <div className="glow-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', border: isDeployed('alex') ? '1px solid var(--primary)' : '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <img src="https://ui-avatars.com/api/?name=Aarav+Sharma&background=FF6B6B&color=fff&size=56" alt="Aarav" style={{ borderRadius: '50%' }} />
              <div>
                <h4 style={{ fontSize: '16px', color: '#fff', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>Aarav Sharma <CheckCircle2 size={12} color="var(--success)" /></h4>
                <div style={{ fontSize: '12px', color: 'var(--primary)' }}>Gen-Z & D2C Growth Expert</div>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <Award size={14} color="var(--accent)" /> <b>Experience:</b> 4 Years
              </div>
              <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <FileText size={14} color="var(--accent)" /> <b>Recent Works:</b> Nykaa, Boat, Flipkart
              </div>
            </div>
            
            <h5 style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={12} /> ENABLE RAFTRA AI SUPPORT:
            </h5>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '13px' }}>
                  <Search size={14} color="var(--primary)" /> Trend & Scraper Agent
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={alexToggles.planner} onChange={e => setAlexToggles(p => ({...p, planner: e.target.checked}))} disabled={isDeployed('alex')} />
                  <span className="slider"></span>
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '13px' }}>
                  <MessageCircle size={14} color="var(--primary)" /> Auto DM Responses
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={alexToggles.dm} onChange={e => setAlexToggles(p => ({...p, dm: e.target.checked}))} disabled={isDeployed('alex')} />
                  <span className="slider"></span>
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '13px' }}>
                  <Zap size={14} color="var(--primary)" /> Smart Commenting (Witty)
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={alexToggles.funny} onChange={e => setAlexToggles(p => ({...p, funny: e.target.checked}))} disabled={isDeployed('alex')} />
                  <span className="slider"></span>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', marginBottom: '8px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Monthly Retainer:</span>
              <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>₹28,000<span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/mo</span></span>
            </div>

            <GlowButton 
              variant="glow" 
              onClick={() => { if (!isDeployed('alex')) setHiringManager({id: 'alex', name: 'Aarav Sharma', basePrice: 28000}); }}
              style={{ marginTop: '16px', padding: '12px', width: '100%', background: isDeployed('alex') ? 'rgba(0,230,118,0.1)' : '', borderColor: isDeployed('alex') ? 'var(--success)' : '', color: isDeployed('alex') ? 'var(--success)' : '' }}
            >
              {isDeployed('alex') ? <><CheckCircle2 size={16} style={{marginRight: '8px'}} /> Hire Request Sent</> : 'Send Hire Request & Enable AI'}
            </GlowButton>
          </div>

          {/* PROFILE 2: Priya Verma */}
          <div className="glow-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', border: isDeployed('sarah') ? '1px solid var(--primary)' : '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <img src="https://ui-avatars.com/api/?name=Priya+Verma&background=4facfe&color=fff&size=56" alt="Priya" style={{ borderRadius: '50%' }} />
              <div>
                <h4 style={{ fontSize: '16px', color: '#fff', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>Priya Verma <CheckCircle2 size={12} color="var(--success)" /></h4>
                <div style={{ fontSize: '12px', color: 'var(--primary)' }}>Brand & Growth Strategist</div>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <Award size={14} color="var(--accent)" /> <b>Experience:</b> 7 Years
              </div>
              <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <FileText size={14} color="var(--accent)" /> <b>Recent Works:</b> Zomato, Swiggy, Razorpay
              </div>
            </div>
            
            <h5 style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={12} /> ENABLE RAFTRA AI SUPPORT:
            </h5>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '13px' }}>
                  <Search size={14} color="var(--primary)" /> Brand Knowledge Scraper
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={sarahToggles.planner} onChange={e => setSarahToggles(p => ({...p, planner: e.target.checked}))} disabled={isDeployed('sarah')} />
                  <span className="slider"></span>
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '13px' }}>
                  <UserCheck size={14} color="var(--primary)" /> Lead Gen Auto DMs
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={sarahToggles.leadDm} onChange={e => setSarahToggles(p => ({...p, leadDm: e.target.checked}))} disabled={isDeployed('sarah')} />
                  <span className="slider"></span>
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '13px' }}>
                  <Briefcase size={14} color="var(--primary)" /> Professional Commenting
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={sarahToggles.thoughtLeadership} onChange={e => setSarahToggles(p => ({...p, thoughtLeadership: e.target.checked}))} disabled={isDeployed('sarah')} />
                  <span className="slider"></span>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', marginBottom: '8px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Monthly Retainer:</span>
              <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>₹75,000<span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/mo</span></span>
            </div>

            <GlowButton 
              variant="glow" 
              onClick={() => { if (!isDeployed('sarah')) setHiringManager({id: 'sarah', name: 'Priya Verma', basePrice: 75000}); }}
              style={{ marginTop: '16px', padding: '12px', width: '100%', background: isDeployed('sarah') ? 'rgba(0,230,118,0.1)' : '', borderColor: isDeployed('sarah') ? 'var(--success)' : '', color: isDeployed('sarah') ? 'var(--success)' : '' }}
            >
              {isDeployed('sarah') ? <><CheckCircle2 size={16} style={{marginRight: '8px'}} /> Hire Request Sent</> : 'Send Hire Request & Enable AI'}
            </GlowButton>
          </div>

          {/* PROFILE 3: Rohan Malhotra */}
          <div className="glow-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', border: isDeployed('max') ? '1px solid var(--primary)' : '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <img src="https://ui-avatars.com/api/?name=Rohan+Malhotra&background=43e97b&color=111&size=56" alt="Rohan" style={{ borderRadius: '50%' }} />
              <div>
                <h4 style={{ fontSize: '16px', color: '#fff', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>Rohan Malhotra <CheckCircle2 size={12} color="var(--success)" /></h4>
                <div style={{ fontSize: '12px', color: 'var(--primary)' }}>Community & Social Manager</div>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <Award size={14} color="var(--accent)" /> <b>Experience:</b> 3 Years
              </div>
              <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <FileText size={14} color="var(--accent)" /> <b>Recent Works:</b> Cred, Meesho, PhonePe
              </div>
            </div>
            
            <h5 style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={12} /> ENABLE RAFTRA AI SUPPORT:
            </h5>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '13px' }}>
                  <MessageCircle size={14} color="var(--primary)" /> Support Auto DMs
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={maxToggles.supportDm} onChange={e => setMaxToggles(p => ({...p, supportDm: e.target.checked}))} disabled={isDeployed('max')} />
                  <span className="slider"></span>
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '13px' }}>
                  <Zap size={14} color="var(--primary)" /> FAQ Commenting
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={maxToggles.faq} onChange={e => setMaxToggles(p => ({...p, faq: e.target.checked}))} disabled={isDeployed('max')} />
                  <span className="slider"></span>
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '13px' }}>
                  <ShieldCheck size={14} color="var(--primary)" /> Auto-Spam Deletion
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={maxToggles.spam} onChange={e => setMaxToggles(p => ({...p, spam: e.target.checked}))} disabled={isDeployed('max')} />
                  <span className="slider"></span>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', marginBottom: '8px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Monthly Retainer:</span>
              <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>₹45,000<span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/mo</span></span>
            </div>

            <GlowButton 
              variant="glow" 
              onClick={() => { if (!isDeployed('max')) setHiringManager({id: 'max', name: 'Rohan Malhotra', basePrice: 45000}); }}
              style={{ marginTop: '16px', padding: '12px', width: '100%', background: isDeployed('max') ? 'rgba(0,230,118,0.1)' : '', borderColor: isDeployed('max') ? 'var(--success)' : '', color: isDeployed('max') ? 'var(--success)' : '' }}
            >
              {isDeployed('max') ? <><CheckCircle2 size={16} style={{marginRight: '8px'}} /> Hire Request Sent</> : 'Send Hire Request & Enable AI'}
            </GlowButton>
          </div>

        </div>
      </div>

      {/* 7. HIRING DEAL FINALIZATION MODAL */}
      {hiringManager && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}>
          <div className="glow-card" style={{ width: '450px', background: '#0a0a0c', padding: '30px', position: 'relative', borderRadius: '16px', border: '1px solid var(--primary)' }}>
            <button onClick={() => {setHiringManager(null); setHirePrice('');}} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '24px' }}>&times;</button>
            
            <h3 style={{ fontSize: '20px', margin: '0 0 16px 0', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Hire {hiringManager.name}
            </h3>
            
            <div style={{ background: 'rgba(90,82,255,0.1)', border: '1px solid rgba(90,82,255,0.2)', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '12px', color: 'var(--primary)', lineHeight: '1.4' }}>
              <strong>RAFTRA SPECIALIST GUARANTEE:</strong> Verified specialists operate inside Raftra. Standard 10% platform commission applies to negotiated retainer.
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Final Negotiated Monthly Retainer (₹)</label>
              <input
                type="number"
                placeholder={`e.g. ${hiringManager.basePrice}`}
                value={hirePrice}
                onChange={e => setHirePrice(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', padding: '12px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--primary)', borderRadius: '8px', color: '#fff', outline: 'none', fontSize: '16px' }}
              />
            </div>

            {hirePrice && !isNaN(Number(hirePrice)) && (
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Retainer</span>
                  <span style={{ color: '#fff' }}>₹{parseFloat(hirePrice).toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Raftra AI Fee (10%)</span>
                  <span style={{ color: 'var(--primary)' }}>₹{(parseFloat(hirePrice) * 0.1).toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border)', fontSize: '14px', fontWeight: 600 }}>
                  <span style={{ color: '#fff' }}>Specialist Payout (90%)</span>
                  <span style={{ color: 'var(--success)' }}>₹{(parseFloat(hirePrice) * 0.9).toLocaleString('en-IN')}</span>
                </div>
              </div>
            )}

            <GlowButton 
              variant="glow" 
              onClick={() => {
                if (!hirePrice || isNaN(Number(hirePrice))) return;
                showToast(`SUCCESS! Deal Locked.\n₹${(parseFloat(hirePrice) * 0.1).toLocaleString('en-IN')} credited to Raftra AI.\n₹${(parseFloat(hirePrice) * 0.9).toLocaleString('en-IN')} escrowed for ${hiringManager.name}.\nSpecialist workspace assigned.`);
                handleDeploy(hiringManager.id);
                setHiringManager(null);
                setHirePrice('');
              }} 
              style={{ width: '100%', padding: '14px' }}
            >
              Lock Deal & Assign Specialist
            </GlowButton>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div style={{ position: 'fixed', bottom: '40px', right: '40px', background: 'var(--success)', color: '#000', padding: '16px 24px', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,230,118,0.3)', zIndex: 200, display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 600, maxWidth: '400px', lineHeight: '1.5', whiteSpace: 'pre-line' }}>
          <CheckCircle2 size={24} />
          {toastMessage}
        </div>
      )}

      {/* Toggle Switch CSS */}
      <style dangerouslySetInnerHTML={{__html: `
        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 36px;
          height: 20px;
        }
        .toggle-switch input { 
          opacity: 0;
          width: 0;
          height: 0;
        }
        .slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: var(--border);
          transition: .2s;
          border-radius: 34px;
        }
        .slider:before {
          position: absolute;
          content: "";
          height: 14px;
          width: 14px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: .2s;
          border-radius: 50%;
        }
        input:checked + .slider {
          background-color: var(--primary);
        }
        input:checked + .slider:before {
          transform: translateX(16px);
        }
        input:disabled + .slider {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}} />
    </div>
  );
};

// Helper Share2 icon wrapper to avoid variable collision
const Share2Icon: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = 'currentColor' }) => {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
};
