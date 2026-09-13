import React, { useCallback, useEffect, useState } from 'react';
import { MessageCircle, Send, ShieldAlert } from 'lucide-react';
import { GlowButton } from '../GlowButton';
import { ChatThread, parseDealEvent, shortTime, inr, type ChatMessageItem, type DealAction, type DirectDeal } from './ChatThread';
import { useLiveEvents } from '../../hooks/useLiveEvents';
import { contactViolation, policyMessage } from '../../utils/chatPolicy';

/* The creator's inbox. It used to open on a scripted "Demo Brand" conversation stored in
   localStorage, with an "Accept Proposal" button that announced "ESCROW LOCKED" - nothing
   was stored, nothing reached a brand, and no escrow exists. Conversations now come from
   /api/inbox, and deal cards act on the real deal. */

interface Thread {
  workspace_id: number;
  brand_name: string;
  brand_logo?: string | null;
  last_message: ChatMessageItem | null;
  unread: number;
  pending_deals: number;
}

interface ThreadDetail {
  brand: { workspace_id: number; name: string; logo?: string | null };
  messages: ChatMessageItem[];
  deals: DirectDeal[];
  can_message: boolean;
}

const readJson = async (r: Response) => {
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || `Request failed (${r.status})`);
  return d;
};

const preview = (t: Thread) => {
  if (!t.last_message) return t.pending_deals ? 'Deal proposal waiting' : 'No messages yet';
  const e = parseDealEvent(t.last_message.content);
  if (e) return `Deal update${e.amount ? ` · ${inr(e.amount)}` : ''}`;
  return `${t.last_message.sender_type === 'influencer' ? 'You: ' : ''}${t.last_message.content}`;
};

const Avatar: React.FC<{ name: string; logo?: string | null; size?: number }> = ({ name, logo, size = 40 }) =>
  logo ? (
    <img src={logo} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: 'rgba(124,117,255,0.15)', border: '1px solid rgba(124,117,255,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8B85FF', fontWeight: 800 }}>
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  );

