import React from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

// Public legal page. Meta, Google and Razorpay all require a reachable Privacy Policy URL
// before granting production access, so this route must stay publicly accessible.
//
// ⚠️ REPLACE BEFORE PUBLISHING — these three values are placeholders. Meta and Razorpay
// verify that the contact address actually receives mail.
const ENTITY = '[Your registered legal entity name]';
const CONTACT_EMAIL = '[privacy@yourdomain.com]';
const JURISDICTION = 'India';
const LAST_UPDATED = '5 August 2026';

const h2: React.CSSProperties = {
  fontSize: '22px', fontFamily: 'var(--font-heading)', color: '#fff',
  margin: '40px 0 14px', paddingTop: '8px',
};
const p: React.CSSProperties = {
  fontSize: '15px', lineHeight: 1.75, color: 'rgba(255,255,255,0.75)', margin: '0 0 14px',
};
const li: React.CSSProperties = { ...p, margin: '0 0 8px' };
const th: React.CSSProperties = {
  textAlign: 'left', padding: '10px 12px', fontSize: '13px', fontWeight: 700, color: '#fff',
  borderBottom: '1px solid rgba(255,255,255,0.15)',
};
const td: React.CSSProperties = {
  padding: '10px 12px', fontSize: '13.5px', color: 'rgba(255,255,255,0.75)',
  borderBottom: '1px solid rgba(255,255,255,0.06)', verticalAlign: 'top',
};

