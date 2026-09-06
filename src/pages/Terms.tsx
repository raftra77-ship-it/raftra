import React from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

// Public legal page. Meta, Google and Razorpay require a reachable Terms URL before granting
// production access, so this route must stay publicly accessible.
//
// ⚠️ REPLACE BEFORE PUBLISHING — placeholders below.
const ENTITY = '[Your registered legal entity name]';
const CONTACT_EMAIL = '[support@yourdomain.com]';
const JURISDICTION = 'India';
const COURTS = '[your city], India';
const LAST_UPDATED = '5 August 2026';

const h2: React.CSSProperties = {
  fontSize: '22px', fontFamily: 'var(--font-heading)', color: '#fff',
  margin: '40px 0 14px', paddingTop: '8px',
};
const p: React.CSSProperties = {
  fontSize: '15px', lineHeight: 1.75, color: 'rgba(255,255,255,0.75)', margin: '0 0 14px',
};
const li: React.CSSProperties = { ...p, margin: '0 0 8px' };

export const Terms = () => (
  <div style={{ minHeight: '100vh', background: 'transparent', color: '#fff', paddingTop: '100px', paddingBottom: '80px', fontFamily: 'var(--font-sans)' }}>
    <Navbar />
    <div style={{ maxWidth: '820px', margin: '0 auto', padding: '40px 24px', position: 'relative', zIndex: 1 }}>

      <h1 style={{ fontSize: 'clamp(28px, 5.4vw, 44px)', fontFamily: 'var(--font-heading)', margin: '0 0 10px', lineHeight: 1.15 }}>
        Terms of Service
      </h1>
      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 8px' }}>Last updated: {LAST_UPDATED}</p>
      <p style={p}>
        These terms govern your use of Raftra, operated by {ENTITY}. By creating an account or
        using the service you agree to them. If you do not agree, please do not use Raftra.
      </p>

      <h2 style={h2}>1. Eligibility and your account</h2>
      <p style={p}>
        You must be at least 18 years old and able to enter a binding contract. You are
        responsible for the accuracy of your account details, for keeping your credentials
        secure, and for all activity that happens under your account. Tell us promptly at{' '}
        <strong style={{ color: '#fff' }}>{CONTACT_EMAIL}</strong> if you suspect unauthorised access.
      </p>

      <h2 style={h2}>2. What Raftra does</h2>
      <p style={p}>
        Raftra is an AI-assisted marketing tool. It audits websites for search and AI-answer
        visibility, drafts content and advertising campaigns, and — where you connect a
        platform and approve a change — applies those changes to your own properties and
        advertising accounts.
      </p>

      <h2 style={h2}>3. Your authority over connected accounts</h2>
      <p style={p}>
        You may only connect websites, repositories, stores and advertising accounts that you
        own or are explicitly authorised to manage. By connecting an account you confirm you
        hold that authority. You are responsible for any change made through your connection,
        and for ensuring your use complies with the terms of the connected platform.
      </p>

      <h2 style={h2}>4. Approval, and changes to your properties</h2>
      <p style={p}>
        Raftra does not modify your properties without your approval. Recommendations must be
        approved by you, and changes are presented as a preview before being applied. Where a
        platform supports it we take a snapshot beforehand so a change can be reverted, and on
        GitHub we open a pull request rather than committing to your default branch.
      </p>
      <p style={p}>
        Even so, you remain responsible for reviewing every change before and after it is
        applied. We strongly recommend keeping your own backups of any site you connect.
      </p>

      <h2 style={h2}>5. Advertising campaigns and spend</h2>
      <p style={p}>
        Campaigns created through Raftra are created in a <strong style={{ color: '#fff' }}>paused</strong>{' '}
        state and do not begin delivering or spending automatically. Activating a campaign is
        your decision, taken in the advertising platform itself.
      </p>
      <p style={p}>
        <strong style={{ color: '#fff' }}>All advertising spend is billed to you by Meta, Google
        or the relevant platform — not by Raftra.</strong> You are solely responsible for your
        advertising budgets, for the resulting charges, and for ensuring your ads comply with
        each platform's advertising policies and with applicable law.
      </p>

      <h2 style={h2}>6. AI-generated output</h2>
      <p style={p}>
        Raftra uses AI models to generate audits, recommendations, written content, images and
        campaign drafts. AI output can be inaccurate, incomplete or unsuitable for your
        situation. It is provided for your review, not as professional advice, and we make no
        guarantee of search rankings, traffic, conversions or advertising performance.
      </p>
      <p style={p}>
        You are responsible for reviewing all generated material before publishing it, including
        checking factual accuracy and that it does not infringe anyone's rights.
      </p>

      <h2 style={h2}>7. Acceptable use</h2>
      <p style={p}>You agree not to:</p>
      <ul style={{ paddingLeft: '20px', margin: '0 0 14px' }}>
        <li style={li}>Connect accounts or properties you are not authorised to manage.</li>
        <li style={li}>Generate or publish unlawful, deceptive, infringing or harmful content.</li>
        <li style={li}>Use the service to spam, scrape at abusive rates, or manipulate search or
          advertising platforms in breach of their rules.</li>
        <li style={li}>Attempt to breach, reverse engineer, overload or disrupt the service.</li>
        <li style={li}>Resell or provide the service to third parties except as expressly permitted.</li>
      </ul>

      <h2 style={h2}>8. Third-party platforms</h2>
      <p style={p}>
        Raftra integrates with services including Meta, Google, GitHub, WordPress and Shopify.
        Your use of those platforms is governed by their own terms, and their availability and
        behaviour are outside our control. A platform may change or revoke API access at any
        time, which may limit or disable parts of Raftra.
      </p>

      <h2 style={h2}>9. Subscriptions, billing and refunds</h2>
      <p style={p}>
        Paid plans are billed in advance through our payment processor on the cycle shown at
        checkout. Fees are stated inclusive or exclusive of taxes as indicated at the time of
        purchase. You may cancel at any time; cancellation stops future renewals and your plan
        remains active until the end of the paid period. Refunds are handled according to the
        refund terms presented at purchase and applicable consumer law. Advertising spend is
        never refundable by us, as it is paid directly to the advertising platform.
      </p>

      <h2 style={h2}>10. Intellectual property</h2>
      <p style={p}>
        You retain ownership of the content you provide and of the content generated for your
        workspace through your use of the service. You grant us a limited licence to process
        that content solely to operate and provide Raftra. The Raftra platform itself, including
        its software and branding, remains our property.
      </p>

      <h2 style={h2}>11. Availability</h2>
      <p style={p}>
        We aim to keep Raftra available and reliable but do not guarantee uninterrupted service.
        Features may change, and we may suspend access for maintenance or to protect the service.
      </p>

      <h2 style={h2}>12. Disclaimers and limitation of liability</h2>
      <p style={p}>
        To the maximum extent permitted by law, Raftra is provided "as is" without warranties of
        any kind. We are not liable for indirect, incidental or consequential loss, or for lost
        profits, lost revenue, lost data, or advertising spend. Our total aggregate liability
        arising from the service is limited to the amount you paid us in the twelve months
        before the event giving rise to the claim. Nothing here excludes liability that cannot
        lawfully be excluded.
      </p>

      <h2 style={h2}>13. Termination</h2>
      <p style={p}>
        You may stop using Raftra and delete your account at any time — see our{' '}
        <a href="/data-deletion" style={{ color: 'var(--primary)' }}>Data Deletion</a> page. We may
        suspend or terminate an account that breaches these terms or that we reasonably believe
        creates risk or legal exposure. On termination your right to use the service ends and
        your data is handled as described in our{' '}
        <a href="/privacy-policy" style={{ color: 'var(--primary)' }}>Privacy Policy</a>.
      </p>

      <h2 style={h2}>14. Changes to these terms</h2>
      <p style={p}>
        We may update these terms as the service evolves. Material changes will be notified in
        the application or by email, and the "last updated" date above will change. Continued
        use after a change means you accept the revised terms.
      </p>

      <h2 style={h2}>15. Governing law</h2>
      <p style={p}>
        These terms are governed by the laws of {JURISDICTION}, and the courts of {COURTS} have
        exclusive jurisdiction over any dispute, subject to any mandatory consumer protections
        available where you live.
      </p>

      <h2 style={h2}>16. Contact</h2>
      <p style={p}>
        Questions about these terms: <strong style={{ color: '#fff' }}>{CONTACT_EMAIL}</strong>.
      </p>
    </div>
    <Footer />
  </div>
);
