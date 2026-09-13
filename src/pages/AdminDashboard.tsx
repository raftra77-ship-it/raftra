import { useCallback, useEffect, useState } from 'react';
import { Users2, CreditCard, Cpu, ShieldAlert, RefreshCw } from 'lucide-react';
import '../App.css';

/* Admin console.

   The previous page fetched /api/auth/users (a route that does not exist, so the list was always
   empty), let anyone type an email into "Add User" and appended a row that was never created,
   counted "active subscriptions" from a hardcoded 'pending', and approved payouts with a message
   claiming a Razorpay disbursal had been triggered.

   Everything here is read from /api/admin and /api/payouts, and all of it requires the admin
   role, which is granted only with backend/scripts/grant_admin.py. */

const readJson = async (r: Response) => {
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.detail || `Request failed (${r.status})`), { status: r.status });
  return d;
};

const inr = (n?: number | null) => (n == null ? '—' : `₹${Number(n).toLocaleString('en-IN')}`);
const when = (v?: string | null) => {
  if (!v) return '—';
  const d = new Date(/Z$|[+-]\d{2}:?\d{2}$/.test(v) ? v : `${v}Z`);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
};

const panel = { background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border)', padding: '20px' } as const;

export function AdminDashboard() {
  const [access, setAccess] = useState<'loading' | 'signed_out' | 'denied' | 'ok'>('loading');

  useEffect(() => {
    fetch('/api/admin/me')
      .then(async r => {
        if (r.status === 401) return setAccess('signed_out');
        const d = await r.json().catch(() => ({}));
        setAccess(r.ok && d.is_admin ? 'ok' : 'denied');
      })
      .catch(() => setAccess('denied'));
  }, []);

  return (
    <div className="dashboard-container" style={{ background: 'transparent', minHeight: '100vh', color: 'white', display: 'flex', flexDirection: 'column' }}>
      <header className="dashboard-header" style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Cpu className="logo-icon" size={20} />
          <span style={{ fontWeight: 800, fontSize: '15px', fontFamily: 'var(--font-heading)' }}>ADMIN CONTROL PANEL</span>
        </div>
      </header>

      <main style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {access === 'loading' && <div style={{ color: 'var(--text-secondary)' }}>Checking access…</div>}

        {(access === 'signed_out' || access === 'denied') && (
          <div style={{ ...panel, display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
            <ShieldAlert size={22} color="#FFB300" style={{ flexShrink: 0 }} />
            <div>
              <h2 style={{ margin: '0 0 6px', fontSize: '18px' }}>{access === 'signed_out' ? 'Sign in required' : 'Admin access required'}</h2>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6 }}>
                {access === 'signed_out'
                  ? 'Sign in with an admin account, then open this page again.'
                  : 'This account is not an admin. The role is granted on the server with "python scripts/grant_admin.py <email>"; sign in again afterwards.'}
              </p>
              {access === 'signed_out' && (
                <a href="/login" style={{ display: 'inline-block', marginTop: '12px', color: '#8B85FF', fontWeight: 700 }}>Go to sign in →</a>
              )}
            </div>
          </div>
        )}

        {access === 'ok' && (
          <>
            <h1 style={{ fontSize: '28px', fontFamily: 'var(--font-heading)', marginBottom: '24px' }}>System administration</h1>
            <Summary />
            <div style={{ ...panel, marginTop: '24px' }}>
              <h2 style={{ fontSize: '18px', margin: '0 0 16px', fontFamily: 'var(--font-heading)', color: '#00E676', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={18} /> Creator payout desk
              </h2>
              <PayoutDesk />
            </div>
            <div style={{ ...panel, marginTop: '24px' }}>
              <h2 style={{ fontSize: '18px', margin: '0 0 16px', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users2 size={18} /> Registered users
              </h2>
              <UserList />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Summary() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetch('/api/admin/summary').then(readJson).then(setData).catch(() => setData(null)); }, []);
  if (!data) return null;
  const sum = (o: Record<string, number> = {}) => Object.values(o).reduce((a, b) => a + b, 0);
  const tiles = [
    { label: 'USERS', value: sum(data.users_by_role), sub: Object.entries(data.users_by_role || {}).map(([k, v]) => `${v} ${k}`).join(' · ') },
    { label: 'PAYOUTS TO REVIEW', value: (data.payouts_by_status?.submitted || 0) + (data.payouts_by_status?.under_review || 0), sub: `${data.payouts_by_status?.approved || 0} approved, awaiting transfer` },
    { label: 'PAYOUTS PAID', value: data.payouts_by_status?.paid || 0, sub: `${data.payouts_by_status?.rejected || 0} rejected` },
    { label: 'DIRECT DEALS', value: sum(data.direct_deals_by_status), sub: Object.entries(data.direct_deals_by_status || {}).map(([k, v]) => `${v} ${k}`).join(' · ') || 'none yet' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
      {tiles.map(t => (
        <div key={t.label} style={panel}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.05em' }}>{t.label}</div>
          <div style={{ fontSize: '28px', fontWeight: 800, margin: '6px 0 4px' }}>{t.value}</div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{t.sub}</div>
        </div>
      ))}
    </div>
  );
}

const PAYOUT_TABS = [
  { id: 'open', label: 'To review', match: (s: string) => s === 'submitted' || s === 'under_review' },
  { id: 'approved', label: 'Approved — transfer pending', match: (s: string) => s === 'approved' },
  { id: 'paid', label: 'Paid', match: (s: string) => s === 'paid' },
  { id: 'rejected', label: 'Rejected', match: (s: string) => s === 'rejected' },
] as const;

function PayoutDesk() {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<(typeof PAYOUT_TABS)[number]['id']>('open');
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch('/api/payouts/admin/all').then(readJson)
      .then(d => { setPayouts(Array.isArray(d) ? d : []); setError(null); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (p: any, action: 'approve' | 'reject' | 'mark-paid') => {
    let body: any = {};
    if (action === 'approve') {
      if (!window.confirm(`Approve ${inr(p.amount)} for @${p.creator_handle}?\n\n${p.context?.title || ''}\n\nNothing is transferred by this step.`)) return;
      body = { admin_note: 'Approved for transfer.' };
    } else if (action === 'reject') {
      const note = window.prompt('Reason for rejecting (shown to the creator):');
      if (!note || !note.trim()) return;
      body = { admin_note: note.trim() };
    } else {
      const ref = window.prompt(`Transfer reference for ${inr(p.amount)} to @${p.creator_handle} (UTR or UPI transaction id):`);
      if (!ref || !ref.trim()) return;
      body = { payout_ref: ref.trim() };
    }
    setBusy(p.id);
    try {
      await fetch(`/api/payouts/${p.id}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(readJson);
      load();
    } catch (e: any) {
      setError(e.message);
    }
    setBusy(null);
  };

  const current = PAYOUT_TABS.find(t => t.id === tab)!;
  const rows = payouts.filter(p => current.match(p.status));

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px', alignItems: 'center' }}>
        {PAYOUT_TABS.map(t => {
          const n = payouts.filter(p => t.match(p.status)).length;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: '6px 14px', borderRadius: '100px', border: '1px solid var(--border)', background: tab === t.id ? 'rgba(90,82,255,0.25)' : 'transparent', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>
              {t.label} ({n})
            </button>
          );
        })}
        <button onClick={load} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {error && <div style={{ color: '#ff6b7a', fontSize: '12.5px', marginBottom: '10px' }}>{error}</div>}
      {loading ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Loading payout requests…</div>
      ) : rows.length === 0 ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: '13px', padding: '8px 0' }}>Nothing here.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {rows.map(p => (
            <div key={p.id} style={{ padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>
                    #{p.id} · @{p.creator_handle} ({p.creator_name || 'Creator'}) · <span style={{ color: '#00E676' }}>{inr(p.amount)}</span>
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    {p.context?.title}{p.context?.work_status ? ` · work status: ${p.context.work_status}` : ''}
                  </div>
                  {p.context?.kind === 'unlinked' && (
                    <div style={{ fontSize: '12px', color: '#FFB300', marginTop: '4px' }}>Not linked to a deal — check before paying.</div>
                  )}
                  {p.context?.token_matches === false && (
                    <div style={{ fontSize: '12px', color: '#ff6b7a', marginTop: '4px' }}>Verification code does not match the brand's approval.</div>
                  )}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', textAlign: 'right' }}>
                  Requested {when(p.created_at)}{p.reviewed_at ? <><br />Reviewed {when(p.reviewed_at)}</> : null}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '6px 16px', marginTop: '12px', fontSize: '12.5px', fontFamily: 'var(--font-mono)' }}>
                <div>UPI: {p.upi_id || '—'}</div>
                <div>Account: {p.account_number || '—'}</div>
                <div>IFSC: {p.ifsc_code || '—'}</div>
                <div>Holder: {p.bank_account_holder || '—'}</div>
                <div>Bank: {p.bank_name || '—'}</div>
                <div>Code: {p.token_submitted || '—'}</div>
              </div>

              {p.screenshot_url && (
                <a href={p.screenshot_url} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#00C4CC', display: 'inline-block', marginTop: '8px' }}>View proof screenshot ↗</a>
              )}
              {p.admin_note && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>Note: {p.admin_note}</div>}
              {p.payout_ref && <div style={{ fontSize: '12px', color: '#00E676', marginTop: '4px' }}>Transfer reference: {p.payout_ref}</div>}

              {(p.status === 'submitted' || p.status === 'under_review' || p.status === 'approved') && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                  {p.status !== 'approved' && (
                    <button disabled={busy === p.id} onClick={() => act(p, 'approve')} style={{ padding: '7px 14px', background: '#00E676', color: '#000', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Approve</button>
                  )}
                  {p.status === 'approved' && (
                    <button disabled={busy === p.id} onClick={() => act(p, 'mark-paid')} style={{ padding: '7px 14px', background: '#00C4CC', color: '#000', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Mark paid…</button>
                  )}
                  <button disabled={busy === p.id} onClick={() => act(p, 'reject')} style={{ padding: '7px 14px', background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid #EF4444', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Reject…</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UserList() {
  const [users, setUsers] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { fetch('/api/admin/users').then(readJson).then(d => setUsers(Array.isArray(d) ? d : [])).catch(e => setError(e.message)); }, []);
  if (error) return <div style={{ color: '#ff6b7a', fontSize: '13px' }}>{error}</div>;
  if (!users) return <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Loading users…</div>;
  if (users.length === 0) return <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>No registered users.</div>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ color: 'var(--text-secondary)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
            <th style={{ padding: '8px' }}>ID</th><th style={{ padding: '8px' }}>Email</th><th style={{ padding: '8px' }}>Name</th><th style={{ padding: '8px' }}>Role</th><th style={{ padding: '8px' }}>Status</th><th style={{ padding: '8px' }}>Billing</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{u.id}</td>
              <td style={{ padding: '8px', fontFamily: 'var(--font-mono)' }}>{u.email}</td>
              <td style={{ padding: '8px' }}>{u.name || '—'}</td>
              <td style={{ padding: '8px' }}>{u.role}</td>
              <td style={{ padding: '8px', color: u.is_active ? '#00E676' : 'var(--text-muted)' }}>{u.is_active ? 'active' : 'inactive'}</td>
              <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{u.payment_status || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
