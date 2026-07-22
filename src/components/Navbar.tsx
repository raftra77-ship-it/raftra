import React, { useState, useEffect } from 'react';
import { Cpu, ChevronDown } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GlowButton } from './GlowButton';
import { motion, AnimatePresence } from 'framer-motion';

export const Navbar: React.FC<{onOpenCreatorPortal?: () => void}> = ({onOpenCreatorPortal}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [hoverFeature, setHoverFeature] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isNavHovered, setIsNavHovered] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 80) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const features = [
    { name: 'Social Media Manager', path: '/features/social-manager' },
    { name: 'SEO & Geo Analytics', path: '/features/seo' },
    { name: 'Influencer Discovery', path: '/features/influencer' },
    { name: 'Creative Studio', path: '/features/creative' },
    { name: 'Campaign Manager', path: '/features/campaign' },
    { name: 'Brand Review System', path: '/features/review' }
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
    <nav
      onMouseEnter={() => setIsNavHovered(true)}
      onMouseLeave={() => {
        setIsNavHovered(false);
        setHoverFeature(false);
      }}
      style={{
        position: 'fixed',
        top: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: isCollapsed ? '56px' : 'calc(100% - 48px)',
        height: isCollapsed ? '56px' : '52px',
        maxWidth: isCollapsed ? '56px' : '1240px',
        display: 'flex',
        alignItems: 'center',
        justify: isCollapsed ? 'center' : 'space-between',
        padding: isCollapsed ? '0' : '10px 24px',
        background: 'rgba(14, 14, 26, 0.88)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderRadius: isCollapsed ? '50%' : '100px',
        border: '1px solid rgba(90, 82, 255, 0.45)',
        boxShadow: isCollapsed
          ? '0 10px 30px rgba(90, 82, 255, 0.4), 0 0 20px rgba(90, 82, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
          : '0 12px 40px -5px rgba(0, 0, 0, 0.7), 0 0 25px rgba(90, 82, 255, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
        zIndex: 1000,
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        cursor: isCollapsed ? 'pointer' : 'default',
        overflow: 'hidden'
      }}
      onClick={() => {
        if (isCollapsed) {
          setIsNavHovered(true);
        }
      }}
    >
      {/* Logo Container */}
      <div 
        style={{
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flex: isCollapsed ? '0 0 auto' : '1 1 0%',
          justify: isCollapsed ? 'center' : 'flex-start'
        }}
        onClick={(e) => {
          e.stopPropagation();
          navigate('/');
        }}
      >
        <Cpu color="var(--primary)" size={isCollapsed ? 24 : 22} />
        {!isCollapsed && (
          <span style={{ fontSize: '19px', fontWeight: 700, fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em', color: '#fff', whiteSpace: 'nowrap' }}>
            Raftra<span style={{ color: 'var(--primary)' }}>AI</span>
          </span>
        )}
      </div>

      {/* Center 5 Links (Visible when expanded) */}
      {!isCollapsed && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '28px', flex: '2 1 0%' }}>
          <button onClick={handleScrollToFriction} className="nav-link-btn">
            The Friction
          </button>
          
          <button onClick={() => navigate('/security')} className="nav-link-btn">
            Security
          </button>

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
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(12, 12, 22, 0.95)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(90, 82, 255, 0.3)',
                    borderRadius: '16px',
                    padding: '12px',
                    minWidth: '220px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    marginTop: '12px',
                    boxShadow: '0 15px 45px rgba(0,0,0,0.6), 0 0 20px rgba(90,82,255,0.2)',
                    zIndex: 100
                  }}
                >
                  {features.map((feat, idx) => (
                    <button
                      key={idx}
                      onClick={() => { setHoverFeature(false); navigate(feat.path); }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#fff',
                        textAlign: 'left',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '13.5px',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(90,82,255,0.15)';
                        e.currentTarget.style.color = '#fff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#fff';
                      }}
                    >
                      {feat.name}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button onClick={() => navigate('/about')} className="nav-link-btn">
            About Us
          </button>

          <button onClick={() => navigate('/pricing')} className="nav-link-btn">
            Pricing
          </button>
        </div>
      )}

      {/* Extreme Right Actions (Visible when expanded) */}
      {!isCollapsed && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '14px', flex: '1 1 0%' }}>
          <button 
            onClick={() => {
              if (onOpenCreatorPortal) {
                onOpenCreatorPortal();
              } else {
                navigate('/');
              }
            }}
            className="creator-portal-btn"
          >
            Creator Portal
          </button>
          <GlowButton variant="glow" onClick={() => navigate('/login')} style={{ padding: '8px 20px', fontSize: '13.5px', whiteSpace: 'nowrap' }}>
            Login
          </GlowButton>
        </div>
      )}
      
      <style>{`
        .nav-link-btn {
          background: transparent;
          border: none;
          color: #b0b0cc;
          font-size: 13.5px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
          padding: 6px 8px;
          white-space: nowrap;
        }
        .nav-link-btn:hover {
          color: #ffffff;
          text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
        }
        .creator-portal-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #e0e0ff;
          font-size: 13px;
          font-weight: 600;
          padding: 8px 16px;
          border-radius: 100px;
          cursor: pointer;
          transition: all 0.25s ease;
          white-space: nowrap;
        }
        .creator-portal-btn:hover {
          background: rgba(90, 82, 255, 0.15);
          border-color: rgba(90, 82, 255, 0.4);
          color: #ffffff;
          box-shadow: 0 0 15px rgba(90, 82, 255, 0.3);
        }
      `}</style>
    </nav>
  );
};
