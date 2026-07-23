import React, { useEffect, useState } from 'react';

// GitHub connector: connect the repo where the site's code lives, so approved
// content can be committed as a pull request (applied to the real site on merge).

interface Status { configured: boolean; connected: boolean; login: string | null; repo_full_name: string | null; }
interface Repo { full_name: string; default_branch: string; private: boolean; }

const authHeaders = (): HeadersInit => {
  const token = localStorage.getItem('token');
  return token ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } : { 'Content-Type': 'application/json' };
};

export const GitHubPanel: React.FC<{ workspaceId: number | null }> = ({ workspaceId }) => {
  const [status, setStatus] = useState<Status | null>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const base = () => `/api/connectors/github/${workspaceId}`;

  const loadStatus = () => {
    if (!workspaceId) return;
    fetch(`${base()}/status`, { headers: authHeaders() })
      .then(r => r.json()).then((s: Status) => { setStatus(s); if (s.connected) loadRepos(); })
      .catch(() => {});
  };

  const loadRepos = () => {
    fetch(`${base()}/repos`, { headers: authHeaders() })
      .then(r => r.json()).then(d => { if (d && Array.isArray(d.repos)) setRepos(d.repos); }).catch(() => {});
  };

  useEffect(() => {
    loadStatus();
    const p = new URLSearchParams(window.location.search).get('github');
    if (p === 'connected') setMsg('GitHub connected.');
    else if (p === 'error') setMsg('Could not connect GitHub. Please try again.');
    // eslint-disable-next-line
  }, [workspaceId]);

  const connect = async () => {
    const r = await fetch(`${base()}/authorize`, { headers: authHeaders() });
    if (!r.ok) { const e = await r.json().catch(() => ({})); setMsg(e.detail || 'Unable to start GitHub connection.'); return; }
    const d = await r.json();
    if (d.url) window.location.href = d.url;
  };

  const selectRepo = async (full_name: string) => {
    const repo = repos.find(x => x.full_name === full_name);
    await fetch(`${base()}/repo`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ repo_full_name: full_name, default_branch: repo?.default_branch || 'main' }),
    });
    setStatus(s => (s ? { ...s, repo_full_name: full_name } : s));
  };

  if (!status) return null;

  return (
    <div className="glow-card" style={{ padding: '20px', marginTop: '24px' }}>
      <h3 style={{ fontSize: '15px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        GitHub — Apply to your site
        <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px', color: status.connected ? '#22C55E' : 'var(--text-secondary)', background: status.connected ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)', border: `1px solid ${status.connected ? 'rgba(34,197,94,0.3)' : 'var(--border-color)'}`, borderRadius: '6px', padding: '2px 8px' }}>
          {status.connected ? 'CONNECTED' : 'NOT CONNECTED'}
        </span>
      </h3>
      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
        Connect the repo your site is built from. Approved content is committed as a pull request — it goes live when you merge it.
      </p>

      {msg && <div style={{ fontSize: '12px', color: '#8B85FF', background: 'rgba(90,82,255,0.1)', border: '1px solid rgba(90,82,255,0.25)', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px' }}>{msg}</div>}

      {!status.configured && (
        <div style={{ fontSize: '12px', color: '#ffae00' }}>Server not configured for GitHub (GITHUB_CLIENT_ID / SECRET missing).</div>
      )}

      {status.configured && !status.connected && (
        <button onClick={connect} style={btn('linear-gradient(135deg, #24292f 0%, #57606a 100%)')}>Connect GitHub</button>
      )}

      {status.connected && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>@{status.login}</span>
          <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Repo:</label>
          <select
            value={status.repo_full_name || ''}
            onChange={(e) => selectRepo(e.target.value)}
            style={{ padding: '8px 10px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '12px', minWidth: '220px' }}
          >
            <option value="" disabled>Select a repository…</option>
            {repos.map(r => <option key={r.full_name} value={r.full_name}>{r.full_name}{r.private ? ' (private)' : ''}</option>)}
          </select>
        </div>
      )}
    </div>
  );
};

function btn(bg: string): React.CSSProperties {
  return { padding: '9px 16px', background: bg, border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' };
}
