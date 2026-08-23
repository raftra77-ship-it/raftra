import React from 'react';

// Marks for the parts of a workspace that are demonstrations: they answer input with
// pre-written results instead of calling a model or a data source. They stay in the product
// as a walkthrough of what each module will do, but they carry a PREVIEW mark so their
// output is never mistaken for real work. Anything genuinely wired to the backend is
// deliberately left unmarked.

export const PreviewBadge: React.FC<{ label?: string }> = ({ label = 'PREVIEW' }) => (
  <span style={{
    fontSize: '10px', fontWeight: 800, letterSpacing: '0.06em', color: 'var(--warning)',
    background: 'rgba(255,174,0,0.12)', border: '1px solid rgba(255,174,0,0.35)',
    borderRadius: '6px', padding: '3px 8px', whiteSpace: 'nowrap',
  }}>{label}</span>
);

export const PreviewNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p style={{
    fontSize: '11.5px', color: 'var(--warning)', margin: '10px 0 0 0', lineHeight: 1.55,
    display: 'flex', gap: '7px', alignItems: 'flex-start',
  }}>
    <span aria-hidden="true">ⓘ</span><span>{children}</span>
  </p>
);

// Shown where a panel needs a data source the workspace has not connected yet. Saying which
// connector is missing is more useful than a blank chart - and far better than the invented
// numbers these panels used to display.
export const NotConnected: React.FC<{ source: string; children?: React.ReactNode }> = ({ source, children }) => (
  <div style={{
    padding: '18px', border: '1px dashed var(--border-color)', borderRadius: '10px',
    background: 'rgba(255,255,255,0.015)', color: 'var(--text-secondary)', fontSize: '12.5px', lineHeight: 1.6,
  }}>
    <div style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '11px', letterSpacing: '0.04em', marginBottom: '6px' }}>
      {source.toUpperCase()} NOT CONNECTED
    </div>
    {children}
  </div>
);
