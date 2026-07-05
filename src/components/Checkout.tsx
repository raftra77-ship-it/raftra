import { useState } from 'react';
import { CreditCard, Zap, CheckCircle2 } from 'lucide-react';
import '../App.css';

export function Checkout() {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');

  const handleSubscribe = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/api/payments/create-checkout-session?email=${email}`, {
        method: 'POST',
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url; // Redirect to Stripe Checkout
      }
    } catch (error) {
      console.error("Payment failed to initialize:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ background: 'var(--bg-secondary)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)', maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
      <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '50%', background: 'var(--accent-glow)', color: 'var(--accent)', marginBottom: '16px' }}>
        <Zap size={24} />
      </div>
      <h2 style={{ fontSize: '20px', fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>Pro Subscription</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
        Unlock full agent coordination, advanced analytics, and unlimited projects.
      </p>

      <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '8px', marginBottom: '24px', textAlign: 'left' }}>
        <h3 style={{ fontSize: '14px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CreditCard size={16}/> Secure Payment
        </h3>
        
        <input 
          type="email" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Billing Email" 
          style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'white', marginBottom: '12px', outline: 'none' }}
        />
        
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={14} style={{ color: 'var(--success)' }}/> Unlimited AI Agents</li>
          <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={14} style={{ color: 'var(--success)' }}/> Dedicated Account Manager</li>
          <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={14} style={{ color: 'var(--success)' }}/> Priority Support</li>
        </ul>
      </div>

      <button 
        onClick={handleSubscribe} 
        disabled={isLoading || !email}
        className="glow-button" 
        style={{ width: '100%', padding: '12px', opacity: (isLoading || !email) ? 0.7 : 1 }}
      >
        {isLoading ? 'Processing...' : 'Subscribe - $20/mo'}
      </button>
    </div>
  );
}
