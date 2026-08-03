import React, { useEffect, useState } from 'react';

// Shopify connector: connect a store so approved content can be created as a blog
// article. Articles are created UNPUBLISHED — a human presses publish in Shopify.

interface Status {
  configured: boolean;
  connected: boolean;
  shop_domain: string | null;
  shop_name: string | null;
  blog_id: number | null;
}
interface Blog { id: number; title: string; handle: string; }

const authHeaders = (): HeadersInit => {
  const token = localStorage.getItem('token');
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };
};

export const ShopifyPanel: React.FC<{ workspaceId: number | null }> = ({ workspaceId }) => {
  const [status, setStatus] = useState<Status | null>(null);
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [shop, setShop] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const base = () => `/api/connectors/shopify/${workspaceId}`;

  const loadBlogs = () => {
    fetch(`${base()}/blogs`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d && Array.isArray(d.blogs)) setBlogs(d.blogs); })
      .catch(() => {});
  };

  const loadStatus = () => {
    if (!workspaceId) return;
    fetch(`${base()}/status`, { headers: authHeaders() })
      .then(r => r.json())
      .then((s: Status) => { setStatus(s); if (s.connected) loadBlogs(); })
      .catch(() => {});
  };

  useEffect(() => {
    loadStatus();
    const p = new URLSearchParams(window.location.search).get('shopify');
    if (p === 'connected') setMsg('Shopify store connected.');
    else if (p === 'error') setMsg('Could not connect Shopify. Please try again.');
    // eslint-disable-next-line
  }, [workspaceId]);

  const connect = async () => {
    if (!shop.trim()) { setMsg('Enter your store domain first (e.g. my-store.myshopify.com).'); return; }
    const r = await fetch(`${base()}/authorize`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ shop: shop.trim() }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      setMsg(e.detail || 'Unable to start the Shopify connection.');
      return;
    }
    const d = await r.json();
    if (d.url) window.location.href = d.url;
  };

  const selectBlog = async (blogId: string) => {
    await fetch(`${base()}/blog`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ blog_id: Number(blogId) }),
    });
    setStatus(s => (s ? { ...s, blog_id: Number(blogId) } : s));
  };

  const disconnect = async () => {
    await fetch(base(), { method: 'DELETE', headers: authHeaders() });
    setBlogs([]); setMsg('Shopify disconnected.'); loadStatus();
  };

  if (!status) return null;

  return (
    <div className="glow-card" style={{ padding: '20px', marginTop: '24px' }}>
      <h3 style={{ fontSize: '15px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        Shopify — Publish to your store
        <span style={badge(status.connected)}>{status.connected ? 'CONNECTED' : 'NOT CONNECTED'}</span>
      </h3>
      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
        Connect your store to create approved content as a blog article. Articles are created
        unpublished — you press publish in Shopify.
      </p>

      {msg && <div style={note}>{msg}</div>}

      {!status.configured && (
        <div style={{ fontSize: '12px', color: '#ffae00' }}>
          Server not configured for Shopify (SHOPIFY_CLIENT_ID / SECRET missing).
        </div>
      )}

      {status.configured && !status.connected && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={shop}
            onChange={e => setShop(e.target.value)}
            placeholder="my-store.myshopify.com"
            style={{ padding: '9px 12px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '12px', minWidth: '240px' }}
          />
          <button onClick={connect} style={btn('linear-gradient(135deg, #5A8F3D 0%, #95BF47 100%)')}>
            Connect Shopify
          </button>
        </div>
      )}

      {status.connected && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {status.shop_name || status.shop_domain}
          </span>
          <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Blog:</label>
          <select
            value={status.blog_id ?? ''}
            onChange={e => selectBlog(e.target.value)}
            style={{ padding: '8px 10px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '12px', minWidth: '200px' }}
          >
            <option value="" disabled>Select a blog…</option>
            {blogs.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
          </select>
          <button onClick={disconnect} style={{ ...btn('transparent'), border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
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
