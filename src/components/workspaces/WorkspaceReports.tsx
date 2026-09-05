import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Trash2,
  Target,
  Megaphone,
  Users,
  MessageSquareQuote,
  AlertCircle,
  Globe,
  ArrowRight
} from 'lucide-react';
import { GlowButton } from '../GlowButton';

/**
 * Market Intelligence.
 *
 * This screen used to be 800 lines of fixtures: forty invented "Meta ads" for two power-bank
 * brands, a hardcoded India search-trend report, and two buttons that waited on a setTimeout
 * before announcing "Synced 40 active Meta competitor ads!" and locking themselves for two
 * weeks. Nothing was ever fetched.
 *
 * It now runs real research against /api/workspaces/{id}/competitors, which reads the
 * competitor's own public pages and extracts positioning, offers, hooks and CTAs from that
 * text. Reports are saved, so the section has something to show on load.
 *
 * The ad-library framing is gone rather than rebuilt. Meta's Ad Library API returns only
 * political and social-issue ads outside the EU, and Google's Ads Transparency Center has no
 * API, so a feed of a rival's commercial creatives is not something anyone can lawfully
 * offer. Promising one was the dishonest part.
 */

interface CompetitorSource {
  url: string;
  kind?: string;
  title?: string;
}

interface CompetitorReport {
  id: number;
  competitor: string;
  site_url?: string | null;
  positioning?: string;
  audience?: string;
  tone?: string;
  offers?: string[];
  hooks?: string[];
  ctas?: string[];
  notes?: string;
  sources?: CompetitorSource[];
  researched_at?: string | null;
}

interface WorkspaceReportsProps {
  onNavigateTab?: (tab: string) => void;
  brandName?: string;
  /** Required: the research endpoint is scoped to a workspace. */
  workspaceId?: number | null;
}

