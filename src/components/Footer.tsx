import React from 'react';
import { Cpu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Footer = () => {
  const navigate = useNavigate();

  return (
    <footer style={{ background: '#050508', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '64px', paddingBottom: '40px', color: '#8e8e9e', fontSize: '14px', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 32px' }}>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '40px', marginBottom: '56px' }}>
          
          {/* Brand Info Column (Span 2) */}
          <div style={{ gridColumn: 'span 2', maxWidth: '380px' }}>
            <div 
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#fff', cursor: 'pointer' }}
              onClick={() => navigate('/')}
            >
              <Cpu size={22} color="var(--primary)" />
              <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', fontFamily: 'var(--font-heading)' }}>
                Raftra<span style={{ color: 'var(--primary)' }}>AI</span>
              </span>
            </div>
            <p style={{ lineHeight: 1.6, margin: 0, fontSize: '13.5px', color: 'rgba(255, 255, 255, 0.65)' }}>
              Raftra AI is an Autonomous AI Growth Operating System. Empowering modern D2C brands with AI creative generation, campaign scaling, AEO search optimization, and creator escrow management.
            </p>
          </div>

          {/* Column 1: Company */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <h4 style={{ color: '#fff', fontSize: '14px', fontWeight: 700, margin: '0 0 18px 0', letterSpacing: '0.02em', textTransform: 'uppercase' }}>Company</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', alignItems: 'flex-start' }}>
              <li><button onClick={() => navigate('/about')} className="footer-link">About Us</button></li>
              <li><button onClick={() => navigate('/careers')} className="footer-link">Careers</button></li>
              <li><button onClick={() => navigate('/blog')} className="footer-link">Growth Blog</button></li>
              <li><button onClick={() => navigate('/about')} className="footer-link">Contact Team</button></li>
            </ul>
          </div>

          {/* Column 2: Product */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <h4 style={{ color: '#fff', fontSize: '14px', fontWeight: 700, margin: '0 0 18px 0', letterSpacing: '0.02em', textTransform: 'uppercase' }}>Product</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', alignItems: 'flex-start' }}>
              <li><button onClick={() => navigate('/features/creative')} className="footer-link">AI Creative Studio</button></li>
              <li><button onClick={() => navigate('/features/campaign')} className="footer-link">Campaign Manager</button></li>
              <li><button onClick={() => navigate('/features/seo')} className="footer-link">SEO & AEO Engine</button></li>
              <li><button onClick={() => navigate('/features/review')} className="footer-link">Growth Analytics</button></li>
              <li><button onClick={() => navigate('/features/influencer')} className="footer-link">Creator Marketplace</button></li>
            </ul>
          </div>

          {/* Column 3: Resources (Left Aligned) */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <h4 style={{ color: '#fff', fontSize: '14px', fontWeight: 700, margin: '0 0 18px 0', letterSpacing: '0.02em', textTransform: 'uppercase' }}>Resources</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', alignItems: 'flex-start' }}>
              <li><button onClick={() => navigate('/docs')} className="footer-link">User Manuals & Docs</button></li>
              <li><button onClick={() => navigate('/blog')} className="footer-link">Playbooks & Case Studies</button></li>
              <li><button onClick={() => navigate('/docs')} className="footer-link">API & Integrations</button></li>
              <li><button onClick={() => navigate('/security')} className="footer-link">Security Center</button></li>
            </ul>
          </div>

          {/* Column 4: Legal */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <h4 style={{ color: '#fff', fontSize: '14px', fontWeight: 700, margin: '0 0 18px 0', letterSpacing: '0.02em', textTransform: 'uppercase' }}>Legal</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', alignItems: 'flex-start' }}>
              <li><button className="footer-link">Privacy Policy</button></li>
              <li><button className="footer-link">Terms of Service</button></li>
              <li><button onClick={() => navigate('/security')} className="footer-link">Data Security</button></li>
              <li><button className="footer-link">Cookie Preferences</button></li>
            </ul>
          </div>

        </div>

        {/* Bottom Copyright Strip */}
        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
          <p style={{ margin: 0 }}>© 2026 Raftra AI. Built for modern growth teams. All rights reserved.</p>
          <div style={{ display: 'flex', gap: '16px' }}>
            <button onClick={() => navigate('/security')} className="footer-link" style={{ fontSize: '12.5px' }}>Security</button>
            <span>•</span>
            <button onClick={() => navigate('/docs')} className="footer-link" style={{ fontSize: '12.5px' }}>Documentation</button>
            <span>•</span>
            <button onClick={() => navigate('/privacy')} className="footer-link" style={{ fontSize: '12.5px' }}>Privacy</button>
          </div>
        </div>

      </div>

      <style>{`
        .footer-link {
          background: transparent;
          border: none;
          color: #8e8e9e;
          cursor: pointer;
          font-size: 13.5px;
          padding: 0;
          margin: 0;
          text-align: left;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: color 0.15s ease, transform 0.15s ease;
          font-family: inherit;
        }
        .footer-link:hover {
          color: #ffffff;
          transform: translateX(2px);
        }
      `}</style>
    </footer>
  );
};
