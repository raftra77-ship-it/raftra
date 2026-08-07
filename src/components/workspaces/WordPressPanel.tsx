import React, { useEffect, useState } from 'react';

// WordPress connector. A site connects one of two ways, and the user never has to know
// which — /detect probes the URL and picks:
//   - self-hosted (exposes /wp-json/) -> Application Password, typed in here.
//   - WordPress.com-hosted            -> OAuth, since those sites have no Application
//                                        Passwords screen and serve no /wp-json/ at all.
// Posts are created as DRAFTS; a human presses publish inside WordPress.

interface Status {
  configured: boolean;
  wpcom_configured?: boolean;
  connected: boolean;
  auth_type: string | null;
  site_url: string | null;
  site_name: string | null;
  username: string | null;
  auto_apply?: boolean;
  seo_plugin?: string | null;
  seo_plugin_label?: string | null;
}

interface Revision {
  id: number;
  page_id: number;
  page_title: string | null;
  fixes: string[];
  auto: boolean;
  created_at: string | null;
  reverted_at: string | null;
}

interface Detected {
  method: 'app_password' | 'wpcom_oauth';
  site_url: string;
  site_name?: string;
  wpcom_configured?: boolean;
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
  const [detected, setDetected] = useState<Detected | null>(null);
  const [username, setUsername] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<Revision[]>([]);

  const base = () => `/api/connectors/wordpress/${workspaceId}`;

  const loadRevisions = () => {
    if (!workspaceId) return;
    fetch(`${base()}/revisions`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => setRevisions(d.revisions || []))
      .catch(() => setRevisions([]));
  };

  const loadStatus = () => {
    if (!workspaceId) return;
    fetch(`${base()}/status`, { headers: authHeaders() })
      .then(r => r.json())
      .then((s: Status) => setStatus(s))
      .catch(() => {
        // Never leave `status` null on a failed fetch — the panel used to render nothing
        // at all in that case, so clicking "Connect WordPress" silently did nothing.
        // Fall back to a not-connected shape so the connect form is always reachable.
        setStatus({ configured: true, connected: false, auth_type: null, site_url: null, site_name: null, username: null });
        setMsg('Could not read the WordPress connection status (is the backend running?). You can still try connecting below.');
      });
  };

  useEffect(() => { loadStatus(); loadRevisions(); /* eslint-disable-next-line */ }, [workspaceId]);

