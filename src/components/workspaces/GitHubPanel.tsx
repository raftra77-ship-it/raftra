import React, { useEffect, useState } from 'react';

// GitHub connector: connect the repo where the site's code lives, so approved
// content can be committed as a pull request (applied to the real site on merge).

interface Status { configured: boolean; connected: boolean; login: string | null; repo_full_name: string | null; }
interface Repo { full_name: string; default_branch: string; private: boolean; }
interface RepoMapping {
  scanned: boolean;
  framework?: string;
  default_branch?: string;
  pages_count?: number;
  status?: 'pending' | 'scanning' | 'ready' | 'failed';
  error?: string | null;
}

const authHeaders = (): HeadersInit => {
  const token = localStorage.getItem('token');
  return token ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } : { 'Content-Type': 'application/json' };
};

export const GitHubPanel: React.FC<{ workspaceId: number | null }> = ({ workspaceId }) => {
  const [status, setStatus] = useState<Status | null>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [mapping, setMapping] = useState<RepoMapping | null>(null);
  const [scanning, setScanning] = useState(false);

  const base = () => `/api/connectors/github/${workspaceId}`;

  const loadStatus = () => {
    if (!workspaceId) return;
    fetch(`${base()}/status`, { headers: authHeaders() })
      .then(r => r.json()).then((s: Status) => { setStatus(s); if (s.connected) { loadRepos(); if (s.repo_full_name) loadMapping(); } })
      .catch(() => {
        // Never leave `status` null on a failed fetch — the panel used to render nothing
        // at all in that case, so clicking "Connect GitHub" silently did nothing. Fall
        // back to a not-connected shape so the connect button is always reachable.
        setStatus({ configured: true, connected: false, login: null, repo_full_name: null });
        setMsg('Could not read the GitHub connection status (is the backend running?). You can still try connecting below.');
      });
  };

  const loadRepos = () => {
    fetch(`${base()}/repos`, { headers: authHeaders() })
      .then(r => r.json()).then(d => { if (d && Array.isArray(d.repos)) setRepos(d.repos); }).catch(() => {});
  };

  const loadMapping = () => {
    fetch(`${base()}/repository-mapping`, { headers: authHeaders() })
      .then(r => r.json()).then((d: RepoMapping) => { if (d && d.scanned) setMapping(d); }).catch(() => {});
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
    setStatus(s => (s ? { ...s, repo_full_name: full_name } : s));
    setScanning(true);
    setMapping(null);
    try {
      const r = await fetch(`${base()}/repo`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ repo_full_name: full_name, default_branch: repo?.default_branch || 'main' }),
      });
      const d = await r.json().catch(() => ({}));
      setMapping({ scanned: true, framework: d.framework, pages_count: d.pages_count, status: d.scan_status });
    } finally {
      setScanning(false);
    }
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

      {status.connected && status.repo_full_name && (scanning || mapping) && (
        <div style={{ marginTop: '12px', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
            {scanning || mapping?.status === 'scanning' ? (
              <span>Scanning repository…</span>
            ) : mapping?.status === 'failed' ? (
              <span style={{ color: '#ff5c5c' }}>Repository scan failed{mapping.error ? `: ${mapping.error}` : '.'}</span>
            ) : (
              <>
                <span><b style={{ color: '#fff' }}>Framework:</b> {mapping?.framework || 'Unknown'}</span>
                <span><b style={{ color: '#fff' }}>Pages Detected:</b> {mapping?.pages_count ?? 0}</span>
                <span style={{ color: '#22C55E' }}>Scanned — ready to apply changes</span>
              </>
            )}
        </div>
      )}
    </div>
  );
};

function btn(bg: string): React.CSSProperties {
  return { padding: '9px 16px', background: bg, border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' };
}
