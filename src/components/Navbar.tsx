import React, { useState } from 'react';
import { Cpu, ChevronDown } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GlowButton } from './GlowButton';
import { motion, AnimatePresence } from 'framer-motion';

export const Navbar: React.FC<{onOpenCreatorPortal?: () => void}> = ({onOpenCreatorPortal}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [hoverFeature, setHoverFeature] = useState(false);

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

  return (
    <nav style={{
      position: 'fixed',
      top: '16px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'calc(100% - 48px)',
      maxWidth: '1240px',
      display: 'flex',
      alignItems: 'center',
      justify: 'space-between',
      padding: '12px 32px',
      background: 'rgba(14, 14, 24, 0.78)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderRadius: '100px',
      border: '1px solid rgba(255, 255, 255, 0.14)',
      boxShadow: '0 10px 35px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
      zIndex: 1000,
      transition: 'all 0.3s ease'
    }}>
      {/* Logo Extreme Left */}
      <div 
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
        onClick={() => navigate('/')}
      >
        <Cpu color="var(--primary)" size={24} />
        <span style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em', color: '#fff' }}>
          Raftra<span style={{ color: 'var(--primary)' }}>AI</span>
        </span>
      </div>

      {/* Center Links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
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
                  background: 'rgba(10, 10, 10, 0.95)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  padding: '16px',
                  minWidth: '220px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  marginTop: '16px',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
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
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
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

      {/* Extreme Right Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button 
          onClick={() => {
            if (onOpenCreatorPortal) {
              onOpenCreatorPortal();
            } else {
              navigate('/'); // fallback if not on landing page
            }
          }}
          style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}
        >
          Creator Portal
        </button>
        <GlowButton variant="glow" onClick={() => navigate('/login')}>
          Login
        </GlowButton>
      </div>
      
      <style>{`
        .nav-link-btn {
          background: transparent;
          border: none;
          color: #aaa;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: color 0.2s;
          position: relative;
          padding-bottom: 4px;
        }
        .nav-link-btn::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 0;
          height: 2px;
          background: #fff;
          transition: width 0.3s ease;
          border-radius: 2px;
        }
        .nav-link-btn:hover {
          color: #fff;
        }
        .nav-link-btn:hover::after {
          width: 100%;
        }
      `}</style>
    </nav>
  );
};
