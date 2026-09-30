import React, { useEffect, useRef, useState } from 'react';
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
import { BrandStructuredEditor, type StructuredKind } from './BrandStructuredEditor';

/** One audience segment plus the line written to stop them scrolling. Mirrors the
 *  backend's Persona model in core/brand_kit.py. */
interface Persona {
  persona?: string;
  hook?: string;
}

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
  /** Computed by the backend from the stored kit - see core/brand_kit.assess_brand_kit. */
  quality?: BrandQuality;
}

/** Every number here is calculated from the kit's own contents, never asserted. */
interface BrandQuality {
  completeness_pct: number;
  completeness_missing: string[];
  evidence_coverage_pct: number;
  specificity: 'high' | 'medium' | 'low';
  generic_phrases: string[];
  thin_usps: string[];
  duplicate_claims: number;
  unsupported_claims: string[];
  counts: Record<string, number>;
  agent_questions_answerable: Record<string, boolean>;
  agent_readiness_pct: number;
  /** How much of the knowledge is actually JOINED UP - the share of personas the system can
   *  reach a product or differentiator for. Presence and usability are different things: a
   *  vault can list five personas and five categories and still not say which goes with which. */
  connected_pct?: number;
  personas_without_offer?: string[];
  categories_without_audience?: string[];
}

interface BrandKnowledgeBaseProps {
  /** Runs the real re-index: rescrapes the site and rebuilds the vector store. */
  onSyncKnowledgeGraph?: () => void;
  syncing?: boolean;
  syncMessage?: { text: string; ok: boolean } | null;
  /** Bumped by the parent when a re-index finishes, to pull the rebuilt kit back in.
   *  Without it the screen kept showing the pre-sync content and assets, so a successful
   *  "Knowledge base rebuilt." sat above data the sync had already replaced. */
  reloadKey?: number;
  brand?: { name?: string; url?: string; tone?: string; colors?: string };
  workspaceId?: number | null;
}

/** How a field is stored, which decides how it is edited and saved.
 *  - text    : a string inside the guidelines JSON
 *  - list    : a string[] inside guidelines, edited one item per line
 *  - profile : a string column on the brand profile itself, not inside guidelines */
type SectionKind = 'text' | 'list' | 'profile' | 'personas'
  // Structured sections read their own object out of guidelines rather than a string.
  | 'usps' | 'catalogue' | 'jtbd' | 'voice' | 'messaging' | 'claims';

/** Section ids and titles. The first nine are the reference's, so the tab strip reads
 *  identically; the rest are fields onboarding has always extracted but which had no way
 *  to be corrected - they were displayed read-only, or not displayed at all. */
const SECTION_TITLES: { id: string; title: string; kind: SectionKind; hint?: string }[] = [
  { id: 'overview', title: 'Brand Overview', kind: 'text' },
  { id: 'usps', title: 'Unique Selling Points (USPs)', kind: 'text' },
  { id: 'features', title: 'Key Features & Benefits', kind: 'text' },
  { id: 'slogan', title: 'Brand Slogan & Mission', kind: 'text' },
  { id: 'personality', title: 'Brand Personality', kind: 'text' },
  { id: 'visual', title: 'Visual Design & Brand Identity', kind: 'text' },
  { id: 'competitive', title: 'Competitive Position', kind: 'text' },
  // Onboarding has always extracted business_model, but no section rendered it, so it was
  // stored and never shown. Added rather than dropped: it is one of the more useful things
  // the crawl determines about a brand.
  { id: 'business_model', title: 'Business Model', kind: 'text' },
  { id: 'tone', title: 'Tone of Voice', kind: 'text' },
  { id: 'target_audience', title: 'Target Audience', kind: 'profile',
    hint: 'Who this brand sells to. Used by every agent that writes copy.' },
  // The crawl has always produced target_audiences - a list of {persona, hook} pairs, the
  // single richest thing it extracts - and kit_to_guidelines never mapped it to a section,
  // so four named segments with a written ad hook each sat in the JSON, invisible.
  { id: 'target_audiences', title: 'Audience Personas', kind: 'personas',
    hint: 'One per line, written as "Persona — hook". The hook is the line that would stop that segment scrolling.' },
  { id: 'categories', title: 'Product Categories', kind: 'list',
    hint: 'One per line.' },
  { id: 'key_messages', title: 'Key Messages', kind: 'list',
    hint: 'One per line.' },
  { id: 'markets', title: 'Markets', kind: 'text',
    hint: 'Where the brand sells.' },
  // Structured sections. These read an object out of guidelines rather than a string, and
  // only appear when a crawl has actually produced them - a brand onboarded before the
  // structured schema existed simply does not show these tabs, rather than showing empties.
  { id: 'structured_usps', title: 'Differentiators', kind: 'usps' },
  { id: 'catalogue', title: 'Products & Services', kind: 'catalogue' },
  { id: 'jobs_to_be_done', title: 'Customer Jobs', kind: 'jtbd' },
  { id: 'voice', title: 'Voice Guide', kind: 'voice' },
  { id: 'messaging', title: 'Messaging', kind: 'messaging' },
  { id: 'verified_claims', title: 'Claims & Guardrails', kind: 'claims' },
];

