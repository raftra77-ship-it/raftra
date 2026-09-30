import React from 'react';

interface Props { children: React.ReactNode }
interface State { error: Error | null }

/** Keeps one failing panel from taking down the dashboard.
 *
 *  Every workspace tab is a `lazy()` chunk behind a single `Suspense`, and `Suspense` only
 *  handles the pending case - it does not catch a rejection. So when a chunk request failed
 *  (most commonly after a redeploy, when an open tab still points at the previous build's
 *  hashed filenames, but equally on a dropped connection) the throw propagated all the way
 *  up with no boundary anywhere in the tree, and React unmounted the entire dashboard. To
 *  the user that reads as "the section isn't loading" - or as a blank screen.
 *
 *  Reloading is the actual fix for the stale-chunk case, so that is the offered action. */
export class TabErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Tab failed to render:', error, info.componentStack);
  }

  /** Lets a recovered tab render again when the user switches away and back. */
  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.children !== this.props.children) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    // A chunk that 404s after a redeploy says so specifically; anything else gets the
    // generic message rather than a misleading "new version" claim.
    const stale = /Loading chunk|dynamically imported module|Importing a module script failed/i
      .test(this.state.error.message || '');

    return (
      <div
        style={{
          margin: '40px auto', maxWidth: '520px', padding: '28px 32px', textAlign: 'center',
          borderRadius: '16px', background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '14px',
          lineHeight: 1.6,
        }}
      >
        <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>
          This section couldn’t load
        </div>
        <p style={{ margin: '0 0 20px' }}>
          {stale
            ? 'A new version of Raftra has been deployed since you opened this page. Reload to pick it up.'
            : 'Something went wrong while rendering this panel. Reloading usually clears it.'}
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 22px', borderRadius: '10px', border: 'none', cursor: 'pointer',
            background: 'var(--accent, #FF6B00)', color: '#000', fontWeight: 800, fontSize: '13px',
          }}
        >
          Reload
        </button>
      </div>
    );
  }
}