export const CreatorInbox: React.FC<{
  handle: string;
  onOpenProfileSetup: () => void;
  onRequestPayout: (dealId: number) => void;
}> = ({ handle, onOpenProfileSetup, onRequestPayout }) => {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyDealId, setBusyDealId] = useState<number | null>(null);

  const loadThreads = useCallback(() => {
    fetch('/api/inbox/creator/threads')
      .then(readJson)
      .then(d => {
        const list: Thread[] = Array.isArray(d) ? d : [];
        setThreads(list);
        setSelected(prev => (prev !== null && list.some(t => t.workspace_id === prev) ? prev : list[0]?.workspace_id ?? null));
      })
      .catch(() => { /* keep what is on screen; the next poll retries */ })
      .finally(() => setLoadingThreads(false));
  }, []);

  const loadThread = useCallback((workspaceId: number) => {
    fetch(`/api/inbox/creator/${workspaceId}`)
      .then(readJson)
      .then(d => {
        setDetail(prev => (prev && prev.brand.workspace_id !== workspaceId && selectedRef.current !== workspaceId ? prev : d));
        setError(null);
        loadThreads(); // opening a thread marks it read on the server
      })
      .catch(e => setError(e.message));
  }, [loadThreads]);

  const selectedRef = React.useRef<number | null>(null);
  selectedRef.current = selected;

  useEffect(() => {
    loadThreads();
    const t = setInterval(() => { if (document.visibilityState === 'visible') loadThreads(); }, 20000);
    return () => clearInterval(t);
  }, [loadThreads]);

  useEffect(() => {
    setDetail(null);
    setError(null);
    if (selected === null) return;
    loadThread(selected);
    const t = setInterval(() => { if (document.visibilityState === 'visible') loadThread(selected); }, 20000);
    return () => clearInterval(t);
  }, [selected, loadThread]);

  useLiveEvents(event => {
    if (event.type === 'chat_message' && event.message) {
      const m = event.message as ChatMessageItem;
      if (m.workspace_id === selectedRef.current) {
        setDetail(prev => (prev && !prev.messages.some(x => x.id === m.id) ? { ...prev, messages: [...prev.messages, m] } : prev));
        if (m.sender_type !== 'influencer') loadThread(m.workspace_id);
      } else {
        loadThreads();
      }
    } else if (event.type === 'deal_update' && event.deal) {
      if (event.deal.workspace_id === selectedRef.current) loadThread(event.deal.workspace_id);
      else loadThreads();
    }
  }, Boolean(handle));

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || selected === null) return;
    const what = contactViolation(text);
    if (what) { setError(policyMessage(what)); return; }
    setSending(true);
    try {
      const m: ChatMessageItem = await fetch(`/api/inbox/creator/${selected}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: text }),
      }).then(readJson);
      setInput('');
      setError(null);
      setDetail(prev => (prev && !prev.messages.some(x => x.id === m.id) ? { ...prev, messages: [...prev.messages, m] } : prev));
      loadThreads();
    } catch (err: any) {
      setError(err.message);
    }
    setSending(false);
  };

  const dealAction = async (deal: DirectDeal, action: DealAction) => {
    if (action === 'accept' && !window.confirm(`Accept ${inr(deal.amount)} from ${deal.brand_name} for:\n\n${deal.deliverables}\n\nThe brand is notified and expects you to deliver.`)) return;
    if (action === 'decline' && !window.confirm(`Decline ${deal.brand_name}'s proposal of ${inr(deal.amount)}?`)) return;
    setBusyDealId(deal.id);
    try {
      await fetch(`/api/deals/${deal.id}/${action}`, { method: 'POST' }).then(readJson);
      if (selected !== null) loadThread(selected);
    } catch (err: any) {
      setError(err.message);
    }
    setBusyDealId(null);
  };

  if (!handle) {
    return (
      <div className="glow-card" style={{ padding: '32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        <MessageCircle size={28} color="#8B85FF" />
        <h3 style={{ margin: 0, color: '#fff' }}>Add your Instagram handle to use your inbox</h3>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '460px', lineHeight: 1.6 }}>
          Brands find and message creators by handle. Save yours in Profile Setup and any conversations or proposals already sent to it appear here.
        </p>
        <GlowButton variant="glow" onClick={onOpenProfileSetup}>Go to Profile Setup</GlowButton>
      </div>
    );
  }

  const active = threads.find(t => t.workspace_id === selected) || null;

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 120px)', display: 'flex', background: '#0a0a0d', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
      <div style={{ width: '320px', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.01)' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '16px', margin: 0, color: '#fff', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MessageCircle size={18} color="#00E676" /> Brand conversations
          </h3>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingThreads ? (
            <div style={{ padding: '20px', color: 'var(--text-secondary)', fontSize: '13px' }}>Loading conversations…</div>
          ) : threads.length === 0 ? (
            <div style={{ padding: '20px', color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6 }}>
              No brand conversations yet. Brands message you from the Creator Marketplace, and brands whose briefs you apply to appear here so you can reach them.
            </div>
          ) : threads.map(t => {
            const isSelected = t.workspace_id === selected;
            return (
              <div key={t.workspace_id} onClick={() => setSelected(t.workspace_id)}
                style={{ padding: '14px 18px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.03)', background: isSelected ? 'rgba(90,82,255,0.15)' : 'transparent', borderLeft: isSelected ? '3px solid var(--primary)' : '3px solid transparent', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Avatar name={t.brand_name} logo={t.brand_logo} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.brand_name}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>{shortTime(t.last_message?.created_at)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', color: t.unread ? '#fff' : 'var(--text-secondary)', fontWeight: t.unread ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{preview(t)}</span>
                    {t.unread > 0 && <span style={{ fontSize: '10px', fontWeight: 800, background: '#00E676', color: '#000', borderRadius: '100px', padding: '1px 7px' }}>{t.unread}</span>}
                    {t.pending_deals > 0 && <span style={{ fontSize: '10px', fontWeight: 800, background: 'rgba(255,179,0,0.2)', color: '#FFB300', borderRadius: '100px', padding: '1px 7px' }}>Deal</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#08080a', minWidth: 0 }}>
        {!active ? (
          <div style={{ margin: 'auto', color: 'var(--text-secondary)', fontSize: '13px' }}>Select a conversation.</div>
        ) : (
          <>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.02)' }}>
              <Avatar name={active.brand_name} logo={active.brand_logo} size={36} />
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>{active.brand_name}</div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>Brand on Raftra · messaging as @{handle}</div>
              </div>
            </div>

            <div style={{ background: 'rgba(255,179,0,0.08)', borderBottom: '1px solid rgba(255,179,0,0.25)', padding: '8px 20px', display: 'flex', gap: '8px', alignItems: 'center', fontSize: '11.5px', color: 'rgba(255,255,255,0.85)' }}>
              <ShieldAlert size={14} color="#FFB300" /> Phone numbers, emails, UPI IDs and WhatsApp links are blocked so every agreement stays on record here.
            </div>

            {detail ? (
              <ChatThread
                role="creator"
                messages={detail.messages}
                deals={detail.deals}
                counterpartName={detail.brand.name}
                busyDealId={busyDealId}
                onDealAction={dealAction}
                onRequestPayout={d => onRequestPayout(d.id)}
                emptyText={`No messages with ${detail.brand.name} yet. Say hello, or ask about their brief.`}
              />
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                {error || 'Loading conversation…'}
              </div>
            )}

            {detail && error && (
              <div style={{ padding: '8px 20px', fontSize: '12.5px', color: '#ff6b7a', borderTop: '1px solid rgba(255,71,87,0.25)' }}>{error}</div>
            )}

            <form onSubmit={send} style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', background: '#0a0a0d', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <input
                type="text"
                placeholder={`Message ${active.brand_name}…`}
                value={input}
                onChange={e => setInput(e.target.value)}
                maxLength={4000}
                style={{ flex: 1, padding: '12px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '24px', color: '#fff', outline: 'none', fontSize: '13px' }}
              />
              <GlowButton variant="glow" type="submit" disabled={sending || !input.trim()} style={{ borderRadius: '50%', width: '42px', height: '42px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Send size={16} />
              </GlowButton>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