const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const formatWhen = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export const WorkspaceReports: React.FC<WorkspaceReportsProps> = ({
  onNavigateTab,
  brandName = 'your brand',
  workspaceId = null,
}) => {
  const [reports, setReports] = useState<CompetitorReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [input, setInput] = useState('');
  const [researching, setResearching] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }
    try {
      const r = await fetch(`/api/workspaces/${workspaceId}/competitors`, { headers: authHeaders() });
      if (r.ok) {
        const data: CompetitorReport[] = await r.json();
        setReports(data);
        setSelectedId((prev) => (prev && data.some((d) => d.id === prev) ? prev : data[0]?.id ?? null));
      }
    } catch {
      /* the empty state below covers this; an error banner here would fire on every
         page load with the API down, which is noisier than it is useful. */
    }
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { loadReports(); }, [loadReports]);

  const runResearch = async (e?: React.FormEvent, override?: string) => {
    if (e) e.preventDefault();
    const target = (override ?? input).trim();
    if (!target || !workspaceId || researching) return;

    setResearching(true);
    setError('');
    try {
      const r = await fetch(`/api/workspaces/${workspaceId}/competitors/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ competitor: target }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        // Replace in place when this competitor has been researched before - the backend
        // upserts, so the list must not gain a second copy of the same row.
        setReports((prev) => [d, ...prev.filter((p) => p.id !== d.id)]);
        setSelectedId(d.id);
        if (!override) setInput('');
      } else {
        setError(d.detail || `Research failed (${r.status}).`);
      }
    } catch {
      setError('Could not reach the server. Please try again in a moment.');
    }
    setResearching(false);
  };

  const removeReport = async (id: number) => {
    if (!workspaceId) return;
    const previous = reports;
    setReports((prev) => prev.filter((p) => p.id !== id));
    if (selectedId === id) setSelectedId(previous.find((p) => p.id !== id)?.id ?? null);
    try {
      const r = await fetch(`/api/workspaces/${workspaceId}/competitors/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!r.ok) setReports(previous);     // put it back rather than pretend it went
    } catch {
      setReports(previous);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied((c) => (c === text ? null : c)), 2000);
  };

  const selected = reports.find((r) => r.id === selectedId) || null;

  const listBlock = (
    label: string,
    items: string[] | undefined,
    color: string,
    Icon: typeof Target,
    copyable = false,
  ) => {
    if (!items || !items.length) return null;
    return (
      <div style={{
        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '16px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon size={15} color={color} />
          <span style={{ fontSize: '11px', fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {label}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
          {items.map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px',
              fontSize: '13px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.5,
            }}>
              <span>{copyable ? `"${item}"` : item}</span>
              {copyable && (
                <button
                  onClick={() => copy(item)}
                  title="Copy"
                  style={{
                    flexShrink: 0, background: copied === item ? 'rgba(0,230,118,0.18)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${copied === item ? '#00E676' : 'rgba(255,255,255,0.12)'}`,
                    color: copied === item ? '#00E676' : '#fff', borderRadius: '100px',
                    padding: '3px 9px', fontSize: '10.5px', fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '4px',
                  }}
                >
                  {copied === item ? <Check size={10} /> : <Copy size={10} />}
                  {copied === item ? 'Copied' : 'Copy'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* ── HEADER ───────────────────────────────────────────────── */}
      <div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px',
          background: 'rgba(124, 117, 255, 0.12)', borderRadius: '100px',
          border: '1px solid rgba(124, 117, 255, 0.3)', marginBottom: '8px',
        }}>
          <Sparkles size={13} color="#7C75FF" />
          <span style={{ fontSize: '11px', color: '#7C75FF', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Competitor Intelligence
          </span>
        </div>
        <h1 style={{ fontSize: '32px', color: '#fff', margin: '0 0 6px 0', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
          Market Intelligence
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14.5px', margin: 0, maxWidth: '720px' }}>
          Research any competitor of {brandName} from what is publicly on their site — how they
          position themselves, who they speak to, the offers they lead with and the copy they run.
          Every report links back to the pages it was read from.
        </p>
      </div>

      {/* ── RESEARCH FORM ────────────────────────────────────────── */}
      <form onSubmit={runResearch} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 320px', minWidth: 0 }}>
          <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="competitor.com or a brand name"
            aria-label="Competitor website or brand name"
            disabled={!workspaceId}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.14)', borderRadius: '100px',
              padding: '11px 18px 11px 38px', color: '#fff', fontSize: '13.5px', outline: 'none',
            }}
          />
        </div>
        <GlowButton
          variant="glow"
          disabled={researching || !input.trim() || !workspaceId}
          style={{ fontSize: '13px', padding: '11px 22px', opacity: researching || !input.trim() ? 0.6 : 1 }}
        >
          {researching ? 'Researching…' : 'Research competitor'}
        </GlowButton>
      </form>

      {!workspaceId && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '9px', padding: '12px 16px', borderRadius: '12px',
          background: 'rgba(255,193,7,0.07)', border: '1px solid rgba(255,193,7,0.28)',
          color: '#ffc107', fontSize: '13px',
        }}>
          <AlertCircle size={15} />
          Select a workspace to run competitor research.
        </div>
      )}

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: '9px', padding: '13px 16px', borderRadius: '12px',
              background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.3)',
              color: '#ff6b7a', fontSize: '13px', lineHeight: 1.5,
            }}
          >
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── EMPTY STATE ──────────────────────────────────────────── */}
      {!loading && !reports.length && (
        <div className="glow-card" style={{
          background: '#0a0a12', border: '1px dashed rgba(255,255,255,0.14)', borderRadius: '20px',
          padding: '38px 26px', textAlign: 'center',
        }}>
          <Globe size={30} color="#7C75FF" style={{ opacity: 0.8 }} />
          <h3 style={{ fontSize: '17px', color: '#fff', margin: '12px 0 6px', fontWeight: 700 }}>
            No competitors researched yet
          </h3>
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: '0 auto', maxWidth: '540px', lineHeight: 1.6 }}>
            Enter a competitor above and their public pages will be read and broken down into
            positioning, audience, offers, hooks and CTAs. Reports are saved here.
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '14px auto 0', maxWidth: '540px', lineHeight: 1.6 }}>
            This does not scan competitors' paid ads: Meta's Ad Library API returns only
            political and social-issue ads outside the EU, and Google's Ads Transparency Center
            has no API, so no product can honestly offer that feed.
          </p>
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[0, 1].map((i) => (
            <div key={i} className="skeleton" style={{ height: '72px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)' }} />
          ))}
        </div>
      )}

      {/* ── RESEARCHED COMPETITORS ───────────────────────────────── */}
      {!!reports.length && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {reports.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              style={{
                background: r.id === selectedId ? 'rgba(124,117,255,0.16)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${r.id === selectedId ? 'rgba(124,117,255,0.5)' : 'rgba(255,255,255,0.09)'}`,
                color: r.id === selectedId ? '#fff' : 'var(--text-secondary)',
                borderRadius: '100px', padding: '7px 16px', fontSize: '13px', fontWeight: 700,
                cursor: 'pointer', transition: 'all 0.15s ease',
              }}
            >
              {r.competitor}
            </button>
          ))}
        </div>
      )}

      {/* ── REPORT ───────────────────────────────────────────────── */}
      {selected && (
        <motion.div
          key={selected.id}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="glow-card"
          style={{
            background: '#0a0a12', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px',
            padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px',
          }}
        >
          {/* Title row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '14px', flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ fontSize: '21px', color: '#fff', margin: 0, fontWeight: 800 }}>{selected.competitor}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px', flexWrap: 'wrap' }}>
                {/* Skipped when the URL only repeats the name that is already the heading -
                    typing "acme.com" would otherwise print it twice, one line apart. */}
                {selected.site_url && selected.site_url.replace(/^https?:\/\//, '').replace(/\/$/, '') !== selected.competitor.trim().toLowerCase() && (
                  <a
                    href={selected.site_url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: '12.5px', color: '#7C75FF', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    {selected.site_url.replace(/^https?:\/\//, '')}
                    <ExternalLink size={11} />
                  </a>
                )}
                {selected.researched_at && (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Researched {formatWhen(selected.researched_at)}
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => runResearch(undefined, selected.competitor)}
                disabled={researching}
                style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                  color: '#fff', borderRadius: '100px', padding: '7px 15px', fontSize: '12px',
                  fontWeight: 700, cursor: researching ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px', opacity: researching ? 0.6 : 1,
                }}
              >
                <RefreshCw size={12} className={researching ? 'animate-spin' : undefined} />
                Refresh
              </button>
              <button
                onClick={() => removeReport(selected.id)}
                title="Delete this report"
                style={{
                  background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.25)',
                  color: '#ff6b7a', borderRadius: '100px', padding: '7px 12px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center',
                }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          {selected.positioning && (
            <div>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#7C75FF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Positioning
              </span>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.9)', margin: '6px 0 0', lineHeight: 1.6 }}>
                {selected.positioning}
              </p>
            </div>
          )}

          {(selected.audience || selected.tone) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px,100%), 1fr))', gap: '14px' }}>
              {selected.audience && (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '15px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '6px' }}>
                    <Users size={14} color="#00D2FF" />
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#00D2FF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Audience</span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', margin: 0, lineHeight: 1.55 }}>{selected.audience}</p>
                </div>
              )}
              {selected.tone && (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '15px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '6px' }}>
                    <MessageSquareQuote size={14} color="#00E676" />
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#00E676', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tone</span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', margin: 0, lineHeight: 1.55 }}>{selected.tone}</p>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px,100%), 1fr))', gap: '14px' }}>
            {listBlock('Offers', selected.offers, '#00E676', Target)}
            {listBlock('Hooks they run', selected.hooks, '#7C75FF', Megaphone, true)}
            {listBlock('Calls to action', selected.ctas, '#00D2FF', ArrowRight)}
          </div>

          {selected.notes && (
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
              {selected.notes}
            </p>
          )}

          {/* Sources: shown so every claim above can be checked against what was read. */}
          {!!selected.sources?.length && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Read from {selected.sources.length} source{selected.sources.length > 1 ? 's' : ''}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '8px' }}>
                {selected.sources.map((s, i) => (
                  <a
                    key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                    style={{
                      fontSize: '12.5px', color: '#7C75FF', display: 'flex', alignItems: 'center', gap: '6px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                  >
                    <ExternalLink size={11} style={{ flexShrink: 0 }} />
                    {s.title || s.url}
                  </a>
                ))}
              </div>
            </div>
          )}

          {!!selected.hooks?.length && onNavigateTab && (
            <button
              onClick={() => onNavigateTab('studio')}
              style={{
                alignSelf: 'flex-start', background: 'rgba(124,117,255,0.14)',
                border: '1px solid rgba(124,117,255,0.4)', color: '#7C75FF', borderRadius: '100px',
                padding: '9px 18px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '7px',
              }}
            >
              <Sparkles size={13} />
              Write against these angles in Creative Studio
              <ArrowRight size={13} />
            </button>
          )}
        </motion.div>
      )}
    </div>
  );
};
