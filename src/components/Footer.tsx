import React from 'react';
import { Cpu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Footer = () => {
  const navigate = useNavigate();

  return (
    <footer style={{ background: '#050505', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '64px', paddingBottom: '32px', color: '#888', fontSize: '14px', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 40px' }}>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '48px', marginBottom: '64px', justifyContent: 'space-between' }}>
          
          <div style={{ flex: '2 1 300px', maxWidth: '400px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#fff' }}>
              <Cpu size={24} color="var(--primary)" />
              <span style={{ fontSize: '18px', fontWeight: 'bold', letterSpacing: '1px' }}>RAFTRA AI</span>
            </div>
            <p style={{ lineHeight: 1.6, marginBottom: '24px' }}>
              Raftra AI is an AI Growth Operating System that helps businesses create ads, launch campaigns, improve SEO and GEO visibility, analyze performance, manage social media, and collaborate with influencers from one unified platform.
            </p>
          </div>

          <div style={{ flex: '1 1 150px' }}>
            <h4 style={{ color: '#fff', fontSize: '15px', fontWeight: 600, marginBottom: '20px' }}>Company</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <li><button onClick={() => navigate('/about')} className="footer-link">About Us</button></li>
              <li><button className="footer-link">Careers</button></li>
              <li><button className="footer-link">Contact</button></li>
              <li><button className="footer-link">Press</button></li>
            </ul>
          </div>

          <div style={{ flex: '1 1 150px' }}>
            <h4 style={{ color: '#fff', fontSize: '15px', fontWeight: 600, marginBottom: '20px' }}>Product</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <li><button onClick={() => navigate('/features/creative')} className="footer-link">AI Creative Studio</button></li>
              <li><button onClick={() => navigate('/features/campaign')} className="footer-link">Campaign Manager</button></li>
              <li><button onClick={() => navigate('/features/seo')} className="footer-link">SEO & GEO</button></li>
              <li><button onClick={() => navigate('/features/review')} className="footer-link">Analytics</button></li>
            </ul>
          </div>

          <div style={{ flex: '1 1 150px' }}>
            <h4 style={{ color: '#fff', fontSize: '15px', fontWeight: 600, marginBottom: '20px' }}>Resources</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <li><button className="footer-link">Documentation</button></li>
              <li><button className="footer-link">API</button></li>
              <li><button className="footer-link">Guides</button></li>
              <li><button className="footer-link">Support</button></li>
            </ul>
          </div>

          <div style={{ flex: '1 1 150px' }}>
            <h4 style={{ color: '#fff', fontSize: '15px', fontWeight: 600, marginBottom: '20px' }}>Legal</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <li><button className="footer-link">Privacy Policy</button></li>
              <li><button className="footer-link">Terms of Service</button></li>
              <li><button onClick={() => navigate('/security')} className="footer-link">Security</button></li>
              <li><button className="footer-link">Cookies</button></li>
            </ul>
          </div>

        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '32px', textAlign: 'center', fontSize: '13px' }}>
          <p style={{ margin: 0 }}>© 2026 Raftra AI. Built for modern growth teams. Secure, AI-powered marketing operations from one platform.</p>
        </div>

      </div>

      <style>{`
        .footer-link {
          background: transparent;
          border: none;
          color: #888;
          cursor: pointer;
          font-size: 14px;
          padding: 0;
          transition: color 0.2s ease;
        }
        .footer-link:hover {
          color: #fff;
        }
      `}</style>
    </footer>
  );
};
