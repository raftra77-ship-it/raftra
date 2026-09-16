import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard } from 'lucide-react';
import { WorkspaceInfluencer } from '../components/workspaces/WorkspaceInfluencer';
import { GlowButton } from '../components/GlowButton';

export const InfluencerMarketplacePage: React.FC = () => {
  const navigate = useNavigate();

  const isLoggedIn = Boolean(localStorage.getItem('token'));

  /* The brand whose collaborations and saved creators this page should show.
     ------------------------------------------------------------------
     This used to be `workspaceId={1}` — a literal. Two things were wrong with it.

     This route is public (App.tsx mounts /influencer-marketplace outside RequireAuth), but
     /api/workspaces/{id}/influencers requires a token, so every signed-out visitor fired it
     twice and got a pair of 401s in the console — the error on this screen.

     Worse for anyone signed in: workspace 1 is not their workspace. The page asked the API
     for another tenant's creator list on every load, and only the backend's ownership check
     stopped it being returned.

     Resolved from /api/workspaces, the same call BrandDashboard uses, and left null while
     signed out so the authenticated fetch never runs. */
  const [workspaceId, setWorkspaceId] = React.useState<number | null>(null);

  React.useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    let cancelled = false;
    fetch('/api/workspaces', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : null))
      .then(list => {
        if (cancelled || !Array.isArray(list) || !list.length) return;
        setWorkspaceId(list[0].id);
      })
      .catch(() => { /* signed-out browsing still works; the list just stays unenriched */ });
    return () => { cancelled = true; };
  }, []);

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
            style={{ fontSize: '18px', fontWeight: 900, fontFamily: 'var(--font-heading)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span style={{ color: 'var(--primary, #5A52FF)' }}>RAFTRA</span> MARKETPLACE
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '3px 10px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
            Creator Discovery Portal ↗
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <GlowButton variant="secondary" onClick={handleDashboardClick} style={{ fontSize: '13px', padding: '8px 16px' }}>
            <LayoutDashboard size={15} /> {isLoggedIn ? 'Back to Dashboard' : 'Back to Dashboard (Sign In)'}
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
        <WorkspaceInfluencer workspaceId={workspaceId} />
      </main>
    </div>
  );
};