/** Kinds whose data is an object/array in guidelines, not an editable string. */
const STRUCTURED_KINDS: SectionKind[] = ['usps', 'catalogue', 'jtbd', 'voice', 'messaging', 'claims'];

/** Kinds edited by BrandStructuredEditor rather than a textarea.
 *
 *  'personas' is included even though it renders as text: its old textarea rewrote every
 *  persona as {persona, hook} and silently dropped the ten other fields the schema defines
 *  - including `categories`, which is the link the brand graph uses to answer "what should
 *  we promote to this segment". Editing it structurally is what stops that data loss. */
const EDITABLE_STRUCTURED: SectionKind[] = [...STRUCTURED_KINDS, 'personas'];

const SECTION_BY_ID = Object.fromEntries(SECTION_TITLES.map(s => [s.id, s]));

const EMPTY_SECTION =
  'Nothing recorded for this section yet — run Sync Knowledge Graph to extract it from the site, or Edit to write it yourself.';

/** A small "stated / inferred · confidence" marker.
 *
 *  The point of the whole evidence layer: a warranty length the site prints and a model's
 *  read on positioning used to look identical on screen. Now they do not. */
const EvidenceMark: React.FC<{ ev?: { source_url?: string; snippet?: string; confidence?: string; basis?: string } }> = ({ ev }) => {
  if (!ev || (!ev.source_url && !ev.basis)) return null;
  const inferred = ev.basis === 'inferred';
  const conf = ev.confidence || 'medium';
  const colour = inferred ? '#FFB300' : '#00E676';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
      <span style={{
        fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em',
        color: colour, background: `${colour}1f`, border: `1px solid ${colour}55`,
        padding: '2px 8px', borderRadius: '100px',
      }}>
        {inferred ? 'Inferred' : 'Stated'} · {conf}
      </span>
      {ev.source_url && (
        <a href={ev.source_url} target="_blank" rel="noopener noreferrer"
           title={ev.snippet || ev.source_url}
           style={{ fontSize: '11px', color: 'var(--text-muted)', textDecoration: 'none',
                    display: 'inline-flex', alignItems: 'center', gap: '4px', maxWidth: '100%',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <ExternalLink size={10} /> source
        </a>
      )}
    </div>
  );
};

const KCard: React.FC<{ accent: string; children: React.ReactNode }> = ({ accent, children }) => (
  <div style={{
    background: `${accent}0f`, border: `1px solid ${accent}38`, borderRadius: '14px',
    padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '8px',
  }}>
    {children}
  </div>
);

const KLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase',
                 letterSpacing: '0.05em', color: 'var(--text-muted)' }}>{children}</span>
);

const KChips: React.FC<{ items: unknown[]; accent: string }> = ({ items, accent }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
    {items.map((v, i) => (
      <span key={i} style={{
        fontSize: '11.5px', color: accent, background: `${accent}1a`,
        border: `1px solid ${accent}44`, padding: '3px 10px', borderRadius: '100px',
      }}>{String(v)}</span>
    ))}
  </div>
);

const K_GRID: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
  gap: '12px',
};

/** Renders the structured sections, which are objects in guidelines rather than strings.
 *
 *  Kept apart from renderSectionBody on purpose: these have real shape, and flattening
 *  them to text to reuse that path is exactly the mistake this change undoes. */
