import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Sparkles, ArrowRight, Lock, CheckCircle } from 'lucide-react';

export const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(token ? '' : 'This reset link is invalid. Please request a new one.');
  const [loading, setLoading] = useState(false);

  // Once the password is updated, send the user to the sign-in page automatically.
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => navigate('/login'), 3000);
    return () => clearTimeout(t);
  }, [done, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Please use a password with at least 8 characters.');
      return;
    }
    if (password.length > 64) {
      setError('Please use a password no longer than 64 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match. Please re-enter them.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Could not reset password. Please try again.');
      setDone(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = { width: '100%', padding: '14px 16px 14px 44px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', outline: 'none', transition: 'border-color 0.2s' };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at center, rgba(90,82,255,0.15) 0%, transparent 100%)', position: 'relative', overflow: 'hidden' }}>
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
            {done ? 'Password updated' : 'Set a new password'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '8px' }}>
            {done ? 'Your password has been changed. Taking you to sign in…' : 'Choose a new password for your account.'}
          </p>
          {error && <p style={{ color: 'var(--accent)', fontSize: '13px', marginTop: '12px' }}>{error}</p>}
        </div>

        {done ? (
          <div style={{ textAlign: 'center' }}>
            <CheckCircle size={40} color="var(--primary)" style={{ marginBottom: '24px' }} />
            <button
              onClick={() => navigate('/login')}
              style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, var(--primary) 0%, #3B33FF 100%)', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 8px 16px rgba(90,82,255,0.25)' }}
            >
              Go to sign in <ArrowRight size={18} />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="form-group">
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: '500' }}>New Password</label>
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
                <input type={showPassword ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} placeholder="••••••••" />
              </div>
              <p style={{ fontSize: '12px', color: password.length >= 8 && password.length <= 64 ? '#4ade80' : 'var(--text-secondary)', marginTop: '8px' }}>
                Use between 8 and 64 characters. Mixing letters, numbers, and symbols makes it stronger.
              </p>
            </div>
            <div className="form-group">
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: '500' }}>Confirm New Password</label>
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  title={showConfirm ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', left: '12px', top: '10px', background: 'none', border: 'none', padding: '4px', cursor: 'pointer', color: showConfirm ? 'var(--primary)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
                >
                  <Lock size={18} />
                </button>
                <input type={showConfirm ? 'text' : 'password'} required value={confirm} onChange={(e) => setConfirm(e.target.value)} style={inputStyle} placeholder="••••••••" />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || !token}
              style={{ marginTop: '10px', width: '100%', padding: '16px', background: 'linear-gradient(135deg, var(--primary) 0%, #3B33FF 100%)', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: loading || !token ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 8px 16px rgba(90,82,255,0.25)', opacity: loading || !token ? 0.7 : 1 }}
            >
              {loading ? 'Updating...' : 'Update password'} {!loading && <ArrowRight size={18} />}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
};
