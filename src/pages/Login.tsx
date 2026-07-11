import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cpu, Mail, Lock, ArrowRight, User } from 'lucide-react';
import '../App.css';

export function Login() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);
    
    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const bodyPayload = isLogin 
        ? { email, password }
        : { email, password, first_name: firstName, last_name: lastName };

      const response = await fetch(`${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const msg = typeof errorData.detail === 'string' 
          ? errorData.detail 
          : (Array.isArray(errorData.detail) ? errorData.detail[0].msg : 'Authentication failed.');
        setErrorMsg(msg);
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      
      // Store token if login
      if (data.access_token) {
        localStorage.setItem('token', data.access_token);
      } else if (!isLogin) {
        // If registered successfully, automatically log them in
        const loginRes = await fetch(`/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const loginData = await loginRes.json();
        if (loginData.access_token) {
          localStorage.setItem('token', loginData.access_token);
        }
      }
      
      navigate('/dashboard');
    } catch (error) {
      console.error('Error connecting to backend:', error);
      setErrorMsg('Could not connect to the server. Is the backend running?');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="onboarding-overlay" style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', height: '100vh', width: '100vw', background: 'var(--bg-primary)' }}>
      <div className="onboarding-modal" style={{ maxWidth: '420px', width: '100%', margin: 'auto', background: 'var(--bg-secondary)', padding: '40px', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <div className="logo-icon-container" style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--accent-glow)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Cpu size={24} style={{ color: 'var(--accent)' }} />
            </div>
          </div>
          <h2 style={{ fontSize: '26px', fontFamily: 'var(--font-heading)', color: '#fff', marginBottom: '8px' }}>
            {isLogin ? 'Welcome back' : 'Create an account'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            {isLogin ? 'Enter your details to access your OS.' : 'Start coordinating your AI agents today.'}
          </p>
        </div>

        {errorMsg && (
          <div style={{ background: 'var(--danger-glow)', color: 'var(--danger)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', textAlign: 'center', border: '1px solid rgba(255, 71, 87, 0.2)' }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          {!isLogin && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="input-group">
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block', fontWeight: 600 }}>First Name</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input
                    type="text"
                    required={!isLogin}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    style={{ width: '100%', padding: '12px 12px 12px 38px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'white', outline: 'none', fontSize: '14px' }}
                  />
                </div>
              </div>
              <div className="input-group">
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block', fontWeight: 600 }}>Last Name</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input
                    type="text"
                    required={!isLogin}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    style={{ width: '100%', padding: '12px 12px 12px 38px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'white', outline: 'none', fontSize: '14px' }}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="input-group">
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block', fontWeight: 600 }}>Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                style={{ width: '100%', padding: '12px 12px 12px 38px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'white', outline: 'none', fontSize: '14px' }}
              />
            </div>
          </div>

          <div className="input-group">
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block', fontWeight: 600 }}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ width: '100%', padding: '12px 12px 12px 38px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'white', outline: 'none', fontSize: '14px' }}
              />
            </div>
          </div>

          <button type="submit" disabled={isLoading} className="glow-button" style={{ width: '100%', marginTop: '0.5rem', padding: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', opacity: isLoading ? 0.7 : 1 }}>
            <span>{isLoading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}</span>
            {!isLoading && <ArrowRight size={16} />}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={() => { setIsLogin(!isLogin); setErrorMsg(''); }}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', transition: 'color 0.2s ease' }}
            onMouseOver={(e) => e.currentTarget.style.color = '#fff'}
            onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
