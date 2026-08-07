import React, { useCallback, useEffect, useState } from 'react';
import { MetricTile, DataSection, InfoTile, BenefitChips, Spinner, connectorBtn as btn, statusBadge } from './ConnectorUI';

// Google Search Console connector — all real, no placeholders.
//
// /status      → is the server configured, is this workspace connected, which property
// /authorize   → OAuth redirect to Google
// /sites       → the verified properties this Google account can access
// /site        → select which property this workspace reports on
// /overview    → totals + top queries/pages/countries/devices (powers everything below)
// /disconnect  → revoke the Google grant and drop the stored tokens

interface Status {
  configured: boolean;
  connected: boolean;
  email: string | null;
  site_url: string | null;
}

interface Row { key: string; clicks: number; impressions: number; ctr: number; position: number }

interface Overview {
  site_url: string;
  range_days: number;
  start_date: string;
  end_date: string;
  last_synced_at: string | null;
  totals: { clicks: number; impressions: number; ctr: number; position: number };
  queries: Row[];
  pages: Row[];
  countries: Row[];
  devices: Row[];
}

const authHeaders = (): HeadersInit => {
  const token = localStorage.getItem('token');
  return token ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } : { 'Content-Type': 'application/json' };
};

const BENEFITS = ['Organic Clicks', 'Impressions', 'CTR', 'Average Position', 'Top Queries', 'Top Pages', 'Month-over-Month Growth'];

const num = (n: number) => n.toLocaleString();

// Search Console returns full URLs for pages and ISO-3166 alpha-3 for countries; trim both
// down so a narrow tile stays readable.
const shortLabel = (s: string) => {
  try {
    const u = new URL(s);
    return (u.pathname === '/' ? u.hostname : u.pathname).slice(0, 34);
  } catch {
    return s.slice(0, 34);
  }
};

const RankRow: React.FC<{ label: string; value: string; title?: string }> = ({ label, value, title }) => (
  <div title={title || label} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '11.5px' }}>
    <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    <span style={{ color: '#fff', fontWeight: 600, flexShrink: 0 }}>{value}</span>
  </div>
);