  const undo = async (revisionId?: number) => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`${base()}/undo`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ revision_id: revisionId ?? null }),
      });
      const d = await r.json().catch(() => ({}));
      setMsg(r.ok ? (d.message || 'Restored the previous version.')
                  : (d.detail || 'Could not undo that change.'));
      loadRevisions();
    } finally { setBusy(false); }
  };

  // The WordPress.com OAuth callback redirects back here with a result flag.
  useEffect(() => {
    const flag = new URLSearchParams(window.location.search).get('wordpress');
    if (!flag) return;
    setMsg(flag === 'connected'
      ? 'WordPress.com connected.'
      : 'WordPress.com did not complete the connection. Please try again.');
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  // Step 1 — work out how this site can connect, before asking for any credentials.
  const detect = async () => {
    if (!siteUrl.trim()) { setMsg('Enter your WordPress site URL.'); return; }
    setBusy(true); setMsg(null); setDetected(null);
    try {
      const r = await fetch(`${base()}/detect`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ site_url: siteUrl.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(d.detail || 'Could not check that site.'); return; }
      setDetected(d);
      setSiteUrl(d.site_url);
      if (d.method === 'wpcom_oauth' && d.wpcom_configured === false) {
        setMsg('This is a WordPress.com site, but WordPress.com sign-in is not configured on the server yet.');
      }
    } finally { setBusy(false); }
  };

  // Step 2a — self-hosted: verify and store the application password.
  const connect = async () => {
    if (!username.trim() || !appPassword.trim()) {
      setMsg('Enter the username and application password.');
      return;
    }
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`${base()}/connect`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ site_url: siteUrl.trim(), username: username.trim(), app_password: appPassword.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(d.detail || 'Could not connect to WordPress.'); return; }
      setMsg(`Connected to ${d.site_name || d.site_url} as ${d.connected_as || username}.`
        + (d.seo_plugin ? '' : ' No SEO plugin detected — meta descriptions can\'t be written on this site.'));
      setAppPassword(''); setDetected(null);
      loadStatus();
    } finally { setBusy(false); }
  };

  // Step 2b — WordPress.com: hand off to their consent screen.
  const connectWpcom = async () => {
    setBusy(true); setMsg(null);
    try {
      const host = detected?.site_url?.replace(/^https?:\/\//, '') || '';
      const r = await fetch(`${base()}/oauth/authorize?blog=${encodeURIComponent(host)}`, { headers: authHeaders() });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.url) { setMsg(d.detail || 'Could not start WordPress.com sign-in.'); return; }
      window.location.href = d.url;
    } finally { setBusy(false); }
  };

  const toggleAutoApply = async (enabled: boolean) => {
    setStatus(s => (s ? { ...s, auto_apply: enabled } : s));   // optimistic
    const r = await fetch(`${base()}/auto-apply`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ enabled }),
    });
    if (!r.ok) { setMsg('Could not change the auto-apply setting.'); loadStatus(); return; }
    if (!enabled) { setMsg('Auto-apply is off — approved fixes wait for you to press Apply.'); return; }
    const d = await r.json().catch(() => ({}));
    // Turning it on applies whatever is already approved, so report what actually happened
    // rather than a generic "setting saved".
    setMsg(d.applied
      ? `Auto-apply is on. ${d.message || 'Applied your approved fixes.'}`
      : `Auto-apply is on, but nothing was applied yet: ${d.message || 'no approved fixes for this site.'}`);
  };

  const disconnect = async () => {
    await fetch(base(), { method: 'DELETE', headers: authHeaders() });
    setMsg('WordPress disconnected.');
    setDetected(null); setSiteUrl(''); setUsername('');
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
        Works with self-hosted WordPress and WordPress.com alike; enter your address and we&apos;ll pick the right way to connect.
      </p>

      {msg && <div style={note}>{msg}</div>}

      {/* ---------- not connected: step 1, the address ---------- */}
      {!status.connected && !detected && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={siteUrl} onChange={e => setSiteUrl(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && detect()}
                 placeholder="https://yoursite.com" style={input(260)} />
          <button onClick={detect} disabled={busy}
                  style={{ ...btn('linear-gradient(135deg, #21759B 0%, #464646 100%)'), opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Checking…' : 'Continue'}
          </button>
        </div>
      )}

      {/* ---------- not connected: step 2a, self-hosted ---------- */}
      {!status.connected && detected?.method === 'app_password' && (
        <div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
            Found WordPress at <strong>{detected.site_name || detected.site_url}</strong>. Create an application
            password under <em>WP Admin → Users → Profile → Application Passwords</em> and paste it here.
          </p>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input value={username} onChange={e => setUsername(e.target.value)}
                   placeholder="WP username" style={input(150)} />
            <input value={appPassword} onChange={e => setAppPassword(e.target.value)}
                   type="password" placeholder="application password" style={input(200)} />
            <button onClick={connect} disabled={busy}
                    style={{ ...btn('linear-gradient(135deg, #21759B 0%, #464646 100%)'), opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Checking…' : 'Connect WordPress'}
            </button>
            <button onClick={() => setDetected(null)} style={{ ...btn('transparent'), border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              Back
            </button>
          </div>
        </div>
      )}

      {/* ---------- not connected: step 2b, WordPress.com ---------- */}
      {!status.connected && detected?.method === 'wpcom_oauth' && (
        <div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
            <strong>{detected.site_name || detected.site_url}</strong> is hosted on WordPress.com, which uses
            sign-in instead of application passwords. You&apos;ll approve access on WordPress.com and come straight back.
          </p>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={connectWpcom} disabled={busy || detected.wpcom_configured === false}
                    style={{ ...btn('linear-gradient(135deg, #21759B 0%, #464646 100%)'),
                             opacity: (busy || detected.wpcom_configured === false) ? 0.5 : 1 }}>
              {busy ? 'Redirecting…' : 'Connect with WordPress.com'}
            </button>
            <button onClick={() => setDetected(null)} style={{ ...btn('transparent'), border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              Back
            </button>
          </div>
        </div>
      )}

      {/* ---------- connected ---------- */}
      {status.connected && (
        <div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {status.site_name || status.site_url}
              {status.username ? ` — @${status.username}` : ' — via WordPress.com'}
            </span>
            <button onClick={disconnect}
                    style={{ ...btn('transparent'), border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              Disconnect
            </button>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!status.auto_apply}
                   onChange={e => toggleAutoApply(e.target.checked)} />
            <span style={{ fontSize: '12px' }}>
              Apply SEO fixes automatically once I approve them
            </span>
          </label>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px', marginLeft: '24px' }}>
            You still approve every recommendation first — this only removes the second click.
            WordPress has no pull request to review, so approved changes go live immediately.
          </p>

          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '10px' }}>
            {status.seo_plugin_label
              ? `${status.seo_plugin_label} detected — meta descriptions and canonical tags will be written to it.`
              : 'No SEO plugin detected. Page titles, content and structured data apply; meta descriptions and canonical tags need Yoast or Rank Math.'}
          </p>

          {/* Undo history. WordPress writes are immediate and have no pull request, so this
              is the only way back — surfaced right here rather than buried in a menu. */}
          {revisions.length > 0 && (
            <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>Recent changes</div>
              {revisions.slice(0, 5).map(rev => (
                <div key={rev.id} style={{ display: 'flex', alignItems: 'center', gap: '10px',
                                           padding: '6px 0', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', flex: 1, minWidth: '200px' }}>
                    <strong>{rev.page_title || `Page ${rev.page_id}`}</strong>
                    {' — '}{rev.fixes.length} fix{rev.fixes.length === 1 ? '' : 'es'}
                    {rev.auto ? ' (auto)' : ''}
                    {rev.created_at ? ` · ${new Date(rev.created_at).toLocaleString()}` : ''}
                  </span>
                  {rev.reverted_at ? (
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', opacity: 0.7 }}>undone</span>
                  ) : (
                    <button onClick={() => undo(rev.id)} disabled={busy}
                            style={{ ...btn('transparent'), padding: '4px 10px', fontSize: '11px',
                                     border: '1px solid var(--border-color)', color: 'var(--text-secondary)',
                                     opacity: busy ? 0.5 : 1 }}>
                      Undo
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
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
