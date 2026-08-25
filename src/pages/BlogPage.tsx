import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  ArrowRight,
  Sparkles,
  Clock,
  User,
  Search,
  Tag,
  Share2,
  Bookmark,
  ChevronRight,
  TrendingUp,
  Zap,
  ArrowLeft,
  X,
  CheckCircle2,
  Cpu,
  Globe
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { GlowButton } from '../components/GlowButton';

interface BlogPost {
  id: string;
  title: string;
  summary: string;
  category: 'AI Marketing' | 'D2C Scaling' | 'UGC & Creators' | 'SEO & AEO';
  readTime: string;
  date: string;
  author: string;
  authorRole: string;
  authorAvatar: string;
  coverImage: string;
  badgeColor: string;
  content: string[];
}

export const BlogPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [emailSubscribed, setEmailSubscribed] = useState(false);
  const [subEmail, setSubEmail] = useState('');

  const blogPosts: BlogPost[] = [
    {
      id: 'blog-1',
      title: 'How D2C Brands Scale Meta Ads with Autonomous Creative Iteration in 2026',
      summary: 'Why manual creative testing is dead and how AI agent graphs generate 100+ high-converting hook variants while preserving brand visual identity.',
      category: 'AI Marketing',
      readTime: '6 min read',
      date: 'Aug 16, 2026',
      author: 'Aryan Verma',
      authorRole: 'Head of Growth Systems',
      authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      coverImage: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1000&q=80',
      badgeColor: '#7C75FF',
      content: [
        'Performance marketing in 2026 is no longer about manual audience hacking or testing 3 copy variants over 2 weeks. The winning D2C brands operate creative factories powered by multi-agent AI graphs.',
        'By analyzing real-time Meta Ad Library data of rivals like Portronics and StuffCool, AI can identify emerging hook structures (e.g., 15-second vertical split tests, wattage demonstrations, and built-in cable proofs) within hours.',
        'The key is maintaining Brand Coordinate Integrity: typography, hex tokens, and voice guardrails must stay 100% compliant while the angle, problem-agitation, and CTA dynamically adjust to customer intent.'
      ]
    },
    {
      id: 'blog-2',
      title: 'The Rise of AEO: Dominating ChatGPT & Perplexity Answer Engine Citations',
      summary: 'A step-by-step playbook on optimizing product entity schemas and JSON-LD knowledge graphs for AI generative search recommendations.',
      category: 'SEO & AEO',
      readTime: '8 min read',
      date: 'Aug 12, 2026',
      author: 'Rohit Shenoy',
      authorRole: 'Search Architect',
      authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
      coverImage: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1000&q=80',
      badgeColor: '#00D2FF',
      content: [
        'When shoppers ask ChatGPT or Perplexity "What is the best laptop power bank in India under ₹3,000?", AI models do not look at backlink counts alone—they look at citation density and verified schema entities.',
        'By deploying structured Product, FAQ, and HowTo schema markups with real-time stock and specification attributes, brands achieve a 70%+ inclusion rate in generative AI summaries.',
        'This article breaks down how to index your brand knowledge base directly into LLM retrieval pipelines.'
      ]
    },
    {
      id: 'blog-3',
      title: 'Eliminating Influencer Collaboration Friction with Escrow Vaults',
      summary: 'How verified milestone payments protect brand budgets while ensuring creators get paid instantly upon deliverable quality check.',
      category: 'UGC & Creators',
      readTime: '5 min read',
      date: 'Aug 8, 2026',
      author: 'Sanya Kapoor',
      authorRole: 'Creator Operations Lead',
      authorAvatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=80',
      coverImage: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1000&q=80',
      badgeColor: '#00E676',
      content: [
        '78% of influencer marketing disputes occur due to delayed deliverables or non-responsive creators after advance payments.',
        'Raftra’s Creator Escrow Vault locks funds securely until UGC reels, stories, or static posts pass automated quality review and brand satisfaction sign-off.',
        'This creates complete transparency: creators shoot with confidence knowing payment is locked, and brands protect their marketing budget.'
      ]
    },
    {
      id: 'blog-4',
      title: 'Festive Season E-commerce Playbook: September to Diwali Run-Up',
      summary: 'Strategic timing, bundle pricing architectures, and midnight flash-sale hooks tailored for India’s biggest commercial wave.',
      category: 'D2C Scaling',
      readTime: '7 min read',
      date: 'Aug 2, 2026',
      author: 'Aryan Verma',
      authorRole: 'Head of Growth Systems',
      authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      coverImage: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1000&q=80',
      badgeColor: '#FFB300',
      content: [
        'Diwali falls in early November, but search demand spikes from late August during Ganesh Chaturthi and Navratri.',
        'Brands that transition from simple price discounts to "Preparedness & Travel Bundles" consistently achieve 4.2x+ ROAS during competitive peak auction bidding.',
        'Learn how to set up automated schedule triggers that queue ad refreshes across regional cultural moments.'
      ]
    }
  ];

  const categories = ['All', 'AI Marketing', 'D2C Scaling', 'UGC & Creators', 'SEO & AEO'];

  const filteredPosts = blogPosts.filter(post => {
    if (selectedCategory !== 'All' && post.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return post.title.toLowerCase().includes(q) || post.summary.toLowerCase().includes(q);
    }
    return true;
  });

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subEmail.trim()) return;
    setEmailSubscribed(true);
    setTimeout(() => {
      setEmailSubscribed(false);
      setSubEmail('');
    }, 4000);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#050508', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{ flex: 1, maxWidth: '1200px', margin: '0 auto', padding: '120px 24px 80px 24px', width: '100%', boxSizing: 'border-box' }}>
        
        {/* ── HERO BANNER ────────────────────────────────────────── */}
        <div style={{ textAlign: 'center', maxWidth: '780px', margin: '0 auto 48px auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '5px 14px', background: 'rgba(124, 117, 255, 0.12)', borderRadius: '100px', border: '1px solid rgba(124, 117, 255, 0.3)', marginBottom: '16px' }}>
            <BookOpen size={14} color="#7C75FF" />
            <span style={{ fontSize: '12px', color: '#7C75FF', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              RAFTRA GROWTH JOURNAL & CASE STUDIES
            </span>
          </div>

          <h1 style={{ fontSize: 'clamp(32px, 5vw, 48px)', color: '#fff', margin: '0 0 16px 0', fontWeight: 900, fontFamily: 'var(--font-heading)', lineHeight: 1.15 }}>
            Actionable Playbooks for <span style={{ color: '#00E676' }}>High-Velocity Brands</span>
          </h1>

          <p style={{ fontSize: '16px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            Deep dives on autonomous AI creative generation, Meta & Google ad telemetry, AEO search indexing, and creator growth economics.
          </p>
        </div>

        {/* ── SEARCH & CATEGORY FILTERS ──────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '36px' }}>
          
          {/* Category Chips */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {categories.map((cat) => {
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    background: isActive ? 'linear-gradient(135deg, #7C75FF 0%, #5A52FF 100%)' : 'rgba(255, 255, 255, 0.04)',
                    border: isActive ? '1px solid #7C75FF' : '1px solid rgba(255, 255, 255, 0.1)',
                    color: isActive ? '#fff' : 'var(--text-secondary)',
                    padding: '8px 18px',
                    borderRadius: '100px',
                    fontSize: '13px',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: isActive ? '0 4px 14px rgba(124, 117, 255, 0.3)' : 'none'
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search playbooks & topics..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '9px 14px 9px 38px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '100px',
                color: '#fff',
                fontSize: '13px',
                outline: 'none'
              }}
            />
          </div>

        </div>

        {/* ── FEATURED POST (FIRST POST) ─────────────────────────── */}
        {filteredPosts.length > 0 && selectedCategory === 'All' && !searchQuery && (
          <div
            onClick={() => setSelectedPost(filteredPosts[0])}
            className="glow-card"
            style={{
              background: 'linear-gradient(135deg, rgba(25, 22, 45, 0.9) 0%, rgba(12, 10, 22, 0.98) 100%)',
              border: '1.5px solid rgba(124, 117, 255, 0.4)',
              borderRadius: '24px',
              overflow: 'hidden',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '24px',
              cursor: 'pointer',
              marginBottom: '40px',
              boxShadow: '0 12px 40px rgba(124, 117, 255, 0.18)',
              transition: 'all 0.3s ease'
            }}
          >
            <div style={{ height: '300px', width: '100%', overflow: 'hidden' }}>
              <img
                src={filteredPosts[0].coverImage}
                alt={filteredPosts[0].title}
                style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s ease' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.04)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              />
            </div>

            <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '18px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '11px', background: `${filteredPosts[0].badgeColor}22`, color: filteredPosts[0].badgeColor, border: `1px solid ${filteredPosts[0].badgeColor}55`, padding: '3px 10px', borderRadius: '100px', fontWeight: 800 }}>
                    FEATURED PLAYBOOK
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{filteredPosts[0].readTime} • {filteredPosts[0].date}</span>
                </div>

                <h2 style={{ fontSize: '24px', color: '#fff', margin: '0 0 10px 0', fontWeight: 800, fontFamily: 'var(--font-heading)', lineHeight: 1.3 }}>
                  {filteredPosts[0].title}
                </h2>

                <p style={{ fontSize: '14.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                  {filteredPosts[0].summary}
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img src={filteredPosts[0].authorAvatar} alt={filteredPosts[0].author} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>{filteredPosts[0].author}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{filteredPosts[0].authorRole}</div>
                  </div>
                </div>

                <span style={{ color: '#00E676', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Read Article <ArrowRight size={14} />
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── BLOG POSTS GRID ────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          {filteredPosts.map((post) => (
            <motion.div
              key={post.id}
              whileHover={{ y: -4 }}
              onClick={() => setSelectedPost(post)}
              className="glow-card"
              style={{
                background: '#0a0a12',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '20px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'border-color 0.2s ease'
              }}
            >
              <div>
                <div style={{ height: '190px', width: '100%', overflow: 'hidden' }}>
                  <img src={post.coverImage} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>

                <div style={{ padding: '22px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '11px', background: `${post.badgeColor}22`, color: post.badgeColor, border: `1px solid ${post.badgeColor}44`, padding: '2px 8px', borderRadius: '100px', fontWeight: 800 }}>
                      {post.category}
                    </span>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{post.readTime}</span>
                  </div>

                  <h3 style={{ fontSize: '18px', color: '#fff', margin: '0 0 8px 0', fontWeight: 800, lineHeight: 1.35 }}>
                    {post.title}
                  </h3>

                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                    {post.summary}
                  </p>
                </div>
              </div>

              <div style={{ padding: '16px 22px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <img src={post.authorAvatar} alt={post.author} style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{post.author}</span>
                </div>
                <span style={{ fontSize: '12px', color: '#7C75FF', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                  Read <ChevronRight size={13} />
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── NEWSLETTER SUBSCRIPTION STRIP ──────────────────────── */}
        <div
          className="glow-card"
          style={{
            marginTop: '60px',
            background: 'linear-gradient(135deg, rgba(20, 35, 25, 0.85) 0%, rgba(10, 16, 14, 0.95) 100%)',
            border: '1.5px solid rgba(0, 230, 118, 0.35)',
            borderRadius: '24px',
            padding: '36px 40px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '24px'
          }}
        >
          <div style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Sparkles size={18} color="#00E676" />
              <h3 style={{ fontSize: '22px', color: '#fff', margin: 0, fontWeight: 800 }}>
                Get Weekly AI Marketing Telemetry
              </h3>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Join 12,000+ D2C founders and performance marketers receiving our weekly tear-downs of winning ad hooks and search trends.
            </p>
          </div>

          <form onSubmit={handleSubscribe} style={{ display: 'flex', gap: '10px', width: '100%', maxWidth: '420px' }}>
            <input
              type="email"
              required
              placeholder="founder@brand.com"
              value={subEmail}
              onChange={e => setSubEmail(e.target.value)}
              style={{
                flex: 1,
                padding: '12px 18px',
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '100px',
                color: '#fff',
                fontSize: '13.5px',
                outline: 'none'
              }}
            />
            <GlowButton variant="glow" type="submit" style={{ padding: '12px 24px', fontSize: '13.5px', whiteSpace: 'nowrap' }}>
              {emailSubscribed ? 'Subscribed ✓' : 'Subscribe Free'}
            </GlowButton>
          </form>
        </div>

      </main>

      {/* ── ARTICLE READ MODAL ───────────────────────────────────── */}
      <AnimatePresence>
        {selectedPost && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.88)',
              backdropFilter: 'blur(12px)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px'
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              style={{
                width: '100%',
                maxWidth: '820px',
                maxHeight: '90vh',
                background: '#0a0a12',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '24px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 80px rgba(0,0,0,0.9)'
              }}
            >
              <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', background: `${selectedPost.badgeColor}22`, color: selectedPost.badgeColor, padding: '3px 10px', borderRadius: '100px', fontWeight: 800 }}>
                  {selectedPost.category}
                </span>

                <button
                  onClick={() => setSelectedPost(null)}
                  style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ padding: '28px 32px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h1 style={{ fontSize: '26px', color: '#fff', margin: 0, fontWeight: 900, fontFamily: 'var(--font-heading)', lineHeight: 1.3 }}>
                  {selectedPost.title}
                </h1>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  <img src={selectedPost.authorAvatar} alt={selectedPost.author} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                  <span>By <strong style={{ color: '#fff' }}>{selectedPost.author}</strong> ({selectedPost.authorRole})</span>
                  <span>•</span>
                  <span>{selectedPost.date}</span>
                </div>

                <div style={{ height: '260px', width: '100%', borderRadius: '16px', overflow: 'hidden' }}>
                  <img src={selectedPost.coverImage} alt={selectedPost.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', color: 'rgba(255,255,255,0.9)', fontSize: '15px', lineHeight: 1.7 }}>
                  {selectedPost.content.map((paragraph, idx) => (
                    <p key={idx} style={{ margin: 0 }}>
                      {paragraph}
                    </p>
                  ))}
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                  <div>
                    <h4 style={{ fontSize: '15px', color: '#fff', margin: '0 0 2px 0', fontWeight: 700 }}>Ready to scale your brand?</h4>
                    <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>Launch autonomous ad workflows in 60 seconds.</span>
                  </div>
                  <GlowButton variant="glow" onClick={() => { setSelectedPost(null); navigate('/login'); }} style={{ fontSize: '12.5px', padding: '8px 20px' }}>
                    Start Free Trial 🚀
                  </GlowButton>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
};
