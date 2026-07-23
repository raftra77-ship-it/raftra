import React, { useEffect, useState } from 'react';

// Google Search Console connector: connect the account, pick the verified
// property, see REAL rankings (queries/clicks/impressions/position), and submit
// a sitemap so Google indexes the site. This is the piece that actually moves a
// site toward "showing up in Google".

interface Status {
  configured: boolean;
  connected: boolean;
  email: string | null;
  site_url: string | null;
}

interface Row {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

const authHeaders = (): HeadersInit => {
  const token = localStorage.getItem('token');
  return token ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } : { 'Content-Type': 'application/json' };
};

export const SearchConsolePanel: React.FC<{ workspaceId: number | null }> = ({ workspaceId }) => {
  const [status, setStatus] = useState<Status | null>(null);
  const [sites, setSites] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState<{ clicks: number; impressions: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const base = () => `/api/connectors/search-console/${workspaceId}`;

  const loadStatus = () => {
    if (!workspaceId) return;
    fetch(`${base()}/status`, { headers: authHeaders() })
      .then(r => r.json()).then((s: Status) => {
        setStatus(s);
        if (s.connected) { loadSites(); if (s.site_url) loadPerformance(); }
      }).catch(() => {});
  };

  const loadSites = () => {
    fetch(`${base()}/sites`, { headers: authHeaders() })
      .then(r => r.json()).then(d => { if (d && Array.isArray(d.sites)) setSites(d.sites); }).catch(() => {});
  };

  const loadPerformance = () => {
    setLoading(true);
    fetch(`${base()}/performance?days=28`, { headers: authHeaders() })
      .then(r => r.json()).then(d => {
        if (d && Array.isArray(d.rows)) { setRows(d.rows); setTotals(d.totals || null); }
        else if (d && d.detail) setMsg(d.detail);
      }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadStatus();
    // Surface the OAuth redirect result (?gsc=connected / ?gsc=error).
    const p = new URLSearchParams(window.location.search).get('gsc');
    if (p === 'connected') { setMsg('Google Search Console connected.'); }
    else if (p === 'error') { setMsg('Could not connect Search Console. Please try again.'); }
    // eslint-disable-next-line
  }, [workspaceId]);

  const connect = async () => {
    const r = await fetch(`${base()}/authorize`, { headers: authHeaders() });
    if (!r.ok) { const e = await r.json().catch(() => ({})); setMsg(e.detail || 'Unable to start Google connection.'); return; }
    const d = await r.json();
    if (d.url) window.location.href = d.url;   // hand off to Google's consent screen
  };

  const selectSite = async (site_url: string) => {
    await fetch(`${base()}/site`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ site_url }) });
    setStatus(s => (s ? { ...s, site_url } : s));
    loadPerformance();
  };

  const submitSitemap = async () => {
    const site = status?.site_url || '';
    const guess = site.endsWith('/') ? `${site}sitemap.xml` : `${site}/sitemap.xml`;
    const sitemap_url = window.prompt('Sitemap URL to submit to Google:', guess);
    if (!sitemap_url) return;
    const r = await fetch(`${base()}/submit-sitemap`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ sitemap_url }) });
    const d = await r.json().catch(() => ({}));
    setMsg(r.ok ? (d.message || 'Sitemap submitted.') : (d.detail || 'Sitemap submission failed.'));
  };

  if (!status) return null;

  return (
    <div className="glow-card" style={{ padding: '20px' }}>
      <h3 style={{ fontSize: '16px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        Google Search Console
        <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px', color: status.connected ? '#22C55E' : 'var(--text-secondary)', background: status.connected ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)', border: `1px solid ${status.connected ? 'rgba(34,197,94,0.3)' : 'var(--border-color)'}`, borderRadius: '6px', padding: '2px 8px' }}>
          {status.connected ? 'CONNECTED' : 'NOT CONNECTED'}
        </span>
      </h3>
      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
        Your site's real Google rankings — and submit a sitemap so Google indexes your pages.
      </p>

      {msg && (
        <div style={{ fontSize: '12px', color: '#8B85FF', background: 'rgba(90,82,255,0.1)', border: '1px solid rgba(90,82,255,0.25)', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px' }}>{msg}</div>
      )}

      {!status.configured && (
        <div style={{ fontSize: '12px', color: '#ffae00' }}>
          Server not configured for Google connections yet (GOOGLE_CLIENT_ID / SECRET missing).
        </div>
      )}

      {status.configured && !status.connected && (
        <button onClick={connect} style={btn('linear-gradient(135deg, var(--primary) 0%, #3B33FF 100%)')}>
          Connect Google Search Console
        </button>
      )}

      {status.connected && (
        <>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Connected as <strong style={{ color: '#fff' }}>{status.email}</strong>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Property:</label>
            <select
              value={status.site_url || ''}
              onChange={(e) => selectSite(e.target.value)}
              style={{ padding: '8px 10px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
            >
              <option value="" disabled>Select a verified property…</option>
              {sites.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {status.site_url && <button onClick={submitSitemap} style={btn('rgba(255,255,255,0.06)')}>Submit sitemap to Google</button>}
          </div>

          {status.site_url && (
            <>
              {totals && (
                <div style={{ display: 'flex', gap: '24px', marginBottom: '12px', fontSize: '13px' }}>
                  <div><span style={{ color: 'var(--text-secondary)' }}>Clicks (28d): </span><strong>{totals.clicks}</strong></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>Impressions (28d): </span><strong>{totals.impressions}</strong></div>
                </div>
              )}
              {loading && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Loading rankings…</div>}
              {!loading && rows.length === 0 && (
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  No search data yet. If the site is new or was just submitted, Google needs days-to-weeks to gather it.
                </div>
              )}
              {rows.length > 0 && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-secondary)', textAlign: 'left' }}>
                        <th style={th}>Query</th><th style={th}>Clicks</th><th style={th}>Impr.</th><th style={th}>CTR</th><th style={th}>Position</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} style={{ borderTop: '1px solid var(--border-color)' }}>
                          <td style={td}>{r.query}</td>
                          <td style={td}>{r.clicks}</td>
                          <td style={td}>{r.impressions}</td>
                          <td style={td}>{r.ctr}%</td>
                          <td style={td}>{r.position}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

const th: React.CSSProperties = { padding: '6px 8px', fontWeight: 600 };
const td: React.CSSProperties = { padding: '6px 8px', color: '#fff' };
function btn(bg: string): React.CSSProperties {
  return { padding: '9px 16px', background: bg, border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' };
}
