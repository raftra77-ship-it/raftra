import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Share2, Bot, CheckCircle2, Calendar, MessageCircle, TrendingUp, Image as ImageIcon, 
  Briefcase, Video, Loader2, Check, ArrowRight, UserCheck, ShieldCheck, Zap,
  FileText, Award, DollarSign, Users, Sparkles
} from 'lucide-react';
import { GlowButton } from '../../components/GlowButton';
import { useNavigate } from 'react-router-down';

export const FeatureSocial = () => {
  const navigate = useNavigate();
  const [specialistHired, setSpecialistHired] = useState(false);

  const availableSpecialists = [
    {
      title: "SEO & GEO Specialist",
      desc: "Improve your Google rankings and AI search visibility through technical optimization, content strategy, authority building, and continuous performance improvements.",
      icon: <TrendingUp size={28} color="#00E676" />
    },
    {
      title: "Paid Ads Specialist",
      desc: "Launch, optimize, and scale Meta and Google advertising campaigns using Raftra's Campaign Manager and AI recommendations.",
      icon: <Zap size={28} color="#FFB300" />
    },
    {
      title: "Social Media Manager",
      desc: "Plan content calendars, schedule posts, manage engagement, monitor performance, and grow your brand presence using Raftra Social Hub.",
      icon: <Share2 size={28} color="#7C75FF" />
    },
    {
      title: "Technical SEO Expert",
      desc: "Handle advanced website optimization including indexing, schema, crawlability, Core Web Vitals, structured data, redirects, and technical troubleshooting.",
      icon: <ShieldCheck size={28} color="#00D2FF" />
    },
    {
      title: "Digital PR Specialist",
      desc: "Build brand authority through media outreach, press mentions, partnerships, and high-quality editorial backlinks.",
      icon: <Award size={28} color="#FF5296" />
    },
    {
      title: "CRO Specialist",
      desc: "Improve landing pages, user journeys, conversion funnels, and customer experience to increase leads and sales.",
      icon: <BarChart3Icon size={28} color="#A855F7" />
    },
    {
      title: "Landing Page Designer",
      desc: "Design and optimize high-converting landing pages tailored to your campaigns, products, and business goals.",
      icon: <ImageIcon size={28} color="#FFBD2E" />
    }
  ];

  const whatYouCanDo = [
    {
      title: "Hire On Demand",
      desc: "Choose specialists only when you need them. No long-term contracts or agency retainer locks.",
      icon: <Briefcase size={28} color="#00D2FF" />
    },
    {
      title: "Work Inside Raftra",
      desc: "Every specialist works directly inside your Raftra workspace using your connected data, campaigns, and AI insights.",
      icon: <UserCheck size={28} color="#00E676" />
    },
    {
      title: "Track Progress",
      desc: "Monitor tasks, milestones, updates, and completed work in real time from your live workspace feed.",
      icon: <Calendar size={28} color="#FFB300" />
    },
    {
      title: "Collaborate Easily",
      desc: "Communicate directly with specialists through Raftra secure workspace chat without relying on external tools.",
      icon: <MessageCircle size={28} color="#7C75FF" />
    },
    {
      title: "Measure Results",
      desc: "Review completed work alongside measurable business outcomes and live ROAS from your dashboards.",
      icon: <TrendingUp size={28} color="#FF5296" />
    }
  ];

  const featuresIncluded = [
    "Verified Marketing Professionals", "Expert Profiles & Portfolios", "Experience & Industry Filters",
    "Hire On Demand", "Secure Chat", "Shared Workspace", "Task Management", "Progress Tracking",
    "Deliverable Review", "Campaign Collaboration", "Performance Reports", "Team Collaboration",
    "Priority Support"
  ];

  const howItWorksFlow = [
    { step: "01", title: "Browse Verified Specialists", desc: "Filter by skill: SEO, Paid Ads, Social Media, PR, CRO." },
    { step: "02", title: "View Portfolios & Ratings", desc: "Compare experience, client reviews, pricing & case studies." },
    { step: "03", title: "Hire & Grant Workspace Access", desc: "Specialist is added directly to your Raftra workspace." },
    { step: "04", title: "Execution via Platform Tools", desc: "Specialist uses your connected campaigns, SEO & AI data." },
    { step: "05", title: "Track Deliverables & Progress", desc: "Monitor real-time task completion and request revisions." },
    { step: "06", title: "Measure Growth Impact", desc: "Review revenue, rankings & campaign performance lift." }
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
          <Briefcase size={18} color="#7C75FF" />
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#7C75FF', letterSpacing: '0.06em', textTransform: 'uppercase' }}>EXTENDED MARKETING TEAM</span>
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} 
          style={{ fontSize: '60px', fontFamily: 'var(--font-heading)', margin: '0 0 24px 0', background: 'linear-gradient(to right, #fff, rgba(255,255,255,0.8))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.15, fontWeight: 800 }}
        >
          Your Extended Marketing Team — Powered by Raftra
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} 
          style={{ color: 'var(--text-secondary)', fontSize: '22px', maxWidth: '1050px', margin: '0 auto 40px auto', lineHeight: 1.6 }}
        >
          Need expert execution beyond AI? Hire certified specialists who work directly inside your Raftra workspace to plan, execute, optimize, and report on your marketing activities—without juggling multiple agencies or tools.
        </motion.p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <GlowButton variant="glow" onClick={() => navigate('/dashboard')} style={{ fontSize: '17px', padding: '16px 36px' }}>
            Hire a Specialist <ArrowRight size={18} />
          </GlowButton>
        </div>
      </div>

      {/* STREAMLINED WORKSPACE OVERVIEW */}
      <section style={{ marginBottom: '80px' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(124, 117, 255, 0.08) 0%, rgba(10, 10, 16, 0.98) 100%)',
          border: '1px solid rgba(124, 117, 255, 0.3)',
          borderRadius: '24px',
          padding: '44px 56px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
        }}>
          <h2 style={{ fontSize: '32px', fontFamily: 'var(--font-heading)', margin: '0 0 20px 0', color: '#fff', fontWeight: 800 }}>
            Certified Specialists Working Inside Your Workspace
          </h2>
          <p style={{ fontSize: '18.5px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, margin: '0 0 24px 0' }}>
            Expert Services gives you instant access to experienced marketing professionals whenever you need them. Whether you're looking to scale SEO, manage paid ads, grow social media, improve conversion rates, or launch a digital PR campaign, Raftra connects you with specialists already trained on the platform.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '17px', color: '#00E676', fontWeight: 600 }}>
            <CheckCircle2 size={22} color="#00E676" style={{ flexShrink: 0 }} /> 
            <span>Instead of hiring a full in-house team or coordinating between freelancers, every specialist works directly inside your Raftra workspace using your connected data, campaigns, and AI insights.</span>
          </div>
        </div>
      </section>

      {/* AVAILABLE SPECIALISTS (7 CARDS GRID) */}
      <section style={{ marginBottom: '80px' }}>
        <div style={{ textAlign: 'center', marginBottom: '44px' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#7C75FF', letterSpacing: '0.12em', textTransform: 'uppercase' }}>CERTIFIED EXPERTS</span>
          <h2 style={{ fontSize: '42px', fontFamily: 'var(--font-heading)', marginTop: '8px', fontWeight: 800 }}>Available Specialists</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '28px' }}>
          {availableSpecialists.map((item, idx) => (
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

      {/* HOW IT WORKS: CONNECTED ARROW STEPPER */}
      <section style={{ marginBottom: '80px' }}>
        <div style={{ textAlign: 'center', marginBottom: '44px' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#7C75FF', letterSpacing: '0.12em', textTransform: 'uppercase' }}>WORKFLOW FLOW</span>
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

      {/* WHY BUSINESSES CHOOSE EXPERT SERVICES */}
      <section style={{ marginBottom: '80px', padding: '48px 56px', background: 'rgba(0,230,118,0.04)', border: '1px solid rgba(0,230,118,0.25)', borderRadius: '24px' }}>
        <div style={{ marginBottom: '32px' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#00E676', letterSpacing: '0.12em', textTransform: 'uppercase' }}>ADVANTAGES</span>
          <h2 style={{ fontSize: '38px', fontFamily: 'var(--font-heading)', marginTop: '8px', fontWeight: 800 }}>Why Businesses Choose Expert Services</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          {[
            "No need to hire or manage a full in-house marketing team",
            "Specialists are already trained on Raftra tools & AI workflows",
            "Faster onboarding and immediate campaign execution",
            "All work happens inside your single shared workspace",
            "Real-time visibility into active task progress & deliverables",
            "Data-driven decisions backed by live campaigns & analytics",
            "Flexibility to scale your marketing team whenever required"
          ].map((adv, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <CheckCircle2 size={22} color="#00E676" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '17px', fontWeight: 600, color: '#fff' }}>{adv}</span>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES INCLUDED LIST (STREAMLINED 2-COLUMN LIST) */}
      <section style={{ marginBottom: '80px', background: 'rgba(255,255,255,0.02)', borderRadius: '24px', padding: '48px 56px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ marginBottom: '32px' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#7C75FF', letterSpacing: '0.12em', textTransform: 'uppercase' }}>FULL INVENTORY</span>
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

      {/* REAL DASHBOARD EXPERT SERVICES INTERACTIVE PREVIEW */}
      <section style={{ marginBottom: '80px', marginTop: '40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#7C75FF', letterSpacing: '0.12em', textTransform: 'uppercase' }}>INTERACTIVE DASHBOARD PREVIEW</span>
          <h2 style={{ fontSize: '38px', fontFamily: 'var(--font-heading)', marginTop: '8px', fontWeight: 800 }}>Explore Expert Services Workspace</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '17px' }}>Live specialist task progress & shared workspace UI inside Raftra AI.</p>
        </div>

        <div style={{ background: '#0a0a0d', borderRadius: '24px', border: '1px solid rgba(124,117,255,0.3)', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>
          
          {/* Top Dashboard Header Bar */}
          <div style={{ padding: '20px 32px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Briefcase size={20} color="#7C75FF" />
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#fff' }}>Expert Services Hub</span>
              </div>
              <span style={{ fontSize: '12px', background: 'rgba(0,230,118,0.12)', color: '#00E676', border: '1px solid rgba(0,230,118,0.3)', padding: '4px 12px', borderRadius: '100px', fontWeight: 700 }}>
                ● Active Specialist: Technical SEO Expert
              </span>
            </div>

            <div style={{ fontSize: '14px', color: '#7C75FF', fontWeight: 700 }}>
              20% Platform Commission on Completed Contracts
            </div>
          </div>

          {/* Live Active Specialist Task Panel */}
          <div style={{ padding: '32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
            
            {/* Active Specialist Card */}
            <div style={{ background: 'linear-gradient(135deg, rgba(20,20,32,0.9), rgba(10,10,16,0.98))', border: '1px solid rgba(124,117,255,0.3)', borderRadius: '20px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                  <div style={{ width: '54px', height: '54px', borderRadius: '50%', background: 'linear-gradient(135deg, #7C75FF, #00E676)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 900, color: '#000' }}>
                    AK
                  </div>
                  <div>
                    <h4 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#fff' }}>Aman K.</h4>
                    <span style={{ fontSize: '13px', color: '#7C75FF', fontWeight: 600 }}>Senior Technical SEO & GEO Specialist</span>
                  </div>
                </div>

                <span style={{ background: 'rgba(0,230,118,0.15)', color: '#00E676', border: '1px solid rgba(0,230,118,0.4)', padding: '4px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: 800 }}>
                  🟢 WORKSPACE ACTIVE
                </span>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#aaa' }}>Current Task: <strong style={{ color: '#fff' }}>Technical SEO Optimization</strong></span>
                  <span style={{ color: '#00E676', fontWeight: 800 }}>76% Completed</span>
                </div>
                <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '100px', overflow: 'hidden' }}>
                  <div style={{ width: '76%', height: '100%', background: '#00E676' }}></div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', textAlign: 'center', fontSize: '14px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '11px', color: '#888' }}>TASKS DONE</div>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: '#fff' }}>18 Finished</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '11px', color: '#888' }}>PENDING REVIEW</div>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: '#FFB300' }}>2 Items</div>
                </div>
              </div>

              <button 
                onClick={() => setSpecialistHired(!specialistHired)}
                style={{
                  padding: '12px',
                  background: specialistHired ? '#00E676' : 'linear-gradient(135deg, #7C75FF 0%, #5A52FF 100%)',
                  color: specialistHired ? '#000' : '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {specialistHired ? <CheckCircle2 size={16} /> : <Zap size={16} />}
                {specialistHired ? 'Specialist Active in Workspace!' : 'Hire a Specialist (1-Click)'}
              </button>
            </div>

            {/* Pricing Model & Engagement Overview */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#7C75FF', letterSpacing: '0.08em', marginBottom: '12px' }}>FLEXIBLE ENGAGEMENT MODELS</div>
                <h4 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 16px 0', color: '#fff' }}>Pay-As-You-Hire</h4>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '15.5px' }}>
                  <li style={{ color: '#fff' }}>✓ Monthly Retainer (Dedicated Dedicated Specialist)</li>
                  <li style={{ color: '#fff' }}>✓ One-Time Projects (Audits, Setup & Redesign)</li>
                  <li style={{ color: '#fff' }}>✓ Campaign-Based Engagements (Scale High-ROAS Ads)</li>
                </ul>
              </div>

              <button 
                onClick={() => navigate('/dashboard')}
                style={{ marginTop: '20px', padding: '12px 24px', background: '#7C75FF', color: '#fff', borderRadius: '10px', fontWeight: 800, fontSize: '14px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                Browse Experts in Dashboard <ArrowRight size={16} />
              </button>
            </div>

          </div>

        </div>
      </section>

      {/* FINAL CTA SECTION */}
      <section style={{ textAlign: 'center', padding: '72px 40px', background: 'linear-gradient(180deg, rgba(124,117,255,0.12), rgba(10,10,16,0.98))', borderRadius: '28px', border: '1px solid rgba(124,117,255,0.35)' }}>
        <h2 style={{ fontSize: '44px', fontFamily: 'var(--font-heading)', marginBottom: '18px', fontWeight: 800 }}>
          Need More Than Software? Add Experts to Your Team.
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '20px', maxWidth: '850px', margin: '0 auto 36px auto', lineHeight: 1.6 }}>
          Combine AI-powered workflows with experienced marketing professionals who execute directly inside your Raftra workspace—so you can grow faster without building an in-house team.
        </p>
        <GlowButton variant="glow" onClick={() => navigate('/dashboard')} style={{ margin: '0 auto', fontSize: '17px', padding: '16px 40px' }}>
          Hire a Specialist <ArrowRight size={20} />
        </GlowButton>
      </section>

    </div>
  );
};

// Helper BarChart3Icon component
function BarChart3Icon(props: any) {
  return <TrendingUp {...props} />;
}
