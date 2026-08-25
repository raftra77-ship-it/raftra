import React, { useEffect, useState } from 'react';
import { MetricTile, DataSection, InfoTile, BenefitChips, Spinner, connectorBtn as btn, statusBadge } from './ConnectorUI';

// Google Search Console connector.
//
// REAL (already wired, untouched by this pass): /status, /authorize (OAuth redirect to
// Google), /sites, /site, /performance, /submit-sitemap.
//
// PLACEHOLDER (this pass): the richer post-connection dashboard — Last Sync, the four
// summary metric tiles, Top Queries/Pages/Countries/Devices, and the Sync Data / Change
// Property / Disconnect actions. These are intentionally NOT wired to Google APIs yet;
// each placeholder spot below is marked with a TODO showing exactly which real call
// replaces it once we're ready to turn this on for real.

interface Status {
  configured: boolean;
  connected: boolean;
  email: string | null;
  site_url: string | null;
}

const authHeaders = (): HeadersInit => {
  const token = localStorage.getItem('token');
  return token ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } : { 'Content-Type': 'application/json' };
};

const BENEFITS = ['Organic Clicks', 'Impressions', 'CTR', 'Average Position', 'Top Queries', 'Top Pages', 'Month-over-Month Growth'];

export const SearchConsolePanel: React.FC<{ workspaceId: number | null; onRunAudit?: () => void }> = ({ workspaceId, onRunAudit }) => {
  const [status, setStatus] = useState<Status | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Placeholder-only local state for the post-connection dashboard — none of this reads
  // from Google yet. Structured so each becomes a real fetch result later without touching
  // the render below.
  const [lastSync, setLastSync] = useState<string>('Just Now');
  const [syncing, setSyncing] = useState(false);
  const [changingProperty, setChangingProperty] = useState(false);
  const [propertyDraft, setPropertyDraft] = useState('');
  const [forceDisconnected, setForceDisconnected] = useState(false);

  const base = () => `/api/connectors/search-console/${workspaceId}`;

  const loadStatus = () => {
    if (!workspaceId) return;
    fetch(`${base()}/status`, { headers: authHeaders() })
      .then(r => r.json()).then((s: Status) => setStatus(s)).catch(() => {});
  };

  useEffect(() => {
    loadStatus();
    // Surface the OAuth redirect result (?gsc=connected / ?gsc=error).
    const p = new URLSearchParams(window.location.search).get('gsc');
    if (p === 'connected') { setMsg('Google Search Console connected.'); setLastSync('Just Now'); }
    else if (p === 'error') { setMsg('Could not connect Search Console. Please try again.'); }
    // eslint-disable-next-line
  }, [workspaceId]);

  const connect = async () => {
    setConnecting(true);
    try {
      const r = await fetch(`${base()}/authorize`, { headers: authHeaders() });
      if (!r.ok) { const e = await r.json().catch(() => ({})); setMsg(e.detail || 'Unable to start Google connection.'); setConnecting(false); return; }
      const d = await r.json();
      if (d.url) { window.location.href = d.url; return; } // hand off to Google's consent screen — page navigates away
      setConnecting(false);
    } catch {
      setMsg('Unable to start Google connection.');
      setConnecting(false);
    }
  };

  // ---- Placeholder actions (post-connection dashboard) ------------------------------
  // TODO: replace with a real GET /performance (+ /sites, /site) call when we wire this up.
  const syncData = () => {
    setSyncing(true);
    setTimeout(() => { setLastSync('Just Now'); setSyncing(false); }, 700);
  };
  // TODO: replace with real GET /sites (list verified properties) + POST /site (select one).
  const openChangeProperty = () => { setPropertyDraft(status?.site_url || ''); setChangingProperty(true); };
  const saveProperty = () => {
    setStatus(s => (s ? { ...s, site_url: propertyDraft } : s));
    setChangingProperty(false);
  };
  // TODO: replace with a real disconnect/revoke endpoint once one exists (Shopify/WordPress
  // already have one — Search Console doesn't yet). For now this only resets local UI state.
  const disconnect = () => { setForceDisconnected(true); setMsg('Disconnected.'); };

  if (!status) return null;

  const isConnected = status.connected && !forceDisconnected;

  return (
    <div className="glow-card" style={{ padding: '20px' }}>
      <h3 style={{ fontSize: '14px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px', lineHeight: 1.3, minWidth: 0 }}>
        <span style={{ minWidth: 0 }}>Google Search Console</span>
        <span style={{ marginLeft: 'auto', ...statusBadge(isConnected ? 'connected' : connecting ? 'pending' : 'disconnected') }}>
          {isConnected ? 'CONNECTED' : connecting ? 'CONNECTING...' : 'NOT CONNECTED'}
        </span>
      </h3>

      {msg && (
        <div style={{ fontSize: '12px', color: '#8B85FF', background: 'rgba(90,82,255,0.1)', border: '1px solid rgba(90,82,255,0.25)', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px' }}>{msg}</div>
      )}

      {!status.configured && (
        <div style={{ fontSize: '12px', color: '#ffae00' }}>
          Server not configured for Google connections yet (GOOGLE_CLIENT_ID / SECRET missing).
        </div>
      )}

      {/* ---------------------------------------------------------------- Not Connected */}
      {status.configured && !isConnected && (
        <>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 14px', lineHeight: 1.6 }}>
            Connect your Google Search Console account to unlock real search performance insights.
          </p>
          <BenefitChips items={BENEFITS} />
          <button onClick={connect} disabled={connecting} style={btn('linear-gradient(135deg, var(--primary) 0%, #3B33FF 100%)', connecting)}>
            {connecting && <Spinner />}
            {connecting ? 'Connecting...' : 'Connect Google Search Console'}
          </button>
        </>
      )}

      {/* ------------------------------------------------------------------- Connected */}
      {isConnected && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
            <InfoTile label="Property" value={status.site_url || 'Not set'} />
            <InfoTile label="Connection Status" value="Connected" accent="#22C55E" />
            <InfoTile label="Last Sync" value={syncing ? 'Syncing…' : lastSync} />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
            <MetricTile label="Organic Clicks" value="—" />
            <MetricTile label="Impressions" value="—" />
            <MetricTile label="CTR" value="—" />
            <MetricTile label="Average Position" value="—" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '16px' }}>
            <DataSection title="Top Queries" />
            <DataSection title="Top Pages" />
            <DataSection title="Countries" />
            <DataSection title="Devices" />
          </div>

          {changingProperty ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap' }}>
              <input
                value={propertyDraft}
                onChange={e => setPropertyDraft(e.target.value)}
                placeholder="e.g. https://example.com/"
                style={{ flex: 1, minWidth: '180px', padding: '8px 10px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
              />
              <button onClick={saveProperty} style={btn('rgba(0,255,157,0.15)')}>Save</button>
              <button onClick={() => setChangingProperty(false)} style={btn('rgba(255,255,255,0.06)')}>Cancel</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button onClick={syncData} disabled={syncing} style={btn('rgba(255,255,255,0.06)', syncing)}>{syncing && <Spinner />}Sync Data</button>
              <button onClick={openChangeProperty} style={btn('rgba(255,255,255,0.06)')}>Change Property</button>
              <button onClick={disconnect} style={btn('rgba(255,92,92,0.1)')}>Disconnect</button>
              {onRunAudit && <button onClick={onRunAudit} style={btn('linear-gradient(135deg, var(--primary) 0%, #3B33FF 100%)')}>Run SEO Audit</button>}
            </div>
          )}
        </>
      )}
    </div>
  );
};