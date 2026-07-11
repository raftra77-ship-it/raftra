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


  const handleNext = () => {
    if (step < 3) {
      setStep((prev) => prev + 1);
    } else {
      // Trigger simulation
      setStep(4);
      runScrapingSimulation();
    }
  };

  const runScrapingSimulation = async () => {
    setLoadingText('Connecting to Firecrawl & Tavily APIs...');
    setLoadingProgress(10);
    
    // Start a fake progress bar just for UX while we wait for the backend
    const interval = setInterval(() => {
      setLoadingProgress(prev => (prev < 90 ? prev + 5 : prev));
      setLoadingText('Agents analyzing and extracting brand context...');
    }, 1000);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/agents/onboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ brand_url: url || 'https://raftra.com' })
      });
      
      const resData = await response.json();
      clearInterval(interval);
      setLoadingProgress(100);
      setLoadingText('Extraction complete! Initializing workspace...');
      
      if (resData.status === 'success') {
        const d = resData.data;
        onComplete({
          url: url || 'https://raftra.com',
          name: name || 'Raftra Brand',
          tone: d.tone || tone,
          colors: d.colors && d.colors.length > 0 ? d.colors[0] : colors
        });
      } else {
        throw new Error("Failed extraction");
      }
    } catch (err) {
      clearInterval(interval);
      setLoadingProgress(100);
      setLoadingText('Error during extraction. Falling back to defaults...');
      // Fallback to user inputs if API fails
      setTimeout(() => {
        onComplete({
          url: url || 'https://example.com',
          name: name || 'Aura Ventures',
          tone,
          colors
        });
      }, 1500);
    }
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
