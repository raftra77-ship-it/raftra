import React, { useState, useEffect } from 'react';
import { Cpu, ChevronDown } from 'lucide-react';
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

  useEffect(() => {
    const handleScroll = () => {
      // Smooth scroll threshold (collapse past 220px, expand when <150px)
      if (window.scrollY > 220) {
        setIsScrolled(true);
      } else if (window.scrollY < 150) {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const features = [
    { name: 'AI Creative Studio', path: '/features/creative' },
    { name: 'Campaign Manager', path: '/features/campaign' },
    { name: 'SEO & GEO', path: '/features/seo' },
    { name: 'Growth Analytics', path: '/features/review' },
    { name: 'Influencer Marketplace', path: '/features/influencer' },
    { name: 'Social Hub', path: '/features/social-manager' }
  ];

  const handleScrollToFriction = () => {
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

  const isCollapsed = isScrolled && !isNavHovered;

  return (
    <motion.nav
      onMouseEnter={() => setIsNavHovered(true)}
      onMouseLeave={() => {
        setIsNavHovered(false);
        setHoverFeature(false);
        setHoverResources(false);
      }}
      initial={false}
      animate={{
        width: isCollapsed ? 78 : 'calc(100% - 48px)',
        maxWidth: isCollapsed ? 78 : 1240,
        height: isCollapsed ? 46 : 52,
        paddingLeft: isCollapsed ? 12 : 24,
        paddingRight: isCollapsed ? 12 : 24,
        left: isScrolled ? 'max(24px, calc(50% - 620px))' : '50%',
        x: isScrolled ? '0%' : '-50%'
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
        background: 'rgba(14, 14, 26, 0.88)',
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
          flex: isCollapsed ? 'none' : '1 1 0%',
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
          <span style={{ fontSize: '19px', fontWeight: 700, fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em', color: '#fff', whiteSpace: 'nowrap' }}>
            Raftra<span style={{ color: 'var(--primary)' }}>AI</span>
          </span>
        )}
      </div>

      {/* Center Links */}
      <motion.div
        animate={{
          opacity: isCollapsed ? 0 : 1,
          scale: isCollapsed ? 0.94 : 1,
          pointerEvents: isCollapsed ? 'none' : 'auto'
        }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', flex: '2 1 0%', whiteSpace: 'nowrap' }}
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
                    background: 'rgba(12, 12, 22, 0.96)',
                    backdropFilter: 'blur(20px)',
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

        {/* Resources Dropdown (Blogs, Careers, User Manuals) */}
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

      {/* Extreme Right Actions (GPU Accelerated Smooth Opacity Morph) */}
      <motion.div
        animate={{
          opacity: isCollapsed ? 0 : 1,
          scale: isCollapsed ? 0.94 : 1,
          pointerEvents: isCollapsed ? 'none' : 'auto'
        }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '14px', flex: '1 1 0%', whiteSpace: 'nowrap' }}
      >
        <button 
          onClick={() => {
            window.open('https://docs.google.com/forms/d/e/1FAIpQLSe8SaOeW1zHgpDQprgkMoKQGOqqEHv3pSrqskUPTDYpBsB_Nw/viewform?usp=sharing&ouid=100579727126475993109', '_blank');
          }}
          className="creator-portal-btn"
        >
          Creator Onboarding
        </button>
        <GlowButton variant="glow" onClick={() => navigate('/login')} style={{ padding: '8px 20px', fontSize: '13.5px', whiteSpace: 'nowrap' }}>
          Login
        </GlowButton>
      </motion.div>
      
      <style>{`
        .nav-link-btn {
          background: transparent;
          border: none;
          color: #c0c0e0;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          position: relative;
          padding: 6px 10px;
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
          font-size: 14px;
          font-weight: 600;
          padding: 9px 18px;
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
      `}</style>
    </motion.nav>
  );
};
