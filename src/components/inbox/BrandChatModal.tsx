import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, ShieldAlert } from 'lucide-react';
import { GlowButton } from '../GlowButton';
import { ChatThread, inr, parseDealEvent, shortTime, type ChatMessageItem, type DealAction, type DirectDeal } from './ChatThread';
import { useLiveEvents } from '../../hooks/useLiveEvents';
import { contactViolation, policyMessage } from '../../utils/chatPolicy';

/* A brand's conversation with one creator, and the direct deals between them.

   This was a localStorage chat relayed over an unauthenticated room socket. It seeded a reply
   "from the creator" the first time it opened, let the brand press "Accept Deal (as
   Influencer)" on its own screen, and then announced "Payment Complete & Vault Funded" for a
   Razorpay escrow payment that was never taken. Messages are now stored through /api/inbox,
   proposals are real deals the creator answers from their own account, and approving the work
   is the brand's only payment-related step. */

export interface ChatCreator {
  handle: string;
  name: string;
  avatar?: string;
  followers?: string;
}

interface ThreadDetail {
  creator: { handle: string; name: string; influencer_id: number | null; has_account: boolean };
  messages: ChatMessageItem[];
  deals: DirectDeal[];
}

const readJson = async (r: Response) => {
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || `Request failed (${r.status})`);
  return d;
};

const clean = (h: string) => (h || '').replace('@', '').trim().toLowerCase();

