import React, { useState, useEffect } from 'react';
import { Cpu, ChevronDown, LogOut } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GlowButton } from './GlowButton';
import { motion, AnimatePresence } from 'framer-motion';

interface AuthUser {
  id: number;
  email: string;
  first_name?: string | null;
  role: string;
}

export const Navbar: React.FC<{onOpenCreatorPortal?: () => void}> = ({onOpenCreatorPortal}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [hoverFeature, setHoverFeature] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  // Reflect logged-in state: validate the stored token against the backend.
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setUser(null);
      return;
    }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: AuthUser) => setUser(data))
      .catch(() => {
        // Token missing/expired/invalid — clear it so the UI shows "Login".
        localStorage.removeItem('token');
        setUser(null);
      });
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    navigate('/');
  };

  const goToDashboard = () => {
    navigate(user?.role === 'creator' ? '/creator-dashboard' : '/dashboard');
  };

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
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '20px 48px',
      background: 'rgba(10, 10, 10, 0.8)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      zIndex: 1000
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
        {user ? (
          <>
            <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              Hi, <span style={{ color: '#fff', fontWeight: 600 }}>{user.first_name || user.email.split('@')[0]}</span>
            </span>
            <GlowButton variant="glow" onClick={goToDashboard}>
              Dashboard
            </GlowButton>
            <button
              onClick={handleLogout}
              title="Log out"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '14px', fontWeight: '500', cursor: 'pointer', padding: '8px 14px', borderRadius: '8px' }}
            >
              <LogOut size={16} /> Log out
            </button>
          </>
        ) : (
          <>
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
          </>
        )}
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
