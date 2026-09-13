import React, { useEffect, useRef } from 'react';
import { GlowButton } from '../GlowButton';

/* One conversation between a brand and a creator, rendered the same way on both sides:
   text messages, plus a card for each direct deal that updates with the deal's real status.
   Deal changes arrive as system messages ({"type":"deal_event"}) written by the server, so the
   thread is the single record of what was proposed, accepted, approved and paid. */

export interface ChatMessageItem {
  id: number;
  workspace_id: number;
  workspace_name?: string | null;
  influencer_id: number;
  sender_type: 'brand' | 'influencer' | 'system';
  content: string;
  created_at: string | null;
  read_at?: string | null;
}

export interface DirectDeal {
  id: number;
  workspace_id: number;
  brand_name: string;
  influencer_handle: string;
  influencer_name?: string | null;
  amount: number;
  deliverables: string;
  status: string;
  created_at?: string | null;
  brand_released_at?: string | null;
  paid_at?: string | null;
  verification_token?: string | null;
}

export type DealAction = 'accept' | 'decline' | 'cancel' | 'release';

export const inr = (n?: number | null) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

// The backend sends naive UTC timestamps; without a zone suffix the browser reads them as local.
export const toUtcDate = (value?: string | null) => {
  if (!value) return null;
  const d = new Date(/Z$|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const shortTime = (value?: string | null) => {
  const d = toUtcDate(value);
  if (!d) return '';
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { day: '2-digit', month: 'short' });
};

export const parseDealEvent = (content: string): { event: string; deal_id: number; amount?: number } | null => {
  try {
    const d = JSON.parse(content);
    return d && d.type === 'deal_event' ? d : null;
  } catch {
    return null;
  }
};

export const DEAL_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Waiting for the creator', color: '#FFB300' },
  active: { label: 'Accepted — work in progress', color: '#8B85FF' },
  delivered: { label: 'Work approved — payment can be requested', color: '#00C4CC' },
  paid: { label: 'Paid', color: '#00E676' },
  declined: { label: 'Declined by the creator', color: '#FF6B7A' },
  cancelled: { label: 'Withdrawn by the brand', color: 'var(--text-muted)' },
};

const EVENT_LABEL: Record<string, string> = {
  proposed: 'Deal proposed',
  accepted: 'Deal accepted',
  declined: 'Deal declined',
  cancelled: 'Proposal withdrawn',
  approved: 'Work approved',
  paid: 'Payment sent',
};

export const DealCard: React.FC<{
  deal: DirectDeal;
  role: 'brand' | 'creator';
  busy?: boolean;
  onAction?: (deal: DirectDeal, action: DealAction) => void;
  onRequestPayout?: (deal: DirectDeal) => void;
}> = ({ deal, role, busy, onAction, onRequestPayout }) => {
  const st = DEAL_STATUS[deal.status] || { label: deal.status, color: '#fff' };
  const btn = { flex: 1, padding: '10px', fontSize: '13px', fontWeight: 700 } as const;
  return (
    <div style={{ width: '100%', maxWidth: '480px', background: 'linear-gradient(135deg, rgba(90,82,255,0.12), rgba(120,50,255,0.08))', border: `1px solid ${st.color}`, padding: '18px', borderRadius: '14px', textAlign: 'center' }}>
      <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
        Direct deal #{deal.id} · {role === 'brand' ? `with @${deal.influencer_handle}` : deal.brand_name}
      </div>
      <div style={{ fontSize: '28px', fontWeight: 800, color: '#fff' }}>{inr(deal.amount)}</div>
      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', margin: '6px 0 12px' }}>{deal.deliverables}</div>
      <span style={{ display: 'inline-block', fontSize: '11.5px', fontWeight: 700, color: st.color, border: `1px solid ${st.color}`, borderRadius: '100px', padding: '3px 12px' }}>
        {st.label}
      </span>

      {deal.verification_token && (
        <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          Verification code: <code style={{ color: '#00E676', fontWeight: 700 }}>{deal.verification_token}</code>
        </div>
      )}

      {role === 'creator' && deal.status === 'pending' && onAction && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
          <GlowButton variant="glow" disabled={busy} onClick={() => onAction(deal, 'accept')} style={btn}>Accept deal</GlowButton>
          <GlowButton variant="secondary" disabled={busy} onClick={() => onAction(deal, 'decline')} style={btn}>Decline</GlowButton>
        </div>
      )}
      {role === 'brand' && deal.status === 'pending' && onAction && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
          <GlowButton variant="secondary" disabled={busy} onClick={() => onAction(deal, 'cancel')} style={btn}>Withdraw proposal</GlowButton>
        </div>
      )}
      {role === 'brand' && deal.status === 'active' && onAction && (
        <div style={{ marginTop: '14px' }}>
          <GlowButton variant="glow" disabled={busy} onClick={() => onAction(deal, 'release')} style={{ ...btn, width: '100%' }}>
            Approve delivered work
          </GlowButton>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
            Approve once you have received and checked the content. The creator can then request payment.
          </div>
        </div>
      )}
      {role === 'creator' && deal.status === 'active' && (
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '12px' }}>
          Share the content with the brand here. Once they approve it, you can request payment.
        </div>
      )}
      {role === 'creator' && deal.status === 'delivered' && onRequestPayout && (
        <GlowButton variant="glow" onClick={() => onRequestPayout(deal)} style={{ ...btn, width: '100%', marginTop: '14px' }}>
          Request payment
        </GlowButton>
      )}
    </div>
  );
};

