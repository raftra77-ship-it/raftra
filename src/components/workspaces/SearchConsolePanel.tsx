import React, { useCallback, useEffect, useState } from 'react';
import { MetricTile, DataSection, InfoTile, BenefitChips, Spinner, connectorBtn as btn, statusBadge } from './ConnectorUI';

// Google Search Console connector.
//
// Everything on this panel now comes from the backend: /status, /authorize (OAuth), /sites +
// /site (the property picker), /overview (tiles and tables) and /disconnect.
//
// The connected view used to be a mock: "—" in every tile, "No Data Yet" in every table, a
// Sync button that ran a 700ms timer, and a Change Property box that edited local state only,
// so the property the backend actually queried never changed. And a Google account with more
// than one verified property landed on "Connected" with nothing selected, which made every
// data call - including the audit's own Search Console step - fail with nothing on screen
// saying why.

interface Status {
  configured: boolean;
  connected: boolean;
  email: string | null;
  site_url: string | null;
}

interface Row { key: string; clicks: number; impressions: number; ctr: number; position: number; }

interface Overview {
  site_url: string;
  range_days: number;
  start_date: string;
  end_date: string;
  totals: { clicks: number; impressions: number; ctr: number; position: number };
  queries: Row[];
  pages: Row[];
  countries: Row[];
  devices: Row[];
  last_synced_at?: string;
}

const authHeaders = (): HeadersInit => {
  const token = localStorage.getItem('token');
  return token ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } : { 'Content-Type': 'application/json' };
};

const api = (workspaceId: number | null, path: string) => `/api/connectors/search-console/${workspaceId}${path}`;

const BENEFITS = ['Organic Clicks', 'Impressions', 'CTR', 'Average Position', 'Top Queries', 'Top Pages', 'Index Status in Audits'];

const fmt = (n: number) => Number(n || 0).toLocaleString();

const pagePath = (url: string) => {
  try { const u = new URL(url); return `${u.pathname}${u.search}` || '/'; } catch { return url; }
};

// The backend sends naive UTC timestamps; without a zone suffix the browser reads them as local.
const syncedAt = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(/Z$|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
};

const topRows = (items: Row[] | undefined, label: (key: string) => string) =>
  (items || []).slice(0, 5).map(r => (
    <div key={r.key} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '12px' }}>
      <span title={r.key} style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
        {label(r.key)}
      </span>
      <span style={{ color: '#fff', whiteSpace: 'nowrap' }}>{fmt(r.clicks)} clicks</span>
    </div>
  ));

