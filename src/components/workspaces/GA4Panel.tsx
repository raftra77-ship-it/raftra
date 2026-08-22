import React, { useEffect, useState } from 'react';
import { MetricTile, DataSection, InfoTile, BenefitChips, Spinner, connectorBtn as btn, statusBadge } from './ConnectorUI';

// Google Analytics 4 (traffic) — reuses the same Google connection as Search Console.
//
// REAL (already wired, untouched by this pass): /status (shared with Search Console),
// POST /ga4/{id}/property (save the Property ID), GET /ga4/{id}/traffic (Users, Sessions,
// Page Views totals + channel breakdown).
//
// PLACEHOLDER (this pass): the richer post-connection dashboard — Last Sync, Bounce Rate,
// Avg Session Duration, Top Pages, Devices, New vs Returning. Each is marked with a TODO
// showing exactly which real call replaces it later.

interface Status { configured: boolean; connected: boolean; ga4_property_id: string | null; }
interface Channel { channel: string; sessions: number; users: number; }
interface Traffic { totals: { active_users: number; sessions: number; page_views: number }; channels: Channel[]; }

const authHeaders = (): HeadersInit => {
  const token = localStorage.getItem('token');
  return token ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } : { 'Content-Type': 'application/json' };
};

const BENEFITS = ['Users', 'Sessions', 'Page Views', 'Bounce Rate', 'Avg. Session Duration', 'Traffic Sources', 'Real-Time Visitors'];

