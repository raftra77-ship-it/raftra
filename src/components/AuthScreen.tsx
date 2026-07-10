import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Lock } from 'lucide-react';

interface AuthScreenProps {
  onLoginComplete: (hasWorkspace: boolean, isCreator?: boolean) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginComplete }) => {
  const [isSignUp, setIsSignUp] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [isCreator, setIsCreator] = useState(false);

  React.useEffect(() => {
    const onboardUsername = localStorage.getItem('onboard_username');
    if (onboardUsername) {
      setUsername(onboardUsername);
      setIsCreator(true);
      setIsSignUp(true);
      localStorage.removeItem('onboard_username');
    }
  }, []);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        const parts = name.split(' ');
        const first = parts[0] || 'User';
        const last = parts.slice(1).join(' ') || 'Name';
        const res = await fetch('http://localhost:8005/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, username, first_name: first, last_name: last, role: isCreator ? 'creator' : 'brand' })
        });
        if (!res.ok) {
          const data = await res.json();
          if (data.detail && data.detail.includes("already registered")) {
            throw new Error("Email already registered. Please click 'Sign in' below.");
          }
          throw new Error(data.detail || "Signup failed");
        }
      }

      const res = await fetch('http://localhost:8005/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email, password })
      });
      if (!res.ok) throw new Error("Invalid credentials");
      const data = await res.json();
      localStorage.setItem('token', data.access_token);
      
      let hasWorkspace = false;
      try {
        const wsRes = await fetch('http://localhost:8005/api/workspaces', {
          headers: { 'Authorization': `Bearer ${data.access_token}` }
        });
        if (wsRes.ok) {
          const wsData = await wsRes.json();
          if (wsData && wsData.length > 0) hasWorkspace = true;
        }
      } catch (e) {}

      onLoginComplete(hasWorkspace, data.role === 'creator');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at center, rgba(90,82,255,0.15) 0%, var(--bg-primary) 100%)', position: 'relative', overflow: 'hidden' }}>
      
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
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '8px' }}>
            {isSignUp ? 'Start building AI-powered campaigns.' : 'Enter your details to access your workspace.'}
          </p>
          {error && <p style={{ color: 'var(--accent)', fontSize: '13px', marginTop: '12px' }}>{error}</p>}
        </div>

        {/* Brand vs Creator Toggle */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '4px', marginBottom: '24px' }}>
          <button 
            type="button"
            onClick={() => setIsCreator(false)}
            style={{ flex: 1, padding: '8px', border: 'none', background: !isCreator ? 'rgba(90,82,255,0.2)' : 'transparent', color: !isCreator ? '#fff' : 'var(--text-secondary)', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: !isCreator ? 600 : 400, transition: 'all 0.2s' }}>
            Brand / Agency
          </button>
          <button 
            type="button"
            onClick={() => setIsCreator(true)}
            style={{ flex: 1, padding: '8px', border: 'none', background: isCreator ? 'rgba(90,82,255,0.2)' : 'transparent', color: isCreator ? '#fff' : 'var(--text-secondary)', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: isCreator ? 600 : 400, transition: 'all 0.2s' }}>
            Creator
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {isSignUp && (
            <>
              <div className="form-group">
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: '500' }}>Username</label>
                <input 
                  type="text" 
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  style={{ width: '100%', padding: '14px 16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', outline: 'none', transition: 'border-color 0.2s' }}
                  placeholder="your_handle"
                />
              </div>
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
            </>
          )}
          <div className="form-group">
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: '500' }}>
              {isSignUp ? 'Email Address' : 'Email or Username'}
            </label>
            <input 
              type={isSignUp ? "email" : "text"}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: '14px 16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', outline: 'none', transition: 'border-color 0.2s' }}
              placeholder={isSignUp ? "you@company.com" : "you@company.com or username"}
            />
          </div>
          <div className="form-group">
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: '500' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="var(--text-secondary)" style={{ position: 'absolute', left: '16px', top: '14px' }} />
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%', padding: '14px 16px 14px 44px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', outline: 'none', transition: 'border-color 0.2s' }}
                placeholder="••••••••"
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            style={{ marginTop: '10px', width: '100%', padding: '16px', background: 'linear-gradient(135deg, var(--primary) 0%, #3B33FF 100%)', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 8px 16px rgba(90,82,255,0.25)', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Processing...' : (isSignUp ? 'Get Started' : 'Sign In')} {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button 
              onClick={() => setIsSignUp(!isSignUp)}
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