export const SearchConsolePanel: React.FC<{ workspaceId: number | null; onRunAudit?: () => void }> = ({ workspaceId, onRunAudit }) => {
  const [status, setStatus] = useState<Status | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: 'info' | 'error' } | null>(null);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const [sites, setSites] = useState<string[] | null>(null);
  const [sitesError, setSitesError] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [selected, setSelected] = useState('');
  const [savingSite, setSavingSite] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const r = await fetch(api(workspaceId, '/status'), { headers: authHeaders() });
      if (r.ok) setStatus(await r.json());
    } catch { /* the panel stays hidden until status loads */ }
  }, [workspaceId]);

  const loadSites = useCallback(async () => {
    if (!workspaceId) return;
    setSites(null);
    setSitesError(null);
    try {
      const r = await fetch(api(workspaceId, '/sites'), { headers: authHeaders() });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setSites([]);
        setSitesError(d.detail || 'Could not list your Search Console properties.');
        return;
      }
      const list: string[] = Array.isArray(d.sites) ? d.sites : [];
      setSites(list);
      setSelected(prev => (prev && list.includes(prev) ? prev : list[0] || ''));
    } catch {
      setSites([]);
      setSitesError('Could not reach the server.');
    }
  }, [workspaceId]);

  const loadOverview = useCallback(async () => {
    if (!workspaceId) return;
    setLoadingData(true);
    setDataError(null);
    try {
      const r = await fetch(api(workspaceId, '/overview?days=28'), { headers: authHeaders() });
      const d = await r.json().catch(() => ({}));
      if (r.ok) setOverview(d);
      else setDataError(d.detail || `Could not load Search Console data (HTTP ${r.status}).`);
    } catch {
      setDataError('Could not reach the server.');
    }
    setLoadingData(false);
  }, [workspaceId]);

  useEffect(() => {
    loadStatus();
    // Surface the OAuth redirect result, then drop it from the URL. It used to stay in the
    // query string, so the banner came back on every reload of the dashboard.
    const p = new URLSearchParams(window.location.search).get('gsc');
    if (p === 'connected') setMsg({ text: 'Google Search Console connected.', tone: 'info' });
    else if (p === 'error') setMsg({ text: 'Google did not complete the connection. Try again, and approve access to Search Console when Google asks.', tone: 'error' });
    if (p) {
      try {
        const u = new URL(window.location.href);
        u.searchParams.delete('gsc');
        window.history.replaceState({}, '', u);
      } catch { /* history unavailable */ }
    }
  }, [loadStatus]);

  // Connected with a property: show its data. Connected without one: choose one first.
  useEffect(() => {
    if (!status?.connected) return;
    if (status.site_url) loadOverview();
    else loadSites();
  }, [status?.connected, status?.site_url, loadOverview, loadSites]);

  const connect = async () => {
    setConnecting(true);
    try {
      const r = await fetch(api(workspaceId, '/authorize'), { headers: authHeaders() });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        setMsg({ text: e.detail || 'Unable to start Google connection.', tone: 'error' });
        setConnecting(false);
        return;
      }
      const d = await r.json();
      if (d.url) { window.location.href = d.url; return; } // hands off to Google's consent screen
      setConnecting(false);
    } catch {
      setMsg({ text: 'Unable to start Google connection.', tone: 'error' });
      setConnecting(false);
    }
  };

  const saveSite = async () => {
    if (!selected) return;
    setSavingSite(true);
    setMsg(null);
    try {
      const r = await fetch(api(workspaceId, '/site'), {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ site_url: selected }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setChoosing(false);
        setOverview(null);
        setStatus(s => (s ? { ...s, site_url: d.site_url || selected } : s));
      } else {
        setMsg({ text: d.detail || 'Could not save that property.', tone: 'error' });
      }
    } catch {
      setMsg({ text: 'Could not reach the server.', tone: 'error' });
    }
    setSavingSite(false);
  };

  const openChooser = () => {
    setSelected(status?.site_url || '');
    setChoosing(true);
    loadSites();
  };

  // Revokes the grant with Google and deletes the stored tokens server-side.
  const disconnect = async () => {
    if (!workspaceId) return;
    if (!window.confirm(
      'Disconnect Google Search Console?\n\nRaftra loses access to your search data and ' +
      'the connection is revoked with Google. Google Analytics uses the same grant, so it ' +
      'disconnects too. Nothing in your Search Console account changes. You can reconnect ' +
      'at any time.')) return;
    setDisconnecting(true);
    setMsg(null);
    try {
      const r = await fetch(api(workspaceId, '/disconnect'), { method: 'POST', headers: authHeaders() });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setStatus(s => (s ? { ...s, connected: false, email: null, site_url: null } : s));
        setOverview(null);
        setChoosing(false);
        setMsg({ text: 'Disconnected. The grant has been revoked with Google.', tone: 'info' });
      } else {
        setMsg({ text: d.detail || 'Could not disconnect. Please try again.', tone: 'error' });
      }
    } catch {
      setMsg({ text: 'Could not reach the server. Please try again.', tone: 'error' });
    }
    setDisconnecting(false);
  };

  if (!status) return null;

  const isConnected = status.connected;
  const totals = overview?.totals;
  const hasData = !!totals && (totals.impressions > 0 || totals.clicks > 0);

  const picker = (
    <div style={{ marginBottom: '14px' }}>
      {sites === null ? (
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Spinner /> Loading your Search Console properties…
        </div>
      ) : sites.length === 0 ? (
        <p style={{ fontSize: '12px', color: '#ffae00', margin: 0, lineHeight: 1.6 }}>
          {sitesError || `No verified properties on ${status.email || 'this Google account'}. Add and verify your site in Search Console, then choose it here.`}{' '}
          <a href="https://search.google.com/search-console" target="_blank" rel="noreferrer" style={{ color: '#8B85FF', fontWeight: 600 }}>
            Open Search Console →
          </a>
        </p>
      ) : (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={selected}
            onChange={e => setSelected(e.target.value)}
            style={{ flex: 1, minWidth: '200px', padding: '9px 10px', background: 'rgba(0,0,0,0.35)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '12.5px' }}
          >
            {sites.map(s => <option key={s} value={s} style={{ background: '#111' }}>{s}</option>)}
          </select>
          <button onClick={saveSite} disabled={savingSite || !selected} style={btn('rgba(0,255,157,0.15)', savingSite)}>
            {savingSite && <Spinner />}{savingSite ? 'Saving…' : 'Use this property'}
          </button>
          {status.site_url && (
            <button onClick={() => setChoosing(false)} style={btn('rgba(255,255,255,0.06)')}>Cancel</button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="glow-card" style={{ padding: '20px' }}>
      <h3 style={{ fontSize: '14px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px', lineHeight: 1.3, minWidth: 0 }}>
        <span style={{ minWidth: 0 }}>Google Search Console</span>
        <span style={{ marginLeft: 'auto', ...statusBadge(isConnected && status.site_url ? 'connected' : isConnected || connecting ? 'pending' : 'disconnected') }}>
          {isConnected ? (status.site_url ? 'CONNECTED' : 'PROPERTY NEEDED') : connecting ? 'CONNECTING...' : 'NOT CONNECTED'}
        </span>
      </h3>

      {msg && (
        <div style={{
          fontSize: '12px', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px',
          color: msg.tone === 'error' ? '#ff8a8a' : '#8B85FF',
          background: msg.tone === 'error' ? 'rgba(255,92,92,0.08)' : 'rgba(90,82,255,0.1)',
          border: `1px solid ${msg.tone === 'error' ? 'rgba(255,92,92,0.3)' : 'rgba(90,82,255,0.25)'}`,
        }}>{msg.text}</div>
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
            Connect your Google Search Console account to see real clicks, impressions and rankings —
            and to let every audit check whether Google has actually indexed the page.
          </p>
          <BenefitChips items={BENEFITS} />
          <button onClick={connect} disabled={connecting} style={btn('linear-gradient(135deg, var(--primary) 0%, #3B33FF 100%)', connecting)}>
            {connecting && <Spinner />}
            {connecting ? 'Connecting...' : 'Connect Google Search Console'}
          </button>
        </>
      )}

      {/* ------------------------------------------------- Connected, choose a property */}
      {isConnected && (!status.site_url || choosing) && (
        <>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 12px', lineHeight: 1.6 }}>
            {status.site_url
              ? 'Choose which Search Console property to read.'
              : `Connected${status.email ? ` as ${status.email}` : ''}. Choose the property that matches the website you audit — no search data can be read until one is selected.`}
          </p>
          {picker}
          {!status.site_url && (
            <button onClick={disconnect} disabled={disconnecting} style={btn('rgba(255,92,92,0.1)', disconnecting)}>
              {disconnecting && <Spinner />}{disconnecting ? 'Disconnecting…' : 'Disconnect'}
            </button>
          )}
        </>
      )}

      {/* ------------------------------------------------------------------- Connected */}
      {isConnected && status.site_url && !choosing && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
            <InfoTile label="Property" value={status.site_url} />
            <InfoTile label="Account" value={status.email || 'Connected'} accent="#22C55E" />
            <InfoTile label="Last Sync" value={loadingData ? 'Syncing…' : syncedAt(overview?.last_synced_at)} />
          </div>

          {dataError && (
            <div style={{ fontSize: '12px', color: '#ff8a8a', background: 'rgba(255,92,92,0.08)', border: '1px solid rgba(255,92,92,0.3)', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', lineHeight: 1.5 }}>
              {dataError}
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '8px' }}>
            <MetricTile label="Organic Clicks" value={totals ? fmt(totals.clicks) : '—'} />
            <MetricTile label="Impressions" value={totals ? fmt(totals.impressions) : '—'} />
            <MetricTile label="CTR" value={hasData ? `${totals!.ctr}%` : '—'} />
            <MetricTile label="Average Position" value={hasData ? String(totals!.position) : '—'} />
          </div>
          {overview && (
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 14px' }}>
              {overview.start_date} → {overview.end_date} · Search Console reports with a ~3 day delay
              {!hasData && ' · no search impressions recorded for this property in that window'}
            </p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: '10px', marginBottom: '16px' }}>
            <DataSection title="Top Queries" rows={topRows(overview?.queries, k => k)} />
            <DataSection title="Top Pages" rows={topRows(overview?.pages, pagePath)} />
            <DataSection title="Countries" rows={topRows(overview?.countries, k => k.toUpperCase())} />
            <DataSection title="Devices" rows={topRows(overview?.devices, k => k.charAt(0).toUpperCase() + k.slice(1).toLowerCase())} />
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={loadOverview} disabled={loadingData} style={btn('rgba(255,255,255,0.06)', loadingData)}>
              {loadingData && <Spinner />}{loadingData ? 'Syncing…' : 'Sync Data'}
            </button>
            <button onClick={openChooser} style={btn('rgba(255,255,255,0.06)')}>Change Property</button>
            <button onClick={disconnect} disabled={disconnecting} style={btn('rgba(255,92,92,0.1)', disconnecting)}>
              {disconnecting && <Spinner />}{disconnecting ? 'Disconnecting…' : 'Disconnect'}
            </button>
            {onRunAudit && <button onClick={onRunAudit} style={btn('linear-gradient(135deg, var(--primary) 0%, #3B33FF 100%)')}>Run SEO Audit</button>}
          </div>
        </>
      )}
    </div>
  );
};