const renderStructured = (kind: SectionKind, raw: unknown): React.ReactNode => {
  const arr = Array.isArray(raw) ? (raw as Record<string, any>[]) : [];
  const obj = (raw && !Array.isArray(raw) ? raw : {}) as Record<string, any>;
  if (!arr.length && !Object.keys(obj).length) {
    return (
      <span style={{ color: 'var(--text-muted)' }}>
        Not yet extracted for this brand. Run Sync Knowledge Graph — this section is filled by the structured crawl.
      </span>
    );
  }

  if (kind === 'usps') {
    return (
      <div style={K_GRID}>
        {arr.map((u, i) => (
          <KCard key={i} accent="#FF6B00">
            <div style={{ fontSize: '14.5px', fontWeight: 800, color: '#fff' }}>{u.name || u.feature}</div>
            {u.feature && <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.8)' }}><KLabel>What</KLabel> {u.feature}</div>}
            {u.benefit && <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.8)' }}><KLabel>Why it matters</KLabel> {u.benefit}</div>}
            {u.audience && <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.8)' }}><KLabel>Who cares</KLabel> {u.audience}</div>}
            {u.messaging_angle && <div style={{ fontSize: '12.5px', color: '#FF6B00', fontStyle: 'italic' }}>{u.messaging_angle}</div>}
            <EvidenceMark ev={u.evidence} />
          </KCard>
        ))}
      </div>
    );
  }

  if (kind === 'catalogue') {
    return (
      <div style={K_GRID}>
        {arr.map((c, i) => (
          <KCard key={i} accent="#00D2FF">
            <div style={{ fontSize: '14.5px', fontWeight: 800, color: '#fff' }}>{c.name}</div>
            {c.benefit && <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.82)', lineHeight: 1.55 }}>{c.benefit}</div>}
            {!!(c.products || []).length && (<><KLabel>Products</KLabel><KChips items={c.products} accent="#00D2FF" /></>)}
            {!!(c.technologies || []).length && (<><KLabel>Tech / materials</KLabel><KChips items={c.technologies} accent="#7C75FF" /></>)}
            {c.use_case && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}><KLabel>Use case</KLabel> {c.use_case}</div>}
            {c.audience && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}><KLabel>For</KLabel> {c.audience}</div>}
            {c.price_range && <div style={{ fontSize: '12px', color: '#00E676' }}>{c.price_range}</div>}
            <EvidenceMark ev={c.evidence} />
          </KCard>
        ))}
      </div>
    );
  }

  if (kind === 'jtbd') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {arr.map((j, i) => (
          <KCard key={i} accent="#00E676">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', fontSize: '12.5px' }}>
              <span style={{ color: 'rgba(255,255,255,0.85)' }}>{j.situation}</span>
              <span style={{ color: 'var(--text-muted)' }}>→</span>
              <span style={{ color: '#FFB300' }}>{j.problem}</span>
              <span style={{ color: 'var(--text-muted)' }}>→</span>
              <span style={{ color: 'rgba(255,255,255,0.85)' }}>{j.desired_outcome}</span>
              <span style={{ color: 'var(--text-muted)' }}>→</span>
              <span style={{ color: '#00E676', fontWeight: 700 }}>{j.brand_response}</span>
            </div>
            <EvidenceMark ev={j.evidence} />
          </KCard>
        ))}
      </div>
    );
  }

  if (kind === 'voice') {
    const traits = (obj.traits || []) as Record<string, any>[];
    const scalars = ([
      ['Formality', obj.formality], ['Energy', obj.energy],
      ['Sentence style', obj.sentence_style], ['Vocabulary', obj.vocabulary],
      ['CTA style', obj.cta_style],
    ] as [string, string][]).filter(([, v]) => !!v);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {!!traits.length && (
          <div style={K_GRID}>
            {traits.map((t, i) => (
              <KCard key={i} accent="#7C75FF">
                <div style={{ fontSize: '14.5px', fontWeight: 800, color: '#fff' }}>{t.trait}</div>
                {t.sounds_like && <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.8)' }}><KLabel>Sounds like</KLabel> {t.sounds_like}</div>}
                {t.example && <div style={{ fontSize: '13px', color: '#fff', fontStyle: 'italic', borderLeft: '2px solid #7C75FF', paddingLeft: '10px' }}>“{t.example}”</div>}
                {t.avoid && <div style={{ fontSize: '12.5px', color: '#ff6b7a' }}><KLabel>Avoid</KLabel> {t.avoid}</div>}
              </KCard>
            ))}
          </div>
        )}
        {!!scalars.length && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px', fontSize: '12.5px' }}>
            {scalars.map(([k, v]) => (
              <div key={k}><KLabel>{k}</KLabel><div style={{ color: 'rgba(255,255,255,0.85)' }}>{v}</div></div>
            ))}
          </div>
        )}
        {!!(obj.use_words || []).length && (<div><KLabel>Use these words</KLabel><KChips items={obj.use_words} accent="#00E676" /></div>)}
        {!!(obj.avoid_words || []).length && (<div><KLabel>Never use</KLabel><KChips items={obj.avoid_words} accent="#ff4757" /></div>)}
      </div>
    );
  }

  if (kind === 'messaging') {
    const supporting = (obj.supporting || []) as Record<string, any>[];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {obj.core_message && (
          <div style={{ fontSize: '17px', fontWeight: 800, color: '#fff', lineHeight: 1.45,
                        borderLeft: '3px solid #FF6B00', paddingLeft: '14px' }}>
            {obj.core_message}
          </div>
        )}
        {!!supporting.length && (
          <div style={K_GRID}>
            {supporting.map((m, i) => (
              <KCard key={i} accent="#FF6B00">
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#fff', lineHeight: 1.5 }}>{m.message}</div>
                {!!(m.proof_points || []).length && (<><KLabel>Proof</KLabel><KChips items={m.proof_points} accent="#00E676" /></>)}
              </KCard>
            ))}
          </div>
        )}
        {!!(obj.functional_benefits || []).length && (<div><KLabel>Functional benefits</KLabel><KChips items={obj.functional_benefits} accent="#00D2FF" /></div>)}
        {!!(obj.emotional_benefits || []).length && (<div><KLabel>Emotional benefits</KLabel><KChips items={obj.emotional_benefits} accent="#FF5296" /></div>)}
        {!!(obj.angles || []).length && (<div><KLabel>Angles</KLabel><KChips items={obj.angles} accent="#7C75FF" /></div>)}
      </div>
    );
  }

  return null;
};

