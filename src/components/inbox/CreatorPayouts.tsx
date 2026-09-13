import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CreditCard, Send, ShieldAlert } from 'lucide-react';
import { GlowButton } from '../GlowButton';
import { inr, shortTime } from './ChatThread';
import { useLiveEvents } from '../../hooks/useLiveEvents';

/* Payment Setup, for real.

   The screen this replaces described a "Razorpay Route 90/10 split" and "escrow" that nothing
   implements, saved bank details with an alert() that stored nothing, accepted a free-text
   "token" with no link to any deal, and printed a tax invoice for "Ankit Kumar", ₹9,000.

   Here a creator picks work that is genuinely payable - a direct deal the brand approved, or a
   posted-deal collaboration the brand completed - and sends the account to pay into. Team
   Raftra reviews it in the admin desk and records the transfer; the status below comes from
   the server. Bank details are sent with each request and never kept in the browser. */

interface Payable {
  key: string;
  kind: 'deal' | 'collab';
  id: number;
  label: string;
  amount: number;
  token?: string | null;
}

const readJson = async (r: Response) => {
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || `Request failed (${r.status})`);
  return d;
};

const STATUS: Record<string, { label: string; color: string }> = {
  submitted: { label: 'Submitted — waiting for review', color: '#FFB300' },
  under_review: { label: 'Under review', color: '#FFB300' },
  approved: { label: 'Approved — transfer being made', color: '#00C4CC' },
  paid: { label: 'Paid', color: '#00E676' },
  rejected: { label: 'Rejected', color: '#FF6B7A' },
};