export const GA4Panel: React.FC<{ workspaceId: number | null }> = ({ workspaceId }) => {
  const [status, setStatus] = useState<Status | null>(null);
  const [propInput, setPropInput] = useState('');
  const [traffic, setTraffic] = useState<Traffic | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Placeholder-only local state for the post-connection dashboard — none of this reads
  // from Google yet. Structured so each becomes a real fetch result later without touching
  // the render below.
  const [lastSync, setLastSync] = useState<string>('Just Now');
  const [syncing, setSyncing] = useState(false);
  const [changingProperty, setChangingProperty] = useState(false);
  const [propertyDraft, setPropertyDraft] = useState('');
  const [forceDisconnected, setForceDisconnected] = useState(false);

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
        if (d && d.totals) { setTraffic(d); setLastSync('Just Now'); }
        else if (d && d.detail) setMsg(d.detail);
      }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { loadStatus(); /* eslint-disable-next-line */ }, [workspaceId]);

  const saveProperty = async () => {
    if (!propInput.trim()) return;
    setSaving(true);
    try {
      const r = await fetch(`${base()}/ga4/${workspaceId}/property`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ property_id: propInput.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setStatus(s => (s ? { ...s, ga4_property_id: propInput.trim() } : s)); setMsg(null); loadTraffic(); }
      else setMsg(d.detail || 'Could not save GA4 property.');
    } finally {
      setSaving(false);
    }
  };

  // ---- Placeholder actions (post-connection dashboard) ------------------------------
  // TODO: replace with a real GET /ga4/{id}/traffic call (already exists — this just re-runs it).
  const syncData = () => {
    setSyncing(true);
    if (status?.ga4_property_id) loadTraffic();
    setTimeout(() => setSyncing(false), 700);
  };
  // TODO: this already calls the real POST /ga4/{id}/property under the hood via saveProperty.
  const openChangeProperty = () => { setPropertyDraft(status?.ga4_property_id || ''); setChangingProperty(true); };
  const confirmChangeProperty = () => { setPropInput(propertyDraft); setChangingProperty(false); saveProperty(); };
  // TODO: replace with a real disconnect/revoke endpoint once one exists for GA4 specifically.
  const disconnect = () => { setForceDisconnected(true); setMsg('Disconnected.'); };

  if (!status) return null;

  const isConnected = status.connected && !forceDisconnected;
  const hasProperty = isConnected && !!status.ga4_property_id;

  return (
    <div className="glow-card" style={{ padding: '20px' }}>
      <h3 style={{ fontSize: '15px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px', lineHeight: 1.3, minWidth: 0 }}>
        <span style={{ minWidth: 0 }}>Google Analytics 4</span>
        <span style={{ marginLeft: 'auto', ...statusBadge(hasProperty ? 'connected' : isConnected ? 'pending' : 'disconnected') }}>
          {hasProperty ? 'CONNECTED' : isConnected ? 'PROPERTY NEEDED' : 'NOT CONNECTED'}
        </span>
      </h3>

      {msg && (
        <div style={{ fontSize: '12px', color: '#ffae00', background: 'rgba(255,174,0,0.08)', border: '1px solid rgba(255,174,0,0.25)', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px' }}>{msg}</div>
      )}

      {/* ---------------------------------------------------------------- Not Connected */}
      {!isConnected && (
        <>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 14px', lineHeight: 1.6 }}>
            Connect Google in the Search Console panel above — that same connection enables traffic here.
          </p>
          <BenefitChips items={BENEFITS} />
        </>
      )}

      {/* ------------------------------------------------------- Connected, no property */}
      {isConnected && !status.ga4_property_id && (
        <>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 14px', lineHeight: 1.6 }}>
            Enter your GA4 Property ID to unlock real traffic insights.
          </p>
          <BenefitChips items={BENEFITS} />
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              value={propInput}
              onChange={(e) => setPropInput(e.target.value)}
              placeholder="e.g. 123456789"
              style={{ padding: '8px 10px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '12px', width: '140px' }}
            />
            <button onClick={saveProperty} disabled={saving} style={btn('rgba(90,82,255,0.2)', saving)}>{saving && <Spinner />}{saving ? 'Saving...' : 'Save'}</button>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>(GA4 Admin → Property Settings → Property ID)</span>
          </div>
        </>
      )}

      {/* ------------------------------------------------------------------- Connected */}
      {hasProperty && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
            <InfoTile label="Property ID" value={status.ga4_property_id || 'Not set'} />
            <InfoTile label="Connection Status" value="Connected" accent="#22C55E" />
            <InfoTile label="Last Sync" value={syncing || loading ? 'Syncing…' : lastSync} />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
            <MetricTile label="Users (28d)" value={traffic ? traffic.totals.active_users.toLocaleString() : '—'} />
            <MetricTile label="Sessions (28d)" value={traffic ? traffic.totals.sessions.toLocaleString() : '—'} />
            <MetricTile label="Page Views (28d)" value={traffic ? traffic.totals.page_views.toLocaleString() : '—'} />
            <MetricTile label="Bounce Rate" value="—" />
            <MetricTile label="Avg. Session Duration" value="—" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '16px' }}>
            <DataSection
              title="Traffic Sources"
              rows={traffic && traffic.channels.length > 0 ? traffic.channels.map((c, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{c.channel}</span>
                  <span style={{ color: '#fff' }}>{c.sessions.toLocaleString()} sessions</span>
                </div>
              )) : undefined}
            />
            <DataSection title="Top Pages" />
            <DataSection title="Devices" />
            <DataSection title="New vs Returning" />
          </div>

          {changingProperty ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap' }}>
              <input
                value={propertyDraft}
                onChange={e => setPropertyDraft(e.target.value)}
                placeholder="e.g. 123456789"
                style={{ padding: '8px 10px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '12px', width: '140px' }}
              />
              <button onClick={confirmChangeProperty} disabled={saving} style={btn('rgba(0,255,157,0.15)', saving)}>{saving && <Spinner />}Save</button>
              <button onClick={() => setChangingProperty(false)} style={btn('rgba(255,255,255,0.06)')}>Cancel</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button onClick={syncData} disabled={syncing || loading} style={btn('rgba(255,255,255,0.06)', syncing || loading)}>{(syncing || loading) && <Spinner />}Sync Data</button>
              <button onClick={openChangeProperty} style={btn('rgba(255,255,255,0.06)')}>Change Property</button>
              <button onClick={disconnect} style={btn('rgba(255,92,92,0.1)')}>Disconnect</button>
            </div>
          )}
        </>
      )}
    </div>
  );
};