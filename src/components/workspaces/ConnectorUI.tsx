import React from 'react';

// Small, reusable building blocks shared by the connector dashboards (Search Console, GA4,
// and future ones). Each renders a placeholder cleanly today and a real value tomorrow with
// no structural change — just pass real data in.

export const MetricTile: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ flex: 1, minWidth: '110px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
    <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginBottom: '6px' }}>{label}</div>
    <div style={{ fontSize: '20px', fontWeight: 800, color: value === '—' ? 'var(--text-muted)' : '#fff' }}>{value}</div>
  </div>
);

export const DataSection: React.FC<{ title: string; rows?: React.ReactNode[] }> = ({ title, rows }) => (
  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px 14px' }}>
    <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>{title}</div>
    {rows && rows.length > 0 ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>{rows}</div>
    ) : (
      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No Data Yet</div>
    )}
  </div>
);

export const InfoTile: React.FC<{ label: string; value: string; accent?: string }> = ({ label, value, accent }) => (
  <div style={{ flex: 1, minWidth: '140px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '10px 12px' }}>
    <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{label}</div>
    <div style={{ fontSize: '13px', fontWeight: 600, color: accent || '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
  </div>
);

export const BenefitChips: React.FC<{ items: string[] }> = ({ items }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginBottom: '16px' }}>
    {items.map(b => (
      <span key={b} style={{ fontSize: '11px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', borderRadius: '20px', padding: '4px 10px' }}>
        {b}
      </span>
    ))}
  </div>
);

export const Spinner: React.FC = () => (
  <span style={{
    display: 'inline-block', width: '11px', height: '11px', borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff',
    animation: 'spin 0.7s linear infinite', marginRight: '2px',
  }} />
);

export function connectorBtn(bg: string, disabled?: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: '7px',
    padding: '9px 16px', background: bg, border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
    color: '#fff', fontSize: '13px', fontWeight: 600, cursor: disabled ? 'wait' : 'pointer',
    opacity: disabled ? 0.7 : 1,
  };
}

export function statusBadge(state: 'connected' | 'pending' | 'disconnected'): React.CSSProperties {
  const map = {
    connected: { c: '#22C55E', bg: 'rgba(34,197,94,0.12)', b: 'rgba(34,197,94,0.3)' },
    pending: { c: '#ffae00', bg: 'rgba(255,174,0,0.12)', b: 'rgba(255,174,0,0.35)' },
    disconnected: { c: 'var(--text-secondary)', bg: 'rgba(255,255,255,0.06)', b: 'var(--border-color)' },
  }[state];
  return { fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px', color: map.c, background: map.bg, border: `1px solid ${map.b}`, borderRadius: '6px', padding: '2px 8px' };
}