const field = { width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' } as const;
const label = { fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 600 } as const;

export const CreatorPayouts: React.FC<{
  handle: string;
  creatorName: string;
  preselectDealId?: number | null;
  onOpenProfileSetup: () => void;
}> = ({ handle, creatorName, preselectDealId, onOpenProfileSetup }) => {
  const [deals, setDeals] = useState<any[]>([]);
  const [collabs, setCollabs] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [choice, setChoice] = useState('');
  const [bank, setBank] = useState({ holder: '', bankName: '', account: '', ifsc: '', upi: '' });
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    if (!handle) { setLoading(false); return; }
    Promise.all([
      fetch('/api/deals/mine').then(readJson).catch(() => []),
      fetch('/api/posted-deals/mine').then(readJson).catch(() => []),
      fetch('/api/payouts/mine').then(readJson).catch(() => []),
    ]).then(([d, c, p]) => {
      setDeals(Array.isArray(d) ? d : []);
      setCollabs(Array.isArray(c) ? c : []);
      setPayouts(Array.isArray(p) ? p : []);
    }).finally(() => setLoading(false));
  }, [handle]);

  useEffect(() => { load(); }, [load]);
  useLiveEvents(event => { if (event.type === 'payout_update' || event.type === 'deal_update') load(); }, Boolean(handle));

  // Work that already has an open or paid request is not offered again.
  const claimed = (kind: 'deal' | 'collab', id: number) =>
    payouts.some(p => p.status !== 'rejected' && (kind === 'deal' ? p.deal_id === id : p.application_id === id));

  const payables: Payable[] = [
    ...deals.filter(d => d.status === 'delivered' && !claimed('deal', d.id)).map(d => ({
      key: `deal:${d.id}`, kind: 'deal' as const, id: d.id, amount: d.amount, token: d.verification_token,
      label: `${d.brand_name} — ${d.deliverables} (direct deal #${d.id})`,
    })),
    ...collabs.filter(a => a.status === 'COMPLETED' && !claimed('collab', a.id)).map(a => ({
      key: `collab:${a.id}`, kind: 'collab' as const, id: a.id, amount: a.final_price ?? a.proposed_price,
      label: `${a.brand_name} — ${a.campaign_name} (collaboration #${a.id})`,
    })),
  ];

  useEffect(() => {
    if (preselectDealId && payables.some(p => p.key === `deal:${preselectDealId}`)) setChoice(`deal:${preselectDealId}`);
    else if (!choice && payables[0]) setChoice(payables[0].key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectDealId, payables.length]);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage(null);
    const form = new FormData();
    form.append('file', file);
    try {
      const d = await fetch('/api/media/upload', { method: 'POST', body: form }).then(readJson);
      if (!d.url) throw new Error('The upload returned no link.');
      setScreenshotUrl(d.url);
    } catch (err: any) {
      setScreenshotUrl('');
      setMessage({ ok: false, text: `The screenshot was not uploaded: ${err.message}` });
    }
    setUploading(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const item = payables.find(p => p.key === choice);
    if (!item) { setMessage({ ok: false, text: 'Choose the work you are requesting payment for.' }); return; }
    if (!bank.upi.trim() && !(bank.account.trim() && bank.ifsc.trim())) {
      setMessage({ ok: false, text: 'Add a UPI ID, or a bank account number with its IFSC code.' });
      return;
    }
    if (uploading) { setMessage({ ok: false, text: 'Wait for the screenshot to finish uploading.' }); return; }
    setSubmitting(true);
    try {
      await fetch('/api/payouts/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creator_handle: handle,
          creator_name: creatorName || handle,
          deal_id: item.kind === 'deal' ? item.id : null,
          application_id: item.kind === 'collab' ? item.id : null,
          token_submitted: item.token || null,
          screenshot_url: screenshotUrl || null,
          bank_account_holder: bank.holder.trim() || null,
          bank_name: bank.bankName.trim() || null,
          account_number: bank.account.trim() || null,
          ifsc_code: bank.ifsc.trim().toUpperCase() || null,
          upi_id: bank.upi.trim() || null,
        }),
      }).then(readJson);
      setMessage({ ok: true, text: `Payment request for ${inr(item.amount)} sent to Team Raftra. You'll see its status below.` });
      setBank({ holder: '', bankName: '', account: '', ifsc: '', upi: '' });
      setScreenshotUrl('');
      setChoice('');
      load();
    } catch (err: any) {
      setMessage({ ok: false, text: err.message });
    }
    setSubmitting(false);
  };

  if (!handle) {
    return (
      <div className="glow-card" style={{ padding: '32px', textAlign: 'center' }}>
        <h3 style={{ color: '#fff', marginTop: 0 }}>Add your Instagram handle first</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Deals and payments are linked to your handle.</p>
        <GlowButton variant="glow" onClick={onOpenProfileSetup}>Go to Profile Setup</GlowButton>
      </div>
    );
  }

  const selected = payables.find(p => p.key === choice);

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '26px', fontFamily: 'var(--font-heading)', margin: '0 0 4px 0', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CreditCard size={24} /> Payment requests
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
          Request payment for work a brand has approved. Team Raftra reviews each request and transfers the agreed fee to the account you give here.
        </p>
      </div>

      <div className="glow-card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '17px', margin: '0 0 16px 0', color: '#fff' }}>New request</h3>
        {loading ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Loading your approved work…</div>
        ) : payables.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6 }}>
            Nothing is ready for payment yet. A direct deal becomes payable when the brand approves your delivered work in the chat; a brief collaboration when the brand marks the campaign complete.
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={label}>Work to be paid for</label>
              <select value={choice} onChange={e => setChoice(e.target.value)} style={{ ...field, background: '#14141F' }}>
                {payables.map(p => <option key={p.key} value={p.key}>{p.label} · {inr(p.amount)}</option>)}
              </select>
              {selected && <div style={{ fontSize: '12px', color: '#00E676', marginTop: '6px', fontWeight: 700 }}>Agreed fee: {inr(selected.amount)}</div>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <div><label style={label}>UPI ID</label><input style={field} value={bank.upi} onChange={e => setBank({ ...bank, upi: e.target.value })} placeholder="name@bank" /></div>
              <div><label style={label}>Account holder name</label><input style={field} value={bank.holder} onChange={e => setBank({ ...bank, holder: e.target.value })} /></div>
              <div><label style={label}>Bank name</label><input style={field} value={bank.bankName} onChange={e => setBank({ ...bank, bankName: e.target.value })} /></div>
              <div><label style={label}>Account number</label><input style={field} value={bank.account} onChange={e => setBank({ ...bank, account: e.target.value })} inputMode="numeric" /></div>
              <div><label style={label}>IFSC code</label><input style={field} value={bank.ifsc} onChange={e => setBank({ ...bank, ifsc: e.target.value })} /></div>
              <div>
                <label style={label}>Proof screenshot (optional)</label>
                <input ref={fileRef} type="file" accept="image/*" onChange={upload} style={{ display: 'none' }} />
                <div onClick={() => fileRef.current?.click()} style={{ ...field, cursor: 'pointer', textAlign: 'center', color: screenshotUrl ? '#00E676' : 'var(--text-secondary)', border: '1px dashed rgba(255,255,255,0.2)' }}>
                  {uploading ? 'Uploading…' : screenshotUrl ? 'Screenshot uploaded — click to change' : 'Click to upload'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <ShieldAlert size={14} color="#FFB300" /> Add a UPI ID, or an account number with IFSC. These details go only to the Raftra review team.
            </div>

            {message && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', fontSize: '12.5px', background: message.ok ? 'rgba(0,230,118,0.08)' : 'rgba(255,71,87,0.08)', border: `1px solid ${message.ok ? 'rgba(0,230,118,0.3)' : 'rgba(255,71,87,0.3)'}`, color: message.ok ? '#00E676' : '#ff6b7a' }}>
                {message.text}
              </div>
            )}

            <GlowButton variant="glow" type="submit" disabled={submitting} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Send size={15} /> {submitting ? 'Sending…' : 'Request payment'}
            </GlowButton>
          </form>
        )}
        {!loading && payables.length === 0 && message && (
          <div style={{ marginTop: '12px', fontSize: '12.5px', color: message.ok ? '#00E676' : '#ff6b7a' }}>{message.text}</div>
        )}
      </div>

      <div className="glow-card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '17px', margin: '0 0 16px 0', color: '#fff' }}>Your requests</h3>
        {payouts.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>No payment requests yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {payouts.map(p => {
              const st = STATUS[p.status] || { label: p.status, color: '#fff' };
              return (
                <div key={p.id} style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{p.context?.title || `Request #${p.id}`}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                      {p.amount != null ? `${inr(p.amount)} · ` : ''}Sent {shortTime(p.created_at)}
                      {p.upi_id ? ` · to ${p.upi_id}` : p.account_number ? ` · to account ${p.account_number}` : ''}
                    </div>
                    {p.admin_note && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px' }}>Note from Raftra: {p.admin_note}</div>}
                    {p.status === 'paid' && p.payout_ref && <div style={{ fontSize: '12px', color: '#00E676', marginTop: '3px' }}>Transfer reference: {p.payout_ref}</div>}
                  </div>
                  <span style={{ alignSelf: 'center', fontSize: '11.5px', fontWeight: 700, color: st.color, border: `1px solid ${st.color}`, borderRadius: '100px', padding: '4px 12px' }}>{st.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
