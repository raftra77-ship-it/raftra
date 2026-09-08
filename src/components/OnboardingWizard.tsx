import React, { useState } from 'react';
import { ArrowRight, Cpu, AlertCircle } from 'lucide-react';
import { GlowButton } from './GlowButton';

interface OnboardingWizardProps {
  onComplete: (brandData: { url: string; name: string; tone: string; colors: string }) => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [tone, setTone] = useState('Premium & Professional');
  const [colors, setColors] = useState('Indigo & Obsidian');
  const [competitorUrl, setCompetitorUrl] = useState('');
  const [loadingText, setLoadingText] = useState('');
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Onboarding is the only place a workspace gets created — without this the user
  // lands on a dashboard with no workspace and nothing works.
  const ensureWorkspace = async (brand: { url: string; name: string; tone: string; colors: string }) => {
    const token = localStorage.getItem('token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    try {
      // Don't create a second workspace if this account already has one.
      const existing = await fetch('/api/workspaces', { headers });
      if (existing.ok) {
        const list = await existing.json();
        if (Array.isArray(list) && list.length > 0) return true;
      }
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: brand.name,
          company_url: brand.url,
          brand_color: brand.colors,
          brand_voice: brand.tone
        })
      });
      if (!res.ok) {
        console.error('Workspace creation failed:', res.status, await res.text());
        return false;
      }
      return true;
    } catch (err) {
      console.error('Workspace creation failed:', err);
      return false;
    }
  };

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

  const handleNext = () => {
    if (step < 3) {
      setStep((prev) => prev + 1);
    } else {
      // Trigger simulation
      setStep(4);
      runScrapingSimulation();
    }
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

        {step < 4 && (
          <div className="onboarding-steps">
            <div className={`onboarding-step-indicator ${step >= 1 ? 'active' : ''}`} />
            <div className={`onboarding-step-indicator ${step >= 2 ? 'active' : ''}`} />
            <div className={`onboarding-step-indicator ${step >= 3 ? 'active' : ''}`} />
          </div>
        )}

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
              <label>Company Display Name</label>
              <input
                type="text"
                placeholder="e.g. Raftra Technologies"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <GlowButton variant="glow" onClick={handleNext} disabled={!url} style={{ marginTop: '12px' }}>
              Analyze URL <ArrowRight size={16} />
            </GlowButton>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h3 style={{ marginBottom: '8px', fontSize: '18px' }}>Brand Voice & Guidelines</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Configure the baseline style for the copywriters and creative designers.
              </p>
            </div>

            <div className="form-group">
              <label>Brand Voice Tone</label>
              <select value={tone} onChange={(e) => setTone(e.target.value)}>
                <option>Premium & Elegant</option>
                <option>Tech-Forward & Modern</option>
                <option>Bold, Urgent & Converting</option>
                <option>Friendly, Casual & Trustworthy</option>
              </select>
            </div>

            <div className="form-group">
              <label>Dominant Color Palette Hint</label>
              <select value={colors} onChange={(e) => setColors(e.target.value)}>
                <option>Electric Blue & Indigo</option>
                <option>Emerald Green & Deep Obsidian</option>
                <option>Minimalist Slate & White</option>
                <option>Sunset Orange & Charcoal</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
              <button className="btn btn-secondary" onClick={() => setStep(1)} style={{ flex: 1 }}>
                Back
              </button>
              <GlowButton variant="glow" onClick={handleNext} style={{ flex: 2 }}>
                Continue <ArrowRight size={16} />
              </GlowButton>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h3 style={{ marginBottom: '8px', fontSize: '18px' }}>Competitive Context</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Our marketing agent will crawl competitor sites to study ad formats and find keywords they occupy.
              </p>
            </div>

            <div className="form-group">
              <label>Primary Competitor Website URL</label>
              <input
                type="url"
                placeholder="https://competitor.com"
                value={competitorUrl}
                onChange={(e) => setCompetitorUrl(e.target.value)}
              />
            </div>

            <div
              style={{
                background: 'rgba(90, 82, 255, 0.05)',
                border: '1px solid rgba(90, 82, 255, 0.1)',
                borderRadius: 'var(--radius-md)',
                padding: '14px',
                display: 'flex',
                gap: '10px',
              }}
            >
              <AlertCircle size={16} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '2px' }} />
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Sandbox integrations: Onboarding registers testing keys for Facebook and Google Ads sandboxes. No real advertising spend will occur during simulation.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
              <button className="btn btn-secondary" onClick={() => setStep(2)} style={{ flex: 1 }}>
                Back
              </button>
              <GlowButton variant="glow" onClick={handleNext} style={{ flex: 2 }}>
                Initialize AI Agents <ArrowRight size={16} />
              </GlowButton>
            </div>
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