export const SearchConsolePanel: React.FC<{ workspaceId: number | null; onRunAudit?: () => void }> = ({ workspaceId, onRunAudit }) => {
  const [status, setStatus] = useState<Status | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Property picker — real properties read from Google, not a free-text box.
  const [changingProperty, setChangingProperty] = useState(false);
  const [sites, setSites] = useState<string[] | null>(null);
  const [propertyDraft, setPropertyDraft] = useState('');
  const [savingProperty, setSavingProperty] = useState(false);

  const base = useCallback(() => `/api/connectors/search-console/${workspaceId}`, [workspaceId]);

  const loadStatus = useCallback(async (): Promise<Status | null> => {
    if (!workspaceId) return null;
    try {
      const r = await fetch(`${base()}/status`, { headers: authHeaders() });
      if (!r.ok) throw new Error(String(r.status));
      const s: Status = await r.json();
      setStatus(s);
      return s;
    } catch {
      // Never leave `status` null on a failed fetch — the panel used to render nothing
      // at all in that case, so the Connect button silently disappeared. Fall back to a
      // not-connected shape so it stays reachable.
      setStatus({ configured: true, connected: false, email: null, site_url: null });
      setMsg('Could not read the Search Console connection status (is the backend running?). You can still try connecting below.');
      return null;
    }
  }, [workspaceId, base]);

  const loadOverview = useCallback(async (silent = false) => {
    if (!workspaceId) return;
    if (!silent) setSyncing(true);
    try {
      const r = await fetch(`${base()}/overview?days=28`, { headers: authHeaders() });
      if (r.ok) {
        setOverview(await r.json());
        setMsg(null);
      } else {
        const e = await r.json().catch(() => ({}));
        setOverview(null);
        // 400 = connected but no property picked yet; that's a normal next step, not an error.
        setMsg(e.detail || 'Could not read Search Console data.');
      }
    } catch {
      setOverview(null);
      setMsg('Could not reach the server to read Search Console data.');
    } finally {
      setSyncing(false);
    }
  }, [workspaceId, base]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await loadStatus();
      if (!alive) return;
      // Surface the OAuth redirect result (?gsc=connected / ?gsc=error).
      const p = new URLSearchParams(window.location.search).get('gsc');
      if (p === 'connected') setMsg('Google Search Console connected.');
      else if (p === 'error') setMsg('Could not connect Search Console. Please try again.');
      if (s?.connected && s.site_url) loadOverview(true);
    })();
    return () => { alive = false; };
  }, [loadStatus, loadOverview]);

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

  const openChangeProperty = async () => {
    setChangingProperty(true);
    setPropertyDraft(status?.site_url || '');
    setSites(null);
    try {
      const r = await fetch(`${base()}/sites`, { headers: authHeaders() });
      const d = await r.json().catch(() => ({}));
      if (r.ok) setSites(d.sites || []);
      else { setSites([]); setMsg(d.detail || 'Could not list your Search Console properties.'); }
    } catch {
      setSites([]);
      setMsg('Could not list your Search Console properties.');
    }
  };

  const saveProperty = async () => {
    if (!propertyDraft) return;
    setSavingProperty(true);
    try {
      const r = await fetch(`${base()}/site`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ site_url: propertyDraft }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setStatus(s => (s ? { ...s, site_url: d.site_url } : s));
        setChangingProperty(false);
        loadOverview();
      } else {
        setMsg(d.detail || 'Could not save the property.');
      }
    } catch {
      setMsg('Could not save the property.');
    } finally {
      setSavingProperty(false);
    }
  };

  const disconnect = async () => {
    setDisconnecting(true);
    try {
      const r = await fetch(`${base()}/disconnect`, { method: 'POST', headers: authHeaders() });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setOverview(null);
        setStatus(s => (s ? { ...s, connected: false, email: null, site_url: null } : s));
        setMsg('Google Search Console disconnected.');
      } else {
        setMsg(d.detail || 'Could not disconnect.');
      }
    } catch {
      setMsg('Could not disconnect.');
    } finally {
      setDisconnecting(false);
    }
  };

  if (!status) return null;

  const isConnected = status.connected;
  const t = overview?.totals;
  const lastSync = overview?.last_synced_at ? new Date(overview.last_synced_at).toLocaleString() : 'Not synced yet';

  return (
    <div className="glow-card" style={{ padding: '20px' }}>
      <h3 style={{ fontSize: '16px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        Google Search Console
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
            <InfoTile label="Property" value={status.site_url || 'Not set — choose one below'} accent={status.site_url ? undefined : '#ffae00'} />
            <InfoTile label="Account" value={status.email || 'Connected'} accent="#22C55E" />
            <InfoTile label="Last Sync" value={syncing ? 'Syncing…' : lastSync} />
          </div>

          {!status.site_url && (
            <p style={{ fontSize: '12px', color: '#ffae00', margin: '0 0 12px', lineHeight: 1.6 }}>
              Pick which verified property this workspace reports on — no data can be read until you do.
            </p>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
            <MetricTile label="Organic Clicks" value={t ? num(t.clicks) : '—'} />
            <MetricTile label="Impressions" value={t ? num(t.impressions) : '—'} />
            <MetricTile label="CTR" value={t ? `${t.ctr}%` : '—'} />
            <MetricTile label="Average Position" value={t ? String(t.position) : '—'} />
          </div>

          {overview && (
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '-6px 0 12px' }}>
              {overview.start_date} → {overview.end_date} · Google reports search data with a ~3 day delay.
            </p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '16px' }}>
            <DataSection title="Top Queries" rows={overview?.queries.map(r => (
              <RankRow key={r.key} label={r.key} value={`${num(r.clicks)} clicks`} title={`${r.key} · pos ${r.position} · ${r.ctr}% CTR`} />
            ))} />
            <DataSection title="Top Pages" rows={overview?.pages.map(r => (
              <RankRow key={r.key} label={shortLabel(r.key)} value={`${num(r.clicks)} clicks`} title={r.key} />
            ))} />
            <DataSection title="Countries" rows={overview?.countries.map(r => (
              <RankRow key={r.key} label={r.key.toUpperCase()} value={num(r.clicks)} />
            ))} />
            <DataSection title="Devices" rows={overview?.devices.map(r => (
              <RankRow key={r.key} label={r.key.toLowerCase()} value={num(r.clicks)} />
            ))} />
          </div>

          {changingProperty ? (
            <div style={{ marginBottom: '14px' }}>
              {sites === null ? (
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Spinner /> Loading your verified properties…
                </div>
              ) : sites.length === 0 ? (
                <p style={{ fontSize: '12px', color: '#ffae00', margin: '0 0 10px', lineHeight: 1.6 }}>
                  This Google account has no verified Search Console properties. Verify your site in Search Console first, then try again.
                </p>
              ) : (
                <select
                  value={propertyDraft}
                  onChange={e => setPropertyDraft(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '12px', marginBottom: '10px' }}
                >
                  <option value="">Select a property…</option>
                  {sites.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button onClick={saveProperty} disabled={!propertyDraft || savingProperty} style={btn('rgba(0,255,157,0.15)', savingProperty)}>
                  {savingProperty && <Spinner />}Save
                </button>
                <button onClick={() => setChangingProperty(false)} style={btn('rgba(255,255,255,0.06)')}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button onClick={() => loadOverview()} disabled={syncing || !status.site_url} style={btn('rgba(255,255,255,0.06)', syncing)}>
                {syncing && <Spinner />}Sync Data
              </button>
              <button onClick={openChangeProperty} style={btn('rgba(255,255,255,0.06)')}>
                {status.site_url ? 'Change Property' : 'Choose Property'}
              </button>
              <button onClick={disconnect} disabled={disconnecting} style={btn('rgba(255,92,92,0.1)', disconnecting)}>
                {disconnecting && <Spinner />}Disconnect
              </button>
              {onRunAudit && <button onClick={onRunAudit} style={btn('linear-gradient(135deg, var(--primary) 0%, #3B33FF 100%)')}>Run SEO Audit</button>}
            </div>
          )}
        </>
      )}
    </div>
  );
};
