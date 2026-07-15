import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, MailCheck } from 'lucide-react';

export const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Something went wrong. Please try again.');
      }
      setSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
            {sent ? 'Check your email' : 'Forgot password?'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '8px' }}>
            {sent
              ? `If an account exists for ${email}, we've sent a link to reset your password.`
              : "Enter your account email and we'll send you a reset link. Works for both brand and creator accounts."}
          </p>
          {error && <p style={{ color: 'var(--accent)', fontSize: '13px', marginTop: '12px' }}>{error}</p>}
        </div>

        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <MailCheck size={40} color="var(--primary)" style={{ marginBottom: '16px' }} />
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="form-group">
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: '500' }}>Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%', padding: '14px 16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', outline: 'none', transition: 'border-color 0.2s' }}
                placeholder="you@company.com"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{ marginTop: '10px', width: '100%', padding: '16px', background: 'linear-gradient(135deg, var(--primary) 0%, #3B33FF 100%)', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 8px 16px rgba(90,82,255,0.25)', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Sending...' : 'Send reset link'} {!loading && <ArrowRight size={18} />}
            </button>
          </form>
        )}

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <button
            onClick={() => navigate('/login')}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '600', cursor: 'pointer', padding: 0, fontSize: '14px' }}
          >
            Back to sign in
          </button>
        </div>
      </motion.div>
    </div>
  );
};