export const BrandChatModal: React.FC<{
  workspaceId: number;
  creator: ChatCreator;
  onClose: () => void;
}> = ({ workspaceId, creator, onClose }) => {
  const handle = clean(creator.handle);
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showPropose, setShowPropose] = useState(false);
  const [price, setPrice] = useState('');
  const [deliverables, setDeliverables] = useState('');
  const [proposing, setProposing] = useState(false);
  const [busyDealId, setBusyDealId] = useState<number | null>(null);
  const detailRef = useRef<ThreadDetail | null>(null);
  detailRef.current = detail;

  const base = `/api/inbox/brand/${workspaceId}/creator/${encodeURIComponent(handle)}`;

  const load = useCallback(() => {
    fetch(base).then(readJson).then(d => { setDetail(d); setError(null); }).catch(e => setError(e.message));
  }, [base]);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 20000);
    return () => clearInterval(t);
  }, [load]);

  useLiveEvents(event => {
    if (event.type === 'chat_message' && event.message) {
      const m = event.message as ChatMessageItem;
      const current = detailRef.current;
      if (m.workspace_id !== workspaceId || !current) return;
      if (current.creator.influencer_id && m.influencer_id !== current.creator.influencer_id) return;
      if (!current.creator.influencer_id) { load(); return; }
      setDetail(prev => (prev && !prev.messages.some(x => x.id === m.id) ? { ...prev, messages: [...prev.messages, m] } : prev));
      if (m.sender_type === 'influencer') load(); // marks it read
    } else if (event.type === 'deal_update' && event.deal) {
      if (event.deal.workspace_id === workspaceId && clean(event.deal.influencer_handle) === handle) load();
    }
  });

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    const what = contactViolation(text);
    if (what) { setError(policyMessage(what)); return; }
    setSending(true);
    try {
      const m: ChatMessageItem = await fetch(base, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, creator_name: creator.name }),
      }).then(readJson);
      setInput('');
      setError(null);
      if (detail?.creator.influencer_id) {
        setDetail(prev => (prev && !prev.messages.some(x => x.id === m.id) ? { ...prev, messages: [...prev.messages, m] } : prev));
      } else {
        load(); // first message created the creator's thread
      }
    } catch (err: any) {
      setError(err.message);
    }
    setSending(false);
  };

  const propose = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(price);
    if (!amount || amount <= 0) { setError('Enter the fee you are offering.'); return; }
    if (!deliverables.trim()) { setError('Describe the deliverables you are paying for.'); return; }
    setProposing(true);
    try {
      await fetch('/api/deals/propose', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, influencer_handle: handle, influencer_name: creator.name, amount, deliverables: deliverables.trim() }),
      }).then(readJson);
      setShowPropose(false);
      setPrice('');
      setDeliverables('');
      setError(null);
      load();
    } catch (err: any) {
      setError(err.message);
    }
    setProposing(false);
  };

  const dealAction = async (deal: DirectDeal, action: DealAction) => {
    if (action === 'cancel' && !window.confirm(`Withdraw your ${inr(deal.amount)} proposal to @${handle}?`)) return;
    if (action === 'release' && !window.confirm(
      `Approve the delivered work for ${inr(deal.amount)}?\n\n${deal.deliverables}\n\n` +
      'Only approve once you have received and checked the content. The creator can then request payment from Raftra.')) return;
    setBusyDealId(deal.id);
    try {
      const url = action === 'release' ? `/api/deals/${deal.id}/release` : `/api/deals/${deal.id}/${action}`;
      await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(readJson);
      load();
    } catch (err: any) {
      setError(err.message);
    }
    setBusyDealId(null);
  };

  const hasOpenProposal = (detail?.deals || []).some(d => d.status === 'pending');

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', padding: '20px' }}>
      <div className="glow-card" style={{ width: '850px', maxWidth: '100%', height: '82vh', background: '#08080a', border: '1px solid rgba(90,82,255,0.4)', borderRadius: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
            {creator.avatar ? (
              <img src={creator.avatar} alt="" style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(124,117,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8B85FF', fontWeight: 800 }}>
                {(creator.name || handle || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <h4 style={{ fontSize: '18px', margin: 0, color: '#fff', fontFamily: 'var(--font-heading)' }}>{creator.name || `@${handle}`}</h4>
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                @{handle}{creator.followers ? ` · ${creator.followers} followers` : ''}
                {detail && (detail.creator.has_account
                  ? <span style={{ color: '#00E676' }}> · on Raftra</span>
                  : <span style={{ color: '#FFB300' }}> · not on Raftra yet</span>)}
              </div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontSize: '18px' }}>&times;</button>
        </div>

        {detail && !detail.creator.has_account && (
          <div style={{ background: 'rgba(255,179,0,0.08)', borderBottom: '1px solid rgba(255,179,0,0.25)', padding: '10px 24px', fontSize: '12px', color: 'rgba(255,255,255,0.9)', lineHeight: 1.5 }}>
            @{handle} hasn't joined Raftra yet. Your messages and proposals are saved and appear in their inbox as soon as they sign up and claim this handle.
          </div>
        )}
        <div style={{ background: 'rgba(220,38,38,0.08)', borderBottom: '1px solid rgba(220,38,38,0.25)', padding: '8px 24px', display: 'flex', gap: '8px', alignItems: 'center', fontSize: '11.5px', color: 'rgba(255,255,255,0.85)' }}>
          <ShieldAlert size={14} color="#FFB300" /> Phone numbers, emails, UPI IDs and WhatsApp links are blocked so every agreement stays on record here.
        </div>

        {detail ? (
          <ChatThread
            role="brand"
            messages={detail.messages}
            deals={detail.deals}
            counterpartName={creator.name || `@${handle}`}
            busyDealId={busyDealId}
            onDealAction={dealAction}
            emptyText={`Start the conversation with @${handle}: introduce the campaign, or send a deal proposal with your fee and deliverables.`}
          />
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
            {error || 'Loading conversation…'}
          </div>
        )}

        {detail && error && (
          <div style={{ padding: '8px 24px', fontSize: '12.5px', color: '#ff6b7a', borderTop: '1px solid rgba(255,71,87,0.25)' }}>{error}</div>
        )}

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', background: '#0a0a0d' }}>
          {showPropose ? (
            <form onSubmit={propose} style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(90,82,255,0.08)', border: '1px solid rgba(90,82,255,0.3)', padding: '16px', borderRadius: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)' }}>Send a deal proposal to @{handle}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Fee (₹)</label>
                  <input type="number" min={1} value={price} onChange={e => setPrice(e.target.value)} required placeholder="e.g. 10000"
                    style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--primary)', borderRadius: '8px', color: '#fff', fontSize: '13px', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Deliverables</label>
                  <input type="text" value={deliverables} onChange={e => setDeliverables(e.target.value)} required placeholder="e.g. 1 Instagram Reel + 2 Stories"
                    style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--primary)', borderRadius: '8px', color: '#fff', fontSize: '13px', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowPropose(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
                <GlowButton variant="glow" type="submit" disabled={proposing} style={{ padding: '8px 20px', fontSize: '12.5px' }}>
                  {proposing ? 'Sending…' : 'Send proposal'}
                </GlowButton>
              </div>
            </form>
          ) : (
            <form onSubmit={send} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button type="button" disabled={hasOpenProposal} onClick={() => setShowPropose(true)}
                title={hasOpenProposal ? 'A proposal is already waiting for the creator' : 'Propose a fee and deliverables'}
                style={{ background: 'rgba(90,82,255,0.15)', border: '1px solid rgba(90,82,255,0.4)', borderRadius: '10px', padding: '12px 16px', color: 'var(--primary)', cursor: hasOpenProposal ? 'not-allowed' : 'pointer', opacity: hasOpenProposal ? 0.5 : 1, fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                Propose deal
              </button>
              <input type="text" placeholder={`Message @${handle}…`} value={input} onChange={e => setInput(e.target.value)} maxLength={4000}
                style={{ flex: 1, padding: '12px 18px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '10px', color: '#fff', outline: 'none', fontSize: '13.5px' }} />
              <GlowButton variant="glow" type="submit" disabled={sending || !input.trim()} style={{ padding: '12px 20px' }}>
                <Send size={18} />
              </GlowButton>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

/* The brand's list of conversations. Without it a creator's reply could only be found by
   opening that creator's card again - there was nowhere replies arrived. */
interface BrandThread {
  influencer_id: number;
  handle: string;
  name: string;
  has_account: boolean;
  unread: number;
  last_message: ChatMessageItem | null;
}

export const BrandInboxButton: React.FC<{
  workspaceId: number;
  onOpen: (creator: ChatCreator) => void;
}> = ({ workspaceId, onOpen }) => {
  const [threads, setThreads] = useState<BrandThread[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    if (!workspaceId) return;
    fetch(`/api/inbox/brand/${workspaceId}/threads`).then(readJson)
      .then(d => setThreads(Array.isArray(d) ? d : []))
      .catch(() => { /* keep what is on screen */ });
  }, [workspaceId]);

  useEffect(() => {
    setThreads([]);
    load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 30000);
    return () => clearInterval(t);
  }, [load]);

  useLiveEvents(event => {
    if ((event.type === 'chat_message' && event.message?.workspace_id === workspaceId) ||
        (event.type === 'deal_update' && event.deal?.workspace_id === workspaceId)) load();
  }, Boolean(workspaceId));

  const unread = threads.reduce((s, t) => s + t.unread, 0);

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => { setOpen(o => !o); load(); }}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', background: 'rgba(90,82,255,0.12)', border: '1px solid rgba(90,82,255,0.4)', borderRadius: '100px', color: '#fff', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}>
        <MessageCircle size={15} color="#8B85FF" /> Messages
        {unread > 0 && <span style={{ background: '#00E676', color: '#000', borderRadius: '100px', padding: '1px 8px', fontSize: '11px', fontWeight: 800 }}>{unread}</span>}
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: '340px', maxHeight: '420px', overflowY: 'auto', background: '#0D0D14', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '14px', zIndex: 50, boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}>
          {threads.length === 0 ? (
            <div style={{ padding: '18px', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              No conversations yet. Press Negotiate on a creator to message them.
            </div>
          ) : threads.map(t => {
            const e = t.last_message ? parseDealEvent(t.last_message.content) : null;
            return (
              <div key={t.influencer_id} onClick={() => { setOpen(false); onOpen({ handle: t.handle, name: t.name }); }}
                style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>{t.name} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>@{t.handle}</span></span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{shortTime(t.last_message?.created_at)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                  <span style={{ flex: 1, fontSize: '12px', color: t.unread ? '#fff' : 'var(--text-secondary)', fontWeight: t.unread ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e ? 'Deal update' : `${t.last_message?.sender_type === 'brand' ? 'You: ' : ''}${t.last_message?.content || ''}`}
                  </span>
                  {t.unread > 0 && <span style={{ fontSize: '10px', fontWeight: 800, background: '#00E676', color: '#000', borderRadius: '100px', padding: '1px 7px' }}>{t.unread}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