/** Claims an ad may safely repeat, and claims it must not make.
 *  Both come straight from the crawl; the second exists to stop generated copy inventing
 *  a certification or a superlative the brand never published. */
const renderClaims = (verified: unknown[], unsupported: unknown[]): React.ReactNode => {
  if (!verified.length && !unsupported.length) {
    return (
      <span style={{ color: 'var(--text-muted)' }}>
        Not yet extracted for this brand. Run Sync Knowledge Graph — this section is filled by the structured crawl.
      </span>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {!!verified.length && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <KLabel>Safe to claim — the site states these</KLabel>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {verified.map((c, i) => (
              <li key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', lineHeight: 1.6, fontSize: '13px' }}>
                <span style={{ color: '#00E676', fontWeight: 800, flexShrink: 0 }}>✓</span>
                <span>{String(c)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!!unsupported.length && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <KLabel>Do not claim — nothing in this brand&rsquo;s content supports these</KLabel>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {unsupported.map((c, i) => (
              <li key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', lineHeight: 1.6, fontSize: '13px' }}>
                <span style={{ color: '#ff4757', fontWeight: 800, flexShrink: 0 }}>✕</span>
                <span>{String(c)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

/** Renders a section's stored text as the structure it actually is.
 *
 *  Everything used to print through a single `whiteSpace: pre-line` div, which flattened
 *  genuinely good extraction into a wall of grey. The crawl writes USPs and benefits as
 *  markdown-ish "- item" lines, so a reader saw literal hyphens; categories and key
 *  messages are arrays joined by newlines, so they read as run-on prose; and the audience
 *  personas — the richest thing the crawl produces, a named segment plus a written ad hook
 *  for each — had no section at all. The content was never the weak part; the presentation
 *  was throwing it away. */
const renderSectionBody = (
  section: { id: string; kind: SectionKind } | undefined,
  content: string,
): React.ReactNode => {
  const text = (content || '').trim();
  if (!text) {
    return <span style={{ color: 'var(--text-muted)' }}>{EMPTY_SECTION}</span>;
  }

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Audience personas: a card each, hook set apart from the segment it targets.
  if (section?.kind === 'personas') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: '12px' }}>
        {lines.map((line, i) => {
          const dash = line.indexOf('—');
          const who = dash === -1 ? line : line.slice(0, dash).trim();
          const hook = dash === -1 ? '' : line.slice(dash + 1).trim();
          return (
            <div key={i} style={{
              background: 'rgba(124, 117, 255, 0.06)', border: '1px solid rgba(124, 117, 255, 0.22)',
              borderRadius: '14px', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '8px',
            }}>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#fff', lineHeight: 1.35 }}>{who}</div>
              {hook && (
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.78)', lineHeight: 1.55, fontStyle: 'italic' }}>
                  “{hook}”
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Comma-separated attribute sections (personality, tone) read far better as chips than
  // as one long sentence the eye has to parse.
  if ((section?.id === 'personality' || section?.id === 'tone') && lines.length === 1 && text.includes(',')) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {text.split(',').map(v => v.trim()).filter(Boolean).map((v, i) => (
          <span key={i} style={{
            background: 'rgba(255, 107, 0, 0.12)', border: '1px solid rgba(255, 107, 0, 0.3)',
            color: '#FF6B00', padding: '5px 14px', borderRadius: '100px', fontSize: '12.5px', fontWeight: 700,
          }}>
            {v}
          </span>
        ))}
      </div>
    );
  }

  // Anything stored as a list, or prose the crawl already bulleted.
  const bulleted = lines.every(l => l.startsWith('- ') || l.startsWith('• '));
  if (section?.kind === 'list' || (bulleted && lines.length > 1)) {
    return (
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {lines.map((l, i) => (
          <li key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', lineHeight: 1.6 }}>
            <span style={{ color: '#FF6B00', fontWeight: 800, flexShrink: 0, marginTop: '1px' }}>▸</span>
            <span>{l.replace(/^[-•]\s*/, '')}</span>
          </li>
        ))}
      </ul>
    );
  }

  // Prose: keep paragraph breaks instead of collapsing everything into one block.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i} style={{ margin: 0, lineHeight: 1.75 }}>{para.trim()}</p>
      ))}
    </div>
  );
};

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
  reloadKey = 0,
}) => {
  const [copiedColor, setCopiedColor] = useState<string | null>(null);
  const [activeKnowledgeTab, setActiveKnowledgeTab] = useState<string>('overview');
  const [profile, setProfile] = useState<BrandProfile | null>(null);
  const [assets, setAssets] = useState<{ id: number; headline: string; image_url?: string | null }[]>([]);
  const [loadState, setLoadState] = useState<{ phase: 'loading' | 'ready' | 'error'; message?: string }>({ phase: 'loading' });
  /** Re-runs the load effect without a full remount, for the Retry button. */
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!workspaceId) { setLoadState({ phase: 'error', message: 'No workspace selected yet.' }); return; }
    let live = true;
    setLoadState({ phase: 'loading' });
    // Both failure paths used to end in `.catch(() => {})`, so a 401, a cold backend or an
    // offline network left the page sitting on an empty shell with nothing to click and no
    // hint that anything had gone wrong - the reported "Brand Knowledge isn't loading".
    fetch(`/api/workspaces/${workspaceId}/brand-profile`, { headers: authHeaders() })
      .then(async r => {
        if (!live) return;
        if (r.ok) { setProfile(await r.json()); setLoadState({ phase: 'ready' }); return; }
        setLoadState({
          phase: 'error',
          message: r.status === 401 || r.status === 403
            ? 'Your session has expired. Sign in again to see this brand’s knowledge.'
            : `Couldn’t load the brand profile (server said ${r.status}).`,
        });
      })
      .catch(() => {
        if (live) setLoadState({ phase: 'error', message: 'Couldn’t reach the server. Check your connection and retry.' });
      });
    fetch(`/api/workspaces/${workspaceId}/creatives`, { headers: authHeaders() })
      .then(r => (r.ok ? r.json() : []))
      .then(d => { if (live) setAssets(Array.isArray(d) ? d.slice(-5).reverse() : []); })
      .catch(() => {});
    return () => { live = false; };
    // reloadKey re-runs this after a sync, so the rebuilt guidelines, palette, logos,
    // typography and assets replace what was on screen before it ran.
  }, [workspaceId, reloadKey, retryKey]);

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

  /** The stored value for a section, rendered as the text the editor shows. A list is one
   *  item per line, which is also how it is typed back in. */
  const sectionContent = (s: { id: string; kind: SectionKind }): string => {
    if (s.kind === 'profile') {
      const v = (profile as Record<string, unknown> | null)?.[s.id];
      return typeof v === 'string' ? v : '';
    }
    const raw = guidelines[s.id];
    if (s.kind === 'personas') {
      return Array.isArray(raw)
        ? (raw as Persona[])
            .map(p => [p?.persona, p?.hook].filter(Boolean).join(' — '))
            .filter(Boolean).join('\n')
        : '';
    }
    if (s.kind === 'list') {
      return Array.isArray(raw) ? (raw as unknown[]).map(String).join('\n') : '';
    }
    if (typeof raw === 'string' && raw.trim()) return raw;
    // Brand Overview falls back to what onboarding wrote; the rest are only filled once
    // someone writes them, because a crawl cannot infer a slogan or a mission.
    return s.id === 'overview' ? (profile?.brand_guidelines_summary || '') : '';
  };

  const knowledgeSections = SECTION_TITLES.map(s => ({ ...s, content: sectionContent(s) }));

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

  /* Supplying the logo the crawl could not find.
     ------------------------------------------------------------------
     extract_logos reads the mark out of the site's markup, which works when a site has one
     and finds nothing when it does not — and a scaffolded app has no logo, only its
     framework's icon. core/brand_kit now refuses to pass those off as brand assets, so the
     honest result for such a site is an empty logo panel. That leaves the user with no way
     to supply the real file at all, which is why this exists: the brand kit is editable
     everywhere else, and the logo is the one asset every generated creative wants.

     Stored through /api/media/upload like every other image in the product, so the URL is
     one this server owns rather than a link to somewhere that may stop serving it. */
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const patchProfile = async (body: Record<string, unknown>) => {
    const r = await fetch(`/api/workspaces/${workspaceId}/brand-profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(d.detail || `Save failed (${r.status})`);
    }
    setProfile(await r.json());
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';                    // so the same file can be picked again
    if (!file || !workspaceId) return;
    setUploadingLogo(true);
    setLogoError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const up = await fetch('/api/media/upload', { method: 'POST', headers: authHeaders(), body: form });
      const data = await up.json().catch(() => null);
      if (!up.ok || !data?.url) throw new Error((data && data.detail) || `Upload failed (${up.status})`);
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      // Prepended, not appended: the first entry is what the kit shows as the primary mark,
      // and someone uploading a logo means this one.
      await patchProfile({ logos: [{ type: 'Uploaded', url: data.url, format: ext, variant: '' }, ...logos] });
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Could not upload that file.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleLogoRemove = async (url: string) => {
    if (!workspaceId) return;
    setLogoError(null);
    try {
      await patchProfile({ logos: logos.filter(l => l.url !== url) });
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Could not remove that logo.');
    }
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
      const section = SECTION_BY_ID[editingSection];
      let body: Record<string, unknown>;

      if (section?.kind === 'profile') {
        // A column on the profile rather than a key inside the guidelines JSON.
        body = { [editingSection]: editDraft.trim() };
      } else {
        // A list is typed one item per line; blanks are dropped so a stray newline does
        // not become an empty category.
        const value = section?.kind === 'list'
          ? editDraft.split('\n').map(v => v.trim()).filter(Boolean)
          : section?.kind === 'personas'
            // Split on the em dash the display writes. A line with no dash is all persona
            // and no hook — a half-filled entry, not an error, so it is kept.
            ? editDraft.split('\n').map(v => v.trim()).filter(Boolean).map(line => {
                const i = line.indexOf('—');
                return i === -1
                  ? { persona: line, hook: '' }
                  : { persona: line.slice(0, i).trim(), hook: line.slice(i + 1).trim() };
              })
            : editDraft;
        // Merged over the existing guidelines object, never replacing it: the other
        // sections and everything the crawl wrote (personas, founded year, accents) live
        // in the same JSON column, and a PATCH that sent only this field would erase them.
        body = { guidelines: { ...guidelines, [editingSection]: value } };
      }

      const r = await fetch(`/api/workspaces/${workspaceId}/brand-profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
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

  /** Save a structured section. The editor returns a partial guidelines object (claims
   *  writes two keys at once), which is merged over what is stored - every other section
   *  and the crawl's bookkeeping live in the same JSON column. */
  const saveStructured = async (patch: Record<string, unknown>) => {
    if (!workspaceId) return;
    setSavingSection(true);
    setEditError(null);
    try {
      const r = await fetch(`/api/workspaces/${workspaceId}/brand-profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ guidelines: { ...guidelines, ...patch } }),
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

      {/* Why the panel is empty, when it is. Previously both states rendered the same blank
          shell, so a still-loading vault and a failed one were indistinguishable. */}
      {loadState.phase === 'loading' && !profile && (
        <div style={{ padding: '14px 18px', borderRadius: '12px', fontSize: '13px',
                      background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
                      color: 'var(--text-secondary)' }}>
          Loading this brand’s knowledge…
        </div>
      )}
      {loadState.phase === 'error' && (
        <div style={{ padding: '14px 18px', borderRadius: '12px', fontSize: '13px',
                      display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
                      background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.3)',
                      color: '#ff6b7a' }}>
          <span>{loadState.message}</span>
          <button
            onClick={() => setRetryKey(k => k + 1)}
            style={{ padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px',
                     fontWeight: 700, background: 'rgba(255,71,87,0.15)', color: '#ff6b7a',
                     border: '1px solid rgba(255,71,87,0.4)' }}
          >
            Retry
          </button>
        </div>
      )}

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
            <input type="file" ref={logoInputRef} onChange={handleLogoUpload} accept="image/*" style={{ display: 'none' }} />
            <button
              onClick={() => logoInputRef.current?.click()}
              disabled={uploadingLogo || !workspaceId}
              style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
                       color: '#fff', borderRadius: '100px', padding: '6px 14px', fontSize: '12px', fontWeight: 600,
                       cursor: uploadingLogo ? 'wait' : 'pointer' }}
            >
              {uploadingLogo ? 'Uploading…' : 'Upload logo'}
            </button>
          </div>
          {logoError && (
            <div style={{ fontSize: '11.5px', color: 'var(--warning)', marginBottom: '10px' }}>{logoError}</div>
          )}

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
                    {/* A crawl can pick the wrong image out of a busy header. Removing it here
                        beats re-running onboarding to correct one mistake. */}
                    <button
                      onClick={() => handleLogoRemove(logo.url)}
                      style={{ marginLeft: '8px', background: 'none', border: 'none', padding: 0,
                               color: 'var(--text-muted)', fontSize: '10px', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      remove
                    </button>
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

      {/* ── BRAND AT A GLANCE ─────────────────────────────────────── */}
      {/* The answers to "who is this brand, what does it offer, who for" above the fold,
          so the page opens with the summary rather than with a tab strip to hunt through.
          Each cell is omitted when unknown rather than shown as a dash: an empty cell here
          is a real signal that the crawl did not establish it. */}
      {(() => {
        const g = guidelines as Record<string, any>;
        const signals = (g.positioning_signals || {}) as Record<string, string>;
        const cells: { label: string; value: string }[] = [
          { label: 'Industry', value: g.industry || '' },
          { label: 'Primary market', value: g.markets || '' },
          { label: 'Business model', value: g.business_model || '' },
          {
            label: 'Positioning',
            value: [signals.price_tier, signals.orientation, signals.reach]
              .filter(Boolean).join(' · '),
          },
          {
            label: 'Core audience',
            value: (profile?.target_audience || '').slice(0, 120),
          },
        ].filter(c => c.value);

        const vp = g.value_proposition || '';
        if (!vp && !cells.length) return null;

        return (
          <div className="glow-card" style={{
            background: '#0a0a12', borderRadius: '20px', padding: '24px 28px',
            border: '1px solid rgba(255, 107, 0, 0.25)',
            display: 'flex', flexDirection: 'column', gap: '18px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Compass size={18} color="#FF6B00" />
              <h3 style={{ fontSize: '17px', color: '#fff', margin: 0, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
                Brand at a glance
              </h3>
            </div>

            {vp && (
              <div style={{ fontSize: '16px', color: '#fff', fontWeight: 700, lineHeight: 1.5,
                            borderLeft: '3px solid #FF6B00', paddingLeft: '14px' }}>
                {vp}
              </div>
            )}

            {!!cells.length && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: '16px' }}>
                {cells.map(c => (
                  <div key={c.label} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase',
                                   letterSpacing: '0.05em', color: 'var(--text-muted)' }}>{c.label}</span>
                    <span style={{ fontSize: '13.5px', color: 'rgba(255,255,255,0.9)', lineHeight: 1.5 }}>{c.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── KNOWLEDGE QUALITY ─────────────────────────────────────── */}
      {/* Computed server-side by core.brand_kit.assess_brand_kit from the stored kit, not
          asserted. Shown because a thin extraction that LOOKS finished is the failure mode
          worth surfacing: it silently degrades every agent that reads this brand. */}
      {profile?.quality && typeof profile.quality.completeness_pct === 'number' && (() => {
        const q = profile.quality!;
        const bar = (label: string, pct: number, colour: string) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '150px', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
              <span style={{ color: colour, fontWeight: 800 }}>{pct}%</span>
            </div>
            <div style={{ height: '5px', borderRadius: '100px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', background: colour }} />
            </div>
          </div>
        );
        const tone = (pct: number) => (pct >= 75 ? '#00E676' : pct >= 45 ? '#FFB300' : '#ff4757');
        const counts = q.counts || {};
        return (
          <div className="glow-card" style={{
            background: '#0a0a12', borderRadius: '20px', padding: '22px 26px',
            border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Target size={17} color="#00D2FF" />
                <h3 style={{ fontSize: '16px', color: '#fff', margin: 0, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
                  Knowledge quality
                </h3>
              </div>
              {(() => {
                // Provenance. Without it, knowledge crawled months ago is presented exactly
                // like knowledge crawled this morning, and a site that has since changed
                // goes unnoticed.
                const meta = ((guidelines as Record<string, any>)._extraction || {}) as Record<string, any>;
                const when = meta.last_crawled ? String(meta.last_crawled).slice(0, 10) : '';
                const days = when ? Math.floor((Date.now() - new Date(when).getTime()) / 86400000) : -1;
                const stale = days > 90;
                return (
                  <span style={{ fontSize: '11.5px', color: stale ? '#FFB300' : 'var(--text-muted)' }}>
                    {when
                      ? `Crawled ${when} from ${meta.source_pages || '?'} page(s)${stale ? ' — may be out of date' : ''}`
                      : 'Measured from the stored knowledge, not estimated'}
                  </span>
                );
              })()}
            </div>

            <div style={{ display: 'flex', gap: '22px', flexWrap: 'wrap' }}>
              {bar('Completeness', q.completeness_pct, tone(q.completeness_pct))}
              {typeof q.connected_pct === 'number'
                && bar('Connected', q.connected_pct, tone(q.connected_pct))}
              {bar('Evidence coverage', q.evidence_coverage_pct, tone(q.evidence_coverage_pct))}
              {bar('Agent readiness', q.agent_readiness_pct, tone(q.agent_readiness_pct))}
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                ['Specificity', q.specificity],
                ['Personas', counts.personas],
                ['Products', counts.products],
                ['Differentiators', counts.usps],
                ['Voice traits', counts.voice_traits],
                ['Safe claims', counts.verified_claims],
              ].filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => (
                <span key={String(k)} style={{
                  fontSize: '11.5px', color: 'var(--text-secondary)',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                  padding: '4px 12px', borderRadius: '100px',
                }}>
                  {k}: <b style={{ color: '#fff' }}>{String(v)}</b>
                </span>
              ))}
            </div>

            {!!(q.categories_without_audience || []).length && (
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <b style={{ color: '#00D2FF' }}>No audience matched:</b>{' '}
                {q.categories_without_audience!.join(', ')}. Campaigns have no persona to aim these at —
                add a persona that names them, or a category the personas already mention.
              </div>
            )}
            {!!(q.personas_without_offer || []).length && (
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <b style={{ color: '#FFB300' }}>No products matched:</b>{' '}
                {q.personas_without_offer!.join(', ')}. Nothing to promote to these segments yet.
              </div>
            )}
            {!!(q.completeness_missing || []).length && (
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <b style={{ color: '#FFB300' }}>Not yet extracted:</b>{' '}
                {q.completeness_missing.join(', ').replace(/_/g, ' ')}. Run Sync Knowledge Graph to fill these.
              </div>
            )}
            {!!(q.generic_phrases || []).length && (
              <div style={{ fontSize: '12.5px', color: '#ff6b7a', lineHeight: 1.6 }}>
                Generic wording found ({q.generic_phrases.join(', ')}) — these constrain nothing and weaken generated copy.
              </div>
            )}
          </div>
        );
      })()}

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

            {editingSection === activeKnowledgeTab
              && EDITABLE_STRUCTURED.includes(SECTION_BY_ID[activeKnowledgeTab]?.kind) ? (
              <BrandStructuredEditor
                kind={(SECTION_BY_ID[activeKnowledgeTab].kind === 'personas'
                  ? 'personas'
                  : SECTION_BY_ID[activeKnowledgeTab].kind) as StructuredKind}
                guidelines={guidelines}
                saving={savingSection}
                error={editError}
                onSave={saveStructured}
                onCancel={() => { setEditingSection(null); setEditError(null); }}
              />
            ) : editingSection === activeKnowledgeTab ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Says how the field is stored, so a list is not typed as prose. */}
                {SECTION_BY_ID[activeKnowledgeTab]?.hint && (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {SECTION_BY_ID[activeKnowledgeTab].hint}
                  </div>
                )}
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
              STRUCTURED_KINDS.includes(SECTION_BY_ID[activeKnowledgeTab]?.kind)
                ? (activeKnowledgeTab === 'verified_claims'
                    ? renderClaims(
                        (guidelines.verified_claims as unknown[]) || [],
                        (guidelines.unsupported_topics as unknown[]) || [])
                    : renderStructured(
                        SECTION_BY_ID[activeKnowledgeTab].kind,
                        guidelines[activeKnowledgeTab]))
                : renderSectionBody(
                    SECTION_BY_ID[activeKnowledgeTab],
                    knowledgeSections.find(s => s.id === activeKnowledgeTab)?.content || ''
                  )
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
