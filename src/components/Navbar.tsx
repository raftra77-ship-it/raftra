import React, { useState, useEffect } from 'react';
import { Cpu, ChevronDown, Menu, X, ArrowRight, Sparkles, BookOpen, Briefcase, FileText } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GlowButton } from './GlowButton';
import { motion, AnimatePresence } from 'framer-motion';

export const Navbar: React.FC<{onOpenCreatorPortal?: () => void}> = ({onOpenCreatorPortal}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [hoverFeature, setHoverFeature] = useState(false);
  const [hoverResources, setHoverResources] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isNavHovered, setIsNavHovered] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Smooth scroll threshold (collapse past 220px on desktop only, expand when <150px)
      if (window.innerWidth > 960) {
        if (window.scrollY > 220) {
          setIsScrolled(true);
        } else if (window.scrollY < 150) {
          setIsScrolled(false);
        }
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const features = [
    { name: 'AI Creative Studio', path: '/features/creative' },
    { name: 'Campaign Manager', path: '/features/campaign' },
    { name: 'SEO & GEO', path: '/features/seo' },
    { name: 'Growth Analytics', path: '/features/review' },
    { name: 'Influencer Marketplace', path: '/features/influencer' },
    { name: 'Social Hub', path: '/features/social-manager' }
  ];

  const handleScrollToFriction = () => {
    setMobileMenuOpen(false);
    if (location.pathname !== '/') {
      navigate('/');
      setTimeout(() => {
        const problemSec = document.getElementById('problem');
        if (problemSec) problemSec.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    } else {
      const problemSec = document.getElementById('problem');
      if (problemSec) problemSec.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleScrollToSolution = () => {
    setMobileMenuOpen(false);
    if (location.pathname !== '/') {
      navigate('/');
      setTimeout(() => {
        const solutionSec = document.getElementById('solution');
        if (solutionSec) solutionSec.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    } else {
      const solutionSec = document.getElementById('solution');
      if (solutionSec) solutionSec.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const isCollapsed = isScrolled && !isNavHovered && !mobileMenuOpen;

  return (
    <>
      <motion.nav
        onMouseEnter={() => setIsNavHovered(true)}
        onMouseLeave={() => {
          setIsNavHovered(false);
          setHoverFeature(false);
          setHoverResources(false);
        }}
        initial={false}
        /* These five numbers are the deployed build's, read out of the shipped bundle at
           raftra-nine.vercel.app rather than estimated from a screenshot:
             width  calc(100% - 48px)   maxWidth 1024   padding 24   left calc(50% - 105px)
           The 105px offset is the alignment that was missing. The bar is not centred on the
           viewport — it is nudged left so the Creator Marketplace pill pinned to the right
           edge sits in the gap it leaves, which is what makes the two read as one row. Local
           had it at a plain 50% and 1240 wide, so the bar ran too wide and too far right. */
        animate={{
          width: isCollapsed ? 78 : 'calc(100% - 48px)',
          /* 1120, not the deployed build's 1024. Everything else here is copied from it, but
             this branch's bar has to hold more: logo 102 + links 669 + actions 275, the 24px
             margin before the actions, and 48 of padding — 1118 in total, where the deployed
             build's equivalents fit in 1024 because its base typography differs. Holding
             1024 here pushed Login 55px outside the pill, which is the bug this fixes. */
          maxWidth: isCollapsed ? 78 : 1120,
          height: isCollapsed ? 46 : 52,
          paddingLeft: isCollapsed ? 12 : 24,
          paddingRight: isCollapsed ? 12 : 24,
          // The >960 guard is kept from this branch's mobile pass: below that the bar stays
          // centred, because a 105px nudge on a phone pushes it off the screen edge.
          left: isScrolled && window.innerWidth > 960
            ? 'max(24px, calc(50% - 620px))'
            : window.innerWidth > 960 ? 'calc(50% - 105px)' : '50%',
          x: isScrolled && window.innerWidth > 960 ? '0%' : '-50%'
        }}
        transition={{
          type: 'spring',
          stiffness: 280,
          damping: 30,
          mass: 0.8
        }}
        style={{
          position: 'fixed',
          top: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          background: 'rgba(14, 14, 26, 0.92)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRadius: '100px',
          border: '1px solid rgba(90, 82, 255, 0.45)',
          boxShadow: isCollapsed
            ? '0 10px 30px rgba(90, 82, 255, 0.4), 0 0 20px rgba(90, 82, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
            : '0 12px 40px -5px rgba(0, 0, 0, 0.7), 0 0 25px rgba(90, 82, 255, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
          zIndex: 999,
          cursor: isCollapsed ? 'pointer' : 'default',
          overflow: isCollapsed ? 'hidden' : 'visible'
        }}
        onClick={() => {
          if (isCollapsed) {
            setIsNavHovered(true);
          }
        }}
      >
        {/* Brand Logo / Icon */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: isCollapsed ? '0px' : '10px',
            cursor: 'pointer',
            flex: isCollapsed ? 'none' : '0 0 auto',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            userSelect: 'none'
          }}
          onClick={(e) => {
            e.stopPropagation();
            navigate('/');
          }}
        >
          <Cpu color="var(--primary)" size={isCollapsed ? 20 : 22} />
          {isCollapsed ? (
            <span style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'var(--font-heading)', color: '#fff', letterSpacing: '-0.02em' }}>
              R
            </span>
          ) : (
            <span style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em', color: '#fff', whiteSpace: 'nowrap' }}>
              Raftra<span style={{ color: 'var(--primary)' }}>AI</span>
            </span>
          )}
        </div>

        {/* Center Desktop Links */}
        <motion.div
          className="nav-desktop-links"
          animate={{
            opacity: isCollapsed ? 0 : 1,
            scale: isCollapsed ? 0.94 : 1,
            pointerEvents: isCollapsed ? 'none' : 'auto'
          }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '28px', flex: '2 1 0%', whiteSpace: 'nowrap' }}
        >
          <button onClick={handleScrollToFriction} className="nav-link-btn">
            The Friction
          </button>
          
          <button onClick={() => navigate('/security')} className="nav-link-btn">
            Security
          </button>

          {/* The Solution Dropdown */}
          <div 
            style={{ position: 'relative' }}
            onMouseEnter={() => setHoverFeature(true)}
            onMouseLeave={() => setHoverFeature(false)}
          >
            <button onClick={handleScrollToSolution} className="nav-link-btn" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              The Solution <ChevronDown size={14} />
            </button>
            
            <AnimatePresence>
              {hoverFeature && (
                <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', paddingTop: '10px', zIndex: 1000 }}>
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    style={{
                      background: 'rgba(12, 12, 22, 0.98)',
                      backdropFilter: 'blur(24px)',
                      border: '1px solid rgba(90, 82, 255, 0.35)',
                      borderRadius: '16px',
                      padding: '10px',
                      minWidth: '230px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 25px rgba(90,82,255,0.3)'
                    }}
                  >
                    {features.map((feat, idx) => (
                      <button
                        key={idx}
                        onClick={() => { setHoverFeature(false); navigate(feat.path); }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#e0e0ff',
                          textAlign: 'left',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          fontSize: '13.5px',
                          fontWeight: 500,
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(90,82,255,0.2)';
                          e.currentTarget.style.color = '#ffffff';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = '#e0e0ff';
                        }}
                      >
                        {feat.name}
                      </button>
                    ))}
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Resources Dropdown */}
          <div 
            style={{ position: 'relative' }}
            onMouseEnter={() => setHoverResources(true)}
            onMouseLeave={() => setHoverResources(false)}
          >
            <button className="nav-link-btn" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              Resources <ChevronDown size={14} />
            </button>
            
            <AnimatePresence>
              {hoverResources && (
                <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', paddingTop: '10px', zIndex: 1000 }}>
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    style={{
                      background: 'rgba(12, 12, 22, 0.98)',
                      backdropFilter: 'blur(24px)',
                      border: '1px solid rgba(0, 230, 118, 0.4)',
                      borderRadius: '16px',
                      padding: '12px',
                      minWidth: '260px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      boxShadow: '0 20px 60px rgba(0,0,0,0.9), 0 0 25px rgba(0,230,118,0.25)'
                    }}
                  >
                    {[
                      { name: 'Growth Blog', path: '/blog', desc: 'Marketing playbooks & case studies' },
                      { name: 'Careers', path: '/careers', desc: 'Remote internships & opportunities' },
                      { name: 'User Manuals & Docs', path: '/docs', desc: 'Platform documentation & guides' }
                    ].map((res, idx) => (
                      <button
                        key={idx}
                        onClick={() => { setHoverResources(false); navigate(res.path); }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#ffffff',
                          textAlign: 'left',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: 600,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '3px',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(0,230,118,0.15)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <span style={{ fontWeight: 700, color: '#ffffff', fontSize: '13.5px' }}>{res.name}</span>
                        <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.72)', lineHeight: 1.35 }}>{res.desc}</span>
                      </button>
                    ))}
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>

          <button onClick={() => navigate('/pricing')} className="nav-link-btn">
            Pricing
          </button>

          <button onClick={() => navigate('/about')} className="nav-link-btn">
            About Us
          </button>
        </motion.div>

        {/* Desktop Right Actions */}
        <motion.div
          className="nav-desktop-actions"
          animate={{
            opacity: isCollapsed ? 0 : 1,
            scale: isCollapsed ? 0.94 : 1,
            pointerEvents: isCollapsed ? 'none' : 'auto'
          }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          /* flex '1 1 0%', not '0 0 auto' — this is why Login sat outside the pill.
             '0 0 auto' makes this group rigid: it contributes its full content width and
             refuses to shrink, so logo + links + actions came to 1054px inside a 1024px bar
             and the overflow spilled past the rounded edge. With a 0 basis it shares the
             leftover space with the links group instead of forcing the bar wider than it is.
             gap and marginLeft also match the deployed build. */
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '14px', flex: '1 1 0%', whiteSpace: 'nowrap', marginLeft: '24px' }}
        >
          <button 
            onClick={() => {
              window.open('https://docs.google.com/forms/d/e/1FAIpQLSe8SaOeW1zHgpDQprgkMoKQGOqqEHv3pSrqskUPTDYpBsB_Nw/viewform?usp=sharing&ouid=100579727126475993109', '_blank');
            }}
            className="creator-portal-btn"
          >
            Creator Onboarding
          </button>
          <GlowButton variant="glow" onClick={() => navigate('/login')} style={{ padding: '8px 18px', fontSize: '13px', whiteSpace: 'nowrap' }}>
            Login
          </GlowButton>
          {/* Login ends the bar, matching the deployed build — its bundle contains exactly
              one "Creator Marketplace", the floating pill LandingPage pins to the top-right.
              A second copy used to sit here, and at the reference width of 1024px it pushed
              the bar's natural content to 1244px: a 220px overflow that squashed the links
              and clipped the label against the floating pill. */}
        </motion.div>

        {/* Mobile Hamburger Toggle Button */}
        <button
          className="nav-mobile-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle Navigation Menu"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#ffffff',
            cursor: 'pointer',
            padding: '6px',
            display: 'none',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {mobileMenuOpen ? <X size={22} color="#00E676" /> : <Menu size={22} color="#ffffff" />}
        </button>
      </motion.nav>

      {/* ── MOBILE FULL-SCREEN / SLIDE-DOWN DRAWER ──────────────── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              top: '76px',
              left: '16px',
              right: '16px',
              background: 'rgba(10, 10, 20, 0.98)',
              backdropFilter: 'blur(30px)',
              WebkitBackdropFilter: 'blur(30px)',
              border: '1.5px solid rgba(90, 82, 255, 0.4)',
              borderRadius: '24px',
              padding: '24px',
              zIndex: 998,
              maxHeight: 'calc(100vh - 100px)',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxShadow: '0 25px 80px rgba(0,0,0,0.95), 0 0 30px rgba(90,82,255,0.25)'
            }}
          >
            {/* Primary Navigation */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                EXPLORE PLATFORM
              </span>

              <button onClick={handleScrollToFriction} className="mobile-nav-btn">
                The Friction (The Problem)
              </button>
              <button onClick={handleScrollToSolution} className="mobile-nav-btn">
                The Solution (AI Growth Engine)
              </button>
              <button onClick={() => { setMobileMenuOpen(false); navigate('/pricing'); }} className="mobile-nav-btn">
                Pricing & Plans (INR)
              </button>
              <button onClick={() => { setMobileMenuOpen(false); navigate('/about'); }} className="mobile-nav-btn">
                About Us
              </button>
              <button onClick={() => { setMobileMenuOpen(false); navigate('/security'); }} className="mobile-nav-btn">
                Security & Data Shield
              </button>
            </div>

            {/* Resources Section */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#00E676', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                RESOURCES & CAREERS
              </span>

              <button onClick={() => { setMobileMenuOpen(false); navigate('/blog'); }} className="mobile-nav-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Growth Blog & Playbooks</span>
                <ArrowRight size={14} color="#7C75FF" />
              </button>

              <button onClick={() => { setMobileMenuOpen(false); navigate('/careers'); }} className="mobile-nav-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Careers & Internships</span>
                <ArrowRight size={14} color="#00E676" />
              </button>

              <button onClick={() => { setMobileMenuOpen(false); navigate('/docs'); }} className="mobile-nav-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>User Manuals & Docs</span>
                <ArrowRight size={14} color="#00D2FF" />
              </button>
            </div>

            {/* Call To Action Buttons */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <GlowButton
                variant="glow"
                onClick={() => { setMobileMenuOpen(false); navigate('/login'); }}
                style={{ width: '100%', padding: '12px', fontSize: '14px', fontWeight: 800, justifyContent: 'center' }}
              >
                Login to Dashboard 🚀
              </GlowButton>

              <button 
                onClick={() => {
                  setMobileMenuOpen(false);
                  window.open('https://docs.google.com/forms/d/e/1FAIpQLSe8SaOeW1zHgpDQprgkMoKQGOqqEHv3pSrqskUPTDYpBsB_Nw/viewform?usp=sharing&ouid=100579727126475993109', '_blank');
                }}
                className="creator-portal-btn"
                style={{ width: '100%', padding: '12px', textAlign: 'center', fontSize: '13.5px' }}
              >
                Creator Onboarding Form
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <style>{`
        .nav-link-btn {
          background: transparent;
          border: none;
          color: #c0c0e0;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          position: relative;
          padding: 6px 8px;
          white-space: nowrap;
        }
        .nav-link-btn:hover {
          color: #ffffff;
          text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
        }
        .creator-portal-btn {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.18);
          color: #ffffff;
          font-size: 13.5px;
          font-weight: 600;
          padding: 8px 16px;
          border-radius: 100px;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }
        .creator-portal-btn:hover {
          background: #000000;
          border-color: rgba(255, 255, 255, 0.4);
          color: #ffffff;
          box-shadow: 0 0 15px rgba(0, 0, 0, 0.8);
        }
        .mobile-nav-btn {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          color: #ffffff;
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          text-align: left;
          cursor: pointer;
          transition: all 0.15s ease;
          width: 100%;
          box-sizing: border-box;
        }
        .mobile-nav-btn:hover {
          background: rgba(90, 82, 255, 0.15);
          border-color: rgba(90, 82, 255, 0.35);
        }

        /* ── RESPONSIVE MEDIA QUERIES ───────────────────────────── */
        @media (max-width: 960px) {
          .nav-desktop-links,
          .nav-desktop-actions {
            display: none !important;
          }
          .nav-mobile-toggle {
            display: flex !important;
          }
        }
      `}</style>
    </>
  );
};
