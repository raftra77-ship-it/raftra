import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase,
  MapPin,
  Clock,
  Sparkles,
  Zap,
  CheckCircle2,
  Award,
  Heart,
  Globe,
  Rocket,
  ArrowRight,
  X,
  Upload,
  Check,
  Building,
  Users2,
  Cpu,
  GraduationCap,
  FileCheck2
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { GlowButton } from '../components/GlowButton';

interface InternshipRole {
  id: string;
  title: string;
  department: 'Engineering' | 'Growth & Marketing' | 'Product & Design';
  location: string;
  duration: string;
  stipend: string;
  perks: string;
  summary: string;
  responsibilities: string[];
  learningOutcomes: string[];
}

export const CareersPage: React.FC = () => {
  const [selectedDept, setSelectedDept] = useState<string>('All');
  const [selectedRole, setSelectedRole] = useState<InternshipRole | null>(null);
  const [applyRole, setApplyRole] = useState<InternshipRole | null>(null);
  const [applicantName, setApplicantName] = useState('');
  const [applicantEmail, setApplicantEmail] = useState('');
  const [applicantPhone, setApplicantPhone] = useState('');
  const [applicantCollege, setApplicantCollege] = useState('');
  const [applicantResumeUrl, setApplicantResumeUrl] = useState('');
  const [applicantNote, setApplicantNote] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const internshipRoles: InternshipRole[] = [
    {
      id: 'intern-1',
      title: 'AI & LLM Systems Engineering Intern',
      department: 'Engineering',
      location: 'Remote (India)',
      duration: '3 Months (Flexible)',
      stipend: 'Unpaid Internship',
      perks: 'Certificate of Internship + Verified LOR + PPO Opportunity',
      summary: 'Work directly on autonomous agent graphs, LangChain/LangGraph orchestration, and Meta/Google ad API integrations.',
      responsibilities: [
        'Assist in building and testing multi-agent state machines for creative copy and visual asset generation.',
        'Optimize retrieval-augmented generation (RAG) pipelines and prompt evaluations for D2C brand kits.',
        'Collaborate on React/TypeScript frontend widgets and FastAPI Python microservices.',
        'Participate in daily engineering standups and code reviews with core founding team.'
      ],
      learningOutcomes: [
        'Production experience deploying modern LLM agent frameworks and vector search.',
        'Mastery of high-performance TypeScript, React state management, and async Python.',
        'Letter of Recommendation and Pre-Placement Offer consideration based on milestone completion.'
      ]
    },
    {
      id: 'intern-2',
      title: 'Growth & Performance Marketing Intern',
      department: 'Growth & Marketing',
      location: 'Remote (India)',
      duration: '3 Months (Flexible)',
      stipend: 'Unpaid Internship',
      perks: 'Certificate of Internship + Verified LOR + PPO Opportunity',
      summary: 'Analyze competitor Meta & Google Ad Library libraries, extract high-converting UGC angles, and benchmark ROAS scaling playbooks.',
      responsibilities: [
        'Conduct weekly ad audits of top consumer electronics and lifestyle D2C brands in India.',
        'Formulate problem-agitation hooks, 15-second vertical reel scripts, and creative brief templates.',
        'Track emerging Answer Engine Optimization (AEO) search queries across ChatGPT and Perplexity.',
        'Assist in creator outreach, rate card compilation, and UGC deliverable review workflows.'
      ],
      learningOutcomes: [
        'Deep practical knowledge of D2C performance marketing metrics, CPA targets, and ROAS curves.',
        'Experience with autonomous ad tools and creator escrow operations.',
        'Strong founder mentorship with direct letter of recommendation.'
      ]
    },
    {
      id: 'intern-3',
      title: 'UI/UX & Product Design Intern',
      department: 'Product & Design',
      location: 'Remote (India)',
      duration: '3 Months (Flexible)',
      stipend: 'Unpaid Internship',
      perks: 'Certificate of Internship + Verified LOR + PPO Opportunity',
      summary: 'Craft futuristic dark-mode interfaces, interactive canvas components, and design system variables for Raftra web applications.',
      responsibilities: [
        'Design sleek component states, toolbars, and micro-interactions in Figma using our modern design tokens.',
        'Collaborate with developers to ensure pixel-perfect CSS implementation and fluid responsive behavior.',
        'Create visual assets, diagrams, and carousel mockups for brand knowledge base documentation.',
        'Gather user feedback to iterate on friction points across onboarding and campaign deployment.'
      ],
      learningOutcomes: [
        'A standout real-world portfolio piece featuring complex SaaS product design.',
        'Hands-on experience with design-to-code translation and dark-mode aesthetic systems.',
        'Official certificate and recommendation letter from leadership.'
      ]
    }
  ];

  const departments = ['All', 'Engineering', 'Growth & Marketing', 'Product & Design'];

  const filteredRoles = internshipRoles.filter(role => {
    if (selectedDept !== 'All' && role.department !== selectedDept) return false;
    return true;
  });

  const handleSubmitApplication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!applicantName || !applicantEmail) return;
    setIsSubmitted(true);
    setTimeout(() => {
      setIsSubmitted(false);
      setApplyRole(null);
      setApplicantName('');
      setApplicantEmail('');
      setApplicantPhone('');
      setApplicantCollege('');
      setApplicantResumeUrl('');
      setApplicantNote('');
      alert('✓ Internship application received! Our team will review your submission and reach out via email within 48 hours.');
    }, 1800);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#050508', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{ flex: 1, maxWidth: '1200px', margin: '0 auto', padding: '120px 24px 80px 24px', width: '100%', boxSizing: 'border-box' }}>
        
        {/* ── HERO BANNER ────────────────────────────────────────── */}
        <div style={{ textAlign: 'center', maxWidth: '780px', margin: '0 auto 48px auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '5px 14px', background: 'rgba(0, 230, 118, 0.12)', borderRadius: '100px', border: '1px solid rgba(0, 230, 118, 0.3)', marginBottom: '16px' }}>
            <GraduationCap size={14} color="#00E676" />
            <span style={{ fontSize: '12px', color: '#00E676', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              INTERNSHIP PROGRAM & CAREERS
            </span>
          </div>

          <h1 style={{ fontSize: 'clamp(32px, 5vw, 48px)', color: '#fff', margin: '0 0 16px 0', fontWeight: 900, fontFamily: 'var(--font-heading)', lineHeight: 1.15 }}>
            Learn & Build the Future of <span style={{ color: '#7C75FF' }}>Autonomous AI Marketing</span>
          </h1>

          <p style={{ fontSize: '16px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            Gain real production experience working on cutting-edge agent graphs, performance marketing pipelines, and modern design systems.
          </p>
        </div>

        {/* ── INTERNSHIP PERKS STRIP ─────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: '16px', marginBottom: '56px' }}>
          {[
            { icon: <FileCheck2 size={20} color="#00E676" />, title: 'Verified Certificate & LOR', desc: 'Receive an official Certificate of Internship and personalized Letter of Recommendation.' },
            { icon: <Globe size={20} color="#00D2FF" />, title: '100% Remote & Flexible', desc: 'Work flexibly from your college or home with asynchronous team coordination.' },
            { icon: <Award size={20} color="#FFB300" />, title: 'PPO Opportunities', desc: 'Top-performing interns are fast-tracked for full-time Pre-Placement Offers.' },
            { icon: <Cpu size={20} color="#7C75FF" />, title: 'Real Production Systems', desc: 'Ship features to real D2C brand dashboards rather than toy demo projects.' }
          ].map((perk, idx) => (
            <div key={idx} className="glow-card" style={{ background: '#0a0a12', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '18px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' }}>
                {perk.icon}
              </div>
              <h3 style={{ fontSize: '16px', color: '#fff', margin: 0, fontWeight: 700 }}>{perk.title}</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>{perk.desc}</p>
            </div>
          ))}
        </div>

        {/* ── ROLES HEADING & FILTER ─────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '24px', color: '#fff', margin: '0 0 4px 0', fontWeight: 800 }}>
              Open Internship Roles ({filteredRoles.length})
            </h2>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: 0 }}>
              Apply for a 3-month remote internship with direct founder mentorship.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {departments.map((dept) => {
              const isActive = selectedDept === dept;
              return (
                <button
                  key={dept}
                  onClick={() => setSelectedDept(dept)}
                  style={{
                    background: isActive ? 'linear-gradient(135deg, #00E676 0%, #00C853 100%)' : 'rgba(255, 255, 255, 0.04)',
                    border: isActive ? '1px solid #00E676' : '1px solid rgba(255, 255, 255, 0.1)',
                    color: isActive ? '#000' : 'var(--text-secondary)',
                    padding: '8px 18px',
                    borderRadius: '100px',
                    fontSize: '13px',
                    fontWeight: isActive ? 800 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {dept}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── INTERNSHIP ROLES LIST ──────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredRoles.map((role) => (
            <div
              key={role.id}
              className="glow-card"
              style={{
                background: '#0a0a12',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '20px',
                padding: '24px 28px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '18px',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '660px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: '18px', color: '#fff', margin: 0, fontWeight: 800 }}>
                    {role.title}
                  </h3>
                  <span style={{ fontSize: '11px', background: 'rgba(124, 117, 255, 0.15)', color: '#7C75FF', border: '1px solid rgba(124, 117, 255, 0.3)', padding: '2px 8px', borderRadius: '100px', fontWeight: 700 }}>
                    {role.department}
                  </span>
                </div>

                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  {role.summary}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={13} color="#00D2FF" /> {role.location}</span>
                  <span>•</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={13} /> {role.duration} ({role.stipend})</span>
                  <span>•</span>
                  <span style={{ color: '#00E676', fontWeight: 700 }}>{role.perks}</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={() => setSelectedRole(role)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#fff',
                    padding: '8px 18px',
                    borderRadius: '100px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  View Details
                </button>

                <GlowButton
                  variant="glow"
                  onClick={() => setApplyRole(role)}
                  style={{ fontSize: '12.5px', padding: '8px 22px' }}
                >
                  Apply Now
                </GlowButton>
              </div>
            </div>
          ))}
        </div>

      </main>

      {/* ── ROLE DETAILS MODAL ───────────────────────────────────── */}
      <AnimatePresence>
        {selectedRole && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} style={{ width: '100%', maxWidth: '680px', maxHeight: '88vh', background: '#0a0a12', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '24px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#00E676', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>{selectedRole.department}</span>
                  <h2 style={{ fontSize: '22px', color: '#fff', margin: '4px 0 0 0', fontWeight: 800 }}>{selectedRole.title}</h2>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>{selectedRole.duration} • {selectedRole.stipend} • {selectedRole.location}</div>
                </div>
                <button onClick={() => setSelectedRole(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={18} /></button>
              </div>

              <div>
                <h4 style={{ fontSize: '14px', color: '#fff', margin: '0 0 8px 0', fontWeight: 700 }}>What You'll Work On:</h4>
                <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {selectedRole.responsibilities.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>

              <div>
                <h4 style={{ fontSize: '14px', color: '#fff', margin: '0 0 8px 0', fontWeight: 700 }}>What You'll Gain:</h4>
                <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {selectedRole.learningOutcomes.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
                <button onClick={() => setSelectedRole(null)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '9px 18px', borderRadius: '100px', fontSize: '13px', cursor: 'pointer' }}>Close</button>
                <GlowButton variant="glow" onClick={() => { const r = selectedRole; setSelectedRole(null); setApplyRole(r); }} style={{ fontSize: '13px', padding: '9px 24px' }}>Apply For Internship</GlowButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── 1-CLICK APPLY MODAL ──────────────────────────────────── */}
      <AnimatePresence>
        {applyRole && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} style={{ width: '100%', maxWidth: '520px', background: '#0a0a12', border: '1px solid rgba(0, 230, 118, 0.35)', borderRadius: '24px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.85)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#00E676', fontWeight: 800, textTransform: 'uppercase' }}>INTERNSHIP APPLICATION</span>
                  <h3 style={{ fontSize: '18px', color: '#fff', margin: '2px 0 0 0', fontWeight: 800 }}>{applyRole.title}</h3>
                </div>
                <button onClick={() => setApplyRole(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={18} /></button>
              </div>

              <form onSubmit={handleSubmitApplication} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Full Name</label>
                  <input type="text" required placeholder="Aarav Sharma" value={applicantName} onChange={e => setApplicantName(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: '#fff', fontSize: '13.5px' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Email</label>
                    <input type="email" required placeholder="aarav@college.edu" value={applicantEmail} onChange={e => setApplicantEmail(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: '#fff', fontSize: '13.5px' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Phone / WhatsApp</label>
                    <input type="tel" placeholder="+91 98765 43210" value={applicantPhone} onChange={e => setApplicantPhone(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: '#fff', fontSize: '13.5px' }} />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>College / University & Year</label>
                  <input type="text" placeholder="e.g. IIT Delhi / B.Tech 3rd Year" value={applicantCollege} onChange={e => setApplicantCollege(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: '#fff', fontSize: '13.5px' }} />
                </div>

                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Resume / GitHub / Portfolio Link</label>
                  <input type="url" required placeholder="https://github.com/username or Google Drive link" value={applicantResumeUrl} onChange={e => setApplicantResumeUrl(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: '#fff', fontSize: '13.5px' }} />
                </div>

                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Why are you interested in this internship?</label>
                  <textarea rows={2} placeholder="Brief note on what you want to learn and build..." value={applicantNote} onChange={e => setApplicantNote(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: '#fff', fontSize: '13px' }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                  <button type="button" onClick={() => setApplyRole(null)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '9px 18px', borderRadius: '100px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                  <GlowButton variant="glow" type="submit" style={{ padding: '9px 24px', fontSize: '13px' }}>
                    {isSubmitted ? 'Submitting...' : 'Submit Application'}
                  </GlowButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
};
