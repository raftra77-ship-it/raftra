import React, { useState } from 'react';
import { 
  Activity, Users, MessageCircle, Heart, Zap, Sparkles, UserCheck, 
  ShieldCheck, CheckCircle2, Briefcase, TrendingUp, Search, 
  Bot, DollarSign, Clock, ChevronRight, Send
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

interface EnquiryItem {
  id: string;
  specialistTitle: string;
  price: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  createdAt: string;
}

export const WorkspaceSocial: React.FC<WorkspaceSocialProps> = () => {
  const [selectedSpecialistIndex, setSelectedSpecialistIndex] = useState<number>(0);
  
  // Enquiry Modal state
  const [enquirySpecialist, setEnquirySpecialist] = useState<{id: string, name: string, price: string, basePrice: number} | null>(null);
  const [enquiryForm, setEnquiryForm] = useState({ name: '', email: '', phone: '', notes: '' });
  const [enquiriesList, setEnquiriesList] = useState<EnquiryItem[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Specialist Roles Data
  const specialistRoles = [
    {
      id: 'social',
      title: 'Social Media Manager',
      price: 'Starting from ₹25,000/month',
      basePrice: 25000,
      icon: Share2Icon,
      color: '#7C75FF',
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
      icon: TrendingUp,
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
      icon: Activity,
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

  const handleOpenEnquiry = (role: { id: string; title: string; price: string; basePrice: number }) => {
    setEnquirySpecialist({ id: role.id, name: role.title, price: role.price, basePrice: role.basePrice });
    setEnquiryForm({ name: '', email: '', phone: '', notes: '' });
  };

  const handleSubmitEnquiry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!enquirySpecialist) return;
    if (!enquiryForm.name || !enquiryForm.email || !enquiryForm.phone) {
      showToast('Please fill in your name, email, and phone number.');
      return;
    }

    const newEnquiry: EnquiryItem = {
      id: `enq_${Date.now()}`,
      specialistTitle: enquirySpecialist.name,
      price: enquirySpecialist.price,
      name: enquiryForm.name,
      email: enquiryForm.email,
      phone: enquiryForm.phone,
      notes: enquiryForm.notes,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setEnquiriesList(prev => [newEnquiry, ...prev]);
    showToast(`ENQUIRY SUBMITTED SUCCESSFULLY!\nEnquiry created for ${enquirySpecialist.name}.\nOur team will get in touch with you shortly.`);
    setEnquirySpecialist(null);
    setEnquiryForm({ name: '', email: '', phone: '', notes: '' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '36px', paddingBottom: '40px' }}>
      
      {/* 1. PAGE HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: 'rgba(124,117,255,0.12)', borderRadius: '100px', border: '1px solid rgba(124,117,255,0.3)', marginBottom: '12px' }}>
            <ShieldCheck size={14} color="#7C75FF" />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#7C75FF', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
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
      <div className="glow-card" style={{ padding: '32px', background: 'linear-gradient(135deg, rgba(124,117,255,0.1) 0%, rgba(10,10,14,0.95) 100%)', border: '1px solid rgba(124,117,255,0.3)', borderRadius: '20px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(124,117,255,0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: 'rgba(255,255,255,0.06)', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <Briefcase size={14} color="#7C75FF" />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>Hire a Raftra Specialist</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.3)', color: 'var(--success)', padding: '4px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
              <span style={{ background: 'rgba(124,117,255,0.2)', color: '#7C75FF', border: '1px solid rgba(124,117,255,0.3)', padding: '6px 14px', borderRadius: '100px', fontSize: '13px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Zap size={13} /> Faster execution
              </span>
              <span style={{ background: 'rgba(0,230,118,0.2)', color: 'var(--success)', border: '1px solid rgba(0,230,118,0.3)', padding: '6px 14px', borderRadius: '100px', fontSize: '13px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <DollarSign size={13} /> Lower costs
              </span>
              <span style={{ background: 'rgba(238,130,238,0.2)', color: 'violet', border: '1px solid rgba(238,130,238,0.3)', padding: '6px 14px', borderRadius: '100px', fontSize: '13px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
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
                  background: isSelected 
                    ? 'linear-gradient(180deg, #222232 0%, #0d0d15 100%)' 
                    : 'rgba(255,255,255,0.03)',
                  border: isSelected 
                    ? '1px solid rgba(255, 255, 255, 0.35)' 
                    : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  padding: '12px 18px',
                  color: isSelected ? '#fff' : 'rgba(255,255,255,0.65)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  whiteSpace: 'nowrap',
                  boxShadow: isSelected ? '0 4px 16px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.15)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <Icon size={16} color={isSelected ? '#ffffff' : 'rgba(255,255,255,0.45)'} />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '14px', fontWeight: isSelected ? 700 : 500 }}>{role.title}</div>
                  <div style={{ fontSize: '11px', color: isSelected ? '#00E676' : 'var(--text-muted)' }}>{role.price}</div>
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
              onClick={() => handleOpenEnquiry({ id: currentSpecialist.id, title: currentSpecialist.title, price: currentSpecialist.price, basePrice: currentSpecialist.basePrice })}
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
                  <Bot size={18} color="#7C75FF" />
                </div>
                <div>
                  <h5 style={{ fontSize: '16px', color: '#fff', margin: 0, fontWeight: 600 }}>What Raftra Automates</h5>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>60% – 80% automated repetitive work</span>
                </div>
              </div>

              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {currentSpecialist.automates.map((item, idx) => (
                  <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#e0e0e0' }}>
                    <CheckCircle2 size={16} color="#7C75FF" style={{ flexShrink: 0 }} />
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

      {/* 5. WHY HIRE THROUGH RAFTRA? SECTION WITH IMPROVED COLORS, SPACING & PADDING */}
      <div className="glow-card" style={{ padding: '36px 32px', background: 'linear-gradient(180deg, #0f0f18 0%, #08080d 100%)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 16px', background: 'rgba(124,117,255,0.15)', borderRadius: '100px', border: '1px solid rgba(124,117,255,0.3)', marginBottom: '14px' }}>
            <Zap size={14} color="#7C75FF" />
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Raftra Advantage
            </span>
          </div>
          <h3 style={{ fontSize: '28px', fontFamily: 'var(--font-heading)', color: '#ffffff', margin: '0 0 10px 0', fontWeight: 700 }}>
            Why Hire Through Raftra?
          </h3>
          <p style={{ color: '#b0b0cc', fontSize: '15px', maxWidth: '720px', margin: '0 auto', lineHeight: 1.6 }}>
            Compare how traditional agencies operate versus Raftra's AI-native specialist workflow.
          </p>
        </div>

        {/* Workflow Comparison Diagram */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px', marginBottom: '40px' }}>
          
          {/* Traditional Agency */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '28px 24px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#8888aa', textTransform: 'uppercase', marginBottom: '20px', letterSpacing: '0.06em' }}>
              Traditional Agency
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {['Audit', 'Manual Work', 'Reports', 'Meetings', 'Changes'].map((step, i, arr) => (
                <React.Fragment key={i}>
                  <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', padding: '14px 18px', borderRadius: '12px', color: '#cccccc', fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{step}</span>
                    <span style={{ fontSize: '11px', color: '#777799', fontWeight: 600, background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>Manual</span>
                  </div>
                  {i < arr.length - 1 && (
                    <div style={{ textAlign: 'center', color: '#555577', fontSize: '14px', margin: '2px 0' }}>↓</div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* With Raftra (IMPROVED HIGH-CONTRAST COLORS, SPACING & PADDING) */}
          <div style={{ background: 'linear-gradient(180deg, rgba(90,82,255,0.12) 0%, rgba(90,82,255,0.04) 100%)', border: '1px solid rgba(124,117,255,0.4)', borderRadius: '20px', padding: '28px 24px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} color="#7C75FF" /> With Raftra
              </div>
              <span style={{ background: 'rgba(0,230,118,0.2)', border: '1px solid rgba(0,230,118,0.4)', color: '#00E676', padding: '4px 12px', borderRadius: '100px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em' }}>
                HIGH EFFICIENCY
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { title: 'AI Audits', desc: 'Instant 24/7 scanning' },
                { title: 'AI Recommendations', desc: 'Data-driven insights' },
                { title: 'One-click Publishing', desc: 'Seamless deployment' },
                { title: 'Live Analytics', desc: 'Real-time monitoring' },
                { title: 'Specialist focuses only on strategy', desc: '100% high-leverage decisions' }
              ].map((step, i, arr) => {
                const isLast = i === arr.length - 1;
                return (
                  <React.Fragment key={i}>
                    <div style={{ 
                      background: isLast ? 'linear-gradient(135deg, rgba(0,230,118,0.18) 0%, rgba(0,230,118,0.08) 100%)' : 'rgba(255,255,255,0.06)', 
                      border: isLast ? '1px solid rgba(0,230,118,0.5)' : '1px solid rgba(124,117,255,0.25)',
                      padding: '14px 18px', 
                      borderRadius: '12px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justify: 'space-between',
                      gap: '12px'
                    }}>
                      <span style={{ fontSize: '14px', fontWeight: isLast ? 700 : 600, color: isLast ? '#00E676' : '#ffffff' }}>
                        {step.title}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 500, color: isLast ? '#76FFB7' : '#B0B0CC', whiteSpace: 'nowrap' }}>
                        {step.desc}
                      </span>
                    </div>
                    {!isLast && (
                      <div style={{ display: 'flex', justifyContent: 'center', margin: '2px 0' }}>
                        <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(124,117,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7C75FF', fontSize: '12px', fontWeight: 'bold' }}>
                          ↓
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

        </div>

        {/* Why it matters Grid */}
        <div>
          <h4 style={{ fontSize: '16px', color: '#ffffff', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
            Why It Matters
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
            {[
              { icon: Zap, text: 'Up to 70% less repetitive work', color: '#7C75FF' },
              { icon: Clock, text: 'AI handles monitoring 24/7', color: 'violet' },
              { icon: UserCheck, text: 'Specialists focus on decisions, not data collection', color: '#00E676' },
              { icon: DollarSign, text: 'Lower cost than a traditional agency', color: '#FFBD2E' },
              { icon: Bot, text: 'Every specialist is trained on Raftra\'s AI workflows', color: '#7C75FF' },
              { icon: TrendingUp, text: 'Faster campaign execution and optimization', color: '#FF5296' }
            ].map((item, idx) => {
              const ItemIcon = item.icon;
              return (
                <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', padding: '18px 22px', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '38px', height: '38px', background: `${item.color}20`, borderRadius: '10px', border: `1px solid ${item.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ItemIcon size={18} color={item.color} />
                  </div>
                  <span style={{ color: '#ffffff', fontSize: '14px', fontWeight: 500, lineHeight: 1.4 }}>
                    {item.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* SUBMITTED ENQUIRIES LIST (IF ANY EXIST) */}
      {enquiriesList.length > 0 && (
        <div className="glow-card" style={{ padding: '28px', background: 'rgba(0,230,118,0.03)', border: '1px solid rgba(0,230,118,0.2)', borderRadius: '16px' }}>
          <h3 style={{ fontSize: '18px', color: '#fff', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle2 size={20} color="var(--success)" /> Submitted Specialist Enquiries ({enquiriesList.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {enquiriesList.map(enq => (
              <div key={enq.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#fff' }}>{enq.specialistTitle}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {enq.name} • {enq.email} • {enq.phone}
                  </div>
                  {enq.notes && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Brief: {enq.notes}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ background: 'rgba(0,230,118,0.15)', color: 'var(--success)', padding: '4px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 600 }}>Enquiry Sent</span>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{enq.createdAt}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. ENQUIRY CREATION MODAL */}
      {enquirySpecialist && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}>
          <div className="glow-card" style={{ width: '480px', maxWidth: '90%', background: '#0a0a0c', padding: '32px', position: 'relative', borderRadius: '20px', border: '1px solid #7C75FF' }}>
            <button onClick={() => setEnquirySpecialist(null)} style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '24px' }}>&times;</button>
            
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', color: '#7C75FF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                SPECIALIST ENQUIRY
              </div>
              <h3 style={{ fontSize: '22px', margin: '0 0 6px 0', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
                Hire {enquirySpecialist.name}
              </h3>
              <div style={{ fontSize: '14px', color: 'var(--success)', fontWeight: 600 }}>
                {enquirySpecialist.price}
              </div>
            </div>

            <form onSubmit={handleSubmitEnquiry} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#ccc', marginBottom: '6px', fontWeight: 500 }}>Your Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={enquiryForm.name}
                  onChange={e => setEnquiryForm(f => ({ ...f, name: e.target.value }))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '100px', color: '#fff', outline: 'none', fontSize: '14px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#ccc', marginBottom: '6px', fontWeight: 500 }}>Work Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="rahul@brand.com"
                    value={enquiryForm.email}
                    onChange={e => setEnquiryForm(f => ({ ...f, email: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '100px', color: '#fff', outline: 'none', fontSize: '14px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#ccc', marginBottom: '6px', fontWeight: 500 }}>Phone / WhatsApp *</label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 9876543210"
                    value={enquiryForm.phone}
                    onChange={e => setEnquiryForm(f => ({ ...f, phone: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '100px', color: '#fff', outline: 'none', fontSize: '14px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#ccc', marginBottom: '6px', fontWeight: 500 }}>Requirements / Brand Brief (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Tell us about your brand goals and what assistance you need..."
                  value={enquiryForm.notes}
                  onChange={e => setEnquiryForm(f => ({ ...f, notes: e.target.value }))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '14px', color: '#fff', outline: 'none', fontSize: '14px', resize: 'vertical' }}
                />
              </div>

              <div style={{ background: 'rgba(124,117,255,0.08)', border: '1px solid rgba(124,117,255,0.2)', padding: '12px 16px', borderRadius: '100px', fontSize: '12px', color: '#b0b0cc', lineHeight: 1.4 }}>
                <strong>RAFTRA VERIFIED GUARANTEE:</strong> Specialist will be assigned to your Raftra workspace within 24 hours of enquiry confirmation.
              </div>

              <GlowButton 
                variant="glow" 
                style={{ width: '100%', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <Send size={16} /> Submit Specialist Enquiry
              </GlowButton>
            </form>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div style={{ position: 'fixed', bottom: '40px', right: '40px', background: 'var(--success)', color: '#000', padding: '16px 24px', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,230,118,0.3)', zIndex: 200, display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 600, maxWidth: '420px', lineHeight: '1.5', whiteSpace: 'pre-line' }}>
          <CheckCircle2 size={24} style={{ flexShrink: 0 }} />
          <div>{toastMessage}</div>
        </div>
      )}
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
