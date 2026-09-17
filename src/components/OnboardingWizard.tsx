import React, { useState } from 'react';
import { ArrowRight, Cpu } from 'lucide-react';
import { GlowButton } from './GlowButton';

interface OnboardingWizardProps {
  onComplete: (brandData: { url: string; name: string; tone: string; colors: string }) => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  // Defaults, not questions: the crawl overwrites both from the site. Kept so the workspace
  // is created with something sane before extraction finishes.
  const [tone] = useState('Premium & Professional');
  const [colors] = useState('Indigo & Obsidian');
  const [loadingText, setLoadingText] = useState('');
  const [loadingProgress, setLoadingProgress] = useState(0);

  /** Commits the onboarded flag so the wizard never reappears, and kicks off the brand
   *  crawl against the real workspace. Without this nothing ever set is_onboarded, so
   *  login sent the user back here every time. */
  /* One request finishes setup: find-or-create the workspace and lock the onboarded flag.
     This was four awaited calls (list, create, list again, mark) and every one of them is a
     round trip to a remote database, which was most of the delay before the dashboard
     appeared. */
  const completeSetup = async (brand: { url: string; name: string; tone: string; colors: string }) => {
    const token = localStorage.getItem('token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    try {
      const r = await fetch('/api/workspaces/setup', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: brand.name,
          company_url: brand.url,
          brand_color: brand.colors,
          brand_voice: brand.tone,
        }),
      });
      if (!r.ok) return null;
      const data = await r.json();

      // Remembered so the homepage CTA can route instantly instead of waiting on a state
      // call; the route guards still verify against the server.
      try { localStorage.setItem('raftra_onboarded', '1'); } catch { /* private mode */ }

      // Kick the brand crawl off and deliberately do not await it. It takes tens of
      // seconds and the user is already onboarded and on their way to the dashboard; the
      // profile fills in behind them. Failures here are logged, never blocking.
      if (brand.url && data.workspace_id) {
        fetch(`/api/workspaces/${data.workspace_id}/reindex`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ url: brand.url, tone: brand.tone }),
        }).catch(err => console.error('Brand enrichment could not be started:', err));
      }
      return data;
    } catch {
      return null;
    }
  };

  /* One question, then work.
     ------------------------------------------------------------------
     This was three input steps before the crawl started, and two of them earned nothing:

     * Step 2 asked for brand voice and a colour hint. The crawl derives both from the site
       itself — BrandKit extracts tone_of_voice and personality from the copy, and
       extract_color_tokens reads the palette out of the CSS variables the site ships. A
       typed guess is weaker evidence than the site, and both are editable afterwards in the
       Brand Knowledge Vault.
     * Step 3 asked for a competitor URL and then dropped it: `competitorUrl` was held in
       state and never appeared in any request body. Three screens of friction, one of them
       collecting a value that went nowhere.

     The URL is the only answer the pipeline actually needs, so it is the only one asked for.
     Everything those steps collected still reaches the profile — extracted rather than
     typed — and every field stays editable later. */
  const handleNext = () => {
    setStep(4);
    runScrapingSimulation();
  };

  /* Finishing onboarding is two fast writes: create the workspace, then commit the
     onboarded flag. The brand crawl is queued server-side against the real workspace and
     enriches the profile afterwards.

     This used to await POST /api/agents/onboard - a full scrape plus LLM extraction, tens
     of seconds - before it created anything, which is why login to dashboard dragged. That
     call also ran the pipeline with workspace_id=0, so its results were written against a
     workspace that does not exist and this account's profile stayed empty either way. */
  const runScrapingSimulation = async () => {
    setLoadingText('Creating your workspace...');
    setLoadingProgress(20);

    let extractedName = name;
    if (!extractedName && url) {
      try {
        const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
        const domainParts = urlObj.hostname.replace('www.', '').split('.');
        if (domainParts.length > 0) {
          extractedName = domainParts[0].charAt(0).toUpperCase() + domainParts[0].slice(1);
        }
      } catch (e) { /* keep whatever the user typed */ }
    }

    const brand = { url, name: extractedName || name, tone, colors };

    setLoadingProgress(60);
    const result = await completeSetup(brand);
    setLoadingProgress(100);

    // If this does not stick the wizard would reappear on the next login, so it is worth
    // telling the user rather than moving on silently.
    if (!result) {
      setLoadingText('Could not save your setup — please try again.');
      return;
    }

    setLoadingText('All set! Opening your dashboard...');
    onComplete(brand);
  };

  return (
    <div className="app-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="onboarding-container" style={{ width: '560px', margin: '40px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', justifyContent: 'center' }}>
          <Cpu className="logo-icon" size={24} />
          <h2 style={{ fontSize: '20px', fontFamily: 'var(--font-heading)' }}>INITIALIZE GROWTH OS</h2>
        </div>

        {/* The three-dot progress rail is gone with the two steps it counted. Leaving it
            would advertise two screens that no longer exist, which is the opposite of the
            point — a one-question form should not look like the start of a sequence. */}

        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h3 style={{ marginBottom: '8px', fontSize: '18px' }}>Your Brand Identity</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Enter your company URL. Our AI agents will scrape details, detect assets, and study target profiles.
              </p>
            </div>

            <div className="form-group">
              <label>Company Website URL</label>
              <input
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Company Display Name <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>— optional</span></label>
              <input
                type="text"
                placeholder="Left blank, we use the site's own name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Says what the crawl will do, so the two screens removed from here do not read
                as capability that was taken away. */}
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
              We read your site for brand voice, colours, logo, products and audience. You can
              edit anything it gets wrong in the Brand Knowledge Vault.
            </p>

            <GlowButton variant="glow" onClick={handleNext} disabled={!url} style={{ marginTop: '12px' }}>
              Analyse my site <ArrowRight size={16} />
            </GlowButton>
          </div>
        )}

        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'center', padding: '20px 0' }}>
            <div className="terminal-dots" style={{ alignSelf: 'stretch', justifyContent: 'center', marginBottom: '8px' }}>
              <span className="shimmer-loading" style={{ width: '48px', height: '48px', borderRadius: '50%', display: 'block' }} />
            </div>

            <div style={{ textAlign: 'center' }}>
              <h4 style={{ marginBottom: '8px', fontSize: '16px' }}>AI GROWTH ENGINE WORKERS DEPLOYING</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                [Task Execution System Active]
              </p>
            </div>

            <div
              style={{
                width: '100%',
                background: '#070709',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                minHeight: '120px',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: '#86ffb3',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{ color: 'var(--accent)' }}>$</span>
                <span>{loadingText}</span>
              </div>
              <div style={{ marginTop: '16px', height: '4px', background: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: 'var(--success)', width: `${loadingProgress}%`, transition: 'width 0.4s ease' }} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
