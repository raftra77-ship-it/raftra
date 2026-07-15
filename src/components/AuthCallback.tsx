import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

interface AuthCallbackProps {
  onLoginComplete: (hasWorkspace: boolean, isCreator?: boolean) => void;
}

// Landing point after Google OAuth: the backend redirects here with
// ?token=...&role=... — store the token and route the user to their dashboard.
export const AuthCallback: React.FC<AuthCallbackProps> = ({ onLoginComplete }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const token = searchParams.get('token');
    const role = searchParams.get('role');

    if (!token) {
      navigate('/login?error=' + encodeURIComponent('Sign-in failed. Please try again.'));
      return;
    }

    localStorage.setItem('token', token);
    const isCreator = role === 'creator';

    const finish = async () => {
      let hasWorkspace = false;
      if (!isCreator) {
        try {
          const wsRes = await fetch('/api/workspaces', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (wsRes.ok) {
            const wsData = await wsRes.json();
            if (wsData && wsData.length > 0) hasWorkspace = true;
          }
        } catch (e) {}
      }
      onLoginComplete(hasWorkspace, isCreator);
    };
    finish();
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
      <Sparkles size={32} color="var(--primary)" />
      <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>Signing you in...</p>
    </div>
  );
};
