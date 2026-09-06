import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  ExternalLink,
  Globe,
  Palette,
  Type,
  Layers,
  Target,
  FileText,
  Compass,
  Image as ImageIcon,
  Plus
} from 'lucide-react';
import { GlowButton } from '../GlowButton';

interface BrandProfile {
  name: string;
  url: string | null;
  brand_voice: string | null;
  brand_color: string | null;
  brand_guidelines_summary: string | null;
  target_audience: string | null;
  color_palette: string[];
  /** The same colours with the name and role the site's own CSS variables gave them.
   *  Empty for a workspace onboarded before token extraction existed — the palette is
   *  still there, so the UI falls back to positional names. */
  color_tokens?: { name: string; hex: string; role: string; source: string }[];
  /** Logo files found in the site's markup, best evidence first. */
  logos?: { type: string; url: string; format: string; variant: string; svg?: string }[];
  typography: Record<string, string>;
  guidelines: Record<string, unknown>;
  is_onboarded: boolean;
}

interface BrandKnowledgeBaseProps {
  /** Runs the real re-index: rescrapes the site and rebuilds the vector store. */
  onSyncKnowledgeGraph?: () => void;
  syncing?: boolean;
  syncMessage?: { text: string; ok: boolean } | null;
  brand?: { name?: string; url?: string; tone?: string; colors?: string };
  workspaceId?: number | null;
}

/** Section ids and titles are the reference's, so the tab strip reads identically. */
const SECTION_TITLES: { id: string; title: string }[] = [
  { id: 'overview', title: 'Brand Overview' },
  { id: 'usps', title: 'Unique Selling Points (USPs)' },
  { id: 'features', title: 'Key Features & Benefits' },
  { id: 'slogan', title: 'Brand Slogan & Mission' },
  { id: 'personality', title: 'Brand Personality' },
  { id: 'visual', title: 'Visual Design & Brand Identity' },
  { id: 'competitive', title: 'Competitive Position' },
  { id: 'tone', title: 'Tone of Voice' },
];

const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/** The reference names each colour ("Demo Orange (Primary Accent)"). Nothing stores a name
 *  for a scraped colour, so position is used rather than inventing one. */
const COLOUR_NAMES = ['Primary Accent', 'Secondary', 'Supporting', 'Supporting', 'Supporting'];
const COLOUR_ROLES = ['Key CTAs & highlights', 'Secondary surfaces', 'Accents', 'Accents', 'Accents'];

