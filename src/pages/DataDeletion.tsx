import React from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

// Public legal page. Meta specifically requires a Data Deletion instructions URL before
// approving an app for production access, so this route must stay publicly accessible.
//
// ⚠️ REPLACE BEFORE PUBLISHING — placeholders below. Meta verifies the address works.
const ENTITY = '[Your registered legal entity name]';
const CONTACT_EMAIL = '[privacy@yourdomain.com]';
const RESPONSE_DAYS = 30;
const LAST_UPDATED = '5 August 2026';

const h2: React.CSSProperties = {
  fontSize: '22px', fontFamily: 'var(--font-heading)', color: '#fff',
  margin: '40px 0 14px', paddingTop: '8px',
};
const p: React.CSSProperties = {
  fontSize: '15px', lineHeight: 1.75, color: 'rgba(255,255,255,0.75)', margin: '0 0 14px',
};
const li: React.CSSProperties = { ...p, margin: '0 0 8px' };
const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '12px', padding: '20px 22px', margin: '0 0 16px',
};

export const DataDeletion = () => (
  <div style={{ minHeight: '100vh', background: 'transparent', color: '#fff', paddingTop: '100px', paddingBottom: '80px', fontFamily: 'var(--font-sans)' }}>
    <Navbar />
    <div style={{ maxWidth: '820px', margin: '0 auto', padding: '40px 24px', position: 'relative', zIndex: 1 }}>

      <h1 style={{ fontSize: '44px', fontFamily: 'var(--font-heading)', margin: '0 0 10px', lineHeight: 1.15 }}>
        Data Deletion
      </h1>
      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 8px' }}>Last updated: {LAST_UPDATED}</p>
      <p style={p}>
        This page explains how to disconnect a platform from Raftra, and how to request deletion
        of your account and personal data. Raftra is operated by {ENTITY}.
      </p>

      <h2 style={h2}>Option 1 — Disconnect a single platform</h2>
      <p style={p}>
        Use this if you want to keep your Raftra account but stop us accessing one connected
        service (for example your Meta ad account or your WordPress site).
      </p>
      <div style={card}>
        <ol style={{ paddingLeft: '20px', margin: 0 }}>
          <li style={li}>Sign in to Raftra and open your workspace.</li>
          <li style={li}>Go to <strong style={{ color: '#fff' }}>Integrations</strong>, or open{' '}
            <strong style={{ color: '#fff' }}>SEO + GEO → View Report → Connect &amp; Publish</strong>.</li>
          <li style={li}>Find the platform and choose <strong style={{ color: '#fff' }}>Disconnect</strong>.</li>
        </ol>
      </div>
      <p style={p}>
        Disconnecting immediately deletes the stored access token for that platform, so Raftra
        can no longer read from or write to it. Content already published to your own site or
        advertising account stays where it is — it belongs to you, and you can edit or remove it
        there.
      </p>

      <h2 style={h2}>Option 2 — Revoke access from the platform itself</h2>
      <p style={p}>
        You can also remove Raftra's access directly from the platform's own settings, which
        works even if you cannot sign in to Raftra:
      </p>
      <ul style={{ paddingLeft: '20px', margin: '0 0 14px' }}>
        <li style={li}><strong style={{ color: '#fff' }}>Meta:</strong> Facebook Settings → Business
          Integrations → select Raftra → Remove.</li>
        <li style={li}><strong style={{ color: '#fff' }}>Google (Ads, Search Console, Analytics):</strong>{' '}
          Google Account → Security → Third-party apps with account access → Raftra → Remove access.</li>
        <li style={li}><strong style={{ color: '#fff' }}>GitHub:</strong> Settings → Applications →
          Authorized OAuth Apps → Raftra → Revoke.</li>
        <li style={li}><strong style={{ color: '#fff' }}>Shopify:</strong> Store admin → Settings →
          Apps and sales channels → Raftra → Uninstall.</li>
        <li style={li}><strong style={{ color: '#fff' }}>WordPress:</strong> WP Admin → Users → Profile
          → Application Passwords → revoke the Raftra password. For WordPress.com, remove Raftra
          under Account Settings → Connected Applications.</li>
      </ul>

      <h2 style={h2}>Option 3 — Delete your Raftra account and all data</h2>
      <div style={card}>
        <p style={{ ...p, margin: '0 0 10px' }}>
          Email <strong style={{ color: '#fff' }}>{CONTACT_EMAIL}</strong> from the address
          registered to your account, with the subject line:
        </p>
        <p style={{ ...p, margin: '0 0 10px', fontFamily: 'var(--font-mono, monospace)', color: '#fff' }}>
          Delete my Raftra account
        </p>
        <p style={{ ...p, margin: 0 }}>
          We use the sending address to verify the request. If you cannot email from the
          registered address, tell us and we will verify your identity another way.
        </p>
      </div>

      <h2 style={h2}>What gets deleted</h2>
      <ul style={{ paddingLeft: '20px', margin: '0 0 14px' }}>
        <li style={li}>Your account record: email, name, username and password hash.</li>
        <li style={li}>All workspaces, brand profiles and knowledge-base content, including the
          vector embeddings generated from them.</li>
        <li style={li}>All SEO and GEO audits, recommendations, approvals and content drafts.</li>
        <li style={li}>All campaign drafts, creative assets and generated ad copy held in Raftra.</li>
        <li style={li}>All stored access tokens for every connected platform, which are revoked and removed.</li>
        <li style={li}>Security and activity logs associated with your account.</li>
      </ul>

      <h2 style={h2}>What is not deleted</h2>
      <ul style={{ paddingLeft: '20px', margin: '0 0 14px' }}>
        <li style={li}><strong style={{ color: '#fff' }}>Content already published to your own
          properties</strong> — pages on your website, pull requests on your repository,
          campaigns in your ad account. These live on systems you control, so you remove them there.</li>
        <li style={li}><strong style={{ color: '#fff' }}>Payment and tax records</strong>, which we
          are legally required to retain for a statutory period. These are kept only for
          accounting and are not used for any other purpose.</li>
      </ul>

      <h2 style={h2}>How long it takes</h2>
      <p style={p}>
        We acknowledge deletion requests promptly and complete them within{' '}
        <strong style={{ color: '#fff' }}>{RESPONSE_DAYS} days</strong>. We will confirm by email
        once your data has been deleted. Access tokens are revoked immediately on receipt, before
        the rest of the deletion is processed.
      </p>

      <h2 style={h2}>Other data requests</h2>
      <p style={p}>
        You can also ask for a copy of your data, or correction of inaccurate data, at the same
        address. See our <a href="/privacy-policy" style={{ color: 'var(--primary)' }}>Privacy
        Policy</a> for the full list of your rights.
      </p>

      <h2 style={h2}>Contact</h2>
      <p style={p}>
        All deletion and privacy requests: <strong style={{ color: '#fff' }}>{CONTACT_EMAIL}</strong>.
      </p>
    </div>
    <Footer />
  </div>
);
