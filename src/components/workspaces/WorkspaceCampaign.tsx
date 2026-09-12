import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles, Check, CheckCircle2, Clock, AlertTriangle, Rocket, Activity,
  Image as ImageIcon, ShieldCheck, RefreshCw, XCircle,
  OctagonX, ArrowRight, FileUp, Download, Copy, Database, Upload,
  TrendingUp, ShoppingCart, GitBranch, BarChart3, ChevronDown, X, Maximize2,
  ExternalLink,
} from 'lucide-react';
import { CampaignService } from '../../services/campaigns';

export interface CampaignItem {
  id: string; platform: string; name: string; objective: string;
  budget: number; roas: number; status: 'active' | 'paused' | 'pending_review';
}

interface WorkspaceCampaignProps {
  workspaceId?: number | null;
  campaigns?: CampaignItem[];
  creativeAssets?: any[];
  onOpenReview?: (itemId: string) => void;
  onToggleStatus?: (id: string) => void;
  // Jump to Creative Studio seeded with a prompt. BrandDashboard already supplies this, but
  // no control in this component calls it yet — declared so the parent wiring type-checks
  // and stays intact for whoever adds the trigger.
  onOpenCreativeStudio?: (seed: string) => void;
}

const authHeaders = (): Record<string, string> => {
  const t = localStorage.getItem('token');
  return t ? { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` } : { 'Content-Type': 'application/json' };
};
const money = (v: any) => `₹${Number(v || 0).toLocaleString('en-IN')}`;
const ago = (ts: number) => {
  const m = Math.floor((Date.now() - ts) / 60000);
  return m < 1 ? 'just now' : m === 1 ? '1 min ago' : `${m} mins ago`;
};

// ── shared styles ────────────────────────────────────────────────────────────
// Type scale for this workspace.
//
// This screen had drifted to 14 distinct font sizes across 154 declarations — 8.5, 9.5,
// 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 17, 18, 22. Eight of them sat within 4px of
// each other, which reads as noise rather than hierarchy: nothing looked deliberately
// larger than anything else, so the eye had no order to follow. Collapsed to seven steps
// with real gaps between them. Use these rather than a raw px value.
const T = {
  micro: '10px',   // dense numeric annotations
  badge: '11px',   // uppercase pills and status labels
  body: '12px',    // default in-card text
  read: '13px',    // longer prose, descriptions, values worth reading
  lead: '14px',    // emphasis inside a card
  title: '17px',   // section headings
  page: '22px',    // the workspace title (one per screen)
} as const;

// Shared tokens for this workspace. Aligned with the SEO/GEO + Creative Studio treatment:
// slightly brighter borders, larger radii, and a readable type scale.
const card: React.CSSProperties = {
  background: 'var(--surface, rgba(255,255,255,0.03))',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: '16px', padding: '26px',
};
// Anchored dropdown panel.
//
// These pickers used to be `position: absolute` inside the header. That makes them
// descendants of <main class="dashboard-main">, which is `overflow: auto` — and an
// overflow ancestor clips absolutely positioned descendants. The Meta panel is ~341px
// tall and opens ~230px down the viewport, so its bottom was being cut off.
//
// Fixed positioning is resolved against the viewport rather than the scroll container,
// so it escapes that clip (no ancestor here establishes a fixed containing block via
// transform/filter/will-change). On top of that we clamp to the viewport, flip above the
// trigger when there isn't room below, and give the panel its own scrollbar so it can
// never be cut off no matter how long the account list is.
const AnchoredPanel: React.FC<{
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  width?: number;
  children: React.ReactNode;
}> = ({ anchorRef, onClose, width = 320, children }) => {
  const MARGIN = 12;
  const [pos, setPos] = useState<{ left: number; top: number; maxH: number } | null>(null);

  React.useLayoutEffect(() => {
    const place = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const below = window.innerHeight - r.bottom - MARGIN - 8;
      const above = r.top - MARGIN - 8;
      // Only flip up when below is genuinely cramped and above is roomier.
      const openUp = below < 240 && above > below;
      const maxH = Math.max(160, openUp ? above : below);
      const w = Math.min(width, window.innerWidth - MARGIN * 2);
      // Right-align to the trigger, then keep it inside the viewport horizontally.
      const left = Math.min(Math.max(MARGIN, r.right - w), window.innerWidth - w - MARGIN);
      const top = openUp ? Math.max(MARGIN, r.top - 8 - maxH) : r.bottom + 8;
      setPos({ left, top, maxH });
    };
    place();
    window.addEventListener('resize', place);
    // capture:true so it also tracks scrolling of .dashboard-main, not just the window.
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchorRef, width]);

  /* 900/901, not 40/50.
     The panel is position:fixed and correctly placed, but it was painting UNDERNEATH the
     dashboard chrome: .sidebar and .dashboard-header are both z-index 100 (App.css), so as
     soon as the dropdown extended over either one it was covered — which looks exactly like
     the panel being cut off. 900/901 is the tier this app already uses for its other
     dropdowns (the profile and notification menus in BrandDashboard), so it clears the
     sidebar and header while still sitting below full-screen modals at 1000. */
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 900 }} />
      <div style={{
        position: 'fixed',
        left: pos ? `${pos.left}px` : '-9999px',
        top: pos ? `${pos.top}px` : '-9999px',
        width: `${Math.min(width, typeof window !== 'undefined' ? window.innerWidth - MARGIN * 2 : width)}px`,
        maxHeight: pos ? `${pos.maxH}px` : undefined,
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        zIndex: 901,
        background: '#14161e',
        border: '1px solid var(--border, var(--border-color))',
        borderRadius: '10px',
        padding: '14px',
        boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
        // Hidden for the first paint only, so it never flashes at the fallback offset.
        visibility: pos ? 'visible' : 'hidden',
      }}>
        {children}
      </div>
    </>
  );
};

const sectionTitle: React.CSSProperties = { fontSize: T.title, fontWeight: 700, color: '#fff', marginBottom: '6px', lineHeight: 1.25 };
const sectionHint: React.CSSProperties = { fontSize: T.read, color: 'var(--text-secondary)', lineHeight: 1.55 };
const label: React.CSSProperties = { fontSize: T.read, color: 'var(--text-secondary)', display: 'block', marginBottom: '7px', fontWeight: 500 };
const input: React.CSSProperties = {
  width: '100%', padding: '11px 14px', background: 'rgba(0,0,0,0.25)',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px',
  color: '#fff', fontSize: T.lead, outline: 'none',
  fontFamily: 'inherit', transition: 'border-color 0.2s ease',
};
// Layout only. The brushed-metal face and its hover light-sweep come from
// `.btn.btn-primary` in index.css — inline styles cannot express :hover, and every button
// using this also carries that className.
const btnPrimary: React.CSSProperties = {
  padding: '12px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
};
// How many creatives the gallery shows before "Show all" is offered.
const GALLERY_PREVIEW_COUNT = 8;
const btnGhost: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border, var(--border-color))', color: '#fff',
  padding: '10px 14px', borderRadius: '9px', fontSize: '13px', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
};

// `label` is optional: it only changes the text, never the colour, so a caller can say
// "Google: REAL" while still being coloured by the underlying status.
const Pill: React.FC<{ status: string; label?: string }> = ({ status, label }) => {
  const map: Record<string, { c: string; b: string }> = {
    Completed: { c: '#00e676', b: 'rgba(0,230,118,0.12)' },
    Approved: { c: '#00e676', b: 'rgba(0,230,118,0.12)' },
    Published: { c: '#00e676', b: 'rgba(0,230,118,0.12)' },
    Generated: { c: '#5a8dff', b: 'rgba(90,141,255,0.14)' },
    'In Progress': { c: '#5a8dff', b: 'rgba(90,141,255,0.14)' },
    Ready: { c: '#00e676', b: 'rgba(0,230,118,0.12)' },
    Configured: { c: '#5a8dff', b: 'rgba(90,141,255,0.14)' },
    'Needs approval': { c: '#ffae00', b: 'rgba(255,174,0,0.14)' },
    Locked: { c: 'var(--text-secondary)', b: 'rgba(255,255,255,0.06)' },
    Pending: { c: 'var(--text-secondary)', b: 'rgba(255,255,255,0.06)' },
    Blocked: { c: '#ff4757', b: 'rgba(255,71,87,0.14)' },
    MOCK: { c: '#ffae00', b: 'rgba(255,174,0,0.14)' },
    DEMO: { c: '#ffae00', b: 'rgba(255,174,0,0.14)' },
    REAL: { c: '#00e676', b: 'rgba(0,230,118,0.12)' },
    SAMPLE: { c: '#ffae00', b: 'rgba(255,174,0,0.14)' },
    LIVE: { c: '#00e676', b: 'rgba(0,230,118,0.12)' },
  };
  const s = map[status] || map.Pending;
  return <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.4px', color: s.c, background: s.b, border: `1px solid ${s.c}33`, borderRadius: '20px', padding: '3px 10px', whiteSpace: 'nowrap' }}>{label ?? status}</span>;
};

// Short values sit on one line (label left, value right). Long values — audience, placements —
// stack instead: right-aligned sentences that wrap are the thing that reads as "all over the place".
const Row: React.FC<{ k: string; v: React.ReactNode; stack?: boolean }> = ({ k, v, stack }) => (
  // Label is small-caps and muted; the value is the loud part. Previously both sat at a
  // similar weight and size, so a long strategy read as an undifferentiated wall.
  stack ? (
    <div style={{ padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>{k}</div>
      <div style={{ fontSize: '14px', color: '#fff', lineHeight: 1.6, wordBreak: 'break-word' }}>{v}</div>
    </div>
  ) : (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '16px', padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.07)', fontSize: '14px' }}>
      <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>{k}</span>
      <span style={{ color: '#fff', fontWeight: 500, textAlign: 'right', lineHeight: 1.5, minWidth: 0, wordBreak: 'break-word' }}>{v}</span>
    </div>
  )
);

// Budget split as a proportional bar rather than two "60% · ₹24,000" text rows.
// The split is the one number a reader wants at a glance, and a bar answers it without
// them having to compare two strings.
const SplitBar: React.FC<{ meta?: { pct: number; amount: number }; google?: { pct: number; amount: number }; fmt: (n: any) => string }> = ({ meta, google, fmt }) => {
  if (!meta && !google) return null;
  const legs = [
    meta && { key: 'Meta', pct: meta.pct, amount: meta.amount, color: 'var(--accent)', rgb: '90,82,255' },
    google && { key: 'Google', pct: google.pct, amount: google.amount, color: 'var(--success)', rgb: '0,255,157' },
  ].filter(Boolean) as { key: string; pct: number; amount: number; color: string; rgb: string }[];
  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '9px' }}>
        Budget split
      </div>
      <div style={{ display: 'flex', height: '8px', borderRadius: '99px', overflow: 'hidden', background: 'rgba(255,255,255,0.06)', marginBottom: '9px' }}>
        {legs.map(l => <div key={l.key} style={{ width: `${l.pct}%`, background: l.color, transition: 'width .4s cubic-bezier(0.16,1,0.3,1)' }} />)}
      </div>
      <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
        {legs.map(l => (
          <span key={l.key} style={{ display: 'inline-flex', alignItems: 'baseline', gap: '7px', fontSize: '13px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: l.color, alignSelf: 'center', flexShrink: 0 }} />
            <span style={{ color: 'var(--text-secondary)' }}>{l.key}</span>
            <b style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>{fmt(l.amount)}</b>
            <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{l.pct}%</span>
          </span>
        ))}
      </div>
    </div>
  );
};

// A success target arrives as one string — "Cost Per Acquisition (CPA) < ₹500". Rendered
// whole it is an unreadable run of words; split at the comparison operator the metric
// becomes a label and the threshold becomes a value, so a column of them can be scanned.
const KpiRow: React.FC<{ text: string }> = ({ text }) => {
  const m = text.match(/^(.*?)\s*([<>=≤≥]+)\s*(.+)$/);
  const name = m ? m[1].trim() : text;
  const target = m ? `${m[2]} ${m[3]}`.trim() : null;
  // "(CPA)" etc. is the useful short form — promote it and drop it from the long name.
  const abbr = name.match(/\(([A-Z]{2,6})\)/);
  const label = abbr ? name.replace(/\s*\([A-Z]{2,6}\)\s*/, ' ').trim() : name;
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '7px', minWidth: 0 }}>
        <CheckCircle2 size={12} style={{ color: 'var(--success)', flexShrink: 0, alignSelf: 'center' }} />
        {abbr && (
          <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--success)', background: 'var(--success-glow)', border: '1px solid rgba(0,255,157,0.25)', borderRadius: '4px', padding: '1px 5px', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>{abbr[1]}</span>
        )}
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', minWidth: 0 }}>{label}</span>
      </span>
      {/* Short numeric targets read best on one line; a long one ("> 2.0x (if purchase
          value is tracked)") must be allowed to wrap or it overflows the row. */}
      {target && (
        <b style={{
          fontSize: '13px', color: '#fff', fontFamily: 'var(--font-mono)', textAlign: 'right',
          whiteSpace: target.length <= 12 ? 'nowrap' : 'normal',
          flexShrink: target.length <= 12 ? 0 : 1,
          lineHeight: 1.45,
        }}>{target}</b>
      )}
    </div>
  );
};

// Headline/description list with a working expander.
//
// "+2 more descriptions" used to be a plain <span> — it read as a control but had no
// handler, so clicking it did nothing and the remaining copy was unreachable. It is now a
// button that expands the full list.
//
// Over-limit copy is also called out properly: a description at 97/90 is rejected by the
// platform at publish time, so it is counted in the header rather than only tinting one
// number red halfway down a collapsed list.
const CopyList: React.FC<{ items: string[]; limit: number; noun: string; preview: number }> = ({ items, limit, noun, preview }) => {
  const [open, setOpen] = useState(false);
  if (!items.length) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  const over = items.filter(t => t.length > limit).length;
  const shown = open ? items : items.slice(0, preview);
  return (
    <span style={{ display: 'block' }}>
      {over > 0 && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '7px', fontSize: '11px', fontWeight: 700, color: 'var(--warning)', background: 'var(--warning-glow)', border: '1px solid rgba(255,174,0,0.35)', borderRadius: '6px', padding: '3px 9px' }}>
          <AlertTriangle size={12} /> {over} over {limit} characters — will be rejected
        </span>
      )}
      {shown.map((t, i) => {
        const bad = t.length > limit;
        return (
          <span key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '4px 0', fontSize: '13px' }}>
            <span style={{ color: bad ? 'var(--danger)' : undefined }}>{t}</span>
            <span style={{ color: bad ? 'var(--danger)' : 'var(--text-secondary)', fontSize: '11px', flexShrink: 0, fontFamily: 'var(--font-mono)', fontWeight: bad ? 700 : 400 }}>{t.length}/{limit}</span>
          </span>
        );
      })}
      {items.length > preview && (
        <button
          onClick={() => setOpen(o => !o)}
          style={{ marginTop: '4px', fontSize: '11px', fontWeight: 600, color: 'var(--accent)', background: 'transparent', border: 'none', padding: '2px 0', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          {open ? `Show fewer ${noun}` : `+${items.length - preview} more ${noun}`}
        </button>
      )}
    </span>
  );
};

// The audience is the longest field the AI produces — several sentences of targeting
// prose. Rendered as a plain row it swamps whatever sits around it, so it gets its own
// contained treatment: accent rule, secondary text, and a height cap with its own scroll
// so one verbose paragraph can never dominate a card. Shared by the strategy panel and
// both platform review cards so they read identically.
const AudienceBlock: React.FC<{ text?: string; maxHeight?: number }> = ({ text, maxHeight = 132 }) => (
  <div style={{
    marginTop: '14px', padding: '14px 16px', background: 'rgba(255,255,255,0.03)',
    borderRadius: '10px', border: '1px solid var(--border, var(--border-color))',
    borderLeft: '2px solid var(--accent)',
  }}>
    <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
      Who this campaign targets
    </div>
    <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.65, maxHeight: `${maxHeight}px`, overflowY: 'auto' }}>
      {text || <span style={{ color: 'var(--text-muted)' }}>—</span>}
    </div>
  </div>
);

// Chip list with a working expander. The previous inline helper capped at 6 and rendered
// "+N more" as a plain <span> — the same dead control as the copy lists, so the remaining
// keywords and extensions could not be seen at all.
const ChipList: React.FC<{ items: any[]; preview?: number }> = ({ items, preview = 6 }) => {
  const [open, setOpen] = useState(false);
  if (!items || !items.length) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  const shown = open ? items : items.slice(0, preview);
  return (
    <span style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
      {shown.map((x: any, i: number) => (
        <span key={i} style={{ fontSize: '11px', color: '#8B85FF', background: 'rgba(90,82,255,0.12)', border: '1px solid rgba(90,82,255,0.25)', borderRadius: '6px', padding: '3px 9px' }}>{String(x)}</span>
      ))}
      {items.length > preview && (
        <button
          onClick={() => setOpen(o => !o)}
          style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent)', background: 'transparent', border: 'none', padding: '3px 2px', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          {open ? 'Show fewer' : `+${items.length - preview} more`}
        </button>
      )}
    </span>
  );
};

// A single copy field with its platform character limit, styled to match CopyList so the
// Meta and Google review cards read the same way. Meta's copy is a few single strings
// (primary text / headline / CTA) rather than the arrays Google uses.
const CopyField: React.FC<{ label: string; value?: string; limit?: number }> = ({ label, value, limit }) => {
  const text = (value || '').trim();
  const bad = !!(limit && text.length > limit);
  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px', marginBottom: '4px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</span>
        {limit && text && (
          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', flexShrink: 0, fontWeight: bad ? 700 : 400, color: bad ? 'var(--danger)' : 'var(--text-secondary)' }}>
            {text.length}/{limit}
          </span>
        )}
      </div>
      <div style={{ fontSize: '13px', lineHeight: 1.55, color: text ? (bad ? 'var(--danger)' : '#fff') : 'var(--text-muted)' }}>
        {text || '—'}
      </div>
    </div>
  );
};

// ── Ad previews ──────────────────────────────────────────────────────────────
// A review screen should show what will actually run. Both cards previously listed the
// copy as label/value rows, which tells you the strings but not the ad — you could not
// tell whether a headline was truncated, whether the creative and copy worked together,
// or what a searcher would see. These render the copy in the shape of the real placement.

const MetaAdPreview: React.FC<{ image?: string; pageName?: string; primary?: string; headline?: string; cta?: string; url?: string }> = ({ image, pageName, primary, headline, cta, url }) => (
  <div style={{ border: '1px solid var(--border-hover)', borderRadius: '12px', overflow: 'hidden', background: '#101014' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '11px 13px' }}>
      <span style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg,#5a52ff,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, color: '#fff', flexShrink: 0 }}>
        {(pageName || 'R').charAt(0).toUpperCase()}
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pageName || 'Your Page'}</span>
        <span style={{ display: 'block', fontSize: '10.5px', color: 'var(--text-muted)' }}>Sponsored · <span style={{ opacity: 0.8 }}>◎</span></span>
      </span>
    </div>
    {primary && (
      <div style={{ padding: '0 13px 10px', fontSize: '12.5px', color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{primary}</div>
    )}
    {image
      ? <img src={image} alt="" style={{ display: 'block', width: '100%', aspectRatio: '1.91 / 1', objectFit: 'cover' }} />
      : <div style={{ width: '100%', aspectRatio: '1.91 / 1', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>No creative selected</div>}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '11px 13px', background: 'rgba(255,255,255,0.03)' }}>
      <span style={{ minWidth: 0 }}>
        {/* Meta's link ads show the destination domain above the headline, same as the
            real placement — it was missing here while Google's preview had one. */}
        <span style={{ display: 'block', fontSize: '10.5px', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {displayHost(url)}
        </span>
        <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#fff', lineHeight: 1.35, marginTop: '2px' }}>{headline || 'Your headline'}</span>
      </span>
      <span style={{ flexShrink: 0, fontSize: '11.5px', fontWeight: 600, color: '#fff', background: 'rgba(255,255,255,0.10)', border: '1px solid var(--border-hover)', borderRadius: '7px', padding: '7px 13px', whiteSpace: 'nowrap' }}>
        {cta || 'Learn More'}
      </span>
    </div>
  </div>
);

// A landing page must actually look like one. `form.tracking` holds a UTM string
// ("utm_source=ai_agent"), and feeding that to new URL() yields it as the "hostname" —
// which is how the preview came to display `Ad · utm_source=ai_agent`.
const displayHost = (url?: string, fallback = 'yoursite.com') => {
  const u = (url || '').trim();
  if (!u || /[=&\s]/.test(u)) return fallback;          // query fragments are not URLs
  if (!/^https?:\/\//i.test(u) && !/\.[a-z]{2,}/i.test(u)) return fallback;  // needs a TLD
  try {
    return new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, '') || fallback;
  } catch {
    return fallback;
  }
};

const GoogleAdPreview: React.FC<{ url?: string; headlines: string[]; descriptions: string[] }> = ({ url, headlines, descriptions }) => {
  const host = displayHost(url);
  return (
    <div style={{ border: '1px solid var(--border-hover)', borderRadius: '12px', padding: '14px 16px', background: '#101014' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '3px' }}>
        <span style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text-primary)', border: '1px solid var(--border-hover)', borderRadius: '4px', padding: '0 5px' }}>Ad</span>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>·</span>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{host}</span>
      </div>
      {/* Google joins up to three headlines with pipes — showing them separately hid how
          long the rendered title actually is. */}
      <div style={{ fontSize: '16px', lineHeight: 1.35, color: '#8ab4f8', marginBottom: '4px' }}>
        {headlines.slice(0, 3).join(' | ') || 'Your headline'}
      </div>
      <div style={{ fontSize: '12.5px', lineHeight: 1.55, color: 'var(--text-secondary)' }}>
        {descriptions.slice(0, 2).join(' ') || 'Your description text appears here.'}
      </div>
    </div>
  );
};

// "Switch it on in Meta Ads Manager" is only actionable if you know what that is and how
// to get there. The backend already returns a deep link to the created campaign
// (campaign_urls) and we know the ad account before publishing — so the instruction
// becomes a link the user can just click.
const ExtLink: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => (
  <a href={href} target="_blank" rel="noreferrer"
    style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
    {children} <ExternalLink size={11} style={{ display: 'inline', verticalAlign: '-1px' }} />
  </a>
);

const metaAdsManagerUrl = (adAccountId?: string | null) =>
  adAccountId
    ? `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${String(adAccountId).replace(/^act_/, '')}`
    : 'https://adsmanager.facebook.com/';

// Wraps a step that must stay inert until the strategy is approved.
const Gated: React.FC<{ children: React.ReactNode; locked: boolean; why: string }> = ({ children, locked, why }) => (
  <div style={{ position: 'relative' }}>
    <div style={{ opacity: locked ? 0.35 : 1, pointerEvents: locked ? 'none' : 'auto', filter: locked ? 'grayscale(0.5)' : 'none', transition: 'opacity .25s' }}>{children}</div>
    {locked && (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <div style={{ background: 'rgba(16,18,26,0.95)', border: '1px solid rgba(255,174,0,0.35)', borderRadius: '10px', padding: '14px 18px', textAlign: 'center', maxWidth: '90%' }}>
          <AlertTriangle size={16} color="#ffae00" style={{ marginBottom: '6px' }} />
          <div style={{ fontSize: '13px', color: '#fff', fontWeight: 600, marginBottom: '2px' }}>Locked</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{why}</div>
        </div>
      </div>
    )}
  </div>
);

export const WorkspaceCampaign: React.FC<WorkspaceCampaignProps> = ({ workspaceId, creativeAssets = [] }) => {
  // ── the full ideation brief (all original fields restored) ──
  const [form, setForm] = useState({
    campaignFocus: 'Diwali Festive Sale',
    objective: 'Conversions',
    budget: 40000,
    audience: 'Women 18-35, Tier 1 & Tier 2 Cities, Interested in Festive Shopping',
    funnel: 'Bottom of Funnel',
    geoTargetingLevel: 'State-Level',
    placement: 'Maharashtra, Delhi, Karnataka',
    schedule: '14 Days',
    tracking: 'utm_source=ai_agent',
  });

  const [campaign, setCampaign] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [activity, setActivity] = useState<{ label: string; at: number }[]>([]);
  // Recently Published collapses by default — it grows with every publish and was pushing
  // the live campaign flow off screen.
  const [publishedOpen, setPublishedOpen] = useState(false);
  const [galleryExpanded, setGalleryExpanded] = useState(false);
  // Any creative on this page can be clicked to open full size. Thumbnails run 68–150px,
  // which is too small to judge an ad by, and the previous only way to see the real
  // image was to download it.
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  useEffect(() => {
    if (!previewImage) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPreviewImage(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewImage]);
  // Spread onto every creative <img> so they all announce and behave the same way.
  // Takes the image's own style so the cursor is merged in rather than replacing it.
  const previewable = (src: string, style: React.CSSProperties) => ({
    onClick: () => setPreviewImage(src),
    title: 'Click to preview full size',
    style: { ...style, cursor: 'zoom-in' as const },
  });
  const [isCopied, setIsCopied] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  // Triggers the account pickers anchor to (see AnchoredPanel).
  const metaAnchorRef = useRef<HTMLDivElement>(null);
  const googleAnchorRef = useRef<HTMLDivElement>(null);
  const scrollToTop = () => {
    let node: HTMLElement | null = topRef.current;
    while (node) {
      if (node.scrollHeight > node.clientHeight + 5) { node.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      node = node.parentElement;
    }
  };
  const importRef = useRef<HTMLInputElement>(null);

  // Smart ad management (restored)
  const [smart, setSmart] = useState({ killAds: true, autoRotate: true, skipRateThreshold: 70, frequencyCap: 3.5, cpaThreshold: 3500, refreshIntervalDays: 4 });

  // Which platforms this campaign goes to, the final sign-off, and the full-review modal.
  const [platforms, setPlatforms] = useState({ meta: true, google: true });
  const [confirmed, setConfirmed] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);

  // Real Meta ad-account connection (from the Meta connector), the publish popup, and the
  // persistent list of campaigns already published.
  // Mirrors GET /api/connectors/meta/{ws}/status. `ready_to_publish` is the one
  // flag to gate real publishing on: an ad needs both an ad account (who pays)
  // and a Page (who it publishes as).
  const [metaAccount, setMetaAccount] = useState<{
    configured?: boolean; connected?: boolean; name?: string;
    ad_account_id?: string | null; page_id?: string | null; page_name?: string | null;
    default_link_url?: string | null; ready_to_publish?: boolean;
    // can_spend: the ad account has a payment method (null = not checked yet). Distinct
    // from ready_to_publish, which only means a paused campaign can be CREATED.
    can_spend?: boolean | null; needs_reconnect?: boolean; auth_error?: string | null;
    token_expires_in_days?: number | null; token_expiring_soon?: boolean;
  }>({});
  // The workspace's site URL. Both publish routes fall back to it for the ad's
  // destination, so the pre-flight checks below must know about it too — otherwise they
  // report "no destination" for a campaign the server would have published fine.
  const [siteUrl, setSiteUrl] = useState<string>('');
  useEffect(() => {
    if (!workspaceId) return;
    fetch('/api/workspaces', { headers: authHeaders() })
      .then(r => (r.ok ? r.json() : []))
      .then((list: any[]) => {
        const ws = (list || []).find((w: any) => w.id === workspaceId);
        setSiteUrl((ws && ws.company_url) || '');
      })
      .catch(() => {});
  }, [workspaceId]);
  const [publishPopup, setPublishPopup] = useState(false);
  const [recentPublished, setRecentPublished] = useState<any[]>([]);
  const [analyticsView, setAnalyticsView] = useState<any | null>(null);   // opened analytics modal payload

  // Meta ad account + Facebook Page picker (needed before a real campaign/ad can be launched).
  const [metaAdAccounts, setMetaAdAccounts] = useState<{ account_id: string; name: string; currency?: string; active?: boolean }[] | null>(null);
  const [metaPages, setMetaPages] = useState<{ id: string; name: string }[] | null>(null);
  const [selectedPage, setSelectedPage] = useState('');
  const [metaPickerOpen, setMetaPickerOpen] = useState(false);
  const [metaPickerBusy, setMetaPickerBusy] = useState(false);

  const loadMetaAdAccounts = useCallback(async () => {
    if (!workspaceId) return;
    setMetaPickerBusy(true);
    try {
      const [accRes, pageRes] = await Promise.all([
        fetch(`/api/connectors/meta/${workspaceId}/ad-accounts`, { headers: authHeaders() }),
        fetch(`/api/connectors/meta/${workspaceId}/pages`, { headers: authHeaders() }),
      ]);
      const accData = await accRes.json().catch(() => ({}));
      const pageData = await pageRes.json().catch(() => ({}));
      if (accRes.ok) setMetaAdAccounts(accData.ad_accounts || []);
      else flash(accData.detail || 'Could not load Meta ad accounts.', false);
      if (pageRes.ok) setMetaPages(pageData.pages || []);
      else flash(pageData.detail || 'Could not load Facebook Pages.', false);
    } catch { flash('Could not reach Meta to load ad accounts / Pages.', false); }
    setMetaPickerBusy(false);
  }, [workspaceId]);

  const selectAdAccount = async (accountId: string) => {
    if (!workspaceId || !accountId) return;
    setMetaPickerBusy(true);
    try {
      const r = await fetch(`/api/connectors/meta/${workspaceId}/account`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ ad_account_id: accountId }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setMetaAccount(a => ({ ...a, ad_account_id: d.ad_account_id })); flash('Ad account saved.'); }
      else flash(d.detail || 'Could not save ad account.', false);
    } catch { flash('Could not save ad account.', false); }
    setMetaPickerBusy(false);
  };

  // Persist the chosen Page to this workspace's Meta connection. The dropdown previously
  // only set local state, so page_id stayed NULL in the database and every "real" publish
  // failed inside _launch_meta_ad and silently degraded to a MOCK-META demo result.
  // default_link_url is where ad clicks land; the workspace site is the sane default.
  const selectPage = async (pageId: string) => {
    if (!pageId || !workspaceId) return;
    setMetaPickerBusy(true);
    try {
      const r = await fetch(`/api/connectors/meta/${workspaceId}/page`, {
        method: 'POST', headers: authHeaders(),
        // default_link_url omitted deliberately: _launch_meta_ad already falls back to
        // the workspace's company_url, so there is no need to duplicate that here.
        body: JSON.stringify({ page_id: pageId }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setSelectedPage(d.page_id || pageId);
        // Re-read status so ready_to_publish reflects the server, not an assumption.
        const s = await fetch(`/api/connectors/meta/${workspaceId}/status`, { headers: authHeaders() });
        if (s.ok) setMetaAccount(await s.json());
        flash(`Publishing as "${d.page_name || 'your Page'}".`);
      } else if (r.status === 401) {
        flash('Your Meta connection expired — reconnect Meta and try again.', false);
      } else {
        flash(d.detail || 'Could not save the Facebook Page.', false);
      }
    } catch {
      flash('Could not save the Facebook Page — server unreachable.', false);
    }
    setMetaPickerBusy(false);
  };

  // Disconnecting deletes the whole connection row server-side, which also clears the
  // ad account and Page selections — so reconnecting starts clean rather than inheriting
  // stale ids. Confirmed first because it is not undoable without re-running OAuth.
  const disconnectPlatform = async (platform: 'meta' | 'google') => {
    if (!workspaceId) return;
    const name = platform === 'meta' ? 'Meta Ads' : 'Google Ads';
    if (!window.confirm(
      `Disconnect ${name}?\n\nThis removes the connection and clears the selected ` +
      `account${platform === 'meta' ? ' and Facebook Page' : ''}. Campaigns already ` +
      `created in ${name} are not affected. You can reconnect at any time.`)) return;

    setMetaPickerBusy(true);
    try {
      const r = await fetch(
        platform === 'meta'
          ? `/api/connectors/meta/${workspaceId}/disconnect`
          : `/api/connectors/google-ads/${workspaceId}`,
        { method: platform === 'meta' ? 'POST' : 'DELETE', headers: authHeaders() });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        if (platform === 'meta') {
          setMetaAccount({ configured: true, connected: false });
          setMetaAdAccounts(null); setMetaPages(null); setSelectedPage(''); setMetaPickerOpen(false);
        } else {
          setGoogleAccount({ configured: true, connected: false });
          setGoogleAdAccounts(null); setGooglePickerOpen(false);
        }
        flash(`${name} disconnected.`);
      } else {
        flash(d.detail || `Could not disconnect ${name}.`, false);
      }
    } catch {
      flash(`Could not disconnect ${name} — server unreachable.`, false);
    }
    setMetaPickerBusy(false);
  };

  const openMetaPicker = () => {
    setMetaPickerOpen(o => !o);
    if (!metaAdAccounts && !metaPickerOpen) loadMetaAdAccounts();
  };

  // Real Google Ads connection (mirrors the Meta picker above exactly) + its account picker.
  const [googleAccount, setGoogleAccount] = useState<{ configured?: boolean; connected?: boolean; email?: string; customer_id?: string | null; login_customer_id?: string | null; is_manager_account?: boolean; needs_reconnect?: boolean; auth_error?: string | null }>({});
  const [googleAdAccounts, setGoogleAdAccounts] = useState<{ customer_id: string; name: string; manager?: boolean }[] | null>(null);
  const [googlePickerOpen, setGooglePickerOpen] = useState(false);
  const [googlePickerBusy, setGooglePickerBusy] = useState(false);
  const [googleAccountsError, setGoogleAccountsError] = useState<string | null>(null);

  const loadGoogleAdAccounts = useCallback(async () => {
    if (!workspaceId) return;
    setGooglePickerBusy(true);
    setGoogleAccountsError(null);
    try {
      const r = await fetch(`/api/connectors/google-ads/${workspaceId}/accounts`, { headers: authHeaders() });
      const d = await r.json().catch(() => ({}));
      if (r.ok) setGoogleAdAccounts(d.accounts || []);
      else {
        // Kept in the panel as well as flashed. The useful failures here
        // (DEVELOPER_TOKEN_NOT_APPROVED, USER_PERMISSION_DENIED, CUSTOMER_NOT_ENABLED) are
        // already translated to plain English server-side in core/google_ads.py — losing
        // them to a toast that disappears leaves the user staring at an empty dropdown.
        const msg = d.detail || 'Could not load Google Ads accounts.';
        setGoogleAccountsError(msg);
        flash(msg, false);
      }
    } catch {
      const msg = 'Could not reach Google Ads to load accounts.';
      setGoogleAccountsError(msg);
      flash(msg, false);
    }
    setGooglePickerBusy(false);
  }, [workspaceId]);

  const selectGoogleAccount = async (customerId: string) => {
    if (!workspaceId || !customerId) return;
    setGooglePickerBusy(true);
    try {
      const r = await fetch(`/api/connectors/google-ads/${workspaceId}/account`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ customer_id: customerId }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setGoogleAccount(a => ({ ...a, customer_id: d.customer_id })); flash('Google Ads account saved.'); }
      else flash(d.detail || 'Could not save Google Ads account.', false);
    } catch { flash('Could not save Google Ads account.', false); }
    setGooglePickerBusy(false);
  };

  const openGooglePicker = () => {
    setGooglePickerOpen(o => !o);
    if (!googleAdAccounts && !googlePickerOpen) loadGoogleAdAccounts();
  };

  /* Starting an OAuth connection.
     ------------------------------------------------------------------
     Both connect buttons used to be a bare fetch-then-redirect with no busy state, so a
     click did nothing visible until the round trip came back — against a remote database
     that is roughly a second of a button that looks dead, and it read as the app hanging.

     Two changes. The button reports itself immediately, and the authorize URL is fetched on
     hover/focus so the click usually has it already and redirects with no wait at all. The
     URL is just a signed state parameter valid for _STATE_TTL_MIN (15 minutes), so
     prefetching one costs nothing and commits to nothing — a user who never clicks simply
     never uses it. */
  const [connecting, setConnecting] = useState<'meta' | 'google' | null>(null);
  const authUrlCache = useRef<{ meta?: string; google?: string }>({});

  const fetchAuthUrl = async (provider: 'meta' | 'google'): Promise<string | null> => {
    if (authUrlCache.current[provider]) return authUrlCache.current[provider]!;
    const path = provider === 'meta' ? 'meta' : 'google-ads';
    const r = await fetch(`/api/connectors/${path}/${workspaceId}/authorize`, { headers: authHeaders() });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.url) { authUrlCache.current[provider] = d.url; return d.url; }
    throw new Error(d.detail || '');
  };

  /** Warms the URL without navigating. Failures are ignored — the click path reports them. */
  const prefetchAuthUrl = (provider: 'meta' | 'google') => {
    if (!workspaceId || authUrlCache.current[provider]) return;
    fetchAuthUrl(provider).catch(() => {});
  };

  const startConnect = async (provider: 'meta' | 'google') => {
    if (connecting) return;
    setConnecting(provider);
    const label = provider === 'meta' ? 'Meta' : 'Google Ads';
    try {
      const url = await fetchAuthUrl(provider);
      if (url) { window.location.href = url; return; }
      flash(`${label} login isn’t configured on the server yet.`, false);
    } catch (e: any) {
      flash(e?.message || `Could not start the ${label} connection.`, false);
    }
    setConnecting(null);
  };

  const connectGoogleAds = () => startConnect('google');

  // The single approved creative that flows into the platform reviews, plus any
  // images the user uploads, plus a manual override of the Google campaign type.
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [googleTypeOverride, setGoogleTypeOverride] = useState<string>('');
  const uploadImageRef = useRef<HTMLInputElement>(null);

  const flash = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 6000); };
  const log = (l: string) => setActivity(a => [{ label: l, at: Date.now() }, ...a].slice(0, 6));

  const spec = campaign?.metrics || {};
  const status = String(campaign?.status || '').toUpperCase();
  // PUBLISHED = at least one platform went out for real; PUBLISHED_DEMO = simulated.
  // Both mean "published", so match on the prefix rather than the exact demo value —
  // otherwise a real publish is treated as unpublished and the flow resets.
  const isPublishedStatus = (s?: string) => String(s || '').toUpperCase().startsWith('PUBLISHED');
  const approved = status === 'APPROVED' || isPublishedStatus(status);
  const published = isPublishedStatus(status);
  const publishedForReal = String(status || '').toUpperCase() === 'PUBLISHED';
  const metaSetup = spec.meta_setup || {};
  const googleSetup = spec.google_setup || {};
  // Mirrors exactly what the publish route requires before it will create a real Google
  // campaign: workspace_routes.py checks `gads_conn.refresh_token and gads_conn.customer_id`,
  // and the status endpoint reports `connected = bool(conn and conn.refresh_token)`. The
  // review card previously hardcoded a MOCK pill, so a fully connected account still read
  // as a simulation right up to the moment it published for real.
  const googleReadyToPublish = !!(googleAccount.connected && googleAccount.customer_id);
  // A connected account still cannot publish if the server's developer token is not
  // approved for production accounts. We only learn that from the API — core/google_ads.py
  // already translates the enum into plain English — so surface it verbatim rather than
  // letting the UI promise a publish that Google will reject.
  const googleTokenBlocked = googleAccountsError && /developer token|not approved|DEVELOPER_TOKEN/i.test(googleAccountsError)
    ? googleAccountsError
    : null;
  // listAccessibleCustomers returns the manager account itself alongside the real ad
  // accounts, so it is easy to select by mistake — and a manager account can never hold a
  // campaign, so publishing to it always fails.
  //
  // This reads customer.manager straight from Google, recorded when the account was
  // picked. It used to infer "manager" by comparing customer_id against login_customer_id,
  // which silently stopped detecting anything once login_customer_id became NULL for
  // directly-authorised accounts — the normal case for every customer.
  const googleIsManagerAccount = !!googleAccount.is_manager_account;
  const split = spec.budget_split || {};
  const heroImage: string | null = spec.image_url || null;
  // Meta ad copy from the approved strategy — this is what actually gets sent
  // to Meta as the creative when publishing for real.
  const metaCopy = spec.meta || {};
  const headlines: string[] = spec.google_headlines || [];
  const descriptions: string[] = spec.google_descriptions || [];
  const keywords: string[] = spec.top_keywords || [];
  const rec = spec.recommendations || {};
  const aiGoogleType: string = spec.google_campaign_type || (rec.google_campaign_type && rec.google_campaign_type.value) || 'Search';
  const GOOGLE_TYPES = ['Search', 'Display', 'Performance Max', 'Shopping', 'Demand Gen', 'Video'];
  const googleType: string = googleTypeOverride || aiGoogleType;
  const g = spec.google || {};
  // Plain-language reasons for the "Why AI Recommended This" section.
  const whyRows: { label: string; value: string; reason: string }[] = [
    rec.objective && { label: 'Objective', value: rec.objective.value, reason: rec.objective.reason },
    ...(Array.isArray(rec.platforms) ? rec.platforms.map((p: any) => ({ label: 'Platform', value: p.value, reason: p.reason })) : []),
    rec.budget_allocation && { label: 'Budget Split', value: `${rec.budget_allocation.meta_pct ?? '—'}% Meta / ${rec.budget_allocation.google_pct ?? '—'}% Google`, reason: rec.budget_allocation.reason },
    rec.google_campaign_type && { label: 'Google Campaign Type', value: rec.google_campaign_type.value, reason: rec.google_campaign_type.reason },
    rec.audience && { label: 'Audience', value: rec.audience.value, reason: rec.audience.reason },
    rec.creative && { label: 'Creative', value: rec.creative.value, reason: rec.creative.reason },
    rec.cta && { label: 'CTA', value: rec.cta.value, reason: rec.cta.reason },
    rec.optimization_goal && { label: 'Optimization Goal', value: rec.optimization_goal.value, reason: rec.optimization_goal.reason },
  ].filter((r: any) => r && r.reason);
  // Which Google fields to show depends on the AI-chosen campaign type.
  const gt = (googleType || '').toLowerCase();
  const gShow = {
    keywords: gt.includes('search') || gt.includes('shopping'),
    extensions: gt.includes('search'),
    images: gt.includes('display') || gt.includes('performance') || gt.includes('demand'),
    videos: gt.includes('performance') || gt.includes('video'),
    signals: gt.includes('performance') || gt.includes('demand'),
  };
  // Where a Meta ad click lands. The backend falls back the same way (request →
  // connection default → workspace site), but resolving it here lets the UI say what is
  // missing BEFORE the publish call, instead of surfacing a server error afterwards.
  const metaDestination: string = spec.landing_page || metaAccount.default_link_url || siteUrl || '';

  // Meta rejects an ad that has no image, no Page to publish as, or nowhere to click.
  // Google needs none of these, so a mixed publish can half-succeed — which is exactly
  // the confusing outcome this pre-flight exists to prevent.
  const metaBlockers: { label: string; fix: string }[] = [
    // First: with an expired or revoked token every Meta call fails, so nothing below is
    // worth fixing until the account is reconnected. A missing payment method deliberately
    // does NOT block — a paused campaign can still be created; the checklist warns instead.
    !!metaAccount.needs_reconnect && {
      label: 'Meta connection expired',
      fix: metaAccount.auth_error || 'Reconnect Meta Ads above — Meta does not let apps renew the connection automatically.',
    },
    !selectedImage && {
      label: 'No creative image selected',
      fix: 'Pick one below, upload your own, or generate a new one — Meta ads cannot be text-only.',
    },
    // Meta truncates or rejects copy past these limits — the same class of failure the
    // Google checks catch, and the preview already counts characters against them.
    String(metaCopy.primary_text || '').length > 125 && {
      label: `Primary text is ${String(metaCopy.primary_text || '').length}/125 characters`,
      fix: 'Shorten it to 125 characters or fewer — Meta cuts off anything longer.',
    },
    String(metaCopy.headline || '').length > 40 && {
      label: `Headline is ${String(metaCopy.headline || '').length}/40 characters`,
      fix: 'Shorten it to 40 characters or fewer.',
    },
    !metaAccount.page_id && {
      label: 'No Facebook Page selected',
      fix: 'Choose the Page the ad publishes as in the Meta setup step.',
    },
    !metaDestination && {
      label: 'No destination URL',
      fix: 'Add your website to the workspace, or set a link on the Meta connection — an ad needs somewhere to click.',
    },
  ].filter(Boolean) as { label: string; fix: string }[];

  // ── Google's own pre-flight ──────────────────────────────────────────────────
  // Mirrors backend validate_search_payload(): a responsive search ad is rejected outright
  // for too few usable headlines/descriptions, an invalid landing page, or a zero budget.
  // Those are the four failures the server raises, so they are the four checked here.
  const RSA = { headlineMax: 30, descriptionMax: 90, minHeadlines: 3, minDescriptions: 2 };
  const fittingHeadlines = headlines.filter(h => String(h || '').trim() && String(h).trim().length <= RSA.headlineMax);
  const fittingDescriptions = descriptions.filter(d => String(d || '').trim() && String(d).trim().length <= RSA.descriptionMax);
  const googleDestination: string = spec.landing_page || siteUrl || '';
  const isHttpUrl = (u: string) => /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(String(u || '').trim());
  const googleBudget = Number(spec.total_budget || campaign?.budget || 0);

  const googleBlockers: { label: string; fix: string }[] = [
    // First, because nothing below matters with a dead token: every Google call would fail
    // with invalid_grant. The server records this the first time Google refuses the token.
    !!googleAccount.needs_reconnect && {
      label: 'Google Ads connection expired',
      fix: googleAccount.auth_error || 'Google revoked this connection. Reconnect Google Ads above.',
    },
    !googleAccount.customer_id && {
      label: 'No Google Ads account selected',
      fix: 'Connect Google Ads and choose the account to publish into.',
    },
    googleIsManagerAccount && {
      label: 'A manager account is selected',
      fix: 'Manager (MCC) accounts cannot hold campaigns — pick a client account underneath it.',
    },
    !!googleTokenBlocked && {
      label: 'Developer token not approved',
      fix: googleTokenBlocked || 'Apply for Basic Access in the Google Ads API Center.',
    },
    fittingHeadlines.length < RSA.minHeadlines && {
      label: `Only ${fittingHeadlines.length} of ${headlines.length} headlines fit`,
      fix: `Google needs at least ${RSA.minHeadlines} headlines of ${RSA.headlineMax} characters or fewer. Shorten the long ones above.`,
    },
    fittingDescriptions.length < RSA.minDescriptions && {
      label: `Only ${fittingDescriptions.length} of ${descriptions.length} descriptions fit`,
      fix: `Google needs at least ${RSA.minDescriptions} descriptions of ${RSA.descriptionMax} characters or fewer.`,
    },
    !isHttpUrl(googleDestination) && {
      label: 'No valid landing page',
      fix: 'Set a full http(s) landing page on the strategy, or add your website to the workspace.',
    },
    !(googleBudget > 0) && {
      label: 'Budget is zero',
      fix: 'Set a campaign budget above zero before publishing.',
    },
  ].filter(Boolean) as { label: string; fix: string }[];

  const googlePublishBlocked = !!googleAccount.connected && googleBlockers.length > 0;

  // Only blocks a REAL publish. Demo mode has no such requirements.
  const metaPublishBlocked = !!metaAccount.connected && metaBlockers.length > 0;

  const chips = (arr: any[]) => <ChipList items={arr} />;
  const libraryImages: string[] = (creativeAssets || []).map((a: any) => a.image_url || a.imageUrl).filter(Boolean);
  // Every creative the user can pick from: the AI-generated ad, their library, and uploads.
  const allImages: string[] = Array.from(new Set([heroImage, ...uploadedImages, ...libraryImages].filter(Boolean) as string[]));
  // Select the AI-generated ad whenever it CHANGES, not only when nothing is selected yet.
  // The old `!selectedImage` guard meant that after the first pick, pressing "New image"
  // generated a fresh creative that never became the selected one — the big preview kept
  // showing the previous image, so generation looked broken.
  const lastHeroRef = useRef<string | null>(null);
  useEffect(() => {
    if (heroImage && heroImage !== lastHeroRef.current) {
      lastHeroRef.current = heroImage;
      setSelectedImage(heroImage);
    }
  }, [heroImage]);  // eslint-disable-line react-hooks/exhaustive-deps
  const onUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { const url = String(reader.result); setUploadedImages(imgs => [url, ...imgs]); setSelectedImage(url); };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ── data ──
  const loadLatest = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const list = await fetch(`/api/workspaces/${workspaceId}/campaigns`, { headers: authHeaders() }).then(r => r.json());
      if (Array.isArray(list)) {
        const sorted = list.slice().sort((a: any, b: any) => b.id - a.id);
        const isPub = (c: any) => String(c.status || '').toUpperCase().startsWith('PUBLISHED');
        setRecentPublished(sorted.filter(isPub).slice(0, 10));
        // Active flow = the latest NOT-yet-published campaign. Once a campaign is published it
        // drops into "Recently Published" and the flow starts fresh from the top checklist.
        setCampaign(sorted.find((c: any) => !isPub(c)) || null);
      }
    } catch { /* ignore */ }
  }, [workspaceId]);
  const refresh = useCallback(async (id: number) => {
    try {
      const r = await fetch(`/api/workspaces/${workspaceId}/campaigns/${id}`, { headers: authHeaders() });
      if (r.ok) setCampaign(await r.json());
    } catch { /* ignore */ }
  }, [workspaceId]);
  // Refresh ONLY the Recently Published list (never changes the campaign in focus).
  const loadRecent = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const list = await CampaignService.list(workspaceId);
      setRecentPublished(list.filter(c => String(c.status).toUpperCase().startsWith('PUBLISHED'))
        .sort((a, b) => b.id - a.id).slice(0, 10));
    } catch { /* ignore */ }
  }, [workspaceId]);
  useEffect(() => { loadLatest(); }, [loadLatest]);
  useEffect(() => {
    if (!workspaceId) return;
    fetch(`/api/connectors/meta/${workspaceId}/status`, { headers: authHeaders() })
      .then(r => (r.ok ? r.json() : null)).then(d => d && setMetaAccount(d)).catch(() => {});
  }, [workspaceId]);
  useEffect(() => {
    if (!workspaceId) return;
    fetch(`/api/connectors/google-ads/${workspaceId}/status`, { headers: authHeaders() })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!d) return;
        setGoogleAccount(d);
        // `connected` only means a refresh token exists. Whether the server's developer
        // token is approved for production accounts is a separate gate, and it is only
        // discoverable by calling the API — so probe it once here rather than waiting for
        // the user to open the account picker. Without this the publish banner defaults to
        // the optimistic wording and promises a campaign Google will reject.
        if (d.connected) loadGoogleAdAccounts();
      })
      .catch(() => {});
  }, [workspaceId, loadGoogleAdAccounts]);

  // ── generate strategy (+ its ad image, together) ──
  const generate = async () => {
    if (!workspaceId) { flash('No workspace selected.', false); return; }
    setIsGenerating(true);
    let beforeMax = 0;
    try {
      const b = await fetch(`/api/workspaces/${workspaceId}/campaigns`, { headers: authHeaders() }).then(r => r.json());
      if (Array.isArray(b)) beforeMax = b.reduce((m: number, c: any) => Math.max(m, c.id), 0);
    } catch { /* ignore */ }
    const prompt = `Create an ad campaign. Theme/focus: ${form.campaignFocus}. Objective: ${form.objective}. Total budget: ₹${form.budget}. Audience: ${form.audience}. Funnel: ${form.funnel}. Geo: ${form.placement} (${form.geoTargetingLevel}). Schedule: ${form.schedule}. Tracking: ${form.tracking}.`;
    // Geo is also sent as its own structured field (not just inside the prose prompt above) so
    // the exact locations the user picked are carried through the spec verbatim, rather than
    // relying on the LLM to re-extract them accurately from text.
    const geoLocations = form.placement.split(',').map(s => s.trim()).filter(Boolean);
    try {
      await fetch(`/api/agents/${workspaceId}/campaign`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ prompt, model: 'gemini-2.5-flash', geo_targeting_level: form.geoTargetingLevel, geo_locations: geoLocations }) });
    } catch { setIsGenerating(false); flash('Could not start generation.', false); return; }
    let tries = 0;
    const poll = setInterval(async () => {
      tries += 1;
      try {
        const now = await fetch(`/api/workspaces/${workspaceId}/campaigns`, { headers: authHeaders() }).then(r => r.json());
        const fresh = Array.isArray(now) ? now.filter((c: any) => c.id > beforeMax).sort((a: any, b: any) => b.id - a.id)[0] : null;
        if (fresh) {
          clearInterval(poll); setIsGenerating(false); setCampaign(fresh);
          log('AI Strategy + ad image generated');
          flash('Strategy and its ad image are ready. Review them, then approve to unlock the rest.');
        } else if (tries >= 20) { clearInterval(poll); setIsGenerating(false); flash('Taking longer than expected — check the agent logs.', false); }
      } catch { /* keep polling */ }
    }, 3000);
  };

  const approve = async () => {
    if (!campaign) return;
    setBusy('approve');
    try {
      const r = await fetch(`/api/workspaces/${workspaceId}/campaigns/${campaign.id}/approve`, { method: 'POST', headers: authHeaders() });
      const d = await r.json();
      if (r.ok) { await refresh(campaign.id); log('Strategy approved'); flash('Approved. The strategy has been passed to Meta, Google and Review below.'); }
      else flash(d.detail || 'Approve failed.', false);
    } catch { flash('Approve failed.', false); }
    setBusy(null);
  };

  const adSetup = async (platform: 'meta' | 'google', action: 'connect' | 'launch', silent = false) => {
    if (!campaign) return false;
    setBusy(`${platform}-${action}`);
    let ok = false;
    try {
      const r = await fetch(`/api/workspaces/${workspaceId}/campaigns/${campaign.id}/ad-setup`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ platform, action }),
      });
      const d = await r.json();
      if (r.ok) {
        await refresh(campaign.id);
        const P = platform === 'meta' ? 'Meta' : 'Google';
        log(`${P} Ads ${action === 'connect' ? 'connected' : 'launched'} (mock)`);
        // "Mark as Ready" only flips a local readiness flag — nothing reaches the ad
        // platform until Publish — so say that rather than the old blanket MOCK note,
        // which now contradicts a genuinely connected (REAL) Meta account.
        if (!silent) flash(action === 'launch'
          ? `${P} marked as ready. Nothing is sent to ${P} until you publish.`
          : `${P} ${action} done in MOCK mode — no real ad account was touched.`);
        ok = true;
      } else flash(d.detail || 'Action failed.', false);
    } catch { flash('Action failed.', false); }
    setBusy(null);
    return ok;
  };

  // The ad account is connected once, from the header. The per-platform cards used to
  // carry their own "Connect account" button, which read as a second, competing
  // connection — so they now go straight to "Mark as Ready". The backend still gates
  // `launch` behind a `connect`, so that mock step is done silently here.
  const markPlatformReady = async (platform: 'meta' | 'google') => {
    const setup = platform === 'meta' ? metaSetup : googleSetup;
    if (!setup.connected && !(await adSetup(platform, 'connect', true))) return;
    await adSetup(platform, 'launch');
  };

  const publish = async (targets: ('meta' | 'google')[]) => {
    if (!campaign || targets.length === 0) return;
    // Stop a publish the platform will certainly reject, and name the missing piece.
    // Checked per platform and BEFORE any request goes out: the two have different
    // requirements, so a "both" publish could otherwise put a live campaign on one
    // platform and nothing on the other, with only an error message to explain it.
    const blocked: string[] = [];
    if (targets.includes('meta') && metaPublishBlocked) {
      blocked.push(`Meta — ${metaBlockers.map(b => b.label.toLowerCase()).join('; ')}`);
    }
    if (targets.includes('google') && googlePublishBlocked) {
      blocked.push(`Google — ${googleBlockers.map(b => b.label.toLowerCase()).join('; ')}`);
    }
    if (blocked.length) {
      flash(`Cannot publish yet. ${blocked.join('. ')}.`, false);
      return;
    }
    setBusy(`publish-${targets.join('-')}`);
    try {
      // Send the approved creative so the backend can build a real ad. Without
      // it Meta only gets a campaign shell, which can never deliver.
      const metaCreative = targets.includes('meta') ? {
        image_url: selectedImage || undefined,
        link_url: metaDestination || undefined,
        headline: metaCopy.headline || undefined,
        primary_text: metaCopy.primary_text || undefined,
        cta: metaCopy.cta || undefined,
        meta_placements: ['facebook', 'instagram'],
      } : {};
      const r = await fetch(`/api/workspaces/${workspaceId}/campaigns/${campaign.id}/publish`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ platforms: targets, ...metaCreative }),
      });
      const d = await r.json();
      if (r.ok) {
        const label = targets.map(t => (t === 'meta' ? 'Meta' : 'Google')).join(' & ');
        const modeTag = d.mode === 'real' ? '' : d.mode === 'mixed' ? ' (partly demo)' : ' (demo)';
        log(`Published to ${label}${modeTag}`);
        flash(d.message || `Published to ${label}${modeTag}.`);
        setPublishPopup(false); setConfirmed(false);
        // Do NOT reset — stay on the now-published campaign (it becomes read-only), and
        // refresh the Recently Published list.
        await refresh(campaign.id);
        await loadRecent();
      } else flash(d.detail || 'Publish failed.', false);
    } catch { flash('Publish failed.', false); }
    setBusy(null);
  };

  // Start a brand-new empty campaign flow (explicit — no longer automatic after publish).
  const startNewCampaign = () => {
    setConfirmed(false); setReviewOpen(false); setPublishPopup(false);
    setSelectedImage(null); setUploadedImages([]); setGoogleTypeOverride('');
    setPlatforms({ meta: true, google: true });
    setCampaign(null);
  };

  // Create the next version of a published campaign (V2, V3…) — editable; the old version stays read-only.
  const createNewVersion = async () => {
    if (!campaign) return;
    setBusy('version');
    try {
      const d = await CampaignService.createVersion(workspaceId!, campaign.id);
      await refresh(d.campaign_id);
      await loadRecent();
      setConfirmed(false); setPublishPopup(false); setReviewOpen(false);
      log(`Version ${d.version} created`);
      flash(`Version ${d.version} created — edit it and publish when ready. The previous version stays read-only.`);
    } catch (e: any) { flash(e.message || 'Could not create a new version.', false); }
    setBusy(null);
  };

  const duplicateCampaign = async (id: number) => {
    if (!workspaceId) return;
    setBusy('duplicate');
    try {
      const d = await CampaignService.duplicate(workspaceId, id);
      await refresh(d.campaign_id);
      await loadRecent();
      setConfirmed(false); setPublishPopup(false);
      log('Campaign duplicated');
      flash('Duplicated into a new editable campaign.');
    } catch (e: any) { flash(e.message || 'Could not duplicate.', false); }
    setBusy(null);
  };

  const viewAnalytics = async (id: number) => {
    if (!workspaceId) return;
    setBusy('analytics');
    try { setAnalyticsView(await CampaignService.analytics(workspaceId, id)); }
    catch (e: any) { flash(e.message || 'Could not load analytics.', false); }
    setBusy(null);
  };

  // Fire-and-forget persistence (keeps the design unchanged; saves quietly as the user works).
  const persistPlatforms = (p: { meta: boolean; google: boolean }) => {
    if (campaign && approved && !published) CampaignService.selectPlatforms(workspaceId!, campaign.id, p).catch(() => {});
  };
  const persistOptimization = (rules: any) => {
    if (campaign && approved && !published) {
      CampaignService.saveOptimization(workspaceId!, campaign.id, {
        auto_kill: rules.killAds, cpa_limit: rules.cpaThreshold, frequency_limit: rules.frequencyCap,
        creative_rotation: rules.autoRotate, refresh_interval_days: rules.refreshIntervalDays,
      }).catch(() => {});
    }
  };
  // Debounced save of the optimization rules whenever the user tweaks them.
  useEffect(() => {
    if (!campaign || !approved || published) return;
    const t = setTimeout(() => persistOptimization(smart), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smart, campaign?.id, approved, published]);

  // Start a real Meta connection (OAuth) — see startConnect above for the busy state and
  // the hover prefetch that make the click immediate.
  const connectMeta = () => startConnect('meta');

  // Publish entry point: if a Meta account is connected (or Meta isn't a target) publish directly;
  // otherwise show the connect-or-publish popup.
  const attemptPublish = (targets: ('meta' | 'google')[]) => {
    if (!targets.includes('meta') || metaAccount.connected) { publish(targets); return; }
    setPublishPopup(true);
  };

  const regenerateImage = async () => {
    if (!workspaceId) return;
    setBusy('image');
    try {
      await fetch(`/api/agents/${workspaceId}/creative`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ prompt: `Ad creative for ${form.campaignFocus}. Audience: ${form.audience}. ${form.objective} campaign.`, model: 'gemini-2.5-flash' }),
      });
      log('New ad image requested');
      flash('Generating a new image — it appears in Creative Studio and your library.');
    } catch { flash('Could not start image generation.', false); }
    setBusy(null);
  };

  // ── presets (restored) ──
  const presets = [
    { id: 'festive', title: 'Festive Conversion Blast', icon: Rocket, badge: 'High ROAS focus', desc: 'Scale a festive sale with bottom-of-funnel retargeting and short video hooks.',
      p: { campaignFocus: 'Diwali Festive Sale', objective: 'Conversions', budget: 65000, audience: 'Festive Shoppers & Tech Enthusiasts', funnel: 'Bottom of Funnel', geoTargetingLevel: 'State-Level', placement: 'Maharashtra, Delhi, Karnataka, Gujarat', schedule: '14 Days', tracking: 'utm_source=ai_agent_festive' } },
    { id: 'cart', title: 'Retargeting & Cart Recovery', icon: ShoppingCart, badge: 'High conversion %', desc: 'Re-engage high-intent abandoned carts with dynamic ads and an exit offer.',
      p: { campaignFocus: '7-Day Abandoned Cart Recovery', objective: 'Conversions', budget: 30000, audience: 'Added to Cart (Last 7 Days) - No Purchase', funnel: 'Bottom of Funnel', geoTargetingLevel: 'City-Level', placement: 'Mumbai, Bangalore, Delhi NCR', schedule: 'Ongoing / Evergreen', tracking: 'utm_source=ai_agent_retargeting' } },
    { id: 'lal', title: '1% Lookalike Expansion', icon: TrendingUp, badge: 'Scale audience', desc: 'Acquire new customers via lookalikes of your top-LTV buyers.',
      p: { campaignFocus: 'Lookalike Customer Acquisition', objective: 'Lead Generation', budget: 50000, audience: 'Top 1% LAL of Past Buyers + Interest in Premium Tech', funnel: 'Top of Funnel', geoTargetingLevel: 'Country-Level', placement: 'India (Tier 1 & Tier 2)', schedule: '30 Days', tracking: 'utm_source=ai_agent_lal' } },
  ];

  // Download the approved creative itself, not just the campaign JSON.
  //
  // Fetched into a blob rather than pointing <a download> straight at the URL: the image
  // often lives on another origin (Pollinations) or is a data: URL, and in both cases the
  // browser ignores the `download` attribute and simply navigates away — losing the user's
  // place in the flow instead of saving the file.
  const downloadCreative = async (url: string) => {
    if (!url) return;
    setBusy('download');
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      // Trust the served content-type for the extension; the URL often has none.
      const ext = (blob.type.split('/')[1] || 'png').split(';')[0].replace('jpeg', 'jpg');
      const name = `creative-${(form.campaignFocus || 'ad').replace(/\s+/g, '_').toLowerCase()}-${Date.now()}.${ext}`;
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
      flash(`Saved "${name}" to your Downloads folder.`);
    } catch {
      flash('Could not download the image — try right-click and Save image as.', false);
    } finally {
      setBusy(null);
    }
  };

  // ── import / export (restored) ──
  const exportCampaign = () => {
    if (!campaign) { flash('Nothing to export yet — generate a strategy first.', false); return; }
    try {
      const blob = new Blob([JSON.stringify({ version: '1.0', exportedAt: new Date().toISOString(), form, smart, strategy: spec }, null, 2)], { type: 'application/json' });
      const filename = `campaign-${(form.campaignFocus || 'untitled').replace(/\s+/g, '_').toLowerCase()}-${Date.now()}.json`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      flash(`Exported "${filename}" to your Downloads folder.`);
    } catch (err) {
      flash('Export failed — could not build the file.', false);
    }
  };
  const importCampaign = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      try {
        const d = JSON.parse(String(ev.target?.result));
        if (!d.form && !d.smart) { flash("That file doesn't look like a campaign export.", false); return; }
        if (d.form) setForm(p => ({ ...p, ...d.form }));
        if (d.smart) setSmart(p => ({ ...p, ...d.smart }));
        flash(d.strategy
          ? 'Campaign brief imported into the form on the left. Note: only the brief restores automatically — click "Generate Strategy + Ad" to recreate its AI strategy and image.'
          : 'Campaign brief imported into the form on the left.');
      } catch { flash('Invalid campaign file — could not read it as JSON.', false); }
    };
    r.onerror = () => flash('Could not read that file.', false);
    r.readAsText(f); e.target.value = '';
  };

  const copyStrategy = () => {
    navigator.clipboard.writeText(JSON.stringify(spec, null, 2));
    setIsCopied(true); setTimeout(() => setIsCopied(false), 2000);
  };

  // ── stepper ──
  // Which platforms are actually in play, and whether each one's ads are reviewed & ready.
  const chosen: ('meta' | 'google')[] = (['meta', 'google'] as const).filter(p => platforms[p]);
  const setupOf = (p: 'meta' | 'google') => (p === 'meta' ? metaSetup : googleSetup);
  const platformsReady = chosen.length > 0 && chosen.every(p => setupOf(p).launched);
  const publishedList: string[] = spec.published_platforms || [];

  const steps = [
    { n: 1, name: 'Ideation', sub: 'Fill campaign brief', s: campaign ? 'Completed' : 'Pending' },
    { n: 2, name: 'AI Strategy', sub: 'Generate strategy', s: !campaign ? 'Pending' : 'Completed' },
    { n: 3, name: 'Approve Strategy', sub: 'Review & approve', s: !campaign ? 'Locked' : approved ? 'Completed' : 'Needs approval' },
    { n: 4, name: 'Select Platforms', sub: 'Choose where to publish', s: !approved ? 'Locked' : chosen.length ? 'Completed' : 'Pending' },
    { n: 5, name: 'Review Platforms', sub: 'Review & edit platform ads', s: !approved || !chosen.length ? 'Locked' : platformsReady ? 'Completed' : 'In Progress' },
    { n: 6, name: 'Human Review', sub: 'Final review & publish', s: published ? 'Completed' : !platformsReady ? 'Locked' : confirmed ? 'In Progress' : 'Pending' },
    { n: 7, name: 'Status', sub: 'Track campaign', s: published ? 'Completed' : 'Locked' },
  ];
  // Returns a literal hex (not a CSS var) because the stepper appends 8-digit alpha
  // suffixes to it — `var(--text-secondary)38` would be invalid CSS. #8f8f9b is the
  // value of --text-secondary.
  const stepColor = (s: string) => (s === 'Completed' ? '#00e676' : s === 'In Progress' || s === 'Generated' ? '#5a8dff' : s === 'Needs approval' ? '#ffae00' : '#8f8f9b');
  const canPublish = approved && platformsReady && confirmed && !published;

  // ── sample performance feed (mock data, kept at top) ──
  // Real optimisation feed. The backend has computed this all along - Meta insights run
  // through campaign_optimizer.analyze(), which decides what to scale, rotate or kill from
  // actual spend, ROAS, CTR and frequency, and says "not enough data yet" rather than
  // guessing. The endpoint was simply never called, so the panel below showed sample rows.
  const [liveFeed, setLiveFeed] = useState<any[] | null>(null);
  const [feedSummary, setFeedSummary] = useState<any | null>(null);

  useEffect(() => {
    if (!workspaceId || !metaAccount.connected) { setLiveFeed(null); return; }
    let cancelled = false;
    fetch(`/api/connectors/meta/${workspaceId}/recommendations?date_preset=last_7d`, { headers: authHeaders() })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (cancelled || !d) return;
        setLiveFeed(Array.isArray(d.recommendations) ? d.recommendations : []);
        setFeedSummary(d.summary || null);
      })
      .catch(() => { /* the sample feed below stays, clearly labelled */ });
    return () => { cancelled = true; };
  }, [workspaceId, metaAccount.connected]);

  // Optimiser signal -> how the card reads. Colours match the sample rows so the panel looks
  // the same whether it is showing real decisions or the example format.
  const SIGNAL_STYLE: Record<string, { tag: string; color: string; bg: string; bd: string; icon: any }> = {
    scaling: { tag: 'Scale (high performance)', color: '#00e676', bg: 'rgba(0,230,118,0.08)', bd: 'rgba(0,230,118,0.3)', icon: CheckCircle2 },
    working: { tag: 'Working', color: '#00e676', bg: 'rgba(0,230,118,0.08)', bd: 'rgba(0,230,118,0.3)', icon: CheckCircle2 },
    underperforming: { tag: 'Underperforming', color: '#ffb74d', bg: 'rgba(255,183,77,0.08)', bd: 'rgba(255,183,77,0.3)', icon: AlertTriangle },
    wasting: { tag: 'Wasting spend', color: '#ff5252', bg: 'rgba(255,82,82,0.08)', bd: 'rgba(255,82,82,0.3)', icon: OctagonX },
    learning: { tag: 'Still learning', color: '#9c7bff', bg: 'rgba(156,123,255,0.08)', bd: 'rgba(156,123,255,0.3)', icon: RefreshCw },
  };

  const formatEvidence = (evidence: any): string => {
    if (!evidence || typeof evidence !== 'object') return '';
    const bits: string[] = [];
    if (evidence.spend != null) bits.push(`Spend ${money(evidence.spend)}`);
    if (evidence.roas != null) bits.push(`ROAS ${Number(evidence.roas).toFixed(2)}×`);
    if (evidence.ctr != null) bits.push(`CTR ${Number(evidence.ctr).toFixed(2)}%`);
    if (evidence.frequency != null) bits.push(`Freq ${Number(evidence.frequency).toFixed(1)}×`);
    if (evidence.cpa != null) bits.push(`CPA ${money(evidence.cpa)}`);
    if (evidence.purchases != null) bits.push(`${evidence.purchases} conv`);
    return bits.join('  |  ');
  };

  const sampleFeed = [
    { id: 'f1', tag: 'Scale (high performance)', icon: CheckCircle2, color: '#00e676', bg: 'rgba(0,230,118,0.08)', bd: 'rgba(0,230,118,0.3)', name: 'Diwali Festive Sale (Meta)', metrics: 'ROAS 4.2×  |  CPA ₹900  |  Spend ₹35,000', rec: 'Running 38% above ROAS target. Scale daily budget +25%.', act: 'Scale Budget +25%' },
    { id: 'f2', tag: 'Rotate creative (fatigue)', icon: AlertTriangle, color: '#ffb74d', bg: 'rgba(255,183,77,0.08)', bd: 'rgba(255,183,77,0.3)', name: 'Summer Apparel Retargeting', metrics: 'Frequency 4.1×  |  CTR 0.8%  |  Skip 74%', rec: 'Frequency hit 4.1× with a high skip rate. Rotate the creative.', act: 'Rotate Creative' },
    { id: 'f3', tag: 'Kill (CPA limit exceeded)', icon: OctagonX, color: '#ff5252', bg: 'rgba(255,82,82,0.08)', bd: 'rgba(255,82,82,0.3)', name: 'Broad TOF Awareness (Google)', metrics: `CPA ₹3,900 (cap ₹${smart.cpaThreshold})  |  0 conv (24h)`, rec: 'CPA breached your safety threshold. Auto-kill rule triggered.', act: 'Kill Ad Set' },
    { id: 'f4', tag: 'Pivot (audience saturation)', icon: RefreshCw, color: '#9c7bff', bg: 'rgba(156,123,255,0.08)', bd: 'rgba(156,123,255,0.3)', name: 'State-Level Scale Campaign', metrics: 'MH ROI 1.5×  |  KA ROI 3.8×', rec: 'Regional saturation detected. Reallocate 40% budget to high-ROI zones.', act: 'Reallocate Budget' },
  ];
  const [executed, setExecuted] = useState<string[]>([]);

  return (
    <div ref={topRef} style={{ display: 'flex', flexDirection: 'column', gap: '28px', color: '#fff' }}>
      {/* ── header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        {/* Header follows the Creative Studio / SEO pattern: tinted icon tile + uppercase
            title + muted subtitle, so every workspace reads as one family. */}
        {/* Sized to match the SEO + GEO workspace header (44px tile / 22px title / 13.5px
            sub). It was rendering at 36/16/12, which made this screen read denser and
            visually out of family with the other workspaces. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(255,189,46,0.15)', border: '1px solid rgba(255,189,46,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Rocket size={22} color="#FFBD2E" />
          </div>
          <div>
            <div style={{ fontSize: '22px', color: '#fff', fontWeight: 800, letterSpacing: '0.02em', fontFamily: 'var(--font-heading)', lineHeight: 1.2 }}>
              CAMPAIGN MANAGER
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '640px', marginTop: '2px', lineHeight: 1.5 }}>
              Describe your campaign once — AI writes the strategy and the ad image, you approve it, and that plan drives Meta, Google and publishing.
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0, alignItems: 'center', position: 'relative' }}>
          {metaAccount.connected ? (
            <div ref={metaAnchorRef} style={{ position: 'relative' }}>
              {/* The raw 16-digit ad-account id used to sit in this pill, making it the
                  widest thing in the header for no read-value. It moves to the tooltip and
                  is still shown in full in the picker this button opens. */}
              <button onClick={openMetaPicker}
                title={metaAccount.ad_account_id ? `Meta ad account ${metaAccount.ad_account_id}` : 'No ad account selected'}
                style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: 600, color: 'var(--success)', background: 'rgba(0,255,157,0.08)', border: '1px solid rgba(0,255,157,0.3)', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', maxWidth: '260px' }}>
                <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Meta{metaAccount.name ? ` · ${metaAccount.name}` : ''}
                </span>
                {!metaAccount.ad_account_id && (
                  <span style={{ flexShrink: 0, fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--warning)', background: 'var(--warning-glow)', border: '1px solid rgba(255,174,0,0.35)', borderRadius: '5px', padding: '2px 6px' }}>
                    NO ACCOUNT
                  </span>
                )}
              </button>
              {metaPickerOpen && (
                <>
                <AnchoredPanel anchorRef={metaAnchorRef} onClose={() => setMetaPickerOpen(false)}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff', marginBottom: '10px' }}>Meta ad account &amp; Page</div>
                  {metaPickerBusy ? (
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Loading…</p>
                  ) : (
                    <>
                      <span style={label}>Ad account</span>
                      <select style={{ ...input, padding: '8px 10px', fontSize: '13px', marginBottom: '12px' }}
                        value={metaAccount.ad_account_id || ''} onChange={e => selectAdAccount(e.target.value)}>
                        <option value="" disabled>{metaAdAccounts && metaAdAccounts.length ? 'Choose an ad account' : 'No ad accounts found'}</option>
                        {(metaAdAccounts || []).map(a => (
                          <option key={a.account_id} value={a.account_id}>{a.name} ({a.currency}){a.active ? '' : ' — inactive'}</option>
                        ))}
                      </select>
                      <span style={label}>Facebook Page</span>
                      <select style={{ ...input, padding: '8px 10px', fontSize: '13px' }}
                        disabled={metaPickerBusy}
                        value={metaAccount.page_id || selectedPage || ''}
                        onChange={e => selectPage(e.target.value)}>
                        <option value="" disabled>{metaPages && metaPages.length ? 'Choose a Page' : 'No Pages found'}</option>
                        {(metaPages || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>

                      {/* Readiness checklist — each line reflects a real server value, so the
                          user can see exactly what is still missing before a real publish. */}
                      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {[
                          { ok: !!metaAccount.connected, label: 'Meta connected' },
                          { ok: !!metaAccount.ad_account_id, label: 'Ad account selected' },
                          { ok: !!metaAccount.page_id, label: 'Facebook Page selected' },
                          { ok: !!metaAccount.ready_to_publish, label: 'Ready to publish' },
                          // Its own row, because "ready" and "can spend" differ: a paused
                          // campaign can be created with no payment method, but it can never
                          // deliver. The server checks the ad account itself for this.
                          { ok: metaAccount.can_spend === true,
                            label: metaAccount.can_spend === false
                              ? 'No payment method on the ad account — ads can be created but won’t run'
                              : metaAccount.can_spend === true ? 'Payment method on the ad account'
                              : 'Payment method not checked yet' },
                          // The two Meta needs that Google does not, checked against the
                          // approved strategy rather than the connection.
                          { ok: !!selectedImage, label: 'Creative image selected' },
                          { ok: !!metaDestination, label: 'Destination URL set' },
                        ].map(row => (
                          <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: row.ok ? '#00e676' : 'var(--text-secondary)' }}>
                            {row.ok ? <CheckCircle2 size={12} /> : <span style={{ width: '12px', textAlign: 'center' }}>○</span>}
                            {row.label}
                          </div>
                        ))}
                      </div>
                      {/* Meta will not renew a long-lived token (re-exchanging one returns the
                          same expiry), so the only fix is connecting again — say so a week
                          ahead instead of letting publishing fail on the day it lapses. */}
                      {(metaAccount.needs_reconnect || metaAccount.token_expiring_soon) && (
                        <div style={{
                          marginTop: '10px', padding: '10px 12px', borderRadius: 'var(--radius-md, 10px)',
                          background: 'rgba(255,71,87,0.07)', border: '1px solid rgba(255,71,87,0.3)',
                          fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5,
                        }}>
                          <b style={{ color: '#ff8b95' }}>
                            {metaAccount.needs_reconnect
                              ? 'Meta connection expired.'
                              : `Meta connection expires in ${metaAccount.token_expires_in_days} day${metaAccount.token_expires_in_days === 1 ? '' : 's'}.`}
                          </b>{' '}
                          {metaAccount.auth_error || 'Meta doesn’t let apps renew this connection automatically — reconnect Meta to keep publishing.'}
                        </div>
                      )}
                      {/* Say precisely what is missing and how to fix it. Meta rejects an ad
                          with no image or no destination, while Google accepts the same
                          strategy happily — so without this a mixed publish half-succeeds
                          and the error only appears after Google has already gone live. */}
                      {metaBlockers.length > 0 ? (
                        <div style={{
                          marginTop: '10px', padding: '10px 12px', borderRadius: 'var(--radius-md, 10px)',
                          background: 'rgba(255,183,0,0.07)', border: '1px solid rgba(255,183,0,0.28)',
                        }}>
                          <div style={{ fontSize: T.badge, fontWeight: 700, color: 'var(--warning, #FFB300)', marginBottom: '6px' }}>
                            Meta cannot publish yet
                          </div>
                          {metaBlockers.map(b => (
                            <div key={b.label} style={{ fontSize: T.body, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '4px' }}>
                              <b style={{ color: 'var(--text-primary)' }}>{b.label}.</b> {b.fix}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '10px', lineHeight: 1.5 }}>
                          {metaAccount.ready_to_publish
                            ? 'Real campaigns will be created in Meta, paused, for you to review and activate.'
                            : 'An ad account and a Facebook Page are both required before a real campaign can be created.'}
                        </p>
                      )}
                      {metaDestination && (
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.5 }}>
                          Ad clicks go to <b style={{ color: 'var(--text-primary)' }}>{displayHost(metaDestination) || metaDestination}</b>.
                        </p>
                      )}
                      <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                        <button onClick={loadMetaAdAccounts} style={{ ...btnGhost, flex: 1, padding: '7px', fontSize: '12px' }}><RefreshCw size={12} /> Refresh list</button>
                        <button onClick={() => disconnectPlatform('meta')} disabled={metaPickerBusy}
                          style={{ ...btnGhost, flex: 1, padding: '7px', fontSize: '12px', color: '#ff5c5c', borderColor: 'rgba(255,92,92,0.3)' }}>
                          Disconnect
                        </button>
                      </div>
                    </>
                  )}
                </AnchoredPanel>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={connectMeta}
              onMouseEnter={() => prefetchAuthUrl('meta')}
              onFocus={() => prefetchAuthUrl('meta')}
              disabled={connecting === 'meta'}
              style={{ ...btnGhost, color: '#8B85FF', borderColor: 'rgba(90,82,255,0.4)' }}
            >
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ffae00', display: 'inline-block' }} />
              {connecting === 'meta' ? 'Opening Meta…' : 'Connect Meta account'}
            </button>
          )}
          {googleAccount.connected ? (
            <div ref={googleAnchorRef} style={{ position: 'relative' }}>
              <button onClick={openGooglePicker} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: 600, color: '#00e676', background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer' }}>
                <CheckCircle2 size={14} /> Google Ads connected{googleAccount.email ? ` · ${googleAccount.email}` : ''}
                {googleAccount.customer_id ? ` · Account ${googleAccount.customer_id}` : ' · No account selected'}
              </button>
              {googlePickerOpen && (
                <>
                <AnchoredPanel anchorRef={googleAnchorRef} onClose={() => setGooglePickerOpen(false)}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff', marginBottom: '10px' }}>Google Ads account</div>
                  {googlePickerBusy ? (
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Loading…</p>
                  ) : (
                    <>
                      <span style={label}>Customer account</span>
                      <select style={{ ...input, padding: '8px 10px', fontSize: '13px', marginBottom: '12px' }}
                        value={googleAccount.customer_id || ''} onChange={e => selectGoogleAccount(e.target.value)}>
                        <option value="" disabled>{googleAdAccounts && googleAdAccounts.length ? 'Choose an account' : 'No accounts found'}</option>
                        {/* Managers are labelled because Google returns them in the same
                            list as real ad accounts, and picking one fails only at publish. */}
                        {(googleAdAccounts || []).map(a => (
                          <option key={a.customer_id} value={a.customer_id}>
                            {a.name} ({a.customer_id}){a.manager ? ' — manager, cannot run ads' : ''}
                          </option>
                        ))}
                      </select>
                      {/* The API returns only accounts this Google user can already reach
                          (customers:listAccessibleCustomers). An empty list means there is no
                          Ads account to publish into — which the old "No accounts found"
                          option stated without saying why or what to do about it. */}
                      {googleAccountsError && (
                        <div style={{ display: 'flex', gap: '8px', padding: '10px 12px', borderRadius: '10px', background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.3)', marginBottom: '10px' }}>
                          <AlertTriangle size={13} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: '2px' }} />
                          {/* The token error is about Raftra's own Google API access, not
                              anything this user can fix — so it is translated rather than
                              shown raw. Other failures (account disabled, no permission) are
                              genuinely theirs to act on and stay verbatim. */}
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            {googleTokenBlocked
                              ? "Google Ads isn't available yet — we're waiting on Google to approve Raftra's access. You can still publish to Meta in the meantime."
                              : googleAccountsError}
                          </span>
                        </div>
                      )}

                      {!googleAccountsError && googleAdAccounts && googleAdAccounts.length === 0 && (
                        <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'var(--warning-glow)', border: '1px solid rgba(255,174,0,0.3)', marginBottom: '10px' }}>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--warning)', marginBottom: '6px' }}>NO ADS ACCOUNT REACHABLE</div>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.55, display: 'block' }}>
                            This Google login doesn't have access to any Google Ads account yet.
                            Create one at{' '}
                            <a href="https://ads.google.com" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>ads.google.com</a>,
                            then come back and press Refresh.
                          </span>
                        </div>
                      )}

                      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '10px', lineHeight: 1.5 }}>
                        {/* Was: "Publishing below still runs in demo mode until that's wired up."
                            Real Google publishing landed (workspace_routes.py launches a full
                            PAUSED Search campaign), so that line told the user a working
                            feature did not exist. */}
                        Choose the account this campaign should run in. Your ad is always created{' '}
                        <b style={{ color: '#fff' }}>paused</b>, so nothing is charged until you switch it
                        on in Google Ads.
                      </p>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                        <button onClick={loadGoogleAdAccounts} style={{ ...btnGhost, flex: 1, padding: '7px', fontSize: '12px' }}><RefreshCw size={12} /> Refresh list</button>
                        <button onClick={() => disconnectPlatform('google')} disabled={metaPickerBusy}
                          style={{ ...btnGhost, flex: 1, padding: '7px', fontSize: '12px', color: '#ff5c5c', borderColor: 'rgba(255,92,92,0.3)' }}>
                          Disconnect
                        </button>
                      </div>
                    </>
                  )}
                </AnchoredPanel>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={connectGoogleAds}
              onMouseEnter={() => prefetchAuthUrl('google')}
              onFocus={() => prefetchAuthUrl('google')}
              disabled={connecting === 'google'}
              style={{ ...btnGhost, color: '#8B85FF', borderColor: 'rgba(90,82,255,0.4)' }}
            >
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ffae00', display: 'inline-block' }} />
              {connecting === 'google' ? 'Opening Google Ads…' : 'Connect Google Ads account'}
            </button>
          )}
          {campaign && !published && <button onClick={startNewCampaign} style={btnGhost}><Sparkles size={14} /> New Campaign</button>}
          <input type="file" ref={importRef} accept=".json" style={{ display: 'none' }} onChange={importCampaign} />
          <button onClick={() => importRef.current?.click()} style={btnGhost}><FileUp size={14} /> Import</button>
          <button onClick={exportCampaign} style={btnGhost}><Download size={14} /> Export</button>
        </div>
      </div>

      {/* ── Published banner: shown after publish; the flow below becomes read-only ── */}
      {published && (
        <div style={{ ...card, borderColor: 'rgba(0,230,118,0.35)', background: 'rgba(0,230,118,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ ...sectionTitle, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '9px' }}>
                <CheckCircle2 size={18} color="#00e676" /> {campaign.name || 'Campaign'} <Pill status="Published" />
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>Version {campaign.version || 1}</span>
                {/* Per-platform publish mode. A real campaign must never read as DEMO, and a
                    mock one must never read as REAL — so this comes from published_modes
                    rather than being assumed. */}
                {(spec.published_platforms || []).map((p: string) => (
                  <Pill key={p} status={(spec.published_modes || {})[p] === 'real' ? 'REAL' : 'DEMO'}
                    label={`${p === 'meta' ? 'Meta' : 'Google'}: ${(spec.published_modes || {})[p] === 'real' ? 'REAL' : 'DEMO'}`} />
                ))}
              </h3>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <span>Platforms: <b style={{ color: '#fff' }}>{(spec.published_platforms || []).map((p: string) => p === 'meta' ? 'Meta' : 'Google').join(' & ') || '—'}</b></span>
                <span>Budget: <b style={{ color: '#fff' }}>{money(spec.total_budget || campaign.budget)}</b></span>
                <span>Published: <b style={{ color: '#fff' }}>{spec.published_at ? new Date(spec.published_at).toLocaleString() : '—'}</b></span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                {Object.entries(spec.campaign_ids || {}).map(([p, id]) => (
                  <span key={p}>{p === 'meta' ? 'Meta' : 'Google'} ID: <code style={{ color: '#8B85FF' }}>{String(id)}</code></span>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button onClick={createNewVersion} disabled={busy === 'version'} className="btn btn-primary" style={btnPrimary}>
                <GitBranch size={14} /> {busy === 'version' ? 'Creating…' : 'Create New Version'}
              </button>
              <button onClick={() => duplicateCampaign(campaign.id)} disabled={busy === 'duplicate'} style={btnGhost}><Copy size={14} /> Duplicate</button>
              <button onClick={() => viewAnalytics(campaign.id)} disabled={busy === 'analytics'} style={btnGhost}><BarChart3 size={14} /> {busy === 'analytics' ? 'Loading…' : 'View Analytics'}</button>
              <button onClick={startNewCampaign} style={btnGhost}><Sparkles size={14} /> New Campaign</button>
            </div>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '10px' }}>
            This version is <b>read-only</b>. To change anything, click <b>Create New Version</b> — the previous version stays intact.
          </p>
        </div>
      )}

      {/* ── 1. performance & action feed (sample data) ── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
          <h3 style={{ ...sectionTitle, display: 'flex', alignItems: 'center', gap: '9px', marginBottom: 0 }}>
            <Activity size={17} color="var(--primary)" /> Daily Performance &amp; AI Action Feed
          </h3>
          <Pill status={liveFeed && liveFeed.length > 0 ? 'LIVE' : 'SAMPLE'} />
        </div>
        <p style={{ ...sectionHint, marginBottom: '14px' }}>
          {liveFeed && liveFeed.length > 0
            ? `From your Meta delivery over the last 7 days${feedSummary ? ` — ${feedSummary.campaigns_analyzed} campaign${feedSummary.campaigns_analyzed === 1 ? '' : 's'}, ${money(feedSummary.total_spend)} spent, blended ROAS ${Number(feedSummary.blended_roas || 0).toFixed(2)}× against a ${Number(feedSummary.target_roas || 0).toFixed(1)}× target` : ''}.`
            : metaAccount.connected
              ? 'Meta is connected but has no delivery data for the last 7 days yet, so these are example rows showing the format. Real decisions appear here once campaigns start spending.'
              : 'Once campaigns are live this shows what to scale, rotate or kill from real numbers. These are example rows so you can see the format.'}
        </p>

        {liveFeed && liveFeed.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: '16px' }}>
            {liveFeed.map((r: any, i: number) => {
              const st = SIGNAL_STYLE[r.signal] || SIGNAL_STYLE.learning;
              const Icon = st.icon;
              const metrics = formatEvidence(r.evidence);
              return (
                <div key={r.campaign_id || i} style={{ padding: '18px', background: st.bg, border: `1px solid ${st.bd}`, borderRadius: '13px', display: 'flex', flexDirection: 'column', gap: '13px' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: st.color, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '7px' }}>
                      <Icon size={14} color={st.color} /> {r.title || st.tag}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>{r.campaign_name}</div>
                    {metrics && (
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginBottom: '8px' }}>{metrics}</div>
                    )}
                    <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>{r.detail}</div>
                    {r.expected && (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.5 }}>{r.expected}</div>
                    )}
                  </div>
                  {/* Applying a recommendation changes budget or pauses delivery on a live ad
                      account. The endpoints exist, but spending real money from a click needs
                      a deliberate decision, so this reads out rather than acts for now. */}
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', borderTop: `1px solid ${st.bd}`, paddingTop: '9px' }}>
                    Apply this in Meta Ads Manager — one-click actions are not wired up yet.
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: '16px' }}>
          {sampleFeed.map(f => {
            const done = executed.includes(f.id);
            const Icon = f.icon;
            return (
              <div key={f.id} style={{ padding: '18px', background: f.bg, border: `1px solid ${f.bd}`, borderRadius: '13px', display: 'flex', flexDirection: 'column', gap: '13px', opacity: done ? 0.55 : 1 }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: f.color, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '7px' }}>
                    <Icon size={14} color={f.color} /> {f.tag}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>{f.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginBottom: '8px' }}>{f.metrics}</div>
                  <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>{f.rec}</div>
                </div>
                <button onClick={() => { setExecuted(e => [...e, f.id]); flash('Example action — connect a live ad account to apply this for real.', false); }}
                  disabled={done}
                  /* Tinted fill + coloured text rather than a solid saturated slab, so the
                     semantic colour still reads (scale/rotate/kill/pivot) without four
                     loud blocks fighting the rest of the workspace. */
                  style={{ padding: '9px 12px', background: done ? 'rgba(255,255,255,0.06)' : `${f.color}1F`, color: done ? 'var(--text-muted)' : f.color, border: done ? '1px solid rgba(255,255,255,0.10)' : `1px solid ${f.color}59`, borderRadius: '100px', fontSize: '12px', fontWeight: 700, cursor: done ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.2s ease' }}>
                  {done ? 'Applied (example)' : <>{f.act} <ArrowRight size={13} /></>}
                </button>
              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* ── 2. the progress bar ── */}
      <div style={{ ...card, padding: '18px 20px' }}>
        {/* Grid, not wrapping flex. With `flex: 1 1 150px` plus interleaved "›" glyphs the
            seventh step could not fit on the first row, wrapped alone, and then flex-grow
            stretched it across the full width — with a chevron left pointing at nothing at
            the end of the row above. Equal grid tracks wrap uniformly, and the numbered
            tiles already carry the sequence, so the separators are no longer needed. */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(132px, 100%), 1fr))',
          gap: '10px',
          alignItems: 'stretch',
        }}>
          {steps.map((st) => (
            /* Tinted state treatment rather than solid fills: the active/completed
               colour lives in the numbered tile's tint + border and in the status
               label, so seven steps in a row read as a progress trail instead of
               seven coloured blocks. Locked steps stay near-invisible on purpose. */
            <div key={st.n} style={{
              display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '12px',
              background: st.s === 'Locked' ? 'transparent' : `${stepColor(st.s)}12`,
              border: `1px solid ${st.s === 'Locked' ? 'rgba(255,255,255,0.06)' : `${stepColor(st.s)}38`}`,
              opacity: st.s === 'Locked' ? 0.55 : 1,
              minWidth: 0, transition: 'all 0.2s ease',
            }}>
              <span style={{
                width: '28px', height: '28px', borderRadius: '9px', flexShrink: 0,
                background: st.s === 'Locked' ? 'rgba(255,255,255,0.05)' : `${stepColor(st.s)}22`,
                border: `1px solid ${st.s === 'Locked' ? 'rgba(255,255,255,0.10)' : `${stepColor(st.s)}55`}`,
                color: st.s === 'Locked' ? 'var(--text-secondary)' : stepColor(st.s),
                fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {st.s === 'Completed' ? <Check size={14} /> : st.n}
              </span>
              <div style={{ lineHeight: 1.35, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{st.name}</div>
                <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.03em', color: stepColor(st.s) }}>{st.s}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3. brief + generated strategy (with its image) ── */}
      {/* alignItems:start so the shorter brief card keeps its natural height instead of
          stretching to match the long strategy output (which left a big empty gap). */}
      <div className="camp-split">
        {/* brief */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'rgba(255,189,46,0.15)', border: '1px solid rgba(255,189,46,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Sparkles size={18} color="#FFBD2E" />
              </div>
              <h3 style={{ ...sectionTitle, marginBottom: 0 }}>AI Ideation &amp; Strategist</h3>
            </div>
            <Pill status={campaign ? 'Completed' : 'Pending'} />
          </div>
          <p style={{ ...sectionHint, marginBottom: '18px' }}>Start from a playbook or fill in your own brief. This is the only form you need.</p>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', color: '#FFBD2E', background: 'rgba(255,189,46,0.12)', border: '1px solid rgba(255,189,46,0.3)', borderRadius: '100px', padding: '4px 12px', marginBottom: '10px' }}>
            <Sparkles size={11} /> QUICK-START PLAYBOOKS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
            {presets.map(p => {
              const Icon = p.icon;
              // color/fontFamily below are set explicitly: a <button> does not inherit them
              // from the page, so without them the title rendered in the UA's default
              // near-black on this dark card and was invisible.
              return (
                <button key={p.id} onClick={() => { setForm(f => ({ ...f, ...p.p })); flash(`"${p.title}" loaded — tweak anything, then generate.`); }}
                  style={{ textAlign: 'left', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '12px', padding: '14px', cursor: 'pointer', color: 'var(--text-primary)', fontFamily: 'inherit', transition: 'all 0.2s ease' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,189,46,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,189,46,0.35)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '24px', height: '24px', borderRadius: '7px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,189,46,0.14)', border: '1px solid rgba(255,189,46,0.3)' }}>
                        <Icon size={13} color="#FFBD2E" />
                      </span>
                      {p.title}
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em', color: '#FFBD2E', background: 'rgba(255,189,46,0.12)', border: '1px solid rgba(255,189,46,0.3)', padding: '3px 9px', borderRadius: '100px', whiteSpace: 'nowrap', flexShrink: 0 }}>{p.badge}</span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{p.desc}</p>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
            <div><span style={label}>Campaign idea / theme</span><input style={input} value={form.campaignFocus} onChange={e => setForm(f => ({ ...f, campaignFocus: e.target.value }))} placeholder="e.g. Diwali Festive Sale" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><span style={label}>Objective</span>
                <select style={input} value={form.objective} onChange={e => setForm(f => ({ ...f, objective: e.target.value }))}>
                  <option>Conversions</option><option>Traffic</option><option>Lead Generation</option><option>Brand Awareness</option><option>Engagement</option>
                </select>
              </div>
              <div><span style={label}>Total budget (₹)</span><input type="number" style={input} value={form.budget} onChange={e => setForm(f => ({ ...f, budget: Number(e.target.value) }))} /></div>
            </div>
            <div><span style={label}>Who are we targeting?</span><textarea style={{ ...input, minHeight: '62px', resize: 'vertical' }} value={form.audience} onChange={e => setForm(f => ({ ...f, audience: e.target.value }))} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><span style={label}>Funnel stage</span>
                <select style={input} value={form.funnel} onChange={e => setForm(f => ({ ...f, funnel: e.target.value }))}>
                  <option>Top of Funnel</option><option>Middle of Funnel</option><option>Bottom of Funnel</option>
                </select>
              </div>
              <div><span style={label}>Geo granularity</span>
                <select style={input} value={form.geoTargetingLevel} onChange={e => setForm(f => ({ ...f, geoTargetingLevel: e.target.value }))}>
                  <option>Pincode-Level</option><option>City-Level</option><option>State-Level</option><option>Country-Level</option>
                </select>
              </div>
            </div>
            <div><span style={label}>Places to run it</span><input style={input} value={form.placement} onChange={e => setForm(f => ({ ...f, placement: e.target.value }))} placeholder="e.g. Maharashtra, Delhi" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><span style={label}>Schedule</span><input style={input} value={form.schedule} onChange={e => setForm(f => ({ ...f, schedule: e.target.value }))} /></div>
              <div><span style={label}>Tracking (UTM)</span><input style={input} value={form.tracking} onChange={e => setForm(f => ({ ...f, tracking: e.target.value }))} /></div>
            </div>
            <button onClick={generate} disabled={isGenerating} className="btn btn-primary" style={{ ...btnPrimary, opacity: isGenerating ? 0.7 : 1, cursor: isGenerating ? 'wait' : 'pointer' }}>
              <Sparkles size={15} /> {isGenerating ? 'Writing your strategy & ad…' : campaign ? 'Regenerate Strategy' : 'Generate Strategy + Ad'}
            </button>
          </div>
        </div>

        {/* generated strategy + image together */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', gap: '10px', flexWrap: 'wrap' }}>
            <h3 style={{ ...sectionTitle, marginBottom: 0 }}>Your AI Strategy &amp; Ad</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {campaign && whyRows.length > 0 && (
                <button onClick={() => setWhyOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#b3aaff', background: 'rgba(90,82,255,0.1)', border: '1px solid rgba(90,82,255,0.35)', borderRadius: '8px', padding: '7px 12px', cursor: 'pointer' }}>
                  <Sparkles size={13} /> Why AI recommended this
                </button>
              )}
              <Pill status={!campaign ? 'Pending' : approved ? 'Approved' : 'Needs approval'} />
            </div>
          </div>
          <p style={{ ...sectionHint, marginBottom: '16px' }}>
            {!campaign ? 'Nothing generated yet.' : approved
              ? 'Approved — this exact plan is what Meta, Google and publishing below are using.'
              : 'Check the plan and the ad image. Keep the image or generate a new one, then approve.'}
          </p>

          {!campaign ? (
            <div style={{ padding: '34px 20px', textAlign: 'center', border: '1px dashed var(--border, var(--border-color))', borderRadius: '11px' }}>
              <Sparkles size={26} color="var(--primary)" style={{ opacity: 0.6, marginBottom: '10px' }} />
              <p style={{ ...sectionHint }}>Fill the brief on the left and press <b style={{ color: '#fff' }}>Generate Strategy + Ad</b>.<br />You'll get the plan, budget split, keywords and a ready ad image here.</p>
            </div>
          ) : (
            <>
              {/* the ad image — pick the one creative that flows into the platform reviews */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', width: '150px', height: '150px', borderRadius: '11px', overflow: 'hidden', background: '#000', border: '1px solid var(--border, var(--border-color))', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {selectedImage ? (
                      <>
                        <img src={selectedImage} alt="Selected ad" {...previewable(selectedImage, { width: '100%', height: '100%', objectFit: 'cover' })} />
                        {/* The expand badge is the only hint that the creative opens larger —
                            without it nothing on a static image says it is clickable. */}
                        <span onClick={() => setPreviewImage(selectedImage)} title="Click to preview full size"
                          style={{ position: 'absolute', bottom: '6px', right: '6px', width: '24px', height: '24px', borderRadius: '7px', background: 'rgba(0,0,0,0.62)', border: '1px solid rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-in' }}>
                          <Maximize2 size={12} color="#fff" />
                        </span>
                      </>
                    ) : <ImageIcon size={26} color="var(--text-muted)" />}
                  </div>
                  <div style={{ flex: 1, minWidth: '160px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '9px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {selectedImage ? 'This is the approved creative. Only this image is sent to the platform reviews below.' : 'Pick or upload the image you want to advertise.'}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {selectedImage && (
                        <button onClick={() => downloadCreative(selectedImage)}
                          disabled={busy === 'download'}
                          style={{ ...btnGhost, padding: '8px 12px', fontSize: '12px' }}>
                          <Download size={13} /> {busy === 'download' ? 'Downloading…' : 'Download'}
                        </button>
                      )}
                      <button onClick={regenerateImage} disabled={busy === 'image'} style={{ ...btnGhost, padding: '8px 12px', fontSize: '12px' }}>
                        <RefreshCw size={13} /> {busy === 'image' ? 'Generating…' : 'New image'}
                      </button>
                      <button onClick={() => uploadImageRef.current?.click()} style={{ ...btnGhost, padding: '8px 12px', fontSize: '12px' }}>
                        <Upload size={13} /> Upload
                      </button>
                      <input ref={uploadImageRef} type="file" accept="image/*" onChange={onUploadImage} style={{ display: 'none' }} />
                    </div>
                  </div>
                </div>

                {/* selectable thumbnails: generated + uploaded + library */}
                {allImages.length > 0 && (
                  <>
                    {/* The library can run to dozens of assets. Showing them all turned this
                        into a wall of near-identical thumbnails, so it's capped until asked. */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', margin: '16px 0 9px' }}>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Choose the creative to advertise <span style={{ color: 'var(--text-muted)' }}>— click to approve</span>
                      </div>
                      {allImages.length > GALLERY_PREVIEW_COUNT && (
                        <button onClick={() => setGalleryExpanded(g => !g)}
                          style={{ ...btnGhost, padding: '5px 12px', fontSize: '12px' }}>
                          {galleryExpanded ? 'Show fewer' : `Show all ${allImages.length}`}
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      {(galleryExpanded ? allImages : allImages.slice(0, GALLERY_PREVIEW_COUNT)).map((src, i) => {
                        const active = selectedImage === src;
                        const label = src === heroImage ? 'AI generated' : uploadedImages.includes(src) ? 'Uploaded' : 'Library';
                        return (
                          <button key={i} onClick={() => setSelectedImage(src)} title={label}
                            style={{ position: 'relative', width: '72px', height: '72px', padding: 0, borderRadius: '12px', overflow: 'hidden', cursor: 'pointer',
                              border: active ? '2px solid #FFBD2E' : '1px solid rgba(255,255,255,0.12)',
                              boxShadow: active ? '0 0 0 3px rgba(255,189,46,0.22)' : 'none', background: '#000', transition: 'all 0.2s ease' }}>
                            <img src={src} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: active ? 1 : 0.7 }} />
                            {/* Clicking a thumbnail approves it — that is its job — so previewing
                                gets its own badge, and must not bubble into the approve click. */}
                            <span onClick={e => { e.stopPropagation(); setPreviewImage(src); }} title="Preview full size"
                              style={{ position: 'absolute', top: '4px', left: '4px', width: '18px', height: '18px', borderRadius: '6px', background: 'rgba(0,0,0,0.62)', border: '1px solid rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-in' }}>
                              <Maximize2 size={10} color="#fff" />
                            </span>
                            {/* Source is shown, not just a tooltip — with a mixed set of AI,
                                uploaded and library assets they were indistinguishable. */}
                            {label !== 'Library' && (
                              <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, fontSize: '10px', fontWeight: 700, letterSpacing: '0.03em', textAlign: 'center', padding: '2px 0',
                                color: label === 'AI generated' ? '#FFBD2E' : '#00E676',
                                background: 'rgba(0,0,0,0.72)' }}>
                                {label === 'AI generated' ? 'AI' : 'UPLOAD'}
                              </span>
                            )}
                            {active && (
                              <span style={{ position: 'absolute', top: '4px', right: '4px', background: '#FFBD2E', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Check size={11} color="#12121c" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* the plan */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(210px, 100%), 1fr))', gap: '18px' }}>
                <div>
                  <Row k="Objective" v={campaign.objective || spec.objective || '—'} />
                  <SplitBar meta={split.meta} google={split.google} fmt={money} />
                  <Row k="Runs for" v={spec.duration_label || form.schedule} />
                  {spec.geo_targeting && (
                    <Row k="Targeting" v={`${spec.geo_targeting.level || 'Country-Level'}${(spec.geo_targeting.locations || []).length ? ` · ${spec.geo_targeting.locations.join(', ')}` : ''}`} />
                  )}
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Success targets</div>
                  {(spec.kpis || []).map((k: string) => <KpiRow key={k} text={k} />)}
                  <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '14px 0 8px' }}>Keywords it will target</div>
                  {/* Was a hard slice(0, 8) with no way to see the rest — the remaining
                      keywords were simply unreachable. */}
                  <ChipList items={keywords} preview={8} />
                  {(headlines.length > 0 || descriptions.length > 0) && (
                    /* Two counts, so show them as counts — the sentence form buried the
                       only two numbers a reader is looking for. */
                    <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
                      {[{ n: headlines.length, l: 'headlines' }, { n: descriptions.length, l: 'descriptions' }].map(x => (
                        <span key={x.l} style={{ display: 'inline-flex', alignItems: 'baseline', gap: '6px', padding: '6px 11px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border, var(--border-color))' }}>
                          <b style={{ fontSize: '15px', color: '#fff', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{x.n}</b>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{x.l}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <AudienceBlock text={spec.audience || form.audience} />

              <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
                <button onClick={copyStrategy} style={{ ...btnGhost, padding: '8px 12px', fontSize: '12px' }}>
                  {isCopied ? <Check size={13} color="#00e676" /> : <Copy size={13} />} {isCopied ? 'Copied' : 'Copy plan'}
                </button>
              </div>

              {!approved ? (
                <button onClick={approve} disabled={busy === 'approve'} style={{ width: '100%', marginTop: '12px', background: '#00e676', border: 'none', color: '#03121a', padding: '13px', borderRadius: '9px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <ShieldCheck size={16} /> {busy === 'approve' ? 'Approving…' : 'Approve & send to all steps'}
                </button>
              ) : (
                <div style={{ marginTop: '12px', padding: '11px 14px', background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: '9px', fontSize: '13px', color: '#00e676', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={15} /> Approved — passed to Meta, Google and Review below.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── 4. select platforms ── */}
      <Gated locked={!approved || published} why={published ? 'Published — read-only. Create a new version to change platforms.' : 'Approve the strategy first to choose platforms'}>
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ minWidth: '190px', flex: '0 1 auto' }}>
            <h3 style={{ ...sectionTitle, marginBottom: '2px' }}>Selected Platforms</h3>
            <p style={sectionHint}>Tick where this strategy should run.</p>
          </div>
          {([{ k: 'meta' as const, name: 'Meta Ads', sub: 'Facebook & Instagram' },
             { k: 'google' as const, name: 'Google Ads', sub: 'Search & Display' }]).map(p => {
            const on = platforms[p.k];
            return (
              <label key={p.k} style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '13px 16px', borderRadius: '11px', border: `1px solid ${on ? 'rgba(0,230,118,0.45)' : 'var(--border, var(--border-color))'}`, background: on ? 'rgba(0,230,118,0.06)' : 'rgba(255,255,255,0.02)', cursor: 'pointer', minWidth: '205px' }}>
                <input type="checkbox" checked={on} onChange={e => { const np = { ...platforms, [p.k]: e.target.checked }; setPlatforms(np); persistPlatforms(np); setConfirmed(false); }}
                  style={{ width: '17px', height: '17px', accentColor: '#00e676', cursor: 'pointer', flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '14px', fontWeight: 600 }}>{p.name}</span>
                  <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)' }}>{p.sub}</span>
                </span>
                {on && <CheckCircle2 size={17} color="#00e676" />}
              </label>
            );
          })}
          <div style={{ flex: 1, minWidth: '215px', fontSize: '12px', color: 'var(--text-secondary)', background: 'rgba(90,82,255,0.06)', border: '1px solid rgba(90,82,255,0.2)', borderRadius: '10px', padding: '12px 14px', lineHeight: 1.55 }}>
            <b style={{ color: '#fff' }}>Edit each platform on its own.</b> Same approved strategy — different ads per platform.
          </div>
        </div>
      </Gated>

      {/* ── 5. per-platform review ── */}
      <Gated locked={!approved || published} why={published ? 'Published — read-only. Create a new version to edit the ads.' : 'Approve the strategy to review platform ads'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Meta + Google sit side-by-side when both are selected, full-width when only one. */}
          <div style={{ display: 'grid', gridTemplateColumns: (platforms.meta && platforms.google) ? 'repeat(auto-fit, minmax(min(330px, 100%), 1fr))' : '1fr', gap: '18px' }}>

          {/* META */}
          {platforms.meta && (
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <h3 style={{ ...sectionTitle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Meta Ads Review <Pill status={metaAccount.ready_to_publish && !metaBlockers.length ? 'REAL' : 'MOCK'} />
                </h3>
                <Pill status={metaBlockers.length ? 'Blocked' : metaSetup.launched ? 'Ready' : 'Pending'} />
              </div>
              <p style={{ ...sectionHint, marginTop: '-8px', marginBottom: '12px' }}>
                What will run on Facebook and Instagram. The ad account is connected in the header above.
              </p>
              {/* Same panel Google's card shows. It used to live only in the Meta connection
                  section further down, so this card said "Blocked" without saying why. */}
              {metaBlockers.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '12px', padding: '10px 12px', borderRadius: '10px', background: 'var(--warning-glow)', border: '1px solid rgba(255,174,0,0.3)' }}>
                  {metaBlockers.map(b => (
                    <span key={b.label} style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', fontSize: '12px', color: 'var(--warning)', lineHeight: 1.5 }}>
                      <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span><b>{b.label}.</b> <span style={{ color: 'var(--text-secondary)' }}>{b.fix}</span></span>
                    </span>
                  ))}
                </div>
              )}
              <MetaAdPreview
                image={selectedImage || undefined}
                pageName={metaAccount.page_name || undefined}
                primary={metaCopy.primary_text}
                headline={metaCopy.headline}
                cta={metaCopy.cta}
                url={spec.landing_page || undefined}
              />

              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '16px 0 2px' }}>
                Campaign setup
              </div>
              <Row k="Campaign name" v={campaign?.name || '—'} />
              <Row k="Objective" v={campaign?.objective || '—'} />
              <Row k="Budget" v={split.meta ? money(split.meta.amount) : '—'} />
              <Row k="Ad format" v={`Image ads (${selectedImage ? 1 : 0})`} />

              {/* The ad copy that is actually published to Meta. It was previously not shown
                  anywhere: publish() sends metaCopy.primary_text / headline / cta, so the
                  user was approving Meta copy sight-unseen while reviewing Google's in full.
                  Limits are Meta's recommended maximums. */}
              <div style={{ marginTop: '12px', marginBottom: '4px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '2px' }}>
                  Ad copy
                </div>
                <CopyField label="Primary text" value={metaCopy.primary_text} limit={125} />
                <CopyField label="Headline" value={metaCopy.headline} limit={40} />
                <CopyField label="Call to action" value={metaCopy.cta} />
              </div>

              <AudienceBlock text={spec.audience || form.audience} />
              <Row k="Placements" v={
                <span style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {String(spec.placements || form.placement).split(',').map((pl, i) => (
                    <span key={i} style={{ fontSize: '11px', background: 'rgba(255,255,255,0.07)', borderRadius: '6px', padding: '3px 9px' }}>{pl.trim()}</span>
                  ))}
                </span>} stack />
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '7px' }}>Creatives</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {selectedImage ? (
                    <img src={selectedImage} alt="Approved creative" {...previewable(selectedImage, { width: '68px', height: '68px', objectFit: 'cover', borderRadius: '9px', border: '1px solid var(--border, var(--border-color))' })} />
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No creative selected — approve one above.</span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '15px', flexWrap: 'wrap' }}>
                {!metaSetup.launched ? (
                  <button onClick={() => markPlatformReady('meta')} disabled={!!busy?.startsWith('meta-')} className="btn btn-primary" style={{ ...btnPrimary, flex: 1, padding: '10px' }}>
                    <Check size={14} /> {busy?.startsWith('meta-') ? 'Marking…' : 'Mark as Ready'}
                  </button>
                ) : (
                  <span style={{ flex: 1, fontSize: '12px', color: '#00e676', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: '9px', padding: '10px' }}>
                    <CheckCircle2 size={14} /> Ready to publish
                  </span>
                )}
              </div>
            </div>
          )}

          {/* GOOGLE */}
          {platforms.google && (
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <h3 style={{ ...sectionTitle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>Google Ads Review <Pill status={googleReadyToPublish && !googleBlockers.length ? 'REAL' : 'MOCK'} /></h3>
                <Pill status={googleBlockers.length ? 'Blocked' : googleSetup.launched ? 'Ready' : 'Pending'} />
              </div>
              <p style={{ ...sectionHint, marginTop: '-8px', marginBottom: '12px' }}>
                {googleReadyToPublish
                  ? 'How your ad will look on Google Search. It is created paused, so nothing is charged until you switch it on in Google Ads.'
                  : 'How your ad would look on Google Search. Connect your Google Ads account above to actually run it — for now this is a preview only.'}
              </p>
              {/* Says which of the two prerequisites is missing rather than leaving the MOCK
                  pill unexplained. Both are exactly what the publish route checks. */}
              {(!googleReadyToPublish || googleBlockers.length > 0) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '12px', padding: '10px 12px', borderRadius: '10px', background: 'var(--warning-glow)', border: '1px solid rgba(255,174,0,0.3)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: googleAccount.connected ? 'var(--success)' : 'var(--warning)' }}>
                    {googleAccount.connected ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />} Google Ads account connected
                  </span>
                  {/* Everything the publish route validates, checked here instead of after
                      the request: too-long copy, a missing landing page and a zero budget
                      are all hard rejections, not warnings. */}
                  {googleBlockers.map(b => (
                    <span key={b.label} style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', fontSize: '12px', color: 'var(--warning)', lineHeight: 1.5 }}>
                      <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span><b>{b.label}.</b> <span style={{ color: 'var(--text-secondary)' }}>{b.fix}</span></span>
                    </span>
                  ))}
                  {googleAccount.connected && googleBlockers.length === 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: 'var(--success)' }}>
                      <CheckCircle2 size={13} /> Ready to publish
                    </span>
                  )}
                </div>
              )}
              <div style={{ padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Campaign type</div>
                <select value={googleType} onChange={e => setGoogleTypeOverride(e.target.value)}
                  style={{ ...input, padding: '8px 10px', fontSize: '13px', width: '100%' }}>
                  {GOOGLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {(rec.google_campaign_type && rec.google_campaign_type.reason) && (
                  <div style={{ display: 'flex', gap: '7px', marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                    <Sparkles size={13} color="var(--primary)" style={{ flexShrink: 0, marginTop: '1px' }} />
                    <span>
                      {googleType === aiGoogleType
                        ? <><b style={{ color: '#b3aaff' }}>Why {aiGoogleType}?</b> {rec.google_campaign_type.reason}</>
                        : <>AI recommended <b style={{ color: '#b3aaff' }}>{aiGoogleType}</b> — {rec.google_campaign_type.reason} You've switched to <b style={{ color: '#b3aaff' }}>{googleType}</b>.</>}
                    </span>
                  </div>
                )}
              </div>
              <Row k="Campaign name" v={campaign?.name || '—'} />
              <GoogleAdPreview
                url={spec.landing_page || undefined}
                headlines={headlines}
                descriptions={descriptions}
              />

              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '16px 0 2px' }}>
                Campaign setup
              </div>
              <Row k="Budget" v={split.google ? money(split.google.amount) : '—'} />
              {/* Was `spec.landing_page || form.tracking` — with no landing page set this
                  showed the UTM string ("utm_source=ai_agent") as the landing page. */}
              {gt.includes('search') && <Row k="Landing page" v={spec.landing_page || '—'} />}
              <Row k="Tracking (UTM)" v={form.tracking || '—'} />
              {gShow.keywords && <Row k={`Keywords (${keywords.length})`} v={chips(keywords)} stack />}
              {gShow.extensions && <Row k="Extensions" v={chips(g.extensions || [])} stack />}
              <Row k={`Headlines (${headlines.length})`} v={
                <CopyList items={headlines} limit={30} noun="headlines" preview={3} />} stack />
              <Row k={`Descriptions (${descriptions.length})`} v={
                <CopyList items={descriptions} limit={90} noun="descriptions" preview={2} />} stack />
              {gShow.images && <Row k="Images" v={
                <span style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedImage
                    ? <img src={selectedImage} alt="Approved creative" {...previewable(selectedImage, { width: '68px', height: '68px', objectFit: 'cover', borderRadius: '9px', border: '1px solid var(--border, var(--border-color))' })} />
                    : <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No creative selected — approve one above.</span>}
                  {(g.image_ideas || []).length ? chips(g.image_ideas) : null}
                </span>} stack />}
              {gShow.videos && <Row k="Videos" v={chips((g.video_ideas || []).length ? g.video_ideas : ['Video placeholder (optional)'])} stack />}
              {gShow.signals && <Row k="Audience signals" v={chips(g.audience_signals || [])} stack />}
              {gShow.images && <Row k="CTA" v={g.cta || (rec.cta && rec.cta.value) || '—'} />}
              <div style={{ display: 'flex', gap: '8px', marginTop: '15px', flexWrap: 'wrap' }}>
                {!googleSetup.launched ? (
                  <button onClick={() => markPlatformReady('google')} disabled={!!busy?.startsWith('google-')} className="btn btn-primary" style={{ ...btnPrimary, flex: 1, padding: '10px' }}>
                    <Check size={14} /> {busy?.startsWith('google-') ? 'Marking…' : 'Mark as Ready'}
                  </button>
                ) : (
                  <span style={{ flex: 1, fontSize: '12px', color: '#00e676', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: '9px', padding: '10px' }}>
                    <CheckCircle2 size={14} /> Ready to publish
                  </span>
                )}
              </div>
            </div>
          )}

          </div>

          {/* OPTIMIZATION RULES — full width, below the platform reviews */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <h3 style={{ ...sectionTitle, marginBottom: 0 }}>Campaign Optimization Rules</h3>
              <Pill status="Configured" />
            </div>
            <p style={{ ...sectionHint, marginBottom: '14px' }}>Safety limits applied once ads are live, so a bad ad gets stopped early.</p>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}><XCircle size={15} color="#ffae00" /> Auto-kill bad ads</span>
              <label className="toggle-switch"><input type="checkbox" checked={smart.killAds} onChange={e => setSmart(s => ({ ...s, killAds: e.target.checked }))} /><span className="slider" /></label>
            </div>
            {smart.killAds && (<>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Kill if CPA over (₹)</span>
                <input type="number" value={smart.cpaThreshold} onChange={e => setSmart(s => ({ ...s, cpaThreshold: Number(e.target.value) }))} style={{ ...input, width: '104px', padding: '7px 10px', textAlign: 'right' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Kill if frequency over</span>
                <input type="number" step="0.1" value={smart.frequencyCap} onChange={e => setSmart(s => ({ ...s, frequencyCap: Number(e.target.value) }))} style={{ ...input, width: '104px', padding: '7px 10px', textAlign: 'right' }} />
              </div>
            </>)}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', marginTop: '4px' }}>
              <span style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}><RefreshCw size={15} color="var(--primary)" /> Smart creative rotation</span>
              <label className="toggle-switch"><input type="checkbox" checked={smart.autoRotate} onChange={e => setSmart(s => ({ ...s, autoRotate: e.target.checked }))} /><span className="slider" /></label>
            </div>
            {smart.autoRotate && (<>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Rotate if skip rate over (%)</span>
                <input type="number" value={smart.skipRateThreshold} onChange={e => setSmart(s => ({ ...s, skipRateThreshold: Number(e.target.value) }))} style={{ ...input, width: '104px', padding: '7px 10px', textAlign: 'right' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '9px 0' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Refresh every (days)</span>
                <input type="number" value={smart.refreshIntervalDays} onChange={e => setSmart(s => ({ ...s, refreshIntervalDays: Number(e.target.value) }))} style={{ ...input, width: '104px', padding: '7px 10px', textAlign: 'right' }} />
              </div>
            </>)}
          </div>
        </div>
      </Gated>

      {/* ── 6. human review & publish ── */}
      <Gated locked={!platformsReady || published} why={published ? 'Published — read-only. Create a new version to publish again.' : !approved ? 'Approve the strategy first' : 'Mark your selected platforms as Ready first'}>
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '4px' }}>
            <h3 style={{ ...sectionTitle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: '9px' }}>
              <ShieldCheck size={17} color="var(--primary)" /> Human Review &amp; Publish
            </h3>
            <button onClick={() => setReviewOpen(true)} style={{ ...btnGhost, padding: '9px 15px' }}>
              <Database size={14} /> Open full review
            </button>
          </div>
          <p style={{ ...sectionHint, marginBottom: '16px' }}>Check everything below, then confirm. Open the full review to re-read the approved strategy in one place.</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(165px, 100%), 1fr))', gap: '12px', marginBottom: '18px' }}>
            {[
              { n: 'Strategy', d: approved ? 'Approved' : 'Not approved', ok: approved },
              { n: 'Creative assets', d: selectedImage ? '1 image approved' : 'None selected', ok: !!selectedImage },
              ...(platforms.meta ? [{ n: 'Meta Ads', d: metaSetup.launched ? money(split.meta?.amount) : 'Not ready', ok: !!metaSetup.launched }] : []),
              ...(platforms.google ? [{ n: 'Google Ads', d: googleSetup.launched ? money(split.google?.amount) : 'Not ready', ok: !!googleSetup.launched }] : []),
              { n: 'Optimization rules', d: smart.killAds || smart.autoRotate ? 'Configured' : 'Off', ok: true },
            ].map(s => (
              <div key={s.n} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border, var(--border-color))', borderRadius: '10px', padding: '13px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '5px' }}>
                  {s.ok ? <CheckCircle2 size={14} color="#00e676" /> : <Clock size={14} color="var(--text-secondary)" />}
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>{s.n}</span>
                </div>
                <div style={{ fontSize: '12px', color: s.ok ? '#00e676' : 'var(--text-secondary)' }}>{s.d}</div>
              </div>
            ))}
            <div style={{ background: 'rgba(90,82,255,0.08)', border: '1px solid rgba(90,82,255,0.25)', borderRadius: '10px', padding: '13px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Total budget</div>
              <div style={{ fontSize: '17px', fontWeight: 700 }}>{money(spec.total_budget || form.budget)}</div>
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '11px', cursor: 'pointer', marginBottom: '16px' }}>
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} style={{ width: '17px', height: '17px', accentColor: 'var(--primary)', cursor: 'pointer', flexShrink: 0 }} />
            <span style={{ fontSize: '13px' }}>I have reviewed all details and confirm this campaign is ready to publish.</span>
          </label>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => { setConfirmed(false); flash('Unlocked — edit anything above, then confirm again.'); }} style={btnGhost}>Back to edit</button>
            <div style={{ flex: 1 }} />
            {platforms.meta && (
              <button onClick={() => attemptPublish(['meta'])} disabled={!canPublish || !metaSetup.launched || busy?.startsWith('publish')}
                style={{ ...btnGhost, opacity: canPublish && metaSetup.launched ? 1 : 0.45, cursor: canPublish && metaSetup.launched ? 'pointer' : 'not-allowed' }}>
                Publish to Meta only
              </button>
            )}
            {platforms.google && (
              <button onClick={() => publish(['google'])} disabled={!canPublish || !googleSetup.launched || busy?.startsWith('publish')}
                style={{ ...btnGhost, opacity: canPublish && googleSetup.launched ? 1 : 0.45, cursor: canPublish && googleSetup.launched ? 'pointer' : 'not-allowed' }}>
                Publish to Google only
              </button>
            )}
            <button onClick={() => attemptPublish(chosen)} disabled={!canPublish || busy?.startsWith('publish')}
              className="btn btn-primary" style={{ ...btnPrimary, padding: '12px 22px', opacity: canPublish ? 1 : 0.45, cursor: canPublish ? 'pointer' : 'not-allowed' }}>
              <Rocket size={15} /> {published ? (publishedForReal ? 'Published' : 'Published (demo)') : busy?.startsWith('publish') ? 'Publishing…' : `Publish to ${chosen.length === 2 ? 'all selected' : chosen.length === 1 ? (chosen[0] === 'meta' ? 'Meta' : 'Google') : 'selected'}`}
            </button>
          </div>

          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '14px', background: 'rgba(255,174,0,0.05)', border: '1px solid rgba(255,174,0,0.2)', borderRadius: '9px', padding: '10px' }}>
            {/* Reported per platform, not from camp.status. A mixed publish (Meta real,
                Google simulated) is stored as PUBLISHED_DEMO, so keying off that status
                told the user "nothing was sent to a real ad account" while a real,
                billable Meta ad existed — the one message that must never be wrong. */}
            {published ? (() => {
              const modes = spec.published_modes || {};
              const urls = spec.campaign_urls || {};
              const name = (p: string) => (p === 'meta' ? 'Meta' : 'Google');
              const real: string[] = publishedList.filter((p: string) => modes[p] === 'real');
              const demo: string[] = publishedList.filter((p: string) => modes[p] !== 'real');
              // The backend already returns a deep link straight to the created campaign
              // (campaign_urls). Offering it turns "activate it there" from an instruction
              // into a click — the user does not have to know where "there" is.
              const links = real.map((pl: string) => {
                const href = urls[pl] || (pl === 'meta' ? metaAdsManagerUrl(metaAccount.ad_account_id) : 'https://ads.google.com/aw/campaigns');
                return <span key={pl}>{' '}<ExtLink href={href}>Open in {name(pl)}</ExtLink></span>;
              });
              if (real.length) return (
                <>
                  <b style={{ color: '#fff' }}>Your ad is created on {real.map(name).join(' & ')}</b>, and it is{' '}
                  <b style={{ color: '#fff' }}>paused</b> — nothing is charged until you turn it on.
                  {demo.length > 0 && <> {demo.map(name).join(' & ')} was a preview only.</>}
                  {links}
                </>
              );
              return <>This was a preview only — no ad was created and nothing was charged.</>;
            })() : 'Connect an ad account for a platform to publish there for real.'}
          </p>
        </div>
      </Gated>

      {/* ── publish-mode notice: real once Meta is connected AND a Page is picked ── */}
      {metaAccount?.ready_to_publish ? (
        <div style={{ ...card, padding: '13px 17px', display: 'flex', alignItems: 'center', gap: '11px', background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.22)' }}>
          <Check size={16} color="#00e676" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            {/* Written for the person running the campaign, not the developer. The account
                id, "developer token", "MCC" and "DEVELOPER_TOKEN_NOT_APPROVED" mean nothing
                to them — what they need to know is: will this spend money, where does it
                appear, and what do I do next. Ids move to a title tooltip. */}
            {/* Short sentences, one idea each, ending in the action. The previous version
                trailed an explanatory aside ("Facebook's own dashboard for running ads")
                which reads as a footnote and buried the thing the user has to do. */}
            <span title={metaAccount.ad_account_id ? `Meta ad account ${metaAccount.ad_account_id}` : undefined}>
              <b style={{ color: '#fff' }}>Your ad will be created on Facebook and Instagram</b>, posting as{' '}
              <b style={{ color: '#fff' }}>{metaAccount.page_name || 'your Page'}</b>.
            </span>{' '}
            It starts <b style={{ color: '#fff' }}>paused</b>, so <b style={{ color: '#fff' }}>you are not charged anything</b>.
            {' '}You choose when to start it:{' '}
            <ExtLink href={metaAdsManagerUrl(metaAccount.ad_account_id)}>Open Facebook Ads Manager</ExtLink>.{' '}
            {googleIsManagerAccount
              ? <><b style={{ color: 'var(--warning)' }}>Google Ads won't run yet.</b> The Google account you picked manages other accounts and can't hold ads itself — pick one of your ad accounts above.</>
              : googleTokenBlocked
                ? <><b style={{ color: 'var(--warning)' }}>Google Ads isn't available yet.</b> This campaign will run on Facebook and Instagram only.</>
                : googleReadyToPublish
                  ? <>It will also run on <b style={{ color: '#fff' }}>Google Search</b>, paused in the same way. <ExtLink href="https://ads.google.com/aw/campaigns">Open Google Ads</ExtLink>.</>
                  : <>To run it on Google Search as well, connect your Google Ads account above.</>}
          </span>
        </div>
      ) : (
        <div style={{ ...card, padding: '13px 17px', display: 'flex', alignItems: 'center', gap: '11px', background: 'rgba(255,174,0,0.05)', border: '1px solid rgba(255,174,0,0.22)' }}>
          <AlertTriangle size={16} color="#ffae00" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            {/* Same rewrite as the live banner: say what is missing and what to do, in the
                words the person running the campaign would use. */}
            <b style={{ color: '#fff' }}>This is a preview — your ad won't go live yet.</b>{' '}
            {!metaAccount?.connected
              ? 'Connect your Meta account above to publish real ads to Facebook and Instagram.'
              : !metaAccount?.ad_account_id
                ? 'Your Meta account is connected — now choose which ad account should pay for this campaign.'
                : 'Your Meta account is connected — now choose the Facebook Page the ad should post as. Meta needs one before it can create an ad.'}
            {' '}Nothing is charged and no ad is created until that's done.
          </span>
        </div>
      )}

      {/* ── recent activity ── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Database size={18} color="#00E676" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ ...sectionTitle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap' }}>
              Recent Activity
              {activity.length > 0 && (
                <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', color: '#00E676', background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: '100px', padding: '2px 9px' }}>
                  {activity.length}
                </span>
              )}
            </h3>
            <p style={{ ...sectionHint, margin: '2px 0 0' }}>Logged as you generate, approve and publish this session.</p>
          </div>
        </div>
        {activity.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.02)' }}>
            <Clock size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Nothing yet — generate a strategy above and each step will appear here.
            </span>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: '10px' }}>
            {activity.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(0,230,118,0.04)', border: '1px solid rgba(0,230,118,0.18)', borderRadius: '12px', padding: '12px 14px' }}>
                <span style={{ width: '26px', height: '26px', borderRadius: '8px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.3)' }}>
                  <CheckCircle2 size={14} color="#00E676" />
                </span>
                <span style={{ fontSize: '13px', flex: 1, color: '#fff', minWidth: 0 }}>{a.label}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', flexShrink: 0 }}>{ago(a.at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── recently published (persists across the session; from real campaign data) ── */}
      {recentPublished.length > 0 && (
        <div style={card}>
          {/* Collapsible: the whole header is the toggle. */}
          <button
            onClick={() => setPublishedOpen(o => !o)}
            aria-expanded={publishedOpen}
            style={{ width: '100%', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '12px' }}
          >
            <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'rgba(255,189,46,0.15)', border: '1px solid rgba(255,189,46,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Rocket size={18} color="#FFBD2E" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ ...sectionTitle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap' }}>
                Recently Published
                <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', color: '#FFBD2E', background: 'rgba(255,189,46,0.12)', border: '1px solid rgba(255,189,46,0.3)', borderRadius: '100px', padding: '2px 9px' }}>
                  {recentPublished.length}
                </span>
              </h3>
              <p style={{ ...sectionHint, margin: '2px 0 0' }}>Open one to keep working on it, duplicate it, or see its analytics.</p>
            </div>
            <ChevronDown
              size={18}
              color="var(--text-secondary)"
              style={{ flexShrink: 0, transform: publishedOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
            />
          </button>
          <div style={{ display: publishedOpen ? 'flex' : 'none', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
            {recentPublished.length === 0 && <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Nothing published yet.</p>}
            {recentPublished.map((c: any) => {
              const cm = c.metrics || {};
              const plats = (cm.published_platforms || []).map((p: string) => (p === 'meta' ? 'Meta' : 'Google')).join(' & ');
              // What actually exists on the ad platforms. Every row used to say
              // "PUBLISHED · DEMO", including campaigns that went out for real — the server
              // records the truth per platform in published_modes, and delivery state in
              // metrics.delivery once someone starts or pauses it.
              const realPlats: string[] = Object.entries(cm.published_modes || {})
                .filter(([, mode]) => mode === 'real').map(([p]) => p);
              const deliveryState = cm.delivery || {};
              const isLive = realPlats.some(p => ['ACTIVE', 'ENABLED'].includes(deliveryState[p]?.status));
              const partlyDemo = cm.published_mode === 'mixed';
              const badge = !realPlats.length
                ? { text: 'PUBLISHED · DEMO', color: 'var(--text-secondary)', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.15)' }
                : isLive
                  ? { text: partlyDemo ? 'LIVE · PARTLY DEMO' : 'LIVE', color: '#00e676', bg: 'rgba(0,230,118,0.1)', border: 'rgba(0,230,118,0.3)' }
                  : { text: partlyDemo ? 'PAUSED · PARTLY DEMO' : 'PUBLISHED · PAUSED', color: '#FFB300', bg: 'rgba(255,179,0,0.1)', border: 'rgba(255,179,0,0.3)' };
              const busyKey = `delivery-${c.id}`;
              const toggleDelivery = async () => {
                if (!workspaceId) return;
                const action = isLive ? 'pause' : 'start';
                setBusy(busyKey);
                try {
                  const res = await CampaignService.setDelivery(workspaceId, c.id, action);
                  setRecentPublished(prev => prev.map((x: any) => (x.id === c.id
                    ? { ...x, metrics: { ...(x.metrics || {}), delivery: res.delivery } } : x)));
                  const failed = Object.entries(res.results).filter(([, r]) => !r.ok);
                  flash(failed.length
                    ? `${action === 'start' ? 'Started' : 'Paused'} only partly — ${failed.map(([p, r]) => `${p === 'meta' ? 'Meta' : 'Google'}: ${r.error}`).join(' ')}`
                    : action === 'start'
                      ? 'Campaign started. A new ad can sit in the platform’s review for a few minutes up to 24h before it delivers.'
                      : 'Campaign paused on every platform it was published to.',
                    !failed.length);
                } catch (e: any) {
                  flash(e?.message || 'Could not change the campaign’s delivery.', false);
                } finally {
                  setBusy(null);
                }
              };
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', background: 'rgba(0,230,118,0.04)', border: '1px solid rgba(0,230,118,0.18)', borderRadius: '12px', padding: '13px 15px', transition: 'all 0.2s ease' }}>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                      {c.name || 'Campaign'} <span style={{ fontSize: '10px', fontWeight: 600, color: '#8B85FF', background: 'rgba(90,82,255,0.12)', border: '1px solid rgba(90,82,255,0.25)', borderRadius: '20px', padding: '1px 8px' }}>v{c.version || 1}</span>
                    </span>
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {c.objective || '—'} · {money(c.budget || 0)}{plats ? ` · ${plats}` : ''}{cm.published_at ? ` · ${new Date(cm.published_at).toLocaleDateString()}` : ''}
                    </span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: badge.color, background: badge.bg, border: `1px solid ${badge.border}`, borderRadius: '20px', padding: '3px 9px', whiteSpace: 'nowrap' }}>{badge.text}</span>
                    {/* The on/off switch that did not exist: publishing creates everything
                        paused, and this is what turns it on. Only shown where something real
                        exists to switch — a demo publish has nothing on Meta or Google. */}
                    {realPlats.length > 0 && (
                      <button
                        onClick={toggleDelivery}
                        disabled={busy === busyKey}
                        style={{ ...(isLive ? btnGhost : btnPrimary), padding: '5px 11px', fontSize: '12px', opacity: busy === busyKey ? 0.6 : 1 }}
                        title={isLive ? 'Stop delivery on every platform' : 'Start delivery — this begins spending your budget'}
                      >
                        {busy === busyKey ? (isLive ? 'Pausing…' : 'Starting…') : isLive ? 'Pause' : 'Start campaign'}
                      </button>
                    )}
                    <button onClick={() => refresh(c.id).then(scrollToTop)} style={{ ...btnGhost, padding: '5px 11px', fontSize: '12px' }}>View</button>
                    <button onClick={() => viewAnalytics(c.id)} style={{ ...btnGhost, padding: '5px 11px', fontSize: '12px' }}><BarChart3 size={12} /> Analytics</button>
                    <button onClick={() => duplicateCampaign(c.id).then(scrollToTop)} style={{ ...btnGhost, padding: '5px 11px', fontSize: '12px' }}><Copy size={12} /> Duplicate</button>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── publish popup: connect Meta account or publish in demo mode ── */}
      {publishPopup && (
        <div onClick={() => setPublishPopup(false)} style={{ position: 'fixed', inset: 0, zIndex: 5000, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div onClick={e => e.stopPropagation()} style={{ ...card, width: '100%', maxWidth: '440px', background: 'rgba(18,20,28,0.99)' }}>
            <h3 style={{ ...sectionTitle, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '9px' }}><Rocket size={17} color="var(--primary)" /> Connect Meta to publish?</h3>
            <p style={{ ...sectionHint, marginBottom: '18px' }}>
              You haven't connected a Meta ad account. Connect it to publish to a real account, or publish now in demo mode.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={connectMeta}
                onMouseEnter={() => prefetchAuthUrl('meta')}
                onFocus={() => prefetchAuthUrl('meta')}
                disabled={connecting === 'meta'}
                className="btn btn-primary"
                style={{ ...btnPrimary, padding: '12px', justifyContent: 'center' }}
              >
                <CheckCircle2 size={15} /> {connecting === 'meta' ? 'Opening Meta…' : 'Connect Meta account'}
              </button>
              <button onClick={() => { setPublishPopup(false); publish(chosen); }} disabled={busy?.startsWith('publish')} style={{ ...btnGhost, padding: '12px', justifyContent: 'center' }}>
                <Rocket size={15} /> Publish anyway (demo)
              </button>
              <button onClick={() => setPublishPopup(false)} style={{ ...btnGhost, padding: '10px', justifyContent: 'center', border: 'none' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── full review modal: the approved strategy, all in one place ── */}
      {whyOpen && (
        <div onClick={() => setWhyOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 5000, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ ...card, width: '100%', maxWidth: '640px', maxHeight: '86vh', overflowY: 'auto', background: 'rgba(18,20,28,0.99)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '4px' }}>
              <h3 style={{ ...sectionTitle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: '9px' }}>
                <Sparkles size={18} color="var(--primary)" /> Why AI recommended this
              </h3>
              <button onClick={() => setWhyOpen(false)} style={{ ...btnGhost, padding: '6px 12px', fontSize: '12px' }}>Close</button>
            </div>
            <p style={{ ...sectionHint, marginBottom: '18px' }}>The reasoning behind each part of this strategy, in plain language.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {whyRows.map((r, i) => (
                <div key={i} style={{ borderLeft: '2px solid rgba(90,82,255,0.4)', paddingLeft: '13px', paddingTop: '2px', paddingBottom: '2px' }}>
                  <div style={{ fontSize: '13px', color: '#fff' }}><b style={{ color: '#b3aaff' }}>{r.label}:</b> {r.value}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55, marginTop: '3px' }}>{r.reason}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── creative lightbox: click any creative to see it full size ──
          Sits above the review modal (z 5000) because a creative can be opened from
          inside it. Backdrop click, the X, and Escape all close it. */}
      {previewImage && (
        <div onClick={() => setPreviewImage(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 6000, background: 'rgba(0,0,0,0.86)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', maxWidth: '100%', maxHeight: '100%' }}>
            <img src={previewImage} alt="Creative preview"
              style={{ maxWidth: '100%', maxHeight: '78vh', objectFit: 'contain', borderRadius: '12px', border: '1px solid var(--border, var(--border-color))', background: '#000' }} />
            <div style={{ display: 'flex', gap: '9px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button onClick={() => downloadCreative(previewImage)} disabled={busy === 'download'}
                style={{ ...btnGhost, padding: '8px 14px', fontSize: '13px' }}>
                <Download size={13} /> {busy === 'download' ? 'Downloading…' : 'Download'}
              </button>
              <button onClick={() => setPreviewImage(null)} style={{ ...btnGhost, padding: '8px 14px', fontSize: '13px' }}>Close</button>
            </div>
          </div>
          {/* Fixed to the viewport, not the image, so it never lands on top of a tall creative. */}
          <button onClick={() => setPreviewImage(null)} aria-label="Close preview" title="Close (Esc)"
            style={{ position: 'fixed', top: '20px', right: '24px', width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={19} />
          </button>
        </div>
      )}

      {reviewOpen && (
        <div onClick={() => setReviewOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 5000, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ ...card, width: '100%', maxWidth: '820px', maxHeight: '86vh', overflowY: 'auto', background: 'rgba(18,20,28,0.99)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '4px' }}>
              <h3 style={{ ...sectionTitle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: '9px' }}>
                <ShieldCheck size={18} color="var(--primary)" /> Full campaign review
              </h3>
              <button onClick={() => setReviewOpen(false)} style={{ ...btnGhost, padding: '6px 12px', fontSize: '12px' }}>Close</button>
            </div>
            <p style={{ ...sectionHint, marginBottom: '18px' }}>Everything you approved, in one place — read it through before publishing.</p>

            {/* strategy */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '.4px', color: 'var(--primary)', marginBottom: '9px' }}>APPROVED STRATEGY</div>
              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '10px' }}>
                {selectedImage && <img src={selectedImage} alt="Ad creative" {...previewable(selectedImage, { width: '120px', height: '120px', objectFit: 'cover', borderRadius: '10px', border: '1px solid var(--border, var(--border-color))' })} />}
                <div style={{ flex: 1, minWidth: '230px' }}>
                  <Row k="Campaign" v={campaign?.name || '—'} />
                  <Row k="Objective" v={campaign?.objective || '—'} />
                  <Row k="Runs for" v={spec.duration_label || form.schedule} />
                  <Row k="Total budget" v={money(spec.total_budget || form.budget)} />
                </div>
              </div>
              <AudienceBlock text={spec.audience || form.audience} maxHeight={120} />
            </div>

            {/* budget split + KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(230px, 100%), 1fr))', gap: '18px', marginBottom: '18px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '.4px', color: 'var(--primary)', marginBottom: '9px' }}>BUDGET SPLIT</div>
                {(split.meta || split.google)
                  ? <SplitBar meta={split.meta} google={split.google} fmt={money} />
                  : <p style={sectionHint}>Not set.</p>}
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '.4px', color: 'var(--primary)', marginBottom: '9px' }}>SUCCESS TARGETS</div>
                {(spec.kpis || []).map((k: string) => <KpiRow key={k} text={k} />)}
                {!(spec.kpis || []).length && <p style={sectionHint}>None set.</p>}
              </div>
            </div>

            {/* ad copy */}
            {(keywords.length > 0 || headlines.length > 0 || descriptions.length > 0) && (
              <div style={{ marginBottom: '18px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '.4px', color: 'var(--primary)', marginBottom: '9px' }}>AD COPY &amp; KEYWORDS</div>
                {keywords.length > 0 && (
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Keywords ({keywords.length})</div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {keywords.map(k => <span key={k} style={{ fontSize: '11px', color: '#8B85FF', background: 'rgba(90,82,255,0.12)', border: '1px solid rgba(90,82,255,0.25)', borderRadius: '6px', padding: '3px 9px' }}>{k}</span>)}
                    </div>
                  </div>
                )}
                {headlines.length > 0 && (
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Headlines ({headlines.length})</div>
                    <CopyList items={headlines} limit={30} noun="headlines" preview={999} />
                  </div>
                )}
                {descriptions.length > 0 && (
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Descriptions ({descriptions.length})</div>
                    <CopyList items={descriptions} limit={90} noun="descriptions" preview={999} />
                  </div>
                )}
              </div>
            )}

            {/* where it goes + rules */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(230px, 100%), 1fr))', gap: '18px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '.4px', color: 'var(--primary)', marginBottom: '9px' }}>PUBLISHING TO</div>
                {chosen.length === 0 && <p style={sectionHint}>No platform selected.</p>}
                {chosen.map(p => (
                  <Row key={p} k={p === 'meta' ? 'Meta Ads' : 'Google Ads'}
                    v={setupOf(p).launched ? <span style={{ color: '#00e676' }}>Ready</span> : <span style={{ color: '#ffae00' }}>Not ready</span>} />
                ))}
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '.4px', color: 'var(--primary)', marginBottom: '9px' }}>SAFETY RULES</div>
                <Row k="Auto-kill bad ads" v={smart.killAds ? `On · CPA > ₹${smart.cpaThreshold}, freq > ${smart.frequencyCap}` : 'Off'} stack />
                <Row k="Creative rotation" v={smart.autoRotate ? `On · skip > ${smart.skipRateThreshold}%, every ${smart.refreshIntervalDays}d` : 'Off'} stack />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button onClick={() => setReviewOpen(false)} style={btnGhost}>Close</button>
              <button onClick={() => { setConfirmed(true); setReviewOpen(false); flash('Reviewed and confirmed — you can publish now.'); }}
                disabled={!platformsReady}
                className="btn btn-primary" style={{ ...btnPrimary, padding: '11px 20px', opacity: platformsReady ? 1 : 0.45, cursor: platformsReady ? 'pointer' : 'not-allowed' }}>
                <Check size={15} /> I've reviewed — confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── analytics modal (mock, demo) ── */}
      {analyticsView && (() => {
        const a = analyticsView; const t = a.totals || {};
        const tiles = [
          { k: 'Impressions', v: (t.impressions || 0).toLocaleString('en-IN') },
          { k: 'Reach', v: (t.reach || 0).toLocaleString('en-IN') },
          { k: 'Clicks', v: (t.clicks || 0).toLocaleString('en-IN') },
          { k: 'CTR', v: `${t.ctr}%` },
          { k: 'Conversions', v: t.conversions },
          { k: 'CPA', v: money(t.cpa) },
          { k: 'Spend', v: money(t.spend) },
          { k: 'ROAS', v: `${t.roas}×`, hot: (t.roas || 0) >= 2 },
        ];
        const sevColor: Record<string, string> = { good: '#00e676', warn: '#ffae00', critical: '#ff5c5c' };
        return (
          <div onClick={() => setAnalyticsView(null)} style={{ position: 'fixed', inset: 0, zIndex: 5000, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div onClick={e => e.stopPropagation()} style={{ ...card, width: '100%', maxWidth: '760px', maxHeight: '88vh', overflowY: 'auto', background: 'rgba(18,20,28,0.99)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '4px' }}>
                <h3 style={{ ...sectionTitle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: '9px' }}>
                  <BarChart3 size={18} color="var(--primary)" /> {a.name || 'Campaign'} — Analytics <Pill status="DEMO" />
                </h3>
                <button onClick={() => setAnalyticsView(null)} style={{ ...btnGhost, padding: '6px 12px', fontSize: '12px' }}>Close</button>
              </div>
              <p style={{ ...sectionHint, marginBottom: '16px' }}>v{a.version} · {(a.platforms || []).map((p: string) => p === 'meta' ? 'Meta' : 'Google').join(' & ')} · {a.status === 'PUBLISHED_DEMO' ? 'Published (demo)' : a.status}. Mock figures — real Meta/Google insights plug in later.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(120px, 100%), 1fr))', gap: '10px', marginBottom: '18px' }}>
                {tiles.map(x => (
                  <div key={x.k} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border, var(--border-color))', borderRadius: '10px', padding: '12px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{x.k}</div>
                    <div style={{ fontSize: '17px', fontWeight: 700, color: (x as any).hot ? '#00e676' : '#fff' }}>{x.v}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '14px', marginBottom: '18px' }}>
                {a.meta_performance && (
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border, var(--border-color))', borderRadius: '10px', padding: '13px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#8B85FF', marginBottom: '8px' }}>Meta Performance</div>
                    <Row k="Spend" v={money(a.meta_performance.spend)} /><Row k="Conversions" v={a.meta_performance.conversions} /><Row k="ROAS" v={`${a.meta_performance.roas}×`} />
                  </div>
                )}
                {a.google_performance && (
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border, var(--border-color))', borderRadius: '10px', padding: '13px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#8B85FF', marginBottom: '8px' }}>Google Performance</div>
                    <Row k="Spend" v={money(a.google_performance.spend)} /><Row k="Conversions" v={a.google_performance.conversions} /><Row k="ROAS" v={`${a.google_performance.roas}×`} />
                  </div>
                )}
              </div>
              {a.top_keywords?.length > 0 && (
                <div style={{ marginBottom: '18px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '.4px', color: 'var(--primary)', marginBottom: '9px' }}>TOP KEYWORDS</div>
                  {a.top_keywords.map((kw: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '13px', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span>{kw.keyword}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{kw.clicks} clicks · {kw.ctr}% CTR · {kw.conversions} conv</span>
                    </div>
                  ))}
                </div>
              )}
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '.4px', color: 'var(--primary)', marginBottom: '9px' }}>AI RECOMMENDATIONS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(a.recommendations || []).map((r: any, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', background: 'rgba(255,255,255,0.03)', border: `1px solid ${sevColor[r.severity] || '#888'}44`, borderRadius: '9px', padding: '10px 12px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: sevColor[r.severity] || '#fff', whiteSpace: 'nowrap' }}>{r.action}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{r.why}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 4000, maxWidth: '580px', background: 'rgba(20,22,30,0.97)', border: `1px solid ${toast.ok ? 'rgba(0,230,118,0.4)' : 'rgba(255,174,0,0.4)'}`, borderRadius: '12px', padding: '14px 18px', color: '#fff', fontSize: '13px', boxShadow: '0 12px 30px rgba(0,0,0,0.5)', display: 'flex', gap: '11px', alignItems: 'center' }}>
          {toast.ok ? <CheckCircle2 size={16} color="#00e676" /> : <AlertTriangle size={16} color="#ffae00" />} {toast.msg}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .toggle-switch { position: relative; display: inline-block; width: 38px; height: 21px; }
        .toggle-switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--border, #333); transition: .2s; border-radius: 34px; }
        .slider:before { position: absolute; content: ""; height: 15px; width: 15px; left: 3px; bottom: 3px; background-color: white; transition: .2s; border-radius: 50%; }
        input:checked + .slider { background-color: var(--primary); }
        input:checked + .slider:before { transform: translateX(17px); }
      `}} />
    </div>
  );
};