export const BrandKnowledgeBase: React.FC<BrandKnowledgeBaseProps> = ({
  onSyncKnowledgeGraph, syncing = false, syncMessage = null, brand, workspaceId = null,
}) => {
  const [copiedColor, setCopiedColor] = useState<string | null>(null);
  const [activeKnowledgeTab, setActiveKnowledgeTab] = useState<string>('overview');
  const [profile, setProfile] = useState<BrandProfile | null>(null);
  const [assets, setAssets] = useState<{ id: number; headline: string; image_url?: string | null }[]>([]);

  useEffect(() => {
    if (!workspaceId) return;
    fetch(`/api/workspaces/${workspaceId}/brand-profile`, { headers: authHeaders() })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setProfile(d); })
      .catch(() => {});
    fetch(`/api/workspaces/${workspaceId}/creatives`, { headers: authHeaders() })
      .then(r => (r.ok ? r.json() : []))
      .then(d => setAssets(Array.isArray(d) ? d.slice(-5).reverse() : []))
      .catch(() => {});
  }, [workspaceId]);

  const brandName = profile?.name || brand?.name || 'This brand';
  const brandUrl = profile?.url || brand?.url || '';
  const guidelines = (profile?.guidelines || {}) as Record<string, unknown>;

  // A brand colour is picked to work on the brand's own site. This one is #0f172a, which is
  // invisible on the near-black hero, so fall back to the reference's orange when the stored
  // colour is too dark to draw with.
  const readable = (hex?: string | null): string => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return '#FF6B00';
    const n = parseInt(m[1], 16);
    const luma = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return luma < 0.25 ? '#FF6B00' : `#${m[1]}`;
  };

  const palette: string[] = (profile?.color_palette?.length
    ? profile.color_palette
    : [profile?.brand_color || brand?.colors || ''].filter(Boolean)) as string[];
  const accent = readable(palette[0]);

  // Prefer the named tokens the crawl read out of the site's CSS variables; fall back to
  // position-based names for workspaces onboarded before those were extracted.
  const colourTokens = (profile?.color_tokens?.length
    ? profile.color_tokens
    : palette.map((hex, idx) => ({
        hex,
        name: COLOUR_NAMES[idx] || 'Supporting',
        role: COLOUR_ROLES[idx] || 'Accents',
        source: 'frequency',
      })));
  const logos = (profile?.logos || []).filter(l => l.url);
  const fonts = Object.entries(profile?.typography || {});
  const categories = Array.isArray(guidelines.categories) ? (guidelines.categories as string[]) : [];
  // Written by onboarding only when the site actually states them.
  const founded = typeof guidelines.founded === 'string' ? guidelines.founded : '';
  const rating = (guidelines.rating || null) as { value: number; count: number | null; scale: number } | null;
  const targetMessages = Array.isArray(guidelines.key_messages) ? (guidelines.key_messages as string[]) : [];

  const knowledgeSections = SECTION_TITLES.map(s => ({
    ...s,
    // Brand Overview falls back to what onboarding wrote; the rest are only filled once
    // someone writes them, because a crawl cannot infer a slogan or a mission.
    content: (typeof guidelines[s.id] === 'string' && (guidelines[s.id] as string).trim())
      ? (guidelines[s.id] as string)
      : (s.id === 'overview' ? (profile?.brand_guidelines_summary || '') : ''),
  }));

  // The reference's own "Add Key Message" control. Its state came from the fixture block
  // that was replaced; restored here so the button works rather than being deleted.
  const [showAddMessage, setShowAddMessage] = useState(false);
  const [newMessageInput, setNewMessageInput] = useState('');

  const handleAddMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = newMessageInput.trim();
    if (!v || !workspaceId) return;
    try {
      const r = await fetch(`/api/workspaces/${workspaceId}/brand-profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ guidelines: { ...guidelines, key_messages: [...targetMessages, v] } }),
      });
      if (r.ok) setProfile(await r.json());
    } catch { /* the message stays in the box so it is not lost */ }
    setNewMessageInput('');
    setShowAddMessage(false);
  };

  // Inline editing for the eight knowledge sections.
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [savingSection, setSavingSection] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const saveSection = async () => {
    if (!workspaceId || !editingSection) return;
    setSavingSection(true);
    setEditError(null);
    try {
      // Merged over the existing guidelines object, never replacing it: the other seven
      // sections and everything the crawl wrote (categories, personas, founded year) live
      // in the same JSON column, and a PATCH that sent only this field would erase them.
      const next = { ...guidelines, [editingSection]: editDraft };
      const r = await fetch(`/api/workspaces/${workspaceId}/brand-profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ guidelines: next }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.detail || `Save failed (${r.status})`);
      }
      setProfile(await r.json());
      setEditingSection(null);
    } catch (e) {
      // The draft stays on screen so nothing typed is lost to a failed request.
      setEditError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setSavingSection(false);
    }
  };

  const handleCopy = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedColor(hex);
    setTimeout(() => setCopiedColor(null), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* ── TOP HERO HEADER ───────────────────────────────────────── */}
      <div
        className="glow-card"
        style={{
          background: 'linear-gradient(135deg, rgba(255, 107, 0, 0.12) 0%, rgba(13, 13, 20, 0.95) 100%)',
          border: '1px solid rgba(255, 107, 0, 0.35)',
          borderRadius: '24px',
          padding: '28px 32px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '18px',
                background: '#000000',
                border: `2px solid ${accent}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 20px rgba(255, 107, 0, 0.35)'
              }}
            >
              <span style={{ fontSize: '32px', fontWeight: 900, color: accent, fontFamily: 'var(--font-heading)' }}>{brandName.charAt(0).toUpperCase()}</span>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <h1 style={{ fontSize: '28px', color: '#fff', margin: 0, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
                  {brandName}
                </h1>
                <span style={{ fontSize: '11px', background: profile?.is_onboarded ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255, 193, 7, 0.12)', color: profile?.is_onboarded ? '#00E676' : '#ffc107', border: `1px solid ${profile?.is_onboarded ? 'rgba(0, 230, 118, 0.3)' : 'rgba(255, 193, 7, 0.3)'}`, padding: '3px 10px', borderRadius: '100px', fontWeight: 700 }}>
                  {profile?.is_onboarded ? '✓ Ingested & Active' : 'Not indexed yet'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <a
                  href={brandUrl || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '13.5px', color: accent, display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontWeight: 600 }}
                >
                  <Globe size={14} /> {brandUrl || 'No website set'} <ExternalLink size={12} />
                </a>
                <span style={{ color: 'var(--text-muted)' }}>•</span>
                {/* Categories, plus "Est. YYYY" when the site states a founding year. The
                    reference had "Direct-to-Consumer Lifestyle Tech (Est. 2022)" as fixed
                    text for every brand. */}
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {[categories.length ? categories.join(' · ') : '',
                    founded ? `Est. ${founded}` : '']
                    .filter(Boolean).join(' · ') || 'No categories set'}
                </span>
                {/* The rating slot only appears when the brand publishes one. The reference
                    showed "⭐ 4.8+ Verified Rating" whatever the site said. */}
                {rating?.value ? (
                  <>
                    <span style={{ color: 'var(--text-muted)' }}>•</span>
                    <span style={{ fontSize: '13px', color: '#FFB300', fontWeight: 600 }}>
                      ⭐ {rating.value}/{rating.scale || 5}
                      {rating.count ? ` from ${rating.count.toLocaleString()} reviews` : ''}
                    </span>
                  </>
                ) : (
                  <>
                    <span style={{ color: 'var(--text-muted)' }}>•</span>
                    <span style={{ fontSize: '13px', color: '#FFB300', fontWeight: 600 }}>
                      {profile?.is_onboarded ? 'Indexed from site' : 'Awaiting first crawl'}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => {
                // The reference alerted; this writes the file it claims to.
                const kit = {
                  exportedAt: new Date().toISOString(),
                  brand: { name: brandName, website: brandUrl || null, voice: profile?.brand_voice || null },
                  palette,
                  typography: profile?.typography || {},
                  targetAudience: profile?.target_audience || null,
                  categories,
                  keyMessages: targetMessages,
                  knowledge: knowledgeSections.map(s => ({ title: s.title, content: s.content })),
                };
                const blob = new Blob([JSON.stringify(kit, null, 2)], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `${brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-brand-kit.json`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(a.href);
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#fff',
                borderRadius: '100px',
                padding: '9px 20px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Export Kit
            </button>
            <GlowButton
              variant="glow"
              onClick={() => onSyncKnowledgeGraph && onSyncKnowledgeGraph()}
              disabled={syncing || !onSyncKnowledgeGraph}
              style={{ fontSize: '13px', padding: '9px 22px', opacity: syncing ? 0.6 : 1 }}
            >
              <Sparkles size={14} /> {syncing ? 'Re-indexing…' : 'Sync Knowledge Graph'}
            </GlowButton>
          </div>
        </div>
      </div>

      {/* Re-indexing crawls the site and re-embeds it, which takes a minute or two, so the
          outcome is reported rather than left to a fire-and-forget alert. */}
      {syncMessage && (
        <div style={{ padding: '10px 14px', borderRadius: '8px', fontSize: '12.5px',
                      background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)',
                      color: syncMessage.ok ? 'var(--text-secondary)' : 'var(--warning)' }}>
          {syncMessage.text}
        </div>
      )}

      {/* ── 1. LOGO, COLOR PALETTE & TYPOGRAPHY ───────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: '24px' }}>
        
        {/* LOGO BOX */}
        <div className="glow-card" style={{ background: '#0a0a12', borderRadius: '20px', padding: '24px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <ImageIcon size={18} color="#FF6B00" />
            <h3 style={{ fontSize: '17px', color: '#fff', margin: 0, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
              Brand Logos
            </h3>
          </div>

          {/* Real logo files when the crawl found them. Each is shown twice — on black and
              on white — because that is the question anyone opening this panel has: does
              the mark survive both grounds, or is there only a light-background version? */}
          {logos.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))', gap: '14px' }}>
              {logos.slice(0, 4).map(logo => (
                <div key={logo.url} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    {['#000000', '#ffffff'].map(bg => (
                      <div key={bg} style={{
                        background: bg,
                        border: `1px solid ${bg === '#000000' ? `${accent}4d` : 'rgba(255,255,255,0.2)'}`,
                        borderRadius: '10px', padding: '14px', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', minHeight: '64px',
                      }}>
                        <img
                          src={logo.url}
                          alt={`${brandName} logo on ${bg === '#000000' ? 'dark' : 'light'}`}
                          style={{ maxWidth: '100%', maxHeight: '40px', objectFit: 'contain' }}
                        />
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: '11.5px', color: '#fff', fontWeight: 700 }}>{logo.type}</div>
                    <a
                      href={logo.url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: '10px', color: 'var(--text-muted)', textDecoration: 'none' }}
                    >
                      {logo.format.toUpperCase()} · open file
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              {/* No logo file was found in the markup, so the wordmark stands in and says so
                  rather than implying an asset exists. */}
              <div style={{ background: '#000000', border: `1px solid ${accent}4d`, borderRadius: '14px', padding: '20px', textAlign: 'center' }}>
                <div style={{ fontSize: '22px', fontWeight: 900, color: accent, letterSpacing: '-0.02em', marginBottom: '4px' }}>
                  {brandName.toUpperCase()}
                </div>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>Wordmark — on dark</span>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{palette[0] || 'no colour stored'}</div>
              </div>

              <div style={{ background: '#ffffff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '14px', padding: '20px', textAlign: 'center' }}>
                <div style={{ fontSize: '22px', fontWeight: 900, color: palette[0] || '#000000', letterSpacing: '-0.02em', marginBottom: '4px' }}>
                  {brandName.toUpperCase()}
                </div>
                <span style={{ fontSize: '11px', color: '#666', fontWeight: 600 }}>Wordmark — on light</span>
                <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>No logo file found on the site</div>
              </div>
            </div>
          )}
        </div>

        {/* TYPOGRAPHY BOX */}
        <div className="glow-card" style={{ background: '#0a0a12', borderRadius: '20px', padding: '24px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Type size={18} color="#00D2FF" />
            <h3 style={{ fontSize: '17px', color: '#fff', margin: 0, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
              Typography
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {/* Figtree and Inter were shown for every brand. These are the fonts read off
                this site. */}
            {fonts.map(([role, family], i) => (
              <div key={role} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '16px' }}>
                <div style={{ fontSize: '32px', fontWeight: 900, color: '#fff', marginBottom: '4px', fontFamily: `'${String(family)}', var(--font-heading)` }}>Aa</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: i === 0 ? '#00D2FF' : '#00E676' }}>{String(family)}</div>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                  {role === 'heading' ? 'Primary Display & Headings' : role === 'body' ? 'Body Copy & Spec Tables' : role}
                </span>
              </div>
            ))}
            {!fonts.length && (
              <div style={{ gridColumn: '1 / -1', fontSize: '12px', color: 'var(--text-muted)' }}>
                No fonts detected on the site.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── COLOR PALETTE ─────────────────────────────────────────── */}
      <div className="glow-card" style={{ background: '#0a0a12', borderRadius: '20px', padding: '24px', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Palette size={18} color="#FF6B00" />
          <h3 style={{ fontSize: '17px', color: '#fff', margin: 0, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
            Color Tokens
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '14px' }}>
          {colourTokens.map(token => (
            <div
              key={token.hex}
              onClick={() => handleCopy(token.hex)}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '14px',
                padding: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ height: '48px', borderRadius: '10px', background: token.hex, marginBottom: '10px', border: '1px solid rgba(255,255,255,0.15)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>{token.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{token.role}</div>
                  {/* Whether the site named this colour itself or we inferred it from usage
                      frequency changes how much to trust the role above, so it is shown. */}
                  {token.source === 'css-variable' && (
                    <div style={{ fontSize: '10px', color: '#00E676', marginTop: '2px' }}>declared in site CSS</div>
                  )}
                </div>
                <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: accent, background: `${accent}1f`, padding: '3px 8px', borderRadius: '6px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {copiedColor === token.hex ? '✓ Copied' : token.hex}
                </div>
              </div>
            </div>
          ))}

          {!colourTokens.length && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              No colours read from the site yet.
            </div>
          )}
        </div>
      </div>

      {/* ── 2. BRAND KNOWLEDGE & STRATEGY TABS ────────────────────── */}
      <div
        className="glow-card"
        style={{
          background: '#0a0a12',
          borderRadius: '20px',
          padding: '28px',
          border: '1px solid rgba(124, 117, 255, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={18} color="#7C75FF" />
          <h3 style={{ fontSize: '19px', color: '#fff', margin: 0, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
            Brand Knowledge & Positioning
          </h3>
        </div>

        {/* Horizontal Navigation Pills */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px' }}>
          {knowledgeSections.map((sec) => (
            <button
              key={sec.id}
              onClick={() => setActiveKnowledgeTab(sec.id)}
              style={{
                background: activeKnowledgeTab === sec.id ? 'rgba(255, 107, 0, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                border: '1px solid',
                borderColor: activeKnowledgeTab === sec.id ? '#FF6B00' : 'rgba(255, 255, 255, 0.08)',
                color: activeKnowledgeTab === sec.id ? '#FF6B00' : 'var(--text-secondary)',
                padding: '8px 18px',
                borderRadius: '100px',
                fontSize: '12.5px',
                fontWeight: activeKnowledgeTab === sec.id ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease'
              }}
            >
              {sec.title}
            </button>
          ))}
        </div>

        {/* Tab Content Display */}
        {knowledgeSections.find(s => s.id === activeKnowledgeTab) && (
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '24px',
              lineHeight: 1.7,
              fontSize: '14.5px',
              color: 'rgba(255, 255, 255, 0.9)',
              whiteSpace: 'pre-line'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ fontSize: '17px', fontWeight: 800, color: '#fff' }}>
                {knowledgeSections.find(s => s.id === activeKnowledgeTab)?.title}
              </div>
              {/* Every extracted section is editable. The crawl's read is a starting point,
                  and until now the only writable field in this whole panel was "Add Key
                  Message" - so a wrong mission or a mis-read tone could not be corrected
                  without re-running onboarding and hoping for a different answer. */}
              {editingSection !== activeKnowledgeTab && (
                <button
                  onClick={() => {
                    setEditingSection(activeKnowledgeTab);
                    setEditDraft(knowledgeSections.find(s => s.id === activeKnowledgeTab)?.content || '');
                    setEditError(null);
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                    color: '#fff', padding: '5px 14px', borderRadius: '100px', fontSize: '12px',
                    fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  Edit
                </button>
              )}
            </div>

            {editingSection === activeKnowledgeTab ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <textarea
                  value={editDraft}
                  onChange={e => setEditDraft(e.target.value)}
                  rows={10}
                  autoFocus
                  style={{
                    width: '100%', background: 'rgba(0,0,0,0.5)',
                    border: '1px solid rgba(255,255,255,0.18)', borderRadius: '12px',
                    color: '#fff', padding: '14px 16px', fontSize: '14px', lineHeight: 1.7,
                    fontFamily: 'inherit', resize: 'vertical', outline: 'none',
                  }}
                />
                {editError && (
                  <div style={{ fontSize: '12.5px', color: '#ff4757' }}>{editError}</div>
                )}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <GlowButton
                    variant="glow"
                    onClick={saveSection}
                    disabled={savingSection}
                    style={{ padding: '8px 20px', fontSize: '12.5px' }}
                  >
                    {savingSection ? 'Saving…' : 'Save'}
                  </GlowButton>
                  <button
                    onClick={() => { setEditingSection(null); setEditError(null); }}
                    disabled={savingSection}
                    style={{
                      background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                      color: 'var(--text-secondary)', padding: '8px 18px', borderRadius: '100px',
                      fontSize: '12.5px', cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              knowledgeSections.find(s => s.id === activeKnowledgeTab)?.content
                || 'Nothing recorded for this section yet — run Sync Knowledge Graph to extract it from the site, or Edit to write it yourself.'
            )}
          </div>
        )}
      </div>

      {/* ── 3. ASSETS SHOWCASE ─────────────────────────────────────── */}
      <div className="glow-card" style={{ background: '#0a0a12', borderRadius: '20px', padding: '24px', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} color="#FF5296" />
            <h3 style={{ fontSize: '17px', color: '#fff', margin: 0, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
              Assets Library
            </h3>
          </div>
          <span style={{ fontSize: '12px', color: '#FF6B00', cursor: 'pointer', fontWeight: 600 }}>
            View More ↗
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '14px' }}>
          {assets.map((asset) => (
            <div
              key={asset.id}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '14px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              {/* File sizes and types like "2.4 MB • Vector SVG" described files that were
                  never stored. These are the creatives this workspace generated. */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', background: `${accent}26`, color: accent, padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                  Generated
                </span>
              </div>
              {asset.image_url && (
                <img src={asset.image_url} alt="" style={{ width: '100%', height: '90px', objectFit: 'cover', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }} />
              )}
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#fff' }}>
                {asset.headline || 'Untitled creative'}
              </div>
            </div>
          ))}

          {!assets.length && (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              No creatives generated for this workspace yet.
            </span>
          )}
        </div>
      </div>

      {/* ── 4. TARGET AUDIENCE, CATEGORIES & COUNTRIES ─────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(360px, 100%), 1fr))', gap: '24px' }}>
        
        {/* COUNTRIES & CATEGORIES */}
        <div className="glow-card" style={{ background: '#0a0a12', borderRadius: '20px', padding: '24px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Compass size={18} color="#00E676" />
            <h3 style={{ fontSize: '17px', color: '#fff', margin: 0, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
              Market & Categories
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                Primary Geographies & Language:
              </span>
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                {/* "Global (US, India, UK)" and "English" were fixed for every brand. */}
                <span style={{ background: 'rgba(255,255,255,0.06)', color: guidelines.markets ? '#fff' : 'var(--text-muted)', padding: '6px 14px', borderRadius: '100px', fontSize: '13px', fontWeight: 600 }}>
                  🌐 {String(guidelines.markets || 'Not set')}
                </span>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                Product Categories:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                {categories.map(cat => (
                  <span
                    key={cat}
                    style={{
                      background: 'rgba(0, 230, 118, 0.1)',
                      border: '1px solid rgba(0, 230, 118, 0.25)',
                      color: '#00E676',
                      padding: '5px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 600
                    }}
                  >
                    {cat}
                  </span>
                ))}
                {!categories.length && (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>None set.</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* TARGET AUDIENCE & KEY MESSAGES */}
        <div className="glow-card" style={{ background: '#0a0a12', borderRadius: '20px', padding: '24px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Target size={18} color="#A855F7" />
              <h3 style={{ fontSize: '17px', color: '#fff', margin: 0, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
                Target Audience & Key Messages
              </h3>
            </div>
            
            <button
              onClick={() => setShowAddMessage(!showAddMessage)}
              style={{
                background: 'rgba(168, 85, 247, 0.15)',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                color: '#A855F7',
                padding: '4px 10px',
                borderRadius: '100px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Plus size={12} /> Add Key Message
            </button>
          </div>

          {showAddMessage && (
            <form onSubmit={handleAddMessage} style={{ marginBottom: '14px', display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Enter new key message hook..."
                value={newMessageInput}
                onChange={e => setNewMessageInput(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '12.5px',
                  outline: 'none'
                }}
              />
              <button
                type="submit"
                style={{ background: '#A855F7', color: '#fff', border: 'none', borderRadius: '8px', padding: '0 14px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
              >
                Add
              </button>
            </form>
          )}

          {/* Four invented segment/message pairs about a power-bank buyer lived here. The
              audience comes from the crawl; the messages are whatever this workspace has
              stored. Same row markup as the reference. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {profile?.target_audience && (
              <div
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ fontSize: '13px', color: '#fff', fontWeight: 700 }}>
                  👥 {profile.target_audience}
                </div>
              </div>
            )}

            {targetMessages.map((message, idx) => (
              <div
                key={idx}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  💬 <em>"{message}"</em>
                </div>
              </div>
            ))}

            {!profile?.target_audience && !targetMessages.length && (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                No audience or key messages recorded yet.
              </span>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