export const PrivacyPolicy = () => (
  <div style={{ minHeight: '100vh', background: 'transparent', color: '#fff', paddingTop: '100px', paddingBottom: '80px', fontFamily: 'var(--font-sans)' }}>
    <Navbar />
    <div style={{ maxWidth: '820px', margin: '0 auto', padding: '40px 24px', position: 'relative', zIndex: 1 }}>

      <h1 style={{ fontSize: '44px', fontFamily: 'var(--font-heading)', margin: '0 0 10px', lineHeight: 1.15 }}>
        Privacy Policy
      </h1>
      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 8px' }}>Last updated: {LAST_UPDATED}</p>
      <p style={p}>
        This policy explains what data Raftra ("we", "us") collects, why we collect it, who we
        share it with, and how you can access or delete it. It applies to the Raftra web
        application and the connections you make to third-party platforms through it.
      </p>

      <h2 style={h2}>1. Who we are</h2>
      <p style={p}>
        Raftra is operated by {ENTITY}. For any privacy question, data access request or
        deletion request, contact us at <strong style={{ color: '#fff' }}>{CONTACT_EMAIL}</strong>.
      </p>

      <h2 style={h2}>2. Information we collect</h2>
      <p style={p}><strong style={{ color: '#fff' }}>Account information.</strong> Your email
        address, username, first and last name, and a securely hashed password. If you sign in
        with Google or GitHub, we record which provider you used. We never store your
        third-party account password.</p>
      <p style={p}><strong style={{ color: '#fff' }}>Security and activity logs.</strong> We
        record account events (registration, sign-in, failed sign-in attempts, password reset
        requests) together with the <strong style={{ color: '#fff' }}>IP address</strong> the
        request came from. This exists to protect your account and detect abuse.</p>
      <p style={p}><strong style={{ color: '#fff' }}>Billing information.</strong> Subscription
        status, credit balance, and a customer identifier issued by our payment processor.
        Card and bank details are handled entirely by the payment processor — they never reach
        our servers.</p>
      <p style={p}><strong style={{ color: '#fff' }}>Workspace and brand content.</strong> The
        business name, website URL, brand voice, logo and any documents or content you add to
        your knowledge base.</p>
      <p style={p}><strong style={{ color: '#fff' }}>Website content we analyse.</strong> When
        you run an SEO or GEO audit, we retrieve and analyse the public content of the website
        URL you supply, and store the resulting audit and recommendations.</p>
      <p style={p}><strong style={{ color: '#fff' }}>Connected platform data and access
        tokens.</strong> See the next section.</p>

      <h2 style={h2}>3. Platforms you connect, and what we access</h2>
      <p style={p}>
        Connecting a platform is always optional and always initiated by you. We request the
        narrowest permissions that let the feature work, and we store an access token so the
        connection keeps working without asking you to sign in repeatedly. You can disconnect
        at any time — see our <a href="/data-deletion" style={{ color: 'var(--primary)' }}>Data
        Deletion</a> page.
      </p>
      <div style={{ overflowX: 'auto', margin: '0 0 16px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '560px' }}>
          <thead>
            <tr>
              <th style={th}>Platform</th>
              <th style={th}>Permissions requested</th>
              <th style={th}>What we do with it</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={td}>Meta (Facebook / Instagram Ads)</td>
              <td style={td}><code>ads_management</code>, <code>ads_read</code></td>
              <td style={td}>Read your ad accounts and campaign performance, and create campaigns
                you have approved. Campaigns are created paused and never start spending on their own.</td>
            </tr>
            <tr>
              <td style={td}>Google Ads</td>
              <td style={td}><code>adwords</code></td>
              <td style={td}>Read your accounts and campaign performance, and create campaigns you
                have approved. Campaigns are created paused.</td>
            </tr>
            <tr>
              <td style={td}>Google Search Console &amp; Analytics</td>
              <td style={td}><code>webmasters</code>, <code>analytics.readonly</code></td>
              <td style={td}>Read search queries, rankings and traffic for your verified properties.
                Read-only.</td>
            </tr>
            <tr>
              <td style={td}>GitHub</td>
              <td style={td}><code>repo</code></td>
              <td style={td}>Read the repository you select and open pull requests containing SEO
                changes. We never merge — you review and merge every change yourself.</td>
            </tr>
            <tr>
              <td style={td}>WordPress</td>
              <td style={td}>Application Password, or WordPress.com OAuth</td>
              <td style={td}>Read and update the pages you choose, applying only the changes you
                have approved.</td>
            </tr>
            <tr>
              <td style={td}>Shopify</td>
              <td style={td}><code>read/write_content</code>, <code>read/write_themes</code></td>
              <td style={td}>Read and update store pages, and prepare theme changes in an
                unpublished draft theme you publish yourself.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p style={p}>
        Access tokens are stored in our database solely to maintain the connection. Revoking
        access from the platform's own settings, or disconnecting inside Raftra, immediately
        stops our ability to use it.
      </p>

      <h2 style={h2}>4. Changes we make to your properties</h2>
      <p style={p}>
        Raftra can modify content on properties you connect — for example editing a WordPress
        page, updating Shopify page metadata, or opening a GitHub pull request. Every such
        change requires your explicit approval first, and is shown to you as a before/after
        preview. For WordPress we store a snapshot of the previous content before writing, so
        a change can be undone exactly.
      </p>

      <h2 style={h2}>5. How we use your information</h2>
      <ul style={{ paddingLeft: '20px', margin: '0 0 14px' }}>
        <li style={li}>To provide the service: audits, recommendations, content and campaign drafts.</li>
        <li style={li}>To authenticate you and keep your account secure.</li>
        <li style={li}>To process subscriptions and payments.</li>
        <li style={li}>To communicate service notifications and support responses.</li>
        <li style={li}>To diagnose faults and improve reliability.</li>
      </ul>
      <p style={p}>
        We do <strong style={{ color: '#fff' }}>not</strong> sell your personal data, and we do
        not use the content of your connected accounts to train our own models.
      </p>

      <h2 style={h2}>6. Service providers we share data with</h2>
      <p style={p}>
        To deliver the product we pass certain data to the processors below. Each receives only
        what its function requires.
      </p>
      <ul style={{ paddingLeft: '20px', margin: '0 0 14px' }}>
        <li style={li}><strong style={{ color: '#fff' }}>Google (Gemini AI)</strong> — brand
          context, page content and audit findings are sent to generate recommendations, ad copy
          and content drafts.</li>
        <li style={li}><strong style={{ color: '#fff' }}>Firecrawl</strong> — retrieves the public
          content of the website URL you ask us to audit.</li>
        <li style={li}><strong style={{ color: '#fff' }}>Tavily</strong> — web search used for
          competitive and brand research.</li>
        <li style={li}><strong style={{ color: '#fff' }}>Qdrant</strong> — stores vector embeddings
          of your brand and knowledge-base content so the AI can reference it.</li>
        <li style={li}><strong style={{ color: '#fff' }}>Supabase (PostgreSQL)</strong> — our
          primary database.</li>
        <li style={li}><strong style={{ color: '#fff' }}>Upstash (Redis)</strong> — caching and
          background job state.</li>
        <li style={li}><strong style={{ color: '#fff' }}>Razorpay</strong> — payment processing.
          Card details are collected and stored by Razorpay, not by us.</li>
      </ul>
      <p style={p}>
        We may also disclose information where required by law, or to protect our rights or the
        safety of our users.
      </p>

      <h2 style={h2}>7. International transfers</h2>
      <p style={p}>
        Some of the providers above process data outside your country of residence. Where that
        happens we rely on the provider's contractual safeguards for international transfers.
      </p>

      <h2 style={h2}>8. How long we keep data</h2>
      <p style={p}>
        Account, workspace and audit data is retained while your account is active. Security
        logs are retained for a limited period for abuse prevention. When you delete your
        account we remove your personal data and revoke stored tokens within 30 days, except
        where we must retain records (such as payment records) to meet legal obligations.
      </p>

      <h2 style={h2}>9. Your rights</h2>
      <p style={p}>
        Depending on where you live, you may have the right to access, correct, export, or
        delete your personal data, to withdraw consent, and to object to certain processing. To
        exercise any of these, email <strong style={{ color: '#fff' }}>{CONTACT_EMAIL}</strong> or
        follow our <a href="/data-deletion" style={{ color: 'var(--primary)' }}>Data Deletion</a> instructions.
        You also have the right to complain to your local data protection authority.
      </p>

      <h2 style={h2}>10. Cookies and local storage</h2>
      <p style={p}>
        We use browser local storage to hold your sign-in session token so you stay logged in.
        We do not use third-party advertising or cross-site tracking cookies in the application.
      </p>

      <h2 style={h2}>11. Security</h2>
      <p style={p}>
        Passwords are stored only as salted hashes, traffic is served over HTTPS, and access
        tokens are held in a restricted-access database. No system is perfectly secure, but we
        work to protect your data and will notify you of a breach affecting it as required by law.
      </p>

      <h2 style={h2}>12. Children</h2>
      <p style={p}>
        Raftra is a business tool and is not directed at children. We do not knowingly collect
        data from anyone under 18. If you believe a child has provided us data, contact us and
        we will delete it.
      </p>

      <h2 style={h2}>13. Changes to this policy</h2>
      <p style={p}>
        We may update this policy as the product changes. Material changes will be communicated
        in the application or by email, and the "last updated" date above will change.
      </p>

      <h2 style={h2}>14. Contact</h2>
      <p style={p}>
        Questions, requests or complaints: <strong style={{ color: '#fff' }}>{CONTACT_EMAIL}</strong>.
        This policy is governed by the laws of {JURISDICTION}.
      </p>
    </div>
    <Footer />
  </div>
);
