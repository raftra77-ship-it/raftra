import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, ArrowLeft } from 'lucide-react';
import { WorkspaceInfluencer } from '../components/workspaces/WorkspaceInfluencer';
import { GlowButton } from '../components/GlowButton';

export const InfluencerMarketplacePage: React.FC = () => {
  const navigate = useNavigate();

  const isLoggedIn = Boolean(localStorage.getItem('token'));

  const handleDashboardClick = () => {
    if (isLoggedIn) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#070709', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      {/* Top Standalone Header Bar */}
      <header style={{
        height: '64px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(13, 13, 20, 0.85)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 28px',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            onClick={() => navigate('/')}
            title="Back to Raftra home"
            role="link"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/'); }}
            style={{ fontSize: '18px', fontWeight: 900, fontFamily: 'var(--font-heading)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span style={{ color: 'var(--primary, #5A52FF)' }}>RAFTRA</span> MARKETPLACE
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '3px 10px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
            Creator Discovery Portal ↗
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Always-present way back to the marketing site. This page is opened with
              target="_blank" from the landing page, so the tab has no history and the
              browser Back button is dead. Without this the only controls were "Back to
              Dashboard" and "Sign In", which both push a logged-out visitor to /login
              and leave them with no route back to the site. */}
          <GlowButton variant="secondary" onClick={() => navigate('/')} style={{ fontSize: '13px', padding: '8px 16px' }}>
            <ArrowLeft size={15} /> Back to Home
          </GlowButton>
          <GlowButton variant="secondary" onClick={handleDashboardClick} style={{ fontSize: '13px', padding: '8px 16px' }}>
            <LayoutDashboard size={15} /> {isLoggedIn ? 'Dashboard' : 'Dashboard (Sign In)'}
          </GlowButton>
          {!isLoggedIn && (
            <GlowButton variant="glow" onClick={() => navigate('/login')} style={{ fontSize: '13px', padding: '8px 16px' }}>
              Brand Sign In / Register
            </GlowButton>
          )}
        </div>
      </header>

      {/* Main Content Body */}
      <main style={{ flex: 1, padding: '24px 32px', width: '100%', boxSizing: 'border-box' }}>
        <WorkspaceInfluencer workspaceId={1} />
      </main>
    </div>
  );
};