export const ChatThread: React.FC<{
  role: 'brand' | 'creator';
  messages: ChatMessageItem[];
  deals: DirectDeal[];
  counterpartName: string;
  busyDealId?: number | null;
  onDealAction?: (deal: DirectDeal, action: DealAction) => void;
  onRequestPayout?: (deal: DirectDeal) => void;
  emptyText?: string;
}> = ({ role, messages, deals, counterpartName, busyDealId, onDealAction, onRequestPayout, emptyText }) => {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const dealsById = new Map(deals.map(d => [d.id, d]));
  // Only the latest event for a deal carries the full, actionable card; earlier events are a line.
  const lastEventIndex = new Map<number, number>();
  messages.forEach((m, i) => {
    if (m.sender_type !== 'system') return;
    const e = parseDealEvent(m.content);
    if (e?.deal_id) lastEventIndex.set(e.deal_id, i);
  });
  const dealsWithoutEvents = deals.filter(d => !lastEventIndex.has(d.id));

  const card = (deal: DirectDeal) => (
    <DealCard deal={deal} role={role} busy={busyDealId === deal.id} onAction={onDealAction} onRequestPayout={onRequestPayout} />
  );

  return (
    <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {dealsWithoutEvents.map(d => (
        <div key={`deal-${d.id}`} style={{ alignSelf: 'center', width: '100%', display: 'flex', justifyContent: 'center' }}>{card(d)}</div>
      ))}

      {messages.length === 0 && dealsWithoutEvents.length === 0 && (
        <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '360px', lineHeight: 1.6 }}>
          {emptyText || 'No messages yet.'}
        </div>
      )}

      {messages.map((m, i) => {
        if (m.sender_type === 'system') {
          const e = parseDealEvent(m.content);
          const deal = e ? dealsById.get(e.deal_id) : undefined;
          return (
            <div key={m.id} style={{ alignSelf: 'center', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', padding: '4px 12px', borderRadius: '14px' }}>
                {e ? `${EVENT_LABEL[e.event] || e.event}${e.amount ? ` · ${inr(e.amount)}` : ''}` : m.content} · {shortTime(m.created_at)}
              </span>
              {e && deal && lastEventIndex.get(e.deal_id) === i && card(deal)}
            </div>
          );
        }
        const mine = role === 'brand' ? m.sender_type === 'brand' : m.sender_type === 'influencer';
        return (
          <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '72%' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', textAlign: mine ? 'right' : 'left' }}>
              {mine ? 'You' : counterpartName} · {shortTime(m.created_at)}
            </div>
            <div style={{
              background: mine ? 'linear-gradient(135deg, #5A52FF, #7832FF)' : 'rgba(255,255,255,0.06)',
              padding: '11px 15px', borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              color: '#fff', fontSize: '13.5px', lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {m.content}
            </div>
            {mine && (
              <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '3px', textAlign: 'right' }}>
                {m.read_at ? 'Seen' : 'Sent'}
              </div>
            )}
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
};
