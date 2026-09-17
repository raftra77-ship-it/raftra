import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Sparkles, ArrowRight, Lock } from 'lucide-react';

interface AuthScreenProps {
  onLoginComplete: (hasWorkspace: boolean, isCreator?: boolean) => void;
}

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginComplete }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // The tab and the mode live in the URL, so /login?role=creator&mode=signup can be linked
  // from the creator side of the site and a refresh keeps the tab the user chose. Both were
  // plain state that always started on Brand / Sign in.
  const [isSignUp, setIsSignUp] = useState(searchParams.get('mode') === 'signup');
  const [isCreator, setIsCreator] = useState(searchParams.get('role') === 'creator');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');

  const [error, setError] = useState(searchParams.get('error') || '');
  const [loading, setLoading] = useState(false);
  // null until the server answers: the Google button is offered only when the backend can
  // actually complete the flow, instead of sending the user to a 503.
  const [googleEnabled, setGoogleEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/providers')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled) setGoogleEnabled(d ? !!d.google : false); })
      .catch(() => { if (!cancelled) setGoogleEnabled(false); });
    return () => { cancelled = true; };
  }, []);

  const syncUrl = (creator: boolean, signUp: boolean) => {
    const next = new URLSearchParams(searchParams);
    next.delete('error');
    if (creator) next.set('role', 'creator'); else next.delete('role');
    if (signUp) next.set('mode', 'signup'); else next.delete('mode');
    setSearchParams(next, { replace: true });
  };
  const chooseRole = (creator: boolean) => {
    setIsCreator(creator);
    setError('');
    syncUrl(creator, isSignUp);
  };
  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError('');
    syncUrl(isCreator, !isSignUp);
  };

  const copy = isCreator
    ? {
        title: isSignUp ? 'Join as a creator' : 'Creator sign in',
        subtitle: isSignUp ? 'Get discovered by brands and manage paid collaborations.'
                           : 'Open your Creator Portal: deals, messages and payouts.',
        emailPlaceholder: 'you@example.com',
      }
    : {
        title: isSignUp ? 'Create your brand account' : 'Welcome back',
        subtitle: isSignUp ? 'Start building AI-powered campaigns.'
                           : 'Enter your details to access your workspace.',
        emailPlaceholder: 'you@company.com',
      };

  const handleSocialLogin = (provider: 'google') => {
    const role = isCreator ? 'creator' : 'brand';
    window.location.href = `/api/auth/oauth/${provider}/authorize?role=${role}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let token: string | undefined;
      if (isSignUp) {
        // No invented names: this used to store "User" / "Name" when a part was missing,
        // which then showed on the creator card and in brand chats.
        const parts = name.trim().split(/\s+/);
        const first = parts[0] || '';
        const last = parts.slice(1).join(' ');
        if (!first) throw new Error('Please enter your name.');
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            first_name: first,
            last_name: last,
            username: email.split('@')[0],
            role: isCreator ? 'creator' : 'brand'
          })
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || 'Signup failed. Please try again.');
        }
        // Register already returns a session, so a second round trip to /login is not
        // needed to sign the new account in.
        token = (await res.json().catch(() => ({}))).access_token;
      }

      if (!token) {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // The tab is sent so the server can say "this is a Brand account" rather than
          // issuing a brand token for a Creator sign-in and letting RequireAuth bounce the
          // user to /dashboard with no explanation. It never decides the session's role —
          // that still comes from the account, read back off the JWT below.
          body: JSON.stringify({ identifier: email, password, role: isCreator ? 'creator' : 'brand' })
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || 'Incorrect email or password.');
        }
        const data = await res.json();
        token = data.access_token;
      }
      if (!token) throw new Error('Login failed: no token returned.');

      localStorage.setItem('token', token);

      let hasWorkspace = false;
      let actualIsCreator = isCreator;
      try {
        const payloadBase64 = token.split('.')[1];
        const decoded = JSON.parse(atob(payloadBase64));
        if (decoded.role === 'creator') {
          actualIsCreator = true;
        }
      } catch(e) {}

      if (!actualIsCreator) {
        try {
          // Asks the server where to land rather than inferring it from the workspace list.
          // "Has a workspace" is not the same question as "finished onboarding": a workspace
          // row exists before the crawl completes, so the old check sent users who had
          // already onboarded back through the wizard on every login.
          const stRes = await fetch('/api/workspaces/onboarding-state', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (stRes.ok) {
            const st = await stRes.json();
            hasWorkspace = !!st.is_onboarded;
            // Cached so the homepage CTA can route without repeating this call, which is a
            // round trip to a remote database and takes seconds.
            try { localStorage.setItem('raftra_onboarded', hasWorkspace ? '1' : '0'); } catch { /* private mode */ }
          }
        } catch (e) {}
      }

      onLoginComplete(hasWorkspace, actualIsCreator);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at center, rgba(90,82,255,0.15) 0%, transparent 100%)', position: 'relative', overflow: 'hidden' }}>
      
      {/* Background decorations */}
      <div style={{ position: 'absolute', top: '10%', left: '20%', width: '300px', height: '300px', background: 'var(--primary)', filter: 'blur(150px)', opacity: 0.1, borderRadius: '50%' }}></div>
      <div style={{ position: 'absolute', bottom: '10%', right: '20%', width: '300px', height: '300px', background: 'var(--accent)', filter: 'blur(150px)', opacity: 0.1, borderRadius: '50%' }}></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ width: '100%', maxWidth: '420px', padding: '40px', background: 'rgba(20,20,20,0.6)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', boxShadow: '0 24px 48px rgba(0,0,0,0.5)', zIndex: 1 }}
      >
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'rgba(90,82,255,0.1)', borderRadius: '100px', border: '1px solid rgba(90,82,255,0.2)', marginBottom: '16px' }}>
            <Sparkles size={16} color="var(--primary)" />
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--primary)' }}>raftra.ai</span>
          </div>
          <h1 style={{ fontSize: '28px', fontFamily: 'var(--font-heading)', margin: 0, background: 'linear-gradient(to right, #fff, rgba(255,255,255,0.5))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {copy.title}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '8px' }}>
            {copy.subtitle}
          </p>
          {error && <p style={{ color: 'var(--accent)', fontSize: '13px', marginTop: '12px' }}>{error}</p>}
        </div>

        {/* Brand vs Creator Toggle */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '4px', marginBottom: '24px' }}>
          <button 
            type="button"
            onClick={() => chooseRole(false)}
            style={{ flex: 1, padding: '8px', border: 'none', background: !isCreator ? 'rgba(90,82,255,0.2)' : 'transparent', color: !isCreator ? '#fff' : 'var(--text-secondary)', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: !isCreator ? 600 : 400, transition: 'all 0.2s' }}>
            Brand / Agency
          </button>
          <button 
            type="button"
            onClick={() => chooseRole(true)}
            style={{ flex: 1, padding: '8px', border: 'none', background: isCreator ? 'rgba(90,82,255,0.2)' : 'transparent', color: isCreator ? '#fff' : 'var(--text-secondary)', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: isCreator ? 600 : 400, transition: 'all 0.2s' }}>
            Creator
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {isSignUp && (
            <div className="form-group">
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: '500' }}>Full Name</label>
              <input 
                type="text" 
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ width: '100%', padding: '14px 16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', outline: 'none', transition: 'border-color 0.2s' }}
                placeholder="John Doe"
              />
            </div>
          )}
          <div className="form-group">
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: '500' }}>Email Address</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: '14px 16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', outline: 'none', transition: 'border-color 0.2s' }}
              placeholder={copy.emailPlaceholder}
            />
          </div>
          <div className="form-group">
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: '500' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
                style={{ position: 'absolute', left: '12px', top: '10px', background: 'none', border: 'none', padding: '4px', cursor: 'pointer', color: showPassword ? 'var(--primary)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
              >
                <Lock size={18} />
              </button>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%', padding: '14px 16px 14px 44px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', outline: 'none', transition: 'border-color 0.2s' }}
                placeholder="••••••••"
              />
            </div>
            {!isSignUp && (
              <div style={{ textAlign: 'right', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', padding: 0 }}
                >
                  Forgot password?
                </button>
              </div>
            )}
          </div>

          <button 
            type="submit"
            disabled={loading}
            style={{ marginTop: '10px', width: '100%', padding: '16px', background: 'linear-gradient(135deg, var(--primary) 0%, #3B33FF 100%)', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 8px 16px rgba(90,82,255,0.25)', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Processing...' : (isSignUp ? 'Get Started' : 'Sign In')} {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        {/* Social login */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '24px 0' }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>or continue with</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={() => handleSocialLogin('google')}
            disabled={googleEnabled === false}
            title={googleEnabled === false ? 'Google sign-in is not configured on this server' : undefined}
            style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', fontSize: '14px', fontWeight: 500, cursor: googleEnabled === false ? 'not-allowed' : 'pointer', opacity: googleEnabled === false ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}
          >
            <GoogleIcon /> Continue with Google{isCreator ? ' as a creator' : ''}
          </button>
        </div>
        {googleEnabled === false && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', textAlign: 'center', margin: '8px 0 0' }}>
            Google sign-in is unavailable right now. Use your email and password.
          </p>
        )}

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button 
              onClick={toggleMode}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '600', cursor: 'pointer', padding: 0 }}
            >
              {isSignUp ? 'Sign in' : 'Create one'}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
};
