import React, { useEffect, useState } from 'react';

// Google Analytics 4 (traffic) — reuses the same Google connection as Search
// Console. Shows real users/sessions/page views and the channels driving them.

interface Status { configured: boolean; connected: boolean; ga4_property_id: string | null; }
interface Channel { channel: string; sessions: number; users: number; }
interface Traffic { totals: { active_users: number; sessions: number; page_views: number }; channels: Channel[]; }

const authHeaders = (): HeadersInit => {
  const token = localStorage.getItem('token');
  return token ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } : { 'Content-Type': 'application/json' };
};

export const GA4Panel: React.FC<{ workspaceId: number | null }> = ({ workspaceId }) => {
  const [status, setStatus] = useState<Status | null>(null);
  const [propInput, setPropInput] = useState('');
  const [traffic, setTraffic] = useState<Traffic | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const base = () => `/api/connectors`;

  const loadStatus = () => {
    if (!workspaceId) return;
    fetch(`${base()}/search-console/${workspaceId}/status`, { headers: authHeaders() })
      .then(r => r.json()).then((s: Status) => {
        setStatus(s);
        if (s.ga4_property_id) { setPropInput(s.ga4_property_id); loadTraffic(); }
      }).catch(() => {});
  };

  const loadTraffic = () => {
    setLoading(true);
    fetch(`${base()}/ga4/${workspaceId}/traffic?days=28`, { headers: authHeaders() })
      .then(r => r.json()).then(d => {
        if (d && d.totals) setTraffic(d);
        else if (d && d.detail) setMsg(d.detail);
      }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { loadStatus(); /* eslint-disable-next-line */ }, [workspaceId]);

  const saveProperty = async () => {
    if (!propInput.trim()) return;
    const r = await fetch(`${base()}/ga4/${workspaceId}/property`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ property_id: propInput.trim() }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) { setStatus(s => (s ? { ...s, ga4_property_id: propInput.trim() } : s)); setMsg(null); loadTraffic(); }
    else setMsg(d.detail || 'Could not save GA4 property.');
  };

  if (!status) return null;

  return (
    <div className="glow-card" style={{ padding: '20px' }}>
      <h3 style={{ fontSize: '16px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        Google Analytics 4 — Traffic
        <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px', color: status.connected ? '#22C55E' : 'var(--text-secondary)', background: status.connected ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)', border: `1px solid ${status.connected ? 'rgba(34,197,94,0.3)' : 'var(--border-color)'}`, borderRadius: '6px', padding: '2px 8px' }}>
          {status.connected ? 'CONNECTED' : 'NOT CONNECTED'}
        </span>
      </h3>
      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
        Your site's real visitors — users, sessions, and where they come from.
      </p>

      {msg && (
        <div style={{ fontSize: '12px', color: '#ffae00', background: 'rgba(255,174,0,0.08)', border: '1px solid rgba(255,174,0,0.25)', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px' }}>{msg}</div>
      )}

      {!status.connected && (
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          Connect Google in the Search Console panel above — that same connection enables traffic here.
        </div>
      )}

      {status.connected && (
        <>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>GA4 Property ID:</label>
            <input
              value={propInput}
              onChange={(e) => setPropInput(e.target.value)}
              placeholder="e.g. 123456789"
              style={{ padding: '8px 10px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '12px', width: '140px' }}
            />
            <button onClick={saveProperty} style={btn('rgba(90,82,255,0.2)')}>Save</button>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>(GA4 Admin → Property Settings → Property ID)</span>
          </div>

          {status.ga4_property_id && (
            <>
              {loading && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Loading traffic…</div>}
              {traffic && (
                <>
                  <div style={{ display: 'flex', gap: '24px', marginBottom: '14px', fontSize: '13px', flexWrap: 'wrap' }}>
                    <Stat label="Users (28d)" value={traffic.totals.active_users} />
                    <Stat label="Sessions (28d)" value={traffic.totals.sessions} />
                    <Stat label="Page views (28d)" value={traffic.totals.page_views} />
                  </div>
                  {traffic.channels.length > 0 && (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ color: 'var(--text-secondary)', textAlign: 'left' }}>
                            <th style={th}>Channel</th><th style={th}>Sessions</th><th style={th}>Users</th>
                          </tr>
                        </thead>
                        <tbody>
                          {traffic.channels.map((c, i) => (
                            <tr key={i} style={{ borderTop: '1px solid var(--border-color)' }}>
                              <td style={td}>{c.channel}</td>
                              <td style={td}>{c.sessions}</td>
                              <td style={td}>{c.users}</td>
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
        </>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div><div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{label}</div><strong style={{ fontSize: '18px' }}>{value.toLocaleString()}</strong></div>
);
const th: React.CSSProperties = { padding: '6px 8px', fontWeight: 600 };
const td: React.CSSProperties = { padding: '6px 8px', color: '#fff' };
function btn(bg: string): React.CSSProperties {
  return { padding: '8px 14px', background: bg, border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' };
}
