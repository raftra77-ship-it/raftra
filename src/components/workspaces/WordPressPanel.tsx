import React, { useEffect, useState } from 'react';

// WordPress connector: uses an Application Password (WP 5.6+) rather than OAuth, which
// is what self-hosted sites support out of the box — so there is no app to register.
// Posts are created as DRAFTS; a human presses publish inside WordPress.

interface Status {
  configured: boolean;
  connected: boolean;
  site_url: string | null;
  site_name: string | null;
  username: string | null;
}

const authHeaders = (): HeadersInit => {
  const token = localStorage.getItem('token');
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };
};

export const WordPressPanel: React.FC<{ workspaceId: number | null }> = ({ workspaceId }) => {
  const [status, setStatus] = useState<Status | null>(null);
  const [siteUrl, setSiteUrl] = useState('');
  const [username, setUsername] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const base = () => `/api/connectors/wordpress/${workspaceId}`;

  const loadStatus = () => {
    if (!workspaceId) return;
    fetch(`${base()}/status`, { headers: authHeaders() })
      .then(r => r.json()).then((s: Status) => setStatus(s)).catch(() => {});
  };

  useEffect(() => { loadStatus(); /* eslint-disable-next-line */ }, [workspaceId]);

  const connect = async () => {
    if (!siteUrl.trim() || !username.trim() || !appPassword.trim()) {
      setMsg('Enter the site URL, username and application password.');
      return;
    }
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`${base()}/connect`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ site_url: siteUrl.trim(), username: username.trim(), app_password: appPassword.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(d.detail || 'Could not connect to WordPress.'); return; }
      setMsg(`Connected to ${d.site_name || d.site_url} as ${d.connected_as || username}.`);
      setAppPassword('');
      loadStatus();
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    await fetch(base(), { method: 'DELETE', headers: authHeaders() });
    setMsg('WordPress disconnected.');
    loadStatus();
  };

  if (!status) return null;

  return (
    <div className="glow-card" style={{ padding: '20px', marginTop: '24px' }}>
      <h3 style={{ fontSize: '15px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        WordPress — Publish to your site
        <span style={badge(status.connected)}>{status.connected ? 'CONNECTED' : 'NOT CONNECTED'}</span>
      </h3>
      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
        Approved content is created as a <strong>draft</strong> post — you press publish in WordPress.
        Create an application password under <em>WP Admin → Users → Profile → Application Passwords</em>.
      </p>

      {msg && <div style={note}>{msg}</div>}

      {!status.connected && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={siteUrl} onChange={e => setSiteUrl(e.target.value)}
                 placeholder="https://yoursite.com" style={input(220)} />
          <input value={username} onChange={e => setUsername(e.target.value)}
                 placeholder="WP username" style={input(150)} />
          <input value={appPassword} onChange={e => setAppPassword(e.target.value)}
                 type="password" placeholder="application password" style={input(200)} />
          <button onClick={connect} disabled={busy}
                  style={{ ...btn('linear-gradient(135deg, #21759B 0%, #464646 100%)'), opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Checking…' : 'Connect WordPress'}
          </button>
        </div>
      )}

      {status.connected && (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {status.site_name || status.site_url} — @{status.username}
          </span>
          <button onClick={disconnect}
                  style={{ ...btn('transparent'), border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
};

const note: React.CSSProperties = {
  fontSize: '12px', color: '#8B85FF', background: 'rgba(90,82,255,0.1)',
  border: '1px solid rgba(90,82,255,0.25)', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px',
};

function input(minWidth: number): React.CSSProperties {
  return { padding: '9px 12px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '12px', minWidth: `${minWidth}px` };
}

function badge(connected: boolean): React.CSSProperties {
  return {
    marginLeft: 'auto', fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px',
    color: connected ? '#22C55E' : 'var(--text-secondary)',
    background: connected ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)',
    border: `1px solid ${connected ? 'rgba(34,197,94,0.3)' : 'var(--border-color)'}`,
    borderRadius: '6px', padding: '2px 8px',
  };
}

function btn(bg: string): React.CSSProperties {
  return { padding: '9px 16px', background: bg, border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' };
}
